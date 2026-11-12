// 一键推送到 GitHub Pages。
// 首次运行：询问 GitHub 用户名 / 仓库名，确认照片公开，然后初始化并推送。
// 之后运行：自动同步便携版最新内容 -> commit -> push，全程无需再输入。
//
// 可选参数：
//   --username=<id>   非交互指定 GitHub 用户名
//   --repo=<name>     非交互指定仓库名
//   --yes             跳过公开确认（用于已阅读风险的自动化）
//   --no-sync         不同步内容，只提交推送当前目录
//   --dry-run         只打印将要执行的命令，不写入、不推送
//   --remote=<url>    覆盖 remote（本地测试用）
//
// 认证：优先用 Git Credential Manager（首次会弹浏览器登录 GitHub，之后记住）。
//       也可以用环境变量 GITHUB_TOKEN（fine-grained PAT，需 repo 权限）自动建仓库并免登录推送。

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(fileURLToPath(new URL(".", import.meta.url)));
const siteRoot = resolve(here, "..");
const configPath = join(siteRoot, "push.config.json");
const syncPath = join(here, "sync.mjs");
const argv = process.argv.slice(2);

function option(name) {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const has = (name) => argv.includes(`--${name}`);
const dryRun = has("dry-run");
const autoYes = has("yes");
const skipSync = has("no-sync");
const isTTY = Boolean(process.stdin.isTTY);

function loadConfig() {
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      console.warn("警告：push.config.json 解析失败，将重新配置。");
    }
  }
  return {};
}

