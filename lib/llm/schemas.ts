import { z } from 'zod';

export const GlossBreakdownSchema = z.object({
  char: z.string(),
  meaning: z.string(),
});

export const GlossItemSchema = z.object({
  id: z.string().optional(),
  word: z.string(),
  pinyin: z.string(),
  gloss: z.string(),
  inContext: z.string(),
  breakdown: z.array(GlossBreakdownSchema).default([]),
  pos: z.string().optional(),
  register: z.enum(['formal', 'neutral', 'colloquial', 'literary']).optional(),
  type: z.enum(['word', 'phrase', 'chengyu', 'name', 'grammar']).optional(),
  note: z.string().optional(),
  segmentation: z
    .object({
      ok: z.boolean(),
      suggested: z.string().nullable().optional(),
    })
    .optional(),
});

export const GlossResponseSchema = z.object({
  items: z.array(GlossItemSchema),
});

export const TranslateItemSchema = z.object({
  id: z.string(),
  translation: z.string(),
});

export const TranslateResponseSchema = z.object({
  items: z.array(TranslateItemSchema),
});

export type GlossResponse = z.infer<typeof GlossResponseSchema>;
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>;
