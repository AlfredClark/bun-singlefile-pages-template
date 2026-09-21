import { watch, type FSWatcher } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { discoverPages, pagesDir } from "./pages.ts";
import { buildSplitPage, splitOutRoot } from "./split-lib.ts";

const DEFAULT_PORT = 3000;
const DEBOUNCE_MS = 150;
const RELOAD_TOPIC = "reload";

const RELOAD_SCRIPT = `<script>(function(){var u="ws://"+location.host+"/_livereload";function c(){var w=new WebSocket(u);w.onmessage=function(e){if(e.data==="reload")location.reload()};w.onclose=function(){setTimeout(c,500)}}c()})();</script>`;

function printUsage(): void {
  console.log("Usage: bun run dev [--port=<n>] [-- <page>]");
  console.log("Example: bun run dev -- --port=4000 clock");
}

function parseArgs(): { port: number; pageArg: string | undefined } {
  let port = DEFAULT_PORT;
  let pageArg: string | undefined;
  for (const arg of Bun.argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg.startsWith("--port=")) {
      const n = Number(arg.slice("--port=".length));
      if (!Number.isInteger(n) || n <= 0 || n > 65535) {
        console.error(`Invalid port: "${arg}". Expected --port=<1-65535>.`);
        process.exit(1);
      }
      port = n;
    } else if (pageArg === undefined) {
      pageArg = arg;
    } else {
      console.error(`Unexpected argument: "${arg}".`);
      printUsage();
      process.exit(1);
    }
  }
  return { port, pageArg };
}

function contentType(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

function withReload(html: string): string {
  if (html.includes("</body>")) {
    return html.replace("</body>", `${RELOAD_SCRIPT}</body>`);
  }
  return html + RELOAD_SCRIPT;
}

async function serveFile(
  absPath: string,
  inject: boolean,
): Promise<Response | null> {
  const file = Bun.file(absPath);
  if (!(await file.exists())) return null;
  if (inject) {
    return new Response(withReload(await file.text()), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(file, {
    headers: { "Content-Type": contentType(absPath) },
  });
}

function indexPage(pages: string[]): Response {
  const items = pages
    .map((page) => `<li><a href="/${page}/">${page}</a></li>`)
    .join("\n");
  return new Response(
    withReload(
      `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>dev</title></head><body><h1>Pages</h1><ul>${items}</ul></body></html>`,
    ),
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/** Current dev targets: the requested page, or every discovered page in --all mode. */
async function currentTargets(pageArg: string | undefined): Promise<string[]> {
  if (pageArg !== undefined) {
    if (await Bun.file(join(pagesDir, pageArg, "index.html")).exists()) {
      return [pageArg];
    }
    console.error(`Missing entry: pages/${pageArg}/index.html`);
    return [];
  }
  const all = await discoverPages();
  if (all.length === 0) {
    console.error("No pages found (expected pages/<name>/index.html).");
  }
  return all;
}

async function buildPages(pages: string[]): Promise<boolean> {
  let ok = true;
  for (const page of pages) {
    try {
      const files = await buildSplitPage(page);
      console.log(
        `ok: split ${page} -> dist/split/${page}/ (${files.join(", ")})`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      ok = false;
    }
  }
  return ok;
}

function shouldIgnore(absPath: string): boolean {
  const base = absPath.slice(absPath.lastIndexOf(sep) + 1);
  return (
    base.startsWith(".") ||
    base.endsWith("~") ||
    base.endsWith(".swp") ||
    base.endsWith(".tmp")
  );
}

async function main(): Promise<void> {
  const { port, pageArg } = parseArgs();
  let targets = await currentTargets(pageArg);
  if (targets.length === 0) process.exit(1);
  await buildPages(targets);

  const server = Bun.serve({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/_livereload") {
        if (server.upgrade(req)) return undefined;
        return new Response("WebSocket upgrade failed.", { status: 500 });
      }
      if (url.pathname === "/") return indexPage(targets);

      const raw = url.pathname;
      if (raw.includes("..") || raw.includes("\\") || raw.includes("\0")) {
        return new Response("Bad request.", { status: 400 });
      }
      const segs = raw.split("/").filter((s) => s.length > 0);
      const page = segs[0];
      if (page === undefined || !targets.includes(page)) {
        return new Response("Not found.", { status: 404 });
      }
      const rest = segs.slice(1);
      if (rest.length === 0 && !raw.endsWith("/")) {
        return new Response(null, {
          status: 302,
          headers: { Location: `/${page}/` },
        });
      }
      const rel = rest.length === 0 ? "index.html" : join(...rest);
      const absPath = join(splitOutRoot, page, rel);
      if (relative(splitOutRoot, absPath).startsWith("..")) {
        return new Response("Bad request.", { status: 400 });
      }
      const res = await serveFile(absPath, absPath.endsWith(".html"));
      return res ?? new Response("Not found.", { status: 404 });
    },
    websocket: {
      open(ws) {
        ws.subscribe(RELOAD_TOPIC);
      },
      message() {},
    },
  });

  // node:fs watch has no recursive mode on Linux, so watch every
  // directory under pages/ individually, plus pages/ itself for add/remove.
  const watchers = new Map<string, FSWatcher>();

  async function collectDirs(dir: string): Promise<string[]> {
    const dirs = [dir];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      dirs.push(...(await collectDirs(join(dir, entry.name))));
    }
    return dirs;
  }

  async function syncWatchers(): Promise<void> {
    const wanted = new Set<string>([pagesDir]);
    for (const page of targets) {
      for (const dir of await collectDirs(join(pagesDir, page))) {
        wanted.add(dir);
      }
    }
    for (const [dir, watcher] of watchers) {
      if (!wanted.has(dir)) {
        watcher.close();
        watchers.delete(dir);
      }
    }
    for (const dir of wanted) {
      if (!watchers.has(dir)) {
        watchers.set(
          dir,
          watch(dir, (_event, filename) => {
            handleFsEvent(
              typeof filename === "string" ? join(dir, filename) : dir,
            );
          }),
        );
      }
    }
  }

  async function settleFsEvents(paths: string[]): Promise<void> {
    targets = await currentTargets(pageArg);
    await syncWatchers();
    if (targets.length === 0) return;

    const affected = new Set<string>();
    for (const absPath of paths) {
      const rel = relative(pagesDir, absPath);
      if (rel !== "" && !rel.startsWith("..")) {
        const seg = rel.split(sep)[0];
        if (seg !== undefined && targets.includes(seg)) affected.add(seg);
      }
    }
    const toBuild = affected.size > 0 ? [...affected] : targets;
    const live: string[] = [];
    for (const page of toBuild) {
      if (await Bun.file(join(pagesDir, page, "index.html")).exists()) {
        live.push(page);
      } else {
        console.error(`Missing entry: pages/${page}/index.html (skipped).`);
      }
    }
    if (await buildPages(live)) {
      server.publish(RELOAD_TOPIC, "reload");
      console.log("dev: rebuilt, browsers reloaded.");
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string[] = [];

  function handleFsEvent(absPath: string): void {
    if (shouldIgnore(absPath)) return;
    pending.push(absPath);
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      const paths = pending;
      pending = [];
      void settleFsEvents(paths);
    }, DEBOUNCE_MS);
  }

  await syncWatchers();
  console.log(
    `dev: http://localhost:${server.port} (pages: ${targets.join(", ")})`,
  );
  console.log("dev: watching pages/ for changes...");
}

await main();
