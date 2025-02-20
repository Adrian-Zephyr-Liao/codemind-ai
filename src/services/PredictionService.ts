import * as vscode from 'vscode';
import OpenAI, { APIError, PermissionDeniedError, RateLimitError } from 'openai';

export class PredictionService {
  private openai: OpenAI;
  private readonly MAX_CONTEXT_LINES = 50;
  
  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.siliconflow.cn/v1'
    });
  }

  async predictCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string[]> {
    try {
      const context = await this.getEnhancedContext(document, position);
      
      const response = await this.openai.chat.completions.create({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          {
            role: 'system',
            content: '你是一个智能代码补全助手。请根据上下文预测并补全当前行的剩余部分。只返回补全的代码，不要包含任何解释。'
          },
          {
            role: 'user',
            content: `请补全这行代码：\n\n${context.code}\n当前行: ${context.currentLine}\n文件类型: ${context.fileType}`
          }
        ],
        temperature: 0.2,
        max_tokens: 100,
        n: 1
      });

      const completion = response.choices[0].message.content?.trim() || '';
      return completion ? [completion] : [];
    } catch (error) {
      console.error('预测失败:', error);
      if (error instanceof RateLimitError) {
        vscode.window.showInformationMessage('API 请求达到限制，请稍后再试。');
      } else if (error instanceof PermissionDeniedError) {
        vscode.window.showInformationMessage('API 请求被拒绝，请检查 API Key 是否正确。');
      } else if (error instanceof APIError) {
        vscode.window.showInformationMessage('预测失败，请稍后再试。');
      }
      return [];
    }
  }

  private async getEnhancedContext(document: vscode.TextDocument, position: vscode.Position) {
    const fileType = document.languageId;
    const currentLine = document.lineAt(position.line).text;
    const indentation = currentLine.match(/^\s*/)?.[0] || '';
    
    // 获取前后文上下文
    const startLine = Math.max(0, position.line - this.MAX_CONTEXT_LINES);
    const endLine = Math.min(document.lineCount - 1, position.line);
    
    let contextCode = '';
    for (let i = startLine; i <= endLine; i++) {
      contextCode += document.lineAt(i).text + '\n';
    }

    // 获取导入语句
    const imports = await this.getImportStatements(document);

    return {
      code: imports + '\n' + contextCode,
      fileType,
      indentation,
      currentLine
    };
  }

  private async getImportStatements(document: vscode.TextDocument): Promise<string> {
    const text = document.getText();
    const importRegex = /^import.*?;?$/gm;
    const imports = text.match(importRegex) || [];
    return imports.join('\n');
  }
} 
