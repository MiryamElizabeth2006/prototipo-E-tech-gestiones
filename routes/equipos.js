const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, u.nombre AS cliente_nombre
            FROM equipos e
            LEFT JOIN usuarios u ON e.cliente_id = u.id
            WHERE e.activo = true
            ORDER BY e.marca, e.modelo
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener equipos' });
    }
});

router.get('/:id', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT e.*, u.nombre AS cliente_nombre FROM equipos e LEFT JOIN usuarios u ON e.cliente_id=u.id WHERE e.id=$1',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Equipo no encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener equipo' });
    }
});

router.post('/', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        const { marca, modelo, tipo, serie, ubicacion, presion_objetivo,
                presion_real, voltaje_mod, viscosidad, rev_bomba, cliente_id } = req.body;
        const result = await pool.query(
            `INSERT INTO equipos (marca, modelo, tipo, serie, ubicacion, presion_objetivo,
             presion_real, voltaje_mod, viscosidad, rev_bomba, cliente_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [marca, modelo, tipo, serie, ubicacion, presion_objetivo,
             presion_real, voltaje_mod, viscosidad, rev_bomba, cliente_id || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear equipo' });
    }
});

router.put('/:id', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        const { marca, modelo, tipo, serie, ubicacion, presion_objetivo,
                presion_real, voltaje_mod, viscosidad, rev_bomba, cliente_id } = req.body;
        const result = await pool.query(
            `UPDATE equipos SET marca=$1, modelo=$2, tipo=$3, serie=$4, ubicacion=$5,
             presion_objetivo=$6, presion_real=$7, voltaje_mod=$8, viscosidad=$9,
             rev_bomba=$10, cliente_id=$11 WHERE id=$12 RETURNING *`,
            [marca, modelo, tipo, serie, ubicacion, presion_objetivo,
             presion_real, voltaje_mod, viscosidad, rev_bomba, cliente_id || null, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar equipo' });
    }
});

router.delete('/:id', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        await pool.query('UPDATE equipos SET activo=false WHERE id=$1', [req.params.id]);
        res.json({ mensaje: 'Equipo desactivado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar equipo' });
    }
});

module.exports = router;
