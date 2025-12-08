const { google } = require('googleapis');
const fs = require('fs');

async function syncJsonWithDrive() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'service-account.json',
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  const drive = google.drive({ version: 'v3', auth });
  const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
  
  // Obtener IDs de Drive
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1000
  });
  
  const driveIds = new Set(res.data.files.map(f => f.id));
  const books = JSON.parse(fs.readFileSync('books.json', 'utf8'));
  
  // Encontrar libros en JSON que no están en Drive
  const booksNotInDrive = books.filter(b => !driveIds.has(b.id));
  
  console.log(`📊 Libros en JSON: ${books.length}`);
  console.log(`📊 Archivos en Drive: ${res.data.files.length}`);
  console.log(`📋 Libros en JSON que NO están en Drive: ${booksNotInDrive.length}\n`);
  
  if (booksNotInDrive.length > 0) {
    booksNotInDrive.forEach(b => console.log(`  - ${b.title} por ${b.author} (ID: ${b.id})`));
    
    const cleanedBooks = books.filter(b => driveIds.has(b.id));
    fs.writeFileSync('books.json', JSON.stringify(cleanedBooks, null, 2));
    console.log(`\n✅ JSON actualizado: ${books.length} → ${cleanedBooks.length} libros`);
  } else {
    console.log('✅ Todos los libros del JSON están en Drive');
  }
}

syncJsonWithDrive().catch(console.error);
