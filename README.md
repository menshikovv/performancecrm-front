This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project documentation

- [CRM authentication, registration, endpoints, and database ID model](docs/CRM_AUTH_AND_DATABASE.md)
- [Target web/mobile architecture, PostgreSQL, Redis, realtime, and deployment](docs/CRM_WEB_MOBILE_ARCHITECTURE.md)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

The interface uses locally bundled Inter Variable with Cyrillic support. Font files are served by the application without an external font CDN.

## Shared motion

All routes use the same motion system from `app/components/crm-motion.tsx` and `app/motion.css`: 780 ms opacity/18 px reveals, a capped 60 ms stagger (180 ms maximum), 220 ms control feedback and 420 ms panels/dialogs. The shared layout installs it once. IntersectionObserver reveals individual cards/KPI tiles and semantic blocks, not their whole grid at the same time. There is no wheel/touch interception or continuous scroll handler. Native smooth scrolling applies to in-page navigation; Next.js owns route scroll restoration via `data-scroll-behavior`.

Server HTML, disabled JavaScript and unsupported animation APIs remain visible by default. Only offscreen or not-yet-painted newly inserted blocks get a temporary JS-managed waiting state, synchronously before paint. Content already on screen is never dimmed to start a fade, and the same DOM node is not restarted when its values or children change. Initial visible server-rendered blocks only move gently; new client-side routes are prepared in a layout effect before paint. Calendar/Overview load their local state before the first client navigation paint, avoiding an intermediate empty loading shell. Sticky elements fade without translation; keyboard focus/clicks reveal pending content immediately. Reduced motion, tab hiding and route cleanup release every pending block, and observers/animations are cleaned up. Custom leaf cards may use `data-motion="reveal"`, and sensitive regions `data-motion="off"`.

The OS `prefers-reduced-motion` setting disables the motion system, CSS animations/transitions and smooth scrolling, including when changed while the page is open. FullCalendar internals and modal contents are not scroll-revealed; dialogs use the shared panel animation. Cognitive-test content opts out of decorative motion so reaction/memory stimuli remain immediate. No new animation library, backend requests or storage migration is required.

## Calendar

Open `/calendar` without signing in to preview the CRM interface. The calendar uses FullCalendar with month and week views, a selected-day agenda, event links, and create/edit/delete forms. The sidebar demo switch opens the staff view with personal, team, and player calendar filters.

Events and notifications are stored in this browser's localStorage. Existing saved events are retained when the design changes. Calendar settings include an explicit confirmation before restoring the demo schedule. Reminders work while the page is open; delivery to other users and reminders when the browser is closed still require a server integration.

### Staff calendar

Open `/calendar?role=staff` or enter Calendar from a Staff page. The shared demo role selects a dedicated reference-style layout on the same route: Staff header/create button, owner-tag chips with actual monthly counts, a month-only FullCalendar grid with previous/today/next controls, and the selected day's agenda on the right. At most two event pills appear per cell; the overflow link opens the remaining events and selects that day. Days can also be selected with Enter/Space or navigated with arrow keys. Player mode keeps its existing month/week layout and personal calendar.

- Staff defaults to `#командный`; `#личный` is the separate `staff-personal` calendar. The five current demo player owners match vexa, frost, Kairo, m1rage and zeNN. New or explicitly restored examples include a dense month schedule (for the reference date 13 October 2026: 35 team events, five Staff-personal events and 4/5/4/1/1 player events). Dates follow the current local month; counts are computed, never hard-coded in the UI.
- Existing `calendar-app:v1` events are not replaced or migrated merely by opening the updated page. Old player owner IDs retain their original names and remain accessible through Calendar settings → Other calendar; selecting one adds its chip. The player's existing `personal` calendar stays separate and is also accessible through settings. Updating or removing an event changes only that event, not other owners' schedules.
- Event creation defaults to the selected date/owner. Editing can move an event between owners/months; all-day events remain supported. Changes append local notifications, and their links open the correct event/owner/date. Edit conflicts with another tab are reported instead of silently overwriting that tab's event. Storage failures retain the editor and show an error rather than a successful save.
- Staff owner/date/month preferences persist separately in `calendar-staff-view:v1`; the shared event/notification/role store stays `calendar-app:v1`. Event and role changes refresh in other open tabs, and writes merge against the latest store. Switching back to player mode removes the URL role override and restores a month view; the player's week view remains available.
- Staff notifications and browser-reminder settings are reached through the sidebar Settings button. Reminder checks are in-page; change notifications are a browser-local demo feed, not actual messages delivered to players. Staff role, team visibility and edit rights must be enforced by the backend before using real team data.

