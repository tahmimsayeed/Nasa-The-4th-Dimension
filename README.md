# 🤖 Robo Pet Station

Kids build their own space robo pet inspired by real NASA hardware left on the Moon,
on Mars, and in deep space — then learn that hardware's true story and share their own
creative work in a Class Museum Wall.

Built for the **2026 NASA Space Apps Challenge**: *Abandoned but not Forgotten —
Storytelling about NASA's Discarded Equipment on the Moon and Mars.*

- **Audience**: kids aged 7–12, in a classroom with a teacher or at home
- **No login**: a nickname + a class code (e.g. `MOON-42`) is all it takes
- **Works on** tablets, Chromebooks and phones

---

## 🚀 Quick start

```bash
npm install                  # install dependencies
npm run build                # build the worker + copy static assets to dist/
npm run db:migrate:local     # create the local SQLite database
npm run db:seed              # add 6 demo exhibits so the wall isn't empty

pm2 start ecosystem.config.cjs   # start on http://localhost:3000
curl http://localhost:3000/api/health
```

Other useful commands:

| Command | What it does |
|---|---|
| `npm run db:reset` | wipe the local DB, re-migrate and re-seed |
| `npm run db:console:local` | run SQL against the local DB |
| `pm2 logs --nostream` | view server logs |
| `npm run deploy:prod` | deploy to Cloudflare Pages |

**Try it out**: open `/`, use nickname `StarPilot7` and class code `MOON-42`.
Teacher view is at `/teacher` — demo class `MOON-42` uses PIN `1234`.

---

## 🎮 The game flow

A progress bar at the top always shows where the kid is: **Build → Learn → Create → Share**.

1. **Welcome** — pick a nickname (never a real name) and enter the class code.
2. **Build Your Robo Pet** — choose one of 6 real NASA machines as inspiration, then
   customise body, wheels/legs/rotors, colour, antenna, science tool, eyes and name.
   A live animated SVG preview updates on every tap. "Surprise me!" randomises everything.
3. **Meet Your Pet's Real Story** — a kid-friendly *mission file*: where the hardware is,
   when it launched, what it did, what it discovered, its current status, 5 fun facts and
   a **Did you know?** card. Hard words are tappable for a glossary pop-up.
4. **Creative Mission** — the kid picks **one** of two tasks (see below).
5. **Share** — the finished piece can be downloaded as a PNG or printed, then published
   to the Class Museum Wall.
6. **Reward** — a collectible **Pet Trading Card** unlocks with confetti, showing the pet's
   picture plus the real mission facts and a rarity badge.

### Mission A — "Message Home" 💌
A postcard written from the robo pet's point of view, with guided prompts
("Where am I?", "What did I see?", "What did I help scientists learn?",
"How do I feel being left behind?").

Three input modes are offered as **equal** options, so a kid who finds writing hard can
still take part fully:

- **⌨️ Type it** — textarea with sentence starters
- **🎨 Draw it** — finger/stylus/mouse canvas with 9 colours, 3 brush sizes, undo and clear
- **🎤 Say it** — one-tap 20-second voice recording with a live timer

A **fact-check nudge** requires at least one real fact from the mission file before the kid
can continue. Clickable **fact chips** insert the true facts straight into the text.

Output: a styled postcard with a space stamp, the pet's picture and the message —
downloadable as a PNG or printable.

### Mission B — "Rescue or Retire" ⚖️
The kid decides their robot's fate: **bring it home to a museum**, **leave it as a historic
site**, or **give it a new job**. They fill a one-page Mission Plan: the decision, 2–3 reasons,
and one risk or challenge they considered. Sentence starters and example reasons are offered
for younger kids.

Output: a **Mission Decision Report** card with the pet's image, a decision stamp and the
reasons — plus a **class-wide poll** result after submitting
("3 other classmates also chose to leave it there").

---

## 🖼️ Class Museum Wall

- Every pet is an exhibit with a **museum plaque**: pet name, creator's nickname, and the
  real hardware it's based on
- Tap an exhibit to read the postcard or mission report, and **play the audio** if there is any
- Each exhibit has its own page at `/exhibit/:id` with a **QR code** — print it for a display
- **Filters**: by hardware type, by task (postcard / rescue-retire), newest or most-loved
- **Reactions**: preset stickers only — ⭐ star, 🚀 rocket, ❤️ heart. There is deliberately
  **no free-text comment anywhere in the app**, and each device can give each sticker once

### Teacher view (`/teacher`)
Sign in with the class code and a 4–8 digit PIN. The first teacher to sign in for a class
claims it with their PIN — there are no accounts to manage.

