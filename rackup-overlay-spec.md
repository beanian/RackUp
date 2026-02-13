# RackUp OBS Overlay — Design & Integration Spec

## 1. Overview

RackUp provides a built-in OBS overlay (scorebug) that displays player names and the current head-to-head score on top of the live camera feed during recordings. The overlay is served by the RackUp Server as a standalone HTML page, loaded into OBS as a browser source, and updated in real time as frame results are recorded in the main RackUp UI.

This approach means the overlay is driven directly by RackUp's scoring data — there is no separate control panel, no manual score entry, and no third-party service dependency. When a user taps a frame result on the touchscreen, the overlay updates instantly.

### 1.1 Design Reference

The overlay style is inspired by overlays.uno's sports scoreboard lower-thirds — a compact, semi-transparent bar anchored to a screen edge displaying team/player names flanking a central score. Think of the scorebug you'd see on a Sky Sports or Matchroom pool broadcast: clean, minimal, professional, and unobtrusive.

### 1.2 Relationship to Main RackUp App

- The overlay is **not** displayed on the touchscreen. It exists solely as an OBS browser source rendered onto the recorded video.
- The overlay receives data from the same RackUp Server that powers the touchscreen UI.
- The overlay page has no interactive elements — it is display-only.
- The overlay is also rendered inside the RackUp UI as the PiP preview and the Camera tab view (composited with the camera feed), but this is handled by the frontend, not by the overlay page itself.

---

## 2. Overlay Layout & Design

### 2.1 Scorebug Position

- The scorebug is positioned as a **lower-third** — anchored to the **bottom-left** of the 1920×1080 frame.
- It should sit approximately **40px from the bottom edge** and **40px from the left edge** to provide breathing room and avoid being cropped by overscan on some displays.
- The scorebug should not extend more than **50% of the screen width** (~960px max) to avoid obscuring the table action.

### 2.2 Scorebug Structure

The scorebug is a single horizontal bar with three sections:

```
┌─────────────────────────────────────────────────────────┐
│  PADDY          │   3  -  1   │          MICK           │
│  ▬▬▬▬▬▬▬▬▬▬▬▬  │             │  ▬▬▬▬▬▬▬▬▬▬▬▬          │
│  (player A)     │   (score)   │  (player B)             │
└─────────────────────────────────────────────────────────┘
```

**Left panel** — Player A name (the player currently at the table or listed first).
**Centre panel** — Head-to-head score for this session (frames won by A – frames won by B).
**Right panel** — Player B name.

### 2.3 Visual Design Specifications

#### Dimensions
- **Overall scorebug width**: 580–700px (scales based on name length, but has a max width).
- **Overall scorebug height**: 56–64px.
- **Corner radius**: 6px (subtle rounding, modern feel).

#### Colours
- **Background**: dark semi-transparent bar.
  - Player panels: `rgba(15, 15, 15, 0.85)` — near-black with slight transparency.
  - Score centre panel: `rgba(0, 120, 80, 0.90)` — dark green (pool table green, brand colour for RackUp). Alternative: a rich dark teal `rgba(0, 90, 75, 0.90)`.
- **Text colour**: `#FFFFFF` (pure white) for player names and score.
- **Dividers**: 1px solid `rgba(255, 255, 255, 0.15)` between the three panels (subtle, barely visible).
- **Drop shadow**: `0 2px 12px rgba(0, 0, 0, 0.5)` on the overall scorebug container to lift it off the video.

#### Typography
- **Font**: `"Inter"`, `"Segoe UI"`, `"Helvetica Neue"`, sans-serif. Load Inter from Google Fonts (OBS browser source supports external fonts). If unavailable, fall back to system sans-serif.
- **Player names**: 20–22px, font-weight 600 (semi-bold), uppercase, letter-spacing 0.5px.
- **Score numbers**: 26–28px, font-weight 700 (bold), tabular-nums (monospaced digits for alignment).
- **Score separator** (the dash or "–"): same size as score numbers, font-weight 400, slightly dimmer (`rgba(255, 255, 255, 0.7)`).

#### Layout Details
- Player name panels: internally left-aligned (Player A) and right-aligned (Player B), with 16–20px horizontal padding.
- Score panel: centred text, 40–50px wide minimum.
- If a player name exceeds the available space, it should be truncated with an ellipsis. Max name display length: ~12 characters before truncation.

