/**
 * Contact-form relay for grandfathershoney.com.
 *
 * POST /contact {name, email, subject, message, token}
 *   → verifies Cloudflare Turnstile server-side
 *   → relays the message through the Forward Email REST API
 * GET /health → {"status":"up"}
 *
 * Vars (wrangler.toml): SITE_NAME, FE_API_USER, MAIL_FROM, MAIL_TO,
 * ALLOWED_ORIGINS
 * Secrets (wrangler secret put): FE_API_PASS, TURNSTILE_SECRET
 *
 * FE_API_USER / FE_API_PASS are the *alias* credentials for
 * noreply@grandfathershoney.com, not the account-wide API token. Forward Email
 * accepts either on this endpoint; the alias pair is scoped to the one mailbox,
 * so a leak here cannot send as any other domain in the account.
 */
const FE_API = 'https://api.forwardemail.net/v1/emails';
const FE_TIMEOUT_MS = 30000;

const LIMITS = { name: 120, email: 254, subject: 160, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (!env.FE_API_USER || !env.FE_API_PASS || !env.TURNSTILE_SECRET) {
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
      console.log('Forward Email send failed:', e && e.message);
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

  // Forward Email builds the MIME itself (Nodemailer-style options), so the
  // worker no longer hand-rolls headers, RFC 2047 encoding or dot-stuffing.
  await feSend(env, {
    from: displayName(siteName) + ' <' + from + '>',
    to,
    replyTo: f.email,
    subject,
    html
  });
}

async function feSend(env, message) {
  const auth = 'Basic ' + b64Utf8(env.FE_API_USER + ':' + env.FE_API_PASS);
  const res = await fetch(FE_API, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(FE_TIMEOUT_MS)
  });
  if (!res.ok) {
    // Body may carry the alias/plan reason; keep it short and never log creds.
    const detail = await res.text().catch(() => '');
    throw new Error('Forward Email ' + res.status + ': ' + detail.slice(0, 200));
  }
}

// Quoted-string display name. Non-ASCII needs no RFC 2047 encoding here --
// Forward Email builds the MIME and encodes the header itself.
function displayName(name) {
  return '"' + name.replace(/([\\"])/g, '\\$1') + '"';
}

function b64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
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
