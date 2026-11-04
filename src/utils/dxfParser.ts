import {
  DxfMetadata,
  DxfShape,
  DxfText,
  Point,
  TakeoffRow,
  TileCell,
  TileConfig,
  TileResult,
} from '../types/takeoff';

export const fmt = (v: number, digits = 2): string =>
  v.toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export function arcPts(a: Point, b: Point, k: number): Point[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (!d || Math.abs(k) < 1e-9) return [];
  const th = 4 * Math.atan(k);
  const h = (d / 2) * ((1 - k * k) / (2 * k));
  const c: Point = [
    (a[0] + b[0]) / 2 - (dy / d) * h,
    (a[1] + b[1]) / 2 + (dx / d) * h,
  ];
  const r = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  const n = Math.max(2, Math.min(24, Math.ceil(Math.abs(th) / 0.2)));
  const o: Point[] = [];
  for (let i = 1; i < n; i++) {
    const q = a0 + (th * i) / n;
    o.push([c[0] + r * Math.cos(q), c[1] + r * Math.sin(q)]);
  }
  return o;
}

export function areaOf(p: Point[]): number {
  const n = p.length;
  if (n < 3) return 0;
  let a = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  }
  return Math.abs(a) * 0.5;
}

export function perOf(p: Point[], closed: boolean): number {
  let l = 0;
  const n = p.length;
  const limit = closed ? n : n - 1;
  for (let i = 0; i < limit; i++) {
    const q = p[(i + 1) % n];
    l += Math.hypot(q[0] - p[i][0], q[1] - p[i][1]);
  }
  return l;
}

export function centroidOf(p: Point[]): Point {
  if (!p.length) return [0, 0];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < p.length; i++) {
    cx += p[i][0];
    cy += p[i][1];
  }
  return [cx / p.length, cy / p.length];
}

export function pip(pt: Point, p: Point[]): boolean {
  let c = false;
  const px = pt[0];
  const py = pt[1];
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const yi = p[i][1];
    const yj = p[j][1];
    if (
      yi > py !== yj > py &&
      px < ((p[j][0] - p[i][0]) * (py - yi)) / (yj - yi) + p[i][0]
    ) {
      c = !c;
    }
  }
  return c;
}

