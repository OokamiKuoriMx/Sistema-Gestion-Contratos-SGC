# Sistema de Gestión de Contratos (SGC) - Google Apps Script

Este repositorio contiene el código fuente para el **Sistema de Gestión de Contratos** basado en Google Apps Script.
La aplicación está diseñada para usar una hoja de cálculo (Google Sheet) como base de datos, con una interfaz web moderna, responsiva y estética construida utilizando HTML5, Javascript Vainilla y Tailwind CSS.

## Estructura del Proyecto

- `Code.gs`: Lógica de backend (API) para Apps Script. Contiene las funciones `doGet()`, `getContracts()`, `saveContract()`, y `deleteContract()`.
- `index.html`: Interfaz de usuario servida a través de la Web App. Utiliza Tailwind CSS (vía CDN) y hace llamadas al backend usando `google.script.run`.
- `appsscript.json`: Manifiesto de la aplicación de Google Apps Script.

## Cómo Usarlo

### 1. Configurar la Base de Datos (Google Sheet)
1. Crea un nuevo Google Sheet.
2. Abre el editor de **Apps Script** desde *Extensiones > Apps Script*.
3. *(Nota: No es necesario crear pestañas o columnas manualmente, el script se encargará de crearlas y asignar los encabezados automáticamente al iniciar).*

### 2. Desplegar la Aplicación en Apps Script
1. Si usas [clasp](https://github.com/google/clasp), simplemente haz `clasp push` para subir este código a tu proyecto.
2. Si lo haces manualmente:
   - Ve a [script.google.com](https://script.google.com/).
   - Crea un "Nuevo proyecto".
   - Borra cualquier archivo existente y pega el contenido de `Code.gs` y crea un archivo `index.html` con su contenido correspondiente.
   - Asegúrate de actualizar el archivo `appsscript.json` (mostrar manifiesto en configuración del editor).
3. Para publicar:
   - Presiona el botón **Implementar** > **Nueva Implementación**.
   - Selecciona **Aplicación web**.
   - Configura el acceso según tus necesidades (por ejemplo, "Solo yo" o "Cualquier usuario de tus dominios").
   - Autoriza los permisos (cuando se pida permisos para leer tu Google Sheet).

### Características

- **Diseño Moderno:** Usa TailwindCSS para una experiencia hermosa y fluida.
- **Micro-animaciones:** Estados de carga, botones con feedback, modals animados.
- **CRUD Completo:** Puedes Agregar, Leer, Actualizar y Eliminar contratos directamente.
- **Sin Dependencias Nativas:** Solo necesitas Google Apps Script.
