// ╔══════════════════════════════════════════════════════════╗
// ║  Chat Sayfası — Konuşma listesi + Mesajlaşma + WS       ║
// ╚══════════════════════════════════════════════════════════╝

// ── State ──────────────────────────────────────────────────
let conversations    = [];     // Tüm konuşmalar cache
let activeConvId     = null;   // Seçili konuşmanın publicId'si
let activeConvData   = null;   // Seçili konuşmanın tam objesi
let stompClient      = null;
let wsConnected      = false;
let convSearchTerm   = '';

// Sayfalama
let msgPage          = 0;
let msgHasMore       = true;
let msgLoading       = false;

// Mevcut kullanıcı
let me = null;

// ── INIT ───────────────────────────────────────────────────
(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    me = Auth.getCurrentUser();

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Mesajlar');

    setupEventListeners();
    connectWebSocket();

    await loadConversations();
})();

// ── EVENT LISTENERS ────────────────────────────────────────
function setupEventListeners() {
    // Yeni konuşma butonu
    document.getElementById('btn-new-conv')
        .addEventListener('click', openNewConvModal);

    // Konuşma arama
    const searchEl = document.getElementById('conv-search');
    searchEl.addEventListener('input', Utils.debounce(e => {
        convSearchTerm = e.target.value.toLowerCase().trim();
        renderConvList();
    }, 250));

    // Mesaj textarea
    const textarea = document.getElementById('msg-textarea');
    const sendBtn  = document.getElementById('msg-send-btn');

    textarea.addEventListener('input', () => {
        // Auto-resize
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
        sendBtn.disabled = !textarea.value.trim();
    });

    textarea.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Mobil geri butonu
    document.getElementById('btn-back-conv')
        .addEventListener('click', () => {
            document.getElementById('conv-panel').classList.remove('hidden-mobile');
            showEmpty();
        });

    // Mesaj listesi scroll → infinite load (yukarı kaydırınca eski mesajlar)
    document.getElementById('msg-list')
        .addEventListener('scroll', onMsgListScroll);
}

// ── KONUŞMA LİSTESİ ────────────────────────────────────────
async function loadConversations() {
    try {
        const raw = await Api.get('/chat/conversations', { size: 50, sort: 'lastMessageAt,desc' });
        let items = [];
        if (raw?.content) items = raw.content;
        else if (Array.isArray(raw)) items = raw;

        conversations = items;
        renderConvList();
    } catch (err) {
        document.getElementById('conv-list').innerHTML = `
            <div style="padding:1.5rem;text-align:center;color:var(--clr-text-muted);font-size:.83rem;">
                Konuşmalar yüklenemedi
            </div>`;
    }
}

