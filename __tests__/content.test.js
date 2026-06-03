// content.js is wrapped in an IIFE that touches window, document, and Chrome APIs
// on load. We set up all required globals before requiring it.

// DOM mocks — must exist before require("../content")
global.window = global.window || {};
Object.assign(global.window, {
  __ankiFlashcardInjected: false,
  getSelection: jest.fn(() => null),
  innerWidth: 1024,
  addEventListener: jest.fn(),
  location: { href: "https://example.com" },
});
global.document = {
  createElement: jest.fn(() => ({
    id: "",
    style: { cssText: "" },
    attachShadow: jest.fn(() => ({
      innerHTML: "",
      querySelector: jest.fn(),
    })),
  })),
  getElementById: jest.fn(() => null),
  addEventListener: jest.fn(),
  documentElement: { appendChild: jest.fn() },
  title: "Test Page",
};
global.Node = { TEXT_NODE: 3 };

const contentModule = require("../content");

// ─── hostnameTag ─────────────────────────────────────────────────────────────

describe("hostnameTag", () => {
  it("extracts hostname from a URL", () => {
    expect(contentModule.hostnameTag("https://en.wikipedia.org/wiki/Test")).toBe("en.wikipedia.org");
  });

  it("strips www. prefix", () => {
    expect(contentModule.hostnameTag("https://www.example.com/page")).toBe("example.com");
  });

  it("returns empty string for invalid URL", () => {
    expect(contentModule.hostnameTag("not-a-url")).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(contentModule.hostnameTag("")).toBe("");
  });

  it("handles URL with port", () => {
    expect(contentModule.hostnameTag("http://localhost:3000/path")).toBe("localhost");
  });

  it("handles URL with subdomain", () => {
    expect(contentModule.hostnameTag("https://docs.google.com/spreadsheets")).toBe("docs.google.com");
  });
});

// ─── escapeHtml ──────────────────────────────────────────────────────────────

describe("escapeHtml (content)", () => {
  it("escapes all HTML-sensitive characters", () => {
    expect(contentModule.escapeHtml('&<>"\''))
      .toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves safe strings unchanged", () => {
    expect(contentModule.escapeHtml("Hello, World!")).toBe("Hello, World!");
  });

  it("handles empty string", () => {
    expect(contentModule.escapeHtml("")).toBe("");
  });

  it("coerces non-string input", () => {
    expect(contentModule.escapeHtml(42)).toBe("42");
  });

  it("escapes nested HTML tags", () => {
    expect(contentModule.escapeHtml('<div class="x">foo</div>'))
      .toBe("&lt;div class=&quot;x&quot;&gt;foo&lt;/div&gt;");
  });
});

// ─── setStatus ───────────────────────────────────────────────────────────────

describe("setStatus", () => {
  it("sets text content and data-kind on element", () => {
    const el = { textContent: "", dataset: {} };
    contentModule.setStatus(el, "Loading…", "info");
    expect(el.textContent).toBe("Loading…");
    expect(el.dataset.kind).toBe("info");
  });

  it("sets error kind", () => {
    const el = { textContent: "", dataset: {} };
    contentModule.setStatus(el, "Something went wrong", "error");
    expect(el.textContent).toBe("Something went wrong");
    expect(el.dataset.kind).toBe("error");
  });

  it("sets success kind", () => {
    const el = { textContent: "", dataset: {} };
    contentModule.setStatus(el, "Done!", "success");
    expect(el.dataset.kind).toBe("success");
  });
});

// ─── renderPanel ─────────────────────────────────────────────────────────────

