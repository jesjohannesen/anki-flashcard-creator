# Anki Flashcard Creator

Chrome extension. Highlight text on any web page → right-click "Create Anki flashcard" (or press the shortcut, or click the floating "+" button) → review an AI-suggested Front/Back with a deck picker → Save. Cards land in your Anki desktop install and sync to mobile via AnkiWeb.

## Features

- Highlight → right-click → AI suggests question + answer
- Keyboard shortcut: ⌘⇧A (Mac) / Ctrl+Shift+A (Win/Linux)
- Optional floating "+" button when text is selected
- AI picks the best-fitting deck from your existing decks
- Profile switching for multi-profile Anki users (per-profile last-deck memory)
- Two AI providers: Gemini API (cloud) or Chrome Built-in (local, free, unlimited)
- Source URL is appended to every card's back

## First-time setup

The extension opens a guided welcome page on first install that walks through these steps. The summary:

1. **Install AnkiConnect** in Anki desktop: Tools → Add-ons → Get Add-ons → paste `2055492159` → restart Anki.
2. **Click "Connect to Anki"** on the welcome page. A popup appears inside Anki — click Yes to allow the extension. (This is the same as adding the extension origin to AnkiConnect's `webCorsOriginList` manually.)
3. **Pick an AI provider**:
   - **Gemini API**: paste a free API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
   - **Chrome Built-in**: enable both `chrome://flags/#prompt-api-for-gemini-nano` and `chrome://flags/#optimization-guide-on-device-model`, restart Chrome. First generation will download Gemini Nano (~2GB).
4. Done.

## Daily use

Keep Anki desktop open. Highlight a passage on any page, then trigger the panel via right-click, ⌘⇧A / Ctrl+Shift+A, or the floating "+" button. Edit if needed, click Save.

## Privacy

The extension only reads text you actively highlight when you trigger card creation. It does not track browsing or contact any server outside your chosen AI provider and your local Anki client. See [PRIVACY.md](PRIVACY.md).

## Development

```
manifest.json      # MV3 manifest
background.js      # Service worker — context menu, commands, Gemini/Built-in calls, AnkiConnect calls
content.js         # Content script — floating button, in-page panel UI
welcome.html/.js   # First-run setup page
options.html/.js   # Settings page
icons/             # 16/32/48/128 PNG icons
store-assets/      # Web Store listing prep + promo tile + icon generator
PRIVACY.md         # Privacy policy
```

To work on it locally: clone, then `chrome://extensions` → Developer mode → "Load unpacked" → pick this folder.

## Publishing

See [`store-assets/STORE_LISTING.md`](store-assets/STORE_LISTING.md) for the full Chrome Web Store submission checklist, listing copy, permission justifications, and zip instructions.

## Troubleshooting

- **"Anki not reachable"** — Anki desktop isn't open, AnkiConnect isn't installed, or step 2 of setup hasn't been completed. Re-open the welcome page (Options → "Re-run welcome") and click "Connect to Anki".
- **"Gemini API error 429"** — you've hit the free-tier daily quota. Wait for reset, or switch to Chrome Built-in in Options.
- **"Built-in AI session failed"** — Gemini Nano is still downloading. Wait a few minutes and try again, or check `chrome://components` for "Optimization Guide On Device Model".
- **Menu item missing** — only appears when text is selected. Doesn't work on `chrome://` pages, the Web Store, or PDFs in the built-in viewer.
