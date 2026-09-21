import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pagesDir } from "./pages.ts";

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-_]*$/;

function printUsage(): void {
  console.log("Usage: bun run new -- <page-name>");
  console.log("Example: bun run new -- my-page");
}

function normalizeName(raw: string): string {
  const name = raw
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^pages\//, "")
    .replace(/\/+$/, "");
  if (!name) {
    console.error("Missing page name.");
    printUsage();
    process.exit(1);
  }
  if (name.includes("/")) {
    console.error(
      `Invalid page name "${raw}": only a direct child of pages/ is allowed (e.g. my-page).`,
    );
    process.exit(1);
  }
  if (!NAME_PATTERN.test(name)) {
    console.error(
      `Invalid page name "${raw}": use letters, digits, "-" or "_", starting with a letter or digit (names starting with "." or "_" are skipped by the build).`,
    );
    process.exit(1);
  }
  return name;
}

function toTitle(name: string): string {
  return name
    .split(/[-_]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function htmlTemplate(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main>
      <h1>${title}</h1>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
`;
}

function cssTemplate(): string {
  return `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  min-width: 100vw;
  background: transparent;
}

main {
  min-height: 100vh;
  min-width: 100vw;
  background: transparent;
}
`;
}

async function main(): Promise<void> {
  const raw = Bun.argv[2];
  if (!raw) {
    printUsage();
    process.exit(1);
  }
  if (raw === "--help" || raw === "-h") {
    printUsage();
    process.exit(0);
  }

  const name = normalizeName(raw);
  const dir = join(pagesDir, name);

  const existing = await Promise.all(
    ["index.html", "main.ts", "style.css"].map((file) =>
      Bun.file(join(dir, file)).exists(),
    ),
  );
  if (existing.some(Boolean)) {
    console.error(
      `Page "${name}" already exists: pages/${name}/ already contains files. Refusing to overwrite.`,
    );
    process.exit(1);
  }

  const title = toTitle(name);
  await mkdir(dir, { recursive: false });
  await Bun.write(join(dir, "index.html"), htmlTemplate(title));
  await Bun.write(join(dir, "main.ts"), "");
  await Bun.write(join(dir, "style.css"), cssTemplate());
  console.log(
    `ok: new ${name} -> pages/${name}/ (index.html, main.ts, style.css)`,
  );
}

await main();
