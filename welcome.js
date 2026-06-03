// Welcome / first-run setup flow.

const $ = (id) => document.getElementById(id);

function markDone(stepId) {
  $(stepId)?.classList.add("done");
}

function setStatus(el, text, kind) {
  el.textContent = text;
  el.dataset.kind = kind || "info";
}

// --- Step 1: AnkiConnect installed ---
$("open-ankiconnect").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://ankiweb.net/shared/info/2055492159" });
});
$("confirm-ankiconnect").addEventListener("click", () => {
  markDone("step-ankiconnect");
});

// --- Step 2: Request permission from AnkiConnect ---
$("grant-permission").addEventListener("click", async () => {
  const status = $("permission-status");
  setStatus(status, "Pinging Anki…", "info");
  let ping;
  try {
    ping = await sendMsg({ type: "ANKI_PING" });
  } catch (e) {
    setStatus(status, `Extension error: ${e.message}`, "error");
    return;
  }
  if (ping?.error) {
    setStatus(
      status,
      `Couldn't reach Anki. Make sure Anki desktop is open with AnkiConnect installed, then try again. (${ping.error})`,
      "error"
    );
    return;
  }
  setStatus(status, "Asking Anki to allow this extension — check Anki for a popup and click Yes.", "info");
  let resp;
  try {
    resp = await sendMsg({ type: "REQUEST_ANKI_PERMISSION" });
  } catch (e) {
    setStatus(status, `Extension error: ${e.message}`, "error");
    return;
  }
  if (resp?.error) {
    setStatus(status, `Failed: ${resp.error}`, "error");
    return;
  }
  const granted = resp?.result?.permission === "granted";
  if (granted) {
    setStatus(status, "✓ Connected. Anki will accept cards from this extension.", "success");
    markDone("step-permission");
  } else {
    setStatus(
      status,
      "Permission not granted. Open Anki's AnkiConnect config and add your extension origin to webCorsOriginList manually (see settings page), then click again.",
      "error"
    );
  }
});

// --- Step 3: AI provider ---
const providerEl = $("provider");
const geminiFields = $("gemini-fields");
const builtinFields = $("builtin-fields");
const keyEl = $("key");
const aiStatus = $("ai-status");

function applyProviderVisibility() {
  const p = providerEl.value;
  geminiFields.style.display = p === "gemini-api" ? "" : "none";
  builtinFields.style.display = p === "chrome-builtin" ? "" : "none";
}
providerEl.addEventListener("change", applyProviderVisibility);

$("save-ai").addEventListener("click", () => {
  const provider = providerEl.value;
  const payload = { aiProvider: provider };
  if (provider === "gemini-api") {
    const k = keyEl.value.trim();
    if (!k) {
      setStatus(aiStatus, "Paste your Gemini API key first, or switch to Chrome Built-in.", "error");
      return;
    }
    payload.geminiApiKey = k;
  }
  chrome.storage.sync.set(payload, () => {
    if (chrome.runtime.lastError) {
      setStatus(aiStatus, `Save failed: ${chrome.runtime.lastError.message}`, "error");
      return;
    }
    setStatus(aiStatus, "✓ Saved.", "success");
    markDone("step-ai");
  });
});

// --- Step 4: Preferences ---
const floatingEl = $("floating");
floatingEl.addEventListener("change", () => {
  chrome.storage.sync.set({ floatingButtonEnabled: floatingEl.checked }, () => {
    if (chrome.runtime.lastError) {
      console.warn("Failed to save floating button preference:", chrome.runtime.lastError.message);
    }
  });
});

// --- Step 5: Done ---
$("close-welcome").addEventListener("click", () => {
  window.close();
});

// --- Restore prior settings if the page is re-opened ---
chrome.storage.sync.get(
  ["aiProvider", "geminiApiKey", "floatingButtonEnabled", "onboardingAnkiconnectConfirmed", "onboardingPermissionGranted"],
  (s) => {
    if (chrome.runtime.lastError) {
      console.warn("Failed to restore settings:", chrome.runtime.lastError.message);
      return;
    }
    providerEl.value = s.aiProvider || "gemini-api";
    keyEl.value = s.geminiApiKey || "";
    floatingEl.checked = s.floatingButtonEnabled !== false;
    applyProviderVisibility();
    if (s.onboardingAnkiconnectConfirmed) markDone("step-ankiconnect");
    if (s.onboardingPermissionGranted) markDone("step-permission");
    if (s.aiProvider) markDone("step-ai");
  }
);

// Persist progress checkpoints when steps complete.
new MutationObserver(() => {
  const updates = {};
  if ($("step-ankiconnect").classList.contains("done")) updates.onboardingAnkiconnectConfirmed = true;
  if ($("step-permission").classList.contains("done")) updates.onboardingPermissionGranted = true;
  if (Object.keys(updates).length) chrome.storage.sync.set(updates);
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });

function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (r) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(r);
      }
    });
  });
}
