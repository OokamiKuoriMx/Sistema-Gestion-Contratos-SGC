var SHEET_ID = 'TU_ID_DE_HOJA_DE_CALCULO_AQUI'; // Reemplazar con el ID real del Google Sheet

// Esquema Relacional de Base de Datos para extracción IA
var ESQUEMA_BD = {
    'Convenios': ['ID_Convenio', 'Numero_Acuerdo', 'Monto_Apoyo', 'Vigencia_Fin', 'Objeto_Programa', 'Proyectos_Asociados'],
    'Contratos': ['ID_Contrato', 'Numero_Contrato', 'ID_Convenio_Vinculado', 'Contratista', 'RFC_Contratista', 'Objeto_Contrato', 'Monto_Sin_IVA', 'Monto_Total_Con_IVA', 'Fecha_Inicio', 'Fecha_Fin'],
    'Programa_Ejecucion': ['ID_Programa', 'ID_Contrato', 'Clave_Concepto_Periodo', 'Descripcion', 'Unidad', 'Cantidad', 'Precio_Unitario', 'Importe_Total'],
    'Estimaciones_Pagos': ['ID_Pago', 'ID_Contrato', 'No_Estimacion', 'Folio_Factura', 'Fecha_Factura', 'Periodo_Inicio', 'Periodo_Fin', 'Monto_Bruto', 'Deducciones', 'Monto_Neto_A_Pagar', 'Beneficiario', 'Cuenta_CLABE']
};

function doGet() {
    return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('Sistema Institucional de Gestión - SGC')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Función inicializadora: Crea las 4 pestañas de la BD relacional si no existen
 */
function initTablas() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    for (const tabla in ESQUEMA_BD) {
        let sheet = ss.getSheetByName(tabla);
        if (!sheet) {
            sheet = ss.insertSheet(tabla);
            sheet.appendRow(ESQUEMA_BD[tabla]);
            // Formato básico de la cabecera
            sheet.getRange(1, 1, 1, ESQUEMA_BD[tabla].length).setFontWeight("bold").setBackground("#611232").setFontColor("white");
            sheet.setFrozenRows(1);
        }
    }
}

/**
 * ====================================================
 * WEBHOOK: Punto de entrada para el Agente IA
 * ====================================================
 * Recibe el JSON generado por el LLM y distribuye 
 * los datos entre las 4 tablas relacionales.
 */
function doPost(e) {
    try {
        if (!e || !e.postData || !e.postData.contents) {
            return errorResponse("Falta carga útil JSON (empty body).");
        }

        // Objeto JSON con el formato exigido por la instrucción del IA Agente
        const payload = JSON.parse(e.postData.contents);

        if (payload.accion === "importar_datos" && payload.datos) {
            initTablas();
            const ss = SpreadsheetApp.openById(SHEET_ID);
            let resultados = {};

            const tablas = Object.keys(ESQUEMA_BD);
            tablas.forEach(tabla => {
                // Verificar si el JSON incluye datos para esta tabla y es un Array
                if (payload.datos[tabla] && Array.isArray(payload.datos[tabla])) {
                    const sheet = ss.getSheetByName(tabla);
                    const headers = ESQUEMA_BD[tabla];
                    let insertados = 0;

                    payload.datos[tabla].forEach(registro => {
                        const row = headers.map(header => {
                            // Generar UUID automáticamente a nivel sistema si falta en la llave primaria
                            if (header.startsWith('ID_') && header === headers[0] && !registro[header]) {
                                registro[header] = Utilities.getUuid();
                            }
                            return registro[header] !== undefined ? registro[header] : '';
                        });
                        sheet.appendRow(row);
                        insertados++;
                    });
                    resultados[tabla] = `${insertados} registros añadidos.`;
                }
            });

            return ContentService.createTextOutput(JSON.stringify({
                status: "success",
                message: "Procesamiento IA relacional completado con éxito",
                detalles: resultados
            })).setMimeType(ContentService.MimeType.JSON);
        }

        return errorResponse("La acción no es 'importar_datos' o no está estructurado correctamente.");

    } catch (error) {
        return errorResponse(error.toString());
    }
}

function errorResponse(msg) {
    return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: msg
    })).setMimeType(ContentService.MimeType.JSON);
}


// ====================================================
// FUNCIONES CRUD PARA LA INTERFAZ WEB MANUAL (index.html)
// Exponiendo tabla Contratos
// ====================================================

function getContracts() {
    try {
        initTablas();
        const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Contratos');
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];

        const headers = data[0];
        const contracts = data.slice(1).map(row => {
            let contract = {};
            headers.forEach((header, index) => {
                contract[header] = row[index];
            });
            return contract;
        });

        return contracts;
    } catch (e) {
        console.error(e);
        throw new Error("Error al consultar la base de datos.");
    }
}

function saveContract(contractData) {
    try {
        initTablas();
        const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Contratos');
        const headers = ESQUEMA_BD['Contratos'];

        // Si no tiene ID, es registro nuevo
        if (!contractData.ID_Contrato) {
            contractData.ID_Contrato = Utilities.getUuid();
            const rowToInsert = headers.map(h => contractData[h] !== undefined ? contractData[h] : '');
            sheet.appendRow(rowToInsert);
        } else {
            // Actualizar registro existente
            const data = sheet.getDataRange().getValues();
            const idIndex = headers.indexOf('ID_Contrato');

            for (let i = 1; i < data.length; i++) {
                if (data[i][idIndex] === contractData.ID_Contrato) {
                    const rowToUpdate = i + 1;
                    const arrayValores = headers.map(h => contractData[h] !== undefined ? contractData[h] : '');
                    sheet.getRange(rowToUpdate, 1, 1, headers.length).setValues([arrayValores]);
                    break;
                }
            }
        }
        return true;
    } catch (e) {
        console.error(e);
        throw new Error("Error al guardar el contrato.");
    }
}

function deleteContract(id) {
    try {
        const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Contratos');
        const data = sheet.getDataRange().getValues();
        const headers = ESQUEMA_BD['Contratos'];
        const idIndex = headers.indexOf('ID_Contrato');

        for (let i = 1; i < data.length; i++) {
            if (data[i][idIndex] === id) {
                sheet.deleteRow(i + 1);
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error(e);
        throw new Error("Error al eliminar el registro.");
    }
}
