import { z } from 'zod';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface LLMProvider {
  chatJSON<T>(messages: ChatMessage[], schema: z.ZodType<T>): Promise<T>;
}
