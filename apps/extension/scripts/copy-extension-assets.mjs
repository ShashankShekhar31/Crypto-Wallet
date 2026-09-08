import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceRoot = path.join(__dirname, "..");
const destinationRoot = path.join(__dirname, "..", "dist");

await mkdir(destinationRoot, { recursive: true });

await copyFile(path.join(sourceRoot, "manifest.json"), path.join(destinationRoot, "manifest.json"));

const popupDirectory = path.join(destinationRoot, "popup");

await mkdir(popupDirectory, { recursive: true });

await copyFile(
  path.join(sourceRoot, "src", "popup", "index.html"),
  path.join(popupDirectory, "index.html"),
);
