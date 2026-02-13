import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import { createReadStream, statSync } from "fs";
import { mkdir, readdir, rename, stat, unlink } from "fs/promises";
import { fileURLToPath } from "url";
import { execSync, spawn } from "child_process";
import path from "path";
import { obs } from "./obs.js";
import { config } from "./config.js";
import { overlayState } from "./overlayState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Track the in-progress recording so it can be excluded from listings
let activeRecordingRelPath: string | null = null;

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
    const file = filename ?? `recording_${Date.now()}.mp4`;

    await mkdir(dir, { recursive: true });
    await obs.startRecording(dir, file);
    overlayState.setRecording(true);
    activeRecordingRelPath = path.relative(path.resolve(config.recordingsBaseDir), path.resolve(dir, file)).replace(/\\/g, "/");

    res.json({ success: true, message: `Recording started: ${file}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/obs/stop-recording", async (req: Request, res: Response) => {
  try {
    const { flags } = (req.body ?? {}) as { flags?: string[] };
    const filePath = await obs.stopRecording();
    overlayState.setRecording(false);
    activeRecordingRelPath = null;

    // If flags were provided, apply them to the file after OBS finalizes it
    if (flags && flags.length > 0) {
      const validFlags = flags.filter((f) =>
        (ALLOWED_FLAGS as readonly string[]).includes(f),
      );
      if (validFlags.length > 0) {
        // Fire and forget — don't block the response
        (async () => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          try {
            const dir = path.dirname(filePath);
            const filename = path.basename(filePath);
            const match = filename.match(FILENAME_RE);
            if (match) {
              const sorted = [...validFlags].sort();
              const flagStr = sorted.map((f) => `[${f}]`).join("");
              const segmentPart = match[7] ?? "";
              const ext = path.extname(filename);
              const newFilename = `${match[1]}_${match[2]}${match[3]}_${match[4]}-vs-${match[5]}_Frame${match[6]}${segmentPart}${flagStr}${ext}`;
              await rename(filePath, path.join(dir, newFilename));
              console.log(
                `[OBS] Applied flags [${sorted.join(", ")}] to: ${newFilename}`,
              );
            }
          } catch (e) {
            console.warn("[OBS] Failed to apply flags to recording:", e);
          }
        })();
      }
    }

    res.json({ success: true, filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/obs/discard-recording", async (_req: Request, res: Response) => {
  try {
    const filePath = await obs.stopRecording();
    overlayState.setRecording(false);
    activeRecordingRelPath = null;

    // Wait for OBS to finalize & release the file, then delete it
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      await unlink(filePath);
      console.log(`[OBS] Discarded recording: ${filePath}`);
    } catch (e) {
      console.warn(`[OBS] Failed to delete recording file: ${filePath}`, e);
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/obs/frame-transition", async (req: Request, res: Response) => {
  try {
    const { player1, player2, player1Nickname, player2Nickname, score, sessionDate, frameNumber } = req.body as {
      player1: string;
      player2: string;
      player1Nickname?: string | null;
      player2Nickname?: string | null;
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
    activeRecordingRelPath = path.relative(path.resolve(config.recordingsBaseDir), path.resolve(directory, filename)).replace(/\\/g, "/");

    // Update overlay text (include nicknames if available)
    const p1Display = player1Nickname ? `${player1} "${player1Nickname}"` : player1;
    const p2Display = player2Nickname ? `${player2} "${player2Nickname}"` : player2;
    const overlayText = `${p1Display} vs ${p2Display} | ${score}`;
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
  segment: number | null;
  sizeBytes: number;
  flags: string[];
}

const ALLOWED_FLAGS = ["brush", "clearance", "foul", "special"] as const;

const FILENAME_RE =
  /^(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})_(.+)-vs-(.+)_Frame(\d+)(_pt\d+)?((?:\[[a-z]+\])*)\.(?:mkv|mp4)$/;

function parseFlags(flagGroup: string): string[] {
  if (!flagGroup) return [];
  const matches = flagGroup.match(/\[([a-z]+)\]/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

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

    const videoFiles = entries.filter((e) => {
      if (!e.endsWith(".mkv") && !e.endsWith(".mp4")) return false;
      // Exclude the file currently being recorded by OBS
      if (activeRecordingRelPath && e.replace(/\\/g, "/") === activeRecordingRelPath) return false;
      return true;
    });

    const recordings: RecordingMeta[] = await Promise.all(
      videoFiles.map(async (relativePath) => {
        const fullPath = path.join(baseDir, relativePath);
        const fileStat = await stat(fullPath);
        const filename = path.basename(relativePath);
        const match = filename.match(FILENAME_RE);

        if (match) {
          const segmentStr = match[7]; // e.g. "_pt2" or undefined
          return {
            relativePath: relativePath.replace(/\\/g, "/"),
            date: match[1],
            time: `${match[2]}:${match[3]}`,
            player1: match[4],
            player2: match[5],
            frameNumber: Number(match[6]),
            segment: segmentStr ? Number(segmentStr.slice(3)) : null,
            sizeBytes: fileStat.size,
            flags: parseFlags(match[8]),
          };
        }

        return {
          relativePath: relativePath.replace(/\\/g, "/"),
          date: fileStat.mtime.toISOString().slice(0, 10),
          time: fileStat.mtime.toISOString().slice(11, 16),
          player1: "Unknown",
          player2: "Unknown",
          frameNumber: 0,
          segment: null,
          sizeBytes: fileStat.size,
          flags: [],
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

    // Security: only allow video files
    const ext = path.extname(fullPath).toLowerCase();
    if (ext !== ".mkv" && ext !== ".mp4") {
      res.status(400).json({ error: "Only .mkv and .mp4 files are supported" });
      return;
    }

    const contentType = ext === ".mp4" ? "video/mp4" : "video/x-matroska";
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
        "Content-Type": contentType,
      });

      createReadStream(fullPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      });

      createReadStream(fullPath).pipe(res);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/recordings/flag", async (req: Request, res: Response) => {
  try {
    const { relativePath, flags } = req.body as {
      relativePath: string;
      flags: string[];
    };

    if (!relativePath || !Array.isArray(flags)) {
      res.status(400).json({ error: "Missing relativePath or flags" });
      return;
    }

    // Validate all flags
    for (const flag of flags) {
      if (!(ALLOWED_FLAGS as readonly string[]).includes(flag)) {
        res.status(400).json({ error: `Invalid flag: ${flag}` });
        return;
      }
    }

    const baseDir = path.resolve(config.recordingsBaseDir);
    const fullPath = path.resolve(baseDir, relativePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Parse current filename to rebuild it
    const dir = path.dirname(fullPath);
    const filename = path.basename(fullPath);
    const match = filename.match(FILENAME_RE);

    if (!match) {
      res.status(400).json({ error: "Filename does not match expected pattern" });
      return;
    }

    // Build new filename with sorted flags (preserving segment suffix)
    const sortedFlags = [...flags].sort();
    const flagStr = sortedFlags.map((f) => `[${f}]`).join("");
    const segmentPart = match[7] ?? "";
    const ext = path.extname(filename);
    const newFilename = `${match[1]}_${match[2]}${match[3]}_${match[4]}-vs-${match[5]}_Frame${match[6]}${segmentPart}${flagStr}${ext}`;
    const newFullPath = path.join(dir, newFilename);

    // Rename file on disk
    await rename(fullPath, newFullPath);

    // Compute new relative path
    const newRelativePath = path
      .relative(baseDir, newFullPath)
      .replace(/\\/g, "/");

    const fileStat = await stat(newFullPath);

    const segStr = match[7];
    res.json({
      relativePath: newRelativePath,
      date: match[1],
      time: `${match[2]}:${match[3]}`,
      player1: match[4],
      player2: match[5],
      frameNumber: Number(match[6]),
      segment: segStr ? Number(segStr.slice(3)) : null,
      sizeBytes: fileStat.size,
      flags: sortedFlags,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── VAR Review Routes ──

app.post("/api/var/review", async (_req: Request, res: Response) => {
  try {
    const filePath = await obs.stopRecording();
    overlayState.setRecording(false);
    activeRecordingRelPath = null;

    // Wait for OBS to finalize the file (write MP4 moov atom) before streaming
    await new Promise(resolve => setTimeout(resolve, 1500));

    const absPath = path.resolve(filePath);
    const baseDir = path.resolve(config.recordingsBaseDir);
    const relativePath = path.relative(baseDir, absPath).replace(/\\/g, "/");

    res.json({ videoFilePath: relativePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/var/resume", async (req: Request, res: Response) => {
  try {
    const { player1, player2, sessionDate, frameNumber } = req.body as {
      player1: string;
      player2: string;
      sessionDate: string;
      frameNumber: number;
    };

    const directory = obs.generateDirectory(sessionDate);

    // Scan directory for existing segments to determine next _ptN suffix
    let existingFiles: string[];
    try {
      existingFiles = await readdir(directory) as string[];
    } catch {
      existingFiles = [];
    }

    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
    const p1 = sanitize(player1);
    const p2 = sanitize(player2);
    const frame = String(frameNumber).padStart(3, "0");
    const prefix = `_${p1}-vs-${p2}_Frame${frame}`;

    // Find the highest existing segment number
    let maxSegment = 1; // base file counts as segment 1
    for (const f of existingFiles) {
      if (f.includes(prefix)) {
        const ptMatch = f.match(/_pt(\d+)/);
        if (ptMatch) {
          maxSegment = Math.max(maxSegment, Number(ptMatch[1]));
        }
      }
    }
    const nextSegment = maxSegment + 1;

    const filename = obs.generateSegmentFilename(player1, player2, frameNumber, nextSegment);

    await mkdir(directory, { recursive: true });
    await obs.startRecording(directory, filename);
    overlayState.setRecording(true);
    activeRecordingRelPath = path.relative(path.resolve(config.recordingsBaseDir), path.resolve(directory, filename)).replace(/\\/g, "/");

    res.json({ success: true, segment: nextSegment });
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

// ── Version / Update Routes ──

app.get("/api/version", async (_req: Request, res: Response) => {
  try {
    const current = execSync("git rev-parse --short HEAD", {
      cwd: config.repoDir,
    })
      .toString()
      .trim();

    let updatesAvailable = 0;
    try {
      execSync("git fetch origin main --quiet", { cwd: config.repoDir });
      const count = execSync("git rev-list HEAD..origin/main --count", {
        cwd: config.repoDir,
      })
        .toString()
        .trim();
      updatesAvailable = Number(count);
    } catch {
      // Network error or no remote — just report 0 updates
    }

    res.json({ current, updatesAvailable });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post("/api/update", async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Transfer-Encoding", "chunked");

  const send = (data: Record<string, unknown>) => {
    res.write(JSON.stringify(data) + "\n");
  };

  const run = (label: string, cmd: string, cwd?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      send({ step: label, status: "running" });
      const child = spawn(cmd, { shell: true, cwd: cwd ?? config.repoDir });
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        send({ step: label, output: chunk.toString() });
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`${label} failed (exit ${code}): ${stderr}`));
        } else {
          send({ step: label, status: "done" });
          resolve();
        }
      });
    });
  };

  try {
    await run("Pulling latest code", "git pull origin main");
    await run("Installing dependencies", "npm install");
    await run("Building frontend", "npm run build");
    await run(
      "Installing server dependencies",
      "npm install",
      path.join(config.repoDir, "server"),
    );

    const newVersion = execSync("git rev-parse --short HEAD", {
      cwd: config.repoDir,
    })
      .toString()
      .trim();

    send({ step: "Update complete", status: "done", newVersion, success: true });
    res.end();

    // Schedule pm2 restart after response is sent
    setTimeout(() => {
      try {
        execSync("npx pm2 restart rackup-server", { cwd: config.repoDir });
      } catch (e) {
        console.warn("[Update] pm2 restart failed:", e);
      }
    }, 2000);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send({ step: "Error", status: "error", error: message });
    res.end();
  }
});

// ── Static File Serving (production) ──

const distDir = path.resolve(config.repoDir, "dist");
app.use("/RackUp", express.static(distDir));
app.get(/^\/RackUp\/.*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(distDir, "index.html"));
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
