function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
}

const DEBUG_MODE = true; // Set to false in production

// Configuración de la base de datos
// Esquema Relacional de Base de Datos para extracción IA
var ESQUEMA_BD = {
    'Convenios_Recurso': ['ID_Convenio', 'Numero_Acuerdo', 'Nombre_Fondo', 'Monto_Apoyo', 'Fecha_Firma', 'Vigencia_Fin', 'Objeto_Programa', 'Estado', 'Link_Sharepoint'],
    'Contratistas': ['ID_Contratista', 'Razon_Social', 'RFC', 'Domicilio_Fiscal', 'Representante_Legal', 'Telefono', 'Banco', 'Cuenta_Bancaria', 'Cuenta_CLABE'],
    'Contratos': ['ID_Contrato', 'Numero_Contrato', 'ID_Convenio_Vinculado', 'ID_Contratista', 'Objeto_Contrato', 'Monto_Total_Sin_IVA', 'Monto_Total_Con_IVA', 'Fecha_Firma', 'Fecha_Inicio_Obra', 'Fecha_Fin_Obra', 'Estado', 'Retencion_Vigilancia_Pct', 'Retencion_Garantia_Pct', 'Otras_Retenciones_Pct', 'Link_Sharepoint'],
    'Estadisticas_Financieras': ['ID_Periodo', 'Año', 'Mes', 'Monto_Ejecutado', 'Monto_Proyectado'],
    'Usuarios_Sistema': ['ID_Usuario', 'Username', 'Nombre_Full', 'Rol', 'Email', 'Activo'],
    'Parametros_Sistema': ['Clave_Parametro', 'Valor_Parametro', 'Descripcion'],
    'Conversaciones_IA': ['ID_Conversacion', 'Fecha_Hora', 'Usuario', 'Prompt', 'Respuesta'],
    'Log_Actividad': ['ID_Log', 'ID_Usuario', 'Accion', 'Tabla_Afectada', 'Timestamp', 'Detalles'],
    'Convenios_Modificatorios': ['ID_Convenio_Mod', 'ID_Contrato', 'Numero_Convenio_Mod', 'Tipo_Modificacion', 'Nuevo_Monto_Con_IVA', 'Nueva_Fecha_Fin', 'Motivo', 'Link_Sharepoint'],
    'Anticipos': ['ID_Anticipo', 'ID_Contrato', 'Porcentaje_Otorgado', 'Monto_Anticipo', 'Fecha_Pago', 'Monto_Amortizado_Acumulado', 'Saldo_Por_Amortizar'],
    'Catalogo_Conceptos': ['ID_Concepto', 'ID_Contrato', 'Clave', 'Descripcion', 'Unidad', 'Cantidad_Contratada', 'Precio_Unitario', 'Importe_Total_Sin_IVA'],
    'Estimaciones': ['ID_Estimacion', 'ID_Contrato', 'No_Estimacion', 'Tipo_Estimacion', 'Periodo_Inicio', 'Periodo_Fin', 'Monto_Bruto_Estimado', 'Deduccion_Surv_05_Monto', 'Subtotal', 'IVA', 'Monto_Neto_A_Pagar', 'Avance_Acumulado_Anterior', 'Avance_Actual', 'Estado_Validacion', 'Link_Sharepoint'],
    'Facturas': ['ID_Factura', 'ID_Estimacion', 'Folio_Fiscal_UUID', 'No_Factura', 'Fecha_Emision', 'Monto_Facturado', 'Estatus_SAT', 'Link_Sharepoint'],
    'Deducciones_Retenciones': ['ID_Deduccion', 'ID_Estimacion', 'Tipo_Deduccion', 'Monto_Deducido', 'Concepto_Deduccion'],
    'Pagos_Emitidos': ['ID_Pago', 'ID_Estimacion', 'Fecha_Pago', 'Monto_Pagado', 'Referencia_Bancaria', 'Estatus_Pago'],
    'Detalle_Estimacion': ['ID_Detalle', 'ID_Estimacion', 'ID_Concepto', 'Cantidad_Estimada_Periodo', 'Precio_Unitario_Contrato', 'Importe_Este_Periodo', 'Avance_Acumulado_Porcentaje', 'Importe_Acumulado'],
    'Programa_Ejecucion': ['ID_Programa', 'ID_Concepto', 'Numero_Programa', 'Fecha_Inicio', 'Fecha_Fin', 'Monto_Programado', 'Avance_Programado_Pct', 'Link_Sharepoint']
};

