# Docx Creation And Data Extraction (skill-docx-creation-and-data-extraction.md)

Description: "Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', or requests to produce professional documents with formatting like tables of contents, headings, page numbers, or letterheads. Also use when extracting or reorganizing content from .docx files, inserting or replacing images in documents, performing find-and-replace in Word files, working with tracked changes or comments, or converting content into a polished Word document. If the user asks for a 'report', 'memo', 'letter', 'template', or similar deliverable as a Word or .docx file, use this skill. Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks unrelated to document generation."
license: Proprietary. LICENSE.txt has complete terms

## Overview

A .docx file is a ZIP archive containing XML files. This environment runs Python 3 without LibreOffice, Pandoc, or any external tools — all operations use pure Python libraries.

## Quick Reference

| Task | Approach |
|------|----------|
| Read/analyze content | `python-docx` |
| Create new document | `python-docx` — see Creating New Documents below |
| Edit existing document | Unpack → edit XML → repack — see Editing Existing Documents below |
| Advanced features (footnotes, tracked changes, comments) | `python-docx` for base + unpack/edit/pack for XML-level work |

### Limitations (No External Tools)

- **No `.doc` conversion** — legacy `.doc` files cannot be converted to `.docx` without LibreOffice. Reject or ask the user to convert first.
- **No PDF export** — no LibreOffice or Poppler available. If the user needs a PDF, note this limitation.
- **No tracked change acceptance** — accepting all tracked changes requires LibreOffice. Individual changes can be edited via XML (see Editing Existing Documents).
- **No image conversion** — images must be provided in a supported format (PNG, JPG, GIF, BMP, SVG).

### Reading Content

```python
from docx import Document

doc = Document('document.docx')

for para in doc.paragraphs:
    print(para.style.name, para.text)

for table in doc.tables:
    for row in table.rows:
        print([cell.text for cell in row.cells])

# Read headers/footers
for section in doc.sections:
    print(section.header.paragraphs[0].text)
    print(section.footer.paragraphs[0].text)
```

For raw XML access (e.g., reading tracked changes, comments, or fields):
```bash
python scripts/office/unpack.py document.docx unpacked/
```

---

## Creating New Documents

Use `python-docx` for all new document creation. Install: `pip install python-docx`

### Setup

```python
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

doc = Document()
doc.save('output.docx')
```

### Page Size

```python
# CRITICAL: python-docx defaults vary by platform — always set explicitly
section = doc.sections[0]
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
```

**Common page sizes:**

