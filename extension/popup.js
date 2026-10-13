const api = globalThis.browser || globalThis.chrome;
const enabled = document.getElementById("enabled");
const state = document.getElementById("state");
const status = document.getElementById("status");
const catalogStatus = document.getElementById("catalog-status");
let pollTimer = null, statusRevision = 0;
const providerNames = { introdb: "IntroDB", theintrodb: "TheIntroDB", skipdb: "SkipDB", aniskip: "AniSkip" };
const catalogMessages = {
  ready: "Timing available. The button appears during the intro when the player can seek.",
  "not-found": "No intro timing was found in the available catalogs. Player signals and local learning remain available.",
  "missing-identity": "The page does not expose a supported show and episode identity.",
  unavailable: "A catalog could not be reached or returned invalid data, and no fallback timing is available. Retrying shortly.",
  "rate-limited": "A catalog asked us to wait, and no fallback timing is available. Retrying automatically.",
  waiting: "Waiting for a visible video. Reload the page after updating the extension.",
  disabled: "Detection is paused."
};
async function refreshCatalog() {
  if (enabled.disabled) return;
  if (!api.runtime?.sendMessage) { catalogStatus.textContent = catalogMessages.waiting; return; }
  if (!enabled.checked) { catalogStatus.textContent = catalogMessages.disabled; return; }
  try {
    const revision = statusRevision;
    const value = await api.runtime.sendMessage({ type: "skip-intro:status" });
    if (revision !== statusRevision || !enabled.checked) return;
    const episode = value?.episode;
    const label = episode ? `S${episode.season}:E${episode.episode} · ` : "";
    const provider = value?.status === "ready" ? `${providerNames[value.provider] || "Catalog"} · ` : "";
    catalogStatus.textContent = label + provider + (catalogMessages[value?.status] || catalogMessages.waiting);
  } catch { if (enabled.checked) catalogStatus.textContent = catalogMessages.unavailable; }
}
const render = () => {
  state.textContent = enabled.checked ? "Enabled on allowed sites" : "Detection is paused";
  clearInterval(pollTimer); pollTimer = null;
  if (enabled.checked) pollTimer = setInterval(refreshCatalog, 2000);
  else catalogStatus.textContent = catalogMessages.disabled;
};
api.storage.local.get("enabled").then(data => {
  enabled.checked = data.enabled !== false;
  enabled.disabled = false;
  render();
  void refreshCatalog();
}).catch(() => { status.textContent = "Unable to read settings. Reopen this popup to try again."; });
enabled.addEventListener("change", async () => {
  statusRevision++;
  enabled.disabled = true;
  try {
    await api.storage.local.set({ enabled: enabled.checked });
    status.textContent = "";
  } catch {
    enabled.checked = !enabled.checked;
    status.textContent = "Unable to save this setting.";
  } finally { enabled.disabled = false; render(); void refreshCatalog(); }
});
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.enabled) return;
  statusRevision++; enabled.checked = changes.enabled.newValue !== false;
  render();
});
window.addEventListener("pagehide", () => { clearInterval(pollTimer); statusRevision++; });
