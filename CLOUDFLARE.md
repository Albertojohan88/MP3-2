# Peticiones directas desde Deja tu huella

El visitante escribe canción y artista y pulsa Buscar y agregar. No se abren GitHub ni un formulario externo. El sitio llama al Worker, que busca en Audius, valida una coincidencia de título y artista, la guarda en Cloudflare D1 y devuelve el resultado. Todos los visitantes leen la misma base de datos y ven las canciones al cargar la página. Tras hacer una petición, la lista del solicitante se actualiza inmediatamente.

Los seis MP3 siguen en Musica. Las canciones encontradas se reproducen en el mismo reproductor mediante la API oficial de Audius, con atribución al artista y enlace a la plataforma. No se descargan ni convierten archivos; la lista en D1 es el catálogo compartido. Audius no contiene todas las canciones comerciales. Si no existe una coincidencia reproducible, se informa y no se añade una pista distinta ni ficticia. La disponibilidad de reproducción puede cambiar.

Referencias oficiales: https://github.com/AudiusProject/docs.audius.org/blob/main/docs/developers/rest-api.md y https://audiusproject.github.io/api-docs/.

## Desplegar

1. Crear un token de API de Cloudflare limitado a la cuenta deseada, con Account > Workers Scripts > Edit, Account > D1 > Edit y Account > Account Settings > Read. Usar la configuración segura del entorno para CLOUDFLARE_API_TOKEN. Nunca guardar el token en este repositorio, site-config.json o el chat.
2. En el entorno permitir api.cloudflare.com para gestionar Cloudflare y discoveryprovider.audius.co para la validación de Audius. El subdominio workers.dev generado debe permitirse también para las comprobaciones de despliegue. Guardar el borrador de red no cambia por sí solo la configuración de la máquina actual.
3. Si el token accede a varias cuentas, configurar CLOUDFLARE_ACCOUNT_ID (no secreto) para elegir una. Habilitar workers.dev en Cloudflare Workers si aún no está configurado.
4. Ejecutar desde /workspace/MP3-2: `python3 scripts/deploy_cloudflare.py`. Crea o reutiliza johan-music-catalog, aplica schema.sql sin borrar datos y despliega johan-music-requests-mp3-2. Se niega a sobrescribir otro Worker sin la etiqueta de este proyecto. No modifica la cuenta ni el plan de facturación.
5. El script verifica las rutas de salud y lectura D1 y guarda la URL pública en site-config.json. Publicar ese archivo en main conecta GitHub Pages con el servicio. No incluir credenciales: solo apiBase, por ejemplo https://johan-music-requests-mp3-2.SUBDOMINIO.workers.dev.
6. Verificar una búsqueda real desde el formulario y reproducir el resultado. Una prueba simulada no valida la conectividad ni el catálogo real. Confirmar que otro navegador ve la canción. Se pueden consultar GET /api/tracks y POST /api/requests con JSON {title, artist}.

El Worker acepta peticiones desde el origen de GitHub Pages y guarda los datos en D1. Aplica un límite global de 20 búsquedas por minuto y evita duplicados. No requiere ni expone claves de GitHub, YouTube ni Audius. El token de Cloudflare solo se usa al desplegar, no en las peticiones de visitantes. No se conserva información personal ni se interpreta el texto como código. El formulario separado de comentarios sigue enviando correo mediante FormSubmit; esos comentarios libres no se convierten en peticiones musicales.

## Validación local

`node --test tests/service.test.mjs` verifica el Worker y sus consultas con SQLite real, incluyendo persistencia, coincidencias, duplicados, límites, errores y CORS. Las respuestas del catálogo se simulan. `python3 -m http.server 8000 --bind 127.0.0.1` sirve el frontend para desarrollo. Sin apiBase, la búsqueda queda deshabilitada con un aviso explícito.
