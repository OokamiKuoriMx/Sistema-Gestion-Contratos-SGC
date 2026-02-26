/**
 * Ejecuta esta función manualmente desde el editor de Apps Script 
 * seleccionando "setupInicialTablas" y presionando el botón "Ejecutar"
 * para forzar la creación de todas las tablas y sus encabezados.
 */
function setupInicialTablas() {
    try {
        configurarBaseDeDatos();
        Logger.log("✅ Tablas inicializadas correctamente de acuerdo al ESQUEMA_BD de 5 tablas.");
    } catch (error) {
        Logger.log("❌ Error inicializando tablas: " + error.message);
    }
}
