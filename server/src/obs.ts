import OBSWebSocket from "obs-websocket-js";
import { config } from "./config.js";

class OBSClient {
  private obs: OBSWebSocket;
  private _connected = false;
  private _recording = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private shouldReconnect = true;

  constructor() {
    this.obs = new OBSWebSocket();

    this.obs.on("ConnectionClosed", () => {
      this._connected = false;
      this._recording = false;
      console.log("[OBS] Connection closed");
      this.scheduleReconnect();
    });

    this.obs.on("RecordStateChanged", (event) => {
      this._recording = event.outputActive;
      console.log(`[OBS] Recording state: ${event.outputActive ? "active" : "stopped"}`);
    });
  }

  get connected(): boolean {
    return this._connected;
  }

  get recording(): boolean {
    return this._recording;
  }

  async connect(): Promise<void> {
    const { host, port, password } = config.obs;
    try {
      await this.obs.connect(`ws://${host}:${port}`, password || undefined);
      this._connected = true;
      this.reconnectDelay = 1000;
      this.shouldReconnect = true;
      console.log(`[OBS] Connected to ws://${host}:${port}`);

      // Sync recording state on connect
      try {
        const status = await this.obs.call("GetRecordStatus");
        this._recording = status.outputActive;
      } catch {
        // Ignore if GetRecordStatus fails
      }

      // Auto-setup: virtual camera, browser source overlay
      await this.autoSetup();
    } catch (err) {
      this._connected = false;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[OBS] Connection failed: ${message}`);
      this.scheduleReconnect();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this._connected) {
      await this.obs.disconnect();
      this._connected = false;
      this._recording = false;
      console.log("[OBS] Disconnected");
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimeout) return;

    console.log(`[OBS] Reconnecting in ${this.reconnectDelay / 1000}s...`);
    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      try {
        await this.connect();
      } catch {
        // connect() already schedules next reconnect on failure
      }
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private ensureConnected(): void {
    if (!this._connected) {
      throw new Error("OBS is not connected. Check that OBS is running with WebSocket server enabled.");
    }
  }

  async startRecording(directory: string, filename: string): Promise<void> {
    this.ensureConnected();

    // Set the recording output directory
    await this.obs.call("SetProfileParameter", {
      parameterCategory: "Output",
      parameterName: "FilePath",
      parameterValue: directory,
    });

    // Set the filename formatting
    await this.obs.call("SetProfileParameter", {
      parameterCategory: "Output",
      parameterName: "FilenameFormatting",
      parameterValue: filename.replace(/\.[^.]+$/, ""), // Strip extension, OBS adds it
    });

    await this.obs.call("StartRecord");
    this._recording = true;
    console.log(`[OBS] Recording started: ${directory}/${filename}`);
  }

  async stopRecording(): Promise<string> {
    this.ensureConnected();

    const result = await this.obs.call("StopRecord");
    this._recording = false;
    console.log(`[OBS] Recording stopped: ${result.outputPath}`);
    return result.outputPath;
  }

  async setOverlayText(text: string): Promise<void> {
    this.ensureConnected();

    await this.obs.call("SetInputSettings", {
      inputName: "RackUp Overlay",
      inputSettings: { text },
    });
    console.log(`[OBS] Overlay text updated`);
  }

  async getStatus(): Promise<{
    connected: boolean;
    recording: boolean;
    recordingDuration: number;
  }> {
    if (!this._connected) {
      return { connected: false, recording: false, recordingDuration: 0 };
    }

    try {
      const status = await this.obs.call("GetRecordStatus");
      return {
        connected: true,
        recording: status.outputActive,
        recordingDuration: status.outputDuration,
      };
    } catch {
      return {
        connected: this._connected,
        recording: this._recording,
        recordingDuration: 0,
      };
    }
  }

  async getScreenshot(width?: number): Promise<string> {
    this.ensureConnected();

    const result = await this.obs.call("GetSourceScreenshot", {
      sourceName: await this.getCurrentSceneName(),
      imageFormat: "jpg",
      imageWidth: width ?? 640,
      imageCompressionQuality: 60,
    });
    return result.imageData;
  }

  private async getCurrentSceneName(): Promise<string> {
    const result = await this.obs.call("GetCurrentProgramScene");
    return result.currentProgramSceneName;
  }

  // ── Auto-setup on connect ──

  private async autoSetup(): Promise<void> {
    await this.ensureVirtualCamera();
    await this.ensureBrowserSource();
  }

  private async ensureVirtualCamera(): Promise<void> {
    try {
      const status = await this.obs.call("GetVirtualCamStatus");
      if (!status.outputActive) {
        await this.obs.call("StartVirtualCam");
        console.log("[OBS] Virtual Camera started");
      } else {
        console.log("[OBS] Virtual Camera already running");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OBS] Could not start Virtual Camera: ${msg}`);
    }
  }

  private async ensureBrowserSource(): Promise<void> {
    const sourceName = "RackUp Scorebug";
    const overlayUrl = `http://localhost:${config.serverPort}/overlay`;

    try {
      const sceneName = await this.getCurrentSceneName();

      // Check if source already exists in the current scene
      const { sceneItems } = await this.obs.call("GetSceneItemList", { sceneName });
      const existing = sceneItems.find(
        (item: Record<string, unknown>) => item.sourceName === sourceName,
      );

      if (existing) {
        // Update URL in case server port changed
        try {
          await this.obs.call("SetInputSettings", {
            inputName: sourceName,
            inputSettings: { url: overlayUrl },
          });
        } catch {
          // Ignore if settings update fails
        }
        console.log(`[OBS] Browser source "${sourceName}" already exists`);
        return;
      }

      // Create the browser source
      await this.obs.call("CreateInput", {
        sceneName,
        inputName: sourceName,
        inputKind: "browser_source",
        inputSettings: {
          url: overlayUrl,
          width: 1920,
          height: 1080,
          fps: 30,
          shutdown: false,       // Keep alive when not visible
          restart_when_active: false,
          css: "",               // No custom CSS
        },
      });
      console.log(`[OBS] Created browser source "${sourceName}"`);

      // Move it to the top of the scene (renders on top of camera)
      const { sceneItems: updatedItems } = await this.obs.call("GetSceneItemList", { sceneName });
      const newItem = updatedItems.find(
        (item: Record<string, unknown>) => item.sourceName === sourceName,
      );
      if (newItem) {
        const sceneItemId = newItem.sceneItemId as number;
        // Index 0 = top of the render order in OBS
        await this.obs.call("SetSceneItemIndex", {
          sceneName,
          sceneItemId,
          sceneItemIndex: updatedItems.length - 1,
        });
        console.log(`[OBS] Moved "${sourceName}" to top of scene`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OBS] Could not setup browser source: ${msg}`);
    }
  }

  generateFilename(player1: string, player2: string, frameNumber: number): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const frame = String(frameNumber).padStart(3, "0");
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${date}_${hours}${minutes}_${sanitize(player1)}-vs-${sanitize(player2)}_Frame${frame}.mkv`;
  }

  generateDirectory(sessionDate: string): string {
    const date = new Date(sessionDate);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${config.recordingsBaseDir}/${year}/${month}`;
  }
}

export const obs = new OBSClient();
