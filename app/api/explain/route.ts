import { aiRouteError, explainWord, parseExplainInput, readAIRequest } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(request: Request): Promise<Response> {
  try {
    const input = parseExplainInput(await readAIRequest(request));
    return Response.json(await explainWord(input), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return aiRouteError(error);
  }
}
