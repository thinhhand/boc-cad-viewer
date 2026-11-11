import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AcApDocManager,
  type AcApDocument,
  type AcApFindLayoutHit,
  type AcApLayerInfo,
  AcApOpenViewMode,
  AcApSettingManager,
  AcEdOpenMode,
  AcEdViewMode,
  acapFindHitBox,
  acapFindText,
  acapMTextToPlainText,
  acapNavigateToFindHit,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE,
} from '@mlightcad/cad-simple-viewer'
import {
  ACDB_DRAW_CIRCLE_SIDES_HIGH,
  AcDb2dPolyline,
  AcDb3dPolyline,
  AcDbArc,
  AcDbBlockReference,
  AcDbCircle,
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbEllipse,
  AcDbEntity,
  AcDbFileType,
  AcDbHatch,
  AcDbLine,
  AcDbMText,
  AcDbOsnapMode,
  acdbHostApplicationServices,
  acdbOsnapModesToMask,
  AcDbPolyline,
  AcDbSpline,
  AcDbSysVarManager,
  AcDbText,
  AcGeBox2d,
  AcGePoint2d,
} from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'
import {
  calculatePolygonCentroid,
  calculatePolygonSegments,
  calculateShoelaceArea,
  convertAreaToSquareMeters,
  getInsunitsOption,
  type MeasuredPolygon,
  parseInsunitsFromDxfBuffer,
  type Point2D,
  type SnapInfo,
} from '../utils/geometry'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FileUp,
  FolderOpen,
  Grid,
  Info,
  Layers,
  Layout,
  Link2,
  Maximize2,
  MousePointerClick,
  Move,
  Pentagon,
  Redo2,
  RotateCw,
  Ruler,
  Scale,
  Search,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Moon,
  HelpCircle,
  Trash2,
  Undo2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
  Type,
} from '../utils/lucideIcons'
import {
  applyVietnameseFontConfiguration,
  cacheCustomFontFile,
  decodeVietnameseCadText,
  detectFontEncodingFromName,
  normalizeVietnameseDatabaseText,
  ESSENTIAL_CAD_FONTS,
  preloadEssentialCadFonts,
  autoDownloadMissingFont,
  autoResolveAllMissingFonts,
} from '../utils/vietnameseFontUtils'
import { optimizeTileGridOrigin, pip, tileCalc } from '../utils/dxfParser'
import type { TakeoffRow, TileConfig, TilePattern } from '../types/takeoff'
import { APP_VERSION, APP_BUILD_DATE, APP_AUTHOR, APP_COPYRIGHT, CHANGELOG_HISTORY } from '../version'

interface SampleFileItem {
  id: string
  label: string
  path: string
  format: 'DXF' | 'DWG'
  desc: string
}

const SAMPLE_FILES: SampleFileItem[] = [
  {
    id: 'floorplan-mm',
    label: '[DXF] Mặt bằng căn hộ (mm)',
    path: '/samples/floorplan-mm.dxf',
    format: 'DXF',
    desc: '$INSUNITS = 4 (mm) • 6 Layers • Các phòng chuẩn 14m²–28m²',
  },
  {
    id: 'site-plan-m',
    label: '[DXF] Mặt bằng quy hoạch lô đất (m)',
    path: '/samples/site-plan-m.dxf',
    format: 'DXF',
    desc: '$INSUNITS = 6 (m) • 4 Layers • Ranh giới & công trình',
  },
  {
    id: 'sheet-0',
    label: '[DXF] Bản vẽ kỹ thuật chi tiết (sheet_0.dxf)',
    path: '/samples/sheet_0.dxf',
    format: 'DXF',
    desc: '$INSUNITS = 4 (mm) • Bản vẽ CAD phức tạp nhiều chi tiết',
  },
  {
    id: 'find-layouts',
    label: '[DXF] Bản vẽ đa Layout (Model + Paper Space)',
    path: '/samples/find-layouts.dxf',
    format: 'DXF',
    desc: 'Hỗ trợ chuyển đổi Model Space & các Layout giấy in',
  },
  {
    id: 'block-color',
    label: '[DXF] Bản vẽ Block & Màu sắc (block-color.dxf)',
    path: '/samples/block-color.dxf',
    format: 'DXF',
    desc: 'Kiểm thử hiển thị INSERT Block lồng nhau & màu ByLayer/ByBlock',
  },
  {
    id: 'dwg-canteen',
    label: '[DWG] Mặt bằng nhà ăn (canteen.dwg)',
    path: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/data/canteen.dwg',
    format: 'DWG',
    desc: 'Bản vẽ AutoCAD DWG thực tế • Giải mã bằng LibreDWG WebAssembly',
  },
  {
    id: 'dwg-baseline',
    label: '[DWG] Bản vẽ tiêu chuẩn (baseline-sample.dwg)',
    path: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/data/baseline-sample.dwg',
    format: 'DWG',
    desc: 'Bản vẽ AutoCAD DWG đầy đủ thực thể kỹ thuật',
  },
  {
    id: 'dwg-lockers',
    label: '[DWG] Chi tiết tủ đồ (lockers.dwg)',
    path: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/data/lockers.dwg',
    format: 'DWG',
    desc: 'Bản vẽ AutoCAD DWG chi tiết nội thất',
  },
  {
    id: 'dwg-chairs',
    label: '[DWG] Mặt bằng ghế (patient-chairs.dwg)',
    path: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/data/patient-chairs.dwg',
    format: 'DWG',
    desc: 'Bản vẽ AutoCAD DWG nhiều Block tham chiếu',
  },
]

const DXF_ENCODING_OPTIONS = [
  { value: '', label: 'Tự động ($DWGCODEPAGE / UTF-8)' },
  { value: 'utf-8', label: 'UTF-8 (Unicode chuẩn)' },
  { value: 'windows-1258', label: 'Windows-1258 (Tiếng Việt ANSI)' },
  { value: 'windows-1252', label: 'Windows-1252 (Latin / Tây Âu)' },
  { value: 'gb18030', label: 'GB18030 / GBK (Tiếng Trung)' },
  { value: 'shift-jis', label: 'Shift-JIS (Tiếng Nhật)' },
  { value: 'euc-kr', label: 'EUC-KR / CP949 (Tiếng Hàn)' },
]

const POLYGON_COLORS = [
  '#0f766e', // Teal
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
]

const TILE_PRESETS = [
  // Khổ gạch vuông & chữ nhật phổ biến
  { label: '30×60 cm (300×600 mm - WC/Tường)', value: '300x600', isWood: false },
  { label: '40×80 cm (400×800 mm)', value: '400x800', isWood: false },
  { label: '45×90 cm (450×900 mm)', value: '450x900', isWood: false },
  { label: '60×60 cm (600×600 mm)', value: '600x600', isWood: false },
  { label: '60×120 cm (600×1200 mm - Tiêu chuẩn)', value: '600x1200', isWood: false },
  { label: '80×80 cm (800×800 mm)', value: '800x800', isWood: false },
  { label: '90×90 cm (900×900 mm)', value: '900x900', isWood: false },
  // Khổ lớn & Đại bản tấm Slab
  { label: '75×150 cm (750×1500 mm)', value: '750x1500', isWood: false },
  { label: '120×120 cm (1200×1200 mm - Đại bản)', value: '1200x1200', isWood: false },
  { label: '120×278 cm (1200×2780 mm - Tấm Slab)', value: '1200x2780', isWood: false },
  { label: '120×280 cm (1200×2800 mm - Tấm Slab)', value: '1200x2800', isWood: false },
  // Gạch thanh giả gỗ (Wood Planks)
  { label: '15×90 cm (150×900 mm - Gạch giả gỗ)', value: '150x900', isWood: true },
  { label: '20×90 cm (200×900 mm - Gạch giả gỗ)', value: '200x900', isWood: true },
  { label: '30×90 cm (300×900 mm - Gạch giả gỗ)', value: '300x900', isWood: true },
]

type ToolMode = 'pan' | 'poly' | 'area' | 'rect' | 'dist' | 'cal' | 'layoff' | 'info'

const MODE_HINTS: Record<ToolMode, string> = {
  pan: 'Kéo giữ chuột trái/phải/giữa để Pan bản vẽ, lăn chuột để Zoom.',
  poly: 'Click chọn các đỉnh liên tiếp (OSNAP). Click P1, Enter hoặc bấm "Đóng vùng" để tính diện tích Shoelace.',
  area: 'Di chuột và bấm trực tiếp vào đường bao kín (Polyline / Circle) trên bản vẽ để lấy diện tích.',
  rect: 'Bấm chọn 2 điểm góc đối diện trên bản vẽ để tạo vùng hình chữ nhật.',
  dist: 'Bấm các điểm liên tiếp để đo chiều dài đoạn/chuỗi, nhấn Enter hoặc nhấp đúp để lưu.',
  cal: 'Bấm chọn 2 điểm của đoạn thẳng đã biết kích thước thật trên bản vẽ để hiệu chỉnh tỉ lệ.',
  layoff: 'Chạm trực tiếp vào bất kỳ đối tượng nào trên bản vẽ để TẮT/BẬT lớp (Layer) của đối tượng đó.',
  info: 'Bấm vào bất kỳ đối tượng nào trên bản vẽ DWG/DXF để tra cứu chi tiết thuộc tính kỹ thuật (Layer, Loại, Kích thước, Block, Text...).',
}

interface ExtractedSnapTarget {
  point: Point2D
  type: 'endpoint' | 'midpoint' | 'center'
  layer: string
}

interface ExtractedClosedBoundary {
  id: string
  layer: string
  points: [number, number][]
  label?: string
}

interface ExtractedEntityShape {
  id: string
  layer: string
  entityType: string
  pts: Point2D[]
  closed: boolean
  bbox: [number, number, number, number]
  summary?: string
}

interface HoveredLayoffInfo {
  layer: string
  isHiddenLayer: boolean
  cursorScreen: Point2D
  entity?: ExtractedEntityShape
}

interface CadLayoutTab {
  name: string
  tabOrder: number
  btrId: string
  isActive: boolean
  isModel: boolean
  entityCount: number
}

interface CadDocumentStats {
  fileFormat: 'DWG' | 'DXF'
  acadVer: string
  totalEntities: number
  blockCount: number
  layoutCount: number
  typeBreakdown: { type: string; count: number }[]
}

interface InspectedEntityInfo {
  id: string
  type: string
  dxfType: string
  layer: string
  lineType: string
  lineWeight: string
  colorLabel: string
  textValue?: string
  blockName?: string
  lengthMeters?: number
  areaSquareMeters?: number
  bboxMeters?: string
  extraProps: { label: string; value: string }[]
}

interface OverlayDrawingInfo {
  id: string
  fileName: string
  visible: boolean
}

interface OpenDocTabInfo {
  sessionId: string
  title: string
  fileName: string
  format: 'DWG' | 'DXF'
  isActive: boolean
  doc: AcApDocument
}

let dwgConverterRegistered = false

function ensureDwgConverterRegistered() {
  if (dwgConverterRegistered) return
  try {
    const dwgParserUrl = `./workers/${LIBREDWG_PARSER_WORKER_FILE}`
    AcDbDatabaseConverterManager.instance.register(
      AcDbFileType.DWG,
      new AcDbLibreDwgConverter({
        convertByEntityType: false,
        useWorker: true,
        parserWorkerUrl: dwgParserUrl,
        timeout: 120000,
      })
    )
    dwgConverterRegistered = true
  } catch {
    // Ignore if already registered
  }
}

function countBtrEntities(db: AcDbDatabase, btrId: string): number {
  if (!btrId) return 0
  try {
    const btr = db.tables?.blockTable?.getIdAt(btrId)
    if (!btr?.newIterator) return 0
    let count = 0
    for (const _ent of btr.newIterator()) {
      count++
    }
    return count
  } catch {
    return 0
  }
}

/**
 * Liệt kê tất cả Sheet / Layouts (Model Space + Paper Space Layouts) trong AcDbDatabase
 */
function listDocumentLayouts(db: AcDbDatabase): CadLayoutTab[] {
  const result: CadLayoutTab[] = []
  const seen = new Set<string>()
  const currentSpace = String(db.currentSpaceId || '')
  const modelBtrId = String(db.tables?.blockTable?.modelSpace?.objectId || '')

  try {
    const layoutDict = db.objects?.layout
    if (layoutDict?.newIterator) {
      for (const layout of layoutDict.newIterator()) {
        const btrId = String(layout.blockTableRecordId || '')
        if (!btrId || seen.has(btrId)) continue
        seen.add(btrId)
        const name = layout.layoutName || 'Layout'
        const isModel = name.toLowerCase() === 'model' || btrId === modelBtrId
        result.push({
          name,
          tabOrder: isModel ? 0 : typeof layout.tabOrder === 'number' ? layout.tabOrder : result.length + 1,
          btrId,
          isActive: btrId === currentSpace,
          isModel,
          entityCount: countBtrEntities(db, btrId),
        })
      }
    }
  } catch {
    // Fallback below
  }

  // Bổ sung các BlockTableRecord *Paper_Space nếu chưa có trong từ điển layout
  try {
    const bt = db.tables?.blockTable
    if (bt?.newIterator) {
      for (const btr of bt.newIterator()) {
        const btrId = String(btr.objectId || '')
        const rawName = String(btr.name || '')
        if (!btrId || seen.has(btrId)) continue
        if (rawName.toLowerCase() === '*model_space') {
          seen.add(btrId)
          result.push({
            name: 'Model',
            tabOrder: 0,
            btrId,
            isActive: btrId === currentSpace,
            isModel: true,
            entityCount: countBtrEntities(db, btrId),
          })
        } else if (rawName.toLowerCase().startsWith('*paper_space')) {
          seen.add(btrId)
          const suffix = rawName.slice('*paper_space'.length)
          const idx = suffix ? Number(suffix) + 1 : 1
          result.push({
            name: `Layout${Number.isFinite(idx) ? idx : result.length}`,
            tabOrder: result.length + 1,
            btrId,
            isActive: btrId === currentSpace,
            isModel: false,
            entityCount: countBtrEntities(db, btrId),
          })
        }
      }
    }
  } catch {
    // Ignore
  }

  if (result.length === 0 && modelBtrId) {
    result.push({
      name: 'Model',
      tabOrder: 0,
      btrId: modelBtrId,
      isActive: true,
      isModel: true,
      entityCount: countBtrEntities(db, modelBtrId),
    })
  }

  result.sort((a, b) => {
    if (a.isModel !== b.isModel) return a.isModel ? -1 : 1
    return a.tabOrder - b.tabOrder
  })

  if (result.length > 0 && !result.some(l => l.isActive)) {
    result[0].isActive = true
  }

  return result
}

/**
 * Trích xuất chi tiết thuộc tính kỹ thuật của một thực thể AcDbEntity phục vụ công cụ Tra cứu (Entity Inspector)
 */
