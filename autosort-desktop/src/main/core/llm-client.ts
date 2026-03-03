import { LLMDecision, llmDecisionFromDict } from './types';

const MAX_SNIPPET_CHARS = 2500;

function extractJsonObj(text: string): string | null {
  const s = text.trim();
  if (!s) return null;
  if (s.startsWith('{') && s.endsWith('}')) return s;
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i >= 0 && j > i) return s.substring(i, j + 1);
  return null;
}

const SYSTEM_PROMPT =
  'Return ONLY one JSON object (no markdown, no extra text). ' +
  'Keys: doc_type, project, vendor, date, suggested_name, confidence, reasons, tags. ' +
  'doc_type must be one of: ops_doc, other, dev_archive, dev_note, photo. ' +
  'date must be YYYY-MM-DD or null. confidence is 0..1. ' +
  'reasons/tags are arrays of short strings.';

export async function llmClassify(
  baseUrl: string,
  fileMeta: Record<string, unknown>,
  snippet: string,
  timeoutMs = 120000
): Promise<LLMDecision | null> {
  const userObj = {
    file_meta: fileMeta,
    content_snippet: snippet.substring(0, MAX_SNIPPET_CHARS),
    naming_rule:
      'suggested_name: keep short; prefer original filename unless clear.',
  };

  const payload = {
    model: 'not-used',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userObj) },
    ],
    temperature: 0,
    max_tokens: 400,
    stream: false,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0].message.content;
    const js = extractJsonObj(content);
    if (!js) return null;
    const parsed = JSON.parse(js);
    const dec = llmDecisionFromDict(
      typeof parsed === 'object' && parsed !== null ? parsed : {}
    );
    if (!dec.suggested_name) {
      dec.suggested_name = String(fileMeta.name ?? 'unnamed');
    }
    return dec;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('LLM_TIMEOUT');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function llmClassifyOllama(
  baseUrl: string,
  fileMeta: Record<string, unknown>,
  snippet: string,
  timeoutMs = 120000
): Promise<LLMDecision | null> {
  const userObj = {
    file_meta: fileMeta,
    content_snippet: snippet.substring(0, MAX_SNIPPET_CHARS),
    naming_rule:
      'suggested_name: keep short; prefer original filename unless clear.',
  };

  const payload = {
    model: 'qwen2:1.5b',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userObj) },
    ],
    stream: false,
    options: { temperature: 0 },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { message: { content: string } };
    const content = data.message.content;
    const js = extractJsonObj(content);
    if (!js) return null;
    const parsed = JSON.parse(js);
    const dec = llmDecisionFromDict(
      typeof parsed === 'object' && parsed !== null ? parsed : {}
    );
    if (!dec.suggested_name) {
      dec.suggested_name = String(fileMeta.name ?? 'unnamed');
    }
    return dec;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('LLM_TIMEOUT');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function llmClassifyWithRetry(
  baseUrl: string,
  fileMeta: Record<string, unknown>,
  snippet: string,
  llmType: 'llama_cpp' | 'ollama' = 'llama_cpp',
  maxRetries = 3,
  timeoutMs = 120000
): Promise<LLMDecision | null> {
  const delays = [2000, 4000, 8000];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (llmType === 'ollama') {
        return await llmClassifyOllama(baseUrl, fileMeta, snippet, timeoutMs);
      }
      return await llmClassify(baseUrl, fileMeta, snippet, timeoutMs);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (
        msg === 'LLM_TIMEOUT' ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('fetch failed')
      ) {
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }
  return null;
}

export async function warmup(llmBaseUrl: string): Promise<void> {
  const payload = {
    model: 'not-used',
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
    temperature: 0,
    stream: false,
  };
  try {
    const url = `${llmBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    // warmup failure is non-fatal
  }
}
