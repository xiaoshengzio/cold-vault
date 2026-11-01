const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface UIDeps {
  rig: { progress: number };
  onBurst?: () => void;
  getPhase?: () => string;
  getFormation?: () => string;
}

interface Project {
  code: string;
  title: string;
  en: string;
  year: string;
  description: string;
  credits?: string;
  tags: string[];
  media?: { video: string; poster: string };
}

const projects: Project[] = [
  {
    code: 'A—01', title: '静态场', en: 'CONCRETE MONOLITH', year: '2026',
    description: '把混凝土的厚重感转译成一套会呼吸的实时空间。光线沿墙体移动，视角成为唯一的刻刀；这是一次关于材质、尺度和静止感的三维实验。',
    tags: ['REAL-TIME 3D', 'SPATIAL DESIGN', 'WEBGL'],
  },
  {
    code: 'A—02', title: '零度以下', en: 'SUBZERO TYPOGRAPHY', year: '2025',
    description: '一组发生在凝固与溶解之间的字体实验。字符不再只是被阅读的符号，而是会随指针温度改变形态的透明薄层。',
    tags: ['TYPOGRAPHY', 'INTERACTION', 'GENERATIVE'],
  },
  {
    code: 'A—03', title: '第二次碎裂', en: 'THE SECOND FRACTURE', year: '2025',
    description: '从一颗晶体被击碎的瞬间出发，研究 Voronoi 解理、零重力刚体与磁吸重组。破碎并非随机消失，而是每块碎片重新找到秩序的过程。',
    tags: ['RAPIER PHYSICS', 'VORONOI', 'MOTION'],
  },
  {
    code: 'A—04', title: '没有窗口的房间', en: 'A ROOM WITHOUT WINDOWS', year: '2024',
    description: '当空间失去窗口，声音就成为测量距离的另一种方式。一段由低频、混响和极弱光线构成的沉浸式影像练习。',
    tags: ['SOUND', 'FILM', 'INSTALLATION'],
  },
  {
    code: 'A—00', title: 'Fly, My Wings', en: 'A CINEMATIC FAN MV', year: '2026',
    description: '以“标本”而非“天使”为核心隐喻，将 15 张 AI 底板扩展为 27 个电影镜头。Blender EEVEE 负责体积雾、光柱、尘埃与浅景深，NumPy 后期完成曝光、眩光、色度降噪、双语字幕和量化抖动，最终合成 194.63 秒、1920×1080 / 30fps 的影像。',
    credits: '原曲 MILI · 非官方粉丝二创 · 仅作学习交流',
    tags: ['BLENDER EEVEE', 'NUMPY POST', '27 SHOTS', 'H.264'],
    media: { video: '/works/fly-my-wings.mp4', poster: '/works/fly-my-wings-cover.webp' },
  },
];

