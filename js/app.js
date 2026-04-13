/* TradeFlow SV — app.js (demo visual, sin backend) */

/* ── AUTH CHECK ── */
var CURRENT_USER = null;
(function() {
  var stored = localStorage.getItem('tf_user');
  if (!stored) { window.location.href = 'login.html'; return; }
  CURRENT_USER = JSON.parse(stored);
  document.getElementById('ub-company').textContent = CURRENT_USER.company;
  document.getElementById('ub-ior').textContent = CURRENT_USER.ior || 'No registrado';
  document.getElementById('dash-title').textContent = CURRENT_USER.company;
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('es-SV', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
})();

/* ── HELPERS ── */
function fmt(n) { return Number(n).toLocaleString('es-SV'); }
function fmtDate(d) { return d || '—'; }

function tag(text, color) {
  return '<span class="tag ' + color + '">' + text + '</span>';
}

function statusTag(s) {
  var map = { held:'FDA Hold', clear:'Liberado', transit:'En Transito', review:'CBP Review' };
  var col = { held:'red', clear:'green', transit:'blue', review:'amber' };
  return tag(map[s] || s, col[s] || 'neutral');
}

function statusColor(s) {
  return { held:'#dc2626', clear:'#16a34a', transit:'#2563eb', review:'#d97706' }[s] || '#aaa';
}

function catColor(cat) {
  if (!cat) return 'neutral';
  var c = cat.toLowerCase();
  if (c.includes('food')) return 'red';
  if (c.includes('drug')) return 'amber';
  if (c.includes('cosm')) return 'neutral';
  return 'neutral';
}

function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (type || 'ok');
  setTimeout(function() { el.classList.remove('show'); }, 3000);
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

/* ── GET MY SHIPMENTS ── */
function getMyShipments() {
  var id = CURRENT_USER.id;
  if (CURRENT_USER.role === 'admin') {
    var all = [];
    for (var k in DEMO_SHIPMENTS) { all = all.concat(DEMO_SHIPMENTS[k]); }
    return all;
  }
  return DEMO_SHIPMENTS[id] || [];
}

/* ── NAVIGATION ── */
var loaded = {};

function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  var nb = document.querySelector('[data-page="' + name + '"]');
  if (nb) nb.classList.add('active');

  var loaders = {
    'mi-dashboard': loadMyDash,
    'mis-envios':   loadMisEnvios,
    'mi-fda':       loadMyFDA,
    'inteligencia': loadInteligencia,
    'referencia':   loadReferencia,
    'perfil':       loadPerfil,
  };
  if (loaders[name]) loaders[name]();
}

function showSub(id, btn) {
  var page = btn.closest('.page-wrap');
  page.querySelectorAll('.sub-pane').forEach(function(p) { p.classList.remove('active'); });
  page.querySelectorAll('.sub-tab').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('sub-' + id).classList.add('active');
  btn.classList.add('active');
  if (id === 'intel-rechazos' && !loaded['rf'])  { loaded['rf']  = 1; renderRefusals(DEMO_REFUSALS); }
  if (id === 'intel-alerts'   && !loaded['al'])  { loaded['al']  = 1; renderAlerts(); }
  if (id === 'intel-dash'     && !loaded['idb']) { loaded['idb'] = 1; renderIntelDash(); }
}