### 2.4 Active Player Indicator (Optional Enhancement)

- A small coloured accent bar (3px tall) at the bottom of the active player's panel to indicate who is currently at the table.
- Colour: `#4ADE80` (bright green) or `#FBBF24` (amber/gold).
- This is a nice-to-have; if the "who's at the table" information isn't tracked, this can be omitted.

### 2.5 Recording Indicator

- A small red circle (⬤) or "REC" badge in the **top-right** of the overlay frame (not part of the scorebug bar itself).
- Colour: `#EF4444` (red), with a slow pulsing opacity animation (1s cycle, 0.6 → 1.0 → 0.6).
- Size: 10px circle or "REC" in 12px font.
- Only visible when OBS is actively recording. Controlled by the same data feed.
- Position: top-right corner, 20px from edges.

---

## 3. Overlay States & Transitions

### 3.1 States

The overlay has the following display states:

| State | What's Shown | When |
|---|---|---|
| **Hidden** | Nothing — fully transparent | No active session, or recording disabled, or between sessions |
| **Active** | Scorebug with player names and score | A frame is in progress (two players selected, recording active) |
| **Updating** | Brief score change animation | A frame result has just been recorded |
| **Session Info** | Session date and "RackUp" branding | Briefly shown at the start/end of a recording (first/last 3 seconds) |

### 3.2 Transitions & Animations

- **Appear**: the scorebug slides in from the left edge over 400ms with an ease-out curve. It should feel smooth and broadcast-quality.
- **Disappear**: the scorebug slides out to the left over 300ms with an ease-in curve.
- **Score update**: when a frame result is recorded and the score changes:
  1. The score numbers briefly scale up (1.0 → 1.15 → 1.0) over 300ms.
  2. The winning player's panel flashes with a subtle green highlight (`rgba(74, 222, 128, 0.3)`) for 500ms, then fades back.
- **Player change**: if the matchup changes (different players step up for the next frame):
  1. The current scorebug slides out to the left (300ms).
  2. A new scorebug with the new players slides in from the left (400ms) after a 200ms pause.
- All animations use CSS transitions/keyframes — no JavaScript animation libraries needed.

### 3.3 Session Intro Card (Optional Enhancement)

At the very start of a recording (first 3 seconds), show a brief "intro card" overlay:
- Centred on screen, slightly larger than the scorebug.
- Shows: "Player A vs Player B" in larger text (28–32px), session date below in smaller text.
- Fades out after 3 seconds, then the scorebug slides in at its normal lower-third position.

---

## 4. Data Flow & Real-Time Updates

### 4.1 Communication Protocol

The overlay page connects to the RackUp Server via **Server-Sent Events (SSE)** for real-time, one-way data push. SSE is preferred over WebSocket here because:
- The overlay only receives data, never sends it.
- SSE is simpler to implement and auto-reconnects natively.
- OBS browser sources handle SSE well.

**Endpoint**: `GET /api/overlay/events`

The server pushes events whenever the overlay state changes. The overlay page listens and updates the DOM accordingly.

### 4.2 Event Types

```typescript
// The server sends these event types:

interface OverlayMatchEvent {
  type: "match_update";
  data: {
    playerA: {
      id: string;
      name: string;
      nickname?: string;   // optional display nickname (shown in italics)
      emoji?: string;      // optional player emoji
      score: number;       // frames won in this session head-to-head
    };
    playerB: {
      id: string;
      name: string;
      nickname?: string;
      emoji?: string;
      score: number;
    };
    sessionDate: string;   // ISO date string
    isRecording: boolean;
    frameNumber: number;   // current frame number in session
  };
}

interface OverlayScoreEvent {
  type: "score_update";
  data: {
    winnerId: string;       // which player won the last frame
    playerAScore: number;   // updated score
    playerBScore: number;   // updated score
  };
}

interface OverlayVisibilityEvent {
  type: "visibility";
  data: {
    visible: boolean;       // show or hide the scorebug
  };
}

interface OverlayRecordingEvent {
  type: "recording_status";
  data: {
    isRecording: boolean;
  };
}
```

### 4.3 Initial State

When the overlay page first loads (or when OBS refreshes the browser source), it should make a one-off REST call to get the current state:

