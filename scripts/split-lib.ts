import { rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { entryFor, pagesDir, root } from "./pages.ts";

export const splitOutRoot = join(root, "dist", "split");

export function splitOutDir(page: string): string {
  return join(splitOutRoot, page);
}

/** Build one page in split mode. Returns output files relative to the page out dir. Throws on failure. */
export async function buildSplitPage(page: string): Promise<string[]> {
  const entry = await entryFor(page);
  const outDir = splitOutDir(page);

  // Asset file names are content-hashed, so clear stale outputs first.
  await rm(outDir, { recursive: true, force: true });

  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    root: join(pagesDir, page),
    target: "browser",
    minify: true,
    naming: { asset: "[dir]/[name]-[hash].[ext]" },
  });

  if (!result.success || result.outputs.length === 0) {
    for (const log of result.logs) console.error(log);
    throw new Error(`Build failed: ${page}`);
  }

  return result.outputs.map((output) => relative(outDir, output.path)).sort();
}
