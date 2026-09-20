import { join, relative } from "node:path";
import { entryFor, pagesDir, resolvePages, root } from "./pages.ts";

const outRoot = join(root, "dist", "split");

async function main(): Promise<void> {
  const pages = await resolvePages(Bun.argv[2]);

  for (const page of pages) {
    const entry = await entryFor(page);
    const outDir = join(outRoot, page);

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
      console.error(`Build failed: ${page}`);
      process.exit(1);
    }

    const files = result.outputs
      .map((output) => relative(outDir, output.path))
      .sort();

    console.log(
      `ok: split ${page} -> dist/split/${page}/ (${files.join(", ")})`,
    );
  }
}

await main();
