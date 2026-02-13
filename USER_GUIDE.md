# RackUp User Guide

A simple guide to using RackUp — your digital pool scoreboard.

---

## What Is RackUp?

RackUp replaces the old chalkboard. It keeps score, tracks who's winning, and remembers everything so you can look back at stats and bragging rights later. It can also record each frame on video using OBS Studio.

The app has **6 tabs** along the bottom of the screen:

| Tab | What it does |
|-----|-------------|
| **Home** | Start sessions, record frames, see this month's leaderboard |
| **Camera** | Live table camera preview and recording controls |
| **Players** | Add new players, rename them, pick emojis, set nicknames |
| **History** | Browse past sessions with summary stats |
| **Recordings** | Watch back recorded frames, tag highlights |
| **Stats** | Player stats, head-to-head records, achievements, leaderboards |

---

## Adding Players (Do This First)

Before you can play, you need to add the players.

1. Tap the **Players** tab at the bottom
2. Tap the big **+ Add Player** button
3. Tap the emoji on the left to pick a custom emoji for that player (optional — defaults to a pool ball)
4. Type the player's name using the on-screen keyboard
5. Optionally type a nickname (shown in gold italics next to the name)
6. Tap **Done** on the keyboard to save

To change a player's name, nickname, or emoji later, tap **Edit** next to their name.

To remove a player you no longer need, tap **Archive**. Archived players can be restored at any time from the "Archived" section at the bottom of the Players page.

---

## Playing a Session

### Starting Up

1. Tap the **Home** tab
2. Tap the big **New Session** button
3. Tap each player who is playing — they get a **gold number** showing the playing order
   - The order you tap them matters: the first two play the opening frame, the rest join the queue
   - Players are sorted by how frequently they play (most active at the top)
4. If you want frames recorded on video, tick the **Record** checkbox in the header bar
5. Tap **Start Session** (appears once 2+ players are selected)

### The VS Splash

After starting a session (and between every frame), a **VS splash screen** appears showing the two players about to play. It includes:
- Player emojis and names
- All-time head-to-head stat (e.g. "Paddy wins 62% of the time")
- A big green **Ready to Play** button

Tap **Ready to Play** when both players are set — this starts the video recording (if enabled).

### Recording a Frame (Who Won)

This is the main thing you'll do:

1. Two big buttons show the current players — one on each side
2. **Tap the winner's name.** That's it!

What happens next:
- The winner's button flashes green
- The frame is saved
- The video recording stops (capturing just that frame)
- A win sound plays
- The **winner stays on** at the table
- The **loser goes to the back of the queue**
- The VS splash appears for the next matchup

### What You'll See During a Session

- **Head-to-head prediction** at the top: shows the all-time win percentage between the two current players (e.g. "Shay wins 62% of the time")
- **Session score** between the two players (e.g. "3-1")
- **Recording flags** (when recording): tag the current frame with Brush, Clearance, Foul, or Special
- **Next Up** queue: shows who's waiting to play, with the next challenger highlighted in gold
- **Running totals** along the bottom: each player's emoji and frame count for the session
- **Camera preview** (when recording is enabled): small picture-in-picture of the table camera in the top-right corner — tap it to go to the full Camera tab

### Recording Flags

When video recording is active, you'll see four tag buttons below the player names: **Brush**, **Clearance**, **Foul**, and **Special**. Tap any of these during a frame to tag it. The tags are saved with the recording and appear on the Recordings page for easy browsing later.

### VAR Review

If something controversial happens during a frame, tap the **VAR** button (appears when recording is active). This stops the recording and plays back the footage so everyone can review the incident. Tap **Resume Recording** when you're done to carry on.

### Win Streaks

When a player wins several frames in a row, the app calls it out:
- 2 in a row: *"2 in a row!"*
- 3 in a row: *"Hat trick!"*
- 4 in a row: *"On fire! 4 straight!"*
- 5+: *"UNSTOPPABLE! (n) straight!"*

The streak message appears in gold and a special sound plays.

### Mid-Session Options

Along the bottom of the screen during a session, you'll find these buttons:

| Button | What it does |
|--------|-------------|
| **Undo** | Takes back the last frame (asks you to confirm first) |
| **+ Player** | Adds another player to the session mid-way through |
| **Speaker icon** | Turns sounds on or off |
| **Record** | Starts or stops video recording |
| **End Session** | Finishes the session (opens a confirmation popup) |

### Changing the Matchup

