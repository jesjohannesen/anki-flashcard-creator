const {
  buildResponseSchema,
  buildPrompt,
  escapeHtml,
  ankiInvoke,
  saveCard,
  generateCard,
  generateCardGemini,
  generateCardChromeBuiltin,
  openPanelOnTab,
} = require("../background");

// ─── buildResponseSchema ────────────────────────────────────────────────────

describe("buildResponseSchema", () => {
  it("returns base schema with front/back when no decks", () => {
    const schema = buildResponseSchema([]);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["front", "back"]);
    expect(schema.properties.front).toEqual({ type: "string" });
    expect(schema.properties.back).toEqual({ type: "string" });
    expect(schema.properties.deck).toBeUndefined();
  });

  it("adds deck enum when decks are provided", () => {
    const schema = buildResponseSchema(["Default", "Biology", "History"]);
    expect(schema.required).toContain("deck");
    expect(schema.properties.deck).toEqual({
      type: "string",
      enum: ["Default", "Biology", "History"],
    });
  });

  it("adds deck with single deck", () => {
    const schema = buildResponseSchema(["OnlyDeck"]);
    expect(schema.required).toContain("deck");
    expect(schema.properties.deck.enum).toEqual(["OnlyDeck"]);
  });
});

// ─── buildPrompt ─────────────────────────────────────────────────────────────

describe("buildPrompt", () => {
  it("includes highlighted passage and page metadata", () => {
    const prompt = buildPrompt({
      selectionText: "Mitochondria is the powerhouse of the cell",
      context: "Biology chapter 5 discusses organelles.",
      pageTitle: "Biology 101",
      pageUrl: "https://example.com/bio",
      deckNames: [],
    });
    expect(prompt).toContain("Mitochondria is the powerhouse of the cell");
    expect(prompt).toContain("Biology 101");
    expect(prompt).toContain("https://example.com/bio");
    expect(prompt).toContain("Biology chapter 5 discusses organelles.");
    expect(prompt).toContain('Return JSON: {"front": "...", "back": "..."}');
  });

  it("includes deck list when decks provided", () => {
    const prompt = buildPrompt({
      selectionText: "Test",
      context: "",
      pageTitle: "Title",
      pageUrl: "https://example.com",
      deckNames: ["Default", "Science"],
    });
    expect(prompt).toContain("- Default");
    expect(prompt).toContain("- Science");
    expect(prompt).toContain("pick the single best fit");
    expect(prompt).toContain('"deck": "<one of the decks above>"');
  });

  it("omits deck instructions when no decks", () => {
    const prompt = buildPrompt({
      selectionText: "Test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(prompt).not.toContain("Available Anki decks");
    expect(prompt).toContain('Return JSON: {"front": "...", "back": "..."}');
  });

  it("handles empty selectionText and context", () => {
    const prompt = buildPrompt({
      selectionText: "",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(prompt).toContain("<<<\n\n>>>");
    expect(prompt).toContain("(unknown)");
  });

  it("truncates context to 2000 characters", () => {
    const longCtx = "A".repeat(3000);
    const prompt = buildPrompt({
      selectionText: "sel",
      context: longCtx,
      pageTitle: "T",
      pageUrl: "U",
      deckNames: [],
    });
    // Context should be sliced to 2000 chars — verify it doesn't contain the full 3000
    expect(prompt).toContain("A".repeat(2000));
    expect(prompt).not.toContain("A".repeat(2001));
  });
});

// ─── escapeHtml ──────────────────────────────────────────────────────────────

describe("escapeHtml (background)", () => {
  it("escapes &, <, >, quotes", () => {
    expect(escapeHtml('&<>"\''))
      .toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves normal text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("coerces non-string values", () => {
    expect(escapeHtml(123)).toBe("123");
    expect(escapeHtml(null)).toBe("null");
    expect(escapeHtml(undefined)).toBe("undefined");
  });

  it("handles string with mixed content", () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });
});

// ─── ankiInvoke ──────────────────────────────────────────────────────────────

describe("ankiInvoke", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("sends correct request to AnkiConnect", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: ["Default"], error: null }),
    });

    const result = await ankiInvoke("deckNames");
    expect(global.fetch).toHaveBeenCalledWith("http://127.0.0.1:8765", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deckNames", version: 6, params: {} }),
    });
    expect(result).toEqual(["Default"]);
  });

  it("passes params correctly", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: null, error: null }),
    });

    await ankiInvoke("addNote", { note: { deckName: "Test" } });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.params).toEqual({ note: { deckName: "Test" } });
  });

  it("throws on HTTP error", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(ankiInvoke("deckNames")).rejects.toThrow("AnkiConnect HTTP 500");
  });

  it("throws on AnkiConnect error field", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: null, error: "deck not found" }),
    });
    await expect(ankiInvoke("addNote")).rejects.toThrow("AnkiConnect: deck not found");
  });
});

