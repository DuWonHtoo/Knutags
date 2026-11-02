# Engraving with BslCAD

This guide covers getting a batch of tag URLs into BslCAD, engraving them on steel, and what to do if your BslCAD version lacks the needed feature.

> **Read this first: menu names.** No public BslCAD manual exists online, so these steps could not be checked against your exact version. BslCAD's screen layout is modeled on **EzCad2**, the most common fiber-laser marking software, and the steps follow that layout. Your buttons may be named slightly differently (for example *Variable text* or *Var. text*, *File* or *Data file*). Look for the closest match. If your version has no variable text at all, use [Fallback B](#fallback-b-dxf-sheet-no-variable-text-needed), which always works.

---

## Before the first batch: decide size and quality

1. Admin → **QR test** → print the test sheet at 100% scale and scan it with an iPhone **and** an Android phone.
2. Engrave a **test piece** with 3 codes (7, 10 and 12 mm) and scan each one from about 10 cm under normal indoor light.
3. Typical results for a URL of about 33 characters (`https://qrp.example.com/p/ABC2345`):

   | Error correction | Modules (normal URL) | Modules (uppercase URL) | 10 mm → mm per module | 5 mm → mm per module |
   | --- | --- | --- | --- | --- |
   | L | 25 | 25 | 0.40 | 0.20 |
   | **M** (recommended) | 29 | **25** | 0.34 / 0.40 | 0.17 / 0.20 |
   | Q | 29 | 29 | 0.34 | 0.17 |
   | H | 33 | 29 | 0.30 / 0.34 | 0.15 / 0.17 |

   - **10 mm with level M** is reliable on steel.
   - **7 mm** works with most phones.
   - **5 mm** is borderline. It needs a short domain, the uppercase option, a crisp black mark and a phone that can focus close. Test before you commit.
4. The **quiet zone** (4 modules of blank metal around the code) is part of the design. For a 10 mm code at level M that means a clear square of about 12.8 mm. Keep logos, edges, holes and text out of it.

---

## A. Prepare the file

1. Admin → **Batches** → open the batch → **Export for engraving**. Download:
   - **TXT: one URL per line**, the most compatible file for BslCAD; and
   - **TXT: one ID per line**, if you also want the readable ID engraved next to the code (recommended: it lets anyone identify a tag even if the code is scratched).
   - Optionally **CSV (id,url)** for Excel mode (see step C).
2. Copy the files to the laser PC, e.g. `C:\Laser\QR\`. Use a short folder path with **no accented or special characters**. Some marking programs can't open those.
3. Line 1 of each TXT = position #1 of the batch, line 2 = #2, and so on. Positions are what you use to void damaged pieces later.

## B. Create the QR code object

1. Open BslCAD → **File → New**.
2. Choose the **Text** tool (the "T" icon or *Draw → Text*) and click on the work area.
3. In the object's **properties panel** (usually on the right), tick **Barcode** (sometimes *Bar code* or *Enable barcode*).
4. Click **Barcode settings / Parameters** (the button next to the barcode type list):
   - Type: **QR Code** (sometimes *QRCODE* under the 2D codes).
   - **Error correction:** **M** (or what you chose in the test).
   - Size / version: **Auto**.
   - **Quiet zone:** set to 4 modules (sometimes labeled *Blank*, *Margin*, *Quiet*). If you can't find it, leave clear space around the code yourself.
   - **Reverse / Inverse:** **off**. The engraved (dark) areas must be the dark squares.
   - Fill / hatch: enable fill so each module is filled. Line spacing about 0.02–0.03 mm for a solid dark mark.
5. Close the dialog. Set the code's width and height exactly in the size boxes on the toolbar (e.g. W = 10, H = 10, with the aspect-ratio lock on).

## C. Link the variable text to the file

1. With the QR object selected, tick **Enable variable text** (or *Variable text*) in the properties panel.
2. Click **Advanced** (or *Add*). A list of variable types appears: *Fixed text, Serial number, Date, Time, Keyboard, **File**…*
3. Choose **File** and select **TXT** as the file type, then **Browse** to `C:\Laser\QR\<batch>-urls.txt`.
4. Settings:
   - **Line number / Start line = 1** (our TXT files have no header).
   - **Auto increment** (or *Line increment*) = 1, so it moves to the next line after each marking.
   - **Auto reset / loop at end**: **off**, so you never engrave the same URL twice.
5. Click **Add**, then **OK/Apply**. The code on screen should now be generated from line 1.
6. **Check it:** zoom in and scan the code on the monitor with your phone. It must open `https://YOUR-DOMAIN/p/<the first ID in the file>`. If a phone shows the "Not set up yet" page, it works: the tag exists but isn't assigned yet.

