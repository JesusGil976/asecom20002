# Aplicación del prompt maestro

El prompt recibido está incluido sin modificaciones en `docs/PROMPT_MAESTRO.md`. La instrucción directa de empezar a programar sustituyó la etapa de auditoría/confirmación. Se trabajó sobre el código funcional 5.1.0 derivado del ZIP v5.0.3.1 ya entregado.

| Área del prompt | Implementación entregada |
|---|---|
| Identidad visual y diseño | Nueva paleta inicial, composición editorial, tokens/composiciones separados, controles de tipografía/densidad/botones/radios/sombras |
| CMS avanzado | Bloques, variantes, drag/drop y botones de orden, activación, contenido, URL/upload en Hero/Nosotros, colores por bloque, columnas, alineación y visibilidad móvil |
| Previsualización/publicación | Vista de sección en vivo sin guardar y vista completa de borrador; guardar y publicar transaccionales, bloqueo de publicación tras fallo de guardado |
| Header y footer | Marca/contacto/redes/textos configurables, editor dinámico de enlaces, labels de login/registro, menú móvil; pie de página en bloques con variantes y sin duplicado global |
| Cursos y catálogo | CRUD/publicación/archivo, clases, imágenes/video/materiales, featured; búsqueda/categoría/nivel/precio/orden, URL de filtros, contador y panel móvil plegable |
| Destacados | Sólo cursos destacados, carrusel 1/2/3, scroll táctil, flechas/dots/teclado |
| Aprendizaje | Dashboard de inscritos, progreso y resumen de datos reales, 1–2 recomendaciones, certificados y pagos; aula responsive con contenido y anterior/siguiente |
| Autenticación | Login/registro/logout/reset, Mostrar/Ocultar dentro del input, confirmación, CSRF, cookies, token hash con expiración/uso único e invalidación de sesiones |
| Pagos/cupones | Pago Móvil, cálculo de cupón/tasa en servidor, pendiente/aprobado/rechazado y matrícula al aprobar; comprobantes privados |
| Certificados | Plantillas frontal/trasera por URL segura o upload; editor visual, A4 horizontal de dos páginas, temario íntegro, PDF, verificación y snapshot |
| Sedes/media | Sedes dinámicas, Maps Embed controlado, URLs y upload validados, aspect ratio estable, fallback de imagen; vídeo permitido y PDF autorizado |
| Seguridad/estados/accesibilidad | Esquemas CMS cerrados, escapes, contratos de color/tokens, roles/autorización, rate limits, sin stack público, loading/empty/disabled/toasts, labels dinámicos, focus/modales/progreso semántico y movimiento reducido |
| Persistencia/operación | SQLite conservado, migración 003 aditiva, backup/restore, variables, logs, health, ejemplos HTTPS/proxy/contenedor/servicio |
| QA y documentación | 60 pruebas, 185 capturas y flujos UI; instalación limpia repetida, manual y límites explícitos |

## Mejoras con coste acotado

- **Renderer compartido:** el alumno y el editor usan los mismos componentes; reduce divergencia de previsualización. No necesita un framework nuevo.
- **Colores por sección:** permite a administración componer campañas sin CSS arbitrario. Se limita a colores hexadecimales y herencia de tokens.
- **Filtros con URL:** el usuario puede volver a una búsqueda o compartir su selección; usa el backend de filtros existente y añade controles pequeños.
- **Resumen de aprendizaje:** muestra datos reales ya disponibles en el dashboard, sin estadísticas inventadas ni consultas nuevas por alumno.
- **Navegación dinámica:** evita depender del desarrollador para añadir enlaces. Reutiliza la validación y auditoría de backend existentes.

## Alcance real y límites

La reconstrucción no sustituye la arquitectura backend que ya había sido validada ni reinicia la BD. No se implementó PostgreSQL: se conserva la documentación del trabajo necesario. Marca y navegación se guardan globalmente; sólo Inicio tiene borradores versionados. La vista de sección no es un emulador completo del viewport. Los textos, imágenes y colores de una instalación existente se conservan, y pueden modificarse desde administración. No se afirma prueba en tu servidor ni con tu BD productiva.


5.3 incorpora vídeo privado HLS, subida por partes reanudable, cola persistente con trabajador separado, clases en borrador/publicadas, orden por botones, posición de reproducción, subtítulos y correo HTML. La subida es administrativa. No implementa DRM ni almacenamiento separado para cada alumno.
