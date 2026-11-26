/**
 * Zentrale Konfiguration für Branding & optionale Supabase-Chat-Anbindung.
 * Alle Anpassungen hier wirken sich direkt auf die gesamte Plattform aus.
 */
export const CONFIG = {
  branding: {
    name: "Hub",
    tagline: "",
    description: "Dokumente, Vorlagen und Materialien einfach herunterladen.",
    // Pfad zum Hauptlogo oben links
    logoUrl: "./assets/ogl-logo.png",
    // Haupt-Akzentfarbe (passend zum OGL-Branding)
    accentColor: "#5b21b6",
    accentHoverColor: "#4c1d95",
    footerText: "OGL Hub — OpenGameLab",
    footerProvider: {
      label: "Bereitgestellt durch\nZentrum für didaktische Computerspielforschung",
      logoUrl: "./assets/zfdc-logo.jpg",
      alt: "ZfdC – Zentrum für didaktische Computerspielforschung",
      url: "https://zfdc.ph-freiburg.de",
    },
    footerLinks: [
      { label: "Spieledatenbank", url: "https://zfdc.ph-freiburg.de/spieledatenbank/" },
    ],
  },

  // Einstellungen für die Dateiansicht
  files: {
    // Standard-Sortierung: "date-desc" | "date-asc" | "name-asc" | "size-desc"
    defaultSort: "date-desc",
    // Zeigt einen Hinweis im Header, wenn noch keine Dateien hochgeladen wurden
    emptyStateHint: "Lade Dateien in den Ordner files/ im GitHub-Repository hoch.",
  },

  // Einstellungen für die Admin-Upload-Seite (admin.html)
  admin: {
    owner: "ZfdCFreiburg",
    repo: "OGL-Hub",
    branch: "main",
    // Name der Supabase Edge Function (supabase/functions/github-admin/index.ts)
    supabaseFunctionName: "github-admin",
    // Optional: Nur diese E-Mail-Adressen dürfen sich per Supabase auf admin.html anmelden (leer = alle im Projekt angelegten User)
    allowedEmails: ["zfdc@janboelmann.de"],
    // Fallback bei direkter Token-Anmeldung: Nur diese GitHub-Benutzernamen sind erlaubt
    allowedUsers: ["ZfdCFreiburg"],
  },

  // Vorbereitete Supabase-Anbindung für den späteren Chat.
  // Zum Aktivieren:
  // 1. supabase/schema.sql im Supabase SQL Editor ausführen
  // 2. url & anonKey hier eintragen und enabled auf true setzen
  supabase: {
    enabled: true,
    url: "https://dsrfurrrhhowgenovoxi.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzcmZ1cnJyaGhvd2dlbm92b3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2Mzk0NTgsImV4cCI6MjExMTIxNTQ1OH0.g3N1JGAB2xdmWasNZqmfb2A3KUADTKkI6qFH_0AfVDw",
    tableName: "chat_messages",
    roomName: "general",
    chatTitle: "OGL Chat",
  },
};
