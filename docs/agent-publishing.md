# Publishing with ChatGPT Work (agent publishing page)

**Address:** `https://<your site>/admin/agent-publish`
For now: `https://hiddentimes-org.vercel.app/admin/agent-publish`. Later: `https://www.hiddentimes.org/admin/agent-publish`.

This is one plain page, built so a browser agent can use it easily. It signs in with the normal admin password, and it publishes through the same server code as the admin dashboard. No AI service or API is connected to the website.

## What the page does

| Need | How |
|---|---|
| Sign in | The normal admin password (same sign-in as `/admin`). Sessions last 12 hours. |
| Title, category, description, story, sources | Ordinary labelled fields. Category is a drop-down of the existing categories (from published stories). Sources: one per line, written as `Title \| https://link`. |
| Cover image | Either an `https://` image address (the server downloads it and keeps a copy in HiddenTimes storage) or a file upload (big photos are made smaller first). Plus an image description and an **image credit**, shown under the image. |
| Save a draft | **Save as draft**: only needs a title and some text. Drafts are never public. |
| Publish | **Publish story**: the server checks everything a finished story needs (list below). |
| Result | The box `#result` shows `data-status="success"` or `"error"`, a message, and a list of problems. When published, it shows the public address and opens it to confirm: `#result-check` gets `data-verified="true"`. |
| No duplicates | A second story with the same title (ignoring capitals and punctuation) is refused. Each form has a hidden submission code, so a double click or a retry after a lost connection returns the story already saved instead of a copy. |
| History | **All stories** at the bottom (newest first, drafts included), with **Continue this draft** buttons. |
| Recovering from interruptions | The form saves itself in the browser as you type. After a reload, a crash or a sign-out, the work comes back. Clicking the same button again is always safe. |

**Rules for publishing** (checked by the server, not only the page):

- a title of at least 10 characters
- an existing category
- a short description of 40 to 300 characters
- at least 300 words
- at least one source with an `https://` link
- a cover image, with an image description and an image credit

Field ids, for reference: `#title`, `#category`, `#excerpt`, `#body`, `#sources`, `#cover-url`, `#cover-file`, `#cover-alt`, `#cover-credit`, `#publish-button`, `#save-draft-button`, `#result`, `#result-url`, `#history-table`. Sign-in uses `#password` and `#sign-in-button`.

## Setup

Nothing to install. The database changes apply themselves when the server starts. They add two columns to `stories`, both optional, and existing stories are unaffected:

- `cover_credit`: the image credit text.
- `submission_id`: with a unique index, so one submission can only ever create one story.

After deploying, open the address above, sign in, and check that the category list shows your categories.

## How ChatGPT Work should use it

1. Open the page and sign in (the user may need to take over to type the password; see the limits below).
2. Read **All stories** and pick a topic that isn't there.
3. Research, write, then fill in the fields from top to bottom.
4. Optionally click **Save as draft** first, so nothing is lost.
5. Click **Publish story**.
6. Read `#result`:
   - `success` with "Verified": done, report the public address.
   - `error`: fix each listed problem and click again.

## Ready-to-use ChatGPT Work instruction

Copy this into a scheduled ChatGPT task, set to repeat daily at 6:00 AM Arizona time (Mountain Standard Time, no daylight saving: UTC−7).

```
You are the daily writer for HiddenTimes, a website of fascinating true stories: historical mysteries,
unusual crimes, scientific discoveries, unexplained phenomena and remarkable events from around the world.

Every day, research, write and publish ONE new story.

1. Open https://hiddentimes-org.vercel.app/admin/agent-publish
   If a sign-in form appears, ask me to sign in (do not guess or store the password).
2. Scroll to "All stories". Choose a topic that is NOT already covered there (check for the same event,
   person or case, not only the same title).
3. Research the topic using credible sources: encyclopaedias, museums, universities, archives, government
   records, reputable newspapers and books. Use at least 3 sources. Do not use content farms or AI-written sites.
4. Write the story:
   - Simple, natural English; engaging, like a good nonfiction book. 900 to 1,800 words.
   - A strong opening paragraph that pulls the reader in.
   - Markdown: "## " for chapter headings, an empty line between paragraphs.
   - Clearly separate documented facts from theories ("Historians believe…", "One theory suggests…",
     "It has never been proven that…").
   - Never invent quotations, names, dates, numbers or details. If something is uncertain, say so.
   - End with what is known today, or what remains unexplained.
5. Find a cover image you are allowed to reuse: public domain or Creative Commons from Wikimedia Commons,
   the Library of Congress, or a museum's open-access collection. On Wikimedia Commons, use the
   "Original file" link or a standard width (for example the 1280px version). Note the creator, licence
   and source. If no suitable image exists, stop and tell me instead of using an unlicensed one.
6. Fill in the form:
   - Story title
   - Category: choose the closest existing one from the list
   - Short description: one or two sentences, 40 to 300 characters
   - Story content: the full Markdown story
   - Source references: one per line, "Title | https://link"
   - Image address: the image's https:// link
   - Image description: what the picture shows
   - Image credit: e.g. "Photo: Jane Doe, CC BY-SA 4.0, via Wikimedia Commons" or "Public domain, via Library of Congress"
7. Click "Save as draft", then "Publish story".
8. Read the Result box. If it says "Not saved", fix every listed problem and click "Publish story" again
   (clicking again is safe; it never creates a duplicate). If it says "Published" and "Verified",
   you are done.
9. Report to me: the title, the public address, the sources used, and the image credit.
   If anything failed, report the exact message from the Result box.
```

## Limits that can stop unattended daily publishing

These depend on ChatGPT, not on the website, and need testing.

- **Sign-in:** the agent needs the admin password. ChatGPT Work usually asks you to take over the browser to type passwords. Its browser may not keep cookies between scheduled runs. A sign-in lasts 12 hours, so each daily run will probably need you to sign in. Never put the password in the task instructions.
- **Confirmation prompts:** ChatGPT Work may stop and ask before submitting a form or publishing ("Should I click Publish?"). If nobody answers, the run waits or ends.
- **Schedules:** ChatGPT's scheduled tasks and agent runs have their own limits on availability, run length and how many per month. They can change, and runs can fail or be skipped.
- **Images:** some image sites block automated downloads. The page then says why. Wikimedia Commons and the Library of Congress normally work.
- **Size:** uploaded files can be 4 MB at most; images given by address can be 6 MB at most.
- **Quality:** the server checks the form (length, sources, credit, duplicates), but it can't check whether the facts are true. Read new stories regularly. Any story can be edited or unpublished in `/admin`.
