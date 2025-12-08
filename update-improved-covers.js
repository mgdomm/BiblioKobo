const fs = require('fs');

const books = JSON.parse(fs.readFileSync('books.json', 'utf8'));

// Actualizar portadas mejoradas
const updatedCovers = {
  // Un destino teñido de sangre (Malediction #1)
  '1FMQ_X0coWT-naS_bx43PNz5vPTWn0YT7': 'https://frikimon.es/wp-content/uploads/2024/11/un-destino-tenido-de-sangre-libro-edicion-especial-limitada.jpg',
  
  // Choque de reyes Ed. ilustrada
  '1413NYJCLGdqwLaOXtmrtaOX_wW_bK1z5': 'https://www.elbazardelibro.com.mx/imagenes/9786073/978607312884.JPG',
  
  // El despertar de los héroes
  '12r2o6Ai413FbelvtzAZXoRPb-frQL0wy': 'https://img-static.ivoox.com/index.php?w=175&url=https://static-1.ivoox.com/audios/3/0/7/7/4681631807703_XXL.jpg&f=webp',
  
  // La espada del destino
  '14P2Kh10FlEury8FoXYmBlim63R70XNBD': 'https://books.google.es/books/publisher/content/images/frontcover/2czaDwAAQBAJ?fife=w400-h600',
  
  // El último deseo
  '14MOl0m9QBnKn5gnfP40Hg3b-ETdhxhPG': 'https://img-static.ivoox.com/index.php?w=175&url=https://static-1.ivoox.com/canales/1/8/7/9/7351463739781_XXL.jpg&f=webp',
  
  // Estación de tormentas
  '14KwG31anHnbi8QrcG9Y9sZFhls2p_GuQ': 'https://books.google.es/books/publisher/content/images/frontcover/n7I0zwEACAAJ?fife=w400-h600',
  
  // Ruina y ascenso
  '15Hd9JZfLUc-uJmjRBYyEIm-g0d2r5qWz': 'https://m.media-amazon.com/images/I/71Ue94rpicL._SY466_.jpg',
  
  // Hogwarts una guía incompleta y poco fiable
  '174cz1_jyYGpzo3lY1zKp2c9sw-KwyyLJ': 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh8NIWt9pRqKM4jVAVbUHVZ6AenDJiuTUVNCetrSSgNm1_tWhuZm98PLHWRjxK4xvELm-cAnTEjQhF3yguzDIb3cZlhj59tk6M-FI-V-Wj87WIutfCYuxqNjdOTyIL0wvh6ar_2zObtJ-E/s659/Hogwarts+03+%2528ESP%2529_001_.jpg',
  
  // Caged in Shadow
  '16ieJ2W9syhma1saoD3rGsM0vNqbD7W2Y': 'https://m.media-amazon.com/images/I/81uk-QncYLL._SL1500_.jpg',
  
  // Fulgor
  '189irWkWBrho6CN2Cf415yrNgKJfm0lth': 'https://proassetspdlcom.cdnstatics2.com/usuaris/libros/thumbs/6a6e232b-25b8-4ffe-a55a-50d0a7a85ca7/d_1200_1200/portada_fulgor-serie-crave-4_tracy-wolff_202201271030.webp'
};

let updated = 0;

books.forEach(book => {
  if (updatedCovers[book.id]) {
    book.coverUrl = updatedCovers[book.id];
    updated++;
    console.log(`✅ ${book.title} - ${book.author}`);
  }
});

fs.writeFileSync('books.json', JSON.stringify(books, null, 2));
console.log(`\n✅ Actualizado: ${updated} portadas mejoradas`);
