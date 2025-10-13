// Lista ufficiale allergeni EU (Reg.1169/2011)
export const ALLERGENS = [
  'glutine',
  'grano',
  'segale',
  'orzo',
  'avena',
  'farro',
  'kamut',
  'crostacei',
  'uova',
  'uovo',
  'pesce',
  'tranne',
  'gelatina',
  'colla di pesce',
  'arachidi',
  'soia',
  'latte',
  'lattosio',
  'frutta a guscio',
  'mandorle',
  'nocciole',
  'noci comuni',
  'noci di anacardi',
  'noci di pecan',
  'noci del brasile',
  'pistacchi',
  'noci del queensland',
  'sedano',
  'senape',
  'sesamo',
  'anidride solforosa',
  'solfiti',
  'lupini',
  'molluschi',
] as const;

/**
 * Evidenzia gli allergeni in un testo dividendolo in parti
 * @param text Il testo degli ingredienti
 * @returns Array di parti con flag isAllergen
 */
export function highlightAllergens(text: string): Array<{ text: string; isAllergen: boolean }> {
  if (!text) return [];

  // Crea pattern regex per trovare gli allergeni (case-insensitive, word boundaries)
  const allergenPattern = new RegExp(
    `\\b(${ALLERGENS.join('|')})\\b`,
    'gi'
  );

  const parts: Array<{ text: string; isAllergen: boolean }> = [];
  let lastIndex = 0;
  let match;

  while ((match = allergenPattern.exec(text)) !== null) {
    // Aggiungi testo prima dell'allergene
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isAllergen: false,
      });
    }

    // Aggiungi l'allergene
    parts.push({
      text: match[0],
      isAllergen: true,
    });

    lastIndex = match.index + match[0].length;
  }

  // Aggiungi testo rimanente
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      isAllergen: false,
    });
  }

  return parts.length > 0 ? parts : [{ text, isAllergen: false }];
}
