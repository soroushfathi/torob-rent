// Fetch locked Linux dependencies on the connected workstation. Never include local .env files.
import { mkdir, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".local/linux-deps", { recursive: true });
await copyFile("package.json", ".local/linux-deps/package.json");
await copyFile("package-lock.json", ".local/linux-deps/package-lock.json");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npm,
  [
    "ci",
    "--prefix",
    ".local/linux-deps",
    "--os=linux",
    "--cpu=x64",
    "--include=dev",
    "--ignore-scripts",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
if (result.status) process.exit(result.status);
console.log(
  "Locked Linux dependencies ready at .local/linux-deps/node_modules. Archive for offline server build as documented.",
);
