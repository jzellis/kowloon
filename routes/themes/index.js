// routes/themes/index.js
// Theme management — list/get are public; create/update/delete require admin.
// Built-in themes (isBuiltIn: true) cannot be deleted or have isBuiltIn toggled off.
// Bootstraps the three built-in themes on first startup if they don't exist.

import express from "express";
import route from "../utils/route.js";
import { Theme, Settings } from "#schema";
import isServerAdmin from "#methods/auth/isServerAdmin.js";
import { getSetting } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

// ── Built-in theme data ────────────────────────────────────────────────────────

const BUILT_IN_THEMES = [
  {
    id: "system",
    name: "System",
    description: "Follows your OS light/dark preference automatically.",
    author: "system",
    colorScheme: "system",
    isBuiltIn: true,
    colors: null,
    postColors: null,
  },
  {
    id: "kowloon-light",
    name: "Kowloon Light",
    description: "Warm cream paper tones. Blue Note Records by daylight.",
    author: "system",
    colorScheme: "light",
    isBuiltIn: true,
    colors: {
      "base-100": "oklch(96% 0.018 85deg)",
      "base-200": "oklch(91% 0.022 85deg)",
      "base-300": "oklch(84% 0.028 85deg)",
      "base-content": "oklch(13% 0.008 265deg)",
      "primary": "oklch(63% 0.1 228deg)",
      "primary-content": "oklch(97% 0.005 228deg)",
      "secondary": "oklch(42% 0.13 265deg)",
      "secondary-content": "oklch(96% 0.018 85deg)",
      "accent": "oklch(55% 0.22 25deg)",
      "accent-content": "oklch(97% 0.005 25deg)",
      "neutral": "oklch(18% 0.008 265deg)",
      "neutral-content": "oklch(92% 0.01 85deg)",
      "info": "oklch(60% 0.15 230deg)",
      "info-content": "oklch(97% 0.005 230deg)",
      "success": "oklch(62% 0.17 145deg)",
      "success-content": "oklch(97% 0.005 145deg)",
      "warning": "oklch(78% 0.19 88deg)",
      "warning-content": "oklch(13% 0.008 265deg)",
      "error": "oklch(55% 0.22 25deg)",
      "error-content": "oklch(97% 0.005 25deg)",
    },
    postColors: {
      note: "#b76c00",
      article: "#006893",
      media: "#009084",
      link: "#417843",
      event: "#cc272e",
    },
  },
  {
    id: "kowloon-dark",
    name: "Kowloon Dark",
    description: "Dark navy-charcoal. Blue Note Records by night.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: true,
    colors: {
      "base-100": "oklch(12% 0.02 265deg)",
      "base-200": "oklch(17% 0.02 265deg)",
      "base-300": "oklch(24% 0.02 265deg)",
      "base-content": "oklch(90% 0.018 85deg)",
      "primary": "oklch(63% 0.1 228deg)",
      "primary-content": "oklch(97% 0.005 228deg)",
      "secondary": "oklch(28% 0.14 265deg)",
      "secondary-content": "oklch(90% 0.018 85deg)",
      "accent": "oklch(55% 0.22 25deg)",
      "accent-content": "oklch(97% 0.005 25deg)",
      "neutral": "oklch(20% 0.012 265deg)",
      "neutral-content": "oklch(90% 0.018 85deg)",
      "info": "oklch(60% 0.15 230deg)",
      "info-content": "oklch(97% 0.005 230deg)",
      "success": "oklch(62% 0.17 145deg)",
      "success-content": "oklch(97% 0.005 145deg)",
      "warning": "oklch(78% 0.19 88deg)",
      "warning-content": "oklch(13% 0.008 265deg)",
      "error": "oklch(55% 0.22 25deg)",
      "error-content": "oklch(97% 0.005 25deg)",
    },
    postColors: {
      note: "#e8920a",
      article: "#2ab4e8",
      media: "#00c4ae",
      link: "#62c278",
      event: "#ee5566",
    },
  },

  // ── Solarized ──────────────────────────────────────────────────────────────
  // Palette by Ethan Schoonover (2011). Canonical hex values.
  // Base03 #002b36 · Base02 #073642 · Base01 #586e75 · Base00 #657b83
  // Base0  #839496 · Base1  #93a1a1 · Base2  #eee8d5 · Base3  #fdf6e3
  // Yellow #b58900 · Orange #cb4b16 · Red #dc322f · Magenta #d33682
  // Violet #6c71c4 · Blue #268bd2 · Cyan #2aa198 · Green #859900

  {
    id: "solarized-light",
    name: "Solarized Light",
    description: "Ethan Schoonover's precision-contrast palette — warm parchment tones.",
    author: "system",
    colorScheme: "light",
    isBuiltIn: false,
    colors: {
      "base-100": "#fdf6e3",
      "base-200": "#eee8d5",
      "base-300": "#93a1a1",
      "base-content": "#657b83",
      "primary": "#268bd2",
      "primary-content": "#fdf6e3",
      "secondary": "#073642",
      "secondary-content": "#eee8d5",
      "accent": "#cb4b16",
      "accent-content": "#fdf6e3",
      "neutral": "#002b36",
      "neutral-content": "#eee8d5",
      "info": "#2aa198",
      "info-content": "#fdf6e3",
      "success": "#859900",
      "success-content": "#fdf6e3",
      "warning": "#b58900",
      "warning-content": "#002b36",
      "error": "#dc322f",
      "error-content": "#fdf6e3",
    },
    postColors: {
      note: "#b58900",
      article: "#268bd2",
      media: "#2aa198",
      link: "#859900",
      event: "#dc322f",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    description: "Ethan Schoonover's precision-contrast palette — deep teal shadows.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: false,
    colors: {
      "base-100": "#002b36",
      "base-200": "#073642",
      "base-300": "#586e75",
      "base-content": "#839496",
      "primary": "#268bd2",
      "primary-content": "#fdf6e3",
      "secondary": "#073642",
      "secondary-content": "#93a1a1",
      "accent": "#b58900",
      "accent-content": "#002b36",
      "neutral": "#073642",
      "neutral-content": "#839496",
      "info": "#2aa198",
      "info-content": "#002b36",
      "success": "#859900",
      "success-content": "#fdf6e3",
      "warning": "#b58900",
      "warning-content": "#002b36",
      "error": "#dc322f",
      "error-content": "#fdf6e3",
    },
    postColors: {
      note: "#b58900",
      article: "#268bd2",
      media: "#2aa198",
      link: "#859900",
      event: "#dc322f",
    },
  },

  // ── High Contrast ──────────────────────────────────────────────────────────
  // Designed for WCAG AAA (7:1 contrast ratio minimum).
  // Also useful for bright outdoor environments — pure bases, saturated accents.

  {
    id: "hc-light",
    name: "High Contrast Light",
    description: "Pure white base, deep saturated accents. WCAG AAA compliant.",
    author: "system",
    colorScheme: "light",
    isBuiltIn: false,
    colors: {
      "base-100": "#ffffff",
      "base-200": "#f2f2f2",
      "base-300": "#cccccc",
      "base-content": "#000000",
      "primary": "#0057e7",
      "primary-content": "#ffffff",
      "secondary": "#002b6b",
      "secondary-content": "#ffffff",
      "accent": "#d62000",
      "accent-content": "#ffffff",
      "neutral": "#111111",
      "neutral-content": "#ffffff",
      "info": "#0050c8",
      "info-content": "#ffffff",
      "success": "#006400",
      "success-content": "#ffffff",
      "warning": "#7c5100",
      "warning-content": "#ffffff",
      "error": "#cc0000",
      "error-content": "#ffffff",
    },
    postColors: {
      note: "#7c5100",
      article: "#0050c8",
      media: "#006400",
      link: "#004d00",
      event: "#cc0000",
    },
  },
  {
    id: "hc-dark",
    name: "High Contrast Dark",
    description: "Pure black base, bright yellow-gold accents. Maximum legibility in any light.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: false,
    colors: {
      "base-100": "#000000",
      "base-200": "#0f0f0f",
      "base-300": "#1f1f1f",
      "base-content": "#ffffff",
      "primary": "#ffd700",
      "primary-content": "#000000",
      "secondary": "#141414",
      "secondary-content": "#ffffff",
      "accent": "#ff5500",
      "accent-content": "#000000",
      "neutral": "#111111",
      "neutral-content": "#ffffff",
      "info": "#55aaff",
      "info-content": "#000000",
      "success": "#44dd44",
      "success-content": "#000000",
      "warning": "#ffaa00",
      "warning-content": "#000000",
      "error": "#ff4444",
      "error-content": "#000000",
    },
    postColors: {
      note: "#ffd700",
      article: "#55aaff",
      media: "#44ddcc",
      link: "#88ee44",
      event: "#ff4444",
    },
  },

  // ── Dracula ────────────────────────────────────────────────────────────────
  // By Zeno Rocha. The most-ported dark theme in existence.
  // bg #282a36 · selection #44475a · fg #f8f8f2 · comment #6272a4
  // cyan #8be9fd · green #50fa7b · orange #ffb86c · pink #ff79c6
  // purple #bd93f9 · red #ff5555 · yellow #f1fa8c

  {
    id: "dracula",
    name: "Dracula",
    description: "Deep charcoal with purple and pink neons. The most-ported dark theme ever made.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: false,
    colors: {
      "base-100": "#282a36",
      "base-200": "#21222c",
      "base-300": "#44475a",
      "base-content": "#f8f8f2",
      "primary": "#bd93f9",
      "primary-content": "#282a36",
      "secondary": "#44475a",
      "secondary-content": "#f8f8f2",
      "accent": "#ff79c6",
      "accent-content": "#282a36",
      "neutral": "#21222c",
      "neutral-content": "#f8f8f2",
      "info": "#8be9fd",
      "info-content": "#282a36",
      "success": "#50fa7b",
      "success-content": "#282a36",
      "warning": "#ffb86c",
      "warning-content": "#282a36",
      "error": "#ff5555",
      "error-content": "#f8f8f2",
    },
    postColors: {
      note: "#ffb86c",
      article: "#8be9fd",
      media: "#50fa7b",
      link: "#f1fa8c",
      event: "#ff5555",
    },
  },

  // ── Nord ───────────────────────────────────────────────────────────────────
  // By Arctic Ice Studio. Arctic, bluish palette — beloved in the Linux ricing community.
  // Polar Night: #2e3440 #3b4252 #434c5e #4c566a
  // Snow Storm:  #d8dee9 #e5e9f0 #eceff4
  // Frost:       #8fbcbb #88c0d0 #81a1c1 #5e81ac
  // Aurora:      #bf616a #d08770 #ebcb8b #a3be8c #b48ead

  {
    id: "nord",
    name: "Nord",
    description: "Arctic, bluish tones inspired by the polar night. Hugely popular in the Linux community.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: false,
    colors: {
      "base-100": "#2e3440",
      "base-200": "#3b4252",
      "base-300": "#434c5e",
      "base-content": "#eceff4",
      "primary": "#88c0d0",
      "primary-content": "#2e3440",
      "secondary": "#3b4252",
      "secondary-content": "#eceff4",
      "accent": "#81a1c1",
      "accent-content": "#2e3440",
      "neutral": "#2e3440",
      "neutral-content": "#eceff4",
      "info": "#88c0d0",
      "info-content": "#2e3440",
      "success": "#a3be8c",
      "success-content": "#2e3440",
      "warning": "#ebcb8b",
      "warning-content": "#2e3440",
      "error": "#bf616a",
      "error-content": "#eceff4",
    },
    postColors: {
      note: "#ebcb8b",
      article: "#88c0d0",
      media: "#a3be8c",
      link: "#8fbcbb",
      event: "#bf616a",
    },
  },

  // ── Gruvbox Dark ───────────────────────────────────────────────────────────
  // By Pavel Pertsev. Retro groove — warm earth tones, the Vim community's classic.
  // bg #282828 · bg1 #3c3836 · bg2 #504945 · fg #ebdbb2
  // red #cc241d · green #98971a · yellow #d79921 · blue #458588
  // purple #b16286 · aqua #689d6a · orange #d65d0e

  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    description: "Retro warm earth tones — the Vim community's most beloved palette.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: false,
    colors: {
      "base-100": "#282828",
      "base-200": "#3c3836",
      "base-300": "#504945",
      "base-content": "#ebdbb2",
      "primary": "#d79921",
      "primary-content": "#282828",
      "secondary": "#3c3836",
      "secondary-content": "#ebdbb2",
      "accent": "#d65d0e",
      "accent-content": "#282828",
      "neutral": "#1d2021",
      "neutral-content": "#ebdbb2",
      "info": "#458588",
      "info-content": "#ebdbb2",
      "success": "#98971a",
      "success-content": "#ebdbb2",
      "warning": "#d79921",
      "warning-content": "#282828",
      "error": "#cc241d",
      "error-content": "#ebdbb2",
    },
    postColors: {
      note: "#d79921",
      article: "#83a598",
      media: "#8ec07c",
      link: "#98971a",
      event: "#fb4934",
    },
  },

  // ── Monokai ────────────────────────────────────────────────────────────────
  // By Wimer Hazenberg. The defining theme of the Sublime Text era.
  // bg #272822 · fg #f8f8f2 · comment #75715e
  // red #f92672 · orange #fd971f · yellow #e6db74
  // green #a6e22e · blue #66d9e8 · purple #ae81ff

  {
    id: "monokai",
    name: "Monokai",
    description: "The defining theme of the Sublime Text era. Dark olive with vivid accent colors.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: false,
    colors: {
      "base-100": "#272822",
      "base-200": "#3e3d32",
      "base-300": "#75715e",
      "base-content": "#f8f8f2",
      "primary": "#a6e22e",
      "primary-content": "#272822",
      "secondary": "#3e3d32",
      "secondary-content": "#f8f8f2",
      "accent": "#f92672",
      "accent-content": "#f8f8f2",
      "neutral": "#1e1f1c",
      "neutral-content": "#f8f8f2",
      "info": "#66d9e8",
      "info-content": "#272822",
      "success": "#a6e22e",
      "success-content": "#272822",
      "warning": "#fd971f",
      "warning-content": "#272822",
      "error": "#f92672",
      "error-content": "#f8f8f2",
    },
    postColors: {
      note: "#fd971f",
      article: "#66d9e8",
      media: "#a6e22e",
      link: "#e6db74",
      event: "#f92672",
    },
  },

  // ── Catppuccin Mocha ───────────────────────────────────────────────────────
  // By the Catppuccin community. Currently the most popular modern theme.
  // base #1e1e2e · mantle #181825 · crust #11111b · surface0 #313244
  // text #cdd6f4 · mauve #cba6f7 · pink #f38ba8 · peach #fab387
  // green #a6e3a1 · teal #94e2d5 · blue #89b4fa · yellow #f9e2af

  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    description: "Soft pastel palette on a deep purple-black base. Currently the most-starred theme on GitHub.",
    author: "system",
    colorScheme: "dark",
    isBuiltIn: false,
    colors: {
      "base-100": "#1e1e2e",
      "base-200": "#181825",
      "base-300": "#313244",
      "base-content": "#cdd6f4",
      "primary": "#cba6f7",
      "primary-content": "#1e1e2e",
      "secondary": "#181825",
      "secondary-content": "#cdd6f4",
      "accent": "#f38ba8",
      "accent-content": "#1e1e2e",
      "neutral": "#11111b",
      "neutral-content": "#cdd6f4",
      "info": "#89b4fa",
      "info-content": "#1e1e2e",
      "success": "#a6e3a1",
      "success-content": "#1e1e2e",
      "warning": "#fab387",
      "warning-content": "#1e1e2e",
      "error": "#f38ba8",
      "error-content": "#1e1e2e",
    },
    postColors: {
      note: "#fab387",
      article: "#89b4fa",
      media: "#94e2d5",
      link: "#a6e3a1",
      event: "#f38ba8",
    },
  },

  // ── Catppuccin Latte ───────────────────────────────────────────────────────
  // The light variant of Catppuccin. Warm off-white with lavender accents.
  // base #eff1f5 · mantle #e6e9ef · crust #dce0e8
  // text #4c4f69 · mauve #8839ef · pink #ea76cb · peach #fe640b
  // green #40a02b · teal #179299 · blue #1e66f5 · yellow #df8e1d

  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    description: "Warm off-white with lavender accents. One of the few light themes that actually works.",
    author: "system",
    colorScheme: "light",
    isBuiltIn: false,
    colors: {
      "base-100": "#eff1f5",
      "base-200": "#e6e9ef",
      "base-300": "#ccd0da",
      "base-content": "#4c4f69",
      "primary": "#8839ef",
      "primary-content": "#eff1f5",
      "secondary": "#dce0e8",
      "secondary-content": "#4c4f69",
      "accent": "#ea76cb",
      "accent-content": "#eff1f5",
      "neutral": "#dce0e8",
      "neutral-content": "#4c4f69",
      "info": "#1e66f5",
      "info-content": "#eff1f5",
      "success": "#40a02b",
      "success-content": "#eff1f5",
      "warning": "#df8e1d",
      "warning-content": "#eff1f5",
      "error": "#d20f39",
      "error-content": "#eff1f5",
    },
    postColors: {
      note: "#df8e1d",
      article: "#1e66f5",
      media: "#179299",
      link: "#40a02b",
      event: "#d20f39",
    },
  },
];

