const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');
const BOOKS_FILE = path.join(__dirname, 'books.json');
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';

const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// Leer books.json
let bookMetadata = [];
try {
  bookMetadata = JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8'));
} catch (err) {
  console.error('Error leyendo books.json:', err.message);
  process.exit(1);
}

// Función para obtener todos los archivos del Drive
async function listAllFiles(folderId) {
  let allFiles = [];
  let pageToken = null;
  
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken: pageToken
    });
    
    const files = response.data.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    allFiles = allFiles.concat(files);
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  return allFiles;
}

// Función para crear clave única
function getBookKey(book) {
  const title = (book.title || '').toLowerCase().trim();
  const author = (book.author || '').toLowerCase().trim();
  const sagaName = (book.saga?.name || '').toLowerCase().trim();
  const sagaNumber = book.saga?.number || 0;
  
  return `${title}|${author}|${sagaName}|${sagaNumber}`;
}

// Función para parsear nombre del archivo
function parseFileName(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  const parts = base.split(' - ');
  const title = (parts[0]?.trim() || filename).toLowerCase();
  const author = (parts[1]?.trim() || '').toLowerCase();
  let sagaName = '';
  let sagaNumber = 0;
  
  if (parts[2]) {
    const sagaMatch = parts[2].match(/^(.*?)(?:\s*#(\d+))?$/);
    if (sagaMatch) {
      sagaName = (sagaMatch[1]?.trim() || '').toLowerCase();
      sagaNumber = sagaMatch[2] ? parseInt(sagaMatch[2], 10) : 0;
    }
  }
  
  return `${title}|${author}|${sagaName}|${sagaNumber}`;
}

// Función para contar campos completos
function countFilledFields(book) {
  let count = 0;
  if (book.coverUrl) count++;
  if (book.description) count++;
  if (book.publisher) count++;
  if (book.publishedDate) count++;
  if (book.pageCount) count++;
  if (book.categories && book.categories.length > 0) count++;
  if (book.language) count++;
  if (book.previewLink) count++;
  return count;
}

async function main() {
  console.log('🔍 Buscando archivos duplicados en Drive...\n');
  
  const files = await listAllFiles(folderId);
  console.log(`📚 Total de archivos en Drive: ${files.length}\n`);
  
  // Agrupar archivos por clave
  const fileGroups = new Map();
  
  files.forEach(file => {
    const key = parseFileName(file.name);
    if (!fileGroups.has(key)) {
      fileGroups.set(key, []);
    }
    fileGroups.get(key).push(file);
  });
  
  // Encontrar duplicados
  const duplicateGroups = Array.from(fileGroups.entries()).filter(([key, group]) => group.length > 1);
  
  if (duplicateGroups.length === 0) {
    console.log('✅ No se encontraron duplicados en Drive.');
    return;
  }
  
  console.log(`⚠️  Se encontraron ${duplicateGroups.length} grupos de duplicados:\n`);
  
  let totalToDelete = 0;
  const filesToDelete = [];
  
  for (const [key, group] of duplicateGroups) {
    const [title] = key.split('|');
    console.log(`📖 "${title}" - ${group.length} copias:`);
    
    // Ordenar por completitud de datos en JSON
    const sortedGroup = group.map(file => {
      const book = bookMetadata.find(b => b.id === file.id);
      const fields = book ? countFilledFields(book) : 0;
      return { file, book, fields };
    }).sort((a, b) => b.fields - a.fields);
    
    // El primero es el que se mantiene
    const toKeep = sortedGroup[0];
    const toDelete = sortedGroup.slice(1);
    
    console.log(`   ✅ Mantener: ${toKeep.file.name} (ID: ${toKeep.file.id}, Campos: ${toKeep.fields})`);
    
    toDelete.forEach(item => {
      console.log(`   ❌ Eliminar: ${item.file.name} (ID: ${item.file.id}, Campos: ${item.fields})`);
      filesToDelete.push(item.file);
      totalToDelete++;
    });
    
    console.log('');
  }
  
  console.log(`\n📊 Resumen:`);
  console.log(`   Total archivos: ${files.length}`);
  console.log(`   Grupos duplicados: ${duplicateGroups.length}`);
  console.log(`   Archivos a eliminar: ${totalToDelete}\n`);
  
  // Confirmar eliminación
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    readline.question('¿Deseas eliminar estos archivos duplicados de Drive? (si/no): ', resolve);
  });
  readline.close();
  
  if (answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 's') {
    console.log('\n❌ Operación cancelada.');
    return;
  }
  
  console.log('\n🗑️  Eliminando archivos duplicados...\n');
  
  for (const file of filesToDelete) {
    try {
      await drive.files.delete({ fileId: file.id });
      console.log(`   ✅ Eliminado: ${file.name} (${file.id})`);
      
      // Eliminar del JSON también
      const index = bookMetadata.findIndex(b => b.id === file.id);
      if (index !== -1) {
        bookMetadata.splice(index, 1);
        console.log(`      Eliminado del JSON también`);
      }
    } catch (err) {
      console.error(`   ❌ Error al eliminar ${file.name}:`, err.message);
    }
  }
  
  // Guardar JSON actualizado
  fs.writeFileSync(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
  console.log(`\n✅ Archivo books.json actualizado`);
  console.log(`\n🎉 Proceso completado. ${totalToDelete} archivos eliminados.`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
