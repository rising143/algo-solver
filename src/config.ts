import * as vscode from 'vscode';
import { SolverConfig } from './types';

export function getConfig(): SolverConfig {
  const cfg = vscode.workspace.getConfiguration('algoSolver');
  return {
    apiBaseUrl: cfg.get<string>('apiBaseUrl', 'https://api.deepseek.com/v1'),
    apiKey: cfg.get<string>('apiKey', ''),
    model: cfg.get<string>('model', 'deepseek-chat'),
    language: cfg.get<string>('language', 'cpp'),
    charDelayMs: cfg.get<number>('charDelayMs', 15),
    stepDelayMs: cfg.get<number>('stepDelayMs', 120),
    requestTimeoutMs: cfg.get<number>('requestTimeoutMs', 180000),
    temperature: cfg.get<number>('temperature', 0.2),
  };
}
