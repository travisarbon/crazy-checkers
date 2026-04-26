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
