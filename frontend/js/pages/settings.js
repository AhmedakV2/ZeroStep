// Ayarlar sayfası — Profil, Bildirim Tercihleri, Görünüm
(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Ayarlar');

    // Kayıtlı temayı uygula
    ThemeManager.apply();

    setupTabs();
    await loadProfile();
    await loadNotificationPrefs();
    setupThemeTab();
    setupPasswordModal();
})();

// ── SEKME YÖNETİMİ ──────────────────────────────────────────
function setupTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
        });
    });
}

// ── PROFİL ──────────────────────────────────────────────────
async function loadProfile() {
    try {
        const user = await Api.get('/users/me');
        document.getElementById('prof-username').textContent    = user.username    || '—';
        document.getElementById('prof-email').textContent       = user.email       || '—';
        document.getElementById('prof-display').textContent     = user.displayName || '—';
        document.getElementById('prof-roles').textContent       = (user.roles || []).join(', ') || '—';
        document.getElementById('prof-created').textContent     = Utils.formatDate(user.createdAt);
        document.getElementById('prof-lastlogin').textContent   = Utils.formatDate(user.lastLoginAt);

        // Avatar baş harfler
        const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
        document.getElementById('prof-avatar').textContent = initials;
    } catch (err) {
        Toast.error('Profil yüklenemedi: ' + err.message);
    }
}

// ── ŞİFRE MODALİ ────────────────────────────────────────────
function setupPasswordModal() {
    document.getElementById('btn-change-password').addEventListener('click', () => {
        Modal.open({
            title: 'Şifre Değiştir',
            contentHTML: `
                <div style="display:flex;flex-direction:column;gap:1rem;margin-top:.5rem;">
                    <div class="form-group">
                        <label class="form-label">Mevcut Şifre</label>
                        <input class="form-input" type="password" id="cpw-current" placeholder="••••••••">
                        <span class="form-error" id="cpw-current-err"></span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Yeni Şifre</label>
                        <input class="form-input" type="password" id="cpw-new" placeholder="Min 8 karakter">
                        <span class="form-error" id="cpw-new-err"></span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Yeni Şifre (Tekrar)</label>
                        <input class="form-input" type="password" id="cpw-confirm" placeholder="Tekrar girin">
                        <span class="form-error" id="cpw-confirm-err"></span>
                    </div>
                    <div id="cpw-error" class="alert alert-danger hidden"></div>
                </div>`,
            confirmLabel: 'Değiştir',
            size: 'sm',
            onConfirm: async () => {
                await submitPasswordChange();
            }
        });
    });
}

async function submitPasswordChange() {
    const current  = document.getElementById('cpw-current')?.value  || '';
    const newPwd   = document.getElementById('cpw-new')?.value      || '';
    const confirm  = document.getElementById('cpw-confirm')?.value  || '';
    const errorEl  = document.getElementById('cpw-error');

    // Temizle
    ['cpw-current', 'cpw-new', 'cpw-confirm'].forEach(id => {
        document.getElementById(id + '-err').textContent = '';
        document.getElementById(id)?.classList.remove('is-error');
    });
    errorEl.classList.add('hidden');

    let valid = true;
    if (!current) { setErr('cpw-current', 'Mevcut şifre zorunlu'); valid = false; }

    const pwPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;
    if (!pwPattern.test(newPwd)) {
        setErr('cpw-new', 'Min 8 karakter, büyük/küçük harf, rakam ve özel karakter içermeli');
        valid = false;
    }
    if (newPwd !== confirm) { setErr('cpw-confirm', 'Şifreler eşleşmiyor'); valid = false; }
    if (!valid) throw new Error('validation');

    try {
        await Api.post('/users/me/change-password', { currentPassword: current, newPassword: newPwd });
        Toast.success('Şifre değiştirildi. Yeniden giriş yapmanız gerekiyor.');
        Modal.close();
        // 1.5 sn sonra logout
        setTimeout(() => Auth.logout(), 1500);
    } catch (err) {
        errorEl.textContent = err.message || 'Şifre değiştirilemedi';
        errorEl.classList.remove('hidden');
        throw err;
    }
}

function setErr(id, msg) {
    document.getElementById(id + '-err').textContent = msg;
    document.getElementById(id)?.classList.add('is-error');
}

