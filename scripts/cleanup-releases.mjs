/**
 * Löscht GitHub-Release-Assets in `hub-*` Releases, die älter als 24 Stunden sind.
 * Wird stündlich über .github/workflows/cleanup-old-files.yml ausgeführt.
 */
const token = process.env.GITHUB_TOKEN;
const repoFull = process.env.GITHUB_REPOSITORY; // z. B. "ZfdCFreiburg/OGL-Hub"
const maxAgeHours = Number(process.env.MAX_AGE_HOURS || 24);

if (!token || !repoFull) {
  console.error("GITHUB_TOKEN oder GITHUB_REPOSITORY fehlt.");
  process.exit(1);
}

const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

const relRes = await fetch(`https://api.github.com/repos/${repoFull}/releases?per_page=100`, { headers });
if (!relRes.ok) {
  throw new Error(`Releases konnten nicht geladen werden: HTTP ${relRes.status}`);
}

const releases = await relRes.json();
let deletedCount = 0;

for (const rel of releases) {
  if (!String(rel.tag_name || "").startsWith("hub-")) continue;

  for (const asset of rel.assets || []) {
    const ts = new Date(asset.updated_at || asset.created_at).getTime();
    if (ts < cutoffMs) {
      const delRes = await fetch(
        `https://api.github.com/repos/${repoFull}/releases/assets/${asset.id}`,
        { method: "DELETE", headers }
      );
      if (delRes.ok) {
        console.log(`Gelöscht (> ${maxAgeHours}h): ${rel.name}/${asset.name}`);
        deletedCount += 1;
      } else {
        console.warn(`Fehler beim Löschen von ${asset.name}: HTTP ${delRes.status}`);
      }
    }
  }
}

console.log(`Cleanup fertig: ${deletedCount} Datei(en) entfernt.`);
