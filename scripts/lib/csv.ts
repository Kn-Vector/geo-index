import fs from "node:fs";
import readline from "node:readline";

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function stripBom(line: string): string {
  return line.replace(/^\uFEFF/, "");
}

export function rowToRecord(header: string[], cols: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (let i = 0; i < header.length; i++) {
    rec[header[i]!] = cols[i] ?? "";
  }
  return rec;
}

export function parseCsvText(text: string): { header: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\n/).map((l) => stripBom(l.replace(/\r$/, "")));
  const nonempty = lines.filter((l) => l.length > 0);
  if (!nonempty.length) return { header: [], rows: [] };
  const header = parseCsvLine(nonempty[0]!);
  const rows = nonempty.slice(1).map((line) => rowToRecord(header, parseCsvLine(line)));
  return { header, rows };
}

export async function streamCsvFile(
  file: string,
  onRow: (rec: Record<string, string>) => void,
): Promise<void> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  let header: string[] | undefined;
  for await (const raw of rl) {
    const line = stripBom(String(raw).replace(/\r$/, ""));
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    onRow(rowToRecord(header, parseCsvLine(line)));
  }
}