- See **all** submissions, including ones waiting for approval
- **Approve / hide / restore / delete** any exhibit
- Toggle **"check work before it goes on the wall"** per class
- **Export the gallery as a printable PDF**: a cover page with a class summary table and a
  decision tally, then one page per exhibit with the full work, the real mission facts and a
  QR code. Uses the browser's native print dialog ("Save as PDF"), so it works identically
  on Chromebooks, iPads and Windows

---

## 🛰️ The six real NASA hardware stories

All facts were verified against `science.nasa.gov` and `jpl.nasa.gov` (last checked 2026-10-03).

| Hardware | Where | Status |
|---|---|---|
| **Apollo Lunar Roving Vehicle** | Taurus-Littrow Valley, Moon | Parked on the Moon since 1972 |
| **Sojourner** | Ares Vallis, Mars | Silent since 1997 |
| **Spirit** | Gusev Crater, Mars | Stuck and silent since 2010 |
| **Opportunity** | Perseverance Valley, Mars | Silent since 2018 |
| **Ingenuity** | Jezero Crater, Mars | Grounded since 2024 |
| **Voyager 1** | Interstellar space | **Still flying and still talking to Earth** |

---

## 📝 Editing the mission facts (for teachers & developers)

All content lives in one file: **`public/static/data/missions.json`**.

It carries its own instructions in a `_readme` key at the top. To add hardware:

1. Copy a whole block inside `hardware`
2. Give it a new unique lowercase `id`
3. Fill in every field, keeping sentences short for ages 7–12
4. Set `base_shape` to one of `rover6`, `rover4`, `buggy`, `copter`, `probe`, `lander`
5. Save and reload the page — **no rebuild needed**

The same file also holds the **glossary** (tap-to-define words), all **builder options**
(bodies, movers, colours, antennas, tools, eyes), the **postcard prompts** and the
**decision options with example reasons**.

---

## 🔒 Safety & accessibility

**Safety**
- **No personal data is ever collected** — nicknames only, no email, no photo, no real names
- **No free chat between kids**: reactions are preset stickers, and there are no comments
- **Teacher approval option** before submissions go live on the wall
- **Profanity filter on every text input**, running on both client and server. It handles
  leet-speak and self-censoring (`sh1t`, `f*ck`, `a55hole`) while avoiding the classic
  false-positive trap — "classmates", "assess", "grass", "45 kilometers" and "2 * 3" all pass
- Emails, phone numbers and `@handles` are rejected so kids can't share contact details
- All kid-entered text is HTML-escaped on output; `<` and `>` are stripped on input

**Accessibility**
- **🔊 Read-aloud button** on every block of text, using the browser's built-in speech
  synthesis (no API key, works offline). Tap again to stop
- **🔠 Bigger text** and **◐ high-contrast** modes, remembered between visits
- **📖 Glossary pop-ups** for words like *rover*, *probe*, *silica*, *interstellar space*
- Touch targets are ≥48px; body text is ≥17px; focus rings are clearly visible
- Semantic HTML with ARIA labels, `aria-pressed` on all toggles, and live regions for
  announcements; `prefers-reduced-motion` disables animations

---

## 🏗️ Tech & architecture

- **Backend**: Hono on Cloudflare Pages/Workers (edge)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: vanilla ES modules — no framework, no CDN, no build step for the client
- **Graphics**: every robo pet is procedurally drawn **inline SVG**, so it scales crisply from
  a 90px thumbnail to a printed card and costs zero network requests
- **Total client payload**: ~208KB uncompressed across all screens

```
webapp/
├── src/
│   ├── index.tsx              # Hono app: API routes + page shells
│   └── safety.ts              # profanity / contact-info filter (server authority)
├── public/static/
│   ├── data/missions.json     # ← ALL editable content lives here
│   ├── css/app.css            # hand-written CSS incl. print styles
│   ├── js/
│   │   ├── app.js             # router, progress bar, top bar, boot
│   │   ├── state.js           # state + localStorage resume
│   │   ├── api.js             # fetch wrapper
│   │   ├── ui.js              # HTML helpers, toasts, modals, confetti, QR
│   │   ├── a11y.js            # read-aloud + glossary
│   │   ├── pet-renderer.js    # procedural SVG robo pet engine
│   │   └── screens/           # welcome, build, learn, create, share, reward, wall, teacher
│   ├── vendor/qrcode.js       # vendored QR generator (no CDN)
│   └── img/favicon.svg
├── migrations/0001_initial_schema.sql
├── seed.sql                   # 6 demo exhibits
├── ecosystem.config.cjs       # PM2 config
└── wrangler.jsonc
```

