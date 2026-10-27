# Peticiones automáticas de canciones

El visitante escribe canción y artista en Deja tu huella, continúa en GitHub y crea una solicitud pública (requiere cuenta de GitHub). No necesita buscar ni pegar un enlace. El formulario de correo conserva su función de enviar comentarios; esos correos no se convierten automáticamente en solicitudes de GitHub.

Al abrir una solicitud con título Petición musical: y campos Canción y Artista, el workflow pages.yml busca el primer video de YouTube habilitado para integración, lo guarda en videos.json y publica el sitio. Aparece en el mismo listado que los MP3; al seleccionarlo cambia al reproductor de YouTube. No descarga ni convierte el audio. La coincidencia automática puede ser una versión diferente; se muestra el título devuelto por YouTube.

## Requisito para activar la búsqueda

En Google Cloud habilitar YouTube Data API v3 y crear una clave restringida a esa API. Guardarla como secreto de Actions llamado YOUTUBE_API_KEY en Settings > Secrets and variables > Actions del repositorio. No incluirla en HTML ni compartirla en el chat. Usar una clave de servidor apropiada para GitHub Actions: una restricción por referente HTTP del navegador no funciona para este proceso.

GitHub Pages debe usar GitHub Actions como fuente. Requiere Actions habilitado, permiso de escritura para el catálogo y Pages. Sin el secreto se publica el sitio existente pero las búsquedas quedan pendientes, con una advertencia en Actions. La web muestra si la automatización aún no ha publicado resultados; no confirma una búsqueda no ejecutada. Ejecutar Run workflow después de configurar el secreto o para reintentar peticiones abiertas.

Se procesan hasta diez búsquedas por ejecución para limitar consumo de cuota. Se evitan búsquedas repetidas por canción y artista ya incorporados. Las peticiones son públicas, y solicitudes abusivas pueden agotar la cuota del proveedor: controlar acceso y cuota desde GitHub y Google Cloud. La lectura incluye solicitudes abiertas pendientes para recuperar eventos agrupados por la cola de despliegue. Cerrar una petición pendiente la excluye. Un video ya publicado se retira editando videos.json.

La reproducción real depende de permisos del video, región, edad y disponibilidad en YouTube. Se ofrece un enlace externo. Una comprobación con respuestas simuladas no confirma una búsqueda real ni reproducción pública.
