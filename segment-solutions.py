# -*- coding: utf-8 -*-
"""ตัดหน้าเฉลยละเอียดออกเป็นภาพวิธีทำรายข้อ (1-30) ต่อชุดข้อสอบ
วิธี: หา marker "N." ที่ต้นบรรทัดชิดขอบซ้ายของคอลัมน์ แบบต้องเรียงลำดับ 1→30 (sequential matcher)
ข้อหนึ่งอาจต่อเนื่องหลายคอลัมน์/หลายหน้า → เก็บเป็นหลายชิ้น (strips) แล้วนำไปเรียงต่อกันในแอป"""
import pymupdf, re, os, sys, json
from PIL import Image

DPI = 120
Z = DPI / 72.0

def page_columns(page):
    """คืน [(x0,x1), ...] ของคอลัมน์ (1 หรือ 2 คอลัมน์) จากการกระจายของ block"""
    W = page.rect.width
    blocks = [b for b in page.get_text('blocks') if b[4].strip()]
    if not blocks: return []
    left  = [b for b in blocks if b[0] < W * 0.45]
    right = [b for b in blocks if b[0] >= W * 0.45]
    if left and right and min(b[0] for b in right) > W * 0.45:
        return [(0, W * 0.5), (W * 0.5, W)]
    return [(0, W)]

def find_markers(doc, nq=30):
    """เดินอ่านทีละหน้า/คอลัมน์ตามลำดับ หา marker ข้อถัดไปที่คาดหวัง
    คืน markers = [(q, page, col_idx, y, cols_of_page)], และ content bottom/top ต่อคอลัมน์"""
    expect = 1
    markers = []
    layout = []          # ต่อหน้า: (cols, col_bounds_y) โดย col_bounds_y = (top,bottom) ของเนื้อหาในคอลัมน์
    for pno in range(len(doc)):
        page = doc[pno]
        cols = page_columns(page)
        d = page.get_text('dict')
        lines = []       # (x0, y0, y1, text)
        for b in d['blocks']:
            for l in b.get('lines', []):
                txt = ''.join(s['text'] for s in l['spans']).strip()
                if txt:
                    x0, y0, x1, y1 = l['bbox']
                    lines.append((x0, y0, y1, txt))
        colinfo = []
        for ci, (cx0, cx1) in enumerate(cols):
            clines = [ln for ln in lines if cx0 <= ln[0] < cx1]
            if not clines:
                colinfo.append(None); continue
            top = min(l[1] for l in clines); bot = max(l[2] for l in clines)
            colinfo.append((top, bot))
            indent_max = min(0.3 * (cx1 - cx0), 90)    # โซนชิดซ้ายของคอลัมน์ (กันเลขกลางบรรทัด/ในสูตร)
            for x0, y0, y1, txt in sorted(clines, key=lambda l: l[1]):
                # marker: บรรทัดเริ่มด้วย "N." หรือ "N ." ของข้อที่คาดหวัง และอยู่โซนซ้ายของคอลัมน์
                m = re.match(r'^(\d{1,2})\s*\.(?!\d)', txt)
                if m and int(m.group(1)) == expect and x0 - cx0 < indent_max:
                    markers.append((expect, pno, ci, y0))
                    expect += 1
                    if expect > nq: break
            if expect > nq: break
        layout.append((cols, colinfo))
        if expect > nq: break
    return markers, layout

def segment(pdf_path):
    doc = pymupdf.open(pdf_path)
    markers, layout = find_markers(doc)
    found = len(markers)
    if found < 30:
        return None, found
    # สร้างรายการ strip ต่อข้อ: จาก marker ของข้อ ถึง marker ข้อถัดไป (ไล่ตามคอลัมน์/หน้า)
    strips = {}   # q -> [(page, col, y_from, y_to)]
    for i, (q, p, c, y) in enumerate(markers):
        pieces = []
        if i + 1 < len(markers):
            q2, p2, c2, y2 = markers[i + 1]
        else:
            p2, c2, y2 = None, None, None
        cp, cc, cy = p, c, y - 4
        while True:
            cols, colinfo = layout[cp]
            info = colinfo[cc] if cc < len(colinfo) else None
            bot = info[1] + 4 if info else None
            if p2 is not None and cp == p2 and cc == c2:
                pieces.append((cp, cc, cy, y2 - 4)); break
            if info: pieces.append((cp, cc, cy, bot))
            # ไปคอลัมน์/หน้าถัดไป
            if cc + 1 < len(cols): cc += 1
            else:
                cp += 1; cc = 0
                if cp >= len(layout) or (p2 is None and cp > p): break
                if p2 is None: break
            nxt = layout[cp][1][cc] if cc < len(layout[cp][1]) else None
            cy = (nxt[0] - 4) if nxt else 0
            if p2 is None: break
        strips[q] = [pc for pc in pieces if pc[3] - pc[2] > 6]
    return (doc, strips, layout), found

