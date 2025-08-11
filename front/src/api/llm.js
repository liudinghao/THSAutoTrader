// API配置
const API_CONFIG = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Provider': 'deepseek',
    },
  },
  kimi: {
    baseUrl: '//api.moonshot.cn/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Provider': 'moonshot',
    },
  },
};

/**
 * 从本地存储获取配置
 * @param {string} apiKey - API密钥
 * @param {string} model - 模型名称
 * @returns {Object} 配置对象
 */
function getConfig(apiKey, model) {
  const savedModel = model || localStorage.getItem('selected_model') || 'kimi';
  const key = `api_key_${savedModel}`;
  const savedApiKey = apiKey || localStorage.getItem(key) || '';

  // 根据模型返回对应的API配置
  let provider = 'deepseek';
  if (savedModel === 'kimi') {
    provider = 'kimi';
  }

  return {
    apiKey: savedApiKey,
    model: savedModel,
    provider: provider,
    baseUrl: API_CONFIG[provider].baseUrl,
    headers: API_CONFIG[provider].headers,
  };
}

/**
 * 验证API密钥
 * @param {string} apiKey - API密钥
 * @param {string} model - 模型名称
 * @returns {Promise<boolean>} 验证结果
 */
export async function validateApiKey(apiKey, model) {
  const config = getConfig(apiKey, model);
  console.log('config', config);
  const { apiKey: actualApiKey, baseUrl, headers } = config;

  if (!actualApiKey) {
    throw new Error('Please enter API key');
  }

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${actualApiKey}`,
      },
      body: JSON.stringify({
        model: config.model === 'kimi' ? 'moonshot-v1-8k' : config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    const data = await response.json();

    if (data.error) {
      if (data.error.code === 'invalid_api_key') {
        throw new Error('Invalid API key, please check and try again');
      }
      throw new Error(data.error.message);
    }
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * 发送消息到AI模型
 * @param {string} apiKey - API密钥
 * @param {string} model - 模型名称
 * @param {Array} messages - 消息历史
 * @param {number} temperature - 温度参数
 * @returns {Promise<Object>} 响应结果
 */
export async function sendMessage(apiKey, model, messages, temperature) {
  const config = getConfig(apiKey, model);
  const actualApiKey = config.apiKey;
  const baseUrl = config.baseUrl;
  const headers = config.headers;

  if (!actualApiKey) {
    throw new Error('Please enter API key');
  }

  try {
    let requestBody = {};

    if (config.provider === 'kimi') {
      // Kimi 模型配置，支持联网搜索
      requestBody = {
        model: 'moonshot-v1-8k',
        messages,
        temperature,
        tools: [
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
        ],
        tool_choice: 'auto',
      };
    } else {
      // DeepSeek 模型配置
      requestBody = {
        model: config.model,
        messages,
        temperature,
      };
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${actualApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (!data.choices || !data.choices[0]) {
      throw new Error('Request failed');
    }

    return data.choices[0].message;
  } catch (error) {
    throw error;
  }
}
