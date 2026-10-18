import { z } from 'zod';
import { LLMProvider, ChatMessage, LLMProviderConfig } from './provider';

export class DeepSeekProvider implements LLMProvider {
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
    };
  }

  async chatJSON<T>(messages: ChatMessage[], schema: z.ZodType<T>): Promise<T> {
    const url = `${this.config.baseUrl}/chat/completions`;

    const makeRequest = async (currentMessages: ChatMessage[]): Promise<T> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: currentMessages,
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          let errorMsg = `Provider error (${res.status})`;
          try {
            const parsed = JSON.parse(errText);
            errorMsg = parsed.error?.message || parsed.message || errorMsg;
          } catch {
            errorMsg = errText.slice(0, 150) || errorMsg;
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from LLM');
        }

        const parsedJSON = JSON.parse(content);
        return schema.parse(parsedJSON);
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      return await makeRequest(messages);
    } catch (err: unknown) {
      // Retry once if JSON parse error
      if (err instanceof SyntaxError || (err instanceof z.ZodError)) {
        const retryMessages: ChatMessage[] = [
          ...messages,
          { role: 'user', content: 'Reminder: Return strictly valid JSON that matches the schema exactly without markdown formatting.' },
        ];
        return await makeRequest(retryMessages);
      }
      throw err;
    }
  }
}
