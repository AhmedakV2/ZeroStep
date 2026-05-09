/**
 * animations.js — ZeroStep Ortak Animasyon Sistemi
 * Her dashboard sayfasının <script> bloğuna VEYA ortak bir bundle'a ekle.
 * Bu dosyayı: frontend/assets/js/animations.js olarak kaydet
 * Her HTML dosyasında utils.js'den sonra yükle.
 */
(function ZeroStepAnimations() {
    'use strict';

    // ── Parallax Orb Takibi ─────────────────────────────────
    function initParallaxOrbs() {
        const orbs = [
            document.getElementById('orb1-wrap'),
            document.getElementById('orb2-wrap'),
            document.getElementById('orb3-wrap'),
        ].filter(Boolean);

        if (orbs.length === 0) return;

        let rafId = null;
        let targetX = 0, targetY = 0;
        let currentX = 0, currentY = 0;

        document.addEventListener('mousemove', (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
        });

        function animate() {
            // Smooth lerp
            currentX += (targetX - currentX) * 0.06;
            currentY += (targetY - currentY) * 0.06;

            orbs.forEach((wrap, i) => {
                const factor = (i + 1) * 30;
                wrap.style.transform = `translate(${currentX / factor}px, ${currentY / factor}px)`;
            });

            rafId = requestAnimationFrame(animate);
        }

        animate();

        // Sayfa kapatılınca temizle
        window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));
    }

    // ── Stagger Fade-Up (IntersectionObserver) ──────────────
    function initStaggerItems() {
        const items = document.querySelectorAll('.stagger-item');
        if (items.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        items.forEach(el => {
            // Başlangıçta durdur; observer tetikleyince çalıştır
            el.style.animationPlayState = 'paused';
            observer.observe(el);
        });
    }

    // ── Stat Card Shine (hover) ──────────────────────────────
    function initCardShine() {
        document.querySelectorAll('.stat-card, .glass-card, .detail-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                card.style.setProperty('--shine-x', x + '%');
                card.style.setProperty('--shine-y', y + '%');
            });
        });
    }

    // ── Page Transition (fade-in on load) ───────────────────
    function initPageTransition() {
        // Body'ye giriş animasyonu
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.3s ease';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.style.opacity = '1';
            });
        });

        // Link tıklamalarında fade-out
        document.querySelectorAll('a[href]:not([target="_blank"]):not([href^="#"]):not([href^="javascript"])').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
                e.preventDefault();
                document.body.style.opacity = '0';
                setTimeout(() => { window.location.href = href; }, 280);
            });
        });
    }

    // ── Ripple Effect (butonlara) ────────────────────────────
    function initRipple() {
        document.querySelectorAll('.btn-primary, .btn-danger, .btn-ghost').forEach(btn => {
            if (btn._rippleBound) return;
            btn._rippleBound = true;

            btn.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const ripple = document.createElement('span');
                const size = Math.max(rect.width, rect.height);
                ripple.style.cssText = `
                    position:absolute;
                    width:${size}px;
                    height:${size}px;
                    left:${e.clientX - rect.left - size/2}px;
                    top:${e.clientY - rect.top - size/2}px;
                    background:rgba(255,255,255,0.2);
                    border-radius:50%;
                    transform:scale(0);
                    animation:ripple-anim 0.5s ease-out forwards;
                    pointer-events:none;
                `;
                this.style.position = 'relative';
                this.style.overflow = 'hidden';
                this.appendChild(ripple);
                ripple.addEventListener('animationend', () => ripple.remove());
            });
        });
    }

    // ── CSS Keyframe enjeksiyonu (ripple için) ───────────────
    function injectKeyframes() {
        if (document.getElementById('zs-anim-keyframes')) return;
        const style = document.createElement('style');
        style.id = 'zs-anim-keyframes';
        style.textContent = `
            @keyframes ripple-anim {
                to { transform: scale(2.5); opacity: 0; }
            }
            @keyframes zs-fade-up {
                from { opacity: 0; transform: translateY(20px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes zs-fade-in {
                from { opacity: 0; }
                to   { opacity: 1; }
            }
            @keyframes zs-slide-in-right {
                from { opacity: 0; transform: translateX(20px); }
                to   { opacity: 1; transform: translateX(0); }
            }
            /* Shine cursor follow */
            .stat-card::after {
                content: '';
                position: absolute;
                inset: 0;
                background: radial-gradient(
                    circle at var(--shine-x, 50%) var(--shine-y, 50%),
                    rgba(255,255,255,0.06) 0%,
                    transparent 60%
                );
                border-radius: inherit;
                pointer-events: none;
                transition: opacity 0.3s;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Tema Animasyonları (light/dark geçiş) ────────────────
    function initThemeTransition() {
        // Tema değişimini smooth yap
        if (document.getElementById('zs-theme-transition')) return;

        const style = document.createElement('style');
        style.id = 'zs-theme-transition';
        style.textContent = `
            body, html {
                transition:
                    background-color 0.3s ease,
                    color 0.3s ease !important;
            }
            .stat-card, .glass-card, .card, .sidebar, .topbar {
                transition:
                    background-color 0.3s ease,
                    border-color 0.3s ease,
                    color 0.2s ease !important;
            }
            /* Animasyonları olumsuz etkilememesi için override */
            .stagger-item, .floating-orb, .spinner, .toast, .cw-bubble {
                transition: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Init ─────────────────────────────────────────────────
    function init() {
        injectKeyframes();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initParallaxOrbs();
                initStaggerItems();
                initCardShine();
                initPageTransition();
                initRipple();
                initThemeTransition();
            });
        } else {
            initParallaxOrbs();
            initStaggerItems();
            initCardShine();
            initPageTransition();
            initRipple();
            initThemeTransition();
        }
    }

    init();
})();