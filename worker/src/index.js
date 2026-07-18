/**
 * Contact-form relay for grandfathershoney.com.
 *
 * POST /contact {name, email, subject, message, token}
 *   → verifies Cloudflare Turnstile server-side
 *   → relays the message through Forward Email SMTP (implicit TLS)
 * GET /health → {"status":"up"}
 *
 * Vars (wrangler.toml): SITE_NAME, SMTP_HOST, SMTP_PORT, SMTP_USER,
 * MAIL_FROM, MAIL_TO, ALLOWED_ORIGINS
 * Secrets (wrangler secret put): SMTP_PASS, TURNSTILE_SECRET
 */
import { connect } from 'cloudflare:sockets';

const LIMITS = { name: 120, email: 254, subject: 160, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SMTP_TIMEOUT_MS = 30000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    if (request.method === 'GET' && path === '/health') {
      return json({ status: 'up' }, 200, cors);
    }
    if (request.method !== 'POST' || (path !== '/contact' && path !== '/')) {
      return json({ ok: false, error: 'Not found.' }, 404, cors);
    }

    const origin = request.headers.get('Origin');
    if (origin && !allowedOrigins(env).includes(origin)) {
      return json({ ok: false, error: 'Origin not allowed.' }, 403, cors);
    }
    if (!env.SMTP_USER || !env.SMTP_PASS || !env.TURNSTILE_SECRET) {
      return json({ ok: false, error: 'Contact form is not configured yet.' }, 503, cors);
    }

    let fields;
    try {
      fields = await readFields(request);
    } catch (e) {
      return json({ ok: false, error: 'Bad request: ' + e.message }, 400, cors);
    }
    const problem = validate(fields);
    if (problem) {
      return json({ ok: false, error: problem }, 400, cors);
    }

    const human = await verifyTurnstile(
      env.TURNSTILE_SECRET,
      fields.token,
      request.headers.get('CF-Connecting-IP')
    );
    if (!human) {
      return json({ ok: false, error: 'Human verification failed. Please try again.' }, 400, cors);
    }

    try {
      await sendMail(env, fields);
    } catch (e) {
      console.log('SMTP send failed:', e && e.message);
      return json({ ok: false, error: 'Could not send your message right now. Please try again later.' }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  }
};

async function readFields(request) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  let raw;
  if (type.includes('application/json')) {
    raw = await request.json();
  } else if (type.includes('form')) {
    const form = await request.formData();
    raw = Object.fromEntries(form);
    raw.token = raw.token || raw['cf-turnstile-response'];
  } else {
    throw new Error('unsupported content type');
  }
  // Header-injection guard: user values never carry CR/LF into headers.
  const clean = (v) => String(v ?? '').replace(/[\r\n\0]/g, ' ').trim();
  return {
    name: clean(raw.name),
    email: clean(raw.email),
    subject: clean(raw.subject),
    message: String(raw.message ?? '').replace(/\0/g, '').trim(),
    token: String(raw.token ?? '')
  };
}

function validate(f) {
  if (!f.name) return 'Please enter your name.';
  if (f.name.length > LIMITS.name) return 'Name is too long.';
  if (!f.email || f.email.length > LIMITS.email || !EMAIL_RE.test(f.email)) {
    return 'Please enter a valid email address.';
  }
  if (!f.subject) return 'Please enter a subject.';
  if (f.subject.length > LIMITS.subject) return 'Subject is too long.';
  if (!f.message) return 'Please enter a message.';
  if (f.message.length > LIMITS.message) return 'Message is too long.';
  if (!f.token) return 'Missing human-verification token.';
  return null;
}

async function verifyTurnstile(secret, token, ip) {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip || undefined })
  });
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.success;
}

