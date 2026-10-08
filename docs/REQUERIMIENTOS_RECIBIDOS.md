Quiero que actúes como un equipo senior completo compuesto por:

- arquitecto de software
- desarrollador backend
- desarrollador frontend
- diseñador UX/UI
- especialista en seguridad
- especialista en bases de datos
- especialista en producto
- ingeniero QA
- especialista en accesibilidad
- especialista en DevOps

Te adjunto:

1. **AcademiaVE v5.0.3.1**, que es actualmente la versión funcional más avanzada de mi plataforma.
2. **El prompt maestro original del proyecto**, que contiene los requisitos funcionales y de negocio.

## REGLA FUNDAMENTAL

**AcademiaVE v5.0.3.1 es ahora el punto de partida oficial.**

No quiero que vuelvas a reconstruir desde v4.3 ni que ignores el trabajo realizado posteriormente.

Debes:

- auditar completamente v5.0.3.1;
- conservar todo lo que funciona correctamente;
- corregir errores existentes;
- mejorar arquitectura, código, UX, UI, seguridad, responsive y mantenibilidad;
- completar funciones parcialmente implementadas;
- encontrar problemas que yo todavía no haya detectado;
- ejecutar y probar realmente la aplicación siempre que el entorno lo permita.

El prompt maestro sigue definiendo las reglas de negocio y objetivos globales, pero cuando exista una diferencia entre una implementación antigua y v5.0.3.1, debes estudiar primero v5.0.3.1 y conservar la evolución correcta que ya exista.

---

# 1. FORMA DE TRABAJO

Quiero aprovechar **ChatGPT Work** precisamente para evitar una reconstrucción basada solamente en lectura estática.

Utiliza tu entorno de trabajo para realizar el ciclo completo:

**Auditar → Planificar → Modificar → Instalar → Ejecutar → Navegar → Probar → Corregir → Volver a probar → Entregar**

No te limites a leer código y decir que debería funcionar.

Siempre que el entorno lo permita:

- descomprime el proyecto;
- instala las dependencias;
- crea una configuración de desarrollo segura;
- ejecuta las migraciones;
- arranca el servidor;
- abre la aplicación;
- prueba las rutas;
- prueba las APIs;
- prueba visualmente las pantallas;
- utiliza distintos tamaños de viewport;
- reproduce los flujos reales;
- revisa la consola del navegador;
- revisa logs del backend;
- corrige errores;
- vuelve a ejecutar las pruebas.

Si algo no puede ejecutarse por una limitación real del entorno, indícalo claramente. Nunca inventes que una función fue comprobada.

---

# 2. NO QUIERO UNA REESCRITURA CIEGA

No elimines código funcional únicamente porque prefieras otra tecnología.

Antes de reemplazar una parte importante responde internamente:

1. ¿Está funcionando?
2. ¿Tiene problemas de seguridad?
3. ¿Tiene problemas de mantenibilidad?
4. ¿Existe una mejora suficientemente importante que justifique sustituirla?
5. ¿La sustitución puede introducir regresiones?

Conserva las reglas de negocio.

Puedes reconstruir implementación, arquitectura o UI cuando exista una razón técnica clara.

---

# 3. DATOS

La aplicación debe funcionar:

### A. Como instalación nueva

Debe poder arrancar sin una base anterior.

### B. Como actualización

Debe poder conservar una instalación existente sin destruir:

- usuarios;
- contraseñas;
- cursos;
- clases;
- matrículas;
- progreso;
- pagos;
- comprobantes;
- cupones;
- certificados;
- CMS;
- diseño;
- sedes;
- configuración.

No hagas migraciones destructivas.

Mantén SQLite como opción funcional actual, pero evita decisiones que imposibiliten PostgreSQL en el futuro.

---

# 4. FUNCIONES QUE YA EXISTEN Y DEBEN CONSERVARSE

Debes verificar y conservar al menos:

- registro;
- login;
- logout;
- sesiones server-side;
- recuperación de contraseña;
- invalidación de sesiones;
- cursos;
- clases;
- previews;
- catálogo;
- dashboard;
- matrículas;
- progreso;
- aula;
- Pago Móvil;
- comprobantes privados;
- aprobación/rechazo de pagos;
- matrícula automática tras aprobación;
- cupones;
- certificados;
- administración;
- CMS visual;
- borrador;
- preview;
- publicación;
- reordenamiento de secciones;
- Design System;
- sedes;
- auditoría;
- configuración;
- navegación;
- footer;
- responsive.

No acepto que una reconstrucción elimine funcionalidades existentes.

---

# 5. CERTIFICADOS — MUY IMPORTANTE

v5.0.3.1 incluye una evolución del sistema de certificados.

Quiero mantener y perfeccionar el concepto:

**plantilla gráfica + campos posicionables**

El administrador debe poder subir:

