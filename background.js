const MENU_ID = "create-anki-flashcard";
const ANKI_URL = "http://127.0.0.1:8765";
const GEMINI_MODEL = "gemini-2.5-flash";

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Create Anki flashcard from selection",
    contexts: ["selection"],
  });
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  await openPanelOnTab(tab, info.selectionText || "", info.pageUrl);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "create_flashcard") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await openPanelOnTab(tab, "", tab.url);
});

async function openPanelOnTab(tab, selectionText, pageUrl) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (e) {
    // Content script may already be injected, or page is restricted (chrome://, Web Store).
    console.warn("Could not inject content script (tab %d):", tab.id, e?.message || e);
  }
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "OPEN_PANEL",
      selectionText: selectionText || "",
      pageUrl: pageUrl || tab.url || "",
      pageTitle: tab.title || "",
    });
  } catch (err) {
    console.error("Failed to open panel:", err);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "GENERATE_CARD") {
    generateCard(msg.payload).then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === "GET_DECKS") {
    ankiInvoke("deckNames").then((decks) => sendResponse({ decks })).catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === "GET_PROFILES") {
    ankiInvoke("getProfiles").then((profiles) => sendResponse({ profiles })).catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === "SWITCH_PROFILE") {
    ankiInvoke("loadProfile", { name: msg.payload.name })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === "SAVE_CARD") {
    saveCard(msg.payload).then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === "REQUEST_ANKI_PERMISSION") {
    ankiInvoke("requestPermission")
      .then((result) => sendResponse({ result }))
      .catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === "ANKI_PING") {
    ankiInvoke("version")
      .then((v) => sendResponse({ version: v }))
      .catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
});

async function generateCard(args) {
  const { aiProvider } = await chrome.storage.sync.get(["aiProvider"]);
  const provider = aiProvider === "chrome-builtin" ? "chrome-builtin" : "gemini-api";
  const result =
    provider === "chrome-builtin"
      ? await generateCardChromeBuiltin(args)
      : await generateCardGemini(args);
  return { ...result, provider };
}

function buildResponseSchema(decks) {
  const schema = {
    type: "object",
    properties: {
      front: { type: "string" },
      back: { type: "string" },
    },
    required: ["front", "back"],
  };
  if (decks.length > 0) {
    schema.properties.deck = { type: "string", enum: decks };
    schema.required.push("deck");
  }
  return schema;
}

async function generateCardGemini({ selectionText, context, pageTitle, pageUrl, deckNames }) {
  const { geminiApiKey } = await chrome.storage.sync.get(["geminiApiKey"]);
  if (!geminiApiKey) {
    return { error: "No Gemini API key set. Open the extension Options page to add one." };
  }

  const decks = Array.isArray(deckNames) ? deckNames.filter(Boolean) : [];
  const prompt = buildPrompt({ selectionText, context, pageTitle, pageUrl, deckNames: decks });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: buildResponseSchema(decks),
          temperature: 0.4,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    return { error: `Gemini API error ${res.status}: ${body.slice(0, 300)}` };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { error: "Empty response from Gemini." };

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "Could not parse Gemini response as JSON." };
  }
  return {
    front: parsed.front || "",
    back: parsed.back || "",
    suggestedDeck: typeof parsed.deck === "string" ? parsed.deck : "",
  };
}