**Endpoint**: `GET /api/overlay/state`

**Response**:
```json
{
  "visible": true,
  "isRecording": true,
  "playerA": { "id": "p1", "name": "Paddy", "nickname": "The Shark", "emoji": "🦈", "score": 3 },
  "playerB": { "id": "p2", "name": "Mick", "score": 1 },
  "sessionDate": "2025-08-15",
  "frameNumber": 7,
  "lastWinnerId": null
}
```

After loading the initial state, the page subscribes to SSE for ongoing updates.

### 4.4 Resilience

- If the SSE connection drops, the overlay should retry every 3 seconds (SSE does this natively).
- While disconnected, the overlay continues to display the last known state (it doesn't blank out).
- If the RackUp Server is unavailable when OBS loads the browser source, the overlay shows nothing (transparent) and retries the connection. Once the server comes up, the overlay populates automatically.

---

## 5. OBS Integration

### 5.1 Browser Source Setup

The overlay is added to OBS as a **Browser Source** with the following settings:

| Setting | Value |
|---|---|
| URL | `http://localhost:4077/overlay` |
| Width | `1920` |
| Height | `1080` |
| FPS | `30` |
| Custom CSS | *(leave empty — all styling is in the page)* |
| Shutdown source when not visible | `No` |
| Refresh browser when scene becomes active | `No` |

The overlay page renders at 1920×1080 with a fully transparent background. Only the scorebug elements are visible; everything else is transparent, allowing the camera feed to show through.

### 5.2 OBS Scene Structure

The recommended OBS scene layering (top to bottom):

1. **RackUp Overlay** (browser source) — topmost layer, transparent except for the scorebug.
2. **Webcam Feed** (video capture device) — the overhead camera showing the pool table.

No other sources are needed for basic recording.

### 5.3 Automated OBS Configuration

During initial setup, the RackUp Server can optionally configure OBS programmatically via the OBS WebSocket API:
- Create the scene if it doesn't exist.
- Add the browser source pointed to `http://localhost:4077/overlay`.
- Set the correct dimensions and layering.

This is a nice-to-have for first-time setup; manual configuration is also straightforward (see §5.1).

---

## 6. Overlay HTML Page Structure

### 6.1 Page Requirements

- The page at `/overlay` must be a single self-contained HTML file (inline CSS, inline JS, or bundled assets).
- **Background**: `transparent` (critical for OBS compositing).
- **Body dimensions**: 1920×1080px, no scrollbars, no overflow.
- The page must load and render within 2 seconds.
- No user interaction elements (no buttons, no inputs).
- The page should not produce any console errors (OBS browser source logs are hard to debug).

### 6.2 Skeleton HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <title>RackUp Overlay</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    /* Reset & transparent background */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: transparent;
      font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', sans-serif;
    }

    /* Scorebug container — positioned bottom-left */
    .scorebug { /* ... see §2 for full styling */ }

    /* Animations — slide in/out, score pulse, etc. */
    /* ... see §3.2 for animation specs */
  </style>
</head>
<body>
  <div id="scorebug" class="scorebug hidden">
    <div class="player player-a">
      <span class="player-name" id="playerA-name">—</span>
    </div>
    <div class="score-centre">
      <span class="score-value" id="playerA-score">0</span>
      <span class="score-separator">–</span>
      <span class="score-value" id="playerB-score">0</span>
    </div>
    <div class="player player-b">
      <span class="player-name" id="playerB-name">—</span>
    </div>
  </div>

  <div id="rec-indicator" class="rec-indicator hidden">
    <span class="rec-dot"></span>
    <span class="rec-text">REC</span>
  </div>

  <script>
    // SSE connection, state management, DOM updates
    // See §4 for data flow details
  </script>
</body>
</html>
```

---

## 7. Server-Side Implementation

### 7.1 Endpoints

The RackUp Server exposes the following overlay-specific endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/overlay` | Serves the overlay HTML page (for OBS browser source) |
| `GET` | `/api/overlay/state` | Returns current overlay state as JSON |
| `GET` | `/api/overlay/events` | SSE stream for real-time overlay updates |

### 7.2 Triggering Overlay Updates

The overlay updates are triggered by actions in the main RackUp application flow. The server maintains an in-memory overlay state object and pushes SSE events when it changes.