// Seed built-in themes once on startup
async function seedBuiltInThemes() {
  try {
    for (const themeData of BUILT_IN_THEMES) {
      await Theme.updateOne(
        { id: themeData.id },
        { $setOnInsert: themeData },
        { upsert: true }
      );
    }
    // Ensure a defaultTheme setting exists
    await Settings.updateOne(
      { name: "defaultTheme" },
      {
        $setOnInsert: {
          name: "defaultTheme",
          value: "system",
          summary: "The default theme for the server. Users can override this in their profile.",
          to: "@public",
          canEdit: "@admin",
          ui: {
            type: "select",
            label: "Default Theme",
            group: "appearance",
            order: 10,
          },
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("themes: seed error:", err.message);
  }
}

// Run seed at module load (non-blocking)
seedBuiltInThemes().then(() => console.log("themes: built-in themes seeded"));

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitize(doc) {
  const t = doc.toObject ? doc.toObject() : doc;
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    author: t.author,
    version: t.version,
    colorScheme: t.colorScheme,
    isBuiltIn: t.isBuiltIn ?? false,
    colors: t.colors ?? null,
    postColors: t.postColors ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// ── GET /themes ───────────────────────────────────────────────────────────────

router.get(
  "/",
  route(async ({ set }) => {
    const [themes, defaultSetting] = await Promise.all([
      Theme.find().sort({ isBuiltIn: -1, createdAt: 1 }).lean(),
      Settings.findOne({ name: "defaultTheme" }).lean(),
    ]);
    set("themes", themes.map(sanitize));
    set("defaultThemeId", defaultSetting?.value ?? "system");
  })
);

// ── GET /themes/:id ───────────────────────────────────────────────────────────

router.get(
  "/:id",
  route(async ({ params, set, setStatus }) => {
    const theme = await Theme.findOne({ id: params.id }).lean();
    if (!theme) {
      setStatus(404);
      set("error", "Theme not found");
      return;
    }
    set("theme", sanitize(theme));
  })
);

// ── POST /themes — create (admin only) ───────────────────────────────────────

router.post(
  "/",
  route(async ({ body, user, set, setStatus }) => {
    if (!user?.id) { setStatus(401); set("error", "Authentication required"); return; }
    if (!(await isServerAdmin(user.id))) { setStatus(403); set("error", "Admin only"); return; }

    const { id, name, description, colorScheme, colors, postColors } = body;
    if (!id || !name || !colorScheme) {
      setStatus(400);
      set("error", "id, name, and colorScheme are required");
      return;
    }
    if (await Theme.exists({ id })) {
      setStatus(409);
      set("error", "A theme with that id already exists");
      return;
    }

    const theme = await Theme.create({
      id,
      name,
      description: description ?? "",
      author: user.id,
      colorScheme,
      isBuiltIn: false,
      colors: colors ?? null,
      postColors: postColors ?? null,
    });

    setStatus(201);
    set("theme", sanitize(theme));
  })
);

// ── PUT /themes/:id — update (admin only, not isBuiltIn) ─────────────────────

router.put(
  "/:id",
  route(async ({ params, body, user, set, setStatus }) => {
    if (!user?.id) { setStatus(401); set("error", "Authentication required"); return; }
    if (!(await isServerAdmin(user.id))) { setStatus(403); set("error", "Admin only"); return; }

    const theme = await Theme.findOne({ id: params.id });
    if (!theme) { setStatus(404); set("error", "Theme not found"); return; }
    if (theme.isBuiltIn) { setStatus(403); set("error", "Built-in themes cannot be modified"); return; }

    const allowed = ["name", "description", "colorScheme", "colors", "postColors"];
    for (const key of allowed) {
      if (body[key] !== undefined) theme[key] = body[key];
    }
    await theme.save();
    set("theme", sanitize(theme));
  })
);

// ── DELETE /themes/:id — delete (admin only, not isBuiltIn) ──────────────────

router.delete(
  "/:id",
  route(async ({ params, user, set, setStatus }) => {
    if (!user?.id) { setStatus(401); set("error", "Authentication required"); return; }
    if (!(await isServerAdmin(user.id))) { setStatus(403); set("error", "Admin only"); return; }

    const theme = await Theme.findOne({ id: params.id });
    if (!theme) { setStatus(404); set("error", "Theme not found"); return; }
    if (theme.isBuiltIn) { setStatus(403); set("error", "Built-in themes cannot be deleted"); return; }

    await Theme.deleteOne({ id: params.id });
    set("ok", true);
  })
);

// ── PATCH /themes/default — set server default (admin only) ──────────────────

router.patch(
  "/default",
  route(async ({ body, user, set, setStatus }) => {
    if (!user?.id) { setStatus(401); set("error", "Authentication required"); return; }
    if (!(await isServerAdmin(user.id))) { setStatus(403); set("error", "Admin only"); return; }

    const { themeId } = body;
    if (!themeId) { setStatus(400); set("error", "themeId is required"); return; }
    if (!(await Theme.exists({ id: themeId }))) {
      setStatus(404);
      set("error", "Theme not found");
      return;
    }

    await Settings.updateOne(
      { name: "defaultTheme" },
      { $set: { value: themeId } },
      { upsert: true }
    );
    set("defaultThemeId", themeId);
  })
);

export default router;
