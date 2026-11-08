/* Data table — see css/components/table.css for markup. Optional: a plain
   .table needs no script. This adds:

   Sorting: th[data-sort] becomes a button. Click sorts ascending, again
   descending. data-sort="number" | "date" | "" (text, locale-aware).
   A cell's data-value overrides its text for sorting (e.g. a raw number
   behind "1.2k", or an ISO date; <time datetime> is read automatically).
   Fires 'jewel:sort' on .table-wrap, detail { column, direction }.

   Selection: data-select on .table-wrap adds a checkbox to every row and
   a select-all in the header (with the mixed state). Selected rows get
   aria-selected="true". Fires 'jewel:selectionchange', detail { rows }.
   API: wrap.jewelTable.selected() → <tr>[]   .sort(columnIndex, 'ascending'|'descending')

   Phone labels: for .table--stack, each cell gets data-label from its
   column header (unless it has one). */

(() => {
  let uid = 0;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  Jewel.register('table', (wrap) => {
    const table = wrap.querySelector('table');
    const body = table?.tBodies[0];
    if (!table || !body || !table.tHead) return;
    const headRow = table.tHead.rows[0];
    const id = `jewel-table${++uid}`;
    if (wrap.scrollWidth > wrap.clientWidth || wrap.classList.contains('table-wrap--tall')) {
      wrap.tabIndex = 0;   // scrollable regions must be reachable by keyboard
      if (!wrap.hasAttribute('aria-label') && table.caption) wrap.setAttribute('aria-labelledby', table.caption.id ||= `${id}-cap`);
      if (!wrap.hasAttribute('role')) wrap.setAttribute('role', 'region');
    }

    const live = document.createElement('span');
    live.className = 'visually-hidden';
    live.setAttribute('aria-live', 'polite');
    wrap.append(live);

    // ---- Selection --------------------------------------------------------
    let all = null;
    if ('select' in wrap.dataset) {
      const th = document.createElement('th');
      th.className = 'table__select';
      th.scope = 'col';
      th.innerHTML = '<label class="choice"><input type="checkbox"><span class="visually-hidden">Select all rows</span></label>';
      headRow.prepend(th);
      all = th.querySelector('input');
      [...body.rows].forEach((row, i) => {
        const td = document.createElement('td');
        td.className = 'table__select';
        const name = row.cells[0]?.textContent.trim() || `row ${i + 1}`;
        td.innerHTML = `<label class="choice"><input type="checkbox"><span class="visually-hidden">Select ${name.replace(/[<>&"]/g, '')}</span></label>`;
        row.prepend(td);
        row.setAttribute('aria-selected', 'false');
      });
    }
    const rowBoxes = () => [...body.querySelectorAll(':scope > tr > .table__select input')];
    const selected = () => [...body.rows].filter((r) => r.getAttribute('aria-selected') === 'true');
    function syncSelection() {
      const boxes = rowBoxes();
      boxes.forEach((b) => b.closest('tr').setAttribute('aria-selected', String(b.checked)));
      const n = boxes.filter((b) => b.checked).length;
      if (all) { all.checked = n > 0 && n === boxes.length; all.indeterminate = n > 0 && n < boxes.length; }
      wrap.dispatchEvent(new CustomEvent('jewel:selectionchange', { bubbles: true, detail: { rows: selected() } }));
    }
    if (all) {
      all.addEventListener('change', () => { rowBoxes().forEach((b) => { b.checked = all.checked; }); syncSelection(); live.textContent = all.checked ? 'All rows selected' : 'No rows selected'; });
      body.addEventListener('change', (e) => { if (e.target.matches('.table__select input')) syncSelection(); });
    }

    // ---- Phone labels ------------------------------------------------------
    const headers = [...headRow.cells];
    if (table.classList.contains('table--stack')) {
      [...body.rows].forEach((row) => [...row.cells].forEach((cell, i) => {
        const h = headers[i];
        if (!cell.dataset.label && h && !h.classList.contains('table__select') && !h.querySelector('.visually-hidden') && h.textContent.trim()) cell.dataset.label = h.textContent.trim();
      }));
    }

    // ---- Sorting -----------------------------------------------------------
    const keyOf = (cell, type) => {
      const raw = cell?.dataset.value ?? cell?.querySelector('time')?.getAttribute('datetime') ?? cell?.textContent.trim() ?? '';
      if (type === 'number') { const n = parseFloat(String(raw).replace(/[^\d.-]/g, '')); return Number.isNaN(n) ? -Infinity : n; }
      if (type === 'date') { const t = Date.parse(raw); return Number.isNaN(t) ? -Infinity : t; }
      return raw;
    };
    function sort(col, direction) {
      const th = headers[col];
      if (!th) return;
      const type = th.dataset.sort;
      const rows = [...body.rows];
      const dir = direction === 'descending' ? -1 : 1;
      rows.sort((a, b) => {
        const x = keyOf(a.cells[col], type);
        const y = keyOf(b.cells[col], type);
        return dir * (typeof x === 'number' ? x - y : collator.compare(x, y));
      });
      body.append(...rows);
      headers.forEach((h) => { if (h !== th) h.removeAttribute('aria-sort'); });
      th.setAttribute('aria-sort', direction);
      live.textContent = `Sorted by ${th.textContent.trim()}, ${direction}`;
      wrap.dispatchEvent(new CustomEvent('jewel:sort', { bubbles: true, detail: { column: col, direction } }));
    }
    headers.forEach((th, col) => {
      if (!('sort' in th.dataset)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'table__sort';
      btn.append(...th.childNodes);
      th.append(btn);
      btn.addEventListener('click', () => sort(col, th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending'));
    });

    wrap.jewelTable = { selected, sort };
  });
})();
