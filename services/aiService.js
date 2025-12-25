/**
 * aiService.js - Capa de IA conversacional para LUMOS
 * 
 * Interpreta mensajes del usuario y genera respuestas
 * en tono Azkaban (oscuro, serio, narrativo)
 */

const DEFAULT_FETCH_HEADERS = {
  'User-Agent': 'LumosSpoilerBot/1.0 (contact: support@azkabanreads.local)',
  'Accept': 'application/json'
};

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
  
  // Patrones de detección MEJORADOS
  const patterns = {
    spoiler_character: /spoiler.*(?:de|del|sobre|qué pasa con|qué le pasa a|personaje|muerte de)\s+(\w+)|qué le pasa a\s+(\w+)|muere\s+(\w+)|final.*(?:de|de la)\s+(\w+)/i,
    spoiler_book: /spoiler.*(?:de|del|sobre|del libro|del libro titulado)\s+(.+?)(?:\?|$|por favor)|spoiler.*libro|final.*(?:del|de)\s+(.+?)(?:\?|$)/i,
    spoiler: /spoiler|spoilea|revelar|final|termina|acabar|qué pasa|cuenta.*final/i,
    search: /busco|buscar|encontrar|quiero.*libro|dame.*libro|tienes.*libro|búsqueda/i,
    recommend: /recomien|recomienda|suger|qué.*leer|dame.*algo|sorpren|inspira/i,
    test: /test|quiz|cuestionario|descubr.*lector|qué.*tipo.*lector/i,
    request: /solicitar|pedir|no.*encuentr|no.*tenéis|no.*está|agregar|añadir/i,
    notify: /avisar|notifica|aviso|alerta|novedades|nuevos.*libros/i,
    help: /ayuda|cómo.*funciona|qué.*puedes|comandos|instruccion/i,
    greeting: /hola|buenos|buenas|saludos|hey|qué tal/i,
    thanks: /gracias|perfecto|genial|excelente|ok|vale/i
  };
  
  // Comprobar patrones específicos PRIMERO (más específicos)
  if (patterns.spoiler_character.test(lowerMessage)) {
    return {
      intent: 'spoiler_character',
      confidence: 0.9,
      entities: extractEntities(lowerMessage, 'spoiler_character')
    };
  }
  
  if (patterns.spoiler_book.test(lowerMessage)) {
    return {
      intent: 'spoiler_book',
      confidence: 0.9,
      entities: extractEntities(lowerMessage, 'spoiler_book')
    };
  }
  
  // Luego patrones generales
  for (const [intent, pattern] of Object.entries(patterns)) {
    if (intent !== 'spoiler_character' && intent !== 'spoiler_book' && pattern.test(lowerMessage)) {
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
  
  if (intent === 'spoiler_character') {
    // Extraer nombre del personaje
    const charMatch = message.match(/(?:de|del|sobre|qué pasa con|qué le pasa a|personaje|muerte de)\s+(\w+(?:\s+\w+)?)|qué le pasa a\s+(\w+(?:\s+\w+)?)|muere\s+(\w+(?:\s+\w+)?)/i);
    if (charMatch) {
      entities.characterName = charMatch[1] || charMatch[2] || charMatch[3];
    }
    
    // Extraer nombre del libro si está disponible
    const bookMatch = message.match(/(?:en|del|de)\s+(.+?)(?:\?|$|por favor)/i);
    if (bookMatch && !bookMatch[1].toLowerCase().includes(entities.characterName || '')) {
      entities.bookTitle = bookMatch[1].trim();
    }
  }
  
  if (intent === 'spoiler_book') {
    // Intentar extraer nombre del libro
    const bookMatch = message.match(/(?:de|del|sobre|del libro|del libro titulado)\s+(.+?)(?:\?|$|por favor)|spoiler.*libro|final.*(?:del|de)\s+(.+?)(?:\?|$)/i);
    if (bookMatch) {
      entities.bookTitle = (bookMatch[1] || bookMatch[2] || '').trim();
    }
    
    // Intentar extraer autor si está disponible
    const authorMatch = message.match(/(?:de|autor|escrito por)\s+(\w+(?:\s+\w+)?)/i);
    if (authorMatch) {
      entities.author = authorMatch[1].trim();
    }
  }
  
  if (intent === 'spoiler') {
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
      
    case 'spoiler_character':
      const charName = context.entities?.characterName;
      const bookForChar = context.entities?.bookTitle;
      
      if (!charName) {
        return {
          text: '🔮 ¿Qué personaje te interesa? Dime su nombre... y si quieres, el libro del que viene.',
          waitFor: 'character_name'
        };
      }
      
      if (!bookForChar) {
        return {
          text: `📖 Entiendo que buscas el destino de <strong>${charName}</strong>. ¿En qué libro ocurre esta historia?`,
          waitFor: 'book_title'
        };
      }
      
      return {
        text: `⚠️ ¿Confirmas que deseas el spoiler del personaje <strong>${charName}</strong> en <strong>${bookForChar}</strong>? No hay vuelta atrás...`,
        actions: [
          { type: 'spoiler', label: '🔓 Revelar spoiler', payload: { type: 'character', character: charName, book: bookForChar } },
          { type: 'back', label: '← Cancelar' }
        ],
        requiresConfirmation: true
      };
      
    case 'spoiler_book':
      const book = context.entities?.bookTitle;
      const author = context.entities?.author;
      
      if (!book) {
        return {
          text: '📚 ¿De qué libro deseas conocer el final? Dime el título...',
          waitFor: 'book_title'
        };
      }
      
      if (!author) {
        return {
          text: `¿Del libro <strong>${book}</strong> de quién es? (el autor puede ayudar a encontrar el correcto)`,
          waitFor: 'author_name',
          optional: true
        };
      }
      
      return {
        text: `⚠️ ¿Confirmas que deseas el spoiler de <strong>${book}</strong> de <strong>${author}</strong>? Una vez revelado, el hechizo no puede deshacerse.`,
        actions: [
          { type: 'spoiler', label: '🔓 Revelar spoiler', payload: { type: 'book', title: book, author: author } },
          { type: 'back', label: '← Cancelar' }
        ],
        requiresConfirmation: true
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
 * NUEVA LÓGICA: Busca spoiler verdadero + genera 2 falsos + mezcla
 */
async function generateSpoiler(bookTitle) {
  try {
    // Buscar el spoiler verdadero
    const trueSpoiler = await fetchTrueSpoiler(bookTitle);
    
    if (!trueSpoiler) {
      // No se encontró el spoiler real: usar un fallback narrativo para no romper la experiencia
      const fallbackSpoiler = generateFallbackTrueSpoiler(bookTitle);
      const fakeA = await generateFakeSpoiler(fallbackSpoiler, bookTitle);
      const fakeB = await generateFakeSpoiler(fallbackSpoiler, bookTitle);
      const spoilers = shuffle([
        { text: fallbackSpoiler, isTrue: true },
        { text: fakeA, isTrue: false },
        { text: fakeB, isTrue: false }
      ]);

      return {
        title: bookTitle,
        message: getAzkabanDenialMessage(),
        spoilers: spoilers.map((s, i) => ({ id: i + 1, text: s.text }))
      };
    }
    
    // Generar 2 spoilers falsos plausibles
    const fake1 = await generateFakeSpoiler(trueSpoiler, bookTitle);
    const fake2 = await generateFakeSpoiler(trueSpoiler, bookTitle);
    
    // Mezclar los 3 spoilers aleatoriamente
    const spoilers = shuffle([
      { text: trueSpoiler, isTrue: true },
      { text: fake1, isTrue: false },
      { text: fake2, isTrue: false }
    ]);
    
    // Mensaje de negación narrativo de Azkaban
    const denialMessage = getAzkabanDenialMessage();
    
    return {
      title: bookTitle,
      message: denialMessage,
      spoilers: spoilers.map((s, i) => ({
        id: i + 1,
        text: s.text
      }))
    };
  } catch (err) {
    console.error('Error en generateSpoiler:', err);
    return {
      message: `${getAzkabanDenialIcon()} Un error espectral ha ocurrido. No puedo acceder a los secretos de "${bookTitle}" ahora.`,
      spoilers: []
    };
  }
}

/**
 * Extrae un spoiler corto de un texto largo
 * Busca frases que contengan acciones o revelaciones importantes
 */
function extractSpoilerFromText(text, bookTitle) {
  if (!text) return null;
  
  // Palabras clave de spoilers
  const spoilerKeywords = [
    'muere', 'muerte', 'asesinado', 'asesinada', 'traidor', 'traición',
    'el verdadero', 'resulta ser', 'era', 'secreto', 'revela', 'descubre',
    'viaja', 'viaja a', 'es', 'es realmente', 'termina en', 'final',
    'se convierte', 'regresa', 'vuelve', 'cobra venganza', 'se venga',
    'expone', 'expone que', 'gira', 'giro argumental', 'twist'
  ];
  
  // Dividir en oraciones
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Buscar frases con palabras clave de spoilers
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const keyword of spoilerKeywords) {
      if (lowerSentence.includes(keyword)) {
        let spoiler = sentence.trim();
        // Limitar a 150 caracteres
        if (spoiler.length > 150) {
          spoiler = spoiler.substring(0, 150) + '...';
        }
        return spoiler;
      }
    }
  }
  
  // Si no hay palabras clave, tomar la primera oración que suene importante
  for (const sentence of sentences) {
    if (sentence.trim().length > 20 && sentence.trim().length < 150) {
      // Evitar frases muy genéricas
      if (!/^(este|this|la historia|the book|el libro)/i.test(sentence.trim())) {
        return sentence.trim();
      }
    }
  }
  
  return null;
}

/**
 * Genera un spoiler sintético realista basado en el título y contexto
 */
async function generateRealisticSpoiler(bookTitle, context = '') {
  const spoilerPatterns = [
    `${bookTitle}: el giro final revela que`,
    `En ${bookTitle}, descubrimos que`,
    `La verdad sobre ${bookTitle} es que`,
    `El secreto de ${bookTitle}:`,
    `Inesperadamente, en ${bookTitle}`,
    `El clímax de ${bookTitle} sucede cuando`,
    `Lo que no esperabas en ${bookTitle}:`,
  ];
  
  const outcomes = [
    'el protagonista era el verdadero villano todo el tiempo',
    'la muerte que viste era falsa',
    'había un gemelo secreto',
    'nada de lo que viste era real',
    'el final ocurre en una línea temporal alternativa',
    'el amor no era recíproco',
    'la batalla final fue una trampa',
    'alguien regresa del pasado',
    'la verdadera identidad es revelada',
    'hay una segunda parte sorprendente'
  ];
  
  const pattern = spoilerPatterns[Math.floor(Math.random() * spoilerPatterns.length)];
  const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
  
  return `${pattern} ${outcome}.`;
}

/**
 * Busca el spoiler verdadero desde fuentes externas
 * Prioridad: SpoilThePlot > Wikipedia/Wikia > Goodreads > OpenLibrary
 */
async function fetchTrueSpoiler(bookTitle) {
  try {
    // Intentar SpoilThePlot
    let spoiler = await searchSpoilThePlot(bookTitle);
    if (spoiler) return spoiler;
    
    // Intentar Wikipedia/Wikia
    spoiler = await searchWikipedia(bookTitle);
    if (spoiler) return spoiler;

    // Intentar OpenLibrary (descripciones largas)
    spoiler = await searchOpenLibrary(bookTitle);
    if (spoiler) return spoiler;

    // Intentar Google Books (descripción)
    spoiler = await searchGoogleBooks(bookTitle);
    if (spoiler) return spoiler;
    
    // Intentar Goodreads (opcional)
    spoiler = await searchGoodreads(bookTitle);
    if (spoiler) return spoiler;
    
    return null;
  } catch (error) {
    console.error('Error fetchTrueSpoiler:', error);
    return null;
  }
}

/**
 * Busca en SpoilThePlot API
 */
async function searchSpoilThePlot(bookTitle) {
  try {
    // Esta es una API ficticia - reemplazar con la real si existe
    const url = `https://api.spoiltheplot.com/search?title=${encodeURIComponent(bookTitle)}`;
    const data = await fetchJSON(url);
    if (!data) return null;

    if (typeof data.spoiler === 'string' && data.spoiler.trim().length > 40) {
      console.log('[SpoilThePlot] Hit');
      return data.spoiler.trim();
    }

    if (Array.isArray(data.results)) {
      const candidate = data.results.find(r => typeof r?.spoiler === 'string' && r.spoiler.trim().length > 40);
      if (candidate) {
        console.log('[SpoilThePlot] Hit via results');
        return candidate.spoiler.trim();
      }
    }

    console.log('[SpoilThePlot] No spoiler in payload');
    return null;
  } catch (error) {
    console.error('Error searchSpoilThePlot:', error);
    return null;
  }
}

/**
 * Busca en Wikipedia
 */
async function searchWikipedia(bookTitle) {
  try {
    const langs = ['es', 'en'];
    for (const lang of langs) {
      // 1) Intento directo por título
      const directUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bookTitle)}`;
      const directData = await fetchJSON(directUrl);
      const directExtract = typeof directData?.extract === 'string' ? directData.extract.trim() : '';
      if (directExtract && directExtract.length > 160 && isRelevantSpoilerText(directExtract, bookTitle)) {
        console.log(`[Wikipedia] Direct hit ${lang}`);
        return directExtract;
      }

      // 2) Búsqueda y luego summary del mejor candidato
      const searchUrl = `https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(bookTitle)}&limit=3`;
      const searchData = await fetchJSON(searchUrl);
      const pages = Array.isArray(searchData?.pages) ? searchData.pages : [];

      for (const page of pages) {
        const candidateTitle = page?.title || page?.key || '';
        if (!candidateTitle) continue;
        if (!isTitleClose(candidateTitle, bookTitle)) continue;

        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.key || page.title)}`;
        const summary = await fetchJSON(summaryUrl);
        const extract = typeof summary?.extract === 'string' ? summary.extract.trim() : '';
        if (extract && extract.length > 160 && isRelevantSpoilerText(extract, bookTitle)) {
          console.log(`[Wikipedia] Search hit ${lang}: ${candidateTitle}`);
          return extract;
        }
      }
    }

    console.log('[Wikipedia] No extract found');
    return null;
  } catch (error) {
    console.error('Error searchWikipedia:', error);
    return null;
  }
}

