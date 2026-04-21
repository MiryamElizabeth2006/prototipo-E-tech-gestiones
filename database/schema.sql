-- ============================================================
-- SISTEMA DE MANTENIMIENTO DE EQUIPOS - SCHEMA COMPLETO
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios (todos los roles)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN ('admin', 'tecnico', 'cliente')),
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de equipos (catálogo)
CREATE TABLE IF NOT EXISTS equipos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    serie VARCHAR(100),
    ubicacion VARCHAR(200),
    presion_objetivo VARCHAR(50),
    presion_real VARCHAR(50),
    voltaje_mod VARCHAR(50),
    viscosidad VARCHAR(50),
    rev_bomba VARCHAR(50),
    cliente_id UUID REFERENCES usuarios(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de órdenes de trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_orden VARCHAR(30) UNIQUE NOT NULL,
    fecha DATE NOT NULL,
    cliente_id UUID REFERENCES usuarios(id),
    tecnico_id UUID REFERENCES usuarios(id),
    equipo_id UUID REFERENCES equipos(id),
    tipo_servicio VARCHAR(50) NOT NULL CHECK (tipo_servicio IN ('mantenimiento', 'reparacion')),
    categoria_incidencia VARCHAR(50) CHECK (categoria_incidencia IN ('hidraulica', 'electronica', 'cabezal', 'otro')),
    contacto VARCHAR(100),
    facturar_a VARCHAR(100),
    hora_entrada TIME,
    hora_salida TIME,
    horas_fact DECIMAL(5,2),
    tipo_visita VARCHAR(100),
    -- Estado inicial del equipo
    inspeccion_visual BOOLEAN DEFAULT false,
    revision_tierra BOOLEAN DEFAULT false,
    prueba_electrovalvulas BOOLEAN DEFAULT false,
    estado_inicial TEXT,
    -- Datos técnicos medidos en sitio (pueden diferir del catálogo)
    eq_presion_obj VARCHAR(50),
    eq_presion_real VARCHAR(50),
    eq_voltaje VARCHAR(50),
    eq_viscosidad VARCHAR(50),
    eq_rev_bomba VARCHAR(50),
    eq_ubicacion VARCHAR(200),
    -- Trabajo
    descripcion_falla TEXT,
    trabajo_realizado TEXT,
    observaciones TEXT,
    recomendaciones TEXT,
    -- Estado de la orden
    estado VARCHAR(30) NOT NULL DEFAULT 'asignada' CHECK (estado IN ('pendiente', 'asignada', 'cerrada')),
    fecha_cierre TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de repuestos por orden
CREATE TABLE IF NOT EXISTS repuestos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_trabajo_id UUID REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    no_parte VARCHAR(100),
    descripcion VARCHAR(200) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    costo DECIMAL(10,2),
    observaciones VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de firmas digitales
CREATE TABLE IF NOT EXISTS firmas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_trabajo_id UUID UNIQUE REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    firma_tecnico TEXT,
    firma_cliente TEXT,
    nombre_cliente_firma VARCHAR(150),
    fecha_hora_firma TIMESTAMP,
    fecha_firma TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente ON ordenes_trabajo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_tecnico ON ordenes_trabajo(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_fecha ON ordenes_trabajo(fecha);
CREATE INDEX IF NOT EXISTS idx_repuestos_orden ON repuestos(orden_trabajo_id);

-- ============================================================
-- DATOS DE PRUEBA
-- Contraseña de todos los usuarios: password123
-- ============================================================

INSERT INTO usuarios (nombre, email, password, rol, telefono) VALUES
('Administrador',    'admin@etech.com',      '$2a$10$cSx4h0bT4RHHWEJEyEu3N.DvsitJuU3G6RX7iQD/I0SHiqk2KQsOO', 'admin',       '555-0001'),
('Juan Pérez',       'tecnico@etech.com',    '$2a$10$cSx4h0bT4RHHWEJEyEu3N.DvsitJuU3G6RX7iQD/I0SHiqk2KQsOO', 'tecnico',     '555-0002'),
('Carlos Técnico',   'carlos@etech.com',     '$2a$10$cSx4h0bT4RHHWEJEyEu3N.DvsitJuU3G6RX7iQD/I0SHiqk2KQsOO', 'tecnico',     '555-0003'),
('Empresa Demo S.A.','cliente@demo.com',     '$2a$10$cSx4h0bT4RHHWEJEyEu3N.DvsitJuU3G6RX7iQD/I0SHiqk2KQsOO', 'cliente',     '555-0004'),
('Industrias XYZ',   'xyz@cliente.com',      '$2a$10$cSx4h0bT4RHHWEJEyEu3N.DvsitJuU3G6RX7iQD/I0SHiqk2KQsOO', 'cliente',     '555-0005')
ON CONFLICT (email) DO NOTHING;

-- Equipos de prueba
INSERT INTO equipos (marca, modelo, tipo, serie, ubicacion) VALUES
('HP', 'LaserJet Pro M404n', 'impresora', 'SN-001-2024', 'Oficina Principal'),
('Canon', 'imagePROGRAF PRO-4100', 'plotter', 'SN-002-2024', 'Sala de Diseño'),
('Xerox', 'VersaLink C7025', 'fotocopiadora', 'SN-003-2024', 'Recepción'),
('Imaje', 'S8', 'codificadora', 'SN-004-2024', 'Línea de Producción A'),
('Videojet', '1620', 'codificadora', 'SN-005-2024', 'Línea de Producción B'),
('Markem', 'X40', 'codificadora', 'SN-006-2024', 'Almacén')
ON CONFLICT DO NOTHING;
