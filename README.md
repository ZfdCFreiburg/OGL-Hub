# OGL Hub

Einfache, wartungsarme Dateiaustauschplattform für **GitHub Pages** mit eigenem Branding und vorbereiteter **Supabase-Chat-Anbindung**.

## Features

- **Zero-Maintenance Hosting**: Läuft komplett statisch auf GitHub Pages – keine Server, keine Datenbank für Dateien, keine npm-Dependencies.
- **Automatischer Datei-Index**: Jede Datei im Ordner `files/` (inkl. Unterordner als Kategorien) wird per GitHub Action automatisch in `files-manifest.json` aufgenommen.
- **Vorschau & Download**: Suche, Ordner-Filter, Dateityp-Filter, Sortierung, Direktlink-Kopie sowie Browser-Vorschau für Bilder, PDFs und Textdateien.
- **Eigenes Branding**: Name, Tagline, Logo, Farben, Dark/Light-Mode und Footer-Links zentral in `config.js` konfigurierbar.
- **Chat-Vorbereitung (Supabase)**: Realtime-Chat-Modul (`js/supabase-chat.js`) + SQL-Schema (`supabase/schema.sql`) bereits eingebaut und per Flag aktivierbar.

## Einrichtung auf GitHub Pages (einmalig)

1. Änderungen auf `main` pushen.
2. Im GitHub-Repository unter **Settings → Pages → Build and deployment** als Source **GitHub Actions** auswählen.
3. Danach baut und veröffentlicht `.github/workflows/deploy.yml` die Seite automatisch bei jedem Push.

## Dateien hochladen

- Dateien einfach in `files/` (oder in Unterordner wie `files/Vorlagen/` oder `files/PDFs/`) ablegen – entweder per `git push` oder direkt im Browser über **Add file → Upload files** auf GitHub.
- Hinweis zu GitHub-Limits: Einzelne Dateien sollten unter **50 MB** bleiben (GitHub-Hard-Limit: 100 MB, Pages-Gesamtlimit: 1 GB).

## Überschrift & Workshopleitung bearbeiten (auf GitHub)

Die Inhalte der Download-Seite lassen sich direkt auf GitHub über das Stift-Symbol in [`site-config.json`](./site-config.json) anpassen:

```json
{
  "pageTitle": "Workshop Digital Independence",
  "workshopLeader": "Max Mustermann",
  "description": "Dokumente, Vorlagen und Materialien einfach herunterladen."
}
```

## Branding anpassen

Alle Texte, Farben und Logos liegen in [`config.js`](./config.js):

- `branding.name`, `branding.tagline`, `branding.description`
- `branding.logoUrl` (z. B. `./assets/logo.svg`, sonst automatisches Monogramm)
- `branding.accentColor` & `branding.accentHoverColor`
- `branding.footerText` & `branding.footerLinks`

## Chat später aktivieren (Supabase)

1. Kostenloses Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Im **SQL Editor** das Skript [`supabase/schema.sql`](./supabase/schema.sql) ausführen.
3. In [`config.js`](./config.js) unter `supabase` die Werte `url` und `anonKey` eintragen und `enabled: true` setzen.
4. Pushen – der Chat-Button erscheint automatisch im Header.

## Lokal testen

```bash
node scripts/generate-manifest.mjs
python3 -m http.server 8080
```

Danach im Browser `http://localhost:8080` öffnen.
