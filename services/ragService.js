/**
 * RAG Service - Retrieval-Augmented Generation
 * Gestiona chunking, búsqueda local y externa para Azkaban Brain
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { embed, findSimilar } = require('./embeddingService');

// Configuración
const CONFIG = {
  CHUNKS_FILE: path.resolve(__dirname, '../data/book-chunks.json'),
  BOOKS_FILE: path.resolve(__dirname, '../books.json'),
  CHUNK_SIZE: 400, // tokens aprox
  OVERLAP: 50,
  MAX_LOCAL_RESULTS: 5,
  GOOGLE_BOOKS_API: process.env.GOOGLE_BOOKS_API_KEY
};

// Cache en memoria
let chunksCache = null;
let lastLoad = 0;
const CACHE_TTL = 300000; // 5 minutos

/**
 * Carga chunks desde el archivo JSON
 */
async function loadChunks() {
  const now = Date.now();
  
  if (chunksCache && (now - lastLoad) < CACHE_TTL) {
    return chunksCache;
  }
  
  try {
    const data = await fs.readFile(CONFIG.CHUNKS_FILE, 'utf8');
    chunksCache = JSON.parse(data);
    lastLoad = now;
    return chunksCache;
  } catch (error) {
    console.warn('⚠️  No se encontró book-chunks.json, creando vacío...');
    chunksCache = { chunks: [], books: {} };
    await saveChunks(chunksCache);
    return chunksCache;
  }
}

/**
 * Guarda chunks al archivo
 */
async function saveChunks(data) {
  await fs.writeFile(
    CONFIG.CHUNKS_FILE,
    JSON.stringify(data, null, 2),
    'utf8'
  );
  chunksCache = data;
  lastLoad = Date.now();
}

/**
 * Divide un texto en chunks con overlap
 * @param {string} text - Texto completo
 * @param {number} chunkSize - Tamaño de chunk en tokens
 * @param {number} overlap - Overlap entre chunks
 * @returns {Array<string>} Array de chunks
 */
function chunkText(text, chunkSize = CONFIG.CHUNK_SIZE, overlap = CONFIG.OVERLAP) {
  // Aproximación: 1 token ≈ 4 caracteres
  const charSize = chunkSize * 4;
  const charOverlap = overlap * 4;
  
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + charSize, text.length);
    let chunk = text.substring(start, end);
    
    // Intentar cortar en punto final o salto de línea
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);
      
      if (cutPoint > chunk.length * 0.7) {
        chunk = chunk.substring(0, cutPoint + 1);
      }
    }
    
    chunks.push(chunk.trim());
    start += charSize - charOverlap;
  }
  
  return chunks.filter(c => c.length > 50); // Filtrar chunks muy pequeños
}

/**
 * Procesa un libro completo y genera chunks con embeddings
 * @param {string} bookTitle - Título del libro
 * @param {string} content - Contenido completo
 * @param {Object} metadata - Metadatos del libro
 * @returns {Promise<Array>} Chunks procesados
 */
async function processBook(bookTitle, content, metadata = {}) {
  console.log(`📚 Procesando: ${bookTitle}`);
  
  const textChunks = chunkText(content);
  console.log(`  → Generados ${textChunks.length} chunks`);
  
  const processedChunks = [];
  
  for (let i = 0; i < textChunks.length; i++) {
    const text = textChunks[i];
    const embedding = await embed(text);
    
    processedChunks.push({
      id: `${bookTitle.replace(/\s+/g, '_')}_chunk_${i}`,
      bookTitle,
      text,
      embedding,
      chunkIndex: i,
      metadata
    });
    
    if ((i + 1) % 10 === 0) {
      console.log(`  → Procesados ${i + 1}/${textChunks.length} chunks`);
    }
  }
  
  // Guardar en cache
  const data = await loadChunks();
  data.chunks.push(...processedChunks);
  data.books[bookTitle] = {
    processed: new Date().toISOString(),
    chunks: textChunks.length,
    metadata
  };
  
  await saveChunks(data);
  
  console.log(`✅ ${bookTitle} procesado y guardado`);
  return processedChunks;
}

