/* ============================================================
   旅行照片记录本 · 自定义脚本（改文案 / 加元素 / 改交互）
   ------------------------------------------------------------
   页面是 React 渲染的，直接改 DOM 会在重渲染时被覆盖。
   所以这里提供 onRender()，它会在每次 DOM 变化后重新应用你的改动。

   默认不做任何事。要启用某个效果，把对应示例的注释去掉即可。
   改完：preview.bat 看效果 → push-to-github.bat 发布。
   ============================================================ */
(function () {
  "use strict";

  /** 在页面初次渲染及之后每次 DOM 变化后执行 fn（自带防抖）。 */
  function onRender(fn) {
    var timer = null;
    function run() {
      try {
        fn();
      } catch (error) {
        console.warn("[custom/theme.js] 自定义脚本出错：", error);
      }
    }
    run();
    var observer = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(run, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /** 批量替换页面上的静态文字（只改文本节点，不破坏 React 结构）。 */
  function replaceText(map) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(function (textNode) {
      var value = textNode.nodeValue;
      Object.keys(map).forEach(function (from) {
        if (value.indexOf(from) !== -1) {
          value = value.split(from).join(map[from]);
        }
      });
      if (value !== textNode.nodeValue) textNode.nodeValue = value;
    });
  }

  /** 往页面右上角插入一块自定义内容。 */
  function addBadge(html) {
    var id = "travel-ui-badge";
    var box = document.getElementById(id);
    if (!box) {
      box = document.createElement("div");
      box.id = id;
      box.style.cssText =
        "position:fixed;top:82px;right:24px;z-index:9999;padding:8px 14px;" +
        "border:1px solid rgba(244,236,216,.25);border-radius:999px;" +
        "background:rgba(6,7,6,.72);color:#f4ecd8;font:12px/1.4 system-ui,sans-serif;" +
        "letter-spacing:1px;backdrop-filter:blur(6px)";
      document.body.appendChild(box);
    }
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  window.TravelUI = { onRender: onRender, replaceText: replaceText, addBadge: addBadge };

  /* ------------------------------------------------------------
     示例 A · 汉化界面上的英文标签
     把英文换成中文，或改成任何你想要的措辞。
     ------------------------------------------------------------ */
  /*
  onRender(function () {
    replaceText({
      "ROLL INDEX": "旅行目录",
      "BACK TO INDEX": "返回目录",
      "ROUTE COORDINATES": "路线坐标",
      "FIELD NOTE": "随手记",
      "CONTACT SHEET": "照片墙",
      "CHAPTERS": "章节",
      "FRAMES": "张照片"
    });
  });
  */

  /* ------------------------------------------------------------
     示例 B · 改浏览器标签标题
     ------------------------------------------------------------ */
  /*
  document.title = "我的旅行相册";
  */

  /* ------------------------------------------------------------
     示例 C · 右上角加一枚徽标 / 一条链接
     ------------------------------------------------------------ */
  /*
  onRender(function () {
    addBadge('<a href="/" style="color:inherit;text-decoration:none">© 2026 MY TRIP</a>');
  });
  */

  /* ------------------------------------------------------------
     示例 D · 给每个章节横幅加一个序号角标
     ------------------------------------------------------------ */
  /*
  onRender(function () {
    document.querySelectorAll(".film-strip").forEach(function (el, i) {
      if (el.querySelector("[data-custom-no]")) return;
      var tag = document.createElement("span");
      tag.setAttribute("data-custom-no", "1");
      tag.textContent = "NO." + String(i + 1).padStart(2, "0");
      tag.style.cssText = "position:absolute;left:16px;bottom:12px;z-index:6;" +
        "font:700 11px/1 monospace;letter-spacing:2px;color:#f4ecd8;opacity:.7";
      el.appendChild(tag);
    });
  });
  */
})();