function extractEntityInspectorDetails(
  entity: AcDbEntity,
  toMeters: number,
  shapeFallback?: ExtractedEntityShape
): InspectedEntityInfo {
  const id = String(entity.objectId || shapeFallback?.id || '—')
  const type = String(entity.type || shapeFallback?.entityType || 'Entity')
  const dxfType = String(entity.dxfTypeName || type.toUpperCase())
  const layer = String(entity.layer || shapeFallback?.layer || '0')
  const lineType = String(entity.lineType || 'ByLayer')
  const lw = entity.lineWeight
  const lineWeight =
    lw !== undefined && lw !== null
      ? Number(lw) < 0
        ? 'ByLayer / Default'
        : `${(Number(lw) / 100).toFixed(2)} mm`
      : 'ByLayer'

  let colorLabel = 'ByLayer'
  try {
    const c = entity.color
    if (c) {
      if (c.isByLayer) colorLabel = 'ByLayer'
      else if (c.isByBlock) colorLabel = 'ByBlock'
      else if (typeof c.cssColor === 'string') colorLabel = c.cssColor
      else if (typeof c.colorIndex === 'number') colorLabel = `ACI ${c.colorIndex}`
    }
  } catch {
    // ignore
  }

  let textValue: string | undefined
  let blockName: string | undefined
  let lengthMeters: number | undefined
  let areaSquareMeters: number | undefined
  let bboxMeters: string | undefined
  const extraProps: { label: string; value: string }[] = []

  if (entity instanceof AcDbText) {
    textValue = (entity.textString || '').trim()
    if (entity.height) {
      extraProps.push({ label: 'Chiều cao chữ', value: `${(entity.height * toMeters).toFixed(3)} m` })
    }
  } else if (entity instanceof AcDbMText) {
    textValue = acapMTextToPlainText(entity.contents || '').trim()
    if (entity.height) {
      extraProps.push({ label: 'Chiều cao chữ', value: `${(entity.height * toMeters).toFixed(3)} m` })
    }
  } else if (entity instanceof AcDbBlockReference) {
    blockName = entity.blockName || entity.blockTableRecord?.name
    const pos = entity.position
    if (pos) {
      extraProps.push({
        label: 'Điểm chèn (WCS)',
        value: `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`,
      })
    }
    const sc = entity.scaleFactors
    if (sc) {
      extraProps.push({
        label: 'Tỉ lệ Scale',
        value: `${sc.x.toFixed(2)} × ${sc.y.toFixed(2)}`,
      })
    }
    if (typeof entity.rotation === 'number') {
      extraProps.push({
        label: 'Góc xoay',
        value: `${((entity.rotation * 180) / Math.PI).toFixed(1)}°`,
      })
    }
  } else if (entity instanceof AcDbLine) {
    const s = entity.startPoint
    const e = entity.endPoint
    const dRaw = Math.hypot(e.x - s.x, e.y - s.y)
    lengthMeters = dRaw * toMeters
    extraProps.push({
      label: 'Điểm đầu → cuối',
      value: `(${s.x.toFixed(1)}, ${s.y.toFixed(1)}) → (${e.x.toFixed(1)}, ${e.y.toFixed(1)})`,
    })
  } else if (entity instanceof AcDbCircle) {
    const r = (entity.radius || 0) * toMeters
    lengthMeters = 2 * Math.PI * r
    areaSquareMeters = Math.PI * r * r
    extraProps.push({ label: 'Bán kính (R)', value: `${r.toFixed(3)} m` })
    extraProps.push({ label: 'Đường kính (Ø)', value: `${(r * 2).toFixed(3)} m` })
  } else if (entity instanceof AcDbArc) {
    const r = (entity.radius || 0) * toMeters
    let sa = entity.startAngle || 0
    let ea = entity.endAngle || 0
    if (ea < sa) ea += Math.PI * 2
    lengthMeters = r * Math.abs(ea - sa)
    extraProps.push({ label: 'Bán kính (R)', value: `${r.toFixed(3)} m` })
  } else if (entity instanceof AcDbPolyline) {
    const n = entity.numberOfVertices
    const pts: Point2D[] = []
    for (let i = 0; i < n; i++) {
      const p = entity.getPoint2dAt(i)
      pts.push({ x: p.x, y: p.y })
    }
    const isClosed =
      entity.closed ||
      (pts.length >= 3 &&
        Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-2)
    const segs = calculatePolygonSegments(pts, toMeters, isClosed)
    lengthMeters = segs.reduce((sum, s) => sum + s.lengthMeters, 0)
    if (isClosed && pts.length >= 3) {
      areaSquareMeters = convertAreaToSquareMeters(calculateShoelaceArea(pts), toMeters)
    }
    extraProps.push({ label: 'Số đỉnh', value: `${n} (${isClosed ? 'Đóng kín' : 'Hở'})` })
  } else if (entity instanceof AcDbHatch) {
    extraProps.push({ label: 'Mẫu Hatch', value: entity.patternName || 'SOLID' })
    try {
      if (entity.area > 0) {
        areaSquareMeters = convertAreaToSquareMeters(entity.area, toMeters)
      }
    } catch {
      // ignore
    }
  }

  try {
    const ext = entity.geometricExtents
    if (
      ext &&
      Number.isFinite(ext.min.x) &&
      Number.isFinite(ext.min.y) &&
      Number.isFinite(ext.max.x) &&
      Number.isFinite(ext.max.y)
    ) {
      const w = Math.abs(ext.max.x - ext.min.x) * toMeters
      const h = Math.abs(ext.max.y - ext.min.y) * toMeters
      bboxMeters = `${w.toFixed(2)} × ${h.toFixed(2)} m`
    }
  } catch {
    // ignore
  }

  // Bổ sung thuộc tính runtime từ entity.properties nếu có
  try {
    const propGroups = entity.properties?.groups
    if (Array.isArray(propGroups)) {
      for (const grp of propGroups) {
        for (const p of grp.properties || []) {
          if (extraProps.length >= 8) break
          const val = p.accessor?.get?.()
          if (
            val !== undefined &&
            val !== null &&
            (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean')
          ) {
            const pAny = p as unknown as { label?: string; name?: string }
            const labelStr = String(pAny.label || pAny.name || '')
            if (
              labelStr &&
              !['layer', 'color', 'linetype', 'lineweight', 'handle', 'type'].includes(
                labelStr.toLowerCase()
              )
            ) {
              extraProps.push({ label: labelStr, value: String(val) })
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return {
    id,
    type,
    dxfType,
    layer,
    lineType,
    lineWeight,
    colorLabel,
    textValue,
    blockName,
    lengthMeters,
    areaSquareMeters,
    bboxMeters,
    extraProps,
  }
}

/**
 * Trích xuất danh sách các điểm Vertex / Endpoint / Midpoint / Center,
 * các đường bao kín (Closed Polylines / Circles), hình học các đối tượng (kể cả trong INSERT Block,
 * Ellipse, Spline, Hatch) và thống kê thực thể từ không gian Layout hiện hành của AcDbDatabase.
 */
function extractDatabaseGeometry(
  db: AcDbDatabase,
  fileName = '',
  targetSpaceBtrId?: string
): {
  snapTargets: ExtractedSnapTarget[]
  closedBoundaries: ExtractedClosedBoundary[]
  entities: ExtractedEntityShape[]
  entityLayerById: Map<string, string>
  entityMapById: Map<string, AcDbEntity>
  extents: [number, number, number, number] | null
  stats: CadDocumentStats
} {
  const snapTargets: ExtractedSnapTarget[] = []
  const closedBoundaries: ExtractedClosedBoundary[] = []
  const entities: ExtractedEntityShape[] = []
  const entityLayerById = new Map<string, string>()
  const entityMapById = new Map<string, AcDbEntity>()
  const textLabels: { x: number; y: number; text: string }[] = []
  const typeCounter = new Map<string, number>()

  let globalMinX = Infinity
  let globalMinY = Infinity
  let globalMaxX = -Infinity
  let globalMaxY = -Infinity
  let totalEntities = 0
  let blockCount = 0

  const computeBbox = (pts: Point2D[]): [number, number, number, number] => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of pts) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
      if (p.x < globalMinX) globalMinX = p.x
      if (p.y < globalMinY) globalMinY = p.y
      if (p.x > globalMaxX) globalMaxX = p.x
      if (p.y > globalMaxY) globalMaxY = p.y
    }
    return [minX, minY, maxX, maxY]
  }

  try {
    if (db.tables?.blockTable?.newIterator) {
      for (const _btr of db.tables.blockTable.newIterator()) {
        blockCount++
      }
    }
  } catch {
    // ignore
  }

  try {
    const spaceId = targetSpaceBtrId || String(db.currentSpaceId || '')
    const activeSpace =
      (spaceId && db.tables?.blockTable?.getIdAt?.(spaceId)) ||
      db.tables?.blockTable?.modelSpace

    if (activeSpace) {
      let count = 0
      const MAX_TARGETS = 35000

      const processEntity = (
        entity: AcDbEntity,
        transformPt: (p: Point2D) => Point2D,
        inheritedLayer?: string,
        topObjectId?: string,
        depth = 0
      ) => {
        const rawLayer = entity.layer || '0'
        const layer = rawLayer === '0' && inheritedLayer ? inheritedLayer : rawLayer
        const objId = topObjectId || String(entity.objectId ?? '')
        const dxfType = String(entity.dxfTypeName || entity.type || 'ENTITY').toUpperCase()

        if (depth === 0) {
          totalEntities++
          typeCounter.set(dxfType, (typeCounter.get(dxfType) || 0) + 1)
          if (objId) {
            entityLayerById.set(objId, layer)
            entityMapById.set(objId, entity)
          }
        }

        if (entity instanceof AcDbText) {
          const pos = entity.position
          const raw = (entity.textString || '').trim()
          const fontHint = detectFontEncodingFromName(
            (entity as unknown as { textStyle?: { name?: string } }).textStyle?.name || ''
          )
          const txt = decodeVietnameseCadText(raw, fontHint)
          if (txt && pos) {
            const tp = transformPt({ x: pos.x, y: pos.y })
            textLabels.push({ x: tp.x, y: tp.y, text: txt })
          }
        } else if (entity instanceof AcDbMText) {
          const pos = entity.location
          const raw = acapMTextToPlainText(entity.contents || '').trim()
          const fontHint = detectFontEncodingFromName(
            (entity as unknown as { textStyle?: { name?: string } }).textStyle?.name || ''
          )
          const txt = decodeVietnameseCadText(raw, fontHint)
          if (txt && pos) {
            const tp = transformPt({ x: pos.x, y: pos.y })
            textLabels.push({ x: tp.x, y: tp.y, text: txt })
          }
        }

        if (entity instanceof AcDbLine) {
          const s = transformPt({ x: entity.startPoint.x, y: entity.startPoint.y })
          const e = transformPt({ x: entity.endPoint.x, y: entity.endPoint.y })
          const linePts = [s, e]
          entities.push({
            id: objId || `ent-${entities.length}`,
            layer,
            entityType: 'LINE',
            pts: linePts,
            closed: false,
            bbox: computeBbox(linePts),
          })
          if (count < MAX_TARGETS) {
            snapTargets.push({ point: s, type: 'endpoint', layer })
            snapTargets.push({ point: e, type: 'endpoint', layer })
            snapTargets.push({
              point: { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 },
              type: 'midpoint',
              layer,
            })
            count += 3
          }
        } else if (entity instanceof AcDbPolyline) {
          const numVerts = entity.numberOfVertices
          const pts: Point2D[] = []
          for (let i = 0; i < numVerts; i++) {
            const pt = entity.getPoint2dAt(i)
            const tp = transformPt({ x: pt.x, y: pt.y })
            pts.push(tp)
            if (count < MAX_TARGETS) {
              snapTargets.push({ point: tp, type: 'endpoint', layer })
              count++
            }
          }
          const isClosed =
            entity.closed ||
            (pts.length >= 3 &&
              Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-2)

          if (pts.length >= 2) {
            entities.push({
              id: objId || `ent-${entities.length}`,
              layer,
              entityType: 'LWPOLYLINE',
              pts,
              closed: isClosed,
              bbox: computeBbox(pts),
            })
          }

          const segCount = isClosed ? pts.length : pts.length - 1
          for (let i = 0; i < segCount; i++) {
            const a = pts[i]
            const b = pts[(i + 1) % pts.length]
            if (a && b && count < MAX_TARGETS) {
              snapTargets.push({
                point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                type: 'midpoint',
                layer,
              })
              count++
            }
          }

          if (isClosed && pts.length >= 3) {
            const tuplePts: [number, number][] = pts.map(p => [p.x, p.y])
            if (
              tuplePts.length > 3 &&
              Math.hypot(
                tuplePts[0][0] - tuplePts[tuplePts.length - 1][0],
                tuplePts[0][1] - tuplePts[tuplePts.length - 1][1]
              ) < 1e-2
            ) {
              tuplePts.pop()
            }
            if (tuplePts.length >= 3) {
              closedBoundaries.push({
                id: `bound-${closedBoundaries.length + 1}`,
                layer,
                points: tuplePts,
              })
            }
          }
        } else if (entity instanceof AcDb2dPolyline || entity instanceof AcDb3dPolyline) {
          const numVerts = entity.numberOfVertices
          const pts: Point2D[] = []
          for (let i = 0; i < numVerts; i++) {
            const pt = entity.getPointAt(i)
            const tp = transformPt({ x: pt.x, y: pt.y })
            pts.push(tp)
            if (count < MAX_TARGETS) {
              snapTargets.push({ point: tp, type: 'endpoint', layer })
              count++
            }
          }
          const isClosed = Boolean(entity.closed)
          if (pts.length >= 2) {
            entities.push({
              id: objId || `ent-${entities.length}`,
              layer,
              entityType: 'POLYLINE',
              pts,
              closed: isClosed,
              bbox: computeBbox(pts),
            })
          }
          if (isClosed && pts.length >= 3) {
            closedBoundaries.push({
              id: `bound-${closedBoundaries.length + 1}`,
              layer,
              points: pts.map(p => [p.x, p.y]),
            })
          }
        } else if (entity instanceof AcDbCircle) {
          const c = transformPt({ x: entity.center.x, y: entity.center.y })
          const pEdge = transformPt({
            x: entity.center.x + (entity.radius || 0),
            y: entity.center.y,
          })
          const r = Math.hypot(pEdge.x - c.x, pEdge.y - c.y)
          if (count < MAX_TARGETS) {
            snapTargets.push({ point: c, type: 'center', layer })
            count++
          }
          if (r > 0) {
            const circlePts: Point2D[] = []
            const steps = 32
            for (let i = 0; i < steps; i++) {
              const ang = (i / steps) * Math.PI * 2
              const qp = { x: c.x + Math.cos(ang) * r, y: c.y + Math.sin(ang) * r }
              circlePts.push(qp)
              if (i % 8 === 0 && count < MAX_TARGETS) {
                snapTargets.push({ point: qp, type: 'endpoint', layer })
                count++
              }
            }
            entities.push({
              id: objId || `ent-${entities.length}`,
              layer,
              entityType: 'CIRCLE',
              pts: circlePts,
              closed: true,
              bbox: computeBbox(circlePts),
            })
            closedBoundaries.push({
              id: `bound-${closedBoundaries.length + 1}`,
              layer,
              points: circlePts.map(p => [p.x, p.y]),
            })
          }
        } else if (entity instanceof AcDbArc) {
          const c = transformPt({ x: entity.center.x, y: entity.center.y })
          const rRaw = entity.radius || 0
          if (count < MAX_TARGETS) {
            snapTargets.push({ point: c, type: 'center', layer })
            count++
          }
          if (rRaw > 0) {
            let sa = entity.startAngle || 0
            let ea = entity.endAngle || Math.PI * 2
            if (ea < sa) ea += Math.PI * 2
            const arcPts: Point2D[] = []
            const steps = 16
            for (let i = 0; i <= steps; i++) {
              const ang = sa + ((ea - sa) * i) / steps
              const pt = transformPt({
                x: entity.center.x + Math.cos(ang) * rRaw,
                y: entity.center.y + Math.sin(ang) * rRaw,
              })
              arcPts.push(pt)
            }
            if (arcPts.length >= 2 && count < MAX_TARGETS) {
              snapTargets.push({ point: arcPts[0], type: 'endpoint', layer })
              snapTargets.push({ point: arcPts[arcPts.length - 1], type: 'endpoint', layer })
              snapTargets.push({
                point: arcPts[Math.floor(arcPts.length / 2)],
                type: 'midpoint',
                layer,
              })
              count += 3
            }
            entities.push({
              id: objId || `ent-${entities.length}`,
              layer,
              entityType: 'ARC',
              pts: arcPts,
              closed: false,
              bbox: computeBbox(arcPts),
            })
          }
        } else if (entity instanceof AcDbEllipse) {
          const c = transformPt({ x: entity.center.x, y: entity.center.y })
          if (count < MAX_TARGETS) {
            snapTargets.push({ point: c, type: 'center', layer })
            count++
          }
          const majR = entity.majorAxisRadius || 0
          const minR = entity.minorAxisRadius || 0
          const majAxis = entity.majorAxis || { x: 1, y: 0 }
          const baseAng = Math.atan2(majAxis.y || 0, majAxis.x || 1)
          if (majR > 0 && minR > 0) {
            let sa = entity.startAngle || 0
            let ea = entity.endAngle || Math.PI * 2
            if (Math.abs(ea - sa) < 1e-6) {
              sa = 0
              ea = Math.PI * 2
            } else if (ea < sa) {
              ea += Math.PI * 2
            }
            const ellPts: Point2D[] = []
            const steps = 24
            const cosB = Math.cos(baseAng)
            const sinB = Math.sin(baseAng)
            for (let i = 0; i <= steps; i++) {
              const t = sa + ((ea - sa) * i) / steps
              const lx = majR * Math.cos(t)
              const ly = minR * Math.sin(t)
              const wx = entity.center.x + (lx * cosB - ly * sinB)
              const wy = entity.center.y + (lx * sinB + ly * cosB)
              ellPts.push(transformPt({ x: wx, y: wy }))
            }
            entities.push({
              id: objId || `ent-${entities.length}`,
              layer,
              entityType: 'ELLIPSE',
              pts: ellPts,
              closed: Boolean(entity.closed),
              bbox: computeBbox(ellPts),
            })
          }
        } else if (entity instanceof AcDbSpline) {
          try {
            const grips = entity.subGetGripPoints?.() || []
            if (grips.length >= 2) {
              const spPts = grips.map(g => transformPt({ x: g.x, y: g.y }))
              for (const gp of spPts) {
                if (count < MAX_TARGETS) {
                  snapTargets.push({ point: gp, type: 'endpoint', layer })
                  count++
                }
              }
              entities.push({
                id: objId || `ent-${entities.length}`,
                layer,
                entityType: 'SPLINE',
                pts: spPts,
                closed: Boolean(entity.closed),
                bbox: computeBbox(spPts),
              })
            }
          } catch {
            // fallback below
          }
        } else if (entity instanceof AcDbBlockReference && depth < 3) {
          const insPos = entity.position || { x: 0, y: 0 }
          const sc = entity.scaleFactors || { x: 1, y: 1 }
          const rot = entity.rotation || 0
          const cosR = Math.cos(rot)
          const sinR = Math.sin(rot)
          const sx = Number.isFinite(sc.x) && sc.x !== 0 ? sc.x : 1
          const sy = Number.isFinite(sc.y) && sc.y !== 0 ? sc.y : 1

          const insertPt = transformPt({ x: insPos.x, y: insPos.y })
          if (count < MAX_TARGETS) {
            snapTargets.push({ point: insertPt, type: 'endpoint', layer })
            count++
          }

          const composeTransform = (localPt: Point2D): Point2D => {
            const x1 = localPt.x * sx
            const y1 = localPt.y * sy
            const wx = insPos.x + (x1 * cosR - y1 * sinR)
            const wy = insPos.y + (x1 * sinR + y1 * cosR)
            return transformPt({ x: wx, y: wy })
          }

          const btr = entity.drawableBlockTableRecord ?? entity.blockTableRecord
          let childExtracted = false
          if (btr?.newIterator) {
            for (const subEnt of btr.newIterator()) {
              childExtracted = true
              processEntity(subEnt, composeTransform, layer, objId, depth + 1)
            }
          }

          if (!childExtracted) {
            try {
              const ext = entity.geometricExtents
              if (ext && Number.isFinite(ext.min.x) && Number.isFinite(ext.max.x)) {
                const boxPts = [
                  transformPt({ x: ext.min.x, y: ext.min.y }),
                  transformPt({ x: ext.max.x, y: ext.min.y }),
                  transformPt({ x: ext.max.x, y: ext.max.y }),
                  transformPt({ x: ext.min.x, y: ext.max.y }),
                ]
                entities.push({
                  id: objId || `ent-${entities.length}`,
                  layer,
                  entityType: 'INSERT',
                  pts: boxPts,
                  closed: true,
                  bbox: computeBbox(boxPts),
                })
              }
            } catch {
              // ignore
            }
          }
        } else {
          // Đối với HATCH, DIMENSION, TABLE, LEADER, SOLID...
          try {
            const grips = entity.subGetGripPoints?.() || []
            for (const g of grips) {
              if (count < MAX_TARGETS && Number.isFinite(g.x) && Number.isFinite(g.y)) {
                snapTargets.push({
                  point: transformPt({ x: g.x, y: g.y }),
                  type: 'endpoint',
                  layer,
                })
                count++
              }
            }
            const ext = entity.geometricExtents
            if (
              ext &&
              Number.isFinite(ext.min.x) &&
              Number.isFinite(ext.min.y) &&
              Number.isFinite(ext.max.x) &&
              Number.isFinite(ext.max.y)
            ) {
              const boxPts: Point2D[] = [
                transformPt({ x: ext.min.x, y: ext.min.y }),
                transformPt({ x: ext.max.x, y: ext.min.y }),
                transformPt({ x: ext.max.x, y: ext.max.y }),
                transformPt({ x: ext.min.x, y: ext.max.y }),
              ]
              entities.push({
                id: objId || `ent-${entities.length}`,
                layer,
                entityType: dxfType,
                pts: boxPts,
                closed: true,
                bbox: computeBbox(boxPts),
              })
            }
          } catch {
            // Ignore if entity does not implement geometricExtents
          }
        }
      }

      const identityTransform = (p: Point2D) => p
      for (const entity of activeSpace.newIterator()) {
        processEntity(entity, identityTransform, undefined, undefined, 0)
      }

      // Gán nhãn phòng tự động cho các đường bao kín nếu có TEXT nằm trong vùng
      for (const b of closedBoundaries) {
        for (const lbl of textLabels) {
          if (pip([lbl.x, lbl.y], b.points)) {
            b.label = lbl.text
            break
          }
        }
      }
    }
  } catch {
    // Fallback to view.osnapResolver if iterator fails
  }

  const extents: [number, number, number, number] | null =
    Number.isFinite(globalMinX) && Number.isFinite(globalMaxX)
      ? [globalMinX, globalMinY, globalMaxX, globalMaxY]
      : null

  const isDwg = fileName.toLowerCase().endsWith('.dwg')
  const rawAcadVer = String(
    (db as unknown as { acadver?: string; dwgVersion?: string }).acadver ||
      (db as unknown as { dwgVersion?: string }).dwgVersion ||
      ''
  )
  const layouts = listDocumentLayouts(db)
  const typeBreakdown = Array.from(typeCounter.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  return {
    snapTargets,
    closedBoundaries,
    entities,
    entityLayerById,
    entityMapById,
    extents,
    stats: {
      fileFormat: isDwg ? 'DWG' : 'DXF',
      acadVer: rawAcadVer || (isDwg ? 'AutoCAD DWG' : 'AutoCAD DXF'),
      totalEntities,
      blockCount,
      layoutCount: layouts.length,
      typeBreakdown,
    },
  }
}

function distToSegmentSquared(p: Point2D, v: Point2D, w: Point2D): number {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const projX = v.x + t * (w.x - v.x)
  const projY = v.y + t * (w.y - v.y)
  return (p.x - projX) ** 2 + (p.y - projY) ** 2
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '')
  const num = parseInt(cleaned, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function fmtNum(n: number, d = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('vi-VN', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export const CadViewer: React.FC = () => {
  const viewerContainerRef = useRef<HTMLDivElement | null>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const docManagerRef = useRef<AcApDocManager | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const overlayInputRef = useRef<HTMLInputElement | null>(null)
  const snapTargetsRef = useRef<ExtractedSnapTarget[]>([])
  const closedBoundariesRef = useRef<ExtractedClosedBoundary[]>([])
  const extractedEntitiesRef = useRef<ExtractedEntityShape[]>([])
  const entityLayerByIdRef = useRef<Map<string, string>>(new Map())
  const entityMapByIdRef = useRef<Map<string, AcDbEntity>>(new Map())
  const lastLoadedBufferRef = useRef<{ fileName: string; buffer: ArrayBuffer } | null>(null)

  // Giao diện Sáng / Tối (theo thiết kế file upload)
  const [dark, setDark] = useState<boolean>(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // State quản lý file & trạng thái tải
  const [currentFileName, setCurrentFileName] = useState<string>('floorplan-mm.dxf')
  const [selectedSampleId, setSelectedSampleId] = useState<string>('floorplan-mm')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>('Đang khởi tạo trình xem CAD 2D...')
  const [openProgress, setOpenProgress] = useState<{ pct: number; stage: string } | null>(null)
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  // State quản lý Sheet / Layouts, Multi-Document Tabs, Overlay (XREF) & Thống kê DWG/DXF
  const [layouts, setLayouts] = useState<CadLayoutTab[]>([])
  const [docStats, setDocStats] = useState<CadDocumentStats | null>(null)
  const [openDocs, setOpenDocs] = useState<OpenDocTabInfo[]>([])
  const [overlays, setOverlays] = useState<OverlayDrawingInfo[]>([])

  // State quản lý tính năng hiển thị nâng cao & xuất DWG/DXF
  const [lineWeightDisplay, setLineWeightDisplay] = useState<boolean>(false)
  const [readingMode, setReadingMode] = useState<boolean>(false)
  const [drawNoPlotLayers, setDrawNoPlotLayers] = useState<boolean>(true)
  const [dxfEncoding, setDxfEncoding] = useState<string>('')
  const [showDisplayMenu, setShowDisplayMenu] = useState<boolean>(false)
  const displayMenuRef = useRef<HTMLDivElement | null>(null)

  // State Tìm kiếm chữ (Find Text trong DWG/DXF) & Mở URL
  const [showFindPanel, setShowFindPanel] = useState<boolean>(false)
  const [findQuery, setFindQuery] = useState<string>('')
  const [findCaseSensitive, setFindCaseSensitive] = useState<boolean>(false)
  const [findHits, setFindHits] = useState<AcApFindLayoutHit[]>([])
  const [activeFindIdx, setActiveFindIdx] = useState<number>(-1)
  const [highlightedFindBox, setHighlightedFindBox] = useState<{
    min: Point2D
    max: Point2D
  } | null>(null)
  const [showUrlModal, setShowUrlModal] = useState<boolean>(false)
  const [remoteUrlInput, setRemoteUrlInput] = useState<string>('')

  // State quản lý Font tiếng Việt & Font CAD (.SHX / .TTF / .WOFF)
  const fontInputRef = useRef<HTMLInputElement | null>(null)
  const [showFontModal, setShowFontModal] = useState<boolean>(false)
  const [cachedFontList, setCachedFontList] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mlightcad.cached_fonts') || '[]')
    } catch {
      return []
    }
  })
  const [isFontLoading, setIsFontLoading] = useState<boolean>(false)
  const [fontToast, setFontToast] = useState<string | null>(null)

  // State Tra cứu thuộc tính thực thể DWG/DXF (Entity Inspector)
  const [hoveredEntity, setHoveredEntity] = useState<ExtractedEntityShape | null>(null)
  const [inspectedEntity, setInspectedEntity] = useState<InspectedEntityInfo | null>(null)

  // State quản lý Layers từ @mlightcad/cad-simple-viewer
  const [layers, setLayers] = useState<AcApLayerInfo[]>([])
  const [layerSearch, setLayerSearch] = useState<string>('')
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false)
  const layerMenuRef = useRef<HTMLDivElement | null>(null)

  // State quản lý đơn vị ($INSUNITS)
  const [detectedInsunits, setDetectedInsunits] = useState<number | null>(4)
  const [selectedInsunits, setSelectedInsunits] = useState<number>(4)
  const [customToMeters, setCustomToMeters] = useState<string>('0.001')
  const [useCustomFactor, setUseCustomFactor] = useState<boolean>(false)

  // State công cụ đo đạc & điều hướng (Mặc định khi mở là chế độ Di chuyển - Pan)
  const [mode, setMode] = useState<ToolMode>('pan')
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true)
  const [ortho, setOrtho] = useState<boolean>(false)
  const [activePoints, setActivePoints] = useState<Point2D[]>([])
  const [currentSnap, setCurrentSnap] = useState<SnapInfo | null>(null)
  const [hoveredBoundary, setHoveredBoundary] = useState<ExtractedClosedBoundary | null>(null)
  const [hoveredLayoff, setHoveredLayoff] = useState<HoveredLayoffInfo | null>(null)
  const [showGhostHidden, setShowGhostHidden] = useState<boolean>(false)
  const [recentHiddenLayers, setRecentHiddenLayers] = useState<string[]>([])
  const [lastLayerToast, setLastLayerToast] = useState<{
    layer: string
    hidden: boolean
  } | null>(null)

  const showLayerToast = useCallback((layer: string, hidden: boolean) => {
    setLastLayerToast({ layer, hidden })
    setTimeout(() => {
      setLastLayerToast(prev => (prev?.layer === layer ? null : prev))
    }, 2500)
  }, [])
  const [cursorWcs, setCursorWcs] = useState<Point2D>({ x: 0, y: 0 })
  const [measuredPolygons, setMeasuredPolygons] = useState<MeasuredPolygon[]>([])
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null)
  const [hoveredPolygonId, setHoveredPolygonId] = useState<string | null>(null)
  const [drawingExtents, setDrawingExtents] = useState<[number, number, number, number] | null>(null)
  const drawingExtentsRef = useRef<[number, number, number, number] | null>(null)

  // Trạng thái giữ chuột phải để di chuyển bản vẽ (Pan) tức thì
  const [isRightPanning, setIsRightPanning] = useState<boolean>(false)
  const isRightPanningRef = useRef<boolean>(false)
  const lastRightPanEndTimeRef = useRef<number>(0)
  const isTouchInteractingRef = useRef<boolean>(false)

  // State lịch sử Hoàn tác / Làm lại (Undo / Redo)
  const [history, setHistory] = useState<MeasuredPolygon[][]>([])
  const [redoStack, setRedoStack] = useState<MeasuredPolygon[][]>([])

  // State Chỉnh tỉ lệ theo kích thước thực (Calibrate)
  const [calLine, setCalLine] = useState<Point2D[] | null>(null)
  const [calValue, setCalValue] = useState<string>('')
  const [calUnit, setCalUnit] = useState<number>(0.001)

  // State cấu hình Lưới gạch (Tile Grid) từ giao diện mới
  const [tileConfig, setTileConfig] = useState<TileConfig>({
    on: false,
    w: 600,
    h: 1200,
    g: 2,
    waste: 5,
    box: 2,
    offsetX: 0,
    offsetY: 0,
    groutColor: '#94a3b8',
    pattern: 'grid',
  })
  const [tilePreset, setTilePreset] = useState<string>('600x1200')
  const [tileExpanded, setTileExpanded] = useState<boolean>(false)
  const [optimizeStatus, setOptimizeStatus] = useState<string>('')

  // State Sidebar phải & Bộ lọc bảng kết quả
  const [sidebarWidth, setSidebarWidth] = useState<number>(460)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024
    }
    return false
  })
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [listFilter, setListFilter] = useState<'all' | 'floor' | 'dist'>('all')
  // Danh sách vùng đang mở chi tiết các đoạn (mặc định ẩn)
  const [expandedPolyIds, setExpandedPolyIds] = useState<Set<string>>(() => new Set())
  const [copyStatus, setCopyStatus] = useState<string>('Sao chép Excel')
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false)
  const [showChangelogModal, setShowChangelogModal] = useState<boolean>(false)

  // Refs đồng bộ cho các callback sự kiện chuột và Canvas Overlay
  const modeRef = useRef(mode)
  modeRef.current = mode
  const snapEnabledRef = useRef(snapEnabled)
  snapEnabledRef.current = snapEnabled
  const orthoRef = useRef(ortho)
  orthoRef.current = ortho
  const activePointsRef = useRef(activePoints)
  activePointsRef.current = activePoints
  const currentSnapRef = useRef(currentSnap)
  currentSnapRef.current = currentSnap
  const hoveredBoundaryRef = useRef(hoveredBoundary)
  hoveredBoundaryRef.current = hoveredBoundary
  const hoveredLayoffRef = useRef(hoveredLayoff)
  hoveredLayoffRef.current = hoveredLayoff
  const hoveredEntityRef = useRef(hoveredEntity)
  hoveredEntityRef.current = hoveredEntity
  const highlightedFindBoxRef = useRef(highlightedFindBox)
  highlightedFindBoxRef.current = highlightedFindBox
  const showGhostHiddenRef = useRef(showGhostHidden)
  showGhostHiddenRef.current = showGhostHidden
  const measuredPolygonsRef = useRef(measuredPolygons)
  measuredPolygonsRef.current = measuredPolygons
  const historyRef = useRef(history)
  historyRef.current = history
  const redoStackRef = useRef(redoStack)
  redoStackRef.current = redoStack
  const calLineRef = useRef(calLine)
  calLineRef.current = calLine
  const selectedPolygonIdRef = useRef(selectedPolygonId)
  selectedPolygonIdRef.current = selectedPolygonId
  const hoveredPolygonIdRef = useRef(hoveredPolygonId)
  hoveredPolygonIdRef.current = hoveredPolygonId
  const layersRef = useRef(layers)
  layersRef.current = layers
  const tileConfigRef = useRef(tileConfig)
  tileConfigRef.current = tileConfig
  const darkRef = useRef(dark)
  darkRef.current = dark
  const drawNoPlotLayersRef = useRef(drawNoPlotLayers)
  drawNoPlotLayersRef.current = drawNoPlotLayers
  const dxfEncodingRef = useRef(dxfEncoding)
  dxfEncodingRef.current = dxfEncoding
  const lineWeightDisplayRef = useRef(lineWeightDisplay)
  lineWeightDisplayRef.current = lineWeightDisplay
  const layoutsRef = useRef(layouts)
  layoutsRef.current = layouts
  const currentFileNameRef = useRef(currentFileName)
  currentFileNameRef.current = currentFileName
  const loadEpochRef = useRef<number>(0)

  // Đóng menu Layer hoặc menu Hiển thị CAD khi click ra ngoài
  useEffect(() => {
    if (!showLayerMenu && !showDisplayMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (showLayerMenu && layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) {
        setShowLayerMenu(false)
      }
      if (showDisplayMenu && displayMenuRef.current && !displayMenuRef.current.contains(e.target as Node)) {
        setShowDisplayMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showLayerMenu, showDisplayMenu])

  // Hệ số quy đổi 1 đơn vị bản vẽ sang mét (m)
  const effectiveToMeters = useMemo(() => {
    if (useCustomFactor) {
      const parsed = parseFloat(customToMeters)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.001
    }
    return getInsunitsOption(selectedInsunits).toMeters
  }, [selectedInsunits, useCustomFactor, customToMeters])

  const effectiveToMetersRef = useRef(effectiveToMeters)
  effectiveToMetersRef.current = effectiveToMeters
  const selectedInsunitsRef = useRef(selectedInsunits)
  selectedInsunitsRef.current = selectedInsunits

  const currentUnitSymbol = useMemo(() => {
    if (useCustomFactor) return 'unit'
    return getInsunitsOption(selectedInsunits).symbol
  }, [selectedInsunits, useCustomFactor])

  // Cập nhật lại diện tích m² và chiều dài đoạn khi người dùng thay đổi đơn vị ($INSUNITS)
  useEffect(() => {
    setMeasuredPolygons(prev =>
      prev.map(poly => {
        const isClosed = poly.kind !== 'dist'
        const areaRaw = isClosed ? calculateShoelaceArea(poly.points) : 0
        const areaSquareMeters = isClosed ? convertAreaToSquareMeters(areaRaw, effectiveToMeters) : 0
        const segments = calculatePolygonSegments(poly.points, effectiveToMeters, isClosed)
        const perimeterRaw = segments.reduce((s, seg) => s + seg.lengthRaw, 0)
        const perimeterMeters = segments.reduce((s, seg) => s + seg.lengthMeters, 0)
        return {
          ...poly,
          areaRaw,
          areaSquareMeters,
          perimeterRaw,
          perimeterMeters,
          segments,
          insunits: selectedInsunits,
        }
      })
    )
  }, [effectiveToMeters, selectedInsunits])

  /**
   * Chuyển đổi một MeasuredPolygon sang TakeoffRow để dùng bộ tính gạch (tileCalc)
   */
  const toTakeoffRow = useCallback((poly: MeasuredPolygon, idx: number): TakeoffRow => {
    return {
      id: idx + 1,
      name: poly.name,
      kind: 'poly',
      pts: poly.points.map(p => [p.x, p.y] as [number, number]),
      area: poly.areaRaw,
      len: poly.perimeterRaw,
      visible: poly.visible,
    }
  }, [])

  /**
   * Vẽ toàn bộ đa giác đã đo, lưới gạch (nếu bật), vùng đang đo & OSNAP marker lên Canvas 2D Overlay
   */
  const renderOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current
    const docManager = docManagerRef.current
    if (!canvas || !docManager) return

    const view = docManager.curView
    const parent = canvas.parentElement
    if (!parent) return
    const width = parent.clientWidth
    const height = parent.clientHeight
    if (width === 0 || height === 0) return

    // Tối ưu 60fps trên mobile: giới hạn DPR tối đa 2 để tránh nghẽn băng thông GPU trên màn hình 3x
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const targetW = Math.round(width * dpr)
    const targetH = Math.round(height * dpr)

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const toMeters = effectiveToMetersRef.current
    const tcCfg = tileConfigRef.current
    const curMode = modeRef.current

    // 0. Nếu đang ở chế độ 'area' (Chọn vùng kín) và có đường bao đang hover
    const hovBound = hoveredBoundaryRef.current
    if (curMode === 'area' && hovBound && hovBound.points.length >= 3) {
      const screenPts = hovBound.points.map(([x, y]) => view.worldToScreen({ x, y }))
      ctx.beginPath()
      ctx.moveTo(screenPts[0].x, screenPts[0].y)
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y)
      }
      ctx.closePath()
      ctx.fillStyle = 'rgba(13, 148, 136, 0.22)'
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#0d9488'
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 0a. Nếu đang ở chế độ 'info' (Tra cứu thực thể DWG/DXF) và có thực thể đang trỏ chuột
    const hovEnt = hoveredEntityRef.current
    if (curMode === 'info' && hovEnt && hovEnt.pts.length >= 2) {
      ctx.save()
      const sp0 = view.worldToScreen(hovEnt.pts[0])
      ctx.beginPath()
      ctx.moveTo(sp0.x, sp0.y)
      for (let i = 1; i < hovEnt.pts.length; i++) {
        const spi = view.worldToScreen(hovEnt.pts[i])
        ctx.lineTo(spi.x, spi.y)
      }
      if (hovEnt.closed) {
        ctx.closePath()
        ctx.fillStyle = 'rgba(14, 165, 233, 0.18)'
        ctx.fill()
      }
      ctx.strokeStyle = '#0ea5e9'
      ctx.lineWidth = 2.8
      ctx.setLineDash([5, 3])
      ctx.stroke()
      ctx.restore()
    }

    // 0a2. Vẽ khung đánh dấu kết quả Tìm kiếm chữ (Find Text Hit Box)
    const findBox = highlightedFindBoxRef.current
    if (findBox) {
      ctx.save()
      const pMin = view.worldToScreen(findBox.min)
      const pMax = view.worldToScreen(findBox.max)
      const rx = Math.min(pMin.x, pMax.x) - 6
      const ry = Math.min(pMin.y, pMax.y) - 6
      const rw = Math.max(24, Math.abs(pMax.x - pMin.x) + 12)
      const rh = Math.max(20, Math.abs(pMax.y - pMin.y) + 12)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2.5
      ctx.setLineDash([5, 3])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.restore()
    }

    // 0b. Nếu đang ở chế độ 'layoff' (Chọn ẩn/bật lớp - tương tự lệnh LAYOFF AutoCAD)
    if (curMode === 'layoff') {
      const visibleLayers = new Set(
        layersRef.current.filter(l => l.isOn && !l.isFrozen).map(l => l.name)
      )
      const hovLay = hoveredLayoffRef.current

      // Vẽ nét mờ (Ghost) cho các đối tượng thuộc Layer đang ẩn khi bật showGhostHidden
      if (showGhostHiddenRef.current) {
        ctx.save()
        ctx.setLineDash([4, 4])
        ctx.lineWidth = 1.2
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
        for (const ent of extractedEntitiesRef.current) {
          if (visibleLayers.has(ent.layer) || ent.pts.length < 2) continue
          const sp0 = view.worldToScreen(ent.pts[0])
          ctx.beginPath()
          ctx.moveTo(sp0.x, sp0.y)
          for (let i = 1; i < ent.pts.length; i++) {
            const spi = view.worldToScreen(ent.pts[i])
            ctx.lineTo(spi.x, spi.y)
          }
          if (ent.closed) ctx.closePath()
          ctx.stroke()
        }
        ctx.restore()
      }

      // Tô sáng tất cả đối tượng cùng Layer đang trỏ chuột vào & hiển thị nhãn tên Layer
      if (hovLay) {
        ctx.save()
        const highlightColor = hovLay.isHiddenLayer ? '#10b981' : '#e11d48'
        ctx.strokeStyle = highlightColor
        ctx.lineWidth = 2.8
        ctx.setLineDash(hovLay.isHiddenLayer ? [5, 3] : [])

        for (const ent of extractedEntitiesRef.current) {
          if (ent.layer !== hovLay.layer || ent.pts.length < 2) continue
          const sp0 = view.worldToScreen(ent.pts[0])
          ctx.beginPath()
          ctx.moveTo(sp0.x, sp0.y)
          for (let i = 1; i < ent.pts.length; i++) {
            const spi = view.worldToScreen(ent.pts[i])
            ctx.lineTo(spi.x, spi.y)
          }
          if (ent.closed) ctx.closePath()
          ctx.stroke()
        }

        // Vẽ nhãn nổi ngay cạnh con trỏ chuột báo tên Layer sẽ Tắt / Bật
        const tag = hovLay.isHiddenLayer
          ? `Bật lại lớp: ${hovLay.layer} (Click để hiện)`
          : `Ẩn lớp: ${hovLay.layer} (Click để tắt)`
        ctx.font = 'bold 11px "JetBrains Mono", monospace'
        const tw = ctx.measureText(tag).width
        const bx = Math.min(width - tw - 24, hovLay.cursorScreen.x + 14)
        const by = Math.max(8, hovLay.cursorScreen.y - 30)

        ctx.fillStyle = hovLay.isHiddenLayer
          ? 'rgba(6, 95, 70, 0.95)'
          : 'rgba(136, 19, 55, 0.95)'
        ctx.beginPath()
        ctx.roundRect(bx, by, tw + 16, 24, 6)
        ctx.fill()
        ctx.strokeStyle = highlightColor
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(tag, bx + 8, by + 12)
        ctx.restore()
      }
    }

    // 1. Vẽ các đa giác & đoạn đo đã hoàn tất (Completed Polygons & Distance Lines)
    const curSpaceId = String(docManager.curDocument?.database?.currentSpaceId || '')
    measuredPolygonsRef.current.forEach((poly, polyIdx) => {
      if (!poly.visible || poly.points.length < 2) return
      // Vùng đo thuộc Sheet/Layout cụ thể chỉ hiển thị khi đang xem Sheet/Layout đó
      if (poly.layoutBtrId && curSpaceId && poly.layoutBtrId !== curSpaceId) return

      const isDist = poly.kind === 'dist' || poly.points.length < 3
      const isSelected = poly.id === selectedPolygonIdRef.current
      const isHovered = poly.id === hoveredPolygonIdRef.current
      const screenPts = poly.points.map(pt => view.worldToScreen(pt))

      // Tô nền mờ chỉ dành cho đa giác diện tích khép kín (>= 3 đỉnh)
      if (!isDist && screenPts.length >= 3) {
        ctx.beginPath()
        ctx.moveTo(screenPts[0].x, screenPts[0].y)
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y)
        }
        ctx.closePath()
        ctx.fillStyle = hexToRgba(
          isHovered ? '#f59e0b' : poly.color,
          isHovered ? 0.45 : isSelected ? 0.35 : 0.2
        )
        ctx.fill()
      }

      // Nếu bật Lưới gạch (Tile Grid), vẽ lưới cho đa giác diện tích
      // Tối ưu 60fps trên mobile: tạm thời bỏ qua tính toán phân mảnh viên cắt trong lúc ngón tay đang trượt/pinch zoom
      if (!isDist && tcCfg.on && screenPts.length >= 3 && !isTouchInteractingRef.current) {
        const rowObj = toTakeoffRow(poly, polyIdx)
        const tc = tileCalc(rowObj, tcCfg, toMeters)
        if (tc && tc.cells && !tc.big) {
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(screenPts[0].x, screenPts[0].y)
          for (let i = 1; i < screenPts.length; i++) {
            ctx.lineTo(screenPts[i].x, screenPts[i].y)
          }
          ctx.closePath()
          ctx.clip()

          // Nếu có roan gạch (g > 0), tô nền kẽ roan gạch bên dưới các viên gạch
          if (tcCfg.g > 0) {
            ctx.fillStyle =
              tcCfg.groutColor || (dark ? 'rgba(71, 85, 105, 0.7)' : 'rgba(148, 163, 184, 0.6)')
            ctx.fill()
          }

          for (const cell of tc.cells) {
            if (cell.pts && cell.pts.length === 4) {
              const sp0 = view.worldToScreen({ x: cell.pts[0][0], y: cell.pts[0][1] })
              const sp1 = view.worldToScreen({ x: cell.pts[1][0], y: cell.pts[1][1] })
              const sp2 = view.worldToScreen({ x: cell.pts[2][0], y: cell.pts[2][1] })
              const sp3 = view.worldToScreen({ x: cell.pts[3][0], y: cell.pts[3][1] })
              ctx.beginPath()
              ctx.moveTo(sp0.x, sp0.y)
              ctx.lineTo(sp1.x, sp1.y)
              ctx.lineTo(sp2.x, sp2.y)
              ctx.lineTo(sp3.x, sp3.y)
              ctx.closePath()

              if (cell.isCut) {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.28)'
                ctx.fill()
                ctx.strokeStyle = 'rgba(217, 119, 6, 0.75)'
              } else {
                ctx.fillStyle = dark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.55)'
                ctx.fill()
                ctx.strokeStyle = 'rgba(13, 148, 136, 0.5)'
              }
              ctx.lineWidth = 0.8
              ctx.stroke()
            } else {
              const pA = view.worldToScreen({ x: cell.x, y: cell.y })
              const pB = view.worldToScreen({ x: cell.x + cell.w, y: cell.y + cell.h })
              const rx = Math.min(pA.x, pB.x)
              const ry = Math.min(pA.y, pB.y)
              const rw = Math.abs(pB.x - pA.x)
              const rh = Math.abs(pB.y - pA.y)

              if (cell.isCut) {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.28)'
                ctx.fillRect(rx, ry, rw, rh)
                ctx.strokeStyle = 'rgba(217, 119, 6, 0.75)'
              } else {
                ctx.fillStyle = dark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.55)'
                ctx.fillRect(rx, ry, rw, rh)
                ctx.strokeStyle = 'rgba(13, 148, 136, 0.5)'
              }
              ctx.lineWidth = 0.8
              ctx.strokeRect(rx, ry, rw, rh)
            }
          }
          ctx.restore()
        }
      }

      // Viền đường đo hoặc viền đa giác
      ctx.save()
      if (isHovered) {
        ctx.shadowColor = 'rgba(245, 158, 11, 0.95)'
        ctx.shadowBlur = 16
        ctx.lineWidth = 4.5
        ctx.strokeStyle = '#f59e0b'
      } else {
        ctx.lineWidth = isSelected ? 3 : 2
        ctx.strokeStyle = poly.color
      }
      ctx.beginPath()
      ctx.moveTo(screenPts[0].x, screenPts[0].y)
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y)
      }
      if (!isDist && screenPts.length >= 3) {
        ctx.closePath()
      }
      ctx.setLineDash([])
      ctx.stroke()
      ctx.restore()

      // Vẽ nhãn chiều dài từng đoạn trên các cạnh
      const maxSegCount = isDist ? screenPts.length - 1 : screenPts.length
      for (let i = 0; i < maxSegCount; i++) {
        const sp1 = screenPts[i]
        const sp2 = screenPts[(i + 1) % screenPts.length]
        const segLenPx = Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y)
        if (segLenPx > 40) {
          const midX = (sp1.x + sp2.x) / 2
          const midY = (sp1.y + sp2.y) / 2
          const seg = poly.segments[i]
          if (seg) {
            const label = `${seg.lengthMeters.toFixed(2)}m`
            ctx.font = '600 11px "JetBrains Mono", monospace'
            const textWidth = ctx.measureText(label).width
            ctx.fillStyle = 'rgba(15, 23, 42, 0.86)'
            ctx.fillRect(midX - textWidth / 2 - 4, midY - 9, textWidth + 8, 18)
            ctx.strokeStyle = hexToRgba(isHovered ? '#f59e0b' : poly.color, isHovered ? 1 : 0.7)
            ctx.lineWidth = isHovered ? 1.5 : 1
            ctx.strokeRect(midX - textWidth / 2 - 4, midY - 9, textWidth + 8, 18)
            ctx.fillStyle = '#f8fafc'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(label, midX, midY)
          }
        }
      }

      // Vẽ các đỉnh của đa giác / đường đo
      screenPts.forEach((sp, idx) => {
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, isHovered ? 6 : isSelected ? 5 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isHovered ? '#f59e0b' : '#0f172a'
        ctx.fill()
        ctx.lineWidth = isHovered ? 2.5 : 2
        ctx.strokeStyle = isHovered ? '#ffffff' : poly.color
        ctx.stroke()

        if (isSelected || isHovered) {
          ctx.font = 'bold 10px "JetBrains Mono", monospace'
          ctx.fillStyle = isHovered ? '#f59e0b' : '#38bdf8'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'bottom'
          ctx.fillText(`P${idx + 1}`, sp.x + 6, sp.y - 4)
        }
      })

      // Vẽ Badge tên + Chỉ số (m² cho Sàn, m cho Đo dài) ở tâm
      const centroidWcs = calculatePolygonCentroid(poly.points)
      const centroidScreen = view.worldToScreen(centroidWcs)
      const titleText = poly.name
      const badgeValueText = isDist
        ? `${poly.perimeterMeters.toFixed(2)} m`
        : `${poly.areaSquareMeters.toFixed(2)} m²`

      ctx.font = '600 11px "Be Vietnam Pro", sans-serif'
      const w1 = ctx.measureText(titleText).width
      ctx.font = 'bold 13px "JetBrains Mono", monospace'
      const w2 = ctx.measureText(badgeValueText).width
      const boxW = Math.max(w1, w2) + 18
      const boxH = 38

      ctx.save()
      if (isHovered) {
        ctx.shadowColor = 'rgba(245, 158, 11, 0.8)'
        ctx.shadowBlur = 12
      }
      ctx.fillStyle = isHovered ? 'rgba(30, 27, 75, 0.95)' : 'rgba(15, 23, 42, 0.92)'
      ctx.beginPath()
      ctx.roundRect(
        centroidScreen.x - boxW / 2,
        centroidScreen.y - boxH / 2,
        boxW,
        boxH,
        6
      )
      ctx.fill()
      ctx.lineWidth = isHovered ? 3 : isSelected ? 2 : 1.5
      ctx.strokeStyle = isHovered ? '#f59e0b' : poly.color
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = isHovered ? '#fef08a' : '#cbd5e1'
      ctx.font = '600 10px "Be Vietnam Pro", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(titleText, centroidScreen.x, centroidScreen.y - 8)

      ctx.fillStyle = isHovered ? '#38bdf8' : isDist ? '#38bdf8' : '#2dd4bf'
      ctx.font = 'bold 13px "JetBrains Mono", monospace'
      ctx.fillText(badgeValueText, centroidScreen.x, centroidScreen.y + 8)
    })

    // 2. Vẽ vùng đang đo trực tiếp (Active Measurement Polygon / Rect + Rubber-band)
    const pts = activePointsRef.current
    const snap = currentSnapRef.current
    const isDrawingTool =
      curMode === 'poly' || curMode === 'rect' || curMode === 'dist' || curMode === 'cal'

    // 2a. Vẽ đoạn chuẩn Chỉnh tỉ lệ (Calibration line)
    const cLine = calLineRef.current
    if (cLine && cLine.length > 0) {
      const p0 = view.worldToScreen(cLine[0])
      const p1 =
        cLine.length >= 2
          ? view.worldToScreen(cLine[1])
          : snap
            ? view.worldToScreen(snap.point)
            : null
      ctx.save()
      if (p1) {
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2.5
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }
      ;[p0, ...(p1 ? [p1] : [])].forEach((sp, idx) => {
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 5.5, 0, Math.PI * 2)
        ctx.fillStyle = '#f59e0b'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#0f172a'
        ctx.stroke()
        ctx.font = 'bold 11px "JetBrains Mono", monospace'
        ctx.fillStyle = '#f59e0b'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`C${idx + 1}`, sp.x + 8, sp.y - 4)
      })
      ctx.restore()
    }

    if ((curMode === 'poly' || curMode === 'rect' || curMode === 'dist') && pts.length > 0) {
      let previewPtsWcs: Point2D[] = pts
      if (curMode === 'rect' && pts.length === 1 && snap) {
        const p1 = pts[0]
        const p2 = snap.point
        previewPtsWcs = [
          p1,
          { x: p2.x, y: p1.y },
          p2,
          { x: p1.x, y: p2.y },
        ]
      } else if (snap) {
        previewPtsWcs = [...pts, snap.point]
      }

      const screenPts = pts.map(p => view.worldToScreen(p))
      const previewScreenPts = previewPtsWcs.map(p => view.worldToScreen(p))

      // Nếu có >= 3 điểm và không phải chế độ đo dài, tô nền mờ xem trước
      if (curMode !== 'dist' && previewScreenPts.length >= 3) {
        ctx.beginPath()
        ctx.moveTo(previewScreenPts[0].x, previewScreenPts[0].y)
        for (let i = 1; i < previewScreenPts.length; i++) {
          ctx.lineTo(previewScreenPts[i].x, previewScreenPts[i].y)
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(13, 148, 136, 0.22)'
        ctx.fill()
      }

      // Vẽ các đoạn thẳng đã cố định
      if (screenPts.length >= 2) {
        ctx.beginPath()
        ctx.moveTo(screenPts[0].x, screenPts[0].y)
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y)
        }
        ctx.strokeStyle = '#0d9488'
        ctx.lineWidth = 2.5
        ctx.setLineDash([])
        ctx.stroke()

        // Hiển thị chiều dài từng đoạn đã chọn
        for (let i = 0; i < screenPts.length - 1; i++) {
          const sp1 = screenPts[i]
          const sp2 = screenPts[i + 1]
          const distRaw = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
          const distM = distRaw * toMeters
          const midX = (sp1.x + sp2.x) / 2
          const midY = (sp1.y + sp2.y) / 2
          const label = `${distM.toFixed(2)} m`
          ctx.font = '600 11px "JetBrains Mono", monospace'
          const tw = ctx.measureText(label).width
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
          ctx.fillRect(midX - tw / 2 - 4, midY - 9, tw + 8, 18)
          ctx.fillStyle = '#5eead4'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, midX, midY)
        }
      }

      // Vẽ đường đứt nét (Rubber-band) từ điểm cuối tới con trỏ chuột và tới điểm đầu P1
      if (snap) {
        if (curMode === 'rect' && pts.length === 1) {
          ctx.beginPath()
          ctx.moveTo(previewScreenPts[0].x, previewScreenPts[0].y)
          for (let i = 1; i < previewScreenPts.length; i++) {
            ctx.lineTo(previewScreenPts[i].x, previewScreenPts[i].y)
          }
          ctx.closePath()
          ctx.strokeStyle = '#14b8a6'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 4])
          ctx.stroke()
          ctx.setLineDash([])
        } else {
          const lastSp = screenPts[screenPts.length - 1]
          const cursorSp = view.worldToScreen(snap.point)

          ctx.beginPath()
          ctx.moveTo(lastSp.x, lastSp.y)
          ctx.lineTo(cursorSp.x, cursorSp.y)
          ctx.strokeStyle = '#14b8a6'
          ctx.lineWidth = 1.8
          ctx.setLineDash([6, 4])
          ctx.stroke()

          if (curMode === 'poly' && screenPts.length >= 2) {
            ctx.beginPath()
            ctx.moveTo(cursorSp.x, cursorSp.y)
            ctx.lineTo(screenPts[0].x, screenPts[0].y)
            ctx.strokeStyle = 'rgba(20, 184, 166, 0.5)'
            ctx.lineWidth = 1.2
            ctx.setLineDash([4, 4])
            ctx.stroke()
          }
          ctx.setLineDash([])
        }
      }

      // Vẽ các đỉnh P1, P2, ... đã click
      screenPts.forEach((sp, index) => {
        const isFirst = index === 0
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, isFirst ? 6 : 4.5, 0, Math.PI * 2)
        ctx.fillStyle = isFirst ? '#f59e0b' : '#0d9488'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#0f172a'
        ctx.stroke()

        ctx.font = 'bold 11px "JetBrains Mono", monospace'
        ctx.fillStyle = isFirst ? '#f59e0b' : '#14b8a6'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'bottom'
        ctx.fillText(isFirst ? 'P1 (Điểm đầu)' : `P${index + 1}`, sp.x + 8, sp.y - 4)
      })

      // Hiển thị diện tích xem trước theo thời gian thực (Live Area) bằng công thức Shoelace
      if (curMode !== 'dist' && previewPtsWcs.length >= 3) {
        const liveAreaRaw = calculateShoelaceArea(previewPtsWcs)
        const liveAreaM2 = convertAreaToSquareMeters(liveAreaRaw, toMeters)
        const cWcs = calculatePolygonCentroid(previewPtsWcs)
        const cSp = view.worldToScreen(cWcs)
        const badgeText = `≈ ${liveAreaM2.toFixed(2)} m²`

        ctx.font = 'bold 13px "JetBrains Mono", monospace'
        const tw = ctx.measureText(badgeText).width
        ctx.fillStyle = 'rgba(19, 78, 74, 0.92)'
        ctx.beginPath()
        ctx.roundRect(cSp.x - tw / 2 - 10, cSp.y - 14, tw + 20, 28, 6)
        ctx.fill()
        ctx.strokeStyle = '#2dd4bf'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.fillStyle = '#f0fdfa'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(badgeText, cSp.x, cSp.y)
      }
    }

    // 3. Vẽ biểu tượng bắt điểm Snap (OSNAP Marker) khi đang ở chế độ đo đạc
    if (isDrawingTool && snap) {
      const sp = view.worldToScreen(snap.point)
      ctx.save()

      if (snap.type === 'first-point') {
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 11, 0, Math.PI * 2)
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2.5
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#f59e0b'
        ctx.fill()
      } else if (snap.type === 'endpoint') {
        const size = 12
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2.2
        ctx.strokeRect(sp.x - size / 2, sp.y - size / 2, size, size)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.25)'
        ctx.fillRect(sp.x - size / 2, sp.y - size / 2, size, size)
      } else if (snap.type === 'midpoint') {
        const r = 7
        ctx.beginPath()
        ctx.moveTo(sp.x, sp.y - r)
        ctx.lineTo(sp.x - r, sp.y + r)
        ctx.lineTo(sp.x + r, sp.y + r)
        ctx.closePath()
        ctx.strokeStyle = '#eab308'
        ctx.lineWidth = 2.2
        ctx.stroke()
      } else if (snap.type === 'center' || snap.type === 'intersection') {
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2)
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 2.2
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = '#14b8a6'
        ctx.fill()
      }

      if (snap.type !== 'none') {
        const tag = snap.label
        ctx.font = '600 11px "JetBrains Mono", monospace'
        const tw = ctx.measureText(tag).width
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
        ctx.fillRect(sp.x + 12, sp.y + 10, tw + 12, 20)
        ctx.strokeStyle = snap.type === 'first-point' ? '#f59e0b' : '#22c55e'
        ctx.lineWidth = 1
        ctx.strokeRect(sp.x + 12, sp.y + 10, tw + 12, 20)
        ctx.fillStyle = '#f8fafc'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(tag, sp.x + 18, sp.y + 20)
      }

      ctx.restore()
    }

    ctx.restore()
  }, [toTakeoffRow])

  const renderOverlayRafRef = useRef<number | null>(null)
  const scheduleRenderOverlay = useCallback(() => {
    if (renderOverlayRafRef.current !== null) return
    renderOverlayRafRef.current = requestAnimationFrame(() => {
      renderOverlayRafRef.current = null
      renderOverlay()
    })
  }, [renderOverlay])

  useEffect(() => {
    return () => {
      if (renderOverlayRafRef.current !== null) {
        cancelAnimationFrame(renderOverlayRafRef.current)
        renderOverlayRafRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    scheduleRenderOverlay()
  }, [
    activePoints,
    currentSnap,
    hoveredBoundary,
    hoveredLayoff,
    hoveredEntity,
    highlightedFindBox,
    showGhostHidden,
    measuredPolygons,
    selectedPolygonId,
    hoveredPolygonId,
    calLine,
    mode,
    tileConfig,
    scheduleRenderOverlay,
  ])

  /**
   * Làm mới danh sách các bản vẽ đang mở (Multi-Document Tabs)
   */
  const refreshOpenDocs = useCallback((manager: AcApDocManager) => {
    try {
      const curDoc = manager.curDocument
      const docs = manager.documents || []
      const tabs: OpenDocTabInfo[] = docs.map((d, idx) => {
        const rawTitle = d.docTitle || `Bản vẽ ${idx + 1}`
        const fileName = rawTitle.split('/').pop() || rawTitle
        const isDwg = /\.dwg$/i.test(fileName)
        return {
          sessionId: String((d as unknown as { internalSessionId?: string }).internalSessionId || `${idx}-${fileName}`),
          title: fileName,
          fileName,
          format: isDwg ? 'DWG' : 'DXF',
          isActive: d === curDoc,
          doc: d,
        }
      })
      setOpenDocs(tabs)
    } catch {
      // Ignore if documents getter not ready
    }
  }, [])

  /**
   * Đồng bộ danh sách Layer, Sheet / Layouts, thông tin $INSUNITS, Snap Targets & Closed Boundaries từ AcDbDatabase
   */
  const syncDocumentMetadata = useCallback(
    (manager: AcApDocManager, rawBuffer?: ArrayBuffer, fileNameOverride?: string) => {
      const doc = manager.curDocument
      const db = doc.database
      const layerStore = doc.layerStore

      setLayers(layerStore.getLayers())

      const resolvedName =
        fileNameOverride || doc.docTitle?.split('/').pop() || currentFileNameRef.current
      if (resolvedName) {
        setCurrentFileName(resolvedName)
      }

      const parsedFromHeader =
        rawBuffer && !/\.dwg$/i.test(resolvedName)
          ? parseInsunitsFromDxfBuffer(rawBuffer)
          : null
      const dbInsunits = typeof db.insunits === 'number' && db.insunits > 0 ? db.insunits : null
      const resolvedInsunits =
        parsedFromHeader !== null
          ? parsedFromHeader
          : dbInsunits !== null
            ? dbInsunits
            : 4

      setDetectedInsunits(resolvedInsunits)
      setSelectedInsunits(resolvedInsunits)
      setUseCustomFactor(false)

      const docLayouts = listDocumentLayouts(db)
      setLayouts(docLayouts)

      // Chuẩn hóa tự động mã chữ tiếng Việt (TCVN3 / VNI / UTF-8 Mojibake) sang Unicode chuẩn trên các đối tượng CAD
      normalizeVietnameseDatabaseText(db)

      const extracted = extractDatabaseGeometry(db, resolvedName, String(db.currentSpaceId || ''))
      snapTargetsRef.current = extracted.snapTargets
      closedBoundariesRef.current = extracted.closedBoundaries
      extractedEntitiesRef.current = extracted.entities
      entityLayerByIdRef.current = extracted.entityLayerById
      entityMapByIdRef.current = extracted.entityMapById
      drawingExtentsRef.current = extracted.extents
      setDrawingExtents(extracted.extents)
      setDocStats(extracted.stats)
      setRecentHiddenLayers([])
      setLastLayerToast(null)
      refreshOpenDocs(manager)
    },
    [refreshOpenDocs]
  )

  /**
   * Tạo cấu hình mở full tính năng cho cả DWG và DXF
   */
  const buildOpenDatabaseOptions = useCallback((customEncoding?: string) => {
    const enc = customEncoding !== undefined ? customEncoding : dxfEncodingRef.current
    return {
      mode: AcEdOpenMode.Write,
      openViewMode: AcApOpenViewMode.Extents,
      minimumChunkSize: 1000,
      drawNoPlotLayers: drawNoPlotLayersRef.current,
      convertInvisibleLayers: true,
      convertAllLayouts: true,
      circleSides: ACDB_DRAW_CIRCLE_SIDES_HIGH,
      ...(enc ? { encoding: enc } : {}),
      sysVars: {
        lwdisplay: lineWeightDisplayRef.current,
      },
    }
  }, [])

  /**
   * Mở bản vẽ DXF / DWG từ ArrayBuffer bằng @mlightcad/cad-simple-viewer
   */
  const loadCadBuffer = useCallback(
    async (
      fileName: string,
      buffer: ArrayBuffer,
      customEncoding?: string,
      isSampleSwitch = false,
      parentEpoch?: number
    ) => {
      const manager = docManagerRef.current
      if (!manager) return

      const thisEpoch = parentEpoch !== undefined ? parentEpoch : ++loadEpochRef.current
      lastLoadedBufferRef.current = { fileName, buffer }
      setIsLoading(true)
      setOpenProgress({ pct: 5, stage: 'Đang khởi tạo bộ giải mã DWG/DXF...' })
      setStatusMessage(`Đang phân tích bản vẽ ${fileName}...`)

      // Nếu đang chuyển đổi giữa các file mẫu CAD, đóng các tài liệu cũ để view reset sạch sẽ, tránh vẽ chồng chéo
      if (isSampleSwitch && manager.documents) {
        const docsToClose = [...manager.documents]
        for (const d of docsToClose) {
          try {
            await manager.closeDocument(d)
          } catch {
            // ignore
          }
        }
      }

      if (loadEpochRef.current !== thisEpoch) return

      const db = manager.curDocument?.database
      const subStageLabels: Record<string, string> = {
        HEADER: 'Đọc tiêu đề & tham số bản vẽ (HEADER)',
        LTYPE: 'Đọc kiểu đường nét (LINETYPE)',
        STYLE: 'Đọc kiểu văn bản (STYLE)',
        DIMSTYLE: 'Đọc kiểu kích thước (DIMSTYLE)',
        LAYER: 'Đọc danh sách Lớp (LAYER)',
        VPORT: 'Cấu hình khung nhìn (VIEWPORT)',
        BLOCK: 'Giải mã khối & XREF (BLOCK)',
        ENTITY: 'Dựng hình thực thể (ENTITIES)',
        OBJECT: 'Nạp đối tượng mở rộng (OBJECTS)',
        END: 'Hoàn tất cấu trúc bản vẽ',
      }

      const handleOpenProgress = (args: { percentage?: number; subStage?: string }) => {
        if (loadEpochRef.current !== thisEpoch) return
        const pct = Math.min(100, Math.max(0, Math.round(args.percentage ?? 0)))
        const sub = args.subStage ? subStageLabels[args.subStage] || args.subStage : ''
        const stageDesc = sub ? `${sub} • ${pct}%` : `Đang phân tích • ${pct}%`
        setOpenProgress({ pct, stage: stageDesc })
      }

      db?.events?.openProgress?.addEventListener(handleOpenProgress)

      try {
        const options = buildOpenDatabaseOptions(customEncoding)
        const success = await manager.openDocument(fileName, buffer, options)

        if (loadEpochRef.current !== thisEpoch) {
          console.log(`Bỏ qua kết quả nạp bản vẽ cũ (${fileName})`)
          return
        }

        if (success) {
          setCurrentFileName(fileName)
          syncDocumentMetadataRef.current(manager, buffer, fileName)

          const view = manager.curView
          view.entitySelectionEnabled = false
          try {
            // Giữ view.mode luôn ở SELECTION để tránh xung đột chuột và không ngắt sự kiện idle của viewer
            view.mode = AcEdViewMode.SELECTION
          } catch {
            // Ignore if activeLayoutView is still initializing
          }

          const initialCursor = modeRef.current === 'pan' ? 'grab' : 'crosshair'
          if (view.canvas) {
            view.canvas.style.setProperty('cursor', initialCursor, 'important')
          }
          if (viewerContainerRef.current) {
            viewerContainerRef.current.style.setProperty('cursor', initialCursor, 'important')
          }

          setActivePoints([])
          setCurrentSnap(null)
          setHoveredBoundary(null)
          setHoveredEntity(null)
          setInspectedEntity(null)
          setHighlightedFindBox(null)
          setStatusMessage(`Đã tải thành công: ${fileName}`)

          const fitDrawingToView = () => {
            const ext = drawingExtentsRef.current
            if (
              ext &&
              Number.isFinite(ext[0]) &&
              Number.isFinite(ext[1]) &&
              Number.isFinite(ext[2]) &&
              Number.isFinite(ext[3]) &&
              (ext[2] > ext[0] || ext[3] > ext[1])
            ) {
              try {
                const box = new AcGeBox2d(
                  new AcGePoint2d(ext[0], ext[1]),
                  new AcGePoint2d(ext[2], ext[3])
                )
                view.zoomTo(box, 1.15)
              } catch {
                try {
                  view.zoomToFitDrawing(0)
                } catch {
                  // ignore
                }
              }
            } else {
              try {
                view.zoomToFitDrawing(0)
              } catch {
                // ignore
              }
            }
            renderOverlayRef.current()
          }

          // Cho renderer ổn định và căn chỉnh toàn bộ bản vẽ vào tầm nhìn chuẩn xác
          requestAnimationFrame(fitDrawingToView)
          setTimeout(fitDrawingToView, 120)
          setTimeout(fitDrawingToView, 350)
        } else {
          setStatusMessage(`Không thể đọc tệp ${fileName}. Vui lòng kiểm tra định dạng DXF/DWG.`)
        }
      } catch (err) {
        if (loadEpochRef.current === thisEpoch) {
          console.error('Lỗi khi mở bản vẽ:', err)
          setStatusMessage(`Lỗi khi mở tệp ${fileName}.`)
        }
      } finally {
        db?.events?.openProgress?.removeEventListener(handleOpenProgress)
        if (loadEpochRef.current === thisEpoch) {
          setIsLoading(false)
          setOpenProgress(null)
        }
      }
    },
    [buildOpenDatabaseOptions]
  )

  /**
   * Mở bản vẽ DXF / DWG từ đường dẫn URL từ xa
   */
  const loadCadUrl = useCallback(
    async (url: string, labelOverride?: string, isSampleSwitch = false) => {
      const manager = docManagerRef.current
      if (!manager || !url.trim()) return

      const thisEpoch = ++loadEpochRef.current
      const cleanUrl = url.trim()
      const fileName = labelOverride || cleanUrl.split('/').pop() || 'drawing.dwg'
      setIsLoading(true)
      setOpenProgress({ pct: 10, stage: `Đang tải ${fileName}...` })
      setStatusMessage(`Đang tải bản vẽ ${fileName}...`)

      try {
        const response = await fetch(cleanUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        if (loadEpochRef.current !== thisEpoch) return
        const buffer = await response.arrayBuffer()
        if (loadEpochRef.current !== thisEpoch) return
        await loadCadBuffer(fileName, buffer, undefined, isSampleSwitch, thisEpoch)
      } catch (err) {
        if (loadEpochRef.current === thisEpoch) {
          console.error('Lỗi tải URL CAD:', err)
          setStatusMessage(`Không thể tải bản vẽ từ URL: ${fileName}`)
          setIsLoading(false)
          setOpenProgress(null)
        }
      }
    },
    [loadCadBuffer]
  )

  /**
   * Tải một trong các file DXF / DWG mẫu có sẵn
   */
  const loadSampleFile = useCallback(
    async (sample: SampleFileItem) => {
      setSelectedSampleId(sample.id)
      const fileName = sample.path.split('/').pop() || `${sample.id}.${sample.format.toLowerCase()}`
      // Đặt lại các phép đo cũ để tránh vẽ đè tọa độ không tương thích lên bản vẽ mẫu mới
      setMeasuredPolygons([])
      setSelectedPolygonId(null)
      setHistory([])
      setRedoStack([])
      setActivePoints([])
      setCurrentSnap(null)
      setHoveredBoundary(null)
      setHoveredEntity(null)
      setInspectedEntity(null)
      setHighlightedFindBox(null)
      await loadCadUrl(sample.path, fileName, true)
    },
    [loadCadUrl]
  )

  /**
   * Đóng vùng đang đo và lưu kết quả (hỗ trợ cả Vùng sàn >= 3 đỉnh và Đo chiều dài >= 2 điểm)
   */
  const finishCurrentPolygon = useCallback(
    (pointsToClose?: Point2D[], customName?: string) => {
      const pts = pointsToClose ?? activePointsRef.current
      const isDist = modeRef.current === 'dist'
      const minPts = isDist ? 2 : 3
      if (pts.length < minPts) return

      const toMeters = effectiveToMetersRef.current
      const isClosed = !isDist
      const areaRaw = isClosed ? calculateShoelaceArea(pts) : 0
      const areaSquareMeters = isClosed ? convertAreaToSquareMeters(areaRaw, toMeters) : 0
      const segments = calculatePolygonSegments(pts, toMeters, isClosed)
      const perimeterRaw = segments.reduce((sum, seg) => sum + seg.lengthRaw, 0)
      const perimeterMeters = segments.reduce((sum, seg) => sum + seg.lengthMeters, 0)

      setHistory(h => [...h.slice(-29), measuredPolygonsRef.current])
      setRedoStack([])

      const m = docManagerRef.current
      const curDb = m?.curDocument?.database
      const curSpaceId = String(curDb?.currentSpaceId || '')
      const curLayout =
        layoutsRef.current.find(l => l.isActive || (curSpaceId && l.btrId === curSpaceId)) ||
        layoutsRef.current[0]
      const layoutBtrId = curLayout?.btrId || curSpaceId || undefined
      const layoutName = curLayout?.name || 'Model'

      setMeasuredPolygons(prev => {
        const nextIndex = prev.length + 1
        const color = POLYGON_COLORS[(nextIndex - 1) % POLYGON_COLORS.length]
        const defaultName = isDist
          ? (pts.length === 2 ? `Đoạn thẳng #${nextIndex}` : `Đoạn đo #${nextIndex}`)
          : `Đa giác #${nextIndex}`
        const newPoly: MeasuredPolygon = {
          id: `poly-${Date.now()}-${nextIndex}`,
          name: customName || defaultName,
          color,
          points: [...pts],
          areaRaw,
          areaSquareMeters,
          perimeterRaw,
          perimeterMeters,
          segments,
          visible: true,
          insunits: selectedInsunitsRef.current,
          kind: isDist ? 'dist' : 'floor',
          layoutBtrId,
          layoutName,
        }
        setSelectedPolygonId(newPoly.id)
        return [newPoly, ...prev]
      })

      setActivePoints([])
      setCurrentSnap(null)
      if (isDist) {
        setStatusMessage(
          `Đã đo chiều dài (${pts.length} điểm) — Độ dài: ${perimeterMeters.toFixed(2)} m`
        )
      } else {
        setStatusMessage(
          `Đã đóng vùng đo (${pts.length} đỉnh) — Diện tích: ${areaSquareMeters.toFixed(2)} m²`
        )
      }
    },
    []
  )

  /**
   * Hoàn tác (Undo) / Làm lại (Redo) các thao tác đo vùng
   */
  const handleUndo = useCallback(() => {
    if (activePointsRef.current.length > 0) {
      setActivePoints(prev => prev.slice(0, -1))
      return
    }
    const curHist = historyRef.current
    if (!curHist.length) return
    const prevPolys = curHist[curHist.length - 1]
    setRedoStack(r => [...r, measuredPolygonsRef.current])
    setHistory(curHist.slice(0, -1))
    setMeasuredPolygons(prevPolys)
  }, [])

  const handleRedo = useCallback(() => {
    const curRedo = redoStackRef.current
    if (!curRedo.length) return
    const nextPolys = curRedo[curRedo.length - 1]
    setHistory(h => [...h, measuredPolygonsRef.current])
    setRedoStack(curRedo.slice(0, -1))
    setMeasuredPolygons(nextPolys)
  }, [])

  /**
   * Áp dụng hiệu chuẩn tỉ lệ thực tế (Chỉnh tỉ lệ) từ đoạn thẳng 2 điểm đã chấm
   */
  const handleApplyCalibration = useCallback(() => {
    if (!calLine || calLine.length < 2) return
    const val = parseFloat(calValue)
    if (!Number.isFinite(val) || val <= 0) return
    const dRaw = Math.hypot(calLine[1].x - calLine[0].x, calLine[1].y - calLine[0].y)
    if (dRaw <= 0) return
    const realMeters = val * calUnit
    const factor = realMeters / dRaw
    setCustomToMeters(factor.toPrecision(6))
    setUseCustomFactor(true)
    setCalLine(null)
    setCalValue('')
    setMode('poly')
    setStatusMessage(
      `Đã hiệu chuẩn tỉ lệ: 1 đv = ${factor.toPrecision(4)} m (${val}${calUnit === 0.001 ? 'mm' : calUnit === 0.01 ? 'cm' : 'm'})`
    )
  }, [calLine, calValue, calUnit])

  /**
   * Tự động chọn tất cả các đường bao kín (Closed Polylines) trong bản vẽ
   */
  const handleSelectAllClosedBoundaries = useCallback(() => {
    const visibleLayers = new Set(
      layersRef.current.filter(l => l.isOn && !l.isFrozen).map(l => l.name)
    )
    const boundaries = closedBoundariesRef.current.filter(
      b => visibleLayers.size === 0 || visibleLayers.has(b.layer)
    )

    if (boundaries.length === 0) {
      setStatusMessage('Không tìm thấy đường bao Polyline khép kín nào trên các Layer đang bật.')
      return
    }

    const toMeters = effectiveToMetersRef.current
    const added: MeasuredPolygon[] = []
    const m = docManagerRef.current
    const curDb = m?.curDocument?.database
    const curSpaceId = String(curDb?.currentSpaceId || '')
    const curLayout =
      layoutsRef.current.find(l => l.isActive || (curSpaceId && l.btrId === curSpaceId)) ||
      layoutsRef.current[0]
    const layoutBtrId = curLayout?.btrId || curSpaceId || undefined
    const layoutName = curLayout?.name || 'Model'

    boundaries.forEach((b, idx) => {
      const pts = b.points.map(([x, y]) => ({ x, y }))
      const areaRaw = calculateShoelaceArea(pts)
      const areaSquareMeters = convertAreaToSquareMeters(areaRaw, toMeters)
      if (areaSquareMeters < 0.05) return

      const segments = calculatePolygonSegments(pts, toMeters, true)
      const perimeterRaw = segments.reduce((sum, seg) => sum + seg.lengthRaw, 0)
      const perimeterMeters = segments.reduce((sum, seg) => sum + seg.lengthMeters, 0)
      const color = POLYGON_COLORS[idx % POLYGON_COLORS.length]

      added.push({
        id: `auto-${Date.now()}-${idx}`,
        name: b.label || `Vùng ${b.layer} #${idx + 1}`,
        color,
        points: pts,
        areaRaw,
        areaSquareMeters,
        perimeterRaw,
        perimeterMeters,
        segments,
        visible: true,
        insunits: selectedInsunitsRef.current,
        kind: 'floor',
        layoutBtrId,
        layoutName,
      })
    })

    if (added.length > 0) {
      setHistory(h => [...h.slice(-29), measuredPolygonsRef.current])
      setRedoStack([])
      setMeasuredPolygons(prev => [...added, ...prev])
      setSelectedPolygonId(added[0].id)
      setStatusMessage(`Đã tự động đo ${added.length} vùng kín từ bản vẽ!`)
    }
  }, [])

  /**
   * Tìm điểm Snap (Vertex/Endpoint/Midpoint/Intersection) gần con trỏ chuột nhất
   */
  const resolveBestSnapPoint = useCallback(
    (clientX: number, clientY: number, shiftKey = false): SnapInfo => {
      const manager = docManagerRef.current
      if (!manager) {
        return { point: { x: 0, y: 0 }, type: 'none', label: '' }
      }

      const view = manager.curView
      const canvasPt = view.viewportToCanvas({ x: clientX, y: clientY })
      const rawWcs = view.screenToWorld(canvasPt)
      const pts = activePointsRef.current

      // 1. Kiểm tra đóng vùng tại điểm đầu P1 (<= 15px)
      if (modeRef.current === 'poly' && pts.length >= 3) {
        const firstScreen = view.worldToScreen(pts[0])
        const distFirstPx = Math.hypot(
          canvasPt.x - firstScreen.x,
          canvasPt.y - firstScreen.y
        )
        if (distFirstPx <= 15) {
          return {
            point: { x: pts[0].x, y: pts[0].y },
            type: 'first-point',
            label: 'Đóng vùng tại P1',
          }
        }
      }

      const applyOrthoIfNeeded = (pt: Point2D): Point2D => {
        if ((!orthoRef.current && !shiftKey) || pts.length === 0 || modeRef.current === 'rect') {
          return pt
        }
        const last = pts[pts.length - 1]
        const dx = Math.abs(pt.x - last.x)
        const dy = Math.abs(pt.y - last.y)
        return dx >= dy ? { x: pt.x, y: last.y } : { x: last.x, y: pt.y }
      }

      if (!snapEnabledRef.current) {
        return {
          point: applyOrthoIfNeeded({ x: rawWcs.x, y: rawWcs.y }),
          type: 'none',
          label: '',
        }
      }

      const visibleLayers = new Set(
        layersRef.current.filter(l => l.isOn && !l.isFrozen).map(l => l.name)
      )

      const SNAP_RADIUS_PX = 18
      let bestEndpoint: { point: Point2D; distPx: number } | null = null
      let bestMidpoint: { point: Point2D; distPx: number } | null = null

      for (const item of snapTargetsRef.current) {
        if (visibleLayers.size > 0 && !visibleLayers.has(item.layer)) continue
        const sp = view.worldToScreen(item.point)
        const distPx = Math.hypot(canvasPt.x - sp.x, canvasPt.y - sp.y)
        if (distPx > SNAP_RADIUS_PX) continue

        if (item.type === 'endpoint' || item.type === 'center') {
          if (!bestEndpoint || distPx < bestEndpoint.distPx) {
            bestEndpoint = { point: item.point, distPx }
          }
        } else if (item.type === 'midpoint') {
          if (!bestMidpoint || distPx < bestMidpoint.distPx) {
            bestMidpoint = { point: item.point, distPx }
          }
        }
      }

      if (bestEndpoint) {
        return {
          point: bestEndpoint.point,
          type: 'endpoint',
          label: `Vertex (${bestEndpoint.point.x.toFixed(1)}, ${bestEndpoint.point.y.toFixed(1)})`,
        }
      }

      try {
        const lastPt = pts.length > 0 ? pts[pts.length - 1] : rawWcs
        const osnap = view.osnapResolver.resolve({
          cursorWcs: rawWcs,
          lastPoint: { x: lastPt.x, y: lastPt.y, z: 0 },
          hitRadiusPx: SNAP_RADIUS_PX,
        })
        if (osnap) {
          const isEnd = osnap.type === AcDbOsnapMode.EndPoint
          const isMid = osnap.type === AcDbOsnapMode.MidPoint
          const isInt = osnap.type === AcDbOsnapMode.Intersection
          return {
            point: { x: osnap.x, y: osnap.y },
            type: isEnd
              ? 'endpoint'
              : isMid
                ? 'midpoint'
                : isInt
                  ? 'intersection'
                  : 'center',
            label: `${isEnd ? 'Endpoint' : isMid ? 'Midpoint' : isInt ? 'Intersection' : 'Center'} (${osnap.x.toFixed(1)}, ${osnap.y.toFixed(1)})`,
          }
        }
      } catch {
        // Bỏ qua nếu osnapResolver không tìm thấy
      }

      if (bestMidpoint) {
        return {
          point: bestMidpoint.point,
          type: 'midpoint',
          label: `Midpoint (${bestMidpoint.point.x.toFixed(1)}, ${bestMidpoint.point.y.toFixed(1)})`,
        }
      }

      return {
        point: applyOrthoIfNeeded({ x: rawWcs.x, y: rawWcs.y }),
        type: 'none',
        label: '',
      }
    },
    []
  )

  /**
   * Tìm đối tượng & Layer dưới con trỏ chuột khi ở chế độ 'layoff' hoặc 'info' (Tra cứu thực thể)
   */
  const findLayoffTarget = useCallback(
    (clientX: number, clientY: number): HoveredLayoffInfo | null => {
      const manager = docManagerRef.current
      if (!manager) return null

      const view = manager.curView
      const canvasPt = view.viewportToCanvas({ x: clientX, y: clientY })
      const wcs = view.screenToWorld(canvasPt)

      const visibleLayers = new Set(
        layersRef.current.filter(l => l.isOn && !l.isFrozen).map(l => l.name)
      )
      const allowHidden = showGhostHiddenRef.current

      // 1. Thử dùng view.pick() trực tiếp từ @mlightcad/cad-simple-viewer cho các đối tượng đang hiển thị
      try {
        const picked = view.pick(wcs, 14, true)
        if (picked && picked.length > 0) {
          const hitId = String(picked[0].id ?? '')
          const layerName = entityLayerByIdRef.current.get(hitId)
          const matchedShape = extractedEntitiesRef.current.find(e => e.id === hitId)
          if (layerName && visibleLayers.has(layerName)) {
            return {
              layer: layerName,
              isHiddenLayer: false,
              cursorScreen: canvasPt,
              entity: matchedShape,
            }
          }
        }
      } catch {
        // Fallback sang kiểm tra hình học bên dưới
      }

      // 2. Kiểm tra khoảng cách trên màn hình (<= 14px) tới các đoạn/cạnh của mọi đối tượng đã trích xuất
      const HIT_RADIUS_PX = 14
      const hitRadiusSq = HIT_RADIUS_PX * HIT_RADIUS_PX
      let bestLayer: string | null = null
      let bestIsHidden = false
      let bestDistSq = hitRadiusSq
      let bestEntity: ExtractedEntityShape | undefined

      for (const ent of extractedEntitiesRef.current) {
        const isLayerVisible = visibleLayers.has(ent.layer)
        if (!isLayerVisible && !allowHidden) continue
        if (ent.pts.length < 2) continue

        const segCount = ent.closed ? ent.pts.length : ent.pts.length - 1
        for (let i = 0; i < segCount; i++) {
          const spA = view.worldToScreen(ent.pts[i])
          const spB = view.worldToScreen(ent.pts[(i + 1) % ent.pts.length])
          const dSq = distToSegmentSquared(canvasPt, spA, spB)
          if (dSq <= bestDistSq) {
            bestDistSq = dSq
            bestLayer = ent.layer
            bestIsHidden = !isLayerVisible
            bestEntity = ent
          }
        }
      }

      if (bestLayer) {
        return {
          layer: bestLayer,
          isHiddenLayer: bestIsHidden,
          cursorScreen: canvasPt,
          entity: bestEntity,
        }
      }

      return null
    },
    []
  )

  /**
   * Đổi chế độ công cụ (Pan / Đa giác / Chọn vùng kín / Chữ nhật / Đo dài / Chọn ẩn-bật lớp / Tra cứu thực thể)
   */
  const selectMode = useCallback((nextMode: ToolMode) => {
    setMode(nextMode)
    setActivePoints([])
    setCurrentSnap(null)
    setHoveredBoundary(null)
    setHoveredLayoff(null)
    setHoveredEntity(null)
    if (nextMode !== 'info') {
      setInspectedEntity(null)
    }
    if (nextMode !== 'cal') {
      setCalLine(null)
    } else {
      setCalLine([])
    }

    const manager = docManagerRef.current
    if (manager) {
      const view = manager.curView
      view.entitySelectionEnabled = false
      try {
        view.mode = AcEdViewMode.SELECTION
      } catch {
        // Ignore if no activeLayoutView yet
      }

      // Cập nhật con trỏ chuột tương ứng với chế độ mới
      const newCursor = nextMode === 'pan' ? 'grab' : nextMode === 'info' ? 'pointer' : 'crosshair'
      if (view.canvas) {
        view.canvas.style.setProperty('cursor', newCursor, 'important')
      }
      if (viewerContainerRef.current) {
        viewerContainerRef.current.style.setProperty('cursor', newCursor, 'important')
      }
    }

    setStatusMessage(MODE_HINTS[nextMode])
  }, [])

  const finishCurrentPolygonRef = useRef(finishCurrentPolygon)
  finishCurrentPolygonRef.current = finishCurrentPolygon
  const handleUndoRef = useRef(handleUndo)
  handleUndoRef.current = handleUndo
  const handleRedoRef = useRef(handleRedo)
  handleRedoRef.current = handleRedo
  const renderOverlayRef = useRef(scheduleRenderOverlay)
  renderOverlayRef.current = scheduleRenderOverlay
  const resolveBestSnapPointRef = useRef(resolveBestSnapPoint)
  resolveBestSnapPointRef.current = resolveBestSnapPoint
  const findLayoffTargetRef = useRef(findLayoffTarget)
  findLayoffTargetRef.current = findLayoffTarget
  const syncDocumentMetadataRef = useRef(syncDocumentMetadata)
  syncDocumentMetadataRef.current = syncDocumentMetadata
  const loadSampleFileRef = useRef(loadSampleFile)
  loadSampleFileRef.current = loadSampleFile

  /**
   * Khởi tạo AcApDocManager của @mlightcad/cad-simple-viewer & gắn sự kiện chuột / bàn phím
   */
  useEffect(() => {
    const hostEl = viewerContainerRef.current
    if (!hostEl) return

    AcApSettingManager.configure({
      storageKey: 'mlightcad.react.area-viewer',
    })
    AcApSettingManager.instance.apply(
      {
        isShowCommandLine: false,
        isShowToolbar: false,
        isShowShortCutToolbar: false,
        isShowLanguageSelector: false,
        isShowCoordinate: false,
        isShowEntityInfo: false,
        isShowRibbon: false,
        osnapModes: acdbOsnapModesToMask([
          AcDbOsnapMode.EndPoint,
          AcDbOsnapMode.MidPoint,
          AcDbOsnapMode.Intersection,
          AcDbOsnapMode.Center,
        ]),
      },
      { persist: false }
    )

    ensureDwgConverterRegistered()

    let manager = AcApDocManager.tryGetInstance()
    if (!manager) {
      manager = AcApDocManager.createInstance({
        container: hostEl,
        autoResize: true,
        useMainThreadDraw: true,
        baseUrl: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/',
        preloadDefaultFonts: true,
        webworkerFileUrls: {
          dwgParser: `./workers/${LIBREDWG_PARSER_WORKER_FILE}`,
          mtextRender: `./workers/${MTEXT_RENDERER_WORKER_FILE}`,
        },
      })
    }

    if (!manager) return
    docManagerRef.current = manager

    // Cấu hình bảng ánh xạ Font CAD tiếng Việt (TCVN3, VNI, Unicode, SHX) & nạp font
    applyVietnameseFontConfiguration(manager)

    const view = manager.curView
    view.entitySelectionEnabled = false

    const handleViewChanged = () => renderOverlayRef.current()
    const handleViewResize = () => renderOverlayRef.current()

    view.events.viewChanged.addEventListener(handleViewChanged)
    view.events.viewResize.addEventListener(handleViewResize)

    const handleLayerStoreChanged = () => {
      if (docManagerRef.current) {
        setLayers(docManagerRef.current.curDocument.layerStore.getLayers())
        renderOverlayRef.current()
      }
    }
    manager.curDocument.layerStore.events.changed.addEventListener(handleLayerStoreChanged)

    // Lắng nghe sự kiện đổi tài liệu (Multi-Document Tabs)
    const handleDocumentActivated = () => {
      if (!docManagerRef.current) return
      const curDoc = docManagerRef.current.curDocument
      curDoc.layerStore.events.changed.addEventListener(handleLayerStoreChanged)
      applyVietnameseFontConfiguration(docManagerRef.current)
      syncDocumentMetadataRef.current(docManagerRef.current)
      setTimeout(() => renderOverlayRef.current(), 100)
    }
    manager.events.documentActivated.addEventListener(handleDocumentActivated)

    // Lắng nghe sự kiện đổi Sheet / Layout (Model, Layout1, Layout2, ...)
    const handleLayoutSwitched = (args: { layout: { blockTableRecordId: string; layoutName?: string } }) => {
      const m = docManagerRef.current
      if (!m) return
      const db = m.curDocument.database
      const targetBtrId = String(args?.layout?.blockTableRecordId || db.currentSpaceId || '')
      setLayouts(prev =>
        prev.map(l => ({
          ...l,
          isActive: l.btrId === targetBtrId,
        }))
      )
      const fileName = m.curDocument.docTitle?.split('/').pop() || 'drawing.dxf'
      const extracted = extractDatabaseGeometry(db, fileName, targetBtrId)
      snapTargetsRef.current = extracted.snapTargets
      closedBoundariesRef.current = extracted.closedBoundaries
      extractedEntitiesRef.current = extracted.entities
      entityLayerByIdRef.current = extracted.entityLayerById
      entityMapByIdRef.current = extracted.entityMapById
      drawingExtentsRef.current = extracted.extents
      setDrawingExtents(extracted.extents)
      setDocStats(extracted.stats)
      setActivePoints([])
      setCurrentSnap(null)
      setHoveredBoundary(null)
      setHoveredEntity(null)
      const fitLayoutToView = () => {
        const ext = drawingExtentsRef.current
        if (
          ext &&
          Number.isFinite(ext[0]) &&
          Number.isFinite(ext[1]) &&
          Number.isFinite(ext[2]) &&
          Number.isFinite(ext[3]) &&
          (ext[2] > ext[0] || ext[3] > ext[1])
        ) {
          try {
            const box = new AcGeBox2d(
              new AcGePoint2d(ext[0], ext[1]),
              new AcGePoint2d(ext[2], ext[3])
            )
            m.curView.zoomTo(box, 1.15)
          } catch {
            try {
              m.curView.zoomToFitDrawing(0)
            } catch {
              // ignore
            }
          }
        } else {
          try {
            m.curView.zoomToFitDrawing(0)
          } catch {
            // ignore
          }
        }
        renderOverlayRef.current()
      }

      setTimeout(fitLayoutToView, 100)
      setTimeout(fitLayoutToView, 300)
    }
    acdbHostApplicationServices().layoutManager.events.layoutSwitched.addEventListener(
      handleLayoutSwitched
    )

    const canvasEl = view.canvas
    let mouseDownPos: { x: number; y: number } | null = null
    let rightDownOrigin: { clientX: number; clientY: number } | null = null
    let rightLastPos: { clientX: number; clientY: number } | null = null
    let rightDownTime = 0
    let rightDragged = false

    let leftDownOrigin: { clientX: number; clientY: number } | null = null
    let leftLastPos: { clientX: number; clientY: number } | null = null
    let leftDownTime = 0
    let leftDragged = false

    // Thực hiện dịch chuyển khung nhìn (Pan) theo độ lệch pixel chuột
    const doPan = (clientX: number, clientY: number, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return
      const pOld = view.screenToWorld(view.viewportToCanvas({ x: clientX - dx, y: clientY - dy }))
      const pNew = view.screenToWorld(view.viewportToCanvas({ x: clientX, y: clientY }))
      const wDx = pNew.x - pOld.x
      const wDy = pNew.y - pOld.y

      if (wDx !== 0 || wDy !== 0) {
        const curCenter = view.center
        ;(view as unknown as { center: { x: number; y: number } }).center = {
          x: curCenter.x - wDx,
          y: curCenter.y - wDy,
        }

        const activeLayout = (view as unknown as { activeLayoutView?: { _cameraControls?: { update: () => void } } }).activeLayoutView
        if (activeLayout?._cameraControls) {
          activeLayout._cameraControls.update()
        }

        ;(view as unknown as { _isDirty: boolean })._isDirty = true
        view.events.viewChanged.dispatch()
      }
    }

    // Xóa điểm vừa bấm gần nhất (dùng cho chuột phải nhấp nhẹ, Backspace & nhấp trúng điểm vừa vẽ)
    const undoLastPoint = () => {
      const curMode = modeRef.current
      if (curMode === 'cal') {
        setCalLine(prev => (prev && prev.length > 0 ? prev.slice(0, -1) : prev))
        return
      }
      if (activePointsRef.current.length > 0) {
        setActivePoints(prev => prev.slice(0, -1))
        setStatusMessage(
          activePointsRef.current.length - 1 > 0
            ? `Đã xóa điểm gần nhất (còn ${activePointsRef.current.length - 1} điểm)`
            : 'Đã xóa hết điểm — bấm chuột trái để bắt đầu lại'
        )
      }
    }

    // Đồng bộ kiểu con trỏ chuột tức thì trên canvas, container và document.body
    const updateCursor = (panning: boolean) => {
      const curMode = modeRef.current
      const cursorVal = panning
        ? 'grabbing'
        : curMode === 'pan'
          ? 'grab'
          : curMode === 'info'
            ? 'pointer'
            : 'crosshair'

      if (canvasEl) {
        canvasEl.style.setProperty('cursor', cursorVal, 'important')
      }
      if (hostEl) {
        hostEl.style.setProperty('cursor', cursorVal, 'important')
      }
      if (panning) {
        document.body.style.setProperty('cursor', 'grabbing', 'important')
      } else {
        document.body.style.removeProperty('cursor')
      }
    }

    updateCursor(false)

    // Chặn triệt để menu chuột phải của trình duyệt trên Chrome & mọi trình duyệt
    const onContextMenuCapture = (e: MouseEvent) => {
      const inViewer =
        (hostEl && hostEl.contains(e.target as Node)) ||
        e.target === canvasEl ||
        e.target === overlayCanvasRef.current
      const justEndedRightPan = Date.now() - lastRightPanEndTimeRef.current < 500

      if (isRightPanningRef.current || justEndedRightPan || inViewer || rightDownOrigin !== null) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Kết thúc Pan chuột phải và khôi phục trạng thái chuẩn xác
    const endRightPan = () => {
      rightDownOrigin = null
      rightLastPos = null
      rightDragged = false
      if (isRightPanningRef.current) {
        isRightPanningRef.current = false
        setIsRightPanning(false)
      }
      lastRightPanEndTimeRef.current = Date.now()
      updateCursor(false)
      renderOverlayRef.current()
    }

    const onMouseMove = (e: MouseEvent) => {
      // 1. Nếu đang nhấn giữ chuột phải: xử lý Pan (di chuyển bản vẽ)
      if (rightDownOrigin && rightLastPos) {
        if (e.buttons === 0) {
          endRightPan()
          return
        }

        const distFromOrigin = Math.hypot(
          e.clientX - rightDownOrigin.clientX,
          e.clientY - rightDownOrigin.clientY
        )
        if (distFromOrigin > 4) {
          rightDragged = true
        }

        const dx = e.clientX - rightLastPos.clientX
        const dy = e.clientY - rightLastPos.clientY

        if (rightDragged && (dx !== 0 || dy !== 0)) {
          doPan(e.clientX, e.clientY, dx, dy)
        }
        rightLastPos = { clientX: e.clientX, clientY: e.clientY }
        return
      }

      // 2. Nếu đang nhấn giữ chuột trái: xử lý Pan ở mọi chế độ (cả khi đang đo)
      if (leftDownOrigin && leftLastPos && (e.buttons & 1)) {
        const distFromOrigin = Math.hypot(
          e.clientX - leftDownOrigin.clientX,
          e.clientY - leftDownOrigin.clientY
        )
        if (distFromOrigin > 5) {
          leftDragged = true
          updateCursor(true)
        }

        const dx = e.clientX - leftLastPos.clientX
        const dy = e.clientY - leftLastPos.clientY

        if (leftDragged && (dx !== 0 || dy !== 0)) {
          doPan(e.clientX, e.clientY, dx, dy)
        }
        leftLastPos = { clientX: e.clientX, clientY: e.clientY }
        if (leftDragged) {
          return // Đang giữ kéo Pan thì không tính snap/hover
        }
      }

      // 3. Di chuyển chuột thông thường
      const canvasPt = view.viewportToCanvas({ x: e.clientX, y: e.clientY })
      const wcs = view.screenToWorld(canvasPt)
      setCursorWcs({ x: wcs.x, y: wcs.y })

      const curMode = modeRef.current
      if (curMode === 'poly' || curMode === 'rect' || curMode === 'dist' || curMode === 'cal') {
        const snap = resolveBestSnapPointRef.current(e.clientX, e.clientY, e.shiftKey)
        setCurrentSnap(snap)
      } else if (curMode === 'area') {
        const visibleLayers = new Set(
          layersRef.current.filter(l => l.isOn && !l.isFrozen).map(l => l.name)
        )
        let found: ExtractedClosedBoundary | null = null
        let bestArea = Infinity
        for (const b of closedBoundariesRef.current) {
          if (visibleLayers.size > 0 && !visibleLayers.has(b.layer)) continue
          if (pip([wcs.x, wcs.y], b.points)) {
            const a = calculateShoelaceArea(b.points.map(([x, y]) => ({ x, y })))
            if (a > 0 && a < bestArea) {
              bestArea = a
              found = b
            }
          }
        }
        setHoveredBoundary(found)
      } else if (curMode === 'layoff') {
        const hit = findLayoffTargetRef.current(e.clientX, e.clientY)
        setHoveredLayoff(hit)
      } else if (curMode === 'info') {
        const hit = findLayoffTargetRef.current(e.clientX, e.clientY)
        setHoveredEntity(hit?.entity || null)
      }
    }

    const onMouseDown = (e: MouseEvent) => {
      // 1. Chuột phải: bấm giữ để Pan, nhấp để Undo
      if (e.button === 2) {
        e.preventDefault()
        e.stopPropagation()
        rightDownOrigin = { clientX: e.clientX, clientY: e.clientY }
        rightLastPos = { clientX: e.clientX, clientY: e.clientY }
        rightDownTime = Date.now()
        rightDragged = false
        isRightPanningRef.current = true
        setIsRightPanning(true)
        updateCursor(true)
        return
      }

      // 2. Chuột trái: bấm giữ để Pan, nhấp ngắn để Chấm điểm (hoặc Undo nếu bấm lại điểm vừa chấm)
      if (e.button === 0) {
        mouseDownPos = { x: e.clientX, y: e.clientY }
        leftDownOrigin = { clientX: e.clientX, clientY: e.clientY }
        leftLastPos = { clientX: e.clientX, clientY: e.clientY }
        leftDownTime = Date.now()
        leftDragged = false
        if (modeRef.current === 'pan') {
          updateCursor(true)
        }
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      // 1. Xử lý sự kiện chuột phải (Nhấp nhẹ = Undo lùi 1 điểm, Bấm giữ kéo = Pan)
      if (e.button === 2 || rightDownOrigin !== null) {
        if (e.button === 2) {
          e.preventDefault()
          e.stopPropagation()
        }

        const elapsed = Date.now() - rightDownTime
        const distFromOrigin = rightDownOrigin
          ? Math.hypot(e.clientX - rightDownOrigin.clientX, e.clientY - rightDownOrigin.clientY)
          : 0
        const wasShortClick = !rightDragged && distFromOrigin <= 6 && elapsed < 600

        endRightPan()

        if (wasShortClick) {
          undoLastPoint()
        }

        const curMode = modeRef.current
        if (curMode === 'poly' || curMode === 'rect' || curMode === 'dist' || curMode === 'cal') {
          const snap = resolveBestSnapPointRef.current(e.clientX, e.clientY, e.shiftKey)
          setCurrentSnap(snap)
        }
        return
      }

      // 2. Xử lý sự kiện chuột trái
      const wasLeftDragged = leftDragged
      leftDownOrigin = null
      leftLastPos = null
      leftDragged = false
      updateCursor(false)

      if (e.button !== 0 || !mouseDownPos) return
      const inViewer = hostEl && (hostEl.contains(e.target as Node) || e.target === canvasEl)
      const moveDist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y)
      mouseDownPos = null

      // Nếu vừa giữ chuột trái để Pan di chuyển bản vẽ: kết thúc Pan và không chấm điểm đo thừa
      if (wasLeftDragged || moveDist > 5) return
      if (!inViewer) return

      const curMode = modeRef.current

      // Nếu nhấp chuột trái trúng hoặc rất gần điểm đo vừa chấm gần nhất (< 15px): Hỗ trợ Undo lùi điểm
      if (curMode === 'poly' || curMode === 'rect' || curMode === 'dist') {
        const lastPt = activePointsRef.current[activePointsRef.current.length - 1]
        if (lastPt) {
          const lastScr = view.worldToScreen(lastPt)
          const distToLast = Math.hypot(e.clientX - lastScr.x, e.clientY - lastScr.y)
          if (distToLast < 15 && activePointsRef.current.length > 0) {
            undoLastPoint()
            return
          }
        }
      }

      if (curMode === 'info') {
        const hit = findLayoffTargetRef.current(e.clientX, e.clientY)
        if (hit?.entity) {
          const rawEnt = entityMapByIdRef.current.get(hit.entity.id)
          if (rawEnt) {
            const info = extractEntityInspectorDetails(
              rawEnt,
              effectiveToMetersRef.current,
              hit.entity
            )
            setInspectedEntity(info)
            setStatusMessage(
              `Tra cứu thực thể: ${info.dxfType} • Layer: ${info.layer} (ID: ${info.id})`
            )
          } else {
            const segs = calculatePolygonSegments(
              hit.entity.pts,
              effectiveToMetersRef.current,
              hit.entity.closed
            )
            const lenM = segs.reduce((s, seg) => s + seg.lengthMeters, 0)
            const areaM2 =
              hit.entity.closed && hit.entity.pts.length >= 3
                ? convertAreaToSquareMeters(
                    calculateShoelaceArea(hit.entity.pts),
                    effectiveToMetersRef.current
                  )
                : undefined
            setInspectedEntity({
              id: hit.entity.id,
              type: hit.entity.entityType || 'Entity',
              dxfType: (hit.entity.entityType || 'ENTITY').toUpperCase(),
              layer: hit.entity.layer,
              lineType: 'ByLayer',
              lineWeight: 'ByLayer',
              colorLabel: 'ByLayer',
              lengthMeters: lenM,
              areaSquareMeters: areaM2,
              extraProps: [],
            })
          }
        } else {
          setInspectedEntity(null)
        }
        return
      }

      if (curMode === 'layoff') {
        const hit = findLayoffTargetRef.current(e.clientX, e.clientY) || hoveredLayoffRef.current
        if (hit && docManagerRef.current) {
          const store = docManagerRef.current.curDocument.layerStore
          const nextOn = hit.isHiddenLayer
          store.setLayerOn(hit.layer, nextOn)
          setLayers(store.getLayers())
          setHoveredLayoff(null)
          showLayerToast(hit.layer, !nextOn)
          if (!nextOn) {
            setRecentHiddenLayers(prev => [
              hit.layer,
              ...prev.filter(x => x !== hit.layer),
            ])
            setStatusMessage(`Đã ẩn lớp (LAYOFF): ${hit.layer}`)
          } else {
            setStatusMessage(`Đã bật lại lớp (LAYON): ${hit.layer}`)
          }
          renderOverlayRef.current()
        }
        return
      }

      if (curMode === 'area') {
        const bound = hoveredBoundaryRef.current
        if (bound && bound.points.length >= 3) {
          const pts = bound.points.map(([x, y]) => ({ x, y }))
          finishCurrentPolygonRef.current(pts, bound.label || `Vùng ${bound.layer}`)
        }
        return
      }

      if (curMode === 'cal') {
        const snap = resolveBestSnapPointRef.current(e.clientX, e.clientY, e.shiftKey)
        setCalLine(prev => {
          const cur = prev ?? []
          if (cur.length >= 2) return [snap.point]
          return [...cur, snap.point]
        })
        return
      }

      if (curMode === 'poly' || curMode === 'rect' || curMode === 'dist') {
        const snap = resolveBestSnapPointRef.current(e.clientX, e.clientY, e.shiftKey)

        if (curMode === 'poly' && snap.type === 'first-point' && activePointsRef.current.length >= 3) {
          finishCurrentPolygonRef.current(activePointsRef.current)
          return
        }

        if (curMode === 'rect' && activePointsRef.current.length === 1) {
          const p1 = activePointsRef.current[0]
          const p2 = snap.point
          const rectPts: Point2D[] = [
            p1,
            { x: p2.x, y: p1.y },
            p2,
            { x: p1.x, y: p2.y },
          ]
          finishCurrentPolygonRef.current(rectPts, `Chữ nhật #${measuredPolygonsRef.current.length + 1}`)
          return
        }

        setActivePoints(prev => [...prev, snap.point])
      }
    }

    const onDoubleClick = (e: MouseEvent) => {
      const curMode = modeRef.current
      if (curMode !== 'poly' && curMode !== 'dist') return
      e.preventDefault()
      const minPts = curMode === 'dist' ? 2 : 3
      if (activePointsRef.current.length >= minPts) {
        finishCurrentPolygonRef.current(activePointsRef.current)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }
      if ((e.key === 'f' || e.key === 'F') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setShowFindPanel(v => !v)
        return
      }
      if (e.key === 'o' || e.key === 'O') {
        setOrtho(prev => !prev)
        return
      }
      const curMode = modeRef.current
      const minPts = curMode === 'dist' ? 2 : 3
      if (e.key === 'Enter' && activePointsRef.current.length >= minPts) {
        finishCurrentPolygonRef.current(activePointsRef.current)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        const hadPoints = activePointsRef.current.length > 0
        setActivePoints([])
        setCurrentSnap(null)
        setHighlightedFindBox(null)
        setCalLine(modeRef.current === 'cal' ? [] : null)
        if (hadPoints) setStatusMessage('Đã hủy vùng đang vẽ (Esc)')
      } else if ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleRedoRef.current()
      } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedoRef.current()
        } else {
          handleUndoRef.current()
        }
      } else if (e.key === 'Backspace') {
        if (activePointsRef.current.length > 0 || (calLineRef.current?.length ?? 0) > 0) {
          e.preventDefault()
          e.stopPropagation()
          undoLastPoint()
        }
      }
    }

    const onAuxClickCapture = (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    hostEl.addEventListener('mousedown', onMouseDown, true)
    canvasEl.addEventListener('mousedown', onMouseDown, true)
    hostEl.addEventListener('dblclick', onDoubleClick)
    canvasEl.addEventListener('dblclick', onDoubleClick)

    window.addEventListener('mousemove', onMouseMove, true)
    window.addEventListener('mouseup', onMouseUp, true)
    window.addEventListener('keydown', onKeyDown)

    hostEl.addEventListener('contextmenu', onContextMenuCapture, true)
    canvasEl.addEventListener('contextmenu', onContextMenuCapture, true)
    window.addEventListener('contextmenu', onContextMenuCapture, true)

    hostEl.addEventListener('auxclick', onAuxClickCapture, true)
    window.addEventListener('auxclick', onAuxClickCapture, true)

    // ==================== HỖ TRỢ VÀ TỐI ƯU CẢM ỨNG MOBILE (PAN, PINCH-ZOOM, TAP) ====================
    hostEl.style.touchAction = 'none'
    canvasEl.style.touchAction = 'none'

    let touchStartPoints: { clientX: number; clientY: number }[] = []
    let touchStartDist = 0
    let touchStartTime = 0
    let touchDragged = false
    let touchLastPos: { clientX: number; clientY: number } | null = null
    let lastTapTime = 0

    // Pipeline rAF tối ưu 60fps cho touch pan & pinch-zoom
    let pendingPanDx = 0
    let pendingPanDy = 0
    let pendingPanPos: { clientX: number; clientY: number } | null = null
    let pendingZoomDelta = 0
    let pendingZoomCenter: { x: number; y: number } | null = null
    let touchRafId: number | null = null

    const flushTouchUpdates = () => {
      touchRafId = null
      const curView = manager.curView
      if (!curView) return

      // Áp dụng phóng to / thu nhỏ qua pinch-to-zoom
      if (pendingZoomDelta !== 0 && pendingZoomCenter) {
        canvasEl.dispatchEvent(
          new WheelEvent('wheel', {
            clientX: pendingZoomCenter.x,
            clientY: pendingZoomCenter.y,
            deltaY: pendingZoomDelta,
            deltaMode: 0,
            bubbles: true,
            cancelable: true,
          })
        )
        pendingZoomDelta = 0
        pendingZoomCenter = null
      }

      // Áp dụng di chuyển bản vẽ (Pan)
      if ((pendingPanDx !== 0 || pendingPanDy !== 0) && pendingPanPos) {
        doPan(pendingPanPos.clientX, pendingPanPos.clientY, pendingPanDx, pendingPanDy)
        pendingPanDx = 0
        pendingPanDy = 0
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      const touches = Array.from(e.touches)
      touchStartTime = Date.now()
      touchDragged = false
      isTouchInteractingRef.current = true

      if (touchRafId !== null) {
        cancelAnimationFrame(touchRafId)
        flushTouchUpdates()
      }

      if (touches.length === 1) {
        const t = touches[0]
        touchStartPoints = [{ clientX: t.clientX, clientY: t.clientY }]
        touchLastPos = { clientX: t.clientX, clientY: t.clientY }
      } else if (touches.length >= 2) {
        const t1 = touches[0]
        const t2 = touches[1]
        touchStartPoints = [
          { clientX: t1.clientX, clientY: t1.clientY },
          { clientX: t2.clientX, clientY: t2.clientY },
        ]
        touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        touchLastPos = {
          clientX: (t1.clientX + t2.clientX) / 2,
          clientY: (t1.clientY + t2.clientY) / 2,
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchLastPos) {
        const t = e.touches[0]
        const dx = t.clientX - touchLastPos.clientX
        const dy = t.clientY - touchLastPos.clientY
        const distFromStart = touchStartPoints[0]
          ? Math.hypot(t.clientX - touchStartPoints[0].clientX, t.clientY - touchStartPoints[0].clientY)
          : 0

        if (distFromStart > 6) {
          touchDragged = true
        }

        if (touchDragged && (dx !== 0 || dy !== 0)) {
          e.preventDefault()
          pendingPanDx += dx
          pendingPanDy += dy
          pendingPanPos = { clientX: t.clientX, clientY: t.clientY }
          touchLastPos = { clientX: t.clientX, clientY: t.clientY }
          if (touchRafId === null) {
            touchRafId = requestAnimationFrame(flushTouchUpdates)
          }
        } else {
          touchLastPos = { clientX: t.clientX, clientY: t.clientY }
        }
      } else if (e.touches.length >= 2 && touchLastPos) {
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        const midX = (t1.clientX + t2.clientX) / 2
        const midY = (t1.clientY + t2.clientY) / 2

        touchDragged = true
        e.preventDefault()

        // 1. Pinch-to-zoom gom theo rAF mượt mà
        if (touchStartDist > 0 && Math.abs(newDist - touchStartDist) > 1.2) {
          pendingZoomDelta += (touchStartDist - newDist) * 2.6
          pendingZoomCenter = { x: midX, y: midY }
          touchStartDist = newDist
        }

        // 2. Pan 2 ngón tay đồng thời
        const dx = midX - touchLastPos.clientX
        const dy = midY - touchLastPos.clientY
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          pendingPanDx += dx
          pendingPanDy += dy
          pendingPanPos = { clientX: midX, clientY: midY }
        }
        touchLastPos = { clientX: midX, clientY: midY }

        if (touchRafId === null) {
          touchRafId = requestAnimationFrame(flushTouchUpdates)
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (touchRafId !== null) {
        cancelAnimationFrame(touchRafId)
        flushTouchUpdates()
      }

      if (e.touches.length === 0) {
        isTouchInteractingRef.current = false
        // Vẽ lại chi tiết hoàn chỉnh khi kết thúc cử chỉ chạm
        renderOverlayRef.current()
      }

      if (touchStartPoints.length === 1 && !touchDragged) {
        const t = touchStartPoints[0]
        const elapsed = Date.now() - touchStartTime

        // Double-tap để kết thúc vẽ đa giác
        const now = Date.now()
        if (now - lastTapTime < 340) {
          lastTapTime = 0
          const curMode = modeRef.current
          if (curMode === 'poly' || curMode === 'dist') {
            const minPts = curMode === 'dist' ? 2 : 3
            if (activePointsRef.current.length >= minPts) {
              e.preventDefault()
              finishCurrentPolygonRef.current(activePointsRef.current)
              return
            }
          }
        }
        lastTapTime = now

        // Chạm nhẹ (< 400ms): chọn điểm đo hoặc bắt thực thể
        if (elapsed < 400) {
          const inViewer = hostEl && (hostEl.contains(e.target as Node) || e.target === canvasEl)
          if (inViewer) {
            const curMode = modeRef.current
            const snap = resolveBestSnapPointRef.current(t.clientX, t.clientY, false)
            setCurrentSnap(snap)

            if (curMode === 'poly' || curMode === 'rect' || curMode === 'dist') {
              const lastPt = activePointsRef.current[activePointsRef.current.length - 1]
              if (lastPt) {
                const lastScr = view.worldToScreen(lastPt)
                const distToLast = Math.hypot(t.clientX - lastScr.x, t.clientY - lastScr.y)
                if (distToLast < 20 && activePointsRef.current.length > 0) {
                  undoLastPoint()
                  return
                }
              }

              if (curMode === 'rect') {
                if (activePointsRef.current.length === 0) {
                  setActivePoints([snap.point])
                  return
                }
                const p1 = activePointsRef.current[0]
                const p2 = snap.point
                const rectPts: Point2D[] = [
                  p1,
                  { x: p2.x, y: p1.y },
                  p2,
                  { x: p1.x, y: p2.y },
                ]
                finishCurrentPolygonRef.current(
                  rectPts,
                  `Chữ nhật #${measuredPolygonsRef.current.length + 1}`
                )
                return
              }

              setActivePoints(prev => [...prev, snap.point])
            } else if (curMode === 'area') {
              const canvasPt = view.viewportToCanvas({ x: t.clientX, y: t.clientY })
              const wcs = view.screenToWorld(canvasPt)
              const visibleLayers = new Set(
                layersRef.current.filter(l => l.isOn && !l.isFrozen).map(l => l.name)
              )
              let found: ExtractedClosedBoundary | null = null
              let bestArea = Infinity
              for (const b of closedBoundariesRef.current) {
                if (visibleLayers.size > 0 && !visibleLayers.has(b.layer)) continue
                if (pip([wcs.x, wcs.y], b.points)) {
                  const a = calculateShoelaceArea(b.points.map(([x, y]) => ({ x, y })))
                  if (a > 0 && a < bestArea) {
                    bestArea = a
                    found = b
                  }
                }
              }
              if (found) {
                const pts = found.points.map(([x, y]) => ({ x, y }))
                const label = found.layer
                  ? `Vùng (${found.layer})`
                  : `Vùng #${measuredPolygonsRef.current.length + 1}`
                finishCurrentPolygonRef.current(pts, label)
              }
            } else if (curMode === 'layoff') {
              const hit = findLayoffTargetRef.current(t.clientX, t.clientY) || hoveredLayoffRef.current
              if (hit && docManagerRef.current) {
                const store = docManagerRef.current.curDocument.layerStore
                const nextOn = hit.isHiddenLayer
                store.setLayerOn(hit.layer, nextOn)
                setLayers(store.getLayers())
                setHoveredLayoff(null)
                showLayerToast(hit.layer, !nextOn)
                if (!nextOn) {
                  setRecentHiddenLayers(prev => [
                    hit.layer,
                    ...prev.filter(x => x !== hit.layer),
                  ])
                  setStatusMessage(`Đã ẩn lớp (LAYOFF): ${hit.layer}`)
                } else {
                  setStatusMessage(`Đã bật lại lớp (LAYON): ${hit.layer}`)
                }
                renderOverlayRef.current()
              }
            }
          }
        }
      }

      if (e.touches.length === 0) {
        touchStartPoints = []
        touchLastPos = null
        touchDragged = false
      }
    }

    hostEl.addEventListener('touchstart', onTouchStart, { passive: false })
    hostEl.addEventListener('touchmove', onTouchMove, { passive: false })
    hostEl.addEventListener('touchend', onTouchEnd, { passive: false })
    hostEl.addEventListener('touchcancel', onTouchEnd, { passive: false })

    loadSampleFileRef.current(SAMPLE_FILES[0])

    return () => {
      view.events.viewChanged.removeEventListener(handleViewChanged)
      view.events.viewResize.removeEventListener(handleViewResize)
      manager.curDocument.layerStore.events.changed.removeEventListener(handleLayerStoreChanged)
      manager.events.documentActivated.removeEventListener(handleDocumentActivated)
      acdbHostApplicationServices().layoutManager.events.layoutSwitched.removeEventListener(
        handleLayoutSwitched
      )

      hostEl.removeEventListener('mousedown', onMouseDown, true)
      canvasEl.removeEventListener('mousedown', onMouseDown, true)
      hostEl.removeEventListener('dblclick', onDoubleClick)
      canvasEl.removeEventListener('dblclick', onDoubleClick)

      window.removeEventListener('mousemove', onMouseMove, true)
      window.removeEventListener('mouseup', onMouseUp, true)
      window.removeEventListener('keydown', onKeyDown)

      hostEl.removeEventListener('contextmenu', onContextMenuCapture, true)
      canvasEl.removeEventListener('contextmenu', onContextMenuCapture, true)
      window.removeEventListener('contextmenu', onContextMenuCapture, true)

      hostEl.removeEventListener('auxclick', onAuxClickCapture, true)
      window.removeEventListener('auxclick', onAuxClickCapture, true)

      hostEl.removeEventListener('touchstart', onTouchStart)
      hostEl.removeEventListener('touchmove', onTouchMove)
      hostEl.removeEventListener('touchend', onTouchEnd)
      hostEl.removeEventListener('touchcancel', onTouchEnd)

      if (touchRafId !== null) {
        cancelAnimationFrame(touchRafId)
        touchRafId = null
      }

      document.body.style.removeProperty('cursor')
    }
  }, [])

  /**
   * Xử lý tải lên một hoặc nhiều file .dxf / .dwg từ máy tính
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      await loadCadBuffer(file.name, buffer)
    }
    e.target.value = ''
  }

  /**
   * Kéo thả trực tiếp file .dwg / .dxf vào khung bản vẽ
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || []).filter(f =>
      /\.(dwg|dxf)$/i.test(f.name)
    )
    if (!files.length) {
      setStatusMessage('Vui lòng kéo thả tệp định dạng .DWG hoặc .DXF!')
      return
    }
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      await loadCadBuffer(file.name, buffer)
    }
  }

  /**
   * Chuyển đổi giữa các Sheet / Layout Tabs (Model, Layout1, Layout2, ...)
   */
  const handleSwitchLayout = useCallback(
    (layout: CadLayoutTab) => {
      const manager = docManagerRef.current
      if (!manager) return
      const db = manager.curDocument.database
      try {
        const switchedByBtr = acdbHostApplicationServices().layoutManager.setCurrentLayoutBtrId(
          layout.btrId,
          db
        )
        if (!switchedByBtr) {
          acdbHostApplicationServices().layoutManager.setCurrentLayout(layout.name, db)
        }
        setLayouts(prev =>
          prev.map(item => ({
            ...item,
            isActive: item.btrId === layout.btrId,
          }))
        )
        setStatusMessage(
          `Đã chuyển sang Sheet / Layout: ${layout.name} (${layout.entityCount} đối tượng)`
        )
      } catch (err) {
        console.error('Lỗi chuyển Sheet/Layout:', err)
      }
    },
    []
  )

  /**
   * Chuyển đổi và đóng tài liệu trên thanh Multi-Document Tabs (MDI)
   */
  const handleSwitchDocument = (tab: OpenDocTabInfo) => {
    const manager = docManagerRef.current
    if (!manager) return
    manager.activateDocument(tab.doc)
    syncDocumentMetadata(manager, undefined, tab.fileName)
    setStatusMessage(`Đang xem bản vẽ: ${tab.fileName}`)
  }

  const handleCloseDocument = (tab: OpenDocTabInfo, e: React.MouseEvent) => {
    e.stopPropagation()
    const manager = docManagerRef.current
    if (!manager || openDocs.length <= 1) return
    manager.closeDocument(tab.doc)
    syncDocumentMetadata(manager)
  }

  /**
   * Quản lý bản vẽ chồng lớp tham chiếu (Overlay / XREF DWG/DXF)
   */
  const handleOverlayUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const manager = docManagerRef.current
    if (!file || !manager) return
    setIsLoading(true)
    setStatusMessage(`Đang chồng lớp bản vẽ tham chiếu (XREF): ${file.name}...`)
    try {
      const buffer = await file.arrayBuffer()
      const overlayId = await manager.loadOverlay(file.name, buffer)
      if (overlayId) {
        setOverlays(prev => [
          ...prev,
          { id: String(overlayId), fileName: file.name, visible: true },
        ])
        setStatusMessage(`Đã chồng lớp (XREF): ${file.name}`)
      }
    } catch (err) {
      console.error('Lỗi tải Overlay:', err)
      setStatusMessage(`Không thể tải bản vẽ tham chiếu ${file.name}.`)
    } finally {
      setIsLoading(false)
      e.target.value = ''
    }
  }

  const handleToggleOverlay = (id: string, visible: boolean) => {
    const manager = docManagerRef.current
    if (!manager) return
    manager.setOverlayVisible(id, visible)
    setOverlays(prev => prev.map(o => (o.id === id ? { ...o, visible } : o)))
    renderOverlay()
  }

  const handleRemoveOverlay = (id: string) => {
    const manager = docManagerRef.current
    if (!manager) return
    manager.removeOverlay(id)
    setOverlays(prev => prev.filter(o => o.id !== id))
    renderOverlay()
  }

  /**
   * Quản lý & nạp thêm file Font CAD (.shx, .ttf, .woff, .woff2, .otf)
   */
  const handleCustomFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsFontLoading(true)
    const uploadedNames: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const success = await cacheCustomFontFile(file)
        if (success) {
          uploadedNames.push(file.name)
        }
      }

      if (uploadedNames.length > 0) {
        const updatedList = Array.from(new Set([...cachedFontList, ...uploadedNames]))
        setCachedFontList(updatedList)
        try {
          localStorage.setItem('mlightcad.cached_fonts', JSON.stringify(updatedList))
        } catch {
          // ignore
        }
        setFontToast(`Đã nạp thành công ${uploadedNames.length} font CAD vào bộ nhớ đệm!`)
        setTimeout(() => setFontToast(null), 4000)

        // Tự động làm mới hiển thị font trên bản vẽ đang mở
        if (docManagerRef.current) {
          const db = docManagerRef.current.curDocument?.database
          if (db) {
            normalizeVietnameseDatabaseText(db)
          }
          applyVietnameseFontConfiguration(docManagerRef.current)
          docManagerRef.current.regen()
          renderOverlayRef.current()
        }
      }
    } catch (err) {
      console.error('Lỗi khi nạp font CAD:', err)
      setFontToast('Có lỗi xảy ra khi nạp font CAD.')
      setTimeout(() => setFontToast(null), 4000)
    } finally {
      setIsFontLoading(false)
      if (fontInputRef.current) {
        fontInputRef.current.value = ''
      }
    }
  }

  const handleRegenFonts = () => {
    if (docManagerRef.current) {
      const db = docManagerRef.current.curDocument?.database
      if (db) {
        normalizeVietnameseDatabaseText(db)
      }
      applyVietnameseFontConfiguration(docManagerRef.current)
      docManagerRef.current.regen()
      renderOverlayRef.current()
      setFontToast('Đã làm mới và áp dụng font tiếng Việt cho bản vẽ!')
      setTimeout(() => setFontToast(null), 3000)
    }
  }

  const handleClearCachedFonts = () => {
    setCachedFontList([])
    try {
      localStorage.removeItem('mlightcad.cached_fonts')
    } catch {
      // ignore
    }
    setFontToast('Đã xóa danh sách font đã nạp.')
    setTimeout(() => setFontToast(null), 3000)
  }

  const handleAutoDownloadMissingFonts = async () => {
    if (!docManagerRef.current) return
    setIsFontLoading(true)
    setFontToast('Đang quét và tự động tải các font CAD bị thiếu...')
    try {
      const res = await autoResolveAllMissingFonts(docManagerRef.current, msg => setFontToast(msg))
      if (res.resolved.length > 0) {
        setFontToast(`Đã tự động tải và kích hoạt ${res.resolved.length} font CAD: ${res.resolved.join(', ')}`)
      } else {
        setFontToast('Bản vẽ đã có đủ font hoặc đã được nạp sẵn!')
      }
      setTimeout(() => setFontToast(null), 4000)
    } catch (err) {
      console.error(err)
      setFontToast('Có lỗi xảy ra khi tự động tải font.')
      setTimeout(() => setFontToast(null), 4000)
    } finally {
      setIsFontLoading(false)
    }
  }

  const handlePreloadAllEssentialFonts = async () => {
    setIsFontLoading(true)
    setFontToast('Đang tải trước trọn bộ 13 font CAD thiết yếu...')
    try {
      const loaded = await preloadEssentialCadFonts((cur, total, name) => {
        setFontToast(`Đang nạp font: ${name} (${cur}/${total})...`)
      })
      if (docManagerRef.current) {
        docManagerRef.current.regen()
        renderOverlayRef.current()
      }
      setFontToast(`Đã nạp sẵn sàng ${loaded.length} font CAD & Tiếng Việt vào bộ nhớ!`)
      setTimeout(() => setFontToast(null), 4000)
    } catch (err) {
      console.error(err)
      setFontToast('Có lỗi xảy ra khi tải gói font.')
      setTimeout(() => setFontToast(null), 4000)
    } finally {
      setIsFontLoading(false)
    }
  }

  /**
   * Điều khiển hiển thị chuyên sâu DWG / DXF & Xuất bản vẽ
   */
  const handleToggleLineWeight = (enabled: boolean) => {
    setLineWeightDisplay(enabled)
    const manager = docManagerRef.current
    if (!manager) return
    try {
      AcDbSysVarManager.instance().setVar('LWDISPLAY', enabled, manager.curDocument.database)
    } catch {
      // ignore
    }
    try {
      const renderer = (manager.curView as unknown as { renderer?: { showLineWeight?: boolean } }).renderer
      if (renderer) renderer.showLineWeight = enabled
      ;(manager.curView as unknown as { _isDirty: boolean })._isDirty = true
    } catch {
      // ignore
    }
    setStatusMessage(enabled ? 'Đã BẬT hiển thị độ dày nét vẽ (Lineweight)' : 'Đã TẮT độ dày nét vẽ')
  }

  const handleToggleReadingMode = (enabled: boolean) => {
    setReadingMode(enabled)
    const manager = docManagerRef.current
    if (!manager) return
    try {
      manager.setReadingMode(enabled)
    } catch {
      // ignore
    }
    setStatusMessage(
      enabled ? 'Đã BẬT Chế độ đọc (Nét đen trên nền trắng)' : 'Đã TẮT Chế độ đọc'
    )
  }

  const handleSwitchCadBackground = () => {
    const manager = docManagerRef.current
    if (!manager) return
    try {
      manager.sendStringToExecute('switchbg')
    } catch {
      // ignore
    }
  }

  const handleChangeEncoding = async (enc: string) => {
    setDxfEncoding(enc)
    dxfEncodingRef.current = enc
    if (lastLoadedBufferRef.current) {
      await loadCadBuffer(
        lastLoadedBufferRef.current.fileName,
        lastLoadedBufferRef.current.buffer,
        enc
      )
    }
  }

  const handleToggleNoPlotLayers = async (enabled: boolean) => {
    setDrawNoPlotLayers(enabled)
    drawNoPlotLayersRef.current = enabled
    if (lastLoadedBufferRef.current) {
      await loadCadBuffer(
        lastLoadedBufferRef.current.fileName,
        lastLoadedBufferRef.current.buffer
      )
    }
  }

  const handleExportCommand = (cmd: 'cdxf' | 'pngout' | 'jpgout' | 'csvg' | 'chtml') => {
    const manager = docManagerRef.current
    if (!manager) return
    try {
      manager.sendStringToExecute(cmd)
      setShowDisplayMenu(false)
      setStatusMessage(`Đã thực thi lệnh xuất bản vẽ: ${cmd.toUpperCase()}`)
    } catch (err) {
      console.error('Lỗi thực thi lệnh xuất CAD:', err)
    }
  }

  /**
   * Tìm kiếm chữ (TEXT, MTEXT, ATTRIB trong Block, DIMENSION, TABLE) trên toàn bộ các Sheet / Layout
   */
  const handleRunFindText = useCallback(() => {
    const manager = docManagerRef.current
    if (!manager) return
    const q = findQuery.trim()
    if (!q) {
      setFindHits([])
      setActiveFindIdx(-1)
      setHighlightedFindBox(null)
      return
    }
    try {
      const db = manager.curDocument.database
      const results = acapFindText(db, q, {
        matchCase: findCaseSensitive,
        maxResults: 300,
        scope: 'drawing',
        currentLayoutId: String(db.currentSpaceId || ''),
      })
      const flatHits = results.hits
      setFindHits(flatHits)
      if (flatHits.length > 0) {
        setActiveFindIdx(0)
        setStatusMessage(
          `Tìm thấy ${flatHits.length}${results.truncated ? '+' : ''} văn bản khớp "${q}"`
        )
      } else {
        setActiveFindIdx(-1)
        setHighlightedFindBox(null)
        setStatusMessage(`Không tìm thấy văn bản "${q}" trong bản vẽ`)
      }
    } catch (err) {
      console.error('Lỗi tìm kiếm văn bản CAD:', err)
    }
  }, [findQuery, findCaseSensitive])

  const handleJumpToFindHit = useCallback(async (hit: AcApFindLayoutHit, idx: number) => {
    const manager = docManagerRef.current
    if (!manager) return
    setActiveFindIdx(idx)
    const db = manager.curDocument.database
    try {
      const box = acapFindHitBox(db, hit.layoutId, hit)
      await acapNavigateToFindHit(manager, hit, { activateLayout: true, margin: 2.2 })
      if (box) {
        setHighlightedFindBox({
          min: { x: box.min.x, y: box.min.y },
          max: { x: box.max.x, y: box.max.y },
        })
      }
      setTimeout(() => renderOverlay(), 120)
    } catch (err) {
      console.error('Lỗi định vị kết quả tìm kiếm:', err)
    }
  }, [renderOverlay])

  /**
   * Bật / Tắt hiển thị một Layer trong @mlightcad/cad-simple-viewer
   */
  const handleToggleLayer = (layerName: string, currentOn: boolean) => {
    const manager = docManagerRef.current
    if (!manager) return
    const store = manager.curDocument.layerStore
    store.setLayerOn(layerName, !currentOn)
    setLayers(store.getLayers())
    renderOverlay()
  }

  const handleSetAllLayersOn = () => {
    const manager = docManagerRef.current
    if (!manager) return
    const store = manager.curDocument.layerStore
    store.setAllLayersOn()
    setLayers(store.getLayers())
    renderOverlay()
  }

  const handleSetAllLayersOff = () => {
    const manager = docManagerRef.current
    if (!manager) return
    const store = manager.curDocument.layerStore
    layers.forEach(l => store.setLayerOn(l.name, false))
    setLayers(store.getLayers())
    renderOverlay()
  }

  const handleZoomToFit = () => {
    const manager = docManagerRef.current
    if (!manager) return
    const view = manager.curView
    const ext = drawingExtentsRef.current
    if (
      ext &&
      Number.isFinite(ext[0]) &&
      Number.isFinite(ext[1]) &&
      Number.isFinite(ext[2]) &&
      Number.isFinite(ext[3]) &&
      (ext[2] > ext[0] || ext[3] > ext[1])
    ) {
      try {
        const box = new AcGeBox2d(
          new AcGePoint2d(ext[0], ext[1]),
          new AcGePoint2d(ext[2], ext[3])
        )
        view.zoomTo(box, 1.15)
      } catch {
        try {
          view.zoomToFitDrawing(0)
        } catch {
          // ignore
        }
      }
    } else {
      try {
        view.zoomToFitDrawing(0)
      } catch {
        // ignore
      }
    }
    setTimeout(() => renderOverlay(), 100)
  }

  const handleZoomBy = (factor: number) => {
    const manager = docManagerRef.current
    if (!manager) return
    const view = manager.curView
    const rect = view.canvas.getBoundingClientRect()
    const wheelEvt = new WheelEvent('wheel', {
      deltaY: factor > 1 ? -120 : 120,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
    })
    view.canvas.dispatchEvent(wheelEvt)
    setTimeout(() => renderOverlay(), 60)
  }

  // Kéo giãn thanh Sidebar bên phải
  const handleSidebarResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX
      setSidebarWidth(Math.max(320, Math.min(720, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Xử lý cấu hình Lưới gạch
  const handlePresetChange = (val: string) => {
    setTilePreset(val)
    const [w, h] = val.split('x').map(Number)
    if (w && h) {
      const presetObj = TILE_PRESETS.find(p => p.value === val)
      setTileConfig(prev => ({
        ...prev,
        w,
        h,
        pattern:
          presetObj?.isWood && (!prev.pattern || prev.pattern === 'grid')
            ? 'third'
            : prev.pattern,
      }))
    }
  }

  const handleRotateTile = () => {
    setTileConfig(prev => ({ ...prev, w: prev.h, h: prev.w }))
  }

  const handleAutoOptimizeTiles = () => {
    if (!measuredPolygons.length) return
    const takeoffRows = measuredPolygons
      .filter(p => p.visible)
      .map((p, idx) => toTakeoffRow(p, idx))
    const best = optimizeTileGridOrigin(takeoffRows, tileConfig, effectiveToMeters)
    setTileConfig(prev => ({
      ...prev,
      w: best.w,
      h: best.h,
      offsetX: best.offsetX,
      offsetY: best.offsetY,
    }))
    setOptimizeStatus(
      best.savedCut > 0
        ? `Đã giảm ${best.savedCut} viên cắt (Gốc ${best.offsetX}%/${best.offsetY}%)`
        : `Đã ở vị trí gốc lưới tối ưu (Gốc ${best.offsetX}%/${best.offsetY}%)`
    )
    setTimeout(() => setOptimizeStatus(''), 4000)
  }

  // Tính toán tổng hợp KPI
  const liveActiveAreaM2 = useMemo(() => {
    const pts = currentSnap ? [...activePoints, currentSnap.point] : activePoints
    const raw = calculateShoelaceArea(pts)
    return convertAreaToSquareMeters(raw, effectiveToMeters)
  }, [activePoints, currentSnap, effectiveToMeters])

  const liveActiveLengthM = useMemo(() => {
    const pts = currentSnap ? [...activePoints, currentSnap.point] : activePoints
    if (pts.length < 2) return 0
    let sum = 0
    for (let i = 0; i < pts.length - 1; i++) {
      sum += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    }
    return sum * effectiveToMeters
  }, [activePoints, currentSnap, effectiveToMeters])

  const filteredPolygons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return measuredPolygons.filter(p => {
      if (listFilter === 'floor' && p.kind === 'dist') return false
      if (listFilter === 'dist' && p.kind !== 'dist') return false
      return !q || p.name.toLowerCase().includes(q)
    })
  }, [measuredPolygons, searchQuery, listFilter])

  // Định vị tâm vùng: đưa tâm màn hình về trọng tâm đa giác (tự động chuyển Sheet nếu vùng nằm ở Sheet khác)
  const handleLocatePolygon = (poly: MeasuredPolygon) => {
    const manager = docManagerRef.current
    if (!manager) return
    const db = manager.curDocument?.database
    const curSpaceId = String(db?.currentSpaceId || '')

    const centerAndZoom = () => {
      const view = manager.curView
      if (!view) return
      const c = calculatePolygonCentroid(poly.points)
      ;(view as unknown as { center: { x: number; y: number } }).center = { x: c.x, y: c.y }
      const layout = (view as unknown as { activeLayoutView?: { _cameraControls?: { update: () => void } } }).activeLayoutView
      layout?._cameraControls?.update()
      ;(view as unknown as { _isDirty: boolean })._isDirty = true
      view.events.viewChanged.dispatch()
      setSelectedPolygonId(poly.id)
    }

    if (poly.layoutBtrId && curSpaceId && poly.layoutBtrId !== curSpaceId && db) {
      const targetLayout = layoutsRef.current.find(l => l.btrId === poly.layoutBtrId)
      if (targetLayout) {
        handleSwitchLayout(targetLayout)
        setTimeout(centerAndZoom, 160)
        return
      }
    }

    centerAndZoom()
  }

  const totalArea = useMemo(
    () =>
      measuredPolygons
        .filter(p => p.visible && p.kind !== 'dist')
        .reduce((sum, p) => sum + p.areaSquareMeters, 0),
    [measuredPolygons]
  )

  const totalPerimeter = useMemo(
    () =>
      measuredPolygons
        .filter(p => p.visible)
        .reduce((sum, p) => sum + p.perimeterMeters, 0),
    [measuredPolygons]
  )

  const totalWallArea = useMemo(
    () =>
      measuredPolygons
        .filter(p => p.visible && (p.heightMeters ?? 0) > 0)
        .reduce((sum, p) => sum + p.perimeterMeters * (p.heightMeters ?? 0), 0),
    [measuredPolygons]
  )

  const tileSummary = useMemo(() => {
    if (!tileConfig.on) {
      return { full: 0, cut: 0, total: 0, toBuy: 0, boxes: 0 }
    }
    let full = 0
    let cut = 0
    measuredPolygons.forEach((poly, idx) => {
      if (!poly.visible) return
      const res = tileCalc(toTakeoffRow(poly, idx), tileConfig, effectiveToMeters)
      if (res && !res.big) {
        full += res.full
        cut += res.cut
      }
    })
    const total = full + cut
    const toBuy = Math.ceil(total * (1 + (tileConfig.waste || 0) / 100))
    const boxes = tileConfig.box > 0 ? Math.ceil(toBuy / tileConfig.box) : 0
    return { full, cut, total, toBuy, boxes }
  }, [measuredPolygons, tileConfig, effectiveToMeters, toTakeoffRow])

  const filteredLayers = useMemo(() => {
    if (!layerSearch.trim()) return layers
    const q = layerSearch.toLowerCase()
    return layers.filter(l => l.name.toLowerCase().includes(q))
  }, [layers, layerSearch])

  const visibleLayerCount = useMemo(
    () => layers.filter(l => l.isOn).length,
    [layers]
  )

  const drawingExtentsText = useMemo(() => {
    if (!drawingExtents) return ''
    const [minX, minY, maxX, maxY] = drawingExtents
    const wM = (maxX - minX) * effectiveToMeters
    const hM = (maxY - minY) * effectiveToMeters
    if (!Number.isFinite(wM) || !Number.isFinite(hM) || wM <= 0 || hM <= 0) return ''
    return `${fmtNum(wM)} × ${fmtNum(hM)} m`
  }, [drawingExtents, effectiveToMeters])

  // Sao chép bảng sang Excel (TSV) và Xuất CSV
  const handleCopyExcel = async () => {
    if (!measuredPolygons.length) return
    const headers = [
      'STT',
      'Hạng mục / Vùng',
      'Loại',
      'Số đoạn',
      'Diện tích Sàn (m²)',
      'Diện tích Tường (m²)',
      'Chu vi / Dài (m)',
      'Cao độ H (m)',
      'Chi tiết các đoạn (m)',
    ]
    const lines = [headers.join('\t')]
    measuredPolygons.forEach((p, i) => {
      const segsText = p.segments.map(s => `P${s.index}:${s.lengthMeters.toFixed(2)}m`).join(' | ')
      const h = p.heightMeters ?? 0
      const wallArea = h > 0 ? p.perimeterMeters * h : 0
      lines.push(
        [
          i + 1,
          p.name,
          p.kind === 'dist' ? 'Đoạn thẳng' : 'Vùng sàn',
          p.segments.length,
          p.kind === 'dist' ? '' : p.areaSquareMeters.toFixed(3),
          wallArea > 0 ? wallArea.toFixed(3) : '',
          p.perimeterMeters.toFixed(2),
          h > 0 ? h.toFixed(2) : '',
          segsText,
        ].join('\t')
      )
    })
    lines.push([
      '',
      'TỔNG CỘNG',
      '',
      '',
      totalArea.toFixed(3),
      totalWallArea.toFixed(3),
      totalPerimeter.toFixed(2),
      '',
      '',
    ].join('\t'))
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopyStatus('Đã chép!')
    setTimeout(() => setCopyStatus('Sao chép Excel'), 2000)
  }

  const handleDownloadCsv = () => {
    if (!measuredPolygons.length) return
    const headers = [
      'STT',
      'Hạng mục / Vùng',
      'Loại',
      'Số đoạn',
      'Diện tích Sàn (m2)',
      'Diện tích Tường (m2)',
      'Chu vi / Dài (m)',
      'Cao độ H (m)',
      'Chi tiết đoạn',
    ]
    const rowsCsv = [headers.join(',')]
    measuredPolygons.forEach((p, i) => {
      const segsText = p.segments.map(s => `P${s.index}:${s.lengthMeters.toFixed(2)}m`).join(' | ')
      const h = p.heightMeters ?? 0
      const wallArea = h > 0 ? p.perimeterMeters * h : 0
      rowsCsv.push(
        [
          i + 1,
          `"${p.name.replace(/"/g, '""')}"`,
          p.kind === 'dist' ? 'Đoạn thẳng' : 'Vùng sàn',
          p.segments.length,
          p.kind === 'dist' ? '' : p.areaSquareMeters.toFixed(3),
          wallArea > 0 ? wallArea.toFixed(3) : '',
          p.perimeterMeters.toFixed(2),
          h > 0 ? h.toFixed(2) : '',
          `"${segsText}"`,
        ].join(',')
      )
    })
    rowsCsv.push([
      '',
      '"TỔNG CỘNG"',
      '',
      '',
      totalArea.toFixed(3),
      totalWallArea.toFixed(3),
      totalPerimeter.toFixed(2),
      '',
      '',
    ].join(','))
    const blob = new Blob(['\uFEFF' + rowsCsv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `boc-tach-khoi-luong-${currentFileName.replace(/\.[^.]+$/, '')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isCurrentDwg = /\.dwg$/i.test(currentFileName)
  const activeLayout = useMemo(
    () => layouts.find(l => l.isActive) || layouts[0] || null,
    [layouts]
  )

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col select-none text-slate-900 dark:text-slate-100"
      style={{ background: 'var(--bg)' }}
    >
      {/* ==================== TOP HEADER BAR (FULL DWG & DXF) ==================== */}
      <header className="h-13 px-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 z-40 relative shadow-2xs">
        {/* Zone 1: Brand & Tên bản vẽ hiện tại */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-xs text-white">
              <Compass className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                BOC CAD
              </h1>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold tracking-wider ${
                  isCurrentDwg
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {isCurrentDwg ? 'DWG' : 'DXF'}
              </span>
              <button
                type="button"
                onClick={() => setShowChangelogModal(true)}
                title={`Phiên bản hiện tại: v${APP_VERSION} (${APP_BUILD_DATE}) • Bấm xem lịch sử cập nhật`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700 hover:border-teal-400/80 transition cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>v{APP_VERSION}</span>
              </button>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <div
              title={currentFileName}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-[260px] shadow-2xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{currentFileName}</span>
            </div>
            {docStats && (
              <div
                title={`Phiên bản: ${docStats.acadVer} • ${docStats.totalEntities} thực thể • ${docStats.blockCount} Blocks • ${layouts.length} Sheets/Layouts`}
                className="hidden xl:inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-700/60 text-[11px] font-mono text-slate-600 dark:text-slate-300 shrink-0"
              >
                <span>{docStats.totalEntities.toLocaleString('vi-VN')} đối tượng</span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {layouts.length} {layouts.length > 1 ? 'Sheets' : 'Sheet'}
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-slate-500 dark:text-slate-400">{docStats.acadVer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Zone 2: Tải lên file .DXF/.DWG, Mở URL, Chồng lớp XREF, Chọn mẫu DWG/DXF */}
        <div className="flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf,.dwg"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            ref={overlayInputRef}
            type="file"
            accept=".dxf,.dwg"
            className="hidden"
            onChange={handleOverlayUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Mở một hoặc nhiều tệp .DWG / .DXF từ máy tính (Hoặc kéo thả trực tiếp vào khung vẽ)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer shrink-0 active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mở DWG / DXF</span>
          </button>

          <button
            type="button"
            onClick={() => overlayInputRef.current?.click()}
            title="Chồng lớp bản vẽ tham chiếu (XREF Overlay DWG/DXF) lên bản vẽ hiện tại"
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg transition-all duration-150 cursor-pointer shrink-0 active:scale-95"
          >
            <FileUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Chồng lớp (XREF)</span>
          </button>

          <input
            ref={fontInputRef}
            type="file"
            accept=".shx,.ttf,.woff,.woff2,.otf"
            multiple
            className="hidden"
            onChange={handleCustomFontUpload}
          />

          <button
            type="button"
            onClick={() => setShowFontModal(true)}
            title="Quản lý Font CAD: Tự động hỗ trợ tiếng Việt TCVN3 (.VnTime), VNI-Windows, Unicode và nạp thêm font .SHX / .TTF"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg transition-all duration-150 cursor-pointer shrink-0 active:scale-95"
          >
            <Type className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Font CAD</span>
            {cachedFontList.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 rounded-full">
                {cachedFontList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleSelectAllClosedBoundaries}
            title="Tự động nhận diện và tính diện tích Shoelace cho tất cả đường bao Polyline kín trên Sheet đang mở"
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-all duration-150 cursor-pointer shrink-0 active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Đo tự động vùng kín</span>
          </button>
        </div>

        {/* Zone 3: Hướng dẫn & Chế độ Sáng / Tối */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowChangelogModal(true)}
            title={`Phiên bản v${APP_VERSION} (${APP_BUILD_DATE}) • Bấm để xem nhật ký cập nhật`}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all duration-150 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>v{APP_VERSION}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            title="Hướng dẫn sử dụng & Phím tắt"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all duration-150 cursor-pointer active:scale-95"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDark(d => !d)}
            title={dark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            aria-label="Giao diện sáng/tối"
            className="p-2 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all duration-150 cursor-pointer active:scale-95"
          >
            {dark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* ==================== THANH CÔNG CỤ ĐO ĐẠC & XEM CAD (OPTIMIZED COMPACT TOOLBAR) ==================== */}
      <div
        role="toolbar"
        aria-label="Công cụ bản vẽ"
        className="w-full h-11 flex items-center overflow-x-auto no-scrollbar gap-1.5 px-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs shrink-0 z-30 relative shadow-2xs select-none"
      >
        {/* Nhóm 1: Công cụ Đo đạc & Vẽ chính */}
        <div className="flex items-center shrink-0 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/70 gap-0.5">
          <button
            type="button"
            onClick={() => selectMode('pan')}
            aria-pressed={mode === 'pan'}
            title="Di chuyển bản vẽ (Pan) - Kéo giữ chuột"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'pan'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70'
            }`}
          >
            <Move className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => selectMode('area')}
            aria-pressed={mode === 'area'}
            title="Chọn vùng kín (Auto Area) - Click vào đường bao Polyline kín"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'area'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70'
            }`}
          >
            <MousePointerClick className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => selectMode('poly')}
            aria-pressed={mode === 'poly'}
            title="Vẽ vùng đa giác (Polygon) - Chấm từng đỉnh Shoelace"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'poly'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70'
            }`}
          >
            <Pentagon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => selectMode('rect')}
            aria-pressed={mode === 'rect'}
            title="Vẽ hình chữ nhật (Rectangle) - Chọn 2 góc đối diện"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'rect'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70'
            }`}
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => selectMode('dist')}
            aria-pressed={mode === 'dist'}
            title="Đo chiều dài đoạn thẳng / Chu vi (Distance)"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'dist'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/80 shrink-0 mx-0.5" />

        {/* Nhóm 2: Tiện ích CAD nâng cao */}
        <div className="flex items-center shrink-0 p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/70 gap-0.5">
          <button
            type="button"
            onClick={() => selectMode('cal')}
            aria-pressed={mode === 'cal'}
            title="Hiệu chuẩn tỉ lệ (Scale Calibration) - Chấm 2 đầu đoạn mẫu"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'cal'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700/70'
            }`}
          >
            <Scale className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => selectMode(mode === 'layoff' ? 'poly' : 'layoff')}
            aria-pressed={mode === 'layoff'}
            title="Chạm ẩn/bật lớp (LAYOFF) - Click vào nét vẽ để ẩn lớp"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'layoff'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 dark:text-rose-400 hover:bg-white dark:hover:bg-rose-950/50'
            }`}
          >
            <EyeOff className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => selectMode(mode === 'info' ? 'poly' : 'info')}
            aria-pressed={mode === 'info'}
            title="Tra cứu thực thể DWG/DXF - Xem chi tiết đối tượng"
            className={`p-1.5 rounded-md font-medium text-xs transition-all duration-150 shrink-0 cursor-pointer ${
              mode === 'info'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-sky-700 dark:text-sky-400 hover:bg-white dark:hover:bg-sky-950/50'
            }`}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/80 shrink-0 mx-0.5" />

        {/* Nhóm 3: Sheet / Layout selector */}
        {layouts.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/70 shrink-0 whitespace-nowrap"
            title="Chuyển nhanh giữa không gian Model và các Sheet / Layout"
          >
            <Layout className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <select
              value={activeLayout?.btrId || ''}
              onChange={e => {
                const target = layouts.find(l => l.btrId === e.target.value)
                if (target) handleSwitchLayout(target)
              }}
              aria-label="Chọn Sheet / Layout bản vẽ"
              className="bg-transparent font-mono font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer text-xs max-w-[110px] truncate"
            >
              {layouts.map(l => (
                <option
                  key={l.btrId}
                  value={l.btrId}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                >
                  {l.name} ({l.entityCount})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Nhóm 4: Bổ trợ vẽ (Vuông góc & OSNAP) */}
        <button
          type="button"
          onClick={() => setOrtho(o => !o)}
          aria-pressed={ortho}
          title="Khóa tia vuông góc 90° (Phím tắt: O hoặc giữ Shift)"
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer border shadow-2xs active:scale-95 ${
            ortho
              ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-400 dark:border-blue-700 font-semibold'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/70'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full transition-colors ${ortho ? 'bg-blue-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">⊥ Vuông góc</span>
          <span className="sm:hidden font-mono font-bold">⊥</span>
        </button>

        <button
          type="button"
          onClick={() => setSnapEnabled(prev => !prev)}
          aria-pressed={snapEnabled}
          title="Bật/Tắt bắt điểm tự động OSNAP"
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer border shadow-2xs active:scale-95 ${
            snapEnabled
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-semibold'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/70'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full transition-colors ${snapEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
          <Crosshair className="w-3.5 h-3.5 shrink-0" />
          <span>OSNAP</span>
        </button>

        {/* Điều khiển khi đang chấm điểm vẽ vùng / đo dài */}
        {activePoints.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-200 shadow-2xs animate-in fade-in duration-150 shrink-0">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="font-mono text-xs font-semibold">
              {activePoints.length} {mode === 'dist' ? 'điểm' : 'đỉnh'}
            </span>
            <div className="h-3 w-px bg-blue-300 dark:bg-blue-700 mx-0.5" />
            <button
              type="button"
              onClick={() => setActivePoints(prev => prev.slice(0, -1))}
              title="Lùi 1 điểm (Backspace)"
              className="p-1 rounded hover:bg-white dark:hover:bg-slate-800 text-xs font-medium cursor-pointer transition-colors"
            >
              <Undo2 className="w-3 h-3 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePoints([])
                setCurrentSnap(null)
              }}
              title="Hủy vẽ (Esc)"
              className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium cursor-pointer transition-colors"
            >
              <X className="w-3 h-3 shrink-0" />
            </button>
            {activePoints.length >= (mode === 'dist' ? 2 : 3) && (
              <button
                type="button"
                onClick={() => finishCurrentPolygon(activePoints)}
                title="Hoàn tất đo (Enter)"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <Check className="w-3 h-3 shrink-0" />
                <span>{mode === 'dist' ? 'Xong' : 'Đóng'}</span>
              </button>
            )}
          </div>
        )}

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/80 shrink-0 mx-0.5" />

        {/* Nhóm 5: Hoàn tác / Làm lại */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/80 p-0.5 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length === 0 && activePoints.length === 0}
            title="Hoàn tác (Ctrl+Z)"
            className="p-1 rounded-md text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 cursor-pointer transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Làm lại (Ctrl+Y)"
            className="p-1 rounded-md text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-35 cursor-pointer transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Nhóm 6: Đơn vị đo */}
        <div
          className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs shrink-0 whitespace-nowrap shadow-2xs"
          title={`Đơn vị gốc của bản vẽ ($INSUNITS=${detectedInsunits ?? 4})`}
        >
          <select
            value={useCustomFactor ? -999 : selectedInsunits}
            onChange={e => {
              const val = Number(e.target.value)
              if (val === -999) {
                setUseCustomFactor(true)
              } else {
                setUseCustomFactor(false)
                setSelectedInsunits(val)
              }
            }}
            aria-label="Đơn vị bản vẽ DXF"
            className="bg-transparent font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
          >
            <option value={4}>mm</option>
            <option value={5}>cm</option>
            <option value={6}>m</option>
            <option value={1}>inch</option>
            <option value={2}>feet</option>
            <option value={0}>unit</option>
            <option value={-999}>tỷ lệ</option>
          </select>

          {useCustomFactor && (
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
              <input
                type="number"
                step="any"
                value={customToMeters}
                onChange={e => setCustomToMeters(e.target.value)}
                title="Hệ số quy đổi 1 đơn vị sang mét (m)"
                className="w-14 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px]"
              />
              <span className="text-slate-500 text-[11px]">m</span>
            </div>
          )}
        </div>

        {/* Hộp nhập kích thước thực khi đã chấm 2 điểm ở chế độ Chỉnh tỉ lệ (cal) */}
        {calLine && calLine.length === 2 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-md shrink-0">
            <span className="text-amber-800 dark:text-amber-300 font-medium whitespace-nowrap">
              Dài:
            </span>
            <input
              type="number"
              step="any"
              value={calValue}
              onChange={e => setCalValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleApplyCalibration()
              }}
              placeholder="VD: 3600"
              autoFocus
              className="w-16 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded font-mono text-xs"
            />
            <select
              value={calUnit}
              onChange={e => setCalUnit(Number(e.target.value))}
              className="bg-transparent font-mono font-semibold text-amber-900 dark:text-amber-200 focus:outline-none cursor-pointer"
            >
              <option value={0.001}>mm</option>
              <option value={0.01}>cm</option>
              <option value={1}>m</option>
            </select>
            <button
              type="button"
              onClick={handleApplyCalibration}
              className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold cursor-pointer"
            >
              Áp dụng
            </button>
            <button
              type="button"
              onClick={() => {
                setCalLine(null)
                setMode('poly')
              }}
              className="px-1 py-0.5 text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Hủy
            </button>
          </div>
        )}

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700/80 shrink-0 mx-0.5" />

        {/* Nhóm 7: Quản lý Lớp (Layer) */}
        <div ref={layerMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowLayerMenu(m => !m)}
            title="Bật/tắt hiển thị các Lớp (Layers) trong bản vẽ"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap shrink-0 cursor-pointer shadow-2xs active:scale-95 transition-all ${
              showLayerMenu
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>
              Lớp ({visibleLayerCount}/{layers.length})
            </span>
          </button>

          {showLayerMenu && (
            <div className="fixed right-3 sm:right-36 top-[100px] w-[340px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-120px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 z-50 flex flex-col text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Danh sách Layer ({visibleLayerCount}/{layers.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSetAllLayersOn}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Bật tất cả
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <button
                    type="button"
                    onClick={handleSetAllLayersOff}
                    className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                  >
                    Ẩn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLayerMenu(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                    title="Đóng menu"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {layers.length > 5 && (
                <div className="mt-2 shrink-0">
                  <input
                    type="text"
                    value={layerSearch}
                    onChange={e => setLayerSearch(e.target.value)}
                    placeholder="Tìm nhanh tên Layer..."
                    className="w-full px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="overflow-y-auto space-y-0.5 mt-2 pr-1 flex-1 max-h-[50vh]">
                {filteredLayers.map(layer => (
                  <label
                    key={layer.name}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={layer.isOn}
                        onChange={() => handleToggleLayer(layer.name, layer.isOn)}
                        className="rounded accent-blue-600 w-3.5 h-3.5 shrink-0 cursor-pointer"
                      />
                      <span
                        className="w-3 h-3 rounded-xs border border-slate-300 dark:border-slate-600 shrink-0"
                        style={{ backgroundColor: layer.cssColor || '#3b82f6' }}
                      />
                      <span
                        className={`truncate font-mono text-xs ${
                          layer.isOn
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-400 line-through'
                        }`}
                      >
                        {layer.name}
                      </span>
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      {layer.isOn ? 'Hiện' : 'Ẩn'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Nút bổ trợ 6: Hiển thị nâng cao & Xuất bản vẽ DWG/DXF */}
        <div ref={displayMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowDisplayMenu(m => !m)}
            title="Cài đặt hiển thị DWG/DXF (Độ dày nét, Chế độ đọc, Bảng mã Font, Xuất DXF/PNG/SVG)"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap shrink-0 cursor-pointer shadow-2xs active:scale-95 transition-all ${
              showDisplayMenu
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">Cài đặt & Xuất</span>
          </button>

          {showDisplayMenu && (
            <div className="fixed right-3 top-[100px] w-[360px] sm:w-[400px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-115px)] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* Header của menu */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    Tùy chọn Đọc & Xuất CAD
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {docStats && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                      {docStats.fileFormat} • {docStats.acadVer}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDisplayMenu(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Đóng menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Phần 1: Tùy chọn hiển thị nét & chế độ */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Hiển thị & Giao diện
                </div>
                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    Hiển thị độ dày nét (LWDISPLAY)
                  </span>
                  <input
                    type="checkbox"
                    checked={lineWeightDisplay}
                    onChange={e => handleToggleLineWeight(e.target.checked)}
                    className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    Chế độ đọc (Nét đen trên nền trắng)
                  </span>
                  <input
                    type="checkbox"
                    checked={readingMode}
                    onChange={e => handleToggleReadingMode(e.target.checked)}
                    className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    Đọc cả các lớp No-Plot / Ẩn
                  </span>
                  <input
                    type="checkbox"
                    checked={drawNoPlotLayers}
                    onChange={e => handleToggleNoPlotLayers(e.target.checked)}
                    className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Màu nền vùng vẽ CAD:</span>
                  <button
                    type="button"
                    onClick={handleSwitchCadBackground}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-medium cursor-pointer shadow-2xs active:scale-95 transition-all text-slate-800 dark:text-slate-200"
                  >
                    Đổi nền Đen / Trắng
                  </button>
                </div>

                <div className="space-y-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400 block font-medium">
                    Bảng mã chữ (Codepage cho DXF/DWG cũ):
                  </span>
                  <select
                    value={dxfEncoding}
                    onChange={e => handleChangeEncoding(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    {DXF_ENCODING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Danh sách bản vẽ chồng lớp XREF */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Bản vẽ chồng lớp (XREF)
                  </span>
                  <button
                    type="button"
                    onClick={() => overlayInputRef.current?.click()}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    + Thêm file
                  </button>
                </div>
                {overlays.length === 0 ? (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
                    Chưa có bản vẽ tham chiếu nào được chồng lớp.
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {overlays.map(ov => (
                      <div
                        key={ov.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 shadow-2xs"
                      >
                        <label className="flex items-center gap-2 truncate cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={ov.visible}
                            onChange={e => handleToggleOverlay(ov.id, e.target.checked)}
                            className="rounded accent-blue-600 w-3.5 h-3.5 shrink-0 cursor-pointer"
                          />
                          <span className="truncate font-mono text-[11px] text-slate-800 dark:text-slate-200">{ov.fileName}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveOverlay(ov.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer shrink-0 ml-2 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Xóa chồng lớp"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Xuất / Chuyển đổi định dạng bản vẽ */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Chuyển đổi & Xuất bản vẽ:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportCommand('cdxf')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 font-semibold text-xs cursor-pointer shadow-2xs active:scale-95 transition-all text-left"
                  >
                    <Download className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>Xuất file .DXF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCommand('pngout')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs cursor-pointer shadow-2xs active:scale-95 transition-all text-left"
                  >
                    <span className="text-sm shrink-0">🖼</span>
                    <span>Xuất ảnh .PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCommand('csvg')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs cursor-pointer shadow-2xs active:scale-95 transition-all text-left"
                  >
                    <span className="text-sm shrink-0">📐</span>
                    <span>Xuất vector .SVG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCommand('chtml')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs cursor-pointer shadow-2xs active:scale-95 transition-all text-left"
                  >
                    <span className="text-sm shrink-0">🌐</span>
                    <span>Xuất web .HTML</span>
                  </button>
                </div>
              </div>

              {/* Thống kê thực thể trong bản vẽ */}
              {docStats && docStats.typeBreakdown.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Cấu trúc thực thể ({docStats.totalEntities}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {docStats.typeBreakdown.map(item => (
                      <span
                        key={item.type}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300"
                      >
                        {item.type}: <strong>{item.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Phiên bản ứng dụng & Xem cập nhật mới */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-mono font-medium">BOC CAD v{APP_VERSION}</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisplayMenu(false)
                    setShowChangelogModal(true)
                  }}
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
                >
                  <span>Xem cập nhật mới</span>
                  <span>➜</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dòng thông tin kích thước bản vẽ & gợi ý chế độ */}
        <div className="hidden 2xl:flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate shrink-0 ml-auto pr-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          <span className="truncate max-w-[220px]">{MODE_HINTS[mode]}</span>
          {drawingExtentsText && (
            <span className="font-mono text-slate-400 dark:text-slate-500 shrink-0">
              ({drawingExtentsText})
            </span>
          )}
        </div>
      </div>

      {/* ==================== THANH ĐIỀU KHIỂN CHỌN ẨN/BẬT LỚP (LAYOFF BAR) ==================== */}
      {mode === 'layoff' && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-rose-50/95 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-800/60 text-xs shrink-0 overflow-x-auto no-scrollbar relative z-20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="inline-flex items-center gap-1.5 font-semibold text-rose-900 dark:text-rose-200 shrink-0">
              <EyeOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Chế độ chạm ẩn lớp (LAYOFF):</span>
            </div>
            <span className="hidden md:inline text-slate-600 dark:text-slate-300 text-[11px] truncate">
              Chạm trực tiếp vào nét vẽ bất kỳ trên bản vẽ để ẩn lớp đó.
            </span>

            <button
              type="button"
              onClick={() => setShowGhostHidden(v => !v)}
              aria-pressed={showGhostHidden}
              title="Hiển thị mờ các đối tượng thuộc lớp ẩn để bạn có thể bấm trực tiếp vào nét mờ và bật lại lớp"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showGhostHidden
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                  : 'bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
              }`}
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>
                {showGhostHidden ? 'Đang hiện mờ lớp ẩn' : 'Hiện mờ nét ẩn để bật lại'}
              </span>
            </button>

            {layers.some(l => !l.isOn) && (
              <button
                type="button"
                onClick={handleSetAllLayersOn}
                className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline cursor-pointer shrink-0 ml-1"
              >
                Bật lại tất cả ({layers.filter(l => !l.isOn).length} lớp đang ẩn)
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {layers.filter(l => !l.isOn).length > 0 && (
              <div className="hidden lg:flex items-center gap-1 shrink-0 mr-1">
                <span className="text-slate-500 dark:text-slate-400 text-[10px]">Lớp ẩn gần đây:</span>
                {layers
                  .filter(l => !l.isOn)
                  .sort((a, b) => {
                    const ia = recentHiddenLayers.indexOf(a.name)
                    const ib = recentHiddenLayers.indexOf(b.name)
                    if (ia !== -1 && ib !== -1) return ia - ib
                    if (ia !== -1) return -1
                    if (ib !== -1) return 1
                    return a.name.localeCompare(b.name)
                  })
                  .slice(0, 5)
                  .map(layer => (
                    <button
                      key={layer.name}
                      type="button"
                      onClick={() => {
                        handleToggleLayer(layer.name, false)
                        showLayerToast(layer.name, false)
                      }}
                      title={`Bấm để bật lại lớp ${layer.name}`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 text-[10px] font-mono transition-colors cursor-pointer"
                    >
                      <Eye className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{layer.name}</span>
                    </button>
                  ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => selectMode('pan')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Xong · Thoát</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== THANH CẤU HÌNH LƯỚI GẠCH (#tilebar) ==================== */}
      <div
        id="tilebar"
        className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-xs shrink-0 overflow-x-auto no-scrollbar transition-all relative z-10"
      >
        <label className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0 select-none">
          <input
            type="checkbox"
            checked={tileConfig.on}
            onChange={e => setTileConfig(prev => ({ ...prev, on: e.target.checked }))}
            className="rounded accent-teal-600 w-3.5 h-3.5 cursor-pointer"
          />
          <Grid className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Lưới gạch</span>
        </label>

        <button
          type="button"
          onClick={() => setTileExpanded(e => !e)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 whitespace-nowrap cursor-pointer font-medium text-[11px] shadow-2xs transition-colors shrink-0"
        >
          {tileExpanded ? '▾ Thu gọn' : '▸ Chi tiết'}
        </button>

        {!tileExpanded && (
          <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate whitespace-nowrap bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
            {tileConfig.w}×{tileConfig.h} mm ·{' '}
            {tileConfig.pattern === 'third'
              ? 'So le 1/3 · '
              : tileConfig.pattern === 'running'
                ? 'So le 1/2 · '
                : tileConfig.pattern === 'herringbone'
                  ? 'Xương cá 45° · '
                  : tileConfig.pattern === 'herringbone90'
                    ? 'Xương cá 90° · '
                    : ''}
            Roan {tileConfig.g} mm · Hao hụt {tileConfig.waste}%
          </span>
        )}

        {tileExpanded && (
          <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Khổ mẫu:</span>
              <select
                value={tilePreset}
                onChange={e => handlePresetChange(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs cursor-pointer shadow-2xs focus:outline-none focus:border-teal-500"
              >
                {TILE_PRESETS.map(p => (
                  <option key={p.label} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 font-mono text-xs">
              <input
                type="number"
                min={10}
                value={tileConfig.w}
                onChange={e =>
                  setTileConfig(prev => ({ ...prev, w: Math.max(10, Number(e.target.value) || 600) }))
                }
                className="w-16 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right tabular-nums focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-400">×</span>
              <input
                type="number"
                min={10}
                value={tileConfig.h}
                onChange={e =>
                  setTileConfig(prev => ({ ...prev, h: Math.max(10, Number(e.target.value) || 600) }))
                }
                className="w-16 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right tabular-nums focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-500 text-[11px]">mm</span>
            </div>

            <button
              type="button"
              onClick={handleRotateTile}
              title="Xoay hướng lát gạch 90 độ"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer shadow-2xs transition-colors"
            >
              <RotateCw className="w-3 h-3 text-slate-500" />
              <span>Xoay 90°</span>
            </button>

            {/* Tùy chọn kiểu lát gạch (Thẳng hàng, So le 1/3, So le 1/2, Xương cá 45°, Xương cá 90°) */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px] whitespace-nowrap">
                Kiểu lát:
              </span>
              <select
                value={tileConfig.pattern || 'grid'}
                onChange={e =>
                  setTileConfig(prev => ({
                    ...prev,
                    pattern: e.target.value as TilePattern,
                  }))
                }
                title="Chọn kiểu lát gạch: Thẳng hàng, So le 1/3 (chuẩn gạch gỗ), So le 1/2, Xương cá 45°, Xương cá 90°"
                className="bg-transparent text-xs font-semibold text-teal-800 dark:text-teal-300 focus:outline-none cursor-pointer"
              >
                <option value="grid" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  Thẳng hàng (Song song)
                </option>
                <option value="third" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  So le 1/3 (Chuẩn gạch gỗ)
                </option>
                <option value="running" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  So le 1/2 (50%)
                </option>
                <option value="herringbone" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  Xương cá 45°
                </option>
                <option value="herringbone90" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  Xương cá 90° (Vuông)
                </option>
              </select>
            </div>

            {/* Tính năng Roan gạch (khe mạch gạch mm & ke ron) */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px]">Roan:</span>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={tileConfig.g}
                onChange={e =>
                  setTileConfig(prev => ({
                    ...prev,
                    g: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                title="Độ rộng khe roan / mạch gạch (mm) — chuẩn ke chèn ron gạch"
                className="w-12 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-right text-xs tabular-nums focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-400 text-[10px]">mm</span>

              <div className="flex items-center gap-0.5 pl-1 border-l border-slate-200 dark:border-slate-700">
                {[
                  { label: 'Khít (0)', val: 0 },
                  { label: '1.5', val: 1.5 },
                  { label: '2', val: 2 },
                  { label: '3', val: 3 },
                ].map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setTileConfig(prev => ({ ...prev, g: p.val }))}
                    title={`Đặt nhanh roan gạch ${p.val} mm`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                      tileConfig.g === p.val
                        ? 'bg-teal-600 text-white font-bold'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Tùy chọn màu roan gạch */}
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"
                  style={{ backgroundColor: tileConfig.groutColor || '#94a3b8' }}
                  title="Màu hiển thị đường roan gạch"
                />
                <select
                  value={tileConfig.groutColor || '#94a3b8'}
                  onChange={e => setTileConfig(prev => ({ ...prev, groutColor: e.target.value }))}
                  title="Màu sắc đường roan gạch (xi măng chà ron)"
                  className="bg-transparent text-[10px] font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="#94a3b8" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Xám</option>
                  <option value="#f8fafc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Trắng</option>
                  <option value="#334155" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Đậm</option>
                  <option value="#090d16" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Đen</option>
                  <option value="#fef08a" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Kem</option>
                </select>
              </div>
            </div>

            <label className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">Hao hụt:</span>
              <input
                type="number"
                min={0}
                value={tileConfig.waste}
                onChange={e =>
                  setTileConfig(prev => ({
                    ...prev,
                    waste: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-14 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-right tabular-nums focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-500 text-[11px]">%</span>
            </label>

            <button
              type="button"
              onClick={handleAutoOptimizeTiles}
              disabled={!measuredPolygons.length}
              title="Tự động tính góc xoay và dời gốc để giảm tối đa số viên gạch phải cắt vụn"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/60 dark:to-emerald-950/40 hover:from-teal-100 hover:to-emerald-100 dark:hover:from-teal-900/60 dark:hover:to-emerald-900/60 text-teal-800 dark:text-teal-300 border border-teal-300/80 dark:border-teal-700/80 font-medium text-xs disabled:opacity-40 whitespace-nowrap cursor-pointer shadow-2xs transition-all"
            >
              <Wand2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Tối ưu giảm viên cắt</span>
            </button>

            {optimizeStatus && (
              <span className="text-teal-700 dark:text-teal-300 font-medium text-[11px] bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                {optimizeStatus}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ==================== KHU VỰC CHÍNH: CAD VIEWPORT + CỘT BÊN PHẢI ==================== */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row relative z-0">
        {/* CỘT TRÁI: Multi-Document Bar + @mlightcad/cad-simple-viewer + Thanh Sheet/Layout Tabs dưới đáy */}
        <div
          className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-slate-950"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onContextMenu={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {/* Thanh Multi-Document Tabs (MDI) chỉ hiển thị khi mở từ 2 bản vẽ trở lên */}
          {openDocs.length > 1 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs overflow-x-auto no-scrollbar shrink-0">
              {openDocs.map(tab => (
                <div
                  key={tab.sessionId}
                  onClick={() => handleSwitchDocument(tab)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] cursor-pointer transition-colors shrink-0 ${
                    tab.isActive
                      ? 'bg-teal-700 text-white font-semibold'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span
                    className={`px-1 rounded text-[9px] font-bold ${
                      tab.format === 'DWG'
                        ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                        : 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                    }`}
                  >
                    {tab.format}
                  </span>
                  <span className="truncate max-w-[160px]">{tab.title}</span>
                  <button
                    type="button"
                    onClick={e => handleCloseDocument(tab, e)}
                    title="Đóng bản vẽ này"
                    className="hover:text-rose-400 px-0.5 cursor-pointer ml-0.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Vùng Canvas Viewport chính */}
          <div className="flex-1 min-h-0 relative overflow-hidden touch-none select-none">
            {/* Container cho @mlightcad/cad-simple-viewer */}
            <div
              ref={viewerContainerRef}
              className={`w-full h-full touch-none select-none ${
                isRightPanning
                  ? '!cursor-grabbing'
                  : mode === 'pan'
                    ? 'cursor-grab active:cursor-grabbing'
                    : mode === 'info'
                      ? 'cursor-pointer'
                      : 'cursor-crosshair'
              }`}
            />

            {/* Canvas 2D trong suốt phủ lên để vẽ đa giác mờ, cạnh, đỉnh & OSNAP marker */}
            <canvas
              ref={overlayCanvasRef}
              className="pointer-events-none absolute inset-0 z-20 will-change-transform"
            />

            {/* Kéo thả file .DWG / .DXF trực tiếp vào khung vẽ */}
            {isDragOver && (
              <div className="absolute inset-3 z-40 rounded-2xl border-2 border-dashed border-teal-400 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white pointer-events-none">
                <FileUp className="w-10 h-10 text-teal-400 animate-bounce" />
                <p className="text-sm font-bold">
                  Thả tệp .DWG hoặc .DXF vào đây để mở ngay
                </p>
                <p className="text-xs text-slate-300">
                  Hỗ trợ đọc đầy đủ AutoCAD DWG & DXF, Blocks, Hatch, MText và mọi Sheet/Layout
                </p>
              </div>
            )}

            {/* Thông báo thao tác Font tiếng Việt */}
            {fontToast && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-lg backdrop-blur-xs border border-teal-500/50 flex items-center gap-2 pointer-events-none">
                <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{fontToast}</span>
              </div>
            )}

            {/* Thông báo thao tác Ẩn/Bật Layer (Tự tắt sau 2.5s) */}
            {lastLayerToast && (
              <div
                className={`absolute top-3 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full text-white text-xs font-medium shadow-lg backdrop-blur-xs flex items-center gap-2 pointer-events-none ${
                  lastLayerToast.hidden
                    ? 'bg-rose-900/90 border border-rose-500/60'
                    : 'bg-emerald-900/90 border border-emerald-500/60'
                }`}
              >
                {lastLayerToast.hidden ? (
                  <EyeOff className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                )}
                <span>
                  {lastLayerToast.hidden
                    ? `Đã ẩn lớp: ${lastLayerToast.layer}`
                    : `Đã bật lại lớp: ${lastLayerToast.layer}`}
                </span>
              </div>
            )}

            {/* Hộp thoại nổi Tìm kiếm chữ (Find Text trong DWG/DXF) */}
            {showFindPanel && (
              <div className="absolute top-3 right-3 z-30 w-80 sm:w-96 max-h-[75%] flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md text-xs overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-amber-500" />
                    <span>Tìm chữ trong bản vẽ DWG/DXF</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFindPanel(false)
                      setHighlightedFindBox(null)
                    }}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-2.5 space-y-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="search"
                      value={findQuery}
                      onChange={e => setFindQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRunFindText()
                      }}
                      placeholder="Nhập nội dung chữ, tên phòng, ký hiệu..."
                      autoFocus
                      className="flex-1 px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleRunFindText}
                      className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer shrink-0"
                    >
                      Tìm
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={findCaseSensitive}
                        onChange={e => setFindCaseSensitive(e.target.checked)}
                        className="rounded accent-amber-600"
                      />
                      <span>Phân biệt chữ HOA/thường</span>
                    </label>
                    <span>{findHits.length} kết quả</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-64">
                  {findHits.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-[11px]">
                      Nhập từ khóa để tìm kiếm TEXT, MTEXT, thuộc tính Block (ATTRIB), kích thước (DIM) trên tất cả các Sheet/Layout.
                    </div>
                  ) : (
                    findHits.map((hit, idx) => (
                      <button
                        key={`${hit.entityId}-${idx}`}
                        type="button"
                        onClick={() => handleJumpToFindHit(hit, idx)}
                        className={`w-full text-left px-3 py-2 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                          activeFindIdx === idx ? 'bg-amber-50 dark:bg-amber-950/50' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {hit.text}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                              Sheet: {hit.layoutName || 'Model'}
                            </span>
                            <span>·</span>
                            <span className="font-mono uppercase">{hit.kind}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          Phóng tới →
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Bảng nổi Tra cứu thuộc tính thực thể DWG/DXF (Entity Inspector) */}
            {inspectedEntity && (
              <div className="absolute top-3 left-3 z-30 w-80 sm:w-92 rounded-xl border border-sky-500/40 bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-mono font-bold text-[11px]">
                      {inspectedEntity.dxfType}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      Chi tiết thực thể CAD
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedEntity(null)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-400">Object ID:</span>{' '}
                    <span className="font-mono font-semibold">{inspectedEntity.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Lớp (Layer):</span>{' '}
                    <span className="font-mono font-semibold text-teal-700 dark:text-teal-300">
                      {inspectedEntity.layer}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Kiểu nét:</span>{' '}
                    <span className="font-mono">{inspectedEntity.lineType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Độ dày nét:</span>{' '}
                    <span className="font-mono">{inspectedEntity.lineWeight}</span>
                  </div>
                  {inspectedEntity.blockName && (
                    <div className="col-span-2">
                      <span className="text-slate-400">Tên Block (INSERT):</span>{' '}
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {inspectedEntity.blockName}
                      </span>
                    </div>
                  )}
                  {inspectedEntity.textValue && (
                    <div className="col-span-2 p-1.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-200 break-words">
                      "{inspectedEntity.textValue}"
                    </div>
                  )}
                  {inspectedEntity.lengthMeters !== undefined && (
                    <div>
                      <span className="text-slate-400">Chiều dài / Chu vi:</span>{' '}
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        {inspectedEntity.lengthMeters.toFixed(3)} m
                      </span>
                    </div>
                  )}
                  {inspectedEntity.areaSquareMeters !== undefined && (
                    <div>
                      <span className="text-slate-400">Diện tích:</span>{' '}
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                        {inspectedEntity.areaSquareMeters.toFixed(3)} m²
                      </span>
                    </div>
                  )}
                  {inspectedEntity.bboxMeters && (
                    <div className="col-span-2">
                      <span className="text-slate-400">Khung bao (BBox):</span>{' '}
                      <span className="font-mono">{inspectedEntity.bboxMeters}</span>
                    </div>
                  )}
                  {inspectedEntity.extraProps.map(p => (
                    <div key={p.label} className="col-span-2">
                      <span className="text-slate-400">{p.label}:</span>{' '}
                      <span className="font-mono">{p.value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleLayer(inspectedEntity.layer, true)
                      showLayerToast(inspectedEntity.layer, true)
                      setInspectedEntity(null)
                    }}
                    className="px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-medium cursor-pointer"
                  >
                    Ẩn lớp "{inspectedEntity.layer}"
                  </button>
                  {hoveredEntity && hoveredEntity.closed && hoveredEntity.pts.length >= 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        finishCurrentPolygon(
                          hoveredEntity.pts,
                          `${inspectedEntity.dxfType} (${inspectedEntity.layer})`
                        )
                        setInspectedEntity(null)
                      }}
                      className="px-2.5 py-1 rounded bg-teal-700 hover:bg-teal-800 text-white font-semibold cursor-pointer"
                    >
                      + Đo diện tích vùng này
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Thanh nổi hiển thị trạng thái khi đang chấm điểm Đo diện tích */}
            {activePoints.length > 0 && (
              <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-teal-500/40 bg-white/95 dark:bg-slate-900/95 px-3.5 py-2 shadow-lg backdrop-blur-md">
                <span className="flex h-2.5 w-2.5 rounded-full bg-teal-500 animate-ping" />
                <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                  {mode === 'dist' ? 'Đang đo chiều dài' : 'Đang chọn'} ({activePoints.length}{' '}
                  {mode === 'dist' ? 'điểm' : 'đỉnh'})
                </span>
                {activePoints.length >= (mode === 'dist' ? 1 : 2) && (
                  <span className="rounded bg-teal-500/15 px-2 py-0.5 text-xs font-mono font-bold text-teal-700 dark:text-teal-300 border border-teal-500/30">
                    {mode === 'dist'
                      ? `≈ ${liveActiveLengthM.toFixed(2)} m`
                      : `≈ ${liveActiveAreaM2.toFixed(2)} m²`}
                  </span>
                )}
                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    type="button"
                    disabled={activePoints.length < (mode === 'dist' ? 2 : 3)}
                    onClick={() => finishCurrentPolygon(activePoints)}
                    className="rounded-md bg-teal-700 hover:bg-teal-800 disabled:opacity-40 px-2.5 py-1 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    {mode === 'dist' ? 'Hoàn tất đo (Enter)' : 'Đóng vùng (Enter)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePoints(prev => prev.slice(0, -1))}
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    Lùi 1 điểm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePoints([])
                      setCurrentSnap(null)
                    }}
                    className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2 py-1 text-xs text-rose-700 dark:text-rose-300 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {/* Loading Overlay khi đang phân tích bản vẽ DXF/DWG */}
            {isLoading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-slate-900/45 backdrop-blur-xs">
                <div className="max-w-sm w-full p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {statusMessage}
                    </span>
                  </div>
                  {openProgress && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        <span className="truncate pr-2">{openProgress.stage}</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400 shrink-0">
                          {openProgress.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-indigo-600 transition-all duration-200 rounded-full"
                          style={{ width: `${Math.max(4, Math.min(100, openProgress.pct))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Nút mở lại bảng khối lượng khi Sidebar đang thu gọn */}
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="fixed lg:absolute bottom-12 lg:bottom-auto right-2 sm:right-3 lg:top-3 z-30 inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 dark:bg-slate-800/90 text-white backdrop-blur-md border border-teal-500/40 rounded-xl shadow-xl hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-teal-400 hidden lg:block" />
                <ChevronUp className="w-3.5 h-3.5 text-teal-400 lg:hidden" />
                <span>Bảng kết quả ({measuredPolygons.length})</span>
                {totalArea > 0 && (
                  <span className="font-mono text-[11px] font-bold text-teal-300 bg-slate-800 dark:bg-slate-750 px-1.5 py-0.5 rounded">
                    {fmtNum(totalArea)} m²
                  </span>
                )}
              </button>
            )}
          </div>

          {/* ==================== THANH SHEET / LAYOUT TABS & ĐIỀU HƯỚNG DƯỚI ĐÁY BẢN VẼ (CHUẨN AUTOCAD) ==================== */}
          <div className="h-9 px-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0 z-20">
            {/* Cụm trái: Các tab Sheet / Layout (Model | Layout1 | Layout2 ...) */}
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                <Layout className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                <span className="hidden sm:inline">Sheets:</span>
              </span>

              {layouts.map(layout => (
                <button
                  key={layout.btrId}
                  type="button"
                  role="tab"
                  aria-selected={layout.isActive}
                  onClick={() => handleSwitchLayout(layout)}
                  title={`Chuyển sang ${layout.isModel ? 'Không gian mô hình (Model Space)' : `Trang in (Paper Space Sheet): ${layout.name}`} — ${layout.entityCount} đối tượng`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs transition-all cursor-pointer shrink-0 border ${
                    layout.isActive
                      ? 'bg-teal-700 text-white border-teal-700 font-bold shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{layout.name}</span>
                  <span
                    className={`px-1 rounded text-[10px] tabular-nums font-medium ${
                      layout.isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {layout.entityCount}
                  </span>
                </button>
              ))}
            </div>

            {/* Cụm phải: Điều khiển Phóng to / Thu nhỏ / Khớp khung & Tọa độ WCS */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-850 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleZoomBy(1.25)}
                  title="Phóng to"
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleZoomBy(0.8)}
                  title="Thu nhỏ"
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={handleZoomToFit}
                  title="Khớp toàn bộ bản vẽ của Sheet hiện tại vào khung nhìn"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                >
                  <Maximize2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                  <span className="hidden sm:inline">Khớp khung</span>
                </button>
              </div>

              {currentSnap && currentSnap.type !== 'none' && (
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 max-w-[180px] truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {currentSnap.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Thanh kéo thay đổi độ rộng Sidebar (Desktop) */}
        {!sidebarCollapsed && (
          <div
            onPointerDown={handleSidebarResizeStart}
            title="Kéo sang trái/phải để tùy chỉnh độ rộng cột bên phải"
            className="hidden lg:flex items-center justify-center w-2 -ml-1 cursor-col-resize z-20 group hover:bg-teal-500/20 active:bg-teal-500/40 select-none transition-colors shrink-0 relative"
          >
            <div className="w-1 h-12 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-teal-500 group-hover:h-16 transition-all" />
          </div>
        )}

        {/* Backdrop mờ khi mở Bảng khối lượng trên Mobile */}
        {!sidebarCollapsed && (
          <div
            onClick={() => setSidebarCollapsed(true)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* ==================== CỘT BÊN PHẢI: THỐNG KÊ KHỐI LƯỢNG (BOTTOM SHEET TRÊN MOBILE) ==================== */}
        {!sidebarCollapsed && (
          <aside
            style={{
              width:
                typeof window !== 'undefined' && window.innerWidth >= 1024
                  ? `${sidebarWidth}px`
                  : undefined,
              minWidth:
                typeof window !== 'undefined' && window.innerWidth >= 1024
                  ? '320px'
                  : undefined,
              maxWidth: '100%',
            }}
            className="fixed lg:static inset-x-0 bottom-0 z-50 lg:z-auto max-h-[85vh] lg:max-h-none rounded-t-2xl lg:rounded-none bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 min-w-0 overflow-hidden shadow-2xl lg:shadow-xs transition-transform"
          >
            {/* Thanh kéo & đóng nhanh trên Mobile */}
            <div className="lg:hidden flex items-center justify-between px-3 pt-2.5 pb-2 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Bảng thống kê khối lượng ({measuredPolygons.length})
                </span>
                {totalArea > 0 && (
                  <span className="text-[11px] font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800">
                    {fmtNum(totalArea)} m²
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                <span>Thu gọn</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Phần 1: Header thống kê & Thẻ KPI */}
            <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0 bg-slate-50/70 dark:bg-slate-900/80 min-w-0">
              {/* Tiêu đề + bộ nút xuất nhanh */}
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                    Thống kê khối lượng
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] leading-3 font-semibold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0 tabular-nums">
                    {measuredPolygons.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyExcel}
                    disabled={!measuredPolygons.length}
                    title="Sao chép bảng sang Excel"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-35 rounded-md shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3 h-3 shrink-0" />
                    <span>{copyStatus === 'Sao chép Excel' ? 'Excel' : copyStatus}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    disabled={!measuredPolygons.length}
                    title="Tải file CSV"
                    className="p-1 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 disabled:opacity-35 rounded-md shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (measuredPolygonsRef.current.length > 0) {
                        setHistory(h => [...h.slice(-29), measuredPolygonsRef.current])
                        setRedoStack([])
                      }
                      setMeasuredPolygons([])
                      setSelectedPolygonId(null)
                      setActivePoints([])
                    }}
                    disabled={!measuredPolygons.length && !activePoints.length}
                    title="Xóa hết các vùng đo"
                    className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 disabled:opacity-35 rounded-md shadow-2xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="hidden sm:flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700/80 text-[10px]">
                    {([['Gọn', 360], ['Vừa', 460], ['Rộng', 600]] as const).map(([label, w]) => {
                      const active =
                        w === 360
                          ? sidebarWidth <= 380
                          : w === 460
                            ? sidebarWidth > 380 && sidebarWidth < 560
                            : sidebarWidth >= 560
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setSidebarWidth(w)}
                          className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 font-bold shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    title="Thu gọn thanh bên"
                    className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 hidden lg:block" />
                    <ChevronDown className="w-4 h-4 lg:hidden" />
                  </button>
                </div>
              </div>

              {/* Thẻ KPI dạng viên thuốc: Tổng diện tích sàn, Tổng chu vi, Tổng diện tích tường, Gạch cần mua */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <div className="px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-teal-50 to-emerald-50/50 dark:from-teal-950/40 dark:to-emerald-950/20 border border-teal-200/80 dark:border-teal-800/80 shadow-2xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300 truncate">
                    Tổng diện tích sàn
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono font-bold text-xl text-teal-700 dark:text-teal-300 tabular-nums">
                      {fmtNum(totalArea, 2)}
                    </span>
                    <span className="text-xs font-semibold text-teal-700/80 dark:text-teal-400/80">m²</span>
                  </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-850 dark:to-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 truncate">
                    Tổng chu vi / Chiều dài
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono font-bold text-xl text-slate-800 dark:text-slate-100 tabular-nums">
                      {fmtNum(totalPerimeter, 2)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">m</span>
                  </div>
                </div>

                {totalWallArea > 0 && (
                  <div className="col-span-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50/40 dark:from-indigo-950/40 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-800/70 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-300">
                      <span>Tổng diện tích tường (Chu vi × Cao độ)</span>
                      <span className="font-mono font-semibold text-[10px] text-indigo-600 dark:text-indigo-400">
                        Σ (P × H)
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-mono font-bold text-xl text-indigo-700 dark:text-indigo-300 tabular-nums">
                        {fmtNum(totalWallArea, 2)}
                      </span>
                      <span className="text-xs font-semibold text-indigo-700/80 dark:text-indigo-400/80">m²</span>
                    </div>
                  </div>
                )}

                {tileConfig.on && (
                  <div className="col-span-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/70 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                      <span className="truncate">Gạch cần mua (+{tileConfig.waste}%)</span>
                      <span className="font-mono text-[10px] font-bold text-amber-700/90 dark:text-amber-300/90 bg-amber-100/70 dark:bg-amber-900/60 px-1.5 py-0.2 rounded">
                        Roan {tileConfig.g}mm
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-mono font-bold text-xl text-amber-700 dark:text-amber-300 tabular-nums">
                        {tileSummary.toBuy}
                      </span>
                      <span className="text-xs font-semibold text-amber-700/80 dark:text-amber-300/80">
                        viên{tileSummary.boxes > 0 ? ` · ${tileSummary.boxes} thùng` : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Thanh tab phân loại + tìm kiếm */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex flex-1 items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700/80 text-[10px] min-w-0">
                  {([
                    ['all', 'Tất cả', measuredPolygons.length],
                    ['floor', 'Sàn', measuredPolygons.filter(p => p.kind !== 'dist').length],
                    ['dist', 'Đo dài', measuredPolygons.filter(p => p.kind === 'dist').length],
                  ] as const).map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setListFilter(key)}
                      className={`flex-1 px-1.5 py-0.5 rounded font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        listFilter === key
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 font-bold shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {label} <span className="tabular-nums opacity-75">({count})</span>
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên..."
                  className="w-24 px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-md shadow-2xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Phần 2: Bảng chi tiết khối lượng (Data Grid) */}
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full border-collapse text-xs tabular-nums border border-slate-300 dark:border-slate-700">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 backdrop-blur-xs text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-wide">
                  <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                    <th className="py-2 px-2.5 text-left font-semibold border-r border-slate-300 dark:border-slate-700">
                      Hạng mục / Vùng
                    </th>
                    <th className="py-2 px-2 text-right font-semibold border-r border-slate-300 dark:border-slate-700">
                      <div>Diện tích (m²)</div>
                      <div className="text-[9px] font-normal normal-case text-teal-600 dark:text-teal-400">Sàn & Tường</div>
                    </th>
                    <th className="py-2 px-2 text-right font-semibold border-r border-slate-300 dark:border-slate-700">
                      <div>Chu vi / Dài (m)</div>
                      <div className="text-[9px] font-normal normal-case text-slate-500 dark:text-slate-400">Cao độ H (m)</div>
                    </th>
                    {tileConfig.on && (
                      <th className="py-2 px-2 text-right font-semibold border-r border-slate-300 dark:border-slate-700">Viên</th>
                    )}
                    <th className="py-2 px-2 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80">
                  {filteredPolygons.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tileConfig.on ? 5 : 4}
                        className="py-10 px-4 text-center text-xs text-slate-400 dark:text-slate-500 leading-normal"
                      >
                        <div className="max-w-[240px] mx-auto space-y-1">
                          <p className="font-semibold text-slate-600 dark:text-slate-400">Chưa có số liệu đo</p>
                          <p className="text-[11px]">
                            {listFilter === 'dist'
                              ? 'Chọn công cụ "Đo dài" và chấm các điểm trên bản vẽ.'
                              : listFilter === 'floor'
                                ? 'Dùng "Vẽ vùng", "Chữ nhật" hoặc "Chọn vùng" trên bản vẽ.'
                                : 'Dùng các công cụ Vẽ vùng, Chữ nhật hoặc Đo dài trên thanh công cụ.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPolygons.map(poly => {
                      const polyIdx = measuredPolygons.findIndex(p => p.id === poly.id)
                      const isSelected = poly.id === selectedPolygonId
                      const isHovered = poly.id === hoveredPolygonId
                      const isExpanded = expandedPolyIds.has(poly.id)
                      const tc = tileConfig.on
                        ? tileCalc(toTakeoffRow(poly, polyIdx), tileConfig, effectiveToMeters)
                        : null
                      const h = poly.heightMeters ?? 0
                      const wallArea = h > 0 ? poly.perimeterMeters * h : 0

                      return (
                        <React.Fragment key={poly.id}>
                          <tr
                            onClick={() => setSelectedPolygonId(isSelected ? null : poly.id)}
                            onMouseEnter={() => setHoveredPolygonId(poly.id)}
                            onMouseLeave={() => setHoveredPolygonId(null)}
                            className={`transition-colors cursor-pointer border-b border-slate-200 dark:border-slate-700/80 ${
                              !poly.visible ? 'opacity-40' : ''
                            } ${
                              isHovered
                                ? 'bg-amber-500/15 dark:bg-amber-500/20'
                                : isSelected
                                  ? 'bg-teal-500/15 dark:bg-teal-500/20'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                            }`}
                          >
                            <td className="py-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700/80" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                                  style={{ backgroundColor: poly.color }}
                                />
                                <input
                                  type="text"
                                  value={poly.name}
                                  onChange={e => {
                                    const val = e.target.value
                                    setMeasuredPolygons(prev =>
                                      prev.map(item =>
                                        item.id === poly.id ? { ...item, name: val } : item
                                      )
                                    )
                                  }}
                                  className="w-full min-w-[70px] bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-teal-500 focus:outline-none font-medium text-slate-900 dark:text-slate-100 text-xs truncate"
                                />
                                {poly.layoutName && (
                                  <span
                                    className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0"
                                    title={`Sheet / Không gian: ${poly.layoutName}`}
                                  >
                                    {poly.layoutName}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 pl-4">
                                {poly.kind === 'dist' ? 'Đoạn thẳng / Tuyến' : 'Vùng sàn khép kín'}
                              </div>
                            </td>

                            <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap border-r border-slate-200 dark:border-slate-700/80">
                              {poly.kind === 'dist' ? (
                                wallArea > 0 ? (
                                  <div>
                                    <div className="text-[10px] text-indigo-500 font-sans font-semibold">Vách (L×H)</div>
                                    <div className="font-bold text-indigo-600 dark:text-indigo-400">
                                      {wallArea.toFixed(2)} m²
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-normal">—</span>
                                )
                              ) : (
                                <div>
                                  <div className="font-bold text-teal-700 dark:text-teal-400">
                                    {poly.areaSquareMeters.toFixed(2)} m²
                                    <span className="text-[9px] text-slate-400 font-sans font-normal ml-0.5">sàn</span>
                                  </div>
                                  {wallArea > 0 && (
                                    <div
                                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5"
                                      title={`Diện tích tường = Chu vi (${poly.perimeterMeters.toFixed(2)}m) × Cao độ (${h}m)`}
                                    >
                                      {wallArea.toFixed(2)} m²
                                      <span className="text-[9px] text-indigo-400 font-sans font-normal ml-0.5">tường</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td
                              className="py-1.5 px-2 text-right font-mono whitespace-nowrap border-r border-slate-200 dark:border-slate-700/80"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                                {poly.perimeterMeters.toFixed(2)} m
                              </div>
                              <div className="flex items-center justify-end gap-1 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-sans">H:</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="0"
                                  placeholder="0"
                                  value={poly.heightMeters !== undefined ? poly.heightMeters : ''}
                                  onChange={e => {
                                    const val = e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0)
                                    setMeasuredPolygons(prev =>
                                      prev.map(item => (item.id === poly.id ? { ...item, heightMeters: val } : item))
                                    )
                                  }}
                                  title="Nhập chiều cao tường H (m) để tính diện tích tường (P × H)"
                                  className="w-13 px-1 py-0.2 text-right font-mono text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:border-teal-500 focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-400 font-sans">m</span>
                              </div>
                            </td>

                            {tileConfig.on && (
                              <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700/80">
                                {tc && !tc.big ? tc.full + tc.cut : <span className="text-slate-300">—</span>}
                              </td>
                            )}

                            <td
                              className="py-1.5 px-1.5 text-right whitespace-nowrap"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPolyIds(prev => {
                                      const next = new Set(prev)
                                      if (next.has(poly.id)) next.delete(poly.id)
                                      else next.add(poly.id)
                                      return next
                                    })
                                  }
                                  title={isExpanded ? 'Ẩn chi tiết các đoạn' : 'Hiện chi tiết các đoạn'}
                                  className={`px-1.5 py-0.5 text-[10px] leading-3 font-semibold rounded cursor-pointer transition-colors ${
                                    isExpanded
                                      ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300'
                                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {poly.segments.length}đ {isExpanded ? '▾' : '▸'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMeasuredPolygons(prev =>
                                      prev.map(item =>
                                        item.id === poly.id
                                          ? { ...item, visible: !item.visible }
                                          : item
                                      )
                                    )
                                  }
                                  title={poly.visible ? 'Ẩn trên bản vẽ' : 'Hiện trên bản vẽ'}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-colors"
                                >
                                  {poly.visible ? (
                                    <Eye className="w-3.5 h-3.5" />
                                  ) : (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLocatePolygon(poly)}
                                  title="Định vị tâm vùng trên bản vẽ"
                                  className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded cursor-pointer transition-colors"
                                >
                                  <Crosshair className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHistory(h => [...h.slice(-29), measuredPolygonsRef.current])
                                    setRedoStack([])
                                    setMeasuredPolygons(prev =>
                                      prev.filter(item => item.id !== poly.id)
                                    )
                                  }}
                                  title="Xóa vùng đo"
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Chi tiết các đoạn: mặc định ẩn, bấm nút "Nđ ▸" để hiện */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-700/80">
                              <td colSpan={tileConfig.on ? 5 : 4} className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {poly.segments.map(seg => (
                                    <span
                                      key={seg.index}
                                      title={`P${seg.index}→P${(seg.index % poly.points.length) + 1}`}
                                      className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 text-[10px] font-mono shadow-2xs"
                                    >
                                      <span className="text-slate-400">Đ{seg.index}</span>
                                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                                        {seg.lengthMeters.toFixed(2)}m
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-600 font-semibold text-xs">
                  <tr>
                    <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 border-r border-slate-300 dark:border-slate-700">
                      Tổng cộng
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap border-r border-slate-300 dark:border-slate-700">
                      <div className="text-teal-700 dark:text-teal-400 font-bold">
                        {fmtNum(totalArea, 2)} m² <span className="text-[9px] font-normal text-slate-400">sàn</span>
                      </div>
                      {totalWallArea > 0 && (
                        <div className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px] mt-0.5">
                          {fmtNum(totalWallArea, 2)} m² <span className="text-[9px] font-normal text-indigo-400">tường</span>
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap border-r border-slate-300 dark:border-slate-700">
                      {fmtNum(totalPerimeter, 2)} m
                    </td>
                    {tileConfig.on && (
                      <td className="py-1.5 px-1.5 text-right font-mono whitespace-nowrap border-r border-slate-300 dark:border-slate-700">
                        {tileSummary.total > 0 ? tileSummary.total : ''}
                      </td>
                    )}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </aside>
        )}
      </main>

      {/* Modal Quản lý Font CAD & Hỗ trợ Tiếng Việt */}
      {showFontModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowFontModal(false)}
        >
          <div
            className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Type className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Quản lý Font CAD & Đọc Tiếng Việt
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tự động nhận diện TCVN3 / VNI / Unicode & Nạp font .SHX, .TTF tùy biến
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFontModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Trạng thái hỗ trợ font */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Các chuẩn mã tiếng Việt & Font được hỗ trợ tự động:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>TCVN3 / ABC (1-byte)</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    .VnTime, .VnTimeH, .VnArial, vntime.shx... Tự động dịch sang Unicode chuẩn để vẽ lên Canvas.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>VNI-Windows (2-byte)</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    VNI-Times, VNI-Helve, VNI-Avo, vni.shx... Tự động giải mã dấu tiếng Việt chuẩn xác.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40">
                  <div className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Unicode & Windows-1258</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    UTF-8, UTF-16, Arial, Times New Roman, Tahoma, Roboto, Be Vietnam Pro.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
                  <div className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>AutoCAD SHX Vector Fonts</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    Ánh xạ nét vẽ simplex.shx, txt.shx, romans.shx và nạp trực tiếp file .shx từ bên ngoài.
                  </div>
                </div>
              </div>
            </div>

            {/* Khu vực Tự động Tải Font bị thiếu (Online & Offline) */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Tự động tải &amp; Bù Font CAD</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                      Tạm tắt (Tối ưu tốc độ mở bản vẽ)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Đã tạm tắt tải font ngầm qua mạng khi mở file để bản vẽ hiển thị nhanh tức thì. Tất cả font CAD tiếng Việt (<span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">VnHelvetInsH, VnArial, VnTime, Simplex...</span>) được tự động ánh xạ trực tiếp sang bộ font hệ thống (Arial, Times New Roman) siêu nhẹ.
                  </p>
                </div>
                <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isFontLoading}
                    onClick={handleAutoDownloadMissingFonts}
                    title="Quét bản vẽ hiện tại và tải thủ công các font còn thiếu khi cần"
                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-98 text-slate-800 dark:text-slate-100 font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50 text-[11px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải font thủ công</span>
                  </button>
                  <button
                    type="button"
                    disabled={isFontLoading}
                    onClick={handlePreloadAllEssentialFonts}
                    title="Nạp gói font CAD tiếng Việt chuẩn vào bộ nhớ đệm"
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-400 font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <RotateCw className="w-3 h-3 text-slate-400" />
                    <span>Nạp gói font CAD ({ESSENTIAL_CAD_FONTS.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Khu vực nạp thêm file Font từ máy tính */}
            <div className="p-3.5 rounded-xl border border-dashed border-teal-500/50 bg-teal-50/40 dark:bg-teal-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <FileUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Nạp thêm Font CAD từ máy tính (.SHX, .TTF, .WOFF)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Nếu bản vẽ hiển thị dấu hỏi (?) do thiếu font đặc thù của dự án, hãy nạp file font tại đây.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isFontLoading}
                  onClick={() => fontInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>{isFontLoading ? 'Đang nạp...' : 'Chọn file Font'}</span>
                </button>
              </div>

              {/* Danh sách font đã lưu trong bộ nhớ đệm IndexedDB */}
              {cachedFontList.length > 0 ? (
                <div className="pt-2 border-t border-teal-200/60 dark:border-teal-900/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Font tùy biến đã nạp ({cachedFontList.length}):
                    </span>
                    <button
                      type="button"
                      onClick={handleClearCachedFonts}
                      className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer hover:underline"
                    >
                      Xóa danh sách
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {cachedFontList.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800/60 font-mono text-[10px] text-teal-800 dark:text-teal-300"
                      >
                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                        <span>{f}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                  Chưa có file font tùy biến nào được nạp (Hệ thống đang dùng các font mặc định đã tích hợp sẵn).
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleRegenFonts}
                title="Quét lại toàn bộ chữ tiếng Việt trong bản vẽ và vẽ lại"
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Làm mới chữ (Regen)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFontModal(false)}
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mở bản vẽ DWG/DXF từ URL */}
      {showUrlModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowUrlModal(false)}
        >
          <div
            className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xl space-y-3 text-xs"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Mở bản vẽ DWG / DXF từ đường dẫn URL
              </h3>
              <button
                type="button"
                onClick={() => setShowUrlModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <input
              type="url"
              value={remoteUrlInput}
              onChange={e => setRemoteUrlInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && remoteUrlInput.trim()) {
                  loadCadUrl(remoteUrlInput)
                  setShowUrlModal(false)
                }
              }}
              placeholder="https://example.com/ban-ve.dwg"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs focus:outline-none focus:border-teal-600"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowUrlModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!remoteUrlInput.trim()}
                onClick={() => {
                  loadCadUrl(remoteUrlInput)
                  setShowUrlModal(false)
                }}
                className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white font-semibold cursor-pointer"
              >
                Tải bản vẽ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hướng dẫn & Phím tắt */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xl space-y-4 text-xs"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Hướng dẫn Đọc Xem DWG/DXF & Đo Khối Lượng CAD
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-slate-600 dark:text-slate-300 leading-relaxed">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  1. Đọc Xem Full DWG & DXF, Chuyển đổi Sheet / Layout
                </p>
                <p>
                  • Hỗ trợ mở trực tiếp cả <strong>.DWG</strong> (AutoCAD R14–2025 qua LibreDWG WebAssembly) và <strong>.DXF</strong>, đọc đầy đủ các tab <strong>Model</strong> và <strong>Paper Space Sheets / Layouts</strong> ở thanh dưới đáy màn hình.
                  <br />• Dùng công cụ <strong>Tra cứu</strong> để xem thuộc tính chi tiết của từng đối tượng CAD, hoặc bấm <strong>Tìm chữ (Ctrl+F)</strong> để tìm nhanh văn bản trên toàn bộ các Sheet.
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  2. Phím tắt thao tác nhanh
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">Enter</span> / Click P1: Đóng vùng
                  </div>
                  <div>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">Nhấp chuột phải</span> / Backspace: Lùi 1 điểm (Undo)
                  </div>
                  <div>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">Bấm giữ chuột kéo</span>: Di chuyển (Pan) cả trái/phải
                  </div>
                  <div>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">Ctrl + F</span>: Tìm chữ trong CAD
                  </div>
                  <div>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">O / Shift</span>: Khóa vuông góc 90°
                  </div>
                  <div>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">Esc</span>: Hủy vùng đang chọn
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <div className="flex flex-col items-start gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpModal(false)
                    setShowChangelogModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 text-teal-600 dark:text-teal-400 hover:underline font-mono text-[11px] cursor-pointer font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>BOC CAD v{APP_VERSION} (Nhật ký cập nhật)</span>
                </button>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {APP_COPYRIGHT}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lịch sử Cập nhật & Phiên bản */}
      {showChangelogModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowChangelogModal(false)}
        >
          <div
            className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Nhật ký Cập nhật & Phiên bản
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      v{APP_VERSION}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Bản dựng ngày: {APP_BUILD_DATE} • BOC CAD Viewer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangelogModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-base cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Danh sách các phiên bản */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {CHANGELOG_HISTORY.map((rel, idx) => {
                const isLatest = idx === 0
                return (
                  <div
                    key={rel.version}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isLatest
                        ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/80 shadow-2xs'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                          v{rel.version}
                        </span>
                        {rel.tag && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white shadow-2xs">
                            {rel.tag}
                          </span>
                        )}
                        <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                          {rel.title}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                        {rel.date}
                      </span>
                    </div>

                    <ul className="space-y-1.5">
                      {rel.changes.map((ch, cIdx) => (
                        <li key={cIdx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 mt-0.5 ${
                              ch.category === 'Tối ưu'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : ch.category === 'Tính năng mới'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                  : ch.category === 'Giao diện'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            }`}
                          >
                            {ch.category}
                          </span>
                          <span>{ch.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 shrink-0 flex-wrap gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {APP_COPYRIGHT} • Phát triển bởi {APP_AUTHOR}
              </span>
              <button
                type="button"
                onClick={() => setShowChangelogModal(false)}
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CadViewer
