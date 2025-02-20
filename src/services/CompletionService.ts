import * as vscode from 'vscode';
import { PredictionService } from './PredictionService';

export class CompletionService {
  private debounceTimer: NodeJS.Timeout | undefined;
  private completionTimer: NodeJS.Timeout | undefined;
  private completionDisabled = false;

  constructor(
    private readonly predictionService: PredictionService,
    private readonly debounceDelay = 200,
    private readonly completionDelay = 1000
  ) {}

  public registerProviders(context: vscode.ExtensionContext): void {
    // 注册内联补全提供者
    const inlineProvider = this.createInlineCompletionProvider();
    // 注册文本变化监听
    const textChangeListener = this.createTextChangeListener();
    // 注册 Tab 键处理
    const tabHandler = this.createTabHandler();

    context.subscriptions.push(
      inlineProvider,
      textChangeListener,
      tabHandler
    );
  }

  private createInlineCompletionProvider(): vscode.Disposable {
    return vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      {
        provideInlineCompletionItems: async (
          document: vscode.TextDocument,
          position: vscode.Position,
          context: vscode.InlineCompletionContext,
          token: vscode.CancellationToken
        ): Promise<vscode.InlineCompletionList> => {
          try {
            if (!this.shouldTriggerCompletion(document, position)) {
              return { items: [] };
            }

            const predictions = await this.predictionService.predictCompletions(document, position);
            const items = this.createCompletionItems(document, position, predictions);

            return { items };
          } catch (error) {
            console.error('内联补全错误:', error);
            return { items: [] };
          }
        }
      }
    );
  }

  private createTextChangeListener(): vscode.Disposable {
    return vscode.workspace.onDidChangeTextDocument(() => {
      if (this.completionDisabled) {
        return;
      }

      this.debounce(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
        }
      }, this.debounceDelay);
    });
  }

  private createTabHandler(): vscode.Disposable {
    return vscode.commands.registerTextEditorCommand('codemind.handleTab', 
      async (editor: vscode.TextEditor) => {
        try {
          const accepted = await vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
          if (accepted) {
            this.disableCompletionTemporarily();
          } else {
            await vscode.commands.executeCommand('tab');
          }
        } catch (error) {
          await vscode.commands.executeCommand('tab');
        }
      }
    );
  }

  private createCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    predictions: string[]
  ): vscode.InlineCompletionItem[] {
    return predictions.map(text => {
      const lineLength = document.lineAt(position.line).text.length;
      const range = new vscode.Range(
        position,
        new vscode.Position(position.line, lineLength)
      );

      const item = new vscode.InlineCompletionItem(text);
      item.range = range;
      return item;
    });
  }

  private debounce(fn: () => void, delay: number): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(fn, delay);
  }

  private disableCompletionTemporarily(): void {
    this.completionDisabled = true;
    
    if (this.completionTimer) {
      clearTimeout(this.completionTimer);
    }
    
    this.completionTimer = setTimeout(() => {
      this.completionDisabled = false;
    }, this.completionDelay);
  }

  private shouldTriggerCompletion(document: vscode.TextDocument, position: vscode.Position): boolean {
    const line = document.lineAt(position.line).text;
    const linePrefix = line.substring(0, position.character);

    return !this.isInComment(document, position) && 
           !this.isInString(linePrefix) && 
           linePrefix.trim().length > 0;
  }

  private isInComment(document: vscode.TextDocument, position: vscode.Position): boolean {
    const text = document.getText();
    const offset = document.offsetAt(position);
    
    // 检查单行注释
    const lineText = document.lineAt(position.line).text;
    if (lineText.trim().startsWith('//')) {
      return true;
    }

    // 检查多行注释
    const beforeText = text.substring(0, offset);
    const lastCommentStart = beforeText.lastIndexOf('/*');
    const lastCommentEnd = beforeText.lastIndexOf('*/');
    
    return lastCommentStart > lastCommentEnd;
  }

  private isInString(linePrefix: string): boolean {
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
} 
