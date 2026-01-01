/**
 * Servidor demo para pruebas de Azkaban Brain
 * Sin dependencia de SendGrid ni Google Drive
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const { askAzkaban, summarizeBook, recommendBooks, isTinyLlamaAvailable } = require('./services/azkabanBrain');
const { indexAllBooks } = require('./services/ragService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== AZKABAN BRAIN API ==========

app.post('/api/azkaban/ask', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query vacío',
        message: 'Debes proporcionar una pregunta'
      });
    }
    
    console.log(`🔮 Pregunta recibida: "${query}"`);
    
    const result = await askAzkaban(query);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en /api/azkaban/ask:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      response: 'Las sombras de Azkaban se agitan... Un error oscuro impide mi respuesta.'
    });
  }
});

app.post('/api/azkaban/summarize', async (req, res) => {
  try {
    const { bookTitle } = req.body;
    
    if (!bookTitle) {
      return res.status(400).json({
        error: 'bookTitle requerido'
      });
    }
    
    const result = await summarizeBook(bookTitle);
    res.json({ success: true, ...result });
    
  } catch (error) {
    console.error('Error en /api/azkaban/summarize:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/azkaban/recommend', async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({
        error: 'preferences requerido'
      });
    }
    
    const result = await recommendBooks(preferences);
    res.json({ success: true, ...result });
    
  } catch (error) {
    console.error('Error en /api/azkaban/recommend:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/azkaban/status', async (req, res) => {
  const status = {
    available: isTinyLlamaAvailable(),
    model: 'TinyLlama-7B-ARM',
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mode: isTinyLlamaAvailable() ? 'full' : 'fallback'
  };
  
  res.json(status);
});

app.post('/api/azkaban/index', async (req, res) => {
  try {
    console.log('📚 Iniciando indexación de biblioteca...');
    
    indexAllBooks().catch(err => {
      console.error('Error en indexación:', err);
    });
    
    res.json({
      success: true,
      message: 'Indexación iniciada en background'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Azkaban Brain - Demo</title>
      <style>
        body { 
          font-family: monospace; 
          background: #0a0a0a; 
          color: #19E6D6; 
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 { text-shadow: 0 0 10px rgba(25,230,214,0.8); }
        a { color: #19E6D6; }
        .status { 
          background: rgba(25,230,214,0.1); 
          border: 2px solid #19E6D6; 
          padding: 20px; 
          margin: 20px 0;
          border-radius: 8px;
        }
        ul { line-height: 2; }
      </style>
    </head>
    <body>
      <h1>🔮 Azkaban Brain - Servidor Demo</h1>
      
      <div class="status">
        <h3>Estado:</h3>
        <p>✅ Servidor activo en modo ${isTinyLlamaAvailable() ? 'completo' : 'fallback'}</p>
        <p>🖥️  Arquitectura: ${process.arch}</p>
        <p>💻 Plataforma: ${process.platform}</p>
      </div>
      
      <h3>Endpoints disponibles:</h3>
      <ul>
        <li><a href="/api/azkaban/status">/api/azkaban/status</a> (GET)</li>
        <li>/api/azkaban/ask (POST)</li>
        <li>/api/azkaban/summarize (POST)</li>
        <li>/api/azkaban/recommend (POST)</li>
        <li>/api/azkaban/index (POST)</li>
      </ul>
      
      <h3>Interfaz de prueba:</h3>
      <p><a href="/test-azkaban.html">→ Test Azkaban Brain</a></p>
      
      <h3>Ejemplo curl:</h3>
      <pre>curl -X POST http://localhost:${PORT}/api/azkaban/ask \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"¿Quién eres?"}'</pre>
    </body>
    </html>
  `);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('🔮 ========================================');
  console.log('🔮  AZKABAN BRAIN - Servidor Demo');
  console.log('🔮 ========================================');
  console.log('');
  console.log(`✅ Servidor activo en http://localhost:${PORT}`);
  console.log(`🧠 Modo: ${isTinyLlamaAvailable() ? 'TinyLlama completo' : 'Fallback (sin TinyLlama)'}`);
  console.log(`🖥️  Arquitectura: ${process.arch}`);
  console.log(`💻 Plataforma: ${process.platform}`);
  console.log('');
  console.log('📍 Endpoints:');
  console.log(`   • http://localhost:${PORT}/api/azkaban/status`);
  console.log(`   • http://localhost:${PORT}/api/azkaban/ask`);
  console.log(`   • http://localhost:${PORT}/test-azkaban.html`);
  console.log('');
  console.log('🎯 Prueba con:');
  console.log(`   curl http://localhost:${PORT}/api/azkaban/status`);
  console.log('');
  console.log('✨ "Las sombras de Azkaban despiertan..."');
  console.log('');
});
