// Avisos não bloqueantes (substituem alert()).
// showToast(mensagem, 'info' | 'success' | 'error')
// deferToast(mensagem, tipo): guarda o aviso para a próxima página (útil antes de redirecionar).
(() => {
    const KEY = 'pokebravara:toast';
    let region = null;

    function ensureRegion() {
        if (region) return region;
        region = document.createElement('div');
        region.className = 'toast-region';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        document.body.append(region);
        return region;
    }

    window.showToast = function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        const remove = () => toast.remove();
        toast.addEventListener('click', remove);
        ensureRegion().append(toast);
        setTimeout(remove, type === 'error' ? 7000 : 4500);
    };

    window.deferToast = function deferToast(message, type = 'info') {
        try { sessionStorage.setItem(KEY, JSON.stringify({ message, type })); } catch { /* sem sessionStorage */ }
    };

    function showPending() {
        try {
            const pending = JSON.parse(sessionStorage.getItem(KEY) || 'null');
            sessionStorage.removeItem(KEY);
            if (pending?.message) window.showToast(pending.message, pending.type);
        } catch { /* ignorar */ }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showPending);
    else showPending();
})();
