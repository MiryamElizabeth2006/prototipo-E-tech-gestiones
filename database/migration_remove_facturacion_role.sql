-- Migración: eliminar rol facturación y dejar solo admin/tecnico/cliente
-- 1) mover usuarios facturación a admin
UPDATE usuarios
SET rol = 'admin'
WHERE rol = 'facturacion';

-- 2) ajustar constraint de roles
ALTER TABLE usuarios
DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE usuarios
ADD CONSTRAINT usuarios_rol_check
CHECK (rol IN ('admin', 'tecnico', 'cliente'));
