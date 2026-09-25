import * as vscode from 'vscode';
import { getConfig } from './config';
import { chat } from './modelClient';
import { parseScript } from './scriptParser';
import { replayScript, rawFallback } from './replayer';

let outputChannel: vscode.OutputChannel;
let statusItem: vscode.StatusBarItem;
let cancelCurrent: (() => void) | null = null;
let isRunning = false;
let progressTimer: NodeJS.Timeout | null = null;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Algo Solver');
  context.subscriptions.push(outputChannel);

  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.text = '$(code) Algo Solver';
  statusItem.tooltip = '点击触发解题（Ctrl+Alt+S）';
  statusItem.command = 'algoSolver.solve';
  context.subscriptions.push(statusItem);
  statusItem.show();

  const solveCmd = vscode.commands.registerCommand('algoSolver.solve', async () => {
    await solve();
  });
  const cancelCmd = vscode.commands.registerCommand('algoSolver.cancel', () => {
    if (cancelCurrent) {
      cancelCurrent();
      log('用户中断当前任务。');
    }
  });
  context.subscriptions.push(solveCmd, cancelCmd);
}

async function solve() {
  if (isRunning) {
    vscode.window.showWarningMessage('Algo Solver 正在运行，已先中断当前任务。');
    cancelCurrent?.();
    await new Promise((r) => setTimeout(r, 100));
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('请先打开包含算法题目的文件。');
    return;
  }
  const problemText = editor.document.getText().trim();
  if (!problemText) {
    vscode.window.showWarningMessage('当前文件为空，请先粘贴算法题目。');
    return;
  }

  const config = getConfig();
  if (!config.apiKey) {
    const choice = await vscode.window.showErrorMessage(
      '请先配置 API Key（algoSolver.apiKey）。',
      '打开设置'
    );
    if (choice === '打开设置') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'algoSolver.apiKey');
    }
    return;
  }

  const startPos = editor.selection.isEmpty
    ? editor.selection.active
    : editor.selection.start;

  isRunning = true;
  vscode.commands.executeCommand('setContext', 'algoSolver.isRunning', true);
  statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  log(`开始解题，语言=${config.language}，模型=${config.model}，接口=${config.apiBaseUrl}`);

  // 进度计时显示
  const requestStart = Date.now();
  startProgress('请求中');

  let fullText = '';
  let requestErr: Error | null = null;

  await new Promise<void>((resolve) => {
    const localCancel = chat(
      config,
      problemText,
      {
        onDone: (text) => {
          fullText = text;
          resolve();
        },
        onError: (err) => {
          requestErr = err;
          resolve();
        },
      }
    );
    cancelCurrent = localCancel;
  });

  stopProgress();

  if (requestErr !== null) {
    const err: Error = requestErr as Error;
    const elapsed = ((Date.now() - requestStart) / 1000).toFixed(1);
    log(`请求失败（${elapsed}s）：${err.message}`);
    vscode.window.showErrorMessage(`Algo Solver 请求失败（${elapsed}s）：${err.message}`);
    resetRunning();
    return;
  }

  const elapsed = ((Date.now() - requestStart) / 1000).toFixed(1);
  log(`模型返回 ${fullText.length} 字符（${elapsed}s），开始解析与回放。`);
  statusItem.text = '$(loading~spin) Algo Solver 输入中…';

  const script = parseScript(fullText);
  let cancelled = false;
  const isCancelled = () => cancelled;

  cancelCurrent = () => {
    cancelled = true;
  };

  try {
    if (script) {
      log(`解析成功：finalCode ${script.finalCode.length} 字符`);
      const result = await replayScript(editor, startPos, script, config, isCancelled, log);
      if (result.interrupted) {
        log('回放被中断。');
        const choice = await vscode.window.showInformationMessage(
          'Algo Solver 已中断。是否用最终代码补全剩余部分？',
          '补全',
          '保留已输入'
        );
        if (choice === '补全' && script.finalCode) {
          const doc = editor.document;
          const endPos = new vscode.Position(doc.lineCount, 0);
          await editor.edit((eb) => eb.replace(new vscode.Range(startPos, endPos), script.finalCode));
          log('已用 finalCode 补全。');
        }
      } else if (result.completed) {
        log(result.fallbackUsed ? '完成（含回退）。' : '完成。');
      }
    } else {
      log('脚本解析失败，使用原始代码兜底。');
      await rawFallback(editor, startPos, fullText, config, isCancelled, log);
    }
  } catch (e: any) {
    log(`回放异常：${e?.message ?? e}`);
    vscode.window.showErrorMessage(`Algo Solver 回放异常：${e?.message ?? e}`);
  }

  resetRunning();
}

function startProgress(label: string) {
  const start = Date.now();
  stopProgress();
  progressTimer = setInterval(() => {
    const sec = Math.floor((Date.now() - start) / 1000);
    statusItem.text = `$(loading~spin) Algo Solver ${label}… ${sec}s`;
  }, 500);
  statusItem.text = `$(loading~spin) Algo Solver ${label}… 0s`;
}

function stopProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function resetRunning() {
  stopProgress();
  isRunning = false;
  cancelCurrent = null;
  vscode.commands.executeCommand('setContext', 'algoSolver.isRunning', false);
  statusItem.text = '$(code) Algo Solver';
  statusItem.backgroundColor = undefined;
}

function log(msg: string) {
  const ts = new Date().toLocaleTimeString();
  outputChannel.appendLine(`[${ts}] ${msg}`);
}

export function deactivate() {
  cancelCurrent?.();
  stopProgress();
}
