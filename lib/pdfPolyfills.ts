// pdf-parse's bundled pdfjs-dist tries to source DOMMatrix/Path2D/ImageData from
// `@napi-rs/canvas` at runtime (an optional native dependency). That require
// succeeds locally but fails to load in Vercel's serverless runtime, and pdfjs-dist
// silently swallows the failure — so these globals stay undefined until something
// (e.g. its JBIG2 image decoder, which uses DOMMatrix purely as 2D-affine scratch
// math, not for actual canvas rendering) instantiates one and throws a
// ReferenceError. These are real, spec-following implementations of the 2D subset
// pdfjs-dist actually touches during text extraction, not throwaway stubs — so any
// incidental exercise of them produces correct results instead of silently wrong ones.

class DOMMatrixPolyfill {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;

  constructor(init?: number[]) {
    if (init && init.length === 16) {
      // 4x4 form: keep the 2D subset (m11, m12, m21, m22, m41, m42).
      [this.a, this.b, , , this.c, this.d, , , , , , , this.e, this.f] = init;
    } else if (init && init.length === 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    } else {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.e = 0;
      this.f = 0;
    }
  }

  private multiplyInto(other: DOMMatrixPolyfill, left: DOMMatrixPolyfill) {
    // this = left ∘ other  (other's transform applies first, then left's)
    const a = left.a * other.a + left.c * other.b;
    const b = left.b * other.a + left.d * other.b;
    const c = left.a * other.c + left.c * other.d;
    const d = left.b * other.c + left.d * other.d;
    const e = left.a * other.e + left.c * other.f + left.e;
    const f = left.b * other.e + left.d * other.f + left.f;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  multiplySelf(other: DOMMatrixPolyfill) {
    return this.multiplyInto(other, new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]));
  }

  preMultiplySelf(other: DOMMatrixPolyfill) {
    return this.multiplyInto(
      new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]),
      other
    );
  }

  translateSelf(tx = 0, ty = 0) {
    return this.multiplySelf(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]));
  }

  translate(tx = 0, ty = 0) {
    return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]).translateSelf(tx, ty);
  }

  scaleSelf(sx = 1, sy = sx) {
    return this.multiplySelf(new DOMMatrixPolyfill([sx, 0, 0, sy, 0, 0]));
  }

  scale(sx = 1, sy = sx) {
    return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e, this.f]).scaleSelf(sx, sy);
  }

  invertSelf() {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    if (!det) {
      this.a = this.b = this.c = this.d = this.e = this.f = NaN;
      return this;
    }
    this.a = d / det;
    this.b = -b / det;
    this.c = -c / det;
    this.d = a / det;
    this.e = (c * f - d * e) / det;
    this.f = (b * e - a * f) / det;
    return this;
  }
}

class Path2DPolyfill {
  segments: { type: string; args: number[] }[] = [];

  constructor(path?: Path2DPolyfill) {
    if (path?.segments) {
      this.segments = path.segments.map((s) => ({ type: s.type, args: [...s.args] }));
    }
  }

  private push(type: string, args: number[]) {
    this.segments.push({ type, args });
  }

  moveTo(x: number, y: number) {
    this.push("moveTo", [x, y]);
  }

  lineTo(x: number, y: number) {
    this.push("lineTo", [x, y]);
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
    this.push("bezierCurveTo", [cp1x, cp1y, cp2x, cp2y, x, y]);
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.push("quadraticCurveTo", [cpx, cpy, x, y]);
  }

  rect(x: number, y: number, w: number, h: number) {
    this.push("rect", [x, y, w, h]);
  }

  closePath() {
    this.push("closePath", []);
  }

  addPath(path: Path2DPolyfill, transform?: DOMMatrixPolyfill) {
    if (!path?.segments) return;
    const m = transform ?? new DOMMatrixPolyfill();
    for (const seg of path.segments) {
      const args: number[] = [];
      for (let i = 0; i + 1 < seg.args.length; i += 2) {
        const x = seg.args[i];
        const y = seg.args[i + 1];
        args.push(m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f);
      }
      // rect() carries a width/height pair that isn't a point — transform the
      // origin only and keep the extents as-is.
      if (seg.type === "rect") {
        args.push(seg.args[2], seg.args[3]);
      }
      this.segments.push({ type: seg.type, args });
    }
  }
}

class ImageDataPolyfill {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace = "srgb";

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height ?? dataOrWidth.length / 4 / widthOrHeight;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}

export function installPdfPolyfills() {
  if (!globalThis.DOMMatrix) {
    globalThis.DOMMatrix = DOMMatrixPolyfill as unknown as typeof DOMMatrix;
  }
  if (!globalThis.Path2D) {
    globalThis.Path2D = Path2DPolyfill as unknown as typeof Path2D;
  }
  if (!globalThis.ImageData) {
    globalThis.ImageData = ImageDataPolyfill as unknown as typeof ImageData;
  }
}
