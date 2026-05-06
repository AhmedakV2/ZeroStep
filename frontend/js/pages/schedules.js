// ╔══════════════════════════════════════════════════════════╗
// ║  Zamanlanmış Görevler Sayfası                            ║
// ╚══════════════════════════════════════════════════════════╝

// ── State ──────────────────────────────────────────────────
let allSchedules = [];
let recipients   = [];  // Modal içindeki alıcı listesi

// ── INIT ───────────────────────────────────────────────────
(async function init() {
    if (!Auth.isLoggedIn()) { window.location.href = '../index.html'; return; }

    Sidebar.render('sidebar');
    Topbar.render('topbar', 'Zamanlanmış Görevler');

    setupFilters();
    document.getElementById('btn-new-schedule').addEventListener('click', () => openModal(null));

    await loadSchedules();
})();

// ── VERİ YÜKLEME ───────────────────────────────────────────
async function loadSchedules() {
    try {
        // GET /api/v1/schedules
        const raw = await Api.get('/schedules', { size: 100 });
        let items = [];
        if (raw?.content) items = raw.content;
        else if (Array.isArray(raw)) items = raw;
        else if (raw?.data?.content) items = raw.data.content;
        else if (Array.isArray(raw?.data)) items = raw.data;

        allSchedules = items;
        renderGrid();
    } catch (err) {
        Toast.error('Zamanlanmış görevler yüklenemedi: ' + err.message);
        document.getElementById('schedule-grid').innerHTML = `
            <div class="schedule-empty">
                <span class="schedule-empty-icon">◷</span>
                <div style="font-size:.9rem;font-weight:600;color:var(--clr-text);">Yüklenemedi</div>
                <div style="font-size:.83rem;margin-top:.25rem;">${Utils.escHtml(err.message)}</div>
            </div>`;
    }
}

// ── FİLTRE ─────────────────────────────────────────────────
function setupFilters() {
    document.getElementById('filter-status').addEventListener('change', renderGrid);
    document.getElementById('filter-freq').addEventListener('change', renderGrid);
}

function getFiltered() {
    const status = document.getElementById('filter-status').value;
    const freq   = document.getElementById('filter-freq').value;

    return allSchedules.filter(s => {
        if (status === 'active' && !s.enabled) return false;
        if (status === 'disabled' && s.enabled) return false;
        if (freq && s.frequency !== freq) return false;
        return true;
    });
}

// ── RENDER ─────────────────────────────────────────────────
function renderGrid() {
    const grid = document.getElementById('schedule-grid');
    const items = getFiltered();

    if (!items.length) {
        grid.innerHTML = `
            <div class="schedule-empty">
                <span class="schedule-empty-icon">◷</span>
                <div style="font-size:.9rem;font-weight:600;color:var(--clr-text);margin-bottom:.35rem;">
                    ${allSchedules.length === 0 ? 'Henüz zamanlanmış görev yok' : 'Filtre sonucu bulunamadı'}
                </div>
                <div style="font-size:.83rem;">
                    ${allSchedules.length === 0 ? '"+ Yeni Plan" butonuyla başlayın.' : 'Filtreleri değiştirin.'}
                </div>
            </div>`;
        return;
    }

    grid.innerHTML = items.map(buildCard).join('');

    // Toggle event'leri
    grid.querySelectorAll('.sch-toggle').forEach(cb => {
        cb.addEventListener('change', e => {
            const id = e.target.dataset.id;
            toggleEnabled(id, e.target.checked, e.target);
        });
    });

    // Buton event'leri — event delegation
    grid.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const { action, id } = btn.dataset;
            if (action === 'edit')    openModal(allSchedules.find(s => s.publicId === id));
            if (action === 'delete')  confirmDelete(id);
            if (action === 'trigger') triggerNow(id, btn);
        });
    });
}

