/* ============================================================================
   STUDIO LUPOLI — script.js
   Interazioni: navbar, menu mobile, reveal on scroll, indicatore di lettura,
   navigazione attiva, smooth scroll, lightbox della gallery, fallback immagini.
   Vanilla JS, nessuna dipendenza esterna.
   ========================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------
     Helper
     -------------------------------------------------------- */
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobileQuery = window.matchMedia('(max-width: 899px)');
  var reducedMotion = function () { return motionQuery.matches; };

  /* Senza JS i contenuti restano visibili: la classe attiva gli stati animati */
  document.documentElement.classList.add('js');

  var revealPending = [];      /* elementi non ancora rivelati */

  var nav        = $('[data-nav]');
  var navMenu    = $('#menu-principale');
  var burger     = $('[data-burger]');
  var navLinks   = $$('[data-nav-link]');
  var progressEl = $('[data-progress-bar]');

  /* --------------------------------------------------------
     1 · REVEAL ON SCROLL
     -------------------------------------------------------- */
  /* Rete di sicurezza: qualunque elemento entrato nello schermo viene
     mostrato anche se la callback dell'observer non è mai arrivata
     (succede quando il browser mette in pausa le schede in secondo piano). */
  var lastFlush = 0;
  function flushReveal() {
    if (!revealPending.length) { return; }
    var now = Date.now();
    if (now - lastFlush < 90) { return; }
    lastFlush = now;
    var limit = window.innerHeight * 0.96;
    var still = [];
    for (var i = 0; i < revealPending.length; i++) {
      var el = revealPending[i];
      if (el.classList.contains('is-visible')) { continue; }
      if (el.getBoundingClientRect().top < limit) { el.classList.add('is-visible'); }
      else { still.push(el); }
    }
    revealPending = still;
  }

  function initReveal() {
    var items = $$('[data-reveal]');

    items.forEach(function (el) {
      var d = el.getAttribute('data-reveal-delay');
      if (d) { el.style.setProperty('--reveal-delay', d); }
    });

    if (reducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    revealPending = items.slice();

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        /* Con uno scorrimento molto rapido un elemento può risultare già
           oltrepassato al momento della callback: in quel caso lo mostriamo
           comunque, per non lasciare contenuti invisibili. */
        var alreadyPassed = entry.boundingClientRect.bottom < 0;
        if (!entry.isIntersecting && !alreadyPassed) { return; }
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* --------------------------------------------------------
     2 · VOCE DI MENU ATTIVA
     -------------------------------------------------------- */
  function initActiveNav() {
    if (!('IntersectionObserver' in window)) { return; }

    var sections = navLinks.map(function (link) {
      return document.getElementById(link.getAttribute('href').slice(1));
    }).filter(Boolean);

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { observer.observe(section); });
  }

  /* --------------------------------------------------------
     3 · SCROLL: indicatore di lettura + stato della navbar
     -------------------------------------------------------- */
  var ticking = false;

  function onScrollFrame() {
    var y  = window.pageYOffset;
    var vh = window.innerHeight;

    if (progressEl) {
      var scrollable = document.documentElement.scrollHeight - vh;
      var ratio = scrollable > 0 ? Math.min(y / scrollable, 1) : 0;
      progressEl.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    }

    if (nav) { nav.classList.toggle('is-solid', y > 8); }

    flushReveal();

    ticking = false;
  }

  function requestScrollFrame() {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(onScrollFrame);
  }

  /* --------------------------------------------------------
     4 · MENU MOBILE
     -------------------------------------------------------- */
  function setMenu(open) {
    if (!burger || !navMenu) { return; }
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
    navMenu.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
  }

  function initMenu() {
    if (!burger || !navMenu) { return; }

    burger.addEventListener('click', function () {
      setMenu(!navMenu.classList.contains('is-open'));
    });

    $$('a', navMenu).forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
        setMenu(false);
        burger.focus();
      }
    });

    /* Chiusura al click fuori dal pannello */
    document.addEventListener('click', function (e) {
      if (!navMenu.classList.contains('is-open')) { return; }
      if (nav && !nav.contains(e.target)) { setMenu(false); }
    });

    var handleBreakpoint = function (e) { if (!e.matches) { setMenu(false); } };
    if (mobileQuery.addEventListener) { mobileQuery.addEventListener('change', handleBreakpoint); }
    else if (mobileQuery.addListener) { mobileQuery.addListener(handleBreakpoint); }
  }

  /* --------------------------------------------------------
     5 · SMOOTH SCROLL con compensazione della navbar
     -------------------------------------------------------- */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!link) { return; }

      var hash = link.getAttribute('href');
      /* Link segnaposto (href="#"): non fanno nulla invece di riportare su */
      if (hash === '#') { e.preventDefault(); return; }
      if (!hash) { return; }

      var target = document.getElementById(hash.slice(1));
      if (!target) { return; }

      e.preventDefault();

      var navH = nav ? nav.offsetHeight : 0;
      var top  = target.getBoundingClientRect().top + window.pageYOffset - navH - 8;

      if (navMenu && navMenu.classList.contains('is-open')) {
        setMenu(false);
        window.setTimeout(function () { scrollTo(top); }, 220);
      } else {
        scrollTo(top);
      }

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', hash);
      }
    });

    function scrollTo(top) {
      window.scrollTo({ top: top, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }

  /* --------------------------------------------------------
     6 · GALLERY LIGHTBOX
     -------------------------------------------------------- */
  function initLightbox() {
    var box      = $('[data-lightbox]');
    var boxImg   = $('[data-lightbox-img]');
    var boxCap   = $('[data-lightbox-caption]');
    var btnClose = $('[data-lightbox-close]');
    var btnPrev  = $('[data-lightbox-prev]');
    var btnNext  = $('[data-lightbox-next]');
    var triggers = $$('.gallery__btn');
    if (!box || !boxImg || !triggers.length) { return; }

    var index = 0;
    var lastFocus = null;

    function show(i) {
      index = (i + triggers.length) % triggers.length;
      var source = $('img', triggers[index]);
      if (!source) { return; }
      boxImg.setAttribute('src', source.getAttribute('src'));
      boxImg.setAttribute('alt', source.getAttribute('alt') || '');
      if (boxCap) { boxCap.textContent = source.getAttribute('alt') || ''; }
    }

    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.hidden = false;
      document.body.classList.add('is-locked');
      window.requestAnimationFrame(function () { box.classList.add('is-open'); });
      if (btnClose) { btnClose.focus(); }
    }

    function close() {
      box.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      window.setTimeout(function () { box.hidden = true; }, reducedMotion() ? 0 : 320);
      if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    triggers.forEach(function (btn, i) {
      btn.addEventListener('click', function () { open(i); });
    });

    if (btnClose) { btnClose.addEventListener('click', close); }
    if (btnPrev)  { btnPrev.addEventListener('click', function () { show(index - 1); }); }
    if (btnNext)  { btnNext.addEventListener('click', function () { show(index + 1); }); }

    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lightbox__figure')) { close(); }
    });

    document.addEventListener('keydown', function (e) {
      if (box.hidden) { return; }
      if (e.key === 'Escape')     { close(); }
      if (e.key === 'ArrowLeft')  { show(index - 1); }
      if (e.key === 'ArrowRight') { show(index + 1); }
      if (e.key === 'Tab') {
        var focusables = $$('button', box);
        if (!focusables.length) { return; }
        var first = focusables[0];
        var last  = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* --------------------------------------------------------
     7 · FALLBACK IMMAGINI
     Se un file non è ancora disponibile in /assets/images,
     al suo posto compare un segnaposto tipografico.
     -------------------------------------------------------- */
  function initImageFallback() {
    $$('img').forEach(function (img) {
      var handle = function () {
        var holder = img.closest('figure, .gallery__item') || img.parentNode;
        if (!holder || holder.classList.contains('img-missing')) { return; }
        holder.classList.add('img-missing');
        holder.setAttribute('data-missing-label', img.getAttribute('data-fallback') || 'Immagine');
        img.style.visibility = 'hidden';
      };
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) { handle(); }
      img.addEventListener('error', handle);
    });
  }

  /* --------------------------------------------------------
     8 · FORM DI CONTATTO
     Validazione lato client e invio. Senza un endpoint configurato
     il messaggio viene passato al client di posta (data-mailto).
     -------------------------------------------------------- */
  function initContactForm() {
    var form = $('[data-contact-form]');
    if (!form) { return; }

    var status = $('[data-form-status]', form);

    function setError(input, on) {
      var describedBy = input.getAttribute('aria-describedby');
      var msg = describedBy ? document.getElementById(describedBy) : null;
      if (on) { input.setAttribute('aria-invalid', 'true'); }
      else { input.removeAttribute('aria-invalid'); }
      if (msg) { msg.hidden = !on; }
    }

    function validEmail(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    }

    function check() {
      var problems = [];

      var nome = form.elements.nome;
      var okNome = nome.value.trim().length >= 2;
      setError(nome, !okNome);
      if (!okNome) { problems.push(nome); }

      var tel = form.elements.telefono;
      var okTel = tel.value.replace(/[^\d+]/g, '').length >= 8;
      setError(tel, !okTel);
      if (!okTel) { problems.push(tel); }

      var email = form.elements.email;
      var okEmail = email.value.trim() === '' || validEmail(email.value.trim());
      setError(email, !okEmail);
      if (!okEmail) { problems.push(email); }

      var privacy = form.elements.privacy;
      var okPrivacy = privacy.checked;
      setError(privacy, !okPrivacy);
      if (!okPrivacy) { problems.push(privacy); }

      return problems;
    }

    /* Errori mostrati man mano che i campi vengono corretti */
    ['nome', 'telefono', 'email', 'privacy'].forEach(function (name) {
      var el = form.elements[name];
      if (!el) { return; }
      el.addEventListener('input', function () {
        if (el.getAttribute('aria-invalid') === 'true') { check(); }
      });
      el.addEventListener('change', function () {
        if (el.getAttribute('aria-invalid') === 'true') { check(); }
      });
    });

    function say(text, isError) {
      if (!status) { return; }
      status.textContent = text;
      status.hidden = false;
      status.classList.toggle('form__status--error', !!isError);
    }

    form.addEventListener('submit', function (e) {
      /* Campo trappola compilato: quasi certamente uno spam bot */
      if (form.elements.azienda && form.elements.azienda.value !== '') {
        e.preventDefault();
        return;
      }

      var problems = check();
      if (problems.length) {
        e.preventDefault();
        say('Controlla i campi evidenziati e riprova.', true);
        problems[0].focus();
        return;
      }

      var mailto = form.getAttribute('data-mailto');
      if (!mailto) { return; }        /* endpoint reale configurato: invio normale */

      e.preventDefault();

      var corpo = [
        'Nome: ' + form.elements.nome.value.trim(),
        'Telefono: ' + form.elements.telefono.value.trim(),
        'Email: ' + (form.elements.email.value.trim() || '—'),
        'Motivo: ' + form.elements.motivo.value,
        '',
        form.elements.messaggio.value.trim() || '(nessun messaggio)'
      ].join('\n');

      var url = 'mailto:' + mailto +
                '?subject=' + encodeURIComponent('Richiesta appuntamento — ' + form.elements.nome.value.trim()) +
                '&body=' + encodeURIComponent(corpo);

      window.location.href = url;
      say('Si apre il tuo programma di posta con la richiesta già compilata: premi invia per completare.');
    });
  }

  /* --------------------------------------------------------
     9 · AVVIO
     -------------------------------------------------------- */
  function init() {
    initReveal();
    initActiveNav();
    initMenu();
    initSmoothScroll();
    initLightbox();
    initImageFallback();
    initContactForm();

    /* flushReveal anche fuori da requestAnimationFrame: in una scheda in
       secondo piano il browser sospende i frame, ma gli eventi di scroll no. */
    window.addEventListener('scroll', function () {
      flushReveal();
      requestScrollFrame();
    }, { passive: true });
    window.addEventListener('resize', requestScrollFrame, { passive: true });
    onScrollFrame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
