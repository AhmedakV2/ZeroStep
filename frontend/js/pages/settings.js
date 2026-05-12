// Ayarlar sayfası — tüm işlemler backend'e bağlı
document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isLoggedIn()) {
        window.location.href = '../index.html';
        return;
    }

    try {
        Sidebar.render('sidebar');
        Topbar.render('topbar', 'Ayarlar');
        ThemeManager.apply();

        setupTabs();
        setupPasswordModal();
        setupProfileEditing();
        setupUnsavedChangesBanner();
        setupThemeTab();

        await loadProfile();
    } catch (err) {
        console.error('Ayarlar başlatılamadı:', err);
        Toast.error('Sayfa yüklenirken bir hata oluştu.');
    }
});

// ── SEKME YÖNETİMİ ────────────────────────────────────────────────────
let _activeTab = 'profile';
let _tabLoaded = {};

function setupTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const target = tab.dataset.tab;
            if (target === _activeTab) return;

            if (_hasUnsaved && !confirm('Kaydedilmemiş değişiklikler var. Devam etmek istiyor musunuz?')) return;

            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('panel-' + target)?.classList.add('active');
            _activeTab = target;

            // Lazy yükleme — her sekme ilk açılışta yüklenir
            if (!_tabLoaded[target]) {
                _tabLoaded[target] = true;
                if (target === 'notifications') await loadNotificationPrefs();
                if (target === 'sessions')      await loadSessions();
            }
        });
    });
}

// ── PROFİL YÜKLEME ────────────────────────────────────────────────────
async function loadProfile() {
    try {
        // GET /api/v1/users/me
        const user = await Api.get('/users/me');
        if (!user) throw new Error('Boş yanıt');

        setText('prof-username', user.username);
        setText('prof-email', user.email);
        setText('prof-display', user.displayName || '(belirtilmemiş)');
        setText('prof-roles', (user.roles || []).join(', '));
        setText('prof-created', Utils.formatDate(user.createdAt));
        setText('prof-lastlogin', Utils.formatDate(user.lastLoginAt));

        const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
        const avatarEl = document.getElementById('prof-avatar');
        if (avatarEl) avatarEl.textContent = initials;

        // Düzenleme inputlarını doldur
        setVal('edit-displayName', user.displayName || '');
        setVal('edit-email', user.email || '');

        renderLoginHistory(user);

    } catch (err) {
        console.error('Profil yüklenemedi:', err);
        setText('prof-username', 'Yüklenirken hata oluştu');
    }
}

function renderLoginHistory(user) {
    const wrap  = document.getElementById('login-history-wrap');
    const table = document.getElementById('login-history-table');
    const tbody = document.getElementById('login-history-body');
    if (!wrap || !table || !tbody) return;

    wrap.style.display  = 'none';
    table.style.display = 'table';

    tbody.innerHTML = user.lastLoginAt
        ? `<tr>
               <td>${Utils.formatDate(user.lastLoginAt)}</td>
               <td style="font-family:var(--font-ui);font-size:.8rem;">—</td>
               <td style="font-size:.8rem;">Tarayıcı</td>
               <td><span style="color:var(--clr-success);font-size:.8rem;">✓ Başarılı</span></td>
           </tr>`
        : `<tr><td colspan="4" style="text-align:center;color:var(--clr-text-muted);padding:1rem;">
               Oturum geçmişi bilgisi mevcut değil.
           </td></tr>`;
}

// ── PROFİL DÜZENLEME ──────────────────────────────────────────────────
function setupProfileEditing() {
    // Görünen ad — PATCH /api/v1/users/me
    document.getElementById('btn-save-displayName')?.addEventListener('click', async () => {
        const val = getVal('edit-displayName').trim();
        if (!val) { Toast.warning('Görünen ad boş olamaz.'); return; }

        const btn = document.getElementById('btn-save-displayName');
        setBtnLoading(btn, true);
        try {
            const updated = await Api.patch('/users/me', { displayName: val });
            setText('prof-display', updated.displayName || val);
            const av = document.getElementById('prof-avatar');
            if (av) av.textContent = val.slice(0, 2).toUpperCase();
            showSaved('saved-displayName');
            clearUnsaved();
            Toast.success('Görünen ad güncellendi.');
        } catch (err) {
            Toast.error('Güncellenemedi: ' + (err.message || 'Sunucu hatası'));
        } finally {
            setBtnLoading(btn, false, 'Kaydet');
        }
    });

    // E-posta — PATCH /api/v1/users/me
    document.getElementById('btn-save-email')?.addEventListener('click', async () => {
        const val   = getVal('edit-email').trim();
        const errEl = document.getElementById('email-err');
        if (errEl) errEl.textContent = '';

        if (!val) { if (errEl) errEl.textContent = 'E-posta boş olamaz.'; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            if (errEl) errEl.textContent = 'Geçerli bir e-posta adresi girin.';
            return;
        }

        const btn = document.getElementById('btn-save-email');
        setBtnLoading(btn, true);
        try {
            const updated = await Api.patch('/users/me', { email: val });
            setText('prof-email', updated.email || val);
            showSaved('saved-email');
            clearUnsaved();
            Toast.success('E-posta güncellendi.');
        } catch (err) {
            if (errEl) errEl.textContent = err.message || 'Güncellenemedi.';
            Toast.error('E-posta güncellenemedi: ' + (err.message || 'Sunucu hatası'));
        } finally {
            setBtnLoading(btn, false, 'Kaydet');
        }
    });

    // Input değişince unsaved flag
    ['edit-displayName', 'edit-email'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', markUnsaved);
    });
}

