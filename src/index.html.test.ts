import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const indexHtml = readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

describe('index.html — Google Fonts <link> (P1.4)', () => {
  it('loads Caveat weights 500 and 700 with display=swap', () => {
    expect(indexHtml).toMatch(/family=Caveat:wght@500;700/);
    expect(indexHtml).toMatch(/display=swap/);
  });

  it('does not load any extra Caveat weights', () => {
    expect(indexHtml).not.toMatch(/Caveat[^&"]*wght@[^"&]*;400/);
    expect(indexHtml).not.toMatch(/Caveat[^&"]*wght@[^"&]*;600/);
    expect(indexHtml).not.toMatch(/Caveat[^&"]*wght@[^"&]*;800/);
  });

  it('keeps the existing Nunito and Fredoka families', () => {
    expect(indexHtml).toMatch(/family=Nunito:wght@400;500;600;700;800/);
    expect(indexHtml).toMatch(/family=Fredoka:wght@500;600;700/);
  });

  it('keeps the two preconnect hints in place', () => {
    expect(indexHtml).toMatch(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
    expect(indexHtml).toMatch(
      /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/,
    );
  });
});

describe('theme-color and OpenGraph (P1.5)', () => {
  it('uses the Margin Notes paper hex for theme-color', () => {
    expect(indexHtml).toMatch(/<meta name="theme-color" content="#F5EFE2"\s*\/>/);
    expect(indexHtml).not.toMatch(/<meta name="theme-color" content="#F5C842"/);
  });

  it('declares the SVG favicon and the apple-touch-icon', () => {
    expect(indexHtml).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"\s*\/>/);
    expect(indexHtml).toMatch(
      /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"\s*\/>/,
    );
  });

  it('declares a canonical URL pointing at the GitHub Pages deployment', () => {
    expect(indexHtml).toMatch(
      /<link rel="canonical" href="https:\/\/travisarbon\.github\.io\/crazy-checkers\/"\s*\/>/,
    );
  });

  describe('OpenGraph meta block', () => {
    it('declares og:type, og:title, og:description, og:url', () => {
      expect(indexHtml).toMatch(/<meta property="og:type" content="website"\s*\/>/);
      expect(indexHtml).toMatch(/<meta property="og:title" content="Crazy Checkers"\s*\/>/);
      expect(indexHtml).toMatch(/<meta property="og:description" content="[^"]+"\s*\/>/);
      expect(indexHtml).toMatch(
        /<meta property="og:url" content="https:\/\/travisarbon\.github\.io\/crazy-checkers\/"\s*\/>/,
      );
    });

    it('declares og:image with absolute GitHub Pages URL and explicit dimensions', () => {
      expect(indexHtml).toMatch(
        /<meta property="og:image" content="https:\/\/travisarbon\.github\.io\/crazy-checkers\/og-image\.png"\s*\/>/,
      );
      expect(indexHtml).toMatch(/<meta property="og:image:width" content="1200"\s*\/>/);
      expect(indexHtml).toMatch(/<meta property="og:image:height" content="630"\s*\/>/);
    });

    it('declares og:image:alt for accessibility-conscious scrapers', () => {
      expect(indexHtml).toMatch(/<meta property="og:image:alt" content="[^"]+"\s*\/>/);
    });

    it('does not use any relative path for og:image (scrapers do not resolve relative URLs)', () => {
      expect(indexHtml).not.toMatch(/<meta property="og:image" content="\/og-image\.png"/);
      expect(indexHtml).not.toMatch(/<meta property="og:image" content="og-image\.png"/);
    });

    it('declares og:site_name and og:locale', () => {
      expect(indexHtml).toMatch(/<meta property="og:site_name" content="Crazy Checkers"\s*\/>/);
      expect(indexHtml).toMatch(/<meta property="og:locale" content="en_US"\s*\/>/);
    });
  });

  describe('Twitter Card meta block', () => {
    it('uses summary_large_image to match the 1200x630 OG image', () => {
      expect(indexHtml).toMatch(/<meta name="twitter:card" content="summary_large_image"\s*\/>/);
    });

    it('declares twitter:title, twitter:description, twitter:image', () => {
      expect(indexHtml).toMatch(/<meta name="twitter:title" content="Crazy Checkers"\s*\/>/);
      expect(indexHtml).toMatch(/<meta name="twitter:description" content="[^"]+"\s*\/>/);
      expect(indexHtml).toMatch(
        /<meta name="twitter:image" content="https:\/\/travisarbon\.github\.io\/crazy-checkers\/og-image\.png"\s*\/>/,
      );
    });
  });
});
