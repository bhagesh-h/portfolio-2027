/* Bhagesh Hunakunti · portfolio
   Progressive enhancement only: the page is complete without this file. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  /* ---------- Theme toggle ------------------------------------------------ */
  var toggle = document.querySelector('.theme-toggle');

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return darkScheme.matches ? 'dark' : 'light';
  }

  function syncThemeUi() {
    var theme = currentTheme();
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    var paper = getComputedStyle(root).getPropertyValue('--paper').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute('content', paper);
    });
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncThemeUi();
    });
  }
  darkScheme.addEventListener('change', syncThemeUi);
  syncThemeUi();

  /* ---------- Header state + current section in the nav -------------------- */
  var header = document.querySelector('.site-header');
  // Whole sections drive the highlight.
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]')).filter(function (a) {
    var el = document.getElementById(a.getAttribute('href').slice(1));
    return el && el.tagName === 'SECTION';
  });
  var targets = navLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);

      // The last section whose top has passed 45% of the viewport is current;
      // at the very bottom the last section wins even if it is short.
      var line = window.innerHeight * 0.45, current = -1;
      targets.forEach(function (el, i) {
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = targets.length - 1;
      navLinks.forEach(function (a, i) {
        if (i === current) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Tool logos ------------------------------------------------------
     On wide screens with a mouse, hover opens a logo (CSS). Everywhere else a
     tap or click on the logo toggles it, closing the others; on phones the
     grid reflow is animated with a view transition when the browser has one. */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var wide = window.matchMedia('(min-width: 760px)');
  var tools = Array.prototype.slice.call(document.querySelectorAll('.tool'));

  function setOpen(tool, open) {
    tool.classList.toggle('is-open', open);
    var btn = tool.querySelector('.tool-hex');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function openOnly(target) {
    var change = function () {
      tools.forEach(function (t) { setOpen(t, t === target); });
      document.dispatchEvent(new CustomEvent('toolslayout'));
    };
    var reveal = function () {
      if (target && !wide.matches) target.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    };
    if (!wide.matches && document.startViewTransition && !reduceMotion.matches) {
      var vt = document.startViewTransition(change);
      if (vt && vt.finished) vt.finished.then(reveal, reveal); else reveal();
    } else { change(); reveal(); }
  }

  if (tools.length) {
    tools.forEach(function (tool) {
      var btn = tool.querySelector('.tool-hex');
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (wide.matches && finePointer.matches) return;    // hover already does it
        openOnly(tool.classList.contains('is-open') ? null : tool);
      });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.tool')) return;
      if (tools.some(function (t) { return t.classList.contains('is-open'); })) openOnly(null);
    });
  }

  /* ---------- Nucleotide layer ----------------------------------------------
     A hexagonal grid fixed to the page. Single cells light up with a white
     A, T, G or C (fill colour encodes the base) and pick a new letter every
     time they fade back in. Cells near the cursor, or a finger, light up and
     trail off. Before anything lights, the layout is mapped so cells only ever
     appear in empty space: never under text, cards, buttons, links, rules or
     the portrait sticker. A faint lattice surrounds the portrait. */
  var layer = document.querySelector('.dna-layer');
  var portrait = document.querySelector('.portrait');

  if (layer && window.Uint8Array && window.Map) {
    var BASES = ['A', 'T', 'G', 'C'];
    var TEXT = '.hero-name, .hero-role, .hero-lede, .section-head h2, .section-lede, .site-footer p';
    var BOXES = '.btn, .text-link, .tool-hex, .elsewhere a';
    // The header (sticky) and the phone menu (fixed) move with the screen, so they
    // are checked live in screen coordinates instead of in the page map.
    var FIXED = ['.site-header', '.nav ul'];
    var RULES = '.section + .section, .site-footer';
    var STICKER = [[50, 14.53], [100, 43.4], [100, 101.13], [50, 130], [0, 101.13], [0, 43.4]];
    var MAX_CELLS = 140;

    var R = 14, DX = 0, DY = 0, cols = 0, rows = 0, free = null, docW = 0, docH = 0;
    var active = new Map(), pool = [], fading = [], pendingOn = [], made = 0;
    var halo = null, haloBox = null;
    var mouse = { x: 0, y: 0, cx: 0, cy: 0, on: false, dirty: false };
    var raf = 0, nextSpawn = 0, liveRects = [];
    var rand = Math.random;

    function colX(r, c) { return c * DX + ((r & 1) ? DX / 2 : 0); }

    function inPolygon(x, y, poly) {
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }

    // Mark every cell whose hexagon touches the box [x0,y0]-[x1,y1] (page coords) as taken.
    function block(x0, y0, x1, y1) {
      var r0 = Math.max(0, Math.floor((y0 - R) / DY)), r1 = Math.min(rows - 1, Math.ceil((y1 + R) / DY));
      for (var r = r0; r <= r1; r++) {
        var y = r * DY;
        if (y + R < y0 || y - R > y1) continue;
        var off = (r & 1) ? DX / 2 : 0;
        var c0 = Math.max(0, Math.floor((x0 - DX - off) / DX)), c1 = Math.min(cols - 1, Math.ceil((x1 + DX - off) / DX));
        for (var c = c0; c <= c1; c++) {
          var x = c * DX + off;
          if (x + DX / 2 < x0 || x - DX / 2 > x1) continue;
          free[r * cols + c] = 0;
        }
      }
    }

    function readLive() {
      liveRects = [];
      FIXED.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        var b = el.getBoundingClientRect();
        if (b.bottom > 0 && b.top < window.innerHeight && b.width) liveRects.push(b);
      });
      // An open (or hovered) logo grows an orange label; keep cells clear of it too.
      document.querySelectorAll('.tool.is-open, .tool:hover').forEach(function (el) {
        liveRects.push(el.getBoundingClientRect());
      });
    }

    // True if the cell at page position (x, y) would sit under the header or the menu.
    function underFixed(x, y) {
      var vx = x - window.scrollX, vy = y - window.scrollY, m = R * 0.5;
      for (var i = 0; i < liveRects.length; i++) {
        var b = liveRects[i];
        if (vx + DX / 2 > b.left - m && vx - DX / 2 < b.right + m && vy + R > b.top - m && vy - R < b.bottom + m) return true;
      }
      return false;
    }

    function build() {
      var sx = window.scrollX, sy = window.scrollY, prevR = R, prevCols = cols;
      docW = layer.clientWidth; docH = layer.clientHeight;
      if (!docW || !docH) return;
      R = docW < 600 ? 12 : 14;
      DX = Math.sqrt(3) * R; DY = 1.5 * R;
      layer.style.setProperty('--nt-w', (DX * 0.9).toFixed(2) + 'px');
      layer.style.setProperty('--nt-h', (2 * R * 0.9).toFixed(2) + 'px');
      layer.style.setProperty('--nt-fs', Math.round(R * 0.95) + 'px');

      cols = Math.floor(docW / DX) + 1;
      rows = Math.floor(docH / DY) + 1;
      free = new Uint8Array(rows * cols);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = colX(r, c), y = r * DY;
          free[r * cols + c] = (x - DX / 2 >= 0 && x + DX / 2 <= docW && y - R >= 0 && y + R <= docH) ? 1 : 0;
        }
      }

      var m = R * 0.5;   // breathing room around every element
      function rect(b) {
        if (b.width || b.height) block(b.left + sx - m, b.top + sy - m, b.right + sx + m, b.bottom + sy + m);
      }
      var range = document.createRange();
      document.querySelectorAll(TEXT).forEach(function (el) {
        range.selectNodeContents(el);                       // tight boxes around each line of text
        Array.prototype.forEach.call(range.getClientRects(), rect);
      });
      document.querySelectorAll(BOXES).forEach(function (el) { rect(el.getBoundingClientRect()); });
      document.querySelectorAll(RULES).forEach(function (el) {
        var b = el.getBoundingClientRect();
        block(b.left + sx - m, b.top + sy - m, b.right + sx + m, b.top + sy + 1 + m);
      });

      haloBox = null;
      if (portrait) {
        var p = portrait.getBoundingClientRect();
        var ox = p.left + sx, oy = p.top + sy, pw = p.width, ph = p.height;
        var poly = STICKER.map(function (v) { return [ox + v[0] / 100 * pw, oy + v[1] / 130 * ph]; });
        block(ox + 0.4 * pw - m, oy - m, ox + pw + m, oy + 0.4 * ph + m);   // head and shoulders above the sticker
        var pr0 = Math.max(0, Math.floor((oy - R) / DY)), pr1 = Math.min(rows - 1, Math.ceil((oy + ph + R) / DY));
        for (var rr = pr0; rr <= pr1; rr++) {
          for (var cc = 0; cc < cols; cc++) {
            var hx = colX(rr, cc), hy = rr * DY;
            if (hx < ox - DX || hx > ox + pw + DX) continue;
            // blocked if the centre or any corner of the cell falls on the sticker
            var hit = inPolygon(hx, hy, poly);
            for (var k = 0; k < 6 && !hit; k++) {
              var a = Math.PI / 180 * (60 * k - 90);
              hit = inPolygon(hx + R * Math.cos(a), hy + R * Math.sin(a), poly);
            }
            if (hit) free[rr * cols + cc] = 0;
          }
        }
        haloBox = { x: ox - 0.24 * pw, y: oy - 0.14 * ph, w: 1.48 * pw, h: 1.28 * ph };
      }

      // Lit cells fade out if the grid changed or something now sits on them.
      active.forEach(function (cell, key) {
        if (R !== prevR || cols !== prevCols || !free[key]) cell.until = 0;
      });
      drawHalo();
      if (reduceMotion.matches) seedStill();
    }

    function haloWeight(x, y) {
      if (!haloBox) return 0;
      var nx = (x - haloBox.x - haloBox.w / 2) / (haloBox.w / 2);
      var ny = (y - haloBox.y - haloBox.h / 2) / (haloBox.h / 2);
      var d = Math.sqrt(nx * nx + ny * ny);
      return d < 0.58 ? 1 : Math.max(0, 1 - (d - 0.58) / 0.4);
    }

    function hexPath(ctx, x, y, r) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 90);
        if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
        else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.closePath();
    }

    function drawHalo() {
      if (!haloBox) { if (halo) halo.remove(); halo = null; return; }
      if (!halo) {
        halo = document.createElement('canvas');
        halo.className = 'dna-halo';
        layer.insertBefore(halo, layer.firstChild);
      }
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      halo.style.transform = 'translate(' + haloBox.x + 'px,' + haloBox.y + 'px)';
      halo.style.width = haloBox.w + 'px';
      halo.style.height = haloBox.h + 'px';
      halo.width = Math.round(haloBox.w * dpr);
      halo.height = Math.round(haloBox.h * dpr);
      var ctx = halo.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, -haloBox.x * dpr, -haloBox.y * dpr);
      ctx.strokeStyle = getComputedStyle(root).getPropertyValue('--line').trim() || '#ccc';
      ctx.lineWidth = 1;
      var r0 = Math.max(0, Math.floor(haloBox.y / DY)), r1 = Math.min(rows - 1, Math.ceil((haloBox.y + haloBox.h) / DY));
      for (var r = r0; r <= r1; r++) {
        for (var c = 0; c < cols; c++) {
          if (!free[r * cols + c]) continue;
          var x = colX(r, c), y = r * DY, w = haloWeight(x, y);
          if (w <= 0) continue;
          ctx.globalAlpha = w;
          hexPath(ctx, x, y, R * 0.9);
          ctx.stroke();
        }
      }
    }

    function makeCell() {
      var el = document.createElement('span');
      el.className = 'nt';
      el.appendChild(document.createElement('span'));
      layer.appendChild(el);
      made++;
      return el;
    }

    function light(r, c, now, ms) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return;
      var key = r * cols + c;
      if (!free[key]) return;
      var x = colX(r, c), y = r * DY;
      if (underFixed(x, y)) return;
      var cell = active.get(key);
      if (cell) { if (now + ms > cell.until) cell.until = now + ms; return; }
      var el = pool.pop() || (made < MAX_CELLS ? makeCell() : null);
      if (!el) return;
      var base = BASES[(rand() * 4) | 0];                  // a fresh letter every time it fades in
      el.className = 'nt nt-' + base;
      el.firstChild.textContent = base;
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      active.set(key, { el: el, until: now + ms, x: x, y: y });
      pendingOn.push(el);
    }

    function lightAround(px, py, now) {
      var reach = R * 4.2;
      var r0 = Math.floor((py - reach) / DY), r1 = Math.ceil((py + reach) / DY);
      for (var r = r0; r <= r1; r++) {
        var off = (r & 1) ? DX / 2 : 0;
        var c0 = Math.floor((px - reach - off) / DX), c1 = Math.ceil((px + reach - off) / DX);
        for (var c = c0; c <= c1; c++) {
          var dx = c * DX + off - px, dy = r * DY - py, d = Math.sqrt(dx * dx + dy * dy);
          if (d <= reach) light(r, c, now, 450 + (1 - d / reach) * 750);
        }
      }
    }

    function spawn(now) {
      var top = window.scrollY, vh = window.innerHeight;
      var nearPortrait = haloBox && rand() < 0.4 && haloBox.y + haloBox.h > top && haloBox.y < top + vh;
      for (var t = 0; t < 10; t++) {
        var x, y;
        if (nearPortrait) { x = haloBox.x + rand() * haloBox.w; y = haloBox.y + rand() * haloBox.h; }
        else { x = rand() * docW; y = top + rand() * vh; }
        var r = Math.round(y / DY), c = Math.round((x - ((r & 1) ? DX / 2 : 0)) / DX);
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        var key = r * cols + c;
        if (!free[key] || active.has(key)) continue;
        if (nearPortrait && haloWeight(colX(r, c), r * DY) < 0.5) continue;
        light(r, c, now, 1600 + rand() * 2400);
        return;
      }
    }

    function tick(now) {
      raf = 0;
      if (document.hidden) return;
      readLive();
      if (pendingOn.length) {
        pendingOn.forEach(function (el) { el.classList.add('on'); });
        pendingOn = [];
      }
      if (mouse.dirty && mouse.on) { lightAround(mouse.x, mouse.y, now); mouse.dirty = false; }
      if (now >= nextSpawn) {
        spawn(now);
        nextSpawn = now + (docW < 600 ? 320 : 210) + rand() * 260;
      }
      active.forEach(function (cell, key) {
        if (cell.until > now && underFixed(cell.x, cell.y)) cell.until = 0;
        if (cell.until <= now) {
          cell.el.classList.remove('on');
          active.delete(key);
          fading.push({ el: cell.el, at: now + 800 });
        }
      });
      while (fading.length && fading[0].at <= now) pool.push(fading.shift().el);
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (!raf && !reduceMotion.matches && !document.hidden) raf = requestAnimationFrame(tick);
    }

    // Reduced motion: a still scattering of letters, no fades, no cursor response.
    function seedStill() {
      active.forEach(function (cell) { cell.el.classList.remove('on'); pool.push(cell.el); });
      active.clear();
      readLive();
      var target = Math.max(10, Math.min(40, Math.round(docW * docH / 90000))), placed = 0;
      for (var t = 0; t < target * 30 && placed < target; t++) {
        var r = (rand() * rows) | 0, c = (rand() * cols) | 0;
        if (!free[r * cols + c] || active.has(r * cols + c)) continue;
        light(r, c, 0, Infinity);
        placed++;
      }
      pendingOn.forEach(function (el) { el.classList.add('on'); });
      pendingOn = [];
    }

    function track(e) {
      if (reduceMotion.matches) return;
      mouse.cx = e.clientX; mouse.cy = e.clientY;
      mouse.x = e.pageX; mouse.y = e.pageY;
      mouse.on = true; mouse.dirty = true;
    }
    document.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') track(e); }, { passive: true });
    document.addEventListener('pointerdown', track, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { mouse.on = false; }, { passive: true });
    window.addEventListener('scroll', function () {
      if (reduceMotion.matches) {
        // No animation loop here: just hide still cells while they sit under the header or menu.
        readLive();
        active.forEach(function (cell) { cell.el.classList.toggle('on', !underFixed(cell.x, cell.y)); });
        return;
      }
      if (!mouse.on) return;
      mouse.x = mouse.cx + window.scrollX; mouse.y = mouse.cy + window.scrollY; mouse.dirty = true;
    }, { passive: true });

    var rebuildTimer = 0;
    function rebuildSoon() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(build, 150); }

    readLive();
    build();
    start();
    if ('ResizeObserver' in window) new ResizeObserver(rebuildSoon).observe(document.body);
    else window.addEventListener('resize', rebuildSoon);
    window.addEventListener('load', rebuildSoon);
    document.addEventListener('toolslayout', function () { setTimeout(build, 700); });   // after the logos settle
    setTimeout(build, 1300);                                // after the hero's entrance has settled
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuildSoon);
    document.addEventListener('visibilitychange', start);
    reduceMotion.addEventListener('change', function () { build(); start(); });
    document.addEventListener('themechange', drawHalo);
  }
})();
