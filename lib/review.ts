import type { SavedWord } from './types';

export interface ReviewQuestion {
  id: string;
  prompt: string;
  word: SavedWord;
  choices: string[];
  answer: string;
  context: string;
}

// These familiar words are distractors only. Correct answers always come from saved vocabulary.
const DISTRACTORS = [
  { surface: 'ventana', translation: 'window' },
  { surface: 'camino', translation: 'path' },
  { surface: 'desayuno', translation: 'breakfast' },
  { surface: 'mar', translation: 'sea' },
  { surface: 'ciudad', translation: 'city' },
  { surface: 'aprender', translation: 'to learn' },
  { surface: 'llevar', translation: 'to carry' },
  { surface: 'temprano', translation: 'early' },
  { surface: 'lejos', translation: 'far away' },
  { surface: 'suave', translation: 'soft' },
  { surface: 'todavía', translation: 'still' },
  { surface: 'despacio', translation: 'slowly' },
];

function normalized(value: string): string {
  return value.normalize('NFC').trim().toLowerCase()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').replace(/\s+/g, ' ');
}

function meanings(value: string): string[] {
  return value.split(/[,;/()]/).map((part) => normalized(part).replace(/^(?:a|an|the|to) /, '')).filter(Boolean);
}

function sameMeaning(first: string, second: string): boolean {
  const alternatives = new Set(meanings(first));
  return meanings(second).some((meaning) => alternatives.has(meaning));
}

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619) >>> 0;
  return result;
}

function choicesFor(word: SavedWord, words: SavedWord[], reverse: boolean, seed: string): string[] {
  const answer = reverse ? word.surface : word.translation;
  const choices = [answer];
  const seen = new Set([normalized(answer)]);
  const candidates = [...words, ...DISTRACTORS];
  for (const candidate of candidates) {
    // A different saved form with the same known meaning is also a correct answer.
    if (sameMeaning(candidate.translation, word.translation)
      || normalized(candidate.surface) === normalized(word.surface)
      || ('lemma' in candidate && typeof candidate.lemma === 'string' && normalized(candidate.lemma) === normalized(word.lemma))) continue;
    const choice = reverse ? candidate.surface : candidate.translation;
    const key = normalized(choice);
    if (!key || seen.has(key)) continue;
    choices.push(choice);
    seen.add(key);
    if (choices.length === 4) break;
  }
  // Stable ordering makes review predictable across rerenders without fixing the answer's position.
  return choices.sort((first, second) => hash(`${seed}:${first}`) - hash(`${seed}:${second}`) || first.localeCompare(second));
}

function blankedContext(word: SavedWord): string | null {
  const surface = word.surface.normalize('NFC').trim().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
  if (!surface) return null;
  const escaped = surface.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  // Unicode boundaries avoid partial matches such as pan inside pantalla and support accented words.
  const pattern = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{M}\\p{N}])`, 'giu');
  let found = false;
  const context = word.contextSentence.normalize('NFC').replace(pattern, (_match, boundary: string) => {
    found = true;
    return `${boundary}____`;
  });
  return found ? context : null;
}

export function buildReview(words: SavedWord[]): ReviewQuestion[] {
  if (words.length === 0) return [];
  return ['translation', 'reverse', 'context'].map((mode, index) => {
    const word = words[index % words.length];
    const id = `${word.id}:${mode}:${index}`;
    const gap = mode === 'context' ? blankedContext(word) : null;
    const reverse = mode === 'reverse' || gap !== null;
    return {
      id,
      prompt: gap !== null ? `Which word meaning “${word.translation}” fits this sentence?`
        : mode === 'reverse' ? `Which Spanish word means “${word.translation}”?`
          : `What does “${word.surface}” mean?`,
      word,
      answer: reverse ? word.surface : word.translation,
      context: gap ?? (mode === 'reverse' ? '' : word.contextSentence),
      choices: choicesFor(word, words, reverse, id),
    };
  });
}
