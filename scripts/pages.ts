import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export const root = resolve(import.meta.dir, "..");
export const pagesDir = join(root, "pages");

function normalizePage(arg: string): string {
  const p = arg.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  return p.replace(/^pages\//, "");
}

async function discoverPages(): Promise<string[]> {
  const entries = await readdir(pagesDir);
  const pages: string[] = [];
  for (const name of entries) {
    if (name.startsWith(".") || name.startsWith("_")) continue;
    const dir = join(pagesDir, name);
    try {
      if (!(await stat(dir)).isDirectory()) continue;
    } catch {
      continue;
    }
    if (await Bun.file(join(dir, "index.html")).exists()) {
      pages.push(name);
    }
  }
  return pages.sort();
}

export async function resolvePages(
  rawArg: string | undefined,
): Promise<string[]> {
  const arg = !rawArg || rawArg === "--all" ? rawArg : normalizePage(rawArg);
  const pages = !arg || arg === "--all" ? await discoverPages() : [arg];

  if (pages.length === 0) {
    console.error("No pages found (expected pages/<name>/index.html).");
    process.exit(1);
  }
  return pages;
}

export async function entryFor(page: string): Promise<string> {
  const entry = join(pagesDir, page, "index.html");
  if (!(await Bun.file(entry).exists())) {
    console.error(`Missing entry: pages/${page}/index.html`);
    process.exit(1);
  }
  return entry;
}
