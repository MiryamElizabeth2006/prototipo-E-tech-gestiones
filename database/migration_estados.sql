-- Migración: cambiar estados de órdenes de trabajo
-- Reemplaza 'en_proceso' por 'asignada' y actualiza el constraint

-- 1. Actualizar órdenes existentes con estado 'en_proceso' a 'asignada'
UPDATE ordenes_trabajo SET estado = 'asignada' WHERE estado = 'en_proceso';

-- 2. Eliminar el constraint anterior
ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_estado_check;

-- 3. Agregar el nuevo constraint con los estados correctos
ALTER TABLE ordenes_trabajo 
    ADD CONSTRAINT ordenes_trabajo_estado_check 
    CHECK (estado IN ('pendiente', 'asignada', 'cerrada'));

-- 4. Cambiar el valor por defecto a 'asignada'
ALTER TABLE ordenes_trabajo ALTER COLUMN estado SET DEFAULT 'asignada';
