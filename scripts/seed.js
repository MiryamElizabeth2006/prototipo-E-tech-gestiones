// Ejecutar con: node scripts/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function seed() {
    const password = await bcrypt.hash('password123', 10);
    console.log('Hash generado:', password);

    try {
        // Limpiar usuarios existentes
        await pool.query('DELETE FROM usuarios');

        const usuarios = [
            { nombre: 'Administrador',    email: 'admin@etech.com',         rol: 'admin' },
            { nombre: 'Juan Pérez',        email: 'tecnico@etech.com',        rol: 'tecnico' },
            { nombre: 'Carlos Técnico',    email: 'carlos@etech.com',         rol: 'tecnico' },
            { nombre: 'Empresa Demo S.A.', email: 'cliente@demo.com',         rol: 'cliente' },
            { nombre: 'Industrias XYZ',    email: 'xyz@cliente.com',          rol: 'cliente' },
            { nombre: 'Facturación',       email: 'facturacion@etech.com',    rol: 'facturacion' },
        ];

        for (const u of usuarios) {
            await pool.query(
                'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
                [u.nombre, u.email, password, u.rol]
            );
            console.log(`✅ Usuario creado: ${u.email}`);
        }

        console.log('\n✅ Seed completado. Contraseña de todos: password123');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
