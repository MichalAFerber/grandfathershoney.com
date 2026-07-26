# Grandfather's Honey

A Jekyll-powered website celebrating small-scale beekeeping & honey production in rural South Carolina, honoring Lorenzo Lorraine Langstroth, the father of modern beekeeping.

## 🐝 About

This website showcases the legacy of L. L. Langstroth and promotes traditional beekeeping practices. The site features photo galleries, educational resources, and information about sustainable honey production.

> **Dev-standards note:** client website — keeps its own branding, fonts, copyright, and GitHub Pages hosting; the contact form (Turnstile + Forward Email SMTP) and footer credit follow the TGWAB Dev Standards.

## 🛠️ Tech Stack

- **Jekyll** - Static site generator
- **GitHub Pages** - Hosting
- **Custom CSS** - Responsive design with CSS custom properties
- **Vanilla JavaScript** - Interactive features including lightbox gallery with arrow navigation

## 🚀 Features

- **Responsive Design** - Mobile-first approach with smooth animations
- **Photo Gallery** - Interactive lightbox with keyboard and arrow navigation
- **Smooth Scrolling** - Enhanced navigation with anchor links
- **SEO Optimized** - Meta tags, Open Graph, and sitemap.xml
- **Custom 404 Page** - Branded error page with helpful navigation
- **Resource Library** - Curated books, videos, and websites about beekeeping
- **First-Party Contact Form** - Cloudflare Turnstile protected, relayed via a Cloudflare Worker over Forward Email SMTP (no third-party form service)

## 📁 Project Structure

```tree
├── _config.yml          # Jekyll configuration
├── _data/               # YAML data files (books, videos, websites)
├── _includes/           # Reusable components (header, footer)
├── _layouts/            # Page layouts
├── assets/
│   ├── css/
│   │   └── main.css     # Styles with CSS custom properties
│   ├── js/
│   │   └── main.js      # Interactive features
│   └── images/          # Image assets
├── 404.html             # Custom error page
└── index.html           # Homepage
```

## 🔧 Local Development

### Prerequisites

- Ruby (>= 2.5)
- Bundler
- Jekyll

### Installation

```bash
# Install dependencies
bundle install

# Serve locally
bundle exec jekyll serve

# Build for production
bundle exec jekyll build
```

The site will be available at `http://localhost:4000`

## 📝 Content Management

### Adding Gallery Images

Place images in `assets/images/gallery/` and they'll automatically appear in the gallery section.

### Updating Resources

Edit the YAML files in `_data/`:

- `books.yml` - Beekeeping books
- `videos.yml` - Educational videos
- `websites.yml` - Useful websites

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

## 📄 License

© 2026 Grandfather's Honey. All rights reserved.

## 🔗 Links

- **Live Site**: [grandfathershoney.com](https://grandfathershoney.com)
- **About L. L. Langstroth**: The inventor of the movable-frame beehive

---

Built with ❤️ and 🍯