**Excel instead of TXT (only if your version prefers it):** many EzCad-style programs only read old-style Excel files. Open the CSV in Excel, choose *File → Save As → **Excel 97-2003 Workbook (.xls)***, then in step C pick **Excel**, select the file, and set the **field / column name to `url`** (the header row is used for field names; data starts on the row below it). If the program asks for a column number instead, `url` is column **2** (B).

## D. Optional: the readable ID next to the code

1. Create a second **Text** object (no barcode), e.g. 1.5–2 mm high, placed *outside* the quiet zone (below the code).
2. Enable **variable text → File → TXT** with `<batch>-ids.txt`, **same start line** and the same increment.
3. Both objects now advance together on every marking. Check that the text matches the ID in the scanned URL.

## E. Marking run

1. Set the laser parameters for your steel (see the tips below) on both objects.
2. Put a piece in the fixture and press **Mark** (F2). After each marking the line number advances automatically.
3. **Write down the current line number** at breaks and at the end of the day. If the software or PC restarts, set *Start line* back to the next unused number.
4. **A piece is ruined?** Either set the line number back by 1 and re-mark the same URL on a new blank, or continue and enter that position number under **Batch → Void damaged pieces** in the admin.
5. When the batch is done: admin → batch → **Mark batch as engraved**, and void any damaged positions.
6. Scan 3–5 random finished pieces with an iPhone and an Android phone before shipping (see [TESTING.md](TESTING.md)).

**Multiple pieces per fixture plate:** variable text with *File* gives one value per marking cycle. Some versions also advance per copy when you **array** (duplicate) the object; test that on scrap. If it doesn't work, use Fallback B, which is designed for plates.

---

## Fallback A: CSV/Excel rejected → use TXT

If the file is rejected or shows strange characters:
- Use the **TXT** export (plain ASCII, one value per line, Windows line endings, no header). It is the simplest format any variable-text feature reads.
- If even TXT shows wrong characters, open it in Notepad → *Save As* → Encoding **ANSI** → save, and try again. Our URLs contain only plain ASCII, so nothing is lost.

## Fallback B: DXF sheet (no variable text needed)

This route always works because BslCAD only has to import a drawing:

1. Admin → batch → **Fallback: DXF sheet**. Enter:
   - **Code size** (e.g. 10 mm) and **error correction** (M);
   - **Columns** and **Pitch X / Y** = the distance between centres of neighbouring pieces on your fixture;
   - **From position #** and **How many** (max 60 per file, e.g. one fixture plate).
2. **Download DXF**. Position #1 is top-left, filling left to right, then the next row.
3. BslCAD → **File → Import vector file** (DXF) → choose the file. Units are millimetres.
4. Select all → apply **Hatch / Fill** (line spacing about 0.02–0.03 mm). Every dark area is a closed rectangle, so it fills cleanly.
5. Align the sheet with your fixture (use the red-light preview), mark, and continue with the next file (*From position #* = previous end + 1).
6. Write the position numbers on your plate layout so you can void damaged pieces by number.

## Fallback C: single tags and replacements

- Admin → tag → **DXF 10 mm** (or **SVG**) downloads one code as a vector, ready to import and engrave by hand.
- Admin → **QR test** can export any URL as SVG/DXF at 5/7/10 mm with any error-correction level.
- Last resort for very small runs: *Variable text → Keyboard*. BslCAD asks for the text before each marking, and you paste the URL from the TXT file.

---

## Steel engraving tips

- **Aim for dark marks on bright metal.** On stainless steel, a fiber laser's *annealing / black marking* (slow, overlapping, slightly defocused passes) gives the best contrast without removing material. Deep engraving gives poor contrast because the bottom reflects light.
- **Run a parameter test grid first.** Mark small squares with different speed, power and frequency on scrap of the same steel, and keep the darkest and most even one. Note the settings in the batch notes field.
- **Brushed or matte finishes scan better than mirror polish.** Mirror surfaces reflect the phone's light, so codes read better when tilted slightly.
- **Laser spot growth:** if the dark squares bleed into each other (the code looks "fat"), reduce power or hatch density, or enable *beam compensation / edge offset* if your version has it.
- **Never invert** the code to "white on black" unless you test every phone model. Many phone cameras don't read inverted QR codes reliably.
- **Protect the code:** if the parts get scratched in use, choose level **Q** and a size one step larger.
