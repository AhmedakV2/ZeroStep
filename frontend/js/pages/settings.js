// Ayarlar sayfası — Profil, Bildirim Tercihleri, Görünüm
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Ayarlar sayfası başlatılıyor...');

    if (!Auth.isLoggedIn()) {
        console.log('⚠️ Giriş yapılmamış, login sayfasına yönlendiriliyor...');
        window.location.href = '../index.html';
        return;
    }

    try {
        console.log('📐 Sidebar ve Topbar render ediliyor...');
        Sidebar.render('sidebar');
        Topbar.render('topbar', 'Ayarlar');

        // Not: Tema utils.js içindeki event listener sayesinde otomatik uygulanıyor.
        // Ama manuel olarak da burda garantiye alabiliriz:
        ThemeManager.apply();

        console.log('⚙️ Bileşenler kuruluyordu...');
        setupTabs();
        await loadProfile();
        await loadNotificationPrefs();
        setupThemeTab();
        setupPasswordModal();

        console.log('✅ Ayarlar sayfası başarıyla yüklendi!');
    } catch (err) {
        console.error('❌ Sayfa başlatılırken hata:', err);
        Toast.error('Sayfa başlatılırken bir hata oluştu.');
    }
});

// ── SEKME YÖNETİMİ ──────────────────────────────────────────
function setupTabs() {
    const tabs = document.querySelectorAll('.settings-tab');

    if (tabs.length === 0) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = tab.dataset.tab;
            const panel = document.getElementById('panel-' + tabName);

            if (!panel) return;

            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            panel.classList.add('active');
        });
    });
}

// ── PROFİL ──────────────────────────────────────────────────
async function loadProfile() {
    try {
        const user = await Api.get('/users/me');
        if (!user) throw new Error('Sunucu boş cevap döndü');

        const setIfExists = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value || '—';
        };

        setIfExists('prof-username', user.username);
        setIfExists('prof-email', user.email);
        setIfExists('prof-display', user.displayName);
        setIfExists('prof-roles', (user.roles || []).join(', '));
        setIfExists('prof-created', Utils.formatDate(user.createdAt));
        setIfExists('prof-lastlogin', Utils.formatDate(user.lastLoginAt));

        const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
        const avatarEl = document.getElementById('prof-avatar');
        if (avatarEl) avatarEl.textContent = initials;

    } catch (err) {
        console.error('❌ Profil yüklenirken hata:', err);
        const uEl = document.getElementById('prof-username');
        if(uEl) uEl.textContent = 'Yüklenirken hata oluştu';
    }
}

// ── ŞİFRE MODALİ ────────────────────────────────────────────
function setupPasswordModal() {
    const btn = document.getElementById('btn-change-password');
    if(!btn) return;

    btn.addEventListener('click', () => {
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

    ['cpw-current', 'cpw-new', 'cpw-confirm'].forEach(id => {
        const errEl = document.getElementById(id + '-err');
        if(errEl) errEl.textContent = '';
        document.getElementById(id)?.classList.remove('is-error');
    });
    if(errorEl) errorEl.classList.add('hidden');

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
        setTimeout(() => Auth.logout(), 1500);
    } catch (err) {
        if(errorEl){
            errorEl.textContent = err.message || 'Şifre değiştirilemedi';
            errorEl.classList.remove('hidden');
        }
        throw err;
    }
}

function setErr(id, msg) {
    const errEl = document.getElementById(id + '-err');
    if(errEl) errEl.textContent = msg;
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
    if (!container) return;

    try {
        const prefs = await Api.get('/notifications/preferences');

        if (!prefs || prefs.length === 0) {
            container.innerHTML = '<div style="padding:1rem;color:var(--clr-text-muted);font-size:.85rem;">Tercih bulunamadı.</div>';
            return;
        }

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

        container.querySelectorAll('.channel-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
            });
        });
    } catch (err) {
        container.innerHTML = `<div class="text-muted" style="padding:1rem;color:var(--clr-text-muted);">Yüklenemedi: ${Utils.escHtml(err.message)}</div>`;
    }
}

async function saveNotificationPrefs() {
    const btn = document.getElementById('btn-save-notifs');
    if(!btn) return;

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

// ── TEMA EKRANI (Arayüz İşlemleri) ──────────────────────────────────
function setupThemeTab() {
    const current = ThemeManager.get();
    const themeCards = document.querySelectorAll('.theme-card');

    if (themeCards.length === 0) return;

    themeCards.forEach(card => {
        const isSelected = card.dataset.theme === current;
        card.classList.toggle('selected', isSelected);

        card.addEventListener('click', () => {
            themeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const theme = card.dataset.theme;
            ThemeManager.set(theme); // utils.js içindeki global manager'ı çağırır

            const themeName = theme === 'dark' ? 'Koyu' : 'Açık';
            Toast.success(`${themeName} tema uygulandı.`);
        });
    });
}