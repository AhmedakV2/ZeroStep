// Ayarlar sayfası — Profil düzenleme, Bildirim Tercihleri, Oturum Yönetimi, Görünüm
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
        await loadProfile();
        await loadNotificationPrefs();
        setupThemeTab();
        setupPasswordModal();
        setupProfileEditing();
        setupUnsavedChanges();
    } catch (err) {
        console.error('Ayarlar sayfası başlatılamadı:', err);
        Toast.error('Sayfa yüklenirken bir hata oluştu.');
    }
});

// ── SEKME YÖNETİMİ ───────────────────────────────────────────────
function setupTabs() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            // Değişiklik uyarısı aktifse sekme değişimini sor
            if (_hasUnsavedChanges && !await confirmDiscardChanges()) return;

            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const panel = document.getElementById('panel-' + tab.dataset.tab);
            if (panel) panel.classList.add('active');

            // Oturum sekmesine ilk geçişte yükle
            if (tab.dataset.tab === 'sessions') loadSessions();
        });
    });
}

// ── PROFİL ───────────────────────────────────────────────────────
async function loadProfile() {
    try {
        const user = await Api.get('/users/me');
        if (!user) throw new Error('Sunucu boş yanıt döndü');

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || '—';
        };

        set('prof-username', user.username);
        set('prof-email', user.email);
        set('prof-display', user.displayName || '(belirtilmemiş)');
        set('prof-roles', (user.roles || []).join(', '));
        set('prof-created', Utils.formatDate(user.createdAt));
        set('prof-lastlogin', Utils.formatDate(user.lastLoginAt));

        const initials = (user.displayName || user.username || '?').slice(0, 2).toUpperCase();
        const avatarEl = document.getElementById('prof-avatar');
        if (avatarEl) avatarEl.textContent = initials;

        // Düzenleme inputlarını doldur
        const editDisplay = document.getElementById('edit-displayName');
        const editEmail   = document.getElementById('edit-email');
        if (editDisplay) editDisplay.value = user.displayName || '';
        if (editEmail)   editEmail.value   = user.email || '';

        // Login geçmişini göster — mevcut kullanıcı bilgileriyle simüle
        renderLoginHistory(user);

    } catch (err) {
        console.error('Profil yüklenemedi:', err);
        const el = document.getElementById('prof-username');
        if (el) el.textContent = 'Yüklenirken hata oluştu';
    }
}

