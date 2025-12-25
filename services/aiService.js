/**
 * aiService.js - Capa de IA conversacional para LUMOS
 * 
 * Interpreta mensajes del usuario y genera respuestas
 * en tono Azkaban (oscuro, serio, narrativo)
 */

const initialMessages = [
  "Los libros permanecen encadenados en estas sombras. ¿Cuál deseas liberar hoy?",
  "Soy LUMOS, guardián de Azkaban Reads. ¿Qué historias te atreves a invocar?",
  "Entre estos muros dormitan secretos encuadernados. Dime un título y los despertaremos.",
  "Las estanterías susurran tu nombre. ¿Buscas un libro concreto o una recomendación prohibida?",
  "Cada página es un hechizo distinto. ¿Quieres que te guíe hacia uno en particular?",
  "La oscuridad de la biblioteca no asusta a los verdaderos lectores. ¿Qué deseas encontrar?",
  "He vigilado estas obras durante años. Pregunta, y te mostraré lo que se oculta entre ellas.",
  "Algunos libros iluminan, otros condenan. ¿Te arriesgas a elegir uno conmigo?",
  "Las sombras traen rumores de nuevas publicaciones. ¿Quieres conocer las últimas novedades?",
  "Ni siquiera Azkaban puede encerrar las historias para siempre. ¿Qué relato deseas desatar?",
  "Tu llegada ha agitado el polvo antiguo de estas páginas. ¿Buscas un autor, un género o un riesgo?"
];

/**
 * Obtiene un mensaje inicial aleatorio
 */
function getRandomInitialMessage() {
  return initialMessages[Math.floor(Math.random() * initialMessages.length)];
}

/**
 * Detecta la intención del usuario basándose en su mensaje
 * @param {string} message - Mensaje del usuario
 * @returns {object} { intent, confidence, entities }
 */
function detectIntent(message) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Patrones de detección
  const patterns = {
    spoiler: /spoiler|spoilea|revelar|final|termina|acabar|muere|cuenta.*final|qué pasa/i,
    search: /busco|buscar|encontrar|quiero.*libro|dame.*libro|tienes.*libro|búsqueda/i,
    recommend: /recomien|recomienda|suger|qué.*leer|dame.*algo|sorpren|inspira/i,
    test: /test|quiz|cuestionario|descubr.*lector|qué.*tipo.*lector/i,
    request: /solicitar|pedir|no.*encuentr|no.*tenéis|no.*está|agregar|añadir/i,
    notify: /avisar|notifica|aviso|alerta|novedades|nuevos.*libros/i,
    help: /ayuda|cómo.*funciona|qué.*puedes|comandos|instruccion/i,
    greeting: /hola|buenos|buenas|saludos|hey|qué tal/i,
    thanks: /gracias|perfecto|genial|excelente|ok|vale/i
  };
  
  // Comprobar cada patrón
  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(lowerMessage)) {
      return {
        intent,
        confidence: 0.8,
        entities: extractEntities(lowerMessage, intent)
      };
    }
  }
  
  // Si contiene palabras clave de libros, asumir búsqueda
  if (/libro|autor|saga|novela|serie|título/i.test(lowerMessage)) {
    return {
      intent: 'search',
      confidence: 0.6,
      entities: { query: message }
    };
  }
  
  return {
    intent: 'unknown',
    confidence: 0.3,
    entities: {}
  };
}

/**
 * Extrae entidades del mensaje según la intención
 */
function extractEntities(message, intent) {
  const entities = {};
  
  if (intent === 'search') {
    entities.query = message;
  }
  
  if (intent === 'spoiler') {
    // Intentar extraer nombre del libro
    const bookMatch = message.match(/(?:de|del|sobre)\s+(.+?)(?:\?|$|por favor)/i);
    if (bookMatch) {
      entities.bookTitle = bookMatch[1].trim();
    }
  }
  
  if (intent === 'recommend') {
    // Detectar preferencias
    if (/saga|serie/i.test(message)) entities.type = 'saga';
    if (/corto|autoconclusivo|único/i.test(message)) entities.type = 'standalone';
    if (/terror|miedo|horror/i.test(message)) entities.genre = 'terror';
    if (/fantasi|fantástico|magia/i.test(message)) entities.genre = 'fantasía';
    if (/romance|amor/i.test(message)) entities.genre = 'romance';
  }
  
  return entities;
}

/**
 * Genera la respuesta de LUMOS según la intención detectada
 * @param {object} params - { message, context, intent }
 * @returns {Promise<object>} { text, actions, requiresConfirmation }
 */
