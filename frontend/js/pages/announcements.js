// ╔══════════════════════════════════════════════════════════╗
// ║  Duyurular Sayfası — Kullanıcı görünümü + Admin yönetimi ║
// ╚══════════════════════════════════════════════════════════╝

// ── State ──────────────────────────────────────────────────
let isAdmin = false;
let stompClient = null;
let adminPage = 0;

// Admin modal için seçili kullanıcılar listesi
let selectedUsers = [];

// ── INIT ───────────────────────────────────────────────────
(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    isAdmin = Auth.isAdmin();

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Duyurular');

    // Admin UI'ı aç
    if (isAdmin) {
        document.getElementById('ann-tabs').classList.remove('hidden');
        document.getElementById('btn-new-ann').classList.remove('hidden');
        setupAdminTabEvents();
    }

    setupTabNavigation();
    connectWebSocket();

    await loadUserAnnouncements();
})();

// ── SEKMELEr ───────────────────────────────────────────────
function setupTabNavigation() {
    document.querySelectorAll('.ann-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ann-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.ann-tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

            // Admin sekmesine ilk geçişte yükle
            if (tab.dataset.tab === 'admin') {
                loadAdminAnnouncements();
            }
        });
    });
}

function setupAdminTabEvents() {
    document.getElementById('btn-new-ann').addEventListener('click', openCreateModal);
    document.getElementById('btn-new-ann-admin').addEventListener('click', openCreateModal);
}

// ═══════════════════════════════════════════════════════════
// KULLANICI GÖRÜNÜMÜ
// ═══════════════════════════════════════════════════════════
async function loadUserAnnouncements() {
    try {
        // GET /api/v1/announcements
        const raw = await Api.get('/announcements');
        const items = Array.isArray(raw) ? raw : (raw?.data ?? []);

        hideSkeleton();
        renderUserAnnouncements(items);
    } catch (err) {
        hideSkeleton();
        document.getElementById('ann-empty').classList.remove('hidden');
        Toast.error('Duyurular yüklenemedi: ' + err.message);
    }
}

function hideSkeleton() {
    document.getElementById('ann-skeleton').classList.add('hidden');
    document.getElementById('ann-list').classList.remove('hidden');
}

