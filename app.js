(function () {
  'use strict';

  var MEDIA = ['music', 'cinema', 'tv'];
  var CATALOG_PREFIX = { music: 'MUS', cinema: 'CIN', tv: 'TVS' };

  var gallery = document.getElementById('gallery');
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  var glow = document.querySelector('.tab-bar__glow');

  var data = { music: [], cinema: [], tv: [] };
  var active = 'music';
  var switching = false;

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // djb2 string hash — deterministic per title+artist, so a track's
  // waveform never changes between page loads, but no two tracks
  // are likely to share the same shape.
  function hashString(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateWaveform(seedText, bars) {
    bars = bars || 38;
    var rand = mulberry32(hashString(seedText));
    var freqA = 1.5 + rand() * 2.5;
    var freqB = 3 + rand() * 4;
    var phase = rand() * Math.PI * 2;
    var heights = [];
    for (var i = 0; i < bars; i++) {
      var t = i / (bars - 1);
      var envelope = Math.sin(Math.PI * t);
      var wave = Math.sin(t * Math.PI * freqA + phase) * 0.5 + Math.sin(t * Math.PI * freqB) * 0.3;
      var noise = (rand() - 0.5) * 0.35;
      var h = 0.16 + envelope * (0.55 + wave * 0.3 + noise);
      h = Math.max(0.08, Math.min(1, h));
      heights.push(Math.round(h * 100));
    }
    return heights;
  }

  function catalogNumber(medium, index) {
    var n = String(index + 1);
    while (n.length < 3) n = '0' + n;
    return CATALOG_PREFIX[medium] + '-' + n;
  }

  function waveformHTML(seedText) {
    return generateWaveform(seedText).map(function (h) {
      return '<span style="height:' + h + '%"></span>';
    }).join('');
  }

  function cardHTML(medium, item, index) {
    var catalog = catalogNumber(medium, index);
    var title = escapeHtml(item.title);
    var color1 = escapeHtml(item.color1 || '#2a2a2e');
    var color2 = escapeHtml(item.color2 || '#48484e');
    var image = escapeHtml(item.image || '');
    var styleAttr = 'style="--c1:' + color1 + ';--c2:' + color2 + '"';

    var body;

    if (medium === 'music') {
      var lyric = item.lyric ? escapeHtml(item.lyric) : '';
      body =
        '<div class="piece__panel">' +
          '<div class="piece__row">' +
            '<div class="piece__thumb"><img src="' + image + '" alt="' + title + ' cover art" loading="lazy"></div>' +
            '<div class="piece__text">' +
              '<p class="piece__title">' + title + '</p>' +
              '<p class="piece__meta">' + escapeHtml(item.artist) +
                ' <span class="piece__year">— ' + escapeHtml(item.year) + '</span></p>' +
            '</div>' +
          '</div>' +
          '<div class="piece__waveform" aria-hidden="true">' +
            waveformHTML(item.title + '|' + item.artist) +
          '</div>' +
          (lyric ? '<p class="piece__lyric">\u201C' + lyric + '\u201D</p>' : '') +
        '</div>';
    } else {
      // Cinema and TV never carry a waveform — only Music does.
      var person = medium === 'cinema' ? item.director : item.creator;
      var secondary = medium === 'cinema'
        ? escapeHtml(item.year)
        : escapeHtml(item.seasons) + (String(item.seasons) === '1' ? ' season' : ' seasons');
      body =
        '<div class="piece__window is-wide">' +
          '<img src="' + image + '" alt="' + title + ' still" loading="lazy">' +
        '</div>' +
        '<div class="piece__plate">' +
          '<p class="piece__title">' + title + '</p>' +
          '<p class="piece__meta">' + escapeHtml(person) +
            ' <span class="piece__year">— ' + secondary + '</span></p>' +
          (item.quote ? '<p class="piece__quote">' + escapeHtml(item.quote) + '</p>' : '') +
        '</div>';
    }

    return (
      '<article class="piece" ' + styleAttr + '>' +
        '<div class="piece__inner">' +
          '<span class="piece__catalog">' + catalog + '</span>' +
          body +
        '</div>' +
      '</article>'
    );
  }

  function emptyHTML(medium) {
    var label = medium === 'tv' ? 'TV' : medium.charAt(0).toUpperCase() + medium.slice(1);
    return (
      '<div class="empty-state">' +
        '<p>Nothing added to ' + label + ' yet.</p>' +
        '<p>The best of it will show up here.</p>' +
      '</div>'
    );
  }

  function renderActive() {
    var items = data[active] || [];
    gallery.innerHTML = items.length
      ? items.map(function (item, i) { return cardHTML(active, item, i); }).join('')
      : emptyHTML(active);
  }

  function moveGlow(btn) {
    if (!glow || !btn) return;
    glow.style.width = btn.offsetWidth + 'px';
    glow.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
  }

  function setActiveTab(medium) {
    tabButtons.forEach(function (btn) {
      var isActive = btn.dataset.medium === medium;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'true' : 'false');
      if (isActive) moveGlow(btn);
    });
  }

  function switchTo(medium) {
    if (medium === active || switching) return;
    switching = true;
    active = medium;
    setActiveTab(medium);
    gallery.classList.add('is-switching');
    window.setTimeout(function () {
      renderActive();
      gallery.classList.remove('is-switching');
      switching = false;
    }, 180);
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { switchTo(btn.dataset.medium); });
  });

  window.addEventListener('resize', function () {
    var current = tabButtons.filter(function (b) { return b.classList.contains('active'); })[0];
    moveGlow(current);
  });

  // Subtle tap response — a quick settle animation so the wall feels alive.
  gallery.addEventListener('click', function (e) {
    var card = e.target.closest('.piece');
    if (!card) return;
    card.classList.remove('is-tapped');
    void card.offsetWidth; // restart the animation even on rapid re-taps
    card.classList.add('is-tapped');
  });

  gallery.addEventListener('animationend', function (e) {
    if (e.animationName === 'piece-settle') {
      var card = e.target.closest('.piece');
      if (card) card.classList.remove('is-tapped');
    }
  });

  requestAnimationFrame(function () { moveGlow(tabButtons[0]); });

  fetch('./data.json?t=' + Date.now())
    .then(function (res) { return res.json(); })
    .then(function (json) {
      MEDIA.forEach(function (m) { data[m] = Array.isArray(json[m]) ? json[m] : []; });
      renderActive();
    })
    .catch(function () {
      gallery.innerHTML =
        '<div class="empty-state"><p>Couldn\u2019t load the collection.</p>' +
        '<p>Check your connection and reload.</p></div>';
    });
})();
