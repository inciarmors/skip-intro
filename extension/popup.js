const api = globalThis.browser || globalThis.chrome;
const enabled = document.getElementById("enabled");
const status = document.getElementById("status");
api.storage.local.get("enabled").then(data => { enabled.checked = data.enabled !== false; }).catch(() => { status.textContent = "Unable to read settings."; });
enabled.addEventListener("change", async () => {
  try { await api.storage.local.set({ enabled: enabled.checked }); }
  catch { status.textContent = "Unable to save this setting."; }
});
document.getElementById("clear").addEventListener("click", async () => {
  try {
    const data = await api.storage.local.get(null);
    const keys = Object.keys(data).filter(key => key.startsWith("intro:"));
    await api.storage.local.remove(keys);
    status.textContent = `${keys.length} saved timings cleared.`;
  } catch { status.textContent = "Unable to clear saved timings."; }
});