| Paper | Width | Height | Content Width (1" margins) |
|-------|-------|--------|---------------------------|
| US Letter | `Inches(8.5)` | `Inches(11)` | `Inches(6.5)` |
| A4 | `Cm(21.0)` | `Cm(29.7)` | `Cm(17.0)` |

**Landscape orientation:**
```python
section = doc.add_section(WD_ORIENT.LANDSCAPE)
section.page_width = Inches(11)
section.page_height = Inches(8.5)
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
# Content width = Inches(9) for US Letter landscape
```

### Styles (Override Built-in Headings)

Use Arial as the default font (universally supported). Keep titles black for readability.

```python
style = doc.styles['Normal']
font = style.font
font.name = 'Arial'
font.size = Pt(12)

for level, (size, before, after) in enumerate([
    (Pt(16), Pt(12), Pt(12)),   # Heading 1
    (Pt(14), Pt(10), Pt(10)),   # Heading 2
    (Pt(13), Pt(8), Pt(8)),     # Heading 3
], start=1):
    h_style = doc.styles[f'Heading {level}']
    h_style.font.name = 'Arial'
    h_style.font.size = size
    h_style.font.bold = True
    h_style.font.color.rgb = RGBColor(0, 0, 0)
    h_style.paragraph_format.space_before = before
    h_style.paragraph_format.space_after = after
```

**Using headings (required for TOC):**
```python
doc.add_heading('Title', level=1)
doc.add_heading('Subtitle', level=2)
```

### Lists (Use Built-in Styles)

```python
# Bullet list
doc.add_paragraph('Bullet item', style='List Bullet')
doc.add_paragraph('Another bullet', style='List Bullet')

# Numbered list
doc.add_paragraph('Numbered item', style='List Number')
doc.add_paragraph('Next number', style='List Number')

# Nested bullets (limited — for deep nesting, use XML manipulation or unpack/edit/pack)
doc.add_paragraph('Nested bullet', style='List Bullet 2')
```

**Custom list formatting** (indent, bullet character) requires XML-level numbering definitions. For simple cases the built-in styles suffice. For complex custom lists, generate the base document with python-docx then use unpack/edit/pack to add numbering XML to `word/numbering.xml`.

### Tables

```python
table = doc.add_table(rows=3, cols=2)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.style = 'Table Grid'

# Set column widths
for i, width in enumerate([Inches(3.25), Inches(3.25)]):
    for row in table.rows:
        row.cells[i].width = width

# Populate cells
table.cell(0, 0).text = 'Header 1'
table.cell(0, 1).text = 'Header 2'
table.cell(1, 0).text = 'Data'

# Cell formatting
cell = table.cell(0, 0)
cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
for run in cell.paragraphs[0].runs:
    run.font.bold = True
    run.font.size = Pt(11)

# Cell shading
from docx.oxml import OxmlElement
shading = OxmlElement('w:shd')
shading.set(qn('w:fill'), 'D5E8F0')
shading.set(qn('w:val'), 'clear')
cell._tc.get_or_add_tcPr().append(shading)

# Cell margins (padding)
tc = cell._tc
tcPr = tc.get_or_add_tcPr()
for margin, val in [('top', '80'), ('bottom', '80'), ('left', '120'), ('right', '120')]:
    el = OxmlElement(f'w:{margin}')
    el.set(qn('w:w'), val)
    el.set(qn('w:type'), 'dxa')
    tcPr.append(el)
```

**Table width rules:**
- Always explicitly set column widths on every cell for consistent rendering
- Cell margins are internal padding — they reduce content area, not add to cell width
- For full-width tables: total column widths = page width minus left and right margins

### Images

```python
from docx.shared import Inches

# Add image as its own paragraph
doc.add_picture('image.png', width=Inches(4))

# Add image inline within a paragraph
paragraph = doc.add_paragraph()
run = paragraph.add_run()
run.add_picture('image.png', width=Inches(4))
```

Supported formats: PNG, JPG/JPEG, GIF, BMP, SVG (SVG requires Word 2016+).

### Page Breaks

```python
doc.add_page_break()

# Or before a specific paragraph
paragraph = doc.add_paragraph()
paragraph.paragraph_format.page_break_before = True
```

### Hyperlinks

python-docx requires XML-level work for hyperlinks:

```python
def add_hyperlink(paragraph, url, text):
    part = paragraph.part
    r_id = part.relate_to(url, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', is_external=True)
    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('r:id'), r_id)
    new_run = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    rStyle = OxmlElement('w:rStyle')
    rStyle.set(qn('w:val'), 'Hyperlink')
    rPr.append(rStyle)
    new_run.append(rPr)
    t = OxmlElement('w:t')
    t.text = text
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)

para = doc.add_paragraph()
add_hyperlink(para, 'https://example.com', 'Click here')
```

### Headers and Footers

```python
section = doc.sections[0]

# Header
header = section.header
header.is_linked_to_previous = False
header_para = header.paragraphs[0]
header_para.text = 'Header Text'
header_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT

# Footer with page number
footer = section.footer
footer.is_linked_to_previous = False
footer_para = footer.paragraphs[0]
footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

run = footer_para.add_run('Page ')
fldChar1 = OxmlElement('w:fldChar')
fldChar1.set(qn('w:fldCharType'), 'begin')
run._r.append(fldChar1)

run2 = footer_para.add_run()
instrText = OxmlElement('w:instrText')
instrText.set(qn('xml:space'), 'preserve')
instrText.text = ' PAGE '
run2._r.append(instrText)

run3 = footer_para.add_run()
fldChar2 = OxmlElement('w:fldChar')
fldChar2.set(qn('w:fldCharType'), 'end')
run3._r.append(fldChar2)
```

### Table of Contents

Requires XML field codes — python-docx has no native TOC support:

```python
def add_toc(document, heading_range='1-3'):
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run('Table of Contents')
    run.bold = True
    run.font.size = Pt(16)

    toc_para = document.add_paragraph()
    for fld_char_type, text in [
        ('begin', None), ('separate', f' TOC \\o "{heading_range}" \\h \\z \\u '), ('end', None)
    ]:
        run = toc_para.add_run()
        if text is not None:
            instrText = OxmlElement('w:instrText')
            instrText.set(qn('xml:space'), 'preserve')
            instrText.text = text
            run._r.append(instrText)
        else:
            fldChar = OxmlElement('w:fldChar')
            fldChar.set(qn('w:fldCharType'), fld_char_type)
            run._r.append(fldChar)

    # Placeholder text between begin and separate
    placeholder = toc_para.add_run('[Right-click and select "Update Field" to populate TOC in Word]')
    placeholder.font.color.rgb = RGBColor(128, 128, 128)
    placeholder.font.italic = True
    # Move placeholder between begin and separate field chars
    toc_para._p.insert(2, placeholder._r)
    # Remove from end
    toc_para._p.remove(placeholder._r)

add_toc(doc)
```

**Important:** The TOC will not show page numbers until the user opens the file in Word and updates the field (right-click → Update Field). This is a limitation of not having a rendering engine.

### Tab Stops

```python
def add_tab_stop(paragraph, position_in_inches, alignment='right', leader=None):
    pPr = paragraph._p.get_or_add_pPr()
    tabs = OxmlElement('w:tabs')
    tab = OxmlElement('w:tab')
    tab.set(qn('w:val'), alignment)
    tab.set(qn('w:pos'), str(int(position_in_inches * 1440)))  # DXA
    if leader:
        tab.set(qn('w:leader'), leader)  # 'dot', 'heavy', 'hyphen', 'middleDot', 'underscore'
    tabs.append(tab)
    pPr.append(tabs)

# Right-aligned date opposite a title
para = doc.add_paragraph()
para.add_run('Company Name')
para.add_run('\t')
para.add_run('January 2025')
add_tab_stop(para, 6.5, alignment='right', leader='dot')
```

### Multi-Column Layouts

```python
def set_columns(section, count=2, spacing_inches=0.5, equal=True, widths=None):
    sectPr = section._sectPr
    # Remove existing cols element if present
    for cols in sectPr.findall(qn('w:cols')):
        sectPr.remove(cols)
    cols = OxmlElement('w:cols')
    cols.set(qn('w:num'), str(count))
    cols.set(qn('w:space'), str(int(spacing_inches * 1440)))
    cols.set(qn('w:equalWidth'), '1' if equal else '0')
    if not equal and widths:
        for w in widths:
            col = OxmlElement('w:col')
            col.set(qn('w:w'), str(int(w * 1440)))
            cols.append(col)
    sectPr.append(cols)

# Equal two-column layout
set_columns(doc.sections[0], count=2, spacing_inches=0.5)

# Custom widths
set_columns(doc.sections[0], equal=False, widths=[3.75, 2.75])
```

### Footnotes

python-docx has no native footnote support. For footnotes, use the unpack/edit/pack workflow:

1. Create the base document with python-docx (all content except footnotes)
2. Unpack: `python scripts/office/unpack.py base.docx unpacked/`
3. Create or edit `word/footnotes.xml` — see XML Reference below for structure
4. Add relationship in `word/_rels/document.xml.rels` if footnotes.xml is new
5. Add content type in `[Content_Types].xml` if footnotes.xml is new
6. Insert `<w:footnoteReference>` elements in `word/document.xml` at desired positions
7. Pack: `python scripts/office/pack.py unpacked/ output.docx --original base.docx`

### Critical Rules for python-docx

- **Set page size explicitly** — defaults vary by platform
- **Landscape: create a new section** — use `doc.add_section(WD_ORIENT.LANDSCAPE)` and set dimensions manually
- **Never use `\n` in text** — use separate paragraphs or `add_break()` for line breaks within a paragraph
- **Never use unicode bullets manually** — use `'List Bullet'` style
- **Always set column widths on tables** — for every cell, not just the table
- **Always set cell margins on tables** — without padding, text hugs cell borders
- **Use `w:val="clear"` for shading** — never `"solid"` (causes black backgrounds on some platforms)
- **Never use tables as dividers/rules** — empty table cells render as boxes; use paragraph borders instead:
  ```python
  from docx.oxml import OxmlElement
  pPr = paragraph._p.get_or_add_pPr()
  pBdr = OxmlElement('w:pBdr')
  bottom = OxmlElement('w:bottom')
  bottom.set(qn('w:val'), 'single')
  bottom.set(qn('w:sz'), '6')
  bottom.set(qn('w:space'), '1')
  bottom.set(qn('w:color'), '2E75B6')
  pBdr.append(bottom)
  pPr.append(pBdr)
  ```
- **TOC requires `add_heading()` with level** — no custom-styled paragraphs; must use built-in heading levels for TOC to work
- **For two-column footers, use tab stops** — not tables

---

## Editing Existing Documents

**Follow all 3 steps in order.**

### Step 1: Unpack
```bash
python scripts/office/unpack.py document.docx unpacked/
```
Extracts XML, pretty-prints, merges adjacent runs, and converts smart quotes to XML entities (`&#x201C;` etc.) so they survive editing. Use `--merge-runs false` to skip run merging.

### Step 2: Edit XML

Edit files in `unpacked/word/`. See XML Reference below for patterns.

**Use "Claude" as the author** for tracked changes and comments, unless the user explicitly requests use of a different name.

**Use the Edit tool directly for string replacement. Do not write Python scripts.** Scripts introduce unnecessary complexity. The Edit tool shows exactly what is being replaced.

**CRITICAL: Use smart quotes for new content.** When adding text with apostrophes or quotes, use XML entities to produce smart quotes:
```xml
<!-- Use these entities for professional typography -->
<w:t>Here&#x2019;s a quote: &#x201C;Hello&#x201D;</w:t>
```
| Entity | Character |
|--------|-----------|
| `&#x2018;` | ' (left single) |
| `&#x2019;` | ' (right single / apostrophe) |
| `&#x201C;` | " (left double) |
| `&#x201D;` | " (right double) |

**Adding comments:** Use `comment.py` to handle boilerplate across multiple XML files (text must be pre-escaped XML):
```bash
python scripts/comment.py unpacked/ 0 "Comment text with &amp; and &#x2019;"
python scripts/comment.py unpacked/ 1 "Reply text" --parent 0  # reply to comment 0
python scripts/comment.py unpacked/ 0 "Text" --author "Custom Author"  # custom author name
```
Then add markers to document.xml (see Comments in XML Reference).

### Step 3: Pack
```bash
python scripts/office/pack.py unpacked/ output.docx --original document.docx
```
Validates with auto-repair, condenses XML, and creates DOCX. Use `--validate false` to skip.

**Auto-repair will fix:**
- `durableId` >= 0x7FFFFFFF (regenerates valid ID)
- Missing `xml:space="preserve"` on `<w:t>` with whitespace

**Auto-repair won't fix:**
- Malformed XML, invalid element nesting, missing relationships, schema violations

### Common Pitfalls

- **Replace entire `<w:r>` elements**: When adding tracked changes, replace the whole `<w:r>...</w:r>` block with `<w:del>...<w:ins>...` as siblings. Don't inject tracked change tags inside a run.
- **Preserve `<w:rPr>` formatting**: Copy the original run's `<w:rPr>` block into your tracked change runs to maintain bold, font size, etc.

---

## XML Reference

### Schema Compliance

- **Element order in `<w:pPr>`**: `<w:pStyle>`, `<w:numPr>`, `<w:spacing>`, `<w:ind>`, `<w:jc>`, `<w:rPr>` last
- **Whitespace**: Add `xml:space="preserve"` to `<w:t>` with leading/trailing spaces
- **RSIDs**: Must be 8-digit hex (e.g., `00AB1234`)

### Tracked Changes

**Insertion:**
```xml
<w:ins w:id="1" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:t>inserted text</w:t></w:r>
</w:ins>
```

**Deletion:**
```xml
<w:del w:id="2" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:delText>deleted text</w:delText></w:r>
</w:del>
```

**Inside `<w:del>`**: Use `<w:delText>` instead of `<w:t>`, and `<w:delInstrText>` instead of `<w:instrText>`.

**Minimal edits** - only mark what changes:
```xml
<!-- Change "30 days" to "60 days" -->
<w:r><w:t>The term is </w:t></w:r>
<w:del w:id="1" w:author="Claude" w:date="...">
  <w:r><w:delText>30</w:delText></w:r>
</w:del>
<w:ins w:id="2" w:author="Claude" w:date="...">
  <w:r><w:t>60</w:t></w:r>
</w:ins>
<w:r><w:t> days.</w:t></w:r>
```

**Deleting entire paragraphs/list items** - when removing ALL content from a paragraph, also mark the paragraph mark as deleted so it merges with the next paragraph. Add `<w:del/>` inside `<w:pPr><w:rPr>`:
```xml
<w:p>
  <w:pPr>
    <w:numPr>...</w:numPr>  <!-- list numbering if present -->
    <w:rPr>
      <w:del w:id="1" w:author="Claude" w:date="2025-01-01T00:00:00Z"/>
    </w:rPr>
  </w:pPr>
  <w:del w:id="2" w:author="Claude" w:date="2025-01-01T00:00:00Z">
    <w:r><w:delText>Entire paragraph content being deleted...</w:delText></w:r>
  </w:del>
</w:p>
```
Without the `<w:del/>` in `<w:pPr><w:rPr>`, accepting changes leaves an empty paragraph/list item.

**Rejecting another author's insertion** - nest deletion inside their insertion:
```xml
<w:ins w:author="Jane" w:id="5">
  <w:del w:author="Claude" w:id="10">
    <w:r><w:delText>their inserted text</w:delText></w:r>
  </w:del>
</w:ins>
```

**Restoring another author's deletion** - add insertion after (don't modify their deletion):
```xml
<w:del w:author="Jane" w:id="5">
  <w:r><w:delText>deleted text</w:delText></w:r>
</w:del>
<w:ins w:author="Claude" w:id="10">
  <w:r><w:t>deleted text</w:t></w:r>
</w:ins>
```