// ── BİLDİRİM TERCİHLERİ ─────────────────────────────────────
const NOTIF_LABELS = {
    EXECUTION_COMPLETED: { label: 'Çalıştırma Tamamlandı', icon: '✓' },
    EXECUTION_FAILED:    { label: 'Çalıştırma Başarısız',  icon: '✗' },
    SCENARIO_SHARED:     { label: 'Senaryo Paylaşıldı',    icon: '◫' },
    ADMIN_ANNOUNCEMENT:  { label: 'Admin Duyurusu',         icon: '◎' },
    NEW_MESSAGE:         { label: 'Yeni Mesaj',             icon: '◈' },
    SCHEDULE_TRIGGERED:  { label: 'Zamanlı Görev Başladı',  icon: '◷' },
};

async function loadNotificationPrefs() {
    const container = document.getElementById('notif-prefs-list');
    try {
        const prefs = await Api.get('/notifications/preferences');
        container.innerHTML = prefs.map(p => {
            const cfg = NOTIF_LABELS[p.type] || { label: p.type, icon: 'ℹ' };
            const inApp  = (p.channels || []).includes('IN_APP');
            const email  = (p.channels || []).includes('EMAIL');
            return `
            <div class="pref-row" data-type="${Utils.escHtml(p.type)}">
                <div class="pref-info">
                    <span class="pref-icon">${cfg.icon}</span>
                    <span class="pref-label">${Utils.escHtml(cfg.label)}</span>
                </div>
                <div class="pref-controls">
                    <label class="channel-chip ${inApp ? 'active' : ''}" title="Uygulama içi">
                        <input type="checkbox" data-channel="IN_APP" ${inApp ? 'checked' : ''}>
                        ◉ Uygulama
                    </label>
                    <label class="channel-chip ${email ? 'active' : ''}" title="E-posta">
                        <input type="checkbox" data-channel="EMAIL" ${email ? 'checked' : ''}>
                        ✉ E-posta
                    </label>
                    <label class="toggle-switch-wrap">
                        <input type="checkbox" class="pref-enabled" ${p.enabled ? 'checked' : ''}>
                        <span class="pref-toggle-slider"></span>
                    </label>
                </div>
            </div>`;
        }).join('');

        // Kanal chip toggle
        container.querySelectorAll('.channel-chip').forEach(chip => {
            chip.addEventListener('click', () => chip.classList.toggle('active'));
        });
    } catch (err) {
        container.innerHTML = `<div class="text-muted" style="padding:1rem;">Yüklenemedi: ${Utils.escHtml(err.message)}</div>`;
    }
}

async function saveNotificationPrefs() {
    const btn = document.getElementById('btn-save-notifs');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const rows = document.querySelectorAll('#notif-prefs-list .pref-row[data-type]');
    let hasError = false;

    for (const row of rows) {
        const type    = row.dataset.type;
        const enabled = row.querySelector('.pref-enabled').checked;
        const channels = [...row.querySelectorAll('.channel-chip.active input[data-channel]')]
            .map(i => i.dataset.channel);

        try {
            await Api.put('/notifications/preferences', {
                type,
                enabled,
                channels: channels.length ? channels : ['IN_APP']
            });
        } catch {
            hasError = true;
        }
    }

    btn.disabled = false;
    btn.textContent = 'Kaydet';

    if (hasError) Toast.warning('Bazı tercihler kaydedilemedi.');
    else Toast.success('Bildirim tercihleri kaydedildi.');
}

document.getElementById('btn-save-notifs')?.addEventListener('click', saveNotificationPrefs);

// ── TEMA YÖNETİMİ ───────────────────────────────────────────
const ThemeManager = {
    STORAGE_KEY: 'zs_theme',

    get() { return localStorage.getItem(this.STORAGE_KEY) || 'dark'; },

    set(theme) {
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.apply(theme);
    },

    apply(theme) {
        const t = theme || this.get();
        document.body.classList.toggle('theme-light', t === 'light');
    }
};

// Tema global uygulama (diğer sayfalar da kullanabilsin diye window'a koy)
window.ThemeManager = ThemeManager;

function setupThemeTab() {
    const current = ThemeManager.get();

    // Tema kartlarını işaretle
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.theme === current);
        card.addEventListener('click', () => {
            document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            ThemeManager.set(card.dataset.theme);
            Toast.success(`${card.dataset.theme === 'dark' ? 'Koyu' : 'Açık'} tema uygulandı.`);
        });
    });
}