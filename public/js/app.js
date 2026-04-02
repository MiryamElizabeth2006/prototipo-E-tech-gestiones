// ============================================================
// CONFIGURACIÓN GLOBAL
// ============================================================
const API = 'http://localhost:3000/api';
let token = localStorage.getItem('token');
let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
let ordenesCache = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (token && usuario) iniciarApp();
    else {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('mainContainer').style.display = 'none';
    }

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('ordenForm').addEventListener('submit', handleGuardarOrden);
    document.getElementById('equipoForm').addEventListener('submit', handleGuardarEquipo);
    document.getElementById('usuarioForm').addEventListener('submit', handleGuardarUsuario);
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);

    // Filtros de órdenes
    document.getElementById('buscarOrden').addEventListener('input', filtrarOrdenes);
    document.getElementById('filtroEstado').addEventListener('change', filtrarOrdenes);

    // Overlay sidebar
    const overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', toggleSidebar);

    // Firmas
    initFirma('canvasTecnico');
    initFirma('canvasCliente');
});

// ============================================================
// AUTH
// ============================================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';

    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

        token = data.token;
        usuario = data.usuario;
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuario));
        iniciarApp();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    }
}

function handleLogout() {
    token = null; usuario = null;
    localStorage.clear();
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = 'flex';
}

function setDemo(email) {
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = 'password123';
}

// ============================================================
// INICIO DE APP
// ============================================================
function iniciarApp() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'flex';

    document.getElementById('sidebarUserName').textContent = usuario.nombre;
    document.getElementById('userAvatar').textContent = usuario.nombre.charAt(0).toUpperCase();
    document.getElementById('sidebarUserRol').textContent = usuario.rol;

    construirNav();

    const vistaInicial = usuario.rol === 'facturacion' ? 'facturacion'
        : usuario.rol === 'cliente' ? 'ordenes'
        : usuario.rol === 'tecnico' ? 'misDatos'
        : 'dashboard';
    cambiarVista(vistaInicial);
}

function construirNav() {
    const menus = {
        admin: [
            { icon: '', label: 'Dashboard', view: 'dashboard' },
            { icon: '', label: 'Órdenes', view: 'ordenes' },
            { icon: '', label: 'Nueva Orden', view: 'formulario' },
            { icon: '', label: 'Equipos', view: 'equipos' },
            { icon: '', label: 'Usuarios', view: 'usuarios' },
        ],
        tecnico: [
            { icon: '', label: 'Mi Resumen',         view: 'misDatos' },
            { icon: '', label: 'Órdenes Asignadas',  view: 'ordenes' },
        ],
        cliente: [
            { icon: '', label: 'Mis Órdenes', view: 'ordenes' },
        ],
        facturacion: [
            { icon: '', label: 'Facturación', view: 'facturacion' },
            { icon: '', label: 'Órdenes Cerradas', view: 'ordenes' },
        ]
    };

    const items = menus[usuario.rol] || menus.cliente;
    const nav = document.getElementById('sidebarNav');
    nav.innerHTML = items.map(item => `
        <button class="nav-item" data-view="${item.view}" onclick="cambiarVista('${item.view}')">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
        </button>
    `).join('');
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function cambiarVista(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    const view = document.getElementById(`${viewName}View`);
    if (view) view.classList.add('active');

    const navBtn = document.querySelector(`[data-view="${viewName}"]`);
    if (navBtn) navBtn.classList.add('active');

    const titles = {
        dashboard: 'Dashboard', ordenes: 'Órdenes de Trabajo',
        formulario: 'Nueva Orden', equipos: 'Catálogo de Equipos',
        usuarios: 'Gestión de Usuarios', facturacion: 'Panel de Facturación',
        misDatos: 'Mi Resumen', detalleOrden: 'Detalle de Orden',
        historialEquipo: 'Historial del Equipo',
        detalleCliente: 'Detalle de mi Orden',
        detalleFacturacion: 'Validación de Orden'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || '';

    if (viewName === 'dashboard') cargarDashboard();
    else if (viewName === 'misDatos') cargarMisDatos();
    else if (viewName === 'ordenes') cargarOrdenes();
    else if (viewName === 'formulario') { if (!document.getElementById('ordenId').value) prepararFormulario(); }
    else if (viewName === 'equipos') cargarEquipos();
    else if (viewName === 'usuarios') cargarUsuarios();
    else if (viewName === 'facturacion') cargarFacturacion();

    // Cerrar sidebar en móvil
    if (window.innerWidth <= 900) cerrarSidebar();
}

function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const content  = document.getElementById('pageContent');
    const menuBtn  = document.getElementById('menuToggle');

    if (window.innerWidth <= 900) {
        // Móvil: desliza el sidebar encima con overlay
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    } else {
        // Desktop: colapsa empujando el contenido
        const colapsando = !sidebar.classList.contains('open');
        sidebar.classList.toggle('open');
        content.classList.toggle('sidebar-collapsed');
        // Mostrar botón topbar solo cuando sidebar está oculto
        menuBtn.style.display = colapsando ? 'block' : 'none';
    }
}

function cerrarSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
}

// ============================================================
// DASHBOARD
// ============================================================
// (función completa definida más abajo junto con fallas por categoría)

function renderBarChart(containerId, data, labelKey, valueKey) {
    const container = document.getElementById(containerId);
    if (!data || data.length === 0) { container.innerHTML = '<p style="color:#9ca3af;font-size:13px">Sin datos</p>'; return; }
    const max = Math.max(...data.map(d => Number(d[valueKey])));
    container.innerHTML = data.map(item => {
        const pct = max > 0 ? (Number(item[valueKey]) / max * 100).toFixed(0) : 0;
        return `
            <div class="bar-item">
                <span class="bar-label" title="${item[labelKey]}">${item[labelKey]}</span>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${pct}%"><span>${item[valueKey]}</span></div>
                </div>
            </div>`;
    }).join('');
}

// ============================================================
// ÓRDENES
// ============================================================
async function cargarOrdenes() {
    try {
        const res = await apiFetch('/ordenes');
        ordenesCache = await res.json();
        renderOrdenes(ordenesCache);
    } catch (err) {
        document.getElementById('ordenesContainer').innerHTML = '<p>Error al cargar órdenes.</p>';
    }
}

function filtrarOrdenes() {
    const texto = document.getElementById('buscarOrden').value.toLowerCase();
    const estado = document.getElementById('filtroEstado').value;
    const filtradas = ordenesCache.filter(o => {
        const matchTexto = !texto ||
            o.numero_orden?.toLowerCase().includes(texto) ||
            o.cliente_nombre?.toLowerCase().includes(texto) ||
            o.tecnico_nombre?.toLowerCase().includes(texto);
        const matchEstado = !estado || o.estado === estado;
        return matchTexto && matchEstado;
    });
    renderOrdenes(filtradas);
}

