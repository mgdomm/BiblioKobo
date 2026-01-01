/**
 * Embedding Service para RAG local
 * Usa TensorFlow.js para embeddings en CPU ARM
 */

const tf = require('@tensorflow/tfjs-node');
const axios = require('axios');

// Cache de modelo
let model = null;
let tokenizer = null;

/**
 * Inicializa el modelo de embeddings (Universal Sentence Encoder ligero)
 */
async function initializeModel() {
  if (model) return;
  
  console.log('🔮 Cargando modelo de embeddings para ARM...');
  
  try {
    // Usar modelo ligero compatible con CPU ARM
    const use = require('@tensorflow-models/universal-sentence-encoder');
    model = await use.load();
    console.log('✅ Modelo de embeddings cargado');
  } catch (error) {
    console.warn('⚠️  No se pudo cargar modelo TF, usando embeddings simples');
    model = 'simple'; // Fallback a embeddings simples
  }
}

/**
 * Genera embedding para un texto
 * @param {string} text - Texto a embeber
 * @returns {Promise<number[]>} Vector de embedding
 */
async function embed(text) {
  await initializeModel();
  
  if (model === 'simple') {
    // Fallback: embedding simple basado en frecuencia de palabras
    return simpleEmbed(text);
  }
  
  try {
    const embeddings = await model.embed([text]);
    const values = await embeddings.array();
    embeddings.dispose();
    return values[0];
  } catch (error) {
    console.error('Error generando embedding:', error);
    return simpleEmbed(text);
  }
}

/**
 * Embedding simple basado en TF-IDF simulado
 * @param {string} text 
 * @returns {number[]} Vector de 512 dimensiones
 */
function simpleEmbed(text) {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  const vector = new Array(512).fill(0);
  
  words.forEach((word, idx) => {
    const hash = hashString(word);
    for (let i = 0; i < 8; i++) {
      const pos = (hash + i * 64) % 512;
      vector[pos] += 1 / (idx + 1); // Peso por posición
    }
  });
  
  // Normalizar
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / (norm || 1));
}

/**
 * Hash simple para strings
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Calcula similitud coseno entre dos vectores
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns {number} Similitud (0-1)
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) || 0;
}

/**
 * Encuentra los chunks más similares a un query
 * @param {string} query - Query del usuario
 * @param {Array} chunks - Array de {text, embedding}
 * @param {number} topK - Número de resultados
 * @returns {Promise<Array>} Chunks ordenados por similitud
 */
async function findSimilar(query, chunks, topK = 5) {
  const queryEmbedding = await embed(query);
  
  const scored = chunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

module.exports = {
  embed,
  cosineSimilarity,
  findSimilar,
  initializeModel
};
