# bun-singlefile-pages-template

基于 Bun 的多页面静态站模板：`pages/` 下的每个目录都可以构建成两种产物 —— **单文件**（全部内联）或 **拆分目录**（HTML / JS / CSS / 资源分离）。

## 目录结构

```
pages/
  clock/
    index.html      # 页面入口（必需）
    main.ts         # 该页脚本（可选）
    style.css       # 该页样式（可选）
    assets/         # 该页资源（可选）
      logo.svg
  counter/
  hello/
scripts/
  pages.ts          # 页面发现与参数解析（两个构建脚本共用）
  single-build.ts   # 单文件模式
  split-build.ts    # 拆分模式
dist/               # 构建产物（已 gitignore）
  single/
    clock.html
  split/
    clock/
      index.html
      chunk-<hash>.js
      chunk-<hash>.css
```

## 页面与资源约定

- 每个页面是 `pages/` 下的一个**直接子目录**，必须包含 `index.html`，目录名即产物名（`pages/clock/` → `clock`）。
- 以 `.` 或 `_` 开头的目录会被跳过。
- 资源放在该页的 `assets/` 子目录下，并用**相对路径**引用：
  - HTML：`<img src="./assets/logo.svg">`、`<link rel="icon" href="./assets/logo.svg">`
  - CSS：`url("./assets/bg.png")`、`url("./assets/font.woff2")`
  - JS：`import "./styles.css"`
- 绝对 URL（`https://…`）不会被处理，按外链原样保留。

## 两种构建模式

| 模式 | 脚本 | 产物 | 特点 |
| --- | --- | --- | --- |
| 单文件 | `single-build.ts` | `dist/single/<name>.html` | JS、CSS、资源全部内联，一个文件即完整页面，可直接双击打开或单独上传 |
| 拆分 | `split-build.ts` | `dist/split/<name>/` | `index.html` + 独立 JS/CSS + 带哈希的资源，路径自动重写；适合需要缓存与按需加载的部署 |

拆分模式下资源会保留 `assets/` 目录结构并附加内容哈希，例如 `dist/split/hello/assets/logo-4n681ck3.svg`。

## 构建

| 命令 | 说明 |
| --- | --- |
| `bun run build` | 依次执行单文件与拆分两种构建 |
| `bun run build:single` | 只构建单文件模式（全部页面） |
| `bun run build:split` | 只构建拆分模式（全部页面） |
| `bun run build:single -- <name>` | 只构建指定页面的单文件产物，如 `bun run build:single -- hello` |
| `bun run build:split -- <name>` | 只构建指定页面的拆分产物 |

也可以直接调用脚本，例如 `bun scripts/split-build.ts hello`、`bun scripts/single-build.ts --all`。

## 单文件模式的内联规则

Bun 的 Standalone HTML 模式（`compile: true` + `target: "browser"` + HTML 入口）会自动内联：

| 源码 | 产物 |
| --- | --- |
| `<script src="./main.ts">` | 内联 `<script type="module">` |
| `<link rel="stylesheet" href="./style.css">` | 内联 `<style>` |
| `<img>` / `<link rel="icon">` / `<video poster>` | `data:` URI |
| `<video>` / `<audio>` / `<source>` | `data:` URI |
| CSS `url(...)`、`@import`、JS `import "*.css"` | 内联进 `<style>` |

只有相对路径才会被内联。构建时会校验产物中是否残留相对引用（残留即说明未内联），并对体积过大的页面告警。

## 局限（仅单文件模式）

- 大文件（视频等）内联后体积约增加 33%（base64）；超过 1 MB 会告警，过大时建议改用拆分模式。
- 不支持 `splitting`。
- 不要设置 `publicPath`，否则资源引用会被前缀化，不再内联。

以上限制在拆分模式下都不存在。