async function sendMail(env, f) {
  const siteName = env.SITE_NAME || "Grandfather's Honey";
  const from = env.MAIL_FROM;
  const to = env.MAIL_TO;
  // DEVSTANDARDS §6: subject is <WEBSITE_NAME>⎯<SUBJECT>
  const subject = siteName + '⎯' + f.subject;
  // DEVSTANDARDS §6: HTML body, tab after the labels, blank line before the
  // message, layout preserved with white-space:pre.
  const html =
    '<div style="white-space:pre; font-family:system-ui, sans-serif;">Name:\t' + escapeHtml(f.name) +
    '\nEmail:\t' + escapeHtml(f.email) +
    '\n\n' + escapeHtml(f.message) + '</div>';

  const message = [
    'From: ' + displayName(siteName) + ' <' + from + '>',
    'To: <' + to + '>',
    'Reply-To: <' + f.email + '>',
    'Subject: ' + encodeHeaderWord(subject),
    'Date: ' + new Date().toUTCString().replace(/GMT$/, '+0000'),
    'Message-ID: <' + crypto.randomUUID() + '@' + from.split('@')[1] + '>',
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64Utf8(html))
  ].join('\r\n');

  await smtpSend(env, from, to, message);
}

async function smtpSend(env, from, to, message) {
  const socket = connect(
    { hostname: env.SMTP_HOST || 'smtp.forwardemail.net', port: Number(env.SMTP_PORT || 465) },
    { secureTransport: 'on', allowHalfOpen: false }
  );
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buffer = '';
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('SMTP timeout')), SMTP_TIMEOUT_MS);
  });

  const send = (cmd) => writer.write(enc.encode(cmd + '\r\n'));

  async function expect(codes) {
    for (;;) {
      if (buffer.endsWith('\r\n')) {
        const lines = buffer.slice(0, -2).split('\r\n');
        const last = lines[lines.length - 1];
        if (/^\d{3}( |$)/.test(last)) {
          const reply = buffer;
          buffer = '';
          const code = Number(last.slice(0, 3));
          if (!codes.includes(code)) {
            throw new Error('SMTP ' + code + ': ' + reply.trim().slice(0, 200));
          }
          return code;
        }
      }
      const { value, done } = await reader.read();
      if (done) throw new Error('SMTP connection closed unexpectedly');
      buffer += dec.decode(value, { stream: true });
    }
  }

  const conversation = (async () => {
    await expect([220]);
    await send('EHLO ' + from.split('@')[1]);
    await expect([250]);
    await send('AUTH LOGIN');
    await expect([334]);
    await send(b64Utf8(env.SMTP_USER));
    await expect([334]);
    await send(b64Utf8(env.SMTP_PASS));
    await expect([235]);
    await send('MAIL FROM:<' + from + '>');
    await expect([250]);
    await send('RCPT TO:<' + to + '>');
    await expect([250, 251]);
    await send('DATA');
    await expect([354]);
    const stuffed = ('\r\n' + message).replace(/\r\n\./g, '\r\n..').slice(2);
    await writer.write(enc.encode(stuffed + '\r\n.\r\n'));
    await expect([250]);
    await send('QUIT');
  })();

  try {
    await Promise.race([conversation, timeout]);
  } finally {
    clearTimeout(timer);
    try { await socket.close(); } catch (e) { /* already closed */ }
  }
}

function displayName(name) {
  if (/^[\x20-\x7e]*$/.test(name)) {
    return '"' + name.replace(/([\\"])/g, '\\$1') + '"';
  }
  return encodeHeaderWord(name);
}

// RFC 2047 B-encoding, folded into short encoded-words. ASCII passes through.
function encodeHeaderWord(value) {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const encoder = new TextEncoder();
  const words = [];
  let chunk = '';
  let bytes = 0;
  for (const ch of value) {
    const len = encoder.encode(ch).length;
    if (bytes + len > 30) {
      words.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += ch;
    bytes += len;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => '=?UTF-8?B?' + b64Utf8(w) + '?=').join('\r\n ');
}

function b64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function wrap76(b64) {
  return b64.replace(/(.{76})(?=.)/g, '$1\r\n');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = { Vary: 'Origin' };
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra }
  });
}
