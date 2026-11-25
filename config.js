/**
 * Zentrale Konfiguration für Branding & optionale Supabase-Chat-Anbindung.
 * Alle Anpassungen hier wirken sich direkt auf die gesamte Plattform aus.
 */
export const CONFIG = {
  branding: {
    name: "OGL Hub",
    tagline: "",
    description: "Dokumente, Vorlagen und Materialien einfach herunterladen.",
    // Pfad zum Hauptlogo oben links
    logoUrl: "./assets/ogl-logo.png",
    // Haupt-Akzentfarbe (passend zum OGL-Branding)
    accentColor: "#5b21b6",
    accentHoverColor: "#4c1d95",
    footerText: "OGL Hub — OpenGameLab",
    footerProvider: {
      label: "Bereitgestellt durch das\nZentrum für didaktische Computerspielforschung",
      logoUrl: "./assets/zfdc-logo.png",
      alt: "ZfdC – Zentrum für didaktische Computerspielforschung",
    },
    footerLinks: [
      // { label: "Impressum", url: "https://example.org/impressum" },
      // { label: "Datenschutz", url: "https://example.org/datenschutz" },
    ],
  },

  // Einstellungen für die Dateiansicht
  files: {
    // Standard-Sortierung: "date-desc" | "date-asc" | "name-asc" | "size-desc"
    defaultSort: "date-desc",
    // Zeigt einen Hinweis im Header, wenn noch keine Dateien hochgeladen wurden
    emptyStateHint: "Lade Dateien in den Ordner files/ im GitHub-Repository hoch.",
  },

  // Vorbereitete Supabase-Anbindung für den späteren Chat.
  // Zum Aktivieren:
  // 1. supabase/schema.sql im Supabase SQL Editor ausführen
  // 2. url & anonKey hier eintragen und enabled auf true setzen
  supabase: {
    enabled: false,
    url: "", // z. B. "https://xyzcompany.supabase.co"
    anonKey: "", // Public Anon Key aus den Supabase Project Settings -> API
    tableName: "chat_messages",
    roomName: "general",
    chatTitle: "Team-Chat",
  },
};
