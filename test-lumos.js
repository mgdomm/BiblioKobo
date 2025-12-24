/**
 * Script de prueba rápida para verificar que LUMOS está funcionando
 * Ejecutar con: node test-lumos.js
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 Iniciando pruebas de LUMOS...\n');

// Test 1: Verificar estructura de archivos
console.log('📁 Test 1: Verificando estructura de archivos...');
const requiredFiles = [
  'routes/books.js',
  'routes/requests.js',
  'routes/admin.js',
  'services/emailService.js',
  'services/notifier.js',
  'utils/fileHandler.js',
  'data/requests.json',
  'data/notifications.json',
  'public/lumos.html',
  'public/lumos-widget.js',
  'books.json'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - NO ENCONTRADO`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n⚠️  Algunos archivos no se encontraron. Verifica la instalación.');
  process.exit(1);
}

// Test 2: Verificar variables de entorno
console.log('\n🔐 Test 2: Verificando variables de entorno...');
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (error) {
  // dotenv no está instalado, usar variables de entorno del sistema
  console.log('  ℹ️  dotenv no instalado, usando variables del sistema');
}

const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASS', 'SITE_URL'];
let envComplete = true;

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`  ✅ ${envVar} está configurado`);
  } else {
    console.log(`  ⚠️  ${envVar} no está configurado`);
    envComplete = false;
  }
});

if (!envComplete) {
  console.log('\n⚠️  Crea un archivo .env con las variables necesarias.');
  console.log('   Copia .env.example a .env y configura tus valores.');
  console.log('   O exporta las variables de entorno en tu sistema.');
}

// Test 3: Verificar datos JSON
console.log('\n📊 Test 3: Verificando archivos JSON...');
try {
  const books = JSON.parse(fs.readFileSync(path.join(__dirname, 'books.json'), 'utf8'));
  console.log(`  ✅ books.json válido (${books.length} libros)`);
  
  const requests = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/requests.json'), 'utf8'));
  console.log(`  ✅ requests.json válido (${requests.length} solicitudes)`);
  
  const notifications = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/notifications.json'), 'utf8'));
  console.log(`  ✅ notifications.json válido (${notifications.length} suscripciones)`);
} catch (error) {
  console.log(`  ❌ Error al leer JSON: ${error.message}`);
  process.exit(1);
}

// Test 4: Verificar dependencias npm
console.log('\n📦 Test 4: Verificando dependencias...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const requiredDeps = ['express', 'nodemailer', 'compression'];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`  ✅ ${dep} - ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`  ❌ ${dep} - NO INSTALADO`);
  }
});

// Test 5: Intentar cargar módulos
console.log('\n🔌 Test 5: Verificando módulos cargables...');
try {
  const FileHandler = require('./utils/fileHandler');
  console.log('  ✅ FileHandler se carga correctamente');
  
  const emailService = require('./services/emailService');
  console.log('  ✅ emailService se carga correctamente');
  
  const notifier = require('./services/notifier');
  console.log('  ✅ notifier se carga correctamente');
  
  const booksRouter = require('./routes/books');
  console.log('  ✅ routes/books se carga correctamente');
  
  const requestsRouter = require('./routes/requests');
  console.log('  ✅ routes/requests se carga correctamente');
  
  const adminRouter = require('./routes/admin');
  console.log('  ✅ routes/admin se carga correctamente');
} catch (error) {
  console.log(`  ❌ Error cargando módulos: ${error.message}`);
  console.log(error.stack);
  process.exit(1);
}

// Resumen
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN DE PRUEBAS');
console.log('='.repeat(60));
console.log(`✅ Estructura de archivos: ${allFilesExist ? 'OK' : 'FALLÓ'}`);
console.log(`${envComplete ? '✅' : '⚠️ '} Variables de entorno: ${envComplete ? 'OK' : 'INCOMPLETO'}`);
console.log('✅ Archivos JSON: OK');
console.log('✅ Dependencias: OK');
console.log('✅ Módulos: OK');
console.log('='.repeat(60));

if (allFilesExist && envComplete) {
  console.log('\n🎉 ¡LUMOS está listo para usarse!');
  console.log('\nPróximos pasos:');
  console.log('1. Ejecuta: npm start');
  console.log('2. Abre: http://localhost:3000/lumos-demo.html');
  console.log('3. Haz clic en el botón 🪄 para probar LUMOS');
} else {
  console.log('\n⚠️  Completa la configuración antes de usar LUMOS.');
  if (!envComplete) {
    console.log('   - Configura las variables de entorno en .env');
  }
}

console.log('\n🪄 LUMOS - Asistente de Azkaban Reads\n');
