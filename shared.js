// Shared utilities used across background, content, and welcome scripts.

/**
 * Escape a string for safe insertion into HTML.
 */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/**
 * Update a status element's text and data-kind attribute.
 */
function setStatus(el, text, kind) {
  el.textContent = text;
  el.dataset.kind = kind || "info";
}

/**
 * Send a message to the background service worker and return the response.
 */
function sendMsg(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r)));
}
