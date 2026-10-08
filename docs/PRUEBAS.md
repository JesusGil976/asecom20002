# Pruebas ejecutadas — 5.3.0

60 pruebas automatizadas, 60 aprobadas, 0 fallos, 0 omitidas. `npm test`; repetidas tras `npm ci` en copia separada. Logs completos en `qa/evidence/`.

1. backup y restore verifican hashes y preservan datos y archivos en otra ruta.
2. layout de certificado conserva sólo campos y propiedades permitidas.
3. layout se persiste como JSON y puede restaurarse.
4. PDF conserva 150 clases completas en dos páginas A4; Unicode funciona.
5. PDF rechaza temario imposible de alojar y caracteres ausentes, sin recorte silencioso.
6. SSRF rechaza redes reservadas, IPv6 local y direcciones mapeadas.
7. enlaces seguros rechazan redirects con backslash y credenciales.
8. CMS aplica esquema por tipo y bloquea HTML, URLs y claves arbitrarias.
9. upload rechaza firma incompleta, MIME falseado y tamaño real excedido.
10. ajuste de certificado divide palabras largas y falla sin omitir contenido.
11. visibilidad false y estilo negrita+cursiva sobreviven al saneado.
12. campos ampliados permanecen dentro de A4 aun sin coordenadas explícitas.
13. health check público.
14. administración guarda Pago Móvil y tasa de cambio.
15. registro, permisos, pago, aprobación, progreso y certificado.
16. CMS crea borrador, guarda secciones y publica versión.
17. reset de contraseña usa hash, expira y eleva session_version.
18. actualización desde esquema v5.0.3.1 conserva filas, hashes y vuelve a migrar sin cambios.
19. CMS mantiene borrador privado y publica colores y pie seguros con historia intacta.
20. CMS rechaza CSS inyectado y revierte la sección completa conservando borrador.
21. diseño conserva temas existentes y valida estilo, densidad y tipografía sin CSS arbitrario.
22. rechaza protocolos peligrosos.
23. Google Maps solo acepta hosts permitidos.
24. normaliza entradas básicas.
25. detecta archivos por firma y no por extensión.
26. configuración administrativa permite guardar Pago Móvil y tasa.
27. configuración administrativa permite persistir plantillas de certificado.
28. rechaza una tasa de cambio inválida.
29. server.js arranca instalación limpia, responde health y cierra limpiamente.
30. producción rechaza secretos predeterminados antes de abrir el servidor.
31. header móvil agrupa CTA principal y menú en el extremo derecho.
32. aula ofrece navegación anterior y siguiente y barra móvil accesible.
33. QA responsive cubre teléfono pequeño, teléfono estándar, tablet y evita overflow global.
34. editor de certificados permite posicionar campos sobre frente y reverso.
35. CSRF se exige incluso en login; origen y CSP no se debilitan.
36. configuración inválida revierte el lote y no devuelve guardado falso.
37. cupón porcentual, cotización y pago multipart con comprobante privado.
38. pago pendiente bloquea duplicados; aprobación única matricula y conserva tasa histórica.
39. PDF de clase sólo lo lee administración o un matriculado; bytes incorrectos se rechazan.
40. progreso reversible, certificado a dos páginas y snapshot histórico.
41. archivar retira del catálogo y conserva aula del alumno matriculado.
42. CMS inválido no cambia borrador; preview privado y publish persiste contenido válido.
43. cupón fijo, expiración, desactivación y rechazo sin matrícula.
44. preview libre no revela clases privadas y subida admin exige rol.
45. cookies HttpOnly y SameSite; contraseñas mayores a 72 bytes no se truncan.
46. recuperación entrega correo SMTP local; token único invalida todas las sesiones.
47. reset expirado y dos solicitudes paralelas sólo permiten un uso.

48. correo de recuperación incluye botón, alternativa de texto, vencimiento y marca escapada.
49. clase nueva queda en borrador: catálogo, aula, progreso y PDF no la exponen.
50. subida exige rol y CSRF, límites de tamaño y una clase propia en borrador.
51. fragmentos reanudan en offset exacto y no aceptan datos de otra cuenta ni exceso.
52. no se publica mientras existe una subida pendiente.
53. trabajador real convierte a HLS con dos calidades, guarda estado y elimina original.
54. subtítulos se validan y se mantienen privados; publicación conserva vídeo seleccionado.
55. manifiesto, variantes, segmentos, HEAD y subtítulos comprueban matrícula en cada petición.
56. posición se guarda por alumno, limita duración y no habilita completar por reproducción.
57. retirar matrícula, cerrar sesión y pasar a borrador revoca nuevas solicitudes.
58. vista gratuita permite sólo clases publicadas y se cierra al archivar curso.
59. archivo falso falla en procesamiento, no se puede asociar y puede retirarse.
60. asociar activo de otra clase se rechaza; eliminar clase retira sus vídeos físicos.

Las comprobaciones estáticas de responsive se mantienen compatibles con código formateado. La evidencia principal de geometría y flujo es el navegador real, descrita en QA.
