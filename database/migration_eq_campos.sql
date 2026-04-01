-- Migración: agregar campos de datos técnicos del equipo medidos en sitio
-- Ejecutar si ya tienes la base de datos creada con el schema anterior

ALTER TABLE ordenes_trabajo
    ADD COLUMN IF NOT EXISTS eq_presion_obj  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS eq_presion_real VARCHAR(50),
    ADD COLUMN IF NOT EXISTS eq_voltaje      VARCHAR(50),
    ADD COLUMN IF NOT EXISTS eq_viscosidad   VARCHAR(50),
    ADD COLUMN IF NOT EXISTS eq_rev_bomba    VARCHAR(50),
    ADD COLUMN IF NOT EXISTS eq_ubicacion    VARCHAR(200);

-- Migración: agregar campos de nombre y fecha/hora en firmas
ALTER TABLE firmas
    ADD COLUMN IF NOT EXISTS nombre_cliente_firma VARCHAR(150),
    ADD COLUMN IF NOT EXISTS fecha_hora_firma TIMESTAMP;
