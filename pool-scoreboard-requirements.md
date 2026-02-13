# RackUp — Functional Requirements

## Project Overview

RackUp is a touch-friendly digital scoreboard and recording management application designed to replace a physical chalkboard and streamline video recording in a home pool room (UK 8-ball pool). The app will be used by an elderly user and his friends during casual pool sessions to track frame results, session scores, long-term statistics, and manage per-frame video recordings via OBS Studio.

The system runs on a dedicated mini PC connected to a wall-mounted touchscreen display and an overhead webcam. RackUp serves as the central control hub — the touchscreen replaces both the chalkboard and the Elgato Stream Deck currently used to manage OBS. The existing Stream Deck is retained as a fallback/companion input device.

The app must be extremely simple to operate, visually clear, and run fullscreen in a browser on the touchscreen display.

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

## 3. Frame Recording & Video Capture

### 3.1 Recording a Frame Result
- The interaction for recording a frame must be fast and require minimal taps.
- **Preferred flow (2–3 taps maximum)**:
  1. Tap "Add Frame" (or the UI is always ready to record).
  2. Tap the winner's name from the list of tonight's players.
  3. Tap the loser's name from the remaining players.
  4. Frame is recorded. No further confirmation needed.
- Alternative: A grid/matrix view where players are on both axes and the user taps the cell at the intersection of winner (row) vs loser (column) to record a frame in a single tap.
- Each frame record stores: session ID, winner, loser, timestamp, and a reference to the associated video file (if recording was active).

### 3.2 Frame Validation
- A player cannot play against themselves.
- Both a winner and a loser must be selected.
- Duplicate consecutive identical results should be allowed (the same two players can play multiple frames in a row).

### 3.3 Video Recording Per Frame (Automatic)
- Video recording is managed **per frame**, not per session. A session may last 6–8 hours; individual frame recordings are typically 5–30 minutes each.
- Recording behaviour is controlled by a **"Recording Enabled" toggle** on the home/session screen. This is a prominent, clearly labelled checkbox or switch.
- **When recording is enabled**, the lifecycle is semi-automatic with a "Ready to Play" gate:
  1. **When the frame ends**: the user taps the winner. RackUp **automatically stops** the current recording.
  2. A **VS splash screen** appears showing the next matchup with a **"Ready to Play"** button. This gives players time to rack the balls without recording dead time.
  3. **Recording starts** when the user taps "Ready to Play". This ensures recordings capture only actual gameplay.
  4. **For the very first frame of a session**, the same flow applies: VS splash appears, recording starts on "Ready to Play".
  5. The session screen shows a visible **recording indicator** (pulsing red dot + "REC" badge) so everyone knows the camera is rolling.
  6. When the session ends (or recording is toggled off), the current recording is stopped.
- **When recording is disabled** (toggle unchecked), no OBS commands are sent. Scoring works exactly the same, just without video. Toggling recording off mid-session should cleanly stop any active recording.
- The user should be able to toggle recording on/off at any point during a session without disrupting the scoring flow.
- If OBS is unavailable when recording is enabled, show a warning but do not block scoring (see §8.1).

### 3.4 Video File Naming & Metadata
- Each recorded video file must be automatically named with structured metadata for easy browsing in a file manager.
- **File naming convention**: `YYYY-MM-DD_HHmm_PlayerA-vs-PlayerB_FrameNNN.mkv`
  - Example: `2025-08-15_2035_Paddy-vs-Mick_Frame012.mkv`
  - Date and time of recording start.
  - Both player names (alphabetical, or winner-vs-loser — to be confirmed).
  - Frame sequence number within the session.
- File format: MKV or MP4 (configurable in OBS, MKV recommended for crash resilience — OBS can remux to MP4 afterwards).
- Recordings are saved to a configurable local directory on the mini PC (e.g., `/recordings/YYYY-MM/`), organised by month.
- The frame record in RackUp's database stores the full file path to the associated video, enabling future playback or linking from the UI.

