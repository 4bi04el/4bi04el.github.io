(function () {
    var root = document.documentElement;
    var themeButton = document.querySelector('.theme-toggle');
    var systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    var explicitPreference = false;
    try {
        explicitPreference = /^(light|dark)$/.test(localStorage.getItem('devfolio-theme'));
    } catch (error) { /* Theme switching still works without storage. */ }

    function applyTheme(theme) {
        root.dataset.theme = theme;
        themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
        themeButton.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
        themeButton.title = themeButton.getAttribute('aria-label');
    }
    applyTheme(root.dataset.theme);
    themeButton.addEventListener('click', function () {
        var theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        explicitPreference = true;
        applyTheme(theme);
        try { localStorage.setItem('devfolio-theme', theme); } catch (error) { /* Optional persistence. */ }
    });
    systemTheme.addEventListener('change', function (event) {
        if (!explicitPreference) applyTheme(event.matches ? 'dark' : 'light');
    });
    window.addEventListener('storage', function (event) {
        if (event.key !== 'devfolio-theme' && event.key !== null) return;
        explicitPreference = event.key !== null && /^(light|dark)$/.test(event.newValue);
        applyTheme(explicitPreference ? event.newValue : (systemTheme.matches ? 'dark' : 'light'));
    });

    var menuButton = document.querySelector('.menu-toggle');
    var links = document.querySelector('.nav-links');
    function closeMenu() {
        menuButton.setAttribute('aria-expanded', 'false');
        links.classList.remove('is-open');
    }
    menuButton.addEventListener('click', function () {
        var open = menuButton.getAttribute('aria-expanded') !== 'true';
        menuButton.setAttribute('aria-expanded', String(open));
        links.classList.toggle('is-open', open);
    });
    links.addEventListener('click', function (event) {
        if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('click', function (event) {
        if (!event.target.closest('.site-header')) closeMenu();
    });

    var sectionLinks = Array.from(links.querySelectorAll('a'));
    var sections = sectionLinks.map(function (link) { return document.querySelector(link.hash); });
    var scheduled = false;
    function updateSection() {
        scheduled = false;
        var current = -1;
        sections.forEach(function (section, index) {
            if (section && section.getBoundingClientRect().top <= 180) current = index;
        });
        if (window.scrollY > 0 && window.innerHeight + window.scrollY >= root.scrollHeight - 8) {
            current = sections.length - 1;
        }
        sectionLinks.forEach(function (link, index) {
            if (index === current) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    }
    window.addEventListener('scroll', function () {
        if (!scheduled) {
            scheduled = true;
            window.requestAnimationFrame(updateSection);
        }
    }, { passive: true });
    window.addEventListener('resize', function () {
        if (window.innerWidth > 700) closeMenu();
        updateSection();
    });
    updateSection();

    // Keep the existing bundle's modal behavior and add keyboard/focus support.
    var returnFocus;
    function closeModal(modal) {
        modal.classList.remove('is-active');
        root.classList.remove('is-clipped');
        if (returnFocus) returnFocus.focus({ preventScroll: true });
    }
    document.addEventListener('click', function (event) {
        var trigger = event.target.closest('.modal-trigger');
        if (trigger) {
            returnFocus = trigger;
            var target = document.getElementById(trigger.dataset.target);
            if (target) {
                // Explicit activation also permits viewing the new details if the legacy bundle fails.
                target.classList.add('is-active');
                root.classList.add('is-clipped');
                target.querySelector('.delete').focus({ preventScroll: true });
            }
        }
        var modal = event.target.closest('.modal');
        if (modal && (event.target.matches('.modal-background') || event.target.closest('.delete, .modal-card-foot .button'))) {
            closeModal(modal);
        }
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            if (menuButton.getAttribute('aria-expanded') === 'true') {
                closeMenu();
                menuButton.focus();
            }
            var modal = document.querySelector('.modal.is-active');
            if (modal) closeModal(modal);
        }
        if (event.key === 'Tab') {
            var activeModal = document.querySelector('.modal.is-active');
            if (!activeModal) return;
            var focusable = activeModal.querySelectorAll('button, a[href], [tabindex="0"]');
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        }
    });
}());

// Decorative terminal animation, driven by one cancellable timeout.
(function () {
    var output = document.querySelector('.terminal-output');
    var terminal = document.querySelector('.hero-terminal');
    if (!output || !terminal) return;

    var STATES = {
        TYPE_HELLO: 'TYPE_HELLO',
        SCRAMBLE_1: 'SCRAMBLE_1',
        SHOW_SECOND: 'SHOW_SECOND',
        SCRAMBLE_2: 'SCRAMBLE_2',
        RESET: 'RESET'
    };
    var hello = 'Hello, world!';
    var second = 'Bocas mexem, blá-blá-blá.';
    var cipher = '7f3a9c82e1b04d6f';
    var alphabet = '0123456789abcdef!@#$%&*';
    var colors = ['#ff71ce', '#ffe66d', '#a8ff60', '#55e7ff', '#c792ea', '#6ba8ff'];
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var desktop = window.matchMedia('(min-width: 1024px)');
    var timer = null;
    var active = false;
    var state = null;
    var generation = 0;

    function render(text) {
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < text.length; i += 1) {
            var letter = document.createElement('span');
            letter.textContent = text[i];
            letter.style.color = colors[i % colors.length];
            fragment.appendChild(letter);
        }
        output.replaceChildren(fragment);
    }

    function clearTimer() {
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
    }

    function schedule(callback, delay, run) {
        clearTimer();
        timer = window.setTimeout(function () {
            timer = null;
            if (active && generation === run) callback();
        }, delay);
    }

    function stop() {
        active = false;
        generation += 1;
        clearTimer();
    }

    function scramble(from, to, duration, completed, run, nextState) {
        state = nextState;
        var started = Date.now();
        var length = Math.max(from.length, to.length);
        function frame() {
            var progress = Math.min(1, (Date.now() - started) / duration);
            var locked = Math.floor(progress * length);
            var text = '';
            for (var i = 0; i < length; i += 1) {
                if (i < locked) text += to[i] || '';
                else text += alphabet[Math.floor(Math.random() * alphabet.length)];
            }
            render(text);
            if (progress < 1) schedule(frame, 50, run);
            else { render(to); completed(); }
        }
        frame();
    }

    function transition(next, run) {
        if (!active || run !== generation) return;
        state = next;
        switch (next) {
            case STATES.TYPE_HELLO:
                render('');
                typeHello(0, run);
                break;
            case STATES.SCRAMBLE_1:
                scramble(hello, cipher, 2500, function () {
                    schedule(function () { transition(STATES.SHOW_SECOND, run); }, 1000, run);
                }, run, STATES.SCRAMBLE_1);
                break;
            case STATES.SHOW_SECOND:
                scramble(cipher, second, 800, function () {
                    schedule(function () { transition(STATES.SCRAMBLE_2, run); }, 2000, run);
                }, run, STATES.SHOW_SECOND);
                break;
            case STATES.SCRAMBLE_2:
                scramble(second, cipher, 2500, function () {
                    schedule(function () { transition(STATES.RESET, run); }, 1000, run);
                }, run, STATES.SCRAMBLE_2);
                break;
            case STATES.RESET:
                render('');
                schedule(function () { transition(STATES.TYPE_HELLO, run); }, 280, run);
                break;
        }
    }

    function typeHello(index, run) {
        state = STATES.TYPE_HELLO;
        render(hello.slice(0, index));
        if (index < hello.length) schedule(function () { typeHello(index + 1, run); }, 85, run);
        else schedule(function () { transition(STATES.SCRAMBLE_1, run); }, 1500, run);
    }

    function start() {
        if (active || motion.matches || !desktop.matches) return;
        active = true;
        generation += 1;
        transition(STATES.TYPE_HELLO, generation);
    }

    function update() {
        if (motion.matches) {
            stop();
            state = null;
            render(hello);
            return;
        }
        if (!desktop.matches) {
            stop();
            state = null;
            render('');
            return;
        }
        start();
    }

    desktop.addEventListener('change', update);
    motion.addEventListener('change', update);
    update();
}());

// Native, on-demand screenshot galleries for project detail dialogs.
(function () {
    var galleries = Array.prototype.slice.call(document.querySelectorAll('[data-gallery]'));
    var activeGallery = null;
    var startX = null;

    function show(gallery, index) {
        var frame = gallery.querySelector('.project-gallery');
        var images = frame.dataset.images.split(',');
        var current = (index + images.length) % images.length;
        gallery.dataset.current = String(current);
        var image = gallery.querySelector('.gallery-image');
        image.src = images[current];
        image.alt = 'Captura ' + (current + 1) + ' de ' + images.length + ' — ' + frame.dataset.project;
        var counter = gallery.querySelector('.gallery-counter');
        if (counter) counter.textContent = (current + 1) + ' / ' + images.length;
        Array.prototype.forEach.call(gallery.querySelectorAll('.gallery-dot'), function (dot, dotIndex) {
            if (dotIndex === current) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
        });
    }

    galleries.forEach(function (gallery) {
        var frame = gallery.querySelector('.project-gallery');
        var previous = gallery.querySelector('.gallery-previous');
        var next = gallery.querySelector('.gallery-next');
        if (previous && next) {
            previous.addEventListener('click', function () { show(gallery, Number(gallery.dataset.current || 0) - 1); });
            next.addEventListener('click', function () { show(gallery, Number(gallery.dataset.current || 0) + 1); });
            gallery.querySelectorAll('.gallery-dot').forEach(function (dot) {
                dot.addEventListener('click', function () { show(gallery, Number(dot.dataset.slide)); });
            });
            frame.addEventListener('pointerdown', function (event) { startX = event.clientX; }, { passive: true });
            frame.addEventListener('pointerup', function (event) {
                if (startX === null) return;
                var delta = event.clientX - startX;
                startX = null;
                if (Math.abs(delta) > 45) show(gallery, Number(gallery.dataset.current || 0) + (delta < 0 ? 1 : -1));
            }, { passive: true });
            frame.addEventListener('pointercancel', function () { startX = null; });
        }
    });

    document.addEventListener('click', function (event) {
        var trigger = event.target.closest('.modal-trigger');
        if (!trigger) return;
        activeGallery = document.getElementById(trigger.dataset.target);
        if (activeGallery && activeGallery.hasAttribute('data-gallery')) show(activeGallery, 0);
    });

    document.addEventListener('keydown', function (event) {
        if (!activeGallery || !activeGallery.classList.contains('is-active')) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        var target = event.target;
        if (target.closest('button, input, select, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
        show(activeGallery, Number(activeGallery.dataset.current || 0) + (event.key === 'ArrowRight' ? 1 : -1));
    });
}());
