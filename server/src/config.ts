import path from "path";
import os from "os";

export const config = {
  obs: {
    host: process.env.OBS_HOST ?? "localhost",
    port: Number(process.env.OBS_PORT ?? 4455),
    password: process.env.OBS_PASSWORD ?? "",
  },
  recordingsBaseDir:
    process.env.RECORDINGS_BASE_DIR ??
    path.join(os.homedir(), "rackup", "recordings"),
  serverPort: Number(process.env.SERVER_PORT ?? 4010),
};
