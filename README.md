# RackUp

A touch-friendly digital scoreboard for UK 8-ball pool. Designed to replace a physical chalkboard in a home pool room, running on a wall-mounted touchscreen display.

## Features

- **Session management** -- Start sessions with 2+ players, record frame results, end sessions with final standings
- **Winner-stays-on** -- Automatic queue rotation: the winner stays at the table, the loser goes to the back of the challenger queue
- **Live scoreboard** -- Running totals, head-to-head records for the current matchup, and "next up" queue display
- **Player management** -- Add, rename, archive, and restore players
- **Statistics** -- Per-player stats (win %, sessions played, best session, current form, head-to-head records)
- **Leaderboards** -- Monthly, yearly, and all-time rankings with filtering
- **Session history** -- Browse past sessions with detailed frame-by-frame replays
- **Touch-first UI** -- Large tap targets, on-screen virtual keyboard, designed for elderly users with minimal technical literacy

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| UI | React 19, React Router 7 |
| Styling | Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL) |
| Build | Vite 7 |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens the dev server at `http://localhost:5173/RackUp/`.

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
  components/          UI components
    Layout.tsx           Main layout with navigation bar
    VirtualKeyboard.tsx  On-screen keyboard for touch input
  db/                  Database layer
    supabase.ts          Supabase client, Player/Session/Frame interfaces
    services.ts          CRUD operations, stats calculations, leaderboard queries
    mappers.ts           PostgreSQL snake_case rows to TypeScript camelCase mapping
    __tests__/           Unit tests for db layer
  hooks/
    useHomeData.ts       Custom hook for home page data fetching
  pages/
    HomePage.tsx         Session management (idle, player picker, live session, summary)
    PlayersPage.tsx      Player roster CRUD
    HistoryPage.tsx      Session history browser
    SessionDetailPage.tsx  Detailed session view with frame replay
    StatsPage.tsx        Player statistics and leaderboards
  App.tsx              Route definitions
  main.tsx             Application entry point
  index.css            Global styles, theme variables, chalkboard aesthetic
```

## Data Model

**Player** -- A person who plays pool. Can be archived (soft delete) to preserve history.

**Session** -- A playing session with 2+ players. Has a start time, optional end time, and an ordered list of player IDs.

**Frame** -- A single game of pool within a session, recording the winner and loser.

## Design

The UI uses a chalkboard aesthetic with billiard-table green backgrounds, chalk-white text, wood-grain trim, and handwritten-style fonts (Caveat, Bebas Neue, Alegreya Sans). Responsive breakpoints support tablets through 32" wall displays.

## Deployment

Configured for GitHub Pages deployment with a `/RackUp/` base path. Uses `HashRouter` for client-side routing compatibility with static hosting.
