// ── Login Sayfası Interaktivitesi ──────────────────────────────
// Daha önce inline script idi — CSP nonce uyumlu olması için extract edildi

(function () {
    const form       = document.getElementById('login-form');
    const loginBtn   = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');
    const pwToggle   = document.getElementById('pw-toggle-btn');
    const pwInput    = document.getElementById('password');

    // Animasyonlar için tanımlamalar
    const wrapper    = document.getElementById('loginWrapper');
    const card       = document.getElementById('loginCard');
    const orbWraps   = [
        document.getElementById('orb1-wrap'),
        document.getElementById('orb2-wrap'),
        document.getElementById('orb3-wrap')
    ];

    pwToggle.addEventListener('click', () => {
        const isHidden = pwInput.type === 'password';
        pwInput.type = isHidden ? 'text' : 'password';
        pwToggle.innerHTML = isHidden
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });

    // 3D Tilt ve Parallax Etkileşimi
    setTimeout(() => {
        document.addEventListener('mousemove', (e) => {
            const xAxis = (e.pageX - window.innerWidth / 2) / 20;
            const yAxis = -(e.pageY - window.innerHeight / 2) / 20;
            card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg) translateZ(10px)`;
            orbWraps.forEach((wrap, index) => {
                const factor = (index + 1) * 15;
                wrap.style.transform = `translate(${e.pageX / factor}px, ${e.pageY / factor}px)`;
            });
        });
        document.addEventListener('mouseleave', () => {
            card.style.transform = `rotateY(0deg) rotateX(0deg) translateZ(0)`;
            orbWraps.forEach(wrap => wrap.style.transform = `translate(0, 0)`);
        });
    }, 800);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            loginError.textContent = "Lütfen tüm alanları doldurun.";
            loginError.classList.remove('hidden');
            wrapper.classList.remove('shake-anim');
            void wrapper.offsetWidth;
            wrapper.classList.add('shake-anim');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner"></span> Giriş yapılıyor...';
        loginError.classList.add('hidden');

        try {
            const user = await Auth.login(username, password);
            if (user.passwordChangeRequired) {
                document.getElementById('change-password-modal').classList.remove('hidden');
                document.getElementById('cpw-current').value = password;
            } else {
                window.location.href = 'pages/dashboard.html';
            }
        } catch (err) {
            loginError.textContent = err.message || 'Giriş başarısız. Lütfen tekrar deneyin.';
            loginError.classList.remove('hidden');
            wrapper.classList.remove('shake-anim');
            void wrapper.offsetWidth;
            wrapper.classList.add('shake-anim');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Giriş Yap';
        }
    });
})();

