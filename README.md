# LYSILK · Lồng khung ảnh Shopee

Web tĩnh giúp ghép 3 ảnh sản phẩm vào khung thương hiệu LYSILK rồi xuất ra 2 file PNG (vuông 1000×1000 và 3:4 1200×1600) để up lên Shopee.

## Workflow

1. Copy ảnh từ Pancake / supplier / nguồn bất kỳ.
2. Mở web → bấm vào ô paste → `Cmd/Ctrl + V` để dán (lặp lại với 5-10 ảnh).
3. Kéo thumbnail từ pool vào 3 ô (1 lớn bên phải, 2 nhỏ bên trái xếp dọc) cho cả khung vuông và khung 3:4.
4. Bấm "Tải về" → 2 PNG đã lồng khung tự download.

## Cấu trúc

- `index.html` — UI 1 trang.
- `app.js` — paste handler, drag-and-drop, canvas renderer, download.
- `styles.css` — layout.
- `assets/khung-vuong.png` — khung 1000×1000.
- `assets/khung-3x4.png` — khung 1200×1600.

Xử lý ảnh hoàn toàn ở client (HTML5 Canvas). Không cần server, không upload đi đâu.
