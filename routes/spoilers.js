const express = require('express');
const router = express.Router();
const { generateSpoiler } = require('../services/aiService');

// POST /api/spoilers
// Devuelve 3 opciones de spoiler (1 real + 2 falsos) sin revelar cuál es verdadero
router.post('/', async (req, res) => {
  const { title } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Necesito el título del libro para invocar sus secretos.'
    });
  }

  try {
    const result = await generateSpoiler(title.trim());
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error generando spoiler:', error);
    return res.status(500).json({
      success: false,
      message: `🌀 No he podido acceder a los secretos de "${title}" en este momento.`,
      spoilers: []
    });
  }
});

module.exports = router;