function doGet() {
    return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('Sistema Institucional de Gestión - SGC')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Función inicializadora: Crea las 5 pestañas de la BD relacional si no existen y elimina deprecadas
 */
var _dbConfigured = false;
function configurarBaseDeDatos() {
    if (_dbConfigured) return;

    const lock = LockService.getScriptLock();
    // Wait up to 10 seconds for other processes to finish configuring DB
    try {
        lock.waitLock(10000);
    } catch (e) {
        console.warn("Could not obtain lock for DB setup, assuming it's already being configured.");
        return;
    }

    try {
        const ss = getSpreadsheet();

        // Eliminar hojas obsoletas
        const hojasObsoletas = ['Convenios', 'Estimaciones_Pagos'];
        hojasObsoletas.forEach(nombreHoja => {
            const hojaObsoleta = ss.getSheetByName(nombreHoja);
            if (hojaObsoleta) {
                ss.deleteSheet(hojaObsoleta);
            }
        });

        for (const tabla in ESQUEMA_BD) {
            let sheet = ss.getSheetByName(tabla);
            const expectedHeaders = ESQUEMA_BD[tabla];

            if (!sheet) {
                sheet = ss.insertSheet(tabla);
                sheet.appendRow(expectedHeaders);
                Logger.log(`[BD] Hoja '${tabla}' creada con éxito.`);
            } else {
                // Verificar si la hoja está completamente en blanco
                if (sheet.getLastRow() === 0) {
                    sheet.appendRow(expectedHeaders);
                } else {
                    // VALIDACIÓN DE COLUMNAS (Auto-Heal)
                    // Leer encabezados actuales
                    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0].map(h => String(h).trim());

                    // Encontrar campos faltantes según el esquema
                    const missingColumns = expectedHeaders.filter(h => !currentHeaders.includes(h));

                    if (missingColumns.length > 0) {
                        Logger.log(`[BD] Reparando tabla '${tabla}': agregando campos [${missingColumns.join(', ')}]`);
                        // Agregar las columnas faltantes al final del encabezado
                        const startCol = currentHeaders.length + 1;
                        sheet.getRange(1, startCol, 1, missingColumns.length).setValues([missingColumns]);
                    }
                }
            }
        }
        _dbConfigured = true;
    } finally {
        lock.releaseLock();
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
            configurarBaseDeDatos();
            const ss = getSpreadsheet();
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

                            let value = registro[header];
                            if (value === undefined || value === null) return '';

                            // Asegurar que los números se traten como numéricos para que la Tabla Nativa detecte Data Types correctos
                            if (typeof value === 'string' && value.trim() !== '') {
                                const parsed = Number(value);
                                if (!isNaN(parsed)) {
                                    value = parsed;
                                }
                            }
                            return value;
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



/**
 * Calcula dinámicamente el estatus de un contrato basado en las fechas actuales
 * siguiendo los principios del Art. 64 de la LOPSRM.
 */
function _actualizarEstatusDinamico(contrato) {
    if (!contrato.Fecha_Inicio_Obra || !contrato.Fecha_Fin_Obra) return contrato.Estado || 'POR INICIAR';

    // Si ya está finiquitado, es un estado terminal
    const estadoActual = String(contrato.Estado || '').toUpperCase();
    if (estadoActual === 'FINIQUITADO') return 'FINIQUITADO';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicio = new Date(contrato.Fecha_Inicio_Obra);
    const fin = new Date(contrato.Fecha_Fin_Obra);

    // Ajustar fechas para comparación (evitar desfases horaria)
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(0, 0, 0, 0);

    let nuevoEstado = contrato.Estado;

    if (hoy >= inicio && hoy <= fin) {
        nuevoEstado = 'VIGENTE';
    } else if (hoy > fin) {
        nuevoEstado = 'CIERRE ADMINISTRATIVO';
    } else if (hoy < inicio) {
        nuevoEstado = 'PROGRAMADO';
    }

    return nuevoEstado;
}

// ====================================================
// FUNCIONES CRUD PARA LA INTERFAZ WEB MANUAL (index.html)
// Exponiendo tabla Contratos
// ====================================================
// SQL-LIKE ORM BACKEND ENGINE
// Interactúa con cualquier pestaña definida en ESQUEMA_BD
// ====================================================

/**
 * Valida que la tabla solicitada exista en el esquema por seguridad
 */
function checkTableExists(tableName) {
    if (!ESQUEMA_BD[tableName]) {
        throw new Error(`Acceso Denegado: La tabla '${tableName}' no existe en el esquema.`);
    }
}

/**
 * Exponer el esquema a la UI para generar los controles dinámicos
 */
function getSchema() {
    return ESQUEMA_BD;
}

/**
 * SELECT * FROM tableName WHERE conditions
 * conditions es un objeto clave-valor. Si viene vacío {}, trae todo.
 */
function dbSelect(tableName, conditions = {}) {
    try {
        configurarBaseDeDatos();
        checkTableExists(tableName);

        const sheet = getSpreadsheet().getSheetByName(tableName);
        if (!sheet) return [];

        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return [];

        const headers = data[0].map(h => String(h).trim());
        let results = data.slice(1).map(row => {
            let record = {};
            headers.forEach((header, index) => {
                let cellValue = row[index];
                if (cellValue instanceof Date) {
                    cellValue = cellValue.toISOString().split('T')[0];
                } else if (typeof cellValue === 'string') {
                    // Prevenir bugs de serialización de google.script.run con saltos de línea y comillas extremas
                    cellValue = cellValue.replace(/\r?\n|\r|\u2028|\u2029/g, "  ").trim();
                }
                record[header] = cellValue;
            });

            // Lógica Especial para Contratos: Estatus Dinamico
            if (tableName === 'Contratos') {
                const estadoCalculado = _actualizarEstatusDinamico(record);
                if (estadoCalculado !== record.Estado) {
                    record.Estado = estadoCalculado;
                    // Opcional: Podríamos disparar un dbUpdate silencioso aquí para persistir en el Sheet
                    // pero por ahora lo dejamos dinámico en la consulta para velocidad.
                }
            }

            return record;
        });

        // Aplicar WHERE constraints de forma inclusiva
        const conditionKeys = Object.keys(conditions);
        if (conditionKeys.length > 0) {
            results = results.filter(record => {
                return conditionKeys.every(key => record[key] == conditions[key]);
            });
        }

        return results;
    } catch (e) {
        console.error(e);
        const errorMsg = DEBUG_MODE ? `[BACKEND ERROR: dbSelect] ${e.message}\nStack: ${e.stack}` : e.message;
        throw new Error(errorMsg);
    }
}

/**
 * INSERT INTO tableName (fields) VALUES (values)
 * Genera un UUID para el Primary Key (primer campo del schema) si no se provee.
 */
function dbInsert(tableName, dataObject) {
    try {
        configurarBaseDeDatos();
        checkTableExists(tableName);

        const sheet = getSpreadsheet().getSheetByName(tableName);
        const expectedHeaders = ESQUEMA_BD[tableName];

        // El primer campo en ESQUEMA_BD es siempre el ID primario
        const primaryKeyName = expectedHeaders[0];

        // Auto-numeric ID (1, 2, 3...) only if not explicitly provided by the caller
        if (!dataObject[primaryKeyName]) {
            let maxId = 0;
            if (sheet.getLastRow() > 1) {
                // Leer solo la primera columna (columna de IDs) para ser rápido
                const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
                maxId = ids.reduce((max, row) => {
                    const val = parseInt(row[0], 10);
                    return (!isNaN(val) && val > max) ? val : max;
                }, 0);
            }
            dataObject[primaryKeyName] = maxId + 1;
        }

        // Obtener headers ordenados tal cual están en la Hoja real en este momento
        let currentHeadersList = [[]];
        if (sheet.getLastRow() > 0) {
            currentHeadersList = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues();
        } else {
            // Si por alguna extraña razón estuviese vacía
            sheet.appendRow(expectedHeaders);
            currentHeadersList = [expectedHeaders];
        }

        const currentHeaders = currentHeadersList[0].map(h => String(h).trim());

        // Asegurar Caseteo
        const rowToInsert = currentHeaders.map(h => {
            let val = dataObject[h];
            if (val === undefined || val === null) return '';
            if (typeof val === 'string' && val.trim() !== '') {
                const num = Number(val);
                if (!isNaN(num)) val = num;
            }
            return val;
        });

        sheet.appendRow(rowToInsert);
        const savedId = dataObject[primaryKeyName];

        // Cascade insert for Details (e.g. Estimaciones -> Detalle_Estimacion)
        if (tableName === 'Estimaciones' && dataObject._Detalles) {
            try {
                // Decodificar Base64 de forma segura en Apps Script
                const decodedStr = Utilities.newBlob(Utilities.base64Decode(dataObject._Detalles)).getDataAsString();
                const detallesInfo = JSON.parse(decodedStr);

                detallesInfo.forEach(d => {
                    d.ID_Estimacion = savedId; // Link parent
                    // Delete PK if it exists so dbInsert creates a new one
                    if (d.ID_Detalle_Estimacion !== undefined) delete d.ID_Detalle_Estimacion;
                    dbInsert('Detalle_Estimacion', d);
                });
            } catch (errDet) {
                console.error("Error inserting detalles (JSON decode issue):", errDet);
            }
        }

        return { success: true, insertId: savedId };

    } catch (e) {
        console.error(e);
        const errorMsg = DEBUG_MODE ? `[BACKEND ERROR: dbInsert] ${e.message}\nStack: ${e.stack}` : e.message;
        throw new Error(errorMsg);
    }
}

/**
 * UPDATE tableName SET ... WHERE conditions
 * Escanea el sheet, encuentra TODOS los match según conditions, y pisa ESAS filas con los dataObject enviados.
 */
function dbUpdate(tableName, dataObject, conditions) {
    try {
        checkTableExists(tableName);
        if (!conditions || Object.keys(conditions).length === 0) {
            throw new Error("Peligro: Intento de UPDATE masivo sin cláusula WHERE bloqueado por seguridad.");
        }

        const sheet = getSpreadsheet().getSheetByName(tableName);
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return { success: false, rowsAffected: 0 };

        const currentHeaders = data[0].map(h => String(h).trim());
        const conditionKeys = Object.keys(conditions);
        let rowsAffected = 0;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Evaluar WHERE match
            const isMatch = conditionKeys.every(condKey => {
                const colIdx = currentHeaders.indexOf(condKey);
                // Conversión flexible para igualaciones numéricas/string
                return colIdx !== -1 && row[colIdx] == conditions[condKey];
            });

            if (isMatch) {
                // Preparamos la data que va a aplastar a la existente
                const arrayValoresActualizados = currentHeaders.map((headerText, index) => {
                    // Si mandaron algo nuevo para esa columna, castea. Si no, conserva el viejo de `row`
                    if (dataObject[headerText] !== undefined && dataObject[headerText] !== null) {
                        let objVal = dataObject[headerText];
                        if (typeof objVal === 'string' && objVal.trim() !== '') {
                            const num = Number(objVal);
                            if (!isNaN(num)) objVal = num;
                        }
                        return objVal;
                    }
                    return row[index];
                });

                sheet.getRange(i + 1, 1, 1, currentHeaders.length).setValues([arrayValoresActualizados]);
                rowsAffected++;
            }
        }

        return { success: true, rowsAffected: rowsAffected };

    } catch (e) {
        console.error(e);
        const errorMsg = DEBUG_MODE ? `[BACKEND ERROR: dbUpdate] ${e.message}\nStack: ${e.stack}` : e.message;
        throw new Error(errorMsg);
    }
}

/**
 * DELETE FROM tableName WHERE conditions
 */
function dbDelete(tableName, conditions) {
    try {
        checkTableExists(tableName);
        if (!conditions || Object.keys(conditions).length === 0) {
            throw new Error("Peligro: Intento de DELETE masivo sin cláusula WHERE bloqueado por seguridad.");
        }

        const sheet = getSpreadsheet().getSheetByName(tableName);
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) return { success: true, rowsDeleted: 0 };

        const currentHeaders = data[0].map(h => String(h).trim());
        const conditionKeys = Object.keys(conditions);
        let rowsDeleted = 0;

        // Iterar de reversa es muy importante al hacer deleteRow para no saltar índices
        for (let i = data.length - 1; i >= 1; i--) {
            const row = data[i];

            const isMatch = conditionKeys.every(condKey => {
                const colIdx = currentHeaders.indexOf(condKey);
                return colIdx !== -1 && row[colIdx] == conditions[condKey];
            });

            if (isMatch) {
                sheet.deleteRow(i + 1);
                rowsDeleted++;
            }
        }

        return { success: true, rowsDeleted: rowsDeleted };
    } catch (e) {
        console.error(e);
        const errorMsg = DEBUG_MODE ? `[BACKEND ERROR: dbDelete] ${e.message}\nStack: ${e.stack}` : e.message;
        throw new Error(errorMsg);
    }
}

