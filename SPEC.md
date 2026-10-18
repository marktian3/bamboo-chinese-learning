# Bamboo 竹 — Product & Design Specification (v1)

> **Audience:** the coding agent implementing this project.
> **Owner:** Product/Design.
> **Status:** Ready for implementation.
> Read this whole document before writing code. Where the spec is silent, choose the simplest option that fits the principles in §2, and leave a `// SPEC-GAP:` comment.

---

## 0. TL;DR

Bamboo is a **local-first web app (PWA)** that helps **intermediate Chinese learners (≈HSK 4–5) reach advanced level (HSK 6+ / native material)** through two linked features:

1. **Reader:** paste any Simplified Chinese text and read it in a clean, large-type reading mode. Reading happens in three passes: **Read & Mark → Reveal → Re-read**. The learner taps words they don't know without interrupting their reading. Then they get **contextual** pinyin and meanings for every marked word at once, in a side panel. Then they re-read the passage with support.
2. **Word Bank + Review:** every word the learner looked up becomes an SRS flashcard, **with the original sentence it came from**. Scheduling uses the **FSRS** algorithm, which is the current state of the art and is used by modern Anki.

Contextual meanings come from an LLM (DeepSeek, bring-your-own-key, v1). An offline **CC-CEDICT** dictionary plus **pinyin-pro** serve as a fallback when there is no key or no network.

---

## 1. Users & Goals

### Primary persona
**"The Plateaued Intermediate"**: knows about 1,500–3,000 words. Can get through graded readers but struggles with native material (news, essays, web novels, WeChat articles). Their problems:
- Native text has too many unknown words, and looking up every one destroys reading flow.
- Pop-up dictionaries give every meaning of a word, not the one used *here*.
- Words they look up are forgotten within days. Anki decks of isolated words feel disconnected from what they actually read.

### Product goals (v1)
| Goal | Metric (local analytics only) |
|---|---|
| Make native text readable without losing flow | % of passages that reach "Completed" |
| Turn reading encounters into durable vocabulary | FSRS retention at 30 days ≥ 85% |
| Build a daily habit | Days with ≥1 review or passage |

### Non-goals (v1)
Accounts or cloud sync, Traditional characters, OCR/URL import, speech recognition, handwriting, social features, graded content generation. See the backlog in §12.

---

## 2. Product Principles

1. **Protect reading flow.** Nothing pops up during the first read unless the learner explicitly asks for it.
2. **Make the learner think before showing the answer.** Inferring a meaning and then checking it beats being told (see §3).
3. **Context is the unit of learning.** We never store a word without the sentence it came from.
4. **Calm, paper-like interface.** The text is the hero. The interface chrome recedes.
5. **Local-first and private.** All data lives in the browser (IndexedDB). The API key never leaves the device except in the proxied LLM call.
6. **Keyboard-first on desktop, thumb-first on mobile.**

---

## 3. Key Decision: Instant Lookup vs. Deferred Reveal (ADR-001)

### Decision
**Default to Deferred Reveal ("Read & Mark → Reveal → Re-read"). Include a lightweight "Peek" escape hatch and an optional "Instant" mode in Settings.**

### Rationale (synthesis of SLA / cognitive-science research)

| Finding | Source | Implication |
|---|---|---|
| Retention depends on *involvement*: need, **search**, and **evaluation**. Inferring a meaning from context and checking it raises involvement. Being handed a gloss lowers it. | Laufer & Hulstijn (2001), *Involvement Load Hypothesis* | The learner should try to infer before seeing the meaning. |
| An **infer → verify** sequence produces good retention, and an explicit consolidation step on top helps further. | Mondria (2003), *SSLA* | Reveal = verify. Word Bank review = consolidate. |
| **Unsuccessful retrieval attempts still improve later learning**, as long as feedback follows (the pretesting / "errorful generation" effect). | Kornell, Hays & Bjork (2009); Potts & Shanks (2014) | A wrong guess is fine. Delaying the answer costs nothing if the answer then arrives. |
| **Delayed feedback** is as good as or better than immediate feedback for long-term retention. | Butler, Karpicke & Roediger (2007) | Revealing at the end of the passage is not a penalty. |
| Glosses reliably help incidental vocabulary learning compared with no support. | Hulstijn, Hollander & Greidanus (1996); Yanagisawa, Webb & Uchihara (2020) meta-analysis | Support is still needed. The question is *when* to give it, not whether. |
| Comprehension needs about **95% known-word coverage at minimum and 98% for comfortable reading**. Below that, guessing from context fails. | Hu & Nation (2000); Laufer & Ravenhorst-Kalovski (2010) | An escape hatch (Peek) is necessary for words that block understanding of the passage. |
| More **encounters** and longer **attention** on a word predict learning. | Webb (2007); Pellicer-Sánchez & Schmitt (2010); Godfroid et al. (2018) eye-tracking | The second read is a guaranteed extra encounter with each word, now understood. Show word-bank words when they appear in new texts. |
| Chinese compounds are often **morphologically transparent** (e.g. 火 + 车), so inferring meaning from the characters works especially well for Chinese. **Pronunciation, however, cannot be inferred from context.** | General finding in Chinese L2 reading research | Peek shows **pinyin first**. Pinyin doesn't give away the meaning, and it lets the learner sound out the word in their head. |

**Caveat:** No single study tests these exact two interfaces for Chinese. This is an evidence-based synthesis. We log enough data (peeks, self-rated guesses, later retention) to check the decision ourselves later (§12).

### Resulting interaction model
- **Pass 1, Read & Mark:** tap = mark (highlight only, nothing pops up). Tapping a marked word opens a mini-toolbar that includes **Peek**. Peek shows pinyin and audio, and "Show meaning" is one more tap away. Both are logged.
- **Reveal (verify):** marked words appear in a side panel in passage order. Each meaning is **hidden until tapped**, so the learner has one last moment to recall their guess. After revealing, they rate themselves: **Guessed it / Partly / No idea**. A "Reveal all" button exists for speed.
- **Pass 2, Re-read:** pinyin appears above marked words (ruby). Tapping a word gives an instant gloss. Per-sentence translation and text-to-speech are available.
- **Settings → Lookup style:** `Deferred (recommended)` | `Instant` (tap shows the gloss popover immediately and still marks the word). This lets the learner override the default with little extra code.

