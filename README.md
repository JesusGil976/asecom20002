# AcademiaVE 5.3.0

Versión con vídeos propios privados, clases en borrador, subida reanudable y correo HTML de recuperación, sobre la reconstrucción visual y CMS de **5.2**. Compatible con datos de **v5.0.3.1–5.2**. Los cambios de esta entrega se realizaron después de la auditoría aprobada. Express 5, SQLite, sesiones server-side y frontend con módulos ES. No necesita un bundler para arrancar. Los informes y las evidencias están en `docs/` y `qa/`.

## Vídeos y actualización rápida

Lee primero `LEEME-v5.3.md` y `docs/VIDEOS.md`. La migración conserva la visibilidad de clases existentes; las nuevas empiezan en borrador. Los vídeos se guardan bajo el almacenamiento privado y deben trasladarse con la base de datos al publicar. No contiene tus cursos ni vídeos reales: debes conservar los datos de tu instalación y cargar tu contenido.

## Instalación limpia

Usa Node.js 24 LTS, npm y **FFmpeg/ffprobe** para vídeos propios. El motor de paquetes mantiene `>=20`; esta entrega se ejecutó con Node 24.19.0. En plataformas sin un binario precompilado de better-sqlite3, instala Python 3, make y compilador C++ (Windows: herramientas de compilación de Visual Studio).

```bash
npm ci
npm run setup
npm run migrate
npm start
```

Abre **http://localhost:3000**. `npm run setup` crea `.env` con un secreto de sesión y contraseña administrativa aleatorios. Consulta `ADMIN_EMAIL` y `ADMIN_PASSWORD` en ese archivo para el primer acceso. Nunca ejecutes setup encima de una instalación existente; el script tampoco sobrescribe `.env`.

Una instalación sin cursos crea los cursos de demostración de la base original. La tasa inicial es 0: configuración administrativa debe guardar una tasa positiva antes de aceptar pagos. No se crean usuarios de QA en tu instalación: los fixtures viven únicamente en directorios temporales de las pruebas.

Para desarrollo:

```bash
npm run dev
```

Usa el mismo origen que `PUBLIC_URL` (incluidos hostname y puerto). Cambia esa variable si abres otro host. Tras cambiar `.env`, reinicia el proceso.

## Actualización desde v5.0.3.1, 5.1 o 5.2

1. Detén el servidor anterior y guarda una copia completa de su carpeta, `.env`, base SQLite y uploads. No reemplaces `data/` ni `public/uploads/` con los directorios vacíos del ZIP.
2. Extrae esta versión en una carpeta nueva. Copia tu `.env`; ajusta rutas absolutas según el ejemplo siguiente. **No ejecutes `npm run setup`** en una actualización.
3. Conserva la base, archivos privados y todas las imágenes/plantillas públicas. Puedes apuntar directamente a las carpetas persistentes anteriores o copiarlas íntegramente a una nueva ruta persistente.
4. Ejecuta `npm ci`, `npm run migrate`, `npm test` y `npm start` desde la carpeta nueva.
5. Comprueba login, tasa, comprobantes, matrícula y un certificado existente antes de retirar el respaldo.

```dotenv
DATA_DIR=/var/lib/academiave
DB_FILE=/var/lib/academiave/academy.sqlite
PUBLIC_UPLOAD_DIR=/var/lib/academiave/public
```

Coloca los comprobantes/PDFs en `DATA_DIR/uploads/private`; coloca el contenido completo del antiguo `public/uploads` en `PUBLIC_UPLOAD_DIR`. Al descargar archivos privados, se busca primero `stored_name` en la ruta actual; si falta, se mantiene la ruta histórica guardada en la BD como compatibilidad. El backup estándar cubre las rutas configuradas: si todavía tienes archivos históricos fuera de ellas, intégralos a la carpeta privada por `stored_name` antes del backup o respáldalos aparte.