### 3.5 OBS Scene & Overlay Integration
- RackUp should update an OBS text source (via WebSocket) to display the current players and score as an overlay on the recording. This means each video file is self-documenting — anyone watching the recording can see who's playing and the current score without needing to cross-reference.
- The overlay should show:
  - Player A name vs Player B name.
  - Current head-to-head score for this session (e.g., "Paddy 2 – 1 Mick").
  - Session date.
- The overlay updates in real time as frames are recorded.

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
- **Minimal navigation**: the app should have no more than 4–5 top-level sections (e.g., Home/Session, Camera, History, Stats, Players).
- **No keyboard input during sessions**: player names are pre-configured. The only input during a session is tapping names to record frame results.
- **Responsive layout**: must work on screens from 20" to 32" in landscape orientation. Primarily designed for landscape.
- **Fullscreen mode**: the app should support running in kiosk/fullscreen mode with no browser chrome visible.

### 5.2 Home Screen / Session Screen
- Shows one of two states:
  - **No active session**: prominent "New Session" button, today's date, quick-glance monthly leaderboard.
  - **Active session**: the live session scoreboard (as described in §2.2), with navigation to History/Stats accessible but unobtrusive.
- **Recording toggle**: a clearly labelled "Recording Enabled" switch is always visible on the session screen. When checked, automatic per-frame recording is active. When unchecked, no recordings are made. Default state should be configurable in settings.
- **OBS Preview (Picture-in-Picture)**: a small live preview window showing the current OBS output is displayed in the **top-right corner** of the session screen. This gives the players a quick glance of what the camera sees without leaving the scoreboard view. The preview should:
  - Be unobtrusive — small enough not to interfere with the scoreboard layout (roughly 15–20% of screen width).
  - Show a live feed from OBS (via the OBS WebSocket virtual cam output, or a browser source rendering the OBS preview).
  - Be clearly bordered/framed so it's visually distinct from the scoreboard UI.
  - Show a "REC" indicator overlaid on the preview when recording is active.
  - Be tappable to navigate to the dedicated Camera tab (see §5.3).

### 5.3 Camera / Live View Tab
- A dedicated tab in the main navigation that shows a **larger view of the OBS camera feed**.
- This is the full-width live preview — useful for checking camera angle, framing, lighting, etc. before or during a session.
- Should display:
  - The live OBS output (full width, maintaining aspect ratio).
  - Current recording status (recording / not recording, duration of current recording).
  - The current overlay information (player names, score) as it would appear on the recording.
  - Manual "Start Recording" / "Stop Recording" buttons as an override, regardless of the auto-record toggle.

### 5.4 Typography & Readability
- Player names: large, bold, sans-serif font. Minimum 28px on a 1080p display.
- Scores/numbers: extra-large, minimum 36px.
- Secondary information (timestamps, labels): can be smaller but still legible, minimum 18px.

### 5.5 Colour & Theming
- Default theme: dark (chalkboard-inspired — dark green or dark grey background, white/chalk-coloured text).
- Optional: allow a simple theme toggle (dark/light) in a settings area.
- Use colour to distinguish wins (green), losses (red), and neutral info (white/grey).

### 5.6 Animations & Feedback
- Tapping a button should provide immediate visual feedback (colour change, brief highlight).
- Avoid elaborate animations that could slow down interaction or confuse the user.
- A subtle "frame recorded" confirmation (e.g., a brief flash or checkmark) after recording a frame.

---

## 6. Data & Storage

### 6.1 Persistence
- All data is stored in Supabase (PostgreSQL). The app was originally specced for SQLite but was implemented with Supabase for ease of deployment and real-time capabilities.
- All writes are immediately committed. The app must survive power loss without data corruption.
- The app requires internet connectivity to reach the Supabase backend.

### 6.2 Video File Management
- Recorded video files are stored in a configurable recordings directory (e.g., `~/rackup/recordings/`).
- Files are organised into subdirectories by year and month: `~/rackup/recordings/2025/08/`.
- The RackUp Server monitors the recordings directory and tracks file metadata (size, duration) in the database once OBS finishes writing.
- A "Recordings" screen in the UI lists all recorded frames with player names, date/time, duration, and file size.
- Nice-to-have: in-browser video playback of recorded frames directly from the RackUp UI.

