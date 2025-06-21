// DeepSeek API配置
const API_CONFIG = {
  baseUrl: 'https://api.deepseek.com/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Provider': 'deepseek',
  },
};

/**
 * 从本地存储获取配置
 * @param {string} apiKey - API密钥
 * @param {string} model - 模型名称
 * @returns {Object} 配置对象
 */
function getConfig(apiKey, model) {
  const savedModel =
    model || localStorage.getItem('selected_model') || 'deepseek-chat';
  const key = `api_key_${savedModel}`;
  const savedApiKey = apiKey || localStorage.getItem(key) || '';

  return {
    apiKey: savedApiKey,
    model: savedModel,
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

  if (!config.apiKey) {
    throw new Error('请输入API密钥');
  }

  try {
    const response = await fetch(API_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        ...API_CONFIG.headers,
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });

    const data = await response.json();

    if (data.error) {
      if (data.error.code === 'invalid_api_key') {
        throw new Error('API密钥无效，请检查后重试');
      }
      throw new Error(data.error.message);
    }
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * 发送消息到DeepSeek
 * @param {string} apiKey - API密钥
 * @param {string} model - 模型名称
 * @param {Array} messages - 消息历史
 * @param {number} temperature - 温度参数
 * @returns {Promise<Object>} 响应结果
 */
export async function sendMessage(apiKey, model, messages, temperature) {
  const config = getConfig(apiKey, model);

  if (!config.apiKey) {
    throw new Error('请输入API密钥');
  }

  try {
    const response = await fetch(API_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        ...API_CONFIG.headers,
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (!data.choices || !data.choices[0]) {
      throw new Error('请求失败');
    }

    return data.choices[0].message;
  } catch (error) {
    throw error;
  }
}
