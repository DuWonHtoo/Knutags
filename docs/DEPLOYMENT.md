# Deployment guide (step by step)

This guide assumes no prior experience. It takes about an hour. You will create three free accounts (GitHub, Supabase, Vercel), buy a domain, and click through a few screens. Copy each value exactly as shown.

> **The one rule that matters most:** the web address in `PUBLIC_BASE_URL` gets engraved into steel and can never change. Finish step 8 (your own domain) **before** you export any batch for real engraving. The admin area shows a red warning until you do.

---

## 0. What you need

| Thing | Where | Cost |
| --- | --- | --- |
| Node.js **20.9 or newer** (LTS) | https://nodejs.org → "LTS" installer | free |
| GitHub account | https://github.com | free |
| Supabase account | https://supabase.com | free to start; Pro ($25/month) recommended for production, see the warning below |
| Vercel account | https://vercel.com (sign up with GitHub) | free Hobby plan for personal use; **Pro is required for commercial use** |
| A domain | any registrar (Cloudflare Registrar, Porkbun, Namecheap…) | ~$10–15/year |
| GitHub Desktop (optional, easiest) | https://desktop.github.com | free |

> **Supabase free plan warning:** free projects are **paused after about a week without activity** and have no automatic backups. A paused project means every engraved tag stops working until you un-pause it. For real tags, upgrade the project to **Pro**, which never pauses and includes daily backups.

---

## 1. Put the code on GitHub

1. Open **GitHub Desktop** → *File → Add local repository* → choose the `qr-profile` folder.
2. It offers to "create a repository here". Click it, then **Publish repository**, and keep **"Keep this code private"** ticked.
3. Check on github.com that the repository exists. It must **not** contain a `.env.local` file; the included `.gitignore` prevents that.

<details><summary>Command-line alternative</summary>

```bash
git init
```

```bash
git add -A
```

```bash
git commit -m "QR Profile"
```

Then create an empty **private** repository on github.com and follow the "push an existing repository" commands it shows.
</details>

---

## 2. Create the Supabase project

