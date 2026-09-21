import { resolvePages } from "./pages.ts";
import { buildSplitPage } from "./split-lib.ts";

async function main(): Promise<void> {
  const pages = await resolvePages(Bun.argv[2]);

  for (const page of pages) {
    try {
      const files = await buildSplitPage(page);
      console.log(
        `ok: split ${page} -> dist/split/${page}/ (${files.join(", ")})`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

await main();