### 6.2 Data Model (Current Implementation)
- **Player**: id, name, emoji (nullable), nickname (nullable), created_at, archived (boolean).
- **Session**: id, date, started_at, ended_at (nullable if active), player_ids (participants).
- **Frame**: id, session_id, winner_id, loser_id, recorded_at, started_at (nullable — when the frame began), video_file_path (nullable).
- **PlayerAchievement**: player_id, achievement_id, unlocked_at (tracks which badges each player has earned).
- Note: Recordings are managed as files on disk with metadata derived from file naming conventions, rather than a separate database table.

### 6.5 Backup & Export
- An "Export Data" button in settings that downloads all scoring data as a JSON or CSV file.
- Video files can be backed up independently via file system tools (rsync, network share, etc.).
- Nice-to-have: automated backup of the SQLite database to a network share or cloud storage on a schedule.

---

## 7. Technical Requirements

### 7.1 Platform
- Single-page web application (SPA).
- Must run in Chromium-based browsers (Chrome, Chromium on Raspberry Pi).
- Designed to run in fullscreen/kiosk mode.

### 7.2 Technology Stack (As Implemented)
- **Frontend**: React 19 with TypeScript.
- **Styling**: Tailwind CSS 4.
- **Backend**: Node.js (Express) running locally on the mini PC.
- **Database**: Supabase (PostgreSQL) — cloud-hosted.
- **OBS Integration**: obs-websocket-js (Node.js client for the OBS WebSocket protocol v5).
- **Build tool**: Vite 7 (frontend).
- **Testing**: Vitest.
- **Process manager**: PM2 or systemd to keep the backend running on boot.

### 7.3 Architecture
- The system runs as two processes on the mini PC:
  1. **RackUp Server** (Node.js): serves the frontend, provides a REST API for scoring/data, communicates with OBS via WebSocket, manages video file naming and organisation.
  2. **OBS Studio**: runs in the background (can be headless or minimised), receives commands from RackUp Server, handles video encoding and file output.
- The frontend (React app) runs in Chromium in fullscreen/kiosk mode on the touchscreen display.
- The frontend communicates with the backend via REST API (localhost).
- The backend communicates with OBS via the OBS WebSocket protocol (localhost:4455 by default).

```
┌──────────────────┐   REST API    ┌──────────────────┐  OBS WebSocket  ┌──────────┐
│   RackUp UI      │◄────────────►│  RackUp Server   │◄──────────────►│   OBS    │
│   (Chromium      │  localhost    │  (Node.js/Express)│  localhost      │  Studio  │
│   fullscreen)    │  :5173/:4077 │                  │  :4455          │          │
│                  │              │  - REST API      │                 │  - Webcam│
│   Touchscreen    │              │  - SSE overlay   │                 │  - Encode│
│   Display        │              │  - File mgmt     │                 │  - Record│
└──────────────────┘              └──────────────────┘                 └──────────┘
         │                               │
         │  Supabase API            ┌────┴─────┐
         ▼                          │ /recordings │
┌──────────────────┐                │ (local SSD) │
│   Supabase       │                └──────────┘
│   (PostgreSQL)   │
│   - Players      │
│   - Sessions     │
│   - Frames       │
│   - Achievements │
└──────────────────┘
```

### 7.4 Stream Deck Fallback
- The Elgato Stream Deck is retained as a secondary input device.
- Stream Deck buttons can call the RackUp Server REST API via HTTP requests (using the Stream Deck "Website" or "API Ninja" plugin) to trigger actions:
  - Start/stop recording.
  - Record a frame result (if player matchup is already selected on screen).
- This provides a physical button fallback if the touchscreen is inconvenient during play.

### 7.5 Deployment
- The app runs entirely on the local mini PC. No cloud dependency.
- On boot, the mini PC should automatically:
  1. Start OBS Studio (minimised/headless).
  2. Start the RackUp Server (via PM2 or systemd).
  3. Launch Chromium in kiosk mode pointing to `http://localhost:5173/RackUp/` (dev) or the built static files.
- The entire startup sequence should be automated so the user just powers on the device and everything is ready.