export function initUI({ rig, onBurst, getPhase, getFormation }: UIDeps) {
  const body = document.body;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (matchMedia('(hover: none)').matches) body.classList.add('is-touch');

  const sections = Array.from(document.querySelectorAll<HTMLElement>('.sec'));
  const navBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav button'));
  const clockEl = document.getElementById('clock');
  const chapterCurrent = document.getElementById('chapter-current');
  const chapterProgress = document.getElementById('chapter-progress');
  const fieldState = document.getElementById('field-state');

  sections[0]?.classList.add('is-in');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target as HTMLElement;
      if (entry.isIntersecting) el.classList.add('is-in');
      if (entry.intersectionRatio > 0.5) {
        const idx = Number(el.dataset.sec ?? 0);
        navBtns.forEach((button, i) => button.classList.toggle('is-active', i === idx));
        if (chapterCurrent) chapterCurrent.textContent = String(idx + 1).padStart(2, '0');
        body.dataset.chapter = String(idx);
      }
    });
  }, { threshold: [0.2, 0.55, 0.9] });
  sections.forEach((section) => io.observe(section));

  let scrollProgress = 0;
  let smoothed = 0;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? clamp01(window.scrollY / max) : 0;
    body.classList.toggle('is-scrolled', window.scrollY > 80);
    if (chapterProgress) chapterProgress.style.transform = `scaleY(${scrollProgress.toFixed(4)})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const tickProgress = () => {
    smoothed = reducedMotion ? scrollProgress : smoothed + (scrollProgress - smoothed) * 0.09;
    rig.progress = smoothed;
    if (fieldState && getPhase) {
      const phase = getPhase();
      const label = phase === 'rest' ? (getFormation?.() ?? 'STABLE') : phase === 'gather' ? 'RECONSTRUCTING' : 'RELEASED';
      if (fieldState.textContent !== label) fieldState.textContent = label;
    }
    requestAnimationFrame(tickProgress);
  };
  requestAnimationFrame(tickProgress);

  const scrollToSection = (index: number) => {
    const target = sections[index];
    if (target) window.scrollTo({ top: target.offsetTop, behavior: reducedMotion ? 'auto' : 'smooth' });
  };
  navBtns.forEach((button, i) => button.addEventListener('click', () => scrollToSection(i)));
  document.querySelectorAll<HTMLElement>('[data-scroll]').forEach((control) => {
    control.addEventListener('click', (event) => {
      event.preventDefault();
      scrollToSection(Number(control.dataset.scroll ?? 0));
    });
  });

  document.getElementById('burst-btn')?.addEventListener('click', () => onBurst?.());

  const dialog = document.getElementById('project-dialog') as HTMLDialogElement | null;
  const projectVideo = document.getElementById('project-video') as HTMLVideoElement | null;
  const closeDialog = () => dialog?.close();
  document.getElementById('dialog-close')?.addEventListener('click', closeDialog);
  dialog?.addEventListener('close', () => {
    body.classList.remove('dialog-open');
    projectVideo?.pause();
  });
  dialog?.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-project]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!dialog) return;
      const index = Number(button.dataset.project ?? 0);
      const project = projects[index];
      if (!project) return;
      const setText = (id: string, value: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setText('project-code', project.code);
      setText('project-title', project.title);
      setText('project-en', project.en);
      setText('project-description', project.description);
      setText('project-credits', project.credits ?? '');
      setText('project-year', project.year);
      setText('project-visual-code', String(index + 1).padStart(2, '0'));
      const tags = document.getElementById('project-tags');
      if (tags) tags.replaceChildren(...project.tags.map((tag) => {
        const span = document.createElement('span');
        span.textContent = tag;
        return span;
      }));
      const visual = document.getElementById('project-visual');
      if (visual) {
        visual.style.filter = project.media ? 'none' : `hue-rotate(${index * 18}deg)`;
        visual.classList.toggle('has-video', !!project.media);
      }
      if (projectVideo) {
        projectVideo.pause();
        if (project.media) {
          projectVideo.src = project.media.video;
          projectVideo.poster = project.media.poster;
          projectVideo.hidden = false;
        } else {
          projectVideo.hidden = true;
          projectVideo.removeAttribute('src');
          projectVideo.removeAttribute('poster');
          projectVideo.load();
        }
      }
      body.classList.add('dialog-open');
      dialog.showModal();
    });
  });

  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const tickClock = () => {
    if (clockEl) clockEl.textContent = fmt.format(new Date());
    setTimeout(tickClock, 1000 - (Date.now() % 1000));
  };
  tickClock();

  const cursor = document.getElementById('cursor');
  const cursorLabel = document.getElementById('cursor-label');
  if (cursor && !body.classList.contains('is-touch')) {
    const place = (event: PointerEvent) => {
      cursor.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
      cursor.classList.add('is-on');
    };
    addEventListener('pointermove', place, { passive: true });
    document.addEventListener('pointerover', (event) => {
      const target = event.target as HTMLElement | null;
      const interactive = target?.closest('a, button, [data-hover]');
      const overCanvas = target?.id === 'gl';
      cursor.classList.toggle('is-hover', !!interactive && !overCanvas);
      cursor.classList.toggle('is-drag', !!overCanvas && !body.classList.contains('is-grabbing'));
      if (cursorLabel) cursorLabel.textContent = 'DRAG';
    });
    document.addEventListener('pointerdown', () => cursor.classList.remove('is-drag'));
  }

  const pre = document.getElementById('preloader');
  const numEl = document.getElementById('pl-num');
  const fillEl = document.getElementById('pl-fill');
  const statusEl = document.getElementById('pl-status');
  const stages = ['正在密封库房', '装载收藏层', '校准冷光源', '锁定标本'];
  let shown = 0;
  let done = false;
  body.classList.add('is-loading');

  const paint = (value: number) => {
    shown = value;
    if (numEl) numEl.textContent = String(Math.round(value)).padStart(3, '0');
    if (fillEl) fillEl.style.transform = `scaleX(${(value / 100).toFixed(4)})`;
    if (statusEl) statusEl.textContent = stages[Math.min(stages.length - 1, Math.floor(value / 26))];
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
      setTimeout(() => pre?.classList.add('is-hidden'), 1250);
      onScroll();
    }, 150);
  };
  const readyWait = async () => {
    let t0 = performance.now();
    while (performance.now() - t0 < 24000) {
      if (document.hidden) {
        t0 += 80;
        await new Promise((resolve) => setTimeout(resolve, 80));
        continue;
      }
      const frames = (window as any).__FRAMES__ || 0;
      if ((window as any).__READY__ === true && frames >= 4) break;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    try { await (document as any).fonts?.ready; } catch { /* fonts are progressive enhancement */ }
    await new Promise((resolve) => setTimeout(resolve, 80));
  };
  let creep = 6;
  const ramp = () => {
    if (done) {
      if (shown < 100) paint(Math.min(100, shown + Math.max(1.2, (100 - shown) * 0.22)));
      if (shown < 100) scheduleRamp();
      return;
    }
    const boot = (window as any).__BOOT__ as { pct: number; label: string } | undefined;
    creep = Math.min(96, creep + 0.06);
    const target = Math.min(96, Math.max(creep, boot ? boot.pct : 0));
    if (shown < target) paint(Math.min(target, shown + Math.max(0.6, (target - shown) * 0.18)));
    if (boot?.label && statusEl) statusEl.textContent = boot.label;
    scheduleRamp();
  };
  const scheduleRamp = () => {
    if (document.hidden) setTimeout(ramp, 50);
    else requestAnimationFrame(ramp);
  };
  paint(0);
  scheduleRamp();
  readyWait().then(finish);
}