// ── ŞİFRE MODALİ ──────────────────────────────────────────────────────
function setupPasswordModal() {
    document.getElementById('btn-change-password')?.addEventListener('click', () => {
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
                        <div class="pw-strength-bar"><div class="pw-strength-fill" id="pw-strength-fill"></div></div>
                        <div class="pw-strength-label" id="pw-strength-label"></div>
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
            onConfirm: async () => { await submitPasswordChange(); }
        });

        // Şifre gücü göstergesi — modal DOM'a geldikten sonra bağla
        setTimeout(() => {
            document.getElementById('cpw-new')?.addEventListener('input', e => {
                updatePwStrength(e.target.value);
            });
        }, 60);
    });
}

function updatePwStrength(pw) {
    const fill  = document.getElementById('pw-strength-fill');
    const label = document.getElementById('pw-strength-label');
    if (!fill || !label) return;

    let score = 0;
    if (pw.length >= 8)       score++;
    if (pw.length >= 12)      score++;
    if (/[A-Z]/.test(pw))    score++;
    if (/[a-z]/.test(pw))    score++;
    if (/[0-9]/.test(pw))    score++;
    if (/[@$!%*?&]/.test(pw)) score++;

    const lvls = [
        { pct: '0%',   color: 'transparent', text: '' },
        { pct: '20%',  color: '#ff4d4d',     text: 'Çok zayıf' },
        { pct: '40%',  color: '#ff9800',     text: 'Zayıf' },
        { pct: '60%',  color: '#fbbf24',     text: 'Orta' },
        { pct: '80%',  color: '#4ade80',     text: 'Güçlü' },
        { pct: '100%', color: '#22c55e',     text: 'Çok güçlü' },
    ];
    const lvl = lvls[Math.min(score, 5)];
    fill.style.width      = pw.length ? lvl.pct  : '0%';
    fill.style.background = lvl.color;
    label.textContent     = pw.length ? lvl.text : '';
    label.style.color     = lvl.color;
}

async function submitPasswordChange() {
    const current = getVal('cpw-current');
    const newPwd  = getVal('cpw-new');
    const confirm = getVal('cpw-confirm');
    const errorEl = document.getElementById('cpw-error');

    ['cpw-current', 'cpw-new', 'cpw-confirm'].forEach(id => {
        const e = document.getElementById(id + '-err');
        if (e) e.textContent = '';
        document.getElementById(id)?.classList.remove('is-error');
    });
    if (errorEl) errorEl.classList.add('hidden');

    let valid = true;
    if (!current) { setFieldErr('cpw-current', 'Mevcut şifre zorunlu'); valid = false; }

    const pwPat = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;
    if (!pwPat.test(newPwd)) {
        setFieldErr('cpw-new', 'Min 8 karakter, büyük/küçük harf, rakam ve özel karakter içermeli');
        valid = false;
    }
    if (newPwd !== confirm) { setFieldErr('cpw-confirm', 'Şifreler eşleşmiyor'); valid = false; }
    if (!valid) throw new Error('validation');

    try {
        // POST /api/v1/users/me/change-password
        await Api.post('/users/me/change-password', {
            currentPassword: current,
            newPassword: newPwd
        });
        Toast.success('Şifre değiştirildi. Yeniden giriş yapmanız gerekiyor.');
        Modal.close();
        setTimeout(() => Auth.logout(), 1800);
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = err.message || 'Şifre değiştirilemedi.';
            errorEl.classList.remove('hidden');
        }
        throw err; // modal confirm butonunu yeniden aktif eder
    }
}

