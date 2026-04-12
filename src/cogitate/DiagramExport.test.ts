import { describe, it, expect } from 'vitest';
import {
  serializeSvgWithStyles,
  DIAGRAM_EXPORT_SIZE,
  DIAGRAM_EXPORT_FILENAME,
} from './DiagramExport';

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 800 800');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '100');
  rect.setAttribute('height', '100');
  rect.setAttribute('fill', '#abcdef');
  svg.appendChild(rect);
  document.body.appendChild(svg);
  return svg;
}

describe('DiagramExport', () => {
  it('exposes expected constants', () => {
    expect(DIAGRAM_EXPORT_SIZE).toBe(800);
    expect(DIAGRAM_EXPORT_FILENAME).toBe('crazy-checkers-diagram.png');
  });

  it('serializeSvgWithStyles forces 800x800 dimensions', () => {
    const svg = makeSvg();
    const output = serializeSvgWithStyles(svg);
    expect(output).toContain('width="800"');
    expect(output).toContain('height="800"');
    document.body.removeChild(svg);
  });

  it('serialized markup includes xmlns namespace', () => {
    const svg = makeSvg();
    const output = serializeSvgWithStyles(svg);
    expect(output).toContain('xmlns="http://www.w3.org/2000/svg"');
    document.body.removeChild(svg);
  });

  it('serialized markup preserves child SVG elements', () => {
    const svg = makeSvg();
    const output = serializeSvgWithStyles(svg);
    expect(output).toContain('<rect');
    document.body.removeChild(svg);
  });
});
