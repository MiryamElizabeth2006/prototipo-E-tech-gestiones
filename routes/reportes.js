const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { verificarToken } = require('../middleware/auth');

async function getOrdenCompleta(ordenId) {
    const orden = await pool.query(`
        SELECT o.*,
               uc.nombre AS cliente_nombre, uc.telefono AS cliente_telefono,
               ut.nombre AS tecnico_nombre,
               e.marca, e.modelo, e.serie, e.ubicacion,
               e.presion_objetivo, e.presion_real, e.voltaje_mod, e.viscosidad, e.rev_bomba
        FROM ordenes_trabajo o
        LEFT JOIN usuarios uc ON o.cliente_id = uc.id
        LEFT JOIN usuarios ut ON o.tecnico_id = ut.id
        LEFT JOIN equipos e ON o.equipo_id = e.id
        WHERE o.id = $1
    `, [ordenId]);

    const repuestos = await pool.query(
        'SELECT * FROM repuestos WHERE orden_trabajo_id=$1 ORDER BY created_at',
        [ordenId]
    );

    const firma = await pool.query(
        'SELECT * FROM firmas WHERE orden_trabajo_id=$1',
        [ordenId]
    );

    return { orden: orden.rows[0], repuestos: repuestos.rows, firma: firma.rows[0] };
}