La migración `003_v51_certificates` añade `snapshot_json` e índices. No elimina tablas, usuarios, contraseñas, pagos ni CMS. Guarda el estado actual de los certificados existentes al actualizar: no puede reconstruir un diseño histórico ya cambiado antes de esta versión. Las plantillas configuradas y posiciones existentes se conservan.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| NODE_ENV | `development` para desarrollo; `production` exige configuración segura |
| PORT | Puerto HTTP, por defecto 3000 |
| PUBLIC_URL | Origen canónico; HTTPS obligatorio en producción |
| SESSION_SECRET | Secreto persistente de al menos 32 caracteres en producción |
| TRUST_PROXY | 0 directo; 1 únicamente detrás de un proxy de confianza |
| ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME | Creación inicial del administrador; no cambian una cuenta existente |
| DATA_DIR, DB_FILE | Carpeta persistente y archivo SQLite |
| PUBLIC_UPLOAD_DIR | Imágenes y plantillas persistentes; por defecto `public/uploads` |
| EXCHANGE_RATE | Valor inicial; después se administra en BD desde Configuración |
| PAYMENT_BANK, PAYMENT_PHONE, PAYMENT_DOCUMENT | Datos iniciales de Pago Móvil |
| MAIL_HOST, MAIL_PORT, MAIL_SECURE | Servidor SMTP, puerto y TLS implícito (`true` usualmente en 465) |
| MAIL_USER, MAIL_PASSWORD, MAIL_FROM | Autenticación SMTP y remitente |
| MAX_RECEIPT_BYTES, MAX_IMAGE_BYTES, MAX_PDF_BYTES | Límites de bytes para subidas |
| LOG_LEVEL | `debug`, `info`, `warn`, `error` |

En producción se exige SESSION_SECRET fuerte, PUBLIC_URL HTTPS, ADMIN_PASSWORD de al menos 12 caracteres distinto del ejemplo y MAIL_HOST/MAIL_USER/MAIL_PASSWORD. El secreto debe permanecer estable entre reinicios para conservar las sesiones.

No incluyas `.env`, datos reales ni backups en un repositorio público. `ADMIN_PASSWORD` sólo se usa al crear la cuenta inicial; cambiarla en `.env` no cambia la contraseña en la BD. Utiliza recuperación por correo para una cuenta existente.

## Correo y recuperación

Configura un SMTP real y un remitente autorizado. La respuesta de recuperación es genérica tanto si existe el usuario como si no. Los tokens se guardan como hash, expiran en 30 minutos y sólo pueden consumirse una vez, incluso con solicitudes simultáneas. Reset incrementa `session_version`, invalidando todas las sesiones anteriores.

En desarrollo sin SMTP no se envía correo ni se publica el token en logs. En producción un fallo de envío registra `password_reset_delivery_failed`; la respuesta pública sigue siendo genérica para no revelar cuentas. Revisa la monitorización del correo. Se comprobó SMTP local de pruebas, no un proveedor externo.

Nuevas contraseñas: mínimo 8 caracteres, máximo 72 bytes UTF-8 para evitar truncamiento de bcrypt. El login conserva compatibilidad con hashes existentes.

## Administración, cursos y aula

El panel conserva resumen, usuarios, pagos, cursos/clases, CMS, sedes, cupones, certificados, configuración, diseño y auditoría. La navegación lateral se adapta a una barra desplazable en móvil. Las tablas tienen desplazamiento propio cuando lo necesitan.

Los cursos soportan borrador, publicado y archivado. Archivar retira el curso del catálogo, pero conserva el aula para quienes ya tienen matrícula. Las clases incluyen texto, vídeo, imagen, PDF privado y preview opcional. El aula mantiene anterior/siguiente, temario móvil, marcar completada/pendiente y certificado al completar el curso.

URLs de YouTube/Vimeo se convierten a embeds permitidos. Otros vídeos se abren como enlace seguro. Los PDFs de materiales requieren matrícula o rol admin; una clase gratuita no vuelve públicos todos los materiales privados del curso.

## Pagos y cupones

Configura banco, teléfono, documento y tasa desde Configuración. El checkout consulta `/api/payments/quote` y muestra USD/Bs y descuento antes de reportar el pago. El servidor vuelve a calcular importes al recibirlo: nunca confía en montos enviados por el cliente.

La tasa y montos se guardan en cada pago. Cambiar la tasa no recalcula pagos históricos. Referencias repetidas, pagos pendientes del mismo alumno/curso y matrículas existentes se rechazan. Aprobación y matrícula se realizan en una transacción; aprobar dos veces devuelve 409. Rechazar requiere motivo y no crea matrícula.

Los comprobantes se guardan fuera del directorio público. Se admiten PNG/JPEG/WebP/PDF conforme a firma y límites; la interfaz ofrece PNG/JPEG/PDF. El comprobante sigue siendo opcional, como en la versión base. Los cupones soportan porcentaje o monto fijo, activación, expiración y límite de usos. Se conserva la semántica original: el uso se consume al reportar un pago, incluso si después se rechaza.

El dashboard muestra los últimos cinco pagos, su estado, motivo de rechazo y comprobante privado. Administración dispone del listado completo.

## CMS y Design System

Bloques permitidos: hero, cursos destacados, estadísticas, proceso, nosotros, sedes, testimonios, CTA y texto. Se valida el esquema específico de cada tipo. No hay HTML/JS arbitrario, iframes configurables por bloque ni atributos arbitrarios.

