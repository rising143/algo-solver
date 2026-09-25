# Algo Solver

VS Code 插件：快捷键触发，调用云端大模型读取当前文件中的算法题，输出运行时间最快的纯代码答案，并按**人类书写顺序**（先骨架后回填）像真人输入一样插入到光标处。

## 功能

- `Ctrl+Alt+S`（Mac `Cmd+Alt+S`）触发解题
- 读取当前文件作为算法题目
- 调用 OpenAI 兼容云端 API（默认 DeepSeek）获取答案
- 模型返回结构化"打字脚本"：先写外层骨架（如 `int main(){}`），再把光标跳回括号内填充内容（如 `print('hello')`）
- 逐字插入带节奏，模拟真人敲键
- `Esc` 中断当前输入
- 解题语言、模型、节奏等均可配置

## 配置

在 VS Code 设置中搜索 `algoSolver`：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `algoSolver.apiBaseUrl` | `https://api.deepseek.com/v1` | OpenAI 兼容接口地址 |
| `algoSolver.apiKey` | `""` | API Key（必填） |
| `algoSolver.model` | `deepseek-chat` | 模型名 |
| `algoSolver.language` | `python` | 解题语言 |
| `algoSolver.charDelayMs` | `15` | 每字符插入间隔 |
| `algoSolver.stepDelayMs` | `120` | 步间停顿 |
| `algoSolver.requestTimeoutMs` | `180000` | 请求超时 |
| `algoSolver.temperature` | `0.2` | 采样温度 |

## 使用

1. 安装插件
2. 配置 `algoSolver.apiKey`
3. 打开一个文件，粘贴一道算法题目
4. 把光标放在想插入答案的位置
5. 按 `Ctrl+Alt+S`，观察代码按人类书写顺序逐字出现

## 打包

```bash
npm install
npm run compile
npm run package
```

生成 `algo-solver-0.0.1.vsix`，在 VS Code 中"从 VSIX 安装"即可。
