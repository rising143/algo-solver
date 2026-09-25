import { SolverConfig } from './types';

const LANGUAGE_HINT: Record<string, string> = {
  cpp: 'C++（使用标准库，main 函数，追求运行时间最快）',
  python: 'Python（追求运行时间最快，可用 sys.stdin 快速读入）',
  java: 'Java（含 main 方法，追求运行时间最快）',
  c: 'C（追求运行时间最快）',
  go: 'Go（追求运行时间最快）',
  rust: 'Rust（追求运行时间最快）',
  javascript: 'JavaScript（Node.js，追求运行时间最快）',
  typescript: 'TypeScript（Node.js，追求运行时间最快）',
};

export function buildSystemPrompt(config: SolverConfig): string {
  const langHint = LANGUAGE_HINT[config.language] ?? config.language;
  return `你是一名算法竞赛解题专家。阅读算法题目，输出运行时间最快的纯代码答案。

【核心规则 - 必须遵守】
1. 解题语言：${langHint}。
2. 只输出纯代码，无解释、无注释。严禁输出任何注释（包括 //、#、/* */ 等）。
3. 用 markdown 代码块包裹代码，例如：
\`\`\`python
import sys
import math

def solve():
    n = int(sys.stdin.readline())
    print(n)

if __name__ == '__main__':
    solve()
\`\`\`
4. 代码必须有正确的换行和缩进。每条语句独占一行，严禁把多行代码合并到一行。
5. 追求运行时间最快，可用快速读入。`;
}

export function buildUserPrompt(problemText: string): string {
  return `请阅读下面这道算法题目，输出纯代码答案。

题目内容：
"""
${problemText}
"""`;
}