Don't want to follow the automatic queue? Tap **Change Players** to manually pick who plays next. If a recording is in progress, you'll be asked whether to keep or discard it.

### Ending a Session

1. Tap **End Session** at the bottom (or on the VS splash screen)
2. A popup appears showing how many frames were played — tap **End Session** to confirm, or **Cancel** to go back
3. The final standings appear with gold, silver, and bronze rankings
4. A fanfare sound plays
5. Tap **Done** to go back to the home screen

---

## Achievements

Players earn badges for milestones. These unlock automatically — you don't need to do anything. When someone unlocks a new achievement, a gold notification pops up on screen.

### All Achievements

| Badge | What you need to do |
|-------|-------------------|
| First Blood | Win your first ever frame |
| Double Digits | Win 10 frames total |
| Half Century | Win 50 frames total |
| Century | Win 100 frames total |
| Living Legend | Win 250 frames total |
| Hat Trick | Win 3 in a row in a session |
| On Fire | Win 5 in a row in a session |
| Perfect 10 | Win 10 in a row in a session |
| Flawless | Win all your frames in a session (at least 3 wins, no losses) |
| Clean Sweep | Beat every opponent in a session (at least 2 opponents) |
| Regular | Play 10 sessions |
| Veteran | Play 50 sessions |
| Iron Man | Play 100 sessions |
| Nemesis | Win 10 frames against one opponent |
| Arch Rival | Win 25 frames against one opponent |
| 50 Club | Play 50 frames against one opponent |
| Dynasty | Win 100 frames against one opponent |
| Comeback King | Come back from 3+ down against an opponent to overtake them |
| Marathon Man | Play in a 20+ frame session |
| Opening Break | Win the first frame of 10 different sessions |
| Giant Killer | Beat the current monthly number 1 player |

To see all badges, go to **Stats** > pick a player > tap the **Badges** tab.

---

## Checking Stats and Leaderboards

Tap the **Stats** tab at the bottom.

### Player Stats

1. Pick a player by tapping their card along the top (shows emoji and name, selected player has a gold border)
2. Three sub-tabs:
   - **Overview**: Total wins/losses, win percentage, sessions played, best session, current form (last 5 sessions)
   - **Head-to-Head**: Record against each opponent they've played
   - **Badges**: All achievements — earned ones glow gold, unearned ones are faded

### Leaderboards

1. Tap the **Leaderboards** tab
2. Choose a time period: **Monthly**, **Yearly**, or **All Time**
3. Use the selectors to pick the specific month or year
4. The table shows rankings with wins, losses, and win percentage

---

## Viewing Past Sessions

Tap the **History** tab to see every completed session, newest first.

At the top, a **summary bar** shows total sessions played, total frames, and the most prolific session winner.

Each session entry shows:
- The date and time
- How many players and frames
- Who won (highlighted in gold)
- The players involved

Tap a session to see the full breakdown:
- **Final standings** with medal colours (gold, silver, bronze)
- **Head-to-head matchups** with a gold star next to dominant players (60%+ win rate)
- **Frame-by-frame timeline** with a connecting line, showing who beat who, when each frame started, and how long it lasted

---

## Camera and Recordings

### Camera Tab

If OBS Studio is connected, the Camera tab shows a live preview of the table camera. You can also manually start and stop recordings from here, and see the current recording status and duration.

### Recordings Tab

Browse and play back recorded frame videos. Each recording shows:
- Player names and frame number
- Date and time
- File size

Tap any recording to watch it in the built-in video player. If the video doesn't play in the browser, it may need to be opened in VLC.

Recordings can be tagged with **flag pills** (Brush, Clearance, Foul, Special) — tap a flag to toggle it on or off.

---

## The Monthly Leaderboard (Home Screen)

When no session is active, the Home screen shows the current month's leaderboard (e.g. "February") — a quick glance at who's on top right now. This resets at the start of each month.

---

## Tips

- **The app remembers everything.** If the power goes out mid-session, just reopen the app — it picks up where you left off.
- **You can mute sounds** by tapping the speaker icon during a session.
- **Archived players aren't deleted.** Their history is kept. You can bring them back any time from the Players page.
- **The winner always stays on.** That's the rule — win and you keep playing. Lose and you go to the back of the queue.
- **Tap the winner, not the loser.** The big buttons during a game are for recording who won. Just tap the winner.
- **Recording is optional.** Everything works the same with or without OBS connected. Just untick Record if you don't want video.
- **Nicknames show everywhere.** If you set a nickname for a player, it appears in gold italics on the scoreboard, overlay, stats, and history pages.
