const api = globalThis.browser || globalThis.chrome;
const enabled = document.getElementById("enabled");
const state = document.getElementById("state");
const status = document.getElementById("status");
const catalogStatus = document.getElementById("catalog-status");
const catalogMessages = {
  ready: "IntroDB timing available. The button appears during the intro when the player can seek.",
  "not-found": "This episode has no intro timing in IntroDB. Player signals and local learning remain available.",
  "missing-identity": "The page does not expose a supported show and episode identity.",
  unavailable: "IntroDB could not be reached or returned an invalid response. Retrying shortly.",
  "rate-limited": "IntroDB asked us to wait. Requests will resume automatically.",
  waiting: "Waiting for a visible video. Reload the page after updating the extension.",
  disabled: "Detection is paused."
};
async function refreshCatalog() {
  if (!api.runtime?.sendMessage) { catalogStatus.textContent = catalogMessages.waiting; return; }
  if (!enabled.checked) { catalogStatus.textContent = catalogMessages.disabled; return; }
  try {
    const value = await api.runtime.sendMessage({ type: "skip-intro:status" });
    const episode = value?.episode;
    const label = episode ? `S${episode.season}:E${episode.episode} · ` : "";
    catalogStatus.textContent = label + (catalogMessages[value?.status] || catalogMessages.waiting);
  } catch { catalogStatus.textContent = catalogMessages.unavailable; }
}
const render = () => { state.textContent = enabled.checked ? "Enabled on allowed sites" : "Detection is paused"; };
api.storage.local.get("enabled").then(data => {
  enabled.checked = data.enabled !== false;
  enabled.disabled = false;
  render();
  void refreshCatalog();
}).catch(() => { status.textContent = "Unable to read settings. Reopen this popup to try again."; });
enabled.addEventListener("change", async () => {
  enabled.disabled = true;
  try {
    await api.storage.local.set({ enabled: enabled.checked });
    status.textContent = "";
  } catch {
    enabled.checked = !enabled.checked;
    status.textContent = "Unable to save this setting.";
  } finally { enabled.disabled = false; render(); void refreshCatalog(); }
});
setInterval(refreshCatalog, 2000);