function renderOrdenes(ordenes) {
    const container = document.getElementById('ordenesContainer');
    if (ordenes.length === 0) {
        container.innerHTML = '<p style="color:#9ca3af;padding:20px">No hay órdenes que mostrar.</p>';
        return;
    }

    const puedeEditar = ['admin', 'tecnico'].includes(usuario.rol);

    container.innerHTML = `
        <div style="overflow-x:auto">
        <table class="ordenes-table">
            <thead>
                <tr>
                    <th>N° Orden</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Técnico</th>
                    <th>Tipo</th>
                    <th>Equipo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${ordenes.map(o => `
                <tr>
                    <td><strong>${o.numero_orden}</strong></td>
                    <td>${o.fecha ? new Date(o.fecha).toLocaleDateString('es') : '—'}</td>
                    <td>${o.cliente_nombre || '—'}</td>
                    <td>${o.tecnico_nombre || '—'}</td>
                    <td>${o.tipo_servicio === 'mantenimiento' ? 'Mant.' : 'Rep.'}</td>
                    <td>${o.marca || ''} ${o.modelo || ''}</td>
                    <td><span class="estado-badge estado-${o.estado}">${o.estado.replace('_', ' ')}</span></td>
                    <td>
                        <div style="display:flex;gap:4px;flex-wrap:wrap">
                            ${usuario.rol === 'tecnico' ? `<button class="btn-icon" style="background:#ede9fe;color:#7c3aed" onclick="verDetalleOrden('${o.id}')" title="Ver detalle">Ver</button>` : ''}
                            ${usuario.rol === 'cliente' ? `<button class="btn-icon" style="background:#ede9fe;color:#7c3aed" onclick="verDetalleCliente('${o.id}')" title="Ver detalle">Ver</button>` : ''}
                            ${puedeEditar ? `<button class="btn-icon btn-edit" onclick="editarOrden('${o.id}')" title="Editar">${o.estado === 'cerrada' ? 'Editar' : 'Completar'}</button>` : ''}
                            ${puedeEditar ? `
                            <select class="btn-estado-sel" onchange="cambiarEstado('${o.id}', this.value)" title="Cambiar estado">
                                <option value="">Estado</option>
                                <option value="pendiente" ${o.estado==='pendiente'?'selected':''}>Pendiente</option>
                                <option value="asignada" ${o.estado==='asignada'?'selected':''}>Asignada</option>
                                <option value="cerrada" ${o.estado==='cerrada'?'selected':''}>Cerrada</option>
                            </select>` : ''}
                            ${o.estado === 'cerrada' ? `<button class="btn-icon btn-pdf" onclick="descargarPDF('${o.id}', '${o.numero_orden}')" title="PDF">PDF</button>` : ''}
                            ${o.estado === 'cerrada' ? `<button class="btn-icon btn-excel" onclick="descargarExcel('${o.id}', '${o.numero_orden}')" title="Excel">Excel</button>` : ''}
                        </div>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>
        </div>`;
}

async function cambiarEstado(ordenId, estado) {
    if (!estado) return;
    try {
        const res = await apiFetch(`/ordenes/${ordenId}/estado`, 'PATCH', { estado });
        if (!res.ok) throw new Error();
        toast('Estado actualizado', 'success');
        cargarOrdenes();
    } catch {
        toast('Error al cambiar estado', 'error');
    }
}

async function editarOrden(id) {
    try {
        const res = await apiFetch(`/ordenes/${id}`);
        const orden = await res.json();
        await prepararFormulario(orden);
        cambiarVista('formulario');
    } catch {
        toast('Error al cargar la orden', 'error');
    }
}

async function exportarReporteGeneral() {
    window.open(`${API}/reportes/general/excel?token=${token}`, '_blank');
}

// ============================================================
// FORMULARIO ORDEN
// ============================================================
async function prepararFormulario(orden = null) {
    document.getElementById('formularioTitulo').textContent = orden ? 'Editar Orden' : 'Nueva Orden de Trabajo';
    document.getElementById('ordenId').value = orden?.id || '';

    // Admin: solo ve datos básicos siempre
    // Técnico: ve todo (datos del admin + sus campos)
    const esTecnico = usuario.rol === 'tecnico';
    document.querySelectorAll('.seccion-tecnico').forEach(el => {
        el.style.display = esTecnico ? '' : 'none';
    });

    // Cargar selects primero, luego asignar valores
    await Promise.all([cargarSelectClientes(), cargarSelectTecnicos(), cargarSelectEquipos()]);

    if (orden) {
        // Asignar número de orden ANTES del setTimeout (no depende de selects)
        document.getElementById('f_numero_orden').value = orden.numero_orden || '';
        document.getElementById('f_numero_orden').disabled = true;

        // Usar setTimeout para asegurar que el DOM se actualice antes de asignar valores de selects
        setTimeout(() => {
            document.getElementById('f_fecha').value = orden.fecha ? orden.fecha.split('T')[0] : '';
            document.getElementById('f_cliente').value = orden.cliente_id || '';
            document.getElementById('f_tecnico').value = orden.tecnico_id || '';
            document.getElementById('f_equipo').value  = orden.equipo_id  || '';
            document.getElementById('f_tipo_servicio').value = orden.tipo_servicio || '';
            document.getElementById('f_categoria').value = orden.categoria_incidencia || '';
            document.getElementById('f_contacto').value = orden.contacto || '';
            document.getElementById('f_facturar_a').value = orden.facturar_a || '';
            document.getElementById('f_hora_entrada').value = orden.hora_entrada || '';
            document.getElementById('f_hora_salida').value = orden.hora_salida || '';
            document.getElementById('f_horas_fact').value = orden.horas_fact || '';
            document.getElementById('f_tipo_visita').value = orden.tipo_visita || '';
            if(document.getElementById('f_inspeccion')) document.getElementById('f_inspeccion').checked = orden.inspeccion_visual || false;
            if(document.getElementById('f_revision')) document.getElementById('f_revision').checked = orden.revision_tierra || false;
            if(document.getElementById('f_prueba')) document.getElementById('f_prueba').checked = orden.prueba_electrovalvulas || false;
            if(document.getElementById('f_estado_inicial')) document.getElementById('f_estado_inicial').value = orden.estado_inicial || '';
            if(document.getElementById('f_eq_presion_obj')) document.getElementById('f_eq_presion_obj').value = orden.eq_presion_obj || orden.presion_objetivo || '';
            if(document.getElementById('f_eq_presion_real')) document.getElementById('f_eq_presion_real').value = orden.eq_presion_real || orden.presion_real || '';
            if(document.getElementById('f_eq_voltaje')) document.getElementById('f_eq_voltaje').value = orden.eq_voltaje || orden.voltaje_mod || '';
            if(document.getElementById('f_eq_viscosidad')) document.getElementById('f_eq_viscosidad').value = orden.eq_viscosidad || orden.viscosidad || '';
            if(document.getElementById('f_eq_rev_bomba')) document.getElementById('f_eq_rev_bomba').value = orden.eq_rev_bomba || orden.rev_bomba || '';
            if(document.getElementById('f_eq_ubicacion')) document.getElementById('f_eq_ubicacion').value = orden.eq_ubicacion || orden.ubicacion || '';
            if(document.getElementById('f_descripcion_falla')) document.getElementById('f_descripcion_falla').value = orden.descripcion_falla || '';
            if(document.getElementById('f_trabajo_realizado')) document.getElementById('f_trabajo_realizado').value = orden.trabajo_realizado || '';
            if(document.getElementById('f_observaciones')) document.getElementById('f_observaciones').value = orden.observaciones || '';
            if(document.getElementById('f_recomendaciones')) document.getElementById('f_recomendaciones').value = orden.recomendaciones || '';
        }, 100);

        // Repuestos
        const container = document.getElementById('repuestosContainer');
        container.innerHTML = '';
        if (orden.repuestos && orden.repuestos.length > 0) {
            orden.repuestos.forEach((r, i) => addRepuesto(r));
        } else {
            addRepuesto();
        }

        // Cargar firmas si existen
        if (orden.firma) {
            if (orden.firma.firma_tecnico) cargarFirmaEnCanvas(orden.firma.firma_tecnico, 'canvasTecnico');
            if (orden.firma.firma_cliente) cargarFirmaEnCanvas(orden.firma.firma_cliente, 'canvasCliente');
            if (orden.firma.nombre_cliente_firma) {
                const el = document.getElementById('f_nombre_cliente_firma');
                if (el) el.value = orden.firma.nombre_cliente_firma;
            }
            if (orden.firma.fecha_hora_firma) {
                const el = document.getElementById('f_fecha_hora_firma');
                if (el) el.value = orden.firma.fecha_hora_firma?.slice(0, 16) || '';
            }
        }
    } else {
        document.getElementById('ordenForm').reset();
        document.getElementById('f_numero_orden').disabled = false;
        document.getElementById('f_fecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('repuestosContainer').innerHTML = '';
        addRepuesto();
        limpiarFirma('canvasTecnico');
        limpiarFirma('canvasCliente');
    }
}

async function cargarSelectClientes() {
    const res = await apiFetch('/usuarios?rol=cliente');
    const data = await res.json();
    const sel = document.getElementById('f_cliente');
    sel.innerHTML = '<option value="">Seleccionar cliente...</option>' +
        data.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
}

async function cargarSelectTecnicos() {
    const res = await apiFetch('/usuarios?rol=tecnico');
    const data = await res.json();
    const sel = document.getElementById('f_tecnico');
    sel.innerHTML = '<option value="">Seleccionar técnico...</option>' +
        data.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
}

async function cargarSelectEquipos() {
    const res = await apiFetch('/equipos');
    const data = await res.json();
    const sel = document.getElementById('f_equipo');
    sel.innerHTML = '<option value="">Seleccionar equipo...</option>' +
        data.map(e => `<option value="${e.id}" data-presion-obj="${e.presion_objetivo||''}" data-presion-real="${e.presion_real||''}" data-voltaje="${e.voltaje_mod||''}" data-viscosidad="${e.viscosidad||''}" data-rev-bomba="${e.rev_bomba||''}" data-ubicacion="${e.ubicacion||''}">${e.marca} ${e.modelo} — ${e.serie || 'S/N'}</option>`).join('');

    // Al cambiar equipo, mostrar info técnica en el formulario
    sel.addEventListener('change', () => {
        const opt = sel.options[sel.selectedIndex];
        const infoEl = document.getElementById('equipoInfoPreview');
        if (!opt.value) { if (infoEl) infoEl.style.display = 'none'; return; }

        // Pre-llenar campos editables de datos del equipo
        document.getElementById('f_eq_presion_obj').value  = opt.dataset.presionObj  || '';
        document.getElementById('f_eq_presion_real').value = opt.dataset.presionReal || '';
        document.getElementById('f_eq_voltaje').value      = opt.dataset.voltaje      || '';
        document.getElementById('f_eq_viscosidad').value   = opt.dataset.viscosidad   || '';
        document.getElementById('f_eq_rev_bomba').value    = opt.dataset.revBomba     || '';
        document.getElementById('f_eq_ubicacion').value    = opt.dataset.ubicacion    || '';

        if (infoEl) infoEl.style.display = 'none';
    });
}

async function handleGuardarOrden(e) {
    e.preventDefault();
    const id = document.getElementById('ordenId').value;
    console.log('Guardando orden, id:', id, 'método:', id ? 'PUT' : 'POST');

    const repuestos = Array.from(document.querySelectorAll('.repuesto-row')).map(row => ({
        no_parte: row.querySelector('.rep-parte').value,
        descripcion: row.querySelector('.rep-desc').value,
        cantidad: parseInt(row.querySelector('.rep-cant').value) || 1,
        costo: parseFloat(row.querySelector('.rep-costo').value) || null,
        observaciones: row.querySelector('.rep-obs').value
    })).filter(r => r.descripcion);

    const payload = {
        numero_orden: document.getElementById('f_numero_orden').value || document.getElementById('f_numero_orden').defaultValue,
        fecha: document.getElementById('f_fecha').value,
        cliente_id: document.getElementById('f_cliente').value,
        tecnico_id: document.getElementById('f_tecnico').value,
        equipo_id: document.getElementById('f_equipo').value,
        tipo_servicio: document.getElementById('f_tipo_servicio').value,
        categoria_incidencia: document.getElementById('f_categoria').value,
        contacto: document.getElementById('f_contacto').value,
        facturar_a: document.getElementById('f_facturar_a').value,
        hora_entrada: document.getElementById('f_hora_entrada').value,
        hora_salida: document.getElementById('f_hora_salida').value,
        horas_fact: document.getElementById('f_horas_fact').value,
        tipo_visita: document.getElementById('f_tipo_visita').value,
        inspeccion_visual: document.getElementById('f_inspeccion')?.checked || false,
        revision_tierra: document.getElementById('f_revision')?.checked || false,
        prueba_electrovalvulas: document.getElementById('f_prueba')?.checked || false,
        estado_inicial: document.getElementById('f_estado_inicial')?.value || null,
        // Datos técnicos del equipo medidos en sitio
        eq_presion_obj:  document.getElementById('f_eq_presion_obj')?.value  || null,
        eq_presion_real: document.getElementById('f_eq_presion_real')?.value || null,
        eq_voltaje:      document.getElementById('f_eq_voltaje')?.value      || null,
        eq_viscosidad:   document.getElementById('f_eq_viscosidad')?.value   || null,
        eq_rev_bomba:    document.getElementById('f_eq_rev_bomba')?.value    || null,
        eq_ubicacion:    document.getElementById('f_eq_ubicacion')?.value    || null,
        descripcion_falla: document.getElementById('f_descripcion_falla')?.value || null,
        trabajo_realizado: document.getElementById('f_trabajo_realizado')?.value || null,
        observaciones: document.getElementById('f_observaciones')?.value || null,
        recomendaciones: document.getElementById('f_recomendaciones')?.value || null,
        repuestos,
        firma_tecnico: getFirmaData('canvasTecnico'),
        firma_cliente: getFirmaData('canvasCliente'),
        nombre_cliente_firma: document.getElementById('f_nombre_cliente_firma')?.value || null,
        fecha_hora_firma: document.getElementById('f_fecha_hora_firma')?.value || null
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/ordenes/${id}` : '/ordenes';
        const res = await apiFetch(url, method, payload);
        if (!res.ok) { const err = await res.json(); throw new Error(err.detalle || err.error); }
        toast(id ? 'Orden actualizada' : 'Orden creada exitosamente', 'success');
        cambiarVista('ordenes');
    } catch (err) {
        toast(err.message || 'Error al guardar orden', 'error');
        console.error('Error guardar orden:', err);
    }
}

