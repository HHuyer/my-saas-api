/**
 * AI Service
 * Provider-agnostic completion driver (OpenAI / Anthropic / Gemini).
 * Falls back to deterministic mock when the configured provider key is missing,
 * so workflows can run end-to-end (and be tested) without real API keys.
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

const DEFAULT_MODEL = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  gemini: 'gemini-1.5-flash'
};

class AIService {
  /**
   * Get the active provider from env (defaults to openai)
   */
  getProvider() {
    return (process.env.AI_PROVIDER || 'openai').toLowerCase();
  }

  /**
   * Check whether a real API key is available for the given provider
   */
  hasApiKey(provider) {
    const key = process.env[`${provider.toUpperCase()}_API_KEY`];
    return Boolean(key && key.trim() !== '');
  }

  /**
   * Generate a completion
   * @param {object} options - { prompt, model, temperature, maxTokens, provider }
   * @returns {Promise<{ text, provider, model }>}
   */
  async complete(options = {}) {
    const provider = (options.provider || this.getProvider()).toLowerCase();

    if (!this.hasApiKey(provider)) {
      return this.mockCompletion(options);
    }

    try {
      switch (provider) {
        case 'openai':
          return await this.completeOpenAI(options);
        case 'anthropic':
          return await this.completeAnthropic(options);
        case 'gemini':
          return await this.completeGemini(options);
        default:
          logger.warn(`Unknown AI provider: ${provider}, falling back to mock`);
          return this.mockCompletion(options);
      }
    } catch (error) {
      logger.error(`AI completion failed (${provider}):`, error.message);
      // Degrade gracefully: don't fail the whole workflow run on AI errors
      return this.mockCompletion(options);
    }
  }

  async completeOpenAI({ prompt, model, temperature }) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model || DEFAULT_MODEL.openai,
        temperature: temperature ?? 0.7,
        messages: [
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 30000
      }
    );

    return {
      text: response.data.choices?.[0]?.message?.content || '',
      provider: 'openai',
      model: model || DEFAULT_MODEL.openai
    };
  }

  async completeAnthropic({ prompt, model, temperature }) {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: model || DEFAULT_MODEL.anthropic,
        max_tokens: 1024,
        temperature: temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000
      }
    );

    return {
      text: response.data.content?.[0]?.text || '',
      provider: 'anthropic',
      model: model || DEFAULT_MODEL.anthropic
    };
  }

  async completeGemini({ prompt, model }) {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || DEFAULT_MODEL.gemini}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {},
        params: { key: process.env.GEMINI_API_KEY },
        timeout: 30000
      }
    );

    return {
      text: response.data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      provider: 'gemini',
      model: model || DEFAULT_MODEL.gemini
    };
  }

  /**
   * Deterministic mock so the pipeline works (and tests pass) without API keys
   */
  async mockCompletion({ prompt, model }) {
    const summary = String(prompt || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);

    return {
      text: `[mock] Processed: ${summary || 'empty prompt'}`,
      provider: 'mock',
      model: model || DEFAULT_MODEL[this.getProvider()] || DEFAULT_MODEL.openai
    };
  }
}

module.exports = new AIService();
