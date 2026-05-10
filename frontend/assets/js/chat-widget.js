// ╔══════════════════════════════════════════════════════════╗
// ║  Chat Widget — Sağ alt köşe FAB + açılır mesajlaşma      ║
// ╚══════════════════════════════════════════════════════════╝

(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────
    var isOpen        = false;
    var conversations = [];
    var activeConvId  = null;
    var stompClient   = null;
    var wsConnected   = false;
    var me            = null;
    var msgPage       = 0;
    var msgHasMore    = true;
    var msgLoading    = false;
    var unreadTotal   = 0;
    var view          = 'list'; // 'list' | 'chat'
    var initialized   = false;

    // Backend adresi (api.js ile uyumlu olmalı)
    var WS_BASE_URL   = 'http://localhost:8080/ws';

    // ── CSS ────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('cw-styles')) return;
        var s = document.createElement('style');
        s.id = 'cw-styles';
        s.textContent = [
            /* FAB */
            '#cw-fab{position:fixed;bottom:1.5rem;right:1.5rem;width:52px;height:52px;border-radius:50%;background:var(--clr-primary,#9e86e8);border:none;cursor:pointer;z-index:9998;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(158,134,232,.5);color:#fff;transition:transform .2s,box-shadow .2s;}',
            '#cw-fab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(158,134,232,.65);}',
            '#cw-fab:active{transform:scale(.95);}',
            /* Badge */
            '#cw-badge{position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:#fff;font-size:.6rem;font-weight:800;min-width:18px;height:18px;border-radius:99px;padding:0 4px;display:flex;align-items:center;justify-content:center;border:2px solid var(--clr-bg,#121214);}',
            '#cw-badge.cw-hidden{display:none;}',
            /* Panel */
            '#cw-panel{position:fixed;bottom:5.5rem;right:1.5rem;width:360px;height:520px;background:var(--clr-surface,rgba(18,18,20,.97));border:1px solid var(--clr-border,rgba(255,255,255,.12));border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.7);display:flex;flex-direction:column;overflow:hidden;z-index:9997;transform:scale(.9) translateY(16px);opacity:0;pointer-events:none;transition:transform .22s cubic-bezier(.16,1,.3,1),opacity .2s ease;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);}',
            '#cw-panel.cw-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
            /* Header */
            '.cw-hd{display:flex;align-items:center;gap:.5rem;padding:.8rem 1rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.1));flex-shrink:0;}',
            '.cw-hd-title{flex:1;font-size:.88rem;font-weight:700;color:var(--clr-text,#f3f4f6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.cw-hd-btn{background:transparent;border:none;cursor:pointer;color:var(--clr-text-muted,#9ca3af);padding:.25rem;border-radius:6px;display:flex;align-items:center;transition:background .15s,color .15s;}',
            '.cw-hd-btn:hover{background:var(--clr-surface-2,rgba(255,255,255,.06));color:var(--clr-text,#f3f4f6);}',
            /* List view */
            '#cw-list-view{flex:1;display:flex;flex-direction:column;overflow:hidden;}',
            '.cw-srch-wrap{padding:.55rem .875rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.1));flex-shrink:0;}',
            '.cw-srch{width:100%;background:var(--clr-surface-2,rgba(255,255,255,.05));border:1px solid var(--clr-border,rgba(255,255,255,.1));border-radius:8px;color:var(--clr-text,#f3f4f6);font-family:inherit;font-size:.82rem;padding:.38rem .65rem;outline:none;transition:border-color .15s;box-sizing:border-box;}',
            '.cw-srch:focus{border-color:var(--clr-primary,#9e86e8);}',
            '#cw-conv-list{flex:1;overflow-y:auto;}',
            '#cw-conv-list::-webkit-scrollbar{width:3px;}',
            '#cw-conv-list::-webkit-scrollbar-thumb{background:var(--clr-border);border-radius:2px;}',
            '.cw-conv{display:flex;align-items:center;gap:.6rem;padding:.7rem .875rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.07));cursor:pointer;transition:background .12s;}',
            '.cw-conv:hover{background:var(--clr-surface-2,rgba(255,255,255,.05));}',
            '.cw-conv.cw-active{background:rgba(158,134,232,.09);}',
            '.cw-av{width:2rem;height:2rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;color:#fff;}',
            '.cw-ci{flex:1;min-width:0;}',
            '.cw-cn{font-size:.82rem;font-weight:600;color:var(--clr-text,#f3f4f6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.cw-cp{font-size:.72rem;color:var(--clr-text-muted,#9ca3af);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}',
            '.cw-ct{font-size:.64rem;color:var(--clr-text-muted,#9ca3af);flex-shrink:0;}',
            /* Chat view */
            '#cw-chat-view{flex:1;display:none;flex-direction:column;overflow:hidden;}',
            '#cw-chat-view.cw-active{display:flex;}',
            '#cw-msgs{flex:1;overflow-y:auto;padding:.75rem;display:flex;flex-direction:column;gap:.3rem;}',
            '#cw-msgs::-webkit-scrollbar{width:3px;}',
            '#cw-msgs::-webkit-scrollbar-thumb{background:var(--clr-border);border-radius:2px;}',
            '.cw-dsep{display:flex;align-items:center;gap:.5rem;font-size:.63rem;color:var(--clr-text-muted,#9ca3af);margin:.3rem 0;}',
            '.cw-dsep::before,.cw-dsep::after{content:"";flex:1;height:1px;background:var(--clr-border,rgba(255,255,255,.1));}',
            '.cw-mr{display:flex;flex-direction:column;max-width:78%;animation:cwIn .15s ease;}',
            '@keyframes cwIn{from{opacity:0;transform:translateY(4px)}}',
            '.cw-mr.cw-mine{align-self:flex-end;align-items:flex-end;}',
            '.cw-mr.cw-theirs{align-self:flex-start;align-items:flex-start;}',
            '.cw-bbl{padding:.42rem .72rem;border-radius:12px;font-size:.82rem;line-height:1.5;word-break:break-word;white-space:pre-wrap;}',
            '.cw-mr.cw-mine .cw-bbl{background:var(--clr-primary,#9e86e8);color:#fff;border-bottom-right-radius:3px;}',
            '.cw-mr.cw-theirs .cw-bbl{background:var(--clr-surface-2,rgba(255,255,255,.07));color:var(--clr-text,#f3f4f6);border:1px solid var(--clr-border,rgba(255,255,255,.1));border-bottom-left-radius:3px;}',
            '.cw-bbl.cw-del{background:transparent!important;border:1px dashed var(--clr-border)!important;color:var(--clr-text-muted)!important;font-style:italic;font-size:.74rem;}',
            '.cw-ts{font-size:.6rem;color:var(--clr-text-muted,#9ca3af);margin-top:2px;padding:0 .12rem;}',
            '.cw-mr:hover .cw-delbtn{opacity:1;}',
            '.cw-delbtn{opacity:0;background:none;border:none;cursor:pointer;color:var(--clr-text-muted);font-size:.64rem;padding:.08rem .28rem;margin-bottom:.12rem;transition:opacity .15s,color .15s;}',
            '.cw-delbtn:hover{color:#ff4d4d;}',
            /* Input */
            '.cw-inp-area{padding:.55rem .7rem;border-top:1px solid var(--clr-border,rgba(255,255,255,.1));flex-shrink:0;}',
            '.cw-inp-row{display:flex;align-items:flex-end;gap:.4rem;background:var(--clr-surface-2,rgba(255,255,255,.05));border:1px solid var(--clr-border,rgba(255,255,255,.1));border-radius:10px;padding:.38rem .38rem .38rem .65rem;transition:border-color .15s;}',
            '.cw-inp-row:focus-within{border-color:var(--clr-primary,#9e86e8);}',
            '.cw-ta{flex:1;background:transparent;border:none;color:var(--clr-text,#f3f4f6);font-family:inherit;font-size:.84rem;resize:none;outline:none;min-height:1.25rem;max-height:5rem;line-height:1.45;}',
            '.cw-ta::placeholder{color:var(--clr-text-muted,#9ca3af);opacity:.7;}',
            '.cw-sbtn{background:var(--clr-primary,#9e86e8);color:#fff;border:none;border-radius:7px;width:1.9rem;height:1.9rem;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:.78rem;transition:background .15s,transform 80ms;}',
            '.cw-sbtn:hover{background:#b4a0ed;}',
            '.cw-sbtn:active{transform:scale(.93);}',
            '.cw-sbtn:disabled{opacity:.35;cursor:not-allowed;transform:none;}',
            '.cw-hint{font-size:.6rem;color:var(--clr-text-muted,#9ca3af);margin-top:.28rem;}',
            /* Loading / empty */
            '.cw-loading{display:flex;align-items:center;justify-content:center;padding:2rem;color:var(--clr-text-muted,#9ca3af);font-size:.8rem;gap:.5rem;}',
            '.cw-spin{width:.8rem;height:.8rem;border:2px solid rgba(158,134,232,.3);border-top-color:#9e86e8;border-radius:50%;animation:cwSpin .65s linear infinite;display:inline-block;}',
            '@keyframes cwSpin{to{transform:rotate(360deg)}}',
            '.cw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:.5rem;color:var(--clr-text-muted,#9ca3af);padding:1.5rem;text-align:center;}',
            '.cw-empty-ico{font-size:2rem;opacity:.18;}',
            '.cw-empty-txt{font-size:.8rem;}',
            /* WS dot */
            '.cw-wsdot{width:6px;height:6px;border-radius:50%;background:var(--clr-text-muted,#9ca3af);flex-shrink:0;transition:background .3s;}',
            '.cw-wsdot.cw-conn{background:#4ade80;animation:cwPulse 2s ease infinite;}',
            '@keyframes cwPulse{0%,100%{opacity:1}50%{opacity:.35}}',
            /* User results in modal */
            '.cw-ures{max-height:140px;overflow-y:auto;border:1px solid var(--clr-border);border-radius:8px;margin-top:.4rem;background:var(--clr-surface);}',
            '.cw-urow{display:flex;align-items:center;gap:.5rem;padding:.48rem .7rem;cursor:pointer;font-size:.8rem;border-bottom:1px solid var(--clr-border);transition:background .12s;}',
            '.cw-urow:last-child{border-bottom:none;}',
            '.cw-urow:hover{background:var(--clr-surface-2);}',
            /* Mobile */
            '@media(max-width:480px){#cw-panel{width:calc(100vw - 2rem);right:1rem;bottom:4.5rem;height:72vh;}#cw-fab{bottom:1rem;right:1rem;}}',
        ].join('');
        document.head.appendChild(s);
    }

    // ── DOM ────────────────────────────────────────────────
    function buildDOM() {
        var fab = document.createElement('button');
        fab.id = 'cw-fab';
        fab.setAttribute('aria-label', 'Mesajlar');
        fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span id="cw-badge" class="cw-hidden">0</span>';
        fab.addEventListener('click', toggle);

        var panel = document.createElement('div');
        panel.id = 'cw-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Mesajlar');
        panel.innerHTML = [
            '<div class="cw-hd">',
            '  <button class="cw-hd-btn" id="cw-back" style="display:none" aria-label="Geri">',
            '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>',
            '  </button>',
            '  <span class="cw-hd-title" id="cw-title">Mesajlar</span>',
            '  <span class="cw-wsdot" id="cw-wsdot" title="WebSocket durumu"></span>',
            '  <button class="cw-hd-btn" id="cw-newbtn" aria-label="Yeni konuşma">',
            '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            '  </button>',
            '  <button class="cw-hd-btn" id="cw-closebtn" aria-label="Kapat">',
            '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            '  </button>',
            '</div>',
            '<div id="cw-list-view">',
            '  <div class="cw-srch-wrap"><input class="cw-srch" id="cw-srch" type="text" placeholder="Konuşma ara..."></div>',
            '  <div id="cw-conv-list"><div class="cw-loading"><span class="cw-spin"></span>Yükleniyor...</div></div>',
            '</div>',
            '<div id="cw-chat-view">',
            '  <div id="cw-msgs"></div>',
            '  <div class="cw-inp-area">',
            '    <div class="cw-inp-row">',
            '      <textarea class="cw-ta" id="cw-ta" placeholder="Mesaj yaz..." rows="1"></textarea>',
            '      <button class="cw-sbtn" id="cw-sbtn" disabled>&#9658;</button>',
            '    </div>',
            '    <div class="cw-hint">Enter gönder &nbsp;·&nbsp; Shift+Enter yeni satır</div>',
            '  </div>',
            '</div>',
        ].join('');

        document.body.appendChild(fab);
        document.body.appendChild(panel);
        bindEvents();
    }

    function bindEvents() {
        document.getElementById('cw-closebtn').addEventListener('click', close);
        document.getElementById('cw-back').addEventListener('click', showList);
        document.getElementById('cw-newbtn').addEventListener('click', openNewModal);
        document.getElementById('cw-srch').addEventListener('input', debounce(function(e) {
            renderConvList(e.target.value.toLowerCase().trim());
        }, 250));

        var ta   = document.getElementById('cw-ta');
        var sbtn = document.getElementById('cw-sbtn');
        ta.addEventListener('input', function() {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
            sbtn.disabled = !ta.value.trim();
        });
        ta.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sbtn.disabled) sendMessage(); }
        });
        sbtn.addEventListener('click', sendMessage);

        document.getElementById('cw-msgs').addEventListener('scroll', function(e) {
            if (e.target.scrollTop < 60 && msgHasMore && !msgLoading && activeConvId) loadMessages(false);
        });
    }

    // ── Toggle / Open / Close ──────────────────────────────
    function toggle() { isOpen ? close() : open(); }

    function open() {
        isOpen = true;
        document.getElementById('cw-panel').classList.add('cw-open');

        // Sadece oturum varsa verileri çek ve WebSocket'e bağlan
        if (window.Store && window.Api && Store.getAccessToken()) {
            if (!me) me = (window.Auth && Auth.getCurrentUser) ? Auth.getCurrentUser() : Store.getUser();

            if (!conversations.length) loadConversations();
            connectWS();
        } else {
            document.getElementById('cw-conv-list').innerHTML = '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span><span class="cw-empty-txt">Oturum açmadınız veya sistem bağlantısı yok.</span></div>';
        }
    }

    function close() {
        isOpen = false;
        document.getElementById('cw-panel').classList.remove('cw-open');
    }

    // ── Görünüm ────────────────────────────────────────────
    function showList() {
        view         = 'list';
        activeConvId = null;
        document.getElementById('cw-list-view').style.display  = 'flex';
        document.getElementById('cw-chat-view').classList.remove('cw-active');
        document.getElementById('cw-title').textContent = 'Mesajlar';
        document.getElementById('cw-back').style.display   = 'none';
        document.getElementById('cw-newbtn').style.display  = 'flex';
        renderConvList('');
    }

    function showChat(conv) {
        view = 'chat';
        // DTO Töleransı
        var other = conv.participant || conv.otherUser || conv.targetUser || {};
        var displayName = other.displayName || other.firstName || other.username || 'Konuşma';

        document.getElementById('cw-list-view').style.display  = 'none';
        document.getElementById('cw-chat-view').classList.add('cw-active');
        document.getElementById('cw-title').textContent = displayName;
        document.getElementById('cw-back').style.display   = 'flex';
        document.getElementById('cw-newbtn').style.display  = 'none';
    }

    // ── Konuşmalar ─────────────────────────────────────────
    function loadConversations() {
        if(!window.Api) return;
        Api.get('/chat/conversations', { size: 50, sort: 'lastMessageAt,desc' }).then(function(raw) {
            conversations = raw && raw.content ? raw.content : (Array.isArray(raw) ? raw : []);
            renderConvList('');
        }).catch(function(err) {
            document.getElementById('cw-conv-list').innerHTML = '<div class="cw-empty"><span>Yüklenemedi:<br><small>' + esc(err.message || '') + '</small></span></div>';
        });
    }

    function renderConvList(filter) {
        var list = filter ? conversations.filter(function(c) {
            var other = c.participant || c.otherUser || c.targetUser || {};
            var name = ((other.username || other.displayName)) || ''.toLowerCase();
            return name.indexOf(filter) !== -1 || ((c.lastMessagePreview || '').toLowerCase().indexOf(filter) !== -1);
        }) : conversations;

        var container = document.getElementById('cw-conv-list');
        if (!list.length) {
            container.innerHTML = '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span><span class="cw-empty-txt">' + (filter ? 'Sonuç bulunamadı' : 'Henüz konuşma yok') + '</span></div>';
            return;
        }

        container.innerHTML = list.map(function(c) {
            var other   = c.participant || c.otherUser || c.targetUser || {};
            var display = other.displayName || other.firstName || other.username || '—';
            var uname   = other.username || 'unknown';
            var ini     = initials(display);
            var col     = avatarColor(uname);
            var time    = c.lastMessageAt ? relTime(c.lastMessageAt) : '';
            var cid     = c.publicId || c.id;
            var active  = cid === activeConvId ? ' cw-active' : '';
            return '<div class="cw-conv' + active + '" data-id="' + esc(cid) + '">' +
                '<div class="cw-av" style="' + col + '">' + ini + '</div>' +
                '<div class="cw-ci">' +
                '<div class="cw-cn">' + esc(display) + '</div>' +
                '<div class="cw-cp">' + esc(c.lastMessagePreview || '...') + '</div>' +
                '</div><span class="cw-ct">' + time + '</span></div>';
        }).join('');

        container.querySelectorAll('.cw-conv[data-id]').forEach(function(el) {
            el.addEventListener('click', function() { openConv(el.dataset.id); });
        });
    }

    // ── Konuşma Aç ─────────────────────────────────────────
    function openConv(publicId) {
        activeConvId = publicId;
        msgPage      = 0;
        msgHasMore   = true;
        var conv = conversations.find(function(c) { return (c.publicId || c.id) === publicId; });
        if (!conv) return;
        showChat(conv);
        renderConvList('');
        document.getElementById('cw-msgs').innerHTML = '<div class="cw-loading"><span class="cw-spin"></span>Yükleniyor...</div>';
        loadMessages(true);
    }

    // ── Mesajlar ───────────────────────────────────────────
    function loadMessages(scrollBottom) {
        if (msgLoading || !activeConvId || !window.Api) return;
        msgLoading = true;

        // Paginaton Toleransı: desc ile çekip arayüzde alt alta doğru basmak için reverse yapıyoruz
        Api.get('/chat/conversations/' + activeConvId + '/messages', { page: msgPage, size: 25, sort: 'sentAt,desc' }).then(function(raw) {
            var items    = raw && raw.content ? raw.content : (Array.isArray(raw) ? raw : []);
            var pages    = raw && raw.totalPages ? raw.totalPages : 1;
            msgHasMore   = msgPage + 1 < pages;

            // Sıralamayı eski -> yeni olarak çevir
            items.reverse();

            renderMsgs(items, scrollBottom);
            msgPage++;
        }).catch(function(err) {
            document.getElementById('cw-msgs').innerHTML = '<div class="cw-empty"><span>Mesajlar yüklenemedi:<br><small>' + esc(err.message || '') + '</small></span></div>';
        }).finally(function() { msgLoading = false; });
    }

    function renderMsgs(items, scrollBottom) {
        var list    = document.getElementById('cw-msgs');
        var isFirst = msgPage === 0;

        if (items.length === 0 && isFirst) {
            list.innerHTML = '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span><span class="cw-empty-txt">Henüz mesaj yok</span></div>';
            return;
        }
        var prevH = list.scrollHeight;
        if (isFirst) list.innerHTML = '';

        var lastDate = null;
        var frag = document.createDocumentFragment();
        items.forEach(function(msg) {
            var d = dateSep(msg.sentAt);
            if (d !== lastDate) {
                var sep = document.createElement('div');
                sep.className = 'cw-dsep';
                sep.textContent = d;
                frag.appendChild(sep);
                lastDate = d;
            }
            frag.appendChild(buildMsg(msg));
        });

        if (isFirst) { list.appendChild(frag); }
        else { list.insertBefore(frag, list.firstChild); list.scrollTop = list.scrollHeight - prevH; }
        if (scrollBottom) list.scrollTop = list.scrollHeight;
    }

    function buildMsg(msg) {
        var senderUname = msg.senderUsername || (msg.sender && msg.sender.username) || '';
        var isMine  = me && senderUname === me.username;
        var deleted = msg.deleted;
        var mid     = msg.publicId || msg.id;

        var row     = document.createElement('div');
        row.className = 'cw-mr ' + (isMine ? 'cw-mine' : 'cw-theirs');
        row.dataset.id = mid;

        var t   = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
        var txt = deleted ? '&#128683; Bu mesaj silindi' : esc(msg.content);
        var del = isMine && !deleted ? '<button class="cw-delbtn" title="Sil">&#10005;</button>' : '';

        row.innerHTML = del + '<div class="cw-bbl' + (deleted ? ' cw-del' : '') + '">' + txt + '</div><span class="cw-ts">' + t + (isMine && msg.readAt ? ' &#10003;&#10003;' : '') + '</span>';

        var db = row.querySelector('.cw-delbtn');
        if (db) db.addEventListener('click', function(e) { e.stopPropagation(); deleteMsg(mid, row); });
        return row;
    }

    // ── Gönder ────────────────────────────────────────────
    function sendMessage() {
        var ta      = document.getElementById('cw-ta');
        var sbtn    = document.getElementById('cw-sbtn');
        var content = ta.value.trim();
        if (!content || !activeConvId || !window.Api) return;

        sbtn.disabled = true;
        ta.value = '';
        ta.style.height = 'auto';

        var tempId  = 'temp_' + Date.now();
        var tempMsg = { publicId: tempId, senderUsername: me && me.username, content: content, deleted: false, sentAt: new Date().toISOString(), readAt: null };
        appendMsg(tempMsg);

        Api.post('/chat/conversations/' + activeConvId + '/messages', { content: content }).then(function(saved) {
            var real = saved && (saved.publicId || saved.id) ? saved : (saved && saved.data ? saved.data : saved);
            var el   = document.querySelector('[data-id="' + tempId + '"]');
            if (el) el.replaceWith(buildMsg(real));
            loadConversations();
        }).catch(function(err) {
            var el = document.querySelector('[data-id="' + tempId + '"]');
            if (el) el.remove();
            if (window.Toast) Toast.error('Gönderilemedi: ' + (err.message || ''));
            ta.value = content;
            sbtn.disabled = false;
        });
    }

    function appendMsg(msg) {
        var list = document.getElementById('cw-msgs');
        var empty = list.querySelector('.cw-empty');
        if (empty) list.innerHTML = '';
        list.appendChild(buildMsg(msg));
        list.scrollTop = list.scrollHeight;
    }

    // ── Sil ───────────────────────────────────────────────
    function deleteMsg(publicId, rowEl) {
        if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
        if(!window.Api) return;
        Api.del('/chat/messages/' + publicId).then(function() {
            var b = rowEl.querySelector('.cw-bbl');
            if (b) { b.innerHTML = '&#128683; Bu mesaj silindi'; b.classList.add('cw-del'); }
            var d = rowEl.querySelector('.cw-delbtn');
            if (d) d.remove();
        }).catch(function(err) {
            if (window.Toast) Toast.error('Silinemedi: ' + (err.message || ''));
        });
    }

    // ── Yeni Konuşma ──────────────────────────────────────
    function openNewModal() {
        if (!window.Modal) { if (window.Toast) Toast.info('Modal bileşeni yüklü değil'); return; }
        if (!window.Api) { if (window.Toast) Toast.warning('API bağlantısı yok'); return; }

        Modal.open({
            title: 'Yeni Konuşma',
            contentHTML: '<div class="form-group" style="margin-bottom:.75rem;"><label class="form-label">Kullanıcı Adı ile Ara</label><input class="form-input" type="text" id="cwm-s" placeholder="Kullanıcı adı..." autocomplete="off"></div><div id="cwm-r"></div><input type="hidden" id="cwm-id">',
            confirmLabel: 'Başlat',
            size: 'sm',
            onConfirm: function() {
                var tid = document.getElementById('cwm-id').value;
                if (!tid) { if (window.Toast) Toast.warning('Kullanıcı seçin'); throw new Error('v'); }
                startConv(tid);
                Modal.close();
            }
        });
        var si = document.getElementById('cwm-s');
        if (si) {
            si.addEventListener('input', debounce(function(e) {
                var q = e.target.value.trim();
                if (q.length < 2) { document.getElementById('cwm-r').innerHTML = ''; return; }

                Api.get('/admin/users', { search: q, size: 10 }).then(function(raw) {
                    var items = (raw && raw.content ? raw.content : (Array.isArray(raw) ? raw : [])).filter(function(u) { return !me || u.username !== me.username; });
                    var r = document.getElementById('cwm-r');
                    if (!items.length) { r.innerHTML = '<div style="font-size:.78rem;color:var(--clr-text-muted);padding:.5rem;">Bulunamadı</div>'; return; }
                    r.innerHTML = '<div class="cw-ures">' + items.map(function(u) {
                        var uid = u.publicId || u.id;
                        var display = u.displayName || u.firstName || u.username;
                        return '<div class="cw-urow" data-uid="' + esc(uid) + '"><div class="cw-av" style="' + avatarColor(u.username) + ';width:1.5rem;height:1.5rem;font-size:.62rem;">' + initials(display) + '</div><div><div style="font-weight:600;font-size:.82rem;">' + esc(display) + '</div><div style="font-size:.7rem;color:var(--clr-text-muted);">@' + esc(u.username) + '</div></div></div>';
                    }).join('') + '</div>';
                    r.querySelectorAll('.cw-urow').forEach(function(row) {
                        row.addEventListener('click', function() {
                            r.querySelectorAll('.cw-urow').forEach(function(x) { x.style.background = ''; });
                            row.style.background = 'rgba(158,134,232,.12)';
                            document.getElementById('cwm-id').value = row.dataset.uid;
                        });
                    });
                }).catch(function(err) {
                    document.getElementById('cwm-r').innerHTML = '<div style="font-size:.78rem;color:#ff4d4d;padding:.5rem;">Arama hatası: ' + esc(err.message || 'Yetki yok') + '</div>';
                });
            }, 350));
            setTimeout(function() { si.focus(); }, 80);
        }
    }

    function startConv(targetId) {
        if(!window.Api) return;
        Api.post('/chat/conversations', { targetUserPublicId: targetId }).then(function(raw) {
            var conv = raw && (raw.publicId || raw.id) ? raw : (raw && raw.data ? raw.data : raw);
            loadConversations();
            if (!isOpen) open();
            openConv(conv.publicId || conv.id);
        }).catch(function(err) {
            if (window.Toast) Toast.error('Başlatılamadı: ' + (err.message || ''));
        });
    }

    // ── WebSocket ──────────────────────────────────────────
    function connectWS() {
        if (wsConnected) return;
        if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
            console.error("ChatWidget: SockJS veya Stomp.js yüklenmemiş!");
            return;
        }
        var token = Store.getAccessToken();
        if (!token) return;

        try {
            var socket = new SockJS(WS_BASE_URL);
            stompClient = Stomp.over(socket);
            stompClient.debug = null;

            stompClient.connect({ 'Authorization': 'Bearer ' + token }, function() {
                wsConnected = true;
                setWsDot(true);
                stompClient.subscribe('/user/queue/chat', function(msg) {
                    try { handleIncoming(JSON.parse(msg.body)); } catch (e) {}
                });
            }, function(error) {
                console.warn("WebSocket Bağlantı Hatası:", error);
                wsConnected = false;
                setWsDot(false);
                setTimeout(connectWS, 10000);
            });
        } catch (e) {
            console.error("WebSocket init hatası:", e);
        }
    }

    function handleIncoming(msg) {
        loadConversations();
        var mid = msg.publicId || msg.id;
        if (activeConvId && msg.conversationPublicId === activeConvId) {
            appendMsg(msg);
            if (mid && window.Api) Api.post('/chat/messages/' + mid + '/read', {}).catch(function() {});
        } else {
            updateBadge(unreadTotal + 1);
            if (window.Toast) Toast.info('Yeni mesaj: ' + msg.senderUsername);
        }
    }

    function setWsDot(ok) {
        var d = document.getElementById('cw-wsdot');
        if (d) { d.className = 'cw-wsdot' + (ok ? ' cw-conn' : ''); }
    }

    // ── Badge ──────────────────────────────────────────────
    function updateBadge(count) {
        unreadTotal = count;
        var b = document.getElementById('cw-badge');
        if (!b) return;
        if (count > 0) { b.textContent = count > 99 ? '99+' : count; b.classList.remove('cw-hidden'); }
        else { b.classList.add('cw-hidden'); }
    }

    // ── Yardımcılar ────────────────────────────────────────
    function initials(name) {
        if (!name) return '?';
        var p = name.trim().split(/\s+/);
        return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    }

    function avatarColor(username) {
        var colors = ['#3d7aed','#2eb87e','#e09040','#e05260','#8b5cf6','#06b6d4','#f59e0b','#10b981'];
        var hash = 0;
        for (var i = 0; i < (username || '').length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
        return 'background:' + colors[hash % colors.length] + ';color:#fff;';
    }

    function relTime(iso) {
        if (!iso) return '';
        var diff = Date.now() - new Date(iso).getTime();
        var min  = Math.floor(diff / 60000);
        if (min < 1)  return 'şimdi';
        if (min < 60) return min + 'dk';
        var h = Math.floor(min / 60);
        if (h < 24) return h + 'sa';
        return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    }

    function dateSep(iso) {
        if (!iso) return '';
        var d = new Date(iso), n = new Date(), y = new Date(n);
        y.setDate(y.getDate() - 1);
        if (d.toDateString() === n.toDateString()) return 'Bugün';
        if (d.toDateString() === y.toDateString()) return 'Dün';
        return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function debounce(fn, ms) {
        var t;
        return function() { var a = arguments; clearTimeout(t); t = setTimeout(function() { fn.apply(null, a); }, ms); };
    }

    // ── Init ──────────────────────────────────────────────
    function init() {
        if (initialized) return;
        initialized = true;

        // Tasarımın DOM'a eklenmesi
        injectStyles();
        buildDOM();

        // Eğer kullanıcı giriş yapmışsa arka plan API çağrılarını yap
        if (window.Store && window.Api && Store.getAccessToken()) {
            me = (window.Auth && Auth.getCurrentUser) ? Auth.getCurrentUser() : Store.getUser();

            Api.get('/chat/unread-count').then(function(r) {
                var count = r && r.unreadCount !== undefined ? r.unreadCount : (r && r.count !== undefined ? r.count : 0);
                updateBadge(count);
            }).catch(function() {});

            window.addEventListener('beforeunload', function() {
                if (stompClient && stompClient.connected) stompClient.disconnect();
            });
        }
    }

    // Global erişim
    window.ChatWidget = { init: init, toggle: toggle, open: open, close: close, updateBadge: updateBadge };

    // Otomatik başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());