### Data model

- **classes** — `code` (PK), `require_approval`, `teacher_pin`
- **exhibits** — `id` (PK, used in URL + QR), `class_code`, `nickname`, `pet_name`,
  `hardware_id`, `pet_config` (JSON), `task_type`, postcard fields
  (`postcard_text`, `drawing_data`, `audio_data`), decision fields
  (`decision`, `reasons`, `risk`), `status` (`live` / `pending` / `hidden`)
- **reactions** — `exhibit_id`, `sticker`, `voter_key`, with a UNIQUE constraint so one
  device can't spam the same sticker

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/class/join` | join/create a class, validate nickname |
| `POST` | `/api/exhibits` | publish a finished exhibit |
| `GET` | `/api/exhibits?classCode=&hardware=&task=&sort=` | gallery list (live only) |
| `GET` | `/api/exhibits/:id` | one exhibit with full media |
| `POST` | `/api/exhibits/:id/react` | add a sticker reaction |
| `GET` | `/api/poll?classCode=` | class-wide decision tally |
| `POST` | `/api/check-text` | live profanity check while typing |
| `POST` | `/api/teacher/login` | claim/verify a class PIN |
| `POST` | `/api/teacher/settings` | toggle approval requirement |
| `POST` | `/api/teacher/exhibits/:id/status` | approve / hide / restore |
| `POST` | `/api/teacher/exhibits/:id/delete` | delete permanently |
| `GET` | `/api/teacher/export?classCode=&pin=` | data for the printable PDF |

Pages: `/` (game), `/wall` (gallery), `/exhibit/:id` (QR target), `/teacher`.

---

## 🧑‍🏫 How a teacher uses it

1. Open `/teacher`, enter a class code (e.g. `MARS-7`) and pick a PIN. **Write the PIN down.**
2. Decide whether to tick **"check work before it goes on the wall"**.
3. Project the class code on the board (the teacher page shows it large, with a QR code).
4. Kids open the site, enter a nickname and the code, and work through Build → Learn →
   Create → Share. Expect **25–40 minutes** for a full first pass.
5. Approve submissions as they arrive, then open `/wall` on the projector for a class
   gallery walk.
6. Use **Export gallery as PDF** to print the exhibits for a corridor display or
   parents' evening.

---

## 🔭 Suggested next steps

The full flow works end to end. Natural extensions, roughly in order of value:

1. **More hardware** — Curiosity, Perseverance, the Apollo ALSEP instruments, Viking landers,
   Pioneer 10/11, the Mars Polar Lander. Each is a ~15-line block in `missions.json`.
2. **Server-side image moderation** for drawings — currently drawings are reviewed by the
   teacher rather than automatically scanned.
3. **Audio transcription** so voice postcards get searchable captions and the profanity filter
   can check spoken words too (currently voice clips rely on teacher review).
4. **Real PDF generation** on the edge (e.g. `pdf-lib`) instead of the browser print dialog,
   giving pixel-identical output and a true file download.
5. **Teacher dashboard analytics** — which hardware is most popular, how the decision split
   compares across classes, which kids haven't submitted yet.
6. **Offline mode** via a service worker, so a class with patchy wifi can keep building and
   sync their exhibits later.
7. **Multi-language support** — the content is already fully externalised in `missions.json`,
   so a translated copy of that one file plus a language picker would localise the whole app.
8. **Accessibility audit with real users**, especially screen-reader testing of the drawing
   canvas, and a switch-access pass.
9. **"Pet collection" screen** — kids who build several pets could see all their trading cards
   as a collectible album.
10. **Class-to-class gallery exchange**, so two schools can swap museum walls.

---

## 📦 Deployment

- **Platform**: Cloudflare Pages + Workers, with D1 for storage
- **Status**: ✅ working prototype, fully tested locally
- **Stack**: Hono + TypeScript + vanilla JS + D1 + hand-written CSS
- **Last updated**: 2026-10-03

To deploy to your own Cloudflare account:

```bash
npx wrangler d1 create webapp-production       # copy the database_id into wrangler.jsonc
npx wrangler d1 migrations apply webapp-production
npm run deploy:prod
```

Optionally set a school-specific blocked word list as a secret:

```bash
npx wrangler pages secret put EXTRA_BLOCKED_WORDS   # comma separated
```

---

## 🙏 Credits

Mission facts from NASA and NASA/JPL-Caltech public mission pages. Built as an educational
entry for the 2026 NASA Space Apps Challenge. Not affiliated with or endorsed by NASA.
