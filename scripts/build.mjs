import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
const base = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url)));
for (const browser of ["chrome", "firefox"]) {
  const target = new URL(`../dist/${browser}/`, import.meta.url);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(new URL("../extension/", import.meta.url), target, { recursive: true });
  const manifest = structuredClone(base);
  manifest.background = browser === "firefox" ? { scripts: ["background.js"] } : { service_worker: "background.js" };
  if (browser === "firefox") manifest.browser_specific_settings = {
    gecko: { id: "skip-intro@inciarmors", strict_min_version: "142.0", data_collection_permissions: { required: ["none"] } }
  };
  else manifest.minimum_chrome_version = "120";
  await writeFile(new URL("manifest.json", target), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Built dist/${browser}`);
}
