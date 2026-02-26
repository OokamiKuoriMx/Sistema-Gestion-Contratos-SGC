import os
import json
import requests
import base64
from google import genai
from google.genai import types

# ---------------------------------------------------------
# CONFIGURACIÓN DEL AGENTE SGC
# ---------------------------------------------------------
# Reemplazar por tu clave de API de Google Gemini obtenida en Google AI Studio
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "TU_API_KEY_AQUI")

# Reemplazar por la URL "Implementada" como Aplicación Web desde Google Apps Script
URL_WEBHOOK_GAS = "DIRECCION_WEBHOOK_APPS_SCRIPT_AQUI" 

INSTRUCCION_SISTEMA = """
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
"""

def analizar_y_exportar(file_path):
    print(f"📄 Abriendo documento para extracción IA: {file_path}")
    
    # 1. Iniciar cliente AI Gemini
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print("❌ Error de configuración. Verifica que tienes instalada la librería: pip install google-genai")
        return
    
    try:
        # 2. Subir Archivo a API de Gemini (Soporta PDF)
        print("☁️  Subiendo documento físico a la nube del agente...")
        # NOTA: Para modelos avanzados puede requerir usar el client.files.upload si el archivo es grande.
        # Aquí procedemos subiendo el binario directo o mediante Base64 según recomendación GenAI SDK
        
        file_to_upload = client.files.upload(file=file_path)
        print("✅ Documento en contexto. Comenzando análisis semántico relacional...")
        
        # 3. Llamar al Agente IA con la Prompt Relacional (Flash 2.5)     
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                file_to_upload,
                "Lee este archivo oficial. Debes generar estrictamente un objeto JSON estructurado con arrays para las tablas correspondientes basándote en la información encontrada."
            ],
            config=types.GenerateContentConfig(
                system_instruction=INSTRUCCION_SISTEMA,
                temperature=0.0,  # Conservador para datos legales-financieros
                response_mime_type="application/json",
            )
        )
        
        output_txt = response.text
        print("✅ Análisis JSON extraído de forma exitosa.")
        
        # Opcional, validar JSON antes de enviar
        datos = json.loads(output_txt)
        
        print("\n🚀 Enviando JSON mapeado al Webhook de tu BD en Apps Script...")
        
        # 4. Enviar a Google Sheets vía Webhook doPost
        headers = {'Content-Type': 'application/json'}
        respuesta_webhook = requests.post(URL_WEBHOOK_GAS, json=datos, headers=headers)
        
        if respuesta_webhook.status_code == 200:
            print("====================================")
            print("🟢 SINCRONIZACIÓN Apps Script EXITOSA")
            try:
                print(json.dumps(respuesta_webhook.json(), indent=2, ensure_ascii=False))
            except:
                print(respuesta_webhook.text)
            print("====================================")
        else:
            print(f"❌ Error HTTP Webhook: {respuesta_webhook.status_code} - {respuesta_webhook.text}")
            
    except Exception as e:
         print(f"❌ Excepción durante la operación del agente: {str(e)}")

if __name__ == "__main__":
    print("🤖 BIENVENIDO AL AGENTE IA SGC 🤖")
    ruta = input("Ingresa la ruta ABSOLUTA de tu archivo PDF o DOCX a analizar: ")
    
    if os.path.isfile(ruta):
        analizar_y_exportar(ruta)
    else:
        print("❌ Archivo no encontrado. Revisa la ruta o permisos del sistema Windows.")