function buildCard(s) {
    const freqLabel = { HOURLY: 'Saatlik', DAILY: 'Günlük', WEEKLY: 'Haftalık' }[s.frequency] || s.frequency;
    const freqIcon  = { HOURLY: '⏱', DAILY: '◷', WEEKLY: '📅' }[s.frequency] || '◷';

    const nextRun = s.nextRunAt ? Utils.formatDate(s.nextRunAt) : '—';
    const lastRun = s.lastRunAt ? Utils.formatDate(s.lastRunAt) : 'Henüz çalışmadı';

    const runTimeStr = buildRunTimeStr(s);
    const recipientCount = s.recipients?.length || 0;

    return `
        <div class="schedule-card${s.enabled ? '' : ' disabled'}">
            <div class="schedule-card-header">
                <div>
                    <div class="schedule-scenario-name" title="${Utils.escHtml(s.scenarioName)}">
                        ${Utils.escHtml(s.scenarioName || '—')}
                    </div>
                    <span class="freq-badge freq-${s.frequency}" style="margin-top:.3rem;display:inline-flex;">
                        ${freqIcon} ${Utils.escHtml(freqLabel)}
                    </span>
                </div>
                <div class="schedule-actions">
                    <button class="btn-icon" data-action="trigger" data-id="${Utils.escHtml(s.publicId)}"
                            title="Şimdi Çalıştır" style="color:var(--clr-success);">▶</button>
                    <button class="btn-icon" data-action="edit" data-id="${Utils.escHtml(s.publicId)}"
                            title="Düzenle">✎</button>
                    <button class="btn-icon" data-action="delete" data-id="${Utils.escHtml(s.publicId)}"
                            title="Sil" style="color:var(--clr-danger);">✕</button>
                </div>
            </div>

            <div class="schedule-info-grid">
                <div class="schedule-info-item">
                    <span class="schedule-info-label">Çalışma Zamanı</span>
                    <span class="schedule-info-value">${Utils.escHtml(runTimeStr)}</span>
                </div>
                <div class="schedule-info-item">
                    <span class="schedule-info-label">Zaman Dilimi</span>
                    <span class="schedule-info-value">${Utils.escHtml(s.timezone || '—')}</span>
                </div>
                <div class="schedule-info-item">
                    <span class="schedule-info-label">Son Çalışma</span>
                    <span class="schedule-info-value">${lastRun}</span>
                </div>
                <div class="schedule-info-item">
                    <span class="schedule-info-label">Sonraki Çalışma</span>
                    <span class="schedule-info-value">${nextRun}</span>
                </div>
            </div>

            ${recipientCount > 0 ? `
            <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--clr-border);">
                <span style="font-size:.7rem;color:var(--clr-text-muted);">
                    ✉ ${recipientCount} alıcı${s.notifyOnFailureOnly ? ' · yalnızca hata' : ''}
                </span>
            </div>` : ''}

            <div class="schedule-card-footer">
                <span class="schedule-creator">
                    ${Utils.escHtml(s.createdByUsername || '')}
                </span>
                <label class="toggle-switch-wrap" title="${s.enabled ? 'Pasif yap' : 'Aktif yap'}">
                    <input type="checkbox" class="sch-toggle" data-id="${Utils.escHtml(s.publicId)}"
                           ${s.enabled ? 'checked' : ''}>
                    <span class="toggle-sw" style="pointer-events:none;">
                        <span class="toggle-sw-slider"></span>
                    </span>
                    <span class="toggle-label">${s.enabled ? 'Aktif' : 'Pasif'}</span>
                </label>
            </div>
        </div>`;
}

// Sıklığa göre çalışma zamanı metni
function buildRunTimeStr(s) {
    if (s.frequency === 'HOURLY') return 'Her saat başı';
    if (s.frequency === 'DAILY')  return s.runTime ? s.runTime + ' (her gün)' : 'Her gün';
    if (s.frequency === 'WEEKLY') {
        const days = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
        const day = s.runDayOfWeek ? days[s.runDayOfWeek] || '' : '';
        return `${day}${day ? ' ' : ''}${s.runTime || ''} (haftalık)`.trim();
    }
    return '—';
}

