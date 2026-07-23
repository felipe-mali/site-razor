// AUTOCOMPLETE DE ENDEREÇOS — Razor Indústria
// Powered by OpenStreetMap Nominatim (gratuito, sem API key)

(function () {
  'use strict';

  // ══════════════════════════════════════════════
  //  CONFIGURAÇÃO
  // ══════════════════════════════════════════════
  const CONFIG = {
    debounceMs: 350,
    minChars: 3,
    maxResults: 6,
    country: 'br',
    language: 'pt-BR',
    biasBounds: { south: -34.0, west: -74.0, north: 5.0, east: -34.0 }, // Brasil
  };

  // ══════════════════════════════════════════════
  //  CLASSE AUTOCOMPLETE
  // ══════════════════════════════════════════════
  class AddressAutocomplete {
    constructor(inputEl, options = {}) {
      this.input = inputEl;
      this.config = { ...CONFIG, ...options };
      this.isOpen = false;
      this.isLoading = false;
      this.suggestions = [];
      this.activeIndex = -1;
      this.abortController = null;
      this.debounceTimer = null;

      this._buildDOM();
      this._bindEvents();
    }

    // ─── Construção do DOM ───
    _buildDOM() {
      // Wrapper
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'ac-wrapper';
      this.input.parentNode.insertBefore(this.wrapper, this.input);
      this.wrapper.appendChild(this.input);

      // Lista de sugestões
      this.listEl = document.createElement('div');
      this.listEl.className = 'ac-list';
      this.listEl.setAttribute('role', 'listbox');
      this.listEl.style.display = 'none';
      this.wrapper.appendChild(this.listEl);

      // Loader
      this.loaderEl = document.createElement('div');
      this.loaderEl.className = 'ac-loader';
      this.loaderEl.innerHTML = '<span class="ac-spinner"></span><span class="ac-loader-text">Buscando endereços...</span>';
      this.loaderEl.style.display = 'none';
      this.wrapper.appendChild(this.loaderEl);
    }

    // ─── Eventos ───
    _bindEvents() {
      this.input.addEventListener('input', () => this._onInput());
      this.input.addEventListener('keydown', (e) => this._onKeydown(e));
      this.input.addEventListener('focus', () => this._onFocus());
      this.input.addEventListener('blur', () => setTimeout(() => this._close(), 200));

      // Fechar ao clicar fora
      document.addEventListener('click', (e) => {
        if (!this.wrapper.contains(e.target)) {
          this._close();
        }
      });
    }

    _onInput() {
      clearTimeout(this.debounceTimer);
      const query = this.input.value.trim();

      if (query.length < this.config.minChars) {
        this._close();
        this._hideLoader();
        return;
      }

      this._showLoader();
      this.debounceTimer = setTimeout(() => this._fetch(query), this.config.debounceMs);
    }

    _onFocus() {
      if (this.suggestions.length > 0 && this.input.value.trim().length >= this.config.minChars) {
        this._open();
      }
    }

    _onKeydown(e) {
      if (!this.isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this._navigate(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._navigate(-1);
          break;
        case 'Enter':
          e.preventDefault();
          if (this.activeIndex >= 0) {
            this._select(this.suggestions[this.activeIndex]);
          }
          break;
        case 'Escape':
          this._close();
          this.input.blur();
          break;
      }
    }

    // ─── Busca à API ───
    async _fetch(query) {
      // Cancelar busca anterior
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();

      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: this.config.maxResults.toString(),
          countrycodes: this.config.country,
          'accept-language': this.config.language,
        });

        // Bias para Brasil
        const b = this.config.biasBounds;
        params.append('viewbox', `${b.west},${b.north},${b.east},${b.south}`);
        params.append('bounded', '0');

        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          signal: this.abortController.signal,
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!res.ok) throw new Error('Erro na busca');

        const data = await res.json();
        this.suggestions = data.map((item) => ({
          displayName: item.display_name,
          shortName: this._formatShortName(item),
          city: item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || '',
          state: item.address?.state || '',
          street: item.address?.road || item.address?.pedestrian || '',
          number: item.address?.house_number || '',
          fullAddress: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        }));

        this._hideLoader();
        this._renderList(query);
      } catch (err) {
        if (err.name !== 'AbortError') {
          this._hideLoader();
          this._close();
        }
      }
    }

    _formatShortName(item) {
      const a = item.address || {};
      const parts = [];
      if (a.road || a.pedestrian) {
        let street = a.road || a.pedestrian;
        if (a.house_number) street += `, ${a.house_number}`;
        parts.push(street);
      }
      const city = a.city || a.town || a.village || a.municipality || '';
      if (city) parts.push(city);
      if (a.state) parts.push(a.state);
      return parts.join(' — ');
    }

    // ─── Renderizar lista ───
    _renderList(query) {
      this.listEl.innerHTML = '';
      this.activeIndex = -1;

      if (this.suggestions.length === 0) {
        this.listEl.innerHTML = `<div class="ac-empty">Nenhum endereço encontrado para "<strong>${this._escapeHtml(query)}</strong>"</div>`;
        this._open();
        return;
      }

      this.suggestions.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'ac-item';
        el.setAttribute('role', 'option');
        el.dataset.index = index;

        const highlighted = this._highlight(item.shortName, query);

        el.innerHTML = `
          <div class="ac-item-icon">📍</div>
          <div class="ac-item-text">
            <div class="ac-item-main">${highlighted}</div>
            <div class="ac-item-secondary">${this._escapeHtml(item.displayName)}</div>
          </div>
        `;

        el.addEventListener('mouseenter', () => this._setActive(index));
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this._select(item);
        });

        this.listEl.appendChild(el);
      });

      this._open();
    }

    _highlight(text, query) {
      const escaped = this._escapeHtml(text);
      const words = query.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regex = new RegExp(`(${words.join('|')})`, 'gi');
      return escaped.replace(regex, '<strong>$1</strong>');
    }

    _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // ─── Navegação por teclado ───
    _navigate(dir) {
      const items = this.listEl.querySelectorAll('.ac-item');
      if (items.length === 0) return;

      this.activeIndex = Math.max(-1, Math.min(this.suggestions.length - 1, this.activeIndex + dir));

      items.forEach((el, i) => {
        el.classList.toggle('ac-item--active', i === this.activeIndex);
        if (i === this.activeIndex) {
          el.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    _setActive(index) {
      this.activeIndex = index;
      const items = this.listEl.querySelectorAll('.ac-item');
      items.forEach((el, i) => {
        el.classList.toggle('ac-item--active', i === index);
      });
    }

    // ─── Selecionar item ───
    _select(item) {
      this.input.value = item.shortName;
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
      this._close();
      this.input.focus();
    }

    // ─── Controle do estado ───
    _open() {
      this.listEl.style.display = 'block';
      this.isOpen = true;
    }

    _close() {
      this.listEl.style.display = 'none';
      this.isOpen = false;
      this.activeIndex = -1;
      this._hideLoader();
    }

    _showLoader() {
      this.isLoading = true;
      this.loaderEl.style.display = 'flex';
    }

    _hideLoader() {
      this.isLoading = false;
      this.loaderEl.style.display = 'none';
    }

    // ─── Destruição ───
    destroy() {
      clearTimeout(this.debounceTimer);
      if (this.abortController) this.abortController.abort();
      this.wrapper.parentNode.insertBefore(this.input, this.wrapper);
      this.wrapper.remove();
    }
  }

  // ══════════════════════════════════════════════
  //  INICIALIZAÇÃO
  // ══════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    const campoCidade = document.getElementById('cidade');
    if (campoCidade) {
      new AddressAutocomplete(campoCidade, {
        country: 'br',
        language: 'pt-BR',
      });
    }
  });

  // Expor classe para uso externo
  window.AddressAutocomplete = AddressAutocomplete;

})();
