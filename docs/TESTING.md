# Testing checklist

Do this once after deployment, and again (briefly) after each new batch. Run `npm run seed` first: it prints a URL for each tag status. Tick each box as you go.

You need an **iPhone** (Safari and the Camera app) and an **Android phone** (Chrome and the Camera or Google Lens). For the "fresh visitor" checks, use **mobile data with Wi-Fi off**.

---

## 1. Public pages (logged out)

On each phone, open a private window (*Safari → Private*, *Chrome → New incognito tab*) so you're not logged in as admin.

| # | Test | iPhone | Android |
| --- | --- | --- | --- |
| 1.1 | **Assigned** demo URL (e.g. Amara Okafor) shows the photo, name, title · organization and public fields. | ☐ | ☐ |
| 1.2 | Hidden fields do **not** appear: Lukas Brandt has no photo, and nobody's emergency contact shows except Diego Ramírez's. | ☐ | ☐ |
| 1.3 | Tapping a phone number opens the dialer, an email opens the mail app, and a website opens in a new tab. | ☐ | ☐ |
| 1.4 | **Unassigned** URL shows "Not set up yet" with no name or details. | ☐ | ☐ |
| 1.5 | **Inactive** URL (Priya Nair's old tag) shows "No longer active". | ☐ | ☐ |
| 1.6 | **Void** URL shows "No longer active". | ☐ | ☐ |
| 1.7 | **Unknown ID** (valid format, not in the database; the seed prints one) shows "Tag not found". | ☐ | ☐ |
| 1.8 | **Malformed ID** (`/p/HELLO10`) shows "Tag not found". | ☐ | ☐ |
| 1.9 | Lowercase ID (`/p/abc…`) redirects to the uppercase URL. | ☐ | ☐ |
| 1.10 | The page fits the screen: no sideways scrolling, and text is readable without zooming. | ☐ | ☐ |
| 1.11 | **Mobile data, Wi-Fi off:** the profile loads in about 2 seconds or less, and the photo appears. | ☐ | ☐ |
| 1.12 | Rotate to landscape: the layout still looks right. | ☐ | ☐ |

## 2. Scanning real engraved tags

| # | Test | iPhone | Android |
| --- | --- | --- | --- |
| 2.1 | The built-in **camera app** recognizes the code within about 2 seconds at 5–15 cm. | ☐ | ☐ |
| 2.2 | The notification/link opens the correct `/p/<ID>` (the ID matches the engraved text, if you engrave it). | ☐ | ☐ |
| 2.3 | Scan under poor light (indoors, evening) and under direct sunlight or glare. | ☐ | ☐ |
| 2.4 | Scan at a slight angle (about 30°). | ☐ | ☐ |
| 2.5 | Try an older or cheaper phone if you have one. | ☐ | ☐ |
| 2.6 | Admin → Tags: the scan count of the scanned tag went up, and "last scan" shows the time. | ☐ | ☐ |

## 3. Admin on the phone (assignment flow)

| # | Test | ☐ |
| --- | --- | --- |
| 3.1 | `https://DOMAIN/admin` → login with the correct password works. A wrong password shows "Wrong password." | ☐ |
| 3.2 | After 10 wrong attempts within 15 minutes, login is blocked with "Too many attempts". | ☐ |
| 3.3 | While logged in, scanning an **unassigned** tag opens the **assignment screen** directly. | ☐ |
| 3.4 | Fill in a test person, **take a photo with the camera**, and save. The tag becomes "assigned". | ☐ |
| 3.5 | Scan the same tag again: the profile shows, with a black "Admin view" bar on top. | ☐ |
| 3.6 | The same scan in a private window (logged out) shows the profile **without** the admin bar. | ☐ |
| 3.7 | Download the photo from the public profile and check it has **no location or camera data** (iPhone: open it in Photos and swipe up, no map; Windows: right-click → Properties → Details, no GPS or camera model). | ☐ |
| 3.8 | Admin scans don't increase the scan count. | ☐ |
| 3.9 | Log out. Then `https://DOMAIN/admin/tags` redirects to the login page. | ☐ |

## 4. Admin features (computer)

| # | Test | ☐ |
| --- | --- | --- |
| 4.1 | **Batches:** generate a batch of 20. IDs are 7 characters, random, and contain no 0/O/1/I/L. | ☐ |
| 4.2 | Export CSV, CSV without header, TXT URLs and TXT IDs. They open in Notepad with 20 lines (21 with the header), in order #1–#20. | ☐ |
| 4.3 | URLs in the export start with your **real domain** (not localhost or vercel.app). The red warning is gone. | ☐ |
| 4.4 | DXF sheet (5 columns, 10 codes) imports into BslCAD or another CAD viewer at the right size. | ☐ |
| 4.5 | Mark the batch as engraved, then void two pieces by position number (e.g. `3 7`). Their status becomes void. | ☐ |
| 4.6 | **Tag screen:** deactivate → the public page says "No longer active". Reactivate → the profile is back. | ☐ |
| 4.7 | **Reassign** an assigned tag to another existing person. The public page shows the new person. | ☐ |
| 4.8 | **Release** a tag → it is unassigned again, and the public page shows "Not set up yet". | ☐ |
| 4.9 | **Void → Restore** returns the tag to unassigned. | ☐ |
| 4.10 | **People:** search by name, company, email and tag ID. The filters "No tag" and "With photo" work. | ☐ |
| 4.11 | Edit a person: untick "Public" on the phone field → it disappears from the public page. Change the photo → the new photo shows. | ☐ |
| 4.12 | Person page → "Add an unassigned tag" with "Deactivate their current tag(s)" → the old tag becomes inactive and the new one assigned. | ☐ |
| 4.13 | **Import:** download the template, add 3 rows (one with an unassigned tag ID, one with an already assigned ID, one without a tag) → **Check rows** shows 2 OK and 1 error → **Import** creates 2 people. | ☐ |
| 4.14 | **QR test:** the table shows 5/7/10 mm × L/M/Q/H. Printing at 100% gives codes of the right physical size (measure one with a ruler: 10 mm + quiet zone). | ☐ |
| 4.15 | Delete a test person → their tag shows "No longer active". | ☐ |

## 5. Security spot checks

| # | Test | ☐ |
| --- | --- | --- |
| 5.1 | Open `https://DOMAIN/api/admin/batches/<any-batch-id>/export` in a private window → **401 Unauthorized**. | ☐ |
| 5.2 | Open any profile → right-click → View page source → it contains `noindex`. | ☐ |
| 5.3 | Open any unassigned tag URL logged out → there is **no** way to fill in or claim it. | ☐ |
| 5.4 | Reload an unknown ID URL about 25 times quickly → "Please wait a moment" appears (rate limit). It clears after about 10 minutes. | ☐ |
| 5.5 | The GitHub repository does **not** contain `.env.local` or any key. | ☐ |
| 5.6 | Supabase → Storage → photos bucket is **Private**. | ☐ |

## 6. After the test

- Remove the test people and the demo data (`npm run seed:reset`).
- Void the test tags you engraved, or keep them as spares.