/* ═══════════════════════════════
   1. MI DASHBOARD
═══════════════════════════════ */
function loadMyDash() {
  var ships = getMyShipments();
  var counts = { held:0, review:0, transit:0, clear:0 };
  ships.forEach(function(s) { if (counts[s.status] !== undefined) counts[s.status]++; });
  var held = ships.filter(function(s) { return s.status === 'held'; });
  var totalCost = ships.reduce(function(sum, s) {
    return sum + (s.costs_normal || []).reduce(function(a, c) { return a + c[1]; }, 0);
  }, 0);
  var extraCost = held.reduce(function(sum, s) {
    return sum + (s.costs_extra || []).reduce(function(a, c) { return a + c[1]; }, 0);
  }, 0);

  var html = '<div class="fade-in">';

  if (held.length) {
    html += '<div class="notice danger" style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><strong>Atencion &mdash; ' + held.length + ' envio(s) con FDA Hold activo.</strong> Cuenta con 90 dias para responder o reexportar el producto.</div>' +
      '<a href="#" onclick="showPage(\'mis-envios\')" style="margin-left:16px;background:#fff;border:1px solid #fecaca;border-radius:4px;padding:5px 12px;font-size:12px;color:#111;text-decoration:none;white-space:nowrap">Ver mis envios &rarr;</a>' +
      '</div>';
  } else {
    html += '<div class="notice ok"><strong>Sin detenciones FDA activas.</strong> Todos sus envios estan en regla.</div>';
  }

  html += '<div class="kpi-strip kpi-strip-4">' +
    '<div class="kpi-cell red"><div class="kpi-label">FDA Hold</div><div class="kpi-value">' + counts.held + '</div><div class="kpi-note">envio(s) detenidos</div></div>' +
    '<div class="kpi-cell amber"><div class="kpi-label">CBP Review</div><div class="kpi-value">' + counts.review + '</div><div class="kpi-note">en revision aduanas</div></div>' +
    '<div class="kpi-cell blue"><div class="kpi-label">En Transito</div><div class="kpi-value">' + counts.transit + '</div><div class="kpi-note">navegando actualmente</div></div>' +
    '<div class="kpi-cell green"><div class="kpi-label">Liberados</div><div class="kpi-value">' + counts.clear + '</div><div class="kpi-note">entregados</div></div>' +
    '</div>';

  html += '<div class="grid-col-2">';

  // Envios activos
  html += '<div class="card"><div class="card-head"><div class="card-title">Envios Activos</div><a href="#" onclick="showPage(\'mis-envios\')" style="font-size:11px;color:#888;text-decoration:none;font-family:\'Courier New\',monospace">Ver todos &rarr;</a></div><div class="card-body">';
  if (!ships.length) {
    html += '<div style="text-align:center;padding:24px;color:#888">Sin envios registrados. <button class="btn-primary" onclick="openModal(\'modal-add\')" style="margin-top:8px">Registrar envio</button></div>';
  } else {
    ships.slice(0,5).forEach(function(s) {
      html += '<div class="shipment-row" onclick="showPage(\'mis-envios\')">' +
        '<div class="sr-bar" style="background:' + statusColor(s.status) + '"></div>' +
        '<div class="sr-info"><div class="sr-id">' + s.entry + '</div>' +
        '<div class="sr-name">' + s.product + '</div>' +
        '<div class="sr-sub">' + s.vessel + ' &middot; ' + (s.dest.split(',')[0] || '—') + '</div></div>' +
        '<div class="sr-right">' + statusTag(s.status) + '<div style="font-size:11px;color:#aaa;font-family:\'Courier New\',monospace">' + s.eta + '</div></div>' +
        '</div>';
    });
  }
  html += '</div></div>';

  // Panel derecho
  html += '<div style="display:flex;flex-direction:column;gap:16px">';

  // Costos
  html += '<div class="card"><div class="card-head"><div class="card-title">Costos Estimados</div><div class="card-meta">todos los envios</div></div><div class="card-body">';
  html += '<div class="cost-row"><span class="cost-row-label">Total envios activos</span><span class="cost-row-val">$' + fmt(totalCost) + '</span></div>';
  html += '<div class="cost-row"><span class="cost-row-label">Prom. por envio</span><span class="cost-row-val">$' + (ships.length ? fmt(Math.round(totalCost / ships.length)) : '0') + '</span></div>';
  html += '<div class="cost-row"><span class="cost-row-label">Costos FDA Hold</span><span class="cost-row-val" style="color:' + (extraCost ? '#dc2626' : '#16a34a') + '">' + (extraCost ? '$' + fmt(extraCost) : 'Sin costos adicionales') + '</span></div>';
  html += '<div style="margin-top:8px;font-size:11px;color:#bbb;font-family:\'Courier New\',monospace">Estimado basado en tarifas promedio de mercado</div>';
  html += '</div></div>';

  // Estado FDA
  html += '<div class="card"><div class="card-head"><div class="card-title">Estado FDA &mdash; Su Empresa</div></div><div class="card-body">';
  html += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Import Alerts activos (El Salvador)</div>';
  html += '<div style="font-size:26px;font-weight:700;color:' + (DEMO_ALERTS.length ? '#d97706' : '#16a34a') + '">' + DEMO_ALERTS.length + '</div>';
  html += '<div style="font-size:11px;color:#888;margin-top:2px">Aplican a toda empresa exportadora SV</div></div>';
  html += '<div style="border-top:1px solid #ebebeb;padding-top:10px">';
  html += '<a href="#" onclick="showPage(\'mi-fda\')" style="display:block;font-size:13px;color:#111;font-weight:700;padding:5px 0;border-bottom:1px solid #ebebeb;text-decoration:none">Ver mi historial FDA &rarr;</a>';
  html += '<a href="#" onclick="showPage(\'inteligencia\')" style="display:block;font-size:13px;color:#888;padding:5px 0;text-decoration:none">Ver inteligencia de mercado &rarr;</a>';
  html += '</div></div></div>';

  html += '</div></div>'; // end grid + fade-in

  document.getElementById('mi-dash-content').innerHTML = html;
}

