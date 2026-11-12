# 旅行照片记录本 · GitHub Pages 只读展示版

## 结论

**原来的便携版文件夹不能整包上传后用 github.io 打开。** 它是「Express 后端 + 打包前端」的本机应用，GitHub Pages 只提供静态文件托管，不会运行 Node。

好消息是：这个项目的**展示页本身已经是读静态 JSON 的**（`fetch("/content/weeks.json")`），只有管理页依赖后端 API。因此不需要重写代码，把前端产物和数据重新摆成静态目录即可。

本目录就是整理好的、可以直接推上去的版本。

## 原文件夹为什么不行

| 问题 | 说明 |
| --- | --- |
| 需要 Node 服务 | `portable-server.mjs` + `server/local-api.mjs`（Express / multer / sharp）负责读写 `weeks.json`、上传并压缩照片。GitHub Pages 不执行任何服务端代码。 |
| 没有入口 | GitHub Pages 在仓库根找 `index.html`，而它在 `dist/` 里。 |
| 绝对路径 | `index.html`、打包 JS、`weeks.json` 里的照片地址都用 `/assets/...`、`/content/...`、`/uploads/...`，只有在**站点根路径**部署才成立。 |
| SPA 深链接 | `/trip/...`、`/week/...`、`/admin` 用的是 history 路由，直接访问会被 Pages 当成不存在的静态文件返回 404。 |
| 体积垃圾 | `runtime/node.exe` 88 MB、`node_modules` 24 MB，共约 112 MB，对 Pages 毫无用处；`node.exe` 还逼近 GitHub 单文件 100 MB 上限。 |
| 管理页 | `/api/content` 的 GET/PUT、照片 POST/DELETE 在静态环境下全部不存在。 |

## 本目录内容

```
github-pages/
├── index.html              展示页入口（已插入只读补丁）
├── 404.html                index.html 的副本，承接 SPA 深链接
├── .nojekyll               跳过 Jekyll 处理
├── push-to-github.bat      ★ 双击一键推送
├── push.config.json        本机配置（首次运行自动生成，已被 .gitignore 忽略）
├── assets/                 前端 JS / CSS + static-shim.js
├── content/weeks.json      文字、章节、照片索引
├── uploads/                73 MB 照片（original / large / thumb）
├── .gitignore
└── tools/
    ├── push.mjs            一键推送逻辑
    ├── sync.mjs            从便携版重新同步内容与最新前端
    ├── static-shim.js      只读展示版补丁源码
    └── sync-content.bat    Windows 一键同步
```

`tools/` 只是维护工具，推到仓库不影响站点，介意的话可以删掉（但删了就不能一键推送了）。

## 一键推送（推荐）

双击根目录的 **`push-to-github.bat`**。

**首次运行**会问三件事：

1. GitHub 用户名
2. 仓库名（直接回车 = `<用户名>.github.io`，推荐）
3. 输入 `YES` 确认照片公开

然后自动完成：同步便携版最新内容 → 建 git 仓库 → commit → push。首次推送时 **Git Credential Manager 会弹出浏览器让你登录 GitHub**，授权一次即可，凭据会记在 Windows 凭据管理器里。

**之后每次**：双击 bat → 自动同步 + 提交 + 推送，无需任何输入。改完本机内容直接双击就是完整的一次发布。

可选能力：

| 场景 | 做法 |
| --- | --- |
| 想连建仓库都自动 | 设置环境变量 `GITHUB_TOKEN`（fine-grained PAT，需 repo 权限），脚本会调用 API 创建公开仓库并用它推送；token 不写入 `.git/config` |
| 先看看会做什么 | `node tools/push.mjs --dry-run --username=<id> --yes` |
| 不想每次同步内容 | `node tools/push.mjs --no-sync` |
| 非交互/CI | `--username=<id> --repo=<name> --yes` |
| 已装 gh 或用别的 remote | 脚本内置 `--remote=<url>` 可覆盖 |

推送后会打印站点地址；**首次仍需在仓库 Settings → Pages 里选一次 `main` / `/ (root)`**，这一步 GitHub 要求人工确认，之后就不用管了。

> 脚本会自动寻找 `git.exe`：本机没装 Git for Windows 时会回退到 WorkBuddy 内置的 PortableGit；两者都没有会提示去 https://git-scm.com/download/win 安装。

## 手动部署（不用脚本）

