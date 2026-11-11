# 📐 BOC CAD Viewer — Web CAD 2D & Quantity Takeoff Tool

<div align="center">

![BOC CAD Viewer Version](https://img.shields.io/badge/version-v0.2.0-blue.svg?style=flat-square)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4.1-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=flat-square&logo=vite&logoColor=white)
![LibreDWG](https://img.shields.io/badge/LibreDWG-WebAssembly-orange.svg?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)

**Trình xem bản vẽ AutoCAD 2D (DWG/DXF) & Công cụ đo bóc tách khối lượng (Takeoff) chuyên nghiệp trực tiếp trên nền tảng Web.**

[Tính năng nổi bật](#-tính-năng-nổi-bật) • [Cài đặt & Chạy](#-cài-đặt--chạy-dự-án) • [Công nghệ](#-công-nghệ-sử-dụng) • [Phím tắt](#-phím-tắt-thao-tác) • [Lịch sử phiên bản](#-lịch-sử-phiên-bản)

</div>

---

## 🌟 Giới thiệu tổng quan

**BOC CAD Viewer** là giải pháp phần mềm Web nhẹ, tốc độ cao, cho phép kỹ sư, kiến trúc sư, nhà thầu và giám sát công trình mở và xem trực tiếp các bản vẽ kỹ thuật định dạng **AutoCAD .DWG** (AutoCAD R14 đến AutoCAD 2025) và **.DXF** mà **không cần cài đặt AutoCAD hay phần mềm chuyên dụng**.

Ứng dụng tích hợp bộ giải pháp bóc tách khối lượng (Quantity Takeoff) thông minh: đo diện tích đa giác khép kín bằng thuật toán Shoelace, tự động nhận diện biên dạng vùng kín, đo chiều dài đa tuyến, tính toán chi tiết khối lượng và hao hụt gạch ốp lát sàn, hỗ trợ đầy đủ font chữ tiếng Việt kỹ thuật và xuất bảng dữ liệu sang Excel chỉ với một cú nhấp chuột.

---

## 🚀 Tính năng nổi bật

### 1. Đọc và hiển thị bản vẽ AutoCAD chuẩn xác
- **Hỗ trợ định dạng đầy đủ**: Đọc mượt mà cả tệp `.DWG` (thông qua lõi LibreDWG biên dịch WebAssembly chạy trực tiếp trên client) và `.DXF`.
- **Đa không gian vẽ (Sheets / Layouts)**: Hỗ trợ tab `Model Space` cùng toàn bộ các trang in `Paper Space / Layout Tabs` chuẩn AutoCAD ở thanh điều hướng chân trang.
- **Quản lý đa bản vẽ (Multi-Document Tabs)**: Mở nhiều file CAD cùng lúc trên các tab độc lập, chuyển đổi nhanh không cần tải lại trang.
- **Quản lý lớp đối tượng (Layers)**: Bật/Tắt, Đóng băng (Freeze/Thaw), Khóa lớp, chức năng ẩn lớp nhanh (`LAYOFF`) và bật lại toàn bộ lớp (`LAYON`).
- **Chồng lớp bản vẽ tham chiếu (XREF Overlay)**: Chồng lớp nhiều bản vẽ DWG/DXF lên nhau để so sánh phương án thiết kế hoặc kiểm tra xung đột kết cấu - kiến trúc - cơ điện.

### 2. Hỗ trợ tiếng Việt chuyên sâu cho bản vẽ CAD
- Tự động nhận diện và giải mã chính xác các bảng mã tiếng Việt phổ biến trong bản vẽ xây dựng Việt Nam: **TCVN3 (ABC / .VnTime)**, **VNI-Windows**, **Unicode chuẩn**, và các phông chữ kỹ thuật dạng **SHX** (`vntime.shx`, `vn_vni.shx`, `txt.shx`, `simplex.shx`...).
- Công cụ tìm kiếm nội dung văn bản (`Ctrl + F`) quét sâu toàn bộ đối tượng `Text` và `MText` trên mọi Layout.

### 3. Tối ưu cảm ứng Mobile & Tablet 60fps mượt mà
- **Pipeline gom cử chỉ `requestAnimationFrame`**: Điều hướng vuốt kéo di chuyển (Pan) và thao tác thu phóng 2 ngón (Pinch-to-zoom) được tích lũy và xử lý mượt mà 60 khung hình/giây.
- **Khử hiện tượng Layout Thrashing**: Không gọi reflow DOM trong chu kỳ render canvas.
- **Giới hạn DPR thông minh (Device Pixel Ratio Clamping)**: Tự động điều tiết tỉ lệ điểm ảnh tối đa 2x trên màn hình OLED độ phân giải cao, triệt tiêu hiện tượng tràn bộ nhớ GPU và giật lag khi xem bản vẽ lớn trên điện thoại.

### 4. Bộ công cụ đo đạc & Bóc tách khối lượng (Takeoff)
- **Tự động bắt điểm hình học (OSNAP)**: Điểm đầu/cuối (`EndPoint`), Trung điểm (`MidPoint`), Tâm đường tròn (`Center`), Giao điểm (`Intersection`).
- **Chọn vùng kín tự động (Auto Boundary)**: Tự nhận diện các đường bao Polyline/Line khép kín trên bản vẽ để tính diện tích tức thì.
- **Đo đa giác tự do (Polygon Area)**: Chấm các đỉnh liên tiếp để đo diện tích các phòng, sàn có hình thù phức tạp theo công thức Shoelace.
- **Đo hình chữ nhật (Rectangle)**: Chỉ cần 2 điểm góc đối diện để đo nhanh diện tích sàn, trần, vách.
- **Đo chiều dài đa tuyến (Polyline Distance)**: Đo tổng chiều dài chu vi tường, len chân tường, ống nước, dây điện.
- **Hiệu chuẩn tỉ lệ (Calibrate Scale)**: Chấm 2 điểm trên một đoạn kích thước thực tế để hiệu chuẩn chính xác tỉ lệ đo đạc trên mọi tỷ lệ bản vẽ.

### 5. Tính toán phân bổ & Bóc tách Gạch lát nền (Tile Takeoff Calculator)
- Cấu hình kích thước gạch tiêu chuẩn (600×1200 mm, 800×800 mm, 300×600 mm, thanh gỗ 150×900 mm...) hoặc nhập kích thước tùy chọn.
- Tự động xoay và dời gốc định vị lưới gạch (`Grid Origin`) theo cạnh phòng để tối ưu thẩm mỹ.
- Tính toán chính xác số viên nguyên, số viên bị cắt bìa, tỷ lệ hao hụt (%) và quy đổi số thùng/hộp gạch cần đặt mua.

### 6. Xuất bản vẽ và Báo cáo dữ liệu
- **Xuất bảng khối lượng sang Excel (.xlsx)**: Đầy đủ tên vùng, diện tích, chu vi, kích thước gạch, số viên, số hộp.
- **Xuất bản vẽ kỹ thuật**: Hỗ trợ xuất sang định dạng vector `.DXF`, `.SVG`, ảnh độ nét cao `.PNG`, hoặc đóng gói trang Web tự hành `.HTML`.

---

## 🛠 Công nghệ sử dụng

| Lớp công nghệ | Thư viện & Công cụ | Mục đích |
| :--- | :--- | :--- |
| **Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Giao diện tương tác và kiến trúc kiểu an toàn |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Giao diện hiện đại, Dark Mode, UI/UX Pro Max Theme |
| **Build Tool** | [Vite 6](https://vite.dev/) | HMR siêu tốc và tối ưu đóng gói bundle |
| **CAD Core** | `@mlightcad/cad-simple-viewer`, `@mlightcad/data-model` | Lõi xử lý dữ liệu và cấu trúc thực thể CAD |
| **DWG Parser** | `LibreDWG WebAssembly` (`libredwg.worker.js`) | Phân tích tệp DWG trực tiếp trên Web Worker không cần backend |
| **Đồ họa 2D** | HTML5 Canvas + [Three.js](https://threejs.org/) | Kết xuất bản vẽ mượt mà với phần cứng GPU |
| **Biểu tượng** | SVG Lucide Icons nhúng inline | Không phụ thuộc thư viện ngoài, tối ưu dung lượng tải |

---

## 💻 Cài đặt & Chạy dự án

### Yêu cầu môi trường
- **Node.js**: Phiên bản 18.x trở lên (khuyên dùng Node.js 20 hoặc 22 LTS).
- **Trình quản lý gói**: `npm`, `pnpm` hoặc `yarn`.

### Các bước thực hiện

1. **Clone repository về máy**:
   ```bash
   git clone https://github.com/thinhhand/boc-cad-viewer.git
   cd boc-cad-viewer
   ```

2. **Cài đặt các gói phụ thuộc (Dependencies)**:
   ```bash
   npm install
   ```

3. **Chạy máy chủ phát triển (Development Server)**:
   ```bash
   npm run dev
   ```
   Sau đó truy cập: `http://localhost:5173/` trên trình duyệt.

4. **Đóng gói phiên bản Production**:
   ```bash
   npm run build
   ```
   Mã nguồn tối ưu sau khi build sẽ nằm trong thư mục `dist/`.

5. **Xem trước bản build (Preview)**:
   ```bash
   npm run preview
   ```

---

## ⌨️ Phím tắt thao tác

| Phím tắt | Thao tác | Mô tả |
| :--- | :--- | :--- |
| **Giữ chuột trái/phải & kéo** | Di chuyển (Pan) | Di chuyển góc nhìn bản vẽ nhanh |
| **Cuộn con lăn chuột** | Thu phóng (Zoom) | Phóng to hoặc thu nhỏ tại vị trí con trỏ chuột |
| **Enter** hoặc **Bấm trúng P1** | Hoàn tất vùng | Khép kín đa giác và đưa kết quả vào bảng khối lượng |
| **Nhấp chuột phải** hoặc **Backspace** | Lùi 1 điểm (Undo) | Xóa điểm vừa chấm gần nhất |
| **Esc** | Hủy lệnh | Hủy bỏ vùng đang vẽ dở dang |
| **Ctrl + F** | Tìm chữ | Mở hộp thoại tìm kiếm văn bản trong bản vẽ |
| **O** hoặc **Giữ Shift** | Khóa Ortho 90° | Khóa đường vẽ vuông góc theo trục X / Y |
| **Double Click (Chuột giữa)** | Khớp khung (Zoom to Fit) | Đưa toàn bộ bản vẽ vừa vặn vào màn hình |

---

## 📦 Cấu trúc thư mục

```text
boc-cad-viewer/
├── public/                     # Tài nguyên tĩnh, Web Workers và font mẫu
│   ├── samples/                # File CAD mẫu .dwg, .dxf để thử nghiệm
│   └── workers/                # LibreDWG WASM parser & MText renderer workers
├── src/
│   ├── components/
│   │   └── CadViewer.tsx       # Component CAD Viewer chính (Viewport, Toolbar, Takeoff, Overlays)
│   ├── types/
│   │   └── takeoff.ts          # Định nghĩa kiểu dữ liệu cho khối lượng, gạch và layer
│   ├── utils/
│   │   ├── dxfParser.ts        # Thuật toán tính Shoelace, PIP, phân mảnh lưới gạch tileCalc
│   │   ├── geometry.ts         # Bắt điểm OSNAP, biến đổi hệ tọa độ WCS / Screen
│   │   ├── lucideIcons.tsx     # Bộ icon Lucide SVG tối ưu
│   │   └── vietnameseFontUtils.ts # Nhận diện & giải mã font AutoCAD tiếng Việt
│   ├── version.ts              # Quản lý số hiệu phiên bản và nhật ký cập nhật (Changelog)
│   ├── App.tsx                 # Root Application
│   └── main.tsx                # Entry point
├── package.json
└── vite.config.ts
```

---

## 📋 Lịch sử phiên bản (Changelog)

- **`v0.2.0` (Mới nhất)**:
  - Tối ưu cử chỉ cảm ứng 60fps trên mobile/tablet qua pipeline `requestAnimationFrame`.
  - Khử Layout Thrashing và tối ưu DPR canvas tối đa 2x chống nghẽn GPU trên màn hình OLED.
  - Tinh gọn thanh công cụ vẽ & đo CAD (Icon-first compact toolbar), chống nhảy layout.
  - Thiết kế lại Menu Tùy chọn hiển thị & Xuất file CAD (DXF, PNG, SVG, HTML) chuẩn responsive.
  - Thêm hệ thống hiển thị số hiệu phiên bản và cửa sổ nhật ký cập nhật trực quan.
- **`v0.1.5`**:
  - Tự động nhận diện và cấu hình font AutoCAD tiếng Việt chuẩn TCVN3, VNI, Unicode và SHX.
  - Hỗ trợ mở và chuyển đổi linh hoạt nhiều tệp DWG/DXF trên các tab riêng biệt (Multi-Tabs).
  - Chồng lớp bản vẽ tham chiếu ngoài (XREF Overlay) và tính năng bóc tách gạch lát nền.
- **`v0.1.0`**:
  - Khởi tạo nền tảng BOC CAD Viewer Web đọc chuẩn tệp DWG & DXF.
  - Đo diện tích Shoelace, đo chiều dài và tự động bắt điểm hình học OSNAP.

---

## 📄 Giấy phép (License)

Dự án được phân phối dưới giấy phép [MIT License](LICENSE).
Mọi đóng góp, báo cáo lỗi hoặc yêu cầu tính năng mới đều được hoan nghênh tại [Issues](https://github.com/thinhhand/boc-cad-viewer/issues).
