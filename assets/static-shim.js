// GitHub Pages 只读展示版补丁（由 sync.mjs 复制到 assets/ 并在 index.html 中优先加载）。
// 静态托管没有 Node 后端：让管理页能读取内容做预览，写入/上传则明确提示不可用。
(function () {
  var script = document.currentScript;
  var siteRoot = script
    ? script.src.replace(/\/assets\/static-shim\.js.*$/, "")
    : "";
  var contentUrl = siteRoot + "/content/weeks.json";
  var nativeFetch = window.fetch.bind(window);

  function showReadOnlyNotice() {
    if (document.getElementById("pages-readonly-notice")) return;
    var box = document.createElement("div");
    box.id = "pages-readonly-notice";
    box.textContent =
      "这是 GitHub Pages 只读展示版，无法在线保存或上传。请在本机的「旅行照片记录本」便携版里编辑，再运行同步脚本并推送。";
    box.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "transform:translateX(-50%)",
      "z-index:99999",
      "max-width:min(680px,92vw)",
      "padding:14px 18px",
      "border-radius:10px",
      "background:#1f2933",
      "color:#fff",
      "font:14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif",
      "box-shadow:0 8px 30px rgba(0,0,0,.3)",
    ].join(";");
    document.body.appendChild(box);
  }

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url ? input.url : "";
    var method = String(
      (init && init.method) || (input && input.method) || "GET",
    ).toUpperCase();

    if (url.indexOf("/api/") !== -1) {
      if (method === "GET" && url.indexOf("/api/content") !== -1) {
        return nativeFetch(contentUrl);
      }
      showReadOnlyNotice();
      return Promise.resolve(
        new Response(JSON.stringify({ error: "GitHub Pages 是只读站点" }), {
          status: 501,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return nativeFetch(input, init);
  };
})();