describe("renderPanel", () => {
  it("returns HTML string containing flashcard panel structure", () => {
    const html = contentModule.renderPanel({ selectionText: "Test text", pageTitle: "Page" });
    expect(html).toContain("New Anki flashcard");
    expect(html).toContain("Test text");
    expect(html).toContain("afc-front");
    expect(html).toContain("afc-back");
    expect(html).toContain("afc-save");
    expect(html).toContain("afc-regen");
    expect(html).toContain("afc-close");
  });

  it("escapes HTML in the preview", () => {
    const html = contentModule.renderPanel({ selectionText: '<script>alert("xss")</script>', pageTitle: "" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("truncates long selection text at 280 chars with ellipsis", () => {
    const longText = "A".repeat(300);
    const html = contentModule.renderPanel({ selectionText: longText, pageTitle: "" });
    expect(html).toContain("…");
  });

  it("does not add ellipsis for short text", () => {
    const html = contentModule.renderPanel({ selectionText: "short", pageTitle: "" });
    expect(html).toContain("short</div>");
  });

  it("handles empty selection text", () => {
    const html = contentModule.renderPanel({ selectionText: "", pageTitle: "" });
    expect(html).toContain("Highlighted");
  });

  it("contains profile and deck selectors", () => {
    const html = contentModule.renderPanel({ selectionText: "X", pageTitle: "" });
    expect(html).toContain('class="afc-profile"');
    expect(html).toContain('class="afc-deck"');
  });
});

// ─── makeDraggable ───────────────────────────────────────────────────────────

describe("makeDraggable", () => {
  it("sets cursor to 'move' on the handle", () => {
    const host = {
      style: { top: "24px", right: "24px" },
      getBoundingClientRect: () => ({ top: 24, right: 1000 }),
    };
    const handle = { style: {}, addEventListener: jest.fn() };

    contentModule.makeDraggable(host, handle);

    expect(handle.style.cursor).toBe("move");
    expect(handle.addEventListener).toHaveBeenCalledWith("mousedown", expect.any(Function));
  });

  it("registers mousedown handler on handle", () => {
    const host = { style: {}, getBoundingClientRect: jest.fn() };
    const handle = { style: {}, addEventListener: jest.fn() };

    contentModule.makeDraggable(host, handle);

    const calls = handle.addEventListener.mock.calls;
    expect(calls.some(([event]) => event === "mousedown")).toBe(true);
  });
});

// ─── getSelectionContext ─────────────────────────────────────────────────────

describe("getSelectionContext", () => {
  it("returns empty string when no selection", () => {
    global.window.getSelection = jest.fn(() => null);
    expect(contentModule.getSelectionContext()).toBe("");
  });

  it("returns empty string when rangeCount is 0", () => {
    global.window.getSelection = jest.fn(() => ({ rangeCount: 0 }));
    expect(contentModule.getSelectionContext()).toBe("");
  });

  it("extracts block-level text content", () => {
    const mockEl = {
      nodeType: 1,
      closest: jest.fn(() => ({ textContent: "  Full paragraph   with spaces.  " })),
    };
    global.window.getSelection = jest.fn(() => ({
      rangeCount: 1,
      getRangeAt: () => ({ commonAncestorContainer: mockEl }),
    }));

    const result = contentModule.getSelectionContext();
    expect(result).toBe("Full paragraph with spaces.");
  });

  it("walks up from text node to parent element", () => {
    const parentEl = {
      closest: jest.fn(() => ({ textContent: "Parent text" })),
    };
    const textNode = {
      nodeType: 3, // Node.TEXT_NODE
      parentElement: parentEl,
    };
    global.window.getSelection = jest.fn(() => ({
      rangeCount: 1,
      getRangeAt: () => ({ commonAncestorContainer: textNode }),
    }));

    const result = contentModule.getSelectionContext();
    expect(result).toBe("Parent text");
    expect(parentEl.closest).toHaveBeenCalled();
  });

  it("truncates context to 2000 characters", () => {
    const longText = "X".repeat(3000);
    const mockEl = {
      nodeType: 1,
      closest: jest.fn(() => ({ textContent: longText })),
    };
    global.window.getSelection = jest.fn(() => ({
      rangeCount: 1,
      getRangeAt: () => ({ commonAncestorContainer: mockEl }),
    }));

    const result = contentModule.getSelectionContext();
    expect(result.length).toBe(2000);
  });
});

// ─── getLiveSelectionText ────────────────────────────────────────────────────

describe("getLiveSelectionText", () => {
  it("returns selection text", () => {
    global.window.getSelection = jest.fn(() => ({
      toString: () => "selected text",
    }));
    expect(contentModule.getLiveSelectionText()).toBe("selected text");
  });

  it("returns empty string when no selection", () => {
    global.window.getSelection = jest.fn(() => null);
    expect(contentModule.getLiveSelectionText()).toBe("");
  });
});
