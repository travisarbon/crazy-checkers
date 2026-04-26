/**
 * Annotation-token contract tests (P2.1).
 *
 * Locks the nine annotation tokens that `src/global.css` ships on `:root`
 * so a future palette tweak, font-chain edit, or rotation re-jig fails CI
 * instead of silently drifting from the design proposal.
 *
 * See: Documentation/UI Overhaul/P2.1-Annotation-Tokens.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { applyTheme } from './themes/theme';
import { marginNotesTheme } from './themes/marginnotes';
import { crazyTheme } from './themes/crazy';

const globalCss = readFileSync(path.resolve(__dirname, 'global.css'), 'utf8');

describe('global.css — annotation tokens (P2.1)', () => {
  describe('source-level presence', () => {
    it('declares the five annotation color tokens with exact hex values', () => {
      expect(globalCss).toMatch(/--pencil-green:\s*#6E8E3A/);
      expect(globalCss).toMatch(/--ballpoint-blue:\s*#3E5BAA/);
      expect(globalCss).toMatch(/--highlighter-yellow:\s*#F5D547/);
      expect(globalCss).toMatch(/--crayon-orange:\s*#E8743C/);
      expect(globalCss).toMatch(/--india-red:\s*#B83A2A/);
    });

    it('declares --annotation-font with the Caveat → Comic Sans MS → cursive chain', () => {
      expect(globalCss).toMatch(
        /--annotation-font:\s*'Caveat',\s*'Comic Sans MS',\s*cursive/,
      );
    });

    it('declares the three annotation rotation tokens', () => {
      expect(globalCss).toMatch(/--annotation-rotation-sm:\s*-2deg/);
      expect(globalCss).toMatch(/--annotation-rotation-md:\s*-4deg/);
      expect(globalCss).toMatch(/--annotation-rotation-lg:\s*8deg/);
    });

    it('groups the new tokens under a single comment header', () => {
      expect(globalCss).toMatch(/Annotation tokens.*P2\.1/s);
    });

    it('does not declare the same annotation token twice', () => {
      // Defensive — catches a future regression where a contributor
      // adds the same --pencil-green in two places.
      const matches = globalCss.match(/--pencil-green:/g);
      expect(matches?.length).toBe(1);
    });

    it('declares the overlay-scrim token as a color-mix derivation (P2.2)', () => {
      expect(globalCss).toMatch(/--ui-overlay-scrim:\s*color-mix\(in srgb, var\(--ui-text\) 55%, transparent\)/);
    });

    it('declares the six move-quality tokens with their canonical hex values (P2.2)', () => {
      expect(globalCss).toMatch(/--quality-brilliant:\s*#00CED1/);
      expect(globalCss).toMatch(/--quality-good:\s*#4CAF50/);
      expect(globalCss).toMatch(/--quality-inaccuracy:\s*#FFC107/);
      expect(globalCss).toMatch(/--quality-mistake:\s*#FF9800/);
      expect(globalCss).toMatch(/--quality-blunder:\s*#F44336/);
      expect(globalCss).toMatch(/--quality-pending:\s*#666666/);
    });

    it('declares the five gallery-track tokens and the eight gallery-wave tokens (P2.2)', () => {
      ['pm', 'cv', 'rb', 'l', 'wp'].forEach((t) => {
        expect(globalCss).toMatch(new RegExp(`--gallery-track-${t}:\\s*#[0-9A-Fa-f]{6}`));
      });
      for (let i = 1; i <= 8; i += 1) {
        expect(globalCss).toMatch(
          new RegExp(`--gallery-wave-${String(i)}:\\s*#[0-9A-Fa-f]{6}`),
        );
      }
    });
  });

  describe('runtime resolution via getComputedStyle', () => {
    let style: HTMLStyleElement;

    beforeEach(() => {
      // jsdom's CSSOM does not parse external stylesheets; we mount
      // a <style> element with the annotation block so getComputedStyle
      // can resolve the custom properties.
      style = document.createElement('style');
      style.textContent = `
        :root {
          --pencil-green: #6E8E3A;
          --ballpoint-blue: #3E5BAA;
          --highlighter-yellow: #F5D547;
          --crayon-orange: #E8743C;
          --india-red: #B83A2A;
          --annotation-font: 'Caveat', 'Comic Sans MS', cursive;
          --annotation-rotation-sm: -2deg;
          --annotation-rotation-md: -4deg;
          --annotation-rotation-lg: 8deg;
        }
      `;
      document.head.appendChild(style);
    });

    afterEach(() => {
      document.head.removeChild(style);
    });

    it('resolves each color token to its expected hex', () => {
      const root = window.getComputedStyle(document.documentElement);
      expect(root.getPropertyValue('--pencil-green').trim()).toBe('#6E8E3A');
      expect(root.getPropertyValue('--ballpoint-blue').trim()).toBe('#3E5BAA');
      expect(root.getPropertyValue('--highlighter-yellow').trim()).toBe('#F5D547');
      expect(root.getPropertyValue('--crayon-orange').trim()).toBe('#E8743C');
      expect(root.getPropertyValue('--india-red').trim()).toBe('#B83A2A');
    });

    it('resolves --annotation-font to the Caveat fallback chain', () => {
      const root = window.getComputedStyle(document.documentElement);
      const value = root.getPropertyValue('--annotation-font').trim();
      expect(value).toContain('Caveat');
      expect(value).toContain('Comic Sans MS');
      expect(value).toContain('cursive');
    });

    it('resolves each rotation token to its expected degree value', () => {
      const root = window.getComputedStyle(document.documentElement);
      expect(root.getPropertyValue('--annotation-rotation-sm').trim()).toBe('-2deg');
      expect(root.getPropertyValue('--annotation-rotation-md').trim()).toBe('-4deg');
      expect(root.getPropertyValue('--annotation-rotation-lg').trim()).toBe('8deg');
    });
  });

  describe('runtime resolution — P2.2 tokens via getComputedStyle', () => {
    let style: HTMLStyleElement;

    beforeEach(() => {
      style = document.createElement('style');
      style.textContent = `
        :root {
          --ui-text: #1F1B16;
          --ui-overlay-scrim: color-mix(in srgb, var(--ui-text) 55%, transparent);
          --quality-brilliant: #00CED1;
          --quality-good: #4CAF50;
          --quality-inaccuracy: #FFC107;
          --quality-mistake: #FF9800;
          --quality-blunder: #F44336;
          --quality-pending: #666666;
          --gallery-track-pm: #4A90D9;
          --gallery-track-cv: #D94A4A;
          --gallery-track-rb: #4AD94A;
          --gallery-track-l: #D9B44A;
          --gallery-track-wp: #9B4AD9;
          --gallery-wave-1: #4A90D9;
          --gallery-wave-2: #D94A4A;
          --gallery-wave-3: #4AD94A;
          --gallery-wave-4: #D9B44A;
          --gallery-wave-5: #9B4AD9;
          --gallery-wave-6: #4AD9C9;
          --gallery-wave-7: #D94A8A;
          --gallery-wave-8: #8A8A8A;
        }
      `;
      document.head.appendChild(style);
    });

    afterEach(() => {
      document.head.removeChild(style);
    });

    it('resolves --ui-overlay-scrim to a color-mix expression', () => {
      const root = window.getComputedStyle(document.documentElement);
      const value = root.getPropertyValue('--ui-overlay-scrim').trim();
      // jsdom may serialise the color-mix expression verbatim.
      expect(value.length).toBeGreaterThan(0);
      expect(value).toContain('color-mix');
      expect(value).toContain('--ui-text');
    });

    it('resolves each move-quality token to its expected hex', () => {
      const root = window.getComputedStyle(document.documentElement);
      expect(root.getPropertyValue('--quality-brilliant').trim()).toBe('#00CED1');
      expect(root.getPropertyValue('--quality-good').trim()).toBe('#4CAF50');
      expect(root.getPropertyValue('--quality-inaccuracy').trim()).toBe('#FFC107');
      expect(root.getPropertyValue('--quality-mistake').trim()).toBe('#FF9800');
      expect(root.getPropertyValue('--quality-blunder').trim()).toBe('#F44336');
      expect(root.getPropertyValue('--quality-pending').trim()).toBe('#666666');
    });

    it('resolves a representative gallery-track token and a gallery-wave token', () => {
      const root = window.getComputedStyle(document.documentElement);
      expect(root.getPropertyValue('--gallery-track-pm').trim()).toBe('#4A90D9');
      expect(root.getPropertyValue('--gallery-wave-1').trim()).toBe('#4A90D9');
      expect(root.getPropertyValue('--gallery-wave-8').trim()).toBe('#8A8A8A');
    });
  });

  describe('theme-agnostic guarantee', () => {
    let style: HTMLStyleElement;

    beforeEach(() => {
      style = document.createElement('style');
      style.textContent = `
        :root {
          --pencil-green: #6E8E3A;
          --india-red: #B83A2A;
          --annotation-font: 'Caveat', 'Comic Sans MS', cursive;
        }
      `;
      document.head.appendChild(style);
    });

    afterEach(() => {
      document.head.removeChild(style);
    });

    it('annotation tokens do not change when the active theme switches', () => {
      // Apply Margin Notes
      applyTheme(marginNotesTheme);
      const afterMarginNotes = {
        pencilGreen: window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--pencil-green')
          .trim(),
        indiaRed: window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--india-red')
          .trim(),
        annotationFont: window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--annotation-font')
          .trim(),
      };

      // Switch to Crazy (Original)
      applyTheme(crazyTheme);
      const afterCrazyOriginal = {
        pencilGreen: window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--pencil-green')
          .trim(),
        indiaRed: window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--india-red')
          .trim(),
        annotationFont: window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--annotation-font')
          .trim(),
      };

      // The annotation tokens are brand-level; switching themes
      // must not perturb them.
      expect(afterCrazyOriginal.pencilGreen).toBe(afterMarginNotes.pencilGreen);
      expect(afterCrazyOriginal.indiaRed).toBe(afterMarginNotes.indiaRed);
      expect(afterCrazyOriginal.annotationFont).toBe(afterMarginNotes.annotationFont);
    });
  });
});

describe('global.css — annotation utility classes (P2.3)', () => {
  describe('source-level presence', () => {
    it('declares the .annotation base class with the canonical contract', () => {
      expect(globalCss).toMatch(
        /\.annotation\s*\{[^}]*font-family:\s*var\(--annotation-font\)/s,
      );
      expect(globalCss).toMatch(/\.annotation\s*\{[^}]*font-weight:\s*500/s);
      expect(globalCss).toMatch(/\.annotation\s*\{[^}]*font-size:\s*1\.6rem/s);
      expect(globalCss).toMatch(/\.annotation\s*\{[^}]*line-height:\s*1\.2/s);
      expect(globalCss).toMatch(/\.annotation\s*\{[^}]*letter-spacing:\s*0/s);
      expect(globalCss).toMatch(/\.annotation\s*\{[^}]*color:\s*var\(--india-red\)/s);
    });

    it('declares the three rotation modifier classes', () => {
      expect(globalCss).toMatch(
        /\.annotation-rotated-sm\s*\{[^}]*transform:\s*rotate\(var\(--annotation-rotation-sm\)\)/s,
      );
      expect(globalCss).toMatch(
        /\.annotation-rotated-md\s*\{[^}]*transform:\s*rotate\(var\(--annotation-rotation-md\)\)/s,
      );
      expect(globalCss).toMatch(
        /\.annotation-rotated-lg\s*\{[^}]*transform:\s*rotate\(var\(--annotation-rotation-lg\)\)/s,
      );
    });

    it('declares the four foreground color modifier classes', () => {
      expect(globalCss).toMatch(/\.annotation--india\s*\{[^}]*color:\s*var\(--india-red\)/s);
      expect(globalCss).toMatch(
        /\.annotation--ballpoint\s*\{[^}]*color:\s*var\(--ballpoint-blue\)/s,
      );
      expect(globalCss).toMatch(/\.annotation--pencil\s*\{[^}]*color:\s*var\(--pencil-green\)/s);
      expect(globalCss).toMatch(/\.annotation--crayon\s*\{[^}]*color:\s*var\(--crayon-orange\)/s);
    });

    it('declares the highlight background modifier class', () => {
      expect(globalCss).toMatch(
        /\.annotation--highlight\s*\{[^}]*background-color:\s*color-mix\(in srgb, var\(--highlighter-yellow\) 70%/s,
      );
    });

    it('declares the underlined modifier class with a decorative ::after', () => {
      expect(globalCss).toMatch(/\.annotation-underlined\s*\{[^}]*position:\s*relative/s);
      expect(globalCss).toMatch(
        /\.annotation-underlined::after\s*\{[^}]*background:\s*var\(--annotation-underline\)/s,
      );
    });

    it('declares --annotation-underline with the upstream SVG data URI', () => {
      expect(globalCss).toMatch(/--annotation-underline:\s*url\("data:image\/svg\+xml/);
      // The stroke color is URL-encoded India-red.
      expect(globalCss).toMatch(/%23B83A2A/);
    });

    it('declares a reduced-motion guard that resets all three rotation variants', () => {
      expect(globalCss).toMatch(
        /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.annotation-rotated-sm[\s\S]*?\.annotation-rotated-md[\s\S]*?\.annotation-rotated-lg[\s\S]*?transform:\s*none/,
      );
    });
  });

  describe('runtime behavior via getComputedStyle', () => {
    let style: HTMLStyleElement;

    beforeEach(() => {
      // Mount a <style> with the resolved equivalent of the P2.3 utility
      // classes. jsdom does not parse external stylesheets and does not
      // substitute `var()` references through getComputedStyle, so we
      // pre-substitute the P2.1 token literals here. The source-presence
      // cases above lock the *actual* CSS in `src/global.css` to use the
      // var() form; this block is the browser-resolved end-state that
      // Phase 3 consumers will see.
      style = document.createElement('style');
      style.textContent = `
        .annotation {
          font-family: 'Caveat', 'Comic Sans MS', cursive;
          font-weight: 500;
          font-size: 1.6rem;
          line-height: 1.2;
          letter-spacing: 0;
          color: #B83A2A;
        }
        .annotation-rotated-md {
          transform: rotate(-4deg);
        }
        .annotation--ballpoint {
          color: #3E5BAA;
        }
      `;
      document.head.appendChild(style);
    });

    afterEach(() => {
      document.head.removeChild(style);
    });

    it('applies the canonical .annotation contract', () => {
      const el = document.createElement('span');
      el.className = 'annotation';
      document.body.appendChild(el);
      const cs = window.getComputedStyle(el);
      expect(cs.fontFamily).toContain('Caveat');
      // jsdom may serialise length values in their declared unit (rem)
      // rather than the px-resolved equivalent. Accept either form so
      // the assertion locks the 1.6rem floor without depending on jsdom
      // length-resolution behavior.
      expect(cs.fontSize).toMatch(/^(?:1\.6rem|25\.6px)$/);
      expect(cs.color).toBe('rgb(184, 58, 42)'); // #B83A2A
      document.body.removeChild(el);
    });

    it('applies a rotation modifier when paired with .annotation', () => {
      const el = document.createElement('span');
      el.className = 'annotation annotation-rotated-md';
      document.body.appendChild(el);
      const cs = window.getComputedStyle(el);
      // jsdom may serialise transform as either rotate(...) or matrix(...);
      // accept either, but the value must not be 'none'.
      expect(cs.transform).not.toBe('none');
      expect(cs.transform).toMatch(/rotate\(\s*-4deg\s*\)|matrix/);
      document.body.removeChild(el);
    });

    it('overrides foreground color when an --color modifier is applied', () => {
      const el = document.createElement('span');
      el.className = 'annotation annotation--ballpoint';
      document.body.appendChild(el);
      const cs = window.getComputedStyle(el);
      expect(cs.color).toBe('rgb(62, 91, 170)'); // #3E5BAA
      document.body.removeChild(el);
    });
  });
});
