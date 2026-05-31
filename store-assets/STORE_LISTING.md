# Chrome Web Store listing — Anki Flashcard Creator

Copy-paste these fields into the [Web Store Developer Console](https://chrome.google.com/webstore/devconsole) when you submit. Items marked **(asset)** are PNG files in this folder.

---

## Basic info

**Name** (≤45 chars)
> Anki Flashcard Creator

**Summary** (≤132 chars)
> Highlight any text and create an AI-suggested Anki flashcard in one click. Saves to your Anki desktop deck.

**Category**
> Productivity

**Language**
> English (United States)

---

## Description (long, ≤16,000 chars)

```
Turn what you read into what you remember.

Anki Flashcard Creator lets you highlight text on any web page — a Substack post, a news article, a Wikipedia entry, a documentation page — and instantly create a high-quality Anki flashcard from it. An AI proposes the question and answer; you can edit it; one click and it lands in your Anki deck.

WHY YOU'LL LIKE IT

• Frictionless. Highlight → right-click, keyboard shortcut, or floating "+" button → review → save. No copy-paste, no app switching.
• Smart deck routing. The AI picks the best-fitting deck from your existing decks. Switching decks (or Anki profiles) is one click.
• Source link preserved. Every card's back gets a link back to the article it came from.
• Works with the Anki you already use. Cards land in your real Anki desktop install and sync to mobile via AnkiWeb like any other card.
• Two AI options. Free Gemini API (cloud, best quality) or fully-local Chrome Built-in (Gemini Nano — unlimited, private).

WHAT YOU NEED

• Anki desktop with the AnkiConnect add-on (free; the welcome page walks you through it).
• Either a free Gemini API key, or Chrome with on-device AI enabled.

The first-run welcome page handles setup. The whole thing takes about three minutes.

PRIVACY

The extension only reads the text you actively highlight when you trigger card creation. It doesn't track browsing, doesn't run analytics, and doesn't contact any servers operated by the extension author. The highlighted text plus the page title/URL are sent to your chosen AI provider (Google Gemini for cloud mode, or your local Chrome for on-device mode). Generated cards go directly to your own Anki desktop client over localhost. Full privacy policy linked from the store listing.

KEYBOARD SHORTCUT

⌘⇧A on Mac / Ctrl+Shift+A on Windows/Linux. Rebind at chrome://extensions/shortcuts.
```

---

## Single-purpose statement

> The extension's single purpose is to create Anki flashcards from text the user highlights on web pages, using an AI model to suggest the front and back of each card.

---

## Permission justifications

For each permission in `manifest.json`, paste this when prompted:

| Permission | Justification |
| --- | --- |
| `contextMenus` | Adds the "Create Anki flashcard from selection" entry to the right-click menu on highlighted text — the primary trigger for the extension's core feature. |
| `storage` | Persists user settings: which AI provider is active, the user's Gemini API key (if provided), the preferred Anki deck per profile, and a floating-button toggle. |
| `scripting` | Used to inject the in-page panel UI on demand (after the user clicks the context menu item or presses the keyboard shortcut) on pages that loaded before the extension was installed. |
| `activeTab` | Lets the extension act on the page the user is currently on when they trigger the action, without holding general access to any other tab. |
| `host_permissions: http://127.0.0.1:8765/*` | Required to communicate with AnkiConnect, the local-only Anki add-on that runs on this loopback address. This is how generated flashcards reach the user's own Anki desktop install. No external host is contacted via this permission. |
| `host_permissions: https://generativelanguage.googleapis.com/*` | Required to call Google's Gemini API (the user's chosen cloud AI provider) using the API key the user pastes into the extension. Only flashcard-generation requests are sent. |

**Remote code use**: None. All JavaScript is bundled in the extension.

---

## Privacy disclosures (in dev console)

Check the following boxes and add the noted text where applicable:

- [x] **Personally identifiable information** — not collected
- [x] **Health information** — not collected
- [x] **Financial and payment information** — not collected
- [x] **Authentication information** — *the user's Gemini API key, stored only in chrome.storage.sync on the user's own device.*
- [x] **Personal communications** — not collected
- [x] **Location** — not collected
- [x] **Web history** — not collected
- [x] **User activity** — *the text the user explicitly highlights and submits is sent to their chosen AI provider for card generation. Nothing else is observed.*
- [x] **Website content** — *only the highlighted passage and a short surrounding excerpt from the page the user submits.*

Certify both:
- [x] I do not sell or transfer user data to third parties outside the approved use cases.
- [x] I do not use or transfer user data for purposes unrelated to the extension's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**: host `PRIVACY.md` (rendered as HTML) on GitHub Pages or any static host, and paste the URL here.

---

## Visual assets

| Asset | Size | File |
| --- | --- | --- |
| Store icon | 128×128 | `../icons/icon128.png` |
| Small promo tile | 440×280 | `promo_tile_440x280.png` |
| Screenshots (1–5) | 1280×800 or 640×400 | **TODO** — take from a real session: (1) right-click menu with the entry visible, (2) the in-page panel with a generated card, (3) the floating "+" button next to highlighted text, (4) the Options page, (5) Anki showing the card. |
| Marquee promo (optional, for featured placement) | 1400×560 | not required |

---

## Pre-submission checklist

- [ ] Bump `version` in `manifest.json` for every upload.
- [ ] Zip the **contents** of the extension folder (not the folder itself). Exclude the `store-assets/` directory and `generate_icons.py` from the zip.
- [ ] Host `PRIVACY.md` as HTML somewhere stable; put that URL in the listing.
- [ ] Take 1–5 screenshots at 1280×800.
- [ ] Walk through the welcome flow on a clean Chrome profile end-to-end one more time.
- [ ] Confirm the keyboard shortcut works.
- [ ] Confirm both AI providers work (or document Chrome Built-in as "experimental, requires on-device model").

---

## Suggested zip command

From the extension root:

```sh
zip -r ../anki-flashcard-creator-v1.0.0.zip . \
  -x "store-assets/*" "PRIVACY.md" ".git/*" ".DS_Store" "*.pyc" "__pycache__/*"
```
