import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/llm/deepseek';
import { GLOSS_SYSTEM_PROMPT } from '@/lib/llm/prompts';
import { GlossResponseSchema } from '@/lib/llm/schemas';

export async function POST(req: NextRequest) {
  try {
    const userApiKey = req.headers.get('x-user-api-key') || '';
    const userBaseUrl = req.headers.get('x-llm-base-url') || 'https://api.deepseek.com';
    const userModel = req.headers.get('x-llm-model') || 'deepseek-chat';

    const apiKey = userApiKey || process.env.DEEPSEEK_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'No API key provided. Please configure your key in Settings.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { passageTitle, context, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'No items provided' }, { status: 400 });
    }

    const provider = new DeepSeekProvider({
      apiKey,
      baseUrl: userBaseUrl,
      model: userModel,
    });

    const userMessageContent = `Passage: ${passageTitle || 'Untitled'}
Passage context:
"""
${context || ''}
"""

Please explain the following ${items.length} words in context:
${JSON.stringify(items, null, 2)}`;

    const response = await provider.chatJSON(
      [
        { role: 'system', content: GLOSS_SYSTEM_PROMPT },
        { role: 'user', content: userMessageContent },
      ],
      GlossResponseSchema
    );

    return NextResponse.json({ ok: true, data: response });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate contextual gloss';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
