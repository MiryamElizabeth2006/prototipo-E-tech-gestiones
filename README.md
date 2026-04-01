# Sistema de Mantenimiento de Equipos

Sistema web para gestión de órdenes de trabajo, equipos y reportes de mantenimiento.

## Características

- Gestión de órdenes de trabajo
- Sistema de roles (Administrador, Técnico, Cliente)
- Dashboard administrativo con estadísticas
- Exportación de reportes en PDF y Excel
- Interfaz responsiva para móviles y tablets
- Autenticación con JWT

## Requisitos

- Node.js 14+
- PostgreSQL 12+
- pgAdmin (opcional, para gestión de base de datos)

## Instalación

### 1. Configurar Base de Datos

Abrir pgAdmin y ejecutar:

```sql
CREATE DATABASE mantenimiento_db;
```

Luego conectarse a la base de datos y ejecutar el script `database/schema.sql`

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Editar el archivo `.env` con tus credenciales de PostgreSQL:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mantenimiento_db
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=tu_secreto_seguro
```

### 4. Iniciar el Servidor

```bash
npm start
```

O para desarrollo con auto-reload:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## Usuarios de Prueba

Después de ejecutar el script SQL, tendrás estos usuarios:

- **Administrador**: admin@etech.com / password123
- **Técnico**: tecnico@etech.com / password123
- **Cliente**: cliente@demo.com / password123

## Estructura del Proyecto

```
├── config/
│   └── database.js          # Configuración de PostgreSQL
├── middleware/
│   └── auth.js              # Middleware de autenticación
├── routes/
│   ├── auth.js              # Rutas de autenticación
│   ├── ordenes.js           # Rutas de órdenes de trabajo
│   ├── equipos.js           # Rutas de equipos
│   ├── usuarios.js          # Rutas de usuarios
│   ├── reportes.js          # Rutas de reportes (PDF/Excel)
│   └── dashboard.js         # Rutas de estadísticas
├── public/
│   ├── css/
│   │   └── styles.css       # Estilos CSS
│   ├── js/
│   │   └── app.js           # JavaScript del frontend
│   └── index.html           # Página principal
├── database/
│   └── schema.sql           # Script de base de datos
├── .env                     # Variables de entorno
├── server.js                # Servidor Express
└── package.json

```

## Funcionalidades por Rol

### Administrador
- Acceso completo a todas las funcionalidades
- Gestión de usuarios, equipos y órdenes
- Visualización de dashboard con estadísticas
- Exportación de reportes

### Técnico
- Ver órdenes asignadas
- Crear nuevas órdenes de trabajo
- Actualizar estado de órdenes
- Generar reportes

### Cliente
- Ver órdenes asignadas (solo lectura)
- Descargar reportes de sus órdenes

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión

### Órdenes de Trabajo
- `GET /api/ordenes` - Listar órdenes
- `POST /api/ordenes` - Crear orden
- `PATCH /api/ordenes/:id/estado` - Actualizar estado

### Reportes
- `GET /api/reportes/:ordenId/pdf` - Descargar PDF
- `GET /api/reportes/:ordenId/excel` - Descargar Excel

### Dashboard
- `GET /api/dashboard/estadisticas` - Obtener estadísticas

### Equipos
- `GET /api/equipos` - Listar equipos
- `POST /api/equipos` - Crear equipo

### Usuarios
- `GET /api/usuarios` - Listar usuarios
- `POST /api/usuarios` - Crear usuario

## Tecnologías Utilizadas

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT para autenticación
- PDFKit para generación de PDFs
- ExcelJS para generación de Excel

### Frontend
- HTML5
- CSS3 (diseño responsivo)
- JavaScript vanilla (sin frameworks)
- Fetch API para comunicación con backend

## Notas de Seguridad

- Las contraseñas se almacenan hasheadas con bcrypt
- Autenticación mediante JWT
- Validación de roles en cada endpoint
- Variables sensibles en archivo .env (no incluir en git)

## Soporte

Para problemas o preguntas, contactar al equipo de desarrollo.