// ── TOGGLE AKTİF/PASİF ─────────────────────────────────────
async function toggleEnabled(id, enable, checkboxEl) {
    try {
        const endpoint = enable ? `/schedules/${id}/enable` : `/schedules/${id}/disable`;
        const updated = await Api.post(endpoint, {});

        // Cache güncelle
        const idx = allSchedules.findIndex(s => s.publicId === id);
        if (idx !== -1) allSchedules[idx] = { ...allSchedules[idx], ...updated };

        renderGrid();
        Toast.success(`Plan ${enable ? 'aktif edildi' : 'pasif yapıldı'}.`);
    } catch (err) {
        // Hata — checkbox'ı geri al
        checkboxEl.checked = !enable;
        Toast.error('İşlem başarısız: ' + err.message);
    }
}

// ── ŞİMDİ ÇALIŞTIR ─────────────────────────────────────────
async function triggerNow(id, btn) {
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:.75rem;height:.75rem;"></span>';

    try {
        // POST /api/v1/schedules/{publicId}/trigger-now
        const raw = await Api.post(`/schedules/${id}/trigger-now`, {});
        const execId = raw?.publicId || raw?.data?.publicId;

        Toast.success('Senaryo kuyruğa alındı!');

        if (execId) {
            // 900ms sonra execution detaya yönlendir
            setTimeout(() => {
                window.location.href = `execution-detail.html?id=${encodeURIComponent(execId)}`;
            }, 900);
        }
    } catch (err) {
        Toast.error('Çalıştırılamadı: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

// ── SİLME ──────────────────────────────────────────────────
function confirmDelete(id) {
    const sch = allSchedules.find(s => s.publicId === id);
    ConfirmDialog.show({
        title: 'Planı Sil',
        message: `"${sch?.scenarioName || ''}" senaryosuna ait bu planı silmek istediğinize emin misiniz?`,
        confirmLabel: 'Sil',
        onConfirm: async () => {
            await Api.del(`/schedules/${id}`);
            Modal.close();
            Toast.success('Plan silindi.');
            allSchedules = allSchedules.filter(s => s.publicId !== id);
            renderGrid();
        },
    });
}

// ── MODAL ──────────────────────────────────────────────────
async function openModal(schedule) {
    const isEdit = !!schedule;
    recipients = schedule?.recipients ? [...schedule.recipients] : [];

    // Senaryo listesini çek (yeni plan için gerekli)
    let scenarios = [];
    try {
        const raw = await Api.get('/scenarios', { page: 0, size: 1000, status: 'READY' });
        if (raw?.content) scenarios = raw.content;
        else if (Array.isArray(raw)) scenarios = raw;
        else if (raw?.data?.content) scenarios = raw.data.content;
    } catch { /* sessiz */ }

    const scenarioOptions = scenarios.map(sc =>
        `<option value="${Utils.escHtml(sc.publicId)}"
            ${schedule?.scenarioPublicId === sc.publicId ? 'selected' : ''}>
            ${Utils.escHtml(sc.name)}
        </option>`
    ).join('');

    const curFreq    = schedule?.frequency    || 'DAILY';
    const curRunTime = schedule?.runTime      || '09:00';
    const curDay     = schedule?.runDayOfWeek || 1;
    const curTz      = schedule?.timezone     || 'Europe/Istanbul';

    const timezones = [
        'Europe/Istanbul', 'Europe/London', 'Europe/Berlin',
        'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC'
    ];

    const weekdays = [
        [1,'Pzt'],[2,'Sal'],[3,'Çar'],[4,'Per'],[5,'Cum'],[6,'Cmt'],[7,'Paz']
    ];

    const contentHTML = `
    <div style="display:flex;flex-direction:column;gap:1rem;margin-top:.5rem;">

        ${!isEdit ? `
        <div class="form-group">
            <label class="form-label">Senaryo <span style="color:var(--clr-danger)">*</span></label>
            <select class="form-input" id="sch-scenario">
                <option value="">— Senaryo Seçin —</option>
                ${scenarioOptions}
            </select>
        </div>` : `
        <div style="padding:.6rem .875rem;background:var(--clr-surface-2);border-radius:var(--radius-sm);font-size:.85rem;color:var(--clr-text);">
            <span style="color:var(--clr-text-muted);font-size:.72rem;display:block;margin-bottom:.15rem;">SENARYO</span>
            ${Utils.escHtml(schedule.scenarioName || '')}
        </div>`}

        <div class="form-group">
            <label class="form-label">Sıklık</label>
            <div class="freq-radio-group">
                ${[['HOURLY','⏱ Saatlik'],['DAILY','◷ Günlük'],['WEEKLY','📅 Haftalık']].map(([v,l]) => `
                    <label class="freq-radio-btn">
                        <input type="radio" name="sch-freq" value="${v}" ${curFreq === v ? 'checked' : ''}>
                        ${l}
                    </label>`).join('')}
            </div>
        </div>

        <div class="form-group" id="sch-time-wrap" style="display:${curFreq === 'HOURLY' ? 'none' : 'flex'};flex-direction:column;gap:.4rem;">
            <label class="form-label">Çalışma Saati</label>
            <input class="form-input" type="time" id="sch-runtime" value="${curRunTime}" style="width:140px;">
        </div>

        <div class="form-group" id="sch-weekday-wrap" style="display:${curFreq === 'WEEKLY' ? 'flex' : 'none'};flex-direction:column;gap:.4rem;">
            <label class="form-label">Haftanın Günü</label>
            <div class="weekday-group" id="weekday-group">
                ${weekdays.map(([num,label]) => `
                    <button type="button" class="weekday-btn${curDay === num ? ' active' : ''}"
                            data-day="${num}">${label}</button>`).join('')}
            </div>
            <input type="hidden" id="sch-weekday" value="${curDay}">
        </div>

        <div class="form-group">
            <label class="form-label">Zaman Dilimi</label>
            <select class="form-input" id="sch-timezone">
                ${timezones.map(tz =>
        `<option value="${tz}" ${curTz === tz ? 'selected' : ''}>${tz}</option>`
    ).join('')}
            </select>
        </div>

        <div class="form-group">
            <label class="form-label">E-posta Alıcıları</label>
            <div class="tag-input-wrap" id="tag-wrap" onclick="document.getElementById('tag-field').focus()">
                <input type="text" id="tag-field" class="tag-input-field"
                       placeholder="E-posta ekle ve Enter'a basın...">
            </div>
            <span style="font-size:.72rem;color:var(--clr-text-muted);">Çalışma sonucu bu adreslere mail gönderilir.</span>
        </div>

        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.88rem;color:var(--clr-text);">
            <input type="checkbox" id="sch-fail-only" ${schedule?.notifyOnFailureOnly ? 'checked' : ''}>
            Sadece hata durumunda bildir
        </label>

        <div id="sch-error" class="alert alert-danger hidden"></div>
    </div>`;

    Modal.open({
        title: isEdit ? 'Planı Düzenle' : 'Yeni Plan Oluştur',
        contentHTML,
        confirmLabel: isEdit ? 'Güncelle' : 'Oluştur',
        size: 'md',
        onConfirm: async () => {
            await saveSchedule(isEdit ? schedule.publicId : null, isEdit ? schedule.scenarioPublicId : null);
        }
    });

    // Modal açıldıktan sonra event'leri bağla
    setTimeout(() => {
        bindModalEvents();
        renderRecipientChips();
    }, 50);
}

function bindModalEvents() {
    // Frekans değişimi
    document.querySelectorAll('input[name="sch-freq"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const val = radio.value;
            const timeWrap    = document.getElementById('sch-time-wrap');
            const weekdayWrap = document.getElementById('sch-weekday-wrap');
            if (timeWrap)    timeWrap.style.display    = val === 'HOURLY' ? 'none' : 'flex';
            if (weekdayWrap) weekdayWrap.style.display = val === 'WEEKLY' ? 'flex' : 'none';
        });
    });

    // Haftanın günü seçimi
    document.querySelectorAll('.weekday-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.weekday-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const input = document.getElementById('sch-weekday');
            if (input) input.value = btn.dataset.day;
        });
    });

    // E-posta tag input
    const tagField = document.getElementById('tag-field');
    if (tagField) {
        tagField.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const email = tagField.value.trim().replace(/,$/, '');
                if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    if (!recipients.includes(email)) {
                        recipients.push(email);
                        renderRecipientChips();
                    }
                    tagField.value = '';
                } else if (email) {
                    Toast.warning('Geçerli bir e-posta adresi girin.');
                }
            }
            if (e.key === 'Backspace' && !tagField.value && recipients.length) {
                recipients.pop();
                renderRecipientChips();
            }
        });
    }
}

