/* ════════════════════════════════════════════════════════════════════════════
   АУДИОЭКСКУРСИЯ ПО СИТИ-ЦЕНТРУ — клиентский JS
   ════════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 1. Reveal on scroll ─────────────────────────────────────────────── */

  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length && !prefersReducedMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ── 2. Параллакс для фото ───────────────────────────────────────────── */

  const parallaxEls = document.querySelectorAll("[data-parallax]");
  if (parallaxEls.length && !prefersReducedMotion) {
    let raf = null;
    const update = () => {
      const vh = window.innerHeight;
      parallaxEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > vh + 100) return;
        const k = parseFloat(el.dataset.parallax) || 0.15;
        const center = rect.top + rect.height / 2;
        const offset = (center - vh / 2) * -k;
        const img = el.querySelector("img");
        if (img) img.style.transform = `translateY(${offset.toFixed(1)}px) scale(1.08)`;
      });
      raf = null;
    };
    window.addEventListener(
      "scroll",
      () => { if (!raf) raf = requestAnimationFrame(update); },
      { passive: true }
    );
    update();
  }

  /* ── 3. Топбар: прогресс прокрутки + смена темы по точкам ─────────────── */

  const topbar = document.querySelector(".topbar");
  const progressBar = document.querySelector(".topbar__progress-bar");
  const navLinks = document.querySelectorAll(".topbar__nav a");
  const points = Array.from(document.querySelectorAll(".point"));

  // карта тем для топбара по фону точки
  const themeByPoint = {
    "1": "",          // светлая (cream)
    "2": "is-dark",   // burgundy
    "3": "is-dark",   // navy
    "4": "",          // светлая (тёплая)
    "5": "",          // светлая (как точка 1)
  };

  const onScroll = () => {
    // прогресс
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docH > 0 ? Math.min(1, Math.max(0, window.scrollY / docH)) : 0;
    if (progressBar) progressBar.style.width = (ratio * 100).toFixed(2) + "%";

    // активная точка + тема топбара
    let activePoint = null;
    const probe = window.innerHeight * 0.35;
    for (const p of points) {
      const r = p.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { activePoint = p; break; }
    }

    navLinks.forEach((a) => a.classList.remove("is-active"));
    topbar.classList.remove("is-dark", "is-pink");

    if (activePoint) {
      const num = activePoint.dataset.point;
      const link = document.querySelector(`.topbar__nav a[data-nav="${num}"]`);
      if (link) link.classList.add("is-active");
      const theme = themeByPoint[num];
      if (theme) topbar.classList.add(theme);
    }
  };

  let scrollRaf = null;
  window.addEventListener(
    "scroll",
    () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(() => { onScroll(); scrollRaf = null; }); },
    { passive: true }
  );
  onScroll();

  /* ── 4. Курсор (только для устройств с hover) ─────────────────────────── */

  const cursor = document.querySelector(".cursor");
  if (cursor && window.matchMedia("(hover: hover)").matches) {
    const dot = cursor.querySelector(".cursor__dot");
    const ring = cursor.querySelector(".cursor__ring");
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; });
    const tick = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (dot) { dot.style.left = mx + "px"; dot.style.top = my + "px"; }
      if (ring) { ring.style.left = rx + "px"; ring.style.top = ry + "px"; }
      requestAnimationFrame(tick);
    };
    tick();

    const hoverables = document.querySelectorAll(
      "a, button, .audio, .resident, .film, .point__photo, .hero__hint"
    );
    hoverables.forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
    });
  }

  /* ── 5. Аудиоплееры ──────────────────────────────────────────────────── */

  // Один-плеер-за-раз: пауза остальных при play
  const allPlayers = [];

  document.querySelectorAll("[data-audio]").forEach((root) => {
    const playBtn = root.querySelector(".audio__play");
    const bar = root.querySelector(".audio__bar");
    const progressFill = root.querySelector(".audio__progress-fill");
    const seekInput = root.querySelector(".audio__seek");
    const timeCur = root.querySelector(".audio__time-cur");
    const timeDur = root.querySelector(".audio__time-dur");
    const src = root.dataset.src;

    // Создаём <audio>
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = src;

    let isReady = false;
    audio.addEventListener("loadedmetadata", () => {
      isReady = true;
      timeDur.textContent = fmt(audio.duration);
    });
    audio.addEventListener("error", () => {
      timeDur.textContent = "нет файла";
      root.classList.add("is-missing");
    });
    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      if (progressFill) progressFill.style.width = pct + "%";
      if (seekInput) seekInput.value = pct;
      timeCur.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener("ended", () => {
      root.classList.remove("is-playing");
      if (progressFill) progressFill.style.width = "0%";
      if (seekInput) seekInput.value = 0;
      timeCur.textContent = "0:00";
    });
    audio.addEventListener("pause", () => root.classList.remove("is-playing"));
    audio.addEventListener("play", () => {
      // пауза всех остальных
      allPlayers.forEach((other) => { if (other.audio !== audio) other.audio.pause(); });
      root.classList.add("is-playing");
    });

    playBtn.addEventListener("click", () => {
      if (audio.paused) audio.play().catch(() => {
        timeDur.textContent = "нет файла";
        root.classList.add("is-missing");
      });
      else audio.pause();
    });

    // Перемотка по перемещению ползунка
    if (seekInput) {
      let isSeeking = false;

      seekInput.addEventListener("mousedown", () => {
        isSeeking = true;
      });

      seekInput.addEventListener("input", () => {
        if (!isReady || !audio.duration) return;
        const targetTime = (seekInput.value / 100) * audio.duration;
        audio.currentTime = targetTime;
        // Если аудио на паузе — запускаем
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      });

      seekInput.addEventListener("mouseup", () => {
        isSeeking = false;
      });

      // Поддержка touch для мобильных
      seekInput.addEventListener("touchstart", () => {
        isSeeking = true;
      }, { passive: true });

      seekInput.addEventListener("touchend", () => {
        isSeeking = false;
      }, { passive: true });
    }

    allPlayers.push({ audio, root, point: root.closest(".point") });
  });

  /* ── 5b. Автовоспроизведение при появлении в зоне видимости ──────────── */

  // IntersectionObserver для автоплея — только паузит/запускает, не перезапускает с начала
  if ("IntersectionObserver" in window) {
    let currentPlaying = null;

    const autoplayObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const player = allPlayers.find((p) => p.point === entry.target);
            if (!player) return;

            // если другой трек играет — ставим на паузу
            if (currentPlaying && currentPlaying !== player) {
              currentPlaying.audio.pause();
            }

            // только если уже играет — меняем currentPlaying
            if (!player.audio.paused) {
              currentPlaying = player;
            }
          } else {
            // точка вышла из зоны видимости
            const player = allPlayers.find((p) => p.point === entry.target);
            if (player && !player.audio.paused) {
              player.audio.pause();
              if (currentPlaying === player) currentPlaying = null;
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // наблюдаем за всеми точками с аудио
    allPlayers.forEach((p) => {
      if (p.point) autoplayObserver.observe(p.point);
    });
  }

  /* ── 6. Подсветка точки при переходе по якорю (с QR-кода) ─────────────── */

  const flashPointFromHash = () => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith("#point-")) return;
    const target = document.querySelector(hash);
    if (!target) return;
    target.classList.add("is-highlighted");
    setTimeout(() => target.classList.remove("is-highlighted"), 2500);
  };
  window.addEventListener("hashchange", flashPointFromHash);
  // и на начальной загрузке — после reveal
  setTimeout(flashPointFromHash, 200);

  /* ── 7. Вспомогательные ──────────────────────────────────────────────── */

  function fmt(sec) {
    if (!isFinite(sec)) return "—";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  /* ── 8. Лёгкое обогащение: корректные кавычки в селекшене (ничего) ─── */
  // (зарезервировано — на будущее)

})();