// Login geçmişini mevcut refresh token bilgisinden göster
function renderLoginHistory(user) {
    const wrap  = document.getElementById('login-history-wrap');
    const table = document.getElementById('login-history-table');
    const tbody = document.getElementById('login-history-body');
    if (!wrap || !table || !tbody) return;

    wrap.style.display = 'none';
    table.style.display = 'table';

    // Backend'de ayrı login history endpoint'i yoksa
    // mevcut son giriş bilgisini göster
    if (user.lastLoginAt) {
        tbody.innerHTML = `
            <tr>
                <td>${Utils.formatDate(user.lastLoginAt)}</td>
                <td style="font-family:var(--font-ui);font-size:.8rem;">—</td>
                <td style="font-size:.8rem;">Tarayıcı</td>
                <td><span style="color:var(--clr-success);font-size:.8rem;">✓ Başarılı</span></td>
            </tr>`;
    } else {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--clr-text-muted);padding:1rem;">
            Oturum geçmişi bilgisi mevcut değil.
        </td></tr>`;
    }
}

// ── PROFİL DÜZENLEME ─────────────────────────────────────────────
function setupProfileEditing() {
    // Görünen ad kaydet
    document.getElementById('btn-save-displayName')?.addEventListener('click', async () => {
        const val = document.getElementById('edit-displayName')?.value.trim();
        if (!val) { Toast.warning('Görünen ad boş olamaz.'); return; }

        const btn = document.getElementById('btn-save-displayName');
        setButtonLoading(btn, true);
        try {
            // PATCH /api/v1/users/me — backend bu endpoint'i destekliyorsa
            await Api.patch('/users/me', { displayName: val });
            document.getElementById('prof-display').textContent = val;
            // Avatar güncelle
            const avatarEl = document.getElementById('prof-avatar');
            if (avatarEl) avatarEl.textContent = val.slice(0, 2).toUpperCase();
            showFieldSaved('saved-displayName');
            Toast.success('Görünen ad güncellendi.');
            clearUnsavedChanges();
        } catch (err) {
            Toast.error('Güncellenemedi: ' + (err.message || 'Sunucu hatası'));
        } finally {
            setButtonLoading(btn, false, 'Kaydet');
        }
    });

    // E-posta kaydet
    document.getElementById('btn-save-email')?.addEventListener('click', async () => {
        const val = document.getElementById('edit-email')?.value.trim();
        const errEl = document.getElementById('email-err');
        if (errEl) errEl.textContent = '';

        if (!val) { if (errEl) errEl.textContent = 'E-posta boş olamaz.'; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            if (errEl) errEl.textContent = 'Geçerli bir e-posta adresi girin.';
            return;
        }

        const btn = document.getElementById('btn-save-email');
        setButtonLoading(btn, true);
        try {
            await Api.patch('/users/me', { email: val });
            document.getElementById('prof-email').textContent = val;
            showFieldSaved('saved-email');
            Toast.success('E-posta güncellendi.');
            clearUnsavedChanges();
        } catch (err) {
            if (errEl) errEl.textContent = err.message || 'Güncellenemedi.';
            Toast.error('E-posta güncellenemedi: ' + (err.message || 'Sunucu hatası'));
        } finally {
            setButtonLoading(btn, false, 'Kaydet');
        }
    });

    // Input değişince unsaved flag
    ['edit-displayName', 'edit-email'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', markUnsavedChanges);
    });
}

function showFieldSaved(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 3000);
}

// ── ŞİFRE MODALİ ─────────────────────────────────────────────────
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
            onConfirm: async () => {
                await submitPasswordChange();
            }
        });

        // Şifre gücü göstergesi — modal açıldıktan sonra bağla
        setTimeout(() => {
            document.getElementById('cpw-new')?.addEventListener('input', e => {
                updatePasswordStrength(e.target.value);
            });
        }, 60);
    });
}

// Şifre gücü hesapla ve göster
function updatePasswordStrength(pw) {
    const fill  = document.getElementById('pw-strength-fill');
    const label = document.getElementById('pw-strength-label');
    if (!fill || !label) return;

    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[@$!%*?&]/.test(pw)) score++;

    const levels = [
        { pct: '0%',   color: 'transparent', text: '' },
        { pct: '20%',  color: '#ff4d4d',     text: 'Çok zayıf' },
        { pct: '40%',  color: '#ff9800',     text: 'Zayıf' },
        { pct: '60%',  color: '#fbbf24',     text: 'Orta' },
        { pct: '80%',  color: '#4ade80',     text: 'Güçlü' },
        { pct: '100%', color: '#22c55e',     text: 'Çok güçlü' },
    ];
    const lvl = levels[Math.min(score, 5)];
    fill.style.width    = pw.length ? lvl.pct : '0%';
    fill.style.background = lvl.color;
    label.textContent   = pw.length ? lvl.text : '';
    label.style.color   = lvl.color;
}

async function submitPasswordChange() {
    const current = document.getElementById('cpw-current')?.value  || '';
    const newPwd  = document.getElementById('cpw-new')?.value      || '';
    const confirm = document.getElementById('cpw-confirm')?.value  || '';
    const errorEl = document.getElementById('cpw-error');

    // Hataları temizle
    ['cpw-current','cpw-new','cpw-confirm'].forEach(id => {
        const errEl = document.getElementById(id + '-err');
        if (errEl) errEl.textContent = '';
        document.getElementById(id)?.classList.remove('is-error');
    });
    if (errorEl) errorEl.classList.add('hidden');

    let valid = true;
    if (!current) { setFieldErr('cpw-current', 'Mevcut şifre zorunlu'); valid = false; }

    const pwPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;
    if (!pwPattern.test(newPwd)) {
        setFieldErr('cpw-new', 'Min 8 karakter, büyük/küçük harf, rakam ve özel karakter içermeli');
        valid = false;
    }
    if (newPwd !== confirm) { setFieldErr('cpw-confirm', 'Şifreler eşleşmiyor'); valid = false; }
    if (!valid) throw new Error('validation');

    try {
        await Api.post('/users/me/change-password', { currentPassword: current, newPassword: newPwd });
        Toast.success('Şifre değiştirildi. Yeniden giriş yapmanız gerekiyor.');
        Modal.close();
        setTimeout(() => Auth.logout(), 1800);
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = err.message || 'Şifre değiştirilemedi.';
            errorEl.classList.remove('hidden');
        }
        throw err; // modal confirm butonunu tekrar aktif etsin
    }
}

function setFieldErr(id, msg) {
    const errEl = document.getElementById(id + '-err');
    if (errEl) errEl.textContent = msg;
    document.getElementById(id)?.classList.add('is-error');
}

// ── BİLDİRİM TERCİHLERİ ─────────────────────────────────────────
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

        if (!prefs || !prefs.length) {
            container.innerHTML = '<div style="padding:1rem;color:var(--clr-text-muted);font-size:.85rem;">Tercih bulunamadı.</div>';
            return;
        }

        container.innerHTML = prefs.map(p => {
            const cfg = NOTIF_LABELS[p.type] || { label: p.type, icon: 'ℹ' };
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

        // Chip toggle
        container.querySelectorAll('.channel-chip').forEach(chip => {
            chip.addEventListener('click', () => chip.classList.toggle('active'));
        });

    } catch (err) {
        container.innerHTML = `<div style="padding:1rem;color:var(--clr-text-muted);">Yüklenemedi: ${Utils.escHtml(err.message)}</div>`;
    }
}

async function saveNotificationPrefs() {
    const btn = document.getElementById('btn-save-notifs');
    setButtonLoading(btn, true);

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

    setButtonLoading(btn, false, 'Kaydet');
    if (hasError) Toast.warning('Bazı tercihler kaydedilemedi.');
    else Toast.success('Bildirim tercihleri kaydedildi.');
}

document.getElementById('btn-save-notifs')?.addEventListener('click', saveNotificationPrefs);

// ── OTURUM YÖNETİMİ ──────────────────────────────────────────────
async function loadSessions() {
    const container = document.getElementById('sessions-list');
    if (!container || container.dataset.loaded) return;
    container.dataset.loaded = '1';

    try {
        // Backend'de /auth/sessions endpoint'i varsa çek; yoksa simüle et
        let sessions = [];
        try {
            sessions = await Api.get('/auth/sessions');
        } catch {
            // Endpoint henüz yok — mevcut oturumu göster
            sessions = null;
        }

        if (!sessions || !sessions.length) {
            // Mevcut oturumu manuel olarak göster
            const user = Store.getUser();
            container.innerHTML = `
                <div class="session-card current">
                    <div class="session-info">
                        <div class="session-icon">◉</div>
                        <div class="session-details">
                            <div class="session-device">Bu Tarayıcı (Mevcut Oturum)</div>
                            <div class="session-meta">
                                ${user ? Utils.escHtml(user.username) : ''} • Az önce
                            </div>
                        </div>
                    </div>
                    <span class="session-badge">Aktif</span>
                </div>
                <p style="font-size:.78rem;color:var(--clr-text-muted);margin-top:.75rem;">
                    Tüm oturumları listeleme için backend <code>/api/v1/auth/sessions</code> endpoint'i gereklidir.
                </p>`;
            return;
        }

        container.innerHTML = sessions.map((s, idx) => {
            const isCurrent = s.current || idx === 0;
            return `
                <div class="session-card ${isCurrent ? 'current' : ''}">
                    <div class="session-info">
                        <div class="session-icon">${isCurrent ? '◉' : '◎'}</div>
                        <div class="session-details">
                            <div class="session-device">${Utils.escHtml(s.userAgent || 'Tarayıcı')}</div>
                            <div class="session-meta">
                                ${Utils.escHtml(s.ipAddress || '—')} •
                                ${s.createdAt ? Utils.formatDate(s.createdAt) : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:.5rem;">
                        ${isCurrent
                ? '<span class="session-badge">Aktif</span>'
                : `<button class="btn btn-ghost btn-sm"
                                data-session-id="${Utils.escHtml(s.id || '')}"
                                onclick="revokeSession(this)">Sonlandır</button>`}
                    </div>
                </div>`;
        }).join('');

    } catch (err) {
        container.innerHTML = `<div style="padding:1rem;color:var(--clr-danger);font-size:.85rem;">Yüklenemedi: ${Utils.escHtml(err.message)}</div>`;
    }
}

// Tek oturumu sonlandır
window.revokeSession = async function(btn) {
    const id = btn.dataset.sessionId;
    if (!id) return;
    btn.disabled = true;
    try {
        await Api.del('/auth/sessions/' + id);
        btn.closest('.session-card').remove();
        Toast.success('Oturum sonlandırıldı.');
    } catch (err) {
        btn.disabled = false;
        Toast.error('Sonlandırılamadı: ' + (err.message || 'Hata'));
    }
};

// Tüm diğer oturumları sonlandır
document.getElementById('btn-revoke-all')?.addEventListener('click', async () => {
    if (!confirm('Diğer tüm oturumlar sonlandırılacak. Onaylıyor musunuz?')) return;
    const btn = document.getElementById('btn-revoke-all');
    setButtonLoading(btn, true);
    try {
        await Api.post('/auth/logout-all', {});
        Toast.success('Diğer tüm oturumlar sonlandırıldı.');
        // Listeden mevcut dışındakileri temizle
        document.querySelectorAll('.session-card:not(.current)').forEach(el => el.remove());
    } catch (err) {
        Toast.error('İşlem başarısız: ' + (err.message || 'Hata'));
    } finally {
        setButtonLoading(btn, false, 'Diğer Tüm Oturumları Sonlandır');
    }
});

// ── TEMA ─────────────────────────────────────────────────────────
function setupThemeTab() {
    const current = ThemeManager.get();
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

// ── UNSAVED CHANGES ───────────────────────────────────────────────
let _hasUnsavedChanges = false;
let _pendingTabSwitch  = null;

function setupUnsavedChanges() {
    const banner   = document.getElementById('unsaved-banner');
    const discard  = document.getElementById('btn-discard-changes');
    const keep     = document.getElementById('btn-keep-changes');

    discard?.addEventListener('click', () => {
        clearUnsavedChanges();
        // Input'ları sıfırla
        loadProfile();
    });

    keep?.addEventListener('click', () => {
        banner?.classList.remove('visible');
        _hasUnsavedChanges = false;
    });

    // Sayfa kapatma uyarısı
    window.addEventListener('beforeunload', e => {
        if (_hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

function markUnsavedChanges() {
    _hasUnsavedChanges = true;
    document.getElementById('unsaved-banner')?.classList.add('visible');
}

function clearUnsavedChanges() {
    _hasUnsavedChanges = false;
    document.getElementById('unsaved-banner')?.classList.remove('visible');
}

function confirmDiscardChanges() {
    return new Promise(resolve => {
        const banner = document.getElementById('unsaved-banner');
        if (!_hasUnsavedChanges) { resolve(true); return; }
        banner?.classList.add('visible');
        // Banner discard/keep butonları zaten resolve'u handle ediyor
        // Basit çözüm: confirm diyaloğu kullan
        resolve(confirm('Kaydedilmemiş değişiklikler var. Yine de devam etmek istiyor musunuz?'));
    });
}

// ── YARDIMCI FONKSİYONLAR ────────────────────────────────────────

// Düzgün çalışan setButtonLoading (orijinal FormUtils'daki bug düzeltildi)
function setButtonLoading(btn, isLoading, originalText) {
    if (!btn) return; // null guard burada — eski kodda yanlıştı
    if (isLoading) {
        btn.disabled = true;
        btn.dataset.origText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span>';
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText || btn.dataset.origText || 'Kaydet';
    }
}