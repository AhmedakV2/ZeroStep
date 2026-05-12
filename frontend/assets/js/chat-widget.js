// ╔══════════════════════════════════════════════════════════╗
// ║  Chat Widget — FAB + mesajlaşma paneli                   ║
// ╚══════════════════════════════════════════════════════════╝

(function () {
    'use strict';

    // ── Sabitler ───────────────────────────────────────────
    var WS_URL = 'http://localhost:8080/ws';

    // ── State ──────────────────────────────────────────────
    var isOpen         = false;
    var conversations  = [];
    var activeConvId   = null;
    var stompClient    = null;
    var wsConnected    = false;
    var me             = null;
    var msgPage        = 0;
    var msgHasMore     = true;
    var msgLoading     = false;
    var unreadTotal    = 0;
    var initialized    = false;
    var selectedUserId = null;

    // ── GİZLENEN SOHBETLERİ LOCALSTORAGE'DAN YÜKLE ──────────────────────
    // NOT: localStorage artifact/private browsing ortamlarında desteklenmez.
    // UZUN VADE: Backend API'ye taşınacak:
    //   POST   /api/v1/chat/conversations/{id}/hide
    //   DELETE /api/v1/chat/conversations/{id}/hide
    //   GET    /api/v1/chat/conversations?hidden=false (varsayılan)
    var hiddenConversations = [];
    try {
        var storedHidden = localStorage.getItem('cw_hidden_convs');
        if (storedHidden) {
            hiddenConversations = JSON.parse(storedHidden);
        }
    } catch (e) {
        // localStorage kullanılamaz (artifact, private mode vb.)
        console.warn('[ChatWidget] localStorage kullanılamadı:', e.message);
        hiddenConversations = [];
    }

    function saveHiddenConvs() {
        try {
            localStorage.setItem('cw_hidden_convs', JSON.stringify(hiddenConversations));
        } catch (e) {
            // Sessiz fail — sayfada hata göstermiyoruz
            // Seansın geri kalanında hiddenConversations in-memory kalır
            console.warn('[ChatWidget] localStorage yazılamadı:', e.message);
        }
    }

    // ── Yardımcı Fonksiyonlar ──────────────────────────────
    function initials(name) {
        var str = String(name || '').trim();
        if (!str || str === 'undefined') return '?';
        var p = str.split(/\s+/);
        return p.length >= 2
            ? (p[0][0] + p[1][0]).toUpperCase()
            : str.slice(0, 2).toUpperCase();
    }

    function avatarColor(username) {
        var colors = ['#3d7aed','#2eb87e','#e09040','#e05260',
            '#8b5cf6','#06b6d4','#f59e0b','#10b981'];
        var hash = 0;
        var str = String(username || '');
        for (var i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
        }
        return 'background:' + colors[hash % colors.length] + ';color:#fff;';
    }

    function relTime(iso) {
        if (!iso) return '';
        var diff = Date.now() - new Date(iso).getTime();
        if (isNaN(diff)) return '';
        var min = Math.floor(diff / 60000);
        if (min < 1)  return 'şimdi';
        if (min < 60) return min + 'dk';
        var h = Math.floor(min / 60);
        if (h < 24)   return h + 'sa';
        return new Date(iso).toLocaleDateString('tr-TR', {
            day: '2-digit', month: '2-digit'
        });
    }

    function dateSep(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        var n = new Date();
        var y = new Date(n);
        y.setDate(y.getDate() - 1);
        if (d.toDateString() === n.toDateString()) return 'Bugün';
        if (d.toDateString() === y.toDateString()) return 'Dün';
        return d.toLocaleDateString('tr-TR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function debounce(fn, ms) {
        var t;
        return function () {
            var a = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(null, a); }, ms);
        };
    }

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
            '#cw-badge{position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:#fff;font-size:.6rem;font-weight:800;min-width:18px;height:18px;border-radius:99px;padding:0 4px;display:flex;align-items:center;justify-content:center;border:2px solid var(--clr-bg,#121214);}',
            '#cw-badge.cw-hidden{display:none;}',
            /* Panel */
            '#cw-panel{position:fixed;bottom:5.5rem;right:1.5rem;width:360px;height:520px;background:var(--clr-surface,rgba(18,18,20,.97));border:1px solid var(--clr-border,rgba(255,255,255,.12));border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.7);display:flex;flex-direction:column;overflow:hidden;z-index:9997;transform:scale(.9) translateY(16px);opacity:0;pointer-events:none;transition:transform .22s cubic-bezier(.16,1,.3,1),opacity .2s ease;backdrop-filter:blur(24px);}',
            '#cw-panel.cw-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
            /* Header */
            '.cw-hd{display:flex;align-items:center;gap:.5rem;padding:.8rem 1rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.1));flex-shrink:0;}',
            '.cw-hd-title{flex:1;font-size:.88rem;font-weight:700;color:var(--clr-text,#f3f4f6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.cw-hd-btn{background:transparent;border:none;cursor:pointer;color:var(--clr-text-muted,#9ca3af);padding:.25rem;border-radius:6px;display:flex;align-items:center;transition:background .15s,color .15s;}',
            '.cw-hd-btn:hover{background:var(--clr-surface-2,rgba(255,255,255,.06));color:var(--clr-text,#f3f4f6);}',
            /* Yeni konuşma formu */
            '#cw-new-wrap{display:none;flex-direction:column;gap:.4rem;padding:.65rem .875rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.1));flex-shrink:0;}',
            '#cw-new-wrap.cw-visible{display:flex;}',
            '.cw-new-row{display:flex;gap:.4rem;}',
            '.cw-new-inp{flex:1;background:var(--clr-surface-2,rgba(255,255,255,.05));border:1px solid var(--clr-border,rgba(255,255,255,.1));border-radius:6px;color:var(--clr-text,#f3f4f6);font-family:inherit;font-size:.82rem;padding:.35rem .6rem;outline:none;transition:border-color .15s;}',
            '.cw-new-inp:focus{border-color:var(--clr-primary,#9e86e8);}',
            '.cw-new-btn{background:var(--clr-primary,#9e86e8);color:#fff;border:none;border-radius:6px;padding:.35rem .65rem;font-size:.78rem;font-weight:600;cursor:pointer;white-space:nowrap;}',
            '.cw-new-btn:hover{background:#b4a0ed;}',
            '.cw-new-hint{font-size:.7rem;color:var(--clr-text-muted,#9ca3af);}',
            '.cw-new-err{font-size:.72rem;color:#ff4d4d;display:none;}',
            /* Kullanıcı arama sonuçları */
            '#cw-user-results{max-height:130px;overflow-y:auto;border:1px solid var(--clr-border,rgba(255,255,255,.1));border-radius:6px;display:none;margin-top:.2rem;}',
            '.cw-urow{display:flex;align-items:center;gap:.5rem;padding:.42rem .65rem;cursor:pointer;font-size:.8rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.07));transition:background .12s;}',
            '.cw-urow:last-child{border-bottom:none;}',
            '.cw-urow:hover,.cw-urow.cw-sel{background:rgba(158,134,232,.12);}',
            '.cw-urow-info{display:flex;flex-direction:column;}',
            '.cw-uav{width:1.5rem;height:1.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:#fff;flex-shrink:0;}',
            '.cw-uname{font-weight:600;font-size:.8rem;color:var(--clr-text,#f3f4f6);}',
            '.cw-udname{font-size:.7rem;color:var(--clr-text-muted,#9ca3af);}',
            /* List view */
            '#cw-list-view{flex:1;display:flex;flex-direction:column;overflow:hidden;}',
            '.cw-srch-wrap{padding:.5rem .875rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.1));flex-shrink:0;}',
            '.cw-srch{width:100%;background:var(--clr-surface-2,rgba(255,255,255,.05));border:1px solid var(--clr-border,rgba(255,255,255,.1));border-radius:8px;color:var(--clr-text,#f3f4f6);font-family:inherit;font-size:.82rem;padding:.38rem .65rem;outline:none;box-sizing:border-box;transition:border-color .15s;}',
            '.cw-srch:focus{border-color:var(--clr-primary,#9e86e8);}',
            '#cw-conv-list{flex:1;overflow-y:auto;}',
            '#cw-conv-list::-webkit-scrollbar{width:3px;}',
            '#cw-conv-list::-webkit-scrollbar-thumb{background:var(--clr-border);border-radius:2px;}',

            // Sohbet listesi elemanı
            '.cw-conv{position:relative;display:flex;align-items:center;gap:.6rem;padding:.7rem .875rem;border-bottom:1px solid var(--clr-border,rgba(255,255,255,.07));cursor:pointer;}',
            '.cw-conv:hover{background:var(--clr-surface-2,rgba(255,255,255,.05));}',
            '.cw-conv.cw-active{background:rgba(158,134,232,.09);}',
            '.cw-av{width:2rem;height:2rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;color:#fff;}',
            '.cw-ci{flex:1;min-width:0;}',
            '.cw-cn{font-size:.82rem;font-weight:600;color:var(--clr-text,#f3f4f6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

            /* Okunmamış mesajlar için yeni stiller */
            '.cw-cp{font-size:.72rem;color:var(--clr-text-muted,#9ca3af);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}',
            '.cw-cp.cw-unread{font-weight:700;color:var(--clr-text,#f3f4f6);}',
            '.cw-unread-badge{background:#22c55e;color:#fff;font-size:.65rem;font-weight:700;padding:2px 6px;border-radius:10px;min-width:18px;text-align:center;display:inline-block;}',

            '.cw-ct{font-size:.64rem;color:var(--clr-text-muted,#9ca3af);flex-shrink:0;}',

            /* Sohbet kapatma (silme) butonu */
            '.cw-conv-del{position:absolute;right:8px;bottom:8px;opacity:0;background:none;border:none;cursor:pointer;color:var(--clr-text-muted);font-size:.7rem;padding:.2rem;transition:opacity .2s,color .2s; border-radius: 4px;}',
            '.cw-conv:hover .cw-conv-del{opacity:1;}',
            '.cw-conv-del:hover{color:#ff4d4d; background:rgba(255,77,77,0.1);}',

            /* Chat view */
            '#cw-chat-view{flex:1;display:none;flex-direction:column;overflow:hidden;}',
            '#cw-chat-view.cw-active{display:flex;}',
            '#cw-msgs{flex:1;overflow-y:auto;padding:.75rem;display:flex;flex-direction:column;gap:.3rem;}',
            '#cw-msgs::-webkit-scrollbar{width:3px;}',
            '#cw-msgs::-webkit-scrollbar-thumb{background:var(--clr-border);border-radius:2px;}',
            '.cw-dsep{display:flex;align-items:center;gap:.5rem;font-size:.63rem;color:var(--clr-text-muted,#9ca3af);margin:.3rem 0;}',
            '.cw-dsep::before,.cw-dsep::after{content:"";flex:1;height:1px;background:var(--clr-border,rgba(255,255,255,.1));}',
            '.cw-mr{display:flex;flex-direction:column;max-width:78%;animation:cwIn .15s ease; position:relative;}',
            '@keyframes cwIn{from{opacity:0;transform:translateY(4px)}}',
            '.cw-mr.cw-mine{align-self:flex-end;align-items:flex-end;}',
            '.cw-mr.cw-theirs{align-self:flex-start;align-items:flex-start;}',
            '.cw-bbl{padding:.42rem .72rem;border-radius:12px;font-size:.82rem;line-height:1.5;word-break:break-word;white-space:pre-wrap;}',
            '.cw-mr.cw-mine .cw-bbl{background:var(--clr-primary,#9e86e8);color:#fff;border-bottom-right-radius:3px;}',
            '.cw-mr.cw-theirs .cw-bbl{background:var(--clr-surface-2,rgba(255,255,255,.07));color:var(--clr-text,#f3f4f6);border:1px solid var(--clr-border,rgba(255,255,255,.1));border-bottom-left-radius:3px;}',
            '.cw-bbl.cw-del{background:transparent!important;border:1px dashed var(--clr-border)!important;color:var(--clr-text-muted)!important;font-style:italic;font-size:.74rem;}',
            '.cw-ts{font-size:.6rem;color:var(--clr-text-muted,#9ca3af);margin-top:2px;padding:0 .12rem;}',

            /* Mesaj Silme Butonu - Sadece Benim Mesajlarımda Çalışacak */
            '.cw-mr.cw-mine:hover .cw-delbtn{opacity:1;}',
            '.cw-delbtn{opacity:0;background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:50%;cursor:pointer;color:var(--clr-text-muted);font-size:.6rem;width:1.4rem;height:1.4rem;display:flex;align-items:center;justify-content:center;position:absolute;left:-25px;top:50%;transform:translateY(-50%);transition:opacity .15s,color .15s, border-color .15s;box-shadow:0 2px 4px rgba(0,0,0,0.2);}',
            '.cw-delbtn:hover{color:#ff4d4d; border-color:#ff4d4d;}',

            /* Input alanı */
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
            /* Genel */
            '.cw-loading{display:flex;align-items:center;justify-content:center;padding:2rem;color:var(--clr-text-muted,#9ca3af);font-size:.8rem;gap:.5rem;}',
            '.cw-spin{width:.8rem;height:.8rem;border:2px solid rgba(158,134,232,.3);border-top-color:#9e86e8;border-radius:50%;animation:cwSpin .65s linear infinite;display:inline-block;}',
            '@keyframes cwSpin{to{transform:rotate(360deg)}}',
            '.cw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:.5rem;color:var(--clr-text-muted,#9ca3af);padding:1.5rem;text-align:center;}',
            '.cw-empty-ico{font-size:2rem;opacity:.18;}',
            '.cw-empty-txt{font-size:.8rem;}',
            '.cw-wsdot{width:6px;height:6px;border-radius:50%;background:var(--clr-text-muted,#9ca3af);flex-shrink:0;transition:background .3s;}',
            '.cw-wsdot.cw-conn{background:#4ade80;animation:cwPulse 2s ease infinite;}',
            '@keyframes cwPulse{0%,100%{opacity:1}50%{opacity:.35}}',
            '@media(max-width:480px){#cw-panel{width:calc(100vw - 2rem);right:1rem;bottom:4.5rem;height:72vh;}#cw-fab{bottom:1rem;right:1rem;}}',
        ].join('');
        document.head.appendChild(s);
    }

    // ── DOM ────────────────────────────────────────────────
    function buildDOM() {
        var fab = document.createElement('button');
        fab.id = 'cw-fab';
        fab.setAttribute('aria-label', 'Mesajlar');
        fab.innerHTML =
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
            '<span id="cw-badge" class="cw-hidden">0</span>';
        fab.addEventListener('click', toggle);

        var panel = document.createElement('div');
        panel.id = 'cw-panel';
        panel.setAttribute('role', 'dialog');
        panel.innerHTML =
            '<div class="cw-hd">' +
            '<button class="cw-hd-btn" id="cw-back" style="display:none">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<span class="cw-hd-title" id="cw-title">Mesajlar</span>' +
            '<span class="cw-wsdot" id="cw-wsdot"></span>' +
            '<button class="cw-hd-btn" id="cw-newbtn" title="Yeni konuşma">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</button>' +
            '<button class="cw-hd-btn" id="cw-closebtn">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
            '</div>' +
            '<div id="cw-new-wrap">' +
            '<div class="cw-new-row">' +
            '<input class="cw-new-inp" id="cw-new-inp" type="text" placeholder="İsim veya kullanıcı adı ara..." autocomplete="off">' +
            '<button class="cw-new-btn" id="cw-new-go">Başlat</button>' +
            '</div>' +
            '<div id="cw-user-results"></div>' +
            '<span class="cw-new-hint">Adı yazın, listeden seçin, Başlat\'a tıklayın.</span>' +
            '<span class="cw-new-err" id="cw-new-err"></span>' +
            '</div>' +
            '<div id="cw-list-view">' +
            '<div class="cw-srch-wrap"><input class="cw-srch" id="cw-srch" type="text" placeholder="Konuşma ara..."></div>' +
            '<div id="cw-conv-list"><div class="cw-loading"><span class="cw-spin"></span>Yükleniyor...</div></div>' +
            '</div>' +
            '<div id="cw-chat-view">' +
            '<div id="cw-msgs"></div>' +
            '<div class="cw-inp-area">' +
            '<div class="cw-inp-row">' +
            '<textarea class="cw-ta" id="cw-ta" placeholder="Mesaj yaz..." rows="1"></textarea>' +
            '<button class="cw-sbtn" id="cw-sbtn" disabled>&#9658;</button>' +
            '</div>' +
            '<div class="cw-hint">Enter gönder &nbsp;·&nbsp; Shift+Enter yeni satır</div>' +
            '</div>' +
            '</div>';

        document.body.appendChild(fab);
        document.body.appendChild(panel);
        bindEvents();
    }

    // ── Event Binders ──────────────────────────────────────
    function bindEvents() {
        document.getElementById('cw-closebtn').addEventListener('click', close);
        document.getElementById('cw-back').addEventListener('click', showList);

        document.getElementById('cw-newbtn').addEventListener('click', function () {
            var visible = document.getElementById('cw-new-wrap').classList.toggle('cw-visible');
            if (visible) {
                setTimeout(function () { document.getElementById('cw-new-inp').focus(); }, 50);
            } else {
                resetNewForm();
            }
        });

        document.getElementById('cw-new-inp').addEventListener('input', debounce(function (e) {
            searchUsers(e.target.value.trim());
        }, 300));

        document.getElementById('cw-new-go').addEventListener('click', function () {
            if (!selectedUserId) {
                showNewErr('Listeden bir kullanıcı seçin.');
                return;
            }
            startConvById(selectedUserId);
        });

        document.getElementById('cw-srch').addEventListener('input', debounce(function (e) {
            renderConvList(e.target.value.toLowerCase().trim());
        }, 250));

        var ta   = document.getElementById('cw-ta');
        var sbtn = document.getElementById('cw-sbtn');
        ta.addEventListener('input', function () {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
            sbtn.disabled = !ta.value.trim();
        });
        ta.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sbtn.disabled) sendMessage();
            }
        });
        sbtn.addEventListener('click', sendMessage);

        document.getElementById('cw-msgs').addEventListener('scroll', function (e) {
            if (e.target.scrollTop < 60 && msgHasMore && !msgLoading && activeConvId) {
                loadMessages(false);
            }
        });
    }

    // ── Kullanıcı Arama ────────────────────────────────────
    function searchUsers(q) {
        var resultsEl = document.getElementById('cw-user-results');
        showNewErr('');
        selectedUserId = null;

        if (!q || q.length < 2) {
            resultsEl.style.display = 'none';
            resultsEl.innerHTML = '';
            return;
        }

        Api.get('/users', { search: q, size: 10 }).then(function (raw) {
            var items = raw && raw.content ? raw.content : (Array.isArray(raw) ? raw : []);

            items = items.filter(function (u) {
                return !me || u.username.toLowerCase() !== String(me.username || '').toLowerCase();
            });

            if (!items.length) {
                resultsEl.innerHTML =
                    '<div class="cw-urow" style="cursor:default;color:var(--clr-text-muted)">Kullanıcı bulunamadı</div>';
                resultsEl.style.display = 'block';
                return;
            }

            resultsEl.innerHTML = items.map(function (u) {
                var uid   = u.publicId || u.id;
                var dname = u.displayName || u.firstName || u.username;
                return '<div class="cw-urow" data-uid="' + esc(uid) + '">' +
                    '<div class="cw-uav" style="' + avatarColor(u.username) + '">' +
                    esc(initials(dname)) + '</div>' +
                    '<div class="cw-urow-info">' +
                    '<div class="cw-uname">' + esc(dname) + '</div>' +
                    '<div class="cw-udname">@' + esc(u.username) + '</div>' +
                    '</div></div>';
            }).join('');
            resultsEl.style.display = 'block';

            resultsEl.querySelectorAll('.cw-urow[data-uid]').forEach(function (row) {
                row.addEventListener('click', function () {
                    resultsEl.querySelectorAll('.cw-urow').forEach(function (r) {
                        r.classList.remove('cw-sel');
                    });
                    row.classList.add('cw-sel');
                    selectedUserId = row.dataset.uid;
                    document.getElementById('cw-new-inp').value =
                        row.querySelector('.cw-uname').textContent;
                });
            });

        }).catch(function (err) {
            var msg = 'Kullanıcılar getirilemedi: ' + esc((err && err.message) || 'Yetkisiz erişim veya sunucu hatası.');
            resultsEl.innerHTML =
                '<div class="cw-urow" style="cursor:default;color:var(--clr-text-muted);font-size:.75rem;">' +
                msg + '</div>';
            resultsEl.style.display = 'block';
        });
    }

    function startConvById(targetPublicId) {
        resetNewForm();
        document.getElementById('cw-new-wrap').classList.remove('cw-visible');

        Api.post('/chat/conversations', { targetUserPublicId: targetPublicId }).then(function (raw) {
            var conv = raw && raw.publicId ? raw : (raw && raw.data ? raw.data : raw);

            if(hiddenConversations.includes(conv.publicId) || hiddenConversations.includes(conv.id)) {
                hiddenConversations = hiddenConversations.filter(id => id !== conv.publicId && id !== conv.id);
                saveHiddenConvs();
            }

            loadConversations();
            openConv(conv.publicId || conv.id);
        }).catch(function (err) {
            if (window.Toast) Toast.error('Konuşma başlatılamadı: ' + ((err && err.message) || ''));
        });
    }

    function resetNewForm() {
        var inp = document.getElementById('cw-new-inp');
        var res = document.getElementById('cw-user-results');
        if (inp) inp.value = '';
        if (res) { res.style.display = 'none'; res.innerHTML = ''; }
        showNewErr('');
        selectedUserId = null;
    }

    function showNewErr(msg) {
        var el = document.getElementById('cw-new-err');
        if (!el) return;
        el.textContent = msg;
        el.style.display = msg ? 'block' : 'none';
    }

    // ── Toggle / Open / Close ──────────────────────────────
    function toggle() { isOpen ? close() : open(); }

    function open() {
        isOpen = true;
        document.getElementById('cw-panel').classList.add('cw-open');

        var token = Store.getAccessToken();
        if (!token) {
            document.getElementById('cw-conv-list').innerHTML =
                '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span>' +
                '<span class="cw-empty-txt">Oturum açmadınız.</span></div>';
            return;
        }

        me = Store.getUser();

        loadConversations();
        connectWS();
    }

    function close() {
        isOpen = false;
        document.getElementById('cw-panel').classList.remove('cw-open');
    }

    // ── Görünüm ────────────────────────────────────────────
    function showList() {
        activeConvId = null;
        msgPage = 0;
        msgHasMore = true;
        document.getElementById('cw-list-view').style.display  = 'flex';
        document.getElementById('cw-chat-view').classList.remove('cw-active');
        document.getElementById('cw-title').textContent = 'Mesajlar';
        document.getElementById('cw-back').style.display  = 'none';
        document.getElementById('cw-newbtn').style.display = 'flex';
        renderConvList('');
    }

    function showChat(conv) {
        var other = conv.otherUser || conv.participant || {};
        var dname = other.displayName || other.username || 'Konuşma';
        document.getElementById('cw-new-wrap').classList.remove('cw-visible');
        resetNewForm();
        document.getElementById('cw-list-view').style.display  = 'none';
        document.getElementById('cw-chat-view').classList.add('cw-active');
        document.getElementById('cw-title').textContent = dname;
        document.getElementById('cw-back').style.display  = 'flex';
        document.getElementById('cw-newbtn').style.display = 'none';
    }

    // ── Konuşma Listesi ────────────────────────────────────
    function loadConversations() {
        if (!Store.getAccessToken()) return;

        Api.get('/chat/conversations', { page: 0, size: 50 }).then(function (raw) {
            conversations = raw && raw.content
                ? raw.content
                : (Array.isArray(raw) ? raw : []);
            renderConvList('');
        }).catch(function (err) {
            console.error('ChatWidget konuşma listesi:', err);
            document.getElementById('cw-conv-list').innerHTML =
                '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span>' +
                '<span class="cw-empty-txt">Konuşmalar yüklenemedi</span></div>';
        });
    }

    function renderConvList(filter) {
        var container = document.getElementById('cw-conv-list');
        if (!container) return;

        var list = conversations.filter(function (c) {
            var cid = c.publicId || c.id;

            // 1. Gizlenen sohbetleri filtrele
            if (hiddenConversations.includes(cid)) return false;

            // 2. Arama filtresi
            if (!filter) return true;

            var other = c.otherUser || {};
            var uName = (other.username || '').toLowerCase();
            var dName = (other.displayName || '').toLowerCase();
            var preview = (c.lastMessagePreview || '').toLowerCase();

            return uName.indexOf(filter) !== -1 ||
                dName.indexOf(filter) !== -1 ||
                preview.indexOf(filter) !== -1;
        });

        if (!list.length) {
            container.innerHTML =
                '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span>' +
                '<span class="cw-empty-txt">' +
                (filter ? 'Sonuç bulunamadı' : 'Henüz konuşma yok') +
                '</span></div>';
            return;
        }

        container.innerHTML = list.map(function (c) {
            if (!c) return '';
            var other   = c.otherUser || {};
            var display = other.displayName || other.username || 'Bilinmeyen';
            var uname   = other.username || '';
            var time    = c.lastMessageAt ? relTime(c.lastMessageAt) : '';
            var cid     = c.publicId || c.id;
            var active  = cid === activeConvId ? ' cw-active' : '';

            // --- YENİ MESAJ BİLDİRİMİ VE KALIN YAZI ---
            var unreadHtml = c.unreadCount && c.unreadCount > 0
                ? '<span class="cw-unread-badge">' + c.unreadCount + '</span>'
                : '';
            var cpClass = c.unreadCount && c.unreadCount > 0
                ? 'cw-cp cw-unread'
                : 'cw-cp';

            return '<div class="cw-conv' + active + '" data-id="' + esc(cid) + '">' +
                '<div class="cw-av" style="' + avatarColor(uname) + '">' + esc(initials(display)) + '</div>' +
                '<div class="cw-ci">' +
                '<div class="cw-cn">' + esc(display) + '</div>' +
                '<div class="' + cpClass + '">' + esc(c.lastMessagePreview || '...') + '</div>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-right:18px;">' +
                '<span class="cw-ct">' + esc(time) + '</span>' +
                unreadHtml +
                '</div>' +
                '<button class="cw-conv-del" data-cid="' + esc(cid) + '" title="Sohbeti Gizle">&#10005;</button>' +
                '</div>';
        }).join('');

        // Tıklama eventleri
        container.querySelectorAll('.cw-conv[data-id]').forEach(function (el) {
            el.addEventListener('click', function (e) {
                // Çarpı ikonuna basılmışsa sohbeti gizle
                if(e.target.closest('.cw-conv-del')) {
                    var cIdToHide = e.target.closest('.cw-conv-del').dataset.cid;
                    hideConversation(cIdToHide, el);
                    return;
                }
                openConv(el.dataset.id);
            });
        });
    }

    function hideConversation(cid, elementRow) {
        // Gizli konuşmalar listesine ekle (localStorage'da kalıcı)
        // TODO: Backend API'ye taşınacak (POST /api/v1/chat/conversations/{id}/hide)
        if (!hiddenConversations.includes(cid)) {
            hiddenConversations.push(cid);
            saveHiddenConvs(); // localStorage'a yaz (fail-safe try/catch ile)
        }

        var currentHeight = elementRow.offsetHeight;
        elementRow.style.height = currentHeight + 'px';

        elementRow.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        elementRow.style.opacity = '0';
        elementRow.style.transform = 'translateX(100%)';

        setTimeout(() => {
            elementRow.style.transition = 'height 0.25s ease, padding 0.25s ease, margin 0.25s ease, border 0.25s ease';
            elementRow.style.height = '0px';
            elementRow.style.paddingTop = '0px';
            elementRow.style.paddingBottom = '0px';
            elementRow.style.marginTop = '0px';
            elementRow.style.marginBottom = '0px';
            elementRow.style.border = 'none';
            elementRow.style.overflow = 'hidden';

            setTimeout(() => {
                elementRow.remove();

                var container = document.getElementById('cw-conv-list');
                if (container && container.querySelectorAll('.cw-conv').length === 0) {
                    container.innerHTML =
                        '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span>' +
                        '<span class="cw-empty-txt">Henüz konuşma yok</span></div>';
                }
            }, 250);
        }, 250);
    }

    // ── YENİ: Bildirim Senkronizasyon Helper'ı ───────────────
    function markRelatedNotificationsAsRead(conv) {
        if (!conv) return;
        var other = conv.otherUser || conv.participant || {};
        var dName = other.displayName || '';
        var uName = other.username || '';

        Api.get('/notifications', { unreadOnly: true, size: 50 }).then(function(res) {
            var items = res && res.content ? res.content : (Array.isArray(res) ? res : []);
            items.forEach(function(n) {
                if (n.type === 'NEW_MESSAGE' && !n.read) {
                    var textToSearch = ((n.title || '') + ' ' + (n.message || '')).toLowerCase();
                    var matchD = dName && textToSearch.indexOf(dName.toLowerCase()) !== -1;
                    var matchU = uName && textToSearch.indexOf(uName.toLowerCase()) !== -1;
                    var matchL = (n.link || '').indexOf(conv.publicId || conv.id) !== -1;

                    if (matchD || matchU || matchL || (!dName && !uName)) {
                        var nid = n.publicId || n.id;
                        if (nid) {
                            Api.post('/notifications/' + nid + '/read', {}).then(function() {
                                // 1. Genel Topbar Rozetini Güncelle (Site genelinde geçerli)
                                var badge = document.getElementById('topbar-notif-badge');
                                if (badge) {
                                    var current = parseInt(badge.textContent) || 0;
                                    var next = Math.max(0, current - 1);
                                    if (window.Topbar && typeof window.Topbar.updateNotifBadge === 'function') {
                                        Topbar.updateNotifBadge(next);
                                    } else {
                                        badge.textContent = next > 99 ? '99+' : next;
                                        badge.style.display = next > 0 ? 'inline-flex' : 'none';
                                    }
                                }
                                // Sidebar Güncellemesi (Site genelinde geçerli)
                                if (window.Sidebar && typeof window.Sidebar.updateBadge === 'function') {
                                    var currSide = parseInt(badge ? badge.textContent : 0) || 0;
                                    Sidebar.updateBadge('notif', Math.max(0, currSide - 1));
                                }

                                // 2. Bildirimler sayfasındaysak listeyi anında görsel olarak düzelt
                                var rowEl = document.querySelector('.notif-item[data-id="' + nid + '"]');
                                if (rowEl) {
                                    rowEl.classList.remove('unread');
                                    rowEl.style.removeProperty('background');
                                    var b = rowEl.querySelector('.badge-primary');
                                    if (b) b.remove();
                                    var rb = rowEl.querySelector('[data-action="read"]');
                                    if (rb) rb.remove();
                                    rowEl.style.borderLeft = 'none';
                                    rowEl.style.paddingLeft = '1.25rem';

                                    if (typeof summaryCache !== 'undefined' && typeof updateSummaryUI !== 'undefined') {
                                        summaryCache.unread = Math.max(0, summaryCache.unread - 1);
                                        updateSummaryUI();
                                    }
                                }
                            }).catch(function(){});
                        }
                    }
                }
            });
        }).catch(function(){});
    }

    // ── Konuşma Aç ─────────────────────────────────────────
    function openConv(publicId) {
        activeConvId = publicId;
        msgPage    = 0;
        msgHasMore = true;

        var conv = conversations.find(function (c) {
            return (c.publicId || c.id) === publicId;
        });
        if (!conv) return;

        showChat(conv);
        renderConvList('');

        document.getElementById('cw-msgs').innerHTML =
            '<div class="cw-loading"><span class="cw-spin"></span>Yükleniyor...</div>';

        loadMessages(true);

        // YENİ: Bu sohbeti açtığımızda sunucudaki bu kişiye ait genel bildirimleri de OKUNDU yap.
        markRelatedNotificationsAsRead(conv);
    }

    // ── Mesaj Yükleme ──────────────────────────────────────
    function loadMessages(scrollBottom) {
        if (msgLoading || !activeConvId) return;
        msgLoading = true;

        Api.get('/chat/conversations/' + activeConvId + '/messages', {
            page: msgPage,
            size: 30
        }).then(function (raw) {
            var items = raw && raw.content ? raw.content : (Array.isArray(raw) ? raw : []);
            var pages = raw && raw.totalPages ? raw.totalPages : 1;
            msgHasMore = (msgPage + 1) < pages;
            var isFirst = (msgPage === 0);
            msgPage++;

            renderMsgs(items, isFirst, scrollBottom);

            // Chat'in kendi küçük rozetini (cw-badge) güncelle
            var activeConv = conversations.find(function(c) { return (c.publicId || c.id) === activeConvId; });
            if (activeConv && activeConv.unreadCount && activeConv.unreadCount > 0) {
                var diff = activeConv.unreadCount;
                activeConv.unreadCount = 0;
                var newTotal = Math.max(0, unreadTotal - diff);
                updateBadge(newTotal);
            }

        }).catch(function (err) {
            console.error('ChatWidget mesajlar:', err);
            document.getElementById('cw-msgs').innerHTML =
                '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span>' +
                '<span class="cw-empty-txt">Mesajlar yüklenemedi</span></div>';
        }).finally(function () {
            msgLoading = false;
        });
    }

    function renderMsgs(items, isFirst, scrollBottom) {
        var list = document.getElementById('cw-msgs');

        if (isFirst && items.length === 0) {
            list.innerHTML =
                '<div class="cw-empty"><span class="cw-empty-ico">&#9672;</span>' +
                '<span class="cw-empty-txt">Henüz mesaj yok. İlk mesajı gönder!</span></div>';
            return;
        }

        var prevH = list.scrollHeight;
        if (isFirst) list.innerHTML = '';

        var lastDate = null;
        var frag = document.createDocumentFragment();

        items.forEach(function (msg) {
            if (!msg) return;
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

        if (isFirst) {
            list.appendChild(frag);
        } else {
            list.insertBefore(frag, list.firstChild);
            list.scrollTop = list.scrollHeight - prevH;
        }

        if (scrollBottom) list.scrollTop = list.scrollHeight;
    }

    // ── Mesaj Elemanı (KİMİN MESAJI) ──────────────────────
    function buildMsg(msg) {
        var senderUname = msg.senderUsername || '';
        var myUsername  = me ? String(me.username || '') : '';

        var isMine = false;
        if (myUsername && senderUname) {
            isMine = (senderUname.toLowerCase() === myUsername.toLowerCase());
        }

        var deleted = msg.deleted;
        var mid     = msg.publicId || msg.id;

        var row = document.createElement('div');
        row.className = 'cw-mr ' + (isMine ? 'cw-mine' : 'cw-theirs');
        row.dataset.id = mid;

        var t = msg.sentAt
            ? new Date(msg.sentAt).toLocaleTimeString('tr-TR', {
                hour: '2-digit', minute: '2-digit'
            })
            : '';
        var txt = deleted ? '&#128683; Bu mesaj silindi' : esc(msg.content);

        var delBtn = (isMine && !deleted)
            ? '<button class="cw-delbtn" title="Sil"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>'
            : '';

        row.innerHTML = delBtn +
            '<div class="cw-bbl' + (deleted ? ' cw-del' : '') + '">' + txt + '</div>' +
            '<span class="cw-ts">' + t + (isMine && msg.readAt ? ' ✓✓' : '') + '</span>';

        var db = row.querySelector('.cw-delbtn');
        if (db) {
            db.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteMsg(mid, row);
            });
        }
        return row;
    }

    // ── Mesaj Gönder ───────────────────────────────────────
    function sendMessage() {
        var ta      = document.getElementById('cw-ta');
        var sbtn    = document.getElementById('cw-sbtn');
        var content = ta.value.trim();
        if (!content || !activeConvId) return;

        sbtn.disabled = true;
        ta.value = '';
        ta.style.height = 'auto';

        var tempId = 'temp_' + Date.now();
        appendMsg({
            publicId:       tempId,
            senderUsername: me ? me.username : '',
            content:        content,
            deleted:        false,
            sentAt:         new Date().toISOString(),
            readAt:         null
        });

        Api.post('/chat/conversations/' + activeConvId + '/messages', { content: content })
            .then(function (saved) {
                var real = saved && saved.publicId ? saved : (saved && saved.data ? saved.data : saved);
                var el   = document.querySelector('[data-id="' + tempId + '"]');
                if (el) el.replaceWith(buildMsg(real));
                loadConversations();
            }).catch(function (err) {
            var el = document.querySelector('[data-id="' + tempId + '"]');
            if (el) el.remove();
            if (window.Toast) Toast.error('Gönderilemedi: ' + ((err && err.message) || ''));
            ta.value = content;
            sbtn.disabled = false;
        });
    }

    function appendMsg(msg) {
        var list = document.getElementById('cw-msgs');
        if (list.querySelector('.cw-empty')) list.innerHTML = '';
        list.appendChild(buildMsg(msg));
        list.scrollTop = list.scrollHeight;
    }

    // ── Mesaj Sil ──────────────────────────────────────────
    function deleteMsg(publicId, rowEl) {
        Api.del('/chat/messages/' + publicId).then(function () {
            var b = rowEl.querySelector('.cw-bbl');
            if (b) { b.innerHTML = '&#128683; Bu mesaj silindi'; b.classList.add('cw-del'); }
            var d = rowEl.querySelector('.cw-delbtn');
            if (d) d.remove();
            loadConversations();
        }).catch(function (err) {
            if (window.Toast) Toast.error('Silinemedi: ' + ((err && err.message) || ''));
        });
    }

    // ── WebSocket ──────────────────────────────────────────
    function connectWS() {
        if (wsConnected) return;
        if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') return;

        var token = Store.getAccessToken();
        if (!token) return;

        try {
            var socket = new SockJS(WS_URL);
            stompClient = Stomp.over(socket);
            stompClient.debug = null;

            stompClient.connect(
                { 'Authorization': 'Bearer ' + token },
                function () {
                    wsConnected = true;
                    setWsDot(true);
                    stompClient.subscribe('/user/queue/chat', function (frame) {
                        try { handleIncoming(JSON.parse(frame.body)); } catch (e) {}
                    });
                },
                function () {
                    wsConnected = false;
                    setWsDot(false);
                    setTimeout(connectWS, 10000);
                }
            );
        } catch (e) {
            console.error('ChatWidget WS hatası:', e);
        }
    }

    function handleIncoming(msg) {
        if(msg && msg.conversationPublicId) {
            if(hiddenConversations.includes(msg.conversationPublicId)) {
                hiddenConversations = hiddenConversations.filter(id => id !== msg.conversationPublicId);
                saveHiddenConvs();
            }
        }

        loadConversations();

        var mid = msg.publicId || msg.id;
        if (activeConvId && msg.conversationPublicId === activeConvId) {
            appendMsg(msg);
            if (mid) Api.post('/chat/messages/' + mid + '/read', {}).catch(function () {});

            // Eğer sohbet zaten açıksa ve yeni bir mesaj geldiyse, arkada oluşan genel bildirimi de anında sil.
            var activeConv = conversations.find(function(c) { return (c.publicId || c.id) === activeConvId; });
            setTimeout(function() { markRelatedNotificationsAsRead(activeConv); }, 500);

        } else {
            updateBadge(unreadTotal + 1);
            if (window.Toast) Toast.info('Yeni mesaj: ' + (msg.senderUsername || ''));
        }
    }

    function setWsDot(ok) {
        var d = document.getElementById('cw-wsdot');
        if (d) d.className = 'cw-wsdot' + (ok ? ' cw-conn' : '');
    }

    // ── Badge ──────────────────────────────────────────────
    function updateBadge(count) {
        unreadTotal = count;
        var b = document.getElementById('cw-badge');
        if (!b) return;
        if (count > 0) {
            b.textContent = count > 99 ? '99+' : count;
            b.classList.remove('cw-hidden');
        } else {
            b.classList.add('cw-hidden');
        }
    }

    // ── Init ──────────────────────────────────────────────
    function init() {
        if (initialized) return;
        initialized = true;

        try {
            injectStyles();
            buildDOM();

            var token = Store.getAccessToken();
            if (token) {
                Api.get('/chat/unread-count').then(function (r) {
                    updateBadge(r && r.count !== undefined ? r.count : 0);
                }).catch(function () {});

                window.addEventListener('beforeunload', function () {
                    if (stompClient && stompClient.connected) stompClient.disconnect();
                });
            }
        } catch (e) {
            console.error('ChatWidget init hatası:', e);
        }
    }

    window.ChatWidget = {
        init:         init,
        toggle:       toggle,
        open:         open,
        close:        close,
        updateBadge:  updateBadge,
        disconnect:   function() {
            if (stompClient && stompClient.connected) {
                stompClient.disconnect();
                wsConnected = false;
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());