# Plan de la issue #37: Actualizar iconos de la app y favicon

- **Issue de este repositorio:** https://github.com/aldeapucela/biki-stats-web/issues/37
- **Repositorio de seguimiento:** `aldeapucela/biki-stats-web`
- **Repositorio de implementación:** `aldeapucela/biki-stats-web`
- **Estado:** AUTORIZADO / EN IMPLEMENTACIÓN (2026-11-03)
- **Rama futura:** `feat/37/actualizar-iconos-de-la-app-y-favicon` (todavía no creada)
- **Base de rama:** `main`

## Resumen verificable de la issue

La issue solicita actualizar los iconos visibles de la aplicación y el favicon para alinearlos con la identidad visual de Aldea Pucela. La aplicación debe presentarse como “Movilidad BIKI”. Sus criterios piden que el favicon se muestre en la pestaña, que el icono de la aplicación cargue en los contextos soportados, que no queden referencias antiguas innecesarias y que se compruebe tanto el desarrollo como la build de producción.

No hay comentarios, etiquetas, asignados ni recursos gráficos adjuntos en la issue.

## Alcance confirmado y exclusiones

Dentro del alcance:

- Identificar todas las referencias actuales a iconos y recursos de marca.
- Sustituir el favicon en los formatos necesarios y actualizar sus referencias HTML.
- Actualizar el icono de la aplicación en los contextos que se confirmen.
- Retirar referencias antiguas solo cuando no sean necesarias para compatibilidad.
- Añadir o actualizar pruebas de referencias y carga de los recursos.
- Verificar desarrollo y build de producción.

Fuera de alcance por ahora:

- Crear o rediseñar la identidad visual sin recibir los recursos finales.
- Cambiar la marca, tipografías o paleta global de la aplicación.
- Publicar recursos en otros repositorios o servicios.

## Contexto y dependencias

- `index.html` declara actualmente `/favicon.svg` como icono SVG y `/favicon.png` como PNG de 64×64.
- `public/favicon.svg` y `public/favicon.png` son los recursos de favicon existentes.
- La marca visible del encabezado usa `public/aldea-pucela.jpg` en `src/main.js`.
- No se ha localizado un `manifest.webmanifest` ni una declaración `apple-touch-icon` en las referencias actuales.
- La referencia visual aprobada es la identidad de [aldeapucela.org](https://aldeapucela.org/), cuyo logo se sirve actualmente desde `https://aldeapucela.org/img/logo-web.jpg`.
- El nombre visible aprobado para la aplicación es “Movilidad BIKI”.
- Deben respetarse las licencias del repositorio y no incorporar material de terceros sin autorización.

## Propuesta técnica (NO EJECUTAR)

1. Usar el mismo logo y recursos de identidad que `aldeapucela.org`, con autorización y atribución conforme a la página de logos y diseños del proyecto, y generar los recursos derivados con los tamaños y formatos adecuados para cada contexto.
2. Inventariar las referencias en `index.html`, `public/` y el código de la interfaz para sustituir los iconos actuales.
3. Actualizar el favicon, el icono visible del encabezado, `apple-touch-icon` y el manifest/PWA con las variantes dimensionadas que correspondan.
4. Usar “Movilidad BIKI” en títulos, nombre accesible, navegación y metadatos donde correspondan.
5. Añadir pruebas que comprueben las referencias, tipos, disponibilidad de los recursos y nombre visible, y ejecutar la build de producción.
6. Abrir un PR hacia `main` con `Closes #37` en el cuerpo para que la issue quede asociada automáticamente.

## Dudas y decisiones (resolver TODAS antes de codificar)

| Duda | Alternativas | Decisión aprobada | Estado |
| --- | --- | --- | --- |
| ¿Cuáles son los recursos gráficos finales? | Adjuntar recursos nuevos; reutilizar un recurso existente | Usar los mismos recursos de identidad que `aldeapucela.org`; tomar su logo como referencia visual | Resuelta |
| ¿Qué significa “iconos de la app”? | Solo favicon; favicon + encabezado; favicon + `apple-touch-icon` + PWA/manifest | Aplicar el recurso a todos esos contextos | Resuelta |
| ¿Qué tamaños y variantes deben cubrirse? | Mantener un tamaño único; generar tamaños específicos por plataforma | Ajustar los tamaños a cada contexto y formato | Resuelta |
| ¿Debe sustituirse `public/aldea-pucela.jpg` en el encabezado? | Sí; no; mantenerlo como imagen institucional independiente | Sí, el encabezado y el resto de iconos usarán el logo de Aldea Pucela | Resuelta |
| ¿Qué nombre debe mostrar la aplicación? | Mantener “Movilidad”; usar “BIKI Aldea Pucela”; usar “Movilidad BIKI” | Usar “Movilidad BIKI” en la marca de la aplicación y metadatos correspondientes | Resuelta |
| ¿Qué pruebas de navegador móvil se consideran suficientes? | Playwright en Chromium; comprobación de recursos y build; matriz adicional de navegadores | Comprobar referencias, disponibilidad, build y contextos de icono definidos | Resuelta |

## Pruebas y validación propuestas

- Ejecutar las pruebas unitarias existentes.
- Añadir o ampliar una prueba E2E que compruebe los enlaces `rel="icon"`, sus respuestas HTTP y tipos MIME.
- Si se añade manifest o `apple-touch-icon`, comprobar también sus referencias y disponibilidad.
- Ejecutar `npm run build` y verificar que los recursos se copian y se sirven desde `dist/`.
- Revisar que no quedan referencias a recursos antiguos fuera de las compatibilidades aprobadas.
- Validar visualmente el favicon y el icono de aplicación en los contextos acordados.

## Riesgos y criterios de aceptación

Riesgos:

- La conversión del logo de referencia a SVG/PNG u otros formatos puede requerir una herramienta disponible en el entorno.
- La marca “Movilidad BIKI” debe mantenerse diferenciada de las menciones descriptivas a movilidad como concepto general.
- Los favicons pueden quedar cacheados por el navegador; conviene cambiar nombres o documentar cómo validar la actualización.
- Añadir capacidades de instalación móvil sin confirmación podría ampliar el alcance más allá de la issue.
- Los formatos y recursos de terceros pueden tener requisitos de licencia o atribución.

Criterios de aceptación:

- Los recursos aprobados se sirven correctamente desde desarrollo y producción.
- El favicon actualizado aparece en la pestaña del navegador.
- El icono de aplicación acordado carga correctamente en todos los contextos confirmados.
- No quedan referencias antiguas no justificadas.
- Las pruebas y la build de producción pasan.

## Autorización expresa para empezar a escribir código

- [x] Todas las dudas resueltas.
- [x] Recibida autorización explícita para **implementar esta issue**.
- **Referencia o texto de autorización:** “Adelante” (2026-11-03).

**Mientras falte cualquiera de las condiciones anteriores, solo editar este documento.**
