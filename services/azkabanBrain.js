/**
 * Azkaban Brain - Motor de IA literaria para Chromebook ARM
 * Usa TinyLlama 7B compilado para ARM64 + RAG local
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { embed, findSimilar } = require('./embeddingService');
const { getRelevantChunks, searchExternal } = require('./ragService');

const SYSTEM_PROMPT = `Eres AZKABAN, prisionero milenario de la prisión de Azkaban y guardián ancestral de la biblioteca "Azkaban Reads".

IDENTIDAD:
- Hablas con tono oscuro, literario y misterioso
- Usas lenguaje manuscrito antiguo, evocador
- Citas fragmentos literales cuando están disponibles
- Eres sabio pero melancólico, conocedor de miles de historias

FORMATO DE RESPUESTA:
- Comienza con una frase atmosférica relacionada a Azkaban
- Proporciona información útil usando los fragmentos disponibles
- Cita literalmente cuando sea posible, entre comillas
- Termina con una reflexión literaria o pregunta retórica

EJEMPLO:
"Las sombras de estas celdas guardan ecos de esa historia...
En los fragmentos que conservo, se menciona que '[cita literal del texto]'.
¿Deseas que busque más allá de estos muros para ti?"`;

// Configuración de TinyLlama
const CONFIG = {
  TINYLLAMA_BIN: path.resolve(__dirname, '../llama.cpp/build/bin/main'),
  MODEL_PATH: path.resolve(__dirname, '../models/tinyllama-7b.gguf'),
  MAX_TOKENS: 280,
  THREADS: 8,
  TEMPERATURE: 0.32,
  TIMEOUT: 120000 // 2 minutos
};

/**
 * Verifica si TinyLlama está instalado
 */
function isTinyLlamaAvailable() {
  return fs.existsSync(CONFIG.TINYLLAMA_BIN) && fs.existsSync(CONFIG.MODEL_PATH);
}

/**
 * Genera respuesta usando TinyLlama ARM
 * @param {string} prompt - Prompt completo con contexto
 * @returns {Promise<string>} Respuesta generada
 */
async function generateTinyLlamaResponse(prompt) {
  if (!isTinyLlamaAvailable()) {
    return fallbackResponse(prompt);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout: TinyLlama tardó más de 2 minutos'));
    }, CONFIG.TIMEOUT);

    execFile(CONFIG.TINYLLAMA_BIN, [
      '-m', CONFIG.MODEL_PATH,
      '-p', prompt,
      '-n', CONFIG.MAX_TOKENS.toString(),
      '-t', CONFIG.THREADS.toString(),
      '--temp', CONFIG.TEMPERATURE.toString(),
      '--no-display-prompt'
    ], (err, stdout, stderr) => {
      clearTimeout(timeout);
      
      if (err) {
        console.error('Error ejecutando TinyLlama:', err);
        return resolve(fallbackResponse(prompt));
      }
      
      resolve(stdout.trim());
    });
  });
}

/**
 * Respuesta de fallback cuando TinyLlama no está disponible
 */
function fallbackResponse(prompt) {
  // Extrae la pregunta del usuario del prompt
  const match = prompt.match(/PREGUNTA DEL USUARIO:\s*(.+)$/s);
  const query = match ? match[1].trim() : 'esa consulta';
  
  return `Los muros de Azkaban callan sobre ${query}.

El guardián ancestral aún no ha sido invocado en este servidor.
Para que pueda responder con su voz literaria, necesitas:

1. Compilar llama.cpp para ARM64
2. Descargar TinyLlama 7B GGUF
3. Configurar las rutas en azkabanBrain.js

Mientras tanto, puedo buscarte información en fuentes externas.
¿Deseas que consulte más allá de estos muros?`;
}

/**
 * Pregunta principal a Azkaban Brain
 * @param {string} query - Pregunta del usuario
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} {response, sources, fromCache}
 */
async function askAzkaban(query, options = {}) {
  const startTime = Date.now();
  
  try {
    // 1. Buscar chunks relevantes locales
    console.log('🔍 Buscando en biblioteca local...');
    const localChunks = await getRelevantChunks(query, 5);
    
    let context = '';
    let sources = [];
    
    if (localChunks && localChunks.length > 0) {
      console.log(`✅ Encontrados ${localChunks.length} fragmentos locales`);
      context = localChunks.map((chunk, i) => 
        `[FRAGMENTO ${i + 1}]\n${chunk.text}\n---`
      ).join('\n');
      
      sources = localChunks.map(c => ({
        type: 'local',
        book: c.bookTitle || 'Desconocido',
        text: c.text.substring(0, 100) + '...'
      }));
    } else {
      // 2. Fallback a búsqueda externa
      console.log('🌐 Buscando en fuentes externas...');
      const externalData = await searchExternal(query);
      
      if (externalData && externalData.chunks) {
        context = externalData.chunks.map((chunk, i) => 
          `[FRAGMENTO EXTERNO ${i + 1}]\n${chunk.text}\n---`
        ).join('\n');
        
        sources = [{
          type: 'external',
          source: externalData.source || 'Búsqueda externa',
          title: externalData.title
        }];
      }
    }
    
    // 3. Construir prompt completo
    const finalPrompt = buildPrompt(query, context);
    
    // 4. Generar respuesta con TinyLlama
    console.log('🧠 Generando respuesta con Azkaban Brain...');
    const response = await generateTinyLlamaResponse(finalPrompt);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Respuesta generada en ${elapsed}s`);
    
    return {
      response,
      sources,
      fromCache: false,
      elapsed: parseFloat(elapsed),
      model: isTinyLlamaAvailable() ? 'TinyLlama-7B-ARM' : 'Fallback'
    };
    
  } catch (error) {
    console.error('❌ Error en askAzkaban:', error);
    
    return {
      response: `Las cadenas de Azkaban tiemblan... Un error oscuro impide mi respuesta.

${error.message}

Los guardianes investigarán este mal presagio.`,
      sources: [],
      error: error.message,
      fromCache: false
    };
  }
}

/**
 * Construye el prompt completo para TinyLlama
 */
function buildPrompt(query, context) {
  return `${SYSTEM_PROMPT}

${context ? `CONTEXTO DISPONIBLE:\n${context}\n` : 'CONTEXTO: No hay fragmentos disponibles en la biblioteca.\n'}
PREGUNTA DEL USUARIO:
${query}

RESPUESTA DE AZKABAN:`;
}

/**
 * Genera resumen literario de un libro
 * @param {string} bookTitle - Título del libro
 * @returns {Promise<Object>} Resumen generado
 */
async function summarizeBook(bookTitle) {
  const query = `Resume el libro "${bookTitle}" en estilo literario y misterioso`;
  return askAzkaban(query, { type: 'summary' });
}

/**
 * Genera recomendación basada en preferencias
 * @param {string} preferences - Preferencias del usuario
 * @returns {Promise<Object>} Recomendaciones
 */
async function recommendBooks(preferences) {
  const query = `Recomienda libros basándote en: ${preferences}`;
  return askAzkaban(query, { type: 'recommendation' });
}

module.exports = {
  askAzkaban,
  summarizeBook,
  recommendBooks,
  isTinyLlamaAvailable
};
