import fs from "node:fs";
import crypto from "node:crypto";

export function sha256File(file: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

export function readSha256Sidecar(file: string): string | undefined {
  const sidecar = `${file}.sha256`;
  if (!fs.existsSync(sidecar)) return undefined;
  const text = fs.readFileSync(sidecar, "utf8").trim().split(/\s+/)[0];
  return text && /^[a-f0-9]{64}$/i.test(text) ? text.toLowerCase() : undefined;
}

export function writeSha256Sidecar(file: string, hash: string): void {
  const name = file.replace(/^.*[/\\]/, "");
  fs.writeFileSync(`${file}.sha256`, `${hash}  ${name}\n`, "utf8");
}
