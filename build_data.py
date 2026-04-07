"""Convert sheet BANG_GIA in bang_gia_flat_insieutoc_v6.xlsx -> data/bang_gia.json

Run once:  python3 build_data.py
"""
import json
from pathlib import Path
import openpyxl

ROOT = Path(__file__).parent
XLSX = ROOT / "bang_gia_flat_insieutoc_v6.xlsx"
OUT = ROOT / "data" / "bang_gia.json"

COLS = [
    "dich_vu", "kich_thuoc", "chat_lieu", "hinh_dang", "so_mat", "can_mang",
    "loai_giay", "so_trang", "so_luong", "don_gia", "don_vi_gia", "don_vi_sl", "ghi_chu",
]

# 5 dich vu user-facing (Phu phi catalogue dung internal khi tinh catalogue)
SERVICES = [
    {
        "id": "to_roi",
        "label": "In tờ rơi",
        "fields": ["kich_thuoc", "so_mat", "can_mang", "so_luong"],
        "field_labels": {
            "kich_thuoc": "Kích thước",
            "so_mat": "Số mặt in",
            "can_mang": "Cán màng",
            "so_luong": "Số lượng",
        },
        "qty_tiers": [
            {"value": 10, "label": "10 tờ"},
            {"value": 20, "label": "20 tờ"},
            {"value": 50, "label": "50 tờ"},
            {"value": 100, "label": "100 tờ"},
            {"value": 200, "label": "200 tờ"},
            {"value": 300, "label": "300 tờ"},
            {"value": 500, "label": "500 tờ"},
            {"value": 1000, "label": "1.000 tờ"},
            {"value": 2000, "label": "2.000 tờ"},
            {"value": 5000, "label": "5.000 tờ"},
        ],
        "spec_note": None,
        "footer_note": "*Báo giá theo các tùy chọn tham khảo. Ngoài các tùy chọn trên, Quý khách vui lòng nhắn Zalo bên dưới!",
    },
    {
        "id": "name_card",
        "label": "In name card",
        "fields": ["kich_thuoc", "chat_lieu", "so_luong"],
        "field_labels": {
            "kich_thuoc": "Kích thước",
            "chat_lieu": "Chất liệu",
            "so_luong": "Số lượng",
        },
        "spec_note": "1 hộp = 100 card",
        "merge_kich_thuoc": {"86×53mm": "90×54mm"},
        "extra_options": {"kich_thuoc": ["86×53mm"]},
        "qty_tiers": [
            {"value": 5, "label": "5 hộp"},
            {"value": 10, "label": "10 hộp"},
            {"value": 20, "label": "20 hộp"},
        ],
        "footer_note": "*Báo giá theo các tùy chọn tham khảo. Ngoài các tùy chọn trên, Quý khách vui lòng nhắn Zalo bên dưới!",
    },
    {
        "id": "tem_nhan",
        "label": "In tem nhãn",
        "fields": ["chat_lieu", "hinh_dang", "kich_thuoc", "so_luong"],
        "field_labels": {
            "chat_lieu": "Chất liệu",
            "hinh_dang": "Hình dáng",
            "kich_thuoc": "Kích thước",
            "so_luong": "Số lượng",
        },
        "cascade": True,
        "qty_tiers": [
            {"value": 100, "label": "100 nhãn"},
            {"value": 200, "label": "200 nhãn"},
            {"value": 300, "label": "300 nhãn"},
            {"value": 400, "label": "400 nhãn"},
            {"value": 500, "label": "500 nhãn"},
            {"value": 1000, "label": "1.000 nhãn"},
            {"value": 2000, "label": "2.000 nhãn"},
            {"value": 3000, "label": "3.000 nhãn"},
            {"value": 4000, "label": "4.000 nhãn"},
            {"value": 5000, "label": "5.000 nhãn"},
        ],
        "spec_note": None,
        "footer_note": "*Báo giá theo các tùy chọn tham khảo. Ngoài các tùy chọn trên, Quý khách vui lòng nhắn Zalo bên dưới!",
    },
    {
        "id": "decal",
        "label": "In decal giấy tròn",
        "fields": ["kich_thuoc", "so_luong"],
        "field_labels": {
            "kich_thuoc": "Kích thước",
            "so_luong": "Số lượng",
        },
        "qty_tiers": [
            {"value": 100, "label": "100 cái"},
            {"value": 200, "label": "200 cái"},
            {"value": 300, "label": "300 cái"},
            {"value": 400, "label": "400 cái"},
            {"value": 500, "label": "500 cái"},
            {"value": 1000, "label": "1.000 cái"},
            {"value": 2000, "label": "2.000 cái"},
            {"value": 3000, "label": "3.000 cái"},
            {"value": 4000, "label": "4.000 cái"},
            {"value": 5000, "label": "5.000 cái"},
        ],
        "spec_note": "Decal giấy, bế demi",
        "footer_note": "*Báo giá theo các tùy chọn tham khảo. Ngoài các tùy chọn trên, Quý khách vui lòng nhắn Zalo bên dưới!",
    },
    {
        "id": "catalogue",
        "label": "In catalogue",
        "fields": ["kich_thuoc", "so_trang", "so_luong"],
        "field_labels": {
            "kich_thuoc": "Khổ",
            "so_trang": "Số trang",
            "so_luong": "Số lượng",
        },
        "spec_note": "Bìa Couché 300gsm, ruột Couché 150gsm, cán mờ bìa, đóng kim",
        "addon_service": "Phụ phí catalogue",
        "addon_kich_thuoc": "Đóng kim cuốn",
        "qty_tiers": [
            {"value": 5, "label": "5 cuốn"},
            {"value": 10, "label": "10 cuốn"},
            {"value": 20, "label": "20 cuốn"},
            {"value": 50, "label": "50 cuốn"},
            {"value": 100, "label": "100 cuốn"},
            {"value": 200, "label": "200 cuốn"},
        ],
        "footer_note": "*Báo giá theo các tùy chọn tham khảo. Đóng keo gáy nhiệt và các yêu cầu khác, Quý khách vui lòng nhắn Zalo bên dưới!",
    },
]


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["BANG_GIA"]
    rows = []
    for r in ws.iter_rows(min_row=3, values_only=True):
        if not r or r[0] is None:
            continue
        obj = {}
        for col, val in zip(COLS, r):
            if val is None or val == "":
                continue
            if isinstance(val, str):
                val = val.strip()
                if not val:
                    continue
            obj[col] = val
        if obj:
            rows.append(obj)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        json.dumps({"services": SERVICES, "rows": rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {OUT} — {len(rows)} rows, {len(SERVICES)} services")


if __name__ == "__main__":
    main()
