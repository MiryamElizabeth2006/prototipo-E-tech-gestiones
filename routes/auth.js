const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
            [email]
        );
        
        console.log('Usuario encontrado:', result.rows.length > 0 ? result.rows[0].email : 'NINGUNO');
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const usuario = result.rows[0];
        const passwordValido = await bcrypt.compare(password, usuario.password);
        
        console.log('Password válido:', passwordValido);
        console.log('Hash en DB:', usuario.password?.substring(0, 20) + '...');
        
        if (!passwordValido) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        
        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(500).json({ error: 'Error en el servidor', detalle: error.message });
    }
});

module.exports = router;
