const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface UIDeps {
  rig: { progress: number };
  onBurst?: () => void;
  getPhase?: () => string;
  getFormation?: () => string;
}

interface Project {
  title: string;
  description: string[];
  media?: { video?: string; poster?: string; image?: string; alt?: string };
}

const projects: Project[] = [
  {
    title: 'P5R 合成工具',
    description: [
      '核心是有界深度优先搜索（DFS）：从目标面具反向展开素材，按深度、单节点候选数、总节点数和时间预算控制搜索空间，并通过环剪枝避免重复配方。',
      '普通二体按基础等级和 23×23 阿尔卡纳合成范式计算，固定多体配方精确匹配，宝魔按素材当前等级查排名。技能与特性沿供体树传播，搜索时同步检查 8 个技能槽、继承类别和每层继承上限。',
      '最后将候选路线重新正向执行，验证配方、素材数量与技能携带顺序。无法完整满足时，不伪造“最优解”，而是给出覆盖最多的一条可执行路线和逐项缺口。',
    ],
    media: { image: '/works/p5r-synth.webp', alt: 'P5R 合成工具的合成树与执行顺序界面' },
  },
  {
    title: '零度以下',
    description: [
      '一组发生在凝固与溶解之间的字体实验。字符不只是被阅读的符号，也会随指针温度改变形态，让排版从静态信息变成可以触碰的材料。',
      '实验关注的是字形、透明度与运动之间的关系，而不是增加更多视觉效果。',
    ],
  },
  {
    title: '第二次碎裂',
    description: [
      '从一颗晶体被击碎的瞬间出发，用 Voronoi 解理构造每块碎片，再让它们在零重力刚体与磁吸作用下重新聚合。',
      '项目验证的不是“碎开后消失”，而是每块碎片如何沿各自的轨迹重新找到秩序。',
    ],
  },
  {
    title: '没有窗口的房间',
    description: [
      '当空间失去窗口，声音就成为测量距离的另一种方式。低频、混响与极弱光线共同构成一段沉浸式影像练习。',
      '它讨论的不是黑暗本身，而是人在有限感知中如何建立空间感。',
    ],
  },
  {
    title: 'Fly, My Wings',
    description: [
      '以“标本”而非“天使”为核心隐喻：被钢针钉住的翅膀、裂开的瓷面具，以及最终离枝的山茶，构成从破碎到坠落的叙事。',
      '15 张 AI 底板先裁成 2.39:1 并烘焙镜头特性，再在 Blender EEVEE 中叠加体积雾、光柱、尘埃、浅景深和缓慢推镜。全片 27 镜、5839 帧，以 194.63 秒呈现。',
      'NumPy 后期处理曝光、眩光、色度降噪和双语字幕，再用 TPDF 抖动减少暗部色带。原曲 MILI，非官方粉丝二创，仅作学习交流。',
    ],
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
  const projectImage = document.getElementById('project-image') as HTMLImageElement | null;
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
      setText('project-title', project.title);
      const description = document.getElementById('project-description');
      if (description) description.replaceChildren(...project.description.map((text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        return paragraph;
      }));
      setText('project-visual-code', String(index + 1).padStart(2, '0'));
      const visual = document.getElementById('project-visual');
      if (visual) {
        visual.style.filter = project.media ? 'none' : `hue-rotate(${index * 18}deg)`;
        visual.classList.toggle('has-video', !!project.media);
      }
      if (projectVideo) {
        projectVideo.pause();
        if (project.media?.video) {
          projectVideo.src = project.media.video;
          projectVideo.poster = project.media.poster ?? '';
          projectVideo.hidden = false;
        } else {
          projectVideo.hidden = true;
          projectVideo.removeAttribute('src');
          projectVideo.removeAttribute('poster');
          projectVideo.load();
        }
      }
      if (projectImage) {
        if (project.media?.image) {
          projectImage.src = project.media.image;
          projectImage.alt = project.media.alt ?? project.title;
          projectImage.hidden = false;
        } else {
          projectImage.hidden = true;
          projectImage.removeAttribute('src');
          projectImage.alt = '';
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
