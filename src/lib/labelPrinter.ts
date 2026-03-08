import { format } from 'date-fns';
import { pb } from '@/lib/pocketbase';

export interface LotData {
  internal_lot_number?: string;
  lot_number: string;
  production_date: string;
  expiry_date?: string;
  product_name: string;
  is_frozen?: boolean;
  freezing_date?: string;
}

export interface PrinterSettings {
  label_width: number;
  label_height: number;
  include_qr_code: boolean;
  include_barcode: boolean;
  include_product_name: boolean;
  include_lot_number: boolean;
  include_expiry_date: boolean;
  include_production_date: boolean;
  include_freezing_date: boolean;
  font_size: string;
  printer_connection_type?: string;
  printer_vendor_id?: number;
  printer_product_id?: number;
  printer_ip_address?: string;
  cups_printer_name?: string;
  custom_layout?: any;
}

// Label format presets
export const LABEL_PRESETS = [
  { name: '100 × 50 mm (Standard)', width: 100, height: 50 },
  { name: '80 × 30 mm (Piccola)', width: 80, height: 30 },
  { name: '60 × 40 mm (Compatta)', width: 60, height: 40 },
  { name: '100 × 70 mm (Grande)', width: 100, height: 70 },
  { name: '62 × 29 mm (Brother)', width: 62, height: 29 },
  { name: '89 × 36 mm (Dymo)', width: 89, height: 36 },
  { name: '54 × 25 mm (Dymo piccola)', width: 54, height: 25 },
  { name: '62 × 100 mm (Brother larga)', width: 62, height: 100 },
];

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

  // If custom layout exists, use positioned elements
  const useCustomLayout = settings.custom_layout && Array.isArray(settings.custom_layout);

  let contentHTML = '';

  if (useCustomLayout) {
    const fields = settings.custom_layout;
    for (const field of fields) {
      if (!field.enabled) continue;
      let text = '';
      switch (field.id) {
        case 'product_name': text = lot.product_name; break;
        case 'lot_number': text = `Lotto: ${lot.internal_lot_number || lot.lot_number}`; break;
        case 'production_date': text = `Produzione: ${format(new Date(lot.production_date), 'dd/MM/yyyy')}`; break;
        case 'expiry_date': text = lot.expiry_date ? `Scadenza: ${format(new Date(lot.expiry_date), 'dd/MM/yyyy')}` : ''; break;
        case 'freezing_date': text = (lot.is_frozen && lot.freezing_date) ? `Congelato: ${format(new Date(lot.freezing_date), 'dd/MM/yyyy')}` : ''; break;
        case 'qr_code': text = '[QR]'; break;
        case 'barcode': text = `*${lot.internal_lot_number || lot.lot_number}*`; break;
      }
      if (!text) continue;

      const posX = (field.x / 300) * settings.label_width;
      const posY = (field.y / 200) * settings.label_height;

      if (field.id === 'barcode') {
        contentHTML += `<div style="position:absolute;left:${posX}mm;top:${posY}mm;font-family:'Libre Barcode 128',cursive;font-size:24px;">${text}</div>`;
      } else if (field.id === 'qr_code') {
        contentHTML += `<div style="position:absolute;left:${posX}mm;top:${posY}mm;" class="qr-code"><canvas id="qr-code" width="60" height="60"></canvas></div>`;
      } else {
        contentHTML += `<div style="position:absolute;left:${posX}mm;top:${posY}mm;font-size:${field.fontSize || 12}px;${field.id === 'product_name' ? 'font-weight:bold;' : ''}">${text}</div>`;
      }
    }
  } else {
    contentHTML = `
      ${settings.include_product_name ? `<div class="header">${lot.product_name}</div>` : ''}
      ${settings.include_lot_number ? `<div class="row"><strong>Lotto:</strong> ${lot.internal_lot_number || lot.lot_number}</div>` : ''}
      ${settings.include_production_date ? `<div class="row"><strong>Produzione:</strong> ${format(new Date(lot.production_date), 'dd/MM/yyyy')}</div>` : ''}
      ${settings.include_expiry_date && lot.expiry_date ? `<div class="row"><strong>Scadenza:</strong> ${format(new Date(lot.expiry_date), 'dd/MM/yyyy')}</div>` : ''}
      ${settings.include_freezing_date && lot.is_frozen && lot.freezing_date ? `<div class="row"><strong>Congelato il:</strong> ${format(new Date(lot.freezing_date), 'dd/MM/yyyy')}</div>` : ''}
    `;
  }

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
            position: relative;
            ${useCustomLayout ? '' : 'display:flex;flex-direction:column;justify-content:space-between;'}
          }
          .header { font-weight: bold; margin-bottom: 2mm; }
          .content { flex: 1; }
          .row { margin: 1mm 0; }
          .qr-code { text-align: center; margin-top: 2mm; }
          .barcode { text-align: center; font-family: 'Libre Barcode 128', cursive; font-size: 24px; margin-top: 2mm; }
        </style>
      </head>
      <body>
        ${useCustomLayout ? contentHTML : `
          <div class="content">${contentHTML}</div>
          ${settings.include_qr_code ? `<div class="qr-code"><canvas id="qr-code" width="60" height="60"></canvas></div>` : ''}
          ${settings.include_barcode ? `<div class="barcode">*${lot.internal_lot_number || lot.lot_number}*</div>` : ''}
        `}
        ${settings.include_qr_code ? `
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            QRCode.toCanvas(document.getElementById('qr-code'), ${JSON.stringify(qrData)}, {
              width: 60, margin: 0
            });
          </script>
        ` : ''}
      </body>
    </html>
  `;
};

// CUPS printing via PocketBase API
const printViaCUPS = async (labelHTML: string, settings: PrinterSettings): Promise<void> => {
  const response = await pb.send('/api/cups/print', {
    method: 'POST',
    body: {
      html: labelHTML,
      printer: settings.cups_printer_name || '',
      copies: 1,
      label_width: settings.label_width,
      label_height: settings.label_height,
    },
  });

  if (!response.success) {
    throw new Error(response.error || 'Errore stampa CUPS');
  }
};

// Get available CUPS printers
export const getCUPSPrinters = async (): Promise<{ printers: Array<{ name: string; enabled: boolean; description: string }>; default_printer: string; cups_available: boolean }> => {
  try {
    return await pb.send('/api/cups/printers', { method: 'GET' });
  } catch {
    return { printers: [], default_printer: '', cups_available: false };
  }
};

// Get CUPS status
export const getCUPSStatus = async (): Promise<{ cups_available: boolean; status?: string }> => {
  try {
    return await pb.send('/api/cups/status', { method: 'GET' });
  } catch {
    return { cups_available: false };
  }
};

const printViaBrowser = async (labelHTML: string): Promise<void> => {
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
  
  await new Promise(resolve => setTimeout(resolve, 500));
  printFrame.contentWindow?.print();
  
  setTimeout(() => {
    document.body.removeChild(printFrame);
  }, 1000);
};

export const printLabel = async (lot: LotData, settings: PrinterSettings): Promise<void> => {
  const labelHTML = generateLabelHTML(lot, settings);
  
  if (settings.printer_connection_type === 'cups') {
    await printViaCUPS(labelHTML, settings);
  } else {
    await printViaBrowser(labelHTML);
  }
};
