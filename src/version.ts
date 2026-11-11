export interface ReleaseChange {
  category: 'Tối ưu' | 'Tính năng mới' | 'Giao diện' | 'Sửa lỗi'
  description: string
}

export interface ReleaseNote {
  version: string
  date: string
  title: string
  tag?: string
  changes: ReleaseChange[]
}

export const APP_VERSION = '0.2.0'
export const APP_BUILD_DATE = '07/11/2026'
export const APP_AUTHOR = 'Đặng Ngọc Thịnh'
export const APP_COPYRIGHT = '© 2026 Đặng Ngọc Thịnh'

export const CHANGELOG_HISTORY: ReleaseNote[] = [
  {
    version: '0.2.0',
    date: '07/11/2026',
    title: 'Tối ưu cảm ứng Mobile 60fps & Toolbar tinh gọn',
    tag: 'Mới nhất',
    changes: [
      {
        category: 'Tối ưu',
        description: 'Đạt chuẩn 60fps mượt mà trên mobile: gom cử chỉ vuốt Pan & thu phóng 2 ngón tay qua requestAnimationFrame.',
      },
      {
        category: 'Tối ưu',
        description: 'Khử Layout Thrashing và tối ưu DPR canvas tối đa 2x chống nghẽn băng thông GPU trên màn hình OLED.',
      },
      {
        category: 'Tối ưu',
        description: 'Tạm hoãn tính toán cắt gạch nặng (tileCalc) trong lúc ngón tay lướt kéo, vẽ lại sắc nét khi thả tay.',
      },
      {
        category: 'Giao diện',
        description: 'Thanh công cụ vẽ & đo CAD tinh gọn (icon-first), cố định kích thước chống co giật thanh toolbar.',
      },
      {
        category: 'Giao diện',
        description: 'Menu Tùy chọn DWG / DXF & Xuất file được căn chỉnh lại vị trí hiển thị, không bị tràn hay che khuất.',
      },
    ],
  },
  {
    version: '0.1.5',
    date: '06/11/2026',
    title: 'Font CAD tiếng Việt & Đa bản vẽ Multi-Tabs',
    changes: [
      {
        category: 'Tính năng mới',
        description: 'Tự động nhận diện và cấu hình font AutoCAD tiếng Việt chuẩn TCVN3, VNI, Unicode và SHX.',
      },
      {
        category: 'Tính năng mới',
        description: 'Hỗ trợ mở và chuyển đổi linh hoạt nhiều tệp DWG / DXF cùng lúc trên các tab riêng biệt.',
      },
      {
        category: 'Tính năng mới',
        description: 'Chồng lớp bản vẽ tham chiếu ngoài (XREF Overlay) và tra cứu chi tiết thực thể CAD (Entity Info).',
      },
      {
        category: 'Tính năng mới',
        description: 'Tính toán phân bổ và hao hụt gạch lát nền (Tile Takeoff Calculator).',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '01/11/2026',
    title: 'Khởi tạo nền tảng BOC CAD Viewer Web',
    changes: [
      {
        category: 'Tính năng mới',
        description: 'Trình xem bản vẽ CAD 2D trên web hỗ trợ chuẩn định dạng AutoCAD .DWG và .DXF.',
      },
      {
        category: 'Tính năng mới',
        description: 'Tự động bắt điểm hình học OSNAP (EndPoint, MidPoint, Intersection, Center).',
      },
      {
        category: 'Tính năng mới',
        description: 'Đo diện tích bằng thuật toán Shoelace, đo chiều dài và xuất khối lượng sang Excel.',
      },
    ],
  },
]