### Comments

After running `comment.py` (see Step 2), add markers to document.xml. For replies, use `--parent` flag and nest markers inside the parent's.

**CRITICAL: `<w:commentRangeStart>` and `<w:commentRangeEnd>` are siblings of `<w:r>`, never inside `<w:r>`.**

```xml
<!-- Comment markers are direct children of w:p, never inside w:r -->
<w:commentRangeStart w:id="0"/>
<w:del w:id="1" w:author="Claude" w:date="2025-01-01T00:00:00Z">
  <w:r><w:delText>deleted</w:delText></w:r>
</w:del>
<w:r><w:t> more text</w:t></w:r>
<w:commentRangeEnd w:id="0"/>
<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r>

<!-- Comment 0 with reply 1 nested inside -->
<w:commentRangeStart w:id="0"/>
  <w:commentRangeStart w:id="1"/>
  <w:r><w:t>text</w:t></w:r>
  <w:commentRangeEnd w:id="1"/>
<w:commentRangeEnd w:id="0"/>
<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r>
<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="1"/></w:r>
```

### Footnotes (XML Level)

When creating footnotes via unpack/edit/pack, the `word/footnotes.xml` structure:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="..." xmlns:r="...">
  <w:footnote w:type="separator" w:id="-1">
    <w:p><w:separator/></w:p>
  </w:footnote>
  <w:footnote w:type="continuationSeparator" w:id="0">
    <w:p><w:continuationSeparator/></w:p>
  </w:footnote>
  <w:footnote w:id="1">
    <w:p>
      <w:r><w:rPr><w:rStyle w:val="FootnoteText"/></w:rPr>
      <w:footnoteRef/></w:r>
      <w:r><w:t>Source: Annual Report 2024</w:t></w:r>
    </w:p>
  </w:footnote>
