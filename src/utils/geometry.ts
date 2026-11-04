export interface Point2D {
  x: number
  y: number
}

export interface SnapInfo {
  point: Point2D
  type: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'first-point' | 'none'
  label: string
}

export interface PolygonSegment {
  index: number
  from: Point2D
  to: Point2D
  lengthRaw: number
  lengthMeters: number
}

export interface MeasuredPolygon {
  id: string
  name: string
  color: string
  points: Point2D[]
  areaRaw: number
  areaSquareMeters: number
  perimeterRaw: number
  perimeterMeters: number
  segments: PolygonSegment[]
  visible: boolean
  insunits: number
  /** Phân loại: 'floor' (vùng sàn, mặc định) hoặc 'dist' (tạo bằng công cụ Đo dài) */
  kind?: 'floor' | 'dist'
  /** Sheet / Layout nơi vùng đo này được tạo (btrId của Model hoặc Paper Space) */
  layoutBtrId?: string
  /** Tên Sheet / Layout hiển thị (ví dụ: 'Model', 'Layout1', ...) */
  layoutName?: string
  /** Chiều cao / Cao độ tường (m) dùng để tính diện tích tường (chu vi × cao độ) */
  heightMeters?: number
}

export interface InsunitsOption {
  code: number
  name: string
  symbol: string
  /** Hệ số nhân để đổi 1 đơn vị chiều dài bản vẽ sang mét (m) */
  toMeters: number
  /** Hệ số chia từ đơn vị diện tích bản vẽ sang m² (ví dụ mm² -> m² là chia 1,000,000) */
  areaDivisorDesc: string
}

/**
 * Bảng tra cứu chuẩn AutoCAD $INSUNITS và hệ số quy đổi sang hệ mét (m, m²)
 */
export const INSUNITS_OPTIONS: InsunitsOption[] = [
  {
    code: 4,
    name: 'Millimeters (mm)',
    symbol: 'mm',
    toMeters: 0.001,
    areaDivisorDesc: '÷ 1,000,000 (10⁶ mm² = 1 m²)',
  },
  {
    code: 5,
    name: 'Centimeters (cm)',
    symbol: 'cm',
    toMeters: 0.01,
    areaDivisorDesc: '÷ 10,000 (10⁴ cm² = 1 m²)',
  },
  {
    code: 14,
    name: 'Decimeters (dm)',
    symbol: 'dm',
    toMeters: 0.1,
    areaDivisorDesc: '÷ 100 (10² dm² = 1 m²)',
  },
  {
    code: 6,
    name: 'Meters (m)',
    symbol: 'm',
    toMeters: 1,
    areaDivisorDesc: '÷ 1 (1 m² = 1 m²)',
  },
  {
    code: 1,
    name: 'Inches (in)',
    symbol: 'in',
    toMeters: 0.0254,
    areaDivisorDesc: '× 0.00064516 (1 in = 25.4 mm)',
  },
  {
    code: 2,
    name: 'Feet (ft)',
    symbol: 'ft',
    toMeters: 0.3048,
    areaDivisorDesc: '× 0.09290304 (1 ft = 0.3048 m)',
  },
  {
    code: 10,
    name: 'Yards (yd)',
    symbol: 'yd',
    toMeters: 0.9144,
    areaDivisorDesc: '× 0.83612736 (1 yd = 0.9144 m)',
  },
  {
    code: 7,
    name: 'Kilometers (km)',
    symbol: 'km',
    toMeters: 1000,
    areaDivisorDesc: '× 1,000,000 (1 km² = 10⁶ m²)',
  },
  {
    code: 0,
    name: 'Unitless (Mặc định 1 đơn vị = 1 mm)',
    symbol: 'unit',
    toMeters: 0.001,
    areaDivisorDesc: '÷ 1,000,000 (giả định mm)',
  },
]

export function getInsunitsOption(code: number): InsunitsOption {
  return (
    INSUNITS_OPTIONS.find(opt => opt.code === code) ?? {
      code,
      name: `Mã INSUNITS (${code})`,
      symbol: 'unit',
      toMeters: 0.001,
      areaDivisorDesc: '÷ 1,000,000',
    }
  )
}

