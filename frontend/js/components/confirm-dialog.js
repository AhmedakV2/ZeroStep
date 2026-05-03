// Confirm dialog; silme/tehlikeli işlemler için özelleşmiş modal
const ConfirmDialog = (() => {

    /**
     * @param {Object} options
     * @param {string} options.title
     * @param {string} options.message
     * @param {string} [options.confirmLabel]
     * @param {Function} options.onConfirm - async () => void
     */
    function show({
                      title = 'Emin misiniz?',
                      message = '',
                      confirmLabel = 'Sil',
                      onConfirm,
                  } = {}) {
        return Modal.open({
            title,
            contentHTML: `<p style="color:var(--clr-text-muted);font-size:.9rem;line-height:1.6">${Utils.escHtml(message)}</p>`,
            confirmLabel,
            cancelLabel: 'Vazgeç',
            danger: true,
            onConfirm,
        });
    }

    return { show };
})();