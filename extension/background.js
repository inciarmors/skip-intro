/* Share only the owning tab's title with this extension's embedded player frames. */
const api = globalThis.browser || globalThis.chrome;
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "skip-intro:tab-context" || sender.id !== api.runtime.id || !Number.isInteger(sender.tab?.id)) return false;
  api.tabs.get(sender.tab.id).then(tab => {
    respond({ title: typeof tab.title === "string" ? tab.title.slice(0, 500) : "" });
  }).catch(() => respond({ title: "" }));
  return true;
});
