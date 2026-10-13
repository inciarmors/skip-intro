import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
await mkdir(new URL("../artifacts/", import.meta.url), { recursive: true });
for (const browser of ["chrome", "firefox"]) {
  const output = fileURLToPath(new URL(`../artifacts/skip-intro-${browser}.zip`, import.meta.url));
  await rm(output, { force: true });
  execFileSync("zip", ["-qr", output, "."], { cwd: new URL(`../dist/${browser}/`, import.meta.url) });
  console.log(output);
}
