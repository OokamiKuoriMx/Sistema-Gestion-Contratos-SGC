// ---------------------------------------------------------
// CONFIGURACIÓN DEL AGENTE IA SGC (GOOGLE APPS SCRIPT)
// ---------------------------------------------------------
// Reemplazar por tu clave de API de Google Gemini obtenida en Google AI Studio
var GEMINI_API_KEY = "AIzaSyDIUgIeUFyC9b-ze7lR99AkObdXKWilS2k";

const INSTRUCCION_SISTEMA = `
Rol y Objetivo:
Eres un Agente de Inteligencia Artificial experto en procesamiento de documentos legales y financieros de obra pública (Contratos, Convenios, Programas y Estimaciones). Tu objetivo es extraer datos estructurados, vincular la información relacional y entregar un JSON estandarizado.

Contexto del Negocio:
Administramos contratos financiados por Convenios. Los contratos tienen Catálogos de Conceptos, Programas de Ejecución y generan Estimaciones (que pueden incluir varios conceptos a la vez).

Estructura de la Base de Datos (Esquema obligatorio en JSON de salida):
1. Convenios_Recurso: ID_Convenio, Numero_Acuerdo, Nombre_Fondo, Monto_Apoyo, Fecha_Firma, Vigencia_Fin, Objeto_Programa, Estado, Link_Sharepoint.
2. Contratistas: ID_Contratista, Razon_Social, RFC, Domicilio_Fiscal, Representante_Legal, Telefono, Banco, Cuenta_Bancaria, Cuenta_CLABE.
3. Contratos: ID_Contrato, Numero_Contrato, ID_Convenio_Vinculado, ID_Contratista, Objeto_Contrato, Monto_Total_Sin_IVA, Monto_Total_Con_IVA, Fecha_Firma, Fecha_Inicio_Obra, Fecha_Fin_Obra, Estado, Retencion_Vigilancia_Pct, Retencion_Garantia_Pct, Otras_Retenciones_Pct, Link_Sharepoint.
4. Convenios_Modificatorios: ID_Convenio_Mod, ID_Contrato, Numero_Convenio_Mod, Tipo_Modificacion, Nuevo_Monto_Con_IVA, Nueva_Fecha_Fin, Motivo, Link_Sharepoint.
5. Anticipos: ID_Anticipo, ID_Contrato, Porcentaje_Otorgado, Monto_Anticipo, Fecha_Pago, Monto_Amortizado_Acumulado, Saldo_Por_Amortizar.
6. Catalogo_Conceptos: ID_Concepto, ID_Contrato, Clave, Descripcion, Unidad, Cantidad_Contratada, Precio_Unitario, Importe_Total_Sin_IVA.
7. Estimaciones: ID_Estimacion, ID_Contrato, No_Estimacion, Tipo_Estimacion, Periodo_Inicio, Periodo_Fin, Monto_Bruto_Estimado, Deduccion_Surv_05_Monto, Subtotal, IVA, Monto_Neto_A_Pagar, Avance_Acumulado_Anterior, Avance_Actual, Estado_Validacion, Link_Sharepoint.
8. Facturas: ID_Factura, ID_Estimacion, Folio_Fiscal_UUID, No_Factura, Fecha_Emision, Monto_Facturado, Estatus_SAT, Link_Sharepoint.
9. Deducciones_Retenciones: ID_Deduccion, ID_Estimacion, Tipo_Deduccion, Monto_Deducido, Concepto_Deduccion.
10. Pagos_Emitidos: ID_Pago, ID_Estimacion, Fecha_Pago, Monto_Pagado, Referencia_Bancaria, Estatus_Pago.
11. Detalle_Estimacion: ID_Detalle, ID_Estimacion, ID_Concepto, Cantidad_Estimada_Periodo, Precio_Unitario_Contrato, Importe_Este_Periodo, Avance_Acumulado_Porcentaje, Importe_Acumulado.
12. Programa_Ejecucion: ID_Programa, ID_Concepto, Numero_Programa, Fecha_Inicio, Fecha_Fin, Monto_Programado, Avance_Programado_Pct, Link_Sharepoint.

Reglas Críticas de Extracción (ESTIMACIONES):
- MULTI-CONCEPTO: Una estimación (ID_Estimacion) se vincula al Contrato (ID_Contrato). Los conceptos específicos ejecutados van en 'Detalle_Estimacion' vinculados por 'ID_Concepto'.
- DEDUCCIÓN 0.5%: Si el documento menciona una retención por "Vigilancia", "Inspección de Obras" o similar del 0.5%, guarda el monto en 'Deduccion_Surv_05_Monto'.
- AVANCES: Extrae el 'Avance_Acumulado_Anterior' (monto acumulado antes de esta estimación) y 'Avance_Actual' (monto de esta estimación).
- COMPARACIÓN: No puedes validar contra el programa aquí, pero asegúrate de extraer los montos y cantidades tal cual aparecen en el documento.

Reglas Generales:
- Vínculo por ID: Usa 'ID_Concepto' para unir Catálogo, Programa y Detalle de Estimación.
- Fechas: Formato YYYY-MM-DD.
- Estados: Usa solo nombres de estados de México en MAYÚSCULAS.
- Link_Sharepoint: Si encuentras una URL de SharePoint o OneDrive en el texto, asígnala al campo correspondiente.

Output: JSON estricto:
{
  "accion": "importar_datos",
  "datos": {
    "Convenios_Recurso": [...],
    "Contratistas": [...],
    "Contratos": [...],
    "Convenios_Modificatorios": [...],
    "Anticipos": [...],
    "Catalogo_Conceptos": [...],
    "Programa_Ejecucion": [...],
    "Estimaciones": [...],
    "Facturas": [...],
    "Deducciones_Retenciones": [...],
    "Pagos_Emitidos": [...],
    "Detalle_Estimacion": [...]
  }
}
`;