async function getLumosResponse({ message, context = {}, intent = null }) {
  // Detectar intención si no se proporciona
  if (!intent) {
    const detection = detectIntent(message);
    intent = detection.intent;
    context.entities = detection.entities;
  }
  
  // Generar respuesta según intención
  switch (intent) {
    case 'greeting':
      return {
        text: getRandomInitialMessage(),
        actions: [
          { type: 'search', label: 'Buscar libro' },
          { type: 'recommend', label: 'Recomiéndame algo' },
          { type: 'notify', label: 'Novedades' },
          { type: 'test', label: 'Test lector' }
        ]
      };
      
    case 'search':
      return {
        text: 'Dime el título, autor o saga que buscas entre los muros de Azkaban...',
        actions: [
          { type: 'search', label: 'Continuar búsqueda', payload: { query: context.entities?.query } }
        ],
        waitFor: 'search_query'
      };
      
    case 'recommend':
      return {
        text: '¿Qué tipo de lectura buscas? Las sombras ocultan muchas historias...',
        actions: [
          { type: 'recommend', label: '📚 Saga', payload: { type: 'saga' } },
          { type: 'recommend', label: '📖 Autoconclusivo', payload: { type: 'standalone' } },
          { type: 'recommend', label: '🎲 Sorpréndeme', payload: { type: 'all' } }
        ]
      };
      
    case 'spoiler':
      const bookTitle = context.entities?.bookTitle || 'ese libro';
      return {
        text: `⚠️ Lo que me pides no tiene marcha atrás. ¿Confirmas que deseas un spoiler de <strong>${bookTitle}</strong>? Una vez revelado, el hechizo no puede deshacerse.`,
        actions: [
          { type: 'spoiler_confirm', label: '✓ Sí, quiero el spoiler', payload: { bookTitle } },
          { type: 'cancel', label: '✗ No, mejor no' }
        ],
        requiresConfirmation: true
      };
      
    case 'test':
      return {
        text: 'El Test del Lector revelarátu verdadera naturaleza... ¿Estás preparado para descubrir qué tipo de lector eres?',
        actions: [
          { type: 'test_start', label: 'Iniciar test' },
          { type: 'cancel', label: 'Quizás luego' }
        ]
      };
      
    case 'request':
      return {
        text: 'Registraré tu solicitud en los archivos prohibidos. Dime el título del libro que buscas y haré lo posible por capturarlo.',
        actions: [
          { type: 'request_book', label: 'Continuar solicitud' }
        ],
        waitFor: 'request_title'
      };
      
    case 'notify':
      return {
        text: 'Puedo vigilar las sombras y avisarte cuando lleguen nuevas obras. ¿Qué deseas que vigile?',
        actions: [
          { type: 'notify_all', label: 'Todas las novedades' },
          { type: 'notify_genre', label: 'Un género específico' }
        ]
      };
      
    case 'help':
      return {
        text: `Soy LUMOS, el guardián de Azkaban Reads. Puedo ayudarte a:
        
• <strong>Buscar libros</strong> por título, autor o saga
• <strong>Recomendarte</strong> lecturas según tus gustos
• <strong>Solicitar libros</strong> que aún no están capturados
• <strong>Revelarte spoilers</strong> (con confirmación)
• <strong>Avisarte</strong> de nuevas publicaciones
• <strong>Descubrir</strong> qué tipo de lector eres

¿Qué deseas hacer?`,
        actions: [
          { type: 'search', label: 'Buscar libro' },
          { type: 'recommend', label: 'Recomiéndame algo' },
          { type: 'test', label: 'Test lector' }
        ]
      };
      
    case 'thanks':
      const responses = [
        'Los muros siempre están atentos. Vuelve cuando necesites más.',
        'Las sombras te esperan. Regresa pronto.',
        'Que las páginas te guíen, lector.'
      ];
      return {
        text: responses[Math.floor(Math.random() * responses.length)],
        actions: [
          { type: 'close', label: 'Cerrar' }
        ]
      };
      
    default:
      return {
        text: 'No comprendo esa petición. ¿Quieres buscar un libro, que te recomiende algo, o necesitas ayuda?',
        actions: [
          { type: 'search', label: 'Buscar libro' },
          { type: 'recommend', label: 'Recomiéndame algo' },
          { type: 'help', label: 'Ayuda' }
        ]
      };
  }
}

/**
 * Genera respuesta de spoiler (solo después de confirmación)
 */
async function generateSpoiler(bookTitle) {
  // IMPORTANTE: Nunca inventar información
  // Esto debe conectarse a una fuente real de datos
  return {
    text: `🔮 <strong>ADVERTENCIA: SPOILERS DE "${bookTitle}"</strong><br><br>
    Lo siento, pero mi misión es proteger los secretos de los libros, no revelarlos sin una fuente confiable. 
    No puedo inventar spoilers. Si realmente deseas conocer el final, te recomiendo buscarlo en fuentes especializadas 
    o preguntar a otros lectores que ya hayan completado la obra.
    <br><br>
    Los secretos mejor guardados son aquellos que descubres por ti mismo...`,
    actions: [
      { type: 'search', label: 'Buscar este libro', payload: { query: bookTitle } },
      { type: 'back', label: 'Volver' }
    ]
  };
}

/**
 * Formatea la respuesta con el tono Azkaban
 */
function formatAzkabanTone(text) {
  // Ya está formateado en las respuestas arriba
  return text;
}

// Exportar funciones
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getLumosResponse,
    detectIntent,
    getRandomInitialMessage,
    generateSpoiler
  };
}

// Para uso en el navegador
if (typeof window !== 'undefined') {
  window.AzkabanAI = {
    getLumosResponse,
    detectIntent,
    getRandomInitialMessage,
    generateSpoiler
  };
}
