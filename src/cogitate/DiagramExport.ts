/**
 * DiagramExport — SVG → Canvas → PNG pipeline for Free Play diagram export
 * (Task 21.5).
 *
 * The exported image captures the board SVG (pieces + diagram overlays) with
 * all CSS variables resolved to concrete values. External UI chrome is not
 * included.
 */

const DEFAULT_EXPORT_SIZE = 800;
const DEFAULT_FILENAME = 'crazy-checkers-diagram.png';

/**
 * Returns a clone of the SVG element with computed styles inlined on every
 * descendant so that theme-dependent CSS custom properties render correctly
 * once detached from the document.
 */
export function serializeSvgWithStyles(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  // Inline computed styles on the source element tree. We traverse the live
  // SVG (which has a resolved style tree) and write key visual properties
  // onto the clone, so the serialized markup is independent of external CSS.
  const sourceNodes = svg.querySelectorAll('*');
  const cloneNodes = clone.querySelectorAll('*');

  for (let i = 0; i < sourceNodes.length; i++) {
    const src = sourceNodes[i];
    const dst = cloneNodes[i];
    if (!src || !dst) continue;
    const computed = globalThis.getComputedStyle(src);
    const important: readonly string[] = [
      'fill',
      'stroke',
      'stroke-width',
      'opacity',
      'color',
      'font-size',
      'font-weight',
      'font-family',
    ];
    const styleParts: string[] = [];
    for (const prop of important) {
      const val = computed.getPropertyValue(prop);
      if (val && val !== 'none' && val !== '') {
        styleParts.push(`${prop}:${val}`);
      }
    }
    if (styleParts.length > 0) {
      const existing = dst.getAttribute('style') ?? '';
      dst.setAttribute('style', `${styleParts.join(';')};${existing}`);
    }
  }

  // Ensure xmlns is set on the root.
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  // Force explicit dimensions.
  clone.setAttribute('width', String(DEFAULT_EXPORT_SIZE));
  clone.setAttribute('height', String(DEFAULT_EXPORT_SIZE));

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

/** Produces a PNG Blob for the supplied SVG. */
export async function exportBoardAsBlob(svgElement: SVGSVGElement): Promise<Blob> {
  const svgString = serializeSvgWithStyles(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.width = DEFAULT_EXPORT_SIZE;
    image.height = DEFAULT_EXPORT_SIZE;

    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => { resolve(); };
      image.onerror = () => { reject(new Error('Failed to load SVG image for export')); };
    });
    image.src = svgUrl;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = DEFAULT_EXPORT_SIZE;
    canvas.height = DEFAULT_EXPORT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to acquire 2D canvas context for export');
    }
    ctx.drawImage(image, 0, 0, DEFAULT_EXPORT_SIZE, DEFAULT_EXPORT_SIZE);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => { resolve(b); }, 'image/png');
    });
    if (!blob) throw new Error('Canvas toBlob returned null');
    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Exports the SVG as a PNG and triggers a browser download. */
export async function exportBoardAsPNG(
  svgElement: SVGSVGElement,
  filename: string = DEFAULT_FILENAME,
): Promise<void> {
  const blob = await exportBoardAsBlob(svgElement);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const DIAGRAM_EXPORT_SIZE = DEFAULT_EXPORT_SIZE;
export const DIAGRAM_EXPORT_FILENAME = DEFAULT_FILENAME;
