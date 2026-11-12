// 本地 UI 预览服务器：与线上路径完全一致（支持 /<repo>/ 子路径和 SPA 深链接）。
// 双击根目录 preview.bat 即可；改完 custom/theme.css 刷新浏览器就能看到效果。
//
//   node tools/preview.mjs                  自动按 push.config.json 决定子路径
//   node tools/preview.mjs --port=8766     换端口
//   node tools/preview.mjs --base=/        强制根路径预览
//   node tools/preview.mjs --no-open       不自动打开浏览器

import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(fileURLToPath(new URL(".", import.meta.url)));
const siteRoot = resolve(here, "..");
const args = process.argv.slice(2);
const option = (name) => {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const port = Number(option("port") || 8765);
const noOpen = args.includes("--no-open");

let base = option("base") || "";
if (base === "/") base = "";
if (!base) {
  const configPath = join(siteRoot, "push.config.json");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      const userSite = `${String(config.username || "").toLowerCase()}.github.io`;
      if (config.repo && config.repo.toLowerCase() !== userSite) {
        base = "/" + config.repo.replace(/^\/+|\/+$/g, "");
      }
    } catch {
      // 配置读不了就按根路径预览
    }
  }
}
if (base) base = "/" + base.replace(/^\/+|\/+$/g, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (base && !pathname.startsWith(base)) {
    response.writeHead(302, { Location: base + "/" }).end();
    return;
  }

  let relative = pathname.slice(base.length).replace(/^\/+/, "");
  let file = resolve(siteRoot, relative || ".");
  if (!file.startsWith(siteRoot)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  const isFile = existsSync(file) && statSync(file).isFile();
  if (!isFile) {
    // 无扩展名的路径当作 SPA 路由，回落 index.html（对应线上 404.html）
    if (extname(relative)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("404 Not Found: " + pathname);
      return;
    }
    file = join(siteRoot, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${port} 已被占用。换一个：node tools/preview.mjs --port=${port + 1}`);
  } else {
    console.error("预览服务启动失败：", error.message);
  }
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}${base}/`;
  console.log("");
  console.log("本地预览已启动：", url);
  console.log("部署路径：", base || "/（站点根）");
  console.log("改 custom/theme.css 或 theme.js 后，刷新浏览器即可看到效果。");
  console.log("关闭本窗口即停止服务（Ctrl+C）。");
  console.log("");
  if (!noOpen && process.platform === "win32") {
    const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    browser.unref();
  }
});