/**
 * Borrado en Cascada para Proyectos (Contratos).
 * Al borrar un contrato, busca y destruye todos sus registros derivados en las 11 tablas.
 */
function dbDeleteCascade(tableName, conditions) {
    try {
        if (tableName !== 'Contratos') {
            // Si no es contrato, hacer delete estándar
            return dbDelete(tableName, conditions);
        }

        const idContrato = conditions['ID_Contrato'];
        if (!idContrato) throw new Error("ID_Contrato requerido para borrado en cascada.");

        let totalDeleted = 0;

        // 1. Obtener Estimaciones asociadas para borrar SUS hijos primero (Detalles, Facturas, Pagos, Deducciones)
        const estimaciones = dbSelect('Estimaciones', { 'ID_Contrato': idContrato });

        estimaciones.forEach(est => {
            const idEst = est.ID_Estimacion;
            const resDet = dbDelete('Detalle_Estimacion', { 'ID_Estimacion': idEst });
            const resFac = dbDelete('Facturas', { 'ID_Estimacion': idEst });
            const resPag = dbDelete('Pagos_Emitidos', { 'ID_Estimacion': idEst });
            const resDed = dbDelete('Deducciones_Retenciones', { 'ID_Estimacion': idEst });
            totalDeleted += resDet.rowsDeleted + resFac.rowsDeleted + resPag.rowsDeleted + resDed.rowsDeleted;
        });

        // 2. Borrar las Estimaciones en sí
        const resEst = dbDelete('Estimaciones', { 'ID_Contrato': idContrato });
        totalDeleted += resEst.rowsDeleted;

        // 3. Borrar Catálogo de Conceptos, Anticipos, Convenios Modificatorios
        const resCat = dbDelete('Catalogo_Conceptos', { 'ID_Contrato': idContrato });
        const resAnt = dbDelete('Anticipos', { 'ID_Contrato': idContrato });
        const resMod = dbDelete('Convenios_Modificatorios', { 'ID_Contrato': idContrato });
        totalDeleted += resCat.rowsDeleted + resAnt.rowsDeleted + resMod.rowsDeleted;

        // 4. Finalmente, borrar el Contrato Raíz
        const resRoot = dbDelete('Contratos', { 'ID_Contrato': idContrato });
        totalDeleted += resRoot.rowsDeleted;

        return { success: true, rowsDeleted: totalDeleted, message: "Cascade ok" };

    } catch (error) {
        const errorDetail = DEBUG_MODE ? `${error.message}\nStack: ${error.stack}` : error.message;
        Logger.log(`[dbDeleteCascade] Error en tabla ${tableName}: ${errorDetail}`);
        throw new Error(errorDetail);
    }
}
