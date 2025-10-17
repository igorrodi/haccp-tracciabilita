import { supabase } from '@/integrations/supabase/client';

// Cache per gli allergeni
let allergensCache: string[] = [];
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

/**
 * Carica gli allergeni dal database
 */
async function loadAllergens(): Promise<string[]> {
  const now = Date.now();
  
  // Usa cache se valida
  if (allergensCache.length > 0 && now - lastFetch < CACHE_DURATION) {
    return allergensCache;
  }

  try {
    const { data, error } = await supabase
      .from('allergens')
      .select('official_ingredients, common_examples')
      .order('number');

    if (error) throw error;

    // Combina ingredienti ufficiali ed esempi comuni
    const allTerms = new Set<string>();
    
    data?.forEach(allergen => {
      // Aggiungi ingredienti ufficiali
      if (allergen.official_ingredients) {
        const officialTerms = allergen.official_ingredients
          .split(',')
          .map(term => term.trim().toLowerCase())
          .filter(term => term && term.length > 2);
        officialTerms.forEach(term => allTerms.add(term));
      }
      
      // Aggiungi esempi comuni
      if (allergen.common_examples) {
        const exampleTerms = allergen.common_examples
          .split(',')
          .map(term => term.trim().toLowerCase())
          .filter(term => term && term.length > 2);
        exampleTerms.forEach(term => allTerms.add(term));
      }
    });

    allergensCache = Array.from(allTerms);
    lastFetch = now;
    
    return allergensCache;
  } catch (error) {
    console.error('Error loading allergens:', error);
    // Fallback a lista base se il caricamento fallisce
    return ['glutine', 'uova', 'latte', 'pesce', 'soia', 'frutta a guscio'];
  }
}

/**
 * Evidenzia gli allergeni in un testo dividendolo in parti
 * @param text Il testo degli ingredienti
 * @returns Array di parti con flag isAllergen
 */
export async function highlightAllergens(text: string): Promise<Array<{ text: string; isAllergen: boolean }>> {
  if (!text) return [];

  const allergens = await loadAllergens();
  
  if (allergens.length === 0) {
    return [{ text, isAllergen: false }];
  }

  // Crea pattern regex per trovare gli allergeni (case-insensitive, word boundaries)
  const allergenPattern = new RegExp(
    `\\b(${allergens.join('|')})\\b`,
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