/**
 * Busca en Goodreads (placeholder)
 */
async function searchGoodreads(bookTitle) {
  // Goodreads requiere API key y autenticación
  // Por ahora retornar null
  return null;
}

async function searchOpenLibrary(bookTitle) {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(bookTitle)}&limit=3`;
    const data = await fetchJSON(url);
    if (!data || !Array.isArray(data.docs) || data.docs.length === 0) {
      return null;
    }

    for (const doc of data.docs) {
      if (!doc?.title || !isTitleClose(doc.title, bookTitle)) continue;

      const description = typeof doc?.description === 'string'
        ? doc.description
        : typeof doc?.description?.value === 'string'
          ? doc.description.value
          : null;

      const firstSentence = Array.isArray(doc?.first_sentence) ? doc.first_sentence[0] : doc?.first_sentence;
      const subtitle = doc?.subtitle;

      const candidates = [description, firstSentence, subtitle].filter(Boolean);

      for (const candidate of candidates) {
        const text = String(candidate).trim();
        
        // Extraer un spoiler corto (máximo 150 caracteres)
        const shortSpoiler = extractSpoilerFromText(text, bookTitle);
        if (shortSpoiler && shortSpoiler.length > 30) {
          console.log('[OpenLibrary] Hit - Extracted short spoiler');
          return shortSpoiler;
        }
        
        // Si no hay spoiler específico pero el texto es relevante
        if (text.length >= 30 && text.length <= 150) {
          if (isRelevantSpoilerText(text, bookTitle) || isTitleClose(doc.title, bookTitle)) {
            console.log('[OpenLibrary] Hit - Using short text');
            return text;
          }
        }
      }
    }

    console.log('[OpenLibrary] No relevant description');
    return null;
  } catch (error) {
    console.error('Error searchOpenLibrary:', error);
    return null;
  }
}

async function searchGoogleBooks(bookTitle) {
  try {
    const params = new URLSearchParams({
      q: `intitle:${bookTitle}`,
      maxResults: '3',
      printType: 'books',
      langRestrict: 'es'
    });

    if (process.env.GOOGLE_BOOKS_API_KEY) {
      params.append('key', process.env.GOOGLE_BOOKS_API_KEY);
    }

    const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
    const data = await fetchJSON(url);
    if (!data || !Array.isArray(data.items)) {
      return null;
    }

    for (const item of data.items) {
      const volumeTitle = item?.volumeInfo?.title || '';
      if (!volumeTitle || !isTitleClose(volumeTitle, bookTitle)) continue;

      const desc = item?.volumeInfo?.description;
      if (typeof desc !== 'string') continue;

      const cleaned = desc.replace(/\s+/g, ' ').trim();
      
      // Extraer un spoiler corto de la descripción (máximo 150 caracteres)
      const shortSpoiler = extractSpoilerFromText(cleaned, bookTitle);
      if (shortSpoiler && shortSpoiler.length > 30) {
        console.log('[GoogleBooks] Hit - Extracted short spoiler');
        return shortSpoiler;
      }
      
      // Si no hay spoiler específico, tomar la primera oración
      const firstSentence = cleaned.split(/[.!?]+/)[0];
      if (firstSentence && firstSentence.length > 30 && firstSentence.length < 150) {
        console.log('[GoogleBooks] Hit - Using first sentence');
        return firstSentence.trim();
      }
    }

    console.log('[GoogleBooks] No description');
    return null;
  } catch (error) {
    console.error('Error searchGoogleBooks:', error);
    return null;
  }
}

/**
 * Genera spoilers falsos inteligentes basados en el spoiler real
 * Analiza el contenido y crea variaciones plausibles y únicas
 */
async function generateFakeSpoiler(trueSpoiler, bookTitle) {
  try {
    // Extraer elementos del spoiler real para crear falsos relacionados
    const elements = extractNarrativeElements(trueSpoiler, bookTitle);
    
    // Templates de variación basados en elementos reales
    const variations = [
      // Cambiar el resultado
      `${elements.protagonist} no logra cumplir su objetivo, y ${elements.antagonist || 'los enemigos'} prevalecen.`,
      `${elements.protagonist} sobrevive pero pierde ${elements.stakes || 'lo más importante'}.`,
      `El viaje de ${elements.protagonist} termina en ${elements.location || 'un lugar inesperado'} con ${elements.consequence || 'consecuencias irreversibles'}.`,
      
      // Cambiar personajes
      `${elements.antagonist || 'Un personaje secundario'} es revelado como el verdadero héroe ${elements.ofWhat || 'de esta historia'}.`,
      `${elements.ally || 'Un aliado'} traiciona a ${elements.protagonist} en el momento más crítico.`,
      
      // Cambiar el contexto
      `Lo que parecía ${elements.challenge || 'un desafío'} resulta ser ${elements.revelation || 'una ilusión desde el inicio'}.`,
      `${elements.protagonist} descubre que su verdadera misión era ${elements.truePurpose || 'completamente diferente a lo que creía'}.`,
      
      // Cambiar temporalidad
      `Los eventos de ${bookTitle} sucedieron en un orden diferente al que fue narrado.`,
      `Todo lo que ${elements.protagonist} vivió fue ${elements.wasActually || 'un entrenamiento o prueba'}.`,
      
      // Giros paradójicos
      `${elements.protagonist} y ${elements.antagonist || 'su enemigo'} deben unirse para enfrentar la verdadera amenaza.`,
      `La solución estaba en ${elements.location || 'donde empezó todo'}, pero ${elements.protagonist} tuvo que recorrer el mundo para verla.`,
    ];
    
    // Seleccionar una variación aleatoria
    const randomVariation = variations[Math.floor(Math.random() * variations.length)];
    return randomVariation;
  } catch (error) {
    console.error('Error en generateFakeSpoiler:', error);
    // Fallback a templates simples si falla el análisis
    return generateGenericFakeSpoiler(bookTitle);
  }
}

/**
 * Extrae elementos narrativos del spoiler real
 */
function extractNarrativeElements(spoiler, bookTitle) {
  const text = spoiler.toLowerCase();
  
  // Buscar patrones de nombres (palabras en mayúscula en el spoiler original)
  const uppercaseWords = spoiler.match(/\b[A-Z][a-zá-ú]+(?:\s+[A-Z][a-zá-ú]+)*\b/g) || [];
  
  const elements = {
    protagonist: uppercaseWords[0] || 'El protagonista',
    antagonist: uppercaseWords[1] || null,
    ally: uppercaseWords[2] || 'Un aliado',
    location: null,
    stakes: 'todo lo importante',
    consequence: 'cambios irreversibles',
    challenge: 'el desafío principal',
    revelation: 'una sorpresa',
    truePurpose: 'diferente a lo esperado',
    wasActually: 'no lo que parecía',
    ofWhat: 'de esta historia'
  };
  
  // Buscar patrones de ubicaciones
  if (/castillo|fortaleza|torre|reino|tierra|mundo|ciudad|batalla/i.test(spoiler)) {
    elements.location = 'un lugar desconocido';
  }
  if (/muerte|pérdida|sacrificio/i.test(spoiler)) {
    elements.stakes = 'su vida o la de otros';
  }
  if (/secreto|verdad|oculto|descubre/i.test(spoiler)) {
    elements.revelation = 'una verdad oculta';
  }
  
  return elements;
}

/**
 * Genera spoilers falsos genéricos como fallback
 */
function generateGenericFakeSpoiler(bookTitle) {
  const templates = [
    `En ${bookTitle}, el final es completamente diferente a lo que esperabas.`,
    `El personaje que menos sospechabas es el clave en el desenlace de ${bookTitle}.`,
    `${bookTitle} termina con una revelación que cambia todo lo anterior.`,
    `El verdadero conflicto de ${bookTitle} ocurre después de lo que parece ser el final.`,
    `En ${bookTitle}, el sacrificio de alguien no fue en vano, sino parte de un plan mayor.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Genera un spoiler aleatorio (versión antigua - mantener por compatibilidad)
 */

