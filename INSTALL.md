# RackUp Mini PC Installation Guide

Step-by-step setup for the Windows 11 mini PC that runs the RackUp pool scoreboard and OBS recording system.

## What You'll Need

- Windows 11 mini PC (connected to your TV/monitor via HDMI)
- Internet connection (Wi-Fi or Ethernet)
- USB webcam pointed at the pool table (optional, for recording)
- A phone or laptop for initial setup (easier than using the touchscreen for typing)

## Step 1: Windows Initial Setup

1. Power on the mini PC and complete the Windows 11 setup wizard
2. Connect to your Wi-Fi network
3. Run Windows Update and install all updates (Settings > Windows Update)
4. Set the display resolution to match your TV (Settings > Display)
5. Disable sleep/screen timeout so the display stays on:
   - Settings > System > Power > Screen and sleep
   - Set all options to **Never**

## Step 2: Install Node.js

1. Open Microsoft Edge (pre-installed on Windows 11)
2. Go to **https://nodejs.org**
3. Download the **LTS** version (the big green button)
4. Run the installer, accept all defaults
5. Verify it worked: open **Terminal** (search for "Terminal" in the Start menu) and type:
   ```
   node --version
   npm --version
   ```
   Both should print version numbers.

## Step 3: Install Git

1. Go to **https://git-scm.com/downloads/win**
2. Download the 64-bit installer
3. Run the installer, accept all defaults
4. Close and reopen Terminal, then verify:
   ```
   git --version
   ```

## Step 4: Install OBS Studio

