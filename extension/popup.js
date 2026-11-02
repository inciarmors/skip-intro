const api = globalThis.browser || globalThis.chrome;
const enabled = document.getElementById("enabled");
const state = document.getElementById("state");
const status = document.getElementById("status");
const catalogStatus = document.getElementById("catalog-status");
let pollTimer = null, statusRevision = 0;
const providerNames = { introdb: "IntroDB", theintrodb: "TheIntroDB", skipdb: "SkipDB", aniskip: "AniSkip", "anime-skip": "Anime Skip" };
const catalogMessages = {
  ready: "Timing available. The button appears during the intro when the player can seek.",
  "not-found": "No intro timing was found in the available catalogs. Player signals and local learning remain available.",
  "missing-identity": "Could not identify the series, season and episode unambiguously. No catalog timing can be requested without them.",
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
    const identifier = episode?.imdbId || (episode?.tmdbId ? `TMDB ${episode.tmdbId}` : episode?.malId ? `MAL ${episode.malId}` : episode?.anilistId ? `AniList ${episode.anilistId}` : "");
    const label = episode ? `${identifier} · S${episode.season}:E${episode.episode} · ` : "";
    const provider = value?.status === "ready" ? `${providerNames[value.provider] || "Catalog"} · ` : "";
    const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
    const intervals = value?.status === "ready" && Array.isArray(value.intros) ? value.intros.filter(intro => Number.isFinite(intro.start) && Number.isFinite(intro.end)).slice(0, 3).map(intro => `${clock(intro.start)}–${clock(intro.end)}`).join(", ") : "";
    catalogStatus.textContent = label + provider + (intervals ? `Intro ${intervals}. ` : "") + (catalogMessages[value?.status] || catalogMessages.waiting);
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

const positionControls = document.getElementById("position-controls");
const preset = document.getElementById("position-preset");
const positionX = document.getElementById("position-x"), positionY = document.getElementById("position-y");
const positionStatus = document.getElementById("position-status");
const normalizePosition = globalThis.SkipIntroCore.normalizePosition;
const corners = { "top-left": [0, 0], "top-right": [100, 0], "bottom-left": [0, 100], "bottom-right": [100, 100] };
let position = normalizePosition(), positionRevision = 0, positionWriting = false, pendingPosition = null;
function renderPosition() {
  preset.value = position.mode === "auto" ? "auto" : Object.keys(corners).find(key => corners[key][0] === position.x && corners[key][1] === position.y) || "custom";
  positionX.value = position.x; positionY.value = position.y;
  document.getElementById("position-x-value").value = `${position.x}%`;
  document.getElementById("position-y-value").value = `${position.y}%`;
  const marker = document.getElementById("position-marker");
  const x = position.mode === "auto" ? 100 : position.x, y = position.mode === "auto" ? 75 : position.y;
  marker.style.left = `calc(${x}% + ${6 - 90 * x / 100}px)`;
  marker.style.top = `calc(${y}% + ${6 - 34 * y / 100}px)`;
}
async function savePosition(value) {
  positionRevision++;
  position = normalizePosition(value); pendingPosition = position;
  renderPosition();
  if (positionWriting) return;
  positionWriting = true;
  // Coalesce rapid slider updates; the latest selection is always written last.
  while (pendingPosition) {
    const next = pendingPosition; pendingPosition = null;
    try {
      await api.storage.local.set({ buttonPosition: next });
      positionStatus.textContent = "Position saved.";
    } catch { positionStatus.textContent = "Unable to save position. Change a control to retry."; }
  }
  positionWriting = false;
}
api.storage.local.get("buttonPosition").then(data => {
  if (!positionRevision) { position = normalizePosition(data.buttonPosition); renderPosition(); }
  positionControls.disabled = false;
}).catch(() => { positionStatus.textContent = "Unable to read position settings. Reopen this popup to try again."; });
preset.addEventListener("change", () => {
  const corner = corners[preset.value];
  void savePosition({ mode: preset.value === "auto" ? "auto" : "custom", x: corner?.[0] ?? position.x, y: corner?.[1] ?? position.y });
});
for (const slider of [positionX, positionY]) slider.addEventListener("input", () => {
  void savePosition({ mode: "custom", x: Number(positionX.value), y: Number(positionY.value) });
});
document.getElementById("position-reset").addEventListener("click", () => { void savePosition(normalizePosition()); });
api.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.buttonPosition || positionWriting) return;
  positionRevision++;
  position = normalizePosition(changes.buttonPosition.newValue); renderPosition();
});
