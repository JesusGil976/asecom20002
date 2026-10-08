# Changelog

## 5.2.0 — reconstrucción según prompt maestro

- Nueva identidad visual y composiciones de portada, tarjetas, autenticación, dashboard, aula y administración. Superficies planas, colores mediante tokens, estados y focus visibles.
- Sistema de diseño separado en tokens y composiciones. Tema inicial nuevo; los temas existentes se conservan.
- Renderer de Inicio separado del resto de vistas y reutilizado en la vista de sección del CMS.
- CMS con colores por bloque, controles seguros, upload en Hero/Nosotros y pie de página con dos variantes. Vista en vivo sin publicar; publicación completa comprobada en UI.
- Editor de navegación con altas/bajas, visibilidad, cabecera/pie y orden, hasta 30 enlaces.
- Diseño con tipografía, estilos de botón, sombras y vista local; corrección de validación de radios, ancho y sombras iniciales.
- Catálogo con precios mínimo/máximo, contador de resultados, URL reproducible, limpiar filtros y panel desplegable móvil.
- Autenticación con composición propia, Mostrar/Ocultar integrado y estados accesibles, también en confirmación del reset.
- Dashboard con resumen de datos reales y organización de cursos/pagos/certificados. Resumen administrativo con accesos a acciones habituales.
- Carrusel con controles de 28 px, teclado y respeto a movimiento reducido; testimonios slider operables por teclado.
- Asociación automática de labels en formularios dinámicos; barras de progreso con semántica; fallback ante imágenes fallidas.
- Frontend formateado para mantenimiento; nuevos módulos sin dependencias de producción nuevas.
- Tres pruebas de contratos y persistencia del producto añadidas: 47 pruebas automatizadas totales; 17 flujos UI y matriz de siete tamaños.

No se cambiaron reglas de cobro, estados de pago, hashes, matrículas ni progreso. No se sustituyeron plantillas de certificados existentes ni borradores publicados. La instalación nueva utiliza los defaults nuevos y la actualización conserva configuración previa.

# Cambios: v5.0.3.1 → v5.1.0

## Estabilidad y datos

- Conserva Express, SQLite, sesiones server-side, frontend modular y funciones de v5.0.3.1. No parte de v4.3.
- Corrige «Nueva clase» pasando un objeto en vez de null. Reintentar una subida de PDF fallida usa la clase recién guardada y evita duplicarla.
- Archivar un curso conserva el aula para alumnos ya matriculados.
- Migración aditiva `003_v51_certificates`: snapshot de certificados e índices; sin borrar datos existentes.
- Rutas persistentes públicas configurables con `PUBLIC_UPLOAD_DIR`. Defaults se copian sólo si faltan; las plantillas del usuario no se sobrescriben.
- Backup por API de SQLite, copia de archivos y manifiesto SHA-256; restore valida y conserva la instalación anterior.
- `npm run setup` crea configuración de desarrollo con credenciales aleatorias sin sobrescribir `.env`.
- Se entrega package-lock reproducible y configuración de Docker, proxy y servicio.

## Seguridad

- CSRF también en registro, login y recuperación/reset. Origen canónico cuando hay PUBLIC_URL; API sin caché compartida.
- Bcrypt asíncrono en auth, límite de 72 bytes para nuevas contraseñas y consumo de token de reset comprobado dentro de transacción tras el hash.
- Fallo SMTP no revela si existe la cuenta; queda registrado para operación.
- CMS con esquema de campos por tipo; rechaza HTML, protocolos peligrosos y propiedades arbitrarias.
- Configuración desconocida/URLs/colores inválidos devuelve 400 y revierte el lote. Validación de fechas de cupón, navegación y órdenes de sedes.
- Subidas: bytes reales, MIME, firma, integridad básica, límite de dimensiones; error 413 comprensible. PDF de una clase no se reasigna a otra mediante su ID.
- Plantillas remotas: DNS público fijado, bloqueo de redes reservadas, sin redirects, timeout y límite durante descarga. Validación de imagen antes de embeber.
- Nodemailer 7 → 10.0.14. npm audit final: cero vulnerabilidades reportadas al ejecutar la auditoría; no equivale a una certificación de seguridad.
- CSP conserva script-src self y la política existente para estilos dinámicos; no se añadió unsafe-inline a scripts.

## Certificados

- Imagen completa con contain, sin recorte ni deformación.
- Fuentes Unicode DejaVu incluidas y estilo negrita+cursiva; caracteres no admitidos producen error explícito.
- Ajuste de texto, palabras largas y temario en 1–4 columnas. No hay recorte silencioso; capacidad excesiva devuelve 422.
- Preview escalado con tamaño de página A4; coordenadas visibles redondeadas y límites correctos cuando se amplía un campo.
- Flechas/Shift para mover campos, manejo de pointercancel y ResizeObserver del editor.
- Certificados nuevos conservan datos/temario/layout/URLs al emitirse; los existentes reciben snapshot del estado encontrado al actualizar.
- Plantillas limpias en instalaciones nuevas; las imágenes y ajustes previos se preservan en actualizaciones.

## UX y responsive

- Total USD/Bs y cupón consultados al servidor antes de reportar pago.
- Dashboard con últimos cinco pagos y estados/motivos/comprobantes; saludo breve y placeholder de curso legible.
- Corrección de overflow de 2 px en dashboard a 360 px con títulos largos y 100%.
- Título del aula más compacto; conserva anterior/siguiente y temario móvil.
- Header tablet colapsa antes de amontonar acciones. Móvil mantiene logo, CTA y hamburguesa.
- CMS: guardar fallido impide publicar/preview; botones subir/bajar accesibles y composición móvil ordenada.
- Modales con nombre accesible, foco inicial, fondo inert, Escape y retorno de foco. Preferencia de movimiento reducido.
- Login respeta destino interno seguro; corrección de selección de anclas y menú Escape.
- Normalización de vídeos soporta URLs watch/embed/shorts/live de YouTube y Vimeo con hosts explícitos.

## Validación

- 18 pruebas originales pasaban antes del cambio.
- 44 pruebas automatizadas finales aprobadas, ninguna omitida.
- 25 rutas en 7 tamaños = 175 capturas Chromium; sin overflow global ni errores de consola en esa matriz.
- Flujos UI y HTTP, SMTP local, backup/restore, migración, PDF A4 de dos páginas y temario de 150 clases cortas.
- Límites y servicios no ejecutados documentados en `docs/QA.md` y `docs/PROBLEMAS_CONOCIDOS.md`.