- imagen frontal;
- imagen trasera.

Las imágenes son el diseño completo del certificado.

AcademiaVE superpone solamente los datos dinámicos.

Deben existir campos configurables para:

### Frente

- nombre del alumno;
- curso;
- duración;
- fecha;
- código.

### Reverso

- contenido / clases;
- duración;
- código.

Cada campo debe poder configurar, como mínimo:

- posición X;
- posición Y;
- ancho;
- alto;
- tamaño de fuente;
- color;
- alineación;
- peso;
- cursiva;
- visibilidad.

Usa posiciones relativas/porcentuales cuando sea apropiado para no depender de la resolución de la imagen.

Quiero un **editor visual real**:

- vista previa de la plantilla;
- seleccionar campo;
- arrastrarlo;
- cambiar propiedades;
- guardar;
- cambiar frente/reverso;
- generar un PDF de prueba.

El PDF de prueba debe usar datos ficticios.

El certificado real debe usar los datos reales del alumno y curso.

No pongas rectángulos o fondos blancos adicionales encima de la plantilla salvo que el administrador explícitamente los configure.

La plantilla debe conservarse visualmente intacta.

A4 horizontal.

PDF de dos páginas.

Revisa cuidadosamente escalado, relación de aspecto, coordenadas, fuentes, multilineado y cursos con muchas clases.

---

# 6. AULA

Revisa completamente el aula.

Debe incluir:

- contenido de la clase;
- vídeo;
- materiales;
- PDFs;
- progreso;
- lista de clases;
- clase actual;
- anterior;
- siguiente;
- marcar completada/pendiente;
- certificado cuando corresponda.

Mantén la navegación **Clase anterior / Siguiente clase** incorporada en las revisiones posteriores a v5.0.

En móvil debe resultar especialmente cómoda.

---

# 7. RESPONSIVE — NO LO TRATES COMO SECUNDARIO

Haz QA específico en:

- 360 px
- 390 px
- 414 px
- 768 px
- 1024 px
- 1280 px
- 1440 px+

Revisa visualmente:

- home;
- header;
- menú móvil;
- hero;
- catálogo;
- detalle de curso;
- login;
- registro;
- checkout;
- dashboard;
- aula;
- certificados;
- administración;
- CMS;
- tablas;
- formularios;
- modales;
- sedes.

**No debe existir overflow horizontal accidental.**

En teléfonos quiero que el header conserve una composición limpia:

**logo a la izquierda**

y a la derecha:

**CTA correspondiente + botón del menú hamburguesa**

No permitas que nombres largos de la academia rompan el layout.

No digas simplemente "responsive". Compruébalo.

---

# 8. DISEÑO

No quiero una apariencia genérica de proyecto escolar.

Debe sentirse como un SaaS/producto educativo comercial.

La estética debe ser:

- limpia;
- tecnológica;
- sobria;
- profesional;
- moderna;
- accesible;
- rápida.

Evita:

- gradientes excesivos;
- sombras excesivas;
- glassmorphism gratuito;
- animaciones pesadas;
- emojis como elementos UI;
- estilos infantiles;
- densidad visual innecesaria.

Conserva y mejora el Design System existente.

No disperses colores, radios y espaciados arbitrarios por el código.

---

# 9. CMS

El CMS de v5 debe conservarse y mejorar.

Quiero bloques estructurados y seguros, no HTML/JS arbitrario.

Debe soportar:

- activar/desactivar;
- reordenar;
- editar;
- variantes;
- imágenes;
- alineación;
- spacing;
- columnas;
- comportamiento responsive;
- animaciones ligeras;
- draft;
- preview;
- publish.

Valida estrictamente todo el contenido.

No permitir:

- `<script>`;
- `javascript:`;
- iframes arbitrarios;
- atributos HTML arbitrarios;
- ejecución de JavaScript desde CMS.

---

# 10. ADMINISTRACIÓN

Realiza una revisión UX completa.

Debe ser eficiente para administración diaria.

Áreas:

- resumen;
- usuarios;
- pagos;
- cursos;
- clases;
- CMS;
- sedes;
- cupones;
- certificados;
- configuración;
- diseño;
- auditoría.

Corrige:

- sidebar;
- scrolls;
- títulos largos;
- layouts estrechos;
- tablas;
- acciones;
- formularios;
- mensajes;
- estados vacíos;
- loading;
- errores.

---

# 11. SEGURIDAD

Audita de nuevo, incluso si v5.0.3.1 ya tiene protecciones.

Verifica:

- sesiones;
- cookies;
- CSRF;
- CSP;
- Helmet;
- rate limits;
- autorización;
- permisos admin;
- recuperación de contraseña;
- uploads;
- MIME;
- magic bytes;
- tamaño;
- nombres de archivos;
- acceso a comprobantes;
- PDFs privados;
- URLs configurables;
- open redirects;
- path traversal;
- XSS;
- inyección SQL;
- exposición accidental de secretos.

