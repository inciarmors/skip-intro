const api = globalThis.browser || globalThis.chrome;
const enabled = document.getElementById("enabled");
const state = document.getElementById("state");
const status = document.getElementById("status");
const render = () => { state.textContent = enabled.checked ? "Enabled on allowed sites" : "Detection is paused"; };
api.storage.local.get("enabled").then(data => {
  enabled.checked = data.enabled !== false;
  enabled.disabled = false;
  render();
}).catch(() => { status.textContent = "Unable to read settings. Reopen this popup to try again."; });
enabled.addEventListener("change", async () => {
  enabled.disabled = true;
  try {
    await api.storage.local.set({ enabled: enabled.checked });
    status.textContent = "";
  } catch {
    enabled.checked = !enabled.checked;
    status.textContent = "Unable to save this setting.";
  } finally { enabled.disabled = false; render(); }
});
