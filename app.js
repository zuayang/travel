/* ==========================================================================
   西行 · 胶片风旅行手记 —— 页面逻辑
   零依赖、零构建。相对路径 + hash 路由，放在任何 GitHub Pages 路径下都能跑。

   改文案：只改下面 COPY 对象。
   改样式：改 styles.css 顶部的 :root 变量。
   改结构：改 renderIndex() / renderDetail() 两个模板函数。
   ========================================================================== */
(function () {
  "use strict";

  /* 所有界面固定文案集中在这里，改一处即可全站生效。全中文，无坐标。 */
  var COPY = {
    journalLabel: "旅行手记",          // 顶部栏左侧
    rollLabel:    "第一卷",            // 顶部栏中间 / 首页 kicker
    region:       "收藏",          // 首页副标题与竖排标注里的地区
    journalSub:   "从海边到戈壁的一卷胶片",
    coverLabel:   "封面",
    indexTitle:   "章节目录",
    journeyLabel: "行程",              // 左下角信息块的小标题
    selectedLabel:"本章照片",
    back:         "← 返回目录",
    emptyNote:    "这一章还没有照片。",
    footLeft:     "一路向西 · 一帧一格",
    footRight:    "全卷完"
  };

  var app = document.getElementById("app");
  var lightbox = document.getElementById("lightbox");
  var journal = null;
  var photos = [];
  var photoIndex = 0;

  /* ---------- 小工具 --------------------------------------------------- */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 兼容 /uploads/... 与 /travel/uploads/... 等历史路径，统一转成本目录相对路径。
  function asset(src) {
    if (!src) return "";
    var i = src.indexOf("uploads/");
    return i >= 0 ? "./" + src.slice(i) : src.replace(/^\/+/, "./");
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // chapterStrip 是数据里记录的横幅裁切条带：{ y, height }（百分比）。
  // 把它换算成 background-size / background-position，就能还原原版的取景。
  function stripCrop(photo) {
    var c = photo && photo.crops && photo.crops.chapterStrip;
    var h = c && Number(c.height) > 0 ? Number(c.height) : 12.5;
    var y = c && Number(c.y) >= 0 ? Number(c.y) : 43.75;
    return {
      zoom: (10000 / h).toFixed(1) + "%",
      pos:  (y * 100 / (100 - h)).toFixed(2) + "%",
      hero: (y + h / 2).toFixed(2) + "%"
    };
  }

  /* ---------- 数据 ----------------------------------------------------- */

  function load() {
    return fetch("./content/weeks.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("http " + res.status);
        return res.json();
      })
      .catch(function () {
        // 双击 index.html（file://）时 fetch 会被浏览器拦，用 data.js 兜底。
        if (window.JOURNAL_DATA) return window.JOURNAL_DATA;
        throw new Error("无法读取 content/weeks.json");
      });
  }

  function normalize(raw) {
    var week = (raw && raw.weeks && raw.weeks[0]) || {};
    return {
      id:      week.id || "journal",
      title:   week.title || "旅行手记",
      range:   week.range || "",
      summary: week.summary || "",
      days: (week.days || []).map(function (day, i) {
        var list = (day.photos || []).map(function (photo, photoIndex) {
          // 便携版 /admin 新上传照片时，alt 默认取文件名（IMG_20250818_...）。
          // 不含中文的说明在这里兜底成中文；手工写过的中文说明原样保留。
          var rawAlt = String(photo.alt || "").trim();
          var alt = /[\u3400-\u9fff]/.test(rawAlt)
            ? rawAlt
            : (day.title || day.weekday || "本章") + " · 第 " + (photoIndex + 1) + " 帧";
          return {
            id:    photo.id || "",
            thumb: asset(photo.thumbSrc || photo.largeSrc || photo.originalSrc),
            large: asset(photo.largeSrc || photo.originalSrc || photo.thumbSrc),
            alt:   alt,
            crop:  stripCrop(photo)
          };
        });
        var cover = list.filter(function (p) { return p.id && p.id === day.coverPhotoId; })[0] || list[0] || null;
        var diary = day.diary;
        if (diary && typeof diary === "object") diary = diary.text || diary.content || "";
        return {
          id:      day.id || String(i),
          index:   day.index || pad(i + 1),
          title:   day.title || day.weekday || "未命名",
          date:    day.date || "",
          location: day.location || "",
          diary:   diary || "",
          tags:    day.tags || [],
          accent:  day.accent || "#cf4938",
          cover:   cover,
          photos:  list
        };
      })
    };
  }

  function totalFrames() {
    return journal.days.reduce(function (n, d) { return n + d.photos.length; }, 0);
  }

  /* ---------- 公共外壳 ------------------------------------------------- */

  function topRail(center) {
    return (
      '<header class="top-rail">' +
        '<span>' + esc(journal.title) + " · " + esc(COPY.journalLabel) + "</span>" +
        '<span class="rail-center">' + esc(center) + "</span>" +
        '<span class="rail-swatches" aria-hidden="true">' +
          "<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>" +
        "</span>" +
      "</header>"
    );
  }

  function foot(right) {
    return (
      '<footer class="site-foot"><span>' + esc(COPY.footLeft) +
      "</span><span>" + esc(right) + "</span></footer>"
    );
  }

  /* ---------- 首页 ----------------------------------------------------- */

  function renderIndex() {
    var days = journal.days;
    var frames = totalFrames();

    // 左栏章节索引：画册目录式细线列表，不再套面板外框。
    var rows = days.map(function (day) {
      return (
        '<li><a href="' + esc(dayHref(day)) + '" style="--tone:' + esc(day.accent) + '">' +
          '<span class="ix">' + esc(day.index) + "</span>" +
          '<span class="nm">' + esc(day.title || "未命名") + "</span>" +
          '<span class="when">' + esc(day.date || "—") + "</span>" +
          '<span class="count">' + day.photos.length + " 张</span>" +
          '<span class="arrow" aria-hidden="true">↗</span>' +
        "</a></li>"
      );
    }).join("");

    var indexPanel =
      '<nav class="chapter-index" aria-label="章节目录">' +
        '<div class="ci-head"><span>' + esc(COPY.indexTitle) + "</span>" +
          "<span>共 " + days.length + " 章 · " + frames + " 帧</span></div>" +
        '<ol class="index-rows">' + rows + "</ol>" +
      "</nav>";

    // 三段式：封面题头 / 章节目录 / 页脚落款，中段留白由 flex 自动撑开。
    var left =
      '<section class="home-copy">' +
        '<div class="copy-top">' +
          '<div class="kicker-row">' +
            '<span class="microline">' + esc(COPY.rollLabel) + " · " + esc(COPY.region) + "</span>" +
            '<span class="kicker-rule" aria-hidden="true"></span>' +
            '<span class="microline dim">' + esc(COPY.journalLabel) + "</span>" +
          "</div>" +
          '<p class="home-eyebrow">' + esc(COPY.journalSub) + "</p>" +
          '<h1 class="home-title rise"><span class="solid">' + esc(journal.title) +
            '</span><span class="outline">影像</span></h1>' +
          '<div class="title-rule" aria-hidden="true"></div>' +
          (journal.range ? '<p class="home-range">' + esc(journal.range) + "</p>" : "") +
          '<p class="home-summary">' + esc(journal.summary) + "</p>" +
        "</div>" +
        indexPanel +
        '<div class="colophon">' +
          '<span class="co-line" aria-hidden="true"></span>' +
          "<p>" + esc(COPY.footLeft) + "</p>" +
          '<span class="co-seal" aria-hidden="true">卷</span>' +
        "</div>" +
      "</section>";

    // 右栏：胶片横幅
    var strips = days.map(function (day) {
      var cover = day.cover;
      var crop = cover ? cover.crop : { zoom: "800%", pos: "50%", hero: "50%" };
      var photoStyle = cover
        ? "background-image:" + cssUrl(cover.large || cover.thumb)
        : "";
      return (
        '<a class="film-strip' + (cover ? "" : " empty") + '" href="' + esc(dayHref(day)) + '"' +
          ' style="--tone:' + esc(day.accent) + ';--strip-zoom:' + crop.zoom +
          ';--crop-y:' + crop.pos + ';--hero-y:' + crop.hero + '">' +
          '<span class="strip-photo" style="' + photoStyle + '"></span>' +
          '<span class="perf top" aria-hidden="true"></span>' +
          '<span class="perf bottom" aria-hidden="true"></span>' +
          '<span class="strip-index">' + esc(day.index) + "</span>" +
          '<span class="strip-top">' + esc(day.title) + "</span>" +
          '<span class="strip-img-count">' + day.photos.length + " 张</span>" +
          '<span class="strip-copy"><strong>' + esc(day.title) + "</strong>" +
            "<small>" + esc([day.date, day.location,
              day.photos.length + " 张"].filter(Boolean).join(" · ")) + "</small></span>" +
        "</a>"
      );
    }).join("");

    var right =
      '<section class="film-strips" aria-label="章节">' + strips + "</section>";

    app.innerHTML =
      topRail(COPY.rollLabel + " — " + COPY.coverLabel) +
      '<main class="home-layout">' + left + right + "</main>" +
      foot(COPY.footRight + " · 共 " + frames + " 帧");
  }

  /* ---------- 详情页 --------------------------------------------------- */

  function dayHref(day) {
    return "#/trip/" + encodeURIComponent(journal.id) + "/" + encodeURIComponent(day.id);
  }

  function renderDetail(dayId) {
    var day = journal.days.filter(function (item) { return item.id === dayId; })[0];
    if (!day) { location.hash = "#/"; return; }

    var cover = day.cover;
    var crop = cover ? cover.crop : { hero: "50%" };
    var heroStyle = cover
      ? 'style="background-image:' + cssUrl(cover.large || cover.thumb) +
        ';--crop-y:' + crop.hero + '"'
      : 'style="--tone:' + esc(day.accent) + '"';

    var tags = day.tags.length
      ? '<p class="tags">' + day.tags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</p>"
      : "";
    var diary = day.diary ? '<p class="diary">' + esc(day.diary) + "</p>" : "";

    var grid = day.photos.length
      ? day.photos.map(function (photo, i) {
          return (
            '<figure class="frame"><img src="' + esc(photo.thumb) + '" data-index="' + i +
            '" alt="' + esc(photo.alt) + '" loading="lazy">' +
            '<figcaption><span>' + esc(photo.alt || "本帧") + "</span><span>" +
            pad(i + 1) + " / " + pad(day.photos.length) + "</span></figcaption></figure>"
          );
        }).join("")
      : '<p class="empty-note">' + esc(COPY.emptyNote) + "</p>";

    app.innerHTML =
      topRail(COPY.rollLabel + " — " + day.title) +
      '<main style="position:relative">' +
        '<a class="back" href="#/">' + esc(COPY.back) + "</a>" +
        '<div class="detail-hero" style="--tone:' + esc(day.accent) + '">' +
          '<div class="hero-photo" ' + heroStyle + "></div>" +
          '<div class="chapter-panel" style="--tone:' + esc(day.accent) + '">' +
            '<p class="kicker">' + esc(COPY.rollLabel) + " / 第 " + esc(day.index) + " 章</p>" +
            "<h1>" + esc(day.title) + "</h1>" +
            '<p class="meta">' + esc([day.date, day.location,
              "共 " + day.photos.length + " 张"].filter(Boolean).join("  /  ")) + "</p>" +
            diary + tags +
          "</div>" +
        "</div>" +
        '<div class="frames-head"><span>' + esc(COPY.selectedLabel) + "</span><strong>" +
          pad(day.photos.length) + "</strong></div>" +
        '<div class="frames">' + grid + "</div>" +
      "</main>" +
      foot(day.title + " / 共 " + day.photos.length + " 张");

    Array.prototype.forEach.call(app.querySelectorAll(".frames img"), function (img) {
      img.addEventListener("click", function () {
        open(day.photos, Number(img.dataset.index));
      });
    });
  }

  // 内联 style="..." 用双引号包住，所以这里必须用单引号，否则 HTML 属性会被截断。
  function cssUrl(url) {
    return "url('" + String(url).replace(/['"\\\r\n]/g, "") + "')";
  }

  /* ---------- 灯箱 ----------------------------------------------------- */

  function paintLightbox() {
    var photo = photos[photoIndex];
    lightbox.innerHTML =
      '<button class="lb-close" data-act="close" aria-label="关闭">×</button>' +
      (photos.length > 1
        ? '<button class="lb-prev" data-act="prev" aria-label="上一张">‹</button>' +
          '<button class="lb-next" data-act="next" aria-label="下一张">›</button>'
        : "") +
      '<img src="' + esc(photo.large) + '" alt="' + esc(photo.alt) + '">' +
      '<p class="lb-caption">' + esc(photo.alt) + "<span>" + (photoIndex + 1) +
      " / " + photos.length + "</span></p>";
  }

  function open(list, index) {
    photos = list;
    photoIndex = index;
    lightbox.hidden = false;
    document.body.classList.add("locked");
    paintLightbox();
  }

  function close() {
    lightbox.hidden = true;
    lightbox.innerHTML = "";
    document.body.classList.remove("locked");
  }

  function step(delta) {
    photoIndex = (photoIndex + delta + photos.length) % photos.length;
    paintLightbox();
  }

  lightbox.addEventListener("click", function (event) {
    var act = event.target.dataset && event.target.dataset.act;
    if (act === "close" || event.target === lightbox) close();
    else if (act === "prev") step(-1);
    else if (act === "next") step(1);
  });

  document.addEventListener("keydown", function (event) {
    if (lightbox.hidden) return;
    if (event.key === "Escape") close();
    else if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
  });

  /* ---------- 路由 ----------------------------------------------------- */

  function render() {
    var match = (location.hash || "").match(/^#\/trip\/[^/]+\/([^/?#]+)/);
    // 首页锁定为一屏（只有右栏能滚）；详情页恢复整页滚动。
    document.body.classList.toggle("is-home", !match);
    if (match) renderDetail(decodeURIComponent(match[1]));
    else renderIndex();
    window.scrollTo(0, 0);
  }

  load()
    .then(function (raw) {
      journal = normalize(raw);
      document.title = journal.title + " — " + COPY.journalLabel;
      render();
    })
    .catch(function (error) {
      app.innerHTML = '<p class="error">读取失败：' + esc(error.message) + "</p>";
    });

  window.addEventListener("hashchange", render);
})();
