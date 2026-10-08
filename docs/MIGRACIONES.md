# Migración desde v5.0.3.1

## Esquema

Se mantienen intactas 001_v43_compat y 002_v5_platform. 003_v51_certificates añade, si falta, `certificates.snapshot_json` y crea índices de pagos/estado, lecciones/orden y sesiones/expiración. Todas las migraciones se ejecutan dentro de una transacción y se registran por ID; una segunda ejecución no repite cambios.

Para certificados existentes con snapshot vacío, se guarda nombre, curso, duración, clases ordenadas, layout y URLs de plantilla del estado encontrado al migrar. No se reescriben código ni fecha de emisión. Para los nuevos, ese snapshot se toma al emitirlos.

## Datos y compatibilidad

No hay DROP, vaciado de tablas ni modificación de hashes de contraseña en la migración nueva. La prueba construye el esquema anterior y compara filas de usuarios, cursos, clases, matrículas, pagos, comprobantes, cupones, progreso, certificados, settings, páginas/versiones/secciones, diseño, sedes, sesiones y navegación. Sólo se añade snapshot a certificados. integrity_check=ok y foreign_key_check sin incidencias en la fixture.

No se recibió la base real de tu instalación: el ZIP contiene carpetas vacías para datos. Por ello, la conservación de tus datos reales requiere copiar/conservar tu BD y uploads como explica README. No se certifica una actualización sobre una base real no proporcionada.

## Cambios de contrato

- Todas las mutaciones de auth requieren cookie + X-CSRF-Token obtenido con GET /api/auth/me.
- Claves desconocidas y URLs/colores/configuración inválidos devuelven 400.
- CMS nuevo guardado exige esquema por tipo; contenido antiguo arbitrario no se convierte a HTML ejecutable.
- Nuevas claves bcrypt no superan 72 bytes; login conserva hashes previos.
- Plantillas se dibujan completas (contain), así que una imagen que dependía de recorte cover puede requerir ajustar posiciones. No se borran sus URLs/layout.
- Cursos archivados conservan aula de matrículas existentes.

## Operación y rollback

Detén servicio, respalda carpeta/env/BD/uploads, instala en carpeta nueva, conserva rutas persistentes, npm ci, npm run migrate y arranque. Comprueba archivos privados y certificado anterior. No ejecutes setup en actualización.

Para volver a la versión previa, detén el servicio y restaura código + BD + archivos del backup previo, manteniendo `.env`. No se entrega migración down destructiva. Una copia de BD posterior a 5.1 conserva la columna nueva, pero rollback completo usa el respaldo previo, no una mezcla de estados.


## Actualización 5.1.0 → 5.2.0

No hay columnas ni tablas nuevas en 5.2: los colores/variantes/pie se guardan en el JSON versionado del CMS y `button_style` en la tabla de tokens. Seed usa INSERT OR IGNORE, por lo que añade el token ausente sin sustituir los valores anteriores. Los snapshots y la migración 003 siguen intactos. Una instalación desde v5.0.3.1 ejecuta las migraciones 001–003 necesarias.

Sustituye código conservando `.env`, BD y uploads, ejecuta `npm ci` y `npm run migrate`, y reinicia. Mantén una copia previa antes de guardar bloques nuevos: v5.1 no reconoce footer/colores nuevos al editar, por lo que un rollback completo debe restaurar el backup previo junto al código.


## Actualización 5.2 → 5.3

004_v53_video añade estado de clase y referencia de vídeo, posición de reproducción y tabla video_assets. Todas las clases existentes quedan publicadas para conservar su comportamiento; sus enlaces y materiales no se modifican. Las clases nuevas creadas por administración empiezan en borrador. Los borradores se excluyen de aula, progreso y nuevas emisiones de certificados; los certificados ya emitidos conservan su instantánea.

La aplicación mantiene las matrículas y pagos existentes. El vídeo preparado se guarda en DATA_DIR/uploads/private/videos/<id>; sus rutas se reconstruyen con IDs, no con rutas absolutas antiguas. Usa npm run backup -- --confirm-stopped antes de actualizar, con el servidor realmente detenido. No ejecutes setup sobre tu .env existente. Para rollback completo, restaura el respaldo anterior y su código.
