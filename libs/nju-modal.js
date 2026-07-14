// libs/nju-modal.js — MD3 Modal & Outlined Input

(function (global) {
    'use strict';

    const Ease = {
        decelerate: 'cubic-bezier(0, 0, 0, 1)',
        accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
        bounce:     'cubic-bezier(0.18, 1.25, 0.4, 1)',
    };

    const STYLE_ID = 'nju-modal-style';

    // SVG: Material Icons Round — close (24px)
    const CLOSE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;

    // ── Style Injection ──────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
/* nju-modal — injected (uses host CSS variables as first choice, falls back to static values) */
.nju-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0);display:flex;align-items:center;justify-content:center;z-index:100000;pointer-events:none;padding:20px; }
.nju-modal-overlay.nju-active { pointer-events:auto; }
.nju-modal { background:var(--md-sys-color-surface-container-lowest, #E2E2E9);border-radius:28px;width:560px;max-width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 4px 8px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.08);opacity:0;transform:scale(0.85) translateY(24px);will-change:transform,opacity;overflow:hidden; }
.nju-modal-header { display:flex;align-items:center;justify-content:space-between;padding:24px 24px 16px;flex-shrink:0; }
.nju-modal-title { font-size:20px;font-weight:600;color:var(--md-sys-color-on-surface, #1A1B21);margin:0; }
.nju-modal-close { display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;background:none;border:none;color:var(--md-sys-color-on-surface-variant, #44474F);cursor:pointer;flex-shrink:0;transition:background-color 250ms ${Ease.decelerate},transform 120ms ${Ease.bounce}; }
.nju-modal-close:hover { background:var(--md-sys-color-surface-container-high, #E8E8EF);color:var(--md-sys-color-on-surface, #1A1B21); }
.nju-modal-close:active { transform:scale(0.9); }
.nju-modal-body { padding:0 24px 24px;overflow-y:auto;flex:1;color:var(--md-sys-color-on-surface-variant, #44474F);font-size:14px;line-height:1.6; }
.nju-modal-footer { display:flex;gap:8px;justify-content:flex-end;padding:0 24px 24px;flex-shrink:0; }
.nju-btn { padding:10px 24px;border-radius:20px;border:none;font-weight:600;font-size:14px;cursor:pointer;transition:background-color 200ms ${Ease.decelerate},box-shadow 200ms ${Ease.decelerate}; }
.nju-btn-secondary { background:transparent;color:var(--md-sys-color-on-surface, #1A1B21); }
.nju-btn-secondary:hover { background:var(--md-sys-color-surface-container-high, #E8E8EF); }
.nju-btn-primary { background:var(--md-sys-color-primary, #4A90D9);color:var(--md-sys-color-on-primary, #fff); }
.nju-btn-primary:hover { box-shadow:0 1px 3px rgba(0,0,0,0.2),0 4px 8px rgba(0,0,0,0.12); }
.nju-btn-danger { background:var(--md-sys-color-error, #BA1A1A);color:var(--md-sys-color-on-error, #fff); }
.nju-btn-danger:hover { box-shadow:0 1px 3px rgba(186,26,26,0.3),0 4px 8px rgba(186,26,26,0.2); }
@media (prefers-reduced-motion:reduce) { .nju-modal-overlay,.nju-modal,.nju-modal-close,.nju-btn{transition-duration:0.01ms!important;animation-duration:0.01ms!important;} }
`;
        document.head.appendChild(style);
    }

    // ── openModal ────────────────────────────────────────────────

    function openModal(title, bodyHtml) {
        injectStyles();

        // Remove any existing modal
        const existing = document.querySelector('.nju-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'nju-modal-overlay';
        overlay.innerHTML = `
            <div class="nju-modal">
                <div class="nju-modal-header">
                    <h2 class="nju-modal-title">${title}</h2>
                    <button class="nju-modal-close" type="button" aria-label="关闭">${CLOSE_ICON}</button>
                </div>
                <div class="nju-modal-body">${bodyHtml}</div>
            </div>
        `;

        // Close button
        overlay.querySelector('.nju-modal-close').addEventListener('click', closeModal);

        // Click overlay to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        // Store for cleanup
        overlay._escHandler = escHandler;

        document.body.appendChild(overlay);

        // Entrance animation
        requestAnimationFrame(() => {
            overlay.classList.add('nju-active');
            overlay.animate(
                { backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.32)'] },
                { duration: 300, easing: Ease.decelerate, fill: 'forwards' }
            );
            const modal = overlay.querySelector('.nju-modal');
            modal.animate(
                [
                    { opacity: 0, transform: 'scale(0.82) translateY(32px)' },
                    { opacity: 1, transform: 'scale(1) translateY(0)' },
                ],
                { duration: 450, easing: Ease.bounce, fill: 'forwards' }
            );
        });

        return overlay;
    }

    // ── closeModal ───────────────────────────────────────────────

    function closeModal() {
        const overlay = document.querySelector('.nju-modal-overlay');
        if (!overlay) return;

        // Clean up Escape listener
        if (overlay._escHandler) {
            document.removeEventListener('keydown', overlay._escHandler);
        }

        const modal = overlay.querySelector('.nju-modal');
        if (!modal) { overlay.remove(); return; }

        overlay.animate(
            { backgroundColor: ['rgba(0,0,0,0.32)', 'rgba(0,0,0,0)'] },
            { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
        );
        const anim = modal.animate(
            [
                { opacity: 1, transform: 'scale(1) translateY(0)' },
                { opacity: 0, transform: 'scale(0.92) translateY(12px)' },
            ],
            { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
        );
        anim.onfinish = () => overlay.remove();
    }

    // ── alert (promise-based) ────────────────────────────────────

    function modalAlert(title, message) {
        return new Promise((resolve) => {
            const bodyHtml = `
                <p style="margin:0;color:#44474F">${message}</p>
                <div class="nju-modal-footer" style="padding:24px 0 0">
                    <button class="nju-btn nju-btn-primary" id="nju-alert-ok">知道了</button>
                </div>
            `;
            openModal(title, bodyHtml);
            const btn = document.getElementById('nju-alert-ok');
            if (btn) {
                btn.addEventListener('click', () => {
                    closeModal();
                    resolve();
                });
            }
        });
    }

    // ── showConfirm ──────────────────────────────────────────────

    function showConfirm({ title, message, confirmText = '确认', cancelText = '取消', danger = false, onConfirm }) {
        const btnClass = danger ? 'nju-btn-danger' : 'nju-btn-primary';
        const bodyHtml = `
            <p style="margin:0 0 24px;color:#44474F">${message}</p>
            <div class="nju-modal-footer" style="padding:0">
                <button class="nju-btn nju-btn-secondary" id="nju-confirm-cancel">${cancelText}</button>
                <button class="nju-btn ${btnClass}" id="nju-confirm-ok">${confirmText}</button>
            </div>
        `;
        openModal(title, bodyHtml);

        document.getElementById('nju-confirm-cancel').addEventListener('click', closeModal);
        document.getElementById('nju-confirm-ok').addEventListener('click', () => {
            if (onConfirm) onConfirm();
            closeModal();
        });
    }

    // ── createMdInput factory ────────────────────────────────────

    function createMdInput({ id, label, type = 'text', value = '', required = false }) {
        return `
            <div class="nju-input-group">
                <input class="nju-input" id="${id}" type="${type}"
                       placeholder=" " ${required ? 'required' : ''}
                       value="${escapeHtml(value)}">
                <label class="nju-label" for="${id}">${label}</label>
                <fieldset class="nju-border" aria-hidden="true">
                    <legend><span>${label}</span></legend>
                </fieldset>
            </div>
        `;
    }

    function createMdTextarea({ id, label, rows = 5, value = '' }) {
        return `
            <div class="nju-input-group">
                <textarea class="nju-input" id="${id}" placeholder=" "
                          rows="${rows}" style="resize:none">${escapeHtml(value)}</textarea>
                <label class="nju-label" for="${id}">${label}</label>
                <fieldset class="nju-border" aria-hidden="true">
                    <legend><span>${label}</span></legend>
                </fieldset>
            </div>
        `;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Exports ──────────────────────────────────────────────────

    const NjuModal = {
        open: openModal,
        close: closeModal,
        alert: modalAlert,
        confirm: showConfirm,
        createMdInput,
        createMdTextarea,
    };

    // Support both module and direct script inclusion
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NjuModal;
    }
    global.NjuModal = NjuModal;

})(typeof window !== 'undefined' ? window : this);
