/* Ayuda Memoria · SAE 2026 (II tramo)
 * Capas: Store (datos) → Query (filtros) → Pivot (tablas) → Text (redacción) → View → Export.
 * Para conectar una base de datos real, solo hay que reemplazar Store.load().            */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const aviso = m => { $('out').innerHTML = `<div class="card empty"><b>No se pudo iniciar la página</b><br>${m}</div>`; };
  if (!window.SAE || !(window.SAE.cols || []).includes('lat')) {
    return aviso('Falta <code>datos.js</code> o es una versión anterior. Colóquelo (la versión nueva) en la misma carpeta que <code>index.html</code> y recargue con Ctrl+F5.');
  }
  window.addEventListener('error', e => { const o = $('out'); if (o && !o.innerHTML.trim()) aviso('Error de script: ' + e.message); });
  const fmt = n => (n || 0).toLocaleString('es-PE');
  const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => s.charAt(0) + s.slice(1).toLowerCase();

  /* ── Store: decodifica el padrón (diccionarios + filas de enteros) ── */
  const Store = (() => {
    const { cols, dict, rows } = window.SAE;
    const ix = Object.fromEntries(cols.map((c, i) => [c, i]));
    return {
      rows,
      get: (r, k) => dict[k][r[ix[k]]],
      val: (r, k) => dict[k] ? dict[k][r[ix[k]]] : r[ix[k]],
      users: r => r[ix.u],
      uniq: (rs, k) => [...new Set(rs.map(r => dict[k][r[ix[k]]]))].sort((a, b) => a.localeCompare(b, 'es')),
      cols, dict, ix
    };
  })();
  const g = Store.get, U = Store.users;

  /* ── Query: ámbito seleccionado ── */
  const LEVELS = ['ut', 'dep', 'prov', 'dist'];
  const sel = { reg: '', ut: '', dep: '', prov: '', dist: '' };   // reg (región alimentaria) filtra todo el reporte
  const scope = (upTo = 4) => Store.rows.filter(r => (!sel.reg || g(r, 'reg') === sel.reg) && LEVELS.slice(0, upTo).every(k => !sel[k] || g(r, k) === sel[k]));
  const nUniq = (rs, f) => new Set(rs.map(f)).size;
  const agg = rs => ({ s: rs.length, u: rs.reduce((t, r) => t + U(r), 0) });

  /* ── Pivot: tablas cruzadas como las del Word ── */
  const ORD = { niv: ['INICIAL', 'PRIMARIA', 'SECUNDARIA', 'INICIAL_SECD'], rac: ['DESAYUNO', 'DESAYUNO + ALMUERZO', 'DESAYUNO + ALMUERZO + CENA', 'REFRIGERIO', 'DESAYUNO + REFRIGERIO'],
    forma: ['ALIMENTOS PARA PREPARAR', 'KIT DE ALIMENTOS', 'ALIMENTOS LISTOS PARA CONSUMIR', 'CONCESIÓN', 'TRANSFERENCIA DE SUBVENCION ECONOMICA', 'ALIMENTOS PARA PREPARAR Y COMPLEMENTO'] };
  const ordered = (vals, k) => { const o = ORD[k] || []; return [...vals].sort((a, b) => (o.indexOf(a) + 1 || 99) - (o.indexOf(b) + 1 || 99) || a.localeCompare(b, 'es')); };

  function matrix(rs, { corner, title, colKey, defs }) {
    const cols = colKey ? ordered(Store.uniq(rs, colKey), colKey) : [];
    const heads = [...cols, 'TOTAL'];
    const cell = a => a.s ? `<td>${fmt(a.s)}</td><td>${fmt(a.u)}</td>` : '<td></td><td></td>';
    let h = `<thead><tr><th rowspan="3">${corner}</th><th colspan="${heads.length * 2}">${title}</th></tr><tr>` +
      heads.map(c => `<th colspan="2">${esc(c)}</th>`).join('') + '</tr><tr>' + heads.map(() => '<th>SSEE</th><th>USUARIOS</th>').join('') + '</tr></thead><tbody>';
    defs.forEach(d => {
      const mine = rs.filter(r => d.f(r));
      if (!mine.length && !d.keep) return;
      h += `<tr class="${d.c || ''}"><td>${esc(d.l)}</td>` + cols.map(c => cell(agg(mine.filter(r => g(r, colKey) === c)))).join('') + cell(agg(mine)) + '</tr>';
    });
    const t = agg(rs);
    h += '<tr class="tot"><td>TOTAL</td>' + cols.map(c => cell(agg(rs.filter(r => g(r, colKey) === c)))).join('') + cell(t) + '</tr></tbody>';
    return `<div class="tw"><table>${h}</table></div>`;
  }
  /* Resumen tipo cuadro dinámico: etiqueta | N.° SSEE | N.° usuarios (+ % y total general) */
  function resumen(rs, k, corner, { sortBy = 'ord', bars = false, show = 'both' } = {}) {
    const m = {}; rs.forEach(r => { const v = g(r, k), a = m[v] ||= { s: 0, u: 0 }; a.s++; a.u += U(r); });
    let arr = Object.entries(m);
    arr = sortBy === 'u' ? arr.sort((a, b) => b[1].u - a[1].u) : sortBy === 's' ? arr.sort((a, b) => b[1].s - a[1].s) : ordered(arr.map(a => a[0]), k).map(n => [n, m[n]]);
    const t = agg(rs), mk = show === 's' ? 's' : 'u', max = Math.max(1, ...arr.map(a => a[1][mk]));
    const S = show !== 'u', Uu = show !== 's';   // columnas visibles: SSEE y/o usuarios
    const head = `<th>${corner}</th>${S ? '<th>N.° DE SSEE</th>' : ''}${Uu ? '<th>N.° DE USUARIOS</th>' : ''}<th>${show === 's' ? '% DE SSEE' : '% USUARIOS'}</th>`;
    const body = arr.map(([l, a]) => `<tr><td>${esc(l)}${bars ? `<div class="bar1" style="width:${a[mk] / max * 100}%"></div>` : ''}</td>${S ? `<td>${fmt(a.s)}</td>` : ''}${Uu ? `<td>${fmt(a.u)}</td>` : ''}<td>${pct(a[mk], t[mk])}</td></tr>`).join('');
    return `<div class="tw"><table class="rsm"><thead><tr>${head}</tr></thead><tbody>${body}<tr class="tot"><td>Total general</td>${S ? `<td>${fmt(t.s)}</td>` : ''}${Uu ? `<td>${fmt(t.u)}</td>` : ''}<td>100%</td></tr></tbody></table></div>`;
  }
  const byNivel = rs => ordered(Store.uniq(rs, 'niv'), 'niv').map(n => ({ l: cap(n.replace('_', ' ')), c: '', f: r => g(r, 'niv') === n }));
  const tables = rs => ({
    t1: matrix(rs, { corner: 'Nivel educativo', title: 'MODALIDAD', colKey: 'mod', defs: byNivel(rs) }),
    t2: matrix(rs, { corner: 'Nivel educativo', title: 'TIPO DE RACIÓN', colKey: 'rac', defs: byNivel(rs) }),
    t3: matrix(rs, { corner: 'Área / Nivel educativo', title: 'TIPO DE RACIÓN', colKey: 'rac',
      defs: Store.uniq(rs, 'area').flatMap(a => [{ l: a, c: 'sub', f: r => g(r, 'area') === a }, ...byNivel(rs.filter(r => g(r, 'area') === a)).map(d => ({ ...d, c: 'ind', f: r => g(r, 'area') === a && d.f(r) }))]) }),
    t4: matrix(rs, { corner: 'Nivel educativo / Turno', title: 'TOTAL', colKey: null,
      defs: ordered(Store.uniq(rs, 'niv'), 'niv').flatMap(n => [{ l: cap(n.replace('_', ' ')), c: 'sub', f: r => g(r, 'niv') === n },
        ...Store.uniq(rs.filter(r => g(r, 'niv') === n), 'tur').map(t => ({ l: t, c: 'ind', f: r => g(r, 'niv') === n && g(r, 'tur') === t }))]) })
  });

  /* ── Text: redacción automática (mismo estilo del Word) ── */
  const notes = {
    mej: 'Para el segundo tramo de atención 2026 se ha ampliado la diversidad de alimentos considerando la pertinencia y diversidad cultural.',
    res: 'Los servicios educativos cuentan con modalidades y formas de atención asignadas.',
    asp: 'Seguimiento y monitoreo permanente para la implementación de las modalidades y formas de atención.',
    inn: 'Se cuenta con la nota técnica aprobada para la implementación del piloto PAE Amazónico en servicios educativos priorizados de Amazonas, Loreto, San Martín, Ucayali y Madre de Dios.'
  };
  let universo = 0;
  function coverage(rs) {
    const t = agg(rs), L = [];
    const formas = m => Store.uniq(rs.filter(r => g(r, 'mod') === m), 'forma').filter(f => f !== '—');
    const mods = Store.uniq(rs, 'mod').map(m => {
      const a = agg(rs.filter(r => g(r, 'mod') === m));
      const fs = formas(m).map(f => `${cap(f)}: ${fmt(agg(rs.filter(r => g(r, 'mod') === m && g(r, 'forma') === f)).s)} SSEE`);
      return { m, a, fs };
    });
    L.push(['N.° de instituciones educativas', `${fmt(t.s)} servicios educativos`]);
    L.push(['N.° de usuarios', `${fmt(t.u)} usuarios`]);
    L.push(['Porcentaje de cobertura', universo ? `${pct(t.s, universo)} a nivel de servicios educativos` : 'Ingrese el universo de SSEE para calcularlo']);
    return { lines: L, mods, t };
  }

  /* ── View ── */
  const chips = ['#1d4ed8', '#f59e0b', '#059669', '#db2777', '#7c3aed'];
  function render() {
    if (map) { map.remove(); map = null; }
    const rs = scope(), out = $('out');
    const name = (sel.dist || sel.prov || sel.dep || sel.ut || 'Nacional') + (sel.reg ? ` (${sel.reg})` : '');
    $('total-gen').textContent = `${fmt(Store.rows.length)} servicios en el padrón`;
    if (!rs.length) { out.innerHTML = '<div class="card empty">Sin servicios educativos para esta selección.</div>'; return; }
    const c = coverage(rs), T = tables(rs), t = c.t;
    const R = { rac: resumen(rs, 'rac', 'TIPO DE RACIÓN'), formaU: resumen(rs, 'forma', 'FORMA DE ATENCIÓN', { sortBy: 'u', bars: true, show: 'u' }), forma: resumen(rs, 'forma', 'FORMA DE ATENCIÓN', { sortBy: 's', bars: true, show: 's' }) };
    const rural = agg(rs.filter(r => g(r, 'area') === 'Rural'));
    const split = c.mods.map((x, i) => `<i style="width:${x.a.u / t.u * 100}%;background:${chips[i % 5]}" title="${esc(x.m)}"></i>`).join('');
    const leg = c.mods.map((x, i) => `<span><span class="dot" style="background:${chips[i % 5]}"></span>${cap(x.m)} <b>${pct(x.a.u, t.u)}</b></span>`).join('');
    const nt = (k, l) => `<div class="card"><label>${l}</label><textarea data-n="${k}">${esc(notes[k])}</textarea></div>`;
    out.innerHTML = `
    <div class="bar"><div><div class="crumb">${[sel.reg && 'Región alimentaria ' + sel.reg, sel.ut, sel.dep, sel.prov, sel.dist].filter(Boolean).map(esc).join(' › ') || 'Todo el país'}</div><h2>${esc(name)}</h2></div>
      <div class="bar noprint"><button class="btn" id="bWord">Word</button><button class="btn g" id="bPdf">PDF / Imprimir</button><button class="btn g" id="bXls">Excel</button><button class="btn g" id="bCsv">CSV</button></div></div>
    <div class="kpis" style="margin-top:14px">
      <div class="kpi"><small>Servicios educativos</small><strong>${fmt(t.s)}</strong><span>${fmt(nUniq(rs, r => g(r, 'dep') + '|' + g(r, 'prov') + '|' + g(r, 'dist')))} distritos</span></div>
      <div class="kpi"><small>Usuarios</small><strong>${fmt(t.u)}</strong><span>${(t.u / t.s).toFixed(1)} por servicio</span></div>
      <div class="kpi"><small>Comités de gestión</small><strong>${fmt(nUniq(rs.filter(r => g(r, 'com') !== '—'), r => g(r, 'ut') + '|' + g(r, 'com')))}</strong><span>${fmt(nUniq(rs, r => Store.val(r, 'cpc')))} centros poblados</span></div>
      <div class="kpi"><small>Servicios en área rural</small><strong>${fmt(rural.s)}</strong><span>${pct(rural.s, t.s)} de los servicios · ${fmt(rural.u)} usuarios</span></div></div>
    <div class="card" style="margin-top:22px" id="rep">
      <h3>1.1 Cobertura de atención</h3>
      <ul style="margin:0 0 16px 18px">${c.lines.map(l => `<li>${l[0]}: <b>${l[1]}</b></li>`).join('')}</ul>
      <div class="noprint" style="max-width:280px;margin-bottom:16px"><label for="univ">Universo de SSEE (opcional)</label><input id="univ" type="number" min="0" value="${universo || ''}" style="width:100%;padding:10px;border:1.5px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)"></div>
      <h3>1.2 Modalidades de atención</h3>
      <div class="split">${split}</div><div class="leg">${leg}</div>
      <ul style="margin:14px 0 18px 18px">${c.mods.map(x => `<li>${cap(x.m)}: <b>${fmt(x.a.s)} SSEE, ${fmt(x.a.u)} usuarios</b>${x.fs.length ? ` (${x.fs.join('; ')})` : ''}</li>`).join('')}</ul>
      <h3>Nivel educativo y modalidad</h3>${T.t1}<br>
      <h3>Nivel educativo y tipo de ración</h3>${T.t2}<br>
      <h3>Nivel educativo, área y tipo de ración</h3>${T.t3}<br>
      <h3>Nivel educativo y turno</h3>${T.t4}
      <p class="crumb" style="margin-top:6px">Turno: valor registrado en el padrón.</p></div>
    <div class="card noprint"><h3>Mapa de servicios educativos · Minimum Bounding Geometry</h3>
      <div class="ctl"><div><label for="gby">Agrupar por</label><select id="gby"><option value="item">Item (único por UT)</option><option value="com">Comité de gestión</option><option value="dist">Distrito</option><option value="none">Todos juntos</option></select></div>
      <div><label for="mtype">Geometría envolvente</label><select id="mtype"><option value="hull">Envolvente convexa (Convex hull)</option><option value="envelope">Envolvente rectangular (Envelope)</option><option value="rect">Rectángulo de menor área</option><option value="circle">Círculo mínimo (Circle)</option></select></div></div>
      <div id="map"></div><div class="mtab" id="mtab"></div></div>
    <div class="card noprint"><h3>Fichas por institución educativa</h3><input id="q" type="search" placeholder="Buscar por nombre, código modular o código local…"><div id="lst"></div></div>
    <div id="resumen">
      <div class="card"><h3>Resumen por tipo de ración</h3>${R.rac}</div>
      <div class="grid2" style="margin-top:22px">
        <div class="card"><h3>Usuarios por forma de atención</h3>${R.formaU}</div>
        <div class="card"><h3>SSEE (Servicios Educativos) por forma de atención</h3>${R.forma}</div></div></div>
    <div class="card"><h3>1.3 Principales mejoras en el SAE</h3></div>
    <div class="grid2">${nt('mej', 'Mejoras implementadas')}${nt('res', 'Resultados o avances')}${nt('asp', 'Aspectos que requieren atención')}${nt('inn', 'Innovación')}</div>`;
    $('bWord').onclick = () => exportWord(rs, name, T, c, R);
    $('bXls').onclick = () => exportXls(rs, name);
    try { initMap(rs); } catch (e) { console.error(e); $('map').innerHTML = '<p class="empty">No se pudo iniciar el mapa: ' + esc(e.message) + '</p>'; }
    initFichas(rs);
    $('bPdf').onclick = () => window.print();
    $('bCsv').onclick = () => exportCsv(rs, name);
    $('univ').onchange = e => { universo = +e.target.value || 0; render(); };
    out.querySelectorAll('textarea').forEach(a => a.oninput = () => notes[a.dataset.n] = a.value);
  }

  /* ── Export ── */
  const download = (blob, file) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const safe = s => s.replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '_');
  function exportWord(rs, name, T, c, R) {
    const css = 'body{font:10pt "Segoe UI",sans-serif}h1,h2{text-align:center;color:#0b1f47}h3{color:#1d4ed8;font-size:10.5pt}table{border-collapse:collapse;width:100%;font-size:8pt}th{background:#dbe8f7;border:1px solid #9db7d9;padding:3px}td{border:1px solid #cbd5e1;padding:3px;text-align:right}td:first-child{text-align:left}tr.tot td{background:#dbe8f7;font-weight:bold}.bar1{display:none}tr.sub td{font-weight:bold}';
    const li = c.lines.map(l => `<li>${l[0]}: <b>${l[1]}</b></li>`).join('');
    const mods = c.mods.map(x => `<li>${cap(x.m)}: <b>${fmt(x.a.s)} SSEE, ${fmt(x.a.u)} usuarios</b>${x.fs.length ? ` (${x.fs.join('; ')})` : ''}</li>`).join('');
    const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${css}</style></head><body>
      <h1>AYUDA MEMORIA</h1><h2>${esc(name.toUpperCase())}</h2>
      <h3>1. PRESTACIÓN DEL SERVICIO ALIMENTARIO ESCOLAR 2026 · II TRAMO</h3><h3>1.1 Cobertura de atención</h3><ul>${li}</ul>
      <h3>1.2 Modalidades de atención</h3><ul>${mods}</ul>
      <p><b>Resumen por tipo de ración</b></p>${R.rac}<p><b>Usuarios por forma de atención</b></p>${R.formaU}<p><b>SSEE (Servicios Educativos) por forma de atención</b></p>${R.forma}
      <p><b>Nivel educativo y modalidad</b></p>${T.t1}<p><b>Nivel educativo y tipo de ración</b></p>${T.t2}
      <p><b>Nivel educativo, área y tipo de ración</b></p>${T.t3}<p><b>Nivel educativo y turno</b></p>${T.t4}
      <h3>1.3 Principales mejoras en el SAE</h3><ul><li>Mejoras implementadas: ${esc(notes.mej)}</li><li>Resultados o avances: ${esc(notes.res)}</li><li>Aspectos que requieren atención: ${esc(notes.asp)}</li><li>Innovación: ${esc(notes.inn)}</li></ul>
      <p style="font-size:8pt;color:#64748b">Fuente: Listado de Servicios Educativos PC 2026 (II tramo, corte ${window.SAE.corte}). Generado el ${new Date().toLocaleString('es-PE')}.</p></body></html>`;
    download(new Blob(['\ufeff', html], { type: 'application/msword' }), `AM_${safe(name)}_SAE_2026.doc`);
  }
  const LABEL = { ut: 'unidad_territorial', dep: 'departamento', prov: 'provincia', dist: 'distrito', cp: 'centro_poblado', niv: 'nivel', mod: 'modalidad', forma: 'forma_atencion', rac: 'tipo_racion', area: 'area', tur: 'turno', reg: 'region_alimentaria', com: 'comite', per: 'periodo_entrega', item: 'item', prog: 'programacion', u: 'usuarios', nom: 'nombre_ie', cm: 'cod_modular', anx: 'anexo', cl: 'cod_local', dir: 'direccion', cpc: 'cod_centro_poblado', qui: 'quintil', pi: 'pueblo_indigena_amazonia', lat: 'latitud', lon: 'longitud', ubi: 'ubigeo' };
  function exportCsv(rs, name) {
    const head = Store.cols.map(c => LABEL[c] || c);
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const body = rs.map(r => Store.cols.map(c => q(Store.val(r, c))).join(','));
    download(new Blob(['\ufeff' + head.join(',') + '\n' + body.join('\n')], { type: 'text/csv;charset=utf-8' }), `SAE_2026_${safe(name)}.csv`);
  }

    /* ── Geometría: Minimum Bounding Geometry (proyección local en km) ── */
  const Geo = (() => {
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const hull = P => {
      P = [...new Map(P.map(p => [p.x + ',' + p.y, p])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
      if (P.length < 3) return P;
      const h = [];
      for (const p of P) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); }
      const n = h.length + 1;
      for (let i = P.length - 2; i >= 0; i--) { const p = P[i]; while (h.length >= n && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); }
      h.pop(); return h;
    };
    const area = Q => Math.abs(Q.reduce((s, p, i) => { const q = Q[(i + 1) % Q.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
    const perim = Q => Q.reduce((s, p, i) => { const q = Q[(i + 1) % Q.length]; return s + Math.hypot(q.x - p.x, q.y - p.y); }, 0);
    const rect = H => {                       // rectángulo orientado de menor área
      let best = null;
      for (let i = 0; i < H.length; i++) {
        const a = H[i], b = H[(i + 1) % H.length], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const p of H) { const s = (p.x - a.x) * ux + (p.y - a.y) * uy, t = -(p.x - a.x) * uy + (p.y - a.y) * ux; x0 = Math.min(x0, s); x1 = Math.max(x1, s); y0 = Math.min(y0, t); y1 = Math.max(y1, t); }
        const A = (x1 - x0) * (y1 - y0);
        if (!best || A < best.A) { const pt = (s, t) => ({ x: a.x + s * ux - t * uy, y: a.y + s * uy + t * ux }); best = { A, poly: [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)] }; }
      }
      return best.poly;
    };
    const c2 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: Math.hypot(a.x - b.x, a.y - b.y) / 2 });
    const c3 = (a, b, c) => {
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)); if (!d) return null;
      const A = a.x * a.x + a.y * a.y, B = b.x * b.x + b.y * b.y, C = c.x * c.x + c.y * c.y;
      const x = (A * (b.y - c.y) + B * (c.y - a.y) + C * (a.y - b.y)) / d, y = (A * (c.x - b.x) + B * (a.x - c.x) + C * (b.x - a.x)) / d;
      return { x, y, r: Math.hypot(a.x - x, a.y - y) };
    };
    const inC = (c, p) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 1e-9;
    const circle = H => {                     // círculo mínimo envolvente (Welzl iterativo)
      const P = H.slice(); let c = { x: P[0].x, y: P[0].y, r: 0 };
      for (let i = 1; i < P.length; i++) if (!inC(c, P[i])) {
        c = { x: P[i].x, y: P[i].y, r: 0 };
        for (let j = 0; j < i; j++) if (!inC(c, P[j])) {
          c = c2(P[i], P[j]);
          for (let k = 0; k < j; k++) if (!inC(c, P[k])) c = c3(P[i], P[j], P[k]) || c;
        }
      }
      return c;
    };
    return {
      run(pts, type) {
        const la0 = pts.reduce((t, p) => t + p.lat, 0) / pts.length, lo0 = pts.reduce((t, p) => t + p.lon, 0) / pts.length, kx = 111.32 * Math.cos(la0 * Math.PI / 180), ky = 110.574;
        const P = pts.map(p => ({ x: (p.lon - lo0) * kx, y: (p.lat - la0) * ky }));
        const back = Q => Q.map(p => [la0 + p.y / ky, lo0 + p.x / kx]);
        const H = hull(P);
        if (H.length < 3 && type !== 'circle') return H.length < 2 ? { kind: 'point', area: 0, per: 0 } : { kind: 'line', ll: back(H), area: 0, per: Math.hypot(H[1].x - H[0].x, H[1].y - H[0].y) };
        if (type === 'circle') { const c = circle(H.length ? H : P); return { kind: 'circle', c: back([c])[0], rKm: c.r, area: Math.PI * c.r * c.r, per: 2 * Math.PI * c.r }; }
        const poly = type === 'envelope' ? (() => { const xs = P.map(p => p.x), ys = P.map(p => p.y), a = Math.min(...xs), b = Math.max(...xs), c = Math.min(...ys), d = Math.max(...ys); return [{ x: a, y: c }, { x: b, y: c }, { x: b, y: d }, { x: a, y: d }]; })()
          : type === 'rect' ? rect(H) : H;
        return { kind: 'poly', ll: back(poly), area: area(poly), per: perim(poly) };
      }
    };
  })();

  /* ── Mapa georreferenciado ── */
  let map = null, shapes = {}, mbgRows = [];
  const MAX_PTS = 6000;   // sobre este número no se dibujan puntos (solo geometrías) para no congelar el navegador
  const PAL = ['#1d4ed8', '#db2777', '#059669', '#f59e0b', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#9333ea', '#ea580c'];
  const hasXY = r => g0(r, 'lat') != null && g0(r, 'lon') != null;
  const g0 = Store.val;
  function initMap(rs) {
    const el = $('map');
    if (typeof L === 'undefined') { el.innerHTML = '<p class="empty">No se pudo cargar el mapa (requiere conexión a internet).</p>'; return; }
    map = L.map(el, { preferCanvas: true });
    // Mapas base libres, todos con datos de OpenStreetMap (© colaboradores de OSM).
    const osmAttr = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
    const cartoAttr = osmAttr + ' · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
    const base = {
      'OpenStreetMap (estándar)': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: osmAttr }),
      'OpenStreetMap Humanitario': L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc', attribution: osmAttr + ' · Tiles: <a href="https://www.hotosm.org/" target="_blank" rel="noopener">HOT</a>' }),
      'Topográfico (OpenTopoMap)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: osmAttr + ' · © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)' }),
      'Claro (CARTO + OSM)': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd', attribution: cartoAttr }),
      'Oscuro (CARTO + OSM)': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd', attribution: cartoAttr })
    };
    // Mapa inicial: OpenStreetMap estándar. Si el servidor de OSM rechaza las teselas
    // (p. ej. al abrir el archivo localmente con file://, que no envía Referer y da 403),
    // se cambia automáticamente a CARTO, que también usa datos de OSM.
    const osm = base['OpenStreetMap (estándar)'];
    let errs = 0;
    osm.on('tileerror', () => {
      if (++errs >= 3 && map.hasLayer(osm)) { map.removeLayer(osm); base['Claro (CARTO + OSM)'].addTo(map); }
    });
    osm.addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    L.control.layers(base, null, { position: 'topright' }).addTo(map);
    const me = map, draw = () => { if (map !== me) return; try { drawMap(rs); } catch (e) { console.error(e); $('mtab').innerHTML = '<p class="crumb">No se pudo dibujar el mapa: ' + esc(e.message) + '</p>'; } };
    $('gby').onchange = $('mtype').onchange = draw;
    $('mtab').innerHTML = '<p class="crumb">Dibujando mapa…</p>'; map.setView([-9.2, -75], 5);
    setTimeout(draw, 30);   // la página se muestra primero y el mapa se dibuja después
  }
  // Un mismo nombre puede existir en varias unidades territoriales: la clave incluye el ámbito que lo hace único.
  const keyOf = (r, gk) => gk === 'none' ? 'Todos los servicios'
    : gk === 'item' ? `${g(r, 'item')} · ${g(r, 'ut')}`
    : gk === 'com'  ? `${g(r, 'com')} · ${g(r, 'ut')}`
    : gk === 'dist' ? `${g(r, 'dist')} · ${g(r, 'prov')} (${g(r, 'dep')})` : g(r, gk);
  function drawMap(rs) {
    map.eachLayer(l => { if (!l._url) map.removeLayer(l); });
    shapes = {}; mbgRows = [];
    const gk = $('gby').value, type = $('mtype').value, groups = {};
    const withXY = rs.filter(hasXY);
    withXY.forEach(r => (groups[keyOf(r, gk)] ||= []).push(r));
    const keys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    const all = [], pintar = withXY.length <= MAX_PTS;
    keys.forEach((k, i) => {
      const col = PAL[i % PAL.length], rows = groups[k];
      rows.forEach(r => { const ll = [g0(r, 'lat'), g0(r, 'lon')]; all.push(ll); if (pintar) L.circleMarker(ll, { radius: 3, color: col, weight: 1, fillOpacity: .75 }).on('click', () => ficha(r)).bindTooltip(esc(g0(r, 'nom')) + ' · ' + esc(g(r, 'niv'))).addTo(map); });
      const m = Geo.run(rows.map(r => ({ lat: g0(r, 'lat'), lon: g0(r, 'lon') })), type), a = agg(rows), o = { fillOpacity: .12, color: col, weight: 2 };
      let sh = null;
      if (m.kind === 'poly') sh = L.polygon(m.ll, o); else if (m.kind === 'line') sh = L.polyline(m.ll, { color: col, weight: 2 }); else if (m.kind === 'circle') sh = L.circle(m.c, { ...o, radius: m.rKm * 1000 });
      if (sh) { sh.bindTooltip(`<b>${esc(k)}</b><br>${fmt(rows.length)} SSEE · ${m.area.toFixed(1)} km²`, { sticky: true }).addTo(map); shapes[k] = sh; }
      mbgRows.push({ k, col, n: rows.length, u: a.u, area: m.area, per: m.per });
    });
    if (all.length) map.fitBounds(all, { padding: [24, 24] }); else map.setView([-9.2, -75], 5);
    const sin = rs.length - withXY.length, shown = mbgRows.slice(0, 200);
    $('mtab').innerHTML = `<table><thead><tr><th>Grupo</th><th>SSEE</th><th>Usuarios</th><th>Área (km²)</th><th>Perímetro (km)</th></tr></thead><tbody>` +
      shown.map(m => `<tr data-k="${esc(m.k)}"><td><span class="sw" style="background:${m.col}"></span>${esc(m.k)}</td><td>${fmt(m.n)}</td><td>${fmt(m.u)}</td><td>${m.area.toFixed(1)}</td><td>${m.per.toFixed(1)}</td></tr>`).join('') + '</tbody></table>' +
      `<p class="crumb">${fmt(withXY.length)} servicios georreferenciados${sin ? ` · ${fmt(sin)} sin coordenadas válidas` : ''}${pintar ? '' : ` · más de ${fmt(MAX_PTS)} puntos: se muestran solo las geometrías; filtre por unidad territorial o departamento para ver cada servicio`}${mbgRows.length > 200 ? ` · mostrando 200 de ${fmt(mbgRows.length)} grupos` : ''}. Áreas calculadas en proyección local (km).</p>`;
    $('mtab').onclick = e => { const tr = e.target.closest('tr[data-k]'); if (tr && shapes[tr.dataset.k]) { map.fitBounds(shapes[tr.dataset.k].getBounds(), { padding: [30, 30] }); $('map').scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
  }

  /* ── Ficha por institución educativa ── */
  function initFichas(rs) {
    let m = [];
    const norm = s => String(s).toLowerCase();
    const paint = () => {
      const q = norm($('q').value).trim();
      m = (q ? rs.filter(r => norm(g0(r, 'nom')).includes(q) || norm(g0(r, 'cm')).includes(q) || norm(g0(r, 'cl')).includes(q)) : rs).slice(0, 40);
      $('lst').innerHTML = `<table><thead><tr><th>Cód. modular</th><th>Institución</th><th>Nivel</th><th>Distrito</th><th>Usuarios</th></tr></thead><tbody>` +
        m.map((r, i) => `<tr data-i="${i}"><td>${esc(g0(r, 'cm'))}</td><td>${esc(g0(r, 'nom'))}</td><td>${esc(g(r, 'niv'))}</td><td>${esc(g(r, 'dist'))}</td><td>${fmt(U(r))}</td></tr>`).join('') + '</tbody></table>';
    };
    $('q').oninput = paint; paint();
    $('lst').onclick = e => { const tr = e.target.closest('tr[data-i]'); if (tr) ficha(m[+tr.dataset.i]); };
  }
  function ficha(r) {
    const v = k => g0(r, k), f = (l, x) => `<div><small>${l}</small><b>${esc(x ?? '—')}</b></div>`, xy = hasXY(r);
    const d = document.createElement('div'); d.className = 'modal';
    d.innerHTML = `<div class="ficha" role="dialog" aria-modal="true"><header><small>Ficha de institución educativa</small><h2>${esc(v('nom'))}</h2></header><div class="fg">
      ${f('Cód. modular / anexo', v('cm') + ' / ' + v('anx'))}${f('Cód. local', v('cl'))}${f('Nivel', g(r, 'niv'))}${f('Usuarios', fmt(U(r)))}
      ${f('Modalidad', g(r, 'mod'))}${f('Forma de atención', g(r, 'forma'))}${f('Tipo de ración', g(r, 'rac'))}${f('Turno', g(r, 'tur'))}
      ${f('Área', g(r, 'area'))}${f('Periodo de entrega', g(r, 'per'))}${f('Comité de gestión', g(r, 'com'))}${f('Item', g(r, 'item'))}
      ${f('Unidad territorial', g(r, 'ut'))}${f('Región alimentaria', g(r, 'reg'))}${f('Departamento / Provincia', g(r, 'dep') + ' / ' + g(r, 'prov'))}${f('Distrito', g(r, 'dist'))}
      ${f('Centro poblado', g(r, 'cp') + ' (' + v('cpc') + ')')}${f('Dirección', v('dir'))}${f('Quintil', v('qui'))}${f('Pueblo indígena (Amazonía)', v('pi') === '0' ? 'No' : v('pi'))}
      ${f('Programación', g(r, 'prog'))}${f('Ubigeo', v('ubi'))}${f('Latitud, longitud', xy ? v('lat') + ', ' + v('lon') : 'Sin coordenadas')}</div>
      <div class="fa">${xy ? `<button class="btn" id="fMap">Ver en el mapa</button><a class="btn g" style="text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${v('lat')},${v('lon')}">Google Maps</a>` : ''}<button class="btn g" id="fX">Cerrar</button></div></div>`;
    const close = () => { d.remove(); document.removeEventListener('keydown', esc_); }, esc_ = e => e.key === 'Escape' && close();
    d.onclick = e => { if (e.target === d) close(); }; d.querySelector('#fX').onclick = close; document.addEventListener('keydown', esc_);
    if (xy) d.querySelector('#fMap').onclick = () => { close(); if (map) { map.setView([v('lat'), v('lon')], 16); $('map').scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
    document.body.appendChild(d);
  }

  /* ── Exportación a Excel ── */
  const numSheet = (X, tb) => { const ws = X.utils.table_to_sheet(tb); Object.values(ws).forEach(c => { if (c && c.t === 's' && /^\d[\d,]*$/.test(c.v)) { c.t = 'n'; c.v = +c.v.replace(/,/g, ''); delete c.w; } }); return ws; };
  function exportXls(rs, name) {
    const X = window.XLSX; if (!X) return alert('No se pudo cargar la librería de Excel (requiere conexión a internet).');
    const wb = X.utils.book_new(), add = (n, ws) => X.utils.book_append_sheet(wb, ws, n), t = agg(rs);
    add('Resumen', X.utils.aoa_to_sheet([['AYUDA MEMORIA · SERVICIO ALIMENTARIO ESCOLAR 2026 · II TRAMO'], ['Ámbito', name], ['Servicios educativos', t.s], ['Usuarios', t.u], ['Fuente', window.SAE.fuente], ['Corte', window.SAE.corte], ['Generado', new Date().toLocaleString('es-PE')]]));
    ['Res. tipo de ración', 'Res. usuarios por forma', 'Res. SSEE por forma'].forEach((n, i) => { const tb = document.querySelectorAll('#resumen table')[i]; if (tb) add(n, numSheet(X, tb)); });
    ['Modalidad', 'Tipo de ración', 'Área y nivel', 'Turno'].forEach((n, i) => {
      const tb = document.querySelectorAll('#rep table')[i]; if (!tb) return;
      add(n, numSheet(X, tb));
    });
    if (mbgRows.length) add('MBG', X.utils.aoa_to_sheet([['Grupo', 'SSEE', 'Usuarios', 'Área km²', 'Perímetro km'], ...mbgRows.map(m => [m.k, m.n, m.u, +m.area.toFixed(2), +m.per.toFixed(2)])]));
    const cols = Store.cols.filter(c => c !== 'u'); cols.push('u');
    add('Servicios', X.utils.aoa_to_sheet([cols.map(c => LABEL[c] || c), ...rs.map(r => cols.map(c => Store.val(r, c)))]));
    X.writeFile(wb, `SAE_2026_${safe(name)}.xlsx`);
  }

/* ── Filtros en cascada ── */
  function fill() {
    $('reg').innerHTML = '<option value="">Todas las regiones</option>' + Store.dict.reg.map(o => `<option${o === sel.reg ? ' selected' : ''}>${esc(o)}</option>`).join('');
    LEVELS.forEach((k, i) => {
      const el = $(k), label = ['Todas las UT', 'Todos los departamentos', 'Todas las provincias', 'Todos los distritos'][i];
      const opts = Store.uniq(scope(i), k);
      el.innerHTML = `<option value="">${label}</option>` + opts.map(o => `<option${o === sel[k] ? ' selected' : ''}>${esc(o)}</option>`).join('');
      el.disabled = i > 1 && !sel[LEVELS[i - 1]];
    });
  }
  LEVELS.forEach((k, i) => $(k).addEventListener('change', e => {
    sel[k] = e.target.value; LEVELS.slice(i + 1).forEach(n => sel[n] = ''); fill(); render();
  }));
  $('reg').addEventListener('change', e => { sel.reg = e.target.value; fill(); render(); });
  $('reset').onclick = () => { sel.reg = ''; LEVELS.forEach(k => sel[k] = ''); fill(); render(); };
  $('fuente').textContent = window.SAE.fuente;
  $('corte').textContent = 'II tramo · corte al ' + window.SAE.corte;
  fill(); render();
})();
