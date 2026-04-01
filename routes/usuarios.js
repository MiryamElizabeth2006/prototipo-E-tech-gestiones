const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, async (req, res) => {
    try {
        const { rol } = req.query;
        let query = 'SELECT id, nombre, email, rol, telefono, activo FROM usuarios WHERE activo=true';
        const params = [];
        if (rol) { query += ' AND rol=$1'; params.push(rol); }
        query += ' ORDER BY nombre';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

router.post('/', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        const { nombre, email, password, rol, telefono } = req.body;
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO usuarios (nombre, email, password, rol, telefono)
             VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, email, rol, telefono`,
            [nombre, email, hash, rol, telefono || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ error: 'El email ya está registrado' });
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

router.put('/:id', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        const { nombre, email, rol, telefono, password } = req.body;

        if (password && password.length >= 6) {
            // Actualizar con nueva contraseña
            const hash = await bcrypt.hash(password, 10);
            const result = await pool.query(
                `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, telefono=$4, password=$5
                 WHERE id=$6 RETURNING id, nombre, email, rol, telefono`,
                [nombre, email, rol, telefono || null, hash, req.params.id]
            );
            return res.json(result.rows[0]);
        }

        // Sin cambio de contraseña
        const result = await pool.query(
            `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, telefono=$4
             WHERE id=$5 RETURNING id, nombre, email, rol, telefono`,
            [nombre, email, rol, telefono || null, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

router.patch('/:id/estado', verificarToken, verificarRol(['admin']), async (req, res) => {
    try {
        const { activo } = req.body;
        await pool.query('UPDATE usuarios SET activo=$1 WHERE id=$2', [activo, req.params.id]);
        res.json({ mensaje: 'Estado actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

module.exports = router;
