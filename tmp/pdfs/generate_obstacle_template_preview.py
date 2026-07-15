from pathlib import Path

from reportlab.lib.colors import Color
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


out = Path("output/pdf/obstacle-scoring-template-preview.pdf")
c = canvas.Canvas(str(out), pagesize=A4)
w, h = A4
left = 14 * mm
top = h - 12 * mm
width = 182 * mm
brown = Color(107 / 255, 63 / 255, 29 / 255)
gold = Color(185 / 255, 138 / 255, 75 / 255)
line = Color(201 / 255, 187 / 255, 160 / 255)
cream = Color(245 / 255, 239 / 255, 226 / 255)
ink = Color(43 / 255, 37 / 255, 32 / 255)
y = top

c.setStrokeColor(line)
c.setLineWidth(0.5)
c.rect(left, h - 282 * mm, width, 270 * mm)
c.setFillColor(brown)
c.rect(left, y - 18 * mm, width, 18 * mm, fill=1, stroke=0)
logo = Path("assets/seorc-club-logo.png")
if logo.exists():
    c.drawImage(str(logo), left + 4 * mm, y - 16 * mm, 14 * mm, 14 * mm, mask="auto")
c.setFillColor(cream)
c.setFont("Helvetica-Bold", 15)
c.drawString(left + 23 * mm, y - 7.5 * mm, "SEORC SHOW")
c.setFont("Helvetica-Bold", 10)
c.drawString(left + 23 * mm, y - 13 * mm, "JUDGE SCORING CARD")
c.setFillColor(ink)
c.setFont("Helvetica", 10)
c.drawString(left + 4 * mm, y - 26 * mm, "Sample Show | Wednesday 15 July 2026")
c.setFont("Helvetica-Bold", 10)
c.drawString(left + 112 * mm, y - 26 * mm, "JUDGE:")
c.setFont("Helvetica", 10)
c.drawString(left + 132 * mm, y - 26 * mm, "Polly")
c.setFont("Helvetica-Bold", 10)
c.drawString(left + 4 * mm, y - 34 * mm, "CLASS:")
c.drawString(left + 112 * mm, y - 34 * mm, "ORDER:")
c.drawString(left + 4 * mm, y - 42 * mm, "RIDER:")
c.drawString(left + 112 * mm, y - 42 * mm, "HORSE:")
c.setFont("Helvetica", 10)
c.drawString(left + 24 * mm, y - 34 * mm, "Rookie")
c.drawString(left + 132 * mm, y - 34 * mm, "1")
c.drawString(left + 25 * mm, y - 42 * mm, "Sample Rider")
c.drawString(left + 132 * mm, y - 42 * mm, "Sample Horse")

y -= 46 * mm
c.setFillColor(gold)
c.rect(left, y - 8 * mm, width, 8 * mm, fill=1, stroke=0)
c.setFillColor(ink)
c.setFont("Helvetica-Bold", 8)
c.drawString(left + 4 * mm, y - 5.2 * mm, "#")
c.drawString(left + 18 * mm, y - 5.2 * mm, "OBSTACLE")
c.drawString(left + 82 * mm, y - 5.2 * mm, "COMMENTS")
c.drawString(left + 164 * mm, y - 5.2 * mm, "SCORE / 10")

obstacles = [
    "Bridge",
    "Gate",
    "Sidepass",
    "Water crossing",
    "Backing poles",
    "Tarp",
    "Mailbox",
    "Serpentine",
    "Drag item",
    "Rope circle",
    "Narrow gap",
    "Pivot box",
    "Jump",
    "Final obstacle",
]
c.setStrokeColor(line)
c.setFillColor(ink)
c.setFont("Helvetica", 9)
for index, name in enumerate(obstacles):
    row_y = y - 8 * mm - index * 10 * mm
    c.rect(left, row_y - 10 * mm, width, 10 * mm)
    for x in [left + 14 * mm, left + 76 * mm, left + 160 * mm]:
        c.line(x, row_y, x, row_y - 10 * mm)
    c.drawString(left + 5 * mm, row_y - 6.5 * mm, str(index + 1))
    c.drawString(left + 18 * mm, row_y - 6.5 * mm, name)

score_y = y - 8 * mm - len(obstacles) * 10 * mm - 6 * mm
c.setFont("Helvetica-Bold", 8)
c.setFillColor(cream)
c.rect(left, score_y - 16 * mm, 86 * mm, 16 * mm, fill=1, stroke=1)
c.rect(left + 96 * mm, score_y - 16 * mm, 86 * mm, 16 * mm, fill=1, stroke=1)
c.setFillColor(ink)
c.drawString(left + 4 * mm, score_y - 5.5 * mm, "TIME SCORE")
c.drawString(left + 100 * mm, score_y - 5.5 * mm, "TOTAL")

comments_y = score_y - 20 * mm
c.setFont("Helvetica-Bold", 8)
c.drawString(left + 4 * mm, comments_y, "OVERALL COMMENTS FOR THE JUDGE")
c.rect(left, comments_y - 23 * mm, width, 20 * mm)

guide_y = comments_y - 28 * mm
c.setFillColor(cream)
acronym_x = left + 124 * mm
c.rect(left, guide_y - 20 * mm, width, 23 * mm, fill=1, stroke=1)
c.line(acronym_x - 6 * mm, guide_y + 3 * mm, acronym_x - 6 * mm, guide_y - 20 * mm)
c.setFillColor(ink)
c.setFont("Helvetica-Bold", 5.8)
c.drawString(left + 4 * mm, guide_y - 1.5 * mm, "SCORING GUIDE")
c.setFont("Helvetica", 5.2)
guide = [
    ("10", "Exceptional"),
    ("9", "Excellent"),
    ("8", "Great"),
    ("7", "Very good"),
    ("6", "Good"),
    ("5", "Satisfactory"),
    ("3-4", "Marginal"),
    ("1-2", "Poor"),
]
for index, (score, label) in enumerate(guide):
    x = left + 4 * mm + (39 * mm if index >= 4 else 0)
    yy = guide_y - 5 * mm - (index % 4) * 3.1 * mm
    c.drawString(x, yy, f"{score} - {label}")
c.setFont("Helvetica", 4.9)
c.drawString(left + 4 * mm, guide_y - 18.4 * mm, "0 - Missed obstacle or did not attempt + 20 sec")

c.setFont("Helvetica-Bold", 5.8)
c.drawString(acronym_x, guide_y - 1.5 * mm, "ACRONYM LIST")
c.setFont("Helvetica", 5.2)
for index, (code, label) in enumerate(
    [("BG", "Broken Gate"), ("WL", "Wrong Lead"), ("GM", "Gaping Mouth"), ("H", "Hesitation")]
):
    c.drawString(acronym_x, guide_y - 5.5 * mm - index * 3.5 * mm, f"{code} - {label}")

c.showPage()
c.save()
print(out)
