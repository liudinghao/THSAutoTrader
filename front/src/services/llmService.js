/**
 * LLM服务层
 * 处理具体的API调用和业务逻辑
 */

import { API_PROVIDERS, DEFAULT_CONFIG, REQUEST_CONFIG, KIMI_TOOLS } from './llmConfig.js'

/**
 * LLM服务类
 */
class LLMService {
  /**
   * 发送消息到LLM
   * @param {Array} messages 消息数组
   * @param {Object} config 配置选项
   * @returns {Promise<Object>} API响应
   */
  async sendMessage(messages, config = {}) {
    // 合并配置
    const finalConfig = { ...DEFAULT_CONFIG, ...config }
    const providerConfig = API_PROVIDERS[finalConfig.provider]
    
    if (!providerConfig) {
      throw new Error(`不支持的提供商: ${finalConfig.provider}`)
    }

    // 验证API密钥
    if (!providerConfig.apiKey || !providerConfig.apiKey.trim()) {
      throw new Error(`${providerConfig.name} 的API密钥未配置`)
    }

    // 构建请求体
    const requestBody = this._buildRequestBody(messages, finalConfig, providerConfig)

    // 发送请求
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout)

      const response = await fetch(providerConfig.baseUrl, {
        method: 'POST',
        headers: {
          ...providerConfig.headers,
          'Authorization': `Bearer ${providerConfig.apiKey.trim()}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return this._processResponse(data, requestBody, finalConfig)

    } catch (error) {
      return this._handleError(error, providerConfig.name)
    }
  }

  /**
   * 构建请求体
   * @private
   */
  _buildRequestBody(messages, config, providerConfig) {
    let requestBody = {
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens
    }

    // Kimi支持工具调用
    if (config.provider === 'kimi' && providerConfig.supportsTools) {
      requestBody.tools = KIMI_TOOLS
      requestBody.tool_choice = 'auto'
    }

    return requestBody
  }

  /**
   * 处理API响应
   * @private
   */
  _processResponse(data, requestBody, config) {
    if (data.error) {
      if (data.error.code === 'invalid_api_key' || data.error.type === 'invalid_api_key') {
        throw new Error('API密钥无效，请检查配置')
      }
      throw new Error(data.error.message || '请求失败')
    }

    if (!data.choices || !data.choices[0]) {
      throw new Error('响应格式异常')
    }

    // 为了兼容原有代码，返回消息对象格式
    const result = data.choices[0].message
    result.usage = data.usage
    result.model = requestBody.model  
    result.provider = config.provider
    return result
  }

  /**
   * 错误处理
   * @private
   */
  _handleError(error, providerName) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试')
    }
    
    if (error.message.includes('API密钥')) {
      throw error
    }
    
    if (error.message.includes('HTTP')) {
      throw new Error(`${providerName} 服务异常: ${error.message}`)
    }
    
    throw new Error(`网络错误: ${error.message}`)
  }

  /**
   * 验证API密钥
   * @param {string} apiKey API密钥
   * @param {string} provider 提供商
   * @returns {Promise<boolean>} 验证结果
   */
  async validateApiKey(apiKey, provider = DEFAULT_CONFIG.provider) {
    const providerConfig = API_PROVIDERS[provider]
    
    if (!providerConfig) {
      throw new Error(`不支持的提供商: ${provider}`)
    }
    
    if (!apiKey || !apiKey.trim()) {
      throw new Error('请输入API密钥')
    }

    try {
      const response = await fetch(providerConfig.baseUrl, {
        method: 'POST',
        headers: {
          ...providerConfig.headers,
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: provider === 'kimi' ? 'moonshot-v1-8k' : providerConfig.defaultModel,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
      })

      const data = await response.json()

      if (data.error) {
        if (data.error.code === 'invalid_api_key' || data.error.type === 'invalid_api_key') {
          throw new Error('API密钥无效，请检查后重试')
        }
        throw new Error(data.error.message || '验证失败')
      }

      return true
    } catch (error) {
      if (error.message.includes('API密钥')) {
        throw error
      }
      throw new Error('网络错误或服务不可用，请稍后重试')
    }
  }
}

// 创建单例实例
export const llmService = new LLMService()

// 导出便捷函数
export const sendLLMMessage = (messages, config) => llmService.sendMessage(messages, config)
export const validateLLMApiKey = (apiKey, provider) => llmService.validateApiKey(apiKey, provider)

// 兼容性导出
export const sendMessage = sendLLMMessage
export const validateApiKey = validateLLMApiKey