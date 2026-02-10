# RackUp — Functional Requirements

## Project Overview

RackUp is a touch-friendly digital scoreboard web application designed to replace a physical chalkboard in a home pool room (UK 8-ball pool). The app will be used by an elderly user and his friends during casual pool sessions to track frame results, session scores, and long-term statistics. The app must be extremely simple to operate, visually clear, and run fullscreen in a browser on a wall-mounted touchscreen display.

---

## 1. User Management

### 1.1 Player Roster
- The app maintains a persistent roster of players (expect 6–12 regulars).
- Each player has a display name (first name or nickname, e.g., "Paddy", "Mick", "Des").
- Players can be added, edited (rename), or soft-deleted (archived, not destroyed — preserve historical data).
- No authentication or login required. This is a single shared device in a private home.

### 1.2 Admin vs Player Mode
- There is no formal admin mode. All users interact with the same interface.
- Destructive actions (deleting a player, clearing a session) should require a simple confirmation prompt (e.g., "Are you sure?" with large Yes/No buttons).

---

## 2. Session Management

### 2.1 Starting a Session
- A "session" represents a single evening/gathering of pool.
- To start a new session, the user taps a prominent "New Session" button on the home screen.
- The user selects which players from the roster are present tonight (multi-select with large tap targets).
- A session is automatically timestamped with the current date.
- Only one session can be active at a time.

### 2.2 During a Session
- The session screen is the primary view and should resemble a digital chalkboard.
- Layout: Player names listed vertically on the left. Each frame/game result is recorded horizontally as a row entry.
- For each frame played, the user taps to record:
  - **Player A** (winner) — selected from the active session players.
  - **Player B** (loser) — selected from the active session players.
  - The frame is appended to the session log immediately.
- The session screen dynamically displays:
  - **Per-player running totals**: frames won and frames lost for this session.
  - **Win/loss record per matchup**: e.g., "Paddy 3 – 2 Mick" shown clearly.
  - **Session leaderboard**: players ranked by frames won in this session.
- The most recent few frame results should be visible as a scrollable or paginated log on screen.
- An "Undo" button allows the last recorded frame to be removed (single-level undo is sufficient, with confirmation).

### 2.3 Ending a Session
- The user taps "End Session" to close the evening.
- A summary screen is shown with final standings for the night.
- The session data is saved permanently.
- If the app is closed or the device loses power mid-session, the session should persist and be resumable (i.e., all frame data is written to storage immediately, not held in memory).

---

## 3. Frame Recording

### 3.1 Recording a Frame Result
- The interaction for recording a frame must be fast and require minimal taps.
- **Preferred flow (2–3 taps maximum)**:
  1. Tap "Add Frame" (or the UI is always ready to record).
  2. Tap the winner's name from the list of tonight's players.
  3. Tap the loser's name from the remaining players.
  4. Frame is recorded. No further confirmation needed.
- Alternative: A grid/matrix view where players are on both axes and the user taps the cell at the intersection of winner (row) vs loser (column) to record a frame in a single tap.
- Each frame record stores: session ID, winner, loser, timestamp.

### 3.2 Frame Validation
- A player cannot play against themselves.
- Both a winner and a loser must be selected.
- Duplicate consecutive identical results should be allowed (the same two players can play multiple frames in a row).

---

## 4. Statistics & History

### 4.1 Session History
- A "History" screen lists all past sessions in reverse chronological order (most recent first).
- Each session entry shows: date, number of players, number of frames played, and the session winner (most frames won).
- Tapping a past session shows the full session detail: all frame results and final standings, identical to the end-of-session summary.

### 4.2 Player Statistics
- A "Stats" screen allows viewing player performance over time.
- For each player, display:
  - **Overall record**: total frames won, total frames lost, win percentage.
  - **Head-to-head records**: win/loss against each other player.
  - **Sessions played**: total count.
  - **Best session**: most frames won in a single session.
  - **Current form**: results from the last 5 sessions.

### 4.3 Leaderboards & Champions
- **Monthly leaderboard**: total frames won by each player during a calendar month, with the leader highlighted as "Champion" once the month ends.
- **Yearly leaderboard**: total frames won by each player during a calendar year.
- **All-time leaderboard**: lifetime frames won.
- Each leaderboard view should show: rank, player name, frames won, frames lost, win %, and number of sessions attended.
- The current month/year leaderboard should be accessible from the home screen as a quick glance.

### 4.4 Time-Period Filtering
- Stats and leaderboards should support filtering by:
  - Specific month (e.g., "August 2025").
  - Specific year (e.g., "2025").
  - Custom date range.
  - All time.

---

## 5. User Interface Requirements

### 5.1 General Principles
- **Touch-first design**: all interactive elements must be large enough for elderly users with reduced dexterity. Minimum touch target size: 48x48px, preferred: 64x64px or larger.
- **High contrast**: dark background with bright text (chalkboard aesthetic is acceptable and on-brand). Text must be readable from 2–3 metres away for the key information (current scores, player names).
- **Minimal navigation**: the app should have no more than 3–4 top-level sections (e.g., Home/Session, History, Stats, Players).
- **No keyboard input during sessions**: player names are pre-configured. The only input during a session is tapping names to record frame results.
- **Responsive layout**: must work on screens from 20" to 32" in landscape orientation. Primarily designed for landscape.
- **Fullscreen mode**: the app should support running in kiosk/fullscreen mode with no browser chrome visible.

