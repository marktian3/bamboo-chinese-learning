import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/llm/deepseek';
import { TRANSLATE_SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { TranslateResponseSchema } from '@/lib/llm/schemas';

export async function POST(req: NextRequest) {
  try {
    const userApiKey = req.headers.get('x-user-api-key') || '';
    const userBaseUrl = req.headers.get('x-llm-base-url') || 'https://api.deepseek.com';
    const userModel = req.headers.get('x-llm-model') || 'deepseek-chat';

    const apiKey = userApiKey || process.env.DEEPSEEK_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'No API key provided' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { sentences, context } = body;

    if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json({ ok: false, error: 'No sentences provided' }, { status: 400 });
    }

    const provider = new DeepSeekProvider({
      apiKey,
      baseUrl: userBaseUrl,
      model: userModel,
    });

    const userMessageContent = `Passage Context:
"""
${context || ''}
"""

Translate these sentence(s) to natural English:
${JSON.stringify(sentences, null, 2)}`;

    const response = await provider.chatJSON(
      [
        { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
        { role: 'user', content: userMessageContent },
      ],
      TranslateResponseSchema
    );

    return NextResponse.json({ ok: true, data: response });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Translation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