function renderConvList() {
    const container = document.getElementById('conv-list');
    const filtered = conversations.filter(c => {
        if (!convSearchTerm) return true;
        const name = (c.otherUser?.username || c.otherUser?.displayName || '').toLowerCase();
        const preview = (c.lastMessagePreview || '').toLowerCase();
        return name.includes(convSearchTerm) || preview.includes(convSearchTerm);
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding:2rem 1.25rem;text-align:center;color:var(--clr-text-muted);font-size:.82rem;">
                ${convSearchTerm ? 'Sonuç bulunamadı' : 'Henüz konuşma yok'}
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(c => {
        const other   = c.otherUser;
        const initials = avatarInitials(other?.displayName || other?.username || '?');
        const isActive = c.publicId === activeConvId;
        const preview  = c.lastMessagePreview || '...';
        const time     = c.lastMessageAt ? relativeTime(c.lastMessageAt) : '';

        return `
            <div class="conv-item ${isActive ? 'active' : ''}"
                 data-id="${Utils.escHtml(c.publicId)}"
                 data-username="${Utils.escHtml(other?.username || '')}">
                <div class="conv-avatar" style="${avatarColor(other?.username || '')}">
                    ${initials}
                </div>
                <div class="conv-info">
                    <div class="conv-name">${Utils.escHtml(other?.displayName || other?.username || '—')}</div>
                    <div class="conv-preview">${Utils.escHtml(preview)}</div>
                </div>
                <div class="conv-meta">
                    <span class="conv-time">${time}</span>
                </div>
            </div>`;
    }).join('');

    // Satır tıklama
    container.querySelectorAll('.conv-item[data-id]').forEach(item => {
        item.addEventListener('click', () => openConversation(item.dataset.id));
    });
}

// ── KONUŞMA AÇ ─────────────────────────────────────────────
async function openConversation(publicId) {
    activeConvId  = publicId;
    activeConvData = conversations.find(c => c.publicId === publicId) || null;
    msgPage   = 0;
    msgHasMore = true;

    // Aktif item vurgula
    renderConvList();

    // Mobil: conv panelini gizle
    document.getElementById('conv-panel').classList.add('hidden-mobile');
    document.getElementById('btn-back-conv').style.display = '';

    // Header güncelle
    const other = activeConvData?.otherUser;
    const initials = avatarInitials(other?.displayName || other?.username || '?');
    document.getElementById('msg-header-avatar').textContent = initials;
    document.getElementById('msg-header-avatar').style.cssText =
        avatarColor(other?.username || '');
    document.getElementById('msg-header-name').textContent =
        other?.displayName || other?.username || '—';

    // Aktif paneli göster
    showActive();

    // Mesajları yükle
    document.getElementById('msg-list').innerHTML = `
        <div class="msg-loading">
            <span class="spinner" style="width:.9rem;height:.9rem;
                border-color:var(--clr-border);border-top-color:var(--clr-primary);"></span>
            Yükleniyor...
        </div>`;

    await loadMessages(true);
}

// ── MESAJ YÜKLEME ──────────────────────────────────────────
async function loadMessages(scrollToBottom = false) {
    if (msgLoading || !activeConvId) return;
    msgLoading = true;

    try {
        const raw = await Api.get(
            `/chat/conversations/${activeConvId}/messages`,
            { page: msgPage, size: 30, sort: 'sentAt,asc' }
        );

        let items    = [];
        let pageData = {};

        if (raw?.content) {
            items    = raw.content;
            pageData = raw;
        } else if (Array.isArray(raw)) {
            items    = raw;
        }

        // Kalan sayfa var mı?
        msgHasMore = pageData.totalPages ? (msgPage + 1 < pageData.totalPages) : false;

        renderMessages(items, scrollToBottom);
        msgPage++;
    } catch (err) {
        const list = document.getElementById('msg-list');
        list.innerHTML = `<div style="padding:2rem;text-align:center;
            color:var(--clr-danger);font-size:.83rem;">Mesajlar yüklenemedi</div>`;
    } finally {
        msgLoading = false;
    }
}

// ── MESAJLARI RENDER ET ────────────────────────────────────
function renderMessages(items, scrollToBottom) {
    const list = document.getElementById('msg-list');

    if (items.length === 0 && msgPage === 0) {
        list.innerHTML = `
            <div style="flex:1;display:flex;align-items:center;justify-content:center;
                color:var(--clr-text-muted);font-size:.83rem;">
                Henüz mesaj yok. İlk mesajı gönder!
            </div>`;
        return;
    }

    // İlk yükleme: listeyi temizle; pagination: başa ekle
    const isFirst = msgPage === 1 || (msgPage === 0 && items.length > 0);

    if (isFirst) {
        list.innerHTML = '';
    }

    // Scroll pozisyonu kaydetme (eski mesaj ekleme için)
    const prevScrollHeight = list.scrollHeight;

    // Mesajları DOM'a ekle
    let lastDate = null;
    const fragment = document.createDocumentFragment();

    items.forEach(msg => {
        const msgDate = formatDateSep(msg.sentAt);
        if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'msg-date-sep';
            sep.textContent = msgDate;
            fragment.appendChild(sep);
            lastDate = msgDate;
        }
        fragment.appendChild(createMsgEl(msg));
    });

    if (isFirst) {
        list.appendChild(fragment);
    } else {
        // Eski mesajlar başa ekleniyor
        list.insertBefore(fragment, list.firstChild);
        // Scroll konumunu koru
        list.scrollTop = list.scrollHeight - prevScrollHeight;
    }

    if (scrollToBottom) {
        list.scrollTop = list.scrollHeight;
    }
}

// ── MESAJ ELEMANI OLUŞTUR ──────────────────────────────────
function createMsgEl(msg) {
    const isMine   = msg.senderUsername === me?.username;
    const deleted  = msg.deleted;

    const row = document.createElement('div');
    row.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;
    row.dataset.id = msg.publicId;

    // Silme butonu (sadece kendi mesajımıza, silinmemişse)
    const actionsHtml = isMine && !deleted ? `
        <div class="msg-actions">
            <button class="msg-action-btn" data-action="delete" data-id="${Utils.escHtml(msg.publicId)}">
                Sil
            </button>
        </div>` : '';

    const bubbleContent = deleted
        ? '🚫 Bu mesaj silindi'
        : Utils.escHtml(msg.content);

    const timeStr = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('tr-TR', {
        hour: '2-digit', minute: '2-digit'
    }) : '';

    row.innerHTML = `
        ${actionsHtml}
        <div class="msg-bubble ${deleted ? 'deleted' : ''}">${bubbleContent}</div>
        <span class="msg-time">${timeStr}${isMine && msg.readAt ? ' ✓✓' : ''}</span>`;

    // Silme butonu event
    row.querySelector('[data-action="delete"]')?.addEventListener('click', e => {
        e.stopPropagation();
        deleteMessage(msg.publicId, row);
    });

    return row;
}

// ── MESAJ GÖNDER ───────────────────────────────────────────
async function sendMessage() {
    const textarea = document.getElementById('msg-textarea');
    const content  = textarea.value.trim();
    if (!content || !activeConvId) return;

    const sendBtn = document.getElementById('msg-send-btn');
    sendBtn.disabled = true;
    textarea.value = '';
    textarea.style.height = 'auto';

    // Optimistic UI: mesajı anında göster
    const tempId  = 'temp_' + Date.now();
    const tempMsg = {
        publicId:        tempId,
        senderUsername:  me?.username,
        content,
        deleted:         false,
        sentAt:          new Date().toISOString(),
        readAt:          null,
    };
    appendMessage(tempMsg);

    try {
        const raw = await Api.post(`/chat/conversations/${activeConvId}/messages`,
            { content });
        // Temp mesajı gerçekle değiştir
        const saved = raw?.publicId ? raw : (raw?.data ?? raw);
        const tempEl = document.querySelector(`[data-id="${tempId}"]`);
        if (tempEl) {
            const realEl = createMsgEl(saved);
            tempEl.replaceWith(realEl);
        }

        // Konuşma listesini güncelle
        await loadConversations();
    } catch (err) {
        // Temp mesajı kaldır
        document.querySelector(`[data-id="${tempId}"]`)?.remove();
        Toast.error('Mesaj gönderilemedi: ' + err.message);
        // İçeriği geri koy
        textarea.value = content;
        sendBtn.disabled = false;
    }
}

// ── MESAJI LİSTEYE EKLE (ANLIK) ───────────────────────────
function appendMessage(msg) {
    const list = document.getElementById('msg-list');
    // Boş durum mesajını temizle
    if (list.querySelector('[style*="İlk mesajı"]')) list.innerHTML = '';

    list.appendChild(createMsgEl(msg));
    list.scrollTop = list.scrollHeight;
}

// ── MESAJ SİL ──────────────────────────────────────────────
async function deleteMessage(publicId, rowEl) {
    ConfirmDialog.show({
        title: 'Mesajı Sil',
        message: 'Bu mesaj silinecek. Karşı taraf "Bu mesaj silindi" görecek.',
        confirmLabel: 'Sil',
        onConfirm: async () => {
            await Api.del(`/chat/messages/${publicId}`);
            Modal.close();

            // Bubble'ı silinmiş görünümüne çevir
            const bubble = rowEl.querySelector('.msg-bubble');
            if (bubble) {
                bubble.textContent = '🚫 Bu mesaj silindi';
                bubble.classList.add('deleted');
            }
            rowEl.querySelector('.msg-actions')?.remove();
        },
    });
}

// ── SCROLL → ESKİ MESAJLAR ─────────────────────────────────
function onMsgListScroll(e) {
    const list = e.target;
    if (list.scrollTop < 80 && msgHasMore && !msgLoading && activeConvId) {
        loadMessages(false);
    }
}

// ── YENİ KONUŞMA MODAL ─────────────────────────────────────
function openNewConvModal() {
    let searchResults = [];

    Modal.open({
        title: 'Yeni Konuşma',
        contentHTML: `
            <div class="form-group" style="margin-bottom:.75rem;">
                <label class="form-label">Kullanıcı Adı ile Ara</label>
                <input class="form-input" type="text" id="nc-search"
                       placeholder="Kullanıcı adını yazın..." autocomplete="off">
            </div>
            <div id="nc-results"></div>
            <input type="hidden" id="nc-selected-id">`,
        confirmLabel: 'Başlat',
        size: 'sm',
        onConfirm: async () => {
            const targetId = document.getElementById('nc-selected-id').value;
            if (!targetId) {
                Toast.warning('Lütfen bir kullanıcı seçin');
                throw new Error('validation');
            }
            await startConversation(targetId);
            Modal.close();
        }
    });

    // Kullanıcı arama — admin endpoint; kendi adımızı hariç tut
    const searchEl = document.getElementById('nc-search');
    searchEl.addEventListener('input', Utils.debounce(async e => {
        const q = e.target.value.trim();
        if (q.length < 2) {
            document.getElementById('nc-results').innerHTML = '';
            return;
        }
        try {
            // GET /api/v1/admin/users?search=q (admin değilse /api/v1/users/search olabilir)
            // Projedeki admin endpoint'ini dene; hata gelirse kullanıcıya bildir
            const raw = await Api.get('/admin/users', { search: q, size: 10 });
            let items = [];
            if (raw?.content) items = raw.content;
            else if (Array.isArray(raw)) items = raw;

            // Kendimizi listeden çıkar
            items = items.filter(u => u.username !== me?.username);

            renderUserResults(items);
        } catch {
            document.getElementById('nc-results').innerHTML =
                `<div style="font-size:.78rem;color:var(--clr-text-muted);padding:.5rem;">
                    Kullanıcı araması için Admin yetkisi gerekebilir
                </div>`;
        }
    }, 350));

    setTimeout(() => searchEl.focus(), 80);
}

function renderUserResults(items) {
    const container = document.getElementById('nc-results');
    if (!items.length) {
        container.innerHTML = `<div style="font-size:.78rem;color:var(--clr-text-muted);padding:.5rem;">
            Kullanıcı bulunamadı</div>`;
        return;
    }

    container.innerHTML = `<div class="user-search-results">${items.map(u => `
        <div class="user-result-item" data-uid="${Utils.escHtml(u.publicId)}">
            <div class="user-result-avatar">${avatarInitials(u.displayName || u.username)}</div>
            <div>
                <div class="user-result-name">${Utils.escHtml(u.displayName || u.username)}</div>
                <div style="font-size:.72rem;color:var(--clr-text-muted);">@${Utils.escHtml(u.username)}</div>
            </div>
        </div>`).join('')}</div>`;

    container.querySelectorAll('.user-result-item').forEach(item => {
        item.addEventListener('click', () => {
            // Seçim vurgula
            container.querySelectorAll('.user-result-item').forEach(i =>
                i.style.background = '');
            item.style.background = 'rgba(61,122,237,.12)';
            document.getElementById('nc-selected-id').value = item.dataset.uid;
        });
    });
}

async function startConversation(targetUserPublicId) {
    try {
        const raw = await Api.post('/chat/conversations',
            { targetUserPublicId });
        const conv = raw?.publicId ? raw : (raw?.data ?? raw);

        // Listeyi yenile ve aç
        await loadConversations();
        openConversation(conv.publicId);
    } catch (err) {
        Toast.error('Konuşma başlatılamadı: ' + err.message);
    }
}

// ── WEBSOCKET ───────────────────────────────────────────────
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
                wsConnected = true;

                // Kendi kuyruğunu dinle
                stompClient.subscribe('/user/queue/chat', msg => {
                    try {
                        const incomingMsg = JSON.parse(msg.body);
                        handleIncomingMessage(incomingMsg);
                    } catch {}
                });
            },
            err => {
                wsConnected = false;
                setTimeout(connectWebSocket, 10_000);
            }
        );
    } catch {}
}

