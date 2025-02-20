// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Configuration } from './config/Configuration';
import { PredictionService } from './services/PredictionService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('CodeMind AI 扩展已激活');

	const config = Configuration.getAIConfig();
	const predictionService = new PredictionService(config.apiKey);
	
	let debounceTimer: NodeJS.Timeout;
	let lastPrediction: vscode.InlineCompletionItem[] = [];
	let completionDisabled = false;
	let completionTimer: NodeJS.Timeout;

	// 注册内联补全提供者
	const inlineProvider = vscode.languages.registerInlineCompletionItemProvider(
		{ pattern: '**' },
		{
			async provideInlineCompletionItems(
				document: vscode.TextDocument,
				position: vscode.Position,
				context: vscode.InlineCompletionContext,
				token: vscode.CancellationToken
			): Promise<vscode.InlineCompletionList> {
				try {
					// 检查是否应该触发补全
					if (!shouldTriggerCompletion(document, position)) {
						return { items: [] };
					}

					const predictions = await predictionService.predictCompletions(document, position);
					console.log("🚀 ~ predictions:", predictions);
					
					// 创建内联补全项
					const items = predictions.map(text => {
						// 计算从当前位置到行尾的范围
						const lineLength = document.lineAt(position.line).text.length;
						const range = new vscode.Range(
							position,
							new vscode.Position(position.line, lineLength)
						);

						const item = new vscode.InlineCompletionItem(text);
						item.range = range; // 设置补全范围到行尾
						return item;
					});

					return { items };
				} catch (error) {
					console.error('内联补全错误:', error);
					return { items: [] };
				}
			}
		}
	);

	// 监听文本变化事件
	const textChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
		if (completionDisabled) {
			return;
		}

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
			}
		}, 200);
	});

	// 注册 Tab 键命令
	const tabCommand = vscode.commands.registerCommand('codemind.acceptPrediction', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor && lastPrediction.length > 0) {
			await editor.edit(editBuilder => {
				const text = lastPrediction[0].insertText.toString();
				editBuilder.insert(editor.selection.active, text);
			});
		}
	});

	// 添加 Tab 键绑定
	const keybinding = vscode.commands.registerTextEditorCommand('codemind.handleTab', async (editor) => {
		try {
			const accepted = await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
			if (accepted) {
				// 补全被接受后，暂时禁用补全
				completionDisabled = true;
				
				// 清除之前的定时器
				if (completionTimer) {
					clearTimeout(completionTimer);
				}
				
				// 1秒后重新启用补全
				completionTimer = setTimeout(() => {
					completionDisabled = false;
				}, 1000);
			} else {
				await vscode.commands.executeCommand('tab');
			}
		} catch (error) {
			await vscode.commands.executeCommand('tab');
		}
	});

	context.subscriptions.push(
		inlineProvider,
		textChangeListener,
		tabCommand,
		keybinding
	);
}

function shouldTriggerCompletion(document: vscode.TextDocument, position: vscode.Position): boolean {
	const line = document.lineAt(position.line).text;
	const linePrefix = line.substring(0, position.character);

	// 避免在注释和字符串中触发
	if (isInComment(document, position) || isInString(linePrefix)) {
		return false;
	}

	// 检查是否在输入过程中
	if (linePrefix.trim().length === 0) {
		return false;
	}

	return true;
}

function isInComment(document: vscode.TextDocument, position: vscode.Position): boolean {
	const text = document.getText();
	const offset = document.offsetAt(position);
	
	// 简单的注释检测
	const lineText = document.lineAt(position.line).text;
	if (lineText.trim().startsWith('//')) {
		return true;
	}

	// 多行注释检测
	const beforeText = text.substring(0, offset);
	const lastCommentStart = beforeText.lastIndexOf('/*');
	const lastCommentEnd = beforeText.lastIndexOf('*/');
	
	return lastCommentStart > lastCommentEnd;
}

function isInString(linePrefix: string): boolean {
	let inString = false;
	let quote: string | null = null;
	
	for (const char of linePrefix) {
		if ((char === '"' || char === "'") && (!quote || char === quote)) {
			inString = !inString;
			quote = inString ? char : null;
		}
	}
	
	return inString;
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('CodeMind AI 扩展已停用');
}