// ─── saveCard ────────────────────────────────────────────────────────────────

describe("saveCard", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ modelName: "Basic" });
      return Promise.resolve({ modelName: "Basic" });
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("creates a note with source URL", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 12345, error: null }),
    });

    const result = await saveCard({
      front: "What is DNA?",
      back: "Deoxyribonucleic acid",
      deckName: "Biology",
      tags: ["science"],
      sourceUrl: "https://example.com",
    });

    expect(result).toEqual({ noteId: 12345 });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe("addNote");
    expect(body.params.note.deckName).toBe("Biology");
    expect(body.params.note.fields.Front).toBe("What is DNA?");
    expect(body.params.note.fields.Back).toContain("Deoxyribonucleic acid");
    expect(body.params.note.fields.Back).toContain('<a href="https://example.com">source</a>');
    expect(body.params.note.tags).toEqual(["science"]);
  });

  it("uses 'web-clip' tag when no tags provided", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 99, error: null }),
    });

    await saveCard({
      front: "Q",
      back: "A",
      deckName: "Default",
      tags: [],
      sourceUrl: "",
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.params.note.tags).toEqual(["web-clip"]);
  });

  it("does not append source link when sourceUrl is empty", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 1, error: null }),
    });

    await saveCard({
      front: "Q",
      back: "Just the answer",
      deckName: "Default",
      tags: [],
      sourceUrl: "",
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.params.note.fields.Back).toBe("Just the answer");
  });

  it("uses custom model name from storage", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ modelName: "Cloze" });
      return Promise.resolve({ modelName: "Cloze" });
    });
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 1, error: null }),
    });

    await saveCard({
      front: "Q",
      back: "A",
      deckName: "D",
      tags: [],
      sourceUrl: "",
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.params.note.modelName).toBe("Cloze");
  });

  it("defaults model name to 'Basic' when not set", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({});
      return Promise.resolve({});
    });
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 1, error: null }),
    });

    await saveCard({
      front: "Q",
      back: "A",
      deckName: "D",
      tags: [],
      sourceUrl: "",
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.params.note.modelName).toBe("Basic");
  });

  it("escapes HTML in source URL", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 1, error: null }),
    });

    await saveCard({
      front: "Q",
      back: "A",
      deckName: "D",
      tags: [],
      sourceUrl: 'https://example.com/page?a=1&b="2"',
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.params.note.fields.Back).toContain("&amp;");
    expect(body.params.note.fields.Back).toContain("&quot;");
  });
});

// ─── generateCard ────────────────────────────────────────────────────────────

describe("generateCard", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("routes to gemini-api by default", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ aiProvider: "gemini-api", geminiApiKey: "test-key" });
      return Promise.resolve({ aiProvider: "gemini-api", geminiApiKey: "test-key" });
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            { content: { parts: [{ text: '{"front":"Q","back":"A"}' }] } },
          ],
        }),
    });

    const result = await generateCard({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.provider).toBe("gemini-api");
    expect(result.front).toBe("Q");
    expect(result.back).toBe("A");
  });

  it("routes to chrome-builtin when configured", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ aiProvider: "chrome-builtin" });
      return Promise.resolve({ aiProvider: "chrome-builtin" });
    });

    // LanguageModel not available in test env
    const result = await generateCard({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    // Should get an error since LanguageModel is undefined
    expect(result.provider).toBe("chrome-builtin");
    expect(result.error).toBeTruthy();
  });
});

