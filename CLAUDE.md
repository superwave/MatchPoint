# MatchPoint - Tennis Umpire Tool

## Project Overview

A mobile-first web application for tennis umpires to track and score matches in real-time. Built with vanilla JavaScript (ES Modules), HTML5, and CSS3 — no frameworks or build tools.

## Architecture

- `index.html` — All UI screens (setup, match, summary)
- `style.css` — Responsive styling with court-themed backgrounds
- `js/` — ES Modules (loaded via `<script type="module">`)

### Module Structure

```
js/
├── state.js          — State, constants, localStorage, pure state functions
├── timer.js          — Match timer (imports state)
├── notifications.js  — Toast notifications (standalone)
├── scoring.js        — Scoring engine + detection functions (imports state, timer, notifications)
├── display.js        — UI rendering: scoreboard, player cards, status banner (imports state, scoring)
├── summary.js        — Post-match result screen (imports state, timer, display)
├── pdf.js            — PDF export (imports state, timer, notifications)
└── app.js            — Entry point: event bindings, flow control (imports all)
```

### Dependency Graph (no cycles)

```
state        ← (none)
timer        ← state
notifications ← (none)
scoring      ← state, timer, notifications
display      ← state, scoring
summary      ← state, timer, display
pdf          ← state, timer, notifications
app          ← all modules
```

### State Sharing

State is shared via ES Module live bindings. `state.js` exports `match` (mutable via property access) and `setMatch()`/`clearMatch()` for reassignment. Other modules import `{ match }` to read/mutate properties.

### Event Handling

All event handlers use `addEventListener` (no inline `onclick`). Dynamic scoring buttons use `data-player`/`data-type` attributes with event delegation on `.scoring-area`.

## External Dependencies (CDN)

- jsPDF 2.5.1 — PDF generation
- jsPDF AutoTable 3.8.1 — PDF tables
- html2canvas 1.4.1 — DOM-to-image for PDF export

## Development

No build step, package manager, or dev server. Open `index.html` directly in a browser or serve with any static file server. Note: ES Modules require serving over HTTP (not `file://`), so use a simple static server.

No tests or linting configured.

## Key Features

- Bilingual UI (English / Traditional Chinese)
- Full tennis scoring (standard, tiebreak, super tiebreak, advantage/no-ad deuce)
- Match history with undo (up to 50 steps)
- PDF export with game-by-game breakdown
- Court-type themed backgrounds (Hard, Clay, Grass, Carpet, Indoor)
- Responsive design with safe-area insets for mobile