export function segD(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = dx * dx + dy * dy;
  let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export function segRect(
  a: Point,
  b: Point,
  r: [number, number, number, number]
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const P = [-dx, dx, -dy, dy];
  const Q = [a[0] - r[0], r[2] - a[0], a[1] - r[1], r[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) {
      if (Q[i] < 0) return false;
    } else {
      const t = Q[i] / P[i];
      if (P[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

export type CadLayerCategory =
  | 'wall_floor'
  | 'furniture'
  | 'dim_anno'
  | 'mep'
  | 'hatch'
  | 'other';

/**
 * Classifies a CAD layer name into architectural categories so users can
 * filter out furniture, sanitary fixtures, dimensions, MEP, and hatches in 1 click.
 * Supports both accented and unaccented Vietnamese layer names.
 */
export function classifyCadLayer(layerName: string): CadLayerCategory {
  const raw = (layerName || '').trim();
  if (!raw || raw === '0') return 'wall_floor';
  const n = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd');
  if (
    /(furn|noi_that|noithat|noi that|\bnt\b|loose|equip|thiet_bi|thietbi|thiet bi|sanit|tbvs|toilet|wc_eq|fixture|cabinet|tu_bep|tu bep|tu_ao|tu ao|sofa|bed|giuong|table|ban_an|ban an|ban_tra|chair|ghe|plant|tree|cay|landscape|car\b|xe\b|people|nguoi|decor|door|cua_|cua |window|vach_kinh)/i.test(
      n
    )
  ) {
    return 'furniture';
  }
  if (
    /(dim|kich_thuoc|kichthuoc|kich thuoc|grid|truc|axis|anno|text|mtext|chu\b|note|ghi_chu|ghi chu|leader|symbol|ky_hieu|ky hieu|tag|title|khung|border|defpoints|viewport|vport|section|mat_cat|mat cat|elev|cot_cao|cot cao|rev)/i.test(
      n
    )
  ) {
    return 'dim_anno';
  }
  if (
    /(mep|elec|dien\b|dien_|dien |light|den\b|power|socket|o_cam|o cam|plumb|nuoc|pipe|ong_|ong |drain|thoat|hvac|dhkk|\bac\b|duct|ong_gio|fire|pccc|sprinkler|alarm|camera|cctv|data|tel)/i.test(
      n
    )
  ) {
    return 'mep';
  }
  if (/(hatch|pat\b|pattern|to_mau|to mau|shade|shadow|bong|paving)/i.test(n)) {
    return 'hatch';
  }
  if (
    /(wall|tuong|vach|part|san\b|san_|_san|san |floor|slab|room|phong|area|dien_tich|dien tich|bound|bo_vien|col|cot\b|cot_|stru|ket_cau|ket cau|\bkc\b|beam|dam|arch|kien_truc|kien truc|\bkt\b|ban_cong|ban cong|logia)/i.test(
      n
    )
  ) {
    return 'wall_floor';
  }
  return 'other';
}

/**
 * 2D Uniform Spatial Grid Index for O(1) hit-testing, vertex snapping, and room label matching
 * on large DXF drawings (up to 200MB / hàng trăm nghìn đối tượng).
 */
export class SpatialGrid {
  private minX: number;
  private minY: number;
  private invW: number;
  private invH: number;
  private gridSize: number;
  private allCells: number[][];
  private closedCells: number[][];
  private visited: Int32Array;
  private queryId = 0;

  constructor(
    shapes: DxfShape[],
    bb: [number, number, number, number] | null,
    gridSize = 64
  ) {
    this.gridSize = gridSize;
    const totalCells = gridSize * gridSize;
    this.allCells = Array.from({ length: totalCells }, () => []);
    this.closedCells = Array.from({ length: totalCells }, () => []);
    this.visited = new Int32Array(shapes.length);

    if (!bb || !shapes.length) {
      this.minX = 0;
      this.minY = 0;
      this.invW = 1;
      this.invH = 1;
      return;
    }

    this.minX = bb[0];
    this.minY = bb[1];
    const w = Math.max(1e-6, bb[2] - bb[0]);
    const h = Math.max(1e-6, bb[3] - bb[1]);
    this.invW = gridSize / w;
    this.invH = gridSize / h;

    const maxIdx = gridSize - 1;
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      const b = s.bb;
      const gx0 = Math.max(0, Math.min(maxIdx, ((b[0] - this.minX) * this.invW) | 0));
      const gx1 = Math.max(0, Math.min(maxIdx, ((b[2] - this.minX) * this.invW) | 0));
      const gy0 = Math.max(0, Math.min(maxIdx, ((b[1] - this.minY) * this.invH) | 0));
      const gy1 = Math.max(0, Math.min(maxIdx, ((b[3] - this.minY) * this.invH) | 0));
      const isClosedRoom = s.closed && s.area > 0;

      for (let gy = gy0; gy <= gy1; gy++) {
        const rowOffset = gy * gridSize;
        for (let gx = gx0; gx <= gx1; gx++) {
          const cellIdx = rowOffset + gx;
          this.allCells[cellIdx].push(i);
          if (isClosedRoom) {
            this.closedCells[cellIdx].push(i);
          }
        }
      }
    }
  }

  public queryBox(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    closedOnly: boolean,
    callback: (shapeIdx: number) => void
  ): void {
    const maxIdx = this.gridSize - 1;
    const gx0 = Math.max(0, Math.min(maxIdx, ((x0 - this.minX) * this.invW) | 0));
    const gx1 = Math.max(0, Math.min(maxIdx, ((x1 - this.minX) * this.invW) | 0));
    const gy0 = Math.max(0, Math.min(maxIdx, ((y0 - this.minY) * this.invH) | 0));
    const gy1 = Math.max(0, Math.min(maxIdx, ((y1 - this.minY) * this.invH) | 0));

    const qid = ++this.queryId;
    const cells = closedOnly ? this.closedCells : this.allCells;
    const vis = this.visited;

    for (let gy = gy0; gy <= gy1; gy++) {
      const rowOffset = gy * this.gridSize;
      for (let gx = gx0; gx <= gx1; gx++) {
        const bucket = cells[rowOffset + gx];
        for (let k = 0; k < bucket.length; k++) {
          const idx = bucket[k];
          if (vis[idx] !== qid) {
            vis[idx] = qid;
            callback(idx);
          }
        }
      }
    }
  }
}

/**
 * Self-contained factory that creates the full-featured streaming DXF parser.
 * This function is used both directly on the main thread AND serialized via .toString()
 * into the Web Worker so there is 100% feature parity with zero code duplication.
 */
function createDxfStreamEngine() {
  type Mat2D = [number, number, number, number, number, number];
  type FontEncodingHint = 'tcvn3' | 'tcvn3_upper' | 'vni' | 'unicode' | undefined;

  // TCVN3 (ABC / .VnTime / vntime.shx / vnsimli.shx) -> Unicode mapping table
  const TCVN3_MAP: Record<string, string> = {
    '\u00A1': 'Ă',
    '\u00A2': 'Â',
    '\u00A3': 'Ê',
    '\u00A4': 'Ô',
    '\u00A5': 'Ơ',
    '\u00A6': 'Ư',
    '\u00A7': 'Đ',
    '\u00A8': 'ă',
    '\u00A9': 'â',
    '\u00AA': 'ê',
    '\u00AB': 'ô',
    '\u00AC': 'ơ',
    '\u00AD': 'ư',
    '\u00AE': 'đ',
    '\u00B5': 'à',
    '\u00B6': 'ả',
    '\u00B7': 'ã',
    '\u00B8': 'á',
    '\u00B9': 'ạ',
    '\u00BB': 'ằ',
    '\u00BC': 'ẳ',
    '\u00BD': 'ẵ',
    '\u00BE': 'ắ',
    '\u00C6': 'ặ',
    '\u00C7': 'ầ',
    '\u00C8': 'ẩ',
    '\u00C9': 'ẫ',
    '\u00CA': 'ấ',
    '\u00CB': 'ậ',
    '\u00CC': 'è',
    '\u00CE': 'ẻ',
    '\u00CF': 'ẽ',
    '\u00D0': 'é',
    '\u00D1': 'ẹ',
    '\u00D2': 'ề',
    '\u00D3': 'ể',
    '\u00D4': 'ễ',
    '\u00D5': 'ế',
    '\u00D6': 'ệ',
    '\u00D7': 'ì',
    '\u00D8': 'ỉ',
    '\u00DC': 'ĩ',
    '\u00DD': 'í',
    '\u00DE': 'ị',
    '\u00DF': 'ò',
    '\u00E1': 'ỏ',
    '\u00E2': 'õ',
    '\u00E3': 'ó',
    '\u00E4': 'ọ',
    '\u00E5': 'ồ',
    '\u00E6': 'ổ',
    '\u00E7': 'ỗ',
    '\u00E8': 'ố',
    '\u00E9': 'ộ',
    '\u00EA': 'ờ',
    '\u00EB': 'ở',
    '\u00EC': 'ỡ',
    '\u00ED': 'ớ',
    '\u00EE': 'ợ',
    '\u00EF': 'ù',
    '\u00F1': 'ủ',
    '\u00F2': 'ũ',
    '\u00F3': 'ú',
    '\u00F4': 'ụ',
    '\u00F5': 'ừ',
    '\u00F6': 'ử',
    '\u00F7': 'ữ',
    '\u00F8': 'ứ',
    '\u00F9': 'ự',
    '\u00FA': 'ỳ',
    '\u00FB': 'ỷ',
    '\u00FC': 'ỹ',
    '\u00FD': 'ý',
    '\u00FE': 'ỵ',
  };

  // VNI-Windows (VNI-Times / VNI-Helve / vni.shx) 2-char vowel+tone -> Unicode mapping
  const VNI_VOWEL_MAP: Record<string, Record<string, string>> = {
    a: {
      '\u00F9': 'á', '\u00F8': 'à', '\u00FB': 'ả', '\u00F5': 'ã', '\u00EF': 'ạ',
      '\u00E2': 'â', '\u00E1': 'ấ', '\u00E0': 'ầ', '\u00E5': 'ẩ', '\u00E3': 'ẫ', '\u00E4': 'ậ',
      '\u00EA': 'ă', '\u00E9': 'ắ', '\u00E8': 'ằ', '\u00EB': 'ẳ', '\u00EC': 'ẵ', '\u00ED': 'ặ',
    },
    A: {
      '\u00D9': 'Á', '\u00D8': 'À', '\u00DB': 'Ả', '\u00D5': 'Ã', '\u00CF': 'Ạ',
      '\u00C2': 'Â', '\u00C1': 'Ấ', '\u00C0': 'Ầ', '\u00C5': 'Ẩ', '\u00C3': 'Ẫ', '\u00C4': 'Ậ',
      '\u00CA': 'Ă', '\u00C9': 'Ắ', '\u00C8': 'Ằ', '\u00CB': 'Ẳ', '\u00CC': 'Ẵ', '\u00CD': 'Ặ',
      '\u00F9': 'Á', '\u00F8': 'À', '\u00FB': 'Ả', '\u00F5': 'Ã', '\u00EF': 'Ạ',
      '\u00E2': 'Â', '\u00E1': 'Ấ', '\u00E0': 'Ầ', '\u00E5': 'Ẩ', '\u00E3': 'Ẫ', '\u00E4': 'Ậ',
      '\u00EA': 'Ă', '\u00E9': 'Ắ', '\u00E8': 'Ằ', '\u00EB': 'Ẳ', '\u00EC': 'Ẵ', '\u00ED': 'Ặ',
    },
    e: {
      '\u00F9': 'é', '\u00F8': 'è', '\u00FB': 'ẻ', '\u00F5': 'ẽ', '\u00EF': 'ẹ',
      '\u00E2': 'ê', '\u00E1': 'ế', '\u00E0': 'ề', '\u00E5': 'ể', '\u00E3': 'ễ', '\u00E4': 'ệ',
    },
    E: {
      '\u00D9': 'É', '\u00D8': 'È', '\u00DB': 'Ẻ', '\u00D5': 'Ẽ', '\u00CF': 'Ẹ',
      '\u00C2': 'Ê', '\u00C1': 'Ế', '\u00C0': 'Ề', '\u00C5': 'Ể', '\u00C3': 'Ễ', '\u00C4': 'Ệ',
      '\u00F9': 'É', '\u00F8': 'È', '\u00FB': 'Ẻ', '\u00F5': 'Ẽ', '\u00EF': 'Ẹ',
      '\u00E2': 'Ê', '\u00E1': 'Ế', '\u00E0': 'Ề', '\u00E5': 'Ể', '\u00E3': 'Ễ', '\u00E4': 'Ệ',
    },
    o: {
      '\u00F9': 'ó', '\u00F8': 'ò', '\u00FB': 'ỏ', '\u00F5': 'õ', '\u00EF': 'ọ',
      '\u00E2': 'ô', '\u00E1': 'ố', '\u00E0': 'ồ', '\u00E5': 'ổ', '\u00E3': 'ỗ', '\u00E4': 'ộ',
    },
    O: {
      '\u00D9': 'Ó', '\u00D8': 'Ò', '\u00DB': 'Ỏ', '\u00D5': 'Õ', '\u00CF': 'Ọ',
      '\u00C2': 'Ô', '\u00C1': 'Ố', '\u00C0': 'Ồ', '\u00C5': 'Ổ', '\u00C3': 'Ỗ', '\u00C4': 'Ộ',
      '\u00F9': 'Ó', '\u00F8': 'Ò', '\u00FB': 'Ỏ', '\u00F5': 'Õ', '\u00EF': 'Ọ',
      '\u00E2': 'Ô', '\u00E1': 'Ố', '\u00E0': 'Ồ', '\u00E5': 'Ổ', '\u00E3': 'Ỗ', '\u00E4': 'Ộ',
    },
    u: {
      '\u00F9': 'ú', '\u00F8': 'ù', '\u00FB': 'ủ', '\u00F5': 'ũ', '\u00EF': 'ụ',
    },
    U: {
      '\u00D9': 'Ú', '\u00D8': 'Ù', '\u00DB': 'Ủ', '\u00D5': 'Ũ', '\u00CF': 'Ụ',
      '\u00F9': 'Ú', '\u00F8': 'Ù', '\u00FB': 'Ủ', '\u00F5': 'Ũ', '\u00EF': 'Ụ',
    },
    y: {
      '\u00F9': 'ý', '\u00F8': 'ỳ', '\u00FB': 'ỷ', '\u00F5': 'ỹ', '\u00EE': 'ỵ', '\u00EF': 'ỵ',
    },
    Y: {
      '\u00D9': 'Ý', '\u00D8': 'Ỳ', '\u00DB': 'Ỷ', '\u00D5': 'Ỹ', '\u00CE': 'Ỵ', '\u00CF': 'Ỵ',
      '\u00F9': 'Ý', '\u00F8': 'Ỳ', '\u00FB': 'Ỷ', '\u00F5': 'Ỹ', '\u00EE': 'Ỵ', '\u00EF': 'Ỵ',
    },
    '\u00F4': {
      '\u00F9': 'ớ', '\u00F8': 'ờ', '\u00FB': 'ở', '\u00F5': 'ỡ', '\u00EF': 'ợ',
    },
    '\u00D4': {
      '\u00D9': 'Ớ', '\u00D8': 'Ờ', '\u00DB': 'Ở', '\u00D5': 'Ỡ', '\u00CF': 'Ợ',
      '\u00F9': 'Ớ', '\u00F8': 'Ờ', '\u00FB': 'Ở', '\u00F5': 'Ỡ', '\u00EF': 'Ợ',
    },
    '\u00F6': {
      '\u00F9': 'ứ', '\u00F8': 'ừ', '\u00FB': 'ử', '\u00F5': 'ữ', '\u00EF': 'ự',
    },
    '\u00D6': {
      '\u00D9': 'Ứ', '\u00D8': 'Ừ', '\u00DB': 'Ử', '\u00D5': 'Ữ', '\u00CF': 'Ự',
      '\u00F9': 'Ứ', '\u00F8': 'Ừ', '\u00FB': 'Ử', '\u00F5': 'Ữ', '\u00EF': 'Ự',
    },
  };

  const VNI_SINGLE_MAP: Record<string, string> = {
    '\u00F4': 'ơ',
    '\u00D4': 'Ơ',
    '\u00F6': 'ư',
    '\u00D6': 'Ư',
    '\u00F1': 'đ',
    '\u00D1': 'Đ',
    '\u00EC': 'ì',
    '\u00CC': 'Ì',
    '\u00ED': 'í',
    '\u00CD': 'Í',
    '\u00EE': 'ỉ',
    '\u00CE': 'Ỉ',
    '\u00EF': 'ĩ',
    '\u00CF': 'Ĩ',
    '\u00F2': 'ị',
    '\u00D2': 'Ị',
  };

  // Reverse Windows-1252 codepoint -> byte (0x80..0x9F) for repairing UTF-8 mojibake
  const CP1252_REV: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
    0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
    0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
    0x017e: 0x9e, 0x0178: 0x9f,
  };

  function detectFontEncodingFromName(fontSpec: string): FontEncodingHint {
    if (!fontSpec) return undefined;
    const f = fontSpec.toLowerCase();
    if (/(?:\.vn|vntime|vnarial|vnsimli|vnsimple|vn_tcvn|abc)/i.test(f)) {
      return /\.vn\w*h\b/i.test(f) ? 'tcvn3_upper' : 'tcvn3';
    }
    if (/(?:\bvni[-_ ]|\bvni\b|vni\.shx|vnitimes|vnihelve|vniaptima)/i.test(f)) {
      return 'vni';
    }
    return undefined;
  }

  function convertVniToUnicode(s: string): string {
    let out = '';
    const n = s.length;
    for (let i = 0; i < n; i++) {
      const ch = s[i];
      const next = i + 1 < n ? s[i + 1] : '';
      const vMap = VNI_VOWEL_MAP[ch];
      if (vMap && next && vMap[next]) {
        out += vMap[next];
        i++;
      } else if (VNI_SINGLE_MAP[ch]) {
        out += VNI_SINGLE_MAP[ch];
      } else {
        out += ch;
      }
    }
    return out;
  }

  function convertTcvn3ToUnicode(s: string, forceUpper = false): string {
    // Convert word by word so all-caps words (e.g. "PHßNG NGñ") get uppercase Vietnamese vowels ("PHÒNG NGỦ")
    return s.replace(/\S+/g, (word) => {
      let asciiUpper = 0;
      let asciiLower = 0;
      for (let i = 0; i < word.length; i++) {
        const c = word.charCodeAt(i);
        if (c >= 65 && c <= 90) asciiUpper++;
        else if (c >= 97 && c <= 122) asciiLower++;
      }
      const wordIsUpper = forceUpper || (asciiUpper >= 1 && asciiLower === 0);
      let out = '';
      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        const mapped = TCVN3_MAP[ch];
        if (mapped) {
          out += wordIsUpper ? mapped.toUpperCase() : mapped;
        } else {
          out += ch;
        }
      }
      return out;
    });
  }

  function tryFixUtf8Mojibake(s: string): string {
    // Detect classic UTF-8 Vietnamese read as Windows-1252/Latin-1 (e.g. "PhÃ²ng khÃ¡ch", "PhÃ²ng ngá»§")
    if (!/(?:Ã[\u0080-\u00BF\u20AC-\u2122]|Ä[\u0080-\u00BF\u20AC-\u2122]|Æ[\u0080-\u00BF\u20AC-\u2122]|á»|áº)/.test(s)) {
      return s;
    }
    try {
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code <= 0xff) {
          bytes[i] = code;
        } else if (CP1252_REV[code] !== undefined) {
          bytes[i] = CP1252_REV[code];
        } else {
          return s;
        }
      }
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return decoded;
    } catch {
      return s;
    }
  }

  function decodeText(raw: string, styleHint?: FontEncodingHint): string {
    if (!raw) return '';

    // 1. Extract font hint from MTEXT \fFontName|...; or \FFontName; before stripping tags
    let fontHint: FontEncodingHint = styleHint;
    const fontMatch = raw.match(/\\[fF]([^;|\\{}]+)/);
    if (fontMatch && fontMatch[1]) {
      const detected = detectFontEncodingFromName(fontMatch[1]);
      if (detected) fontHint = detected;
    }

    // 2. Decode AutoCAD \U+XXXX hex escapes and special %% symbols
    let s = raw
      .replace(/\\U\+([0-9A-Fa-f]{4})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/%%[cC]/g, '⌀')
      .replace(/%%[dD]/g, '°')
      .replace(/%%[pP]/g, '±')
      .replace(/%%%/g, '%')
      .replace(/%%[uUoOkK]/g, '')
      .replace(/\\P/gi, ' ')
      .replace(/\\~|\\\n/g, ' ')
      .replace(/\\S([^;\\{}]*)[\^#/ ]([^;\\{}]*);/g, '$1/$2')
      .replace(/\\S([^;\\{}]*);/g, '$1')
      .replace(/\\[fFhHwWqQtTaAcCpP][^;\\{}]*;/g, '')
      .replace(/\\[LlOoKk]/g, '')
      .replace(/\\([{}])/g, '$1')
      .replace(/[{}]/g, '');

    // 3. Repair UTF-8 Mojibake if UTF-8 bytes were interpreted as Latin-1/Windows-1252
    s = tryFixUtf8Mojibake(s);

    // 4. If the string already contains genuine precomposed Vietnamese Unicode (À-ỹ above U+0100 like ă, đ, ơ, ư, ả, ấ, ệ, ộ...), normalize and return
    const hasNativeVietUnicode = /[\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/.test(s);

    if (!hasNativeVietUnicode) {
      if (fontHint === 'vni') {
        s = convertVniToUnicode(s);
      } else if (fontHint === 'tcvn3' || fontHint === 'tcvn3_upper') {
        s = convertTcvn3ToUnicode(s, fontHint === 'tcvn3_upper');
      } else {
        // Auto-detect VNI-Windows vs TCVN3 (ABC) heuristics
        // VNI pattern: ASCII vowel or Ô/ô/Ö/ö followed immediately by VNI tone/diacritic byte, or Ñ/ñ before vowel
        const isVni =
          /[aAeEoOuUyY\u00D4\u00F4\u00D6\u00F6][\u00F9\u00F8\u00FB\u00F5\u00EF\u00E2\u00E1\u00E0\u00E5\u00E3\u00E4\u00EA\u00E9\u00E8\u00EB\u00EC\u00ED\u00D9\u00D8\u00DB\u00D5\u00CF\u00C2\u00C1\u00C0\u00C5\u00C3\u00C4\u00CA\u00C9\u00C8\u00CB\u00CC\u00CD]/.test(
            s
          ) ||
          /[\u00D1\u00F1][aAeEiIoOuUyY\u00D4\u00F4\u00D6\u00F6]/.test(s) ||
          /[bBcCdDgGhHkKlLmMnNpPqQrRsStTvVxX][\u00F4\u00D4\u00F6\u00D6][a-zA-Z]/.test(s);

        // TCVN3 pattern: contains unmistakable TCVN3 bytes (µ, ¸, ¹, », ¾, Æ, Ç, Õ, Ö, ×, Ý, Þ, ß, è, é, ê, ë, í, î, ï, ñ, õ, ö, ÷, ø, ù, ® , ©, ª, «, ¬, \u00AD)
        // or Vietnamese consonants followed by TCVN3 vowel codes
        const isTcvn3 =
          /[\u00A1-\u00AE\u00B5-\u00BE\u00C6\u00C7\u00CB\u00CE\u00CF\u00D0\u00D1\u00D5-\u00DE\u00DF\u00E4-\u00EE\u00F1\u00F5-\u00FE]/.test(
            s
          ) ||
          /\b(?:Phßng|phßng|Kh¸ch|kh¸ch|BÕp|bÕp|Ngñ|ngñ|TÇng|tÇng|MÆt|mÆt|B»ng|b»ng|T­êng|t­êng|Cöa|cöa|Sµn|sµn|Nhµ|nhµ|VÖ|vÖ|TrÇn|trÇn|M¸i|m¸i|Cét|cét|DÇm|dÇm)/i.test(
            s
          );

        if (isVni && !isTcvn3) {
          s = convertVniToUnicode(s);
        } else if (isTcvn3) {
          s = convertTcvn3ToUnicode(s, false);
        } else if (isVni) {
          s = convertVniToUnicode(s);
        }
      }
    }

    return s
      .normalize('NFC')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildArcPts(a: Point, b: Point, k: number): Point[] {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    if (!d || Math.abs(k) < 1e-9) return [];
    const th = 4 * Math.atan(k);
    const h = (d / 2) * ((1 - k * k) / (2 * k));
    const cx = (a[0] + b[0]) / 2 - (dy / d) * h;
    const cy = (a[1] + b[1]) / 2 + (dx / d) * h;
    const r = Math.hypot(a[0] - cx, a[1] - cy);
    const a0 = Math.atan2(a[1] - cy, a[0] - cx);
    const n = Math.max(2, Math.min(24, Math.ceil(Math.abs(th) / 0.2)));
    const o: Point[] = [];
    for (let i = 1; i < n; i++) {
      const q = a0 + (th * i) / n;
      o.push([cx + r * Math.cos(q), cy + r * Math.sin(q)]);
    }
    return o;
  }

  function calcArea(p: Point[]): number {
    const n = p.length;
    if (n < 3) return 0;
    let a = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
    }
    return Math.abs(a) * 0.5;
  }

  function pointInPoly(pt: Point, p: Point[]): boolean {
    let c = false;
    const px = pt[0];
    const py = pt[1];
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const yi = p[i][1];
      const yj = p[j][1];
      if (
        yi > py !== yj > py &&
        px < ((p[j][0] - p[i][0]) * (py - yi)) / (yj - yi) + p[i][0]
      ) {
        c = !c;
      }
    }
    return c;
  }

  function mulMat(m1: Mat2D, m2: Mat2D): Mat2D {
    return [
      m1[0] * m2[0] + m1[1] * m2[2],
      m1[0] * m2[1] + m1[1] * m2[3],
      m1[2] * m2[0] + m1[3] * m2[2],
      m1[2] * m2[1] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[1] * m2[5] + m1[4],
      m1[2] * m2[4] + m1[3] * m2[5] + m1[5],
    ];
  }

  function applyMat(m: Mat2D, pt: Point): Point {
    return [
      m[0] * pt[0] + m[1] * pt[1] + m[4],
      m[2] * pt[0] + m[3] * pt[1] + m[5],
    ];
  }

  function buildInsertMatrix(
    baseX: number,
    baseY: number,
    insX: number,
    insY: number,
    offX: number,
    offY: number,
    sx: number,
    sy: number,
    rotDeg: number,
    insExtZ: number
  ): Mat2D {
    const rad = (rotDeg * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const k = insExtZ < 0 ? -1 : 1;
    const a = k * sx * cosR;
    const b = -k * sy * sinR;
    const c = sx * sinR;
    const d = sy * cosR;
    const tx0 = k * (insX + offX * cosR - offY * sinR);
    const ty0 = insY + offX * sinR + offY * cosR;
    const tx = tx0 - a * baseX - b * baseY;
    const ty = ty0 - c * baseX - d * baseY;
    return [a, b, c, d, tx, ty];
  }

  interface BlockInsert {
    name: string;
    layer: string;
    x: number;
    y: number;
    sx: number;
    sy: number;
    rot: number;
    colCount: number;
    rowCount: number;
    colSpace: number;
    rowSpace: number;
    extZ: number;
  }

  interface BlockDef {
    name: string;
    baseX: number;
    baseY: number;
    flags: number;
    shapes: {
      pts: Point[];
      closed: boolean;
      layer: string;
      roomLabel?: string;
      isCurve?: boolean;
    }[];
    texts: DxfText[];
    inserts: BlockInsert[];
  }

  const shapes: DxfShape[] = [];
  const shapeInsSpan: number[] = [];
  const texts: DxfText[] = [];
  const bb: [number, number, number, number] = [1e300, 1e300, -1e300, -1e300];
  const blocks = new Map<string, BlockDef>();
  const hiddenByCadSet = new Set<string>();
  const layerNamesSet = new Set<string>();
  const styleFontMap = new Map<string, FontEncodingHint>();

  let insUnitsCode = 0;
  let insertCount = 0;
  let hatchCount = 0;
  let done = false;

  // Section tracking: 'NONE' | 'HEADER' | 'TABLES' | 'BLOCKS' | 'ENTITIES' | 'SKIP'
  let section = 'NONE';
  let checkedHeadless = false;
  let remainder = '';
  let pendingCode: number | null = null;
  let awaitingSectionName = false;

  // HEADER state
  let headerVar = '';

  // TABLES (LAYER & STYLE) state
  let inLayerRecord = false;
  let layerRecName = '';
  let layerRecColor = 7;
  let layerRecFlags = 0;
  let inStyleRecord = false;
  let styleRecName = '';
  let styleRecFont = '';

  // BLOCKS state
  let currentBlock: BlockDef | null = null;
  let inBlockHeader = false;

  // Active Entity state
  let entType = '';
  let ignoreEnt = true;
  let inTrailingData = false;
  let paperSpace = false;
  let layer = '0';
  let textStyle = 'STANDARD';
  let customName = '';
  let blockName = '';
  let flags = 0;
  let hAlign = 0;
  let vAlign = 0;
  let hasAlignPt = false;
  let x0 = 0;
  let y0 = 0;
  let x1 = 0;
  let y1 = 0;
  let r = 0;
  let a0 = 0;
  let a1 = 0;
  let eStartParam = 0;
  let eEndParam = Math.PI * 2;
  let height = 0;
  let scaleX = 1;
  let scaleY = 1;
  let rotDeg = 0;
  let colCount = 1;
  let rowCount = 1;
  let colSpace = 0;
  let rowSpace = 0;
  let extZ = 1;

  // LWPOLYLINE / SPLINE points
  let pts: Point[] = [];
  let fitPts: Point[] = [];
  let bulges: number[] = [];

  // POLYLINE / VERTEX / SEQEND state
  let inPoly = false;
  let polyFlags = 0;
  let polyLayer = '0';
  let polyExtZ = 1;
  let polyPaperSpace = false;
  let polyPts: Point[] = [];
  let polyBulges: number[] = [];
  let vX = 0;
  let vY = 0;
  let vBulge = 0;
  let vFlags = 0;

  // HATCH boundary path state
  interface HatchLoop {
    isPoly: boolean;
    closed: boolean;
    invalid: boolean;
    pts: Point[];
    bulges: number[];
    edgeSegments: Point[][];
    edgesRemaining: number;
    expectedVerts: number;
    edgeType: number; // 1=line, 2=arc, 3=ellipse, 4=spline
    ex0: number;
    ey0: number;
    ex1: number;
    ey1: number;
    er: number;
    ea0: number;
    ea1: number;
    eccw: boolean;
    expectingPolyHasBulge: boolean;
  }
  let hatchLoops: HatchLoop[] = [];
  let curLoop: HatchLoop | null = null;
  let inHatchBoundary = false;

  function recordShapeToTarget(
    rawPts: Point[],
    bul: number[] | null,
    closed: boolean,
    lay: string,
    roomLabel?: string,
    entityExtZ = 1,
    metaFlags?: {
      fromInsert?: boolean;
      fromHatch?: boolean;
      isCurve?: boolean;
      insSpan?: number;
    }
  ) {
    const n = rawPts.length;
    if (n < 2) return;

    // Validate finite coordinates and apply OCS extrusion Z < 0 when applicable
    const pList: Point[] = new Array(n);
    const flipX = entityExtZ < 0;
    for (let i = 0; i < n; i++) {
      const px = flipX ? -rawPts[i][0] : rawPts[i][0];
      const py = rawPts[i][1];
      if (!Number.isFinite(px) || !Number.isFinite(py) || Math.abs(px) > 1e11 || Math.abs(py) > 1e11) {
        return;
      }
      pList[i] = [px, py];
    }

    let bList = bul;
    if (flipX && bul) {
      bList = bul.map((b) => -b);
    }

    let isClosed = closed;
    let cleanPts = pList;
    if (
      !isClosed &&
      n > 2 &&
      Math.hypot(
        pList[0][0] - pList[n - 1][0],
        pList[0][1] - pList[n - 1][1]
      ) < 1e-4
    ) {
      cleanPts = pList.slice(0, -1);
      isClosed = true;
    }

    let finalPts = cleanPts;
    if (bList) {
      let hasBulge = false;
      for (let i = 0; i < bList.length; i++) {
        if (bList[i] !== 0) {
          hasBulge = true;
          break;
        }
      }
      if (hasBulge) {
        finalPts = [];
        const m = cleanPts.length;
        for (let i = 0; i < m; i++) {
          finalPts.push(cleanPts[i]);
          if (bList[i] && (i < m - 1 || isClosed)) {
            const ap = buildArcPts(
              cleanPts[i],
              cleanPts[(i + 1) % m],
              bList[i]
            );
            for (let k = 0; k < ap.length; k++) finalPts.push(ap[k]);
          }
        }
      }
    }

    if (finalPts.length < 2) return;

    if (currentBlock) {
      currentBlock.shapes.push({
        pts: finalPts,
        closed: isClosed,
        layer: lay,
        roomLabel,
        isCurve: metaFlags?.isCurve,
      });
      return;
    }

    let sx0 = 1e300;
    let sy0 = 1e300;
    let sx1 = -1e300;
    let sy1 = -1e300;
    for (let i = 0; i < finalPts.length; i++) {
      const px = finalPts[i][0];
      const py = finalPts[i][1];
      if (px < sx0) sx0 = px;
      if (px > sx1) sx1 = px;
      if (py < sy0) sy0 = py;
      if (py > sy1) sy1 = py;
    }

    // Skip zero-length degenerate segments
    if (sx1 - sx0 < 1e-7 && sy1 - sy0 < 1e-7) return;

    if (sx0 < bb[0]) bb[0] = sx0;
    if (sy0 < bb[1]) bb[1] = sy0;
    if (sx1 > bb[2]) bb[2] = sx1;
    if (sy1 > bb[3]) bb[3] = sy1;

    layerNamesSet.add(lay);
    shapeInsSpan.push(metaFlags?.insSpan ?? 0);
    shapes.push({
      pts: finalPts,
      closed: isClosed,
      layer: lay,
      bb: [sx0, sy0, sx1, sy1],
      area: isClosed ? calcArea(finalPts) : 0,
      roomLabel: roomLabel || undefined,
      fromInsert: metaFlags?.fromInsert,
      fromHatch: metaFlags?.fromHatch,
      isCurve: metaFlags?.isCurve,
    });
  }

  function recordTextToTarget(pt: Point, text: string, h: number, lay: string) {
    if (!text || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return;
    if (currentBlock) {
      currentBlock.texts.push({ pt, text, height: h || 0, layer: lay });
    } else {
      layerNamesSet.add(lay);
      texts.push({ pt, text, height: h || 0, layer: lay });
    }
  }

  function expandInsertWithMat(
    ins: BlockInsert,
    parentMat: Mat2D,
    rootLayer: string,
    depth: number
  ) {
    if (depth > 6) return;
    const blk = blocks.get(ins.name);
    if (!blk) return;
    // Skip XREF or XREF overlay blocks
    if ((blk.flags & (4 | 8)) !== 0) return;

    const cols = Math.max(1, Math.min(100, ins.colCount || 1));
    const rows = Math.max(1, Math.min(100, ins.rowCount || 1));
    const cSpace = ins.colSpace || 0;
    const rSpace = ins.rowSpace || 0;
    const effectiveInsLayer = ins.layer === '0' ? rootLayer : ins.layer;

    for (let rIdx = 0; rIdx < rows; rIdx++) {
      for (let cIdx = 0; cIdx < cols; cIdx++) {
        const localMat = buildInsertMatrix(
          blk.baseX,
          blk.baseY,
          ins.x,
          ins.y,
          cIdx * cSpace,
          rIdx * rSpace,
          ins.sx,
          ins.sy,
          ins.rot,
          ins.extZ
        );
        const mat = mulMat(parentMat, localMat);

        // Compute bounding span of this block instance to distinguish furniture/fixtures from full-building blocks
        let bx0 = 1e300;
        let by0 = 1e300;
        let bx1 = -1e300;
        let by1 = -1e300;
        const transformedList: {
          tPts: Point[];
          closed: boolean;
          targetLayer: string;
          roomLabel?: string;
          isCurve?: boolean;
        }[] = [];

        for (let i = 0; i < blk.shapes.length; i++) {
          const bs = blk.shapes[i];
          const targetLayer = bs.layer === '0' ? effectiveInsLayer : bs.layer;
          const tPts: Point[] = new Array(bs.pts.length);
          for (let k = 0; k < bs.pts.length; k++) {
            const p = applyMat(mat, bs.pts[k]);
            tPts[k] = p;
            if (p[0] < bx0) bx0 = p[0];
            if (p[0] > bx1) bx1 = p[0];
            if (p[1] < by0) by0 = p[1];
            if (p[1] > by1) by1 = p[1];
          }
          transformedList.push({
            tPts,
            closed: bs.closed,
            targetLayer,
            roomLabel: bs.roomLabel,
            isCurve: bs.isCurve,
          });
        }

        const insSpan = bx1 >= bx0 ? Math.max(bx1 - bx0, by1 - by0) : 0;
        for (let i = 0; i < transformedList.length; i++) {
          const item = transformedList[i];
          recordShapeToTarget(
            item.tPts,
            null,
            item.closed,
            item.targetLayer,
            item.roomLabel,
            1,
            {
              fromInsert: true,
              isCurve: item.isCurve,
              insSpan,
            }
          );
        }

        for (let i = 0; i < blk.texts.length; i++) {
          const bt = blk.texts[i];
          const targetLayer = bt.layer === '0' ? effectiveInsLayer : bt.layer;
          const tPt = applyMat(mat, bt.pt);
          const scaleFactor = Math.max(0.1, Math.hypot(mat[0], mat[2]));
          recordTextToTarget(tPt, bt.text, (bt.height || 120) * scaleFactor, targetLayer);
        }

        for (let i = 0; i < blk.inserts.length; i++) {
          const sub = blk.inserts[i];
          expandInsertWithMat(sub, mat, effectiveInsLayer, depth + 1);
        }
      }
    }
  }

  function flushHatchEdge(loop: HatchLoop) {
    if (!loop || loop.edgeType === 0 || loop.invalid) return;
    if (loop.edgeType === 1) {
      // Line edge: (ex0, ey0) -> (ex1, ey1)
      if (Math.hypot(loop.ex1 - loop.ex0, loop.ey1 - loop.ey0) > 1e-5) {
        loop.edgeSegments.push([
          [loop.ex0, loop.ey0],
          [loop.ex1, loop.ey1],
        ]);
      }
    } else if (loop.edgeType === 2 && loop.er > 0) {
      // Circular arc edge
      const s = (loop.ea0 * Math.PI) / 180;
      const e = (loop.ea1 * Math.PI) / 180;
      let sw = loop.eccw ? e - s : s - e;
      while (sw <= 1e-6) sw += 2 * Math.PI;
      while (sw > 2 * Math.PI + 1e-6) sw -= 2 * Math.PI;
      const n = Math.max(4, Math.min(24, Math.ceil(sw / 0.2)));
      const seg: Point[] = [];
      for (let i = 0; i <= n; i++) {
        const q = loop.eccw ? s + (sw * i) / n : s - (sw * i) / n;
        seg.push([
          loop.ex0 + loop.er * Math.cos(q),
          loop.ey0 + loop.er * Math.sin(q),
        ]);
      }
      if (seg.length >= 2) {
        loop.edgeSegments.push(seg);
      }
    } else {
      // Elliptic or spline edge inside HATCH boundary has nested codes 72/73/10/20
      loop.invalid = true;
    }
    loop.edgeType = 0;
  }

  function stitchHatchEdgeLoop(segments: Point[][]): Point[] | null {
    if (!segments.length) return null;
    const used = new Uint8Array(segments.length);
    const poly: Point[] = [...segments[0]];
    used[0] = 1;

    // Compute characteristic loop size for connection tolerance
    let minX = poly[0][0];
    let maxX = poly[0][0];
    let minY = poly[0][1];
    let maxY = poly[0][1];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      for (let k = 0; k < s.length; k++) {
        if (s[k][0] < minX) minX = s[k][0];
        if (s[k][0] > maxX) maxX = s[k][0];
        if (s[k][1] < minY) minY = s[k][1];
        if (s[k][1] > maxY) maxY = s[k][1];
      }
    }
    const span = Math.max(maxX - minX, maxY - minY);
    if (span < 1e-4) return null;
    const maxGap = Math.max(1e-2, span * 0.02);

    for (let step = 1; step < segments.length; step++) {
      const tail = poly[poly.length - 1];
      let bestIdx = -1;
      let bestRev = false;
      let bestDist = maxGap;

      for (let i = 1; i < segments.length; i++) {
        if (used[i]) continue;
        const seg = segments[i];
        const dStart = Math.hypot(seg[0][0] - tail[0], seg[0][1] - tail[1]);
        if (dStart < bestDist) {
          bestDist = dStart;
          bestIdx = i;
          bestRev = false;
        }
        const endPt = seg[seg.length - 1];
        const dEnd = Math.hypot(endPt[0] - tail[0], endPt[1] - tail[1]);
        if (dEnd < bestDist) {
          bestDist = dEnd;
          bestIdx = i;
          bestRev = true;
        }
      }

      if (bestIdx === -1) {
        // Disconnected edges — discard loop to avoid drawing diagonal spiderweb lines
        return null;
      }

      used[bestIdx] = 1;
      const chosen = segments[bestIdx];
      if (bestRev) {
        for (let k = chosen.length - 2; k >= 0; k--) {
          poly.push(chosen[k]);
        }
      } else {
        for (let k = 1; k < chosen.length; k++) {
          poly.push(chosen[k]);
        }
      }
    }

    const first = poly[0];
    const last = poly[poly.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) > maxGap) {
      return null;
    }
    if (
      poly.length > 3 &&
      Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-4
    ) {
      poly.pop();
    }
    return poly.length >= 3 ? poly : null;
  }

  function flushLayerRecord() {
    if (inLayerRecord) {
      if (layerRecName) {
        const cleanLayer = decodeText(layerRecName) || layerRecName;
        layerNamesSet.add(cleanLayer);
        // In AutoCAD DXF: color < 0 means Layer is OFF; flag bit 1 means Layer is FROZEN
        if (layerRecColor < 0 || (layerRecFlags & 1) !== 0) {
          hiddenByCadSet.add(cleanLayer);
        }
      }
      inLayerRecord = false;
      layerRecName = '';
      layerRecColor = 7;
      layerRecFlags = 0;
    }
    if (inStyleRecord) {
      if (styleRecName && styleRecFont) {
        const hint = detectFontEncodingFromName(styleRecFont);
        if (hint) {
          styleFontMap.set(styleRecName.toUpperCase(), hint);
        }
      }
      inStyleRecord = false;
      styleRecName = '';
      styleRecFont = '';
    }
  }

  function flushEntity() {
    if (!entType || ignoreEnt) {
      entType = '';
      return;
    }
    if (paperSpace && section === 'ENTITIES') {
      entType = '';
      return;
    }

    if (entType === 'LINE') {
      // DXF LINE coordinates (10,20)-(11,21) are ALWAYS in WCS (never OCS-flipped)
      recordShapeToTarget(
        [
          [x0, y0],
          [x1, y1],
        ],
        null,
        false,
        layer,
        undefined,
        1
      );
    } else if (entType === 'LWPOLYLINE') {
      // DXF LWPOLYLINE coordinates are in OCS
      recordShapeToTarget(
        pts,
        bulges,
        Boolean(flags & 1),
        layer,
        customName ? decodeText(customName) : undefined,
        extZ
      );
    } else if (entType === 'CIRCLE') {
      // DXF CIRCLE center is in OCS
      if (r > 0) {
        const p: Point[] = [];
        const segs = 32;
        for (let i = 0; i < segs; i++) {
          const q = (i / segs) * 2 * Math.PI;
          p.push([x0 + r * Math.cos(q), y0 + r * Math.sin(q)]);
        }
        recordShapeToTarget(p, null, true, layer, undefined, extZ, {
          isCurve: true,
        });
      }
    } else if (entType === 'ARC') {
      // DXF ARC center and angles are in OCS
      if (r > 0) {
        const s = (a0 * Math.PI) / 180;
        const sw =
          ((((a1 - a0) % 360) + 360) % 360 || 360) * (Math.PI / 180);
        const n = Math.max(4, Math.min(32, Math.ceil(sw / 0.15)));
        const p: Point[] = [];
        for (let i = 0; i <= n; i++) {
          const q = s + (sw * i) / n;
          p.push([x0 + r * Math.cos(q), y0 + r * Math.sin(q)]);
        }
        recordShapeToTarget(p, null, false, layer, undefined, extZ, {
          isCurve: true,
        });
      }
    } else if (entType === 'ELLIPSE') {
      // DXF ELLIPSE center (x0,y0) and major axis vector (x1,y1) are ALREADY in WCS
      const majR = Math.hypot(x1, y1);
      if (majR > 0 && r > 0) {
        const minR = majR * r;
        const rot = Math.atan2(y1, x1);
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const startParam = eStartParam;
        const endParam =
          eEndParam > startParam + 1e-6 ? eEndParam : eEndParam + 2 * Math.PI;
        const sw = Math.min(2 * Math.PI, endParam - startParam);
        const isFull = Math.abs(sw - 2 * Math.PI) < 1e-2;
        const segs = Math.max(8, Math.min(36, Math.ceil(sw / 0.18)));
        const p: Point[] = [];
        const count = isFull ? segs : segs + 1;
        const minorSign = extZ < 0 ? -1 : 1;
        for (let i = 0; i < count; i++) {
          const t = startParam + (sw * i) / segs;
          const lx = majR * Math.cos(t);
          const ly = minorSign * minR * Math.sin(t);
          p.push([x0 + lx * cosR - ly * sinR, y0 + lx * sinR + ly * cosR]);
        }
        recordShapeToTarget(p, null, isFull, layer, undefined, 1, {
          isCurve: true,
        });
      }
    } else if (entType === 'SPLINE') {
      // DXF SPLINE control points (10,20) and fit points (11,21) are ALREADY in WCS
      const splinePts = fitPts.length >= 2 ? fitPts : pts;
      if (splinePts.length >= 2) {
        recordShapeToTarget(
          splinePts,
          null,
          Boolean(flags & 1),
          layer,
          undefined,
          1,
          { isCurve: true }
        );
      }
    } else if (entType === 'HATCH') {
      // Only extract clean, closed HATCH boundary loops in top-level Model Space
      if (!currentBlock) {
        if (curLoop) flushHatchEdge(curLoop);
        for (let i = 0; i < hatchLoops.length; i++) {
          const lp = hatchLoops[i];
          if (lp.invalid) continue;
          if (lp.isPoly) {
            if (lp.closed && lp.pts.length >= 3) {
              hatchCount++;
              recordShapeToTarget(
                lp.pts,
                lp.bulges.length === lp.pts.length ? lp.bulges : null,
                true,
                layer,
                undefined,
                extZ,
                { fromHatch: true }
              );
            }
          } else if (lp.edgeSegments.length > 0 && lp.edgesRemaining === 0) {
            const stitched = stitchHatchEdgeLoop(lp.edgeSegments);
            if (stitched && stitched.length >= 3) {
              hatchCount++;
              recordShapeToTarget(stitched, null, true, layer, undefined, extZ, {
                fromHatch: true,
              });
            }
          }
        }
      }
      hatchLoops = [];
      curLoop = null;
      inHatchBoundary = false;
    } else if (entType === 'POLYLINE') {
      // Ignore 3D polygon meshes (bit 16) and Polyface 3D meshes (bit 64)
      if ((flags & (16 | 64)) === 0) {
        inPoly = true;
        polyFlags = flags;
        polyLayer = layer;
        polyExtZ = (flags & 8) !== 0 ? 1 : extZ; // 3D polyline is in WCS
        polyPaperSpace = paperSpace;
        polyPts = [];
        polyBulges = [];
      } else {
        inPoly = false;
      }
    } else if (entType === 'VERTEX') {
      // Skip spline control frame points (bit 16) and polyface mesh records (bit 128)
      if (inPoly && (vFlags & (16 | 128)) === 0) {
        polyPts.push([vX, vY]);
        polyBulges.push((polyFlags & 8) !== 0 ? 0 : vBulge);
      }
    } else if (entType === 'SEQEND') {
      if (inPoly) {
        if (!(polyPaperSpace && section === 'ENTITIES')) {
          recordShapeToTarget(
            polyPts,
            polyBulges,
            Boolean(polyFlags & 1),
            polyLayer,
            undefined,
            polyExtZ
          );
        }
        inPoly = false;
        polyPts = [];
        polyBulges = [];
      }
    } else if (entType === 'INSERT') {
      // Skip anonymous dimension (*D) and hatch (*X) blocks
      if (
        blockName &&
        !blockName.startsWith('*D') &&
        !blockName.startsWith('*X')
      ) {
        const ins: BlockInsert = {
          name: blockName,
          layer,
          x: x0,
          y: y0,
          sx: scaleX || 1,
          sy: scaleY || 1,
          rot: rotDeg || 0,
          colCount: colCount || 1,
          rowCount: rowCount || 1,
          colSpace: colSpace || 0,
          rowSpace: rowSpace || 0,
          extZ,
        };
        if (currentBlock) {
          currentBlock.inserts.push(ins);
        } else {
          insertCount++;
          expandInsertWithMat(ins, [1, 0, 0, 1, 0, 0], layer, 0);
        }
      }
    } else if (
      entType === 'TEXT' ||
      entType === 'MTEXT' ||
      entType === 'ATTRIB'
    ) {
      // Record room/annotation texts in both Model Space and Block Definitions
      const styleHint = styleFontMap.get((textStyle || 'STANDARD').toUpperCase());
      const cleaned = decodeText(customName, styleHint);
      if (cleaned) {
        if (entType === 'MTEXT') {
          // MTEXT insertion point (10,20) is in WCS
          recordTextToTarget([x0, y0], cleaned, height, layer);
        } else {
          // TEXT / ATTRIB is in OCS; use alignment point (11,21) when aligned
          const useAlign = (hAlign !== 0 || vAlign !== 0) && hasAlignPt;
          const tx = useAlign ? x1 : x0;
          const ty = useAlign ? y1 : y0;
          recordTextToTarget(
            [extZ < 0 ? -tx : tx, ty],
            cleaned,
            height,
            layer
          );
        }
      }
    }

    entType = '';
  }

  function startEntity(nextType: string) {
    flushEntity();
    entType = nextType;
    inTrailingData = false;
    paperSpace = false;
    if (
      nextType === 'LINE' ||
      nextType === 'LWPOLYLINE' ||
      nextType === 'CIRCLE' ||
      nextType === 'ARC' ||
      nextType === 'ELLIPSE' ||
      nextType === 'SPLINE' ||
      nextType === 'HATCH' ||
      nextType === 'POLYLINE' ||
      nextType === 'VERTEX' ||
      nextType === 'SEQEND' ||
      nextType === 'INSERT' ||
      nextType === 'TEXT' ||
      nextType === 'MTEXT' ||
      nextType === 'ATTRIB'
    ) {
      ignoreEnt = false;
      layer = '0';
      textStyle = 'STANDARD';
      customName = '';
      blockName = '';
      flags = 0;
      hAlign = 0;
      vAlign = 0;
      hasAlignPt = false;
      x0 = 0;
      y0 = 0;
      x1 = 0;
      y1 = 0;
      r = 0;
      a0 = 0;
      a1 = 0;
      eStartParam = 0;
      eEndParam = Math.PI * 2;
      height = 0;
      scaleX = 1;
      scaleY = 1;
      rotDeg = 0;
      colCount = 1;
      colSpace = 0;
      rowCount = 1;
      rowSpace = 0;
      extZ = 1;
      vX = 0;
      vY = 0;
      vBulge = 0;
      vFlags = 0;
      if (nextType === 'LWPOLYLINE' || nextType === 'SPLINE') {
        pts = [];
        fitPts = [];
        bulges = [];
      } else if (nextType === 'HATCH') {
        hatchLoops = [];
        curLoop = null;
        inHatchBoundary = false;
      }
    } else {
      ignoreEnt = true;
    }
  }

  function feedChunk(chunk: string, isLastChunk: boolean): void {
    if (done) return;
    const str = remainder ? remainder + chunk : chunk;
    const len = str.length;
    let pos = 0;

    if (!checkedHeadless && len > 0) {
      checkedHeadless = true;
      const head = str.slice(0, Math.min(256, len));
      if (
        !/\bSECTION\b/.test(head) &&
        /^\s*0\s+(?:LINE|LWPOLYLINE|POLYLINE|CIRCLE|ARC|ELLIPSE|SPLINE|HATCH|INSERT|TEXT|MTEXT)\b/.test(
          head
        )
      ) {
        section = 'ENTITIES';
      }
    }

    while (pos < len) {
      let nl = str.indexOf('\n', pos);
      if (nl === -1) {
        if (!isLastChunk) {
          remainder = str.slice(pos);
          return;
        }
        nl = len;
      }

      let lineEnd = nl;
      if (lineEnd > pos && str.charCodeAt(lineEnd - 1) === 13) {
        lineEnd--;
      }

      if (pendingCode === null) {
        let p = pos;
        while (p < lineEnd && str.charCodeAt(p) <= 32) p++;
        if (p < lineEnd) {
          let code = 0;
          let valid = false;
          while (p < lineEnd) {
            const ch = str.charCodeAt(p);
            if (ch >= 48 && ch <= 57) {
              code = code * 10 + (ch - 48);
              valid = true;
              p++;
            } else if (ch <= 32) {
              break;
            } else {
              valid = false;
              break;
            }
          }
          if (valid) pendingCode = code;
        }
      } else {
        const c = pendingCode;
        pendingCode = null;

        if (c === 0) {
          let s = pos;
          let e = lineEnd;
          while (s < e && str.charCodeAt(s) <= 32) s++;
          while (e > s && str.charCodeAt(e - 1) <= 32) e--;
          const val = str.slice(s, e);

          if (val === 'SECTION') {
            flushEntity();
            flushLayerRecord();
            awaitingSectionName = true;
          } else if (val === 'ENDSEC') {
            flushEntity();
            flushLayerRecord();
            if (section === 'ENTITIES') {
              // Stop immediately after ENTITIES to skip trailing OBJECTS / THUMBNAILIMAGE
              section = 'NONE';
              done = true;
              remainder = '';
              return;
            }
            section = 'NONE';
          } else if (val === 'EOF') {
            flushEntity();
            flushLayerRecord();
            done = true;
            remainder = '';
            return;
          } else if (section === 'TABLES') {
            flushLayerRecord();
            if (val === 'LAYER') {
              inLayerRecord = true;
              layerRecName = '';
              layerRecColor = 7;
              layerRecFlags = 0;
            } else if (val === 'STYLE') {
              inStyleRecord = true;
              styleRecName = '';
              styleRecFont = '';
            }
          } else if (section === 'BLOCKS') {
            flushEntity();
            if (val === 'BLOCK') {
              currentBlock = {
                name: '',
                baseX: 0,
                baseY: 0,
                flags: 0,
                shapes: [],
                texts: [],
                inserts: [],
              };
              inBlockHeader = true;
              inTrailingData = false;
            } else if (val === 'ENDBLK') {
              if (
                currentBlock &&
                currentBlock.name &&
                !currentBlock.name.startsWith('*Model_Space') &&
                !currentBlock.name.startsWith('*Paper_Space') &&
                !currentBlock.name.startsWith('*D') &&
                !currentBlock.name.startsWith('*X')
              ) {
                blocks.set(currentBlock.name, currentBlock);
              }
              currentBlock = null;
              inBlockHeader = false;
            } else {
              inBlockHeader = false;
              startEntity(val);
            }
          } else if (section === 'ENTITIES') {
            startEntity(val);
          }
        } else if (awaitingSectionName) {
          if (c === 2) {
            let s = pos;
            let e = lineEnd;
            while (s < e && str.charCodeAt(s) <= 32) s++;
            while (e > s && str.charCodeAt(e - 1) <= 32) e--;
            const sec = str.slice(s, e);
            if (
              sec === 'HEADER' ||
              sec === 'TABLES' ||
              sec === 'BLOCKS' ||
              sec === 'ENTITIES'
            ) {
              section = sec;
            } else {
              section = 'SKIP';
            }
            awaitingSectionName = false;
          }
        } else if (section === 'HEADER') {
          if (c === 9) {
            let s = pos;
            let e = lineEnd;
            while (s < e && str.charCodeAt(s) <= 32) s++;
            while (e > s && str.charCodeAt(e - 1) <= 32) e--;
            headerVar = str.slice(s, e);
          } else if (c === 70 && headerVar === '$INSUNITS') {
            insUnitsCode = parseInt(str.slice(pos, lineEnd), 10) || 0;
            headerVar = '';
          }
        } else if (section === 'TABLES') {
          if (inLayerRecord) {
            if (c === 2) {
              let s = pos;
              let e = lineEnd;
              while (s < e && str.charCodeAt(s) <= 32) s++;
              while (e > s && str.charCodeAt(e - 1) <= 32) e--;
              layerRecName = str.slice(s, e);
            } else if (c === 62) {
              layerRecColor = parseInt(str.slice(pos, lineEnd), 10) || 0;
            } else if (c === 70) {
              layerRecFlags = parseInt(str.slice(pos, lineEnd), 10) || 0;
            }
          } else if (inStyleRecord) {
            if (c === 2 && !styleRecName) {
              let s = pos;
              let e = lineEnd;
              while (s < e && str.charCodeAt(s) <= 32) s++;
              while (e > s && str.charCodeAt(e - 1) <= 32) e--;
              styleRecName = str.slice(s, e);
            } else if (c === 3 || c === 4 || c === 1000) {
              let s = pos;
              let e = lineEnd;
              while (s < e && str.charCodeAt(s) <= 32) s++;
              while (e > s && str.charCodeAt(e - 1) <= 32) e--;
              if (e > s) styleRecFont += ' ' + str.slice(s, e);
            }
          }
        } else if (section === 'BLOCKS' && inBlockHeader && currentBlock) {
          if (c === 1001 || c === 101) {
            inTrailingData = true;
          } else if (!inTrailingData) {
            if (c === 2 && !currentBlock.name) {
              let s = pos;
              let e = lineEnd;
              while (s < e && str.charCodeAt(s) <= 32) s++;
              while (e > s && str.charCodeAt(e - 1) <= 32) e--;
              const bName = str.slice(s, e);
              if (bName) currentBlock.name = bName;
            } else if (c === 3 && !currentBlock.name) {
              let s = pos;
              let e = lineEnd;
              while (s < e && str.charCodeAt(s) <= 32) s++;
              while (e > s && str.charCodeAt(e - 1) <= 32) e--;
              const bName = str.slice(s, e);
              if (bName) currentBlock.name = bName;
            } else if (c === 10) {
              currentBlock.baseX = +str.slice(pos, lineEnd);
            } else if (c === 20) {
              currentBlock.baseY = +str.slice(pos, lineEnd);
            } else if (c === 70) {
              currentBlock.flags = parseInt(str.slice(pos, lineEnd), 10) || 0;
            }
          }
        } else if (
          (section === 'ENTITIES' || (section === 'BLOCKS' && !inBlockHeader)) &&
          !ignoreEnt
        ) {
          // Isolate XDATA (1001) and Embedded Objects (101) so their group codes never overwrite entity geometry
          if (c === 1001 || c === 101) {
            inTrailingData = true;
          } else if (!inTrailingData) {
            if (c === 67) {
              if ((parseInt(str.slice(pos, lineEnd), 10) || 0) === 1) {
                paperSpace = true;
              }
            } else if (entType === 'HATCH') {
              if (c === 8) {
                let s = pos;
                let e = lineEnd;
                while (s < e && str.charCodeAt(s) <= 32) s++;
                while (e > s && str.charCodeAt(e - 1) <= 32) e--;
                if (e > s) {
                  const rawLay = str.slice(s, e);
                  layer = decodeText(rawLay) || rawLay;
                }
              } else if (c === 230) {
                extZ = +str.slice(pos, lineEnd);
              } else if (c === 91) {
                inHatchBoundary = true;
              } else if (c === 92 && inHatchBoundary) {
                if (curLoop) flushHatchEdge(curLoop);
                const pathFlags = parseInt(str.slice(pos, lineEnd), 10) || 0;
                const isPoly = (pathFlags & 2) !== 0;
                curLoop = {
                  isPoly,
                  closed: true,
                  invalid: false,
                  pts: [],
                  bulges: [],
                  edgeSegments: [],
                  edgesRemaining: 0,
                  expectedVerts: 0,
                  edgeType: 0,
                  ex0: 0,
                  ey0: 0,
                  ex1: 0,
                  ey1: 0,
                  er: 0,
                  ea0: 0,
                  ea1: 0,
                  eccw: true,
                  expectingPolyHasBulge: isPoly,
                };
                hatchLoops.push(curLoop);
              } else if (c === 75 || c === 76 || c === 97 || c === 98) {
                if (curLoop) flushHatchEdge(curLoop);
                curLoop = null;
                if (c === 75 || c === 76 || c === 98) inHatchBoundary = false;
              } else if (curLoop && !curLoop.invalid) {
                if (curLoop.isPoly) {
                  if (c === 72 && curLoop.expectingPolyHasBulge) {
                    curLoop.expectingPolyHasBulge = false;
                  } else if (c === 73) {
                    curLoop.closed = (parseInt(str.slice(pos, lineEnd), 10) || 0) !== 0;
                  } else if (c === 93) {
                    curLoop.expectedVerts = parseInt(str.slice(pos, lineEnd), 10) || 0;
                  } else if (
                    c === 10 &&
                    curLoop.expectedVerts > 0 &&
                    curLoop.pts.length < curLoop.expectedVerts
                  ) {
                    curLoop.pts.push([+str.slice(pos, lineEnd), 0]);
                    curLoop.bulges.push(0);
                  } else if (c === 20 && curLoop.pts.length > 0) {
                    curLoop.pts[curLoop.pts.length - 1][1] = +str.slice(pos, lineEnd);
                  } else if (c === 42 && curLoop.bulges.length > 0) {
                    curLoop.bulges[curLoop.bulges.length - 1] = +str.slice(pos, lineEnd);
                  }
                } else {
                  // Edge boundary path
                  if (c === 93 && curLoop.edgesRemaining === 0 && curLoop.edgeSegments.length === 0) {
                    curLoop.edgesRemaining = parseInt(str.slice(pos, lineEnd), 10) || 0;
                  } else if (c === 72 && curLoop.edgesRemaining > 0) {
                    flushHatchEdge(curLoop);
                    const et = parseInt(str.slice(pos, lineEnd), 10) || 0;
                    curLoop.edgeType = et;
                    curLoop.edgesRemaining--;
                    curLoop.eccw = true;
                    if (et !== 1 && et !== 2) {
                      curLoop.invalid = true;
                    }
                  } else if (c === 10) {
                    curLoop.ex0 = +str.slice(pos, lineEnd);
                  } else if (c === 20) {
                    curLoop.ey0 = +str.slice(pos, lineEnd);
                  } else if (c === 11) {
                    curLoop.ex1 = +str.slice(pos, lineEnd);
                  } else if (c === 21) {
                    curLoop.ey1 = +str.slice(pos, lineEnd);
                  } else if (c === 40) {
                    curLoop.er = +str.slice(pos, lineEnd);
                  } else if (c === 50) {
                    curLoop.ea0 = +str.slice(pos, lineEnd);
                  } else if (c === 51) {
                    curLoop.ea1 = +str.slice(pos, lineEnd);
                  } else if (c === 73) {
                    curLoop.eccw = (parseInt(str.slice(pos, lineEnd), 10) || 0) !== 0;
                  }
                }
              }
            } else {
              // Standard Entities
              if (c === 10) {
                const v = +str.slice(pos, lineEnd);
                if (entType === 'LWPOLYLINE' || entType === 'SPLINE') {
                  pts.push([v, 0]);
                  if (entType === 'LWPOLYLINE') bulges.push(0);
                } else if (entType === 'VERTEX') {
                  vX = v;
                } else {
                  x0 = v;
                }
              } else if (c === 20) {
                const v = +str.slice(pos, lineEnd);
                if (entType === 'LWPOLYLINE' || entType === 'SPLINE') {
                  if (pts.length) pts[pts.length - 1][1] = v;
                } else if (entType === 'VERTEX') {
                  vY = v;
                } else {
                  y0 = v;
                }
              } else if (c === 11) {
                const v = +str.slice(pos, lineEnd);
                if (entType === 'SPLINE') {
                  fitPts.push([v, 0]);
                } else {
                  x1 = v;
                  hasAlignPt = true;
                }
              } else if (c === 21) {
                const v = +str.slice(pos, lineEnd);
                if (entType === 'SPLINE') {
                  if (fitPts.length) fitPts[fitPts.length - 1][1] = v;
                } else {
                  y1 = v;
                  hasAlignPt = true;
                }
              } else if (c === 40) {
                const v = +str.slice(pos, lineEnd);
                r = v;
                height = v;
              } else if (c === 41) {
                const v = +str.slice(pos, lineEnd);
                if (entType === 'ELLIPSE') eStartParam = v;
                else if (entType === 'INSERT') scaleX = v;
              } else if (c === 42) {
                const v = +str.slice(pos, lineEnd);
                if (entType === 'LWPOLYLINE') {
                  if (bulges.length) bulges[bulges.length - 1] = v;
                } else if (entType === 'VERTEX') {
                  vBulge = v;
                } else if (entType === 'ELLIPSE') {
                  eEndParam = v;
                } else if (entType === 'INSERT') {
                  scaleY = v;
                }
              } else if (c === 44) {
                colSpace = +str.slice(pos, lineEnd);
              } else if (c === 45) {
                rowSpace = +str.slice(pos, lineEnd);
              } else if (c === 50) {
                const v = +str.slice(pos, lineEnd);
                a0 = v;
                rotDeg = v;
              } else if (c === 51) {
                a1 = +str.slice(pos, lineEnd);
              } else if (c === 70) {
                const v = parseInt(str.slice(pos, lineEnd), 10) || 0;
                if (entType === 'VERTEX') vFlags = v;
                else if (entType === 'INSERT') colCount = v;
                else flags = v;
              } else if (c === 71) {
                if (entType === 'INSERT') {
                  rowCount = parseInt(str.slice(pos, lineEnd), 10) || 1;
                }
              } else if (c === 72) {
                hAlign = parseInt(str.slice(pos, lineEnd), 10) || 0;
              } else if (c === 73) {
                vAlign = parseInt(str.slice(pos, lineEnd), 10) || 0;
              } else if (c === 230) {
                extZ = +str.slice(pos, lineEnd);
              } else if (c === 8) {
                let s = pos;
                let e = lineEnd;
                while (s < e && str.charCodeAt(s) <= 32) s++;
                while (e > s && str.charCodeAt(e - 1) <= 32) e--;
                if (e > s) {
                  const rawLay = str.slice(s, e);
                  layer = decodeText(rawLay) || rawLay;
                }
              } else if (c === 7) {
                let s = pos;
                let e = lineEnd;
                while (s < e && str.charCodeAt(s) <= 32) s++;
                while (e > s && str.charCodeAt(e - 1) <= 32) e--;
                if (e > s) textStyle = str.slice(s, e);
              } else if (c === 2) {
                let s = pos;
                let e = lineEnd;
                while (s < e && str.charCodeAt(s) <= 32) s++;
                while (e > s && str.charCodeAt(e - 1) <= 32) e--;
                if (e > s) blockName = str.slice(s, e);
              } else if (c === 1) {
                let s = pos;
                let e = lineEnd;
                while (s < e && str.charCodeAt(s) <= 32) s++;
                while (e > s && str.charCodeAt(e - 1) <= 32) e--;
                if (e > s) {
                  customName += str.slice(s, e);
                }
              } else if (c === 3 && entType === 'MTEXT') {
                // Only MTEXT uses group code 3 for multi-chunk text continuation
                let s = pos;
                let e = lineEnd;
                while (s < e && str.charCodeAt(s) <= 32) s++;
                while (e > s && str.charCodeAt(e - 1) <= 32) e--;
                if (e > s) {
                  customName += str.slice(s, e);
                }
              }
            }
          }
        }
      }

      pos = nl + 1;
    }

    remainder = '';
    if (isLastChunk) {
      flushEntity();
      flushLayerRecord();
    }
  }

  function finalize() {
    flushEntity();
    flushLayerRecord();

    // Compute robust bounding box that ignores extreme stray CAD points/markers far from the drawing
    let validBb: [number, number, number, number] | null =
      shapes.length > 0 ? [bb[0], bb[1], bb[2], bb[3]] : null;

    if (shapes.length >= 40 && validBb) {
      const step = Math.max(1, Math.floor(shapes.length / 500));
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < shapes.length; i += step) {
        const b = shapes[i].bb;
        xs.push((b[0] + b[2]) * 0.5);
        ys.push((b[1] + b[3]) * 0.5);
      }
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      const q05x = xs[Math.floor(xs.length * 0.04)];
      const q95x = xs[Math.floor(xs.length * 0.96)];
      const q05y = ys[Math.floor(ys.length * 0.04)];
      const q95y = ys[Math.floor(ys.length * 0.96)];
      const coreSpan = Math.max(1, q95x - q05x, q95y - q05y);
      const pad = coreSpan * 4;
      const minAllowX = q05x - pad;
      const maxAllowX = q95x + pad;
      const minAllowY = q05y - pad;
      const maxAllowY = q95y + pad;

      let rx0 = 1e300;
      let ry0 = 1e300;
      let rx1 = -1e300;
      let ry1 = -1e300;
      let kept = 0;
      for (let i = 0; i < shapes.length; i++) {
        const b = shapes[i].bb;
        if (
          b[0] >= minAllowX &&
          b[2] <= maxAllowX &&
          b[1] >= minAllowY &&
          b[3] <= maxAllowY &&
          b[2] - b[0] <= coreSpan * 6 &&
          b[3] - b[1] <= coreSpan * 6
        ) {
          if (b[0] < rx0) rx0 = b[0];
          if (b[1] < ry0) ry0 = b[1];
          if (b[2] > rx1) rx1 = b[2];
          if (b[3] > ry1) ry1 = b[3];
          kept++;
        }
      }
      if (kept >= shapes.length * 0.7 && rx0 < rx1 && ry0 < ry1) {
        validBb = [rx0, ry0, rx1, ry1];
      }
    }

    // If an INSERT block spans more than 35% of the entire building plan, treat it as a structural plan block rather than loose furniture
    if (validBb && shapes.length > 0) {
      const planSpan = Math.max(1, validBb[2] - validBb[0], validBb[3] - validBb[1]);
      const maxFurnitureBlockSpan = planSpan * 0.35;
      for (let i = 0; i < shapes.length; i++) {
        if (shapes[i].fromInsert && shapeInsSpan[i] > maxFurnitureBlockSpan) {
          shapes[i].fromInsert = false;
        }
      }
    }

    // Fast 64x64 Spatial Grid matching to associate TEXT/MTEXT room names with enclosing closed shapes
    if (texts.length > 0 && shapes.length > 0 && validBb) {
      const G = 64;
      const minX = validBb[0];
      const minY = validBb[1];
      const invW = G / Math.max(1e-6, validBb[2] - validBb[0]);
      const invH = G / Math.max(1e-6, validBb[3] - validBb[1]);
      const closedCells: number[][] = Array.from({ length: G * G }, () => []);
      const maxIdx = G - 1;

      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        if (!s.closed || s.area <= 0) continue;
        const b = s.bb;
        const gx0 = Math.max(0, Math.min(maxIdx, ((b[0] - minX) * invW) | 0));
        const gx1 = Math.max(0, Math.min(maxIdx, ((b[2] - minX) * invW) | 0));
        const gy0 = Math.max(0, Math.min(maxIdx, ((b[1] - minY) * invH) | 0));
        const gy1 = Math.max(0, Math.min(maxIdx, ((b[3] - minY) * invH) | 0));
        for (let gy = gy0; gy <= gy1; gy++) {
          const ro = gy * G;
          for (let gx = gx0; gx <= gx1; gx++) {
            closedCells[ro + gx].push(i);
          }
        }
      }

      for (let i = 0; i < texts.length; i++) {
        const txt = texts[i];
        // Skip purely numeric dimension strings when assigning room names
        if (!/[A-Za-zÀ-ỹ]/.test(txt.text)) continue;
        const tx = txt.pt[0];
        const ty = txt.pt[1];
        const gx = Math.max(0, Math.min(maxIdx, ((tx - minX) * invW) | 0));
        const gy = Math.max(0, Math.min(maxIdx, ((ty - minY) * invH) | 0));
        const bucket = closedCells[gy * G + gx];
        let bestIdx = -1;
        let bestArea = 1e300;
        for (let k = 0; k < bucket.length; k++) {
          const idx = bucket[k];
          const s = shapes[idx];
          const b = s.bb;
          if (tx < b[0] || tx > b[2] || ty < b[1] || ty > b[3]) continue;
          if (s.area < bestArea && pointInPoly(txt.pt, s.pts)) {
            bestArea = s.area;
            bestIdx = idx;
          }
        }
        if (bestIdx >= 0 && !shapes[bestIdx].roomLabel) {
          shapes[bestIdx].roomLabel = txt.text;
        }
      }
    }

    // Resolve AutoCAD $INSUNITS code to meters conversion factor
    let unitFactor: number | null = null;
    let unitLabel = 'Tự nhận diện theo khổ bản vẽ';
    if (insUnitsCode === 4) {
      unitFactor = 0.001;
      unitLabel = 'mm (Chuẩn $INSUNITS=4)';
    } else if (insUnitsCode === 5) {
      unitFactor = 0.01;
      unitLabel = 'cm (Chuẩn $INSUNITS=5)';
    } else if (insUnitsCode === 6) {
      unitFactor = 1;
      unitLabel = 'm (Chuẩn $INSUNITS=6)';
    } else if (insUnitsCode === 1) {
      unitFactor = 0.0254;
      unitLabel = 'inch ($INSUNITS=1)';
    } else if (insUnitsCode === 2) {
      unitFactor = 0.3048;
      unitLabel = 'feet ($INSUNITS=2)';
    } else if (insUnitsCode === 14) {
      unitFactor = 0.1;
      unitLabel = 'dm ($INSUNITS=14)';
    }

    let closedShapes = 0;
    for (let i = 0; i < shapes.length; i++) {
      if (shapes[i].closed && shapes[i].area > 0) closedShapes++;
    }

    const metadata: DxfMetadata = {
      insUnitsCode,
      unitFactor,
      unitLabel,
      totalShapes: shapes.length,
      closedShapes,
      textCount: texts.length,
      layerCount: layerNamesSet.size,
      blockCount: blocks.size,
      insertCount,
      hatchCount,
      hiddenByCadLayers: Array.from(hiddenByCadSet),
    };

    return {
      shapes,
      texts,
      bb: validBb,
      metadata,
    };
  }

  return {
    feedChunk,
    finalize,
    decodeText,
    getDone: () => done,
    getShapeCount: () => shapes.length,
  };
}

const sharedDecodeEngine = createDxfStreamEngine();

/**
 * Decodes AutoCAD Unicode escapes (\U+XXXX), special symbols (%%c, %%d, %%p),
 * MTEXT formatting codes, and legacy Vietnamese CAD font encodings (TCVN3/.VnTime, VNI-Windows, CP1258).
 */
export function cleanDxfText(raw: string): string {
  return sharedDecodeEngine.decodeText(raw);
}

export function parseDxfFull(text: string): {
  shapes: DxfShape[];
  texts: DxfText[];
  bb: [number, number, number, number] | null;
  metadata: DxfMetadata;
} {
  const engine = createDxfStreamEngine();
  engine.feedChunk(text, true);
  return engine.finalize();
}

export function parseDxf(text: string): DxfShape[] {
  return parseDxfFull(text).shapes;
}

export interface DxfProgressInfo {
  pct: number;
  mbRead: string;
  totalMb: string;
  shapeCount: number;
}

/**
 * Serializes `createDxfStreamEngine` directly into a Web Worker so 200MB DXF files
 * parse in 8MB slices off the main thread with 100% identical support for
 * HEADER ($INSUNITS), TABLES (LAYER, STYLE), BLOCKS + INSERT, HATCH, ELLIPSE, SPLINE, TEXT/MTEXT/ATTRIB,
 * and automatic UTF-8 / Windows-1252 (TCVN3 / VNI) byte decoding.
 */
const WORKER_SCRIPT = `
const createDxfStreamEngine = ${createDxfStreamEngine.toString()};

self.onmessage = async function(ev) {
  const file = ev.data.file;
  if (!file) return;
  try {
    const totalSize = file.size || 1;
    const CHUNK_SIZE = 8 * 1024 * 1024;
    const utf8FatalDecoder = new TextDecoder('utf-8', { fatal: true });
    const win1252Decoder = new TextDecoder('windows-1252');
    let useWin1252 = false;
    const syncReader = typeof FileReaderSync !== 'undefined' ? new FileReaderSync() : null;
    const engine = createDxfStreamEngine();

    let offset = 0;
    while (offset < totalSize && !engine.getDone()) {
      const end = Math.min(offset + CHUNK_SIZE, totalSize);
      const slice = file.slice(offset, end);
      const buf = syncReader ? syncReader.readAsArrayBuffer(slice) : await slice.arrayBuffer();
      let chunkStr = '';
      if (!useWin1252) {
        try {
          chunkStr = utf8FatalDecoder.decode(buf, { stream: end < totalSize });
        } catch (_) {
          useWin1252 = true;
          chunkStr = win1252Decoder.decode(buf, { stream: end < totalSize });
        }
      } else {
        chunkStr = win1252Decoder.decode(buf, { stream: end < totalSize });
      }
      engine.feedChunk(chunkStr, end >= totalSize);
      offset = end;
      self.postMessage({
        type: 'progress',
        pct: engine.getDone() ? 98 : Math.min(98, Math.round((offset / totalSize) * 95)),
        mbRead: (offset / (1024 * 1024)).toFixed(1),
        totalMb: (totalSize / (1024 * 1024)).toFixed(1),
        shapeCount: engine.getShapeCount()
      });
    }

    const result = engine.finalize();
    self.postMessage({
      type: 'done',
      shapes: result.shapes,
      texts: result.texts,
      bb: result.bb,
      metadata: result.metadata
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err && err.message ? err.message : String(err)
    });
  }
};
`;

/**
 * Parses a DXF File (up to 200MB+) asynchronously in 8MB streaming slices inside a Web Worker.
 */
export function parseDxfFileFast(
  file: File,
  onProgress?: (info: DxfProgressInfo) => void
): {
  promise: Promise<{
    shapes: DxfShape[];
    texts: DxfText[];
    bb: [number, number, number, number] | null;
    metadata: DxfMetadata;
  }>;
  cancel: () => void;
} {
  let cancelled = false;
  let activeWorker: Worker | null = null;
  let workerUrl: string | null = null;

  const cleanup = () => {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    if (workerUrl) {
      URL.revokeObjectURL(workerUrl);
      workerUrl = null;
    }
  };

  const promise = new Promise<{
    shapes: DxfShape[];
    texts: DxfText[];
    bb: [number, number, number, number] | null;
    metadata: DxfMetadata;
  }>((resolve, reject) => {
    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      try {
        const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
        workerUrl = URL.createObjectURL(blob);
        activeWorker = new Worker(workerUrl);

        activeWorker.onmessage = (ev) => {
          if (cancelled) return;
          const data = ev.data;
          if (data.type === 'progress') {
            onProgress?.({
              pct: data.pct,
              mbRead: data.mbRead,
              totalMb: data.totalMb,
              shapeCount: data.shapeCount,
            });
          } else if (data.type === 'done') {
            cleanup();
            resolve({
              shapes: data.shapes,
              texts: data.texts,
              bb: data.bb,
              metadata: data.metadata,
            });
          } else if (data.type === 'error') {
            cleanup();
            reject(new Error(data.message));
          }
        };

        activeWorker.onerror = () => {
          cleanup();
          runChunkedMainThread().then(resolve).catch(reject);
        };

        activeWorker.postMessage({ file });
        return;
      } catch {
        cleanup();
      }
    }

    runChunkedMainThread().then(resolve).catch(reject);

    async function runChunkedMainThread() {
      const totalSize = file.size || 1;
      const CHUNK_SIZE = 8 * 1024 * 1024;
      const utf8FatalDecoder = new TextDecoder('utf-8', { fatal: true });
      const win1252Decoder = new TextDecoder('windows-1252');
      let useWin1252 = false;
      const engine = createDxfStreamEngine();
      let offset = 0;

      while (offset < totalSize && !engine.getDone()) {
        if (cancelled) throw new Error('CANCELLED');
        const end = Math.min(offset + CHUNK_SIZE, totalSize);
        const buf = await file.slice(offset, end).arrayBuffer();
        if (cancelled) throw new Error('CANCELLED');
        let chunkStr = '';
        if (!useWin1252) {
          try {
            chunkStr = utf8FatalDecoder.decode(buf, { stream: end < totalSize });
          } catch {
            useWin1252 = true;
            chunkStr = win1252Decoder.decode(buf, { stream: end < totalSize });
          }
        } else {
          chunkStr = win1252Decoder.decode(buf, { stream: end < totalSize });
        }
        engine.feedChunk(chunkStr, end >= totalSize);
        offset = end;
        onProgress?.({
          pct: engine.getDone() ? 98 : Math.min(98, Math.round((offset / totalSize) * 95)),
          mbRead: (offset / (1024 * 1024)).toFixed(1),
          totalMb: (totalSize / (1024 * 1024)).toFixed(1),
          shapeCount: engine.getShapeCount(),
        });
        await new Promise((r) => setTimeout(r, 0));
      }

      return engine.finalize();
    }
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      cleanup();
    },
  };
}

