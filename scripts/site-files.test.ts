import { describe, expect, it } from 'vitest';

import { PUBLIC_PAGES, robotsTxt, sitemapXml, socialTags } from './site-files';

const SITE = 'https://stickflow.example.workers.dev';

describe('robotsTxt', () => {
  it('allows everything, keeps the image proxy out, and points to the sitemap', () => {
    expect(robotsTxt(SITE)).toBe(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  });

  it('has no sitemap line while the address of the site is unknown', () => {
    expect(robotsTxt(null)).toBe('User-agent: *\nAllow: /\nDisallow: /api/\n');
  });
});

describe('sitemapXml', () => {
  it('lists the home page and the public pages with absolute addresses', () => {
    const xml = sitemapXml(`${SITE}/`, PUBLIC_PAGES);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).toContain(`<loc>${SITE}/confidentialite</loc>`);
    expect(xml).toContain(`<loc>${SITE}/a-propos</loc>`);
  });
});

describe('socialTags', () => {
  it('describes the app for sharing, with absolute addresses when the site is known', () => {
    const tags = socialTags(SITE);
    expect(tags).toContainEqual({ tag: 'meta', attrs: { property: 'og:image', content: `${SITE}/og-image.png` } });
    expect(tags).toContainEqual({ tag: 'meta', attrs: { property: 'og:url', content: `${SITE}/` } });
    expect(tags).toContainEqual({ tag: 'link', attrs: { rel: 'canonical', href: `${SITE}/` } });
    expect(tags).toContainEqual({ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } });
  });

  it('falls back to relative addresses, without canonical link, when it is unknown', () => {
    const tags = socialTags(null);
    expect(tags).toContainEqual({ tag: 'meta', attrs: { property: 'og:image', content: '/og-image.png' } });
    expect(tags.some((tag) => tag.attrs.rel === 'canonical' || tag.attrs.property === 'og:url')).toBe(false);
  });
});