function renderUserAnnouncements(items) {
    const list = document.getElementById('ann-list');
    const empty = document.getElementById('ann-empty');

    if (!items || items.length === 0) {
        list.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    list.classList.remove('hidden');
    list.innerHTML = items.map(a => buildAnnCard(a)).join('');

    // Dismiss butonları
    list.querySelectorAll('[data-dismiss]').forEach(btn => {
        btn.addEventListener('click', () => dismissAnnouncement(btn.dataset.dismiss, btn.closest('.ann-card')));
    });
}

function buildAnnCard(ann) {
    const icons = { INFO: 'ℹ', WARNING: '⚠', CRITICAL: '✕' };
    const icon = icons[ann.severity] ?? 'ℹ';
    const published = ann.publishAt ? Utils.formatDate(ann.publishAt) : '';

    return `
        <div class="ann-card" data-severity="${Utils.escHtml(ann.severity)}" data-id="${Utils.escHtml(ann.publicId)}">
            <button class="ann-dismiss-btn" data-dismiss="${Utils.escHtml(ann.publicId)}" title="Kapat">✕</button>
            <div class="ann-header">
                <div class="ann-icon ann-icon-${Utils.escHtml(ann.severity)}">${icon}</div>
                <div class="ann-title">${Utils.escHtml(ann.title)}</div>
            </div>
            <div class="ann-body">${Utils.escHtml(ann.body)}</div>
            <div class="ann-footer">
                <span class="ann-meta">${published}</span>
                ${ann.severity === 'CRITICAL' ? '<span class="badge badge-danger">KRİTİK</span>' : ''}
                ${ann.severity === 'WARNING'  ? '<span class="badge badge-warning">UYARI</span>' : ''}
            </div>
        </div>`;
}

async function dismissAnnouncement(publicId, cardEl) {
    try {
        await Api.post(`/announcements/${publicId}/dismiss`, {});
        // Animasyonlu kapat
        cardEl.classList.add('dismissing');
        cardEl.addEventListener('animationend', () => {
            cardEl.remove();
            // Hiç kart kalmadıysa boş durumu göster
            const list = document.getElementById('ann-list');
            if (!list.querySelector('.ann-card')) {
                list.classList.add('hidden');
                document.getElementById('ann-empty').classList.remove('hidden');
            }
        }, { once: true });
    } catch (err) {
        Toast.error('Duyuru kapatılamadı: ' + err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// ADMİN PANEL
// ═══════════════════════════════════════════════════════════
async function loadAdminAnnouncements() {
    const tbody = document.getElementById('admin-ann-tbody');
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <span class="empty-state-msg" style="color:var(--clr-text-muted)">Yükleniyor...</span>
    </div></td></tr>`;

    try {
        const raw = await Api.get('/admin/announcements', { page: adminPage, size: 20 });
        let items = [];
        let pageData = {};

        if (raw?.content) { items = raw.content; pageData = raw; }
        else if (Array.isArray(raw)) { items = raw; pageData = { totalPages: 1 }; }
        else { items = []; }

        renderAdminTable(items);

        // Pagination
        const paginationEl = document.getElementById('admin-pagination');
        if (pageData.totalPages > 1) {
            Pagination.render(paginationEl, pageData, (p) => {
                adminPage = p;
                loadAdminAnnouncements();
            });
        } else {
            paginationEl.innerHTML = '';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger" style="padding:1rem;text-align:center;">
            Yüklenemedi: ${Utils.escHtml(err.message)}
        </td></tr>`;
    }
}

function renderAdminTable(items) {
    const tbody = document.getElementById('admin-ann-tbody');

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">
            <div class="empty-state">
                <span class="empty-state-icon">◎</span>
                <p class="empty-state-msg">Henüz duyuru yok</p>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(a => {
        const sevClass = `severity-${a.severity}`;
        const tgtClass = `target-${a.targetType}`;
        const tgtLabel = { ALL: 'Herkes', ROLE: 'Rol', USERS: 'Kullanıcılar' }[a.targetType] ?? a.targetType;
        const publishedDot = a.published
            ? '<span class="published-dot yes"></span>Yayında'
            : '<span class="published-dot no"></span>Taslak';

        const canPublish = !a.published;
        const canDelete  = !a.published;

        return `
            <tr data-id="${Utils.escHtml(a.publicId)}">
                <td>
                    <div style="font-weight:600;font-size:.88rem;">${Utils.escHtml(a.title)}</div>
                    <div style="font-size:.72rem;color:var(--clr-text-muted);margin-top:2px;">
                        ${Utils.escHtml(a.createdByUsername || '')}
                    </div>
                </td>
                <td>
                    <span class="badge ${sevClass}" style="font-size:.7rem;">
                        ${Utils.escHtml(a.severity)}
                    </span>
                </td>
                <td>
                    <span class="target-badge ${tgtClass}">${Utils.escHtml(tgtLabel)}</span>
                </td>
                <td style="font-size:.82rem;color:var(--clr-text-muted);">${publishedDot}</td>
                <td style="font-size:.78rem;color:var(--clr-text-muted);">${Utils.formatDate(a.createdAt)}</td>
                <td>
                    <div class="admin-ann-actions">
                        ${canPublish ? `<button class="btn btn-publish btn-sm" data-action="publish" data-id="${Utils.escHtml(a.publicId)}">Yayınla</button>` : ''}
                        ${canDelete  ? `<button class="btn btn-ghost btn-sm"   data-action="edit"    data-id="${Utils.escHtml(a.publicId)}">Düzenle</button>` : ''}
                        ${canDelete  ? `<button class="btn btn-danger btn-sm"  data-action="delete"  data-id="${Utils.escHtml(a.publicId)}">Sil</button>` : ''}
                        ${!canPublish ? '<span style="font-size:.72rem;color:var(--clr-text-muted);">Yayında</span>' : ''}
                    </div>
                </td>
            </tr>`;
    }).join('');

    // Aksiyon butonları
    tbody.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === 'publish') confirmPublish(id);
            else if (action === 'delete') confirmDelete(id);
            else if (action === 'edit') openEditModal(id, items.find(a => a.publicId === id));
        });
    });
}

// ── Yayınlama ────────────────────────────────────────────
function confirmPublish(publicId) {
    ConfirmDialog.show({
        title: 'Duyuruyu Yayınla',
        message: 'Duyuru yayınlandıktan sonra düzenlenemez ve silinemez. Hedef kullanıcılara bildirim gönderilir.',
        confirmLabel: 'Yayınla',
        onConfirm: async () => {
            await Api.post(`/admin/announcements/${publicId}/publish`, {});
            Modal.close();
            Toast.success('Duyuru yayınlandı!');
            loadAdminAnnouncements();
        }
    });
}