| RackUp Action | Overlay Effect |
|---|---|
| Session started, players selected | Overlay becomes visible with player names, score 0–0 |
| New matchup selected (different players step up) | Player names update, score resets to their session head-to-head |
| Frame result recorded (winner tapped) | Score updates with animation |
| Recording started | REC indicator appears |
| Recording stopped | REC indicator disappears |
| Session ended | Overlay hides (slide out) |
| Recording toggle disabled | Overlay hides |

### 7.3 Overlay State Object

```typescript
interface OverlayPlayer {
  id: string;
  name: string;
  nickname?: string;   // optional display nickname
  emoji?: string;      // optional player emoji
  score: number;
}

interface OverlayState {
  visible: boolean;
  isRecording: boolean;
  playerA: OverlayPlayer | null;
  playerB: OverlayPlayer | null;
  sessionDate: string | null;
  frameNumber: number;
  lastWinnerId: string | null;  // used to trigger highlight animation
}
```

This state is held in memory on the server and rebuilt from the database on server restart.

---

## 8. Styling Variants & Customisation

### 8.1 Default Theme: "Broadcast"

The default theme described in §2 — dark semi-transparent panels with green centre, white text. Professional and clean.

### 8.2 Alternative Theme: "Chalkboard"

An alternative theme that matches the RackUp main UI aesthetic:
- Background: `rgba(30, 40, 30, 0.85)` — dark green-grey.
- Text: `rgba(230, 225, 210, 1.0)` — warm chalk-white.
- Font: a slightly rougher sans-serif like `"Barlow Semi Condensed"` for a casual feel.
- Score centre: same background as player panels (no colour differentiation).

### 8.3 Theme Configuration

- The overlay theme is configurable in RackUp's settings page.
- The theme name is passed as a query parameter to the overlay URL: `http://localhost:4077/overlay?theme=broadcast` or `http://localhost:4077/overlay?theme=chalkboard`.
- Themes are defined as CSS custom properties (variables) at the top of the overlay stylesheet, making it easy to add new themes later.

```css
/* Theme: Broadcast (default) */
:root {
  --scorebug-bg: rgba(15, 15, 15, 0.85);
  --scorebug-centre-bg: rgba(0, 120, 80, 0.90);
  --scorebug-text: #FFFFFF;
  --scorebug-text-dim: rgba(255, 255, 255, 0.7);
  --scorebug-highlight: rgba(74, 222, 128, 0.3);
  --scorebug-radius: 6px;
  --scorebug-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  --scorebug-font: 'Inter', 'Segoe UI', sans-serif;
}

/* Theme: Chalkboard */
:root[data-theme="chalkboard"] {
  --scorebug-bg: rgba(30, 40, 30, 0.85);
  --scorebug-centre-bg: rgba(30, 40, 30, 0.85);
  --scorebug-text: rgba(230, 225, 210, 1.0);
  --scorebug-text-dim: rgba(230, 225, 210, 0.6);
  --scorebug-highlight: rgba(200, 180, 100, 0.3);
  --scorebug-radius: 4px;
  --scorebug-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  --scorebug-font: 'Barlow Semi Condensed', 'Inter', sans-serif;
}
```

---

## 9. PiP Preview & Camera Tab Integration

### 9.1 How PiP Works in the RackUp Frontend

The small picture-in-picture preview on the session screen and the larger Camera tab view in the main RackUp UI are **not** the same as the OBS overlay page. They are rendered within the React frontend and show the OBS output feed.

There are two approaches to getting the OBS camera feed into the RackUp UI:

#### Option A: OBS Virtual Camera (Recommended)
- Enable OBS Virtual Camera output.
- The RackUp frontend accesses it via the browser's `navigator.mediaDevices.getUserMedia()` API, selecting the OBS Virtual Camera as the video source.
- This gives the React app a live `<video>` element showing exactly what OBS is outputting (camera feed + overlay composited).
- Works well for both the PiP and full Camera tab views.

#### Option B: OBS WebSocket Screenshot
- Use the OBS WebSocket API's `GetSourceScreenshot` request to periodically capture a JPEG frame from OBS.
- Display this as an `<img>` in the React app, refreshed every 500ms–1s.
- Lower quality (not truly live, slight delay) but doesn't require virtual camera setup.
- Useful as a fallback if virtual camera causes issues.