function handleIncomingMessage(msg) {
    // Konuşma listesini güncelle
    loadConversations();

    // Açık konuşmaya ait mesaj ise ekle
    if (activeConvId && msg.conversationPublicId === activeConvId) {
        appendMessage(msg);
        // Okundu işareti
        if (msg.publicId) {
            Api.post(`/chat/messages/${msg.publicId}/read`, {}).catch(() => {});
        }
    } else {
        // Başka konuşmadan geldi — toast
        Toast.info(`Yeni mesaj: ${msg.senderUsername}`);
    }
}

// ── UI HELPERS ─────────────────────────────────────────────
function showEmpty() {
    document.getElementById('msg-empty').style.display = '';
    const active = document.getElementById('msg-active');
    active.style.display = 'none';
    activeConvId = null;
    renderConvList();
}

function showActive() {
    document.getElementById('msg-empty').style.display = 'none';
    const active = document.getElementById('msg-active');
    active.style.display = 'flex';
}

function avatarInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

// Sabit renk — kullanıcı adından hash
function avatarColor(username) {
    const colors = [
        '#3d7aed', '#2eb87e', '#e09040', '#e05260',
        '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981',
    ];
    let hash = 0;
    for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    const bg = colors[hash % colors.length];
    return `background:${bg};color:#fff;`;
}

function relativeTime(isoStr) {
    if (!isoStr) return '';
    const diff = Date.now() - new Date(isoStr).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)  return 'şimdi';
    if (min < 60) return `${min}dk`;
    const h = Math.floor(min / 60);
    if (h < 24)   return `${h}sa`;
    return new Date(isoStr).toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit' });
}

function formatDateSep(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Bugün';
    if (d.toDateString() === yesterday.toDateString()) return 'Dün';
    return d.toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric' });
}

// Sayfa kapanırken WS bağlantısını kapat
window.addEventListener('beforeunload', () => {
    if (stompClient?.connected) stompClient.disconnect();
});