// ── Silme ────────────────────────────────────────────────
function confirmDelete(publicId) {
    ConfirmDialog.show({
        title: 'Duyuruyu Sil',
        message: 'Bu taslak duyuru kalıcı olarak silinecek.',
        confirmLabel: 'Sil',
        onConfirm: async () => {
            await Api.del(`/admin/announcements/${publicId}`);
            Modal.close();
            Toast.success('Duyuru silindi.');
            loadAdminAnnouncements();
        }
    });
}

// ═══════════════════════════════════════════════════════════
// MODAL — OLUŞTUR / DÜZENLE
// ═══════════════════════════════════════════════════════════
function openCreateModal() {
    selectedUsers = [];
    openAnnModal(null);
}

function openEditModal(publicId, ann) {
    selectedUsers = [];
    openAnnModal(ann);
}

function openAnnModal(ann) {
    const isEdit = !!ann;

    const contentHTML = buildModalContent(ann);

    Modal.open({
        title: isEdit ? 'Duyuruyu Düzenle' : 'Yeni Duyuru',
        contentHTML,
        confirmLabel: 'Kaydet',
        size: 'lg',
        onConfirm: async (backdrop) => {
            await saveAnnouncement(backdrop, isEdit ? ann?.publicId : null);
        }
    });

    // Modal açıldıktan sonra dinamik event'leri bağla
    setTimeout(() => bindModalEvents(ann), 50);
}

function buildModalContent(ann) {
    const curSev     = ann?.severity    ?? 'INFO';
    const curTarget  = ann?.targetType  ?? 'ALL';
    const curRoles   = ann?.targetRoles ?? [];

    return `
    <div style="display:flex;flex-direction:column;gap:1rem;margin-top:.5rem;">

        <div class="form-group">
            <label class="form-label">Başlık <span style="color:var(--clr-danger)">*</span></label>
            <input class="form-input" type="text" id="ann-title" maxlength="255"
                   placeholder="Duyuru başlığı..." value="${Utils.escHtml(ann?.title ?? '')}">
        </div>

        <div class="form-group">
            <label class="form-label">İçerik <span style="color:var(--clr-danger)">*</span></label>
            <textarea class="form-input" id="ann-body" rows="4"
                      placeholder="Duyuru içeriği..."
                      style="resize:vertical;">${Utils.escHtml(ann?.body ?? '')}</textarea>
        </div>

        <div class="form-group">
            <label class="form-label">Şiddet</label>
            <div class="severity-radio-group">
                <label class="sev-option sev-INFO">
                    <input type="radio" name="ann-severity" value="INFO" ${curSev==='INFO'?'checked':''}>
                    ℹ INFO
                </label>
                <label class="sev-option sev-WARNING">
                    <input type="radio" name="ann-severity" value="WARNING" ${curSev==='WARNING'?'checked':''}>
                    ⚠ WARNING
                </label>
                <label class="sev-option sev-CRITICAL">
                    <input type="radio" name="ann-severity" value="CRITICAL" ${curSev==='CRITICAL'?'checked':''}>
                    ✕ CRITICAL
                </label>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Hedef Kitle</label>
            <div class="target-radio-group">
                <label class="target-radio-card">
                    <input type="radio" name="ann-target" value="ALL" ${curTarget==='ALL'?'checked':''}>
                    <div class="trc-label">Herkes</div>
                    <div class="trc-desc">Tüm aktif kullanıcılar</div>
                </label>
                <label class="target-radio-card">
                    <input type="radio" name="ann-target" value="ROLE" ${curTarget==='ROLE'?'checked':''}>
                    <div class="trc-label">Role Göre</div>
                    <div class="trc-desc">Belirli rol sahipleri</div>
                </label>
                <label class="target-radio-card">
                    <input type="radio" name="ann-target" value="USERS" ${curTarget==='USERS'?'checked':''}>
                    <div class="trc-label">Kişiler</div>
                    <div class="trc-desc">Belirli kullanıcılar</div>
                </label>
            </div>

            <!-- ROLE seçimi -->
            <div id="role-select-area" style="display:${curTarget==='ROLE'?'block':'none'}">
                <div class="role-check-list">
                    ${['ADMIN','TESTER','VIEWER'].map(r => `
                        <label class="role-check-item">
                            <input type="checkbox" value="${r}" name="ann-roles"
                                   ${curRoles.includes(r)?'checked':''}>
                            ${r}
                        </label>`).join('')}
                </div>
            </div>

            <!-- USERS seçimi -->
            <div id="user-select-area" style="display:${curTarget==='USERS'?'block':'none'}">
                <input class="form-input" type="text" id="user-search-input"
                       placeholder="Kullanıcı adı ile ara..." style="margin-top:.5rem;">
                <div id="user-search-results" class="user-search-results" style="display:none;"></div>
                <div class="user-search-chip-area" id="selected-users-chips"></div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
            <div class="form-group">
                <label class="form-label">Yayın Zamanı</label>
                <input class="form-input" type="datetime-local" id="ann-publish-at"
                       value="${ann?.publishAt ? toDatetimeLocal(ann.publishAt) : ''}">
                <span style="font-size:.7rem;color:var(--clr-text-muted);">Boş = hemen yayınla</span>
            </div>
            <div class="form-group">
                <label class="form-label">Son Geçerlilik</label>
                <input class="form-input" type="datetime-local" id="ann-expires-at"
                       value="${ann?.expiresAt ? toDatetimeLocal(ann.expiresAt) : ''}">
                <span style="font-size:.7rem;color:var(--clr-text-muted);">Boş = sonsuz</span>
            </div>
        </div>
    </div>`;
}

