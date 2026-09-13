import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { explainWord, tutorAnswer } from '../lib/ai';
import type { ExplainInput, TutorInput } from '../lib/types';

const word: ExplainInput = {
  language: 'es', word: 'mercado', sentence: 'Voy al mercado por la mañana.',
  translation: 'I go to the market in the morning.',
};
const clip: TutorInput = {
  question: 'What does this mean?', transcript: 'Me gusta el café. Lo tomo por la mañana.',
  translation: 'I like coffee. I drink it in the morning.', learnerLevel: 1,
};
const aiResponse = (value: unknown) => new Response(JSON.stringify({
  status: 'completed', output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] },
  ],
}), { status: 200 });

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('OPENAI_MODEL', '');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AI unavailable', () => {
  it('returns a deterministic contextual word meaning without a network request', async () => {
    const first = await explainWord(word);
    expect(first).toEqual(await explainWord(word));
    expect(first.lemma).toBe('mercado');
    expect(first.translation).toBe('market');
    expect(first.example).toContain('mercado');
    expect(first.contextMeaning).toContain('market');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses a supplied short translation for an unknown word', async () => {
    const result = await explainWord({ ...word, word: 'farolillo', sentence: 'Mira ese farolillo.', translation: 'small paper lantern' });
    expect(result.translation).toBe('small paper lantern');
  });

  it('does not turn a short supporting sentence into a guessed word definition', async () => {
    const result = await explainWord({ ...word, word: 'farolillo', sentence: 'Mira ese farolillo.', translation: 'Look at that lantern' });
    expect(result.translation).not.toBe('Look at that lantern');
    expect(result.contextMeaning).toContain('Look at that lantern');
  });

  it('answers what does this mean from the supplied translation', async () => {
    const result = await tutorAnswer(clip);
    expect(result.source).toBe('demo');
    expect(result.answer).toContain('I like coffee.');
    expect(result.answer).toContain('Me gusta el café.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses a grammatical construction actually present in the transcript', async () => {
    const result = await tutorAnswer({ ...clip, question: 'Explain the grammar' });
    expect(result.answer).toContain('gusta');
    expect(result.answer).toContain('pleasing');
  });

  it('summarizes a different clip using its own translation', async () => {
    const result = await tutorAnswer({ ...clip, question: 'Summarize the video', transcript: 'El tren sale a las ocho.', translation: 'The train leaves at eight.' });
    expect(result.answer).toContain('The train leaves at eight.');
    expect(result.answer).not.toContain('coffee');
  });

  it('keeps long transcript fallback answers within 120 words', async () => {
    const result = await tutorAnswer({ ...clip, transcript: 'Una frase. '.repeat(200), translation: 'A sentence. '.repeat(200) });
    expect(result.answer.split(/\s+/).length).toBeLessThanOrEqual(120);
  });

  it('does not invent a translation when one is unavailable', async () => {
    const result = await tutorAnswer({ ...clip, transcript: 'Un farolillo ilumina la calle.', translation: '' });
    expect(result.answer).toContain('Un farolillo ilumina la calle.');
    expect(result.answer).toMatch(/translation.*unavailable/i);
  });
});

describe('bounded provider integration', () => {
  beforeEach(() => vi.stubEnv('OPENAI_API_KEY', 'test-key-never-a-real-secret'));

  it.each([401, 429, 500])('falls back on provider status %i without exposing its error', async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response('private-provider-details', { status }));
    const result = await tutorAnswer(clip);
    expect(result.source).toBe('demo');
    expect(result.answer).not.toContain('private-provider-details');
  });

  it('falls back on malformed model JSON or missing fields', async () => {
    vi.mocked(fetch).mockResolvedValue(aiResponse({ lemma: 'mercado', translation: ['market'] }));
    expect((await explainWord(word)).translation).toBe('market');
    vi.mocked(fetch).mockResolvedValue(new Response('not JSON', { status: 200 }));
    expect((await tutorAnswer(clip)).source).toBe('demo');
  });

  it('falls back on incomplete and refused responses', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'incomplete', output: [] })));
    expect((await tutorAnswer(clip)).source).toBe('demo');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Refused' }] }] })));
    expect((await tutorAnswer(clip)).source).toBe('demo');
  });

  it('uses the configured model, server authorization, structured output, and no storage', async () => {
    vi.stubEnv('OPENAI_MODEL', 'configured-test-model');
    vi.mocked(fetch).mockResolvedValue(aiResponse({ answer: '“Me gusta” means “I like.”' }));
    expect((await tutorAnswer(clip)).source).toBe('ai');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('configured-test-model');
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe('json_schema');
    expect(body.text.format.strict).toBe(true);
    expect(body.input[0].role).toBe('user');
    expect(body.instructions).toContain('transcript');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-key-never-a-real-secret');
  });

  it('caps valid model answers to 120 words', async () => {
    vi.mocked(fetch).mockResolvedValue(aiResponse({ answer: 'word '.repeat(180) }));
    const result = await tutorAnswer(clip);
    expect(result.source).toBe('ai');
    expect(result.answer.split(/\s+/).length).toBeLessThanOrEqual(120);
  });

  it('returns validated word fields and uses the small default model', async () => {
    const explanation = {
      lemma: 'mercado', translation: 'market', contextMeaning: 'The local food market.',
      explanation: 'A place where people buy and sell food.', example: 'El mercado abre temprano.',
    };
    vi.mocked(fetch).mockResolvedValue(aiResponse(explanation));
    expect(await explainWord(word)).toEqual({ ...explanation, source: 'ai' });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).model).toBe('gpt-4.1-mini');
  });

  it('falls back when the network rejects', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('private-network-details'));
    expect((await explainWord(word)).source).toBe('demo');
    expect((await tutorAnswer(clip)).source).toBe('demo');
  });

  it('returns fallback within eight seconds even if the provider never resolves', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    const pending = tutorAnswer(clip);
    await vi.advanceTimersByTimeAsync(8000);
    expect((await pending).source).toBe('demo');
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