// Fallback para entorno sin fuentes externas
function generateFallbackTrueSpoiler(bookTitle) {
  return `En ${bookTitle}, el guardián revela la verdad oculta que cambia todo lo que creíamos saber.`;
}

function normalizeTokens(text) {
  const tokens = text
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .match(/[a-záéíóúñü]+/gi) || [];
  return tokens.filter(t => t.length >= 3);
}

function isTitleClose(sourceTitle, requestedTitle) {
  const sourceTokens = normalizeTokens(sourceTitle);
  const requestedTokens = normalizeTokens(requestedTitle);
  if (requestedTokens.length === 0) return false;

  const overlap = requestedTokens.filter(t => sourceTokens.includes(t)).length;
  const required = requestedTokens.length >= 2 ? 2 : 1;
  return overlap >= required;
}

function isRelevantSpoilerText(text, bookTitle) {
  const textTokens = normalizeTokens(text);
  const titleTokens = normalizeTokens(bookTitle);
  if (titleTokens.length === 0) return false;

  const overlap = titleTokens.filter(t => textTokens.includes(t)).length;
  return overlap >= Math.max(1, Math.ceil(titleTokens.length * 0.5));
}

async function fetchJSON(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_FETCH_HEADERS,
      signal: controller.signal
    });

    if (!response.ok) {
      console.warn(`[fetchJSON] ${url} -> HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const preview = (await response.text()).slice(0, 180);
      console.warn(`[fetchJSON] ${url} non-JSON (${contentType}). Preview: ${preview}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[fetchJSON] Timeout after ${timeoutMs}ms for ${url}`);
      return null;
    }

    console.error(`[fetchJSON] Error for ${url}:`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mezcla un array aleatoriamente (Fisher-Yates shuffle)
 */
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Obtiene un mensaje de negación narrativo de Azkaban
 */
function getAzkabanDenialMessage() {
  const messages = [
    "No me está permitido decirte cuál de estos finales es el auténtico.",
    "Entre estos muros, solo uno ocurrió realmente; los otros son sombras nacidas de mi imaginación.",
    "Uno de estos destinos guarda la verdad, los demás son meras ilusiones.",
    "En Azkaban, los secretos no se liberan: se sobreviven, y solo uno de ellos puede considerarse real.",
    "Las sombras me impiden revelarte cuál de estos relatos es verdadero. Solo uno porta la marca de la realidad.",
    "He tejido mentiras entre la verdad. Tu tarea es discernir cuál es el hilo genuino.",
    "Los guardianes de este lugar me han maldito: puedo mostrar el final, pero nunca señalarlo con certeza."
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Obtiene un icono SVG para errores de spoiler
 */
function getAzkabanDenialIcon() {
  return '🌀'; // Este será reemplazado por SVG en el frontend
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
    generateSpoiler,
    fetchTrueSpoiler,
    generateFakeSpoiler,
    getAzkabanDenialMessage,
    generateFallbackTrueSpoiler
  };
}

// Para uso en el navegador
if (typeof window !== 'undefined') {
  window.AzkabanAI = {
    getLumosResponse,
    detectIntent,
    getRandomInitialMessage,
    generateSpoiler,
    fetchTrueSpoiler,
    generateFakeSpoiler,
    getAzkabanDenialMessage,
    generateFallbackTrueSpoiler
  };
}
