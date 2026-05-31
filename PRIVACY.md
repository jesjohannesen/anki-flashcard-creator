# Privacy Policy — Anki Flashcard Creator

_Last updated: 2026-05-31_

This Chrome extension ("the extension") helps you turn highlighted text from web pages into Anki flashcards. This document describes what data the extension handles and where it goes.

## What the extension processes

When you trigger card creation (via context menu, keyboard shortcut, or floating button) the extension reads:

- The **text you highlighted** on the page.
- A **short surrounding excerpt** (up to 2,000 characters from the same paragraph/section as the highlight) to give the AI enough context to write a good question.
- The **page title** and **page URL** of the tab you triggered the action from.

It does **not** read or collect anything from pages where you have not explicitly triggered the action. No browsing history is tracked.

## Where that data is sent

Card generation requires an AI model. You choose the provider in the extension's Options or Welcome page.

### Option A: Gemini API (cloud) — default

If you select Gemini API, the highlighted text, surrounding excerpt, page title, and page URL are sent to **Google's Gemini API** (`generativelanguage.googleapis.com`) using the API key you paste into the extension. Google's handling of that data is governed by:

- [Google AI Studio Terms of Service](https://ai.google.dev/gemini-api/terms)
- [Google's Privacy Policy](https://policies.google.com/privacy)

Free-tier Gemini usage may be retained by Google for service-improvement purposes. Paid-tier usage is not. The extension does not send any other data to Google.

### Option B: Chrome Built-in (local)

If you select Chrome Built-in, the same content is processed by **Gemini Nano**, an on-device model that runs locally inside Chrome. No data leaves your computer for AI processing.

## Anki

When you click Save, the generated flashcard's front, back, deck name, tags, and source URL are sent to **AnkiConnect** running on `localhost:8765` on your own machine. From there, Anki syncs the card to your AnkiWeb account via Anki's standard sync mechanism, governed by [AnkiWeb's privacy policy](https://faqs.ankiweb.net/privacy.html).

The extension does not communicate with any AnkiWeb servers directly.

## Local storage

The extension stores the following in `chrome.storage.sync` (which syncs across your signed-in Chrome profiles via Google's standard Chrome Sync, not via any server operated by the extension author):

- Your selected AI provider.
- Your Gemini API key, if you provided one.
- Your preferred Anki note model name, default deck per profile, and last-used Anki profile name.
- Whether the floating "+" button is enabled.
- A few onboarding completion flags.

You can clear all of this by removing the extension or by clearing the keys from the Options page.

## What the extension does not do

- It does not run analytics, telemetry, or error reporting.
- It does not contact any servers operated by the extension author.
- It does not read pages or selections you have not explicitly acted on.
- It does not sell, share, or transfer any data to third parties beyond the AI provider you select and your own Anki client.

## Contact

For questions or concerns about this policy, open an issue on the project's source repository.
