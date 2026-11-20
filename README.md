# HiddenTimes website

A story site: readers see stories on the home page, and editors post them from a private admin page.

- **Stories** are saved in a **PostgreSQL database**.
- **Images** are saved in **online storage** (any S3-compatible service).
- **Pages** are built on the server, so Google, Bing, WhatsApp, Facebook, X and LinkedIn see every story's title, text and picture straight away.

## Run it

```
npm install
npm start
```

- Site: http://localhost:3000
- Admin: http://localhost:3000/admin (the home page has no link to it)

When the server starts, it shows where stories and images are being saved.

## Settings

All settings live in a file called `.env` in this folder. Copy `.env.example` to `.env` and fill it in. **Never share `.env` or upload it anywhere public**: it holds your passwords and keys.

| Setting | What it is |
|---|---|
| `SITE_URL` | your real web address, e.g. `https://www.hiddentimes.org` (used by Google and share previews) |
| `ADMIN_PASSWORD` | the admin page password. **The default `hiddentimes` must be changed before going live.** |
| `DATABASE_URL` | your online PostgreSQL database |
| `S3_*` | your online image storage |

Without `DATABASE_URL` and the `S3_*` settings, the site still runs, saving to this computer (`data/stories.json` and `uploads/`). That's fine for trying things out, but **not for the live site**.

## Accounts

