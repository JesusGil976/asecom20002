# QA de AcademiaVE 5.3.0

Fecha: 2026-10-03. Linux, Node 24.19.0, npm 11.9.0, Chromium 153.0.8010.0. Los datos de pruebas son ficticios y viven en directorios temporales.

| Comprobación | Resultado |
|---|---|
| `npm test` | 60 aprobadas, 0 fallos, 0 omitidas |
| `npm run check` | 61 archivos JavaScript y 12 archivos estructurales válidos |
| `npm run verify:hotfix` | Versión y rutas de certificados verificadas |
| `npm audit` | 0 vulnerabilidades reportadas en esta ejecución |
| Instalación limpia | `npm ci`, check y 60 tests repetidos en una copia separada |
| Navegador | 25 rutas × 7 anchos = 175 capturas |
| Overflow horizontal global | 0 registrado |
| Errores de navegador | 0 registrados |
| PDF | Dos páginas A4 horizontal renderizadas y revisadas; extracción de temario de 150 clases |

## Flujos operados en UI

- Pago enviado mediante formulario real con cupón y comprobante PNG.
- Aprobación administrativa en UI y matrícula automática.
- Anterior/siguiente y completada/pendiente en UI; emisión del certificado tras completar seis clases.
- Nueva clase abre sin error; modales etiquetados y Escape cierra.
- Certificados: flechas, arrastre, guardado, reverso, negrita+cursiva y PDF ficticio.
- CMS: reordenamiento por botón y guardado del borrador.
- CMS: publicación bloqueada tras rechazo del guardado (HTTP 400 simulado).
- Mostrar/Ocultar integrado, accesible y reversible.
- Filtros de precio, contador, URL y limpieza de catálogo.
- Carrusel móvil operado con teclado y dots.
- Tema: vista local sin publicar, guardado de botones y persistencia.
- Editor de navegación: añadir, quitar y guardar enlaces.
- CMS: texto y colores en vista en vivo, subida de imagen y borrador.
- CMS: publicación real con pie de página sin duplicar footer; otras rutas conservan su pie.
- Menú móvil: abre, tecla normal seguida de Escape cierra.
- Registro, logout y login por formularios reales; destino next interno respetado.
- Logout destruye la sesión.

## Matriz

Anchos: 360, 390, 414, 768, 1024, 1280 y 1440 px. Se verificaron las siguientes rutas en todos los anchos:

| Ruta | Anchos |
|---|---|
| `/` | Los siete |
| `/catalogo` | Los siete |
| `/curso/qa-course` | Los siete |
| `/login` | Los siete |
| `/registro` | Los siete |
| `/recuperar` | Los siete |
| `/reset-password?token=demo` | Los siete |
| `/privacidad` | Los siete |
| `/terminos` | Los siete |
| `/dashboard` | Los siete |
| `/pago?course=ia` | Los siete |
| `/aula/qa-course` | Los siete |
| `/certificado/AVE-2026-8B176303BF` | Los siete |
| `/admin/resumen` | Los siete |
| `/admin/usuarios` | Los siete |
| `/admin/pagos` | Los siete |
| `/admin/cursos` | Los siete |
| `/admin/cms` | Los siete |
| `/admin/sedes` | Los siete |
| `/admin/cupones` | Los siete |
| `/admin/certificados` | Los siete |
| `/admin/configuracion` | Los siete |
| `/admin/diseno` | Los siete |
| `/admin/auditoria` | Los siete |
| `/?preview=1` | Los siete |

## Inspección visual

Se revisaron los siete mosaicos, la portada, acceso desktop/móvil, CMS, catálogo móvil y ambos renders del certificado. El catálogo móvil prioriza cursos y ofrece filtros en un desplegable; el formulario de acceso conserva Mostrar/Ocultar dentro del campo. El pie de Inicio sustituye al global sin duplicar los enlaces legales. Se revisaron estados de modal, botón, foco y páginas con nombres/títulos largos.

El control automático de scrollWidth complementa la revisión visual. Tablas/carruseles/navegación administrativa usan desplazamiento interno intencional. No se afirma ausencia de problemas para cualquier contenido configurado ni certificación de accesibilidad.

## Evidencias y reproducción

- `qa/evidence/`: tests, sintaxis, compatibilidad, npm audit y logs de instalación limpia/navegador.
- `qa/browser/results.json`: geometría, flujos y errores de la ejecución final.
- `qa/index.html`: galería de 185 capturas completas.
- `qa/contact-sheets/`: siete mosaicos de revisión.
- `qa/browser/preview.pdf`, `certificate.pdf` y `qa/pdf/`: PDFs ficticios y renders.
- `scripts/qa-browser.cjs`: automatización de UI real con datos temporales.
- `scripts/qa-gallery.py`: galería; Pillow opcional para los mosaicos.

La lista exacta de 60 pruebas está en `docs/PRUEBAS.md`. El recorrido de navegador contiene 17 grupos de flujos, además de la matriz de capturas.

## Pruebas no realizadas

No se recibió BD productiva: se verificaron fixtures del esquema original y conservación de filas/hashes. No se ejecutaron Docker, Nginx, systemd, HTTPS público, hosting remoto o un proveedor SMTP externo. El reset se probó con SMTP local. No se probaron Safari/Firefox, iPhone/Android físicos, lector de pantalla, carga concurrente sostenida ni integraciones de vídeo/Maps o plantilla remota contra sus servidores externos. Estos límites se mantienen explícitos en `docs/PROBLEMAS_CONOCIDOS.md`.


## Vídeo propio y correo HTML (5.3)

`npm run test:video-browser` ejecuta ocho flujos adicionales sobre datos temporales: subida por partes desde el editor, conversión real, previsualización privada, publicación con subtítulos, reproducción con calidad/velocidad/búsqueda/reanudación, orden de clases, bloqueo anónimo y vista gratuita, y correo HTML. Se generaron diez capturas: aula y editor en 360/390/768/1440 px, y correo en 390/768 px. Resultados: qa/video/results.json; cero errores de consola y sin desbordamiento global. La matriz general de 175 pantallas y 17 flujos se volvió a ejecutar en esta versión, también sin errores ni desbordamiento global.

Fixture de 12 segundos: original 9.690.949 bytes; HLS 720p y 480p 2.642.032 bytes. Es una medición de esa muestra, no una garantía de compresión de cualquier vídeo. HLS.js 1.7.3 se distribuye localmente con su licencia. FFmpeg y ffprobe reales se ejecutaron en Linux. Safari, teléfonos físicos y Windows siguen pendientes de prueba en el entorno del usuario. SMTP real Gmail fue confirmado previamente por el usuario; en esta entrega se volvió a probar SMTP local y se renderizó la nueva plantilla, sin enviar correo a su cuenta.