export function tileCalc(
  r: TakeoffRow,
  T: TileConfig,
  unitFactor: number
): TileResult | null {
  const pattern = T.pattern || 'grid';
  const key = [
    T.w,
    T.h,
    T.g,
    pattern,
    T.offsetX || 0,
    T.offsetY || 0,
    unitFactor,
  ].join('|');
  if (r.tcKey === key && r.tc !== undefined) return r.tc;
  r.tcKey = key;
  r.tc = null;
  if (r.kind === 'dist' || !(unitFactor > 0)) return null;

  const tw = T.w / 1000 / unitFactor;
  const th = T.h / 1000 / unitFactor;
  const g = (T.g || 0) / 1000 / unitFactor;
  const p = r.pts;

  let x0 = 1e300;
  let y0 = 1e300;
  let x1 = -1e300;
  let y1 = -1e300;
  for (const q of p) {
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }

  const cells: TileCell[] = [];
  let full = 0;
  let cut = 0;

  // 1. KIỂU XƯƠNG CÁ 45 ĐỘ (HERRINGBONE 45°)
  if (pattern === 'herringbone') {
    const L = Math.max(tw, th);
    const W = Math.min(tw, th);
    const c = 0.70710678; // cos(45 deg)
    const s = 0.70710678; // sin(45 deg)
    const stepX = (L + W) * c + g;
    const stepY = (L + W) * c + g;

    const nx = Math.ceil((x1 - x0 + L * 2) / stepX) + 2;
    const ny = Math.ceil((y1 - y0 + L * 2) / stepY) + 2;

    if (!(nx > 0 && ny > 0) || nx * ny * 2 > 30000) {
      r.tc = { big: true, full: 0, cut: 0, cells: [] };
      return r.tc;
    }

    const shiftX = ((T.offsetX || 0) / 100) * stepX;
    const shiftY = ((T.offsetY || 0) / 100) * stepY;
    const startX = x0 - L - shiftX;
    const startY = y0 - L - shiftY;

    const segInt = (a: Point, b: Point, cPt: Point, dPt: Point) => {
      const ccw = (p1: Point, p2: Point, p3: Point) =>
        (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
      return ccw(a, cPt, dPt) !== ccw(b, cPt, dPt) && ccw(a, b, cPt) !== ccw(a, b, dPt);
    };

    const testQuad = (pts: Point[]) => {
      let cx = 0, cy = 0;
      let minX = 1e300, maxX = -1e300, minY = 1e300, maxY = -1e300;
      for (let k = 0; k < 4; k++) {
        cx += pts[k][0];
        cy += pts[k][1];
        if (pts[k][0] < minX) minX = pts[k][0];
        if (pts[k][0] > maxX) maxX = pts[k][0];
        if (pts[k][1] < minY) minY = pts[k][1];
        if (pts[k][1] > maxY) maxY = pts[k][1];
      }
      cx /= 4;
      cy /= 4;

      if (maxX < x0 || minX > x1 || maxY < y0 || minY > y1) return;

      let hit = false;
      for (let k = 0; k < p.length && !hit; k++) {
        const pk1 = p[k];
        const pk2 = p[(k + 1) % p.length];
        for (let e = 0; e < 4; e++) {
          if (segInt(pk1, pk2, pts[e], pts[(e + 1) % 4])) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        cut++;
        cells.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY, isCut: true, pts });
      } else if (pip([cx, cy], p)) {
        full++;
        cells.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY, isCut: false, pts });
      }
    };

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const ox = startX + i * stepX;
        const oy = startY + j * stepY;

        // Thanh nghiêng +45 độ
        const P0: Point = [ox, oy];
        const P1: Point = [ox + L * c, oy + L * s];
        const P2: Point = [ox + L * c - W * s, oy + L * s + W * c];
        const P3: Point = [ox - W * s, oy + W * c];
        testQuad([P0, P1, P2, P3]);

        // Thanh vuông góc -45 độ tiếp nối
        const Q0: Point = [P1[0] + g * c, P1[1]];
        const Q1: Point = [Q0[0] + W * s, Q0[1] + W * c];
        const Q2: Point = [Q1[0] - L * c, Q1[1] + L * s];
        const Q3: Point = [Q0[0] - L * c, Q0[1] + L * s];
        testQuad([Q0, Q1, Q2, Q3]);
      }
    }

    r.tc = { full, cut, cells };
    return r.tc;
  }

  // 2. KIỂU XƯƠNG CÁ 90 ĐỘ (HERRINGBONE 90°)
  if (pattern === 'herringbone90') {
    const L = Math.max(tw, th);
    const W = Math.min(tw, th);
    const step = L + W + 2 * g;

    const nx = Math.ceil((x1 - x0) / step) + 2;
    const ny = Math.ceil((y1 - y0) / step) + 2;

    if (!(nx > 0 && ny > 0) || nx * ny * 4 > 30000) {
      r.tc = { big: true, full: 0, cut: 0, cells: [] };
      return r.tc;
    }

    const shiftX = ((T.offsetX || 0) / 100) * step;
    const shiftY = ((T.offsetY || 0) / 100) * step;
    const startX = x0 - shiftX;
    const startY = y0 - shiftY;

    const e = Math.min(L, W) * 1e-4;

    const testRect = (rx: number, ry: number, rw: number, rh: number) => {
      const rc: [number, number, number, number] = [rx + e, ry + e, rx + rw - e, ry + rh - e];
      let hit = false;
      for (let k = 0; k < p.length && !hit; k++) {
        hit = segRect(p[k], p[(k + 1) % p.length], rc);
      }
      if (hit) {
        cut++;
        cells.push({ x: rx, y: ry, w: rw, h: rh, isCut: true });
      } else if (pip([rx + rw / 2, ry + rh / 2], p)) {
        full++;
        cells.push({ x: rx, y: ry, w: rw, h: rh, isCut: false });
      }
    };

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const ox = startX + i * step;
        const oy = startY + j * step;
        // 4 viên đan xen trong 1 ô lặp vuông
        testRect(ox, oy, L, W);
        testRect(ox + L + g, oy, W, L);
        testRect(ox + W + g, oy + L + g, L, W);
        testRect(ox, oy + W + g, W, L);
      }
    }

    r.tc = { full, cut, cells };
    return r.tc;
  }

  // 3. CÁC KIỂU LÁT HÌNH CHỮ NHẬT: THẲNG HÀNG (GRID), SO LE 50% (RUNNING), SO LE 1/3 (THIRD)
  const pw = tw + g;
  const ph = th + g;
  const shiftX = ((T.offsetX || 0) / 100) * pw;
  const shiftY = ((T.offsetY || 0) / 100) * ph;
  const startX = x0 - (shiftX > 0 ? pw - shiftX : 0);
  const startY = y0 - (shiftY > 0 ? ph - shiftY : 0);

  const nx = Math.ceil((x1 - startX) / pw) + 2;
  const ny = Math.ceil((y1 - startY) / ph) + 1;
  if (!(nx > 0 && ny > 0) || nx * ny > 25000) {
    r.tc = { big: true, full: 0, cut: 0, cells: [] };
    return r.tc;
  }

  const e = Math.min(tw, th) * 1e-4;

  for (let j = 0; j < ny; j++) {
    const y = startY + j * ph;
    let xOffset = 0;
    if (pattern === 'running') {
      xOffset = (j % 2) * (pw * 0.5);
    } else if (pattern === 'third') {
      xOffset = (j % 3) * (pw / 3);
    }

    const iStart = xOffset > 0 ? -1 : 0;
    for (let i = iStart; i < nx; i++) {
      const x = startX + i * pw + xOffset;
      const rc: [number, number, number, number] = [
        x + e,
        y + e,
        x + tw - e,
        y + th - e,
      ];
      let hit = false;
      for (let k = 0; k < p.length && !hit; k++) {
        hit = segRect(p[k], p[(k + 1) % p.length], rc);
      }
      if (hit) {
        cut++;
        cells.push({ x, y, w: tw, h: th, isCut: true });
      } else if (pip([x + tw / 2, y + th / 2], p)) {
        full++;
        cells.push({ x, y, w: tw, h: th, isCut: false });
      }
    }
  }

  r.tc = { full, cut, cells };
  return r.tc;
}

