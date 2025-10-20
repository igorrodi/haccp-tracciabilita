import { useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface LabelField {
  id: string;
  label: string;
  enabled: boolean;
  x: number;
  y: number;
  fontSize: number;
}

interface PrinterSettings {
  include_product_name: boolean;
  include_lot_number: boolean;
  include_production_date: boolean;
  include_expiry_date: boolean;
  include_freezing_date: boolean;
  include_qr_code: boolean;
  include_barcode: boolean;
  custom_layout?: any;
}

interface LabelPreviewProps {
  width: number;
  height: number;
  settings: PrinterSettings;
  onSettingsChange: (settings: any) => void;
}

export const LabelPreview = ({ width, height, settings, onSettingsChange }: LabelPreviewProps) => {
  const [fields, setFields] = useState<LabelField[]>([
    { id: 'product_name', label: 'Nome Prodotto', enabled: settings.include_product_name, x: 10, y: 10, fontSize: 16 },
    { id: 'lot_number', label: 'Lotto: XXX', enabled: settings.include_lot_number, x: 10, y: 40, fontSize: 12 },
    { id: 'production_date', label: 'Produzione: 01/01/2024', enabled: settings.include_production_date, x: 10, y: 60, fontSize: 12 },
    { id: 'expiry_date', label: 'Scadenza: 31/12/2024', enabled: settings.include_expiry_date, x: 10, y: 80, fontSize: 12 },
    { id: 'freezing_date', label: 'Congelato: 15/06/2024', enabled: settings.include_freezing_date, x: 10, y: 100, fontSize: 12 },
    { id: 'qr_code', label: 'QR Code', enabled: settings.include_qr_code, x: 150, y: 10, fontSize: 12 },
    { id: 'barcode', label: 'Barcode', enabled: settings.include_barcode, x: 150, y: 50, fontSize: 12 },
  ]);

  useEffect(() => {
    if (settings.custom_layout) {
      setFields(settings.custom_layout);
    }
  }, []);

  const handleDrag = (id: string, data: any) => {
    const updatedFields = fields.map(f => 
      f.id === id ? { ...f, x: data.x, y: data.y } : f
    );
    setFields(updatedFields);
    onSettingsChange({ ...settings, custom_layout: updatedFields });
  };

  const toggleField = (id: string) => {
    const updatedFields = fields.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    );
    setFields(updatedFields);
    
    // Update the corresponding include_* setting
    const settingKey = `include_${id}` as keyof PrinterSettings;
    onSettingsChange({ 
      ...settings, 
      [settingKey]: !settings[settingKey],
      custom_layout: updatedFields 
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-base font-semibold mb-3 block">Campi Disponibili</Label>
          <div className="space-y-2">
            {fields.map(field => (
              <div key={field.id} className="flex items-center justify-between p-2 rounded border">
                <Label htmlFor={field.id} className="font-normal">{field.label}</Label>
                <Switch
                  id={field.id}
                  checked={field.enabled}
                  onCheckedChange={() => toggleField(field.id)}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-base font-semibold mb-3 block">Anteprima Etichetta</Label>
          <div className="w-full h-[500px] flex items-center justify-center bg-muted/30 rounded-lg p-4 border-2">
            <Card 
              className="relative bg-white border-2"
              style={{ 
                width: width > height ? '450px' : width === height ? '400px' : '300px',
                height: width > height ? '300px' : width === height ? '400px' : '450px',
                overflow: 'hidden'
              }}
            >
              {fields.filter(f => f.enabled).map(field => (
                <Draggable
                  key={field.id}
                  position={{ x: field.x, y: field.y }}
                  onStop={(e, data) => handleDrag(field.id, data)}
                  bounds="parent"
                >
                  <div 
                    className="absolute cursor-move p-1 hover:bg-primary/10 border border-dashed border-transparent hover:border-primary rounded"
                    style={{ fontSize: `${field.fontSize}px` }}
                  >
                    {field.label}
                  </div>
                </Draggable>
              ))}
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
};