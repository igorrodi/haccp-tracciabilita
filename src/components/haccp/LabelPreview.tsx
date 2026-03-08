import { useState, useEffect, useRef, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Type } from 'lucide-react';

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

const MM_TO_PX_RATIO = 3.78; // approximate mm to px for screen display

export const LabelPreview = ({ width, height, settings, onSettingsChange }: LabelPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selectedField, setSelectedField] = useState<string | null>(null);

  const [fields, setFields] = useState<LabelField[]>(() => {
    if (settings.custom_layout && Array.isArray(settings.custom_layout)) {
      return settings.custom_layout;
    }
    return [
      { id: 'product_name', label: 'Nome Prodotto', enabled: settings.include_product_name, x: 10, y: 10, fontSize: 16 },
      { id: 'lot_number', label: 'Lotto: XXX-2024', enabled: settings.include_lot_number, x: 10, y: 40, fontSize: 12 },
      { id: 'production_date', label: 'Prod: 01/01/2024', enabled: settings.include_production_date, x: 10, y: 60, fontSize: 12 },
      { id: 'expiry_date', label: 'Scad: 31/12/2024', enabled: settings.include_expiry_date, x: 10, y: 80, fontSize: 12 },
      { id: 'freezing_date', label: 'Cong: 15/06/2024', enabled: settings.include_freezing_date, x: 10, y: 100, fontSize: 12 },
      { id: 'qr_code', label: '▣ QR Code', enabled: settings.include_qr_code, x: 200, y: 10, fontSize: 12 },
      { id: 'barcode', label: '||||| Barcode |||||', enabled: settings.include_barcode, x: 200, y: 70, fontSize: 12 },
    ];
  });

  // Calculate scale to fit preview in container
  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth - 32;
    const containerHeight = 400;
    const labelWidthPx = width * MM_TO_PX_RATIO;
    const labelHeightPx = height * MM_TO_PX_RATIO;
    const scaleX = containerWidth / labelWidthPx;
    const scaleY = containerHeight / labelHeightPx;
    setScale(Math.min(scaleX, scaleY, 2));
  }, [width, height]);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

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
    const settingKey = `include_${id}` as keyof PrinterSettings;
    onSettingsChange({ 
      ...settings, 
      [settingKey]: !settings[settingKey],
      custom_layout: updatedFields 
    });
  };

  const updateFontSize = (id: string, size: number) => {
    const updatedFields = fields.map(f => 
      f.id === id ? { ...f, fontSize: size } : f
    );
    setFields(updatedFields);
    onSettingsChange({ ...settings, custom_layout: updatedFields });
  };

  const labelWidthPx = width * MM_TO_PX_RATIO;
  const labelHeightPx = height * MM_TO_PX_RATIO;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Fields panel */}
        <div className="lg:col-span-1">
          <Label className="text-sm font-semibold mb-3 block">Campi Disponibili</Label>
          <div className="space-y-1.5">
            {fields.map(field => (
              <div
                key={field.id}
                className={`flex items-center justify-between p-2 rounded-lg border transition-colors cursor-pointer
                  ${selectedField === field.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}
                  ${!field.enabled ? 'opacity-50' : ''}`}
                onClick={() => setSelectedField(field.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{field.label}</span>
                </div>
                <Switch
                  checked={field.enabled}
                  onCheckedChange={() => toggleField(field.id)}
                />
              </div>
            ))}
          </div>

          {/* Font size control for selected field */}
          {selectedField && fields.find(f => f.id === selectedField && f.id !== 'qr_code' && f.id !== 'barcode') && (
            <div className="mt-4 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Type className="w-4 h-4" />
                <Label className="text-sm">Dimensione testo</Label>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {fields.find(f => f.id === selectedField)?.fontSize}px
                </Badge>
              </div>
              <Slider
                value={[fields.find(f => f.id === selectedField)?.fontSize || 12]}
                onValueChange={([v]) => updateFontSize(selectedField, v)}
                min={8}
                max={24}
                step={1}
              />
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-2" ref={containerRef}>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-semibold">Anteprima Etichetta</Label>
            <Badge variant="outline" className="text-xs">
              {width} × {height} mm — scala {Math.round(scale * 100)}%
            </Badge>
          </div>
          <div className="flex items-center justify-center bg-muted/20 rounded-xl p-4 border-2 border-dashed min-h-[300px]">
            <div
              style={{
                width: labelWidthPx * scale,
                height: labelHeightPx * scale,
                position: 'relative',
              }}
            >
              <div
                className="bg-white border-2 border-foreground/20 rounded shadow-lg"
                style={{
                  width: labelWidthPx,
                  height: labelHeightPx,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {fields.filter(f => f.enabled).map(field => (
                  <Draggable
                    key={field.id}
                    position={{ x: field.x, y: field.y }}
                    onStop={(_, data) => handleDrag(field.id, data)}
                    bounds="parent"
                    scale={scale}
                  >
                    <div
                      className={`absolute cursor-move select-none px-1 py-0.5 rounded transition-all
                        ${selectedField === field.id 
                          ? 'ring-2 ring-primary bg-primary/10' 
                          : 'hover:bg-primary/5 border border-dashed border-transparent hover:border-primary/40'}`}
                      style={{ 
                        fontSize: `${field.fontSize}px`,
                        fontWeight: field.id === 'product_name' ? 'bold' : 'normal',
                        fontFamily: field.id === 'barcode' ? "'Libre Barcode 128', monospace" : 'Arial, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedField(field.id);
                      }}
                    >
                      {field.id === 'qr_code' ? (
                        <div className="w-[50px] h-[50px] border-2 border-foreground/30 rounded flex items-center justify-center text-[8px] text-muted-foreground">
                          QR
                        </div>
                      ) : (
                        field.label
                      )}
                    </div>
                  </Draggable>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Trascina gli elementi per posizionarli sull'etichetta • Clicca per selezionare e ridimensionare
          </p>
        </div>
      </div>
    </div>
  );
};
