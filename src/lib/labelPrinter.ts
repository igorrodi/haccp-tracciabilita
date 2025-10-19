import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

interface LotData {
  internal_lot_number?: string;
  lot_number: string;
  production_date: string;
  expiry_date?: string;
  product_name: string;
}

interface PrinterSettings {
  label_width: number;
  label_height: number;
  include_qr_code: boolean;
  include_barcode: boolean;
  include_product_name: boolean;
  include_lot_number: boolean;
  include_expiry_date: boolean;
  include_production_date: boolean;
  font_size: string;
}

export const generateLabelHTML = (lot: LotData, settings: PrinterSettings): string => {
  const fontSize = settings.font_size === 'small' ? '10px' : 
                   settings.font_size === 'large' ? '16px' : '12px';
  
  const qrData = JSON.stringify({
    lotto_interno: lot.internal_lot_number,
    lotto_originale: lot.lot_number,
    prodotto: lot.product_name,
    produzione: lot.production_date,
    scadenza: lot.expiry_date || 'N/A',
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: ${settings.label_width}mm ${settings.label_height}mm;
            margin: 2mm;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: ${fontSize};
            margin: 0;
            padding: 4mm;
            width: ${settings.label_width}mm;
            height: ${settings.label_height}mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            font-weight: bold;
            margin-bottom: 2mm;
          }
          .content {
            flex: 1;
          }
          .row {
            margin: 1mm 0;
          }
          .qr-code {
            text-align: center;
            margin-top: 2mm;
          }
          .barcode {
            text-align: center;
            font-family: 'Libre Barcode 128', cursive;
            font-size: 24px;
            margin-top: 2mm;
          }
        </style>
      </head>
      <body>
        <div class="content">
          ${settings.include_product_name ? `
            <div class="header">${lot.product_name}</div>
          ` : ''}
          
          ${settings.include_lot_number ? `
            <div class="row">
              <strong>Lotto:</strong> ${lot.internal_lot_number || lot.lot_number}
            </div>
          ` : ''}
          
          ${settings.include_production_date ? `
            <div class="row">
              <strong>Produzione:</strong> ${format(new Date(lot.production_date), 'dd/MM/yyyy')}
            </div>
          ` : ''}
          
          ${settings.include_expiry_date && lot.expiry_date ? `
            <div class="row">
              <strong>Scadenza:</strong> ${format(new Date(lot.expiry_date), 'dd/MM/yyyy')}
            </div>
          ` : ''}
        </div>
        
        ${settings.include_qr_code ? `
          <div class="qr-code">
            <svg id="qr-code" width="60" height="60"></svg>
          </div>
        ` : ''}
        
        ${settings.include_barcode ? `
          <div class="barcode">
            *${lot.internal_lot_number || lot.lot_number}*
          </div>
        ` : ''}
        
        ${settings.include_qr_code ? `
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.getElementById('qr-code'), ${JSON.stringify(qrData)}, {
              width: 60,
              margin: 0
            });
          </script>
        ` : ''}
      </body>
    </html>
  `;
};

export const printLabel = async (lot: LotData, settings: PrinterSettings): Promise<void> => {
  const labelHTML = generateLabelHTML(lot, settings);
  
  // Create a hidden iframe for printing
  const printFrame = document.createElement('iframe');
  printFrame.style.display = 'none';
  document.body.appendChild(printFrame);
  
  const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!frameDoc) {
    throw new Error('Impossibile creare il frame di stampa');
  }
  
  frameDoc.open();
  frameDoc.write(labelHTML);
  frameDoc.close();
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Print
  printFrame.contentWindow?.print();
  
  // Clean up after printing
  setTimeout(() => {
    document.body.removeChild(printFrame);
  }, 1000);
};