/* ═══════════════════════════════
   2. MIS ENVIOS
═══════════════════════════════ */
var myExtraShips = [];

function loadMisEnvios() {
  var ships = getMyShipments().concat(myExtraShips);
  var sub = document.getElementById('mis-sub');
  if (sub) sub.textContent = ships.length + ' envio(s) registrado(s)';

  var counts = { held:0, review:0, transit:0, clear:0 };
  ships.forEach(function(s) { if (counts[s.status] !== undefined) counts[s.status]++; });

  var html = '<div class="kpi-strip kpi-strip-4">' +
    '<div class="kpi-cell red"><div class="kpi-label">FDA Hold</div><div class="kpi-value">' + counts.held + '</div></div>' +
    '<div class="kpi-cell amber"><div class="kpi-label">CBP Review</div><div class="kpi-value">' + counts.review + '</div></div>' +
    '<div class="kpi-cell blue"><div class="kpi-label">En Transito</div><div class="kpi-value">' + counts.transit + '</div></div>' +
    '<div class="kpi-cell green"><div class="kpi-label">Liberados</div><div class="kpi-value">' + counts.clear + '</div></div>' +
    '</div>';

  html += '<div class="card"><table class="data-table"><thead><tr>' +
    '<th>Entry No.</th><th>Producto</th><th>Barco / Contenedor</th><th>Ruta</th><th>ETA</th><th>Estado</th><th></th>' +
    '</tr></thead><tbody>';

  ships.forEach(function(s) {
    html += '<tr>' +
      '<td><div style="font-family:\'Courier New\',monospace;font-size:12px">' + s.entry + '</div><div style="font-family:\'Courier New\',monospace;font-size:10px;color:#aaa">' + (s.bl || '—') + '</div></td>' +
      '<td style="max-width:180px">' + s.product + '</td>' +
      '<td><div style="font-size:12px;font-weight:700">' + (s.vessel || '—') + '</div><div style="font-family:\'Courier New\',monospace;font-size:10px;color:#aaa">' + (s.container || '—') + '</div></td>' +
      '<td style="font-size:12px;color:#888">' + (s.origin || '').split(',')[0] + ' &rarr; ' + (s.dest || '').split(',')[0] + '</td>' +
      '<td style="font-family:\'Courier New\',monospace;font-size:12px">' + s.eta + '</td>' +
      '<td>' + statusTag(s.status) + '</td>' +
      '<td><button onclick="viewShipment(\'' + s.id + '\')" style="background:none;border:1px solid #ddd;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:Arial;font-weight:700">Ver</button></td>' +
      '</tr>';
  });

  html += '</tbody></table></div>';
  document.getElementById('mis-content').innerHTML = html;
}

