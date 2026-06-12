#!/usr/bin/env python3
"""Xuất README.md thành PDF cho dự án Simdulich.vn"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Preformatted
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import re

OUTPUT = "/Users/phamhuy/Documents/sim-27-5-test5/Simdulich_README.pdf"

# ── Styles ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "DocTitle",
    parent=styles["Title"],
    fontSize=22,
    textColor=colors.HexColor("#1a56db"),
    spaceAfter=6,
    fontName="Helvetica-Bold",
)
h2_style = ParagraphStyle(
    "H2",
    parent=styles["Heading2"],
    fontSize=14,
    textColor=colors.HexColor("#1e3a5f"),
    spaceBefore=14,
    spaceAfter=4,
    fontName="Helvetica-Bold",
    borderPad=0,
)
h3_style = ParagraphStyle(
    "H3",
    parent=styles["Heading3"],
    fontSize=12,
    textColor=colors.HexColor("#374151"),
    spaceBefore=10,
    spaceAfter=3,
    fontName="Helvetica-Bold",
)
body_style = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontSize=10,
    leading=16,
    spaceAfter=4,
)
bullet_style = ParagraphStyle(
    "Bullet",
    parent=body_style,
    leftIndent=14,
    bulletIndent=0,
    spaceAfter=3,
)
code_style = ParagraphStyle(
    "Code",
    parent=styles["Code"],
    fontSize=8,
    leading=12,
    backColor=colors.HexColor("#f3f4f6"),
    borderColor=colors.HexColor("#d1d5db"),
    borderWidth=1,
    borderPad=6,
    fontName="Courier",
    spaceAfter=8,
)
note_style = ParagraphStyle(
    "Note",
    parent=body_style,
    backColor=colors.HexColor("#fffbeb"),
    borderColor=colors.HexColor("#f59e0b"),
    borderWidth=1,
    borderPad=6,
    leftIndent=6,
    spaceAfter=8,
    fontSize=9,
)

# ── Content ──────────────────────────────────────────────────────────────────
story = []

def hr():
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d1d5db"), spaceAfter=6))

def add_table(headers, rows, col_widths=None):
    data = [headers] + rows
    tbl = Table(data, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a56db")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4ff")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 8))

# ── Title ────────────────────────────────────────────────────────────────────
story.append(Paragraph("Simdulich.vn", title_style))
story.append(Paragraph(
    "Giao dien React (dieu huong theo tab) + backend Node.js/Express — he thong van hanh eSIM / SIM du lich.",
    body_style
))
hr()

# ── Cau truc ─────────────────────────────────────────────────────────────────
story.append(Paragraph("Cau truc du an", h2_style))
add_table(
    ["Thu muc", "Mo ta"],
    [
        ["frontend/", "Vite + React + TypeScript (UI Simdulich.vn)"],
        ["backend/", "Express proxy + SHA1 encStr + webhook nhan callback"],
        ["backend/data/", "Luu tru JSON (users.json, orders.json) — khong commit git"],
    ],
    col_widths=[60*mm, 110*mm],
)

# ── Cai dat ──────────────────────────────────────────────────────────────────
story.append(Paragraph("Cai dat", h2_style))
story.append(Preformatted(
    "copy .env.example .env\n"
    "# Sua WORLDMOVE_MERCHANT_ID, WORLDMOVE_DEPT_ID, WORLDMOVE_TOKEN trong .env\n\n"
    "npm install\n"
    "npm install --prefix frontend\n"
    "npm install --prefix backend",
    code_style,
))
story.append(Paragraph("Chay dev:", h3_style))
story.append(Preformatted("npm run dev", code_style))
story.append(Paragraph("UI: http://localhost:5173     API: http://localhost:4000", body_style))

# ── Phan cap ─────────────────────────────────────────────────────────────────
story.append(Paragraph("Quan tri & phan cap gia", h2_style))
add_table(
    ["Cap", "Vai tro", "Tab hien thi"],
    [
        ["admin", "Quan tri — gia goc NT", "Cau hinh, Quan tri, Bao gia, eSIM, Redeem, SIM vat ly, Nap tien, Tra cuu, Webhook"],
        ["tong_kho", "Tong kho — gia + markup", "Dat eSIM, Dat SIM vat ly, Quan ly dai ly"],
        ["dai_ly", "Dai ly — gia + markup", "Dat eSIM, Dat SIM vat ly"],
    ],
    col_widths=[28*mm, 50*mm, 92*mm],
)

story.append(Paragraph("Tai khoan mau", h3_style))
add_table(
    ["Dang nhap", "Mat khau", "Markup"],
    [
        ["admin", "admin123", "0% (gia goc)"],
        ["tongkho", "tongkho123", "3%"],
        ["daily", "daily123", "8%"],
    ],
    col_widths=[45*mm, 45*mm, 80*mm],
)

story.append(Paragraph("Admin co the:", h3_style))
for item in [
    "Chinh ty gia NT->VND va markup mac dinh theo cap (tab Quan tri)",
    "Chinh markup % rieng tren tung tai khoan (blur o input trong bang)",
    "Tao tai khoan Tong kho moi (tab Quan ly dai ly)",
]:
    story.append(Paragraph(f"• {item}", bullet_style))

story.append(Spacer(1, 6))
story.append(Paragraph("Tong kho co the:", h3_style))
for item in [
    "Tao tai khoan Dai ly cua rieng minh (tab Quan ly dai ly)",
    "Chinh markup % va khoa / mo khoa tung dai ly cap duoi",
    "Xem toan bo don hang do dai ly thuoc nhanh minh tao",
]:
    story.append(Paragraph(f"• {item}", bullet_style))

story.append(Spacer(1, 4))
story.append(Paragraph(
    "Luu y: Tong kho 1 chi thay don tu dai ly ma chinh no tao ra (phan vung rieng biet giua cac tong kho).",
    note_style,
))

# ── API phan quyen ────────────────────────────────────────────────────────────
story.append(Paragraph("API phan quyen quan ly", h3_style))
add_table(
    ["Endpoint", "Phuong thuc", "Mo ta"],
    [
        ["/api/manage/users", "GET", "admin: tat ca users; tong_kho: danh sach dai ly truc tiep"],
        ["/api/manage/users", "POST", "admin tao tong_kho; tong_kho tao dai_ly"],
        ["/api/manage/users/:id", "PATCH", "Cap nhat markupPercent / active / password (chi con truc tiep)"],
        ["/api/orders", "GET", "Tra don theo cap bac (admin: tat ca; tong_kho: nhanh; dai_ly: cua minh)"],
        ["/api/orders", "POST", "Luu don eSIM sau khi dat thanh cong"],
    ],
    col_widths=[52*mm, 28*mm, 90*mm],
)

# ── Webhook ───────────────────────────────────────────────────────────────────
story.append(Paragraph("Webhook (cau hinh tren cong API nha cung cap)", h2_style))
story.append(Paragraph("Tro ve may ban (can expose public, vi du ngrok):", body_style))
add_table(
    ["API", "Path"],
    [
        ["2.2 eSIM Order Callback", "POST /webhooks/worldmove/esim-order"],
        ["2.5 eSIM Order & Redeem Callback", "POST /webhooks/worldmove/esim-order-redeem"],
        ["3.2 Redeem Callback", "POST /webhooks/worldmove/redeem"],
        ["5.2 Top-up Callback", "POST /webhooks/worldmove/topup"],
    ],
    col_widths=[75*mm, 95*mm],
)
story.append(Paragraph("Backend bat buoc tra ve chuoi \"1\" (da implement).", note_style))

# ── Luu y nghiep vu ───────────────────────────────────────────────────────────
story.append(Paragraph("Luu y nghiep vu da validate o UI + server", h2_style))
for item in [
    "eSIM: tong qty <= 20, san pham leSIM=true (khi chon tu bao gia)",
    "Nap tien: day <= 30, toi da 500 dong, khong trung simNum",
    "simExists: simNum dung 20 chu so",
    "SIM vat ly: taxId va note bat buoc (co the chuoi rong)",
    "E-commerce Order: tu dong dien ten_tk + gia tri nhap (vi du: tongkho_DH001)",
    "Company: admin co the sua tuy y; tai khoan con tu dong khoa theo username",
    "Thoi gian don hang: dung gio Taipei UTC+8 (khop voi Worldmove)",
]:
    story.append(Paragraph(f"• {item}", bullet_style))

# ── E-commerce Order ghi chu ──────────────────────────────────────────────────
story.append(Paragraph("Ghi chu: Thay doi placeholder E-commerce Order tren Worldmove Admin UI", h2_style))
story.append(Paragraph(
    "Field E-commerce Order trong giao dien Worldmove (receiverEcid) hien thi placeholder lay tu key da ngon ngu ecommerceOrder.",
    body_style,
))
story.append(Paragraph("Cach 1: Sua truc tiep trong HTML", h3_style))
story.append(Preformatted(
    '<input type="text" maxlength="50" name="receiverEcid_esim"\n'
    '    ng-model="form.receiverEcid" class="form-control"\n'
    '    id="inputEcid" placeholder="Worldmove Order" style="">',
    code_style,
))
story.append(Paragraph("Luu y: Xoa ng-attr-placeholder de Angular khong ghi de lai gia tri cu.", note_style))

story.append(Paragraph("Cach 2: Sua qua file ngon ngu (khuyen dung)", h3_style))
story.append(Preformatted(
    '// en.json\n{ "ecommerceOrder": "Worldmove Order" }\n\n'
    '// vi.json\n{ "ecommerceOrder": "Don hang Worldmove" }',
    code_style,
))

# ── Footer ────────────────────────────────────────────────────────────────────
hr()
story.append(Paragraph(
    "Production URL: https://fmshippingsys.fastmove.com.tw",
    ParagraphStyle("footer", parent=body_style, textColor=colors.grey, fontSize=9),
))

# ── Build ─────────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=18*mm, rightMargin=18*mm,
    topMargin=20*mm, bottomMargin=20*mm,
    title="Simdulich.vn — Tai lieu he thong",
    author="Simdulich.vn",
)
doc.build(story)
print(f"Da xuat: {OUTPUT}")
