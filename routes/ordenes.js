const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

// GET todas las órdenes (filtradas por rol)
router.get('/', verificarToken, async (req, res) => {
    try {
        let query = `
            SELECT o.*,
                   uc.nombre AS cliente_nombre, uc.telefono AS cliente_telefono,
                   ut.nombre AS tecnico_nombre,
                   e.marca, e.modelo, e.serie, e.tipo AS equipo_tipo
            FROM ordenes_trabajo o
            LEFT JOIN usuarios uc ON o.cliente_id = uc.id
            LEFT JOIN usuarios ut ON o.tecnico_id = ut.id
            LEFT JOIN equipos e ON o.equipo_id = e.id
        `;
        const params = [];

        if (req.usuario.rol === 'tecnico') {
            query += ' WHERE o.tecnico_id = $1';
            params.push(req.usuario.id);
        } else if (req.usuario.rol === 'cliente') {
            query += ' WHERE o.cliente_id = $1';
            params.push(req.usuario.id);
        } else if (req.usuario.rol === 'facturacion') {
            query += " WHERE o.estado = 'cerrada'";
        }

        query += ' ORDER BY o.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener órdenes' });
    }
});

// GET una orden con repuestos y firma
router.get('/:id', verificarToken, async (req, res) => {
    try {
        const ordenResult = await pool.query(`
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
        `, [req.params.id]);

        if (ordenResult.rows.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });

        const repuestosResult = await pool.query(
            'SELECT * FROM repuestos WHERE orden_trabajo_id = $1 ORDER BY created_at',
            [req.params.id]
        );

        const firmaResult = await pool.query(
            'SELECT * FROM firmas WHERE orden_trabajo_id = $1',
            [req.params.id]
        );

        res.json({
            ...ordenResult.rows[0],
            repuestos: repuestosResult.rows,
            firma: firmaResult.rows[0] || null
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener orden' });
    }
});

// POST crear nueva orden
router.post('/', verificarToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            numero_orden, fecha, cliente_id, equipo_id, tecnico_id,
            tipo_servicio, categoria_incidencia, contacto, facturar_a,
            hora_entrada, hora_salida, horas_fact, tipo_visita,
            inspeccion_visual, revision_tierra, prueba_electrovalvulas,
            estado_inicial, descripcion_falla, trabajo_realizado,
            observaciones, recomendaciones, repuestos,
            firma_tecnico, firma_cliente,
            eq_presion_obj, eq_presion_real, eq_voltaje, eq_viscosidad, eq_rev_bomba, eq_ubicacion
        } = req.body;

        const ordenResult = await client.query(
            `INSERT INTO ordenes_trabajo
            (numero_orden, fecha, cliente_id, equipo_id, tecnico_id, tipo_servicio,
             categoria_incidencia, contacto, facturar_a, hora_entrada, hora_salida,
             horas_fact, tipo_visita, inspeccion_visual, revision_tierra,
             prueba_electrovalvulas, estado_inicial, descripcion_falla,
             trabajo_realizado, observaciones, recomendaciones,
             eq_presion_obj, eq_presion_real, eq_voltaje, eq_viscosidad, eq_rev_bomba, eq_ubicacion)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
            RETURNING *`,
            [numero_orden, fecha, cliente_id, equipo_id, tecnico_id, tipo_servicio,
             categoria_incidencia, contacto, facturar_a, hora_entrada || null, hora_salida || null,
             horas_fact || null, tipo_visita, inspeccion_visual, revision_tierra,
             prueba_electrovalvulas, estado_inicial, descripcion_falla,
             trabajo_realizado, observaciones, recomendaciones,
             eq_presion_obj || null, eq_presion_real || null, eq_voltaje || null,
             eq_viscosidad || null, eq_rev_bomba || null, eq_ubicacion || null]
        );

        const ordenId = ordenResult.rows[0].id;

        if (repuestos && repuestos.length > 0) {
            for (const r of repuestos) {
                if (r.descripcion) {
                    await client.query(
                        `INSERT INTO repuestos (orden_trabajo_id, no_parte, descripcion, cantidad, costo, observaciones)
                         VALUES ($1,$2,$3,$4,$5,$6)`,
                        [ordenId, r.no_parte || null, r.descripcion, r.cantidad || 1, r.costo || null, r.observaciones || null]
                    );
                }
            }
        }

        if (firma_tecnico || firma_cliente) {
            await client.query(
                `INSERT INTO firmas (orden_trabajo_id, firma_tecnico, firma_cliente, nombre_cliente_firma, fecha_hora_firma, fecha_firma)
                 VALUES ($1,$2,$3,$4,$5,NOW())`,
                [ordenId, firma_tecnico || null, firma_cliente || null,
                 req.body.nombre_cliente_firma || null,
                 req.body.fecha_hora_firma || null]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(ordenResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al crear orden', detalle: error.message });
    } finally {
        client.release();
    }
});

// PATCH actualizar estado
router.patch('/:id/estado', verificarToken, async (req, res) => {
    try {
        const { estado } = req.body;
        const fechaCierre = estado === 'cerrada' ? new Date() : null;
        const result = await pool.query(
            `UPDATE ordenes_trabajo SET estado=$1, fecha_cierre=$2, updated_at=NOW()
             WHERE id=$3 RETURNING *`,
            [estado, fechaCierre, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// PUT actualizar orden completa
router.put('/:id', verificarToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const {
            tecnico_id, tipo_servicio, categoria_incidencia, contacto, facturar_a,
            hora_entrada, hora_salida, horas_fact, tipo_visita,
            inspeccion_visual, revision_tierra, prueba_electrovalvulas,
            estado_inicial, descripcion_falla, trabajo_realizado,
            observaciones, recomendaciones, repuestos, firma_tecnico, firma_cliente,
            eq_presion_obj, eq_presion_real, eq_voltaje, eq_viscosidad, eq_rev_bomba, eq_ubicacion
        } = req.body;

        await client.query(
            `UPDATE ordenes_trabajo SET
             tecnico_id=$1, tipo_servicio=$2, categoria_incidencia=$3, contacto=$4,
             facturar_a=$5, hora_entrada=$6, hora_salida=$7, horas_fact=$8, tipo_visita=$9,
             inspeccion_visual=$10, revision_tierra=$11, prueba_electrovalvulas=$12,
             estado_inicial=$13, descripcion_falla=$14, trabajo_realizado=$15,
             observaciones=$16, recomendaciones=$17,
             eq_presion_obj=$18, eq_presion_real=$19, eq_voltaje=$20,
             eq_viscosidad=$21, eq_rev_bomba=$22, eq_ubicacion=$23,
             updated_at=NOW()
             WHERE id=$24`,
            [tecnico_id, tipo_servicio, categoria_incidencia, contacto, facturar_a,
             hora_entrada || null, hora_salida || null, horas_fact || null, tipo_visita,
             inspeccion_visual, revision_tierra, prueba_electrovalvulas,
             estado_inicial, descripcion_falla, trabajo_realizado,
             observaciones, recomendaciones,
             eq_presion_obj || null, eq_presion_real || null, eq_voltaje || null,
             eq_viscosidad || null, eq_rev_bomba || null, eq_ubicacion || null,
             req.params.id]
        );

        if (repuestos) {
            await client.query('DELETE FROM repuestos WHERE orden_trabajo_id=$1', [req.params.id]);
            for (const r of repuestos) {
                if (r.descripcion) {
                    await client.query(
                        `INSERT INTO repuestos (orden_trabajo_id, no_parte, descripcion, cantidad, costo, observaciones)
                         VALUES ($1,$2,$3,$4,$5,$6)`,
                        [req.params.id, r.no_parte || null, r.descripcion, r.cantidad || 1, r.costo || null, r.observaciones || null]
                    );
                }
            }
        }

        if (firma_tecnico || firma_cliente) {
            await client.query(
                `INSERT INTO firmas (orden_trabajo_id, firma_tecnico, firma_cliente, fecha_firma)
                 VALUES ($1,$2,$3,NOW())
                 ON CONFLICT (orden_trabajo_id) DO UPDATE
                 SET firma_tecnico=$2, firma_cliente=$3, fecha_firma=NOW()`,
                [req.params.id, firma_tecnico || null, firma_cliente || null]
            );
        }

        await client.query('COMMIT');
        res.json({ mensaje: 'Orden actualizada correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar orden' });
    } finally {
        client.release();
    }
});

module.exports = router;