/**
 * Searches across grid origin offsets (and 90-degree rotation if rectangular tile)
 * to minimize total tiles and cut tiles across all visible area rows.
 */
export function optimizeTileGridOrigin(
  rows: TakeoffRow[],
  currentConfig: TileConfig,
  unitFactor: number
): {
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  savedCut: number;
  savedTotal: number;
} {
  const areaRows = rows.filter((r) => r.kind !== 'dist' && r.visible !== false);
  if (!areaRows.length || !(unitFactor > 0)) {
    return {
      offsetX: currentConfig.offsetX,
      offsetY: currentConfig.offsetY,
      w: currentConfig.w,
      h: currentConfig.h,
      savedCut: 0,
      savedTotal: 0,
    };
  }

  const evaluate = (w: number, h: number, ox: number, oy: number) => {
    let full = 0;
    let cut = 0;
    const tempCfg: TileConfig = {
      ...currentConfig,
      w,
      h,
      offsetX: ox,
      offsetY: oy,
    };
    for (const r of areaRows) {
      const clone: TakeoffRow = { ...r, tcKey: undefined, tc: undefined };
      const res = tileCalc(clone, tempCfg, unitFactor);
      if (res && !res.big) {
        full += res.full;
        cut += res.cut;
      }
    }
    return { full, cut, total: full + cut };
  };

  const baseline = evaluate(
    currentConfig.w,
    currentConfig.h,
    currentConfig.offsetX,
    currentConfig.offsetY
  );

  let bestW = currentConfig.w;
  let bestH = currentConfig.h;
  let bestOx = currentConfig.offsetX;
  let bestOy = currentConfig.offsetY;
  let bestCut = baseline.cut;
  let bestTotal = baseline.total;

  const orientations: [number, number][] =
    currentConfig.w === currentConfig.h
      ? [[currentConfig.w, currentConfig.h]]
      : [
          [currentConfig.w, currentConfig.h],
          [currentConfig.h, currentConfig.w],
        ];

  const steps = [0, 15, 30, 50, 65, 80];
  for (const [w, h] of orientations) {
    for (const ox of steps) {
      for (const oy of steps) {
        const res = evaluate(w, h, ox, oy);
        if (
          res.total > 0 &&
          (res.cut < bestCut || (res.cut === bestCut && res.total < bestTotal))
        ) {
          bestCut = res.cut;
          bestTotal = res.total;
          bestW = w;
          bestH = h;
          bestOx = ox;
          bestOy = oy;
        }
      }
    }
  }

  return {
    offsetX: bestOx,
    offsetY: bestOy,
    w: bestW,
    h: bestH,
    savedCut: Math.max(0, baseline.cut - bestCut),
    savedTotal: Math.max(0, baseline.total - bestTotal),
  };
}