## Overview

Open `/overview` without signing in to preview the dashboard. The overview and calendar use the same sidebar and link to one another. Other sidebar items open the relevant overview section or metric details.

- Daily mood, energy, and sleep-quality ratings update the completion progress and daily streak. Changing a rating updates the same daily record.
- Weekly charts and summaries recalculate from local records. The state badge reflects the latest mood rating; the donut shows the weekly average and distribution.
- The widget chips and `+` control let users show or hide state, sleep, nutrition, and game widgets.
- Each card's arrow opens its record history. Users can add dated scores, sleep duration and energy, and notes. Future dates and invalid values are rejected.
- Calendar notifications and the upcoming-event widget open the matching event in `/calendar`.

The initial dataset is mocked. Overview records and widget preferences use the `performance-overview:v1` localStorage key. No backend is called; data is scoped to this browser and device. The demo role is shared with the calendar.

## Staff overview

The Overview demo-role switch now opens a distinct team dashboard rather than relabelling the player's screen. `/overview?role=staff` previews it directly and persists the shared demo role; switching back removes that URL override. This is a UI demonstration, not authorization.

- The Staff sidebar has Overview, Calendar, Players, Materials, Statistics and Game Statistics. Players opens the standalone `/players` roster and player profiles. Materials opens the standalone `/strategies` catalog. Neither action creates a real team membership or executes/downloads scripts. Previous overview checklist records are retained in local storage, but the old modal is superseded by this catalog.
- The default dashboard includes mood distribution, sleep/energy, readiness, cognitive form, K/D and win rate. State/sleep/nutrition/game chips independently control widgets. The scope chips switch between all five mock players and one player, recalculating every card and detail table.
- Current summaries use the last seven calendar days; changes compare the previous seven. Means exclude missing observations but retain zeroes. K/D uses total known kills/deaths, and win rate uses total known wins/maps, not an unweighted average of ratios. Zero deaths produce an unknown K/D. Sparkline gaps remain gaps; readiness/cognitive indices are unvalidated demonstration values, not health assessments.
- Card arrows open daily data tables; charts expose values by keyboard focus and pointer. The top event link uses actual team-scope events in the existing local Calendar. The three Staff notifications are explicitly demo messages and maintain separate read state.

Staff records, selected player, widget preferences, notification reads and checklist progress use `performance-staff-overview:v1`. They do not overwrite personal check-ins, test records or saved games. Shared role changes and cross-tab updates are supported. Genuine team access and player data ingestion still need authenticated backend permissions and data integration.

## Staff players

Open `/players` without signing in. This standalone Staff demo includes a five-player readiness roster, a selected player's profile and seven tabs: Profile, Tests, Game, Correlations, Balance, Nutrition and Sleep. `?player=vexa` (or another demo player ID) selects a player directly. `?view=nutrition` opens the team meal feed. Old `/overview?section=players` links redirect here.

- Readiness, sleep, mood and cognitive values reuse the same `performance-staff-overview:v1` observations as the Staff overview. Existing observations and missing recent days are preserved. Older periods use deterministic demo history, not imported player data. Readiness remains today's snapshot while 7/30/90-day periods control the detail panels and team nutrition table.
- Test and game-source filters update the appropriate charts/tables. K/D and win rate are weighted by kills/deaths and maps; comparisons use the preceding equal-length period. Correlations pair same-date sleep/test values and require at least five non-constant pairs. They are not causal conclusions or medical assessments.
- Communication notes autosave separately for each player. Scheme, roadmap and mindmap uploads accept PNG/JPEG/WebP images up to 5 MB and 8000 pixels per side, resize to at most 1000 pixels, and store a compressed preview locally. Preview, replacement and confirmed removal are supported. Storage failures show an error instead of reporting success.
- Telegram, FACEIT and Steam links are entered explicitly. Until configured, social buttons open a link editor rather than pretending to open a known player account. Only validated HTTPS profile links on the respective exact hosts are accepted.

