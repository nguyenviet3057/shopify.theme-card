(function () {
  var BREAKPOINT = 768;
  var MAX_CHIPS = 6;
  var MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  var SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function asString(value) {
    if (Array.isArray(value)) return value[0] ? String(value[0]) : '';
    if (value == null) return '';
    return String(value);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseEventDate(iso) {
    if (!iso) return null;
    var parsed = new Date(iso);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function startOfCalendarGrid(year, month) {
    var first = new Date(year, month, 1);
    var mondayOffset = (first.getDay() + 6) % 7;
    var start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  }

  function formatLongDate(date) {
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function chipColors(event) {
    var tag = event.tags && event.tags[0];
    return {
      bg: event.backgroundColor || (tag && tag.backgroundColor) || '#1D1A17',
      fg: event.textColor || (tag && tag.textColor) || '#ffffff',
    };
  }

  function escapeHtml(value) {
    return asString(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  class GlEventCalendar extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.year = new Date().getFullYear();
      this.minMonth = new Date().getMonth();
      this.events = this.readEvents();
      this.searchQuery = '';
      this.gameFilter = '';
      this.typeFilter = '';
      this.current = new Date(this.year, this.minMonth, 1);

      this.els = {
        monthLabel: this.querySelector('[data-month-label]'),
        gridWrapper: this.querySelector('[data-grid-wrapper]'),
        gridBody: this.querySelector('[data-grid-body]'),
        agenda: this.querySelector('[data-agenda]'),
        skeleton: this.querySelector('[data-skeleton]'),
        empty: this.querySelector('[data-empty]'),
        search: this.querySelector('[data-search]'),
        gameSelect: this.querySelector('[data-game-select]'),
        drawer: this.querySelector('[data-drawer]'),
        drawerBody: this.querySelector('[data-drawer-body]'),
        drawerFooter: this.querySelector('[data-drawer-footer]'),
        drawerTitle: this.querySelector('[data-drawer-title]'),
        backdrop: this.querySelector('[data-backdrop]'),
      };

      this.populateGames();
      this.bind();
      this.render();
    }

    readEvents() {
      var script = this.querySelector('[data-events-json]');
      if (!script) return [];
      try {
        var parsed = JSON.parse(script.textContent);
        var year = this.year;
        var minMonth = this.minMonth;
        return (Array.isArray(parsed) ? parsed : [])
          .map(function (event, index) {
            var date = parseEventDate(event.time);
            if (!date || date.getFullYear() !== year || date.getMonth() < minMonth) return null;
            return {
              id: event.id || String(index),
              title: asString(event.title),
              game: asString(event.game),
              descriptionHtml: event.descriptionHtml || '',
              image: event.image || '',
              time: date,
              ticketUrl: asString(event.ticketUrl),
              textColor: asString(event.textColor),
              backgroundColor: asString(event.backgroundColor),
              tags: Array.isArray(event.tags) ? event.tags : [],
              types: Array.isArray(event.types) ? event.types.map(asString) : [],
            };
          })
          .filter(Boolean)
          .sort(function (a, b) {
            return a.time - b.time;
          });
      } catch (err) {
        console.error('Event calendar JSON failed to parse', err);
        return [];
      }
    }

    populateGames() {
      var select = this.els.gameSelect;
      if (!select) return;
      var games = [];
      this.events.forEach(function (event) {
        if (event.game && games.indexOf(event.game) === -1) games.push(event.game);
      });
      games.sort();
      games.forEach(function (game) {
        var option = document.createElement('option');
        option.value = game;
        option.textContent = game;
        select.appendChild(option);
      });
    }

    bind() {
      var self = this;

      this.querySelectorAll('[data-dir]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var nextMonth = self.current.getMonth() + Number(btn.getAttribute('data-dir'));
          if (nextMonth < self.minMonth || nextMonth > 11) return;
          self.current.setMonth(nextMonth);
          self.render();
        });
      });

      if (this.els.search) {
        this.els.search.addEventListener('input', function () {
          self.searchQuery = self.els.search.value.trim().toLowerCase();
          self.render();
        });
      }

      if (this.els.gameSelect) {
        this.els.gameSelect.addEventListener('change', function () {
          self.gameFilter = self.els.gameSelect.value;
          self.render();
        });
      }

      this.querySelectorAll('[data-type-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.typeFilter = btn.getAttribute('data-type-filter') || '';
          self.querySelectorAll('[data-type-filter]').forEach(function (other) {
            var active = other === btn;
            other.classList.toggle('is-active', active);
            other.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          self.render();
        });
      });

      this.querySelectorAll('[data-drawer-close]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.closeDrawer();
        });
      });

      if (this.els.backdrop) {
        this.els.backdrop.addEventListener('click', function () {
          self.closeDrawer();
        });
      }

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') self.closeDrawer();
      });

      window.addEventListener('resize', function () {
        clearTimeout(self._resizeTimer);
        self._resizeTimer = setTimeout(function () {
          self.render();
        }, 150);
      });
    }

    isMobile() {
      return window.innerWidth < BREAKPOINT;
    }

    filteredEvents() {
      var query = this.searchQuery;
      var game = this.gameFilter;
      var typeFilter = this.typeFilter;
      return this.events.filter(function (event) {
        if (typeFilter && (event.types || []).indexOf(typeFilter) === -1) return false;
        if (game && event.game !== game) return false;
        if (!query) return true;
        var haystack = [event.title, event.game]
          .concat(
            event.tags.map(function (tag) {
              return asString(tag.title);
            })
          )
          .join(' ')
          .toLowerCase();
        if (event.descriptionHtml) {
          haystack += ' ' + event.descriptionHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
        }
        return haystack.indexOf(query) !== -1;
      });
    }

    eventsForMonth(events) {
      var year = this.current.getFullYear();
      var month = this.current.getMonth();
      return events.filter(function (event) {
        return event.time.getFullYear() === year && event.time.getMonth() === month;
      });
    }

    groupByDay(events) {
      var groups = {};
      events.forEach(function (event) {
        var key = dateKey(event.time);
        if (!groups[key]) groups[key] = [];
        groups[key].push(event);
      });
      Object.keys(groups).forEach(function (key) {
        groups[key].sort(function (a, b) {
          return a.time - b.time;
        });
      });
      return groups;
    }

    updateYearNav() {
      var month = this.current.getMonth();
      var minMonth = this.minMonth;
      this.querySelectorAll('[data-dir]').forEach(function (btn) {
        var dir = Number(btn.getAttribute('data-dir'));
        btn.disabled = (dir < 0 && month <= minMonth) || (dir > 0 && month >= 11);
      });
    }

    render() {
      if (this.els.skeleton) this.els.skeleton.hidden = true;
      this.updateYearNav();

      var monthEvents = this.eventsForMonth(this.filteredEvents());
      this.els.monthLabel.textContent =
        MONTH_NAMES[this.current.getMonth()] + ', ' + this.current.getFullYear();

      var mode = this.isMobile() ? 'agenda' : 'grid';
      this.els.gridWrapper.hidden = mode !== 'grid';
      this.els.agenda.hidden = mode !== 'agenda';

      if (!monthEvents.length) {
        this.els.agenda.innerHTML = '';
        this.els.empty.hidden = mode === 'grid';
        if (mode === 'grid') {
          this.renderGrid([]);
        } else {
          this.els.gridWrapper.hidden = true;
          this.els.agenda.hidden = true;
        }
        return;
      }

      this.els.empty.hidden = true;

      if (mode === 'grid') this.renderGrid(monthEvents);
      else this.renderAgenda(monthEvents);
    }

    renderGrid(events) {
      var self = this;
      var grouped = this.groupByDay(events);
      var start = startOfCalendarGrid(this.current.getFullYear(), this.current.getMonth());
      var todayKey = dateKey(new Date());
      var html = '';

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      for (var i = 0; i < 42; i++) {
        var day = new Date(start);
        day.setDate(start.getDate() + i);
        day.setHours(0, 0, 0, 0);
        var key = dateKey(day);
        var inMonth = day.getMonth() === this.current.getMonth();
        var isPast = day < today;
        var isToday = key === todayKey;
        var dayEvents = grouped[key] || [];
        var extra = dayEvents.length - MAX_CHIPS;
        var visible = dayEvents.slice(0, MAX_CHIPS);
        var cellClass = 'gl-event-calendar__cell';
        if (!inMonth) cellClass += ' gl-event-calendar__cell--other-month';
        if (isPast) cellClass += ' gl-event-calendar__cell--past';
        if (isToday) cellClass += ' gl-event-calendar__cell--today';

        html += '<div class="' + cellClass + '">';
        html += '<div class="gl-event-calendar__cell-date">' + day.getDate() + '</div>';
        html += '<div class="gl-event-calendar__cell-events">';
        visible.forEach(function (event) {
          html += self.chipHtml(event);
        });
        if (extra > 0) {
          html +=
            '<button type="button" class="gl-event-calendar__more-btn" data-more-day="' +
            key +
            '">+' +
            extra +
            ' more</button>';
        }
        html += '</div></div>';
      }

      this.els.gridBody.innerHTML = html;
      this.bindEventButtons(this.els.gridBody, grouped);
    }

    renderAgenda(events) {
      this.els.agenda.innerHTML = this.agendaHtml(events);
      this.bindEventButtons(this.els.agenda);
    }

    agendaHtml(events) {
      var grouped = this.groupByDay(events);
      var keys = Object.keys(grouped).sort();
      var html = '';

      keys.forEach(function (key) {
        var first = grouped[key][0].time;
        html +=
          '<div class="gl-event-calendar__agenda-day"><div class="gl-event-calendar__agenda-date">' +
          WEEKDAYS[(first.getDay() + 6) % 7] +
          ', ' +
          SHORT_MONTHS[first.getMonth()] +
          ' ' +
          first.getDate() +
          '</div><div class="gl-event-calendar__agenda-events">';
        grouped[key].forEach(function (event) {
          var colors = chipColors(event);
          html +=
            '<button type="button" class="gl-event-calendar__agenda-item" data-event-id="' +
            escapeHtml(event.id) +
            '" style="--chip-bg:' +
            escapeHtml(colors.bg) +
            ';--chip-text:' +
            escapeHtml(colors.fg) +
            '">' +
            escapeHtml(event.title) +
            '</button>';
        });
        html += '</div></div>';
      });

      return html;
    }

    chipHtml(event) {
      var colors = chipColors(event);
      return (
        '<button type="button" class="gl-event-calendar__chip" data-event-id="' +
        escapeHtml(event.id) +
        '" style="--chip-bg:' +
        escapeHtml(colors.bg) +
        ';--chip-text:' +
        escapeHtml(colors.fg) +
        '">' +
        escapeHtml(event.title) +
        '</button>'
      );
    }

    bindEventButtons(root, grouped) {
      var self = this;
      root.querySelectorAll('[data-event-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var event = self.events.find(function (item) {
            return String(item.id) === String(btn.getAttribute('data-event-id'));
          });
          if (event) self.openEvent(event);
        });
      });
      root.querySelectorAll('[data-more-day]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.getAttribute('data-more-day');
          self.openDayList(key, (grouped && grouped[key]) || []);
        });
      });
    }

    openEvent(event) {
      var colors = chipColors(event);
      var tagsHtml = (event.tags || [])
        .map(function (tag) {
          return (
            '<span class="gl-event-calendar__drawer-badge" style="background:' +
            escapeHtml(tag.backgroundColor || colors.bg) +
            ';color:' +
            escapeHtml(tag.textColor || colors.fg) +
            '">' +
            escapeHtml(tag.title) +
            '</span>'
          );
        })
        .join('');

      this.els.drawerTitle.textContent = 'Event Details';
      this.els.drawerBody.innerHTML =
        (event.image
          ? '<img class="gl-event-calendar__drawer-image" src="' +
            escapeHtml(event.image) +
            '" alt="' +
            escapeHtml(event.title) +
            '">'
          : '') +
        tagsHtml +
        '<h4 class="gl-event-calendar__drawer-event-name">' +
        escapeHtml(event.title) +
        '</h4>' +
        '<p class="gl-event-calendar__drawer-date">' +
        formatLongDate(event.time) +
        ' · ' +
        formatTime(event.time) +
        '</p>' +
        (event.game ? '<p class="gl-event-calendar__drawer-game">' + escapeHtml(event.game) + '</p>' : '') +
        (event.descriptionHtml
          ? '<div class="gl-event-calendar__drawer-description">' + event.descriptionHtml + '</div>'
          : '');

      this.setDrawerFooter(
        event.ticketUrl
          ? '<a class="gl-event-calendar__drawer-ticket" href="' +
            escapeHtml(event.ticketUrl) +
            '" target="_blank" rel="noopener noreferrer">Buy Ticket</a>'
          : ''
      );

      this.openDrawer();
    }

    openDayList(key, events) {
      var self = this;
      this.els.drawerTitle.textContent = 'Events';
      this.els.drawerBody.innerHTML =
        '<div class="gl-event-calendar__overflow-list">' +
        events
          .map(function (event) {
            var colors = chipColors(event);
            return (
              '<button type="button" class="gl-event-calendar__overflow-item" data-event-id="' +
              escapeHtml(event.id) +
              '"><span class="gl-event-calendar__overflow-dot" style="background:' +
              escapeHtml(colors.bg) +
              '"></span><span class="gl-event-calendar__overflow-name">' +
              escapeHtml(event.title) +
              '</span><span class="gl-event-calendar__overflow-time">' +
              formatTime(event.time) +
              '</span></button>'
            );
          })
          .join('') +
        '</div>';
      this.setDrawerFooter('');
      this.openDrawer();
      this.els.drawerBody.querySelectorAll('[data-event-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var event = self.events.find(function (item) {
            return String(item.id) === String(btn.getAttribute('data-event-id'));
          });
          if (event) self.openEvent(event);
        });
      });
    }

    setDrawerFooter(html) {
      var footer = this.els.drawerFooter;
      if (!footer) return;
      footer.innerHTML = html || '';
      footer.hidden = !html;
    }

    openDrawer() {
      if (!this.els.drawer || !this.els.backdrop) return;

      var drawer = this.els.drawer;
      var backdrop = this.els.backdrop;
      this.clearDrawerCloseWait();

      drawer.hidden = false;
      backdrop.hidden = false;
      drawer.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';

      if (drawer.classList.contains('is-open')) return;

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          drawer.classList.add('is-open');
          backdrop.classList.add('is-open');
        });
      });
    }

    closeDrawer() {
      if (!this.els.drawer || !this.els.backdrop) return;

      var drawer = this.els.drawer;
      var backdrop = this.els.backdrop;
      var self = this;

      if (!drawer.classList.contains('is-open') && drawer.hidden) return;

      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';

      function finish() {
        self.clearDrawerCloseWait();
        drawer.hidden = true;
        backdrop.hidden = true;
      }

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
      }

      this._onDrawerCloseEnd = function (event) {
        if (event.target !== drawer) return;
        finish();
      };
      drawer.addEventListener('transitionend', this._onDrawerCloseEnd);
      this._drawerCloseTimer = setTimeout(finish, 320);
    }

    clearDrawerCloseWait() {
      if (this._onDrawerCloseEnd && this.els.drawer) {
        this.els.drawer.removeEventListener('transitionend', this._onDrawerCloseEnd);
      }
      this._onDrawerCloseEnd = null;
      if (this._drawerCloseTimer) {
        clearTimeout(this._drawerCloseTimer);
        this._drawerCloseTimer = null;
      }
    }
  }

  if (!customElements.get('gl-event-calendar')) {
    customElements.define('gl-event-calendar', GlEventCalendar);
  }
})();