English | [简体中文](./README_zh-CN.md)

# bun-singlefile-pages-template

A Bun-based multi-page static site template: every directory under `pages/` can be built into two kinds of output — a **single file** (everything inlined) or a **split directory** (HTML / JS / CSS / assets kept separate).

## Directory structure

```
pages/
  clock/
    index.html      # page entry (required)
    main.ts         # page script (optional)
    style.css       # page styles (optional)
    assets/         # page assets (optional)
      logo.svg
  counter/
  hello/
scripts/
  pages.ts          # page discovery + arg parsing (shared by both build scripts)
  single-build.ts   # single-file mode
  split-build.ts    # split mode
dist/               # build output (gitignored)
  single/
    clock.html
  split/
    clock/
      index.html
      chunk-<hash>.js
      chunk-<hash>.css
```

## Pages and asset conventions

- Every page is a **direct subdirectory** of `pages/` and must contain `index.html`; the directory name becomes the output name (`pages/clock/` → `clock`).
- Directories starting with `.` or `_` are skipped.
- Assets live in the page's `assets/` subdirectory and are referenced with **relative paths**:
  - HTML: `<img src="./assets/logo.svg">`, `<link rel="icon" href="./assets/logo.svg">`
  - CSS: `url("./assets/bg.png")`, `url("./assets/font.woff2")`
  - JS: `import "./styles.css"`
- Absolute URLs (`https://…`) are left untouched and stay as external links.

## The two build modes

| Mode   | Script            | Output                    | Notes                                                                                                        |
| ------ | ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Single | `single-build.ts` | `dist/single/<name>.html` | JS, CSS and assets all inlined — one file is the whole page; just double-click it or upload it on its own    |
| Split  | `split-build.ts`  | `dist/split/<name>/`      | `index.html` + separate JS/CSS + content-hashed assets, with paths rewritten; suits caching and lazy loading |

In split mode, assets keep their `assets/` directory structure and get a content hash, e.g. `dist/split/hello/assets/logo-4n681ck3.svg`.

## Build

| Command                          | Description                                                   |
| -------------------------------- | ------------------------------------------------------------- |
| `bun run build`                  | Build both modes, single then split                           |
| `bun run build:single`           | Build single-file mode only (all pages)                       |
| `bun run build:split`            | Build split mode only (all pages)                             |
| `bun run build:single -- <name>` | Build a single page's single-file output, e.g. `... -- hello` |
| `bun run build:split -- <name>`  | Build a single page's split output                            |

You can also call the scripts directly, e.g. `bun scripts/split-build.ts hello` or `bun scripts/single-build.ts --all`.

## Code quality

| Command                | Description                               |
| ---------------------- | ----------------------------------------- |
| `bun run lint`         | ESLint check (including type-aware rules) |
| `bun run lint:fix`     | ESLint check with automatic fixes         |
| `bun run format`       | Format every file with Prettier           |
| `bun run format:check` | Check formatting only, without writing    |

- ESLint uses flat config (`eslint.config.js`), built on `typescript-eslint`'s `recommendedTypeChecked`, so type-aware rules such as `no-floating-promises` and `require-await` are enabled.
- Prettier is configured in `.prettierrc.json`; `dist/`, `bun.lock`, `.commandcode/` and `.idea/` are excluded via `.prettierignore`.
- Division of labour: Prettier handles formatting, and `eslint-config-prettier` turns off every rule that would conflict with it.

### Why TypeScript is pinned to 6

TypeScript 7 is the native (Go) implementation and **ships no programmatic API**, which `typescript-eslint` depends on — it throws outright as soon as it detects TS ≥ 7 (its peer range is `>=4.8.4 <6.1.0`).

So this project pins `typescript` to `^6.0.2`, which is a prerequisite for ESLint to run at all. Microsoft's official side-by-side approach (aliasing `typescript` to `@typescript/typescript6`) does not work on the current Bun version: Bun leaks the root-level `typescript` alias into transitive dependencies, so the compat package's own `@typescript/old: npm:typescript@^6` dependency resolves back to itself, producing a circular `require` that returns an empty object.

Once `typescript-eslint` supports TS 7.1 (typescript-eslint#10940), TypeScript 7 can be restored.

## Inlining rules (single-file mode)

Bun's Standalone HTML mode (`compile: true` + `target: "browser"` + an HTML entrypoint) inlines automatically:

| Source                                           | Output                          |
| ------------------------------------------------ | ------------------------------- |
| `<script src="./main.ts">`                       | inline `<script type="module">` |
| `<link rel="stylesheet" href="./style.css">`     | inline `<style>`                |
| `<img>` / `<link rel="icon">` / `<video poster>` | `data:` URI                     |
| `<video>` / `<audio>` / `<source>`               | `data:` URI                     |
| CSS `url(...)`, `@import`, JS `import "*.css"`   | inlined into `<style>`          |

Only relative paths get inlined. The build verifies that no relative references are left behind in the output (leftovers mean something was not inlined) and warns about pages that are too large.

## Limitations (single-file mode only)

- Large files (video, etc.) inflate the output by roughly 33% once base64-encoded; anything over 1 MB triggers a warning, and split mode is the better choice beyond that.
- `splitting` is not supported.
- Do not set `publicPath`, or asset references get prefixed and stop being inlined.

None of these limitations apply to split mode.
