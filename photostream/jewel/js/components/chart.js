/* Chart — draws a line, area, bar, pie/donut or sparkline chart as SVG from
   an HTML table. See css/components/chart.css for the markup and options.

   - Animates once when it scrolls into view; instantly with reduced motion.
   - Hover card: follows the pointer and lists every series at that point
     (line/area snap to the nearest x with a crosshair; bars and slices are
     their own targets). Tap on touch screens.
   - Keyboard: the plot is focusable; arrow keys move between points (or
     slices), Home/End jump, Esc hides. A live region reads the values.
   - The table moves into a "Show data" disclosure: the accessible view.
   - Colors come from CSS: data-series picks one of the --chart-1…5
     tokens, in a fixed order. Labels are inserted with textContent only.
   - Redraws on resize; no library.
   - From data (React, live updates): Jewel.chart.render(el, data) writes
     the table and draws the chart; .update(data) redraws it. See the
     "From data" section at the end of this file. */

(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_SERIES = 5;     // colors never cycle; series 6+ fold to the context gray
  const MAX_SLICES = 6;     // more pie slices fold into "Other"
  let uid = 0;

  const svgEl = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v);
    parent?.append(n);
    return n;
  };
  const htmlEl = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const num = (t) => {
    const c = String(t ?? '').replace(/[^0-9.\-]/g, '');
    return c === '' || c === '-' || c === '.' ? null : Number(c);
  };
  const r1 = (v) => Math.round(v * 10) / 10;
  const textW = (s, px = 11) => String(s).length * px * 0.62;   // close enough for Inter

  /* ---- Data --------------------------------------------------------------- */
  function readTable(table) {
    const head = [...table.tHead.rows[0].cells].map((c) => c.textContent.trim());
    const rows = [...table.tBodies[0].rows];
    return {
      categoryLabel: head[0],
      categories: rows.map((r) => r.cells[0].textContent.trim()),
      series: head.slice(1).map((name, i) => ({
        name,
        index: i,
        slot: i < MAX_SERIES ? String(i + 1) : 'x',
        values: rows.map((r) => num(r.cells[i + 1]?.textContent)),
        texts: rows.map((r) => (r.cells[i + 1]?.textContent ?? '').trim()),
      })),
    };
  }

  // integers: whole-number data gets whole-number ticks (no 2.5, 7.5).
  function niceScale(min, max, count = 4, integers = false) {
    if (max === min) max = min + 1;
    const span = max - min;
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag)
      .filter((s) => !integers || Number.isInteger(s))
      .find((s) => span / s <= count) ?? Math.max(1, 10 * mag);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { min: lo, max: hi, ticks };
  }

  function formatter(fig) {
    const pre = fig.dataset.prefix || '';
    const suf = fig.dataset.suffix || '';
    const plain = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
    const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
    // One style per axis: pass compact = true when any tick reaches 10,000.
    return (v, useCompact = Math.abs(v) >= 10000) => pre + (useCompact ? compact : plain).format(v) + suf;
  }

  /* ---- Hover card --------------------------------------------------------- */
  function buildTip(plot) {
    const tip = htmlEl('div', 'chart__tip');
    tip.hidden = true;
    tip.setAttribute('aria-hidden', 'true');   // the live region speaks; the card is visual
    plot.append(tip);
    return tip;
  }

  // rows: [{ slot, value, name, total }]
  function fillTip(tip, title, rows) {
    tip.replaceChildren();
    tip.append(htmlEl('p', 'chart__tip-title', title));
    const list = htmlEl('ul', 'chart__tip-rows');
    for (const row of rows) {
      // plain: one value with nothing to key (sparklines), so no key column.
      const li = htmlEl('li', 'chart__tip-row' + (row.total ? ' is-total' : '') + (row.plain ? ' is-plain' : ''));
      if (!row.plain) {
        const key = htmlEl('span', 'chart__key');
        if (row.slot) key.dataset.series = row.slot;
        li.append(key);
      }
      li.append(htmlEl('strong', null, row.value), htmlEl('span', null, row.name));
      list.append(li);
    }
    tip.append(list);
  }

  // above: always open upward. Sparklines use it: they sit low in a stat,
  // often near a panel's bottom edge, and the panel's mask (the knockout
  // corner) clips anything that hangs below the panel.
  function placeTip(tip, plot, x, y, { above = false } = {}) {
    tip.hidden = false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const pw = plot.clientWidth;
    let left = x + 16;
    if (left + w > pw) left = x - 16 - w;
    left = Math.max(0, Math.min(left, pw - w));
    let top = y - h - 12;
    if (top < 0 && !above) top = y + 18;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  /* ---- Cartesian frame (line, area, bar) --------------------------------- */
  function frame(svg, W, H, data, opts) {
    const { stacked, minZero = true, fmt, rightPad = 12 } = opts;
    const n = data.categories.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      if (stacked) {
        const sum = data.series.reduce((a, s) => a + (s.values[i] ?? 0), 0);
        hi = Math.max(hi, sum);
        lo = Math.min(lo, 0);
      } else {
        for (const s of data.series) {
          if (s.values[i] == null) continue;
          hi = Math.max(hi, s.values[i]);
          lo = Math.min(lo, s.values[i]);
        }
      }
    }
    if (!Number.isFinite(hi)) { hi = 1; lo = 0; }
    if (minZero) lo = Math.min(0, lo);
    const integers = data.series.every((s) => s.values.every((v) => v == null || Number.isInteger(v)));
    const sc = niceScale(lo, hi, 4, integers);
    const big = Math.max(...sc.ticks.map(Math.abs)) >= 10000;
    const tickText = (t) => fmt(t, big);
    const left = Math.max(...sc.ticks.map((t) => textW(tickText(t)))) + 12;
    const m = { top: 14, right: rightPad, bottom: 30, left };
    const iw = Math.max(10, W - m.left - m.right);
    const ih = Math.max(10, H - m.top - m.bottom);
    const y = (v) => m.top + ih * (1 - (v - sc.min) / (sc.max - sc.min));

    const grid = svgEl('g', { 'aria-hidden': 'true' }, svg);
    for (const t of sc.ticks) {
      const yy = Math.round(y(t)) + 0.5;
      svgEl('line', { class: t === 0 ? 'chart__axis' : 'chart__grid', x1: m.left, x2: W - m.right, y1: yy, y2: yy }, grid);
      svgEl('text', { class: 'chart__tick', x: m.left - 10, y: yy, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, grid).textContent = tickText(t);
    }
    return { m, iw, ih, y, sc, grid, n };
  }

  function xLabels(svg, f, data, xAt) {
    const fit = Math.max(1, Math.floor(f.iw / 52));
    const every = Math.ceil(f.n / fit);
    const g = svgEl('g', { 'aria-hidden': 'true' }, svg);
    data.categories.forEach((c, i) => {
      if (i % every && i !== f.n - 1) return;
      svgEl('text', { class: 'chart__tick', x: xAt(i), y: f.m.top + f.ih + 20, 'text-anchor': 'middle' }, g).textContent = c;
    });
  }

  /* ---- Line & area -------------------------------------------------------- */
  function drawLine(ctx, { area = false } = {}) {
    const { svg, W, H, data, fig, fmt } = ctx;
    const stacked = area && fig.hasAttribute('data-stacked');
    const multi = data.series.length > 1;
    // Direct labels at the line ends: series names (2–4 series) or the end value (1).
    const endText = (s) => (multi ? s.name : s.texts[s.texts.length - 1]);
    const wantLabels = data.series.length <= 4;
    const rightPad = wantLabels ? Math.max(...data.series.map((s) => textW(endText(s), 12))) + 20 : 12;
    const f = frame(svg, W, H, data, { stacked, minZero: area || stacked, fmt, rightPad });
    const step = f.n > 1 ? f.iw / (f.n - 1) : 0;
    const xAt = (i) => f.m.left + (f.n > 1 ? i * step : f.iw / 2);
    xLabels(svg, f, data, xAt);

    // Values to plot (cumulative when stacked).
    const base = new Array(f.n).fill(0);
    const plotted = data.series.map((s) => {
      const top = s.values.map((v, i) => (stacked ? base[i] + (v ?? 0) : v));
      const bottom = stacked ? [...base] : null;
      if (stacked) top.forEach((v, i) => { base[i] = v; });
      return { s, top, bottom };
    });

    const marks = svgEl('g', {}, svg);
    const dots = [];
    const ends = [];
    const order = plotted;
    order.forEach(({ s, top, bottom }, k) => {
      const attrs = { 'data-series': s.slot };
      // Split into runs where the value exists (gaps for empty cells).
      const runs = [];
      let run = [];
      top.forEach((v, i) => { if (v == null) { if (run.length) runs.push(run); run = []; } else run.push(i); });
      if (run.length) runs.push(run);
      for (const r of runs) {
        const pts = r.map((i) => [r1(xAt(i)), r1(f.y(top[i]))]);
        if (area) {
          const floor = r.map((i) => [r1(xAt(i)), r1(f.y(bottom ? bottom[i] : Math.max(0, f.sc.min)))]).reverse();
          svgEl('path', { ...attrs, class: 'chart__area', d: `M${[...pts, ...floor].map((p) => p.join(',')).join('L')}Z`, 'data-anim': 'fade', style: `--d:${300 + k * 120}ms` }, marks);
        }
        svgEl('path', { ...attrs, class: 'chart__line', d: `M${pts.map((p) => p.join(',')).join('L')}`, pathLength: 1, 'data-anim': 'draw', style: `--d:${k * 120}ms` }, marks);
      }
      // A dot per point: hidden until hovered, except the end dot.
      const last = top.reduce((a, v, i) => (v == null ? a : i), -1);
      top.forEach((v, i) => {
        if (v == null) return;
        const dot = svgEl('circle', { ...attrs, class: 'chart__dot' + (i === last ? ' is-end' : ''), cx: r1(xAt(i)), cy: r1(f.y(v)), r: 4, 'data-anim': i === last ? 'fade' : null, style: `--d:${900 + k * 120}ms` }, marks);
        (dots[i] ||= []).push(dot);
      });
      if (last >= 0) ends.push({ s, y: f.y(top[last]), x: xAt(last) });
    });

    // End labels, only if they don't collide (then the legend carries identity).
    if (wantLabels && ends.length) {
      const sorted = [...ends].sort((a, b) => a.y - b.y);
      const clear = sorted.every((e, i) => i === 0 || e.y - sorted[i - 1].y >= 14);
      if (clear) {
        const g = svgEl('g', { 'aria-hidden': 'true' }, svg);
        for (const e of ends) {
          svgEl('text', { class: 'chart__end-label', x: e.x + 10, y: e.y, 'dominant-baseline': 'middle', 'data-anim': 'fade', style: '--d:1000ms' }, g).textContent = endText(e.s);
        }
      }
    }

    const cross = svgEl('line', { class: 'chart__cross', y1: f.m.top, y2: f.m.top + f.ih, x1: 0, x2: 0, visibility: 'hidden' }, svg);
    svgEl('rect', { class: 'chart__hit', x: f.m.left - step / 2, y: f.m.top, width: f.iw + step, height: f.ih }, svg);

    return {
      count: f.n,
      indexAt: (px) => Math.max(0, Math.min(f.n - 1, Math.round((px - f.m.left) / (step || 1)))),
      anchor: (i) => {
        const ys = data.series.map((s, k) => plotted[k].top[i]).filter((v) => v != null);
        return { x: xAt(i), y: ys.length ? f.y(Math.max(...ys)) : f.m.top };
      },
      activate: (i) => {
        dots.flat().forEach((d) => d.classList.remove('is-active'));
        if (i == null) { cross.setAttribute('visibility', 'hidden'); return; }
        (dots[i] || []).forEach((d) => d.classList.add('is-active'));
        const x = Math.round(xAt(i)) + 0.5;
        cross.setAttribute('x1', x);
        cross.setAttribute('x2', x);
        cross.setAttribute('visibility', 'visible');
      },
      describe: (i) => describeCategory(data, i, stacked),
    };
  }

  function describeCategory(data, i, total) {
    const rows = data.series
      .filter((s) => s.values[i] != null)
      .map((s) => ({ slot: s.slot, value: s.texts[i], name: s.name }));
    if (total && rows.length > 1) {
      const sum = data.series.reduce((a, s) => a + (s.values[i] ?? 0), 0);
      rows.push({ value: new Intl.NumberFormat().format(sum), name: 'Total', total: true });
    }
    return { title: data.categories[i], rows };
  }

  /* ---- Bars --------------------------------------------------------------- */
  function drawBars(ctx) {
    const { svg, W, H, data, fig, fmt } = ctx;
    const stacked = fig.hasAttribute('data-stacked');
    const f = frame(svg, W, H, data, { stacked, fmt });
    const band = f.iw / f.n;
    const ns = data.series.length;
    const GAP = 2;
    const barW = Math.max(3, Math.min(24, stacked ? band * 0.6 : (band * 0.7 - GAP * (ns - 1)) / ns));
    const groupW = stacked ? barW : barW * ns + GAP * (ns - 1);
    const xAt = (i) => f.m.left + band * i + band / 2;
    xLabels(svg, f, data, xAt);
    const zeroY = f.y(Math.max(0, f.sc.min));

    // A column with a 4px rounded data end and a square baseline.
    const column = (x, yTop, yBot, w) => {
      const h = yBot - yTop;
      if (h <= 0) return '';
      const r = Math.min(4, w / 2, h);
      return `M${r1(x)},${r1(yBot)}V${r1(yTop + r)}Q${r1(x)},${r1(yTop)} ${r1(x + r)},${r1(yTop)}H${r1(x + w - r)}Q${r1(x + w)},${r1(yTop)} ${r1(x + w)},${r1(yTop + r)}V${r1(yBot)}Z`;
    };

    const bands = [];
    const showValues = ns === 1 && f.n <= 12 && barW >= 14;
    for (let i = 0; i < f.n; i++) {
      const g = svgEl('g', { class: 'chart__band' }, svg);
      let acc = 0;
      const x0 = xAt(i) - groupW / 2;
      data.series.forEach((s, k) => {
        const v = s.values[i];
        if (v == null || v <= 0) return;
        const attrs = { 'data-series': s.slot };
        let x;
        let yTop;
        let yBot;
        if (stacked) {
          x = x0;
          yBot = f.y(acc) - (acc > 0 ? GAP : 0);   // 2px surface gap between segments
          acc += v;
          yTop = f.y(acc);
        } else {
          x = x0 + k * (barW + GAP);
          yBot = zeroY;
          yTop = f.y(v);
        }
        const isTop = !stacked || data.series.slice(k + 1).every((t) => !(t.values[i] > 0));
        const d = isTop ? column(x, yTop, yBot, barW) : `M${r1(x)},${r1(yBot)}V${r1(yTop)}H${r1(x + barW)}V${r1(yBot)}Z`;
        if (d) svgEl('path', { ...attrs, class: 'chart__bar', d, 'data-anim': 'grow', style: `--d:${i * 45 + k * 20}ms` }, g);
        if (showValues) {
          svgEl('text', { class: 'chart__value', x: r1(x + barW / 2), y: r1(yTop - 7), 'text-anchor': 'middle', 'data-anim': 'fade', style: `--d:${500 + i * 45}ms`, 'aria-hidden': 'true' }, g).textContent = s.texts[i];
        }
      });
      // The whole band is the hit target, bigger than the bars.
      svgEl('rect', { class: 'chart__hit', x: r1(f.m.left + band * i), y: f.m.top, width: r1(band), height: f.ih }, g);
      bands.push(g);
    }

    return {
      count: f.n,
      indexAt: (px) => Math.max(0, Math.min(f.n - 1, Math.floor((px - f.m.left) / band))),
      anchor: (i) => {
        const top = stacked
          ? data.series.reduce((a, s) => a + (s.values[i] ?? 0), 0)
          : Math.max(0, ...data.series.map((s) => s.values[i] ?? 0));
        return { x: xAt(i), y: f.y(top) };
      },
      activate: (i) => bands.forEach((b, k) => b.toggleAttribute('data-active', k === i)),
      describe: (i) => describeCategory(data, i, stacked),
    };
  }

  /* ---- Pie & donut -------------------------------------------------------- */
  function drawRound(ctx, { donut }) {
    const { svg, W, data, fig } = ctx;
    const s0 = data.series[0];
    let slices = data.categories
      .map((name, i) => ({ name, value: s0.values[i], text: s0.texts[i] }))
      .filter((d) => d.value > 0);
    if (slices.length > MAX_SLICES) {
      const keep = [...slices].sort((a, b) => b.value - a.value).slice(0, MAX_SLICES - 1);
      const rest = slices.filter((d) => !keep.includes(d));
      const restSum = rest.reduce((a, d) => a + d.value, 0);
      slices = slices.filter((d) => keep.includes(d));
      slices.push({ name: 'Other', value: restSum, text: new Intl.NumberFormat().format(restSum), other: true });
    }
    const total = slices.reduce((a, d) => a + d.value, 0) || 1;
    const size = Math.min(W, 240);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 6;
    const r = donut ? R * 0.62 : 0;

    // Sweep reveal: a mask circle whose stroke draws round once.
    const id = `jewel-chart-${++uid}`;
    const mask = svgEl('mask', { id }, svgEl('defs', {}, svg));
    svgEl('circle', { cx, cy, r: R / 2 + r / 2, fill: 'none', stroke: '#fff', 'stroke-width': R - r + 8, pathLength: 1, transform: `rotate(-90 ${cx} ${cy})`, 'data-anim': 'sweep' }, mask);

    const g = svgEl('g', { mask: `url(#${id})` }, svg);
    const paths = [];
    let a0 = -Math.PI / 2;
    slices.forEach((d, i) => {
      const frac = d.value / total;
      const a1 = a0 + Math.min(frac * Math.PI * 2, Math.PI * 2 - 1e-4);
      const mid = (a0 + a1) / 2;
      const p = svgEl('path', {
        class: 'chart__slice',
        d: wedge(cx, cy, R, r, a0, a1, slices.length > 1 ? 2 : 0),
        'data-series': d.other ? 'x' : (i < MAX_SERIES ? String(i + 1) : 'x'),
        style: `--lift-x:${r1(Math.cos(mid) * 4)}px;--lift-y:${r1(Math.sin(mid) * 4)}px`,
      }, g);
      paths.push({ p, d, frac, mid });
      a0 = a1;
    });

    if (donut) {
      const label = fig.dataset.centerLabel || 'Total';
      const tv = svgEl('text', { class: 'chart__center-value', x: cx, y: cy - 2, 'text-anchor': 'middle', 'data-anim': 'fade', style: '--d:700ms', 'aria-hidden': 'true' }, svg);
      tv.textContent = fig.dataset.centerValue || new Intl.NumberFormat().format(total);
      svgEl('text', { class: 'chart__center-label', x: cx, y: cy + 20, 'text-anchor': 'middle', 'data-anim': 'fade', style: '--d:800ms', 'aria-hidden': 'true' }, svg).textContent = label;
    }

    const pct = (f) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(f * 100)}%`;
    const isPct = (t) => /%s*$/.test(t);
    return {
      count: paths.length,
      slices: paths,
      hit: (target) => paths.findIndex((x) => x.p === target),
      anchor: (i) => {
        const { mid } = paths[i];
        const rr = donut ? (R + r) / 2 : R * 0.6;
        const scale = (svg.getBoundingClientRect().width || size) / size;
        return { x: (cx + Math.cos(mid) * rr) * scale, y: (cy + Math.sin(mid) * rr) * scale };
      },
      activate: (i) => paths.forEach((x, k) => x.p.toggleAttribute('data-active', k === i)),
      describe: (i) => {
        const { d, frac } = paths[i];
        const slot = paths[i].p.dataset.series;
        return { title: d.name, rows: [{ slot, value: d.text, name: isPct(d.text) ? s0.name : `${pct(frac)} of total` }] };
      },
      legend: () => paths.map(({ d, frac, p }) => ({ name: d.name, slot: p.dataset.series, value: d.text, pct: isPct(d.text) ? '' : pct(frac) })),
    };
  }

  // A slice with a real 2px gap cut from each side (no outline: the gap is
  // empty space, so the outer and inner edges stay clean).
  function wedge(cx, cy, R, r, a0, a1, gap = 2) {
    const span = a1 - a0;
    const half = gap / 2;
    const pt = (rad, a) => `${r1(cx + rad * Math.cos(a))},${r1(cy + rad * Math.sin(a))}`;
    const oA = Math.min(span / 2, half / R);
    const o0 = a0 + oA;
    const o1 = a1 - oA;
    const large = o1 - o0 > Math.PI ? 1 : 0;
    if (r <= 0) {
      // Pie: push the apex out along the bisector so both edges keep the gap.
      const mid = (a0 + a1) / 2;
      const apex = Math.min(R * 0.5, half / Math.sin(Math.min(span / 2, Math.PI / 2)));
      return `M${r1(cx + apex * Math.cos(mid))},${r1(cy + apex * Math.sin(mid))}L${pt(R, o0)}A${R},${R} 0 ${large} 1 ${pt(R, o1)}Z`;
    }
    const iA = Math.min(span / 2, half / r);
    const i0 = a0 + iA;
    const i1 = a1 - iA;
    const largeI = i1 - i0 > Math.PI ? 1 : 0;
    return `M${pt(R, o0)}A${R},${R} 0 ${large} 1 ${pt(R, o1)}L${pt(r, i1)}A${r},${r} 0 ${largeI} 0 ${pt(r, i0)}Z`;
  }

  /* ---- Legend ------------------------------------------------------------- */
  function renderLegend(list, data, type, round) {
    list.replaceChildren();
    if (round) {
      for (const it of round.legend()) {
        const li = htmlEl('li');
        const left = htmlEl('span');
        const sw = htmlEl('span', 'chart__swatch');
        sw.dataset.series = it.slot;
        left.append(sw, document.createTextNode(it.name));
        const right = htmlEl('span');
        right.append(htmlEl('b', null, it.value));
        if (it.pct) right.append(document.createTextNode(` · ${it.pct}`));
        li.append(left, right);
        list.append(li);
      }
      list.hidden = false;
      return;
    }
    // A legend for two or more series; one series is named by the title.
    list.hidden = data.series.length < 2;
    for (const s of data.series) {
      const li = htmlEl('li');
      const sw = htmlEl('span', 'chart__swatch' + (type === 'line' ? ' chart__swatch--line' : ''));
      sw.dataset.series = s.slot;
      li.append(sw, document.createTextNode(s.name));
      list.append(li);
    }
  }

  /* ---- Chart component ---------------------------------------------------- */
  Jewel.register('chart', (fig) => {
    const type = fig.dataset.type || 'line';
    if (type === 'sparkline') return sparkline(fig);
    const table = fig.querySelector('table');
    if (!table?.tHead || !table.tBodies.length) return;

    let data = readTable(table);
    if (data.series.length > MAX_SERIES) console.warn(`[jewel] chart: ${data.series.length} series; series after ${MAX_SERIES} share the context gray. Fold them into "Other" or split the chart.`);
    const round = type === 'pie' || type === 'donut';
    const fmt = formatter(fig);
    const title = fig.querySelector('.chart__title')?.textContent.trim() || fig.querySelector('figcaption')?.textContent.trim() || 'Chart';
    if (round) fig.classList.add('chart--round');

    // Structure: [figcaption] [body: plot + legend] [details: table]
    const plot = htmlEl('div', 'chart__plot');
    plot.tabIndex = 0;
    plot.setAttribute('role', 'group');
    plot.setAttribute('aria-roledescription', 'chart');
    const kind = { line: 'Line chart', area: 'Area chart', bar: 'Bar chart', pie: 'Pie chart', donut: 'Donut chart' }[type] || 'Chart';
    plot.setAttribute('aria-label', `${kind}: ${title}. Use the arrow keys to read values; the full data is in the table below.`);
    const legend = htmlEl('ul', 'chart__legend');
    legend.setAttribute('aria-label', 'Legend');
    const body = htmlEl('div', 'chart__body');
    body.append(plot, legend);
    const live = htmlEl('span', 'visually-hidden');
    live.setAttribute('aria-live', 'polite');
    const details = htmlEl('details', 'chart__data');
    details.append(htmlEl('summary', null, 'Show data'));
    table.replaceWith(details);
    details.append(table);
    const caption = fig.querySelector(':scope > figcaption');
    (caption || fig.firstChild) ? (caption ? caption.after(body) : fig.prepend(body)) : fig.append(body);
    fig.append(live);
    const tip = buildTip(plot);

    let view = null;
    let active = null;
    let lastW = 0;

    function render() {
      const W = Math.round(plot.clientWidth);
      if (!W || W === lastW) return;
      lastW = W;
      plot.querySelector('svg')?.remove();
      const H = Number(fig.dataset.height) || 260;
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true', focusable: 'false' });
      plot.prepend(svg);
      const ctx = { svg, W, H, data, fig, fmt };
      view = type === 'bar' ? drawBars(ctx)
        : type === 'area' ? drawLine(ctx, { area: true })
        : round ? drawRound(ctx, { donut: type === 'donut' })
        : drawLine(ctx);
      if (round) plot.style.maxWidth = `${svg.getAttribute('width')}px`;
      renderLegend(legend, data, type, round ? view : null);
      hide();
    }

    function show(i, px, py) {
      if (!view || i == null || i < 0 || i >= view.count) return hide();
      active = i;
      view.activate(i);
      const { title: t, rows } = view.describe(i);
      fillTip(tip, t, rows);
      const a = px == null ? view.anchor(i) : { x: px, y: py };
      placeTip(tip, plot, a.x, a.y);
    }
    function hide() {
      active = null;
      view?.activate(null);
      tip.hidden = true;
    }
    function speak(i) {
      const { title: t, rows } = view.describe(i);
      live.textContent = `${t}: ${rows.map((r) => `${r.name} ${r.value}`).join(', ')}`;
    }

    const local = (e) => {
      const b = plot.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    const pointAt = (e) => {
      if (round) return view.hit(e.target);
      const svg = plot.querySelector('svg');
      const scale = svg.viewBox.baseVal.width / svg.getBoundingClientRect().width;
      return view.indexAt(local(e)[0] * scale);
    };

    plot.addEventListener('pointermove', (e) => {
      if (!view) return;
      const i = pointAt(e);
      if (i < 0) return hide();
      const [x, y] = local(e);
      show(i, x, y);
    });
    plot.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
    plot.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' && view) {
        const i = pointAt(e);
        const [x, y] = local(e);
        i < 0 ? hide() : show(i, x, y);
      }
    });
    document.addEventListener('pointerdown', (e) => { if (!plot.contains(e.target)) hide(); });

    plot.addEventListener('keydown', (e) => {
      if (!view) return;
      const last = view.count - 1;
      let i = active ?? -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = Math.min(last, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = Math.max(0, i < 0 ? 0 : i - 1);
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = last;
      else if (e.key === 'Escape') { hide(); return; }
      else return;
      e.preventDefault();
      show(i);
      speak(i);
    });
    plot.addEventListener('blur', hide);

    // Animate once, when at least a third of the chart is on screen.
    const reveal = () => fig.classList.add('is-in');
    if (reduced.matches || !('IntersectionObserver' in window)) reveal();
    else {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { reveal(); io.disconnect(); }
      }, { threshold: 0.33 });
      io.observe(fig);
    }

    new ResizeObserver(() => render()).observe(plot);
    render();

    // Jewel.chart.update() rewrites the table, then calls this.
    fig._jewelChart = {
      refresh() {
        data = readTable(table);
        lastW = 0;
        render();
      },
    };
  });

  /* ---- Sparkline ---------------------------------------------------------- */
  // <span class="sparkline" data-component="chart" data-type="sparkline"
  //       data-values="9100,9400,9900,10400" data-labels="Jan,Feb,Mar,Apr"
  //       data-name="Members" aria-label="Members, January to April: up from 9,100 to 10,400"></span>
  function sparkline(el) {
    let values = [];
    let labels = [];
    const read = () => {
      values = (el.dataset.values || '').split(',').map(num);
      labels = (el.dataset.labels || '').split(',').map((s) => s.trim());
    };
    read();
    if (!values.length) return;
    el.setAttribute('role', 'img');
    if (!el.getAttribute('aria-label')) {
      const vs = values.filter((v) => v != null);
      el.setAttribute('aria-label', `Trend: from ${vs[0]} to ${vs[vs.length - 1]}`);
    }
    const tip = buildTip(el);
    let pts = [];
    let lastW = 0;

    const render = () => {
      const W = Math.round(el.clientWidth) || 120;
      const H = Math.round(el.clientHeight) || 32;
      if (W === lastW) return;
      lastW = W;
      el.querySelector('svg')?.remove();
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
      el.prepend(svg);
      const vs = values.filter((v) => v != null);
      const lo = Math.min(...vs);
      const hi = Math.max(...vs);
      const pad = 4;
      const x = (i) => pad + (values.length > 1 ? (i * (W - pad * 2)) / (values.length - 1) : (W - pad * 2) / 2);
      const y = (v) => pad + (H - pad * 2) * (1 - (v - lo) / ((hi - lo) || 1));
      pts = values.map((v, i) => (v == null ? null : [x(i), y(v)]));
      const d = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${r1(p[0])},${r1(p[1])}`).join('');
      svgEl('path', { class: 'chart__line', d, pathLength: 1, 'data-anim': 'draw' }, svg);
      const lastI = pts.reduce((a, p, i) => (p ? i : a), 0);
      svgEl('circle', { class: 'chart__dot', cx: r1(pts[lastI][0]), cy: r1(pts[lastI][1]), r: 3, 'data-anim': 'fade', style: '--d:900ms' }, svg);
    };

    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      const px = ((e.clientX - b.left) / b.width) * lastW;
      let best = -1;
      pts.forEach((p, i) => { if (p && (best < 0 || Math.abs(p[0] - px) < Math.abs(pts[best][0] - px))) best = i; });
      if (best < 0) return;
      fillTip(tip, labels[best] || '', [{ value: new Intl.NumberFormat().format(values[best]), name: el.dataset.name || '', plain: true }]);
      placeTip(tip, el, (pts[best][0] / lastW) * b.width, (pts[best][1] / (el.clientHeight || 32)) * b.height, { above: true });
    });
    el.addEventListener('pointerleave', () => { tip.hidden = true; });

    const reveal = () => el.classList.add('is-in');
    if (reduced.matches || !('IntersectionObserver' in window)) reveal();
    else {
      const io = new IntersectionObserver((en) => { if (en.some((x) => x.isIntersecting)) { reveal(); io.disconnect(); } }, { threshold: 0.5 });
      io.observe(el);
    }
    new ResizeObserver(render).observe(el);
    render();

    el._jewelChart = {
      refresh() {
        read();
        lastW = 0;
        if (values.some((v) => v != null)) render();
      },
    };
  }

  /* ---- From data -----------------------------------------------------------
     For apps that hold the data themselves (React state, a live feed). The
     chart is still drawn from a real table, which these functions write, so
     "Show data", the keyboard and the screen reader view all keep working.

       const chart = Jewel.chart.render(container, {
         type: 'donut',                       // line | area | bar | pie | donut | sparkline
         title: 'Pods by state',              // optional caption
         subtitle: 'prod-east',               // optional
         categoryLabel: 'State',              // first column's header
         labels: ['Running', 'Pending', 'Failed'],
         series: [{ name: 'Pods', values: [12, 5, 1] }],
         stacked: false, prefix: '', suffix: '', height: 260,   // all optional
       });
       chart.update({ series: [{ values: [11, 6, 1] }] });     // redraws in place
       chart.el                                               // the <figure>

     container: a figure.chart to reuse, or any element to put a new one in.
     update() merges: leave out labels, names or options to keep them. The
     type is fixed once drawn.
     Jewel.chart.update(figure, data) does the same for any chart on the
     page, including ones written as HTML tables. Values are numbers or null
     (a gap). In React, render once in an effect, call update() when the
     data changes, and let Jewel own the figure's contents. */
  const OPTS = ['type', 'stacked', 'prefix', 'suffix', 'height'];
  const state = new WeakMap(); // figure → last full data, so update() can merge

  function merge(prev = {}, next = {}) {
    const out = { ...prev, ...next };
    out.series = (next.series || prev.series || []).map((s, i) => ({
      ...(prev.series?.[i] || {}),
      ...s,
    }));
    return out;
  }

  function writeChart(fig, d) {
    const type = d.type || 'line';
    const cellText = (v) => (v == null || Number.isNaN(v) ? '' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(v));
    if (type === 'sparkline') {
      fig.classList.remove('chart');
      fig.classList.add('sparkline');
      fig.dataset.type = 'sparkline';
      const s = d.series?.[0] || { values: [] };
      fig.dataset.values = s.values.map((v) => (v == null ? '' : v)).join(',');
      fig.dataset.labels = (d.labels || []).join(',');
      if (s.name) fig.dataset.name = s.name;
      if (d.title) fig.setAttribute('aria-label', d.title);
      return;
    }
    fig.classList.add('chart');
    for (const k of OPTS) {
      const v = d[k];
      if (v == null || v === false || v === '') delete fig.dataset[k];
      else fig.dataset[k] = v === true ? '' : String(v);
    }
    // Caption
    let cap = fig.querySelector(':scope > figcaption');
    if (d.title || d.subtitle) {
      if (!cap) { cap = document.createElement('figcaption'); fig.prepend(cap); }
      cap.replaceChildren();
      if (d.title) cap.append(htmlEl('span', 'chart__title', d.title));
      if (d.subtitle) cap.append(htmlEl('span', 'chart__subtitle', d.subtitle));
    }
    // Table (inside "Show data" once the chart has been drawn)
    let table = fig.querySelector('table');
    if (!table) { table = document.createElement('table'); fig.append(table); }
    const series = d.series || [];
    const head = document.createElement('thead');
    const hr = head.insertRow();
    const th0 = document.createElement('th');
    th0.scope = 'col';
    th0.textContent = d.categoryLabel || '';
    hr.append(th0);
    series.forEach((s, i) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = s.name || `Series ${i + 1}`;
      hr.append(th);
    });
    const body = document.createElement('tbody');
    (d.labels || []).forEach((label, r) => {
      const tr = body.insertRow();
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = label;
      tr.append(th);
      series.forEach((s) => { tr.insertCell().textContent = cellText(s.values?.[r]); });
    });
    table.replaceChildren(head, body);
  }

  // A chart first written as an HTML table: start from what the table says.
  function seed(fig) {
    if (fig.dataset.type === 'sparkline') {
      return {
        type: 'sparkline',
        labels: (fig.dataset.labels || '').split(',').map((x) => x.trim()),
        series: [{ name: fig.dataset.name, values: (fig.dataset.values || '').split(',').map(num) }],
      };
    }
    const t = fig.querySelector('table');
    if (!t?.tHead || !t.tBodies.length) return {};
    const r = readTable(t);
    const d = { categoryLabel: r.categoryLabel, labels: r.categories, series: r.series.map((x) => ({ name: x.name, values: x.values })) };
    for (const k of OPTS) if (k in fig.dataset) d[k] = k === 'stacked' ? true : fig.dataset[k];
    return d;
  }

  function update(fig, next) {
    if (!state.has(fig)) state.set(fig, seed(fig));
    if (fig._jewelChart && next.type && next.type !== (state.get(fig).type || 'line')) {
      console.warn('[jewel] chart: the type is fixed once drawn; render a new chart to change it.');
      next = { ...next, type: state.get(fig).type };
    }
    const d = merge(state.get(fig), next);
    state.set(fig, d);
    writeChart(fig, d);
    if (fig._jewelChart) fig._jewelChart.refresh();
    else {
      fig.dataset.component = 'chart';
      Jewel.mount(fig.parentElement || document);
    }
    return fig;
  }

  function render(container, data) {
    let fig = container.matches?.('figure.chart, .sparkline') ? container : null;
    if (!fig) {
      fig = document.createElement(data.type === 'sparkline' ? 'span' : 'figure');
      container.append(fig);
    }
    update(fig, data);
    return {
      el: fig,
      update: (next) => update(fig, next),
    };
  }

  window.Jewel.chart = { render, update: (fig, data) => update(fig, data) };
})();