def segment_zorder(pdf_path):
    """fallback สำหรับเอกสารที่เรียงข้อแบบแถว (ซ้าย→ขวา→ซ้ายล่าง) เช่น เฉลยคณิต ม.1 ปี 2564:
    จับ marker ทุกตัวโดยไม่บังคับลำดับ แล้วตัดแต่ละข้อจาก marker ถึง marker ถัดไปในคอลัมน์เดียวกัน
    (ไม่ตามต่อข้ามคอลัมน์ — เค้าโครงแบบนี้คำอธิบายจบในช่องของตัวเอง)"""
    import re as _re
    doc = pymupdf.open(pdf_path)
    percol = {}          # (page, col) -> [(y, q)]
    layout = []
    seen = set()
    for pno in range(len(doc)):
        page = doc[pno]
        cols = page_columns(page)
        d = page.get_text('dict')
        colinfo = [None]*len(cols)
        for ci, (cx0, cx1) in enumerate(cols):
            ys = []
            for b in d['blocks']:
                for l in b.get('lines', []):
                    txt = ''.join(sp['text'] for sp in l['spans']).strip()
                    if not txt: continue
                    x0, y0, x1, y1 = l['bbox']
                    if not (cx0 <= x0 < cx1): continue
                    ys.append((y0, y1))
                    m = _re.match(r'^(\d{1,2})\s*\.(?!\d)', txt)
                    if m and 1 <= int(m.group(1)) <= 30 and int(m.group(1)) not in seen                          and x0 - cx0 < min(0.3*(cx1-cx0), 90):
                        seen.add(int(m.group(1)))
                        percol.setdefault((pno, ci), []).append((y0, int(m.group(1))))
            if ys: colinfo[ci] = (min(y[0] for y in ys), max(y[1] for y in ys))
        layout.append((cols, colinfo))
    if len(seen) < 30: return None, len(seen)
    # ตัดเต็มความกว้างเป็นแถบแนวนอน: จาก y ของ marker ถึง y ของ marker แถวถัดไปในหน้า
    # (ข้อที่อยู่เคียงกันคนละคอลัมน์จะเห็นเพื่อนบ้านด้วย — อ่านเหมือนครอปหน้ากระดาษ ยอมรับได้
    #  และไม่มีทางตัดเนื้อหากว้างเกินคอลัมน์ขาด)
    perpage = {}
    for (pno, ci), ms in percol.items():
        perpage.setdefault(pno, []).extend(ms)
    fullw = []          # layout เต็มความกว้างสำหรับ export
    for pno, (cols, colinfo) in enumerate(layout):
        tops = [c[0] for c in colinfo if c]; bots = [c[1] for c in colinfo if c]
        fullw.append(([(0, doc[pno].rect.width)], [(min(tops), max(bots)) if tops else None]))
    strips = {}
    for pno, ms in perpage.items():
        ms.sort()
        bot = fullw[pno][1][0][1] + 4
        ys = sorted(set(round(y) for y, q in ms))
        for y, q in ms:
            nxt = [v for v in ys if v > round(y) + 8]
            y2 = (nxt[0] - 4) if nxt else bot
            strips[q] = [(pno, 0, y-4, y2)]
    return (doc, strips, fullw), 30

def export(pdf_path, outdir, prefix):
    res, found = segment(pdf_path)
    if res is None:
        res, found = segment_zorder(pdf_path)
    if res is None: return found, 0
    doc, strips, layout = res
    os.makedirs(outdir, exist_ok=True)
    n = 0
    for q, pieces in strips.items():
        for j, (p, c, y0, y1) in enumerate(pieces):
            cols, _ = layout[p]
            cx0, cx1 = cols[c]
            clip = pymupdf.Rect(cx0, max(0, y0), cx1, min(doc[p].rect.height, y1))
            pix = doc[p].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY, clip=clip)
            img = Image.frombytes('L', (pix.width, pix.height), pix.samples)
            img.save(f'{outdir}/{prefix}_q{q:02d}_{j}.webp', 'WEBP', quality=52, method=6)
            n += 1
    return found, n

if __name__ == '__main__':
    G = sys.argv[1] if len(sys.argv) > 1 else 'G5'      # G5 (ชื่อไฟล์เดิมไม่มี suffix) หรือ G6
    sfx = '' if G == 'G5' else '_' + G
    report = []
    for y in range(2557, 2569):
        for s in ['Math', 'Science']:
            pdf = f'exams/{y}/Answer_TEDET{y}_{s}_{G}.pdf'
            d = pymupdf.open(pdf)
            if len(d) < 2:
                report.append((y, s, 'no-expl', 0)); continue
            # ข้ามหน้าตารางเฉลย (หน้า 1): segment ทั้งเอกสารแต่ marker หน้า 1 คือเลขในตาราง — ตัดหน้า 1 ออกก่อน
            tmp = pymupdf.open()
            tmp.insert_pdf(d, from_page=1, to_page=len(d) - 1)
            tmpf = f'exams/keys/_tmp_{y}_{s}{sfx}.pdf'
            tmp.save(tmpf)
            found, n = export(tmpf, 'exams/solutions', f'{y}_{s}{sfx}')
            report.append((y, s, found, n))
    for r in report: print(r)
