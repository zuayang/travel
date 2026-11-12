# 旅行照片记录本 · 静态站点

由 `原风格版/push-to-github.bat` 自动生成并推送，请勿直接在此仓库编辑文件（下次推送会覆盖）。

- 纯静态：原生 HTML / CSS / JS + hash 路由，全部 `./` 相对路径，用户站点根或项目子路径都能打开。
- 内容在 `content/weeks.json`，照片在 `uploads/`；`data.js` 是 `file://` 双击预览用的数据快照。
- GitHub Pages：Settings → Pages → Deploy from a branch → `main` / `(root)`；`.nojekyll` 已包含。
- 站点文件由本地「原风格版」目录维护；本地控制台不会推送到线上。
