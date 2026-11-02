// Référencement et partage (v2.2) : robots.txt, sitemap.xml et balises Open Graph / Twitter de
// l'accueil. L'adresse publique du site (SITE_URL, voir .env.example) rend les adresses absolues ;
// sans elle, le build reste valide (balises relatives, pas de sitemap).

import type { HtmlTagDescriptor, Plugin } from 'vite';

/** Pages publiques à référencer, en plus de l'accueil (adresses sans « .html », comme les sert Cloudflare). */
export const PUBLIC_PAGES = ['/confidentialite', '/a-propos'] as const;

const TITLE = 'StickFlow · Animateur de stickman assisté par IA';
const DESCRIPTION =
  'Animez des stickmans image par image dans votre navigateur, même hors ligne. L’IA ajoute les images intermédiaires et rend vos boucles fluides ; vous gardez le contrôle. Export GIF et vidéo.';

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

export function robotsTxt(siteUrl: string | null): string {
  const rules = 'User-agent: *\nAllow: /\nDisallow: /api/\n';
  return siteUrl ? `${rules}\nSitemap: ${trimSlash(siteUrl)}/sitemap.xml\n` : rules;
}

export function sitemapXml(siteUrl: string, pages: readonly string[]): string {
  const base = trimSlash(siteUrl);
  const urls = ['/', ...pages].map((path) => `  <url><loc>${base}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export interface Tag {
  tag: 'meta' | 'link';
  attrs: Record<string, string>;
}

export function socialTags(siteUrl: string | null): Tag[] {
  const base = siteUrl ? trimSlash(siteUrl) : '';
  const image = `${base}/og-image.png`;
  const meta = (key: 'name' | 'property', id: string, content: string): Tag => ({ tag: 'meta', attrs: { [key]: id, content } });
  return [
    meta('name', 'description', DESCRIPTION),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'StickFlow'),
    meta('property', 'og:locale', 'fr_FR'),
    meta('property', 'og:title', TITLE),
    meta('property', 'og:description', DESCRIPTION),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', 'L’éditeur de StickFlow : un stickman en pleine course et sa timeline.'),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', TITLE),
    meta('name', 'twitter:description', DESCRIPTION),
    meta('name', 'twitter:image', image),
    ...(siteUrl ? [meta('property', 'og:url', `${base}/`), { tag: 'link' as const, attrs: { rel: 'canonical', href: `${base}/` } }] : []),
  ];
}

/** Ajoute les balises à l'accueil et écrit robots.txt et sitemap.xml dans dist/. */
export function siteFilesPlugin(siteUrl: string | null): Plugin {
  return {
    name: 'stickflow-site-files',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { path }): HtmlTagDescriptor[] {
        if (path !== '/index.html') return [];
        return socialTags(siteUrl).map(({ tag, attrs }) => ({ tag, attrs, injectTo: 'head' }));
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) });
      if (siteUrl) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl, PUBLIC_PAGES) });
      else this.warn('SITE_URL absent : pas de sitemap.xml, balises de partage en adresses relatives (voir .env.example).');
    },
  };
}
