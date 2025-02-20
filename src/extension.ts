// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Configuration } from './config/Configuration';
import { PredictionService } from './services/PredictionService';
import { CompletionService } from './services/CompletionService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('CodeMind AI 扩展已激活');

	const config = Configuration.getAIConfig();
	const predictionService = new PredictionService(config.apiKey);
	const completionService = new CompletionService(predictionService);

	// 注册所有提供者和处理器
	completionService.registerProviders(context);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('CodeMind AI 扩展已停用');
}
