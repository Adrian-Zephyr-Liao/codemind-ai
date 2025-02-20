import * as vscode from 'vscode';
import { PredictionService } from '../services/PredictionService';

export class MultiCursorCompletionProvider implements vscode.CompletionItemProvider {
  private lastPosition: vscode.Position | null = null;
  private lastTriggerTime: number = 0;
  private readonly TRIGGER_DELAY = 500; // 触发延迟(ms)

  constructor(private predictionService: PredictionService) {
    // 监听光标移动事件
    vscode.window.onDidChangeTextEditorSelection(this.handleSelectionChange.bind(this));
  }

  private async handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent) {
    const position = event.selections[0].active;
    if (this.shouldTriggerPrediction(position)) {
      // 触发预测
      this.triggerPrediction(event.textEditor.document, position);
    }
  }

  private shouldTriggerPrediction(position: vscode.Position): boolean {
    if (!this.lastPosition) {
      this.lastPosition = position;
      return true;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - this.lastTriggerTime;

    // 检查是否是新的一行
    const isNewLine = position.line !== this.lastPosition.line;
    
    this.lastPosition = position;
    this.lastTriggerTime = now;

    return isNewLine && timeSinceLastTrigger > this.TRIGGER_DELAY;
  }

  private async triggerPrediction(document: vscode.TextDocument, position: vscode.Position) {
    // 显示建议
    vscode.commands.executeCommand('editor.action.triggerSuggest');
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    try {
      const predictions = await this.predictionService.predictCompletions(document, position);
      
      // 将预测结果转换为 CompletionItem
      return predictions.map(prediction => {
        const item = new vscode.CompletionItem(prediction, vscode.CompletionItemKind.Text);
        item.insertText = prediction;
        // 设置 Tab 键作为接受建议的快捷键
        item.command = {
          command: 'acceptSelectedSuggestion',
          title: 'Accept Suggestion'
        };
        return item;
      });
    } catch (error) {
      console.error('预测失败:', error);
      return [];
    }
  }
} 
