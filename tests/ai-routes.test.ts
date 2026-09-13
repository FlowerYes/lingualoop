import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { POST as explain } from '../app/api/explain/route';
import { POST as tutor } from '../app/api/tutor/route';

const explainInput = { language: 'es', word: 'café', sentence: 'Me gusta el café.', translation: 'I like coffee.' };
const tutorInput = { question: 'What does this mean?', transcript: 'Me gusta el café.', translation: 'I like coffee.', learnerLevel: 1 };
const request = (body: unknown) => new Request('http://localhost/api/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('AI routes', () => {
  it('returns the documented word shape at the top level', async () => {
    const response = await explain(request(explainInput));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ lemma: 'café', translation: 'coffee', contextMeaning: expect.any(String), explanation: expect.any(String), example: expect.any(String) });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('returns a tutor answer with honest provenance', async () => {
    const response = await tutor(request(tutorInput));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: 'demo', answer: expect.stringContaining('I like coffee.') });
  });

  it.each([null, [], {}, { ...explainInput, word: {} }, { ...explainInput, sentence: false }, { ...explainInput, word: '   ' }, { ...explainInput, word: 'a'.repeat(81) }])('rejects invalid explain inputs before contacting a provider', async (input) => {
    expect((await explain(request(input))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([{ ...tutorInput, question: 42 }, { ...tutorInput, learnerLevel: '1' }, { ...tutorInput, learnerLevel: 6 }, { ...tutorInput, transcript: '' }, { ...tutorInput, question: 'x'.repeat(601) }, { ...tutorInput, transcript: 'x'.repeat(12001) }])('rejects invalid tutor inputs', async (input) => {
    expect((await tutor(request(input))).status).toBe(400);
  });

  it('handles malformed JSON without throwing', async () => {
    const response = await tutor(new Request('http://localhost/api/tutor', { method: 'POST', body: '{bad json' }));
    expect(response.status).toBe(400);
  });

  it('rejects oversized bodies regardless of a missing content-length header', async () => {
    expect((await tutor(request({ ...tutorInput, extra: 'a'.repeat(33000) }))).status).toBe(413);
  });

  it('accepts fractional adaptive learner levels and empty supporting translation', async () => {
    expect((await tutor(request({ ...tutorInput, learnerLevel: 2.15, translation: '' }))).status).toBe(200);
  });
});
