// Shared by every page: draws the gift-box logo, turns it into the page menu,
// and talks to server.js.
(function () {
  var LOGO_SVG =
    '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<g transform="translate(78 10) rotate(-12)">' +
        '<path d="M0 10 L30 6 L36 10 L30 14 Z" fill="#1e6b3a"/>' +
        '<path d="M14 9 L8 0 L13 0 L22 8 Z" fill="#1e6b3a"/>' +
        '<path d="M14 11 L8 20 L13 20 L22 12 Z" fill="#1e6b3a"/>' +
        '<path d="M2 10 L-2 4 L2 4 L6 9 Z" fill="#1e6b3a"/>' +
      '</g>' +
      '<path d="M60 30 C 48 30, 30 40, 18 30" stroke="#f2b632" stroke-width="2" stroke-dasharray="4 4" fill="none"/>' +
      '<rect x="18" y="58" width="84" height="52" rx="4" fill="#c8102e"/>' +
      '<rect x="12" y="46" width="96" height="16" rx="4" fill="#9b0c23"/>' +
      '<rect x="53" y="46" width="14" height="64" fill="#1e6b3a"/>' +
      '<path d="M60 46 C 44 30, 34 40, 44 46 Z" fill="#1e6b3a"/>' +
      '<path d="M60 46 C 76 30, 86 40, 76 46 Z" fill="#1e6b3a"/>' +
      '<circle cx="60" cy="46" r="5" fill="#f2b632"/>' +
    '</svg>';

  var PAGES = [
    { href: "index.html", label: "Counter", id: "counter" },
    { href: "index.html#tv", label: "TV display", id: "tv" },
    { href: "log.html", label: "Packing log", id: "log" }
  ];

  // Builds the logo button + menu inside <div class="logo-wrap" id="logo-wrap">.
  // currentPage() returns the id of the page being shown.
  window.setupLogoMenu = function (currentPage) {
    var wrap = document.getElementById("logo-wrap");
    var btn = document.createElement("button");
    btn.className = "logo";
    btn.type = "button";
    btn.setAttribute("aria-label", "Open page menu");
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = LOGO_SVG;

    var menu = document.createElement("nav");
    menu.className = "menu";
    menu.hidden = true;
    PAGES.forEach(function (p) {
      var a = document.createElement("a");
      a.href = p.href;
      a.textContent = p.label;
      a.dataset.page = p.id;
      menu.appendChild(a);
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);

    // Use logo.png if present, otherwise keep the built-in SVG.
    var img = new Image();
    img.onload = function () { img.alt = ""; btn.innerHTML = ""; btn.appendChild(img); };
    img.src = "logo.png";

    function setOpen(open) {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) {
        var cur = currentPage();
        Array.prototype.forEach.call(menu.children, function (a) {
          if (a.dataset.page === cur) a.setAttribute("aria-current", "page");
          else a.removeAttribute("aria-current");
        });
      }
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); setOpen(menu.hidden); });
    menu.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  };

  window.api = function (method, path, body) {
    return fetch(path, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ("Server error " + r.status));
        return d;
      });
    });
  };

  // "2026-10-11" -> "11 October 2026" (or "11 Oct 2026" when short is true)
  window.formatDate = function (iso, short) {
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: short ? "short" : "long", year: "numeric" });
  };

  window.todayIso = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  // Two-tap confirm for destructive buttons (pop-up dialogs are easy to miss on phones).
  window.confirmTap = function (btn, armedText, action) {
    if (btn.dataset.armed) {
      clearTimeout(+btn.dataset.armed);
      delete btn.dataset.armed;
      btn.textContent = btn.dataset.label;
      btn.classList.remove("armed");
      action();
      return;
    }
    btn.dataset.label = btn.textContent;
    btn.textContent = armedText;
    btn.classList.add("armed");
    btn.dataset.armed = String(setTimeout(function () {
      delete btn.dataset.armed;
      btn.textContent = btn.dataset.label;
      btn.classList.remove("armed");
    }, 3000));
  };
})();