// ── BİLDİRİM TERCİHLERİ ───────────────────────────────────────────────
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

    container.innerHTML = '<div style="padding:1rem;color:var(--clr-text-muted);">Yükleniyor...</div>';

    try {
        // GET /api/v1/notifications/preferences
        const prefs = await Api.get('/notifications/preferences');

        if (!prefs || !prefs.length) {
            container.innerHTML = '<div style="padding:1rem;color:var(--clr-text-muted);">Tercih bulunamadı.</div>';
            return;
        }

        container.innerHTML = prefs.map(p => {
            const cfg   = NOTIF_LABELS[p.type] || { label: p.type, icon: 'ℹ' };
            const inApp = (p.channels || []).includes('IN_APP');
            const email = (p.channels || []).includes('EMAIL');
            return `
            <div class="pref-row" data-type="${Utils.escHtml(p.type)}">
                <div class="pref-info">
                    <div class="pref-icon">${cfg.icon}</div>
                    <span>${Utils.escHtml(cfg.label)}</span>
                </div>
                <div class="pref-controls">
                    <label class="channel-chip ${inApp ? 'active' : ''}">
                        <input type="checkbox" data-channel="IN_APP" ${inApp ? 'checked' : ''}>
                        ◉ Uygulama
                    </label>
                    <label class="channel-chip ${email ? 'active' : ''}">
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
            chip.addEventListener('click', () => chip.classList.toggle('active'));
        });

    } catch (err) {
        container.innerHTML = `<div style="padding:1rem;color:var(--clr-danger);font-size:.85rem;">
            Yüklenemedi: ${Utils.escHtml(err.message)}
        </div>`;
    }
}

// Bildirim tercihlerini kaydet — her tercih için PUT /api/v1/notifications/preferences
async function saveNotificationPrefs() {
    const btn = document.getElementById('btn-save-notifs');
    setBtnLoading(btn, true);

    const rows = document.querySelectorAll('#notif-prefs-list .pref-row[data-type]');
    let hasError = false;

    for (const row of rows) {
        const type     = row.dataset.type;
        const enabled  = row.querySelector('.pref-enabled')?.checked ?? true;
        const channels = [...row.querySelectorAll('.channel-chip.active input[data-channel]')]
            .map(i => i.dataset.channel);
        try {
            await Api.put('/notifications/preferences', {
                type,
                enabled,
                channels: channels.length ? channels : ['IN_APP']
            });
        } catch (err) {
            console.error('Tercih kaydedilemedi:', type, err.message);
            hasError = true;
        }
    }

    setBtnLoading(btn, false, 'Kaydet');
    if (hasError) Toast.warning('Bazı tercihler kaydedilemedi.');
    else Toast.success('Bildirim tercihleri kaydedildi.');
}

document.getElementById('btn-save-notifs')?.addEventListener('click', saveNotificationPrefs);

// ── OTURUM YÖNETİMİ ────────────────────────────────────────────────────
async function loadSessions() {
    const container = document.getElementById('sessions-list');
    if (!container) return;

    container.innerHTML = '<div style="padding:1rem;color:var(--clr-text-muted);">Yükleniyor...</div>';

    let sessions     = [];
    let backendReady = true;

    try {
        // GET /api/v1/auth/sessions
        const raw = await Api.get('/auth/sessions');
        sessions = Array.isArray(raw) ? raw : [];
    } catch {
        backendReady = false;
    }

    if (!backendReady || !sessions.length) {
        const user = Store.getUser();
        container.innerHTML = `
            <div class="session-card current">
                <div class="session-info">
                    <div class="session-icon">◉</div>
                    <div class="session-details">
                        <div class="session-device">Bu Tarayıcı (Mevcut Oturum)</div>
                        <div class="session-meta">${user ? Utils.escHtml(user.username) : ''} • Aktif</div>
                    </div>
                </div>
                <span class="session-badge">Aktif</span>
            </div>
            ${!backendReady ? `
            <p style="font-size:.75rem;color:var(--clr-text-muted);margin-top:.875rem;
                padding:.625rem;background:var(--clr-surface-2);border-radius:var(--radius-sm);">
                Tüm oturumları listelemek için backend'de
                <code style="font-family:var(--font-ui);">GET /api/v1/auth/sessions</code>
                endpoint'i gereklidir.
            </p>` : ''}`;
        return;
    }

    container.innerHTML = sessions.map((s, idx) => {
        const isCurrent = s.current === true || idx === 0;
        const sid = Utils.escHtml(String(s.id || s.publicId || ''));
        return `
            <div class="session-card ${isCurrent ? 'current' : ''}">
                <div class="session-info">
                    <div class="session-icon">${isCurrent ? '◉' : '◎'}</div>
                    <div class="session-details">
                        <div class="session-device">${Utils.escHtml(s.userAgent || 'Tarayıcı')}</div>
                        <div class="session-meta">
                            ${Utils.escHtml(s.ipAddress || '—')}
                            ${s.createdAt ? ' • ' + Utils.formatDate(s.createdAt) : ''}
                        </div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:.5rem;">
                    ${isCurrent
            ? '<span class="session-badge">Aktif</span>'
            : `<button class="btn btn-ghost btn-sm" data-sid="${sid}"
                                onclick="revokeSession(this)">Sonlandır</button>`}
                </div>
            </div>`;
    }).join('');
}

// Tek oturum sonlandır — DELETE /api/v1/auth/sessions/{id}
window.revokeSession = async function(btn) {
    const sid = btn.dataset.sid;
    if (!sid) { Toast.error('Oturum ID bulunamadı.'); return; }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:.75rem;height:.75rem;"></span>';
    try {
        await Api.del('/auth/sessions/' + sid);
        btn.closest('.session-card').remove();
        Toast.success('Oturum sonlandırıldı.');
    } catch (err) {
        btn.disabled  = false;
        btn.textContent = 'Sonlandır';
        Toast.error('Sonlandırılamadı: ' + (err.message || 'Sunucu hatası'));
    }
};

// Tüm diğer oturumları sonlandır — POST /api/v1/auth/logout-all
document.getElementById('btn-revoke-all')?.addEventListener('click', async () => {
    if (!confirm('Mevcut oturum dışındaki tüm oturumlar sonlandırılacak. Devam edilsin mi?')) return;

    const btn = document.getElementById('btn-revoke-all');
    setBtnLoading(btn, true);
    try {
        await Api.post('/auth/logout-all', {});
        document.querySelectorAll('.session-card:not(.current)').forEach(el => el.remove());
        Toast.success('Diğer tüm oturumlar sonlandırıldı.');
    } catch (err) {
        // Endpoint henüz yoksa bilgi ver
        if (err.status === 404 || err.status === 405) {
            Toast.info('Bu özellik henüz backend tarafında desteklenmiyor.');
        } else {
            Toast.error('İşlem başarısız: ' + (err.message || 'Sunucu hatası'));
        }
    } finally {
        setBtnLoading(btn, false, 'Diğer Tüm Oturumları Sonlandır');
    }
});

// ── TEMA ───────────────────────────────────────────────────────────────
function setupThemeTab() {
    const current = ThemeManager.get();
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.theme === current);
        card.addEventListener('click', () => {
            document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            // ThemeManager: localStorage'a kaydeder + body class'ını anında uygular
            ThemeManager.set(card.dataset.theme);
            Toast.success(`${card.dataset.theme === 'dark' ? 'Koyu' : 'Açık'} tema uygulandı.`);
        });
    });
}

// ── UNSAVED CHANGES BANNER ─────────────────────────────────────────────
let _hasUnsaved = false;

function setupUnsavedChangesBanner() {
    document.getElementById('btn-keep-changes')?.addEventListener('click', () => {
        document.getElementById('unsaved-banner')?.classList.remove('visible');
    });

    document.getElementById('btn-discard-changes')?.addEventListener('click', async () => {
        clearUnsaved();
        await loadProfile(); // alanları orijinal değerlere döndür
    });

    window.addEventListener('beforeunload', e => {
        if (_hasUnsaved) { e.preventDefault(); e.returnValue = ''; }
    });
}

function markUnsaved() {
    _hasUnsaved = true;
    document.getElementById('unsaved-banner')?.classList.add('visible');
}

function clearUnsaved() {
    _hasUnsaved = false;
    document.getElementById('unsaved-banner')?.classList.remove('visible');
}

// ── YARDIMCI FONKSİYONLAR ─────────────────────────────────────────────

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
}

function getVal(id) {
    return document.getElementById(id)?.value || '';
}

function showSaved(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 3000);
}

function setFieldErr(id, msg) {
    const errEl = document.getElementById(id + '-err');
    if (errEl) errEl.textContent = msg;
    document.getElementById(id)?.classList.add('is-error');
}

// setBtnLoading — FormUtils.setLoading'deki "if (buttonEl) return" bug'ı düzeltildi
function setBtnLoading(btn, isLoading, originalText) {
    if (!btn) return; // null guard doğru şekilde
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.origText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span>';
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText || btn.dataset.origText || 'Kaydet';
    }
}