Selections, filters, notes, contact links and image previews persist in `performance-staff-players:v1`, independently from the overview's selected player. Other tabs receive updates. These are browser-local demonstration records: Staff mode is not authorization, notes are not access-controlled, and uploads are not sent to a server. Production player records and confidential staff notes require authenticated backend permissions and server storage. Do not enter confidential information in the public demo.

### Team nutrition feed

The `Питание команды` mode contains a grouped meal feed and daily summary, matching the reference's warm photo placeholders and dark no-photo cards. It has all-player/individual filters, Today/3-day/7-day periods and a photo-only toggle. The starter examples contain 35 meals (21 marked with photo placeholders) over three days, or 95 over seven days. Dates follow the current local calendar day. Placeholders are explicitly not real food photos or AI-recognition results.

- Meal cards open calories, protein, fat, carbs and player/date/time details, with previous/next navigation within the filtered feed. Day headings or the summary's date selector select the day being summarized.
- Summary cards filter the feed by player. Daily totals always include all that player's meals on that day, regardless of the feed's photo filter or selected player. Progress bars use each player's configurable calorie target; water and macros are demonstration values. `В норме` indicates at least two example meal records without exceeding the configured calorie reference, not nutritional adequacy or a health assessment.
- Calorie/water references and feed filters are validated and saved separately in `performance-staff-nutrition:v1`, retaining roster/profile preferences and personal recovery records. They synchronize across tabs. The mobile summary is collapsible so meals remain easy to reach.

This dedicated example meal feed is separate from the Staff overview's aggregate nutrition history and the personal Recovery module. Editing its display targets does not rewrite either dataset. Real mobile meal delivery, food photos, dietary assessment and team authorization are not connected.

## Team strategies and scripts

Open `/strategies` without signing in. The Staff sidebar links here from every CRM page. Old Staff `/overview?section=strategies` links redirect here. The reference-style page has summary counters, a searchable two-column catalog, map/type/T/CT/favorite filters and a selected material's preview, tags, instructions, author/date and actions. On narrow screens, selecting a card opens its details in a modal.

- Ten initial examples include eight grenade lineups and two team plans, with three favorites. Preview backgrounds and type icons are code-rendered placeholders, not actual CS2 screenshots. Search covers title, map, description, type and author; filters combine. Counters at the top describe the full catalog; map counts reflect the other active filters.
- Add/edit forms validate title, map, side, type, 1–20 numbered steps, optional description, inert script text and optional video URL. Editing keeps the same ID, original author/date, favorites and unchanged step completion; changing instructions resets their completion to avoid stale checkmarks. Unsaved edits prompt before discarding. Concurrent material edits/deletion show a conflict instead of silently overwriting them. Deletion requires confirmation and affects only the selected record.
- Favorites and numbered-step completion persist. Explicitly empty catalogs remain empty; malformed storage falls back to demo examples. Cross-tab updates and selection/filter persistence are supported, with at most 500 stored materials.
- Video URLs must be HTTPS YouTube/Rutube links or direct MP4/WebM/OGV files on a public hostname; unsafe schemes, credentials, IP literals and local hosts are rejected. Video-service links open externally; direct files use native controls without autoplay. Seed video badges open an explicit demonstration placeholder until a real URL is provided. Videos are not imported automatically, and remote availability remains the video's host's responsibility.
- Script text is rendered as plain text and can be copied. The CRM does not execute it, run game commands, or generate executable files.

The catalog, favorites, selected material and filters use `performance-strategies:v1`, separate from Staff metrics, player notes, games and personal records. Team visibility, author identity and edit rights are demonstration-only. There is no server authorization, shared team database, upload service or cross-device synchronization yet. Do not put confidential team material in this public browser-local demo.

## Tests

Open `/tests` without signing in. It uses the same CRM sidebar, local Inter font, notification feed, and demo role as the overview and calendar.

- The daily battery contains playable Visual Search, Go / No-Go, 2-Back, Stroop Switch, and Spatial Span tasks. Accuracy and reaction time come from actual answers; completed tests can be resumed as a battery or repeated individually.
- Results, daily progress, the seven-day trend, and attempt history update immediately. The first two successful attempts of each test are calibration; attempts below 60% accuracy are excluded from the daily index. Scores are a demonstration formula, not a validated assessment.
- Morning, afternoon, and evening mood/energy check-ins are editable and update the matching daily averages in Overview. Game surveys can be added or edited before/after training.
- Weekly balance ratings and notes are saved and displayed in the balance wheel and previous-week history.