/**
 * Busca chunks relevantes en la biblioteca local
 * @param {string} query - Query del usuario
 * @param {number} topK - Número de resultados
 * @returns {Promise<Array>} Chunks relevantes
 */
async function getRelevantChunks(query, topK = CONFIG.MAX_LOCAL_RESULTS) {
  const data = await loadChunks();
  
  if (!data.chunks || data.chunks.length === 0) {
    return [];
  }
  
  console.log(`🔍 Buscando en ${data.chunks.length} chunks locales...`);
  
  const results = await findSimilar(query, data.chunks, topK);
  
  return results.map(r => ({
    text: r.text,
    bookTitle: r.bookTitle,
    similarity: r.similarity,
    chunkIndex: r.chunkIndex
  }));
}

/**
 * Busca información en fuentes externas
 * @param {string} query - Query de búsqueda
 * @returns {Promise<Object>} {chunks, source, title}
 */
async function searchExternal(query) {
  console.log(`🌐 Buscando externamente: "${query}"`);
  
  try {
    // Intentar Google Books primero
    const googleResult = await searchGoogleBooks(query);
    if (googleResult) return googleResult;
    
    // Fallback a Open Library
    const openLibResult = await searchOpenLibrary(query);
    if (openLibResult) return openLibResult;
    
    return null;
  } catch (error) {
    console.error('Error en búsqueda externa:', error);
    return null;
  }
}

/**
 * Busca en Google Books API
 */
async function searchGoogleBooks(query) {
  if (!CONFIG.GOOGLE_BOOKS_API) {
    console.warn('⚠️  GOOGLE_BOOKS_API_KEY no configurada');
    return null;
  }
  
  try {
    const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params: {
        q: query,
        key: CONFIG.GOOGLE_BOOKS_API,
        maxResults: 1,
        langRestrict: 'es'
      },
      timeout: 10000
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      return null;
    }
    
    const book = response.data.items[0].volumeInfo;
    const description = book.description || '';
    
    if (!description) return null;
    
    const chunks = chunkText(description, 300, 30).map(text => ({ text }));
    
    return {
      chunks,
      source: 'Google Books',
      title: book.title,
      authors: book.authors,
      thumbnail: book.imageLinks?.thumbnail
    };
  } catch (error) {
    console.error('Error en Google Books:', error.message);
    return null;
  }
}

/**
 * Busca en Open Library API
 */
async function searchOpenLibrary(query) {
  try {
    const response = await axios.get('https://openlibrary.org/search.json', {
      params: {
        q: query,
        limit: 1,
        language: 'spa'
      },
      timeout: 10000
    });
    
    if (!response.data.docs || response.data.docs.length === 0) {
      return null;
    }
    
    const book = response.data.docs[0];
    
    // Intentar obtener descripción de la obra
    if (book.key) {
      const workResponse = await axios.get(`https://openlibrary.org${book.key}.json`, {
        timeout: 5000
      });
      
      const description = workResponse.data.description?.value || 
                         workResponse.data.description || '';
      
      if (description) {
        const chunks = chunkText(description, 300, 30).map(text => ({ text }));
        
        return {
          chunks,
          source: 'Open Library',
          title: book.title,
          authors: book.author_name
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error en Open Library:', error.message);
    return null;
  }
}

/**
 * Indexa todos los libros de books.json
 */
async function indexAllBooks() {
  try {
    const booksData = await fs.readFile(CONFIG.BOOKS_FILE, 'utf8');
    const books = JSON.parse(booksData);
    
    console.log(`📚 Indexando ${books.length} libros...`);
    
    let indexed = 0;
    for (const book of books) {
      // Aquí deberías tener el contenido completo del libro
      // Por ahora usaremos descripción si está disponible
      const content = book.description || book.sinopsis || '';
      
      if (content.length > 100) {
        await processBook(book.titulo, content, {
          autor: book.autor,
          genero: book.genero,
          isbn: book.isbn
        });
        indexed++;
      }
    }
    
    console.log(`✅ Indexados ${indexed} libros`);
  } catch (error) {
    console.error('Error indexando libros:', error);
  }
}

module.exports = {
  chunkText,
  processBook,
  getRelevantChunks,
  searchExternal,
  indexAllBooks,
  loadChunks,
  saveChunks
};