// ============================================================
// REPUESTOS
// ============================================================
function addRepuesto(data = {}) {
    const container = document.getElementById('repuestosContainer');
    const div = document.createElement('div');
    div.className = 'repuesto-row';
    div.innerHTML = `
        <input type="text" class="rep-parte" placeholder="N° Parte" value="${data.no_parte || ''}">
        <input type="text" class="rep-desc" placeholder="Descripción *" value="${data.descripcion || ''}">
        <input type="number" class="rep-cant" placeholder="Cant." min="1" value="${data.cantidad || 1}">
        <input type="number" class="rep-costo" placeholder="Costo" step="0.01" min="0" value="${data.costo || ''}">
        <input type="text" class="rep-obs" placeholder="Observaciones" value="${data.observaciones || ''}">
        <button type="button" class="btn-remove-rep" onclick="removeRepuesto(this)">✕</button>
    `;
    container.appendChild(div);
}

function removeRepuesto(btn) {
    const rows = document.querySelectorAll('.repuesto-row');
    if (rows.length > 1) btn.closest('.repuesto-row').remove();
}

// ============================================================
// FIRMAS DIGITALES
// ============================================================
const firmasState = {};

function initFirma(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    firmasState[canvasId] = { drawing: false, hasData: false };

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const src = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    };

    const start = (e) => { e.preventDefault(); firmasState[canvasId].drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const draw = (e) => { e.preventDefault(); if (!firmasState[canvasId].drawing) return; const p = getPos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1f2937'; ctx.lineTo(p.x, p.y); ctx.stroke(); firmasState[canvasId].hasData = true; };
    const stop = () => { firmasState[canvasId].drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stop);
}

function limpiarFirma(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (firmasState[canvasId]) {
        firmasState[canvasId].hasData = false;
        firmasState[canvasId].limpiada = true;
    }
}

function getFirmaData(canvasId) {
    // Si fue limpiada explícitamente, retornar string vacío para borrar en BD
    if (firmasState[canvasId]?.limpiada && !firmasState[canvasId]?.hasData) return '';
    // Si tiene datos nuevos, retornar el base64
    if (firmasState[canvasId]?.hasData) return document.getElementById(canvasId).toDataURL('image/png');
    // Si no se tocó, retornar null (no cambiar en BD)
    return null;
}

function cargarFirmaEnCanvas(dataUrl, canvasId) {
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        if (firmasState[canvasId]) {
            firmasState[canvasId].hasData = true;
            firmasState[canvasId].limpiada = false;
        }
    };
    img.src = dataUrl;
}