/**
 * Đọc trực tiếp biến $INSUNITS từ phần HEADER của nội dung file DXF
 */
export function parseInsunitsFromDxfBuffer(buffer: ArrayBuffer): number | null {
  try {
    // Chỉ cần giải mã tối đa 128KB đầu tiên vì HEADER luôn nằm ở đầu file DXF
    const slice = buffer.slice(0, Math.min(buffer.byteLength, 131072))
    const text = new TextDecoder('utf-8', { fatal: false }).decode(slice)
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length - 2; i++) {
      if (lines[i].trim() === '$INSUNITS') {
        // Tìm mã nhóm 70 ngay sau $INSUNITS
        for (let j = i + 1; j < Math.min(i + 6, lines.length - 1); j += 2) {
          const groupCode = lines[j].trim()
          const valueStr = lines[j + 1]?.trim()
          if (groupCode === '70' && valueStr !== undefined) {
            const parsed = parseInt(valueStr, 10)
            if (!Number.isNaN(parsed)) {
              return parsed
            }
          }
        }
      }
      if (lines[i].trim() === 'ENTITIES') {
        break
      }
    }
  } catch {
    // Bỏ qua nếu là file nhị phân
  }
  return null
}

/**
 * Công thức Shoelace (Gauss's area formula / Công thức dây giày)
 * Tính diện tích đa giác dựa trên danh sách các đỉnh liên tiếp (x_i, y_i)
 *
 * Area = 1/2 * | Σ (x_i * y_{i+1} - x_{i+1} * y_i) |
 */
export function calculateShoelaceArea(points: Point2D[]): number {
  const n = points.length
  if (n < 3) return 0

  let sum = 0
  for (let i = 0; i < n; i++) {
    const current = points[i]
    const next = points[(i + 1) % n]
    sum += current.x * next.y - next.x * current.y
  }

  return Math.abs(sum) * 0.5
}

/**
 * Quy đổi diện tích từ đơn vị gốc của bản vẽ sang mét vuông (m²)
 * Ví dụ: Bản vẽ vẽ bằng mm (toMeters = 0.001) -> nhân với (0.001)^2 = chia cho 1,000,000
 */
export function convertAreaToSquareMeters(
  areaRaw: number,
  toMetersFactor: number
): number {
  return areaRaw * (toMetersFactor * toMetersFactor)
}

/**
 * Tính danh sách các đoạn thẳng (cạnh) của đa giác
 */
export function calculatePolygonSegments(
  points: Point2D[],
  toMetersFactor: number,
  closed = true
): PolygonSegment[] {
  const segments: PolygonSegment[] = []
  if (points.length < 2) return segments

  const count = closed ? points.length : points.length - 1
  for (let i = 0; i < count; i++) {
    const from = points[i]
    const to = points[(i + 1) % points.length]
    const lengthRaw = Math.hypot(to.x - from.x, to.y - from.y)
    segments.push({
      index: i + 1,
      from,
      to,
      lengthRaw,
      lengthMeters: lengthRaw * toMetersFactor,
    })
  }
  return segments
}

/**
 * Tính trọng tâm (Centroid) của đa giác để đặt nhãn diện tích chính xác
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
  const n = points.length
  if (n === 0) return { x: 0, y: 0 }
  if (n < 3) {
    const sumX = points.reduce((acc, p) => acc + p.x, 0)
    const sumY = points.reduce((acc, p) => acc + p.y, 0)
    return { x: sumX / n, y: sumY / n }
  }

  let signedAreaTwice = 0
  let cx = 0
  let cy = 0

  for (let i = 0; i < n; i++) {
    const p0 = points[i]
    const p1 = points[(i + 1) % n]
    const cross = p0.x * p1.y - p1.x * p0.y
    signedAreaTwice += cross
    cx += (p0.x + p1.x) * cross
    cy += (p0.y + p1.y) * cross
  }

  if (Math.abs(signedAreaTwice) < 1e-9) {
    const sumX = points.reduce((acc, p) => acc + p.x, 0)
    const sumY = points.reduce((acc, p) => acc + p.y, 0)
    return { x: sumX / n, y: sumY / n }
  }

  const factor = 1 / (3 * signedAreaTwice)
  return {
    x: cx * factor,
    y: cy * factor,
  }
}
