import { join } from "node:path";
import { entryFor, resolvePages, root } from "./pages.ts";

const outDir = join(root, "dist", "single");

const SIZE_WARN_BYTES = 1_000_000;
const RELATIVE_ASSET_ATTR =
  /\b(?:src|srcset|poster)\s*=\s*["'](?!data:|https?:|\/\/|#)/gi;
const RELATIVE_CSS_URL = /url\(\s*["']?(?!data:|https?:|\/\/|#)/gi;

function findUninlined(html: string): string[] {
  return [
    ...html.matchAll(RELATIVE_ASSET_ATTR),
    ...html.matchAll(RELATIVE_CSS_URL),
  ].map((match) => match[0]);
}

async function main(): Promise<void> {
  const pages = await resolvePages(Bun.argv[2]);

  for (const page of pages) {
    const entry = await entryFor(page);

    const result = await Bun.build({
      entrypoints: [entry],
      compile: true,
      target: "browser",
      minify: true,
    });

    if (!result.success || result.outputs.length === 0) {
      for (const log of result.logs) console.error(log);
      console.error(`Build failed: ${page}`);
      process.exit(1);
    }

    const artifact = result.outputs.find((output) =>
      output.path.endsWith(".html"),
    );
    if (!artifact) {
      const found = result.outputs.map((output) => output.path).join(", ");
      console.error(
        `No HTML output for ${page} (got: ${found || "none"}). Expected a standalone HTML file.`,
      );
      process.exit(1);
    }

    const html = await artifact.text();

    const uninlined = findUninlined(html);
    if (uninlined.length > 0) {
      console.warn(
        `warn: ${page} left ${uninlined.length} relative reference(s) un-inlined ` +
          `(${uninlined.slice(0, 3).join(", ")}) — output is not self-contained.`,
      );
    }

    if (html.length > SIZE_WARN_BYTES) {
      const mb = (html.length / 1024 / 1024).toFixed(2);
      console.warn(
        `warn: ${page} is ${mb} MB — large assets inlined as base64 add ~33%; consider compressing them.`,
      );
    }

    await Bun.write(join(outDir, `${page}.html`), html);
    console.log(`ok: single ${page} -> dist/single/${page}.html`);
  }
}

await main();
