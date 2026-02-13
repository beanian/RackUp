import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  obs: {
    host: process.env.OBS_HOST ?? "localhost",
    port: Number(process.env.OBS_PORT ?? 4455),
    password: process.env.OBS_PASSWORD ?? "",
  },
  recordingsBaseDir:
    process.env.RECORDINGS_BASE_DIR ??
    path.join(os.homedir(), "Videos"),
  serverPort: Number(process.env.SERVER_PORT ?? 4077),
  repoDir: path.resolve(__dirname, "../.."),
};
