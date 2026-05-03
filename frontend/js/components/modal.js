// Generic modal bileşeni; title + content HTML + aksyon butonları
const Modal = (() => {

    let _activeModal = null;

    function open({
                      title = '',
                      contentHTML = '',
                      confirmLabel = 'Kaydet',
                      cancelLabel = 'Vazgeç',
                      onConfirm = null,
                      onCancel = null,
                      showCancel = true,
                      size = 'md', // sm | md | lg
                      danger = false,
                  } = {}) {
        close(); // önceki varsa kapat

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');

        backdrop.innerHTML = `
            <div class="modal modal-${size}" role="document">
                <div class="modal-header">
                    <h2 class="modal-title">${Utils.escHtml(title)}</h2>
                    <button class="btn-icon modal-close-btn" aria-label="Kapat">✕</button>
                </div>
                <div class="modal-body">${contentHTML}</div>
                <div class="modal-footer">
                    ${showCancel ? `<button class="btn btn-ghost modal-cancel">${Utils.escHtml(cancelLabel)}</button>` : ''}
                    ${onConfirm ? `<button class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm">${Utils.escHtml(confirmLabel)}</button>` : ''}
                </div>
            </div>`;

        // Kapatma olayları
        backdrop.querySelector('.modal-close-btn').addEventListener('click', () => {
            close();
            onCancel?.();
        });

        backdrop.querySelector('.modal-cancel')?.addEventListener('click', () => {
            close();
            onCancel?.();
        });

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) { close(); onCancel?.(); }
        });

        backdrop.querySelector('.modal-confirm')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span>';
            try {
                await onConfirm?.(backdrop);
            } finally {
                if (backdrop.isConnected) {
                    btn.disabled = false;
                    btn.textContent = confirmLabel;
                }
            }
        });

        // Escape ile kapat
        const onKeyDown = (e) => {
            if (e.key === 'Escape') { close(); onCancel?.(); }
        };
        document.addEventListener('keydown', onKeyDown);
        backdrop._onKeyDown = onKeyDown;

        document.body.appendChild(backdrop);
        _activeModal = backdrop;

        // İlk input'a fokuslan
        setTimeout(() => {
            const first = backdrop.querySelector('input, select, textarea');
            first?.focus();
        }, 50);

        return backdrop;
    }

    function close() {
        if (_activeModal) {
            document.removeEventListener('keydown', _activeModal._onKeyDown);
            _activeModal.remove();
            _activeModal = null;
        }
    }

    /** Modal içindeki elemana kolayca ulaşmak için */
    function getElement(selector) {
        return _activeModal?.querySelector(selector) ?? null;
    }

    /** Modal'ın kendisi (form okuma vb. için) */
    function getModal() {
        return _activeModal;
    }

    return { open, close, getElement, getModal };
})();