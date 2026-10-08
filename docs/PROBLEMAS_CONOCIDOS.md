# Límites y validación pendiente — 5.3

1. Se ejecutaron 60 pruebas, comprobación de código, consulta npm audit, 175 pantallas y 17 flujos generales de Chromium, más 8 flujos y 10 capturas de vídeo/correo. No se declara ausencia absoluta de errores.
2. No se aportaron base de datos productiva, vídeos reales ni configuración privada del usuario. La migración conserva datos de la fixture anterior; el usuario debe conservar .env, BD y archivos de su instalación.
3. Vídeo propio usa disco local privado. No se incluyen R2/S3, CDN, DRM, marca de agua forense ni garantía contra descarga/captura por alumnos autorizados.
4. Un proceso de aplicación por base SQLite. La cola, límites y archivos no coordinan réplicas. El trabajador procesa un vídeo por vez.
5. Conversión y reproducción se probaron en Linux, FFmpeg real y Chromium; faltan Windows, Safari, iPhone/Android físicos y medición de carga con el catálogo real. Los límites de disco se comprueban periódicamente y requieren margen operativo.
6. Gmail SMTP funcionó según el usuario; las pruebas de esta entrega usaron SMTP local y renderizado del correo. HTML no garantiza evitar spam ni idéntica presentación en todos los clientes de correo.
7. Docker/Nginx/systemd/HTTPS se entregan como ejemplos, sin ejecutarse en este entorno. Se requiere dominio y servidor estables para publicar.
8. Subidas parciales/fallidas sin asociar caducan a las 24 horas; vídeos listos sin asociar a los 7 días. Conserva originales localmente. La compresión no siempre reduce el total si se generan varias calidades de un archivo ya comprimido.
9. Las clases en borrador no cuentan para progreso ni nuevos certificados. Añadir/retirar clases publicadas cambia el denominador del progreso; no se implementaron cohortes ni versiones de temario por matrícula. El alumno marca manualmente la finalización, sin examen ni verificación de visionado completo.
10. Certificados emitidos guardan datos y referencias de plantillas; una plantilla remota cambiada/eliminada puede alterar su reproducción. Conservar activos inmutables o PDF emitido es una mejora futura. El renderer rechaza temarios imposibles de ajustar y caracteres fuera de DejaVu en vez de recortar silenciosamente.
11. Los listados no tienen paginación general y ciertas consultas requieren optimización cuando aumente el catálogo. Cursos con precio cero y un rol docente independiente siguen fuera del alcance actual; las clases gratuitas de vista previa sí existen.
12. Respaldos/restauración requieren detener servidor y trabajador. La bandera confirm-stopped declara esa condición; no detecta procesos en otros equipos. La restauración prepara recursos y revierte errores detectados, pero no es atómica ante un corte de energía entre discos. Usa respaldos confiables y externos.
13. No se reprodujeron vídeos/mapas reales de proveedores externos ni se auditó WCAG integralmente. Los colores configurables no corrigen contraste de forma automática.
14. Configurar contenido comercial, dominio, datos bancarios, correo, privacidad/términos y validar en los dispositivos de destino sigue pendiente antes de abrir al público.
