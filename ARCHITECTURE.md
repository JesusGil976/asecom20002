# Arquitectura de AcademiaVE 5.2.0

## Decisión de continuidad

La base entregada es v5.0.3.1. Se conserva su monolito modular: cambiar de framework o BD no aportaba una mejora suficiente para justificar regresiones durante esta revisión. La aplicación arranca sin compilación de frontend.

## Componentes reales

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| Arranque/configuración | server.js, src/config.js | Variables, garantías de producción, ciclo de vida |
| HTTP | src/app.js, src/routes/ | Express, composición de rutas y respuestas |
| Acceso y controles | src/middleware/ | Usuario, roles, CSRF, origen, límites, errores |
| SQLite | src/db/ | Conexión WAL, migraciones transaccionales, store de sesiones y seeds |
| Servicios | src/services/ | Cursos, pricing, certificados, CMS, settings, archivos, correo y auditoría |
| Frontend | public/assets/js/ | Router SPA, estado, API CSRF, vistas y administración |
| Diseño | public/assets/css/, design_tokens | Variables CSS, responsive, tokens persistidos |
| Persistencia | DATA_DIR, PUBLIC_UPLOAD_DIR | SQLite, privados, imágenes, plantillas y backups |
| Operación | scripts/, deploy/, Dockerfile | Setup, validación, backup/restore, servicio/proxy/contenedor |

La nueva función quotePayment centraliza la lógica compartida por cotización y creación de pago. cms-schema es el contrato de bloque por tipo; remote-template concentra la descarga remota segura. Certificados guardan un snapshot serializable para separar emisión histórica de datos editables.

## Transacciones y conservación

Aprobación de pago + matrícula, creación de pago + recibo + uso de cupón, publicación CMS, configuración por lote y consumo de reset se protegen con transacciones. No se simula una transacción distribuida entre SQLite y el sistema de archivos: las subidas intentan retirar archivos recién creados si falla la operación, pero una interrupción de proceso todavía puede dejar un archivo huérfano. Backup completo requiere detener escrituras.

El frontend y el servidor validan datos con propósitos distintos: el servidor es la autoridad. Las URLs privadas requieren autorización en cada descarga. Las plantillas públicas contienen sólo el fondo; datos del alumno se generan en PDF privado. La verificación de certificado por código conserva el carácter público de la versión base.

## Preparación para PostgreSQL

SQLite sigue siendo la única BD ejecutable en esta entrega. No se afirma compatibilidad PostgreSQL. La lógica de precio, CMS y rendering ya queda separada de rutas, pero quedan sentencias SQL directas, `.prepare()`, pragmas, `INSERT OR IGNORE` y `lastInsertRowid` que necesitarán repositorios y un adaptador antes de migrar. Snapshot usa JSON convencional y los archivos están fuera de la BD; no se añadieron formatos propietarios que impidan esa transición.

## Mantenibilidad y límites

Se añadió lockfile, contratos explícitos, pruebas de regresión y documentación de operación. Parte del frontend original sigue en funciones extensas; la revisión no reescribe todo el panel. Las listas administrativas y algunas consultas por curso aún requieren paginación/optimización para volúmenes grandes. El sistema es apropiado para una instalación de un proceso con SQLite; escalado horizontal necesita almacenamiento, sesiones y rate limits compartidos.


## Separación frontend incorporada en 5.2

`home.js` genera secciones con una lista de componentes cerrada y lo reutiliza CMS para evitar una vista previa implementada de forma independiente. `navigation-editor.js` encapsula los enlaces. `ui.js` centraliza escapes, tarjetas, estado, progreso y asociación accesible de controles. `state.js` traduce los tokens validados a variables CSS y atributos de densidad/botón.

Tokens y composiciones están separados de los estilos de compatibilidad. No se añadió un bundler/framework ni dependencias de runtime para esta reconstrucción. Se reformateó el frontend: aún quedan funciones extensas en administración y vistas; los futuros cambios pueden separarlas por dominio sin migrar datos.
