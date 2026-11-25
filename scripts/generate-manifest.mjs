import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const FILES_DIR = path.join(ROOT, "files");
const OUTPUT_FILE = path.join(ROOT, "files-manifest.json");

function getGitModifiedIso(filePath) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", filePath], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function scanDirectory(dir, baseRelative = "") {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = baseRelative ? `${baseRelative}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath, relPath));
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      const ext = path.extname(entry.name).replace(/^\./, "").toLowerCase();
      const folder = baseRelative || "Allgemein";
      const gitDate = getGitModifiedIso(path.join("files", relPath));

      results.push({
        name: entry.name,
        folder,
        ext,
        size: stat.size,
        modifiedAt: gitDate || stat.mtime.toISOString(),
        url: `./files/${relPath.split(path.sep).join("/")}`,
      });
    }
  }

  return results;
}

const files = scanDirectory(FILES_DIR);
const manifest = {
  generatedAt: new Date().toISOString(),
  count: files.length,
  files,
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Manifest erstellt: ${files.length} Datei(en) -> ${path.basename(OUTPUT_FILE)}`);
