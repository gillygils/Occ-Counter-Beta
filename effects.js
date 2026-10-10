// Celebrations and the TV brick wall. Everything draws on <canvas>, no libraries.
(function () {
  var COLORS = ["#c8102e", "#1e6b3a", "#f2b632", "#ffffff", "#e8473f", "#3fa463"];
  var reducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fullScreenCanvas(z) {
    var c = document.createElement("canvas");
    c.className = "fx-canvas";
    c.style.zIndex = z;
    document.body.appendChild(c);
    var dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    var ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    return { canvas: c, ctx: ctx, w: innerWidth, h: innerHeight };
  }

  // Big gold pill in the middle of the screen, e.g. "150 boxes!"
  function banner(text) {
    var b = document.createElement("div");
    b.className = "milestone-banner";
    b.textContent = text;
    document.body.appendChild(b);
    setTimeout(function () { b.classList.add("out"); }, 2200);
    setTimeout(function () { b.remove(); }, 2800);
  }

  // Confetti shot up from cannons along the bottom edge.
  window.confetti = function (text) {
    if (text) banner(text);
    if (reducedMotion) return;
    var s = fullScreenCanvas(50);
    var scale = Math.max(1, Math.min(s.w, s.h) / 500);
    var parts = [];
    var cannons = [0.1, 0.3, 0.5, 0.7, 0.9];
    cannons.forEach(function (fx) {
      for (var i = 0; i < 36; i++) {
        var angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
        var speed = (11 + Math.random() * 9) * scale * Math.sqrt(s.h / 700);
        parts.push({
          x: s.w * fx, y: s.h + 10,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          w: (6 + Math.random() * 6) * scale, h: (10 + Math.random() * 8) * scale,
          rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
          color: COLORS[(Math.random() * COLORS.length) | 0]
        });
      }
    });
    var start = performance.now();
    (function frame(now) {
      var t = now - start;
      s.ctx.clearRect(0, 0, s.w, s.h);
      parts.forEach(function (p) {
        p.vy += 0.32 * scale;
        p.vx *= 0.99;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        s.ctx.save();
        s.ctx.translate(p.x, p.y);
        s.ctx.rotate(p.rot);
        s.ctx.fillStyle = p.color;
        // Squash the width to fake the paper flipping over.
        s.ctx.fillRect(-p.w / 2 * Math.cos(p.rot * 3), -p.h / 2, p.w * Math.cos(p.rot * 3), p.h);
        s.ctx.restore();
      });
      if (t < 4500) requestAnimationFrame(frame);
      else s.canvas.remove();
    })(start);
  };

  // Goal reached: black screen, the goal in gold, fireworks behind it, then back to normal.
  window.goalCelebration = function (goal, churchName, onDone) {
    var overlay = document.createElement("div");
    overlay.className = "goal-overlay";
    var inner = document.createElement("div");
    inner.className = "goal-text";
    var top = document.createElement("div");
    top.className = "goal-kicker";
    top.textContent = (churchName ? churchName + " reached the goal" : "Goal reached");
    var num = document.createElement("div");
    num.className = "goal-number";
    num.textContent = goal.toLocaleString();
    var bottom = document.createElement("div");
    bottom.className = "goal-kicker";
    bottom.textContent = goal === 1 ? "shoebox packed" : "shoeboxes packed";
    inner.appendChild(top); inner.appendChild(num); inner.appendChild(bottom);
    document.body.appendChild(overlay);

    var dpr = window.devicePixelRatio || 1;
    var canvas = document.createElement("canvas");
    canvas.className = "goal-canvas";
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    overlay.appendChild(canvas);
    overlay.appendChild(inner);
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    var W = innerWidth, H = innerHeight;
    var scale = Math.max(1, Math.min(W, H) / 600);

    requestAnimationFrame(function () { overlay.classList.add("in"); });

    var rockets = [], sparks = [];
    var FIREWORK_COLORS = ["#f2b632", "#ffd76a", "#ffffff", "#e8473f", "#3fa463", "#ff9f1c"];
    function launch() {
      rockets.push({
        x: W * (0.15 + Math.random() * 0.7), y: H,
        vy: -(H / 55) * (0.8 + Math.random() * 0.35),
        targetY: H * (0.12 + Math.random() * 0.35),
        color: FIREWORK_COLORS[(Math.random() * FIREWORK_COLORS.length) | 0]
      });
    }
    function burst(r) {
      var n = 70;
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i) / n;
        var sp = (2 + Math.random() * 3.5) * scale;
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color: r.color });
      }
    }

    var DURATION = 8000;
    var start = performance.now();
    var lastLaunch = 0;
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      overlay.classList.remove("in");
      setTimeout(function () { overlay.remove(); if (onDone) onDone(); }, 900);
    }
    overlay.addEventListener("click", finish);

    if (reducedMotion) { setTimeout(finish, 5000); return; }

    (function frame(now) {
      if (finished) return;
      var t = now - start;
      ctx.fillStyle = "rgba(0,0,0,0.2)"; // leaves fading trails
      ctx.fillRect(0, 0, W, H);
      if (t < DURATION - 1500 && now - lastLaunch > 380) { launch(); if (Math.random() < 0.4) launch(); lastLaunch = now; }
      rockets = rockets.filter(function (r) {
        r.y += r.vy;
        ctx.fillStyle = r.color;
        ctx.beginPath(); ctx.arc(r.x, r.y, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
        if (r.y <= r.targetY) { burst(r); return false; }
        return true;
      });
      sparks = sparks.filter(function (p) {
        p.vy += 0.05 * scale;
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.012;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        return p.life > 0;
      });
      if (t < DURATION) requestAnimationFrame(frame);
      else finish();
    })(start);
  };

  // TV background: one shoebox brick per box packed, stacking up to the goal.
  window.BrickWall = function (canvas) {
    var ctx = canvas.getContext("2d");
    var count = 0, goal = 0, layout = null;
    var falling = {}; // brick index -> animation start time
    var animating = false;

    function computeLayout() {
      var dpr = window.devicePixelRatio || 1;
      var W = innerWidth, H = innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (goal < 1) { layout = null; return; }
      // Bricks are twice as wide as tall; size them so `goal` bricks fill the screen.
      var bh = Math.sqrt((W * H) / (2 * goal));
      var cols = Math.max(1, Math.floor(W / (2 * bh)));
      var rows = Math.ceil(goal / cols);
      var bw = W / (cols + 0.5);
      bh = bw / 2;
      if (rows * bh > H) { bh = H / rows; bw = bh * 2; }
      layout = { W: W, H: H, cols: cols, rows: rows, bw: bw, bh: bh, x0: (W - (cols + 0.5) * bw) / 2 };
    }

    function slot(i) {
      var L = layout;
      var row = Math.floor(i / L.cols), col = i % L.cols;
      var offset = row % 2 ? L.bw / 2 : 0; // running bond, like a real wall
      return { x: L.x0 + offset + col * L.bw, y: L.H - (row + 1) * L.bh };
    }

    function drawBrick(x, y, w, h, filled) {
      var gap = Math.max(1, Math.min(3, w * 0.04));
      x += gap / 2; y += gap / 2; w -= gap; h -= gap;
      if (!filled) {
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        return;
      }
      if (w < 6) { ctx.fillStyle = "#1e6b3a"; ctx.fillRect(x, y, w, h); return; }
      var lid = h * 0.38;
      ctx.fillStyle = "#1e6b3a"; // green box
      ctx.fillRect(x, y + lid, w, h - lid);
      ctx.fillStyle = "#c8102e"; // red lid
      ctx.fillRect(x, y, w, lid);
      ctx.fillStyle = "rgba(0,0,0,0.22)"; // lid shadow
      ctx.fillRect(x, y + lid, w, Math.max(1, h * 0.06));
      if (w > 28) {
        ctx.fillStyle = "rgba(255,255,255,0.55)"; // white stars on the box
        var r = Math.max(1, h * 0.05);
        [[0.18, 0.68], [0.42, 0.82], [0.66, 0.66], [0.86, 0.84]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(x + w * p[0], y + h * p[1], r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = "#f2b632"; // little emblem on the lid
        ctx.beginPath(); ctx.arc(x + w / 2, y + lid / 2, Math.max(1.5, lid * 0.28), 0, Math.PI * 2); ctx.fill();
      }
    }

    function draw(now) {
      if (!layout) { ctx.clearRect(0, 0, canvas.width, canvas.height); animating = false; return; }
      var L = layout;
      ctx.clearRect(0, 0, L.W, L.H);
      var filled = Math.min(count, goal);
      var still = false;
      for (var i = 0; i < goal; i++) {
        var p = slot(i);
        if (i >= filled) { drawBrick(p.x, p.y, L.bw, L.bh, false); continue; }
        var y = p.y;
        if (falling[i] !== undefined) {
          var k = Math.max(0, Math.min(1, (now - falling[i]) / 450));
          if (k < 1) { still = true; y = p.y - (1 - k * k) * Math.min(L.H * 0.3, L.bh * 6); }
          else delete falling[i];
        }
        drawBrick(p.x, y, L.bw, L.bh, true);
      }
      animating = still;
      if (still) requestAnimationFrame(draw);
    }

    function kick() { if (!animating) { animating = true; requestAnimationFrame(draw); } }

    this.update = function (newCount, newGoal) {
      var goalChanged = newGoal !== goal;
      var prev = count;
      count = newCount; goal = newGoal;
      if (goalChanged || !layout) computeLayout();
      // Drop in new bricks one after another; big jumps just appear.
      if (!reducedMotion && !goalChanged && newCount > prev && newCount - prev <= 20) {
        var t = performance.now();
        for (var i = prev; i < Math.min(newCount, goal); i++) falling[i] = t + (i - prev) * 90;
      }
      kick();
    };

    addEventListener("resize", function () { computeLayout(); kick(); });
  };
})();
