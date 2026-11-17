function activateCard(element, action) {
    element.tabIndex = 0;
    element.setAttribute('role', 'button');
    element.addEventListener('click', event => {
        if (!event.target.closest('a, button, input')) action();
    });
    element.addEventListener('keydown', event => {
        if (event.target !== element || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        action();
    });
}

function showPageError(message) {
    document.getElementById('spinner')?.classList.add('hidden');
    const feedback = document.getElementById('page-feedback');
    feedback.querySelector('span').textContent = message;
    feedback.hidden = false;
}

function escapeText(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
}

document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement) event.target.setAttribute('data-image-failed', '');
}, true);
document.addEventListener('load', event => {
    if (event.target instanceof HTMLImageElement) event.target.removeAttribute('data-image-failed');
}, true);

const overlays = [...document.querySelectorAll('.modal-overlay')];
const modalStack = [];
const focusedBeforeModal = new Map();
const focusable = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

function modalControls(overlay) {
    return [...overlay.querySelectorAll(focusable)].filter(control => control.getClientRects().length);
}

const modalObserver = new MutationObserver(() => {
    for (const dialog of overlays) {
        const index = modalStack.indexOf(dialog);
        const visible = !dialog.classList.contains('hidden');
        if (visible && index < 0) {
            focusedBeforeModal.set(dialog, document.activeElement);
            modalStack.push(dialog);
            (modalControls(dialog)[0] || dialog).focus();
        } else if (!visible && index >= 0) {
            modalStack.splice(index, 1);
            focusedBeforeModal.get(dialog)?.focus();
            focusedBeforeModal.delete(dialog);
        }
    }
});
for (const dialog of overlays) {
    dialog.tabIndex = -1;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    modalObserver.observe(dialog, { attributes: true, attributeFilter: ['class'] });
}

document.addEventListener('keydown', event => {
    const dialog = modalStack.at(-1);
    if (!dialog) return;
    if (event.key === 'Escape') {
        dialog.querySelector('.close-btn, .interaction-close-btn, #cancel-btn')?.click();
    }
    if (event.key !== 'Tab') return;
    const controls = modalControls(dialog);
    const first = controls[0];
    const last = controls.at(-1);
    const active = document.activeElement;
    if (!first || !dialog.contains(active) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault();
        (event.shiftKey ? last || dialog : first || dialog).focus();
    }
});