function cargarImagenFirma(input, canvasId) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Escalar la imagen para que quepa en el canvas
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            if (firmasState[canvasId]) firmasState[canvasId].hasData = true;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// ============================================================
// REPORTES
// ============================================================
async function descargarPDF(ordenId, numero) {
    try {
        const res = await apiFetch(`/reportes/${ordenId}/pdf`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        descargarBlob(blob, `orden_${numero}.pdf`);
    } catch { toast('Error al generar PDF', 'error'); }
}

async function descargarExcel(ordenId, numero) {
    try {
        const res = await apiFetch(`/reportes/${ordenId}/excel`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        descargarBlob(blob, `orden_${numero}.xlsx`);
    } catch { toast('Error al generar Excel', 'error'); }
}

function descargarBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// EQUIPOS
// ============================================================
let equiposCache = [];

async function cargarEquipos() {
    try {
        const res = await apiFetch('/equipos');
        equiposCache = await res.json();
        renderEquipos(equiposCache);

        // Activar filtros
        document.getElementById('buscarEquipo')?.addEventListener('input', filtrarEquipos);
        document.getElementById('filtroTipoEquipo')?.addEventListener('change', filtrarEquipos);
    } catch { toast('Error al cargar equipos', 'error'); }
}

function filtrarEquipos() {
    const texto = document.getElementById('buscarEquipo').value.toLowerCase();
    const tipo  = document.getElementById('filtroTipoEquipo').value;
    const filtrados = equiposCache.filter(e => {
        const matchTexto = !texto ||
            e.marca?.toLowerCase().includes(texto) ||
            e.modelo?.toLowerCase().includes(texto) ||
            e.serie?.toLowerCase().includes(texto) ||
            e.cliente_nombre?.toLowerCase().includes(texto);
        const matchTipo = !tipo || e.tipo === tipo;
        return matchTexto && matchTipo;
    });
    renderEquipos(filtrados);
}

function renderEquipos(equipos) {
    const container = document.getElementById('equiposContainer');
    if (equipos.length === 0) { container.innerHTML = '<p style="color:#9ca3af;padding:20px">No hay equipos registrados.</p>'; return; }
    
    const porPagina = 8;
    let paginaActual = 1;
    const totalPaginas = () => Math.ceil(equipos.length / porPagina);

    function render() {
        const inicio = (paginaActual - 1) * porPagina;
        const fin = inicio + porPagina;
        const equiposPagina = equipos.slice(inicio, fin);

        container.innerHTML = `
            <div style="overflow-x:auto">
            <table class="ordenes-table">
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>Marca / Modelo</th>
                        <th>Tipo</th>
                        <th>Serie</th>
                        <th>Ubicación</th>
                        <th>Cliente</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${equiposPagina.map((e, i) => `
                    <tr>
                        <td>${inicio + i + 1}</td>
                        <td><strong>${e.marca} ${e.modelo}</strong></td>
                        <td>${e.tipo}</td>
                        <td>${e.serie || '—'}</td>
                        <td>${e.ubicacion || '—'}</td>
                        <td>${e.cliente_nombre || 'Sin asignar'}</td>
                        <td>
                            <div style="display:flex;gap:4px">
                                <button class="btn-icon btn-edit" onclick="abrirModalEquipo('${e.id}')">Editar</button>
                                <button class="btn-icon" style="background:#ede9fe;color:#7c3aed" onclick="verHistorialEquipo('${e.id}','${e.marca} ${e.modelo}')">Historial</button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
            </div>
            ${`
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-top:12px;padding-right:4px">
                <button class="btn-secondary" onclick="cambiarPaginaEquipos(-1)" ${paginaActual === 1 ? 'disabled' : ''} style="padding:6px 14px;font-size:18px">&#8592;</button>
                <span style="font-weight:600;color:#1f2937">Página ${paginaActual} de ${totalPaginas()}</span>
                <button class="btn-secondary" onclick="cambiarPaginaEquipos(1)" ${paginaActual === totalPaginas() ? 'disabled' : ''} style="padding:6px 14px;font-size:18px">&#8594;</button>
            </div>`}
        `;
    }

    window.cambiarPaginaEquipos = (dir) => {
        paginaActual = Math.min(Math.max(1, paginaActual + dir), totalPaginas());
        render();
    };

    render();
}

function abrirModalEquipo(id = null) {
    document.getElementById('equipoId').value = id || '';
    document.getElementById('modalEquipoTitulo').textContent = id ? 'Editar Equipo' : 'Nuevo Equipo';
    document.getElementById('equipoForm').reset();

    // Cargar clientes en el select
    apiFetch('/usuarios?rol=cliente').then(r => r.json()).then(clientes => {
        document.getElementById('eq_cliente').innerHTML = '<option value="">Sin asignar</option>' +
            clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        if (id) {
            apiFetch(`/equipos/${id}`).then(r => r.json()).then(e => {
                document.getElementById('eq_marca').value = e.marca || '';
                document.getElementById('eq_modelo').value = e.modelo || '';
                document.getElementById('eq_tipo').value = e.tipo || '';
                document.getElementById('eq_serie').value = e.serie || '';
                document.getElementById('eq_ubicacion').value = e.ubicacion || '';
                document.getElementById('eq_cliente').value = e.cliente_id || '';
                document.getElementById('eq_presion_obj').value = e.presion_objetivo || '';
                document.getElementById('eq_presion_real').value = e.presion_real || '';
                document.getElementById('eq_voltaje').value = e.voltaje_mod || '';
                document.getElementById('eq_viscosidad').value = e.viscosidad || '';
                document.getElementById('eq_rev_bomba').value = e.rev_bomba || '';
            });
        }
    });

    document.getElementById('modalEquipo').style.display = 'flex';
}

async function handleGuardarEquipo(e) {
    e.preventDefault();
    const id = document.getElementById('equipoId').value;
    const payload = {
        marca: document.getElementById('eq_marca').value,
        modelo: document.getElementById('eq_modelo').value,
        tipo: document.getElementById('eq_tipo').value,
        serie: document.getElementById('eq_serie').value,
        ubicacion: document.getElementById('eq_ubicacion').value,
        cliente_id: document.getElementById('eq_cliente').value || null,
        presion_objetivo: document.getElementById('eq_presion_obj').value,
        presion_real: document.getElementById('eq_presion_real').value,
        voltaje_mod: document.getElementById('eq_voltaje').value,
        viscosidad: document.getElementById('eq_viscosidad').value,
        rev_bomba: document.getElementById('eq_rev_bomba').value
    };
    try {
        const res = await apiFetch(id ? `/equipos/${id}` : '/equipos', id ? 'PUT' : 'POST', payload);
        if (!res.ok) throw new Error();
        toast(id ? 'Equipo actualizado' : 'Equipo creado', 'success');
        cerrarModal('modalEquipo');
        cargarEquipos();
    } catch { toast('Error al guardar equipo', 'error'); }
}

// ============================================================
// USUARIOS
// ============================================================
let usuariosCache = [];

async function cargarUsuarios() {
    try {
        const res = await apiFetch('/usuarios');
        usuariosCache = await res.json();
        renderUsuarios(usuariosCache);

        document.getElementById('buscarUsuario')?.addEventListener('input', filtrarUsuarios);
        document.getElementById('filtroRolUsuario')?.addEventListener('change', filtrarUsuarios);
    } catch { toast('Error al cargar usuarios', 'error'); }
}

function filtrarUsuarios() {
    const texto = document.getElementById('buscarUsuario').value.toLowerCase();
    const rol   = document.getElementById('filtroRolUsuario').value;
    const filtrados = usuariosCache.filter(u => {
        const matchTexto = !texto ||
            u.nombre?.toLowerCase().includes(texto) ||
            u.email?.toLowerCase().includes(texto);
        const matchRol = !rol || u.rol === rol;
        return matchTexto && matchRol;
    });
    renderUsuarios(filtrados);
}

function renderUsuarios(usuarios) {
    const container = document.getElementById('usuariosContainer');
    if (usuarios.length === 0) { container.innerHTML = '<p style="color:#9ca3af;padding:20px">No hay usuarios registrados.</p>'; return; }

    const porPagina = 8;
    let paginaActual = 1;
    const totalPaginas = () => Math.ceil(usuarios.length / porPagina);

    function render() {
        const inicio = (paginaActual - 1) * porPagina;
        const usuariosPagina = usuarios.slice(inicio, inicio + porPagina);

        container.innerHTML = `
            <div style="overflow-x:auto">
            <table class="ordenes-table">
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Teléfono</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${usuariosPagina.map((u, i) => `
                    <tr>
                        <td>${inicio + i + 1}</td>
                        <td><strong>${u.nombre}</strong></td>
                        <td>${u.email}</td>
                        <td><span class="estado-badge" style="background:var(--primary-light);color:var(--primary)">${u.rol}</span></td>
                        <td>${u.telefono || '—'}</td>
                        <td><span class="estado-badge ${u.activo ? 'estado-cerrada' : 'estado-pendiente'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                        <td>
                            <div style="display:flex;gap:4px">
                                <button class="btn-icon btn-edit" onclick="abrirModalUsuario('${u.id}')">Editar</button>
                                <button class="btn-icon" style="background:#fee2e2;color:#e02424" onclick="toggleUsuario('${u.id}', ${!u.activo})">${u.activo ? 'Desactivar' : 'Activar'}</button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
            </div>
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-top:12px;padding-right:4px">
                <button class="btn-secondary" onclick="cambiarPaginaUsuarios(-1)" ${paginaActual === 1 ? 'disabled' : ''} style="padding:6px 14px;font-size:18px">&#8592;</button>
                <span style="font-weight:600;color:#1f2937">Página ${paginaActual} de ${totalPaginas()}</span>
                <button class="btn-secondary" onclick="cambiarPaginaUsuarios(1)" ${paginaActual === totalPaginas() ? 'disabled' : ''} style="padding:6px 14px;font-size:18px">&#8594;</button>
            </div>
        `;
    }

    window.cambiarPaginaUsuarios = (dir) => {
        paginaActual = Math.min(Math.max(1, paginaActual + dir), totalPaginas());
        render();
    };

    render();
}

function abrirModalUsuario(id = null) {
    document.getElementById('usuarioId').value = id || '';
    document.getElementById('modalUsuarioTitulo').textContent = id ? 'Editar Usuario' : 'Nuevo Usuario';
    document.getElementById('usuarioForm').reset();
    document.getElementById('us_password').required = !id;
    document.getElementById('us_password_confirm').required = !id;
    document.getElementById('passError').style.display = 'none';
    // Mostrar/ocultar hint según si es edición o creación
    document.getElementById('passLabel').style.display = id ? 'inline' : 'none';
    document.getElementById('modalUsuario').style.display = 'flex';

    // Validar en tiempo real que coincidan
    const pass = document.getElementById('us_password');
    const confirm = document.getElementById('us_password_confirm');
    const error = document.getElementById('passError');
    const check = () => {
        if (confirm.value && pass.value !== confirm.value) {
            error.style.display = 'block';
        } else {
            error.style.display = 'none';
        }
    };
    pass.addEventListener('input', check);
    confirm.addEventListener('input', check);
}

async function handleGuardarUsuario(e) {
    e.preventDefault();
    const id = document.getElementById('usuarioId').value;
    const pass = document.getElementById('us_password').value;
    const passConfirm = document.getElementById('us_password_confirm').value;
    const passError = document.getElementById('passError');

    // Validar que las contraseñas coincidan
    if (pass || passConfirm) {
        if (pass !== passConfirm) {
            passError.style.display = 'block';
            return;
        }
        if (pass.length < 6) {
            toast('La contraseña debe tener mínimo 6 caracteres', 'error');
            return;
        }
    }
    passError.style.display = 'none';

    const payload = {
        nombre: document.getElementById('us_nombre').value,
        email: document.getElementById('us_email').value,
        rol: document.getElementById('us_rol').value,
        telefono: document.getElementById('us_telefono').value
    };
    if (pass) payload.password = pass;

    try {
        const res = await apiFetch(id ? `/usuarios/${id}` : '/usuarios', id ? 'PUT' : 'POST', payload);
        if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
        toast(id ? 'Usuario actualizado' : 'Usuario creado', 'success');
        cerrarModal('modalUsuario');
        cargarUsuarios();
    } catch (err) { toast(err.message || 'Error al guardar usuario', 'error'); }
}

async function toggleUsuario(id, activo) {
    try {
        await apiFetch(`/usuarios/${id}/estado`, 'PATCH', { activo });
        toast('Estado actualizado', 'success');
        cargarUsuarios();
    } catch { toast('Error al actualizar estado', 'error'); }
}

// ============================================================
// FACTURACIÓN
// ============================================================
// FACTURACIÓN
// ============================================================
let facturacionCache = [];

async function cargarFacturacion() {
    try {
        const res = await apiFetch('/ordenes');
        facturacionCache = await res.json();
        renderFacturacion(facturacionCache);

        // Activar filtros
        document.getElementById('buscarFacturacion')?.addEventListener('input', filtrarFacturacion);
        document.getElementById('filtroEstadoFacturacion')?.addEventListener('change', filtrarFacturacion);
    } catch { toast('Error al cargar facturación', 'error'); }
}

function filtrarFacturacion() {
    const texto = document.getElementById('buscarFacturacion').value.toLowerCase();
    const estado = document.getElementById('filtroEstadoFacturacion').value;
    const filtradas = facturacionCache.filter(o => {
        const matchTexto = !texto ||
            o.numero_orden?.toLowerCase().includes(texto) ||
            o.cliente_nombre?.toLowerCase().includes(texto) ||
            o.tecnico_nombre?.toLowerCase().includes(texto);
        const matchEstado = !estado || o.estado === estado;
        return matchTexto && matchEstado;
    });
    renderFacturacion(filtradas);
}

function renderFacturacion(ordenes) {
    const container = document.getElementById('facturacionContainer');
    
    // Filtrar solo órdenes cerradas para mostrar
    const ordenesCerradas = ordenes.filter(o => o.estado === 'cerrada');

    if (ordenesCerradas.length === 0) { 
        container.innerHTML = '<p style="color:#9ca3af;padding:20px">No hay órdenes que mostrar.</p>'; 
        return; 
    }

    // Resumen rápido
    const totalHoras = ordenesCerradas.reduce((s, o) => s + (parseFloat(o.horas_fact) || 0), 0);

    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom:16px">
            <div class="stat-card green">
                <div class="stat-label">Órdenes Cerradas</div>
                <div class="stat-value">${ordenesCerradas.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Horas Facturables</div>
                <div class="stat-value">${totalHoras.toFixed(1)}</div>
            </div>
        </div>
        <div style="overflow-x:auto">
        <table class="ordenes-table">
            <thead><tr>
                <th>N° Orden</th><th>Fecha</th><th>Cliente</th><th>Técnico</th>
                <th>Tipo Servicio</th><th>Equipo</th><th>Horas</th><th>Acciones</th>
            </tr></thead>
            <tbody>
            ${ordenesCerradas.map(o => `
                <tr>
                    <td><strong>${o.numero_orden}</strong></td>
                    <td>${o.fecha ? new Date(o.fecha).toLocaleDateString('es') : '—'}</td>
                    <td>${o.cliente_nombre || '—'}</td>
                    <td>${o.tecnico_nombre || '—'}</td>
                    <td>${o.tipo_servicio === 'mantenimiento' ? 'Mantenimiento' : 'Reparación'}</td>
                    <td>${o.marca || ''} ${o.modelo || ''}</td>
                    <td><strong>${o.horas_fact || '—'}</strong></td>
                    <td>
                        <div style="display:flex;gap:4px;flex-wrap:wrap">
                            <button class="btn-icon" style="background:#ede9fe;color:#7c3aed" onclick="verDetalleFacturacion('${o.id}')">Validar</button>
                            <button class="btn-icon btn-pdf" onclick="descargarPDF('${o.id}','${o.numero_orden}')">PDF</button>
                            <button class="btn-icon btn-excel" onclick="descargarExcel('${o.id}','${o.numero_orden}')">Excel</button>
                        </div>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
}

// ============================================================
// MODALES
// ============================================================
function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

// ============================================================
// AJUSTES DE CUENTA
// ============================================================
function abrirPanelAjustes() {
    document.getElementById('aj_nombre').value           = usuario.nombre   || '';
    document.getElementById('aj_email').value            = usuario.email    || '';
    document.getElementById('aj_telefono').value         = usuario.telefono || '';
    document.getElementById('aj_password').value         = '';
    document.getElementById('aj_password_confirm').value = '';
    document.getElementById('ajPassError').style.display = 'none';
    document.getElementById('aj_nombre_display').textContent = usuario.nombre;
    document.getElementById('aj_rol_display').textContent    = usuario.rol;
    document.getElementById('aj_avatar').textContent         = usuario.nombre.charAt(0).toUpperCase();

    // Validar contraseñas en tiempo real
    const pass    = document.getElementById('aj_password');
    const confirm = document.getElementById('aj_password_confirm');
    const error   = document.getElementById('ajPassError');
    pass.oninput    = () => { error.style.display = (confirm.value && pass.value !== confirm.value) ? 'block' : 'none'; };
    confirm.oninput = () => { error.style.display = (confirm.value && pass.value !== confirm.value) ? 'block' : 'none'; };

    // Formulario datos personales
    document.getElementById('ajustesForm').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            nombre:   document.getElementById('aj_nombre').value,
            email:    document.getElementById('aj_email').value,
            telefono: document.getElementById('aj_telefono').value,
            rol:      usuario.rol
        };
        try {
            const res = await apiFetch(`/usuarios/${usuario.id}`, 'PUT', payload);
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            usuario.nombre = payload.nombre;
            usuario.email  = payload.email;
            localStorage.setItem('usuario', JSON.stringify(usuario));
            document.getElementById('sidebarUserName').textContent = usuario.nombre;
            document.getElementById('aj_nombre_display').textContent = usuario.nombre;
            toast('Datos actualizados correctamente', 'success');
        } catch (err) { toast(err.message || 'Error al guardar', 'error'); }
    };

    // Formulario contraseña
    document.getElementById('passwordForm').onsubmit = async (e) => {
        e.preventDefault();
        const p = pass.value;
        const c = confirm.value;
        if (p !== c) { error.style.display = 'block'; return; }
        if (p.length < 6) { toast('Mínimo 6 caracteres', 'error'); return; }
        try {
            const res = await apiFetch(`/usuarios/${usuario.id}`, 'PUT', { rol: usuario.rol, password: p });
            if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
            pass.value = ''; confirm.value = '';
            toast('Contraseña actualizada correctamente', 'success');
        } catch (err) { toast(err.message || 'Error al cambiar contraseña', 'error'); }
    };

    document.getElementById('modalAjustes').style.display = 'flex';
}

// ============================================================
// UTILIDADES
// ============================================================
async function apiFetch(path, method = 'GET', body = null) {
    const opts = {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}${path}`, opts);
    if (res.status === 401) { handleLogout(); throw new Error('Sesión expirada'); }
    return res;
}

function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ============================================================
// DASHBOARD DEL TÉCNICO
// ============================================================
async function cargarMisDatos() {
    try {
        const res = await apiFetch('/ordenes');
        const ordenes = await res.json();

        const pendientes  = ordenes.filter(o => o.estado === 'pendiente').length;
        const asignadas   = ordenes.filter(o => o.estado === 'asignada').length;
        const cerradas    = ordenes.filter(o => o.estado === 'cerrada').length;
        const total       = ordenes.length;

        document.getElementById('statsTecnico').innerHTML = `
            <div class="stat-card orange">
                <div class="stat-label">Pendientes</div>
                <div class="stat-value">${pendientes}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Asignadas</div>
                <div class="stat-value">${asignadas}</div>
            </div>
            <div class="stat-card green">
                <div class="stat-label">Cerradas</div>
                <div class="stat-value">${cerradas}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total</div>
                <div class="stat-value">${total}</div>
            </div>
        `;

        // Gráfica por estado
        renderBarChart('chartTecnicoEstados', [
            { estado: 'Pendiente', total: pendientes },
            { estado: 'Asignada',  total: asignadas },
            { estado: 'Cerrada',   total: cerradas }
        ], 'estado', 'total');

        // Gráfica últimos 7 días
        const hoy = new Date();
        const dias = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });
        const porDia = dias.map(dia => ({
            dia: dia.slice(5),
            total: ordenes.filter(o => o.fecha && o.fecha.startsWith(dia)).length
        }));
        renderBarChart('chartTecnicoDias', porDia, 'dia', 'total');

    } catch (err) {
        console.error(err);
    }
}

// ============================================================
// DETALLE DE ORDEN (TÉCNICO)
// ============================================================
async function verDetalleOrden(id) {
    try {
        const res = await apiFetch(`/ordenes/${id}`);
        const o = await res.json();

        document.getElementById('detalleOrdenContainer').innerHTML = `
            <div class="detalle-grid">

                <div class="form-card">
                    <div class="form-card-title">Información del Cliente</div>
                    <p><strong>Nombre:</strong> ${o.cliente_nombre || '—'}</p>
                    <p><strong>Teléfono:</strong> ${o.cliente_telefono || '—'}</p>
                    <p><strong>Contacto:</strong> ${o.contacto || '—'}</p>
                    <p><strong>Facturar a:</strong> ${o.facturar_a || '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">Información del Equipo</div>
                    <p><strong>Marca / Modelo:</strong> ${o.marca || '—'} ${o.modelo || ''}</p>
                    <p><strong>Serie:</strong> ${o.serie || '—'}</p>
                    <p><strong>Ubicación:</strong> ${o.ubicacion || '—'}</p>
                    <p><strong>Presión Objetivo:</strong> ${o.presion_objetivo || '—'}</p>
                    <p><strong>Presión Real:</strong> ${o.presion_real || '—'}</p>
                    <p><strong>Voltaje Mod.:</strong> ${o.voltaje_mod || '—'}</p>
                    <p><strong>Viscosidad:</strong> ${o.viscosidad || '—'}</p>
                    <p><strong>Rev. Bomba:</strong> ${o.rev_bomba || '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">Datos de la Orden</div>
                    <p><strong>N° Orden:</strong> ${o.numero_orden}</p>
                    <p><strong>Fecha:</strong> ${o.fecha ? new Date(o.fecha).toLocaleDateString('es') : '—'}</p>
                    <p><strong>Tipo:</strong> ${o.tipo_servicio}</p>
                    <p><strong>Categoría:</strong> ${o.categoria_incidencia || '—'}</p>
                    <p><strong>Estado:</strong> <span class="estado-badge estado-${o.estado}">${o.estado.replace('_',' ')}</span></p>
                    <p><strong>Hora Entrada:</strong> ${o.hora_entrada || '—'}</p>
                    <p><strong>Hora Salida:</strong> ${o.hora_salida || '—'}</p>
                    <p><strong>Horas Fact.:</strong> ${o.horas_fact || '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">🔍 Estado Inicial del Equipo</div>
                    <p>${o.inspeccion_visual ? '☑' : '☐'} Inspección Visual</p>
                    <p>${o.revision_tierra ? '☑' : '☐'} Revisión con Tierra</p>
                    <p>${o.prueba_electrovalvulas ? '☑' : '☐'} Prueba Electroválvulas</p>
                    ${o.estado_inicial ? `<p style="margin-top:8px">${o.estado_inicial}</p>` : ''}
                </div>

                <div class="form-card" style="grid-column: 1 / -1">
                    <div class="form-card-title">Trabajo Realizado</div>
                    ${o.descripcion_falla ? `<p><strong>Falla:</strong> ${o.descripcion_falla}</p>` : ''}
                    <p style="margin-top:8px"><strong>Trabajo:</strong> ${o.trabajo_realizado || '—'}</p>
                    ${o.observaciones ? `<p style="margin-top:8px"><strong>Observaciones:</strong> ${o.observaciones}</p>` : ''}
                    ${o.recomendaciones ? `<p style="margin-top:8px"><strong>Recomendaciones:</strong> ${o.recomendaciones}</p>` : ''}
                </div>

                ${o.repuestos && o.repuestos.length > 0 ? `
                <div class="form-card" style="grid-column: 1 / -1">
                    <div class="form-card-title">📦 Repuestos Utilizados</div>
                    <div style="overflow-x:auto">
                    <table class="ordenes-table">
                        <thead><tr><th>N° Parte</th><th>Descripción</th><th>Cant.</th><th>Observaciones</th></tr></thead>
                        <tbody>
                        ${o.repuestos.map(r => `
                            <tr>
                                <td>${r.no_parte || '—'}</td>
                                <td>${r.descripcion}</td>
                                <td>${r.cantidad}</td>
                                <td>${r.observaciones || '—'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    </div>
                </div>` : ''}

            </div>

            <div class="form-footer" style="margin-top:16px">
                <button class="btn-secondary" onclick="cambiarVista('ordenes')">Volver</button>
                <button class="btn-primary" onclick="editarOrden('${o.id}')">Llenar / Editar Formulario</button>
                <button class="btn-icon btn-pdf" onclick="descargarPDF('${o.id}','${o.numero_orden}')">PDF</button>
                <button class="btn-icon btn-excel" onclick="descargarExcel('${o.id}','${o.numero_orden}')">Excel</button>
            </div>
        `;

        cambiarVista('detalleOrden');
    } catch (err) {
        toast('Error al cargar detalle', 'error');
    }
}

// ============================================================
// HISTORIAL DE EQUIPO (ADMIN)
// ============================================================
async function verHistorialEquipo(equipoId, nombre) {
    try {
        document.getElementById('historialEquipoTitulo').textContent = `Historial: ${nombre}`;

        const res = await apiFetch('/ordenes');
        const todas = await res.json();
        const ordenes = todas.filter(o => o.equipo_id === equipoId);

        const container = document.getElementById('historialEquipoContainer');

        if (ordenes.length === 0) {
            container.innerHTML = `
                <div class="form-card">
                    <p style="color:var(--gray-400)">Este equipo no tiene órdenes de trabajo registradas.</p>
                </div>`;
        } else {
            // Resumen
            const cerradas   = ordenes.filter(o => o.estado === 'cerrada').length;
            const mant        = ordenes.filter(o => o.tipo_servicio === 'mantenimiento').length;
            const rep         = ordenes.filter(o => o.tipo_servicio === 'reparacion').length;

            container.innerHTML = `
                <div class="stats-grid" style="margin-bottom:20px">
                    <div class="stat-card"><div class="stat-label">Total Atenciones</div><div class="stat-value">${ordenes.length}</div></div>
                    <div class="stat-card green"><div class="stat-label">Cerradas</div><div class="stat-value">${cerradas}</div></div>
                    <div class="stat-card"><div class="stat-label">Mantenimientos</div><div class="stat-value">${mant}</div></div>
                    <div class="stat-card orange"><div class="stat-label">Reparaciones</div><div class="stat-value">${rep}</div></div>
                </div>
                <div style="overflow-x:auto">
                <table class="ordenes-table">
                    <thead><tr>
                        <th>N° Orden</th><th>Fecha</th><th>Tipo</th><th>Categoría</th>
                        <th>Técnico</th><th>Estado</th><th>Acciones</th>
                    </tr></thead>
                    <tbody>
                    ${ordenes.map(o => `
                        <tr>
                            <td><strong>${o.numero_orden}</strong></td>
                            <td>${o.fecha ? new Date(o.fecha).toLocaleDateString('es') : '—'}</td>
                            <td>${o.tipo_servicio === 'mantenimiento' ? 'Mant.' : 'Rep.'}</td>
                            <td>${o.categoria_incidencia || '—'}</td>
                            <td>${o.tecnico_nombre || '—'}</td>
                            <td><span class="estado-badge estado-${o.estado}">${o.estado.replace('_',' ')}</span></td>
                            <td>
                                <button class="btn-icon btn-pdf" onclick="descargarPDF('${o.id}','${o.numero_orden}')">PDF</button>
                                <button class="btn-icon btn-excel" onclick="descargarExcel('${o.id}','${o.numero_orden}')">Excel</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
                </div>`;
        }

        cambiarVista('historialEquipo');
    } catch { toast('Error al cargar historial', 'error'); }
}

// ============================================================
// MEJORA DASHBOARD — agregar fallas por categoría
// ============================================================
async function cargarDashboard() {
    try {
        const res = await apiFetch('/dashboard/estadisticas');
        const d = await res.json();

        const pendientes = d.porEstado.find(e => e.estado === 'pendiente')?.total || 0;
        const asignadas  = d.porEstado.find(e => e.estado === 'asignada')?.total || 0;
        const cerradas   = d.porEstado.find(e => e.estado === 'cerrada')?.total || 0;
        const totalOrdenes = Number(pendientes) + Number(asignadas) + Number(cerradas);
        const tasaCierre = totalOrdenes > 0 ? Math.round((cerradas / totalOrdenes) * 100) : 0;

        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Total Equipos</div>
                <div class="stat-value">${d.totalEquipos}</div>
            </div>
            <div class="stat-card orange">
                <div class="stat-label">Órdenes Pendientes</div>
                <div class="stat-value">${pendientes}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Asignadas</div>
                <div class="stat-value">${asignadas}</div>
            </div>
            <div class="stat-card green">
                <div class="stat-label">Cerradas</div>
                <div class="stat-value">${cerradas}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Técnicos Activos</div>
                <div class="stat-value">${d.totalTecnicos}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Clientes</div>
                <div class="stat-value">${d.totalClientes}</div>
            </div>
            <div class="stat-card green">
                <div class="stat-label">Tasa de Cierre</div>
                <div class="stat-value">${tasaCierre}%</div>
                <div class="stat-sub">de órdenes resueltas</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Órdenes</div>
                <div class="stat-value">${totalOrdenes}</div>
            </div>
        `;

        renderBarChart('chartDia',      d.atencionesPorDia,    'dia',    'total');
        renderBarChart('chartCliente',  d.atencionesPorCliente,'nombre', 'total');
        renderBarChart('chartEquipos',  d.equiposConMasIncidencias.map(e => ({ ...e, nombre: `${e.marca} ${e.modelo}` })), 'nombre', 'incidencias');
        renderBarChart('chartEstados',  d.porEstado,           'estado', 'total');

        // Gráfica de fallas por categoría
        if (d.fallasPorCategoria) {
            renderBarChart('chartCategorias', d.fallasPorCategoria, 'categoria_incidencia', 'total');
        }
        // Gráfica de técnicos
        if (d.atencionesPorTecnico) {
            renderBarChart('chartTecnicos', d.atencionesPorTecnico, 'nombre', 'total');
        }
    } catch (err) {
        console.error(err);
    }
}

// ============================================================
// DETALLE DE ORDEN — CLIENTE
// Ve: estado, equipo, fallas detectadas, observaciones,
//     recomendaciones y puede descargar PDF/Excel
// ============================================================
async function verDetalleCliente(id) {
    try {
        const res = await apiFetch(`/ordenes/${id}`);
        const o = await res.json();

        document.getElementById('detalleClienteContainer').innerHTML = `

            <div class="detalle-grid">

                <div class="form-card">
                    <div class="form-card-title">Información de la Orden</div>
                    <p><strong>N° Orden:</strong> ${o.numero_orden}</p>
                    <p><strong>Fecha:</strong> ${o.fecha ? new Date(o.fecha).toLocaleDateString('es') : '—'}</p>
                    <p><strong>Tipo de Servicio:</strong> ${o.tipo_servicio === 'mantenimiento' ? 'Mantenimiento' : 'Reparación'}</p>
                    <p><strong>Estado:</strong> <span class="estado-badge estado-${o.estado}">${o.estado.replace('_',' ')}</span></p>
                    <p><strong>Técnico asignado:</strong> ${o.tecnico_nombre || '—'}</p>
                    <p><strong>Fecha de atención:</strong> ${o.hora_entrada ? `${o.hora_entrada} — ${o.hora_salida || ''}` : '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">Equipo Atendido</div>
                    <p><strong>Equipo:</strong> ${o.marca || '—'} ${o.modelo || ''}</p>
                    <p><strong>Serie:</strong> ${o.serie || '—'}</p>
                    <p><strong>Ubicación:</strong> ${o.ubicacion || '—'}</p>
                    <p><strong>Tipo:</strong> ${o.equipo_tipo || '—'}</p>
                </div>

                <div class="form-card" style="grid-column:1/-1">
                    <div class="form-card-title">🔍 Fallas Detectadas</div>
                    <p>${o.descripcion_falla || 'No se registraron fallas específicas.'}</p>
                </div>

                <div class="form-card" style="grid-column:1/-1">
                    <div class="form-card-title">🛠️ Trabajo Realizado</div>
                    <p>${o.trabajo_realizado || '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">📝 Observaciones</div>
                    <p>${o.observaciones || 'Sin observaciones.'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">💡 Recomendaciones</div>
                    <p>${o.recomendaciones || 'Sin recomendaciones.'}</p>
                </div>

                ${o.repuestos && o.repuestos.length > 0 ? `
                <div class="form-card" style="grid-column:1/-1">
                    <div class="form-card-title">📦 Repuestos / Materiales Utilizados</div>
                    <div style="overflow-x:auto">
                    <table class="ordenes-table">
                        <thead><tr><th>N° Parte</th><th>Descripción</th><th>Cantidad</th></tr></thead>
                        <tbody>
                        ${o.repuestos.map(r => `
                            <tr>
                                <td>${r.no_parte || '—'}</td>
                                <td>${r.descripcion}</td>
                                <td>${r.cantidad}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    </div>
                </div>` : ''}

            </div>

            <div class="form-footer" style="margin-top:16px">
                <button class="btn-secondary" onclick="cambiarVista('ordenes')">Volver</button>
                <button class="btn-icon btn-pdf" style="padding:9px 16px;font-size:14px" onclick="descargarPDF('${o.id}','${o.numero_orden}')">Descargar PDF</button>
                <button class="btn-icon btn-excel" style="padding:9px 16px;font-size:14px" onclick="descargarExcel('${o.id}','${o.numero_orden}')">Descargar Excel</button>
            </div>
        `;

        cambiarVista('detalleCliente');
    } catch { toast('Error al cargar detalle', 'error'); }
}

// ============================================================
// DETALLE DE ORDEN — FACTURACIÓN
// Ve: servicio, repuestos con costos, horas, totales
// Solo consulta — no puede editar
// ============================================================
async function verDetalleFacturacion(id) {
    try {
        const res = await apiFetch(`/ordenes/${id}`);
        const o = await res.json();

        const totalRepuestos = (o.repuestos || []).reduce((s, r) => s + (parseFloat(r.costo) || 0) * r.cantidad, 0);

        document.getElementById('detalleFacturacionContainer').innerHTML = `

            <div class="detalle-grid">

                <div class="form-card">
                    <div class="form-card-title">Datos de la Orden</div>
                    <p><strong>N° Orden:</strong> ${o.numero_orden}</p>
                    <p><strong>Fecha:</strong> ${o.fecha ? new Date(o.fecha).toLocaleDateString('es') : '—'}</p>
                    <p><strong>Estado:</strong> <span class="estado-badge estado-${o.estado}">${o.estado.replace('_',' ')}</span></p>
                    <p><strong>Tipo de Servicio:</strong> ${o.tipo_servicio === 'mantenimiento' ? 'Mantenimiento' : 'Reparación'}</p>
                    <p><strong>Categoría:</strong> ${o.categoria_incidencia || '—'}</p>
                    <p><strong>Tipo de Visita:</strong> ${o.tipo_visita || '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">Cliente / Facturación</div>
                    <p><strong>Cliente:</strong> ${o.cliente_nombre || '—'}</p>
                    <p><strong>Teléfono:</strong> ${o.cliente_telefono || '—'}</p>
                    <p><strong>Contacto:</strong> ${o.contacto || '—'}</p>
                    <p><strong>Facturar a:</strong> ${o.facturar_a || '—'}</p>
                    <p><strong>Técnico:</strong> ${o.tecnico_nombre || '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">Equipo</div>
                    <p><strong>Equipo:</strong> ${o.marca || '—'} ${o.modelo || ''}</p>
                    <p><strong>Serie:</strong> ${o.serie || '—'}</p>
                    <p><strong>Ubicación:</strong> ${o.ubicacion || '—'}</p>
                </div>

                <div class="form-card">
                    <div class="form-card-title">Horas de Servicio</div>
                    <p><strong>Hora Entrada:</strong> ${o.hora_entrada || '—'}</p>
                    <p><strong>Hora Salida:</strong> ${o.hora_salida || '—'}</p>
                    <p><strong>Horas Facturables:</strong> <span style="font-size:20px;font-weight:700;color:var(--primary)">${o.horas_fact || '0'}</span></p>
                </div>

                <div class="form-card" style="grid-column:1/-1">
                    <div class="form-card-title">Trabajo Realizado</div>
                    <p>${o.trabajo_realizado || '—'}</p>
                    ${o.observaciones ? `<p style="margin-top:8px"><strong>Observaciones:</strong> ${o.observaciones}</p>` : ''}
                </div>

                <div class="form-card" style="grid-column:1/-1">
                    <div class="form-card-title">Repuestos / Materiales</div>
                    ${o.repuestos && o.repuestos.length > 0 ? `
                    <div style="overflow-x:auto">
                    <table class="ordenes-table">
                        <thead><tr><th>N° Parte</th><th>Descripción</th><th>Cantidad</th><th>Costo Unit.</th><th>Subtotal</th></tr></thead>
                        <tbody>
                        ${o.repuestos.map(r => {
                            const sub = (parseFloat(r.costo) || 0) * r.cantidad;
                            return `<tr>
                                <td>${r.no_parte || '—'}</td>
                                <td>${r.descripcion}</td>
                                <td>${r.cantidad}</td>
                                <td>${r.costo ? '$' + parseFloat(r.costo).toFixed(2) : '—'}</td>
                                <td>${sub > 0 ? '$' + sub.toFixed(2) : '—'}</td>
                            </tr>`;
                        }).join('')}
                        </tbody>
                        ${totalRepuestos > 0 ? `
                        <tfoot>
                            <tr style="background:var(--gray-100)">
                                <td colspan="4" style="text-align:right;font-weight:700">Total Repuestos:</td>
                                <td style="font-weight:700;color:var(--primary)">$${totalRepuestos.toFixed(2)}</td>
                            </tr>
                        </tfoot>` : ''}
                    </table>
                    </div>` : '<p style="color:var(--gray-400)">Sin repuestos registrados.</p>'}
                </div>

            </div>

            <div class="alert" style="background:#fef3c7;color:#92400e;margin-top:16px">
                Este sistema es solo de consulta. La facturación se realiza externamente con estos datos.
            </div>

            <div class="form-footer" style="margin-top:12px">
                <button class="btn-secondary" onclick="cambiarVista('facturacion')">Volver</button>
                <button class="btn-icon btn-pdf" style="padding:9px 16px;font-size:14px" onclick="descargarPDF('${o.id}','${o.numero_orden}')">Descargar PDF</button>
                <button class="btn-icon btn-excel" style="padding:9px 16px;font-size:14px" onclick="descargarExcel('${o.id}','${o.numero_orden}')">Descargar Excel</button>
            </div>
        `;

        cambiarVista('detalleFacturacion');
    } catch { toast('Error al cargar detalle', 'error'); }
}