---

## 4. Tech Stack & Architecture

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (latest stable, App Router) + TypeScript (strict)** | Almost all UI is client components. Server use is limited to the LLM proxy route. |
| Styling | **Tailwind CSS v4** + CSS variables for design tokens (§9) | Light and dark themes via `data-theme` on `<html>`. |
| UI primitives | **Radix UI** (via shadcn/ui), **lucide-react** icons | Popover, Dialog, Sheet, Tooltip, Switch, Tabs. |
| Local DB | **Dexie 4** (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`) | Schema in §8. |
| SRS | **ts-fsrs** | Default desired retention 0.90. |
| Segmentation | `Intl.Segmenter('zh', { granularity: 'word' })` behind a `Segmenter` interface | Swappable for jieba-wasm later. The user can fix boundaries in the UI. |
| Dictionary | **CC-CEDICT** preprocessed at build time into `/public/dict/cedict.json` (gzipped). Lazy-loaded on first use and cached in IndexedDB. | License CC BY-SA 4.0. Attribution goes on the About page. |
| Pinyin | **pinyin-pro** | Handles common polyphones in context. Used for Peek and as an offline fallback. |
| LLM | **DeepSeek** (OpenAI-compatible, `https://api.deepseek.com`, model `deepseek-chat`), JSON output mode | BYOK through Settings. See §7. |
| Validation | **zod** | All LLM responses and import files are validated. |
| TTS | Web Speech API (`speechSynthesis`, `zh-CN` voice) | Upgrade path: cloud TTS. |
| PWA | **Serwist** (`@serwist/next`) | Works offline for reading, reviews, and dictionary mode. |
| Testing | **Vitest** (unit), **Playwright** (e2e) with the LLM mocked | |
| Lint/format | ESLint + Prettier | |

### LLM call path (important for future migration)
```
Browser ──POST /api/llm/*  (header: x-user-api-key, x-llm-base-url, x-llm-model)──▶ Next.js Route Handler
Route Handler: key = header ?? process.env.DEEPSEEK_API_KEY  ──▶ DeepSeek /chat/completions
```
- Always route through our own API route, never browser-direct. This avoids CORS problems and lets us switch to a server-held key later just by setting an env var, with no client changes.
- The route must **never log** the key or request bodies.
- Provider code sits behind `LLMProvider` (`lib/llm/provider.ts`) with a single `chatJSON<T>(messages, schema)` method, so other OpenAI-compatible providers can be added later.

### Suggested project structure
```
app/
  layout.tsx                # theme, fonts, nav shell
  page.tsx                  # Home / Library
  read/[passageId]/page.tsx # Reader (3 passes)
  review/page.tsx           # SRS session
  words/page.tsx            # Word Bank
  settings/page.tsx
  about/page.tsx            # licenses & attributions
  api/llm/gloss/route.ts
  api/llm/translate/route.ts
  api/llm/ping/route.ts
components/
  reader/  (ReaderText, Token, MarkToolbar, PeekPopover, RevealPanel, RevealItem, PhaseBar, SentenceTranslation)
  review/  (ReviewCard, RatingBar, SessionSummary)
  words/   (WordTable, WordDetailDrawer)
  ui/      (shadcn primitives)
lib/
  db/        (schema.ts, repositories)
  segment/   (segmenter.ts, sentences.ts, tokens.ts)
  dict/      (cedict.ts, pinyin.ts)
  llm/       (provider.ts, deepseek.ts, prompts.ts, schemas.ts, cache.ts)
  srs/       (fsrs.ts, queue.ts)
  tts/       (speak.ts)
  export/    (json.ts, csv.ts)
scripts/
  build-cedict.ts           # downloads + converts CC-CEDICT → public/dict/cedict.json
tests/
```

---

## 5. Information Architecture & Navigation

```
┌─ Top nav (desktop) / Bottom tab bar (mobile) ───────────────────────┐
│  竹 Bamboo     Library     Review (●23)     Word Bank     ⚙ Settings │
└─────────────────────────────────────────────────────────────────────┘
```
- **Library (home):** paste a new passage, see recent passages, and see the "Due today" call to action.
- **Reader:** `/read/:id`. It has no nav clutter: only a slim header (back, title, phase bar, settings for font size).
- **Review:** an SRS session. The badge shows the number of due cards.
- **Word Bank:** search, filter, edit, and delete words.
- **Settings:** API key, reading preferences, SRS preferences, data export/import.

---

## 6. Feature Specifications

### 6.1 Library / Home

**Layout (desktop):**
```
┌──────────────────────────────────────────────────────────────┐
│  Good evening.            [ Review 23 due → ]  🔥 6-day streak │
│                                                              │
│  ┌─ New passage ──────────────────────────────────────────┐  │
│  │ Paste Chinese text here…                                │  │
│  │                                                         │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│   Title (optional) [__________]     1,248 chars   [Start reading]│
│                                                              │
│  Recent passages                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ 人工智能与…   │ │ 鲁迅《故乡》  │ │ 新闻：…       │          │
│  │ 1.2k chars   │ │ 3.4k chars   │ │ 800 chars    │          │
│  │ ● Re-reading │ │ ✓ Completed  │ │ ○ Pass 1     │          │
│  │ 14 marked    │ │ 31 marked    │ │ 3 marked     │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

**Requirements**
- The textarea accepts up to **10,000 characters**. Show a live character count, and show a warning above 6,000 ("Long passages may be slower to reveal").
- **Validation:** at least one CJK character is required. If < 30% of characters are CJK, show a warning (but allow it).
- **Normalization on save:** trim; collapse runs of spaces and tabs; keep paragraph breaks (`\n\n` and single `\n` → paragraph); convert half-width punctuation between CJK characters to full-width (`,`→`，`, etc.); strip zero-width characters.
- **Title default:** the first 16 characters of the first line, with an ellipsis. Editable here and in the Reader header.
- On "Start reading," create the passage, segment it, persist the tokens, and navigate to `/read/:id`.
- **Passage cards** show the title, character count, status (`Pass 1` / `Revealed` / `Re-reading` / `Completed`), number of marked words, and last opened time. The overflow menu has Rename, Duplicate (fresh read), and Delete (with confirmation).
- **Empty state:** a friendly illustration and a "Try a sample passage" button that loads one bundled, public-domain sample (e.g. an excerpt from 朱自清《背影》).

### 6.2 Segmentation & Tokens

- `segment(text) → Token[]`, where
  `Token = { id, text, start, end, isWord, sentenceIdx, paragraphIdx }`.
  `isWord` = Intl.Segmenter `isWordLike` **and** contains a CJK character. Punctuation, Latin text, and numbers are rendered but **not tappable**.
- Sentence splitting: split after `。！？!?；…` (and `……`), keeping trailing closing quotes and brackets (`」』”’）》`) with the sentence. A newline also ends a sentence.
- **User boundary overrides** (see Extend/Split in §6.3) are stored per passage as `merges: [{start, end}]` and applied on top of the base segmentation. Re-segmenting must keep overrides.
- Segmenter quality is "good enough." The LLM gloss response may also return a `segmentation.suggested` span. The Reveal panel offers it as a one-tap fix (§6.4).

### 6.3 Reader — Pass 1: Read & Mark

**Layout (desktop):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Library   人工智能与未来的工作            ①Read ─ ②Reveal ─ ③Re-read  Aa │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│          随着人工智能技术的迅速发展，越来越多的企业开始                      │
│          把 ▓落实▓ 自动化作为提高 ▓效率▓ 的重要手段。                      │
│          …                                                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  7 words marked · 2 peeked                         [ Reveal (7) → ]  │
└─────────────────────────────────────────────────────────────────────┘
```
- The reading column is centered, with `max-width: 34em` (≈ 32–36 Chinese characters per line at default size).
- Sticky bottom action bar. On mobile it sits above the tab bar, which is hidden in the Reader.

**Token interactions**
| State | Visual | Tap / click | Keyboard |
|---|---|---|---|
| Unmarked word | Plain ink. On hover (desktop): `--surface-hover` background with rounded 4px. | → **Marked** (150ms fade-in highlight) | `←/→` move focus between words; `Space` toggles mark |
| Marked | `--mark-bg` background + 2px `--mark` underline | Opens **Mark toolbar** (popover above the word) | `Enter` opens toolbar |
| Peeked | Like Marked, but the underline is `--peek` (amber) and dashed | Opens toolbar | — |
| In Word Bank (not marked) | 1px dotted underline in `--ink-faint`. This is a quiet "you've met this before" cue. Togglable in Settings (default on). | → Marked (as above) | — |
| Non-word (punctuation, Latin) | Plain | Nothing | Skipped by focus |

**Mark toolbar** (small, horizontal, icon + label on desktop, icons on mobile):
`[👁 Peek]  [◀ Extend]  [Extend ▶]  [✂ Split]  [✕ Unmark]`
- **Peek:** opens the **Peek popover** in place of the toolbar:
  ```
  ┌───────────────────────┐
  │  luò shí     🔊        │   ← pinyin (tone-colored), audio
  │  [ Show meaning ]      │   ← one more tap; reveals short gloss
  └───────────────────────┘
  ```
  Pinyin comes from pinyin-pro (instant, offline). "Show meaning" uses the cached LLM gloss if one exists, otherwise the CEDICT first sense (labeled "dictionary"). Log `peek = 'pinyin' | 'meaning'` on the mark.
- **Extend ◀/▶:** merges the mark with the adjacent word token, creating a user merge. Use this for phrases, chengyu (成语), or segmentation errors.
- **Split:** only shown when the mark spans more than 1 base token. Splits it back.
- **Unmark:** removes the mark.
- Close the toolbar with Esc, a click outside, or scrolling.

**Desktop shortcut:** click-drag across several tokens marks them as one merged unit.

**Other Pass 1 behaviors**
- **Background prefetch:** after the learner has been idle for 3s with ≥1 un-glossed mark, batch-request glosses (§7.2) and cache them silently. Reveal should feel instant. Never show any of it before Reveal.
- **Aa menu:** font size (20–40px, default 28), font family (§9.3), line height (compact/normal/airy), theme. Changes apply live and are saved to Settings.
- Marks are **auto-saved** to IndexedDB immediately. Leaving and coming back restores phase, marks, and scroll position.
- **Reveal button:** disabled when 0 marks. The tooltip says "Mark words you don't know first." The secondary link "Nothing to mark → Finish" goes straight to Completed.

### 6.4 Reader — Reveal (Verify)

On "Reveal," set the phase to `revealed`, open the **Reveal panel**, and request any glosses not yet cached.

**Layout (desktop ≥ 1024px):** the reading column shifts left. A right panel of **400px** slides in (200ms ease-out).
**Mobile/tablet:** the panel is a **bottom sheet** (Radix Dialog / vaul-style) at 60% height, draggable to full.

```
┌──────────── Reveal panel ─────────────┐
│ 7 words         [Reveal all]  [⤢]     │
├───────────────────────────────────────┤
│ 落实                        ☑ Add      │
│ "…把落实自动化作为…"                   │
│ ┌───────────────────────────────────┐ │
│ │      Tap to reveal  (Space)        │ │
│ └───────────────────────────────────┘ │
├───────────────────────────────────────┤
│ 效率   xiào lǜ  🔊               ☑ Add  │
│ efficiency                             │
│ Here: how productively companies       │
│ operate.                               │
│ 效 effect · 率 rate                    │
│ noun · neutral · HSK-ish common        │
│ How did you do?                        │
│ ( Guessed it ) ( Partly ) ( No idea )  │
├───────────────────────────────────────┤
│ …                                      │
├───────────────────────────────────────┤
│        [ Start re-reading → ]          │
└───────────────────────────────────────┘
```

**Reveal item, collapsed (default):** the word in large type in the reading font, plus the sentence snippet (≤ 40 chars around the word, with the word in `--mark` color). Below that, a "Tap to reveal" placeholder.

**Reveal item, expanded:**
- **Pinyin** (tone-colored if enabled) + 🔊 TTS.
- **Gloss:** short contextual English (≤ 8 words), bold.
- **In context:** one sentence explaining what it means *here*.
- **Breakdown:** per-character meanings (e.g. `效 effect · 率 rate`). Very valuable for Chinese.
- **Meta chips:** part of speech · register (`formal` / `neutral` / `colloquial` / `literary`) · type (`word` / `phrase` / `chengyu` / `name`).
- **Note** (optional, ≤ 2 lines): collocations, a near-synonym contrast, a usage warning.
- **Self-rating:** `Guessed it` / `Partly` / `No idea` → stored as `inferResult`. Optional, not blocking.
- **Add to Word Bank** checkbox, checked by default. **Default to unchecked** when `type === 'name'` (proper nouns).
- **Already in Word Bank:** a badge "In your bank · seen 3×". The checkbox label changes to **"Review sooner"** (default on). If confirmed, the card's `due` is set to now (§6.6). The new context is always attached.
- **Segmentation suggestion:** if the LLM says the boundary is wrong, show a banner: "Did you mean **落实到**?" with an [Apply] button, which updates the merge and the mark.

**Panel ↔ text linking**
- Hovering or focusing a panel item highlights the word in the text (pulse outline) and scrolls it into view.
- Clicking a marked word in the text scrolls the panel to its item and expands it.

**Keyboard (desktop):** `J/K` next/previous item, `Space` reveal current, `1/2/3` self-rate, `A` toggle add, `R` reveal all.

**Loading & errors**
- While glosses load, show skeleton shimmer lines in the item. Items fill in independently as results arrive.
- **No API key:** show a banner at the top: "Dictionary mode: add a DeepSeek API key in Settings for meanings in context." Items show CEDICT senses (up to 3) and pinyin-pro pinyin. The Breakdown is built from single-character CEDICT entries.
- **LLM error / timeout (20s):** a per-item inline error with [Retry]. Fall back to dictionary data automatically so the learner is never blocked.

**Footer:** `[Start re-reading →]` moves to Pass 2. The panel stays available, collapsible with `[⤢]` or `\`.

### 6.5 Reader — Pass 2: Re-read

- **Pinyin ruby** above marked words. In the Aa menu: `Pinyin: Off / Marked words (default) / All words`. Use `<ruby>` / `<rt>`.
  - **Line height stays constant across all passes** (reserve ruby space from Pass 1), so the text **never reflows** when pinyin appears. The learner's spatial memory of the page is preserved.
- **Tap a marked word:** gloss popover (pinyin, gloss, in-context line, 🔊). **Tap an unmarked word:** marks it (late discovery) and shows its gloss instantly, since flow is no longer the priority on the second read. It is added to the panel.
- **Sentence translation:** a subtle `⋯` / `译` icon at the end of each sentence on hover (desktop), or long-press anywhere in the sentence (mobile). It expands an English translation **below the sentence**, inline, in `--ink-muted` UI font. Translations are fetched per sentence on demand (§7.3) and cached. There is **no "translate whole passage" button**, by design: full L1 translation is easy to over-use and short-circuits engagement with the text.
- **Read aloud:** a ▶ button in the action bar. TTS reads sentence by sentence and highlights the current sentence (`--surface-hover` background). Speed is 0.6×–1.2×, default 0.9×.
- **Action bar:** `[▶ Read aloud]   12 words to add   [ Finish & add to Word Bank → ]`

**Finish modal**
```
┌──────── Nice work ─────────┐
│ You read 1,248 characters  │
│ 12 new words → Word Bank   │
│ 2 existing words → sooner  │
│ Guessed 5 · Partly 4 · ✗ 3 │
│ [Back to Library] [Review] │
└────────────────────────────┘
```
On confirm: create Words, Contexts, and Cards (§6.6, §8), and set the passage status to `completed`. If the learner re-opens a completed passage, it opens in Pass 2 with the panel available. Words are never double-added; contexts are de-duplicated by `(wordId, passageId, sentenceIdx)`.

### 6.6 Word Bank

**Word creation rules (on Finish)**
- Key = the simplified surface form (`落实`). If the word already exists, **attach a new Context** and do not create a new word.
- Word fields come from the LLM gloss (or the dictionary fallback): pinyin, gloss, breakdown, POS, register, note.
- Create **one card of type `recognition`** per new word (v1). The `cloze` card type is planned (§12) but the schema supports it now.
- "Review sooner" on an existing word sets its card's `due = now` but does **not** record a fake review. It also increments `word.encounters`.

**Word Bank screen**
```
┌──────────────────────────────────────────────────────────────┐
│ Word Bank (342)   [🔍 hanzi / pinyin / english ]              │
│ Filter: All · New · Learning · Review · Suspended · Known     │
│ Sort: Recently added ▾                          [Export ▾]    │
├──────────────────────────────────────────────────────────────┤
│ 落实  luò shí   to implement      Learning · due in 2d   3 ctx │
│ 效率  xiào lǜ   efficiency        Review · due in 18d    1 ctx │
│ …                                                             │
└──────────────────────────────────────────────────────────────┘
```
- Search matches hanzi, pinyin with or without tones (`luoshi` matches `luò shí`), and English.
- Clicking a row opens the **Word detail drawer**: big word, pinyin, 🔊, editable gloss and note, breakdown, **all contexts** (sentence + passage title link + date), review history (rating timeline), and FSRS stats (stability, difficulty, next due). Actions: Suspend, Mark as known (removed from reviews), Reset progress, Delete (with confirmation).
- Manual add: a `+ Add word` button with fields for hanzi (required), plus an optional sentence. It auto-fills pinyin and meaning via dictionary or LLM.

### 6.7 Review (SRS)

**Algorithm:** ts-fsrs with defaults; `request_retention` comes from Settings (default **0.90**). Turn on `enable_fuzz`. Use learning steps (default 1m, 10m).

**Queue building** (`lib/srs/queue.ts`)
1. Due review/learning cards (`due ≤ now`), most overdue first, capped at `maxReviewsPerDay` (default 200).
2. Then new cards, oldest first, capped at `newCardsPerDay` (default 20, counted per local day).
3. Learning cards that come due again during the session are re-inserted.
4. Exclude suspended and known words.

**Card UI: recognition (v1)**
```
Front                                   Back
┌──────────────────────────────┐        ┌──────────────────────────────┐
│                              │        │           落实               │
│            落实              │        │      luò shí   🔊            │
│                              │        │   to implement; carry out    │
│  …越来越多的企业开始把        │        │ "…越来越多的企业开始把        │
│   落实 自动化作为…           │        │   落实 自动化作为…"          │
│                              │        │   → (sentence translation)   │
│                              │        │  落 fall · 实 solid          │
│      [ Show answer ]  Space  │        │ ▸ 2 more contexts · notes    │
└──────────────────────────────┘        │ [Again 1m][Hard 6m][Good 10m][Easy 4d] │
                                        └──────────────────────────────┘
```
- **Front:** the word large (64px, reading font), with **one** context sentence below it (word highlighted in `--mark`). **Rotate the context** shown on each review, round-robin through `word.contexts`, so the learner doesn't just memorize one sentence.
- **Back:** pinyin (tone-colored), 🔊 (auto-play setting, default on), gloss, the sentence translation (from cache, or fetched lazily), breakdown, collapsible "more contexts" and note, and a "From: passage title" link.
- **Rating bar** shows the interval preview under each button from `scheduler.repeat()`. Keys: `1` Again, `2` Hard, `3` Good, `4` Easy, `Space` show answer / Good.
- **Other keys:** `Z` undo last rating (restore the previous card state, delete the log), `E` edit word, `S` suspend, `K` mark as known.
- **Header:** a progress bar plus `Due 23 · New 10 · Done 7`.
- **Session summary:** cards reviewed, % correct (Good/Easy), time spent, and a "Come back tomorrow: 31 due" forecast.
- **Empty state:** "All caught up 🎋" and a "Read something new" call to action.
- **Leech:** when `lapses ≥ 8`, auto-tag the word `leech` and show a gentle note on the back ("This one's tricky; try adding a note or mnemonic").

### 6.8 Settings

| Section | Setting | Default |
|---|---|---|
| **AI** | API key (password field, show/hide) | — |
| | Base URL | `https://api.deepseek.com` |
| | Model | `deepseek-chat` |
| | [Test connection] → calls `/api/llm/ping` | — |
| **Reading** | Lookup style: Deferred (recommended) / Instant | Deferred |
| | Font family | Noto Serif SC |
| | Font size | 28px |
| | Line height | Normal |
| | Pinyin display in Pass 2 | Marked words |
| | Tone colors | On |
| | Underline Word Bank words | On |
| | TTS voice (list of zh-CN voices) / speed | first zh-CN / 0.9× |
| **Review** | New cards per day | 20 |
| | Max reviews per day | 200 |
| | Desired retention | 0.90 (slider 0.80–0.97) |
| | Auto-play audio on answer | On |
| **Appearance** | Theme: System / Light / Dark | System |
| **Data** | Export all (JSON), Export Word Bank (CSV, Anki-compatible), Import JSON (merge or replace), Delete all data (type "DELETE" to confirm) | — |

The API key is stored in IndexedDB `settings`. Show a security note: "Stored only in this browser. Sent only to your configured AI provider via this app's server."

---

## 7. LLM Integration

### 7.1 General
- OpenAI-compatible `POST {baseUrl}/chat/completions` with `response_format: { type: "json_object" }`, `temperature: 0.2`.
- Validate every response with zod. On a parse failure, retry once with a "Return valid JSON only" reminder, then fall back to the dictionary.
- **Cache** (`glossCache` table), keyed by `sha1(word + '|' + sentence)`. The translation cache is keyed by `sha1(sentence)`. Cache entries never expire (the user can clear them in Settings).
- **Batching:** at most 25 words per gloss request. Run up to 3 requests concurrently.
- **Context window:** send the full passage if ≤ 4,000 chars. Otherwise send only the paragraphs containing the requested words, plus 1 neighboring paragraph each.

### 7.2 `/api/llm/gloss`

**Request (client → route)**
```json
{
  "passageTitle": "人工智能与未来的工作",
  "context": "…passage or excerpt…",
  "items": [
    { "id": "m_12", "word": "落实", "sentence": "越来越多的企业开始把落实自动化作为提高效率的重要手段。" }
  ]
}
```

**System prompt (store in `lib/llm/prompts.ts`)**
```
You are an expert Chinese teacher helping an upper-intermediate learner (HSK 4–5, aiming for HSK 6+)
read authentic Simplified Chinese. For each item, explain the word AS USED IN ITS SENTENCE.
Be concise and accurate. English output only, except for Chinese characters and pinyin.
Pinyin must use tone marks (e.g. "luò shí"), syllables separated by spaces, and must reflect
the pronunciation in this context (handle polyphones such as 行, 长, 得, 了 correctly).
If the given word boundary looks wrong for this sentence (e.g. it is part of a larger word,
phrase or chengyu, or should be shorter), set segmentation.ok=false and give the better span
in segmentation.suggested (it must be a substring of the sentence containing the original word).
Return JSON matching the schema exactly.
```

**Response schema**
```json
{
  "items": [
    {
      "id": "m_12",
      "word": "落实",
      "pinyin": "luò shí",
      "gloss": "to implement; carry out",
      "inContext": "Here: actually putting automation into practice, not just planning it.",
      "breakdown": [ { "char": "落", "meaning": "fall; land" }, { "char": "实", "meaning": "solid; real" } ],
      "pos": "verb",
      "register": "formal",
      "type": "word",
      "note": "Very common in official/business writing; collocates with 政策、措施、责任.",
      "segmentation": { "ok": true, "suggested": null }
    }
  ]
}
```
Field constraints: `gloss` ≤ 8 words; `inContext` ≤ 25 words; `register ∈ {formal, neutral, colloquial, literary}`; `type ∈ {word, phrase, chengyu, name, grammar}`; `note` optional, ≤ 30 words.

### 7.3 `/api/llm/translate`
Request: `{ "sentences": [{ "id": "s_4", "text": "…" }], "context": "…" }` → Response: `{ "items": [{ "id": "s_4", "translation": "…" }] }`.
Prompt: natural, faithful English. Keep the tone. Do not add explanations.

### 7.4 `/api/llm/ping`
Sends a minimal request and returns `{ ok: true, model }` or `{ ok: false, error }`. Used by "Test connection."

### 7.5 Dictionary fallback (no key / offline / error)
- pinyin: `pinyin-pro` with `{ toneType: 'symbol', type: 'string' }` run on the whole sentence, then slice out the word's syllables (this improves polyphone handling).
- gloss: the first CEDICT sense; senses 2–3 are shown below it. breakdown: the first sense of each character's CEDICT entry. pos, register, and type: omitted.
- The UI labels this "dictionary" with a small chip so the learner knows it isn't contextual.

---

## 8. Data Model (Dexie)

```ts
// lib/db/schema.ts
db.version(1).stores({
  passages:     'id, status, createdAt, updatedAt, lastOpenedAt',
  marks:        'id, passageId, [passageId+start]',
  words:        'id, &simplified, status, createdAt',
  contexts:     'id, wordId, passageId, [wordId+passageId+sentenceIdx]',
  cards:        'id, wordId, due, state',
  reviewLogs:   'id, cardId, reviewedAt',
  glossCache:   'key',
  translationCache: 'key',
  settings:     'id',          // singleton 'app'
  dict:         'key'          // CEDICT storage if chosen over static JSON
});
```

```ts
type Passage = {
  id: string; title: string; text: string;
  tokens: Token[];                      // base segmentation
  merges: { start: number; end: number }[];  // user overrides (char offsets)
  phase: 'pass1' | 'revealed' | 'pass2' | 'completed';
  scrollY: number;
  createdAt: number; updatedAt: number; lastOpenedAt: number;
};

type Mark = {
  id: string; passageId: string;
  start: number; end: number;           // char offsets in passage.text
  surface: string; sentenceIdx: number;
  peek: 'none' | 'pinyin' | 'meaning';
  inferResult?: 'knew' | 'partial' | 'none';
  addToBank: boolean;                   // default true (false for type 'name')
  glossKey?: string;                    // → glossCache
  createdAt: number;
};

type Word = {
  id: string; simplified: string;
  pinyin: string; gloss: string; breakdown: { char: string; meaning: string }[];
  pos?: string; register?: string; type?: string; note?: string;
  userNote?: string; tags: string[];
  status: 'active' | 'suspended' | 'known';
  encounters: number;                   // times marked across passages
  createdAt: number; updatedAt: number;
};

type Context = {
  id: string; wordId: string; passageId: string | null;
  sentence: string; sentenceIdx: number;
  inContext?: string;                   // LLM contextual explanation
  translation?: string;
  createdAt: number;
};

type CardRow = {
  id: string; wordId: string; type: 'recognition' | 'cloze';
  // ts-fsrs Card fields:
  due: number; stability: number; difficulty: number;
  elapsed_days: number; scheduled_days: number; learning_steps: number;
  reps: number; lapses: number; state: 0 | 1 | 2 | 3; last_review?: number;
  nextContextIdx: number;               // rotation pointer
};

type ReviewLogRow = {
  id: string; cardId: string; rating: 1 | 2 | 3 | 4;
  reviewedAt: number; durationMs: number;
  prevCard: Omit<CardRow, 'id'>;        // enables undo
};
```
- IDs: `nanoid()`.
- Dates: epoch ms in the DB. Convert to `Date` at the ts-fsrs boundary.
- **Export JSON:** `{ app: 'bamboo', schemaVersion: 1, exportedAt, data: { ...allTablesExceptCaches } }`. Exclude the API key unless the user ticks "include API key."
- **CSV export:** columns `Hanzi, Pinyin, Meaning, Sentence, SentenceTranslation, Notes, Tags`, UTF-8 with BOM.

---

## 9. Visual Design System

### 9.1 Mood
**"Rice paper, ink, and bamboo."** A warm, quiet reading surface; ink-black text; bamboo green as the brand and action color; **vermilion (朱红, the color of a seal stamp)** for marked words, so marking feels like annotating with a red brush. No gradients or heavy shadows. Thin borders and generous whitespace.

### 9.2 Color tokens

Define these as CSS variables in `app/globals.css` and map them into Tailwind's theme.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F3EA` (rice paper) | `#151719` | App background / reading surface |
| `--surface` | `#FFFDF8` | `#1D2023` | Cards, panels, popovers |
| `--surface-hover` | `#F0EADC` | `#262A2E` | Hover/focus backgrounds, TTS sentence |
| `--border` | `#E4DCCB` | `#2F3337` | Hairlines (1px) |
| `--ink` | `#1E1D1A` | `#ECE7DC` | Primary text (reading) |
| `--ink-muted` | `#6A655B` | `#A29C90` | Secondary text, translations |
| `--ink-faint` | `#A8A193` | `#5F5A52` | Placeholders, word-bank dotted underline |
| `--primary` (bamboo) | `#3F7D58` | `#6DB488` | Primary buttons, active nav, progress |
| `--primary-hover` | `#33684A` | `#82C49B` | |
| `--primary-tint` | `#E2EEE5` | `#1F3328` | Selected chips, success backgrounds |
| `--mark` (vermilion) | `#C2412D` | `#E8705B` | Marked underline, highlighted word in sentences |
| `--mark-bg` | `#F7DDD5` | `rgba(232,112,91,0.18)` | Marked word background |
| `--peek` (amber) | `#B7862A` | `#E2B65A` | Peeked underline, "dictionary" chip |
| `--peek-bg` | `#F6EACB` | `rgba(226,182,90,0.16)` | |
| `--danger` | `#B3261E` | `#F2867D` | Destructive actions, "Again" |
| `--focus` | `#3F7D58` at 50% (2px ring, 2px offset) | `#6DB488` at 60% | Keyboard focus |

**Rating buttons:** Again = `--danger` outline, Hard = `--peek` outline, Good = `--primary` filled, Easy = `#2F6F8F` (light) / `#6FB2D2` (dark) outline.

**Tone colors** (pinyin, if enabled; Pleco-style convention):
| Tone | Light | Dark |
|---|---|---|
| 1 (ā) | `#D0443A` | `#F07A6E` |
| 2 (á) | `#D3851C` | `#F0AE55` |
| 3 (ǎ) | `#3B9455` | `#6CC487` |
| 4 (à) | `#3468BE` | `#78A5EE` |
| 5 (neutral) | `#8A857B` | `#9E988C` |

All text/background pairs must meet **WCAG AA** (4.5:1 body, 3:1 large text). Check the mark and tone colors on both `--bg` and `--surface`.

### 9.3 Typography
| Role | Font | Size / line-height |
|---|---|---|
| Reading text (default) | **Noto Serif SC** (思源宋体), weights 400/600 | 28px / 2.2 (constant across passes, reserves ruby space), `letter-spacing: 0.04em` |
| Reading alt 1 | **LXGW WenKai** (霞鹜文楷), friendly brush/kai style | same |
| Reading alt 2 | **Noto Sans SC** (思源黑体) | same |
| Ruby pinyin | **Inter**, 400, `0.42em` of the reading size, `--ink-muted` (or tone colors) | — |
| UI | **Inter** + Noto Sans SC fallback | 14–16px / 1.5 |
| Review word | Reading font, 600 | 64px desktop / 52px mobile |
| Panel word | Reading font, 600 | 28px |

Load fonts via `next/font` (Google) where available. LXGW WenKai is self-hosted from its npm package or CDN with `unicode-range` subsets. Use `font-display: swap`.

**Paragraphs:** `text-indent: 2em` (the Chinese typographic convention), 1em gap between paragraphs. `text-align: justify` with `text-justify: inter-character`.

### 9.4 Spacing, shape, motion
- 4px base spacing scale. Radii: 6px (chips, tokens 4px), 10px (cards, popovers), 16px (sheets).
- Shadows: only on floating elements (popovers, sheets): `0 8px 24px rgba(30,29,26,0.10)`.
- Motion: 150ms for token highlights, 200ms ease-out for panel/sheet transitions, 120ms for reveal expand. Respect `prefers-reduced-motion` (turn transitions off and use instant state changes).
- **Mark feedback:** the highlight background fades in from 0 → 100% over 150ms, and the underline draws left → right. It should feel like a brush stroke and stay subtle.

### 9.5 Responsive breakpoints
| Width | Behavior |
|---|---|
| < 640px | Bottom tab bar (hidden in Reader); Reveal = bottom sheet; reading font default 24px; side padding 20px |
| 640–1023px | Top nav; Reveal = bottom sheet (or 360px overlay panel in landscape) |
| ≥ 1024px | Top nav; Reveal = 400px right panel; reading column re-centers in remaining space |

Touch targets are at least 44×44px. Tokens are naturally ~28px tall, so add **invisible vertical padding** to tokens on touch devices so taps register.

### 9.6 Brand
- Name: **Bamboo** (竹). Wordmark: "竹 Bamboo", with 竹 in Noto Serif SC 600 inside a small rounded square in `--primary` with white text (a seal-like mark). Use it as the favicon and PWA icon.
- Voice: warm, concise, encouraging, never gamified to excess. ("Nice work." / "All caught up.")

---

## 10. Accessibility & Quality Bar
- All interactive tokens are `<button>`-semantics spans (`role="button"`, `tabIndex` roving, `aria-pressed` for marked). The reading text stays selectable/copyable when the learner holds Alt (desktop).
- Popovers and sheets trap focus and close on Esc. Panel items are reachable by keyboard.
- `lang="zh-CN"` on reading text, `lang="en"` on glosses, so screen readers pronounce each correctly.
- No layout shift between passes (constant line-height).
- Performance: a 10,000-character passage renders in < 200ms after segmentation, and a mark toggle responds in < 16ms. Memoize tokens; mark state lives in a `Set<start>` lookup.
- Works offline (except LLM calls) after first load.

---

## 11. Milestones & Acceptance Criteria

Implement in order. Each milestone ends with passing tests and a working build.

### M0: Foundation
- Next.js + TS strict + Tailwind v4 + shadcn/ui + Dexie + ESLint/Prettier + Vitest + Playwright set up.
- Design tokens (§9.2), fonts (§9.3), light/dark/system theme, nav shell (desktop top nav, mobile tab bar), empty pages for all routes.
- Settings page persists to IndexedDB.
- ✅ *Theme toggle works without flash (set `data-theme` before hydration); settings survive reload.*

### M1: Paste → Reading Mode → Marking
- Library paste box with validation and normalization, passage cards, sample passage.
- Segmenter + sentence splitter with unit tests (include cases: quotes after 。, `……`, mixed Latin/numbers, empty lines).
- Reader Pass 1: token rendering, mark/unmark, mark toolbar, Extend/Split/drag-merge, keyboard navigation, autosave, scroll restore, Aa menu.
- ✅ *Paste text → read → mark 5 words incl. one 2-word merge → reload → marks and phase restored.*

### M2: Dictionary, Peek, and the Reveal Panel (dictionary mode)
- `scripts/build-cedict.ts` + lazy loader; pinyin-pro integration; TTS helper.
- Peek popover (pinyin → show meaning) with logging.
- Reveal panel (desktop side panel and mobile sheet), collapsed/expanded items, self-rating, add checkbox, panel↔text linking, keyboard shortcuts, "dictionary" chip.
- ✅ *With no API key, the full Read → Reveal flow works offline using CEDICT.*

### M3: LLM Integration
- Provider abstraction, DeepSeek implementation, `/api/llm/gloss|translate|ping` routes, zod schemas, cache, batching, background prefetch, retry and fallback, segmentation suggestion UI.
- ✅ *With a key: Reveal shows contextual pinyin, gloss, inContext, and breakdown; re-opening a passage hits the cache (no network); an invalid key shows a clear error and falls back to the dictionary.*

### M4: Pass 2 Re-read
- Ruby pinyin modes with zero reflow, gloss popovers, late marking, per-sentence translation, read-aloud with sentence highlighting, Finish modal creating words, contexts, and cards (with de-duplication and "review sooner").
- ✅ *Finishing a passage with 10 marks (2 already in bank, 1 proper noun) yields 7 new words + 2 updated words with new contexts.*

### M5: Word Bank & Review
- ts-fsrs wrapper, queue builder (limits, per-day new count), review UI with context rotation, interval previews, shortcuts, undo, suspend/known, leech tagging, session summary.
- Word Bank list, search (incl. toneless pinyin), filters, detail drawer, manual add.
- Due badge in nav.
- ✅ *Unit tests for queue limits, undo, and context rotation. E2E: add words from a passage → review → ratings reschedule correctly.*

### M6: Data, PWA, Polish
- JSON export/import (merge/replace with zod validation), CSV export, delete all.
- Serwist PWA: installable, offline app shell + dictionary.
- About page with CC-CEDICT, font, and library attributions.
- Accessibility pass (axe in Playwright), reduced motion, contrast check, mobile QA at 375px.
- ✅ *Lighthouse PWA installable; axe shows 0 serious violations; export → delete all → import restores everything.*

---

## 12. Post-v1 Backlog (prioritized)
1. **Known-word tracking and coverage estimate** (LingQ-style): words not marked in completed passages count as "known" implicitly. Show "≈ 96% known" on new passages to help pick text at the right level (§3, 95–98% coverage).
2. **Cloze / production cards:** after a recognition card reaches stability > 21 days, unlock a cloze card (sentence with the word blanked + English hint → type the hanzi with an IME).
3. **Listening cards** (audio of the sentence → meaning).
4. **URL import** (readability extraction) and **LLM-generated passages** at a target coverage level using the learner's due words.
5. **Grammar pattern and chengyu extraction** from passages (e.g. 不但…而且, 之所以…是因为).
6. **Server-held API key + accounts + sync** (Supabase): flip the proxy to `process.env.DEEPSEEK_API_KEY`, add auth and rate limits.
7. **Stats dashboard:** retention curve, reviews forecast, words added per week, peek rate vs. retention (to validate ADR-001 on our own data).
8. **FSRS parameter optimization** from the learner's review logs.
9. Better segmentation (jieba-wasm) and cloud neural TTS.
10. Traditional characters.

---

## 13. Open Questions (non-blocking; defaults chosen)
| Question | Default taken |
|---|---|
| Should "Guessed it / Partly / No idea" affect the first FSRS schedule? | **No** in v1. Stored as metadata only, to analyze later. |
| Should Pass 2 allow full-passage translation? | **No.** Per-sentence only, by design (§6.5). |
| Max passage length | 10,000 chars |
| Daily new cards default | 20 |

---

## 14. References
- Butler, A. C., Karpicke, J. D., & Roediger, H. L. (2007). The effect of type and timing of feedback on learning from multiple-choice tests. *Journal of Experimental Psychology: Applied.*
- Godfroid, A., et al. (2018). Incidental vocabulary learning in a natural reading context: An eye-tracking study. *Bilingualism: Language and Cognition.*
- Hu, M., & Nation, I. S. P. (2000). Unknown vocabulary density and reading comprehension. *Reading in a Foreign Language.*
- Hulstijn, J., Hollander, M., & Greidanus, T. (1996). Incidental vocabulary learning by advanced foreign language students: The influence of marginal glosses, dictionary use, and reoccurrence of unknown words. *Modern Language Journal.*
- Kornell, N., Hays, M. J., & Bjork, R. A. (2009). Unsuccessful retrieval attempts enhance subsequent learning. *JEP: Learning, Memory, and Cognition.*
- Laufer, B., & Hulstijn, J. (2001). Incidental vocabulary acquisition in a second language: The construct of task-induced involvement. *Applied Linguistics.*
- Laufer, B., & Ravenhorst-Kalovski, G. C. (2010). Lexical threshold revisited. *Reading in a Foreign Language.*
- Mondria, J.-A. (2003). The effects of inferring, verifying, and memorizing on the retention of L2 word meanings. *Studies in Second Language Acquisition.*
- Pellicer-Sánchez, A., & Schmitt, N. (2010). Incidental vocabulary acquisition from an authentic novel. *Reading in a Foreign Language.*
- Potts, R., & Shanks, D. R. (2014). The benefit of generating errors during learning. *Journal of Experimental Psychology: General.*
- Webb, S. (2007). The effects of repetition on vocabulary knowledge. *Applied Linguistics.*
- Yanagisawa, A., Webb, S., & Uchihara, T. (2020). How do different forms of glossing contribute to L2 vocabulary learning from reading? *Studies in Second Language Acquisition.*
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling (FSRS). *KDD '22.*