No debilites CSP sólo para hacer funcionar una interfaz.

---

# 12. PAGOS

Prueba el proceso completo con datos de prueba:

1. configurar tasa Bs/USD;
2. crear curso;
3. registrar alumno;
4. comprar;
5. aplicar cupón si corresponde;
6. subir comprobante;
7. comprobar estado pendiente;
8. aprobar desde administración;
9. verificar matrícula;
10. acceder al aula.

La tasa de cambio configurada debe persistir realmente.

No permitas falsos mensajes de "guardado" si el servidor rechazó o ignoró un dato.

Los pagos históricos deben mantener su tasa y cantidades originales.

---

# 13. TESTING

Crea/mejora pruebas automatizadas para:

- registro;
- login;
- logout;
- recuperación;
- reset;
- roles;
- cursos;
- clases;
- compra;
- pagos;
- cupones;
- matrícula;
- progreso;
- certificados;
- CMS;
- configuración;
- uploads;
- autorización admin.

Pero las pruebas automatizadas no sustituyen QA real.

También quiero pruebas manuales mediante navegador cuando Work pueda realizarlas.

---

# 14. INSPECCIÓN VISUAL

Este punto es obligatorio.

No quiero que solamente compruebes código y HTTP 200.

Navega las principales pantallas y revisa visualmente:

- desbordamientos;
- alineación;
- tamaños;
- espaciado;
- jerarquía;
- estados;
- contraste;
- formularios;
- navegación;
- responsive.

Si detectas algo feo o incómodo, corrígelo aunque técnicamente “funcione”.

---

# 15. REGRESIONES

Cada vez que cambies una parte importante:

- vuelve a ejecutar pruebas;
- comprueba rutas relacionadas;
- comprueba permisos;
- comprueba UI relacionada.

No arregles una pantalla rompiendo otra.

---

# 16. DEPENDENCIAS

Antes de añadir una librería pregúntate:

- ¿la necesitamos realmente?
- ¿es mantenida?
- ¿aumenta innecesariamente el bundle?
- ¿introduce riesgos?

Evita dependencias grandes para resolver problemas pequeños.

---

# 17. PRODUCCIÓN

Déjalo preparado para:

- HTTPS;
- reverse proxy;
- dominio;
- SMTP;
- almacenamiento persistente;
- backup;
- restore;
- logging;
- health check;
- variables de entorno;
- ejecución como servicio/contenedor cuando corresponda.

No introduzcas secretos hardcodeados.

---

# 18. DOCUMENTACIÓN

Actualiza documentación para reflejar el proyecto REAL entregado.

Incluye:

- instalación desde cero;
- actualización desde v5.0.3.1;
- desarrollo;
- producción;
- `.env`;
- correo;
- base de datos;
- backups;
- restauración;
- CMS;
- pagos;
- certificados;
- editor de certificados;
- administración;
- testing.

---

# 19. FORMA DE EJECUTAR ESTA TAREA

No quiero que me devuelvas una gran explicación teórica y después esperes confirmación.

**La autorización para trabajar ya está dada.**

Primero realiza internamente una auditoría de v5.0.3.1.

Después crea un plan de ejecución.

Luego continúa directamente con la implementación.

Puedes corregir decisiones anteriores si encuentras una solución objetivamente mejor, pero conserva compatibilidad funcional y explica los cambios importantes al final.

Trabaja de forma autónoma hasta llegar a un estado estable.

---

# 20. RESULTADO QUE QUIERO

No quiero fragmentos de código.

Quiero una **nueva versión completa del proyecto**.

Al finalizar entrega:

1. ZIP completo de la nueva versión;
2. changelog respecto a v5.0.3.1;
3. informe de arquitectura;
4. informe de seguridad;
5. informe de migraciones;
6. informe de QA;
7. lista exacta de pruebas ejecutadas;
8. lista de pruebas que no pudieron realizarse;
9. problemas conocidos restantes;
10. instrucciones de instalación limpia;
11. instrucciones de actualización desde v5.0.3.1.

No afirmes que algo funciona si no fue ejecutado o comprobado.

---

# 21. CRITERIO FINAL

La pregunta que debes hacerte durante toda la reconstrucción es:

**“¿Esto se comporta y se siente como una plataforma educativa profesional que una empresa podría poner hoy en producción?”**

No busco simplemente incrementar el número de funciones.

Busca:

**estabilidad → seguridad → funcionalidad → UX → responsive → administración → estética → rendimiento**

No sacrifiques las primeras por las últimas.

Sorpréndeme con mejoras justificadas que no haya pensado, siempre que:

- aporten valor real;
- tengan coste de mantenimiento razonable;
- no debiliten seguridad;
- no destruyan funcionalidades existentes.