/**
 * Generates an authentic ASCII DXF sample floorplan of a 2-Bedroom Apartment (in mm)
 * with HEADER ($INSUNITS=4), TABLES (LAYER), closed room polylines, TEXT room labels, perimeter walls, and balcony.
 */
export function generateSampleApartmentDxf(): string {
  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];

  const addClosedPoly = (pts: Point[], layer: string) => {
    lines.push('0', 'LWPOLYLINE', '8', layer, '70', '1');
    for (const [x, y] of pts) {
      lines.push('10', String(x), '20', String(y));
    }
  };

  const addText = (x: number, y: number, text: string, height = 180) => {
    lines.push(
      '0',
      'TEXT',
      '8',
      'TEXT_TEN_PHONG',
      '10',
      String(x),
      '20',
      String(y),
      '40',
      String(height),
      '1',
      text
    );
  };

  const addLine = (a: Point, b: Point, layer: string) => {
    lines.push(
      '0',
      'LINE',
      '8',
      layer,
      '10',
      String(a[0]),
      '20',
      String(a[1]),
      '11',
      String(b[0]),
      '21',
      String(b[1])
    );
  };

  const addArc = (
    cx: number,
    cy: number,
    r: number,
    a0: number,
    a1: number,
    layer: string
  ) => {
    lines.push(
      '0',
      'ARC',
      '8',
      layer,
      '10',
      String(cx),
      '20',
      String(cy),
      '40',
      String(r),
      '50',
      String(a0),
      '51',
      String(a1)
    );
  };

  // Outer building envelope (9600 x 7200 mm)
  addClosedPoly(
    [
      [-200, -200],
      [9800, -200],
      [9800, 7400],
      [-200, 7400],
    ],
    'TUONG_BAO'
  );

  // 1. Phòng khách & Bếp - Ăn (L-shaped living + dining + kitchen)
  addClosedPoly(
    [
      [0, 0],
      [5400, 0],
      [5400, 4400],
      [3200, 4400],
      [3200, 7200],
      [0, 7200],
    ],
    'SAN_PHONG'
  );
  addText(2200, 2600, 'Phòng khách & Bếp');

  // 2. Phòng ngủ Master (Master Bedroom)
  addClosedPoly(
    [
      [5550, 0],
      [9600, 0],
      [9600, 4400],
      [5550, 4400],
    ],
    'SAN_PHONG'
  );
  addText(7500, 2200, 'Phòng ngủ Master');

  // 3. Phòng ngủ 2 (Bedroom 2)
  addClosedPoly(
    [
      [6200, 4550],
      [9600, 4550],
      [9600, 7200],
      [6200, 7200],
    ],
    'SAN_PHONG'
  );
  addText(7900, 5850, 'Phòng ngủ 2');

  // 4. WC Master
  addClosedPoly(
    [
      [3350, 4550],
      [4700, 4550],
      [4700, 7200],
      [3350, 7200],
    ],
    'SAN_WC'
  );
  addText(4025, 5850, 'WC Master', 140);

  // 5. WC Chung
  addClosedPoly(
    [
      [4850, 4550],
      [6050, 4550],
      [6050, 7200],
      [4850, 7200],
    ],
    'SAN_WC'
  );
  addText(5450, 5850, 'WC Chung', 140);

  // 6. Logia / Ban công (Balcony)
  addClosedPoly(
    [
      [0, -1400],
      [5400, -1400],
      [5400, -200],
      [0, -200],
    ],
    'SAN_BAN_CONG'
  );
  addText(2700, -800, 'Logia / Ban công', 150);

  // Architectural door swings & details on CUA_KIEN_TRUC layer
  addArc(5550, 900, 900, 0, 90, 'CUA_KIEN_TRUC');
  addLine([5550, 900], [6450, 900], 'CUA_KIEN_TRUC');

  addArc(6200, 5400, 850, 0, 90, 'CUA_KIEN_TRUC');
  addLine([6200, 5400], [7050, 5400], 'CUA_KIEN_TRUC');

  addArc(4000, 4550, 700, 0, 90, 'CUA_KIEN_TRUC');
  addLine([4000, 4550], [4000, 5250], 'CUA_KIEN_TRUC');

  addArc(5000, 4550, 700, 0, 90, 'CUA_KIEN_TRUC');
  addLine([5000, 4550], [5000, 5250], 'CUA_KIEN_TRUC');

  // Balcony railing lines
  for (let x = 200; x <= 5200; x += 250) {
    addLine([x, -1400], [x, -1320], 'TUONG_BAO');
  }

  // Sample Furniture on NOI_THAT layer & Sanitary fixtures on TBVS layer (to demonstrate 1-click Clutter Filter)
  // Living room Sofa + Coffee table
  addClosedPoly(
    [
      [400, 500],
      [2800, 500],
      [2800, 1350],
      [400, 1350],
    ],
    'NOI_THAT'
  );
  addClosedPoly(
    [
      [900, 1600],
      [2300, 1600],
      [2300, 2200],
      [900, 2200],
    ],
    'NOI_THAT'
  );
  // Master Bedroom Bed + Nightstands
  addClosedPoly(
    [
      [6800, 1200],
      [8800, 1200],
      [8800, 3000],
      [6800, 3000],
    ],
    'NOI_THAT'
  );
  // Bedroom 2 Bed
  addClosedPoly(
    [
      [7400, 5200],
      [9200, 5200],
      [9200, 6800],
      [7400, 6800],
    ],
    'NOI_THAT'
  );
  // Sanitary fixtures in WC
  addClosedPoly(
    [
      [3500, 6400],
      [3950, 6400],
      [3950, 7050],
      [3500, 7050],
    ],
    'TBVS'
  );
  addClosedPoly(
    [
      [5000, 6400],
      [5450, 6400],
      [5450, 7050],
      [5000, 7050],
    ],
    'TBVS'
  );

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}
