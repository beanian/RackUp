# RackUp

A touch-friendly digital scoreboard for UK 8-ball pool with OBS recording integration. Designed to replace a physical chalkboard in a home pool room, running on a wall-mounted touchscreen display.

## Features

- **Session management** -- Start sessions with 2+ players, record frame results with a single tap, end sessions with final standings
- **Winner-stays-on** -- Automatic queue rotation: the winner stays at the table, the loser goes to the back of the challenger queue
- **VS splash screen** -- Fighting-game style matchup splash with "Ready to Play" button before each frame
- **Live scoreboard** -- Running totals, head-to-head records, all-time predictions, and "next up" queue display
- **OBS recording** -- Automatic per-frame video recording via OBS WebSocket, with structured file naming and VAR-style instant replay
- **Recording flags** -- Tag frames with metadata (brush, clearance, foul, special) during or after play
- **Streaming overlay** -- Real-time scorebug overlay for OBS browser source with player names, nicknames, emojis, and head-to-head score
- **Camera preview** -- Picture-in-picture live preview on the session screen, plus a dedicated full-screen Camera tab
- **Player management** -- Add, rename, archive, and restore players, with custom emojis and nicknames
- **Achievements** -- 21 unlockable badges for milestones, streaks, rivalries, and session moments
- **Win streaks** -- Animated announcements with escalating sound effects for consecutive wins
- **Statistics** -- Per-player stats (win %, sessions played, best session, current form, head-to-head records)
- **Leaderboards** -- Monthly, yearly, and all-time rankings with filtering
- **Session history** -- Browse past sessions with timeline view, frame timing, and head-to-head breakdowns
- **Recordings browser** -- In-app video playback of recorded frames with flag-based filtering
- **Sound effects** -- Win sounds, streak fanfares, VS splash audio, session end fanfare
- **Touch-first UI** -- Large tap targets, on-screen virtual keyboard, designed for elderly users with minimal technical literacy

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| UI | React 19, React Router 7 |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Server | Node.js, Express |
| OBS Integration | obs-websocket-js (WebSocket v5) |
| Build | Vite 7 |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm
- A Supabase project (or local Supabase instance)
- OBS Studio (optional, for recording features)

### Install

```bash
npm install
cd server && npm install
```

### Environment

Create a `.env` file in the project root with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For the server, configure OBS and recording settings via environment variables (see `server/src/config.ts`):

```
OBS_HOST=localhost
OBS_PORT=4455
OBS_PASSWORD=your-obs-password
RECORDINGS_BASE_DIR=~/Videos
SERVER_PORT=4077
```

### Development

```bash
# Frontend
npm run dev

# Server (in a separate terminal)
cd server && npm run dev
```

The frontend dev server opens at `http://localhost:5173/RackUp/`.
The API server runs at `http://localhost:4077`.

### Build

```bash
npm run build
```

Compiles TypeScript and bundles for production.

### Lint

```bash
npm run lint
```

### Test

```bash
npm test           # single run
npm run test:watch # watch mode
```

## Project Structure

```
src/
  components/              UI components
    Layout.tsx               Main layout with navigation bar
    VirtualKeyboard.tsx      On-screen keyboard for touch input
    VsSplash.tsx             VS matchup splash with ready button
    PlayerName.tsx           Name + nickname display component
    AnimatedNumber.tsx       Smooth number transition animation
  db/                      Database layer
    supabase.ts              Supabase client, Player/Session/Frame interfaces
    services.ts              CRUD operations, stats calculations, leaderboard queries
    mappers.ts               PostgreSQL snake_case rows to TypeScript camelCase mapping
    __tests__/               Unit tests for db layer
  hooks/
    useHomeData.ts           Custom hook for home page data fetching
    useObsStatus.ts          OBS connection and recording status hook
  pages/
    HomePage.tsx             Session management (idle, player picker, live session, summary)
    CameraPage.tsx           Live OBS camera preview with manual recording controls
    PlayersPage.tsx          Player roster CRUD with emoji picker and nicknames
    HistoryPage.tsx          Session history browser with summary stats
    SessionDetailPage.tsx    Detailed session view with timeline and frame replay
    RecordingsPage.tsx       Video recording browser with flag filtering and playback
    StatsPage.tsx            Player statistics, achievements, and leaderboards
  utils/
    achievements.ts          21 achievement definitions with unlock logic
    streaks.ts               Win streak detection and messaging
    sounds.ts                Sound effect playback (wins, streaks, fanfares)
  App.tsx                  Route definitions
  main.tsx                 Application entry point
  index.css                Global styles, theme variables, chalkboard aesthetic

server/
  src/
    index.ts                 Express API server (recordings, OBS control, overlay, VAR)
    obs.ts                   OBS WebSocket client (start/stop recording, file naming)
    overlayState.ts          In-memory overlay state + SSE broadcast
    config.ts                Server configuration (OBS, paths, ports)

overlay/
  overlay.html               Standalone OBS browser source overlay (scorebug)

supabase/
  migrations/                Database migration files
```

## Data Model

**Player** -- A person who plays pool. Has a name, optional emoji, optional nickname. Can be archived (soft delete) to preserve history.

**Session** -- A playing session with 2+ players. Has a start time, optional end time, and an ordered list of player IDs.

**Frame** -- A single game of pool within a session, recording the winner, loser, optional start time, and optional video file path.

## User Guide

See [USER_GUIDE.md](USER_GUIDE.md) for a step-by-step guide on how to use the app.

## Design

The UI uses a chalkboard aesthetic with billiard-table green backgrounds, chalk-white text, wood-grain trim, and handwritten-style fonts (Caveat, Bebas Neue, Alegreya Sans). Responsive breakpoints support tablets through 32" wall displays.

## Deployment

Configured for GitHub Pages deployment with a `/RackUp/` base path. Uses `HashRouter` for client-side routing compatibility with static hosting. The server component requires a separate hosting environment (e.g., the local mini PC).