function saveConfig(config) {
  if (dryRun) {
    console.log("[dry-run] 将写入 push.config.json：", JSON.stringify(config, null, 2));
    return;
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

async function ask(question) {
  if (!isTTY) {
    throw new Error(`需要交互输入：${question}\n非交互环境请用 --username / --repo / --yes 参数提供。`);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

// 系统可能没装 Git for Windows，只有 WorkBuddy 内置的 PortableGit。
function findGit() {
  const probe = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (probe.status === 0) return "git";

  const candidates = [];
  for (const dir of (process.env.PATH || "").split(";")) {
    if (/git/i.test(dir)) candidates.push(join(dir, "git.exe"), join(dir, "git"));
  }
  candidates.push(
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
    join(process.env.LOCALAPPDATA || "", "Programs", "Git", "cmd", "git.exe"),
  );
  for (const drive of ["C", "D", "E", "F", "G", "H"]) {
    candidates.push(`${drive}:\\WorkBuddy\\resources\\vendor\\PortableGit\\mingw64\\bin\\git.exe`);
    candidates.push(`${drive}:\\WorkBuddy\\resources\\vendor\\PortableGit\\cmd\\git.exe`);
  }
  for (const exe of candidates) {
    if (!existsSync(exe)) continue;
    const result = spawnSync(exe, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return exe;
  }
  return null;
}

function run(exe, args, { allowFail = false } = {}) {
  const label = `> ${exe} ${args.join(" ")}`;
  if (dryRun) {
    console.log("[dry-run]", label);
    return { ok: true, out: "", err: "" };
  }
  const result = spawnSync(exe, args, { cwd: siteRoot, encoding: "utf8" });
  const ok = result.status === 0;
  const out = (result.stdout || "").trim();
  const err = (result.stderr || "").trim();
  if (!ok && !allowFail) {
    console.error(label);
    if (out) console.error(out);
    if (err) console.error(err);
  }
  return { ok, out, err, error: result.error };
}

// 有 token 时顺手把仓库也建好，做到真正无人值守。
async function ensureRepo(config, token) {
  if (!token || dryRun) {
    if (dryRun && token) console.log("[dry-run] 将检查/创建 GitHub 仓库");
    return;
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "travel-journal-push",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const check = await fetch(
    `https://api.github.com/repos/${config.username}/${config.repo}`,
    { headers },
  );
  if (check.status === 200) {
    console.log("仓库已存在：", `${config.username}/${config.repo}`);
    return;
  }
  if (check.status !== 404) {
    console.warn("无法查询仓库（状态", check.status, "），跳过自动创建。");
    return;
  }
  const created = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: config.repo,
      private: false,
      description: "Travel photo journal (static site)",
      has_issues: false,
      has_wiki: false,
      has_projects: false,
    }),
  });
  if (created.ok) {
    console.log("已创建公开仓库：", `${config.username}/${config.repo}`);
  } else {
    console.warn("自动建仓库失败（", created.status, "）：请确认 token 有 repo 权限，或到 github.com/new 手动创建。");
  }
}

function explainPushFailure(err) {
  const text = `${err}`.toLowerCase();
  console.error("");
  if (/authentication|could not read username|invalid username|password|403/.test(text)) {
    console.error("→ 认证失败。首次推送会弹出 GitHub 登录窗口，请在浏览器里完成授权；");
    console.error("  或设置环境变量 GITHUB_TOKEN 后重试。");
  } else if (/repository not found|not found/.test(text)) {
    console.error("→ 远端仓库不存在。请到 https://github.com/new 创建同名仓库（Public），");
    console.error("  或设置 GITHUB_TOKEN 让脚本自动创建。");
  } else if (/timed out|could not resolve|failed to connect|unable to access/.test(text)) {
    console.error("→ 网络不通。请检查代理/网络后重试。");
  } else if (/permission denied|protected branch|non-fast-forward|rejected/.test(text)) {
    console.error("→ 推送被拒绝。检查仓库权限，或先执行 git pull --rebase。");
  }
}

async function main() {
  const config = loadConfig();
  config.branch = config.branch || "main";

  if (!config.username) config.username = option("username") || (await ask("GitHub 用户名："));
  if (!config.repo) {
    config.repo =
      option("repo") ||
      (await ask(`仓库名（直接回车 = ${config.username}.github.io）：`)) ||
      `${config.username}.github.io`;
  }
  if (!config.username || !config.repo) {
    throw new Error("用户名和仓库名不能为空。");
  }

  if (!config.confirmedPublic && !autoYes) {
    console.log("");
    console.log("⚠️  免费版 GitHub Pages 要求仓库为 Public。本站点含全部个人旅行照片与文字，");
    console.log("   推送后即公开可访问、可被搜索引擎收录、可被任意克隆。");
    const answer = await ask("确认公开请输入 YES：");
    if (answer.toUpperCase() !== "YES") {
      console.log("已取消，没有推送任何内容。");
      return;
    }
  }
  config.confirmedPublic = true;
  saveConfig(config);

  const git = findGit();
  if (!git) {
    throw new Error(
      "找不到 git.exe。请安装 Git for Windows：https://git-scm.com/download/win （安装时勾选 Git Credential Manager）。",
    );
  }
  const gitExe = git === "git" ? "git" : git;
  console.log("git：", gitExe);

  if (!existsSync(join(siteRoot, "index.html"))) {
    throw new Error("缺少 index.html，请先运行 tools/sync-content.bat 生成站点。");
  }

  // 1. 同步便携版里最新的前端与内容
  if (!skipSync) {
    console.log("\n[1/4] 同步最新内容…");
    const sync = run(process.execPath, [syncPath], { allowFail: true });
    if (!sync.ok) throw new Error("内容同步失败，已停止推送。");
  } else {
    console.log("\n[1/4] 跳过内容同步（--no-sync）");
  }

  // 2. 准备仓库
  console.log("[2/4] 检查远端仓库…");
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || config.token || option("token") || "";
  await ensureRepo(config, token);

  const remote =
    option("remote") || `https://github.com/${config.username}/${config.repo}.git`;

  // 3. git init / 提交
  console.log("[3/4] 提交变更…");
  if (!dryRun && !existsSync(join(siteRoot, ".git"))) run(gitExe, ["init"]);
  if (dryRun) run(gitExe, ["init"]);

  const nameCheck = run(gitExe, ["config", "user.name"], { allowFail: true });
  if (!nameCheck.out) run(gitExe, ["config", "user.name", "Travel Journal"]);
  const emailCheck = run(gitExe, ["config", "user.email"], { allowFail: true });
  if (!emailCheck.out) run(gitExe, ["config", "user.email", "journal@localhost"]);

  const current = run(gitExe, ["remote", "get-url", "origin"], { allowFail: true });
  if (!current.ok) run(gitExe, ["remote", "add", "origin", remote]);
  else if (current.out !== remote) run(gitExe, ["remote", "set-url", "origin", remote]);

  run(gitExe, ["add", "-A"]);
  const status = run(gitExe, ["status", "--porcelain"], { allowFail: true });
  if (dryRun || status.out) {
    const stamp = new Date().toLocaleString("sv-SE", { hour12: false }).slice(0, 16);
    run(gitExe, ["commit", "-m", `Update travel photo journal (${stamp})`]);
  } else {
    console.log("没有新变更，跳过 commit。");
  }
  run(gitExe, ["branch", "-M", config.branch]);

  // 4. 推送。有 token 时临时改写 remote，推完立刻还原，避免明文留在 .git/config。
  console.log("[4/4] 推送到 GitHub…");
  const useTokenUrl = Boolean(token) && !option("remote") && !dryRun;
  let pushed;
  if (useTokenUrl) {
    const pushUrl = `https://x-access-token:${encodeURIComponent(token)}@github.com/${config.username}/${config.repo}.git`;
    run(gitExe, ["remote", "set-url", "origin", pushUrl], { allowFail: true });
    pushed = run(gitExe, ["push", "-u", "origin", config.branch], { allowFail: true });
    run(gitExe, ["remote", "set-url", "origin", remote], { allowFail: true });
  } else {
    pushed = run(gitExe, ["push", "-u", "origin", config.branch], { allowFail: true });
  }
  if (!pushed.ok) {
    explainPushFailure(pushed.err || pushed.out);
    process.exitCode = 1;
    return;
  }

  const isUserSite = config.repo.toLowerCase() === `${config.username.toLowerCase()}.github.io`;
  const siteUrl = isUserSite
    ? `https://${config.username}.github.io/`
    : `https://${config.username}.github.io/${config.repo}/`;
  console.log("");
  console.log("✅ 推送完成", dryRun ? "（dry-run，未实际执行）" : "");
  console.log("   仓库：https://github.com/" + config.username + "/" + config.repo);
  console.log("   站点：" + siteUrl);
  console.log("   首次部署请到 Settings → Pages 选 main / (root)，约 1-2 分钟生效。");
  if (!isUserSite) {
    console.log("   注意：普通仓库名需要运行 `node tools/sync.mjs --base=" + config.repo + "` 加路径前缀。");
  }
}

main().catch((error) => {
  console.error("\n❌ " + (error.message || error));
  process.exitCode = 1;
});
