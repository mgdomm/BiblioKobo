/**
 * ollamaService.js - Integración con Ollama para modelos locales
 * Permite usar Ollama en lugar de APIs externas
 */

const axios = require('axios');

class OllamaService {
  constructor() {
    this.baseURL = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'mistral:latest';
    this.timeout = 60000; // 60 segundos para evitar timeouts en VRAM baja
  }

  /**
   * Verifica si Ollama está disponible
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.warn('⚠ Ollama no disponible:', error.message);
      return false;
    }
  }

  /**
   * Obtiene lista de modelos disponibles
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      console.error('Error obteniendo modelos:', error.message);
      return [];
    }
  }

  /**
   * Genera una respuesta usando Ollama
   * @param {string} prompt - Texto de entrada
   * @param {object} options - Opciones adicionales
   */
  async generate(prompt, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: options.model || this.model,
          prompt: prompt,
          stream: false,
          temperature: options.temperature || 0.3, // Reducido para menos memoria
          top_p: options.top_p || 0.9,
          top_k: options.top_k || 20, // Reducido
          num_predict: options.num_predict || 200, // Limitado para bajo vram
          num_ctx: 2048 // Contexto menor para bajo vram
        },
        { timeout: this.timeout }
      );

      return {
        success: true,
        response: response.data.response,
        model: response.data.model,
        created_at: response.data.created_at
      };
    } catch (error) {
      console.error('Error generando respuesta con Ollama:', error.message);
      return {
        success: false,
        error: error.message,
        response: null
      };
    }
  }

  /**
   * Chat conversacional con contexto
   * @param {array} messages - Array de mensajes con estructura {role, content}
   * @param {object} options - Opciones adicionales
   */
  async chat(messages, options = {}) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        {
          model: options.model || this.model,
          messages: messages,
          stream: false,
          temperature: options.temperature || 0.7
        },
        { timeout: this.timeout }
      );

      return {
        success: true,
        response: response.data.message.content,
        model: response.data.model
      };
    } catch (error) {
      console.error('Error en chat con Ollama:', error.message);
      return {
        success: false,
        error: error.message,
        response: null
      };
    }
  }

  /**
   * Genera embeddings (vectores) para búsqueda semántica
   * @param {string} text - Texto a vectorizar
   * @param {string} model - Modelo a usar (ej: 'nomic-embed-text')
   */
  async embed(text, model = 'nomic-embed-text') {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/embed`,
        {
          model: model,
          input: text
        },
        { timeout: this.timeout }
      );

      return {
        success: true,
        embedding: response.data.embedding,
        model: response.data.model
      };
    } catch (error) {
      console.error('Error generando embedding:', error.message);
      return {
        success: false,
        error: error.message,
        embedding: null
      };
    }
  }

  /**
   * Descarga/carga un modelo
   * @param {string} modelName - Nombre del modelo
   */
  async pullModel(modelName) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/pull`,
        { name: modelName },
        { timeout: 600000 } // 10 minutos
      );

      return {
        success: true,
        message: `Modelo ${modelName} cargado`
      };
    } catch (error) {
      console.error('Error cargando modelo:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Responde preguntas basadas en contexto (RAG)
   * @param {string} question - Pregunta del usuario
   * @param {string} context - Contexto/documento relevante
   */
  async answerWithContext(question, context) {
    const prompt = `Contexto:
${context}

Pregunta: ${question}

Responde basándote SOLO en el contexto proporcionado. Si la respuesta no está en el contexto, di que no tienes esa información.`;

    return this.generate(prompt, {
      temperature: 0.5,
      num_predict: 500
    });
  }
}

module.exports = new OllamaService();