// ─── generateCardGemini ──────────────────────────────────────────────────────

describe("generateCardGemini", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("returns error when no API key", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({});
      return Promise.resolve({});
    });

    const result = await generateCardGemini({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("No Gemini API key");
  });

  it("returns front/back/suggestedDeck on success", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ geminiApiKey: "fake-key" });
      return Promise.resolve({ geminiApiKey: "fake-key" });
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"front":"What is X?","back":"Y","deck":"Science"}',
                  },
                ],
              },
            },
          ],
        }),
    });

    const result = await generateCardGemini({
      selectionText: "X is Y",
      context: "Textbook",
      pageTitle: "Science 101",
      pageUrl: "https://example.com",
      deckNames: ["Science", "Default"],
    });

    expect(result.front).toBe("What is X?");
    expect(result.back).toBe("Y");
    expect(result.suggestedDeck).toBe("Science");
    // Verify it called the Gemini API
    expect(global.fetch.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
  });

  it("returns error on non-ok HTTP response", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ geminiApiKey: "fake-key" });
      return Promise.resolve({ geminiApiKey: "fake-key" });
    });

    global.fetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limit exceeded"),
    });

    const result = await generateCardGemini({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Gemini API error 429");
  });

  it("returns error on empty response", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ geminiApiKey: "fake-key" });
      return Promise.resolve({ geminiApiKey: "fake-key" });
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [] }),
    });

    const result = await generateCardGemini({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Empty response from Gemini");
  });

  it("returns error on invalid JSON in response", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ geminiApiKey: "fake-key" });
      return Promise.resolve({ geminiApiKey: "fake-key" });
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            { content: { parts: [{ text: "not-json" }] } },
          ],
        }),
    });

    const result = await generateCardGemini({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Could not parse Gemini response");
  });

  it("handles missing deck in response", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ geminiApiKey: "fake-key" });
      return Promise.resolve({ geminiApiKey: "fake-key" });
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: '{"front":"Q","back":"A"}' }],
              },
            },
          ],
        }),
    });

    const result = await generateCardGemini({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.front).toBe("Q");
    expect(result.back).toBe("A");
    expect(result.suggestedDeck).toBe("");
  });

  it("filters empty deck names from deckNames", async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      if (cb) cb({ geminiApiKey: "fake-key" });
      return Promise.resolve({ geminiApiKey: "fake-key" });
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: '{"front":"Q","back":"A","deck":"Default"}' }],
              },
            },
          ],
        }),
    });

    await generateCardGemini({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: ["Default", "", null, "Science"],
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const schema = body.generationConfig.responseSchema;
    // Filtered decks should not contain empty/null values
    expect(schema.properties.deck.enum).toEqual(["Default", "Science"]);
  });
});

// ─── generateCardChromeBuiltin ───────────────────────────────────────────────