Borrador y publicación son distintos. Guarda el borrador, abre preview administrativo, revisa y publica. Si el servidor rechaza el guardado, la UI no intenta publicar. Reordena por arrastre o con botones subir/bajar; configura variantes, imágenes, columnas, espaciado, alineación, visibilidad móvil y animación ligera. La preferencia de movimiento reducido desactiva animaciones.

Diseño conserva tokens en BD: colores, tipografía, radios, ancho, sombras y densidad. Los cambios se validan y aplican por variables CSS. Una configuración inválida revierte el lote completo y devuelve un error, en vez de simular un guardado.

## Certificados y editor visual

A4 horizontal, dos páginas. Sube un **diseño limpio** PNG/JPEG de frente y reverso. La imagen contiene todo el diseño estático; la plataforma superpone sólo campos dinámicos, sin rectángulos blancos. La imagen se ajusta con `contain`, conservando proporción y contenido completo. Si no tiene proporción A4, habrá márgenes en vez de recortes.

Frente: alumno, curso, duración, fecha y código. Reverso: clases, duración y código. Cada campo permite X/Y/ancho/alto en porcentaje, tamaño en puntos PDF, color, alineación, normal/negrita/cursiva/negrita+cursiva y visibilidad.

Selecciona un campo, arrástralo o usa las flechas (Shift: paso de 1%; normal: 0.1%). Edita propiedades y guarda posiciones. «Ver PDF de prueba» guarda las posiciones y usa datos ficticios. «Restaurar recomendados» restaura posiciones; no cambia las imágenes. «Guardar URLs» y «Guardar posiciones» son acciones separadas.

El PDF ajusta texto y divide palabras largas. Para temarios extensos prueba de una a cuatro columnas y un mínimo de 7 puntos. Si no cabe todo, devuelve 422 con instrucciones de ajuste; no omite títulos. Se probaron 150 clases cortas, no una capacidad fija para cualquier longitud de título.

Las fuentes DejaVu se incluyen con licencia. Cubren español y muchos caracteres Unicode; no todos los alfabetos. Caracteres ausentes producen error explícito. Los certificados nuevos guardan snapshot de nombre, curso, duración, temario, layout y URLs de plantilla. Editar el curso o layout después no cambia el certificado emitido. Conserva los archivos antiguos: no reemplaces manualmente una imagen en la misma URL.

Instalación limpia usa nuevas plantillas; actualización conserva las anteriores, incluidas las imágenes demo originales. Si una plantilla antigua ya contiene un nombre impreso, sube un diseño limpio: no se borra ese texto mediante un fondo blanco.

Plantillas remotas: HTTPS, puerto 443, sin redirecciones, IP pública tras resolución DNS fijada para la conexión, límite de 12 MiB y 10 segundos. Es preferible subirlas localmente; disponibilidad de servidores remotos no está garantizada.

## API y CSRF

Clientes externos deben solicitar primero `GET /api/auth/me`, conservar cookie y mandar el `csrfToken` devuelto en `X-CSRF-Token` para todas las mutaciones, incluidos registro, login, forgot y reset. Login/regeneración devuelven un token nuevo. En multipart, el token se envía como cabecera.

API: `Cache-Control: private, no-store`. Roles, sesiones, origen y CSRF se comprueban en servidor; esconder un botón no sustituye autorización. Los parámetros de consulta se enlazan mediante sentencias preparadas.

## Backup y restauración

Con el servicio detenido para coherencia entre BD y archivos:

```bash
npm run backup -- --confirm-stopped
```

El script usa la API de backup de SQLite y copia uploads privados/públicos, generando `manifest.json` con tamaños y SHA-256. Los hashes se calculan por flujo para admitir vídeos grandes. **Detén servidor y procesamiento de vídeos** para un conjunto coherente BD + archivos. `.env` se respalda aparte; guarda los backups en otro dispositivo.

Para restaurar, configura `.env` con rutas destino, detén el servicio y ejecuta:

```bash
npm run restore -- /ruta/al/backup --confirm-stopped
npm run migrate
npm start
```

Restore verifica manifiesto e integridad SQLite, prepara todos los recursos y sustituye carpetas completas sin conservar archivos sobrantes. Guarda las copias anteriores junto a cada ruta con sufijo `.restore-*-previous` y revierte los cambios ante errores detectados durante la sustitución. No elimines esa copia hasta verificar el resultado. `--confirm-stopped` es una declaración del operador; el script no detecta procesos remotos ni garantiza una restauración transaccional del sistema de archivos.

## Producción