function bindModalEvents(ann) {
    // Hedef tipi değişince ilgili alanı göster/gizle
    document.querySelectorAll('input[name="ann-target"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('role-select-area').style.display =
                radio.value === 'ROLE' ? 'block' : 'none';
            document.getElementById('user-select-area').style.display =
                radio.value === 'USERS' ? 'block' : 'none';
        });
    });

    // Kullanıcı arama
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(async (e) => {
            const q = e.target.value.trim();
            if (q.length < 2) {
                document.getElementById('user-search-results').style.display = 'none';
                return;
            }
            await searchUsersForModal(q);
        }, 300));
    }

    // Önceden seçili kullanıcıları göster
    renderSelectedChips();
}

async function searchUsersForModal(q) {
    const resultsEl = document.getElementById('user-search-results');
    try {
        const raw = await Api.get('/admin/users', { search: q, size: 8 });
        let items = raw?.content ?? (Array.isArray(raw) ? raw : []);

        // Zaten seçilenleri hariç tut
        items = items.filter(u => !selectedUsers.find(s => s.publicId === u.publicId));

        if (!items.length) {
            resultsEl.innerHTML = `<div style="padding:.75rem;font-size:.78rem;color:var(--clr-text-muted);">Sonuç bulunamadı</div>`;
            resultsEl.style.display = 'block';
            return;
        }

        resultsEl.style.display = 'block';
        resultsEl.innerHTML = items.map(u => `
            <div class="user-result-row" data-uid="${Utils.escHtml(u.publicId)}"
                 data-uname="${Utils.escHtml(u.username)}">
                <div class="user-result-av">${avatarInitials(u.displayName || u.username)}</div>
                <div>
                    <div style="font-weight:600;">${Utils.escHtml(u.displayName || u.username)}</div>
                    <div style="font-size:.7rem;color:var(--clr-text-muted);">@${Utils.escHtml(u.username)}</div>
                </div>
            </div>`).join('');

        // Kullanıcı seç
        resultsEl.querySelectorAll('.user-result-row').forEach(row => {
            row.addEventListener('click', () => {
                selectedUsers.push({ publicId: row.dataset.uid, username: row.dataset.uname });
                resultsEl.style.display = 'none';
                document.getElementById('user-search-input').value = '';
                renderSelectedChips();
            });
        });
    } catch {
        resultsEl.style.display = 'none';
    }
}

function renderSelectedChips() {
    const area = document.getElementById('selected-users-chips');
    if (!area) return;
    area.innerHTML = selectedUsers.map(u => `
        <div class="user-chip" data-uid="${Utils.escHtml(u.publicId)}">
            @${Utils.escHtml(u.username)}
            <button type="button" data-remove="${Utils.escHtml(u.publicId)}">✕</button>
        </div>`).join('');

    area.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedUsers = selectedUsers.filter(u => u.publicId !== btn.dataset.remove);
            renderSelectedChips();
        });
    });
}

