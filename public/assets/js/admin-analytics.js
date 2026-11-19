// Admin: Analytics tab. Data comes from /api/admin/analytics (anonymous, see lib/analytics.js).
(() => {
  const { esc } = HT;
  const $ = (s, el = document) => el.querySelector(s);
  const body = $('#an-body');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let days = 30;
  let data = null;

  // ---------- section + time range ----------
  document.addEventListener('ht:view', (e) => { if (e.detail === 'analytics') load(); });
  document.querySelectorAll('.an-range button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.an-range button').forEach((x) => x.classList.toggle('is-on', x === b));
    days = Number(b.dataset.days);
    load();
  }));

  // ---------- formatting ----------
  const dur = (s) => {
    s = Math.round(s || 0);
    if (s < 60) return `${s} s`;
    if (s < 3600) { const m = Math.floor(s / 60), r = s % 60; return r ? `${m} min ${r} s` : `${m} min`; }
    const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return `${h} h ${String(m).padStart(2, '0')} min`;
  };
  const durShort = (s) => (s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);
  const num = (n) => new Intl.NumberFormat('en', { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
  const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } })();
  const flag = (cc) => (/^[A-Z]{2}$/.test(cc) && cc !== 'XX' ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '');
  const countryName = (cc) => (cc === 'LOCAL' ? 'This computer (testing)' : !cc ? 'Unknown' : (regionNames && regionNames.of(cc)) || cc);
  const place = (x) => {
    if (x.country === 'LOCAL') return 'This computer (testing)';
    return [x.city, x.region && x.region !== x.city ? x.region : '', countryName(x.country)].filter(Boolean).join(', ');
  };
  const dayLabel = (d, opts = { day: 'numeric', month: 'short' }) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', opts);

  // ---------- column chart (single series, one colour) ----------
  const tooltip = document.createElement('div');
  tooltip.className = 'an-tip'; tooltip.hidden = true; document.body.appendChild(tooltip);

  function niceMax(v) {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  function columnChart(el, points, { yFormat = num, height = 200, every = 1 } = {}) {
    const draw = () => {
      const W = el.clientWidth || 600, H = height, padL = 44, padB = 26, padT = 8;
      const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
      const band = (W - padL) / points.length;
      const barW = Math.max(2, Math.min(24, band * 0.62));
      const y = (v) => padT + (H - padT - padB) * (1 - v / max);
      const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
      let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(el.dataset.label || '')}">`;
      ticks.forEach((t) => {
        svg += `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="an-grid"/>`;
        svg += `<text x="${padL - 8}" y="${y(t) + 4}" class="an-tick" text-anchor="end">${esc(yFormat(t))}</text>`;
      });
      points.forEach((p, i) => {
        const cx = padL + band * i + band / 2, top = y(p.value), base = y(0), h = base - top;
        if (h > 0) {
          const r = Math.min(4, h, barW / 2), x0 = cx - barW / 2, x1 = cx + barW / 2;
          // rounded data-end, square at the baseline
          svg += `<path class="an-bar" d="M${x0} ${base}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x1 - r}Q${x1} ${top} ${x1} ${top + r}V${base}Z"/>`;
        }
        // label every Nth day plus the last one, skipping a regular label that would crowd the last
        const last = i === points.length - 1;
        if (last || (i % every === 0 && points.length - 1 - i >= Math.max(2, every / 2))) {
          svg += `<text x="${cx}" y="${H - 8}" class="an-tick" text-anchor="middle">${esc(p.label)}</text>`;
        }
        // hit target: the whole band, taller than the bar
        svg += `<rect class="an-hit" x="${padL + band * i}" y="${padT}" width="${band}" height="${H - padT - padB}" data-i="${i}"/>`;
      });
      svg += `<line x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="an-axis"/></svg>`;
      el.innerHTML = svg;
      el.querySelectorAll('.an-hit').forEach((r) => {
        const p = points[r.dataset.i];
        const on = () => {
          tooltip.innerHTML = p.tip; tooltip.hidden = false;
          const bx = r.getBoundingClientRect();
          tooltip.style.left = `${Math.min(innerWidth - tooltip.offsetWidth - 12, Math.max(12, bx.left + bx.width / 2 - tooltip.offsetWidth / 2))}px`;
          tooltip.style.top = `${bx.top + scrollY - tooltip.offsetHeight - 8}px`;
          r.classList.add('is-hover');
        };
        r.addEventListener('mouseenter', on);
        r.addEventListener('mouseleave', () => { tooltip.hidden = true; r.classList.remove('is-hover'); });
      });
    };
    draw();
    new ResizeObserver(() => draw()).observe(el);
  }

  // ---------- horizontal bar list (single series) ----------
  const barList = (rows, { value, label, right }) => {
    const max = Math.max(1, ...rows.map(value));
    return `<ul class="an-bars">${rows.map((r) => `
      <li title="${esc(label(r, true))}">
        <span class="an-bars-label">${label(r)}</span>
        <span class="an-bars-track"><span class="an-bars-fill" style="width:${Math.max(2, (value(r) / max) * 100)}%"></span></span>
        <span class="an-bars-val">${right(r)}</span>
      </li>`).join('')}</ul>`;
  };

  const table = (head, rows) => `<div class="an-table-wrap"><table class="an-table">
    <thead><tr>${head.map((h) => `<th${h.num ? ' class="num"' : ''}>${h.t}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${head[i].num ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;

  // ---------- page ----------
  async function load() {
    body.innerHTML = '<p class="an-loading">Loading…</p>';
    try {
      const r = await fetch(`/api/admin/analytics?days=${days}&tz=${encodeURIComponent(tz)}`, { credentials: 'same-origin' });
      if (r.status === 401) { location.reload(); return; }
      data = await r.json();
      render();
    } catch {
      body.innerHTML = '<p class="an-loading">Couldn\'t load analytics. Please try again.</p>';
    }
  }

  function render() {
    const t = data.totals;
    if (!t.views) {
      body.innerHTML = `<div class="an-empty"><h2>No visits yet in this period</h2>
        <p>Visits are counted as soon as people open your site. Your own visits while signed in to the admin are not counted.
        Open the site in a private window to see it work.</p></div>`;
      return;
    }
    const every = data.daily.length > 60 ? 30 : data.daily.length > 14 ? 7 : 1;

    body.innerHTML = `
      <section class="an-kpis">
        ${kpi('Visitors', num(t.visitors), 'each person counted once a day')}
        ${kpi('Page views', num(t.views), '')}
        ${kpi('Visitors per day', num(t.avgDailyVisitors), 'average')}
        ${kpi('Time per visitor', dur(t.avgSecondsPerVisitor), 'average active reading time')}
        ${kpi('Time on a story', dur(t.avgSecondsPerStory), 'average per story opened')}
        ${kpi('Left within 10 s', t.bouncePct + '%', 'of visitors')}
      </section>

      <section class="an-card">
        <h2>Visitors per day</h2>
        <div class="an-chart" id="ch-daily" data-label="Visitors per day"></div>
        <details class="an-details"><summary>Show the numbers</summary>
          ${table([{ t: 'Day' }, { t: 'Visitors', num: 1 }, { t: 'Page views', num: 1 }, { t: 'Avg. time per visitor', num: 1 }],
            [...data.daily].reverse().map((d) => [dayLabel(d.day, { weekday: 'short', day: 'numeric', month: 'short' }), num(d.visitors), num(d.views), d.visitors ? dur(d.avgSeconds) : '–']))}
        </details>
      </section>

      <section class="an-card">
        <h2>Average time spent per day</h2>
        <p class="an-note">Active reading time per visitor: only while the page is open in front of them and they're reading.</p>
        <div class="an-chart" id="ch-time" data-label="Average time per visitor by day"></div>
      </section>

      <section class="an-card">
        <h2>Most read stories</h2>
        <p class="an-note"><strong>Read</strong> compares the average time spent with the story's estimated read time.
          <strong>Finished</strong> counts readers who reached the end or read for most of the estimated time.</p>
        ${data.topStories.length ? table(
          [{ t: 'Story' }, { t: 'Views', num: 1 }, { t: 'Readers', num: 1 }, { t: 'Avg. time', num: 1 }, { t: 'Est. read', num: 1 }, { t: 'Read' }, { t: 'Finished', num: 1 }],
          data.topStories.map((s) => [
            `<a href="/story/${encodeURIComponent(s.slug)}" target="_blank" rel="noopener">${esc(s.title)}</a><small>${esc(s.category)}</small>`,
            num(s.views), num(s.readers), dur(s.avgSeconds), s.readMinutes ? `${s.readMinutes} min` : '–',
            s.readPct === null ? '–' : `<span class="an-meter" title="${s.readPct}% of the estimated read time"><span style="width:${Math.min(100, s.readPct)}%"></span></span><span class="an-meter-val">${s.readPct}%</span>`,
            `${s.finishedPct}%`,
          ])) : '<p class="an-note">No story has been opened in this period.</p>'}
      </section>

      <div class="an-two">
        <section class="an-card">
          <h2>Where readers are</h2>
          ${barList(data.countries.slice(0, 12), {
            value: (r) => r.visitors,
            label: (r, plain) => plain ? countryName(r.country) : `<span class="an-flag" aria-hidden="true">${flag(r.country)}</span>${esc(countryName(r.country))}`,
            right: (r) => `${num(r.visitors)} · ${durShort(r.avgSeconds)}`,
          })}
          ${data.cities.length ? `<h3>Top cities</h3>${table([{ t: 'City' }, { t: 'Visitors', num: 1 }, { t: 'Avg. time', num: 1 }],
            data.cities.map((c) => [esc(place(c)), num(c.visitors), dur(c.avgSeconds)]))}` : ''}
          <p class="an-note">Country and city come from your hosting service once the site is online. While testing on this computer, visits show as "This computer".</p>
        </section>

        <section class="an-card">
          <h2>How long people stay</h2>
          <div class="an-chart" id="ch-dist" data-label="Visitors by time spent"></div>
          <details class="an-details"><summary>Show the numbers</summary>
            ${table([{ t: 'Time spent' }, { t: 'Visitors', num: 1 }], data.distribution.map((b) => [b.label, num(b.visitors)]))}
          </details>
        </section>
      </div>

      <div class="an-two">
        <section class="an-card">
          <h2>Stayed longest</h2>
          ${visitList(data.longest)}
        </section>
        <section class="an-card">
          <h2>Left fastest</h2>
          ${visitList(data.shortest)}
        </section>
      </div>

      <div class="an-two">
        <section class="an-card">
          <h2>Where visitors came from</h2>
          ${barList(data.referrers, { value: (r) => r.count, label: (r) => esc(r.name), right: (r) => num(r.count) })}
        </section>
        <section class="an-card">
          <h2>Devices</h2>
          ${barList(data.devices, { value: (r) => r.count, label: (r) => esc(r.name[0].toUpperCase() + r.name.slice(1)), right: (r) => `${Math.round((r.count / t.visitors) * 100)}%` })}
        </section>
      </div>`;

    columnChart($('#ch-daily'), data.daily.map((d) => ({
      label: dayLabel(d.day), value: d.visitors,
      tip: `<strong>${dayLabel(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}</strong><br>${num(d.visitors)} visitors · ${num(d.views)} page views${d.visitors ? `<br>${dur(d.avgSeconds)} average` : ''}`,
    })), { every });
    columnChart($('#ch-time'), data.daily.map((d) => ({
      label: dayLabel(d.day), value: d.avgSeconds,
      tip: `<strong>${dayLabel(d.day, { weekday: 'long', day: 'numeric', month: 'long' })}</strong><br>${d.visitors ? `${dur(d.avgSeconds)} per visitor` : 'No visitors'}`,
    })), { every, yFormat: durShort, height: 170 });
    columnChart($('#ch-dist'), data.distribution.map((b) => ({
      label: b.label.replace(' min', 'm').replace(' s', 's').replace('Under ', '<'), value: b.visitors,
      tip: `<strong>${b.label}</strong><br>${num(b.visitors)} visitors`,
    })), { height: 190 });
  }

  const kpi = (label, value, note) => `<div class="an-kpi"><span class="an-kpi-label">${label}</span><span class="an-kpi-value">${value}</span>${note ? `<span class="an-kpi-note">${note}</span>` : ''}</div>`;

  const visitList = (list) => (!list.length ? '<p class="an-note">No visits yet.</p>' : `<ol class="an-visits">${list.map((v) => `
    <li>
      <span class="an-visit-time">${dur(v.seconds)}</span>
      <span class="an-visit-main">
        <span>${flag(v.country)} ${esc(place(v))}</span>
        <small>${esc(v.device || 'unknown device')} · ${dayLabel(v.day)} · ${v.stories.length ? esc(v.stories.join(', ')) : `${v.pages} page${v.pages === 1 ? '' : 's'}, no story`}</small>
      </span>
    </li>`).join('')}</ol>
    <p class="an-note">Visitors are anonymous: each is a different person-day, not a named account.</p>`);

})();
