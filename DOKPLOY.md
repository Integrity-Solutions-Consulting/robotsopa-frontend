# Frontend independiente en Dokploy

Si Dokploy clona este monorepositorio, seleccione el método Dockerfile, contexto `front` y Dockerfile `front/Dockerfile` (o `Dockerfile` si la interfaz interpreta la ruta relativa al contexto). El puerto interno es `80`. Si se publica `front` como repositorio independiente, use contexto `.` y Dockerfile `Dockerfile`.

Configure en Environment:

```env
API_BASE_URL=https://botisc.dokploy.integritysolutions.com.ec
```

Debe ser únicamente el origen HTTPS de la API, sin `/api`. Al iniciar, el contenedor genera `app.config.json`; cambiar la variable y reiniciar el contenedor aplica la nueva dirección sin reconstruir la imagen. Sin la variable, el contenedor no arranca. Para desarrollo, `npm start` utiliza la configuración vacía de `public/app.config.json` y el proxy local de `proxy.conf.json`.

Publique el frontend con HTTPS y configure en el backend el origen exacto del frontend en `Cors__AllowedOrigins__0` (por ejemplo `https://panel.ejemplo.com`, sin barra final), conservando los demás orígenes necesarios. El backend debe permitir credenciales y tener `SRI_COOKIE_SECURE=true`, de modo que la cookie de sesión use `Secure` y `SameSite=None`. Si los dominios son de sitios diferentes, las políticas del navegador pueden bloquear cookies de terceros incluso con esos ajustes; use preferentemente subdominios HTTPS del mismo sitio y pruebe el inicio de sesión y las descargas con el dominio real. No incluya secretos en el frontend ni en `API_BASE_URL`.

Las contraseñas SRI introducidas por el usuario se envían al backend para la funcionalidad existente; no deben incluirse como valores predefinidos en el código ni en la imagen.