function viewShipment(id) {
  var all = [];
  for (var k in DEMO_SHIPMENTS) { all = all.concat(DEMO_SHIPMENTS[k]); }
  all = all.concat(myExtraShips);
  var s = null;
  for (var i = 0; i < all.length; i++) { if (String(all[i].id) === String(id)) { s = all[i]; break; } }
  if (!s) return;

  var totalN = (s.costs_normal || []).reduce(function(a, c) { return a + c[1]; }, 0);
  var totalE = (s.costs_extra  || []).reduce(function(a, c) { return a + c[1]; }, 0);

  var m = document.createElement('div');
  m.className = 'overlay open';

  var tlHtml = (s.timeline || []).map(function(t) {
    return '<div class="tl-step"><div class="tl-dot ' + t.st + '">' + t.lbl.substring(0,2).toUpperCase() + '</div><div class="tl-label">' + t.lbl + '</div><div class="tl-date">' + t.date + '</div></div>';
  }).join('');

  var holdsHtml = '';
  if (s.fda_holds && s.fda_holds.length) {
    holdsHtml = '<div class="fda-panel"><div class="fda-panel-title">FDA Hold &mdash; ' + s.fda_holds.length + ' cargo(s) de refusal</div><div class="fda-panel-sub">90 dias para responder, reconditioner o reexportar el producto.</div>' +
      '<table class="data-table" style="background:#fff;border-radius:5px"><thead><tr><th>Codigo</th><th>Seccion</th><th>Descripcion</th></tr></thead><tbody>' +
      s.fda_holds.map(function(h) {
        return '<tr><td>' + tag(h.code,'red') + '</td><td style="font-family:\'Courier New\',monospace;font-size:11px;color:#b91c1c">' + h.section + '</td><td style="font-size:12px">' + h.desc + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  } else {
    holdsHtml = '<div class="notice ok"><strong>Sin cargos FDA.</strong> Producto liberado sin restricciones.</div>';
  }

  var agenciesHtml = (s.agencies || []).map(function(a) {
    var sc = a.status === 'pass' ? '#16a34a' : a.status === 'fail' ? '#dc2626' : a.status === 'pending' ? '#d97706' : '#aaa';
    var st = a.status === 'pass' ? 'Aprobado' : a.status === 'fail' ? 'Detenido' : a.status === 'pending' ? 'En revision' : 'N/A';
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 10px;background:#f7f7f7;border:1px solid #e0e0e0;border-radius:5px;margin-bottom:6px">' +
      '<div><div style="font-weight:700;font-size:12px">' + a.name + '</div><div style="font-size:11px;color:#888;margin-top:2px">' + a.note + '</div></div>' +
      '<div style="margin-left:12px;font-weight:700;font-size:12px;color:' + sc + ';flex-shrink:0">' + st + '</div></div>';
  }).join('');

  var costsNHtml = (s.costs_normal || []).map(function(c) {
    return '<div class="cost-row"><span class="cost-row-label">' + c[0] + '</span><span class="cost-row-val">' + (c[1] === 0 ? '$0 (CAFTA)' : '$' + fmt(c[1])) + '</span></div>';
  }).join('') + '<div class="cost-row" style="border-top:2px solid #ddd;font-weight:700"><span class="cost-row-label">Subtotal</span><span class="cost-row-val">$' + fmt(totalN) + '</span></div>';

  var costsEHtml = totalE > 0 ?
    (s.costs_extra || []).map(function(c) {
      return '<div class="cost-row"><span class="cost-row-label">' + c[0] + '</span><span class="cost-row-val" style="color:#dc2626">$' + fmt(c[1]) + '</span></div>';
    }).join('') + '<div class="cost-row" style="border-top:2px solid #fecaca;font-weight:700"><span class="cost-row-label" style="color:#b91c1c">Total con hold</span><span class="cost-row-val" style="color:#dc2626">$' + fmt(totalN + totalE) + '</span></div>'
    : '<div style="text-align:center;padding:20px;color:#16a34a;font-weight:700;font-size:13px">Sin costos adicionales</div>';

  m.innerHTML = '<div class="modal" style="max-width:720px">' +
    '<div class="modal-head"><div><div class="modal-title">' + s.entry + '</div><div class="modal-sub">' + s.product + ' &middot; Broker: ' + (s.broker || '—') + '</div></div>' +
    '<button class="modal-close" onclick="this.closest(\'.overlay\').remove()">&#215;</button></div>' +
    '<div class="modal-body">' +
    '<div class="info-grid">' +
    '<div class="info-cell"><div class="ic-label">Barco</div><div class="ic-value">' + (s.vessel || '—') + '</div></div>' +
    '<div class="info-cell"><div class="ic-label">Contenedor</div><div class="ic-value">' + (s.container || '—') + '</div></div>' +
    '<div class="info-cell"><div class="ic-label">ETA</div><div class="ic-value">' + s.eta + '</div></div>' +
    '<div class="info-cell"><div class="ic-label">Estado</div><div class="ic-value">' + statusTag(s.status) + '</div></div>' +
    '</div>' +
    '<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Estado del Envio</div>' +
    '<div class="timeline">' + tlHtml + '</div></div>' +
    holdsHtml +
    '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Agencias Regulatorias</div>' + agenciesHtml + '</div>' +
    '<div class="grid-2" style="margin-bottom:0">' +
    '<div class="card"><div class="card-head"><div class="card-title">Costos de Importacion</div></div><div class="card-body">' + costsNHtml + '</div></div>' +
    '<div class="card">' + (totalE > 0 ? '<div class="card-head" style="background:#fef2f2"><div class="card-title" style="color:#b91c1c">Costos FDA Hold</div></div><div class="card-body">' + costsEHtml + '</div>' : '<div class="card-body" style="display:flex;align-items:center;justify-content:center;padding:32px">' + costsEHtml + '</div>') + '</div>' +
    '</div>' +
    '</div></div>';

  document.body.appendChild(m);
  m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
}

function addShipment() {
  var entry   = document.getElementById('s-entry').value.trim();
  var product = document.getElementById('s-product').value.trim();
  if (!entry || !product) { toast('Ingrese Entry Number y Producto.', 'err'); return; }
  var ns = {
    id: 'new-' + Date.now(),
    entry: entry,
    bl: document.getElementById('s-bl').value,
    vessel: document.getElementById('s-vessel').value,
    container: document.getElementById('s-container').value,
    product: product,
    origin: document.getElementById('s-origin').value || 'Puerto Acajutla, SV',
    dest: document.getElementById('s-dest').value || 'Port of Los Angeles, CA',
    etd: document.getElementById('s-etd').value || '—',
    eta: document.getElementById('s-eta').value || '—',
    arrived: '—',
    status: 'transit',
    broker: document.getElementById('s-broker').value || '—',
    fda_holds: [], costs_normal: [], costs_extra: [],
    timeline: [
      {lbl:'Embarcado',date:'—',sub:'—',st:'done'},
      {lbl:'En transito',date:'En curso',sub:document.getElementById('s-vessel').value||'—',st:'active'},
      {lbl:'Prior Notice',date:'Pendiente',sub:'—',st:'pending'},
      {lbl:'Arribo',date:'Pendiente',sub:'—',st:'pending'},
      {lbl:'CBP',date:'Pendiente',sub:'—',st:'pending'},
      {lbl:'FDA',date:'Pendiente',sub:'—',st:'pending'},
      {lbl:'Liberacion',date:'Pendiente',sub:'—',st:'pending'},
    ],
    agencies:[
      {name:'CBP Aduanas',status:'pending',note:'ISF pendiente de presentacion.'},
      {name:'USDA APHIS',status:'na',note:'Por determinar segun tipo de producto.'},
      {name:'FDA',status:'pending',note:'Prior Notice pendiente de envio.'},
    ],
  };
  myExtraShips.push(ns);
  closeModal('modal-add');
  document.getElementById('s-entry').value = '';
  document.getElementById('s-product').value = '';
  toast('Envio registrado correctamente.');
  showPage('mis-envios');
}

/* ═══════════════════════════════
   3. MI HISTORIAL FDA
═══════════════════════════════ */
function loadMyFDA() {
  var company = CURRENT_USER.company;
  var myRefusals = DEMO_REFUSALS.filter(function(r) {
    return r.firm.toLowerCase().includes(company.toLowerCase().split(' ')[0]);
  });

  var html = '<div class="fade-in">';

  html += '<div class="kpi-strip kpi-strip-4" style="grid-template-columns:repeat(3,1fr)">' +
    '<div class="kpi-cell ' + (myRefusals.length ? 'red' : '') + '"><div class="kpi-label">Rechazos Historicos</div><div class="kpi-value">' + myRefusals.length + '</div><div class="kpi-note">registros en FDA</div></div>' +
    '<div class="kpi-cell amber"><div class="kpi-label">Import Alerts SV</div><div class="kpi-value">' + DEMO_ALERTS.length + '</div><div class="kpi-note">aplican a toda empresa SV</div></div>' +
    '<div class="kpi-cell"><div class="kpi-label">Tipos de cargo propios</div><div class="kpi-value">' + (myRefusals.length ? [...new Set(myRefusals.flatMap(function(r) { return r.charges.split(',').map(function(c) { return c.trim(); }); }))].length : 0) + '</div></div>' +
    '</div>';

  // Mis rechazos
  html += '<div class="card" style="margin-bottom:20px"><div class="card-head"><div class="card-title">Rechazos FDA &mdash; ' + company + '</div><div class="card-meta">FDA Dashboard API</div></div>';
  if (!myRefusals.length) {
    html += '<div class="card-body"><div class="notice ok"><strong>Sin rechazos encontrados.</strong> No se encontraron registros de rechazo para "' + company + '" en la base de datos publica de la FDA.</div>' +
      '<div style="font-size:12px;color:#aaa;font-family:\'Courier New\',monospace">Nota: Esta demo usa datos de ejemplo. En produccion se consulta la FDA API en tiempo real.</div></div>';
  } else {
    html += '<table class="data-table"><thead><tr><th>Shipment ID</th><th>Producto</th><th>Cargos de Refusal</th><th>Fecha</th></tr></thead><tbody>' +
      myRefusals.map(function(r) {
        var charges = r.charges.split(',').map(function(c) { return tag(c.trim(), /LISTERIA|SALMONELLA|INSANITARY|FILTHY|AFLATOXIN/.test(c) ? 'red' : 'amber'); }).join(' ');
        return '<tr><td style="font-family:\'Courier New\',monospace;font-size:12px">' + r.id + '</td><td>' + r.product + '</td><td>' + charges + '</td><td style="font-family:\'Courier New\',monospace;font-size:12px">' + r.date + '</td></tr>';
      }).join('') +
      '</tbody></table>';
  }
  html += '</div>';

  // Import Alerts que aplican
  html += '<div class="card" style="margin-bottom:20px"><div class="card-head"><div class="card-title">Import Alerts Activos &mdash; El Salvador</div><div class="card-meta">Aplican a toda empresa exportadora SV</div></div><div class="card-body">';
  html += '<div class="notice warn">Estos <strong>' + DEMO_ALERTS.length + ' Import Alerts</strong> aplican a todas las empresas de El Salvador que exporten los productos listados. Verifique si sus productos estan incluidos.</div>';
  DEMO_ALERTS.slice(0,5).forEach(function(a) {
    html += '<div style="padding:10px 0;border-bottom:1px solid #ebebeb;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
      '<div><div style="font-family:\'Courier New\',monospace;font-size:11px;font-weight:700;margin-bottom:3px">Alert ' + a.num + ' &mdash; ' + tag('DWPE','red') + '</div>' +
      '<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:3px">' + a.title.substring(0,90) + (a.title.length > 90 ? '...' : '') + '</div>' +
      '<div style="font-size:12px;color:#888"><strong style="color:#555">Productos:</strong> ' + a.products + '</div></div>' +
      '<a href="' + a.url + '" target="_blank" style="font-size:11px;color:#111;border:1px solid #ddd;border-radius:4px;padding:3px 10px;text-decoration:none;white-space:nowrap;background:#f7f7f7;font-family:\'Courier New\',monospace">FDA &rarr;</a>' +
      '</div>';
  });
  if (DEMO_ALERTS.length > 5) {
    html += '<div style="padding-top:10px;font-size:12px;color:#888"><a href="#" onclick="showPage(\'inteligencia\')" style="color:#111;font-weight:700">Ver los ' + DEMO_ALERTS.length + ' Import Alerts completos &rarr;</a></div>';
  }
  html += '</div></div>';

  html += '</div>';
  document.getElementById('mi-fda-content').innerHTML = html;
}

/* ═══════════════════════════════
   4. INTELIGENCIA DE MERCADO
═══════════════════════════════ */
function loadInteligencia() {
  if (!loaded['idb']) { loaded['idb'] = 1; renderIntelDash(); }
}

function renderIntelDash() {
  var d = DEMO_SUMMARY;
  var maxY = Math.max.apply(null, d.years.map(function(y) { return y[1]; }));
  var catColors = ['#dc2626','#d97706','#2563eb','#16a34a','#888'];

  var html = '<div class="notice info">Datos generales de todos los exportadores de El Salvador. Para sus datos especificos use <a href="#" onclick="showPage(\'mi-fda\')">Mi Historial FDA</a>.</div>';

  html += '<div class="kpi-strip kpi-strip-5">' +
    '<div class="kpi-cell red"><div class="kpi-label">Total detenciones SV</div><div class="kpi-value">' + d.total + '</div><div class="kpi-note">FDA API</div></div>' +
    '<div class="kpi-cell amber"><div class="kpi-label">Alimentos</div><div class="kpi-value">' + d.cats[0][1] + '</div></div>' +
    '<div class="kpi-cell blue"><div class="kpi-label">Medicamentos</div><div class="kpi-value">' + d.cats[1][1] + '</div></div>' +
    '<div class="kpi-cell"><div class="kpi-label">Cosmeticos</div><div class="kpi-value">' + d.cats[2][1] + '</div></div>' +
    '<div class="kpi-cell"><div class="kpi-label">Costo prom.</div><div class="kpi-value">$4,200</div><div class="kpi-note">USD por detencion</div></div>' +
    '</div>';

  html += '<div class="grid-2">';

  // Barras
  html += '<div class="card"><div class="card-head"><div class="card-title">Principales Causas</div></div><div class="card-body"><div class="hbar-list">';
  var colors = ['red','red','amber','amber','blue','blue','gray','gray'];
  d.charges.forEach(function(c, i) {
    var pct = Math.round((c[1] / d.charges[0][1]) * 100);
    html += '<div class="hbar"><div class="hbar-label">' + c[0] + '</div>' +
      '<div class="hbar-track"><div class="hbar-fill ' + (colors[i] || 'gray') + '" data-w="' + pct + '%" style="width:0%">' + c[1] + '</div></div></div>';
  });
  html += '</div></div></div>';

  // Columnas por ano
  html += '<div class="card"><div class="card-head"><div class="card-title">Detenciones por Ano Fiscal</div><div class="card-meta">El Salvador</div></div><div class="card-body">';
  html += '<div class="col-chart">';
  d.years.forEach(function(y, i) {
    var h = Math.round((y[1] / maxY) * 100);
    html += '<div class="col-wrap"><div class="col-fill' + (i === d.years.length-1 ? ' current' : '') + '" style="height:' + h + '%"><span class="col-num">' + y[1] + '</span></div><div class="col-label">' + y[0] + '</div></div>';
  });
  html += '</div>';

  // Donut categorias
  html += '<div class="donut-row" style="margin-top:16px">';
  var total = d.cats.reduce(function(s, c) { return s + c[1]; }, 0);
  var circ = 2 * Math.PI * 36, off = 0;
  html += '<svg width="90" height="90" viewBox="0 0 100 100" style="flex-shrink:0">';
  d.cats.forEach(function(c, i) {
    var dash = (c[1] / total) * circ;
    html += '<circle cx="50" cy="50" r="36" fill="none" stroke="' + catColors[i] + '" stroke-width="18" stroke-dasharray="' + dash + ' ' + circ + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 50 50)"/>';
    off += dash;
  });
  html += '<text x="50" y="47" text-anchor="middle" fill="#111" font-size="13" font-weight="700">' + total + '</text>';
  html += '<text x="50" y="58" text-anchor="middle" fill="#aaa" font-size="7" font-family="Courier New">TOTAL</text>';
  html += '</svg>';
  html += '<div class="donut-legend">';
  d.cats.forEach(function(c, i) {
    html += '<div class="dl-item"><div class="dl-dot" style="background:' + catColors[i] + '"></div><span class="dl-name">' + c[0] + '</span><span class="dl-val">' + c[1] + '</span></div>';
  });
  html += '</div></div>';

  html += '</div></div>'; // card body + card
  html += '</div>'; // grid-2

  html += '<div style="font-size:11px;color:#bbb;text-align:right;font-family:\'Courier New\',monospace">datadashboard.fda.gov &middot; api-datadashboard.fda.gov/v1/import_refusals</div>';

  document.getElementById('dash-content').innerHTML = html;
  setTimeout(function() {
    document.querySelectorAll('.hbar-fill[data-w]').forEach(function(el) { el.style.width = el.dataset.w; });
  }, 100);
}

var rfFilter = 'all';
function renderRefusals(rows) {
  document.getElementById('rf-count').textContent = rows.length;
  var tbody = document.getElementById('rf-tbody');
  tbody.innerHTML = rows.map(function(r) {
    var charges = r.charges.split(',').map(function(c) {
      return tag(c.trim(), /LISTERIA|SALMONELLA|INSANITARY|FILTHY|AFLATOXIN/.test(c) ? 'red' : 'amber');
    }).join(' ');
    return '<tr>' +
      '<td style="font-family:\'Courier New\',monospace;font-size:12px">' + r.id + '</td>' +
      '<td><div style="font-weight:700">' + r.firm + '</div><div style="font-size:11px;color:#888">' + r.city + '</div></td>' +
      '<td>' + tag(r.cat, catColor(r.cat)) + '</td>' +
      '<td style="font-size:12px">' + r.product + '</td>' +
      '<td>' + charges + '</td>' +
      '<td style="font-family:\'Courier New\',monospace;font-size:12px">' + r.date + '</td>' +
      '</tr>';
  }).join('');
}

function filterRf() {
  var q = document.getElementById('rf-search').value.toLowerCase();
  var rows = DEMO_REFUSALS.filter(function(r) {
    if (rfFilter !== 'all' && !r.cat.toLowerCase().includes(rfFilter)) return false;
    if (!q) return true;
    return r.firm.toLowerCase().includes(q) || r.product.toLowerCase().includes(q) || r.charges.toLowerCase().includes(q);
  });
  renderRefusals(rows);
}

function setRfFilter(btn, f) {
  rfFilter = f;
  document.querySelectorAll('#page-inteligencia .filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  filterRf();
}

function renderAlerts() {
  var html = '<div class="notice warn"><strong>DWPE &mdash; Detention Without Physical Examination.</strong> Empresas listadas en estos alerts son detenidas automaticamente en el puerto sin inspeccion fisica. Fuente: <a href="https://www.accessdata.fda.gov/cms_ia/country_SV.html" target="_blank">accessdata.fda.gov/cms_ia/country_SV.html</a></div>' +
    '<div class="count-row"><span style="font-weight:700;color:#111">' + DEMO_ALERTS.length + ' Import Alerts activos para El Salvador</span><a href="https://www.accessdata.fda.gov/cms_ia/country_SV.html" target="_blank">Ver en FDA.gov</a></div>';

  DEMO_ALERTS.forEach(function(a) {
    html += '<div class="alert-card">' +
      '<div class="alert-card-head"><div class="alert-num">Import Alert ' + a.num + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="font-family:\'Courier New\',monospace;font-size:10px;color:#aaa">' + a.date + '</span>' + tag('DWPE','red') +
      '<a href="' + a.url + '" target="_blank" style="font-family:\'Courier New\',monospace;font-size:10px;color:#111;border:1px solid #ddd;border-radius:4px;padding:2px 8px;text-decoration:none;background:#fff">FDA</a></div></div>' +
      '<div class="alert-card-body"><div class="alert-title">' + a.title + '</div>' +
      '<div class="alert-meta-row"><span><strong>Productos:</strong> ' + a.products + '</span><span><strong>Cargo:</strong> ' + a.charge + '</span></div>' +
      '<div class="alert-reason"><strong>Razon:</strong> ' + a.reason + '</div></div></div>';
  });

  html += '<div style="margin-top:10px;font-size:11px;color:#bbb;font-family:\'Courier New\',monospace;text-align:right">accessdata.fda.gov/cms_ia/country_SV.html &mdash; Datos verificados</div>';
  document.getElementById('alerts-content').innerHTML = html;
}

/* ═══════════════════════════════
   5. REFERENCIA
═══════════════════════════════ */
var cdFilter = 'all';
function loadReferencia() {
  if (loaded['cd']) return;
  loaded['cd'] = 1;
  renderCodes(DEMO_CHARGES);
}

function renderCodes(rows) {
  document.getElementById('cd-count').textContent = rows.length;
  document.getElementById('cd-tbody').innerHTML = rows.map(function(r) {
    return '<tr>' +
      '<td>' + tag(r.code, r.cat === 'ADULTERATION' ? 'red' : 'amber') + '</td>' +
      '<td style="font-family:\'Courier New\',monospace;font-size:11px;color:#b91c1c">' + r.section + '</td>' +
      '<td>' + tag(r.cat, r.cat === 'ADULTERATION' ? 'red' : 'amber') + '</td>' +
      '<td><div style="font-size:13px;font-weight:700;color:#111;margin-bottom:2px">' + r.es + '</div><div style="font-size:11px;color:#aaa">' + r.en.substring(0,80) + '...</div></td>' +
      '<td><a href="https://www.ecfr.gov/current/title-21" target="_blank" style="font-family:\'Courier New\',monospace;font-size:11px;color:#111">eCFR</a></td>' +
      '</tr>';
  }).join('');
}

function filterCodes() {
  var q = document.getElementById('cd-search').value.toLowerCase();
  var rows = DEMO_CHARGES.filter(function(r) {
    if (cdFilter !== 'all' && r.cat !== cdFilter) return false;
    if (!q) return true;
    return r.code.toLowerCase().includes(q) || r.es.toLowerCase().includes(q) || r.section.toLowerCase().includes(q);
  });
  renderCodes(rows);
}

function setCdFilter(btn, f) {
  cdFilter = f;
  document.querySelectorAll('#page-referencia .filter-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  filterCodes();
}

/* ═══════════════════════════════
   PERFIL
═══════════════════════════════ */
function loadPerfil() {
  var u = CURRENT_USER;
  document.getElementById('perfil-content').innerHTML = '<div style="max-width:600px">' +
    '<div class="card"><div class="card-head"><div class="card-title">Informacion de Cuenta</div></div><div class="card-body">' +
    '<div class="form-group"><label class="form-label">Nombre</label><input class="form-input" id="p-name" value="' + (u.name || '') + '"></div>' +
    '<div class="form-group"><label class="form-label">Empresa</label><input class="form-input" id="p-company" value="' + (u.company || '') + '"></div>' +
    '<div class="form-group"><label class="form-label">Correo</label><input class="form-input" value="' + (u.email || '') + '" disabled></div>' +
    '<div class="form-group"><label class="form-label">Numero IOR</label><input class="form-input" id="p-ior" value="' + (u.ior || '') + '"><div class="form-hint">Importer of Record &mdash; asignado por CBP</div></div>' +
    '<div class="form-group"><label class="form-label">Tipo de cuenta</label><input class="form-input" value="' + (u.role === 'admin' ? 'Administrador' : 'Importador') + '" disabled></div>' +
    '<button class="btn-primary" onclick="saveProfile()" style="width:100%">Guardar cambios</button>' +
    '</div></div></div>';
}

function saveProfile() {
  CURRENT_USER.name    = document.getElementById('p-name').value;
  CURRENT_USER.company = document.getElementById('p-company').value;
  CURRENT_USER.ior     = document.getElementById('p-ior').value;
  localStorage.setItem('tf_user', JSON.stringify(CURRENT_USER));
  document.getElementById('ub-company').textContent = CURRENT_USER.company;
  toast('Perfil actualizado.');
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', function() { showPage('mi-dashboard'); });
