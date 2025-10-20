import { useState } from 'react';
import Draggable from 'react-draggable';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

interface LabelField {
  id: string;
  label: string;
  enabled: boolean;
  x: number;
  y: number;
  fontSize: number;
}

interface LabelPreviewProps {
  width: number;
  height: number;
  onSave?: (layout: LabelField[]) => void;
}

export const LabelPreview = ({ width, height, onSave }: LabelPreviewProps) => {
  const [fields, setFields] = useState<LabelField[]>([
    { id: 'product_name', label: 'Nome Prodotto', enabled: true, x: 10, y: 10, fontSize: 16 },
    { id: 'lot_number', label: 'Lotto: XXX', enabled: true, x: 10, y: 40, fontSize: 12 },
    { id: 'production_date', label: 'Produzione: 01/01/2024', enabled: true, x: 10, y: 60, fontSize: 12 },
    { id: 'expiry_date', label: 'Scadenza: 31/12/2024', enabled: true, x: 10, y: 80, fontSize: 12 },
    { id: 'freezing_date', label: 'Congelato: 15/06/2024', enabled: false, x: 10, y: 100, fontSize: 12 },
  ]);

  const handleDrag = (id: string, data: any) => {
    setFields(fields.map(f => 
      f.id === id ? { ...f, x: data.x, y: data.y } : f
    ));
  };

  const toggleField = (id: string) => {
    setFields(fields.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
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
          <Card 
            className="relative bg-white border-2"
            style={{ 
              width: `${width * 2}px`, 
              height: `${height * 2}px`,
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

      {onSave && (
        <Button onClick={() => onSave(fields)} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Salva Layout
        </Button>
      )}
    </div>
  );
};