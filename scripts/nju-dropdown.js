/* Shared outlined dropdown used by options and message pages. */
(() => {
    'use strict';
    class NjuDropdown {
        constructor(el) {
            this.el = el;
            this.trigger = el.querySelector('.nju-dropdown-trigger');
            this.menu = el.querySelector('.nju-dropdown-menu');
            this.textEl = el.querySelector('.nju-dropdown-text');
            this.options = [...el.querySelectorAll('li[data-value]')];
            this._value = this.options.find(o => o.classList.contains('active'))?.dataset.value || '';
            this._onChange = null;
            this._onThisDocClick = event => { if (!el.contains(event.target)) this.close(); };
            this._card = el.closest('.card');
            el._njuDropdown = this;
            this.init();
        }

        init() {
            this.trigger.addEventListener('click', () => this.toggle());
            this.trigger.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.toggle(); }
                if (event.key === 'ArrowDown') { event.preventDefault(); if (!this.el.classList.contains('open')) this.open(); this._focusNext(); }
                if (event.key === 'ArrowUp') { event.preventDefault(); if (!this.el.classList.contains('open')) this.open(); this._focusPrev(); }
                if (event.key === 'Escape') { this.close(); this.trigger.focus(); }
            });
            this.bindOptions();
            this.setValue(this._value, true);
            this.menu.hidden = true;
        }

        bindOptions() {
            this.options.forEach(option => {
                option.tabIndex = -1;
                option.setAttribute('role', 'option');
                option.addEventListener('click', () => { this.setValue(option.dataset.value); this.close(); this.trigger.focus(); });
                option.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.setValue(option.dataset.value); this.close(); this.trigger.focus(); }
                    if (event.key === 'Escape') { event.preventDefault(); this.close(); this.trigger.focus(); }
                    if (event.key === 'ArrowDown') { event.preventDefault(); this._focusNext(); }
                    if (event.key === 'ArrowUp') { event.preventDefault(); this._focusPrev(); }
                    if (event.key === 'Tab') this.close();
                });
            });
        }

        open() {
            if (this.select?.matches(':disabled')) return;
            NjuDropdown.closeAll();
            this.menu.hidden = false;
            if (this._card) { this._card.style.position = 'relative'; this._card.style.zIndex = '100'; }
            this.el.classList.add('open');
            this.trigger.setAttribute('aria-expanded', 'true');
            document.addEventListener('pointerdown', this._onThisDocClick);
        }

        close() {
            this.menu.hidden = true;
            if (this._card) { this._card.style.zIndex = ''; this._card.style.position = ''; }
            this.el.classList.remove('open');
            this.trigger.setAttribute('aria-expanded', 'false');
            document.removeEventListener('pointerdown', this._onThisDocClick);
        }

        toggle() { this.el.classList.contains('open') ? this.close() : this.open(); }

        setValue(value, silent = false) {
            if (!silent && this.select?.matches(':disabled')) return;
            this._value = value;
            this.options.forEach(option => {
                const active = option.dataset.value === value;
                option.classList.toggle('active', active);
                option.setAttribute('aria-selected', String(active));
            });
            const selected = this.options.find(option => option.dataset.value === value);
            if (selected) this.textEl.textContent = selected.textContent;
            if (!silent && this._onChange) this._onChange(value);
        }

        getValue() { return this._value; }
        onChange(handler) { this._onChange = handler; return this; }

        _focusNext() {
            const active = this.options.includes(document.activeElement) ? document.activeElement : this.menu.querySelector('li.active') || this.options[0];
            this._setFocus(this.options[(this.options.indexOf(active) + 1) % this.options.length]);
        }

        _focusPrev() {
            const active = this.options.includes(document.activeElement) ? document.activeElement : this.menu.querySelector('li.active') || this.options[0];
            const index = this.options.indexOf(active);
            this._setFocus(this.options[(index - 1 + this.options.length) % this.options.length]);
        }

        _setFocus(option) {
            if (!option) return;
            this.options.forEach(item => item.style.outline = '');
            option.focus();
            option.scrollIntoView({ block: 'nearest' });
        }

        refresh(select = this.select) {
            this.menu.replaceChildren(...[...select.options].map(option => {
                const item = document.createElement('li');
                item.dataset.value = option.value;
                item.textContent = option.textContent;
                return item;
            }));
            this.options = [...this.menu.children];
            this.bindOptions();
            this.setValue(select.value, true);
        }

        static initAll(root = document) {
            root.querySelectorAll('.nju-dropdown').forEach(el => {
                if (!el._njuDropdown) el._njuDropdown = new NjuDropdown(el);
            });
        }

        static closeAll() {
            document.querySelectorAll('.nju-dropdown.open').forEach(el => el._njuDropdown?.close());
        }

        static getById(id) { return document.getElementById(id)?._njuDropdown || null; }

        static fromSelect(select, onChange) {
            const wrapper = document.createElement('div');
            wrapper.className = 'nju-dropdown';
            wrapper.id = `${select.id}-dropdown`;
            wrapper.dataset.name = select.id;
            const trigger = document.createElement('div');
            trigger.className = 'nju-dropdown-trigger';
            trigger.tabIndex = 0;
            trigger.setAttribute('role', 'combobox');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-controls', `${wrapper.id}-menu`);
            const label = document.querySelector(`label[for="${select.id}"]`);
            if (label) {
                label.id ||= `${select.id}-label`;
                trigger.setAttribute('aria-labelledby', label.id);
            }
            const text = document.createElement('span');
            text.className = 'nju-dropdown-text';
            const arrow = document.createElement('span');
            arrow.className = 'nju-dropdown-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '▾';
            trigger.append(text, arrow);
            const menu = document.createElement('ul');
            menu.className = 'nju-dropdown-menu';
            menu.id = `${wrapper.id}-menu`;
            menu.setAttribute('role', 'listbox');
            [...select.options].forEach(option => {
                const item = document.createElement('li');
                item.dataset.value = option.value;
                item.textContent = option.textContent;
                menu.append(item);
            });
            wrapper.append(trigger, menu);
            select.hidden = true;
            select.after(wrapper);
            const instance = new NjuDropdown(wrapper);
            instance.select = select;
            instance.onChange(value => { select.value = value; onChange?.(value); });
            instance.setValue(select.value, true);
            return instance;
        }
    }
    globalThis.NjuDropdown = NjuDropdown;
})();