/**
 * Función llamada desde el frontend para leer el archivo con Gemini y guardar
 */
function processDocumentWithAI(base64Data, mimeType, targetTable = null, parentContext = null) {
    try {
        if (!base64Data || !mimeType) {
            throw new Error("Datos del archivo o MimeType faltantes.");
        }

        // 1. Preparar payload para Gemini
        let b64 = base64Data;
        if (b64.includes('base64,')) {
            b64 = b64.split('base64,')[1];
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        let promptAdicional = `Lee este archivo oficial. Debes generar estrictamente un objeto JSON estructurado con arrays para las tablas correspondientes basándote en la información encontrada.`;
        if (targetTable) {
            promptAdicional += `\n\nATENCIÓN: El usuario subió este documento desde el contexto de la tabla '${targetTable}'. Enfócate PRINCIPALMENTE en extraer los datos correspondientes a la estructura de la tabla '${targetTable}'.`;
            if (parentContext) {
                promptAdicional += `\n\nCONTEXTO ADICIONAL: El registro padre tiene esta información: ${JSON.stringify(parentContext)}. Asegúrate de usar estos IDs para vincular los registros hijo que encuentres.`;
            }
        }

        const payload = {
            system_instruction: {
                parts: [{ text: INSTRUCCION_SISTEMA }]
            },
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: b64
                            }
                        },
                        {
                            text: promptAdicional
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.0,
                responseMimeType: "application/json"
            }
        };

        const options = {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        };

        // 2. Enviar a Gemini API usando el servicio REST de Apps Script
        const response = UrlFetchApp.fetch(url, options);
        const resultText = response.getContentText();
        const resultJson = JSON.parse(resultText);

        if (response.getResponseCode() !== 200) {
            throw new Error("HTTP " + response.getResponseCode() + " - " + (resultJson.error?.message || resultText));
        }

        // 3. Extraer respuesta (Es JSON texto, así que hay que parsearlo)
        const llmJsonString = resultJson.candidates[0].content.parts[0].text;
        const datosExtraidos = JSON.parse(llmJsonString);

        // 4. Procesar y guardar en BD
        if (datosExtraidos.accion === "importar_datos" && datosExtraidos.datos) {
            return guardarDatosIA(datosExtraidos.datos);
        } else {
            throw new Error("El formato JSON devuelto por la IA no corresponde al solicitado.");
        }

    } catch (e) {
        console.error(e);
        return { success: false, message: e.toString() };
    }
}

/**
 * Función auxiliar para insertar y actualizar los datos en las pestañas como hace el webhook.
 * Realiza un chequeo de existencia (UPSERT) para evitar records duplicados desde la IA.
 */
