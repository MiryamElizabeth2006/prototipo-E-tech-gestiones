CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS incidencias_categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(120) UNIQUE NOT NULL,
    descripcion TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

-- Compatibilidad con instalaciones previas (tabla ya creada con menos columnas)
ALTER TABLE incidencias
    ADD COLUMN IF NOT EXISTS consecutivo BIGSERIAL,
    ADD COLUMN IF NOT EXISTS codigo VARCHAR(30),
    ADD COLUMN IF NOT EXISTS fecha_reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS fecha_resolucion TIMESTAMP,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Si había datos previos, rellenar fecha_reporte para evitar nulos
UPDATE incidencias
SET fecha_reporte = COALESCE(fecha_reporte, created_at, CURRENT_TIMESTAMP)
WHERE fecha_reporte IS NULL;

-- Restricciones únicas (solo si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'incidencias_codigo_key'
    ) THEN
        ALTER TABLE incidencias ADD CONSTRAINT incidencias_codigo_key UNIQUE (codigo);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidencias_categoria ON incidencias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_tecnico ON incidencias(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_fecha ON incidencias(fecha_reporte);

INSERT INTO incidencias_categorias (nombre, descripcion) VALUES
('Arreglo', 'Corrección de falla puntual'),
('Mantenimiento Preventivo', 'Revisión o mantenimiento programado'),
('Inspección', 'Inspección técnica sin intervención mayor'),
('Reemplazo de Pieza', 'Sustitución de componente dañado'),
('Actualización de Software', 'Actualización de firmware/software')
ON CONFLICT (nombre) DO NOTHING;