1. 先在 https://github.com/new 新建仓库，仓库名必须是 **`<你的用户名>.github.io`**（例如 `zhangsan.github.io`）。**不要勾选 Add a README / .gitignore / license**，否则首次 push 会因远端已有提交被拒绝。
   > 这一步是关键：用户主页仓库部署在域名根 `/`，所有 `/assets/...`、`/uploads/...` 绝对路径才能原样工作。
2. 在本目录初始化并推送：
   ```bash
   cd github-pages
   git init
   git add -A
   git commit -m "Publish travel photo journal"
   git branch -M main
   git remote add origin https://github.com/<用户名>/<用户名>.github.io.git
   git push -u origin main
   ```
3. 仓库 **Settings → Pages** 里确认 Source 为 `Deploy from a branch` / `main` / `/ (root)`，保存。
4. 等待 1–2 分钟，访问 `https://<用户名>.github.io/`。

> **⚠️ 隐私提醒：免费版 GitHub Pages 要求仓库为 Public（私有仓库需付费套餐才能发布 Pages）。** 本目录含 76 个文件中的全部个人旅行照片和日记文字，一旦推送即公开可访问、可被搜索引擎收录、可被任意克隆。请先确认这些照片愿意公开；不想公开就别用 Pages，改用本机便携版或需要登录的托管方案。

## 以后怎么更新内容

静态站不能在线编辑，流程是「本机编辑 → 一键推送」：

1. 双击原便携版的 `启动照片记录本.bat`，在 `http://127.0.0.1:5173/admin` 里改文字、传照片（后端会自动生成缩略图和 webp 并更新 `weeks.json`）。
2. 双击本目录 `push-to-github.bat`。它内部先调用 `sync.mjs` 同步最新 `dist/` 和 `public/`，再 commit + push，几分钟后线上更新。

只想同步、不推送时，双击 `tools/sync-content.bat`（或运行 `node tools/sync.mjs`）。同步脚本会自动寻找工作区里的便携版目录，也可以手动传源目录路径：`node tools/sync.mjs "D:\path\to\旅行照片记录本_Windows便携版"`。

## 管理页会怎样

访问 `/admin` 仍能打开并预览内容（`static-shim.js` 把读取请求转到静态 JSON），但**保存、上传、删除都会失败并弹出提示条**。这是静态托管的硬限制，不是配置问题。

如果确实需要在线编辑，属于另一个量级的改造：把内容存到云数据库/对象存储、把照片上传改走云 API，或用 GitHub Actions + 登录态后台。当前这套便携版代码不能直接复用。

## 如果仓库名不是 `<用户名>.github.io`

普通项目仓库会部署在 `https://<用户名>.github.io/<仓库名>/`，所有根绝对路径都会失效，需要给资源路径和路由都加前缀。用同步脚本生成子路径版：

```bash
node tools/sync.mjs --base=<仓库名>
```

在 Git Bash 里请**不要**写成 `--base=/仓库名`（MSYS 会把 `/` 开头的参数当路径转换掉）；在 cmd / `sync-content.bat` 里两种写法都可以。

它会：给 `index.html` 的 `/assets/`、JS 里的 `/content/weeks.json`、`weeks.json` 里的 `/uploads/` 加前缀，并给前端路由注入 `basename`。已在当前打包产物上验证过这四处替换。

代价与风险：
- 这是针对当前打包产物的文本补丁，前端重新打包后需重新验证（脚本会提示是否成功注入）。
- 子路径下 `404.html` 的 fallback 行为依赖 GitHub Pages 对项目站点自定义 404 的处理，深链接刷新请务必自测。
- 更省事的替代：给项目站点绑定自定义域名（自定义域下站点变回根路径 `/`），或改用 Cloudflare Pages / Netlify（可配 SPA rewrite）。

## 其它注意

- 当前站点约 **73 MB**，全部来自照片。GitHub Pages 建议站点 < 1 GB、单文件 < 100 MB、月流量软限 100 GB，日常分享没问题，但首次 push 会稍慢。
- 不要上传：`runtime/node.exe`、`node_modules/`、`server/`、`portable-server.mjs`、`*.bat`、`package*.json`、`使用说明.txt`。它们对 Pages 无用，还白白占用仓库空间。
- 如果想连同源码一起备份，建议另建一个源码仓库，或用 GitHub Actions 在工作流里调用 `sync.mjs` 生成产物再部署，而不是把整个便携版塞进 Pages 仓库。