async function generateCardChromeBuiltin({ selectionText, context, pageTitle, pageUrl, deckNames }) {
  if (typeof LanguageModel === "undefined") {
    return {
      error:
        "Chrome built-in AI not available. Enable chrome://flags/#prompt-api-for-gemini-nano and chrome://flags/#optimization-guide-on-device-model, then restart Chrome. Requires Chrome 138+.",
    };
  }

  let availability;
  try {
    availability = await LanguageModel.availability();
  } catch (e) {
    return { error: `Built-in AI availability check failed: ${e.message}` };
  }
  if (availability === "unavailable") {
    return {
      error:
        "Built-in AI unavailable on this device. Requirements: ~22GB free disk, GPU with 4GB+ VRAM, supported OS, non-metered network.",
    };
  }

  const decks = Array.isArray(deckNames) ? deckNames.filter(Boolean) : [];
  const prompt = buildPrompt({ selectionText, context, pageTitle, pageUrl, deckNames: decks });

  let session;
  try {
    session = await LanguageModel.create({
      initialPrompts: [
        {
          role: "system",
          content:
            "You create high-quality Anki flashcards from passages the user highlighted while reading. Always reply with strict JSON matching the requested schema. No prose, no markdown.",
        },
      ],
      temperature: 0.4,
      topK: 3,
    });
  } catch (e) {
    return {
      error: `Built-in AI session failed: ${e.message}. The Gemini Nano model may still be downloading — try again in a few minutes.`,
    };
  }

  let raw;
  try {
    raw = await session.prompt(prompt, { responseConstraint: buildResponseSchema(decks) });
  } catch (e) {
    try { session.destroy?.(); } catch (destroyErr) {
      console.warn("Built-in AI session cleanup failed:", destroyErr?.message || destroyErr);
    }
    return { error: `Built-in AI prompt failed: ${e.message}` };
  }
  try { session.destroy?.(); } catch (destroyErr) {
    console.warn("Built-in AI session cleanup failed:", destroyErr?.message || destroyErr);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: `Built-in AI returned non-JSON: ${String(raw).slice(0, 200)}` };
  }
  return {
    front: parsed.front || "",
    back: parsed.back || "",
    suggestedDeck: typeof parsed.deck === "string" ? parsed.deck : "",
  };
}

function buildPrompt({ selectionText, context, pageTitle, pageUrl, deckNames }) {
  const lines = [
    "You create a single Anki flashcard from a passage the user highlighted while reading.",
    "Rules:",
    "- Test ONE specific, important fact, idea, or relationship from the passage.",
    "- The question must be self-contained. Do NOT use phrases like \"this article\", \"the author\", \"the passage\".",
    "- The answer should be concise but complete enough to stand alone.",
    "- Avoid yes/no questions. Prefer questions that require recalling the key term, number, mechanism, or claim.",
    "- Use the surrounding context only to disambiguate the highlighted passage, not as the primary content.",
    "",
    `Page title: ${pageTitle || "(unknown)"}`,
    `Page URL: ${pageUrl || "(unknown)"}`,
    "",
    "Highlighted passage:",
    "<<<",
    selectionText || "",
    ">>>",
    "",
    "Surrounding context (may be empty):",
    "<<<",
    (context || "").slice(0, 2000),
    ">>>",
    "",
  ];
  if (deckNames && deckNames.length > 0) {
    lines.push(
      "Available Anki decks (pick the single best fit for this card from this list — match by topic):",
      ...deckNames.map((d) => `- ${d}`),
      "If none clearly fit, pick the most general deck (e.g. \"Default\").",
      "",
      "Return JSON: {\"front\": \"...\", \"back\": \"...\", \"deck\": \"<one of the decks above>\"}"
    );
  } else {
    lines.push("Return JSON: {\"front\": \"...\", \"back\": \"...\"}");
  }
  return lines.join("\n");
}

async function saveCard({ front, back, deckName, tags, sourceUrl }) {
  const { modelName } = await chrome.storage.sync.get(["modelName"]);
  const noteModel = modelName || "Basic";

  const backWithSource = sourceUrl
    ? `${back}\n\n<hr><a href="${escapeHtml(sourceUrl)}">source</a>`
    : back;

  const note = {
    deckName,
    modelName: noteModel,
    fields: { Front: front, Back: backWithSource },
    options: { allowDuplicate: false, duplicateScope: "deck" },
    tags: tags && tags.length ? tags : ["web-clip"],
  };
  const id = await ankiInvoke("addNote", { note });
  if (id == null) {
    return { error: "Duplicate card — a note with the same Front field already exists in this deck." };
  }
  return { noteId: id };
}

async function ankiInvoke(action, params = {}) {
  let res;
  try {
    res = await fetch(ANKI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });
  } catch (e) {
    throw new Error(
      "Could not connect to Anki. Make sure Anki is running with AnkiConnect installed."
    );
  }
  if (!res.ok) throw new Error(`AnkiConnect HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`AnkiConnect: ${data.error}`);
  return data.result;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