### 7.6 Performance
- The app must load and be interactive within 3 seconds.
- Frame recording (tap to save) must feel instant — under 100ms perceived latency.
- OBS start/stop recording commands should execute within 500ms.
- Stat calculations for up to 5 years of data (estimated: ~5,000 frames, ~500 sessions) should compute in under 1 second.

---

## 8. Non-Functional Requirements

### 8.1 Reliability
- The app should never lose scoring data. All writes should be immediately persisted to SQLite.
- If the browser crashes mid-session, reopening the app should restore the active session exactly as it was.
- If OBS crashes or the WebSocket connection drops, RackUp should:
  - Show a clear warning on the UI (e.g., "Recording unavailable — OBS disconnected").
  - Continue to function fully for scoring — OBS being down must never block score recording.
  - Automatically reconnect to OBS when it becomes available again.
- If a recording is interrupted (power loss, OBS crash), the MKV container should be recoverable (MKV is resilient to incomplete writes, unlike MP4).

### 8.2 Simplicity
- The app must be usable by someone with zero technical literacy. If it requires explanation beyond "tap the winner, tap the loser", it's too complicated.
- Error messages should be plain English, not technical jargon.

### 8.3 Maintainability
- Clean, well-structured code with clear separation of concerns.
- Components should be modular and reusable.
- Data access logic should be centralised (a data service layer), not scattered across components.

---

## 9. Future Enhancements

### Implemented (originally out of scope, now shipped)
- ~~**Video playback in UI**~~: browse and play back recorded frames directly from the Recordings tab. ✅
- ~~**Photo/avatar support**~~: players have custom emojis and optional nicknames. ✅
- ~~**Achievement badges**~~: 21 unlockable badges for milestones, streaks, rivalries, session moments, and monthly feats. ✅
- ~~**Sound effects**~~: win sounds, streak fanfares, VS splash audio, session end fanfare. ✅

### Still planned
- **Automatic upload**: after a session ends (or on a schedule), automatically upload recordings to YouTube (unlisted), Google Drive, a NAS, or another cloud service. Tag uploads with player names and session metadata.
- **Game type support**: different pool variants (8-ball, 9-ball, killer, etc.) tracked separately.
- **Handicap system**: assign handicaps to balance matchups between players of different skill levels.
- **Multi-device sync**: if a second device (e.g., a phone) is ever used, data could sync via the local server API.
- **Home Assistant integration**: display current session status on an HA dashboard, or trigger automations (e.g., turn on the table light when a session starts).
- **Printable reports**: generate a monthly/yearly summary as a PDF.
- **Highlight clipping**: mark specific moments during a frame for easy retrieval later (e.g., "great shot at 4:32").

---

## 10. Acceptance Criteria (Definition of Done for V1)

### Scoring
1. ✅ Users can add and manage a roster of players.
2. ✅ Users can start a new session, select tonight's players, and record frame results with 2–3 taps.
3. ✅ The live session screen shows running totals, head-to-head records, and a session leaderboard — updated in real time.
4. ✅ Users can end a session and view a summary.
5. ✅ All past sessions are stored and browsable.
6. ✅ Per-player statistics are available (overall, head-to-head, per-month, per-year).
7. ✅ Monthly and yearly leaderboards show the champion.

### Recording & OBS Integration
8. ✅ RackUp can start and stop OBS recording via WebSocket.
9. ✅ Each frame recording is saved as an individual video file, named with date, time, player names, and frame number.
10. ✅ Recordings are organised in a structured directory (by year/month).
11. ✅ A recording indicator is visible on the session screen when OBS is actively recording.
12. ✅ OBS text overlay is updated in real time with current players and score.
13. ✅ Frame results can be recorded without video (recording is optional, not blocking).

### UX & Reliability
14. ✅ The UI is touch-friendly, high-contrast, and usable by elderly non-technical users.
15. ✅ The app works fully offline and survives power loss without data loss.
16. ✅ The app runs in fullscreen kiosk mode in Chromium.
17. ✅ The entire system (OBS + RackUp Server + Chromium) starts automatically on device boot.
18. ✅ The Stream Deck can trigger start/stop recording and basic actions via the RackUp REST API as a fallback.
