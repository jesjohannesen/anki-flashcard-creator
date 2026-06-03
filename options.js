const keyEl = document.getElementById("key");
const modelEl = document.getElementById("model");
const floatingEl = document.getElementById("floating");
const statusEl = document.getElementById("status");
const originEl = document.getElementById("origin");
const providerEl = document.getElementById("provider");
const providerHintEl = document.getElementById("provider-hint");
const geminiKeyRow = document.getElementById("gemini-key-row");

originEl.value = `chrome-extension://${chrome.runtime.id}`;

const PROVIDER_HINTS = {
  "gemini-api":
    "Cloud-hosted Gemini 2.5 Flash. Best quality. Free tier has daily request limits — switch providers if you hit them.",
  "chrome-builtin":
    "Gemini Nano runs locally in Chrome. Free and unlimited. Requires Chrome 138+, ~22GB free disk, GPU with 4GB+ VRAM, and enabling chrome://flags/#prompt-api-for-gemini-nano + chrome://flags/#optimization-guide-on-device-model. First use downloads a ~2GB model. Quality is lower than the cloud option.",
};

function applyProviderUi() {
  const p = providerEl.value;
  providerHintEl.textContent = PROVIDER_HINTS[p] || "";
  geminiKeyRow.style.display = p === "gemini-api" ? "" : "none";
}

providerEl.addEventListener("change", () => {
  applyProviderUi();
  // Persist immediately so the change takes effect without needing to click Save.
  chrome.storage.sync.set({ aiProvider: providerEl.value }, () => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = `Failed to save provider: ${chrome.runtime.lastError.message}`;
      return;
    }
    statusEl.textContent = `Provider set to ${providerEl.options[providerEl.selectedIndex].textContent}.`;
    setTimeout(() => (statusEl.textContent = ""), 2000);
  });
});

floatingEl.addEventListener("change", () => {
  chrome.storage.sync.set({ floatingButtonEnabled: floatingEl.checked }, () => {
    if (chrome.runtime.lastError) {
      console.warn("Failed to save floating button preference:", chrome.runtime.lastError.message);
    }
  });
});

chrome.storage.sync.get(
  ["modelName", "floatingButtonEnabled", "aiProvider"],
  ({ modelName, floatingButtonEnabled, aiProvider }) => {
    modelEl.value = modelName || "Basic";
    floatingEl.checked = floatingButtonEnabled !== false;
    providerEl.value = aiProvider || "gemini-api";
    applyProviderUi();
  }
);
chrome.storage.local.get(["geminiApiKey"], ({ geminiApiKey }) => {
  keyEl.value = geminiApiKey || "";
});

document.getElementById("save").addEventListener("click", () => {
  const geminiApiKey = keyEl.value.trim();
  const modelName = modelEl.value.trim() || "Basic";
  const floatingButtonEnabled = floatingEl.checked;
  const aiProvider = providerEl.value;
  chrome.storage.local.set({ geminiApiKey });
  chrome.storage.sync.set(
    { modelName, floatingButtonEnabled, aiProvider },
    () => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = `Save failed: ${chrome.runtime.lastError.message}`;
        return;
      }
      statusEl.textContent = "Saved.";
      setTimeout(() => (statusEl.textContent = ""), 1500);
    }
  );
});
