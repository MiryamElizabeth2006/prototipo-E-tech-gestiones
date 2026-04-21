const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

const ESTADOS_VALIDOS = ['pendiente', 'en_proceso', 'cerrada'];
let schemaReadyPromise = null;

async function ensureIncidenciasSchema() {
    if (!schemaReadyPromise) {
        schemaReadyPromise = (async () => {
            await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS incidencias_categorias (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    nombre VARCHAR(120) UNIQUE NOT NULL,
                    descripcion TEXT,
                    activa BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS incidencias (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    consecutivo BIGSERIAL UNIQUE,
                    codigo VARCHAR(30) UNIQUE,
                    categoria_id UUID NOT NULL REFERENCES incidencias_categorias(id),
                    tecnico_id UUID NOT NULL REFERENCES usuarios(id),
                    descripcion TEXT NOT NULL,
                    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'en_proceso', 'cerrada')),
                    fecha_reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    fecha_resolucion TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_incidencias_categoria ON incidencias(categoria_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_incidencias_tecnico ON incidencias(tecnico_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias(estado)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_incidencias_fecha ON incidencias(fecha_reporte)');
            await pool.query(`
                INSERT INTO incidencias_categorias (nombre, descripcion) VALUES
                ('Arreglo', 'Corrección de falla puntual'),
                ('Mantenimiento Preventivo', 'Revisión o mantenimiento programado'),
                ('Inspección', 'Inspección técnica sin intervención mayor'),
                ('Reemplazo de Pieza', 'Sustitución de componente dañado'),
                ('Actualización de Software', 'Actualización de firmware/software')
                ON CONFLICT (nombre) DO NOTHING
            `);
        })().catch((err) => {
            schemaReadyPromise = null;
            throw err;
        });
    }
    return schemaReadyPromise;
}

router.get('/categorias', verificarToken, async (req, res) => {
    try {
        await ensureIncidenciasSchema();
        const result = await pool.query(
            'SELECT id, nombre, descripcion, activa FROM incidencias_categorias WHERE activa=true ORDER BY nombre'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error categorías incidencias:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

router.put('/categorias', verificarToken, verificarRol(['admin']), async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureIncidenciasSchema();
        const categorias = Array.isArray(req.body.categorias) ? req.body.categorias : [];
        await client.query('BEGIN');
        await client.query('UPDATE incidencias_categorias SET activa=false');
        for (const item of categorias) {
            const nombre = String(item.nombre || '').trim();
            if (!nombre) continue;
            await client.query(
                `INSERT INTO incidencias_categorias (nombre, descripcion, activa)
                 VALUES ($1,$2,true)
                 ON CONFLICT (nombre) DO UPDATE SET descripcion=EXCLUDED.descripcion, activa=true`,
                [nombre, item.descripcion || null]
            );
        }
        await client.query('COMMIT');
        res.json({ mensaje: 'Categorías actualizadas' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error guardando categorías incidencias:', error);
        res.status(500).json({ error: 'Error al guardar categorías' });
    } finally {
        client.release();
    }
});

router.post('/', verificarToken, verificarRol(['tecnico', 'admin']), async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureIncidenciasSchema();
        const { categoria_id, descripcion, fecha_resolucion } = req.body;
        const tecnicoId = req.usuario.rol === 'tecnico' ? req.usuario.id : (req.body.tecnico_id || req.usuario.id);
        if (!categoria_id || !descripcion) {
            return res.status(400).json({ error: 'Categoría y descripción son obligatorias' });
        }
        await client.query('BEGIN');
        const insert = await client.query(
            `INSERT INTO incidencias (categoria_id, descripcion, tecnico_id, estado, fecha_resolucion)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING id, consecutivo, fecha_reporte`,
            [categoria_id, descripcion, tecnicoId, fecha_resolucion ? 'cerrada' : 'pendiente', fecha_resolucion || null]
        );
        const row = insert.rows[0];
        const year = new Date(row.fecha_reporte).getFullYear();
        const codigo = `INC-${year}-${String(row.consecutivo).padStart(6, '0')}`;
        await client.query('UPDATE incidencias SET codigo=$1 WHERE id=$2', [codigo, row.id]);
        await client.query('COMMIT');

        const detalle = await pool.query(
            `SELECT i.id, i.codigo, i.estado, i.descripcion, i.fecha_reporte, i.fecha_resolucion,
                    c.nombre AS categoria, u.nombre AS tecnico_nombre
             FROM incidencias i
             JOIN incidencias_categorias c ON c.id=i.categoria_id
             JOIN usuarios u ON u.id=i.tecnico_id
             WHERE i.id=$1`,
            [row.id]
        );
        res.status(201).json(detalle.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creando incidencia:', error);
        res.status(500).json({ error: 'Error al crear incidencia', detalle: error.message });
    } finally {
        client.release();
    }
});

router.get('/', verificarToken, async (req, res) => {
    try {
        await ensureIncidenciasSchema();
        const { codigo, categoria_id, tecnico_id, fecha_desde, fecha_hasta } = req.query;
        let query = `
            SELECT i.id, i.codigo, i.estado, i.descripcion, i.fecha_reporte, i.fecha_resolucion,
                   i.updated_at, c.id AS categoria_id, c.nombre AS categoria,
                   u.id AS tecnico_id, u.nombre AS tecnico_nombre,
                   CASE
                     WHEN i.fecha_resolucion IS NULL THEN NULL
                     ELSE ROUND(EXTRACT(EPOCH FROM (i.fecha_resolucion - i.fecha_reporte))/3600.0, 2)
                   END AS horas_resolucion
            FROM incidencias i
            JOIN incidencias_categorias c ON c.id=i.categoria_id
            JOIN usuarios u ON u.id=i.tecnico_id
            WHERE 1=1
        `;
        const params = [];
        const add = (val, sql) => {
            params.push(val);
            query += sql.replace('$X', `$${params.length}`);
        };

        if (req.usuario.rol === 'tecnico') add(req.usuario.id, ' AND i.tecnico_id=$X');
        if (codigo) add(`%${codigo}%`, ' AND i.codigo ILIKE $X');
        if (categoria_id) add(categoria_id, ' AND i.categoria_id=$X');
        if (tecnico_id && req.usuario.rol === 'admin') add(tecnico_id, ' AND i.tecnico_id=$X');
        if (fecha_desde) add(fecha_desde, ' AND DATE(i.fecha_reporte) >= DATE($X)');
        if (fecha_hasta) add(fecha_hasta, ' AND DATE(i.fecha_reporte) <= DATE($X)');

        query += ' ORDER BY i.fecha_reporte DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error listando incidencias:', error);
        res.status(500).json({ error: 'Error al obtener incidencias' });
    }
});

router.patch('/:id/estado', verificarToken, verificarRol(['tecnico', 'admin']), async (req, res) => {
    try {
        await ensureIncidenciasSchema();
        const { estado } = req.body;
        if (!ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }
        const whereTecnico = req.usuario.rol === 'tecnico' ? ' AND tecnico_id=$3' : '';
        const params = req.usuario.rol === 'tecnico'
            ? [estado, req.params.id, req.usuario.id]
            : [estado, req.params.id];
        const setFecha = estado === 'cerrada'
            ? 'fecha_resolucion=COALESCE(fecha_resolucion,NOW()),'
            : "fecha_resolucion=NULL,";
        const q = `UPDATE incidencias SET estado=$1, ${setFecha} updated_at=NOW()
                   WHERE id=$2 ${whereTecnico} RETURNING *`;
        const result = await pool.query(q, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Incidencia no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error cambiando estado incidencia:', error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

router.get('/stats/overview', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        await ensureIncidenciasSchema();
        const [porCategoria, porTecnico, porEstado, frecuencia, tiempos] = await Promise.all([
            pool.query(`
                SELECT c.nombre AS categoria, COUNT(i.id) AS total
                FROM incidencias_categorias c
                LEFT JOIN incidencias i ON i.categoria_id=c.id
                GROUP BY c.nombre ORDER BY total DESC
            `),
            pool.query(`
                SELECT u.nombre, COUNT(i.id) AS total
                FROM incidencias i
                JOIN usuarios u ON u.id=i.tecnico_id
                GROUP BY u.nombre ORDER BY total DESC
            `),
            pool.query(`SELECT estado, COUNT(*) AS total FROM incidencias GROUP BY estado`),
            pool.query(`
                SELECT TO_CHAR(fecha_reporte, 'YYYY-MM-DD') AS dia, COUNT(*) AS total
                FROM incidencias
                GROUP BY dia ORDER BY dia DESC LIMIT 15
            `),
            pool.query(`
                SELECT c.nombre AS categoria,
                       ROUND(AVG(EXTRACT(EPOCH FROM (i.fecha_resolucion - i.fecha_reporte))/3600.0), 2) AS promedio_horas
                FROM incidencias i
                JOIN incidencias_categorias c ON c.id=i.categoria_id
                WHERE i.fecha_resolucion IS NOT NULL
                GROUP BY c.nombre ORDER BY promedio_horas DESC
            `)
        ]);

        res.json({
            porCategoria: porCategoria.rows,
            porTecnico: porTecnico.rows,
            porEstado: porEstado.rows,
            frecuencia: frecuencia.rows.reverse(),
            tiempos: tiempos.rows
        });
    } catch (error) {
        console.error('Error stats incidencias:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

router.get('/stats/tecnico-resumen', verificarToken, verificarRol(['tecnico']), async (req, res) => {
    try {
        await ensureIncidenciasSchema();
        const [porCategoria, porEstado] = await Promise.all([
            pool.query(`
                SELECT c.nombre AS categoria, COUNT(i.id) AS total
                FROM incidencias_categorias c
                LEFT JOIN incidencias i ON i.categoria_id=c.id AND i.tecnico_id=$1
                GROUP BY c.nombre ORDER BY total DESC
            `, [req.usuario.id]),
            pool.query(`SELECT estado, COUNT(*) AS total FROM incidencias WHERE tecnico_id=$1 GROUP BY estado`, [req.usuario.id])
        ]);
        res.json({ porCategoria: porCategoria.rows, porEstado: porEstado.rows });
    } catch (error) {
        console.error('Error resumen técnico incidencias:', error);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

router.get('/notificaciones/admin', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        await ensureIncidenciasSchema();
        const result = await pool.query(`
            SELECT i.id, i.codigo, i.fecha_reporte, c.nombre AS categoria, u.nombre AS tecnico_nombre
            FROM incidencias i
            JOIN incidencias_categorias c ON c.id=i.categoria_id
            JOIN usuarios u ON u.id=i.tecnico_id
            WHERE i.fecha_reporte >= NOW() - INTERVAL '48 hours'
            ORDER BY i.fecha_reporte DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error notificaciones incidencias:', error);
        res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
});

router.get('/export/csv', verificarToken, async (req, res) => {
    try {
        await ensureIncidenciasSchema();
        const result = await pool.query(`
            SELECT i.codigo, c.nombre AS categoria, u.nombre AS tecnico, i.estado,
                   i.fecha_reporte, i.fecha_resolucion, i.descripcion
            FROM incidencias i
            JOIN incidencias_categorias c ON c.id=i.categoria_id
            JOIN usuarios u ON u.id=i.tecnico_id
            ${req.usuario.rol === 'tecnico' ? 'WHERE i.tecnico_id=$1' : ''}
            ORDER BY i.fecha_reporte DESC
        `, req.usuario.rol === 'tecnico' ? [req.usuario.id] : []);
        const header = 'codigo,categoria,tecnico,estado,fecha_reporte,fecha_resolucion,descripcion';
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = result.rows.map(r => [
            esc(r.codigo), esc(r.categoria), esc(r.tecnico), esc(r.estado),
            esc(r.fecha_reporte), esc(r.fecha_resolucion), esc(r.descripcion)
        ].join(','));
        const csv = [header, ...lines].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=incidencias.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exportando CSV incidencias:', error);
        res.status(500).json({ error: 'Error al exportar CSV' });
    }
});

module.exports = router;
