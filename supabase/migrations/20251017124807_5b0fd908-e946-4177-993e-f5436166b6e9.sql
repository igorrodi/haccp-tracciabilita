-- Create allergens table
CREATE TABLE IF NOT EXISTS public.allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  official_ingredients TEXT,
  common_examples TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;

-- Everyone can read allergens
CREATE POLICY "Anyone can view allergens"
  ON public.allergens
  FOR SELECT
  USING (true);

-- Only admins can manage allergens
CREATE POLICY "Admins can insert allergens"
  ON public.allergens
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update allergens"
  ON public.allergens
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete allergens"
  ON public.allergens
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_allergens_updated_at
  BEFORE UPDATE ON public.allergens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Populate with initial data from CSV
INSERT INTO public.allergens (number, category_name, official_ingredients, common_examples) VALUES
(1, 'CEREALI CONTENENTI GLUTINE', 'grano, segale, orzo, avena, farro, kamut o i loro ceppi ibridati e prodotti derivati', 'farina, farina 0, farina 00, farina integrale, semola, pane, pasta, birra, malto, crusca, farina di farro'),
(2, 'CROSTACEI e prodotti derivati', '', 'gamberi, scampi, aragoste, granchi, astici, maurizi (canocchie)'),
(3, 'UOVA e prodotti derivati', '', 'uova intere, tuorlo, albume, liofilizzato d''uovo, maionese, pasta all''uovo, uova'),
(4, 'PESCE e prodotti derivati', 'tranne: gelatina o colla di pesce utilizzata come chiarificante nella birra e nel vino', 'salmone, merluzzo, tonno, platessa, pesce spada, spigola, trota, acciughe, sardine'),
(5, 'ARACHIDI e prodotti derivati', '', 'olio di arachidi, burro di arachidi, farina di arachidi, snack a base di arachidi'),
(6, 'SOIA e prodotti derivati', '', 'farina di soia, tofu, tempeh, edamame, latte di soia, salse di soia, olio di soia'),
(7, 'LATTE e prodotti derivati', 'incluso lattosio', 'latte fresco, latte UHT, panna, burro, yogurt, formaggi, mascarpone, ricotta, siero di latte'),
(8, 'FRUTTA A GUSCIO', 'mandorle (Amygdalus communis L.), nocciole (Corylus avellana), noci comuni (Juglans regia), noci di acagiù (Anacardium occidentale), noci di pecan (Carya illinoiesis (Wangenti) K. Koch), noci del Brasile (Berthelletia excelsa), pistacchi (Pistacia vera), noci del Queensland (Macadamia ternifolia) e prodotti derivati', 'granella, farina di mandorle'),
(9, 'SEDANO e prodotti derivati', '', 'coste di sedano, radice di sedano, foglie di sedano, estratti di sedano, sale di sedano'),
(10, 'SENAPE e prodotti derivati', '', 'semi di senape, senape in salsa, farina di senape'),
(11, 'SEMI DI SESAMO e prodotti derivati', '', 'sesamo, olio di sesamo, tahin, gomasio, farina di sesamo, tahina'),
(12, 'ANIDRIDE SOLFOROSA E SOLFITI', 'in concentrazioni superiori a 10 mg/Kg o 10 mg/l espressi come SO₂', 'additivi alimentari, conservanti, vino, birra, succhi di frutta, frutta secca'),
(13, 'LUPINI e prodotti derivati', '', 'farina di lupini, lupini secchi o in salamoia'),
(14, 'MOLLUSCHI e prodotti derivati', '', 'vongole, cozze, ostriche, capesante, cannolicchi, lumache di terra, polpo, seppie, calamari')
ON CONFLICT (number) DO NOTHING;