import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function unzipTo(zipPath: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "pipe" });
}

export function extractMembers(zipPath: string, destDir: string, members: string[]): string[] {
  fs.mkdirSync(destDir, { recursive: true });
  const copied: string[] = [];
  for (const member of members) {
    try {
      execFileSync("tar", ["-xf", zipPath, "-C", destDir, member], { stdio: "pipe" });
      const found = findFileNamed(destDir, (n) => n.toLowerCase() === member.toLowerCase());
      if (found) copied.push(found);
    } catch {
      // member absent from this archive
    }
  }
  return copied;
}

export function findExtractedDataCsv(dir: string): string | undefined {
  const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  return names
    .filter((n) => /^API_.*\.csv$/i.test(n) && !/^Metadata_/i.test(n))
    .map((n) => path.join(dir, n))[0];
}

export function findFileNamed(dir: string, predicate: (name: string) => boolean): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (predicate(name)) return full;
    }
  }
  return undefined;
}
