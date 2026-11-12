// 把 Windows 便携版里最新的 dist + public 同步成 GitHub Pages 静态站点。
// 用法：
//   node tools/sync.mjs                         默认部署在站点根路径（推荐：<用户名>.github.io）
//   node tools/sync.mjs --base=/myrepo          部署在 /myrepo/ 子路径（普通项目仓库）
//   node tools/sync.mjs "D:\path\to\便携版"      手动指定源目录
//
// 注意：会以源目录为准覆盖本目录下的 assets/ content/ uploads/ index.html 404.html，
// 因此在这几个目录里手工做的修改会被覆盖，请改到源目录或本脚本里。

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(fileURLToPath(new URL(".", import.meta.url)));
const siteRoot = resolve(here, "..");
const workspace = resolve(siteRoot, "..");
const args = process.argv.slice(2);

const baseOption = args.find((arg) => arg.startsWith("--base="));
let rawBase = baseOption
  ? baseOption.slice("--base=".length).replace(/^\/+|\/+$/g, "")
  : "";
// Git Bash / MSYS 会把以 / 开头的参数转换成 Windows 路径，这里还原成仓库名。
if (rawBase.includes(":")) {
  rawBase = rawBase.split(/[\\/]/).pop() || "";
}
const base = rawBase ? "/" + rawBase : "";
const positional = args.filter((arg) => !arg.startsWith("--"));

// 便携版自带的精简 Node 上 fs.cpSync 会异常退出，这里手写递归复制。
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else if (entry.isFile()) {
      copyFileSync(src, dst);
    }
  }
}

function findSource() {
  if (positional[0]) {
    return resolve(positional[0]);
  }
  const candidates = readdirSync(workspace, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== basename(siteRoot))
    .map((entry) => join(workspace, entry.name))
    .filter(
      (dir) =>
        existsSync(join(dir, "dist", "index.html")) &&
        existsSync(join(dir, "public", "content", "weeks.json")),
    );
  if (candidates.length === 0) {
    throw new Error("未找到便携版源目录，请把源目录路径作为第一个参数传入。");
  }
  return candidates[0];
}

const source = findSource();
console.log("源目录：", source);
console.log("输出目录：", siteRoot);
console.log("部署路径：", base || "/（站点根）");

for (const [from, to] of [
  ["dist/assets", "assets"],
  ["public/content", "content"],
  ["public/uploads", "uploads"],
]) {
  const src = join(source, from);
  if (!existsSync(src)) {
    throw new Error(`源目录缺少 ${from}`);
  }
  rmSync(join(siteRoot, to), { recursive: true, force: true });
  copyDir(src, join(siteRoot, to));
}

// 只读展示版补丁：让 /admin 能预览内容，写操作给出明确提示。
copyFileSync(
  join(here, "static-shim.js"),
  join(siteRoot, "assets", "static-shim.js"),
);

let html = readFileSync(join(source, "dist", "index.html"), "utf8");
html = html.replace(
  '<script type="module"',
  '<script src="/assets/static-shim.js"></script>\n    <script type="module"',
);
if (base) {
  html = html.replaceAll('"/assets/', `"${base}/assets/`);
}
writeFileSync(join(siteRoot, "index.html"), html);
// GitHub Pages 没有 history fallback，用 404.html 承接 /trip/... /admin 等深链接。
writeFileSync(join(siteRoot, "404.html"), html);
writeFileSync(join(siteRoot, ".nojekyll"), "");

if (base) {
  const assetsDir = join(siteRoot, "assets");
  let routerPatched = false;
  for (const file of readdirSync(assetsDir).filter((name) => name.endsWith(".js") && name !== "static-shim.js")) {
    const path = join(assetsDir, file);
    let code = readFileSync(path, "utf8");
    code = code.replaceAll('"/content/weeks.json"', `"${base}/content/weeks.json"`);
    code = code.replaceAll('"/api/content"', `"${base}/api/content"`);
    const routerNeedle = "function Vm(){return a.jsx(om,{future:";
    if (code.includes(routerNeedle)) {
      code = code.replace(
        routerNeedle,
        `function Vm(){return a.jsx(om,{basename:"${base}",future:`,
      );
      routerPatched = true;
    }
    writeFileSync(path, code);
  }
  if (!routerPatched) {
    console.warn("警告：未能给前端路由注入 basename，子路径下的站内跳转可能异常，请自测。");
  }

  const contentPath = join(siteRoot, "content", "weeks.json");
  const content = readFileSync(contentPath, "utf8").replaceAll(
    '"/uploads/',
    `"${base}/uploads/`,
  );
  writeFileSync(contentPath, content);
}

console.log("完成。接下来：git add -A && git commit && git push");
