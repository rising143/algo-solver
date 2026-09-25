import { SolveScript } from './types';

/**
 * 从模型返回的文本中提取纯代码，包装为 SolveScript。
 * 改用纯代码模式：模型返回 markdown 代码块，换行是真实字符，不存在 JSON 转义问题。
 */
export function parseScript(raw: string): SolveScript | null {
  const code = extractRawCode(raw);
  if (!code) return null;
  return { finalCode: code, steps: [] };
}

/**
 * 从文本中提取纯代码（去 markdown 包裹）。
 */
export function extractRawCode(raw: string): string {
  // 优先匹配 ```lang ... ```
  const fenceMatch = raw.match(/```(?:[a-zA-Z0-9]+)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // 没有 markdown 包裹，直接 trim
  return raw.trim();
}