Se incluyen `Dockerfile`, `compose.yaml`, ejemplo Nginx y unidad systemd en `deploy/`. Configura HTTPS y dominio reales, SMTP, credenciales, datos bancarios y textos de privacidad/términos antes de publicar.

El contenedor usa volúmenes separados para `/data` y `/uploads`, usuario sin privilegios y health check. El puerto se expone en loopback para el proxy. `TRUST_PROXY=1` sólo es correcto si existe exactamente el proxy de confianza delante. En systemd usa `DATA_DIR=/var/lib/academiave` y `PUBLIC_UPLOAD_DIR=/var/lib/academiave/public`, y crea ese directorio con permisos del usuario `academiave`.

```bash
docker compose up --build -d
```

La configuración se entrega preparada, pero **Docker, Nginx, TLS y systemd no se ejecutaron en este entorno**. Health `/api/health` confirma proceso y versión; no comprueba entrega SMTP ni integridad de todo el almacenamiento.

## Pruebas

```bash
npm run check
npm test
npm audit
npm run verify:hotfix
npm run check:video
```

Resultado de la entrega: **60 pruebas, 60 pass, 0 fail, 0 skipped**. `verify:hotfix` conserva su nombre por compatibilidad y verifica versión actual/rutas del editor. Lista exacta: `docs/PRUEBAS.md`.

QA opcional de navegador, en una copia de trabajo:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

Repite `npm ci` al terminar si quieres volver al conjunto de dependencias de producción. `CHROMIUM_PATH` y `PLAYWRIGHT_MODULE` permiten usar un navegador y Playwright ya instalados. QA usa datos temporales y no tu instalación real.

Se ejecutó Chromium 153: 25 rutas × 7 tamaños = 175 capturas. Anchos: 360, 390, 414, 768, 1024, 1280 y 1440 px. Resultados en `qa/browser/results.json`; abre `qa/index.html` para revisarlas. Los desplazos horizontales intencionales de tablas/carruseles/nav no se consideran overflow global. No se probaron dispositivos físicos ni otros motores de navegador.


## Nuevo producto y CMS en 5.2

La interfaz usa una identidad editorial con verde profundo, superficies claras y navegación simple. Una instalación nueva adopta el nuevo tema. Al actualizar se conservan los colores, tipografía y textos configurados; puedes cambiarlos desde Diseño. No se sobrescriben preferencias guardadas para imponer una marca nueva.

- `public/assets/css/tokens.css`: paleta, tipografía, escala de espaciado, radios, transiciones y densidad.
- `public/assets/css/product.css`: composiciones de portada, acceso, aprendizaje, administración y CMS.
- `public/assets/css/app.css`: reglas de componentes y compatibilidad responsive, con colores referenciados a tokens.
- `public/assets/js/home.js`: renderer de componentes compartido por Inicio y vista en vivo del CMS.
- `public/assets/js/navigation-editor.js`: editor de enlaces de cabecera/pie, visibilidad y orden.

En **Páginas / CMS**, selecciona una sección y edita su contenido. La vista de sección se actualiza sin guardar ni publicar. Fondo, texto y acento aceptan exclusivamente colores hexadecimales de seis dígitos; un campo vacío hereda el tema global. Hero y Nosotros admiten URL o upload de imagen. Puedes añadir un bloque **Pie de página**, reordenarlo y elegir columnas o variante mínima: cuando está visible en Inicio sustituye el pie global de esa ruta. En las demás rutas se mantiene el pie global.

El borrador no cambia el sitio público hasta pulsar Publicar. La vista completa abre el borrador guardado y permite comprobar los anchos reales. La vista de sección es una referencia de composición, no una emulación completa de dispositivos ni un editor WYSIWYG. Los colores personalizados requieren comprobar contraste antes de publicar.

En **Diseño** puedes cambiar tipografía, densidad, radios, sombra y estilo de botones (redondeado, píldora o recto). La vista rápida del formulario es local hasta guardar. Se corrigió la validación de radios/ancho/sombra, incluida la sombra inicial con desplazamiento `0` sin unidad. El tema guardado se aplica globalmente.

En **Configuración → Navegación** puedes añadir, eliminar, ocultar y ordenar hasta 30 enlaces seguros. Las etiquetas, destinos y ubicación son editables. Recarga la página para actualizar la cabecera y el pie tras guardar.

El catálogo ofrece búsqueda, categoría, nivel, orden y rango de precio; los filtros se guardan en la URL. En teléfono/tablet el panel de filtros se abre mediante un control desplegable para dar prioridad a los cursos. El dashboard muestra cifras reales de matrículas, cursos completados y certificados, además de pagos y recomendaciones. Mostrar/Ocultar contraseña está integrado en el input, incluido el campo de confirmación del reset.
