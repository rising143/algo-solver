import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { SolverConfig } from './types';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

export interface ChatCallbacks {
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

/**
 * 以 OpenAI 兼容接口调用模型（非流式，更稳定）。
 * 返回一个可调用的 cancel 函数。
 */
export function chat(
  config: SolverConfig,
  problemText: string,
  cb: ChatCallbacks
): () => void {
  const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/chat/completions`);
  const body = JSON.stringify({
    model: config.model,
    stream: false,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: buildSystemPrompt(config) },
      { role: 'user', content: buildUserPrompt(problemText) },
    ],
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Length': String(Buffer.byteLength(body)),
  };

  const lib = url.protocol === 'https:' ? https : http;
  let aborted = false;
  let settled = false;
  let req: http.ClientRequest;

  const timer = setTimeout(() => {
    if (settled) return;
    aborted = true;
    try { req.destroy(); } catch { /* noop */ }
    settled = true;
    cb.onError(new Error(`请求超时（${config.requestTimeoutMs}ms），请检查网络或增大超时设置`));
  }, config.requestTimeoutMs);

  const options: https.RequestOptions = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    headers,
  };

  req = lib.request(options, (res) => {
    let data = '';

    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
      res.on('data', (c) => (data += c.toString()));
      res.on('end', () => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        cb.onError(new Error(`API 返回错误 ${res.statusCode}: ${data.slice(0, 500)}`));
      });
      return;
    }

    res.setEncoding('utf8');
    res.on('data', (chunk: string) => {
      if (aborted) return;
      data += chunk;
    });
    res.on('end', () => {
      if (aborted || settled) return;
      clearTimeout(timer);
      settled = true;
      try {
        const json = JSON.parse(data);
        const content = json?.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          cb.onDone(content);
        } else {
          cb.onError(new Error(`API 返回格式异常: ${data.slice(0, 300)}`));
        }
      } catch (e: any) {
        cb.onError(new Error(`解析 API 响应失败: ${e?.message ?? e}`));
      }
    });
    res.on('error', (e) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      cb.onError(e);
    });
  });

  req.on('error', (e) => {
    if (settled) return;
    clearTimeout(timer);
    settled = true;
    cb.onError(e);
  });

  req.write(body);
  req.end();

  return () => {
    if (aborted) return;
    aborted = true;
    clearTimeout(timer);
    try { req.destroy(); } catch { /* noop */ }
  };
}
