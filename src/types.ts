export interface SolveStep {
  /** 当前文档中已存在且唯一的字符串，新内容插在其后；空串仅第一步允许（起始光标处） */
  anchor: string;
  /** 本次插入的文本 */
  text: string;
}

export interface SolveScript {
  /** 所有 steps 执行后的完整代码，用于兜底校验 */
  finalCode: string;
  /** 有序插入步骤 */
  steps: SolveStep[];
}

export interface SolverConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  charDelayMs: number;
  stepDelayMs: number;
  requestTimeoutMs: number;
  temperature: number;
}
