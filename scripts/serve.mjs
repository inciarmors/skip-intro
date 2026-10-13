import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const routes = new Map([
  ["/", ["../demo/index.html", "text/html"]],
  ["/demo.js", ["../demo/demo.js", "text/javascript"]],
  ["/core.js", ["../extension/core.js", "text/javascript"]],
  ["/content.js", ["../extension/content.js", "text/javascript"]],
  ["/popup.html", ["../extension/popup.html", "text/html"]],
  ["/popup.css", ["../extension/popup.css", "text/css"]],
  ["/popup.js", ["../extension/popup.js", "text/javascript"]]
]);
createServer(async (req, res) => {
  const route = routes.get(new URL(req.url, "http://localhost").pathname);
  if (!route) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { "Content-Type": route[1], "Cache-Control": "no-store" }); res.end(await readFile(new URL(route[0], import.meta.url))); }
  catch { res.writeHead(500).end(); }
}).listen(4173, "127.0.0.1", () => console.log("Demo: http://127.0.0.1:4173"));
