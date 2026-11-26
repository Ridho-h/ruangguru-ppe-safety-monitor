import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const srcDir = path.join(webRoot, "node_modules", "onnxruntime-web", "dist");
const destDir = path.join(webRoot, "public", "ort");

if (!fs.existsSync(srcDir)) {
  console.log("onnxruntime-web/dist not found yet, skipping WASM copy.");
  process.exit(0);
}

const NEEDED_FILES = new Set([
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
]);

fs.mkdirSync(destDir, { recursive: true });
for (const existing of fs.readdirSync(destDir)) {
  if (!NEEDED_FILES.has(existing)) {
    fs.rmSync(path.join(destDir, existing), { force: true });
  }
}

let copied = 0;
for (const file of NEEDED_FILES) {
  const srcPath = path.join(srcDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(destDir, file));
    copied += 1;
  }
}
console.log(`Copied ${copied} essential onnxruntime-web runtime assets to public/ort/`);
