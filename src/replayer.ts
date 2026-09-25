import * as vscode from 'vscode';
import { SolveScript, SolverConfig } from './types';
import { extractRawCode } from './scriptParser';

export interface ReplayResult {
  completed: boolean;
  interrupted: boolean;
  fallbackUsed: boolean;
}

/**
 * 逐字插入完整代码，模拟人类打字。
 * 策略：从 startPos 开始，逐字插入整个 finalCode。
 * 每次插入后从文档实际内容推算光标位置，避免 offset 计算错误。
 */
export async function replayScript(
  editor: vscode.TextEditor,
  startPos: vscode.Position,
  script: SolveScript,
  config: SolverConfig,
  isCancelled: () => boolean,
  logger: (msg: string) => void
): Promise<ReplayResult> {
  // 规范化换行：统一为 \n
  let finalCode = script.finalCode.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 规范化：修复 ): 后跟空格（非换行）的情况，强制添加换行（Python 函数体）
  finalCode = normalizeFinalCode(finalCode);
  if (!finalCode) {
    return { completed: false, interrupted: false, fallbackUsed: false };
  }

  // 日志：输出 finalCode 转义形式，方便诊断
  logger(`finalCode 转义：${JSON.stringify(finalCode)}`);
  logger(`开始逐字插入：${finalCode.length} 字符`);

  const interrupted = await insertWithTypewriter(editor, startPos, finalCode, config, isCancelled, logger);
  if (interrupted) {
    return { completed: false, interrupted: true, fallbackUsed: false };
  }

  logger(`回放完成：逐字插入 ${finalCode.length} 字符，无回退。`);
  return { completed: true, interrupted: false, fallbackUsed: false };
}

/**
 * 规范化 finalCode：修复 Python 中 ): 后跟空格（非换行）的情况。
 */
function normalizeFinalCode(code: string): string {
  return code.replace(/\):([ \t]{2,})(?![ \t]*\n)/g, '):\n$1');
}

/**
 * 逐字插入文本，模拟人类打字。
 * 关键改进：每次插入后用 selection 定位光标（VS Code 会自动把光标移到插入点之后），
 * 而非自己计算 position。这彻底避免了 position 计算错误。
 */
async function insertWithTypewriter(
  editor: vscode.TextEditor,
  startPos: vscode.Position,
  text: string,
  config: SolverConfig,
  isCancelled: () => boolean,
  logger: (msg: string) => void
): Promise<boolean> {
  if (text.length === 0) return false;

  // charDelayMs 为 0：整段一次性插入
  if (config.charDelayMs <= 0) {
    const success = await editor.edit((eb) => eb.insert(startPos, text));
    if (success) {
      const doc = editor.document;
      const startOff = doc.offsetAt(startPos);
      const endPos = doc.positionAt(startOff + text.length);
      editor.selection = new vscode.Selection(endPos, endPos);
      editor.revealRange(new vscode.Range(startPos, endPos));
    }
    return false;
  }

  // 逐字插入：每次插入一个 chunk
  // 关键：每次插入前把光标设到插入位置，插入后 VS Code 自动移动光标
  let i = 0;
  let chunkCount = 0;
  // 初始光标位置
  editor.selection = new vscode.Selection(startPos, startPos);

  while (i < text.length) {
    if (isCancelled()) return true;

    let chunk: string;
    if (text[i] === '\n') {
      // 合并 \n + 后续缩进（空格/制表符）为一个块
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
      chunk = text.slice(i, j);
      i = j;
    } else {
      // 单个字符
      chunk = text[i];
      i++;
    }

    // 获取当前光标位置作为插入点
    const insertPos = editor.selection.active;

    // 用 editor.edit 插入
    const success = await editor.edit((eb) => {
      eb.insert(insertPos, chunk);
    });
    if (!success) {
      logger(`插入失败：chunk=${JSON.stringify(chunk)}，pos=${insertPos.line}:${insertPos.character}`);
      return false;
    }

    // 插入后 VS Code 自动把光标移到插入内容之后
    // 但为确保光标位置正确，手动设置：基于插入前 position + chunk 内容推算
    const newPos = calcNewPos(insertPos, chunk);
    editor.selection = new vscode.Selection(newPos, newPos);
    editor.revealRange(new vscode.Range(newPos, newPos));
    chunkCount++;

    // 延迟：模拟人类打字节奏
    const delay = calcHumanDelay(chunk, config.charDelayMs);
    await new Promise<void>((r) => setTimeout(r, delay));
  }

  logger(`逐字插入完成：${chunkCount} 块。`);
  return false;
}

/**
 * 根据插入的 chunk 计算新的光标位置。
 * chunk 中可能包含 \n + 缩进空格。
 */
function calcNewPos(pos: vscode.Position, chunk: string): vscode.Position {
  const lines = chunk.split('\n');
  if (lines.length === 1) {
    // 无换行：character 增加
    return new vscode.Position(pos.line, pos.character + lines[0].length);
  }
  // 有换行：最后一行的长度作为 character
  const lastLine = lines[lines.length - 1];
  return new vscode.Position(pos.line + lines.length - 1, lastLine.length);
}

/**
 * 模拟人类打字节奏的延迟计算。
 * - 普通字符：0.4~1.6 倍随机
 * - 标点符号（; : , ) }）：停顿稍长
 * - 换行+缩进：模拟回车+对齐，停顿更长
 * - 偶尔（8%概率）触发"思考停顿"：额外 300~800ms
 */
function calcHumanDelay(chunk: string, baseMs: number): number {
  const isNl = chunk.includes('\n');
  const lastChar = chunk[chunk.length - 1] ?? '';

  let multiplier: number;
  if (isNl) {
    // 换行+缩进：2.0~4.5 倍
    multiplier = 2.0 + Math.random() * 2.5;
  } else if (';:'.includes(lastChar)) {
    // 语句结束/冒号：1.8~3.5 倍
    multiplier = 1.8 + Math.random() * 1.7;
  } else if (',)]}'.includes(lastChar)) {
    // 逗号/右括号：1.2~2.2 倍
    multiplier = 1.2 + Math.random() * 1.0;
  } else if ('{('.includes(lastChar)) {
    // 左括号：0.8~1.5 倍
    multiplier = 0.8 + Math.random() * 0.7;
  } else {
    // 普通字符：0.4~1.6 倍
    multiplier = 0.4 + Math.random() * 1.2;
  }

  let delay = Math.max(1, Math.round(baseMs * multiplier));

  // 8% 概率触发思考停顿
  if (Math.random() < 0.08) {
    delay += 300 + Math.round(Math.random() * 500);
  }

  return delay;
}

export async function rawFallback(
  editor: vscode.TextEditor,
  startPos: vscode.Position,
  rawText: string,
  config: SolverConfig,
  isCancelled: () => boolean,
  logger: (msg: string) => void
): Promise<void> {
  const code = extractRawCode(rawText);
  if (!code) return;
  logger('脚本解析失败，已提取原始代码整体插入。');
  await insertWithTypewriter(editor, startPos, code, config, isCancelled, logger);
}
