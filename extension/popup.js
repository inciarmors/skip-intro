const api = globalThis.browser || globalThis.chrome;
const enabled = document.getElementById("enabled");
const status = document.getElementById("status");
api.storage.local.get("enabled").then(data => { enabled.checked = data.enabled !== false; }).catch(() => { status.textContent = "Impossibile leggere le impostazioni."; });
enabled.addEventListener("change", async () => {
  try { await api.storage.local.set({ enabled: enabled.checked }); }
  catch { status.textContent = "Impossibile salvare l’impostazione."; }
});
document.getElementById("clear").addEventListener("click", async () => {
  try {
    const data = await api.storage.local.get(null);
    const keys = Object.keys(data).filter(key => key.startsWith("intro:"));
    await api.storage.local.remove(keys);
    status.textContent = `${keys.length} intervalli cancellati.`;
  } catch { status.textContent = "Impossibile cancellare gli intervalli."; }
});
