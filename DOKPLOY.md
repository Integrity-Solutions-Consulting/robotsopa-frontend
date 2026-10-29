# Frontend independiente en Dokploy

Seleccione Dockerfile `Dockerfile`, contexto raíz de este repositorio y puerto 80. Configure en Environment `API_BASE_URL=https://api.midominio.com` con el dominio público de la API. El contenedor genera `app.config.json` al iniciar; para cambiar la URL, cambie la variable y reinicie o redespliegue sin recompilar. No introduzca secretos en este proyecto. En la aplicación backend configure su CORS para el origen HTTPS exacto de este frontend.

También puede usar `compose.dokploy.yml` como una aplicación Compose independiente; contiene solo el frontend. No requiere la red ni el nombre interno de la API.
