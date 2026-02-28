/**
 * Ejecuta esta función manualmente desde el editor de Apps Script 
 * seleccionando "setupInicialTablas" y presionando el botón "Ejecutar"
 * para forzar la creación de todas las tablas y sus encabezados.
 */
function setupInicialTablas() {
    let ui;
    try {
        ui = SpreadsheetApp.getUi();
    } catch (e) {
        // No hay UI disponible (ej. ejecución vía API o disparador)
    }

    try {
        const ss = getSpreadsheet();
        const tablas = Object.keys(ESQUEMA_BD);
        const totalNumTablas = tablas.length;

        // Capturar estado ANTES de reparar
        const estadoPrevio = {};
        tablas.forEach(tabla => {
            const sheet = ss.getSheetByName(tabla);
            if (sheet && sheet.getLastRow() > 0) {
                estadoPrevio[tabla] = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0].map(h => String(h).trim());
            } else {
                estadoPrevio[tabla] = null; // no existía o vacía
            }
        });

        _dbConfigured = false; // Forzar re-ejecución del auto-heal
        configurarBaseDeDatos(); // Ejecuta la lógica robusta de Code.gs

        let reporte = `REPORTE DE SINCRONIZACIÓN DE BASE DE DATOS (${totalNumTablas} TABLAS):\n\n`;

        tablas.forEach(tabla => {
            const sheet = ss.getSheetByName(tabla);
            const metaHeaders = ESQUEMA_BD[tabla];
            const prevHeaders = estadoPrevio[tabla];

            if (!prevHeaders) {
                reporte += `🆕 ${tabla}: Creada hoy (${metaHeaders.length} campos)\n`;
                return;
            }

            // Verificar headers post-reparación
            const postHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0].map(h => String(h).trim());
            const perfectMatch = metaHeaders.length === postHeaders.length &&
                metaHeaders.every((h, i) => h === postHeaders[i]);

            if (perfectMatch && prevHeaders.length === metaHeaders.length && prevHeaders.every((h, i) => h === metaHeaders[i])) {
                reporte += `✅ ${tabla}: OK (${metaHeaders.length} campos)\n`;
            } else if (perfectMatch) {
                // Fue reparada exitosamente
                const removidas = prevHeaders.filter(h => h && !metaHeaders.includes(h));
                const agregadas = metaHeaders.filter(h => !prevHeaders.includes(h));
                let detalle = [];
                if (removidas.length > 0) detalle.push(`eliminadas: [${removidas.join(', ')}]`);
                if (agregadas.length > 0) detalle.push(`agregadas: [${agregadas.join(', ')}]`);
                if (detalle.length === 0) detalle.push('reordenadas');
                reporte += `🔧 ${tabla}: Reparada (${detalle.join(', ')})\n`;
            } else {
                reporte += `⚠️ ${tabla}: Posible problema (${postHeaders.length} campos, esperados ${metaHeaders.length})\n`;
            }
        });

        Logger.log(reporte);
        if (ui) {
            ui.alert('Sincronización Completada', reporte, ui.ButtonSet.OK);
        }
    } catch (error) {
        Logger.log("❌ Error inicializando tablas: " + error.message);
        if (ui) {
            try { ui.alert('Error', error.message, ui.ButtonSet.OK); } catch (e) { }
        }
    }
}

/**
 * ¡PELIGRO! Herramienta de Administrador.
 * Ejecuta esta función desde el editor para BORRAR ABSOLUTAMENTE TODOS LOS DATOS
 * de todas las tablas, preservando únicamente los encabezados.
 */
function flushDatabase() {
    let ui;
    try {
        ui = SpreadsheetApp.getUi();
    } catch (e) {
        Logger.log("❌ flushDatabase requiere una interfaz activa.");
        return;
    }

    try {
        const tablas = Object.keys(ESQUEMA_BD);
        const totalNumTablas = tablas.length;
        const response = ui.alert('Confirmación de Borrado Masivo', `⚠️ Estás a punto de ELIMINAR TODOS LOS DATOS de las ${totalNumTablas} tablas del sistema.\nEsta acción no se puede deshacer.\n\n¿Estás completamente seguro?`, ui.ButtonSet.YES_NO);

        if (response == ui.Button.YES) {
            configurarBaseDeDatos(); // Ensure ESQUEMA is loaded
            const ss = getSpreadsheet();
            const tablas = Object.keys(ESQUEMA_BD);

            let tablasLimpiadas = 0;
            tablas.forEach(tabla => {
                const sheet = ss.getSheetByName(tabla);
                if (sheet) {
                    const lastRow = sheet.getLastRow();
                    if (lastRow > 1) {
                        // Borra desde la fila 2 hasta el final, preservando la 1 (Headers)
                        sheet.deleteRows(2, lastRow - 1);
                        tablasLimpiadas++;
                    }
                }
            });
            ui.alert('Éxito', `✅ Se han purgado los datos de ${tablasLimpiadas} tablas. La base de datos está limpia.`, ui.ButtonSet.OK);
        } else {
            ui.alert('Cancelado', 'Operación abortada. No se borró ningún dato.', ui.ButtonSet.OK);
        }
    } catch (error) {
        Logger.log("❌ Error purgando tablas: " + error.message);
        if (ui) ui.alert('Error', error.message, ui.ButtonSet.OK);
    }
}