</w:footnotes>
```

Reference in document.xml:
```xml
<w:r><w:t>Revenue grew 15%</w:t></w:r>
<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="1"/></w:r>
```

Relationship in `word/_rels/document.xml.rels` (if footnotes.xml is new):
```xml
<Relationship Id="rIdFootnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
```

### Images

1. Add image file to `word/media/`
2. Add relationship to `word/_rels/document.xml.rels`:
```xml
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
```
3. Add content type to `[Content_Types].xml`:
```xml
<Default Extension="png" ContentType="image/png"/>
```
4. Reference in document.xml:
```xml
<w:drawing>
  <wp:inline>
    <wp:extent cx="914400" cy="914400"/>  <!-- EMUs: 914400 = 1 inch -->
    <a:graphic>
      <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
        <pic:pic>
          <pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill>
        </pic:pic>
      </a:graphicData>
    </a:graphic>
  </wp:inline>
</w:drawing>
```

---

## Dependencies
These may need to be installed to the vm
- **python-docx**: `pip install python-docx` (creating, reading, editing documents)
- **scripts/office/unpack.py**: Pure Python — unpacks DOCX to XML for editing
- **scripts/office/pack.py**: Pure Python — repacks XML into DOCX with validation
- **scripts/comment.py**: Pure Python — manages comment boilerplate for XML editing
