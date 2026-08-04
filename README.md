# Grandfather's Honey

A static website celebrating small-scale beekeeping & honey production in rural South Carolina, honoring Lorenzo Lorraine Langstroth, the father of modern beekeeping.

## 🐝 About

This website showcases the legacy of L. L. Langstroth and promotes traditional beekeeping practices. The site features photo galleries, educational resources, and information about sustainable honey production.

> **Dev-standards note:** client website — keeps its own branding, fonts, and copyright; the contact form (Turnstile + the house mailer Worker), footer credit, and site plumbing follow the TGWAB Dev Standards.

## 🛠️ Tech Stack

- **Static HTML** - No build step; the repo is the deployed output
- **Cloudflare Pages** - Hosting, via the Pages Git integration
- **Custom CSS** - Responsive design with CSS custom properties
- **Vanilla JavaScript** - Interactive features including lightbox gallery with arrow navigation

## 🚀 Features

- **Responsive Design** - Mobile-first approach with smooth animations
- **Photo Gallery** - Interactive lightbox with keyboard and arrow navigation
- **Smooth Scrolling** - Enhanced navigation with anchor links
- **SEO Optimized** - Meta tags, Open Graph, and sitemap.xml
- **Custom 404 Page** - Branded error page with helpful navigation
- **Resource Library** - Curated books, videos, and websites about beekeeping
- **First-Party Contact Form** - Cloudflare Turnstile protected, relayed via the house mailer Worker over the Forward Email REST API (no third-party form service)

## 📁 Project Structure

```tree
├── index.html           # Homepage
├── 404.html             # Custom error page
├── _headers             # Cloudflare Pages security headers (CSP etc.)
├── robots.txt           # Search engine crawling rules
├── sitemap.xml          # XML sitemap
├── sitemap-index.xml    # Sitemap index (advertised in robots.txt)
├── llms.txt             # Site summary for AI crawlers
├── ads.txt              # Programmatic ad inventory declaration
├── site.webmanifest     # Web app manifest
├── favicon.ico          # Favicon (16/32/48)
├── apple-touch-icon.png # Apple touch icon (180x180)
├── icon-192.png         # PWA icon (192x192)
├── icon-512.png         # PWA icon (512x512)
├── icon-512-maskable.png# PWA maskable icon (512x512)
├── .well-known/
│   └── security.txt     # Security policy
└── assets/
    ├── css/
    │   └── main.css     # Styles with CSS custom properties
    ├── js/
    │   └── main.js      # Interactive features
    └── images/          # Image assets
```

## 🔧 Local Development

No build step—serve the repo root with any static server:

```bash
python3 -m http.server 8000
# or: npx http-server
```

The site will be available at `http://localhost:8000`

## 🚀 Deploy

One repo → one Cloudflare Pages project (TGWAB account), deployed by the **Pages Git integration** on every push to `main`. No build step—the repo is the output; framework preset **None**. There is no other deploy path.

The canonical host is **`grandfathershoney.com`** (apex); `www.grandfathershoney.com` 301s to it.

## 📝 Content Management

### Adding Gallery Images

Place images in `assets/images/` and add the corresponding markup in `index.html`'s gallery section.

### Contact Form

The contact form posts to the shared **mailer**
(`https://mailer.thompsonblack.us/contact/grandfathershoney`), which verifies
Turnstile server-side, enforces a per-product Origin allowlist, fixes the
recipient to the herald registry's `contact_to`, and emits the DEV-STANDARDS §6
house format under golden tests.

There is no per-site Worker or Function: the endpoint and Turnstile sitekey are
set directly in `index.html`, and per-product config (from address, recipient,
allowed origins) lives in the herald registry — change it with `notifyctl`, then
`notifyctl sync-mailer`.

### Modifying Styles

The site uses CSS custom properties (variables) defined in `assets/css/main.css`:

- Color scheme based on honey and amber tones
- Responsive spacing and typography
- Easy theme customization

## 🎨 Design Features

- **Color Palette**: Honey gold (#d4a03a), cream (#faf8f5), and brown (#4a3728)
- **Typography**: Playfair Display for headings, Source Sans Pro for body text
- **Animations**: Smooth transitions and fade-in effects
- **Lightbox Gallery**: Click any gallery image to view full-size with arrow navigation

## 📋 Standards

Built to the TGWAB Dev Standards **v2.19.0** (internal). Client property, **Fully managed** tier—the product-facing sections (§1 branding, §10 link-backs, §17 launch checklist) do not apply.

### Deviations

- §2—Astro + Tailwind stack—hand-authored static site, migrated off the original Jekyll build—2026-08-04—permanent
- §2—no runtime CDNs—Playfair Display & Source Sans Pro load from Google Fonts; self-hosting the woff2 files is the open follow-up—2026-08-04—review 2026-11-01
- §11—generated sitemap—no build step on this site, so `sitemap.xml` is maintained by hand—2026-08-04—permanent
- §14—dark mode legibility—site is light-only by client design (`color-scheme: light only`)—2026-08-04—permanent

## 📄 License

© Grandfather's Honey. All rights reserved.

## 🔗 Links

- **Live Site**: [grandfathershoney.com](https://grandfathershoney.com)
- **About L. L. Langstroth**: The inventor of the movable-frame beehive

---

Built with ❤️ and 🍯
