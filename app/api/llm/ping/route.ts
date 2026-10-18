import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const userApiKey = req.headers.get('x-user-api-key') || '';
    const userBaseUrl = req.headers.get('x-llm-base-url') || 'https://api.deepseek.com';
    const userModel = req.headers.get('x-llm-model') || 'deepseek-chat';

    const apiKey = userApiKey || process.env.DEEPSEEK_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'No API key provided. Please enter a valid API key in Settings.' },
        { status: 400 }
      );
    }

    const cleanBaseUrl = userBaseUrl.replace(/\/+$/, '');
    const url = `${cleanBaseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: userModel,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `Provider error (${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        errorMsg = parsed.error?.message || parsed.message || errorMsg;
      } catch {
        errorMsg = errText.slice(0, 200) || errorMsg;
      }
      return NextResponse.json({ ok: false, error: errorMsg }, { status: res.status });
    }

    return NextResponse.json({ ok: true, model: userModel });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