describe("generateCardChromeBuiltin", () => {
  afterEach(() => {
    delete global.LanguageModel;
  });

  it("returns error when LanguageModel is undefined", async () => {
    const result = await generateCardChromeBuiltin({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Chrome built-in AI not available");
  });

  it("returns error when availability is 'unavailable'", async () => {
    global.LanguageModel = {
      availability: jest.fn().mockResolvedValue("unavailable"),
    };

    const result = await generateCardChromeBuiltin({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Built-in AI unavailable");
  });

  it("returns error when availability check throws", async () => {
    global.LanguageModel = {
      availability: jest.fn().mockRejectedValue(new Error("check failed")),
    };

    const result = await generateCardChromeBuiltin({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("availability check failed");
  });

  it("returns error when session creation fails", async () => {
    global.LanguageModel = {
      availability: jest.fn().mockResolvedValue("available"),
      create: jest.fn().mockRejectedValue(new Error("model downloading")),
    };

    const result = await generateCardChromeBuiltin({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Built-in AI session failed");
  });

  it("returns error when prompt fails", async () => {
    const mockSession = {
      prompt: jest.fn().mockRejectedValue(new Error("prompt error")),
      destroy: jest.fn(),
    };
    global.LanguageModel = {
      availability: jest.fn().mockResolvedValue("available"),
      create: jest.fn().mockResolvedValue(mockSession),
    };

    const result = await generateCardChromeBuiltin({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Built-in AI prompt failed");
    expect(mockSession.destroy).toHaveBeenCalled();
  });

  it("returns front/back on successful generation", async () => {
    const mockSession = {
      prompt: jest.fn().mockResolvedValue('{"front":"Q","back":"A"}'),
      destroy: jest.fn(),
    };
    global.LanguageModel = {
      availability: jest.fn().mockResolvedValue("available"),
      create: jest.fn().mockResolvedValue(mockSession),
    };

    const result = await generateCardChromeBuiltin({
      selectionText: "test text",
      context: "context",
      pageTitle: "Title",
      pageUrl: "https://example.com",
      deckNames: [],
    });
    expect(result.front).toBe("Q");
    expect(result.back).toBe("A");
    expect(result.suggestedDeck).toBe("");
    expect(mockSession.destroy).toHaveBeenCalled();
  });

  it("returns error on non-JSON response", async () => {
    const mockSession = {
      prompt: jest.fn().mockResolvedValue("This is not JSON"),
      destroy: jest.fn(),
    };
    global.LanguageModel = {
      availability: jest.fn().mockResolvedValue("available"),
      create: jest.fn().mockResolvedValue(mockSession),
    };

    const result = await generateCardChromeBuiltin({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: [],
    });
    expect(result.error).toContain("Built-in AI returned non-JSON");
  });

  it("includes suggested deck when returned", async () => {
    const mockSession = {
      prompt: jest.fn().mockResolvedValue('{"front":"Q","back":"A","deck":"Science"}'),
      destroy: jest.fn(),
    };
    global.LanguageModel = {
      availability: jest.fn().mockResolvedValue("available"),
      create: jest.fn().mockResolvedValue(mockSession),
    };

    const result = await generateCardChromeBuiltin({
      selectionText: "test",
      context: "",
      pageTitle: "",
      pageUrl: "",
      deckNames: ["Science"],
    });
    expect(result.suggestedDeck).toBe("Science");
  });
});

// ─── openPanelOnTab ──────────────────────────────────────────────────────────

describe("openPanelOnTab", () => {
  beforeEach(() => {
    chrome.scripting.executeScript.mockReset();
    chrome.tabs.sendMessage.mockReset();
  });

  it("injects content script and sends OPEN_PANEL message", async () => {
    chrome.scripting.executeScript.mockResolvedValue(undefined);
    chrome.tabs.sendMessage.mockResolvedValue(undefined);

    await openPanelOnTab(
      { id: 42, title: "Page Title", url: "https://example.com" },
      "selected text",
      "https://example.com"
    );

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ["content.js"],
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: "OPEN_PANEL",
      selectionText: "selected text",
      pageUrl: "https://example.com",
      pageTitle: "Page Title",
    });
  });

  it("falls back to tab.url when pageUrl is empty", async () => {
    chrome.scripting.executeScript.mockResolvedValue(undefined);
    chrome.tabs.sendMessage.mockResolvedValue(undefined);

    await openPanelOnTab(
      { id: 1, title: "T", url: "https://fallback.com" },
      "text",
      ""
    );

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: "OPEN_PANEL",
      selectionText: "text",
      pageUrl: "https://fallback.com",
      pageTitle: "T",
    });
  });

  it("handles script injection failure gracefully", async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error("restricted page"));
    chrome.tabs.sendMessage.mockResolvedValue(undefined);

    // Should not throw
    await openPanelOnTab({ id: 1, title: "", url: "" }, "", "");
    expect(chrome.tabs.sendMessage).toHaveBeenCalled();
  });

  it("handles sendMessage failure gracefully", async () => {
    chrome.scripting.executeScript.mockResolvedValue(undefined);
    chrome.tabs.sendMessage.mockRejectedValue(new Error("tab closed"));

    // Should not throw
    await expect(
      openPanelOnTab({ id: 1, title: "", url: "" }, "", "")
    ).resolves.toBeUndefined();
  });
});