function guardarDatosIA(datos) {
    configurarBaseDeDatos(); // Ensure ESQUEMA_BD is loaded
    let resultados = { insertados: 0, actualizados: 0 };

    // Jerarquía de inserción (Padres primero, Hijos después) para resolver llaves foráneas
    const jerarquia = [
        'Convenios_Recurso',
        'Contratistas',
        'Contratos',
        'Convenios_Modificatorios',
        'Anticipos',
        'Catalogo_Conceptos',
        'Programa_Ejecucion',
        'Estimaciones',
        'Facturas',
        'Deducciones_Retenciones',
        'Pagos_Emitidos',
        'Detalle_Estimacion'
    ];

    // Mapa de traducción de IDs: Si la IA generó un "ID_Contrato": "temp_1", y dbInsert le asignó el entero 15, guardamos { "temp_1": 15 }
    const mapaIds = {};

    jerarquia.forEach(tabla => {
        if (datos[tabla] && Array.isArray(datos[tabla])) {
            const headers = ESQUEMA_BD[tabla];
            const pkName = headers[0];

            let skName = null;
            if (tabla === 'Contratistas') skName = 'RFC';
            else if (tabla === 'Contratos') skName = 'Numero_Contrato';
            else if (tabla === 'Facturas') skName = 'Folio_Fiscal_UUID';
            else if (tabla === 'Estimaciones') skName = 'No_Estimacion';
            else if (tabla === 'Convenios_Recurso') skName = 'Numero_Acuerdo';

            datos[tabla].forEach(registro => {
                // --- SANITIZACIÓN DE CAMPOS (MAPPING FALLBACK) ---
                if (tabla === 'Catalogo_Conceptos') {
                    if (registro.Clave_Concepto && !registro.Clave) registro.Clave = registro.Clave_Concepto;
                    if (registro.Descripcion_Concepto && !registro.Descripcion) registro.Descripcion = registro.Descripcion_Concepto;
                    if (registro.Unidad_Medida && !registro.Unidad) registro.Unidad = registro.Unidad_Medida;
                }

                // 1. Reemplazar llaves foráneas con literales reales usando nuestro mapa (ej. Contrato "temp_1" -> 15)
                Object.keys(registro).forEach(k => {
                    if (k.startsWith('ID_') && k !== pkName && mapaIds[registro[k]]) {
                        registro[k] = mapaIds[registro[k]];
                    }
                });

                if (tabla === 'Estimaciones' && registro.ID_Contrato) {
                    // Fetch contract to get its retention parameters
                    const contrato = dbSelect('Contratos', { ID_Contrato: registro.ID_Contrato });
                    if (contrato && contrato.length > 0) {
                        const c = contrato[0];
                        const bruto = parseFloat(registro.Monto_Bruto_Estimado) || 0;

                        if (bruto > 0) {
                            // Surveillance (Vigilancia)
                            const pctVig = parseFloat(c.Retencion_Vigilancia_Pct) || 0.005; // Default 0.5% if not set
                            if (!registro.Deduccion_Surv_05_Monto || registro.Deduccion_Surv_05_Monto == 0) {
                                registro.Deduccion_Surv_05_Monto = (bruto * (pctVig / 100)).toFixed(2);
                            }

                            // You could add other retentions here as separate fields or deducciones records
                        }
                    }

                    // Auto-calculate Subtotal/Net if possible
                    const bruto = parseFloat(registro.Monto_Bruto_Estimado) || 0;
                    if (!registro.Subtotal && bruto > 0) {
                        const ded = parseFloat(registro.Deduccion_Surv_05_Monto) || 0;
                        registro.Subtotal = (bruto - ded).toFixed(2);
                    }
                }

                let match = null;
                const idOriginalDadoPorIA = registro[pkName];

                if (registro[pkName] && typeof registro[pkName] !== 'string' && typeof registro[pkName] !== 'number') {
                    delete registro[pkName]; // Limpiar basuras
                }

                if (registro[pkName]) {
                    const cond = {}; cond[pkName] = registro[pkName];
                    const res = dbSelect(tabla, cond);
                    if (res && res.length > 0) match = res[0];
                }

                if (!match && skName && registro[skName]) {
                    const cond = {}; cond[skName] = registro[skName];
                    const res = dbSelect(tabla, cond);
                    if (res && res.length > 0) {
                        match = res[0];
                        registro[pkName] = match[pkName];
                    }
                }

                // --- COMPOSITE UNIQUE CHECKS FOR MASS IMPORTERS ---
                if (!match) {
                    if (tabla === 'Catalogo_Conceptos' && registro.Clave && registro.ID_Contrato) {
                        const res = dbSelect(tabla, { Clave: registro.Clave, ID_Contrato: registro.ID_Contrato });
                        if (res && res.length > 0) {
                            match = res[0];
                            registro[pkName] = match[pkName];
                        }
                    }
                    else if (tabla === 'Estimaciones' && registro.No_Estimacion && registro.ID_Contrato) {
                        const res = dbSelect(tabla, { No_Estimacion: registro.No_Estimacion, ID_Contrato: registro.ID_Contrato });
                        if (res && res.length > 0) {
                            match = res[0];
                            registro[pkName] = match[pkName];
                        }
                    }
                    else if (tabla === 'Detalle_Estimacion' && registro.ID_Estimacion && registro.ID_Concepto) {
                        const res = dbSelect(tabla, { ID_Estimacion: registro.ID_Estimacion, ID_Concepto: registro.ID_Concepto });
                        if (res && res.length > 0) {
                            match = res[0];
                            registro[pkName] = match[pkName];
                        }
                    }
                }

                if (match) {
                    const cond = {}; cond[pkName] = registro[pkName];
                    const dataMerged = { ...match };
                    Object.keys(registro).forEach(k => {
                        if (registro[k] !== undefined && registro[k] !== null && registro[k] !== '') {
                            dataMerged[k] = registro[k];
                        }
                    });
                    dbUpdate(tabla, dataMerged, cond);
                    resultados.actualizados++;

                    // Guardar mapa por si había un ID temporal
                    if (idOriginalDadoPorIA) mapaIds[idOriginalDadoPorIA] = match[pkName];

                } else {
                    // Limpiar el PK temporal para que Code.gs asigne el consecutivo numérico real
                    if (idOriginalDadoPorIA) {
                        delete registro[pkName];
                    }

                    const resInsert = dbInsert(tabla, registro);
                    resultados.insertados++;

                    // Registrar el nuevo ID real para actualizar a los hijos que iterarán después
                    if (idOriginalDadoPorIA && resInsert.success && resInsert.insertId) {
                        mapaIds[idOriginalDadoPorIA] = resInsert.insertId;
                    }
                }
            });
        }
    });

    return {
        success: true,
        message: "Procesamiento IA completado con UPSERT Inteligente",
        detalles: resultados
    };
}
