const SHEET_ID = 'TU_ID_DE_HOJA_DE_CALCULO_AQUI'; // Reemplazar con el ID real del Google Sheet
const SHEET_NAME = 'Contratos';

function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Sistema de Gestión de Contratos')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Numero', 'Cliente', 'Monto', 'FechaInicio', 'FechaFin', 'Estado']);
  }
  return sheet;
}

function getContracts() {
  try {
    const sheet = getSheet();
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
    throw new Error("Error al leer los datos de la hoja de cálculo.");
  }
}

function saveContract(contractData) {
  try {
    const sheet = getSheet();
    
    if (!contractData.ID) {
      contractData.ID = Utilities.getUuid();
      sheet.appendRow([
        contractData.ID,
        contractData.Numero,
        contractData.Cliente,
        contractData.Monto,
        contractData.FechaInicio,
        contractData.FechaFin,
        contractData.Estado || 'Activo'
      ]);
    } else {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIndex = headers.indexOf('ID');
      
      for (let i = 1; i < data.length; i++) {
          if (data[i][idIndex] === contractData.ID) {
              let rowToUpdate = i + 1;
              sheet.getRange(rowToUpdate, 1, 1, headers.length).setValues([[
                  contractData.ID,
                  contractData.Numero,
                  contractData.Cliente,
                  contractData.Monto,
                  contractData.FechaInicio,
                  contractData.FechaFin,
                  contractData.Estado
              ]]);
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
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIndex = headers.indexOf('ID');
    
    for (let i = 1; i < data.length; i++) {
        if (data[i][idIndex] === id) {
            sheet.deleteRow(i + 1);
            return true;
        }
    }
    return false;
  } catch (e) {
    console.error(e);
    throw new Error("Error al eliminar el contrato.");
  }
}
