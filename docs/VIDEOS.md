# Vídeos propios — diseño y operación 5.3

## Contrato

Sólo administración sube vídeos. Los alumnos obtienen reproducción de clases publicadas en cursos donde tengan matrícula; las clases gratuitas sólo son públicas cuando el curso y la clase están publicados. Los matriculados conservan acceso a cursos archivados, como en la versión anterior. Administradores pueden previsualizar sus activos listos antes de asociarlos/publicarlos.

`video_assets` conserva ID aleatorio, clase, administrador, nombre original sólo informativo, tamaños, duración, estado y error. El almacenamiento real usa `<privateUploadDir>/videos/<id>`, independiente del nombre enviado y del equipo anterior. `lessons.video_asset_id` selecciona un activo listo que pertenezca a la clase. `video_url` sigue disponible; al elegir un activo propio se borra la URL externa. No hay almacenamiento binario dentro de SQLite.

## Subida y procesamiento

- Inicio JSON autorizado y con CSRF: POST `/api/admin/videos/uploads`, `{lessonId,name,size}`. La clase debe estar en borrador.
- Datos en fragmentos de hasta 4 MiB: PUT `/api/admin/videos/uploads/:id/chunk`, Content-Type application/octet-stream, X-CSRF-Token y Upload-Offset. El buffer en memoria es por fragmento, nunca el archivo completo. Los fragmentos son secuenciales y hay exclusión por subida.
- Reanudación: GET `/api/admin/videos/uploads/:id` devuelve receivedBytes. El siguiente fragmento debe comenzar en ese offset; uno repetido se rechaza, evitando duplicación. Se sincroniza disco antes de avanzar el estado.
- Finalización: POST `/api/admin/videos/uploads/:id/finish`. Requiere haber recibido el tamaño declarado. El servidor pone el activo en cola.
- Un trabajador Node separado procesa un vídeo por vez y lanza ffprobe/FFmpeg con argumentos, sin shell. Se valida contenedor y metadatos reales, se limita duración/resolución/tiempo, se excluyen protocolos de red y se desactivan referencias externas de MOV. No se aceptan listas HLS como archivos de entrada.
- FFmpeg genera H.264/AAC, segmentos de 6 segundos y lista HLS de varias calidades. Usa un hilo de conversión por comando. No se conserva el original después de una conversión correcta. Las calidades no se amplían por encima de la altura detectada en la fuente.
- Estados: uploading → queued → processing → ready o failed. Ante una parada controlada, el trabajo interrumpido vuelve a la cola; al reiniciar se recuperan trabajos processing. Mantén un solo proceso de aplicación por base de datos: la cola no implementa coordinación entre réplicas.

Se admiten hasta cinco activos pendientes globales. Al comenzar se comprueban tamaño, cuota y espacio libre, reservando de forma contable tres veces el tamaño de entrada. Durante conversión se comprueba periódicamente espacio y tamaño; una conversión puede exceder temporalmente el límite entre comprobaciones. Ajusta cuotas conservando margen para sistema operativo, respaldos y base de datos.

Los archivos falsos, ilegibles o fuera de límites quedan en error y no pueden asociarse. Instalar FFmpeg no sustituye mantenerlo actualizado: procesa archivos con un usuario sin privilegios y límites de recursos del sistema cuando despliegues.

## Reproducción y privacidad

GET y HEAD `/api/videos/:lessonId/master.m3u8`, variantes y segmentos comprueban sesión y matrícula en cada solicitud. Sólo se permiten nombres generados de listas, segmentos y captions.vtt, sin acceso al original. No hay credenciales en URLs ni enlaces públicos al almacenamiento privado. Las respuestas usan `private, no-store`, `Vary: Cookie` y nosniff. No configures un proxy/CDN para cachearlas públicamente.

HLS.js 1.7.3 está incluido localmente bajo `public/assets/vendor` con su licencia Apache-2.0; no depende de un CDN. Safari/dispositivos Apple pueden usar HLS nativo; otros navegadores con MSE usan HLS.js. El CSP mantiene scripts propios y permite el blob de MediaSource; el reproductor usa HLS.js sin trabajador blob.

La posición se guarda cada 15 segundos, al pausar y al salir, con autenticación, matrícula, CSRF y validación frente a la duración. Se conserva en lesson_progress y no marca automáticamente la clase completada. Los subtítulos WebVTT se suben en borrador y se sirven con el mismo control de acceso del vídeo.

HLS divide el vídeo y permite calidad adaptable; **no impide que un alumno autorizado descargue/reconstruya los fragmentos**. controlsList=nodownload sólo modifica la interfaz. No se implementó DRM, marca de agua forense ni restricción por IP. El cierre de sesión y retirada de matrícula impiden nuevas solicitudes, sin recuperar lo ya almacenado en el reproductor.

## Limpieza y respaldo

Retirar un activo sólo es posible si no está asociado ni convirtiéndose. Eliminar una clase deja sus activos sin clase y los retira en mantenimiento; activos en conversión esperan a terminar. Las subidas incompletas/fallidas sin uso vencen a las 24 horas y los activos listos sin asociar a los 7 días. El mantenimiento inicia con el servidor y se repite cada hora. Reemplazar PDF retira los anteriores sin referencias; eliminar la clase retira sus PDF.

El respaldo incluye todas las carpetas privadas, incluidos HLS y subidas pendientes, y las públicas. Los hashes se calculan por flujo, evitando cargar vídeos enteros en RAM. La restauración verifica manifiesto e integridad y prepara carpetas completas antes de sustituirlas; conserva las anteriores y revierte cambios si detecta un error durante la sustitución. Servidor y trabajador deben estar detenidos. Los hashes sirven para integridad, no para acreditar la procedencia de un respaldo.

## Coste y evolución

El almacenamiento implementado es disco privado local. No se incluye integración R2/S3, CDN de vídeo, servicio de conversión externo ni DRM. Los límites se configuran en .env, no asignan un disco independiente a los alumnos. Para reducir costes iniciales puedes conservar sólo 720p y ajustar CRF después de revisar una clase real; las clases con texto fino requieren más calidad que una cámara hablando.

Las mejoras futuras pueden añadir almacenamiento de objetos privado, trabajador dedicado, módulos, rol docente, evaluaciones y políticas de sesiones concurrentes. Deben medir uso real y conservar el control de autorización de todos los recursos.
