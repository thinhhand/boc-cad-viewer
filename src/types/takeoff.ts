export type Point = [number, number];

export type ToolMode = 'pan' | 'area' | 'poly' | 'rect' | 'dist' | 'cal' | 'layoff';

export interface DxfText {
  pt: Point;
  text: string;
  height: number;
  layer: string;
}

export interface DxfShape {
  pts: Point[];
  closed: boolean;
  layer: string;
  bb: [number, number, number, number];
  area: number;
  roomLabel?: string;
  fromInsert?: boolean;
  fromHatch?: boolean;
  isCurve?: boolean;
}

export interface ClutterFilterConfig {
  cleanMode: boolean; // Chế độ Tường & Sàn (1-click lọc gọn)
  hideInsertBlocks: boolean; // Ẩn khối Block rời (Nội thất, TBVS, Cửa, Cây...)
  hideHatch: boolean; // Ẩn các vùng Hatch tô mẫu vật liệu
  hideSmallCurves: boolean; // Ẩn đường cong / tròn nhỏ (bồn cầu, lavabo, quạt, đồ rời...)
  hideCadTexts: boolean; // Ẩn chữ ghi chú CAD trên mặt bằng
  minSizeM: number; // Ngưỡng ẩn chi tiết vụn nhỏ hơn X mét (0 = tắt)
}

export interface DxfMetadata {
  insUnitsCode: number;
  unitFactor: number | null;
  unitLabel: string;
  totalShapes: number;
  closedShapes: number;
  textCount: number;
  layerCount: number;
  blockCount: number;
  insertCount: number;
  hatchCount: number;
  hiddenByCadLayers: string[];
}

export type TilePattern = 'grid' | 'running' | 'third' | 'herringbone' | 'herringbone90';

export interface TileCell {
  x: number;
  y: number;
  w: number;
  h: number;
  isCut: boolean;
  pts?: Point[]; // tọa độ 4 đỉnh cho gạch lát chéo / xương cá
}

export interface TileResult {
  big?: boolean;
  full: number;
  cut: number;
  cells: TileCell[];
}

export interface TakeoffRow {
  id: number;
  name: string;
  kind: 'area' | 'poly' | 'dist';
  si?: number; // shape index if selected from DXF closed polyline
  pts: Point[];
  area: number; // in drawing units squared
  len: number; // perimeter or length in drawing units
  visible?: boolean;
  tcKey?: string;
  tc?: TileResult | null;
}

export interface TileConfig {
  on: boolean;
  w: number; // mm
  h: number; // mm
  g: number; // grout mm (độ rộng roan / mạch gạch)
  waste: number; // %
  box: number; // tiles per box
  offsetX: number; // 0..99 %
  offsetY: number; // 0..99 %
  groutColor?: string; // màu đường roan gạch
  pattern?: TilePattern; // kiểu lát gạch: 'grid' | 'running' | 'third' | 'herringbone' | 'herringbone90'
}

export interface HistoryState {
  rows: TakeoffRow[];
  tmp: Point[];
}

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: string;
  fileName: string;
  dxfUnit: number;
  tileConfig: TileConfig;
  rows: Omit<TakeoffRow, 'tcKey' | 'tc'>[];
  shapes: DxfShape[];
  texts?: DxfText[];
}
