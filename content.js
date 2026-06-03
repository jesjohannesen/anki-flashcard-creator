(() => {
  if (window.__ankiFlashcardInjected) return;
  window.__ankiFlashcardInjected = true;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "OPEN_PANEL") {
      removeFloatingButton();
      openPanel({
        selectionText: msg.selectionText || getLiveSelectionText(),
        context: getSelectionContext(),
        pageUrl: msg.pageUrl || window.location.href,
        pageTitle: msg.pageTitle || document.title,
      });
    }
  });

  let floatingEnabled = true;
  chrome.storage.sync.get(["floatingButtonEnabled"], ({ floatingButtonEnabled }) => {
    floatingEnabled = floatingButtonEnabled !== false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && "floatingButtonEnabled" in changes) {
      floatingEnabled = changes.floatingButtonEnabled.newValue !== false;
      if (!floatingEnabled) removeFloatingButton();
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (!floatingEnabled) return;
    if (e.target?.closest?.("#anki-flashcard-host, #afc-floating-host")) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() || "";
      if (text.length < 3) {
        removeFloatingButton();
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      showFloatingButton(rect);
    }, 0);
  });

  document.addEventListener("mousedown", (e) => {
    if (e.target?.closest?.("#afc-floating-host")) return;
    removeFloatingButton();
  });

  document.addEventListener("scroll", removeFloatingButton, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") removeFloatingButton();
  });

  function showFloatingButton(rect) {
    removeFloatingButton();
    const host = document.createElement("div");
    host.id = "afc-floating-host";
    const top = Math.max(8, rect.bottom + 6);
    const left = Math.min(window.innerWidth - 40, Math.max(8, rect.right - 28));
    host.style.cssText = `all: initial; position: fixed; top: ${top}px; left: ${left}px; z-index: 2147483647;`;
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
<style>
  .btn {
    all: initial;
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
    background: #2563eb; color: #fff;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.18);
    cursor: pointer;
    font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    user-select: none;
  }
  .btn:hover { background: #1d4ed8; }
  .btn:active { transform: scale(0.95); }
</style>
<button class="btn" title="Create Anki flashcard">+</button>
    `;
    document.documentElement.appendChild(host);
    const btn = shadow.querySelector(".btn");
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      const selectionText = getLiveSelectionText();
      const context = getSelectionContext();
      removeFloatingButton();
      openPanel({
        selectionText,
        context,
        pageUrl: window.location.href,
        pageTitle: document.title,
      });
    });
  }

  function removeFloatingButton() {
    document.getElementById("afc-floating-host")?.remove();
  }

  function getLiveSelectionText() {
    const sel = window.getSelection();
    return sel ? sel.toString() : "";
  }

  function getSelectionContext() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "";
    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const blockSelectors = "p,li,blockquote,article,section,div";
    const block = node?.closest?.(blockSelectors) || node;
    const text = (block?.textContent || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 2000);
  }

  function openPanel({ selectionText, context, pageUrl, pageTitle }) {
    document.getElementById("anki-flashcard-host")?.remove();

    const host = document.createElement("div");
    host.id = "anki-flashcard-host";
    host.style.cssText = "all: initial; position: fixed; top: 24px; right: 24px; z-index: 2147483647;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = renderPanel({ selectionText, pageTitle });
    document.documentElement.appendChild(host);

    const $ = (sel) => shadow.querySelector(sel);

    makeDraggable(host, shadow.querySelector(".afc-header"));

    const front = $(".afc-front");
    const back = $(".afc-back");
    const profile = $(".afc-profile");
    const deck = $(".afc-deck");
    const deckHint = $(".afc-deck-hint");
    const status = $(".afc-status");
    const saveBtn = $(".afc-save");
    const regenBtn = $(".afc-regen");
    const closeBtn = $(".afc-close");

    let currentProfile = "";

    closeBtn.addEventListener("click", () => host.remove());

    const populateDecks = (decks, preselect) =>
      new Promise((resolve) => {
        chrome.storage.sync.get(["lastDeckByProfile"], ({ lastDeckByProfile }) => {
          const lastForThisProfile = (lastDeckByProfile || {})[currentProfile];
          deck.innerHTML = "";
          for (const d of decks) {
            const opt = document.createElement("option");
            opt.value = d;
            opt.textContent = d;
            deck.appendChild(opt);
          }
          const want =
            (preselect && decks.includes(preselect) && preselect) ||
            (lastForThisProfile && decks.includes(lastForThisProfile) && lastForThisProfile) ||
            decks[0] ||
            "";
          if (want) deck.value = want;
          resolve();
        });
      });

    const loadDecksForCurrentProfile = async (preselect) => {
      let resp;
      try {
        resp = await sendMsg({ type: "GET_DECKS" });
      } catch (e) {
        setStatus(status, `Extension error: ${e.message}. Try reopening the panel.`, "error");
        return [];
      }
      if (resp?.error) {
        setStatus(status, `Anki not reachable: ${resp.error}. Is Anki open with AnkiConnect installed?`, "error");
        return [];
      }
      const decks = resp?.decks || [];
      await populateDecks(decks, preselect);
      return decks;
    };

    const providerLabel = (p) =>
      p === "chrome-builtin" ? "Chrome Built-in (local)" : "Gemini API (cloud)";

    const generate = async (decks) => {
      const { aiProvider } = await new Promise((r) =>
        chrome.storage.sync.get(["aiProvider"], r)
      );
      setStatus(status, `Generating with ${providerLabel(aiProvider || "gemini-api")}…`, "info");
      saveBtn.disabled = true;
      regenBtn.disabled = true;
      deckHint.textContent = "";
      let resp;
      try {
        resp = await sendMsg({
          type: "GENERATE_CARD",
          payload: { selectionText, context, pageTitle, pageUrl, deckNames: decks },
        });
      } catch (e) {
        saveBtn.disabled = false;
        regenBtn.disabled = false;
        setStatus(status, `Extension error: ${e.message}. Try reopening the panel.`, "error");
        return;
      }
      saveBtn.disabled = false;
      regenBtn.disabled = false;
      if (!resp || resp.error) {
        const prefix = resp?.provider ? `[${providerLabel(resp.provider)}] ` : "";
        setStatus(status, `${prefix}${resp?.error || "Generation failed."}`, "error");
        return;
      }
      front.value = resp.front || "";
      back.value = resp.back || "";
      if (resp.suggestedDeck && decks.includes(resp.suggestedDeck)) {
        deck.value = resp.suggestedDeck;
        deckHint.textContent = `✨ suggested: ${resp.suggestedDeck}`;
      }
      setStatus(status, `Generated with ${providerLabel(resp.provider || "gemini-api")}. Edit if needed, then Save.`, "info");
    };

    profile.addEventListener("change", async () => {
      const newProfile = profile.value;
      setStatus(status, `Switching profile to ${newProfile}…`, "info");
      let resp;
      try {
        resp = await sendMsg({ type: "SWITCH_PROFILE", payload: { name: newProfile } });
      } catch (e) {
        setStatus(status, `Extension error: ${e.message}. Try reopening the panel.`, "error");
        return;
      }
      if (resp?.error) {
        setStatus(status, `Profile switch failed: ${resp.error}`, "error");
        return;
      }
      currentProfile = newProfile;
      chrome.storage.sync.set({ lastProfile: newProfile });
      const decks = await loadDecksForCurrentProfile();
      deckHint.textContent = "";
      setStatus(status, `On profile ${newProfile}. Click Regenerate to re-suggest a deck.`, "info");
      regenBtn.dataset.decks = JSON.stringify(decks);
    });

    regenBtn.addEventListener("click", () => {
      const decks = JSON.parse(regenBtn.dataset.decks || "[]");
      generate(decks);
    });

    saveBtn.addEventListener("click", async () => {
      const f = front.value.trim();
      const b = back.value.trim();
      const d = deck.value;
      if (!f || !b) {
        setStatus(status, "Front and Back are required.", "error");
        return;
      }
      if (!d) {
        setStatus(status, "Pick a deck.", "error");
        return;
      }
      saveBtn.disabled = true;
      setStatus(status, "Saving to Anki…", "info");
      const host_tag = hostnameTag(pageUrl);
      let resp;
      try {
        resp = await sendMsg({
          type: "SAVE_CARD",
          payload: {
            front: f,
            back: b,
            deckName: d,
            tags: ["web-clip", host_tag].filter(Boolean),
            sourceUrl: pageUrl,
          },
        });
      } catch (e) {
        saveBtn.disabled = false;
        setStatus(status, `Extension error: ${e.message}. Try reopening the panel.`, "error");
        return;
      }
      saveBtn.disabled = false;
      if (!resp || resp.error) {
        setStatus(status, resp?.error || "Save failed.", "error");
        return;
      }
      chrome.storage.sync.get(["lastDeckByProfile"], ({ lastDeckByProfile }) => {
        const next = { ...(lastDeckByProfile || {}), [currentProfile]: d };
        chrome.storage.sync.set({ lastDeckByProfile: next });
      });
      setStatus(status, `Saved (note ${resp.noteId}). Closing…`, "success");
      setTimeout(() => host.remove(), 900);
    });

    (async () => {
      let profResp;
      try {
        profResp = await sendMsg({ type: "GET_PROFILES" });
      } catch (e) {
        setStatus(status, `Extension error: ${e.message}. Try reopening the panel.`, "error");
        return;
      }
      if (profResp?.error) {
        setStatus(status, `Anki not reachable: ${profResp.error}. Is Anki open with AnkiConnect installed?`, "error");
        return;
      }
      const profiles = profResp?.profiles || [];
      const { lastProfile } = await new Promise((r) =>
        chrome.storage.sync.get(["lastProfile"], r)
      );
      profile.innerHTML = "";
      for (const p of profiles) {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        profile.appendChild(opt);
      }
      currentProfile =
        (lastProfile && profiles.includes(lastProfile) && lastProfile) ||
        profiles[0] ||
        "";
      if (currentProfile) profile.value = currentProfile;

      if (currentProfile) {
        setStatus(status, `Loading Anki profile ${currentProfile}…`, "info");
        let swResp;
        try {
          swResp = await sendMsg({
            type: "SWITCH_PROFILE",
            payload: { name: currentProfile },
          });
        } catch (e) {
          setStatus(status, `Extension error: ${e.message}. Try reopening the panel.`, "error");
          return;
        }
        if (swResp?.error) {
          setStatus(status, `Could not load profile ${currentProfile}: ${swResp.error}`, "error");
          return;
        }
        chrome.storage.sync.set({ lastProfile: currentProfile });
      }

      const decks = await loadDecksForCurrentProfile();
      regenBtn.dataset.decks = JSON.stringify(decks);
      await generate(decks);
    })().catch((e) => {
      console.error("Anki panel initialization failed:", e);
      setStatus(status, `Initialization error: ${e.message}`, "error");
    });
  }

  function hostnameTag(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function makeDraggable(host, handle) {
    let dragging = false;
    let startX = 0, startY = 0;
    let origRight = 24, origTop = 24;
    handle.style.cursor = "move";
    handle.addEventListener("mousedown", (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = host.getBoundingClientRect();
      origTop = rect.top;
      origRight = window.innerWidth - rect.right;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      host.style.top = `${origTop + dy}px`;
      host.style.right = `${origRight - dx}px`;
    });
    window.addEventListener("mouseup", () => { dragging = false; });
  }

  function renderPanel({ selectionText, pageTitle }) {
    const preview = (selectionText || "").slice(0, 280);
    return `
<style>
  :host, * { box-sizing: border-box; }
  .afc {
    width: 380px;
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08);
    overflow: hidden;
  }
  .afc-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px;
    background: #f6f7f9;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    user-select: none;
  }
  .afc-title { font-weight: 600; font-size: 13px; }
  .afc-close {
    background: transparent; border: 0; cursor: pointer;
    font-size: 18px; line-height: 1; padding: 2px 6px; color: #555;
  }
  .afc-close:hover { color: #000; }
  .afc-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .afc-section-label {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
    color: #666; font-weight: 600;
  }
  .afc-preview {
    font-size: 12px; color: #555;
    background: #fafafa; border: 1px solid #eee; border-radius: 6px;
    padding: 8px; max-height: 80px; overflow: auto;
  }
  textarea, select {
    width: 100%; font: inherit; color: inherit;
    padding: 8px; border: 1px solid #d0d4da; border-radius: 6px;
    background: #fff; resize: vertical;
  }
  textarea:focus, select:focus { outline: none; border-color: #4f8cff; box-shadow: 0 0 0 2px rgba(79,140,255,0.2); }
  .afc-front { min-height: 52px; }
  .afc-back { min-height: 80px; }
  .afc-row { display: flex; gap: 8px; align-items: center; }
  .afc-row label { font-size: 12px; color: #444; min-width: 44px; }
  .afc-deck-hint { font-size: 11px; color: #2563eb; min-height: 14px; margin-top: -4px; }
  .afc-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
  button.afc-btn {
    font: inherit; padding: 7px 12px; border-radius: 6px; cursor: pointer; border: 1px solid transparent;
  }
  .afc-regen { background: #f1f3f6; border-color: #d0d4da; color: #1a1a1a; }
  .afc-regen:hover { background: #e7eaef; }
  .afc-save { background: #2563eb; color: #fff; }
  .afc-save:hover { background: #1d4ed8; }
  .afc-save:disabled, .afc-regen:disabled { opacity: 0.6; cursor: default; }
  .afc-status { font-size: 12px; min-height: 16px; }
  .afc-status[data-kind="error"] { color: #c0392b; }
  .afc-status[data-kind="success"] { color: #1f7a3a; }
  .afc-status[data-kind="info"] { color: #555; }
</style>
<div class="afc">
  <div class="afc-header">
    <div class="afc-title">New Anki flashcard</div>
    <button class="afc-close" title="Close">×</button>
  </div>
  <div class="afc-body">
    <div>
      <div class="afc-section-label">Highlighted</div>
      <div class="afc-preview">${escapeHtml(preview)}${selectionText && selectionText.length > 280 ? "…" : ""}</div>
    </div>
    <div>
      <div class="afc-section-label">Front</div>
      <textarea class="afc-front" placeholder="Question…"></textarea>
    </div>
    <div>
      <div class="afc-section-label">Back</div>
      <textarea class="afc-back" placeholder="Answer…"></textarea>
    </div>
    <div class="afc-row">
      <label for="profile">Profile</label>
      <select class="afc-profile" id="profile"></select>
    </div>
    <div class="afc-row">
      <label for="deck">Deck</label>
      <select class="afc-deck" id="deck"></select>
    </div>
    <div class="afc-deck-hint"></div>
    <div class="afc-status" data-kind="info">Generating…</div>
    <div class="afc-actions">
      <button class="afc-btn afc-regen">Regenerate</button>
      <button class="afc-btn afc-save">Save to Anki</button>
    </div>
  </div>
</div>
    `;
  }
})();
