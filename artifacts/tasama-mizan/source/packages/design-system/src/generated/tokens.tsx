/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F5F7FC",
      "foreground": "#0A1033",
      "border": "#D6DCEE",
      "card": "#FFFFFF",
      "cardForeground": "#0A1033",
      "popover": "#EFF2FA",
      "popoverForeground": "#0A1033",
      "primary": "#10069F",
      "primaryForeground": "#FFFFFF",
      "secondary": "#342BAD",
      "secondaryForeground": "#FFFFFF",
      "muted": "#EFF2FA",
      "mutedForeground": "#4B5478",
      "accent": "#806722",
      "accentForeground": "#FFFFFF",
      "destructive": "#B91C1C",
      "destructiveForeground": "#FFFFFF",
      "input": "#D6DCEE",
      "ring": "#10069F",
      "chart1": "#636ED4",
      "chart2": "#987423",
      "chart3": "#49A763",
      "chart4": "#874BA2",
      "chart5": "#B04921",
      "sidebar": "#FFFFFF",
      "sidebarForeground": "#0A1033",
      "sidebarBorder": "#D6DCEE",
      "sidebarPrimary": "#10069F",
      "sidebarPrimaryForeground": "#FFFFFF",
      "sidebarAccent": "#EFF2FA",
      "sidebarAccentForeground": "#0A1033",
      "sidebarRing": "#10069F"
    },
    "dark": {
      "background": "#060B26",
      "foreground": "#E9EDFB",
      "border": "#27306B",
      "card": "#101744",
      "cardForeground": "#E9EDFB",
      "popover": "#16205A",
      "popoverForeground": "#E9EDFB",
      "primary": "#8B82F5",
      "primaryForeground": "#060B26",
      "secondary": "#6F63E6",
      "secondaryForeground": "#FFFFFF",
      "muted": "#16205A",
      "mutedForeground": "#99A4D4",
      "accent": "#D9C084",
      "accentForeground": "#1A1305",
      "destructive": "#F87171",
      "destructiveForeground": "#060B26",
      "input": "#27306B",
      "ring": "#8B82F5",
      "chart1": "#7D8AE0",
      "chart2": "#B98D1C",
      "chart3": "#1FAE76",
      "chart4": "#9A66CB",
      "chart5": "#DB6134",
      "sidebar": "#101744",
      "sidebarForeground": "#E9EDFB",
      "sidebarBorder": "#27306B",
      "sidebarPrimary": "#8B82F5",
      "sidebarPrimaryForeground": "#060B26",
      "sidebarAccent": "#16205A",
      "sidebarAccentForeground": "#E9EDFB",
      "sidebarRing": "#8B82F5"
    }
  },
  "fontFamily": {
    "sans": [
      "Inter",
      "system-ui",
      "-apple-system",
      "sans-serif"
    ],
    "serif": [
      "Comfortaa",
      "Inter",
      "system-ui",
      "sans-serif"
    ],
    "mono": [
      "ui-monospace",
      "SFMono-Regular",
      "Menlo",
      "monospace"
    ],
    "wordmark": [
      "Comfortaa",
      "system-ui",
      "sans-serif"
    ]
  },
  "radius": "0.625rem",
  "spacing": "0.25rem",
  "brand": {
    "gradient": [
      "#10069F",
      "#342BAD",
      "#8B82F5",
      "#D9C084"
    ],
    "status": {
      "light": {
        "success": "#15803D",
        "warn": "#B45309",
        "danger": "#B91C1C"
      },
      "dark": {
        "success": "#4ADE80",
        "warn": "#FBBF24",
        "danger": "#F87171"
      }
    },
    "backdrop": {
      "light": {
        "deep": "#E7EBF7",
        "mid": "#F5F7FC",
        "hi": "#FFFFFF"
      },
      "dark": {
        "deep": "#04081F",
        "mid": "#060B26",
        "hi": "#101744"
      }
    },
    "hero": {
      "background": "#07105F",
      "foreground": "#E9EDFB",
      "card": "#0E1A78",
      "cardForeground": "#E9EDFB",
      "border": "#2C3A9E",
      "mutedForeground": "#A3AEE0",
      "primary": "#D9C084",
      "primaryForeground": "#07105F"
    }
  }
} as const;

export type Tokens = typeof tokens;
export default tokens;
