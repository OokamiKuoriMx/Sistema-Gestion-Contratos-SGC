// ---------------------------------------------------------
// CONFIGURACIÓN DEL AGENTE IA SGC (GOOGLE APPS SCRIPT)
// ---------------------------------------------------------
// Reemplazar por tu clave de API de Google Gemini obtenida en Google AI Studio
var GEMINI_API_KEY = "TU_API_KEY_AQUI";

const INSTRUCCION_SISTEMA = `
Rol y Objetivo:
Eres un Agente de Inteligencia Artificial experto en procesamiento de documentos legales y financieros (Contratos, Convenios, Programas de Ejecución y Solicitudes de Pago). Tu objetivo es extraer datos estructurados de archivos PDF y DOCX mediante comprensión semántica, vincular la información de forma relacional y estructurarla en un formato JSON estandarizado para ser enviado a una base de datos en Google Apps Script.

Contexto del Negocio:
El sistema administra la cartera de contratos de una dependencia gubernamental. Los contratos de obra pública o servicios están financiados por Convenios de Apoyo Financiero. A su vez, los contratos tienen Programas de Ejecución y generan Estimaciones de Pago. 

Estructura de la Base de Datos (4 Tablas Relacionales a generar en objeto de salida):
1. Convenios: ID_Convenio, Numero_Acuerdo, Monto_Apoyo, Vigencia_Fin, Objeto_Programa, Proyectos_Asociados.
2. Contratos: ID_Contrato, Numero_Contrato, ID_Convenio_Vinculado, Contratista, RFC_Contratista, Objeto_Contrato, Monto_Sin_IVA, Monto_Total_Con_IVA, Fecha_Inicio, Fecha_Fin.
3. Programa_Ejecucion: ID_Programa, ID_Contrato, Clave_Concepto_Periodo, Descripcion, Unidad, Cantidad, Precio_Unitario, Importe_Total.
4. Estimaciones_Pagos: ID_Pago, ID_Contrato, No_Estimacion, Folio_Factura, Fecha_Factura, Periodo_Inicio, Periodo_Fin, Monto_Bruto, Deducciones, Monto_Neto_A_Pagar, Beneficiario, Cuenta_CLABE.

Extracción y Limpieza: 
- Extrae montos a número flotante sin '$' ni ','.
- Fechas a YYYY-MM-DD (ISO).
- Valida sumas y deducciones.

Output: Extrae estrictamente un objeto JSON:
{
  "accion": "importar_datos",
  "datos": {
    "Contratos": [...],
    "Convenios": [...],
    "Programa_Ejecucion": [...],
    "Estimaciones_Pagos": [...]
  }
}
`;

/**
 * Función llamada desde el frontend para leer el archivo con Gemini y guardar
 */
function processDocumentWithAI(base64Data, mimeType) {
    try {
        if (!base64Data || !mimeType) {
            throw new Error("Datos del archivo o MimeType faltantes.");
        }

        // 1. Preparar payload para Gemini
        // El frontend nos enviará data:application/pdf;base64,JVBER... así que extraemos sólo el base 64
        let b64 = base64Data;
        if (b64.includes('base64,')) {
            b64 = b64.split('base64,')[1];
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
                            text: "Lee este archivo oficial. Debes generar estrictamente un objeto JSON estructurado con arrays para las tablas correspondientes basándote en la información encontrada."
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
 * Función auxiliar para insertar los datos en las pestañas como hace el webhook.
 */
function guardarDatosIA(datos) {
    initTablas(); // Se asume que initTablas y ESQUEMA_BD existen en Code.gs en un entorno global de GAS
    const ss = SpreadsheetApp.openById(SHEET_ID); // SHEET_ID también declarado en Code.gs
    let resultados = {};

    const tablas = Object.keys(ESQUEMA_BD);
    tablas.forEach(tabla => {
        if (datos[tabla] && Array.isArray(datos[tabla])) {
            const sheet = ss.getSheetByName(tabla);
            const headers = ESQUEMA_BD[tabla];
            let insertados = 0;

            datos[tabla].forEach(registro => {
                const row = headers.map(header => {
                    if (header.startsWith('ID_') && header === headers[0] && !registro[header]) {
                        registro[header] = Utilities.getUuid();
                    }
                    return registro[header] !== undefined ? registro[header] : '';
                });
                sheet.appendRow(row);
                insertados++;
            });
            resultados[tabla] = insertados;
        }
    });

    return {
        success: true,
        message: "Procesamiento IA relacional completado con éxito",
        detalles: resultados
    };
}
