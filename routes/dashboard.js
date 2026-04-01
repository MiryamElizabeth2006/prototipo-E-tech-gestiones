const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/estadisticas', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        const [estados, tipos, porDia, porCliente, porTecnico, equiposTop,
               totalEquipos, totalTecnicos, totalClientes, fallasCat] = await Promise.all([

            pool.query(`SELECT estado, COUNT(*) AS total FROM ordenes_trabajo GROUP BY estado`),

            pool.query(`SELECT tipo_servicio, COUNT(*) AS total FROM ordenes_trabajo GROUP BY tipo_servicio`),

            pool.query(`
                SELECT TO_CHAR(fecha, 'DD/MM') AS dia, COUNT(*) AS total
                FROM ordenes_trabajo
                WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY dia, fecha ORDER BY fecha
            `),

            pool.query(`
                SELECT u.nombre, COUNT(o.id) AS total
                FROM ordenes_trabajo o
                JOIN usuarios u ON o.cliente_id = u.id
                GROUP BY u.nombre ORDER BY total DESC LIMIT 5
            `),

            pool.query(`
                SELECT u.nombre, COUNT(o.id) AS total
                FROM ordenes_trabajo o
                JOIN usuarios u ON o.tecnico_id = u.id
                GROUP BY u.nombre ORDER BY total DESC LIMIT 5
            `),

            pool.query(`
                SELECT e.marca, e.modelo, COUNT(o.id) AS incidencias
                FROM ordenes_trabajo o
                JOIN equipos e ON o.equipo_id = e.id
                GROUP BY e.marca, e.modelo ORDER BY incidencias DESC LIMIT 5
            `),

            pool.query(`SELECT COUNT(*) AS total FROM equipos WHERE activo=true`),
            pool.query(`SELECT COUNT(*) AS total FROM usuarios WHERE rol='tecnico' AND activo=true`),
            pool.query(`SELECT COUNT(*) AS total FROM usuarios WHERE rol='cliente' AND activo=true`),

            pool.query(`
                SELECT COALESCE(categoria_incidencia, 'sin categoría') AS categoria_incidencia,
                       COUNT(*) AS total
                FROM ordenes_trabajo
                WHERE categoria_incidencia IS NOT NULL
                GROUP BY categoria_incidencia ORDER BY total DESC
            `)
        ]);

        res.json({
            porEstado:                estados.rows,
            porTipoServicio:          tipos.rows,
            atencionesPorDia:         porDia.rows,
            atencionesPorCliente:     porCliente.rows,
            atencionesPorTecnico:     porTecnico.rows,
            equiposConMasIncidencias: equiposTop.rows,
            fallasPorCategoria:       fallasCat.rows,
            totalEquipos:             totalEquipos.rows[0].total,
            totalTecnicos:            totalTecnicos.rows[0].total,
            totalClientes:            totalClientes.rows[0].total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
