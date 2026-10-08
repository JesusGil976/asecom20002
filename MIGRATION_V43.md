# Migración AcademiaVE v4.3 → v5.0

## Objetivo

Migrar arquitectura y frontend sin destruir datos ni reglas de negocio.

## Datos preservados

v5 reutiliza las tablas de v4.3 para:

- `users`
- `courses`
- `lessons`
- `media`
- `payments`
- `payment_receipts`
- `sessions`
- `password_reset_tokens`
- `enrollments`
- `lesson_progress`
- `site_settings`
- `coupons`
- `certificates`

Se conservan IDs, hashes de contraseña, referencias bancarias, importes históricos, matrícula, progreso y códigos de certificado.

## Antes de migrar

1. Detén v4.3.
2. Haz backup verificable de `data/` y `public/uploads/`.
3. Copia el backup a una ubicación diferente del servidor.
4. Conserva el `.env` actual.
5. Prueba primero sobre una copia/staging.

## Procedimiento recomendado

```bash
# dentro de una carpeta nueva con v5
cp /ruta/v4.3/.env ./.env
cp -a /ruta/v4.3/data ./data
cp -a /ruta/v4.3/public/uploads/. ./public/uploads/

npm install
npm run migrate
npm test
npm start
```

No copies `server.js`, `public/index.html`, `public/script.js` o `public/style.css` de v4.3 encima de v5.

## Qué ocurre al aplicar migraciones

1. Se crea `schema_migrations`.
2. Se verifica/completa el esquema v4.3 sin borrar tablas.
3. Se crean las tablas v5.
4. Se generan tokens de diseño iniciales tomando los colores existentes cuando están disponibles.
5. Se crea la página `home` y una versión CMS publicada inicial basada en `site_settings` si aún no existe.
6. Las antiguas `location_1..3` se convierten en registros de `locations` sólo si la tabla nueva está vacía.
7. La configuración antigua permanece en `site_settings` para compatibilidad.

## Sesiones existentes

v5 mantiene el nombre de cookie `connect.sid` y la tabla `sessions`. Si se conserva el mismo `SESSION_SECRET`, las sesiones v4.3 compatibles pueden seguir siendo válidas. Un cambio de secreto o un reset de contraseña invalidará sesiones, como debe ocurrir.

## Verificación posterior

Comprueba manualmente al menos:

- login de alumno existente;
- login admin;
- catálogo;
- detalle de curso;
- matrícula existente;
- aula/progreso existente;
- pagos históricos;
- comprobante privado;
- cupón;
- certificado existente;
- generación de un certificado nuevo;
- CMS y publicación;
- backup.

## Rollback operativo

Las migraciones no eliminan el esquema v4.3, pero v5 sí añade tablas/columnas. El rollback seguro es restaurar el backup completo de v4.3 y volver a desplegar el código v4.3. No intentes "desmigrar" una base productiva manualmente.