// PDF de una orden
router.get('/:ordenId/pdf', verificarToken, async (req, res) => {
    try {
        const { orden, repuestos, firma } = await getOrdenCompleta(req.params.ordenId);
        if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

        const doc = new PDFDocument({ margin: 45, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=orden_${orden.numero_orden}.pdf`);
        doc.pipe(res);

        const azul = '#3a8fd1';
        const gris = '#f1f5f9';
        const verde = '#4caf50';

        // Encabezado empresa (izquierda) + N° orden (derecha)
        doc.rect(0, 0, doc.page.width, 80).fill('#1e293b');

        // Datos empresa
        doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
           .text('E-TECH BUSINESS SERVICES S.A.', 45, 12);
        doc.fontSize(8).font('Helvetica').fillColor('#cbd5e1');
        doc.text('RUC: 1793226780001', 45, 28);
        doc.text('Av. Eloy Alfaro N47-24 y Mortiños, Edf. Ma. Fernanda, 1er. Piso', 45, 38);
        doc.text('Telf.: 025163232  /  Cel.: 0999510774', 45, 48);
        doc.text('corporativo@ecuatechservice.com', 45, 58);

        // Título y N° orden
        doc.fillColor(azul).fontSize(11).font('Helvetica-Bold')
           .text('REGISTRO DE VISITA', doc.page.width - 200, 14, { width: 155, align: 'right' });
        doc.fillColor(verde).fontSize(10)
           .text('SERVICIO TÉCNICO', doc.page.width - 200, 28, { width: 155, align: 'right' });
        doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
           .text(`NO.: ${orden.numero_orden}`, doc.page.width - 200, 48, { width: 155, align: 'right' });

        doc.fillColor('#333').fontSize(10).font('Helvetica');
        let y = 95;

        const campo = (label, valor, x, yPos, w = 230) => {
            doc.font('Helvetica-Bold').text(label + ':', x, yPos, { width: w, continued: true });
            doc.font('Helvetica').text(' ' + (valor || '—'));
        };

        // Sección datos generales
        doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
           .text('DATOS GENERALES', 50, y + 3);
        y += 22;
        doc.fillColor('#333').font('Helvetica').fontSize(9);
        campo('Fecha', orden.fecha ? new Date(orden.fecha).toLocaleDateString('es') : '', 45, y);
        campo('Tipo de Servicio', orden.tipo_servicio?.toUpperCase(), 300, y);
        y += 16;
        campo('Cliente', orden.cliente_nombre, 45, y);
        campo('Teléfono', orden.cliente_telefono, 300, y);
        y += 16;
        campo('Contacto', orden.contacto, 45, y);
        campo('Facturar a', orden.facturar_a, 300, y);
        y += 16;
        campo('Técnico', orden.tecnico_nombre, 45, y);
        campo('Tipo de Visita', orden.tipo_visita, 300, y);
        y += 16;
        campo('Hora Entrada', orden.hora_entrada, 45, y);
        campo('Hora Salida', orden.hora_salida, 180, y);
        campo('Horas Fact.', orden.horas_fact, 320, y, 150);
        y += 22;

        // Sección equipo
        doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
           .text('DATOS DEL EQUIPO', 50, y + 3);
        y += 22;
        doc.fillColor('#333').font('Helvetica').fontSize(9);
        campo('Marca', orden.marca, 45, y);
        campo('Modelo', orden.modelo, 300, y);
        y += 16;
        campo('Serie', orden.serie, 45, y);
        campo('Ubicación', orden.eq_ubicacion || orden.ubicacion, 300, y);
        y += 16;
        campo('Presión Objetivo', orden.eq_presion_obj || orden.presion_objetivo, 45, y);
        campo('Presión Real', orden.eq_presion_real || orden.presion_real, 300, y);
        y += 16;
        campo('Voltaje Mod.', orden.eq_voltaje || orden.voltaje_mod, 45, y);
        campo('Viscosidad', orden.eq_viscosidad || orden.viscosidad, 300, y);
        y += 16;
        campo('Rev. Bomba', orden.eq_rev_bomba || orden.rev_bomba, 45, y);
        y += 22;

        // Estado inicial
        doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
           .text('ESTADO INICIAL DEL EQUIPO', 50, y + 3);
        y += 22;
        doc.fillColor('#333').font('Helvetica').fontSize(9);
        const checks = [
            ['Inspección Visual', orden.inspeccion_visual],
            ['Revisión con Tierra', orden.revision_tierra],
            ['Prueba Electroválvulas', orden.prueba_electrovalvulas]
        ];
        checks.forEach(([label, val]) => {
            doc.text(`${val ? '☑' : '☐'} ${label}`, 50, y);
            y += 14;
        });
        if (orden.estado_inicial) {
            doc.text(orden.estado_inicial, 50, y, { width: doc.page.width - 100 });
            y += doc.heightOfString(orden.estado_inicial, { width: doc.page.width - 100 }) + 8;
        }
        y += 6;

        // Descripción de falla
        if (orden.descripcion_falla) {
            doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
            doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
               .text('DESCRIPCIÓN DE LA FALLA', 50, y + 3);
            y += 22;
            doc.fillColor('#333').font('Helvetica').fontSize(9)
               .text(orden.descripcion_falla, 50, y, { width: doc.page.width - 100 });
            y += doc.heightOfString(orden.descripcion_falla, { width: doc.page.width - 100 }) + 14;
        }

        // Trabajo realizado
        doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
           .text('TRABAJO REALIZADO', 50, y + 3);
        y += 22;
        doc.fillColor('#333').font('Helvetica').fontSize(9)
           .text(orden.trabajo_realizado || '—', 50, y, { width: doc.page.width - 100 });
        y += doc.heightOfString(orden.trabajo_realizado || '—', { width: doc.page.width - 100 }) + 14;

        // Recomendaciones
        doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
           .text('RECOMENDACIONES Y OBSERVACIONES', 50, y + 3);
        y += 22;
        doc.fillColor('#333').font('Helvetica').fontSize(9)
           .text(orden.recomendaciones || '—', 50, y, { width: doc.page.width - 100 });
        y += doc.heightOfString(orden.recomendaciones || '—', { width: doc.page.width - 100 }) + 14;

        // Repuestos
        if (repuestos.length > 0) {
            doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
            doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
               .text('REPUESTOS / MATERIALES UTILIZADOS', 50, y + 3);
            y += 22;
            // Cabecera tabla
            doc.rect(45, y, doc.page.width - 90, 14).fill(gris);
            doc.fillColor('#333').font('Helvetica-Bold').fontSize(8);
            doc.text('N° Parte', 50, y + 3, { width: 80 });
            doc.text('Descripción', 135, y + 3, { width: 160 });
            doc.text('Cant.', 300, y + 3, { width: 40 });
            doc.text('Costo Unit.', 345, y + 3, { width: 70 });
            doc.text('Subtotal', 420, y + 3, { width: 80 });
            y += 16;
            doc.font('Helvetica').fontSize(8);
            let totalRepuestos = 0;
            repuestos.forEach((r, i) => {
                if (i % 2 === 0) doc.rect(45, y - 2, doc.page.width - 90, 14).fill('#fafafa');
                doc.fillColor('#333');
                const subtotal = (parseFloat(r.costo) || 0) * r.cantidad;
                totalRepuestos += subtotal;
                doc.text(r.no_parte || '—', 50, y, { width: 80 });
                doc.text(r.descripcion, 135, y, { width: 160 });
                doc.text(String(r.cantidad), 300, y, { width: 40 });
                doc.text(r.costo ? `$${parseFloat(r.costo).toFixed(2)}` : '—', 345, y, { width: 70 });
                doc.text(subtotal > 0 ? `$${subtotal.toFixed(2)}` : '—', 420, y, { width: 80 });
                y += 16;
            });
            // Total repuestos
            if (totalRepuestos > 0) {
                doc.rect(45, y - 2, doc.page.width - 90, 16).fill('#e8f0fe');
                doc.fillColor('#1a56db').font('Helvetica-Bold').fontSize(9);
                doc.text('TOTAL REPUESTOS:', 300, y + 2, { width: 115, align: 'right' });
                doc.text(`$${totalRepuestos.toFixed(2)}`, 420, y + 2, { width: 80 });
                y += 18;
            }
            y += 6;
        }

        // Firmas — igual al formulario físico
        y += 10;
        doc.rect(45, y, doc.page.width - 90, 16).fill(azul);
        doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
           .text('FIRMA DEL REPRESENTANTE DEL CLIENTE, DE CONFORMIDAD CON LO EXPUESTO', 50, y + 4);
        y += 20;

        // Cabecera tabla de firmas
        const col1 = 45, col2 = 165, col3 = 330, col4 = 450;
        const fw = doc.page.width - 90;
        doc.rect(col1, y, fw, 14).fill(gris);
        doc.fillColor('#333').font('Helvetica-Bold').fontSize(8);
        doc.text('FIRMA E-TECH', col1 + 2, y + 3, { width: 115 });
        doc.text('NOMBRE CLIENTE', col2 + 2, y + 3, { width: 160 });
        doc.text('FIRMA', col3 + 2, y + 3, { width: 115 });
        doc.text('FECHA/HORA', col4 + 2, y + 3, { width: 95 });
        y += 16;

        // Fila de firmas
        doc.rect(col1, y, fw, 55).stroke('#ccc');
        doc.moveTo(col2, y).lineTo(col2, y + 55).stroke('#ccc');
        doc.moveTo(col3, y).lineTo(col3, y + 55).stroke('#ccc');
        doc.moveTo(col4, y).lineTo(col4, y + 55).stroke('#ccc');

        if (firma?.firma_tecnico) {
            try { doc.image(Buffer.from(firma.firma_tecnico.split(',')[1], 'base64'), col1 + 2, y + 3, { width: 115, height: 48 }); } catch {}
        }
        doc.fillColor('#555').font('Helvetica').fontSize(8);
        doc.text(orden.nombre_cliente_firma || orden.cliente_nombre || '', col2 + 4, y + 20, { width: 155 });
        if (firma?.firma_cliente) {
            try { doc.image(Buffer.from(firma.firma_cliente.split(',')[1], 'base64'), col3 + 2, y + 3, { width: 115, height: 48 }); } catch {}
        }
        const fechaFirma = firma?.fecha_hora_firma || firma?.fecha_firma;
        if (fechaFirma) {
            const fd = new Date(fechaFirma);
            doc.text(fd.toLocaleDateString('es') + '\n' + fd.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }), col4 + 4, y + 18, { width: 90 });
        }
        y += 60;

        // Pie de página
        doc.fontSize(7).fillColor('#94a3b8').font('Helvetica')
           .text('ORIGINAL: BLANCO — COPIA: AMARILLA', 45, y + 10, { align: 'left' })
           .text('E-TECH BUSINESS SERVICES S.A.  |  corporativo@ecuatechservice.com  |  Tel: 025163232', 45, y + 10, { align: 'right', width: doc.page.width - 90 });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al generar PDF' });
    }
});

// Excel de una orden
router.get('/:ordenId/excel', verificarToken, async (req, res) => {
    try {
        const { orden, repuestos } = await getOrdenCompleta(req.params.ordenId);
        if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'E-Tech Business Services';

        const ws = wb.addWorksheet('Orden de Trabajo');
        ws.columns = [
            { key: 'campo', width: 30 },
            { key: 'valor', width: 50 }
        ];

        const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a56db' } } };
        const labelStyle = { font: { bold: true } };

        const addHeader = (text) => {
            const row = ws.addRow([text, '']);
            ws.mergeCells(`A${row.number}:B${row.number}`);
            row.getCell(1).style = headerStyle;
            row.height = 18;
        };

        const addRow = (label, value) => {
            const row = ws.addRow([label, value ?? '—']);
            row.getCell(1).style = labelStyle;
        };

        addHeader('E-TECH BUSINESS SERVICES S.A. - ORDEN DE TRABAJO');
        ws.addRow([]);
        addHeader('DATOS GENERALES');
        addRow('Número de Orden', orden.numero_orden);
        addRow('Fecha', orden.fecha ? new Date(orden.fecha).toLocaleDateString('es') : '');
        addRow('Cliente', orden.cliente_nombre);
        addRow('Teléfono Cliente', orden.cliente_telefono);
        addRow('Técnico', orden.tecnico_nombre);
        addRow('Tipo de Servicio', orden.tipo_servicio);
        addRow('Categoría Incidencia', orden.categoria_incidencia);
        addRow('Contacto', orden.contacto);
        addRow('Facturar a', orden.facturar_a);
        addRow('Hora Entrada', orden.hora_entrada);
        addRow('Hora Salida', orden.hora_salida);
        addRow('Horas Facturadas', orden.horas_fact);
        addRow('Tipo de Visita', orden.tipo_visita);
        addRow('Estado', orden.estado);

        ws.addRow([]);
        addHeader('DATOS DEL EQUIPO');
        addRow('Marca', orden.marca);
        addRow('Modelo', orden.modelo);
        addRow('Serie', orden.serie);
        addRow('Ubicación', orden.ubicacion);
        addRow('Presión Objetivo', orden.presion_objetivo);
        addRow('Presión Real', orden.presion_real);
        addRow('Voltaje Mod.', orden.voltaje_mod);
        addRow('Viscosidad', orden.viscosidad);
        addRow('Rev. Bomba', orden.rev_bomba);

        ws.addRow([]);
        addHeader('TRABAJO REALIZADO');
        addRow('Descripción de Falla', orden.descripcion_falla);
        addRow('Trabajo Realizado', orden.trabajo_realizado);
        addRow('Observaciones', orden.observaciones);
        addRow('Recomendaciones', orden.recomendaciones);

        if (repuestos.length > 0) {
            ws.addRow([]);
            addHeader('REPUESTOS / MATERIALES');
            const repHeader = ws.addRow(['N° Parte', 'Descripción', 'Cantidad', 'Costo Unit.', 'Subtotal', 'Observaciones']);
            repHeader.eachCell(cell => { cell.style = labelStyle; });
            let totalRep = 0;
            repuestos.forEach(r => {
                const sub = (parseFloat(r.costo) || 0) * r.cantidad;
                totalRep += sub;
                ws.addRow([r.no_parte, r.descripcion, r.cantidad, r.costo ? parseFloat(r.costo) : null, sub > 0 ? sub : null, r.observaciones]);
            });
            if (totalRep > 0) {
                const totRow = ws.addRow(['', '', '', 'TOTAL REPUESTOS:', totalRep, '']);
                totRow.getCell(4).style = labelStyle;
                totRow.getCell(5).style = { font: { bold: true, color: { argb: 'FF1a56db' } } };
            }
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=orden_${orden.numero_orden}.xlsx`);
        await wb.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al generar Excel' });
    }
});

// Excel de todas las órdenes (reporte general)
router.get('/general/excel', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.numero_orden, o.fecha, o.tipo_servicio, o.categoria_incidencia,
                   o.estado, o.horas_fact,
                   uc.nombre AS cliente, ut.nombre AS tecnico,
                   e.marca, e.modelo, e.serie
            FROM ordenes_trabajo o
            LEFT JOIN usuarios uc ON o.cliente_id=uc.id
            LEFT JOIN usuarios ut ON o.tecnico_id=ut.id
            LEFT JOIN equipos e ON o.equipo_id=e.id
            ORDER BY o.fecha DESC
        `);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Órdenes');
        ws.columns = [
            { header: 'N° Orden', key: 'numero_orden', width: 15 },
            { header: 'Fecha', key: 'fecha', width: 12 },
            { header: 'Cliente', key: 'cliente', width: 25 },
            { header: 'Técnico', key: 'tecnico', width: 20 },
            { header: 'Tipo Servicio', key: 'tipo_servicio', width: 15 },
            { header: 'Categoría', key: 'categoria_incidencia', width: 15 },
            { header: 'Estado', key: 'estado', width: 12 },
            { header: 'Horas', key: 'horas_fact', width: 8 },
            { header: 'Equipo', key: 'equipo', width: 30 },
        ];
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a56db' } };
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        result.rows.forEach(r => {
            ws.addRow({
                ...r,
                fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es') : '',
                equipo: `${r.marca || ''} ${r.modelo || ''} ${r.serie ? '('+r.serie+')' : ''}`
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte_ordenes.xlsx');
        await wb.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: 'Error al generar reporte' });
    }
});

module.exports = router;
