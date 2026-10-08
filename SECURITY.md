# Informe de seguridad — AcademiaVE 5.2.0

## Alcance y resultado

Revisión de código de v5.0.3.1, controles HTTP ejecutados, archivos privados, autenticación, CMS, configuración, dependencias y PDFs. Se corrigieron los problemas descritos abajo. No es un pentest externo ni una garantía de ausencia de vulnerabilidades.

| Área | Control entregado y comprobación |
| --- | --- |
| Sesiones | SQLite server-side, regeneración en login/registro, logout destruye sesión, session_version invalida anteriores tras reset |
| Cookies | HttpOnly, SameSite=Lax; Secure en producción mediante configuración existente |
| CSRF | Token de sesión en todas las mutaciones, incluidas auth; 403 sin token/origen incorrecto |
| Roles | Autorización admin en servidor; alumno ajeno recibe 403 en comprobantes, materiales y PDF de certificado |
| Contraseñas | Bcrypt 12, async en auth, nuevas claves ≤72 bytes; hashes existentes conservados |
| Reset | Hash SHA-256 del token, caducidad, uso único transaccional y prueba simultánea 200/400 |
| Correo | Respuesta genérica aunque falle entrega; no token en logs; SMTP local ejecutado |
| CSP | script-src self, object-src none, base/form self; sin scripts inline. style-src-attr unsafe-inline se conserva de la base para posiciones dinámicas |
| CMS | Esquema por tipo, texto plano, variantes/listas acotadas, URLs seguras, sin HTML/JS/atributos arbitrarios |
| SQL | Parámetros enlazados; opciones de orden/estados seleccionadas de listas cerradas |
| Uploads | Multer con límites, MIME/firma, bytes reales, PNG/JPEG/WebP estructural básico, dimensiones ≤40 MP y ≤16000 por lado, EOF de PDF |
| Privados | Fuera del public root, propietario/admin o matrícula exigidos; no-store/nosniff y CSP sandbox en descarga |
| URLs | Rechaza credenciales y backslash/control en navegación; Google Maps exige host/path permitidos |
| SSRF certificados | HTTPS443, DNS resuelto y fijado, bloqueo de IP reservadas/privadas IPv4/IPv6, redirects prohibidos, 10 s y 12 MiB durante lectura |
| Configuración | Valores desconocidos o inválidos no se ignoran; rollback del lote |
| Dependencias | Nodemailer actualizado a 10.0.14; npm audit final sin vulnerabilidades reportadas |
| Producción | Secreto fuerte y HTTPS/SMTP exigidos al arrancar; no se entregan secretos reales |

## Hallazgos de la base y acciones

1. CMS atrapaba el error de save y continuaba publish: corregido y reproducido con rechazo HTTP 400 desde navegador.
2. Configuración omitía claves desconocidas y convertía URLs inválidas en vacío: ahora 400 y rollback.
3. Blacklist SSRF textual no comprobaba DNS, direcciones mapeadas ni límite durante descarga: módulo dedicado con pinning de dirección.
4. Login/registro/reset no exigían CSRF explícito: se exige usando el token ya entregado por bootstrap.
5. Bcrypt podía truncar claves mayores de 72 bytes: nuevos registros/reset rechazan exceso; login de hashes anteriores no se redefine.
6. Auth pasó a hash async; el token se revalida dentro de transacción para impedir consumo doble durante la espera.
7. Firma sola y tamaño declarado de archivo eran insuficientes: bytes reales, MIME y estructura/dimensiones añadidos.
8. Nodemailer 7 presentó avisos de npm audit: actualización major validada con SMTP local. No se probaron proveedores SMTP reales.

## Límites residuales

- Rate limits son en memoria de un proceso; no distribuidos ni persistentes al reiniciar. No se ejecutó una prueba de carga/DoS.
- Validación de archivo no es un antivirus ni un saneamiento completo de PDF. PDFs subidos son documentos de terceros y no se transforman.
- Descargar una URL remota pública real no fue probado por las restricciones de red; se probaron funciones de clasificación de IP y la implementación se revisó.
- No se probaron TLS real, Secure cookie sobre navegador HTTPS real, Nginx, Docker, systemd ni configuración de un hosting.
- No hay MFA ni rediseño de permisos granulares; se mantiene admin/student.
- Verificación pública de certificado expone nombre/curso por código, como antes; configura términos/privacidad apropiados a tu negocio.
- Los ejemplos contienen credenciales claramente de desarrollo; `setup` genera aleatorias y producción rechaza el ejemplo.
- Restore presupone backup propio y servicio detenido; hashes detectan corrupción, no autentican quién creó el backup.

## Evidencias

`qa/evidence/npm-audit-before.json`, `npm-audit-after.json`, `tests.log`, `qa/browser/results.json` y lista en `docs/PRUEBAS.md`. Un resultado npm audit de cero se limita al registro consultado y fecha de ejecución (2026-10-03).


## Contratos nuevos en 5.2

Los colores de bloque admiten exclusivamente `#RRGGBB`; se rechazan funciones CSS, variables, instrucciones adicionales y URLs. La vista en vivo aplica la misma lista de propiedades y escapa todo texto. El pie reutiliza enlaces administrados con destinos seguros. Los uploads reutilizan validación binaria y autorización de administración. Tipografía, botones, radios y sombras siguen contratos acotados; se corrigieron expresiones de validación sin permitir CSS libre. La vista de sección es inerte para impedir navegación accidental.

Estos controles se probaron con casos de inyección, rollback de borrador y persistencia/publicación. Colores arbitrarios válidos pueden producir contraste insuficiente: no se afirma cumplimiento WCAG automático.
