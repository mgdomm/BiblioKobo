const fs = require('fs');

const books = JSON.parse(fs.readFileSync('books.json', 'utf8'));

// Mapeo de IDs a URLs de portadas encontradas manualmente
const manualCovers = {
  // Choque de reyes Ed. ilustrada
  '1413NYJCLGdqwLaOXtmrtaOX_wW_bK1z5': 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1358399126i/17288631.jpg',
  
  // El caballero de los Siete Reinos
  '13gQL-ImJngxNhIVshtHFjyY2HgnZ8Zt-': 'https://books.google.es/books/publisher/content/images/frontcover/igB2BgAAQBAJ?fife=w400-h600',
  
  // Hija de las Tinieblas
  '10PzA44OY4Ji_Pdsz91Pvs9HnIbmy-bOI': 'https://www.machadolibros.com/media/products/images/544612_medium.jpeg',
  
  // Los hijos del rey (Serpent & Dove #2)
  '10s2ntlDvX1Kmdk18PKxX_F9_BgSLMncT': 'https://books.google.es/books/publisher/content/images/frontcover/XZbQEAAAQBAJ?fife=w400-h600',
  
  // La búsqueda del asesino
  '13A57JQney9wAY6SUVsnzaIGMeqt42fLP': 'https://books.google.es/books/publisher/content/images/frontcover/jfRnEQAAQBAJ?fife=w400-h600',
  
  // Aprendiz de asesino
  '136p41oyXcBPDjEK7RnOeWyf1a0Y7D7ma': 'https://books.google.es/books/publisher/content/images/frontcover/RfRnEQAAQBAJ?fife=w400-h600',
  
  // El despertar de los héroes (La Rueda del Tiempo)
  '12r2o6Ai413FbelvtzAZXoRPb-frQL0wy': 'https://www.planetadelibros.com/usuaris/libros/fotos/364/m_libros/portada_el-gran-viaje-2-el-despertar-de-los-heroes-la-rueda-del-tiempo-2_robert-jordan_202301101032.jpg',
  
  // La espada del destino
  '14P2Kh10FlEury8FoXYmBlim63R70XNBD': 'https://www.jaimes.cat/41148/la-espada-del-destino.jpg',
  
  // El último deseo
  '14MOl0m9QBnKn5gnfP40Hg3b-ETdhxhPG': 'https://tercerafundacion.net/biblioteca/portadas/3208.jpg',
  
  // Estación de tormentas
  '14KwG31anHnbi8QrcG9Y9sZFhls2p_GuQ': 'https://tercerafundacion.net/biblioteca/portadas/50715.jpg',
  
  // Ruina y ascenso
  '15Hd9JZfLUc-uJmjRBYyEIm-g0d2r5qWz': 'https://laestanteriadelcaos.com/wp-content/uploads/2021/07/ruina-y-ascenso.jpg',
  
  // Harry Potter y El Legado Maldito
  '15ZLWCdy-UC3pXfVaocH_jMpfJepvhs4-': 'https://books.google.es/books/publisher/content/images/frontcover/B72rDAEACAAJ?fife=w400-h600',
  
  // Caged in Shadow
  '16ieJ2W9syhma1saoD3rGsM0vNqbD7W2Y': 'https://m.media-amazon.com/images/I/51N8xqPqBNL._SY445_SX342_.jpg',
  
  // Hogwarts una guía incompleta y poco fiable
  '174cz1_jyYGpzo3lY1zKp2c9sw-KwyyLJ': 'https://ww3.lectulandia.co/app/uploads/2017/01/Hogwarts-una-guia-incompleta-y-poco-fiable-de-J.-K.-Rowling.jpg',
  
  // Harry Potter y Las Reliquias de la Muerte
  '173flml08xrCPX96MIiRrebXWp_-_LzyF': 'https://books.google.es/books/publisher/content/images/frontcover/dHRnzQEACAAJ?fife=w400-h600',
  
  // Harry Potter y El Misterio del Príncipe
  '172Pvwfr-EpP5bft1Xzu88rGlmNG1HgXQ': 'https://books.google.es/books/publisher/content/images/frontcover/olaREAAAQBAJ?fife=w400-h600',
  
  // Harry Potter y La Cámara Secreta
  '178KsreY7HOVuk4-V5F6FWrR6XiSM_v1Z': 'https://books.google.es/books/publisher/content/images/frontcover/nlaREAAAQBAJ?fife=w400-h600',
  
  // Harry Potter y La Piedra Filosofal
  '177yZ-7z7SRIYZZv9PjomnIJhqiBeKA-H': 'https://books.google.es/books/publisher/content/images/frontcover/56cZPAAACAAJ?fife=w400-h600',
  
  // Fulgor
  '189irWkWBrho6CN2Cf415yrNgKJfm0lth': 'https://imagessl8.casadellibro.com/a/l/s7/28/9788408258728.webp',
  
  // El verano en que me enamoré
  '1-d3beHqyHK0ulScANojC3Y8MXwbneq9r': 'https://books.google.es/books/publisher/content/images/frontcover/CQg0bh6rhxcC?fife=w400-h600',
  
  // El mago de Oz
  '1-DUWQXet4dTAeOXs18rRS8F2_VFrPMpp': 'https://books.google.es/books/publisher/content/images/frontcover/xZr10AEACAAJ?fife=w400-h600',
  
  // Imperio de Fuego Azul
  '105tUf2NhX_ZFvWPBiukp-nASyrWmoINw': 'https://books.google.es/books/publisher/content/images/frontcover/Y9FUEQAAQBAJ?fife=w400-h600',
  
  // Trono de Cristal
  '15gDsNm-az8Z1JW9uEYbDRUGdIir4HzMG': 'https://books.google.es/books/publisher/content/images/frontcover/vXRuEAAAQBAJ?fife=w400-h600',
  
  // Reckless
  '187FBB6vuJZxNOfVcz6andHxBoA2AWHxi': 'https://books.google.es/books/publisher/content/images/frontcover/e8EDEQAAQBAJ?fife=w400-h600'
};

let updated = 0;

books.forEach(book => {
  if (manualCovers[book.id]) {
    book.coverUrl = manualCovers[book.id];
    updated++;
    console.log(`✅ ${book.title} - ${book.author}`);
  }
});

fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
console.log(`\n✅ Actualizado: ${updated} libros con portadas manuales`);
