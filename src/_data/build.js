// Asset version for cache-busting: a hash of the CSS/JS contents, so it only changes when they do.
import fs from "node:fs";
import crypto from "node:crypto";

export default function () {
  const files = [...fs.readdirSync("./src/assets/css").map((f) => `./src/assets/css/${f}`), ...fs.readdirSync("./src/js").map((f) => `./src/js/${f}`)];
  const hash = crypto.createHash("sha1");
  for (const f of files) hash.update(fs.readFileSync(f));
  return { version: hash.digest("hex").slice(0, 10) };
}