Mock data initializes the page. Changes persist under `performance-tests:v1` in localStorage, only in the current browser. There are no test-related backend calls. Cross-device synchronization, shared staff access, and server-delivered training surveys require backend integration.

## Mood and energy

Open `/mood` without signing in. The sidebar and the mood card in Tests now link to this standalone tracker. It includes weekly day counts and averages, week navigation, daily mood/energy averages, three color-coded slot indicators, and editable morning/afternoon/evening cards. Future days cannot be filled; previous weeks remain editable. A `?date=YYYY-MM-DD` link selects a past or current date directly.

Mood and Tests use the same check-ins in `performance-tests:v1`. Saving replaces only the matching date/slot and updates that day's averaged mood/energy in Overview without changing sleep duration. Existing local records are preserved; mock history is used only when no valid store exists. Other open tabs receive storage updates. There is no backend integration for these check-ins yet.

## Recovery

Open `/recovery` without signing in. The shared sidebar links to the standalone recovery page. Sleep, screen time, and nutrition cards share a 7/14/30-day period selector with their detailed chart and daily history. Missing days are striped; manual entries are purple. Personal comparison targets can be changed through Settings or the chart legend.

- Manual sleep records calculate overnight duration from bedtime/wake time, or accept duration only. Screen time accepts 0–24 hours. Future dates and invalid values are rejected. Saving sleep or screen time replaces only the selected date.
- Nutrition is stored as individual meals; adding a meal updates the daily calorie sum. Meals can be edited from a day's source badge without duplicating them.
- Sleep edits update Overview's duration without changing that day's energy. Duration-only manual edits from Overview are imported back; unknown bed/wake times remain blank. Existing local records are retained.

Records, selected period/tab, and targets persist under `performance-recovery:v1`. The initial phone/photo records and connection status are explicitly a demo. There is no mobile synchronization, food-photo recognition, or recovery backend integration yet. Manual edits are browser-local; other open tabs receive storage updates.

## Statistics

Open `/stats` without signing in. The shared sidebar opens the standalone statistics page. The overview and correlation modes share one selected period: 7, 30, 90, 365 days or a validated custom range of up to 366 days. Comparisons use the immediately preceding equal-length period; dates are counted inclusively using calendar days.

- Mood/energy legend controls hide series and persist. Missing observations remain gaps, not zeroes. Yearly charts aggregate by week while summaries and correlations use the original daily observations.
- Recovery charts share the sleep, screen-time and nutrition records and personal targets from `/recovery`. Cognitive averages include only counted attempts; completion totals include all finished attempts. Balance averages use the existing weekly dimensions and reviews from Tests, retaining their meaning rather than relabelling scores.
- Existing CRM records override the corresponding demonstration history. Stats does not rewrite module records. Storage/focus updates refresh data after edits on other pages or tabs.
- The correlation mode pairs observations by the same date and computes Pearson's r. It requires at least five pairs and non-constant values. The displayed relation is not a causal conclusion. A pair table makes the inputs inspectable.

Preferences persist in `performance-stats:v1`. Extended demonstration history is enabled initially and can be disabled in Statistics settings. Saved games from `/game` supply daily personal K/D, round-weighted Rating (when entered), and map win rate. The first player row represents the current player; team K/D is separate. Saved results override the same date's extended demo values, and missing Rating remains missing. Local module starter examples remain visible when extended history is disabled. No game backend is connected.

## Game statistics

Open `/game` without signing in. The shared sidebar opens the game-entry page and searchable history. The first visit includes example matches and an incomplete example draft; these are demonstration data, not imported Faceit results.

- Record practice, Faceit or tournament games, a past/current date, an optional opponent, and either the full five-player team or only yourself. Switching the lineup retains hidden player rows in the draft.
- Add up to seven maps, scores and optional pistol-round results. Series results, map/round win rates, known pistol win rate, average rounds and aggregate K/D recalculate immediately. Unknown pistols are excluded from their percentage.
- Enter player statistics directly or paste rectangular tab-separated cells from Excel/Google Sheets, including names. Decimal commas are supported. K, D, A and ADR are required for each active player and map; optional values remain unknown rather than zero. K/D and kill/death difference are calculated; Rating is an optional entered value, not an official rating calculation.
- Drafts persist automatically. Saving validates inputs and opens history; editing updates the same record instead of creating a duplicate. Deleting a map/game or clearing a draft requires confirmation. Clearing a draft does not delete saved games.

