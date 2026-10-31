/* ------------------------------------------------------------------
   ui.ts — DOM 层：预加载、时钟、光标、滚动 → 镜头、章节显影
   ------------------------------------------------------------------ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface UIDeps {
  rig: { progress: number };
  onBurst?: () => void;
}

export function initUI({ rig }: UIDeps) {
  const body = document.body;
  if (matchMedia('(hover: none)').matches) body.classList.add('is-touch');

  const sections = Array.from(document.querySelectorAll<HTMLElement>('.sec'));
  const navBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav button'));
  const hint = document.getElementById('hint');
  const clockEl = document.getElementById('clock');

  /* ------------------------------------------------------ 第一节立即显影 */
  sections[0]?.classList.add('is-in');

  /* ------------------------------------------------------ 章节观察 */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) el.classList.add('is-in');
        const idx = Number(el.dataset.sec ?? 0);
        if (e.intersectionRatio > 0.5) {
          navBtns.forEach((b, i) => b.classList.toggle('is-active', i === idx));
        }
      });
    },
    { threshold: [0.2, 0.55, 0.9] },
  );
  sections.forEach((s) => io.observe(s));

  /* ------------------------------------------------------ 滚动 → 镜头 */
  let scrollProgress = 0;
  let smoothed = 0;

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? clamp01(window.scrollY / max) : 0;
    if (window.scrollY > 40) hint?.classList.add('is-hidden');
    body.classList.toggle('is-scrolled', window.scrollY > 80);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const tickProgress = () => {
    smoothed += (scrollProgress - smoothed) * 0.09;
    rig.progress = smoothed;
    requestAnimationFrame(tickProgress);
  };
  requestAnimationFrame(tickProgress);

  /* ------------------------------------------------------ 导航 */
  navBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const target = sections[i];
      if (!target) return;
      window.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    });
  });

  /* ------------------------------------------------------ 时钟 */
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const tickClock = () => {
    if (clockEl) clockEl.textContent = fmt.format(new Date());
    setTimeout(tickClock, 1000 - (Date.now() % 1000));
  };
  tickClock();

  /* ------------------------------------------------------ 光标 */
  const cursor = document.getElementById('cursor');
  if (cursor && !body.classList.contains('is-touch')) {
    let mx = innerWidth / 2;
    let my = innerHeight / 2;
    let cx = mx;
    let cy = my;

    addEventListener(
      'pointermove',
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (!cursor.classList.contains('is-on')) cursor.classList.add('is-on');
      },
      { passive: true },
    );

    const hoverables = 'a, button, .works-list a, [data-hover]';
    document.addEventListener('pointerover', (e) => {
      const t = e.target as HTMLElement | null;
      cursor.classList.toggle('is-hover', !!t?.closest?.(hoverables));
    });

    // 直接跟随：以前逐帧 lerp 0.16，在 30fps 下相当于把光标拖后 6 帧，
    // 手感就是「鼠标比屏幕上慢一拍」。pointermove 本身已按帧合并，直接写 transform 最快。
    cx = mx;
    cy = my;
    const place = () => {
      cursor.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
    };
    addEventListener(
      'pointermove',
      (e) => {
        cx = e.clientX;
        cy = e.clientY;
        place();
      },
      { passive: true },
    );
  }

  /* ------------------------------------------------------ 预加载 */
  const pre = document.getElementById('preloader');
  const numEl = document.getElementById('pl-num');
  const fillEl = document.getElementById('pl-fill');
  const statusEl = document.getElementById('pl-status');

  const stages = [
    '正在密封库房',
    '装载收藏层',
    '校准冷光源',
    '锁定标本',
  ];

  let shown = 0;
  let done = false;
  body.classList.add('is-loading');

  const paint = (v: number) => {
    shown = v;
    if (numEl) numEl.textContent = String(Math.round(v)).padStart(3, '0');
    if (fillEl) fillEl.style.transform = 'scaleX(' + (v / 100).toFixed(4) + ')';
    if (statusEl) statusEl.textContent = stages[Math.min(stages.length - 1, Math.floor(v / 26))];
  };

  const finish = () => {
    if (done) return;
    done = true;
    paint(100);
    if (statusEl) statusEl.textContent = '库门已开';
    setTimeout(() => {
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
      pre?.classList.add('is-done');
      setTimeout(() => pre?.classList.add('is-hidden'), 1200);
      onScroll();
    }, 380);
  };

  const readyWait = async () => {
    const t0 = performance.now();
    let hinted = false;
    // 等真正出图若干帧再收遮罩：首帧着色器/管线编译可能长达数秒，
    // 期间主线程被占住，页面无响应——遮罩必须留在屏幕上，否则看起来像"卡死"。
    while (performance.now() - t0 < 16000) {
      const frames = (window as any).__FRAMES__ || 0;
      if ((window as any).__READY__ === true && frames >= 4) break;
      const el = performance.now() - t0;
      if (!hinted && el > 3200) {
        hinted = true;
        if (statusEl) statusEl.textContent = '编译冷光着色器';
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    try {
      await (document as any).fonts?.ready;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 340));
  };

  // 进度以主程序真实阶段为准（window.__BOOT__）。主线程被着色器编译占住时
  // rAF 停摆，进度条靠 CSS transition 继续补间，画面不会"死"在一个数字上。
  let creep = 6;
  const ramp = () => {
    if (done) {
      if (shown < 100) paint(Math.min(100, shown + Math.max(1.2, (100 - shown) * 0.22)));
      if (shown < 100) requestAnimationFrame(ramp);
      return;
    }
    const b = (window as any).__BOOT__ as { pct: number; label: string } | undefined;
    if (b && b.label && statusEl) statusEl.textContent = b.label;
    creep = Math.min(96, creep + 0.06);
    const target = Math.min(96, Math.max(creep, b ? b.pct : 0));
    if (shown < target) paint(Math.min(target, shown + Math.max(0.6, (target - shown) * 0.18)));
    requestAnimationFrame(ramp);
  };
  paint(0);
  requestAnimationFrame(ramp);
  readyWait().then(finish);
}
