import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { createReadStream, statSync } from "fs";
import { mkdir, readdir, stat } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";
import { obs } from "./obs.js";
import { config } from "./config.js";
import { overlayState } from "./overlayState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json());

// ── OBS Routes ──

app.get("/api/obs/status", async (_req: Request, res: Response) => {
  try {
    const status = await obs.getStatus();
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.get("/api/obs/screenshot", async (_req: Request, res: Response) => {
  try {
    const imageData = await obs.getScreenshot();
    res.json({ imageData });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/obs/start-recording", async (req: Request, res: Response) => {
  try {
    const { filename, directory } = req.body as {
      filename?: string;
      directory?: string;
    };

    const dir = directory ?? obs.generateDirectory(new Date().toISOString());
    const file = filename ?? `recording_${Date.now()}.mkv`;

    await mkdir(dir, { recursive: true });
    await obs.startRecording(dir, file);
    overlayState.setRecording(true);

    res.json({ success: true, message: `Recording started: ${file}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/obs/stop-recording", async (_req: Request, res: Response) => {
  try {
    const filePath = await obs.stopRecording();
    overlayState.setRecording(false);
    res.json({ success: true, filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/obs/frame-transition", async (req: Request, res: Response) => {
  try {
    const { player1, player2, score, sessionDate, frameNumber } = req.body as {
      player1: string;
      player2: string;
      score: string;
      sessionDate: string;
      frameNumber: number;
    };

    let videoFilePath: string | undefined;

    // Stop current recording if one is active
    const status = await obs.getStatus();
    if (status.recording) {
      videoFilePath = await obs.stopRecording();
      // OBS needs time to finalize the file before starting a new recording
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Generate new filename and directory
    const filename = obs.generateFilename(player1, player2, frameNumber);
    const directory = obs.generateDirectory(sessionDate);

    // Ensure directory exists
    await mkdir(directory, { recursive: true });

    // Start new recording
    await obs.startRecording(directory, filename);

    // Update overlay text
    const overlayText = `${player1} vs ${player2} | ${score}`;
    await obs.setOverlayText(overlayText);

    res.json({ success: true, videoFilePath: videoFilePath ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/obs/overlay", async (req: Request, res: Response) => {
  try {
    const { player1, player2, score, date } = req.body as {
      player1: string;
      player2: string;
      score: string;
      date: string;
    };

    const overlayText = `${player1} vs ${player2} | ${score} | ${date}`;
    await obs.setOverlayText(overlayText);

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Recordings Routes ──

interface RecordingMeta {
  relativePath: string;
  date: string;
  time: string;
  player1: string;
  player2: string;
  frameNumber: number;
  sizeBytes: number;
}

const FILENAME_RE =
  /^(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})_(.+)-vs-(.+)_Frame(\d+)\.mkv$/;

app.get("/api/recordings", async (_req: Request, res: Response) => {
  try {
    const baseDir = config.recordingsBaseDir;

    let entries: string[];
    try {
      entries = await readdir(baseDir, { recursive: true }) as string[];
    } catch {
      res.json({ recordings: [] });
      return;
    }

    const mkvFiles = entries.filter((e) => e.endsWith(".mkv"));

    const recordings: RecordingMeta[] = await Promise.all(
      mkvFiles.map(async (relativePath) => {
        const fullPath = path.join(baseDir, relativePath);
        const fileStat = await stat(fullPath);
        const filename = path.basename(relativePath);
        const match = filename.match(FILENAME_RE);

        if (match) {
          return {
            relativePath: relativePath.replace(/\\/g, "/"),
            date: match[1],
            time: `${match[2]}:${match[3]}`,
            player1: match[4],
            player2: match[5],
            frameNumber: Number(match[6]),
            sizeBytes: fileStat.size,
          };
        }

        return {
          relativePath: relativePath.replace(/\\/g, "/"),
          date: fileStat.mtime.toISOString().slice(0, 10),
          time: fileStat.mtime.toISOString().slice(11, 16),
          player1: "Unknown",
          player2: "Unknown",
          frameNumber: 0,
          sizeBytes: fileStat.size,
        };
      }),
    );

    recordings.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.time.localeCompare(a.time);
    });

    res.json({ recordings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.get("/api/recordings/stream", (req: Request, res: Response) => {
  try {
    const relativePath = req.query.path as string | undefined;
    if (!relativePath) {
      res.status(400).json({ error: "Missing path parameter" });
      return;
    }

    const baseDir = path.resolve(config.recordingsBaseDir);
    const fullPath = path.resolve(baseDir, relativePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Security: only allow .mkv files
    if (!fullPath.toLowerCase().endsWith(".mkv")) {
      res.status(400).json({ error: "Only .mkv files are supported" });
      return;
    }

    const fileStat = statSync(fullPath);
    const fileSize = fileStat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/x-matroska",
      });

      createReadStream(fullPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/x-matroska",
        "Accept-Ranges": "bytes",
      });

      createReadStream(fullPath).pipe(res);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Overlay Routes ──

app.get("/overlay", (_req: Request, res: Response) => {
  const overlayPath = path.resolve(__dirname, "../../overlay/overlay.html");
  res.sendFile(overlayPath);
});

app.get("/api/overlay/state", (_req: Request, res: Response) => {
  res.json(overlayState.getState());
});

app.get("/api/overlay/events", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  overlayState.addClient(res);

  _req.on("close", () => {
    overlayState.removeClient(res);
  });
});

app.post("/api/overlay/update", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  overlayState.updateFull(body);
  res.json({ success: true });
});

// ── Start ──

const server = app.listen(config.serverPort, () => {
  console.log(`[Server] RackUp OBS server listening on port ${config.serverPort}`);

  // Connect to OBS on startup (non-blocking)
  obs.connect().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Server] Initial OBS connection failed: ${message}`);
    console.warn("[Server] Will keep retrying in the background...");
  });
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[Server] ERROR: Port ${config.serverPort} is already in use!`);
    console.error("[Server] Kill the other process and try again.");
    process.exit(1);
  }
  throw err;
});