// ── Kaydet ───────────────────────────────────────────────
async function saveAnnouncement(backdrop, existingPublicId) {
    const title  = document.getElementById('ann-title')?.value.trim();
    const body   = document.getElementById('ann-body')?.value.trim();
    const sev    = document.querySelector('input[name="ann-severity"]:checked')?.value ?? 'INFO';
    const target = document.querySelector('input[name="ann-target"]:checked')?.value ?? 'ALL';

    if (!title) { Toast.warning('Başlık zorunlu'); throw new Error('validation'); }
    if (!body)  { Toast.warning('İçerik zorunlu'); throw new Error('validation'); }

    // Rol listesi
    const targetRoles = target === 'ROLE'
        ? [...document.querySelectorAll('input[name="ann-roles"]:checked')].map(c => c.value)
        : [];

    if (target === 'ROLE' && targetRoles.length === 0) {
        Toast.warning('En az bir rol seçilmeli'); throw new Error('validation');
    }

    // Kullanıcı listesi
    const targetUserPublicIds = target === 'USERS'
        ? selectedUsers.map(u => u.publicId)
        : [];

    if (target === 'USERS' && targetUserPublicIds.length === 0) {
        Toast.warning('En az bir kullanıcı seçilmeli'); throw new Error('validation');
    }

    // Tarihler
    const publishAtRaw = document.getElementById('ann-publish-at')?.value;
    const expiresAtRaw = document.getElementById('ann-expires-at')?.value;

    const payload = {
        title,
        body,
        severity: sev,
        targetType: target,
        targetRoles,
        targetUserPublicIds,
        publishAt:  publishAtRaw  ? new Date(publishAtRaw).toISOString()  : null,
        expiresAt:  expiresAtRaw  ? new Date(expiresAtRaw).toISOString()  : null,
    };

    if (existingPublicId) {
        await Api.put(`/admin/announcements/${existingPublicId}`, payload);
        Toast.success('Duyuru güncellendi');
    } else {
        await Api.post('/admin/announcements', payload);
        Toast.success('Duyuru oluşturuldu (Taslak)');
    }

    Modal.close();
    loadAdminAnnouncements();
}

// ═══════════════════════════════════════════════════════════
// WEBSOCKET — /topic/announcements
// ═══════════════════════════════════════════════════════════
function connectWebSocket() {
    const token = Store.getAccessToken();
    if (!token) return;

    try {
        const socket = new SockJS('http://localhost:8080/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;

        stompClient.connect(
            { Authorization: `Bearer ${token}` },
            () => {
                // Yeni duyuru broadcast'ini dinle
                stompClient.subscribe('/topic/announcements', msg => {
                    try {
                        const ann = JSON.parse(msg.body);
                        handleIncomingAnnouncement(ann);
                    } catch {}
                });
            },
            () => { setTimeout(connectWebSocket, 10_000); }
        );
    } catch {}
}

function handleIncomingAnnouncement(ann) {
    // Kullanıcı sekmesi aktifse listeye ekle
    const list = document.getElementById('ann-list');
    const empty = document.getElementById('ann-empty');

    if (!list.classList.contains('hidden')) {
        const card = document.createElement('div');
        card.innerHTML = buildAnnCard(ann);
        const cardEl = card.firstElementChild;
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'translateY(-8px)';
        list.prepend(cardEl);
        requestAnimationFrame(() => {
            cardEl.style.transition = 'opacity .25s ease, transform .25s ease';
            cardEl.style.opacity = '1';
            cardEl.style.transform = 'none';
        });

        // Dismiss bağla
        cardEl.querySelector('[data-dismiss]')?.addEventListener('click', (e) => {
            dismissAnnouncement(e.currentTarget.dataset.dismiss, cardEl);
        });

        empty.classList.add('hidden');
    }

    // Toast bildirimi
    const icons = { INFO: 'ℹ', WARNING: '⚠', CRITICAL: '✕' };
    Toast.info(`${icons[ann.severity] ?? '◎'} ${ann.title}`, 6000);
}

// ── Yardımcılar ───────────────────────────────────────────
function avatarInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

// ISO string → datetime-local input formatı
function toDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Sayfa kapanırken WS temizle
window.addEventListener('beforeunload', () => {
    if (stompClient?.connected) stompClient.disconnect();
});