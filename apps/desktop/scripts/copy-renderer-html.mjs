import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const source = path.join(__dirname, "..", "src", "renderer", "index.html");

const destinationDirectory = path.join(__dirname, "..", "dist", "renderer");

const destination = path.join(destinationDirectory, "index.html");

await mkdir(destinationDirectory, { recursive: true });
await copyFile(source, destination);
