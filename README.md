# Bảng giá động — In Siêu Tốc

Widget HTML/JS thuần (no framework) hiển thị bảng giá động cho 5 dịch vụ in: tờ rơi, name card, tem nhãn, decal giấy tròn, catalogue.

## Demo

**Mở demo trực tiếp trên GitHub Pages:** [https://longdz1204.github.io/bang-gia-dong-ist/]([url](https://longdz1204.github.io/bang-gia-dong-ist/))

## Cấu trúc

- `index.html` + `assets/style.css` + `assets/app.js` — phiên bản phát triển, cần chạy qua local server vì fetch `data/bang_gia.json`:
  ```bash
  python3 -m http.server 8000
  # mở http://localhost:8000
  ```
- `demo.html` — file ĐƠN LẺ inline toàn bộ CSS + JS + data. Mở trực tiếp bằng double-click, không cần server. Dùng để gửi review nhanh.
- `data/bang_gia.json` — dữ liệu giá (852 row, 5 dịch vụ + 1 phụ phí). Build từ `bang_gia_flat_insieutoc_v6.xlsx`.
- `bang_gia_flat_insieutoc_v6.xlsx` — nguồn gốc giá + spec workflow cho dev (sheet `WF_*`, `MAP_TRUONG`, `HUONG_DAN`).
- `build_data.py` — script chuyển xlsx → json. Chạy lại mỗi khi giá thay đổi:
  ```bash
  python3 build_data.py
  ```

## Logic bảng giá

Xem chi tiết trong sheet `HUONG_DAN` của file xlsx. Tóm tắt:

- **Tờ rơi**: 3 nguồn giá (KTS / Offset ghép bài / Offset bài riêng) → lookup cùng combo, lấy giá thấp nhất. Offset ghép bài có `don_vi_gia = "VNĐ/tổng"` (giá trọn gói).
- **Tem nhãn**: cascade. Field con (`hinh_dang`, `kich_thuoc`) chỉ hiển thị option có data cho upstream đã chọn. Field vẫn visible khi upstream chưa pick — hiện thông báo "Vui lòng chọn yếu tố phía trên trước".
- **Catalogue**: tổng = `(giá in + phụ phí đóng kim) × số cuốn`. Phụ phí đóng kim lookup riêng theo bậc số lượng.
- **Số lượng**: dropdown `<select>`. Tier nào không có data thực cho combo hiện tại → user vẫn chọn được, ô **Tổng cộng** sẽ tự hiển thị `"Liên hệ báo giá"`.