function renderRecipientChips() {
    const wrap = document.getElementById('tag-wrap');
    const field = document.getElementById('tag-field');
    if (!wrap || !field) return;

    // Mevcut chip'leri temizle, field'ı koru
    wrap.querySelectorAll('.recipient-tag').forEach(el => el.remove());

    const fragment = document.createDocumentFragment();
    recipients.forEach(email => {
        const chip = document.createElement('span');
        chip.className = 'recipient-tag';
        chip.innerHTML = `${Utils.escHtml(email)} <button type="button" data-email="${Utils.escHtml(email)}">✕</button>`;
        chip.querySelector('button').addEventListener('click', () => {
            recipients = recipients.filter(r => r !== email);
            renderRecipientChips();
        });
        fragment.appendChild(chip);
    });

    wrap.insertBefore(fragment, field);
}

// ── KAYDET ─────────────────────────────────────────────────
async function saveSchedule(existingId, existingScenarioPublicId) {
    const errorEl = document.getElementById('sch-error');

    const freq      = document.querySelector('input[name="sch-freq"]:checked')?.value;
    const runtime   = document.getElementById('sch-runtime')?.value;
    const weekday   = parseInt(document.getElementById('sch-weekday')?.value || '1');
    const timezone  = document.getElementById('sch-timezone')?.value;
    const failOnly  = document.getElementById('sch-fail-only')?.checked || false;

    // Yeni plan için senaryo seçimi
    const scenarioPid = existingId
        ? existingScenarioPublicId
        : document.getElementById('sch-scenario')?.value;

    if (!existingId && !scenarioPid) {
        errorEl.textContent = 'Lütfen bir senaryo seçin.';
        errorEl.classList.remove('hidden');
        throw new Error('validation');
    }

    if (freq !== 'HOURLY' && !runtime) {
        errorEl.textContent = 'Çalışma saati zorunludur.';
        errorEl.classList.remove('hidden');
        throw new Error('validation');
    }

    const payload = {
        frequency:          freq,
        runTime:            freq === 'HOURLY' ? null : runtime,
        runDayOfWeek:       freq === 'WEEKLY' ? weekday : null,
        timezone:           timezone || 'Europe/Istanbul',
        recipients,
        notifyOnFailureOnly: failOnly,
    };

    if (existingId) {
        // PUT /api/v1/schedules/{publicId}
        const updated = await Api.put(`/schedules/${existingId}`, payload);
        const idx = allSchedules.findIndex(s => s.publicId === existingId);
        if (idx !== -1) allSchedules[idx] = { ...allSchedules[idx], ...updated };
        Toast.success('Plan güncellendi.');
    } else {
        // POST /api/v1/schedules/scenarios/{scenarioPublicId}
        const created = await Api.post(`/schedules/scenarios/${scenarioPid}`, payload);
        allSchedules.unshift(created);
        Toast.success('Plan oluşturuldu.');
    }

    Modal.close();
    renderGrid();
}