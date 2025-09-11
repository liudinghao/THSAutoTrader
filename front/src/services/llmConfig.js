/**
 * LLM配置文件
 * 只包含配置常量，不包含业务逻辑
 */

// API提供商配置
export const API_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Provider': 'deepseek',
    },
    defaultModel: 'deepseek-chat',
    supportsTools: false,
    apiKey: 'sk-c7c0c5a0480c462ebcf13be3f999f406'
  },
  kimi: {
    name: 'Moonshot (Kimi)',
    baseUrl: '//api.moonshot.cn/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Provider': 'moonshot',
    },
    defaultModel: 'moonshot-v1-8k',
    supportsTools: true,
    apiKey: '' // 需要配置Kimi的API密钥
  }
}

// 默认配置
export const DEFAULT_CONFIG = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 2000,
  timeout: 30000
}

// 请求配置
export const REQUEST_CONFIG = {
  timeout: 30000,
  retries: 1
}

// Kimi工具配置
export const KIMI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  },
]