### 5.2 Home Screen
- Shows one of two states:
  - **No active session**: prominent "New Session" button, today's date, quick-glance monthly leaderboard.
  - **Active session**: the live session scoreboard (as described in §2.2), with navigation to History/Stats accessible but unobtrusive.

### 5.3 Typography & Readability
- Player names: large, bold, sans-serif font. Minimum 28px on a 1080p display.
- Scores/numbers: extra-large, minimum 36px.
- Secondary information (timestamps, labels): can be smaller but still legible, minimum 18px.

### 5.4 Colour & Theming
- Default theme: dark (chalkboard-inspired — dark green or dark grey background, white/chalk-coloured text).
- Optional: allow a simple theme toggle (dark/light) in a settings area.
- Use colour to distinguish wins (green), losses (red), and neutral info (white/grey).

### 5.5 Animations & Feedback
- Tapping a button should provide immediate visual feedback (colour change, brief highlight).
- Avoid elaborate animations that could slow down interaction or confuse the user.
- A subtle "frame recorded" confirmation (e.g., a brief flash or checkmark) after recording a frame.

---

## 6. Data & Storage

### 6.1 Persistence
- All data must be stored locally on the device. The app must work fully offline with no internet dependency.
- Data should survive browser restarts, device reboots, and power losses.
- **Storage approach**: use a local database (IndexedDB preferred for web apps, or SQLite if using a backend).

### 6.2 Data Model (Conceptual)
- **Player**: id, name, created_at, archived (boolean).
- **Session**: id, date, started_at, ended_at (nullable if active), player_ids (participants).
- **Frame**: id, session_id, winner_id, loser_id, recorded_at.

### 6.3 Backup & Export
- Nice-to-have: an "Export Data" button in settings that downloads all data as a JSON or CSV file, for safekeeping or migration.

---

## 7. Technical Requirements

### 7.1 Platform
- Single-page web application (SPA).
- Must run in Chromium-based browsers (Chrome, Chromium on Raspberry Pi).
- Designed to run in fullscreen/kiosk mode.

### 7.2 Technology Stack (Recommended)
- **Frontend**: React with TypeScript.
- **Styling**: Tailwind CSS.
- **Local storage**: IndexedDB via Dexie.js (or similar wrapper).
- **No backend server required** — all logic and storage runs client-side in the browser.
- **Build tool**: Vite.

### 7.3 Deployment
- The app should be deployable as a static site (HTML/CSS/JS bundle).
- Can be served locally from the Raspberry Pi (e.g., via a simple HTTP server like `serve` or `nginx`).
- Alternatively, could be hosted on a free static host (Netlify, Vercel) and loaded in the browser on the device.

### 7.4 Performance
- The app must load and be interactive within 3 seconds.
- Frame recording (tap to save) must feel instant — under 100ms perceived latency.
- Stat calculations for up to 5 years of data (estimated: ~5,000 frames, ~500 sessions) should compute in under 1 second.

---

## 8. Non-Functional Requirements

### 8.1 Reliability
- The app should never lose data. All writes should be immediately persisted.
- If the browser crashes mid-session, reopening the app should restore the active session exactly as it was.

### 8.2 Simplicity
- The app must be usable by someone with zero technical literacy. If it requires explanation beyond "tap the winner, tap the loser", it's too complicated.
- Error messages should be plain English, not technical jargon.

### 8.3 Maintainability
- Clean, well-structured code with clear separation of concerns.
- Components should be modular and reusable.
- Data access logic should be centralised (a data service layer), not scattered across components.

---

## 9. Future Enhancements (Out of Scope for V1, But Design With Them in Mind)

- **Photo/avatar support** for players.
- **Game type support**: different pool variants (8-ball, 9-ball, killer, etc.) tracked separately.
- **Handicap system**: assign handicaps to balance matchups between players of different skill levels.
- **Achievement badges**: fun milestones like "10-win streak", "100 frames played", "Giant killer" (beating the top-ranked player).
- **Sound effects**: optional satisfying sounds when recording frames.
- **Multi-device sync**: if a second device (e.g., a phone) is ever used, data could sync via a simple backend or peer-to-peer.
- **Home Assistant integration**: display current session status on an HA dashboard, or trigger automations (e.g., turn on the table light when a session starts).
- **Printable reports**: generate a monthly/yearly summary as a PDF.

---

## 10. Acceptance Criteria (Definition of Done for V1)

1. ✅ Users can add and manage a roster of players.
2. ✅ Users can start a new session, select tonight's players, and record frame results with 2–3 taps.
3. ✅ The live session screen shows running totals, head-to-head records, and a session leaderboard — updated in real time.
4. ✅ Users can end a session and view a summary.
5. ✅ All past sessions are stored and browsable.
6. ✅ Per-player statistics are available (overall, head-to-head, per-month, per-year).
7. ✅ Monthly and yearly leaderboards show the champion.
8. ✅ The UI is touch-friendly, high-contrast, and usable by elderly non-technical users.
9. ✅ The app works fully offline and survives power loss without data loss.
10. ✅ The app runs in fullscreen kiosk mode in Chromium.
