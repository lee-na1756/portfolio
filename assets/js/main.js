(() => {
  'use strict';

  const root = document.documentElement;
  if (root.hasAttribute('data-motion-initialized')) return;
  root.setAttribute('data-motion-initialized', '');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
  const watchMedia = (query, handler) => (query.addEventListener ? query.addEventListener('change', handler) : query.addListener?.(handler)); // Safari < 14
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const works = document.querySelector('.works');
  const contact = document.querySelector('.contact');
  const letters = [...document.querySelectorAll('.hero__letter')].map(element => ({ element, x: 0, y: 0, baseX: 0, baseY: 0 }));
  const navLinks = [...document.querySelectorAll('.site-header__nav-link')].map(element => ({ element, x: 0, y: 0, baseX: 0, baseY: 0 }));
  const animations = new Set();
  const pointer = { active: false, initialized: false, hover: false, x: 0, y: 0, ringX: 0, ringY: 0 };
  let dot = null;
  let ring = null;
  let glowLayer = null;
  let glow = null;
  let glowBox = { left: 0, top: 0, w: 0, h: 0 };
  let glowKey = '';
  let headerHeight = 0;
  let frame = 0;
  let lastTime = 0;
  let measureDirty = true;
  let scrollDirty = true;
  let heroReady = false;
  let heroTop = 0;
  let heroBottom = 0;
  let worksTop = 0;
  let contactTop = 0;
  let contactBottom = 0;
  let viewportHeight = innerHeight;
  let openingActive = false;
  let finishOpening = () => { };

  function menuActive() { return header?.hasAttribute('data-menu-active'); }
  function requestFrame() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(updateFrame);
  }
  function invalidate() {
    measureDirty = true;
    scrollDirty = true;
    requestFrame();
  }
  function clearPointer() {
    pointer.active = false;
    pointer.hover = false;
    requestFrame();
  }
  function resetLetters() {
    letters.forEach(letter => {
      letter.x = letter.y = 0;
      letter.element.style.removeProperty('transform');
    });
  }
  function measure() {
    // No layout reads in pointermove or scroll handlers. Baselines are cached on resize/font changes.
    if (header) {
      headerHeight = header.offsetHeight;
      root.style.setProperty('--site-header-height', `${headerHeight}px`);
    }
    viewportHeight = innerHeight;
    if (hero) {
      const bounds = hero.getBoundingClientRect();
      heroTop = bounds.top + scrollY;
      heroBottom = bounds.bottom + scrollY;
    }
    if (works) worksTop = works.getBoundingClientRect().top + scrollY;
    if (contact) {
      const bounds = contact.getBoundingClientRect();
      contactTop = bounds.top + scrollY;
      contactBottom = bounds.bottom + scrollY;
    }
    if (glowLayer) {
      const bounds = glowLayer.getBoundingClientRect();
      glowBox = { left: bounds.left + scrollX, top: bounds.top + scrollY, w: bounds.width, h: bounds.height };
    }
    // Header is fixed, so its links are cached in viewport coordinates (only while undisplaced, never accumulating).
    navLinks.forEach(link => {
      if (link.x !== 0 || link.y !== 0) return;
      const bounds = link.element.getBoundingClientRect();
      link.baseX = bounds.left + bounds.width / 2;
      link.baseY = bounds.top + bounds.height / 2;
    });
    if (heroReady) letters.forEach(letter => {
      const bounds = letter.element.getBoundingClientRect();
      // Subtract our own offset once, never accumulate transforms into the original baseline.
      letter.baseX = bounds.left + scrollX + bounds.width / 2 - letter.x;
      letter.baseY = bounds.top + scrollY + bounds.height / 2 - letter.y;
    });
    measureDirty = false;
  }
  function updateFrame(time) {
    frame = 0;
    const delta = lastTime ? Math.min(48, time - lastTime) : 16.67;
    lastTime = time;
    const locked = menuActive();
    if (measureDirty && !locked) measure();
    if (scrollDirty && !locked) {
      if (works) {
        const progress = Math.max(0, Math.min(1, (scrollY - worksTop + viewportHeight * .92) / (viewportHeight * .74)));
        const eased = progress * progress * (3 - 2 * progress);
        works.style.setProperty('--works-background-scale', reducedMotion.matches ? '1' : String(.94 + .06 * eased));
      }
      // Header text turns #F8F8F8 only while the fixed header's centre line is over the dark CONTACT section.
      if (header && contact) {
        const probe = scrollY + headerHeight / 2;
        header.toggleAttribute('data-on-dark', probe >= contactTop && probe < contactBottom);
      }
      scrollDirty = false;
    }
    let moving = false;
    const enabled = mouse.matches && !reducedMotion.matches && !locked && !openingActive;
    // Cursor dot (exact position) and ring (follows with a lag: 0.18 per 60fps frame, as in the earlier preview).
    if (dot && pointer.active && mouse.matches && !reducedMotion.matches) {
      const ringAlpha = 1 - Math.exp(-delta / 84);
      pointer.ringX += (pointer.x - pointer.ringX) * ringAlpha;
      pointer.ringY += (pointer.y - pointer.ringY) * ringAlpha;
      dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      ring.style.transform = `translate3d(${pointer.ringX}px, ${pointer.ringY}px, 0)`;
      dot.setAttribute('data-visible', '');
      ring.setAttribute('data-visible', '');
      ring.toggleAttribute('data-hover', pointer.hover);
      moving = Math.abs(pointer.x - pointer.ringX) + Math.abs(pointer.y - pointer.ringY) > .05;
    } else {
      dot?.removeAttribute('data-visible');
      ring?.removeAttribute('data-visible');
    }

    // Hero glow: same target formula as the earlier preview; CSS transition (2.4s) makes it drift slowly.
    if (glow && enabled && pointer.active && pointer.y + scrollY >= heroTop && pointer.y + scrollY <= heroBottom) {
      const gx = pointer.x * .7 + innerWidth * .3 * .68 + scrollX - glowBox.left;
      const gy = pointer.y * .7 + innerHeight * .3 * .42 + scrollY - glowBox.top;
      const dx = Math.round(gx - glowBox.w * .68);
      const dy = Math.round(gy - glowBox.h * .42);
      const key = `${dx}|${dy}`;
      if (key !== glowKey) {
        glowKey = key;
        glow.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }
    }

    // Header links are pulled toward the pointer (distance < 90px, factor .35) only while the Hero is on screen.
    const magnet = enabled && pointer.active && scrollY < heroBottom - headerHeight;
    navLinks.forEach(link => {
      let tx = 0;
      let ty = 0;
      if (magnet) {
        const dx = pointer.x - link.baseX;
        const dy = pointer.y - link.baseY;
        if (Math.hypot(dx, dy) < 90) {
          tx = Math.round(dx * .35 * 10) / 10;
          ty = Math.round(dy * .35 * 10) / 10;
        }
      }
      if (tx !== link.x || ty !== link.y) {
        link.x = tx;
        link.y = ty;
        link.element.style.transform = tx || ty ? `translate(${tx}px, ${ty}px)` : ''; // CSS transition eases it back to place.
      }
    });

    if (heroReady) {
      const nearHero = enabled && pointer.active && pointer.y + scrollY >= heroTop && pointer.y + scrollY <= heroBottom;
      letters.forEach(letter => {
        let targetX = 0;
        let targetY = 0;
        if (nearHero) {
          const dx = letter.baseX - scrollX - pointer.x;
          const dy = letter.baseY - scrollY - pointer.y;
          const distance = Math.hypot(dx, dy);
          const strength = 46 * Math.pow(Math.max(0, 1 - distance / 170), 2);
          targetX = distance > .1 ? dx / distance * strength : 0;
          targetY = distance > .1 ? dy / distance * strength : 0;
        }
        const returning = targetX === 0 && targetY === 0;
        const alpha = 1 - Math.exp(-delta / 110); // 0.14 per 60fps frame, same speed approaching and returning
        letter.x += (targetX - letter.x) * alpha;
        letter.y += (targetY - letter.y) * alpha;
        if (returning && Math.abs(letter.x) + Math.abs(letter.y) < .01) {
          letter.x = letter.y = 0;
          letter.element.style.removeProperty('transform');
        } else {
          letter.element.style.transform = `translate3d(${letter.x.toFixed(4)}px, ${letter.y.toFixed(4)}px, 0)`;
          if (Math.abs(targetX - letter.x) + Math.abs(targetY - letter.y) > .01) moving = true;
        }
      });
    }
    if (moving) requestFrame();
    else lastTime = 0;
  }

  function animate(element, keyframes, options) {
    if (!element?.animate) return Promise.resolve();
    const animation = element.animate(keyframes, { fill: 'both', ...options });
    animations.add(animation);
    return animation.finished.catch(() => { }).then(() => {
      animation.cancel(); // Restore the exact underlying Figma styles, not a persistent inline transform.
      animations.delete(animation);
    });
  }

  function initFixedHeader() {
    if (!header) return;
    const inFlow = !['absolute', 'fixed'].includes(getComputedStyle(header).position);
    root.style.setProperty('--site-header-height', `${header.offsetHeight}px`);
    if (inFlow) {
      const spacer = document.createElement('div');
      spacer.className = 'site-header-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      header.before(spacer);
    }
    header.setAttribute('data-fixed-header', '');
  }

  function initPointer() {
    function sync() {
      root.toggleAttribute('data-fine-pointer', mouse.matches); // CSS shows the PC effects from this attribute, not from a second media query
      if (mouse.matches && !reducedMotion.matches && !dot) {
        dot = document.createElement('div');
        dot.className = 'cursor-dot';
        ring = document.createElement('div');
        ring.className = 'cursor-ring';
        dot.setAttribute('aria-hidden', 'true');
        ring.setAttribute('aria-hidden', 'true');
        document.body.append(dot, ring);
      }
      if (!mouse.matches || reducedMotion.matches) {
        root.removeAttribute('data-cursor-fx');
        clearPointer();
        resetLetters();
        pointer.initialized = false;
      }
      invalidate();
    }
    window.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen' || !mouse.matches || reducedMotion.matches || menuActive()) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      pointer.hover = !!event.target.closest?.('a[href], button:not(:disabled)');
      root.setAttribute('data-cursor-fx', ''); // hides the OS cursor only once the dot is shown
      if (!pointer.initialized) {
        pointer.ringX = pointer.x;
        pointer.ringY = pointer.y;
        pointer.initialized = true;
      }
      requestFrame();
    }, { passive: true });
    document.addEventListener('pointerout', event => {
      // Only a real exit through the window edge counts (Safari may send relatedTarget === null between elements).
      const edge = event.clientX <= 1 || event.clientY <= 1 || event.clientX >= innerWidth - 1 || event.clientY >= innerHeight - 1;
      if (!event.relatedTarget && edge) clearPointer();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', clearPointer, { passive: true });
    window.addEventListener('blur', clearPointer);
    document.addEventListener('keydown', clearPointer);
    watchMedia(mouse, sync);
    watchMedia(reducedMotion, sync);
    sync();
  }

  function initHero() {
    if (!hero) return;
    glowLayer = document.createElement('div');
    glowLayer.className = 'hero__glow-layer';
    glowLayer.setAttribute('aria-hidden', 'true');
    glow = document.createElement('div');
    glow.className = 'hero__glow';
    glowLayer.append(glow);
    hero.prepend(glowLayer);
    invalidate();
    // Scatter from the earlier preview: x = (random - .5) * innerWidth * .8, y = (random - .5) * innerHeight * .8.
    // Rotation and scale are softened for the current design; start points are clamped to the viewport (no horizontal scroll).
    const starts = reducedMotion.matches ? [] : letters.map(letter => {
      const b = letter.element.getBoundingClientRect(); // natural position, read once before any entry transform exists
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const m = Math.max(b.width, 16);
      const x = (Math.random() - .5) * innerWidth * .8;
      const y = (Math.random() - .5) * innerHeight * .8;
      return {
        x: Math.max(m - cx, Math.min(innerWidth - m - cx, x)),
        y: Math.max(m - cy, Math.min(innerHeight - m - cy, y)),
        r: (Math.random() - .5) * 90,
        s: .75 + Math.random() * .5
      };
    });
    if (!reducedMotion.matches) {
      letters.forEach((letter, index) => {
        letter.element.style.setProperty('--entry-x', `${starts[index].x}px`);
        letter.element.style.setProperty('--entry-y', `${starts[index].y}px`);
      });
      hero.setAttribute('data-hero-loading', '');
    }
    let started = false;
    function playHero() {
      if (started) return;
      started = true;
      const reduce = reducedMotion.matches;
      // Timing from the earlier preview: move 1800ms, opacity 1000ms, delay 250ms + 50ms per letter.
      const completions = letters.flatMap((letter, index) => {
        if (reduce) return [animate(letter.element, [{ opacity: .7 }, { opacity: 1 }], { duration: 180, delay: 0, easing: 'cubic-bezier(.22, .61, .36, 1)' })];
        const { x, y, r, s } = starts[index];
        const delay = 250 + index * 50;
        return [
          animate(letter.element,
            [{ transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})` }, { transform: 'translate(0, 0) rotate(0deg) scale(1)' }],
            { duration: 1800, delay, easing: 'cubic-bezier(.16, .84, .24, 1)' }),
          animate(letter.element, [{ opacity: 0 }, { opacity: 1 }], { duration: 1000, delay, easing: 'ease' })
        ];
      });
      const tagline = hero.querySelector('.hero__tagline');
      animate(tagline, reduce ? [{ opacity: .6 }, { opacity: 1 }] : [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }],
        { duration: reduce ? 180 : 900, delay: reduce ? 0 : 350, easing: 'ease-out' });
      hero.removeAttribute('data-hero-loading');
      Promise.all(completions).then(() => { heroReady = true; invalidate(); });
    }
    const opening = document.querySelector('.site-opening');
    if (!opening || !root.hasAttribute('data-opening') || reducedMotion.matches || location.hash || scrollY > 0) {
      root.removeAttribute('data-opening');
      playHero();
      return;
    }
    openingActive = true;
    const inertElements = [...document.querySelectorAll('header.site-header, main, footer')].map(element => [element, element.inert]);
    inertElements.forEach(([element]) => { element.inert = true; });
    try { sessionStorage.setItem('naoko-portfolio-opening', 'seen'); } catch (_) { /* Enhancement remains optional. */ }
    const name = opening.querySelector('.site-opening__name');
    const text = 'NAOKO OHNO';
    let count = 1;
    name.textContent = text.slice(0, count);
    const typing = setInterval(() => {
      name.textContent = text.slice(0, ++count);
      if (count >= text.length) clearInterval(typing);
    }, 80);
    let finished = false;
    let slideTimer;
    let safetyTimer;
    finishOpening = () => {
      if (finished) return;
      finished = true;
      clearInterval(typing);
      clearTimeout(slideTimer);
      clearTimeout(safetyTimer);
      root.removeAttribute('data-opening');
      inertElements.forEach(([element, inert]) => { element.inert = inert; });
      openingActive = false;
      playHero();
      invalidate();
    };
    slideTimer = setTimeout(() => {
      playHero(); // Letters begin while the cover is leaving: no blank frame between stages.
      animate(opening, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
        { duration: 600, easing: 'cubic-bezier(.76, 0, .24, 1)' }).then(finishOpening);
    }, 900);
    safetyTimer = setTimeout(finishOpening, 1800);
    window.addEventListener('keydown', event => { if (event.key === 'Escape') finishOpening(); });
  }
  function initNavigation() {
    const header = document.querySelector('.site-header');
    const toggle = header?.querySelector('.site-header__menu-toggle');
    const nav = header?.querySelector('.site-header__nav');
    if (!header || !toggle || !nav || header.hasAttribute('data-menu-ready')) return;

    const mobile = window.matchMedia('(max-width: 768px)');
    const background = [...document.querySelectorAll('main, footer, .site-header__logo')];
    let previousInert = [];
    let scrollPosition = 0;
    let closeTimer = null;
    let pendingNavigation = null;
    // CSS close sequence: text .2s → panel .7s → icon .35s.
    const closeDuration = 1250;

    function cancelClose() {
      window.clearTimeout(closeTimer);
      closeTimer = null;
      pendingNavigation = null;
    }

    function lockPage() {
      if (document.body.classList.contains('menu-scroll-locked')) return;
      scrollPosition = window.scrollY;
      document.body.style.setProperty('--menu-scroll-top', `${-scrollPosition}px`);
      document.body.classList.add('menu-scroll-locked');
      previousInert = background.map(element => [element, element.inert]);
      background.forEach(element => { element.inert = true; });
    }

    function unlockPage() {
      if (!document.body.classList.contains('menu-scroll-locked')) return;
      document.body.classList.remove('menu-scroll-locked');
      document.body.style.removeProperty('--menu-scroll-top');
      previousInert.forEach(([element, inert]) => { element.inert = inert; });
      previousInert = [];
      window.scrollTo(0, scrollPosition);
    }

    function setNavAccessible(accessible) {
      nav.inert = !accessible;
      if (accessible) nav.removeAttribute('aria-hidden');
      else nav.setAttribute('aria-hidden', 'true');
    }

    function finishClose() {
      const destination = pendingNavigation;
      cancelClose();
      header.dataset.menuState = 'closed';
      header.removeAttribute('data-menu-active');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'メニューを開く');
      setNavAccessible(!mobile.matches);
      unlockPage();
      invalidate();
      if (destination) {
        window.location.assign(destination.href);
        // Native anchors scroll to the section; move keyboard focus there as well.
        if (destination.origin === location.origin && destination.pathname === location.pathname && destination.hash) {
          const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
          if (target) {
            const hadTabindex = target.hasAttribute('tabindex');
            if (!hadTabindex) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            if (!hadTabindex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
          }
        }
      }
    }

    function openMenu() {
      if (!mobile.matches) return;
      cancelClose();
      lockPage();
      header.setAttribute('data-menu-active', '');
      header.dataset.menuState = 'open';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'メニューを閉じる');
      setNavAccessible(true);
      clearPointer();
    }

    function closeMenu(destination = null) {
      cancelClose();
      pendingNavigation = destination;
      // Keep the same button focused while the disappearing links become inert.
      toggle.focus({ preventScroll: true });
      header.dataset.menuState = 'closing';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'メニューを開く');
      setNavAccessible(false);
      if (reducedMotion.matches) finishClose();
      else closeTimer = window.setTimeout(finishClose, closeDuration);
    }

    toggle.addEventListener('click', () => {
      if (!mobile.matches) return;
      if (header.dataset.menuState === 'open') closeMenu();
      else openMenu(); // Reversing an interrupted transition never queues another close.
    });

    nav.addEventListener('click', event => {
      if (!mobile.matches || header.dataset.menuState !== 'open') return;
      const link = event.target.closest('a[href]');
      if (link) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        closeMenu(new URL(link.href, location.href));
      } else if (event.target === nav) closeMenu();
    });

    document.addEventListener('keydown', event => {
      if (!mobile.matches || !header.hasAttribute('data-menu-active')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      } else if (event.key === 'Tab') {
        const focusable = header.dataset.menuState === 'open'
          ? [toggle, ...nav.querySelectorAll('a[href]')]
          : [toggle];
        const index = focusable.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && (index === focusable.length - 1 || index === -1)) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    });

    function resetMenu() {
      const focusedInNav = nav.contains(document.activeElement);
      cancelClose();
      finishClose();
      if (mobile.matches && focusedInNav) toggle.focus({ preventScroll: true });
    }

    watchMedia(mobile, resetMenu);
    watchMedia(reducedMotion, () => {
      if (reducedMotion.matches && header.dataset.menuState === 'closing') finishClose();
    });
    window.addEventListener('pagehide', resetMenu);
    window.addEventListener('pageshow', event => {
      if (event.persisted) resetMenu();
    });

    header.setAttribute('data-menu-ready', '');
    toggle.disabled = false;
    resetMenu();
  }

  function initReveals() {
    if (!('IntersectionObserver' in window)) return;
    const groups = new Map();
    const registered = new WeakSet();
    function reveal(target) {
      const items = groups.get(target);
      if (!items) return;
      groups.delete(target);
      observer.unobserve(target);
      items.forEach(({ element, kind, delay }) => {
        element.removeAttribute('data-reveal-pending');
        element.setAttribute('data-revealed', '');
        const reduce = reducedMotion.matches;
        const keyframes = reduce || kind === 'image'
          ? [{ opacity: 0 }, { opacity: 1 }]
          : kind === 'title'
            ? [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }]
            : [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }];
        animate(element, keyframes, {
          duration: reduce ? 180 : kind === 'title' ? 2000 : 800,
          delay: reduce ? 0 : delay,
          easing: 'cubic-bezier(.22, .61, .36, 1)'
        });
      });
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === hero) {
          hero.toggleAttribute('data-in-view', entry.isIntersecting);
        } else if (entry.isIntersecting) reveal(entry.target);
      });
    }, { threshold: .05, rootMargin: '0px 0px -5% 0px' });
    function watch(target, items) {
      if (!target) return;
      const fresh = items.filter(item => item.element && !registered.has(item.element));
      if (!fresh.length) return;
      fresh.forEach(({ element, kind }) => {
        registered.add(element);
        element.setAttribute('data-reveal-pending', kind);
      });
      groups.set(target, fresh);
      observer.observe(target);
    }
    function single(element, kind = 'body', delay = 0) {
      // A fully clipped title has no intersection area; observe its unmasked heading wrapper.
      watch(kind === 'title' ? element.parentElement : element, [{ element, kind, delay }]);
    }

    document.querySelectorAll('.section-heading__title, .project-section-heading__title, .inquiry__title, .policy__title, .project-hero__title')
      .forEach(element => single(element, 'title'));
    document.querySelectorAll('.work-card').forEach(card => {
      watch(card, ['.work-card__media', '.work-card__category', '.work-card__title', '.work-card__type', '.work-card__link']
        .map((selector, index) => ({ element: card.querySelector(selector), kind: index ? 'body' : 'image', delay: index * 100 })));
    });
    document.querySelectorAll('.profile__media').forEach(element => single(element, 'image', 100));
    document.querySelectorAll('.profile__body').forEach(body => {
      watch(body, [...body.querySelectorAll('.profile__name, .profile__name-ja, .profile__paragraph')]
        .map((element, index) => ({ element, kind: 'body', delay: 200 + index * 100 })));
    });
    document.querySelectorAll('.contact__body').forEach(body => {
      watch(body, ['.contact__lead', '.contact__description', '.contact__link']
        .map((selector, index) => ({ element: body.querySelector(selector), kind: 'body', delay: index * 120 })));
    });
    document.querySelectorAll('.story__item, .skills__group, .project-process__item, .project-overview__meta')
      .forEach((element, index) => single(element, 'body', index % 3 * 100));
    document.querySelectorAll('.project-hero__media, .project-style-guide__image, .full-design__item')
      .forEach(element => single(element, 'image', 100));
    document.querySelectorAll('main p').forEach((element, index) => {
      if (element.closest('.hero, form, .work-card, [data-reveal-pending]')) return;
      single(element, 'body', index % 3 * 100);
    });
    if (hero) {
      hero.setAttribute('data-motion-ready', '');
      observer.observe(hero);
    }
    // Keyboard and hash navigation must never leave a focused link hidden by a reveal.
    document.addEventListener('focusin', event => {
      groups.forEach((items, target) => {
        if (items.some(({ element }) => element.contains(event.target))) reveal(target);
      });
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        groups.forEach((_, target) => {
          const bounds = target.getBoundingClientRect();
          if (bounds.top < innerHeight && bounds.bottom > 0) reveal(target);
        });
      }
    });
  }

  // FULL DESIGN (work detail pages): the thin bar in each frame follows the scroll position of its own preview.
  // PC and SP previews are independent; the native scroll event covers wheel, trackpad, touch and keyboard.
  function initFullDesignScroll() {
    document.querySelectorAll('.full-design__frame').forEach(frame => {
      const preview = frame.querySelector('.full-design__preview');
      if (!preview) return;
      let queued = 0;
      const update = () => {
        queued = 0;
        const range = preview.scrollHeight - preview.clientHeight;
        const progress = range > 0 ? Math.min(1, Math.max(0, preview.scrollTop / range)) : 0;
        frame.style.setProperty('--full-design-progress', progress.toFixed(4));
      };
      const request = () => { if (!queued) queued = requestAnimationFrame(update); };
      preview.addEventListener('scroll', request, { passive: true });
      const image = preview.querySelector('img');
      image?.addEventListener('load', request);
      if (typeof ResizeObserver === 'function') {
        const observer = new ResizeObserver(request);
        observer.observe(preview);
        if (image) observer.observe(image);
      }
      request();
    });
  }

  initNavigation();
  initFixedHeader();
  initHero();
  initPointer();
  initReveals();
  initFullDesignScroll();
  if (works) works.setAttribute('data-background-motion', '');
  window.addEventListener('scroll', () => { scrollDirty = true; requestFrame(); }, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(invalidate);
    [header?.querySelector('.site-header__inner'), hero, works, document.body].filter(Boolean).forEach(element => observer.observe(element));
  }
  document.fonts?.ready.then(invalidate);
  watchMedia(reducedMotion, () => {
    if (reducedMotion.matches) {
      finishOpening();
      animations.forEach(animation => animation.finish());
      resetLetters();
    }
    invalidate();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearPointer();
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    } else invalidate();
  });
  window.addEventListener('pagehide', () => {
    finishOpening();
    clearPointer();
    animations.forEach(animation => animation.finish());
    resetLetters();
    cancelAnimationFrame(frame);
    frame = 0;
  });
  window.addEventListener('pageshow', invalidate);
  invalidate();
})();