| Service | Used for | Account |
|---|---|---|
| Supabase | database (stories) + image storage | GitHub account [@aimemoria](https://github.com/aimemoria) (sign in with GitHub) |

Passwords and keys never go in this file. They belong only in `.env`.

## Connecting online storage (recommended: Supabase)

Supabase gives you the database and the image storage in one free account.

1. **Create a project** at supabase.com. Choose *Continue with GitHub* and sign in as the account above. Choose a strong database password and the region closest to your readers.
2. **Database:** click **Connect** at the top of the project, open *Connection String*, choose **Session pooler** (it works on every network, and suits a server that stays running), copy the URI, replace `[YOUR-PASSWORD]` with your database password, and paste it into `.env` as `DATABASE_URL`. Then go to *Project Settings → Database → SSL Configuration*, click **Download certificate**, save it as `certs/supabase-ca.crt`, and keep `DATABASE_CA_FILE=./certs/supabase-ca.crt`.
3. **Image bucket:** go to *Storage → New bucket*, name it `stories`, and tick **Public bucket**, so readers can see the images.
4. **Storage keys:** go to *Project Settings → Storage → S3 Connection*, create an access key, and fill in `.env`:
   ```
   S3_BUCKET=stories
   S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
   S3_REGION=<the region shown on that page>
   S3_FORCE_PATH_STYLE=true
   S3_ACCESS_KEY_ID=<access key>
   S3_SECRET_ACCESS_KEY=<secret key>
   S3_PUBLIC_URL=https://<project-ref>.supabase.co/storage/v1/object/public/stories
   ```
5. **Start the site** with `npm start`. The database tables are created automatically, and the start-up message should say *Stories stored in → postgres* and *Images stored in → online storage*.
6. **Move your existing stories and images online:**
   ```
   npm run migrate:cloud
   ```
   This is safe to run more than once, and it doesn't change the files on this computer.

Other providers work the same way. For the database: Neon, Railway, Render or AWS RDS. For images: Cloudflare R2, AWS S3 or Backblaze B2. `.env.example` shows the settings for each.

### How the database is organised

The tables are in `db/schema.sql`:

| Table | Holds |
|---|---|
| `stories` | one row per story: title, section, author, summary, Markdown text, link, cover image address + description, featured/published, dates |
| `story_resources` | the Resources links of each story, in order (deleted automatically with the story) |
| `media` | a record of every uploaded image, so nothing in storage is lost track of |
| `settings` | site settings, e.g. the admin password hash |
| `page_views` | one row per visit for Analytics: page, story, country/city, source, device, active seconds, how far they scrolled. No IP addresses. |

Uploaded images are checked by their actual content: only real JPG, PNG, WebP and GIF files are accepted. When a cover is replaced, or its story is deleted, the old image is removed from storage automatically.

Run `npm run test:db` to check the database code against a real Postgres engine.

## Account and password

Go to **/admin → Account → Change password**. Enter your current password, then the new one twice (at least 12 characters).

- The new password is stored in the database only as a **scrypt hash**, a one-way scramble, so nobody can read it, not even with database access.
- Changing it **signs out every other device**.
- After the change, the starting password in `ADMIN_PASSWORD` stops working.
- The website never edits `.env` or your hosting settings. `ADMIN_PASSWORD` is only the starting password.

**Forgot it?** Run `npm run reset:password` with the database settings in `.env`. This removes the saved password, so the starting `ADMIN_PASSWORD` works again. Sign in with it and set a new one in Account.

## Posting a story

On `/admin`, fill in:

- **Title** and **Section**. The section groups stories into rows on the home page, for example *History* or *Interviews*.
- **Story**: written in Markdown (`**bold**`, `*italic*`, `[link](https://…)`, `## heading`, lists, `> quote`, images). Use the **Preview** tab to check it, or **Import .md file** to load a Markdown file. A cheat sheet sits under the editor.
- **YouTube or other link** (optional): a YouTube link adds a podcast player to the story and a ▶ badge to its card. Any other link shows a "Continue on…" button.
- **Resources** (optional): sources and further reading, each with a title and a link. They appear as a numbered list at the end of the story.
- **Cover image** (optional): upload one or paste a URL, and **describe it in a few words**, which helps Google Images and screen readers. If you skip the image, stories with a YouTube link use the video thumbnail.
- **Feature** pins a story to the top of the home page. Untick **Published** to keep a story as a draft (drafts are never shown to search engines).

## Analytics

Open **/admin → Analytics** to see:

- **Visitors and page views** per day, average visitors per day
- **Time spent:** average active reading time per visitor and per story, by day, and how long people stay (under 10 s up to 30 min +)
- **Most read stories:** views, readers, average time compared with the estimated read time, and the share who finished
- **Where readers are:** countries and top cities
- **Stayed longest and left fastest:** anonymous visits with place, device, day and stories read
- **Where visitors came from** (Google, WhatsApp, Facebook…) and **devices**

Choose 7 days, 30 days, 90 days or 1 year at the top. Every chart has a *Show the numbers* table.

**Privacy by design.** There are no cookies, nothing is stored on visitors' devices, and no IP addresses are kept. Each visitor gets an anonymous code that changes every day, so nobody can be followed over time. People who switch on *Do not track* or *Global Privacy Control* aren't counted, and nor are search-engine bots or your own visits while signed in to the admin. Time is counted only while the page is in front of the reader and they've been active in the last minute.

**Location** (country, region, city) comes from the hosting service once the site is online (Vercel and Cloudflare provide it). While testing on this computer, visits show as *This computer*.

Optional setting: `ANALYTICS_SECRET` in `.env` (any long random text) for the anonymous codes.

**Estimated read time** (about 220 words a minute) is saved with each story and shown on cards, the featured story, the story page and in the admin, and given to Google as the article's reading time.

## Search engines (SEO)

Built in:

- **Complete pages:** every page arrives finished from the server, with its own title, description, canonical link and share preview (Open Graph + Twitter cards).
- **Article labels:** Google can read the headline, date, author, image and section of each story, and it understands the podcast video and the breadcrumb path *HiddenTimes › Section › Story* (structured data in schema.org format).
- **`/sitemap.xml`:** every published story and section, with update dates and images. It refreshes by itself.
- **`/robots.txt`:** lets search engines in, keeps them out of `/admin` and `/api`, and points them to the sitemap.
- **`/feed.xml`:** an RSS feed of the latest 30 stories for feed readers and news apps.
- **Clean basics:** missing pages answer with a real *404 not found*, and story addresses are short and readable (`/story/the-battle-of-cannae`).

**After the site is live** (this needs your real domain):

1. Set `SITE_URL` in `.env` to your real address.
2. Add the site to **Google Search Console** and **Bing Webmaster Tools**, and submit `https://<your-domain>/sitemap.xml` in each.
3. Test a story at **search.google.com/test/rich-results**, and share a link in WhatsApp to see the preview.

## Publishing with ChatGPT Work

A simple publishing page for browser agents lives at **`/admin/agent-publish`**. It uses the same sign-in, checks and storage as the dashboard. The full guide, and a ready-to-use daily instruction for ChatGPT Work, are in [docs/agent-publishing.md](docs/agent-publishing.md).

## Hosting on Vercel (free)

The site runs on Vercel's free **Hobby** plan, connected to the GitHub repo `aimemoria/hiddentimes.org`. Every `git push` to `main` puts the new version online by itself, in about a minute.

### First setup (once)

1. Sign in at **vercel.com** with GitHub (@aimemoria).
2. **Add New → Project**, pick **hiddentimes.org**, and click **Import**. Vercel finds the settings by itself: Express, with `npm run build` as the build step.
3. Before clicking **Deploy**, open **Environment Variables** and add these. Copy the values from your `.env`, but never into a file that gets uploaded.

   | Name | Value |
   |---|---|
   | `SITE_URL` | `https://www.hiddentimes.org` |
   | `ADMIN_PASSWORD` | the starting admin password |
   | `SESSION_SECRET` | a long random text: it signs the admin sign-in cookie |
   | `DATABASE_URL` | the Supabase **Transaction pooler** address (port 6543, best for Vercel) |
   | `DATABASE_CA` | the full text of `certs/supabase-ca.crt`. Open the file in VS Code, copy everything, and paste it in |
   | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE` | same as in `.env` |

   Leave `DATABASE_CA_FILE` out: the `certs/` folder is never uploaded.
4. Click **Deploy**. The site opens at a `…vercel.app` address. Check it, and sign in at `/admin`.
5. **Settings → Domains:** add `www.hiddentimes.org` and `hiddentimes.org`, and follow the DNS steps Vercel shows at your domain registrar. Vercel adds HTTPS by itself.

### What's different on Vercel

- **Admin sign-in** is a signed cookie, not memory on the server, because Vercel starts and stops copies of the server all the time. Changing the password signs out every other device.
- **Cover images** can be 4 MB at most (Vercel's limit is 4.5 MB per request). The admin page shrinks bigger photos before they're sent, so this rarely matters.
- **Files in `public/`** are served by Vercel directly. `npm run build` copies the logo kit, the image shrinker and the Markdown helpers in there. On this computer `npm start` serves them from their own folders, so you don't need to build.
- Without `DATABASE_URL` the site won't start on Vercel. That's on purpose: it can't keep files, so stories would be lost.

Other hosts that run Node.js 22.9 or newer (Render, Railway, a VPS) also work with the same environment variables.

### Other addresses (hiddentimes.com typos)

The real address is `https://www.hiddentimes.org`. The site sends visitors from any other address it receives to the real one, with a permanent (301) redirect that keeps the page they asked for. For example, `hiddentimes.com/story/x` goes to `https://www.hiddentimes.org/story/x`. This covers the bare `hiddentimes.org`, plain `http://`, and `hiddentimes.com` with or without www. Google treats all of them as one site. Your computer (localhost) and the host's preview addresses (`*.vercel.app` and similar) aren't redirected.

For the .com to work you have to **own `hiddentimes.com`** (about $10 to $15 a year with any registrar). Then add `hiddentimes.com` and `www.hiddentimes.com` to the host as extra domains, next to the .org. The host routes them to this site, and the code sends the visitor on to .org.

---

## Future plan: user accounts and roles

> **Status: planned, not built yet.** Today there is one shared admin password, and anyone who signs in can do everything. This section describes the next step: separate accounts with three roles.

### The three roles

**Writer.** Writes stories and can change anything in **their own** stories: text, title, section, cover, YouTube link, resources and draft/published status. Writers can't see or change anyone else's drafts.

**Editor.** Has every Writer power, plus full access to **every writer's stories**. An editor can correct, rewrite, publish, unpublish, feature or delete any story.

**Admin.** Has every Editor power, plus control of the team:

- add new users and choose their role (Writer or Editor)
- remove users, or suspend them without deleting their stories
- reset a user's password
- change what each role is allowed to do (see *Adjustable permissions* below)

There is always at least one Admin, and the site won't let the last Admin be removed or demoted.

### Who can do what (default settings)

| Action | Writer | Editor | Admin |
|---|:---:|:---:|:---:|
| Write a new story | ✓ | ✓ | ✓ |
| Edit own stories | ✓ | ✓ | ✓ |
| Publish / unpublish own stories | ✓ | ✓ | ✓ |
| Delete own stories | ✓ | ✓ | ✓ |
| See other people's drafts | | ✓ | ✓ |
| Edit anyone's story | | ✓ | ✓ |
| Publish / unpublish anyone's story | | ✓ | ✓ |
| Feature a story on the home page | | ✓ | ✓ |
| Delete anyone's story | | ✓ | ✓ |
| Add / remove users | | | ✓ |
| Change a user's role | | | ✓ |
| Change role permissions | | | ✓ |

### Adjustable permissions

An Admin can switch each permission on or off from a **Team** page in the admin area, in two ways:

1. **Per role:** for example, writers' stories need an editor's approval before going live (turn off *Publish own stories* for Writers).
2. **Per person:** an exception for one user, for example a trusted writer who may also feature stories.

A per-person setting overrides the role setting. Admin-only powers (managing users and permissions) can't be given to other roles, so nobody can lock the Admin out.

### How it would be built

- **Accounts:** a new `users` table in the database holding name, email, role, permission overrides and a **hashed** password (Node's built-in `scrypt`, never plain text).
- **Sign in:** with email + password instead of the shared password, and sessions kept in the database so sign-ins survive restarts. On first start after the upgrade, the existing `ADMIN_PASSWORD` creates the first Admin account, so nothing breaks.
- **Story ownership:** each story records its `author_id`, plus who last edited it and when. Existing stories are assigned to the first Admin.
- **Permission checks on the server:** every save, publish and delete is checked against the signed-in user's role and overrides. The admin page also hides buttons the user can't use, but the server check is what actually protects the stories.
- **Team page (Admins only):** a list of users with role, status and last sign-in, plus buttons to invite, change role, reset password and suspend or remove.
- **Activity log:** an `activity` table recording who created, edited, published or deleted what, so editors and admins can see changes.
- **Byline:** the public story page shows the writer's name automatically, and the free-text *Author* field stays available for guest writers.
- **Optional later:** email invitations, *Submit for review* for writers whose publish permission is off, and showing the changes between versions of a story.
