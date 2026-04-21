const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Para firmas en base64
app.use(express.static('public'));

// Soporte de token por query param (para descargas directas)
app.use((req, res, next) => {
    if (req.query.token && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
});

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ordenes', require('./routes/ordenes'));
app.use('/api/equipos', require('./routes/equipos'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/incidencias', require('./routes/incidencias'));

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`   Roles disponibles: admin | tecnico | cliente`);
    console.log(`   Contraseña de prueba: password123`);
});
