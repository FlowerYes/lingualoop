import { describe, expect, it } from 'vitest';
import { lookupVocabulary } from '../data/vocabulary';
import { videos } from '../data/videos';

describe('contextual offline vocabulary', () => {
  it('explains lo mejor as the best part, with an independent example', () => {
    const sentence = 'Lo mejor es sentarse al sol y leer tranquilamente.';
    const result = lookupVocabulary('mejor', sentence);
    expect(result).toMatchObject({ lemma: 'mejor', translation: 'best' });
    expect(result?.contextMeaning).toContain('the best part');
    expect(result?.explanation).toContain('Lo + adjective');
    expect(result?.example).not.toBe(sentence);
  });

  it.each([
    ['fuera', 'Los domingos desayuno fuera de casa.', 'away'],
    ['casa', 'Los domingos desayuno fuera de casa.', 'home'],
    ['desayuno', 'Los domingos desayuno fuera de casa.', 'I have breakfast'],
    ['pido', 'Pido un café y algo dulce.', 'I order'],
    ['dulce', 'Pido un café y algo dulce.', 'sweet'],
    ['poco', 'Vamos a caminar un poco más.', 'a little'],
    ['más', 'Vamos a caminar un poco más.', 'further'],
    ['fresco', 'El aire está fresco y el camino está tranquilo.', 'cool'],
    ['guardar', 'Cada puerta parece guardar una historia distinta.', 'to hold'],
    ['historia', 'Cada puerta parece guardar una historia distinta.', 'story'],
    ['bien', 'Si huelen bien, seguramente tendrán mucho sabor.', 'good'],
    ['de', 'Por eso siempre acabo caminando más de lo previsto.', 'than'],
    ['cerca', 'Si dependiera de mí, dedicaríamos más tiempo a comprar cerca.', 'locally'],
    ['su', 'Es como si cada viaje tuviera su propia banda sonora.', 'its'],
  ])('chooses the intended sense of %s', (word, sentence, translation) => {
    expect(lookupVocabulary(word, sentence)?.translation).toBe(translation);
  });

  it('distinguishes the meanings of al, llevar, and cuanto across contexts', () => {
    expect(lookupVocabulary('al', 'Lo mejor es sentarse al sol y leer tranquilamente.')?.translation).toBe('in the');
    expect(lookupVocabulary('al', 'Para llegar al mirador, sube por esta calle.')?.translation).toBe('to the');
    expect(lookupVocabulary('al', 'Quedamos en una terraza para ponernos al día.')?.contextMeaning).toContain('catch up');
    expect(lookupVocabulary('llevar', '¿Para tomar aquí o para llevar?')?.translation).toBe('to go; takeaway');
    expect(lookupVocabulary('llevar', 'Ojalá aprendiéramos a llevar esa calma a la vida cotidiana.')?.translation).toBe('to bring');
    expect(lookupVocabulary('cuanto', 'En cuanto tengo un rato libre, llamo a una amiga.')?.translation).toContain('as soon as');
    expect(lookupVocabulary('Cuanto', 'Cuanto menos ruido hacemos, más detalles percibimos.')?.contextMeaning).toContain('the less… the more…');
  });

  it('explains grammar in the actual inflected forms', () => {
    expect(lookupVocabulary('tengan', 'No hace falta que tengan una forma perfecta.')?.explanation).toContain('subjunctive');
    expect(lookupVocabulary('aprendiéramos', 'Ojalá aprendiéramos a llevar esa calma a la vida cotidiana.')).toMatchObject({ lemma: 'aprender', translation: 'we could learn' });
    expect(lookupVocabulary('acabo', 'Por eso siempre acabo caminando más de lo previsto.')?.explanation).toContain('eventual result');
  });

  it('explains both actual las uses when a sentence contains both', () => {
    const result = lookupVocabulary('las', 'Hay canciones que asocio con las calles donde las descubrí.');
    expect(result?.translation).toBe('the; them (both used here)');
    expect(result?.contextMeaning).toContain('“las calles”');
    expect(result?.contextMeaning).toContain('“las descubrí”');
    expect(lookupVocabulary('Las', 'Las casas son blancas. Hay muchas flores.')?.translation).toBe('the');
  });

  it('preserves complete offline coverage for every active caption sentence', () => {
    expect(videos.flatMap((video) => video.transcript).length).toBeGreaterThan(0);
    for (const caption of videos.flatMap((video) => video.transcript)) {
      for (const word of caption.words) {
        const result = lookupVocabulary(word.surface, caption.text);
        expect(result, `${word.surface}: ${caption.text}`).not.toBeNull();
        for (const field of ['lemma', 'translation', 'contextMeaning', 'explanation', 'example'] as const) {
          expect(result?.[field].trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('normalizes punctuation, case, and decomposed accents; unknown words remain unknown', () => {
    expect(lookupVocabulary('¡MEJOR!', 'LO MEJOR ES SENTARSE AL SOL.')?.translation).toBe('best');
    expect(lookupVocabulary('cafe\u0301')?.lemma).toBe('café');
    expect(lookupVocabulary('palabrainventada', 'Una palabra inventada.')).toBeNull();
    expect(lookupVocabulary('constructor')).toBeNull();
    expect(lookupVocabulary('mejor')?.translation).toBe('best; better');
  });
});