### 9.2 PiP Component (Session Screen)

- **Size**: approximately 320×180px (16:9, ~15–18% of screen width on a 1920px display).
- **Position**: top-right corner of the session screen, 8–16px margin from edges.
- **Border**: 2px solid `rgba(255, 255, 255, 0.2)`, rounded corners 8px.
- **Drop shadow**: subtle, to lift it off the scoreboard background.
- **Overlay badge**: a small pulsing red dot in the top-right corner of the PiP when recording is active.
- **Interaction**: tapping the PiP navigates to the Camera tab.
- The PiP shows the composited output (camera + scorebug), so the user can verify the overlay looks correct without switching tabs.

### 9.3 Camera Tab

- Full-width live view of the OBS output, maintaining 16:9 aspect ratio.
- Below the video: current recording status, elapsed recording time (counting up), and file name of the current recording.
- Manual override buttons: "Start Recording" and "Stop Recording" — these bypass the automatic recording logic and send direct commands to OBS. Useful for testing or manual control.
- A small settings area or info panel showing: OBS connection status (connected/disconnected), recording file path, resolution, and encoder info.

---

## 10. Testing & Validation

### 10.1 Overlay Rendering Tests

- The overlay must render correctly at exactly 1920×1080 in OBS browser source.
- Transparent areas must be truly transparent (no white/black background bleed).
- Test with player names of varying lengths: short (3 chars), medium (8 chars), and long (15+ chars with truncation).
- Test score values from 0–0 up to double digits (e.g., 15–12).
- Verify animations are smooth at 30fps (OBS browser source default).

### 10.2 Real-Time Update Tests

- Record a frame result on the touchscreen and verify the overlay updates within 200ms.
- Change the active matchup and verify the player name transition animation plays.
- Toggle recording on/off and verify the REC indicator responds.
- Kill the RackUp Server and verify the overlay holds its last state (doesn't blank).
- Restart the RackUp Server and verify the overlay reconnects and refreshes.

### 10.3 OBS Integration Tests

- Verify the overlay composites correctly over the webcam feed (no z-order issues).
- Verify recorded video files contain the overlay baked into the video.
- Test with OBS in both windowed and minimised states.
- Verify the PiP preview in the RackUp UI matches what OBS is recording.

---

## 11. File Structure

The overlay-related code should be organised within the RackUp project as follows:

```
rackup/
├── server/
│   └── src/
│       ├── index.ts            # Express API — serves /overlay, /api/overlay/*, recording, VAR endpoints
│       ├── obs.ts              # OBS WebSocket client (recording control, file naming)
│       ├── overlayState.ts     # In-memory overlay state + SSE broadcast logic
│       └── config.ts           # Server configuration (OBS host/port, paths)
├── overlay/
│   └── overlay.html            # Standalone overlay page served to OBS (HTML/CSS/JS all inlined)
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx        # Session screen with inline PiP preview
│   │   └── CameraPage.tsx      # Full camera view tab with manual recording controls
│   ├── hooks/
│   │   └── useObsStatus.ts     # OBS connection + recording status hook
│   └── ...
└── ...
```

---

## 12. Acceptance Criteria

1. ✅ The overlay page renders a scorebug at 1920×1080 with a transparent background, suitable for OBS browser source compositing.
2. ✅ Player names and head-to-head session score are displayed and update in real time when frame results are recorded.
3. ✅ The scorebug slides in/out with smooth CSS animations when the overlay becomes visible/hidden.
4. ✅ Score changes trigger a brief visual highlight animation on the winning player's panel.
5. ✅ A matchup change (different players) triggers a slide-out/slide-in transition.
6. ✅ A REC indicator pulses in the top-right corner when recording is active.
7. ✅ The overlay reconnects automatically if the SSE connection drops, retaining the last known state.
8. ✅ The overlay is configurable with at least two themes (Broadcast and Chalkboard) via a URL parameter.
9. ✅ A PiP preview of the OBS output is visible on the RackUp session screen (bottom-right, ~320×180px).
10. ✅ A Camera tab shows a full-size live OBS preview with recording status and manual start/stop controls.
11. ✅ The overlay bakes correctly into recorded video files.
