import fs from "node:fs";
import path from "node:path";
import { countrySilhouette } from "../../apps/web/src/lib/profile/silhouette.ts";

export function writeSilhouettes(
  entities: { id: string; commonName: string }[],
  destDir: string,
): { written: number; missing: string[] } {
  fs.mkdirSync(destDir, { recursive: true });
  const missing: string[] = [];
  let written = 0;
  for (const entity of entities) {
    const sil = countrySilhouette(entity.id, entity.commonName);
    if (!sil) {
      missing.push(entity.id);
      continue;
    }
    fs.writeFileSync(path.join(destDir, `${entity.id}.svg`), sil.svg);
    written += 1;
  }
  return { written, missing };
}
