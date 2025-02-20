import * as vscode from 'vscode';

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class Configuration {
  private static readonly CONFIG_SECTION = 'codemindAI';

  static getAIConfig(): AIConfig {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    return {
      apiKey: config.get('apiKey', ''),
      baseUrl: config.get('baseUrl', 'https://api.siliconflow.cn'),
      model: config.get('model', 'deepseek-ai/DeepSeek-V2-Chat')
    };
  }
} 