1. https://supabase.com/dashboard → **New project**.
2. Name: `qr-profile`. Database password: click **Generate** and save it in your password manager (the app doesn't need it, but you might later).
3. Region: pick the one **closest to where the tags will be scanned** (e.g. *East US*, *Central EU (Frankfurt)*). Remember it for step 7.
4. Click **Create new project** and wait about 2 minutes.

## 3. Create the database tables

1. In the project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase/schema.sql` from this project in Notepad, select all (Ctrl+A), copy, and paste it into the editor.
3. Click **Run**. It should say *Success. No rows returned*.
4. Check the result:
   - **Table Editor** shows the tables `batches`, `people`, `tags` and `rate_limits`.
   - **Storage** shows a bucket called `photos` marked *Private*.

Running the file again later is safe.

## 4. Copy the two Supabase values

1. **Project Settings** (gear icon) → **Data API** → copy the **Project URL** (`https://xxxx.supabase.co`). This is your `SUPABASE_URL`.
2. **Project Settings** → **API Keys** → under *Secret keys*, create or reveal a secret key (`sb_secret_…`). If your project only shows the legacy keys, use the **service_role** key instead. This is your `SUPABASE_SERVICE_ROLE_KEY`.

> **Never share the secret key.** It gives full access to the database. It goes only into `.env.local` (on your PC) and Vercel's environment settings. Never paste it into a web page, chat or GitHub.

## 5. Make your secrets

Open a terminal (Windows: **Start → "Terminal"** or "Command Prompt") and run this twice to get two random strings:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- The first one is your `SESSION_SECRET`.
- For `ADMIN_PASSWORD`, choose a long passphrase (at least 12 characters, e.g. four random words). You can also use the second random string.

## 6. Try it on your PC (recommended)

1. In the `qr-profile` folder, copy `.env.example` to a new file named `.env.local`.
2. Open `.env.local` in Notepad and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` and `SESSION_SECRET`. Leave `PUBLIC_BASE_URL=http://localhost:3000` for now.
3. In a terminal inside the folder, run these one at a time:

```bash
npm install
```

```bash
npm run seed
```

```bash
npm run dev
```

4. Open http://localhost:3000/admin, log in, and click around. `npm run seed` printed URLs for each tag status; open them.
5. Press Ctrl+C in the terminal to stop.

## 7. Deploy on Vercel

1. https://vercel.com/new → **Import** your `qr-profile` GitHub repository.
2. Framework preset: **Next.js** (detected automatically). Leave the build settings unchanged.
3. Open **Environment Variables** and add each of these (name on the left, value on the right):

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | from step 4 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 4 |
   | `ADMIN_PASSWORD` | from step 5 |
   | `SESSION_SECRET` | from step 5 |
   | `PUBLIC_BASE_URL` | for now `https://<project-name>.vercel.app` (you'll see it after the first deploy) |
   | `DISPLAY_TIME_ZONE` | optional, e.g. `Europe/Berlin` |

4. Click **Deploy** and wait about 1–2 minutes.
5. **Function region:** `vercel.json` in this project pins the server to **Singapore (`sin1`)**, next to a Supabase project in *Southeast Asia (Singapore)*. If your Supabase project is somewhere else, change `sin1` to the matching Vercel region (e.g. Supabase *East US (N. Virginia)* → `iad1`, *West EU (London)* → `lhr1`, *Central EU (Frankfurt)* → `fra1`) and redeploy. The server and the database must be in the same region: every scan makes 2–3 database calls, and each one crossing continents adds about 0.3 s.
6. Open `https://<project>.vercel.app/admin` and log in.

## 8. Your own domain (before engraving!)

**Choosing a domain:** shorter is better, because every character makes the QR code denser and harder to scan at 5 mm. Something like `xyz.io` or a subdomain such as `id.yourcompany.com` is ideal. If your company already owns a domain, a subdomain costs nothing.

1. Buy the domain at a registrar and **turn on auto-renew**. If it ever lapses, every tag stops working.
2. Vercel → Project → **Settings → Domains** → **Add** → type the domain (e.g. `qrp.example.com`).
3. Vercel shows one or two DNS records (an **A** record or a **CNAME**). Log in to your registrar → DNS settings → add **exactly** the records Vercel shows. Wait until Vercel shows a green *Valid Configuration* (minutes to a few hours). HTTPS is set up automatically.
4. Vercel → **Settings → Environment Variables** → edit `PUBLIC_BASE_URL` to `https://qrp.example.com` (no slash at the end) → **Redeploy**.
5. In the admin, the red "Do not engrave yet" warning disappears.

## 9. Set up your phone for assigning tags

1. On your phone, open `https://YOUR-DOMAIN/admin` in the **default browser** (Safari on iPhone, Chrome on most Android phones). That is the browser the camera app opens scanned links in.
2. Log in. You stay logged in for 30 days.
3. Scan a blank (unassigned) tag with the normal camera app. It opens the assignment screen directly.

## 10. Before the first real batch

1. Remove the demo data: run `npm run seed:reset` on your PC.
2. Admin → **QR test**: print the test sheet and decide on size and error-correction level (see [BSLCAD.md](BSLCAD.md)).
3. Generate a small batch (e.g. 10), engrave it, and run through [TESTING.md](TESTING.md).
4. Then generate the real batches.

## Maintenance

- **Updating the app:** commit and push to GitHub. Vercel deploys automatically.
- **Backups:** Supabase Pro makes daily backups. Also keep the exported batch CSVs; they're your record of which IDs exist.
- **Changing the admin password:** edit `ADMIN_PASSWORD` in Vercel → Redeploy. To log out every device, also change `SESSION_SECRET`.
- **Logs:** Vercel → Project → **Logs** shows errors from the server.
- **Never change** `PUBLIC_BASE_URL` or `QR_URL_UPPERCASE` once tags are engraved. If you ever must move domains, keep the old domain and redirect it to the new one.
