# 修改主界面 UI

## 先说清楚一个前提

这个便携包里**没有前端源码**（没有 `src/`、`.tsx`、Vite 配置），只有 Vite 打包压缩后的两个文件：

```
assets/index-CAdTbOyu.js    约 200 KB，React 组件 + 逻辑（压缩成一行）
assets/index-D64RmnmZ.css   约 40 KB，全部样式（压缩成一行）
```

所以「改 UI」分三档：

| 想改什么 | 用哪条路 | 难度 |
| --- | --- | --- |
| 配色、字体、字号、间距、圆角、背景、显隐、响应式 | **`theme.css` 覆盖** | ★ 推荐，安全可逆 |
| 静态文案汉化、加徽标/角标、轻量交互 | **`theme.js` 注入** | ★★ 推荐 |
| 增删页面模块、改组件结构、改数据流 | 改打包 JS 或**重建源码** | ★★★★ 脆弱，见文末 |

前两档已经搭好机制，**你只需要编辑 `custom/` 下的两个文件**，同步和推送都不会覆盖它们。

## 文件与工作流

```
github-pages/
├── custom/
│   ├── theme.css      ← 改样式：8 组即贴即用的配方，默认全部注释，不改外观
│   ├── theme.js       ← 改文案/加元素：4 个示例，默认不生效
│   └── README.md      ← 本文件
├── preview.bat        ← 双击：启动本地预览并自动开浏览器
└── push-to-github.bat ← 双击：同步 + 提交 + 发布
```

**标准流程：**

1. 编辑 `custom/theme.css`（或 `theme.js`），保存。
2. 双击 `preview.bat` → 浏览器打开 `http://127.0.0.1:8765/travel/`。这个预览服务器和线上路径完全一致（含 `/travel/` 前缀和深链接回落），改完 CSS **刷新即可见效**，不用等 GitHub。
3. 满意后双击 `push-to-github.bat` 发布。

> 预览服务器默认读 `push.config.json` 判断子路径；换端口用 `node tools/preview.mjs --port=8766`。关闭黑窗口即停止。

## CSS 配方速查

`theme.css` 里每组配方都有完整可复制的代码，取消注释就能用：

| # | 效果 | 关键选择器 |
| --- | --- | --- |
| 1 | 换主色调 | `.home-layout` / `.chapter-panel` / `.film-strip` / `.roll-row` 的 `--accent` 系变量 |
| 2 | 换字体 | `:root`、`.microline`、`.top-rail`、`.route-spine` |
| 3 | 换背景 / 去掉胶片扫描线 | `body`、`body::before` |
| 4 | 大标题尺寸与颜色 | `.home-title`（原版 `clamp(104px,26cqw,210px)`） |
| 5 | 左右分栏比例 / 窄屏堆叠 | `.home-layout`、`@media (max-width:1100px)` |
| 6 | 卡片圆角、章节标题位置 | `.film-strip`、`.strip-copy`、`.strip-index` |
| 7 | 顶栏高度、隐藏侧边刻度 | `.top-rail`、`.route-spine` |
| 8 | 关掉入场动画（截图用） | 全局 `animation-duration` |

### 主界面常用类名（F12 里能对上）

| 类名 | 是什么 |
| --- | --- |
| `.site-shell` | 整页外壳 |
| `.top-rail` | 最顶部那行 "西行 – TRAVEL JOURNAL / ROLL 01 – COVER" |
| `.home-layout` | 左右两栏网格容器 |
| `.home-copy` | 左栏（大标题、日期、简介、坐标） |
| `.home-title` | 「西行 / ROLL」巨型标题 |
| `.travel-index-panel` | 左下的章节索引列表 |
| `.roll-row` | 索引里的每一行 |
| `.route-spine` | 左栏右侧竖排的刻度文字 |
| `.film-strips` / `.film-strip` | 右栏章节横幅列表 / 单个横幅 |
| `.strip-copy` / `.strip-index` | 横幅上的章节名 / 序号 |
| `.chapter-panel` | 详情页左侧信息面板 |
| `.photo-stage` / `.gallery-nav` / `.thumbnail-rail` | 详情页照片区 |

**定位技巧：** 浏览器按 F12 → 点左上角箭头 → 点页面上想改的元素 → 在 Styles 面板看它的 class 和当前生效的规则，复制选择器到 `theme.css` 覆盖即可。优先级不够就在声明后加 `!important`。

## 改文字的三种情况

**① 数据里的文字（推荐）** —— 旅行名「西行」、章节名「敦煌」、日期、地点、日记、照片描述、每章强调色，都存在 `content/weeks.json`。

用本机便携版的 `http://127.0.0.1:5173/admin` 改，或编辑源目录 `旅行照片记录本_Windows便携版/public/content/weeks.json`，再走一次推送（推送时会自动同步）。**不要直接改 `github-pages/content/weeks.json`**，会被同步覆盖。

**② 界面硬编码英文标签** —— 这些写在打包 JS 里，用 `theme.js` 的 `replaceText()` 改最省事，示例 A 已列好：

```
ROLL INDEX / BACK TO INDEX / ROUTE COORDINATES / FIELD NOTE /
CONTACT SHEET / ROLL 01 - COVER / A PHOTOGRAPHIC JOURNAL / TRAVEL JOURNAL ...
```

浏览器标签标题用示例 B：`document.title = "我的旅行相册"`。

**③ 加内容** —— 示例 C（右上角徽标）、示例 D（章节角标）。`onRender()` 会在 React 重渲染后自动重新应用，不会一闪就没。

## 想改结构怎么办

CSS/JS 覆盖改不了「组件层级」和「业务交互」（比如把左右分栏改成瀑布流、给每章加评论框）。可选：

- **重建源码（彻底但工作量大）**：需要拿到原始的 Vite + React 项目源码；当前包里没有。若你有原始工程，把 `dist` 重新构建产出替换掉，再重新接上 `static-shim.js`、`--base` 补丁和 `custom/` 注入。
- **直接改压缩 JS（脆弱）**：`assets/index-CAdTbOyu.js` 是一行压缩代码，能做字符串替换（例如把某个文案全局替换），但**每次 `sync.mjs` 都会从源 `dist/` 重新覆盖**。要持久就得把补丁写进 `sync.mjs` 的 `base` 处理段，并且前端一重新打包，所有字符串定位都会失效。

不建议在压缩文件上做大改。真要长期维护 UI，找回/重建源码是唯一稳妥的路。

## 注意事项

- ❌ 不要直接编辑 `assets/index-*.css/js`、`index.html`、`404.html`、`content/weeks.json` —— 同步会覆盖。
- ⚠️ 不要只双击 `sync-content.bat` 再自己推：它不带 `--base`，会把站点改回根路径版导致线上白屏。统一走 `push-to-github.bat`。
- 章节强调色是数据驱动的行内样式（`--accent`），CSS 里全局改主色盖不住它；要统一请在管理页逐章改，或批量改源 `weeks.json` 的 `accent` 字段。
- 主题色相关多用 `color-mix()`，需要较新的浏览器（Chrome/Edge 111+、Safari 16.2+）。
- 预览服务器设了 `Cache-Control: no-store`，改 CSS 刷新就生效；线上有 CDN 缓存，发布后强制刷新（Ctrl+F5）并等 1–2 分钟。
