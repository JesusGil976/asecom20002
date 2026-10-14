# Actualización del CMS de ASECOM

Base: GitHub main, commit 0528fcd. Fecha: 14 de octubre de 2026.

## Instalación

1. Descomprime ASECOM_CMS_Actualizacion.zip.
2. Copia las carpetas public, src, tests, scripts y docs dentro del repositorio existente, respetando las rutas. Reemplaza los archivos coincidentes y conserva todos los demás.
3. Guarda los cambios en GitHub en un único commit.
4. Despliega ese commit en Blitz y reinicia la aplicación: hay cambios tanto de interfaz como de servidor.
5. Recarga con Ctrl + Shift + R. Entra en Administración → Páginas / CMS.

El paquete es una actualización, no un proyecto independiente. No contiene .env, credenciales, bases de datos, node_modules ni archivos de alumnos. No añade dependencias de producción ni requiere migraciones de esquema. Conserva las secciones existentes y las versiones publicadas.

## Edición

- Hasta 30 elementos por lista: estadísticas, pasos, testimonios, preguntas frecuentes, galería y equipo docente. Añadir, quitar y ordenar con controles propios.
- Duplicar secciones, asignarles nombres internos, moverlas con flechas o arrastrarlas. Se conserva el máximo existente de 40 secciones.
- Configurar destinos, visibilidad y estilo de los botones de portada.
- Imágenes de portada y Nosotros: texto alternativo, encuadre, proporción, tamaño, lado y ajuste completo/recortado. La variante centrada muestra la imagen; la variante minimalista conserva su diseño sin imagen.
- Elegir cursos y orden manual por bloque; sin selección se muestran los destacados automáticamente. Elegir sedes por bloque; sin selección se muestran todas las activas.
- Texto con títulos, negritas, listas y enlaces mediante formato sencillo. La barra inserta ese formato. Se conserva el texto plano anterior. No se permite HTML arbitrario.
- Bloques nuevos: preguntas frecuentes desplegables, galería y equipo docente. Galería y equipo admiten URL o subida de imágenes por elemento.
- Las opciones de columnas se muestran solo en bloques que las utilizan.

## Guardado, historial y vista previa

Los cambios se conservan automáticamente como recuperación local en este navegador y para este administrador. Esto NO publica ni guarda automáticamente el borrador en el servidor: usa «Guardar borrador» para sincronizarlo. Al regresar, se ofrece recuperar la copia local. Si el almacenamiento del navegador está deshabilitado, sigue disponible el guardado manual.

«Publicar» guarda el borrador antes de publicarlo. «Historial» muestra versiones anteriores; restaurar reemplaza únicamente el borrador, previa confirmación. Debes publicar para que el público vea la versión restaurada. La restauración conserva las versiones archivadas.

«Vista previa completa» guarda el borrador y abre una ventana con anchos de escritorio, tablet y móvil (390 y 360 píxeles). Requiere sesión de administrador. Si no abre, permite las ventanas emergentes para tu dominio. El marco solo puede integrarse desde el mismo origen; se sigue bloqueando el uso desde otros sitios.

La vista embebida en el editor es una referencia de contenido. Usa la vista completa para comprobar el diseño por dispositivo.

## Navegación

En Configuración → Navegación hay un selector de secciones publicadas que rellena el destino correcto. Los enlaces personalizados siguen disponibles.

Se mantienen los destinos habituales /#nosotros y /#sedes. Los bloques repetidos reciben identificadores distintos. Puedes definir identificadores personalizados en minúsculas; deben ser únicos. Si cambias uno ya enlazado, actualiza su enlace. Publica un bloque nuevo antes de seleccionarlo en la navegación.

## Otras correcciones

- Inicio muestra primero su contenido institucional; los cursos se cargan por separado. Si fallan, se muestra un enlace al catálogo sin bloquear toda la página.
- Se reajusta el ancla después de cargar los cursos si el visitante todavía no ha interactuado, para conservar el destino del menú.
- Título y descripción SEO de cursos se aplican tanto al HTML inicial como a la navegación interna. No es una implementación completa de SEO técnico ni de tarjetas sociales.
- Los enlaces de recuperación se construyen con URL para evitar barras duplicadas, incluso si PUBLIC_URL termina en barra.

## Verificación

- Comprobación de sintaxis y estructura del proyecto.
- Suite automatizada: 64 pruebas, incluyendo validación de nuevos campos, restauración privada, texto seguro y anclas únicas, además de los flujos existentes.
- Prueba Chromium con base de datos temporal: guardar, duplicar, FAQ, recuperación local, publicación, restauración sin alterar la versión pública, navegación por sección, cuatro estadísticas, vista a 390 px, editor móvil sin desbordamiento horizontal, metadatos SEO y fallo simulado de cursos.

Comandos: npm ci; npm run check; npm test.
Prueba visual opcional: instala Playwright y Chromium en tu entorno de desarrollo y ejecuta node scripts/qa-cms-flexible.cjs. PLAYWRIGHT_MODULE permite indicar un módulo instalado fuera del proyecto.

La validación se hizo en un entorno local de prueba. El despliegue en Blitz y la revisión con el contenido real deben hacerse al instalar esta actualización.