1. Go to **https://obsproject.com**
2. Download and install OBS Studio for Windows
3. Launch OBS once to complete the initial setup wizard:
   - Skip the auto-configuration wizard (we'll configure it manually)
4. Enable the WebSocket server:
   - Tools > WebSocket Server Settings
   - Check **Enable WebSocket server**
   - Set a password (you'll need this later) or leave it blank
   - Port should be **4455** (default)
   - Click OK
5. Add your webcam as a source:
   - In the Sources panel, click **+** > **Video Capture Device**
   - Name it anything (e.g. "Pool Table Camera")
   - Select your USB webcam from the Device dropdown
   - Click OK
6. Close OBS for now (it will be started automatically later)

## Step 5: Clone the RackUp Repository

Open Terminal and run:

```
cd C:\Users\%USERNAME%
git clone https://github.com/beanian/RackUp.git rackup
cd rackup
```

## Step 6: Install Dependencies

Still in Terminal, inside the `rackup` folder:

```
npm install
cd server
npm install
cd ..
```

## Step 7: Build the Frontend

```
npm run build
```

This creates the `dist/` folder with the compiled frontend.

## Step 8: Configure the Server

Create a `.env` file in the rackup folder. In Terminal:

```
notepad .env
```

Paste the following (adjust the OBS password if you set one in Step 4):

```
OBS_PASSWORD=your-obs-password-here
RECORDINGS_BASE_DIR=C:\Users\YourUsername\Videos\RackUp
SERVER_PORT=4077
```

Save and close Notepad.

If you left the OBS WebSocket password blank, use:

```
OBS_PASSWORD=
```

The recordings directory will be created automatically when the first recording starts.

## Step 9: Install PM2 (Process Manager)

PM2 keeps the RackUp server running in the background and restarts it automatically if it crashes or the PC reboots.

```
npm install -g pm2
npm install -g pm2-windows-startup
```

Start the server:

```
pm2 start ecosystem.config.cjs
```

Verify it's running:

```
pm2 status
```

You should see `rackup-server` with status **online**.

Set it to start automatically on boot:

```
pm2 save
pm2-startup install
```

## Step 10: Configure OBS to Auto-Start

RackUp needs OBS running in the background to handle recording. Set it to launch at startup:

1. Press `Win + R`, type `shell:startup`, press Enter
2. This opens the Startup folder
3. Right-click in the folder > New > Shortcut
4. Browse to `C:\Program Files\obs-studio\bin\64bit\obs64.exe`
5. Click Next, name it "OBS Studio", click Finish
6. Right-click the new shortcut > Properties
7. In the Target field, add ` --minimize-to-tray` at the end, so it reads:
   ```
   "C:\Program Files\obs-studio\bin\64bit\obs64.exe" --minimize-to-tray
   ```
8. Click OK

OBS will now start minimized to the system tray on every boot.

## Step 11: Set Up Chrome in Kiosk Mode

The scoreboard runs as a full-screen web page in Chrome.

1. Install Google Chrome if not already installed (https://google.com/chrome)
2. Create a shortcut for kiosk mode:
   - Right-click the Desktop > New > Shortcut
   - Enter this as the target:
     ```
     "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-translate --no-first-run http://localhost:4077/RackUp/
     ```
   - Name it "RackUp Scoreboard"
3. To auto-launch on startup, copy this shortcut into the Startup folder:
   - Press `Win + R`, type `shell:startup`, press Enter
   - Paste the shortcut there

## Step 12: Test Everything

1. Make sure OBS is running (check the system tray)
2. Open Terminal and check the server:
   ```
   pm2 status
   ```
   Should show `rackup-server` as **online**.
3. Open Chrome and go to **http://localhost:4077/RackUp/**
4. You should see the RackUp scoreboard with the chalkboard theme
5. Try starting a session to verify the database connection works
6. Check the Camera tab to verify OBS is connected (green indicator)

## Step 13: Reboot Test

Restart the PC and verify that:

1. OBS starts automatically (check system tray for the OBS icon)
2. The RackUp server starts automatically (`pm2 status` in Terminal)
3. Chrome opens in full-screen kiosk mode showing the scoreboard

If Chrome doesn't open automatically, check the shortcut is in the Startup folder (Step 11).

## Updating RackUp

When updates are pushed to GitHub, update the mini PC:

```
cd C:\Users\%USERNAME%\rackup
git pull origin main
npm install
cd server && npm install && cd ..
npm run build
pm2 restart rackup-server
```

Or use the in-app update button (Settings) which does this automatically.

## Troubleshooting

### Server won't start
```
pm2 logs rackup-server
```
Check the logs for error messages. Common issues:
- Port 4077 already in use: close any other server on that port
- Missing dependencies: run `npm install` again

### OBS not connecting
- Make sure OBS is running
- Check WebSocket is enabled: Tools > WebSocket Server Settings
- Verify the password in `.env` matches the OBS setting
- Default WebSocket port is 4455

### Blank screen in Chrome
- Check the server is running: `pm2 status`
- Try navigating to `http://localhost:4077/RackUp/` manually
- Check for build errors: `npm run build`

### No data / empty leaderboards
- The database is hosted on Supabase (cloud) - check internet connection
- The Supabase credentials are baked into the app at build time

### Recordings not saving
- Check the `RECORDINGS_BASE_DIR` path exists and is writable
- Verify OBS recording format is set to MP4: Settings > Output > Recording Format

### Chrome kiosk mode - how to exit
- Press `Alt + F4` to close Chrome
- Press `Alt + Tab` to switch to another window
- Press `F11` to toggle full-screen

### PM2 commands reference
```
pm2 status                    # Check if server is running
pm2 logs rackup-server        # View server logs
pm2 restart rackup-server     # Restart the server
pm2 stop rackup-server        # Stop the server
pm2 start ecosystem.config.cjs  # Start from config
```

## Network Access

Once the mini PC is set up, anyone on the same Wi-Fi network can check stats on their phone:

- **Main scoreboard**: `http://<mini-pc-ip>:4077/RackUp/`
- **Mobile PWA**: `https://beanian.github.io/RackUp/pwa/` (works from anywhere, no local network needed)

To find the mini PC's IP address, run in Terminal:
```
ipconfig
```
Look for the IPv4 address under your Wi-Fi or Ethernet adapter.
