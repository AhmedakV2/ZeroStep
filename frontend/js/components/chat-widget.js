/**
 * Chat Widget — Sağ alt köşe sabit mesajlaşma penceresi
 * Kaydet: frontend/js/components/chat-widget.js
 *
 * Bağımlılıklar: api.js, store.js, auth.js, utils.js
 * (Tüm bağımlılıklar zaten dashboard sayfalarında yüklü)
 */
(function ChatWidget() {
    'use strict';

    // ── State ────────────────────────────────────────────────
    let isOpen        = false;
    let activeConvId  = null;
    let conversations = [];
    let me            = null;
    let stompClient   = null;

    // ── DOM Oluşturma ────────────────────────────────────────
    function mount() {
        if (document.getElementById('chat-widget-fab')) return; // Zaten monte edilmiş

        // CSS'yi yükle (eğer link tag yoksa)
        if (!document.querySelector('link[href*="chat-widget.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            // Sayfa konumuna göre path çöz
            const depth = window.location.pathname.includes('/admin/') ? '../../../' :
                window.location.pathname.includes('/pages/')  ? '../../'    : '../';
            link.href = depth + 'assets/css/chat-widget.css';
            document.head.appendChild(link);
        }

        document.body.insertAdjacentHTML('beforeend', `
            <!-- Chat Widget FAB -->
            <button id="chat-widget-fab" aria-label="Mesajlar" title="Mesajlar">
                <svg class="cw-icon-open" width="22" height="22" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <svg class="cw-icon-close" width="20" height="20" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <span class="cw-badge" id="cw-fab-badge">0</span>
            </button>

            <!-- Chat Widget Panel -->
            <div id="chat-widget-panel" role="dialog" aria-label="Mesajlar">

                <!-- Header -->
                <div class="cw-header">
                    <div class="cw-header-icon">◈</div>
                    <div>
                        <div class="cw-header-title">Mesajlar</div>
                        <div class="cw-header-subtitle" id="cw-status-text">Yükleniyor...</div>
                    </div>
                    <div class="cw-header-actions">
                        <button class="cw-header-btn" id="cw-close-btn" title="Kapat" aria-label="Kapat">✕</button>
                    </div>
                </div>

                <!-- Body -->
                <div class="cw-body">

                    <!-- Konuşma Listesi -->
                    <div class="cw-conv-list" id="cw-conv-list">
                        <div class="cw-loading">
                            <span class="spinner" style="width:.8rem;height:.8rem;
                                border-color:var(--clr-border);
                                border-top-color:var(--clr-primary);"></span>
                            Yükleniyor...
                        </div>
                    </div>

                    <!-- Mesaj Paneli -->
                    <div class="cw-msg-panel" id="cw-msg-panel">
                        <div class="cw-msg-header">
                            <button class="cw-back-btn" id="cw-back-btn" title="Geri">←</button>
                            <span class="cw-msg-name" id="cw-msg-name">—</span>
                        </div>
                        <div class="cw-messages" id="cw-messages">
                            <div class="cw-loading">
                                <span class="spinner" style="width:.8rem;height:.8rem;
                                    border-color:var(--clr-border);
                                    border-top-color:var(--clr-primary);"></span>
                                Yükleniyor...
                            </div>
                        </div>
                        <div class="cw-input-area">
                            <textarea class="cw-textarea" id="cw-textarea"
                                      placeholder="Mesaj yaz..." rows="1"></textarea>
                            <button class="cw-send-btn" id="cw-send-btn"
                                    title="Gönder (Enter)" disabled>➤</button>
                        </div>
                    </div>

                </div>
            </div>
        `);

        bindEvents();
    }

    // ── Event Binding ────────────────────────────────────────
    function bindEvents() {
        // FAB toggle
        document.getElementById('chat-widget-fab').addEventListener('click', togglePanel);

        // Kapat butonu
        document.getElementById('cw-close-btn').addEventListener('click', closePanel);

        // Geri butonu
        document.getElementById('cw-back-btn').addEventListener('click', showConvList);

        // Textarea
        const textarea = document.getElementById('cw-textarea');
        const sendBtn  = document.getElementById('cw-send-btn');

        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
            sendBtn.disabled = !textarea.value.trim();
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled) sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);

        // Escape ile kapat
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) closePanel();
        });

        // Panel dışı tıklama — yalnızca FAB ve panel dışıysa kapat
        document.addEventListener('click', (e) => {
            if (!isOpen) return;
            const panel = document.getElementById('chat-widget-panel');
            const fab   = document.getElementById('chat-widget-fab');
            if (!panel.contains(e.target) && !fab.contains(e.target)) {
                closePanel();
            }
        });
    }

    // ── Panel Aç/Kapat ───────────────────────────────────────
    function togglePanel() {
        isOpen ? closePanel() : openPanel();
    }

    function openPanel() {
        isOpen = true;
        const fab   = document.getElementById('chat-widget-fab');
        const panel = document.getElementById('chat-widget-panel');
        fab.classList.add('is-open');
        panel.classList.add('is-open');
        loadConversations();
    }

    function closePanel() {
        isOpen = false;
        document.getElementById('chat-widget-fab').classList.remove('is-open');
        document.getElementById('chat-widget-panel').classList.remove('is-open');
    }

    // ── Konuşma Listesi ──────────────────────────────────────
    async function loadConversations() {
        const list = document.getElementById('cw-conv-list');

        try {
            const raw = await Api.get('/chat/conversations', { size: 30, sort: 'lastMessageAt,desc' });
            conversations = raw?.content || (Array.isArray(raw) ? raw : []);
            renderConvList();
            updateStatusText('Çevrimiçi');
        } catch {
            list.innerHTML = `<div class="cw-empty"><span class="cw-empty-icon">◈</span>Yüklenemedi</div>`;
        }
    }

    function renderConvList() {
        const list = document.getElementById('cw-conv-list');

        if (conversations.length === 0) {
            list.innerHTML = `
                <div class="cw-empty">
                    <span class="cw-empty-icon">◈</span>
                    <span>Henüz konuşma yok</span>
                </div>`;
            return;
        }

        const items = conversations.map(c => {
            const other = c.otherUser;
            const initials = avatarInitials(other?.displayName || other?.username || '?');
            const preview  = c.lastMessagePreview || '...';
            const time     = c.lastMessageAt ? relativeTime(c.lastMessageAt) : '';

            return `
                <div class="cw-conv-item" data-id="${Utils.escHtml(c.publicId)}">
                    <div class="cw-conv-avatar"
                         style="${avatarColor(other?.username || '')}">${initials}</div>
                    <div class="cw-conv-info">
                        <div class="cw-conv-name">${Utils.escHtml(other?.displayName || other?.username || '—')}</div>
                        <div class="cw-conv-preview">${Utils.escHtml(preview)}</div>
                    </div>
                    <span class="cw-conv-time">${time}</span>
                </div>`;
        }).join('');

        list.innerHTML = items;

        list.querySelectorAll('.cw-conv-item[data-id]').forEach(item => {
            item.addEventListener('click', () => openConversation(item.dataset.id));
        });
    }

    // ── Konuşma Aç ───────────────────────────────────────────
    async function openConversation(publicId) {
        activeConvId = publicId;
        const conv  = conversations.find(c => c.publicId === publicId);
        const other = conv?.otherUser;

        // İsimleri güncelle
        document.getElementById('cw-msg-name').textContent =
            other?.displayName || other?.username || '—';

        // Slide animasyonu
        document.getElementById('cw-conv-list').classList.add('slide-out');
        document.getElementById('cw-msg-panel').classList.add('is-active');

        // Mesajları yükle
        await loadMessages(publicId);
    }

    function showConvList() {
        activeConvId = null;
        document.getElementById('cw-conv-list').classList.remove('slide-out');
        document.getElementById('cw-msg-panel').classList.remove('is-active');
    }

    // ── Mesaj Yükleme ────────────────────────────────────────
    async function loadMessages(publicId) {
        const msgList = document.getElementById('cw-messages');
        msgList.innerHTML = `<div class="cw-loading">
            <span class="spinner" style="width:.8rem;height:.8rem;
                border-color:var(--clr-border);border-top-color:var(--clr-primary);"></span>
            Yükleniyor...
        </div>`;

        try {
            const raw = await Api.get(
                `/chat/conversations/${publicId}/messages`,
                { page: 0, size: 30, sort: 'sentAt,asc' }
            );
            const items = raw?.content || (Array.isArray(raw) ? raw : []);
            renderMessages(items);
        } catch {
            msgList.innerHTML = `<div class="cw-empty">
                <span class="cw-empty-icon">✕</span>Mesajlar yüklenemedi</div>`;
        }
    }

    function renderMessages(items) {
        const msgList = document.getElementById('cw-messages');
        const myUsername = me?.username || Store.getUser()?.username;

        if (items.length === 0) {
            msgList.innerHTML = `<div class="cw-empty">
                <span class="cw-empty-icon">◈</span>Henüz mesaj yok</div>`;
            return;
        }

        msgList.innerHTML = items.map(msg => {
            const isMine  = msg.senderUsername === myUsername;
            const deleted = msg.deleted;
            const content = deleted ? '🚫 Bu mesaj silindi' : Utils.escHtml(msg.content);
            const time    = msg.sentAt
                ? new Date(msg.sentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                : '';

            return `
                <div class="cw-msg-row ${isMine ? 'mine' : 'theirs'}">
                    <div class="cw-bubble${deleted ? ' deleted' : ''}">${content}</div>
                    <span class="cw-msg-time">${time}${isMine && msg.readAt ? ' ✓✓' : ''}</span>
                </div>`;
        }).join('');

        // Sona scroll
        msgList.scrollTop = msgList.scrollHeight;
    }

    function appendMessage(msg) {
        const msgList   = document.getElementById('cw-messages');
        const myUsername = me?.username || Store.getUser()?.username;

        // Boş durumu temizle
        if (msgList.querySelector('.cw-empty')) msgList.innerHTML = '';

        const isMine  = msg.senderUsername === myUsername;
        const content = msg.deleted ? '🚫 Bu mesaj silindi' : Utils.escHtml(msg.content);
        const time    = msg.sentAt
            ? new Date(msg.sentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            : '';

        const row = document.createElement('div');
        row.className = `cw-msg-row ${isMine ? 'mine' : 'theirs'}`;
        row.innerHTML = `
            <div class="cw-bubble">${content}</div>
            <span class="cw-msg-time">${time}</span>`;

        msgList.appendChild(row);
        msgList.scrollTop = msgList.scrollHeight;
    }

    // ── Mesaj Gönder ─────────────────────────────────────────
    async function sendMessage() {
        const textarea = document.getElementById('cw-textarea');
        const sendBtn  = document.getElementById('cw-send-btn');
        const content  = textarea.value.trim();
        if (!content || !activeConvId) return;

        sendBtn.disabled = true;
        textarea.value   = '';
        textarea.style.height = 'auto';

        // Optimistic
        appendMessage({
            senderUsername: me?.username || Store.getUser()?.username,
            content,
            sentAt: new Date().toISOString(),
        });

        try {
            await Api.post(`/chat/conversations/${activeConvId}/messages`, { content });
            // Konuşma listesini güncelle
            await loadConversations();
        } catch {
            if (window.Toast) Toast.error('Mesaj gönderilemedi');
        } finally {
            sendBtn.disabled = false;
        }
    }

    // ── WebSocket ────────────────────────────────────────────
    function connectWS() {
        const token = Store.getAccessToken();
        if (!token || typeof SockJS === 'undefined' || typeof Stomp === 'undefined') return;

        try {
            const socket = new SockJS('http://localhost:8080/ws');
            stompClient  = Stomp.over(socket);
            stompClient.debug = null;

            stompClient.connect({ Authorization: `Bearer ${token}` }, () => {
                stompClient.subscribe('/user/queue/chat', msg => {
                    try {
                        const incoming = JSON.parse(msg.body);
                        handleIncoming(incoming);
                    } catch {}
                });
            }, () => setTimeout(connectWS, 15_000));
        } catch {}
    }

    function handleIncoming(msg) {
        // Badge güncelle
        updateUnreadBadge(1);

        // Aktif konuşmaya ait mesajsa anında göster
        if (isOpen && activeConvId && msg.conversationPublicId === activeConvId) {
            appendMessage(msg);
            Api.post(`/chat/messages/${msg.publicId}/read`, {}).catch(() => {});
        } else {
            // Konuşma listesini güncelle
            if (isOpen) loadConversations();
            if (window.Toast) Toast.info(`◈ Yeni mesaj: ${msg.senderUsername}`);
        }
    }

    // ── Badge Yönetimi ───────────────────────────────────────
    function updateUnreadBadge(delta) {
        const badge = document.getElementById('cw-fab-badge');
        if (!badge) return;
        const current = parseInt(badge.textContent) || 0;
        const next = Math.max(0, current + delta);
        badge.textContent = next > 99 ? '99+' : next;
        badge.classList.toggle('visible', next > 0);
    }

    function setUnreadBadge(count) {
        const badge = document.getElementById('cw-fab-badge');
        if (!badge) return;
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.toggle('visible', count > 0);
    }

    async function loadUnreadCount() {
        try {
            const data = await Api.get('/chat/unread-count');
            setUnreadBadge(data?.count ?? 0);
        } catch {}
    }

    function updateStatusText(text) {
        const el = document.getElementById('cw-status-text');
        if (el) el.textContent = text;
    }

    // ── Yardımcılar ──────────────────────────────────────────
    function avatarInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    }

    function avatarColor(username) {
        const colors = ['#7c65d4','#2eb87e','#e09040','#e05260','#06b6d4','#f59e0b'];
        let hash = 0;
        for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
        return `background:${colors[hash % colors.length]};color:#fff;`;
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

    // ── Init ─────────────────────────────────────────────────
    function init() {
        // Auth modülü henüz yüklenmediyse bekle
        if (typeof Auth === 'undefined') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        if (!Auth.isLoggedIn()) return;

        me = Auth.getCurrentUser();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                mount();
                loadUnreadCount();
                connectWS();
            });
        } else {
            mount();
            loadUnreadCount();
            connectWS();
        }

        window.addEventListener('beforeunload', () => {
            if (stompClient?.connected) stompClient.disconnect();
        });
    }

    // Global erişim (diğer modüllerden badge güncellemesi için)
    window.ChatWidget = { setUnreadBadge, updateUnreadBadge };

    init();
})();