Data and the selected view persist under `performance-game:v1` in this browser only. Saved games feed `/stats`; unfinished drafts do not. There is no backend, external match import or cross-device synchronization yet.

## Profile

Open `/profile` without signing in. The user identity card in the shared sidebar links to it from every CRM page. The layout includes personal details/photo, password form, account deletion, subscription and selectable Solo/team/Staff profiles.

- Name, nickname, FACEIT URL and photo are local demo data, not a fetched ScoutScope identity. Save validates required fields, nickname format and the exact FACEIT HTTPS host/profile path. Email and its verification badge are demonstration-only and read-only.
- PNG/JPEG/WebP uploads up to 5 MB and 8000 × 8000 pixels are decoded, center-cropped and reduced to a 256 × 256 WebP before local storage. The save button commits the preview; photo removal is also saved explicitly. Shared sidebar name/photo update across tabs.
- Demo codes `AT-7F3K` (player/team) and `STAFF-7F3K` (staff) add selectable profiles without removing Solo. Selecting one changes the shared demo role; it grants no real permissions and does not partition the existing browser-local module records. Production membership must be authorized by the backend.
- Subscription details use the same access records as `/plans`; the change/renew controls open that page. Password inputs validate but are never stored or sent; a dialog explains that the password API is not connected. Account deletion likewise does not call a real deletion API: the confirmed demo-profile reset leaves calendar, tests and statistics untouched.
- Logout uses the existing same-origin `/api/auth/logout` endpoint to clear the CRM session, then opens the login view. It preserves local demo records and does not terminate sessions on other ecosystem sites.

Profile fields, memberships and demo subscription use `performance-profile:v1`. Browser-storage failures display an error instead of reporting success. Do not treat local roles, subscription state or the demo email badge as authorization or billing data. The auth proxy checks browser Origin against the actual request Host (including port) rather than NextURL's loopback-normalized hostname; foreign origins remain rejected. A production reverse proxy must preserve the public Host and correctly forward the HTTPS scheme.

## Plans and demo checkout

Open `/plans` without signing in. The shared sidebar's Tariffs link is now a real route on every page. The page contains current access/expiry progress, the full PerformanceCoach CRM offer, separate game-statistics and correlation modules, an accessible comparison table, and independent FAQ accordions. The comparison table scrolls within its own container on small screens.

- Full CRM uses one consistent example price: RUB 23,990 per 30 days; 90 days cost RUB 64,773 (10% discount), and 180 days RUB 115,152 (20%). Per-month equivalents and savings come from the same catalog, including the comparison table's RUB 19,192/month minimum. Modules cost RUB 399 and RUB 499 per 30 days. These are prototype prices, not a real commercial offer.
- A new demo profile starts with four days of the game module remaining. Existing saved legacy Pro/Team subscriptions migrate to full CRM with their original dates; existing personal fields, photo and memberships are retained. `billing` inside `performance-profile:v1` is now the canonical demo-access model; the old `subscription` field is retained only for compatibility/migration.
- Terms are 30/90/180 calendar days, not calendar months. Renewal adds days to the same product's existing end date, or today's date if expired. Different products keep independent periods. Full CRM includes both modules and prevents additional module purchases while CRM is active. Buying CRM does not erase, transfer or refund previously saved module periods.
- Checkout requires explicit acknowledgement of a demo purchase. It performs one local profile write, preserves other CRM data and appends a uniquely identified demonstration receipt. It does not call a payment provider, collect payment details, enable automatic billing, or enforce real access restrictions. Local roles and billing must never authorize backend access.
- `/plans/confirmation` shows the latest saved demonstration receipt. `?order=<id>` selects one of the last 20 stored receipts; unknown IDs show an empty state, never activate access. Reloading a confirmation does not repeat a purchase. Other open profile/pricing tabs refresh after updates.

The comparison describes target product packaging. Real payments, server entitlements, AI reports and phone data delivery remain unconnected; all existing demo sections stay available regardless of the chosen plan. Real checkout will require a server-created order, verified provider webhook and server-side entitlement checks, not a client redirect or localStorage flag.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
