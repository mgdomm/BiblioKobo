#!/bin/bash

###############################################################################
# Validador de instalación de Azkaban Brain
# Verifica que todo esté correctamente instalado
###############################################################################

echo "🔍 Validando instalación de Azkaban Brain..."
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ERRORS=0
WARNINGS=0

# Función para verificar
check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $1${NC}"
  else
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
  fi
}

check_warn() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $1${NC}"
  else
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
  fi
}

# ========== 1. Arquitectura ==========
echo "📋 Verificando sistema..."
ARCH=$(uname -m)
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
  echo -e "${GREEN}✅ Arquitectura ARM64: $ARCH${NC}"
else
  echo -e "${YELLOW}⚠️  Arquitectura no ARM: $ARCH${NC}"
  echo "   (Esto podría funcionar igualmente)"
  ((WARNINGS++))
fi

# ========== 2. Dependencias del sistema ==========
echo ""
echo "📦 Verificando dependencias..."

command -v git &> /dev/null
check "Git instalado"

command -v cmake &> /dev/null
check "CMake instalado"

command -v make &> /dev/null
check "Make instalado"

command -v node &> /dev/null
check "Node.js instalado"

if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo "   → Versión Node.js: $NODE_VERSION"
fi

# ========== 3. Archivos principales ==========
echo ""
echo "📁 Verificando archivos..."

[ -f "$BASE_DIR/server.js" ]
check "server.js existe"

[ -f "$BASE_DIR/package.json" ]
check "package.json existe"

[ -d "$BASE_DIR/services" ]
check "Carpeta services/ existe"

[ -f "$BASE_DIR/services/azkabanBrain.js" ]
check "azkabanBrain.js existe"

[ -f "$BASE_DIR/services/ragService.js" ]
check "ragService.js existe"

[ -f "$BASE_DIR/services/embeddingService.js" ]
check "embeddingService.js existe"

# ========== 4. llama.cpp ==========
echo ""
echo "🔧 Verificando llama.cpp..."

if [ -d "$BASE_DIR/llama.cpp" ]; then
  echo -e "${GREEN}✅ Directorio llama.cpp existe${NC}"
  
  if [ -f "$BASE_DIR/llama.cpp/build/bin/main" ]; then
    echo -e "${GREEN}✅ Binario llama.cpp compilado${NC}"
    SIZE=$(ls -lh "$BASE_DIR/llama.cpp/build/bin/main" | awk '{print $5}')
    echo "   → Tamaño: $SIZE"
  else
    echo -e "${RED}❌ Binario llama.cpp NO encontrado${NC}"
    echo "   Ejecuta: ./setup-azkaban-arm.sh"
    ((ERRORS++))
  fi
else
  echo -e "${RED}❌ Directorio llama.cpp NO existe${NC}"
  echo "   Ejecuta: ./setup-azkaban-arm.sh"
  ((ERRORS++))
fi

# ========== 5. Modelo TinyLlama ==========
echo ""
echo "🧠 Verificando modelo TinyLlama..."

if [ -d "$BASE_DIR/models" ]; then
  echo -e "${GREEN}✅ Directorio models/ existe${NC}"
  
  MODEL_FILE="$BASE_DIR/models/tinyllama-7b.gguf"
  if [ -f "$MODEL_FILE" ]; then
    echo -e "${GREEN}✅ Modelo TinyLlama descargado${NC}"
    SIZE=$(ls -lh "$MODEL_FILE" | awk '{print $5}')
    echo "   → Tamaño: $SIZE"
    
    # Verificar que no esté corrupto (debe ser >100 MB)
    SIZE_BYTES=$(stat -f%z "$MODEL_FILE" 2>/dev/null || stat -c%s "$MODEL_FILE" 2>/dev/null)
    if [ "$SIZE_BYTES" -lt 100000000 ]; then
      echo -e "${YELLOW}⚠️  El modelo parece pequeño, podría estar corrupto${NC}"
      ((WARNINGS++))
    fi
  else
    echo -e "${RED}❌ Modelo TinyLlama NO encontrado${NC}"
    echo "   Ejecuta: ./setup-azkaban-arm.sh"
    ((ERRORS++))
  fi
else
  echo -e "${RED}❌ Directorio models/ NO existe${NC}"
  ((ERRORS++))
fi

# ========== 6. Datos ==========
echo ""
echo "🗂️  Verificando datos..."

[ -d "$BASE_DIR/data" ]
check "Directorio data/ existe"

if [ -f "$BASE_DIR/data/book-chunks.json" ]; then
  echo -e "${GREEN}✅ book-chunks.json existe${NC}"
  
  # Verificar que sea JSON válido
  if node -e "JSON.parse(require('fs').readFileSync('$BASE_DIR/data/book-chunks.json'))" 2>/dev/null; then
    echo -e "${GREEN}   → JSON válido${NC}"
  else
    echo -e "${RED}   → JSON inválido${NC}"
    ((ERRORS++))
  fi
else
  echo -e "${YELLOW}⚠️  book-chunks.json NO existe (se creará automáticamente)${NC}"
  ((WARNINGS++))
fi

# ========== 7. Node modules ==========
echo ""
echo "📦 Verificando dependencias Node.js..."

if [ -d "$BASE_DIR/node_modules" ]; then
  echo -e "${GREEN}✅ node_modules instalado${NC}"
  
  # Verificar dependencias críticas
  [ -d "$BASE_DIR/node_modules/express" ]
  check_warn "express instalado"
  
  [ -d "$BASE_DIR/node_modules/@tensorflow/tfjs-node" ]
  check_warn "@tensorflow/tfjs-node instalado"
  
  [ -d "$BASE_DIR/node_modules/axios" ]
  check_warn "axios instalado"
else
  echo -e "${YELLOW}⚠️  node_modules NO instalado${NC}"
  echo "   Ejecuta: npm install"
  ((WARNINGS++))
fi

# ========== 8. Scripts ejecutables ==========
echo ""
echo "🔨 Verificando scripts..."

[ -x "$BASE_DIR/setup-azkaban-arm.sh" ]
check_warn "setup-azkaban-arm.sh es ejecutable"

[ -x "$BASE_DIR/test-azkaban.sh" ]
check_warn "test-azkaban.sh es ejecutable"

# ========== 9. RAM disponible ==========
echo ""
echo "💾 Verificando recursos del sistema..."

if command -v free &> /dev/null; then
  RAM_FREE=$(free -m | awk '/^Mem:/{print $7}')
  echo "   → RAM libre: ${RAM_FREE} MB"
  
  if [ "$RAM_FREE" -lt 1000 ]; then
    echo -e "${YELLOW}⚠️  Poca RAM disponible (<1 GB)${NC}"
    echo "   Considera cerrar aplicaciones"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✅ RAM suficiente${NC}"
  fi
fi

# ========== 10. Puerto 3000 ==========
echo ""
echo "🌐 Verificando puerto..."

if command -v netstat &> /dev/null; then
  if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    echo -e "${YELLOW}⚠️  Puerto 3000 ya está en uso${NC}"
    echo "   Podrías necesitar usar otro puerto"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✅ Puerto 3000 disponible${NC}"
  fi
elif command -v lsof &> /dev/null; then
  if lsof -i :3000 &> /dev/null; then
    echo -e "${YELLOW}⚠️  Puerto 3000 ya está en uso${NC}"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✅ Puerto 3000 disponible${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  No se pudo verificar el puerto${NC}"
  ((WARNINGS++))
fi

# ========== Resumen ==========
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}🎉 INSTALACIÓN PERFECTA${NC}"
  echo "   Todo está listo para iniciar"
  echo ""
  echo "Próximo paso:"
  echo "   npm start"
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  INSTALACIÓN CON ADVERTENCIAS${NC}"
  echo "   Errores: $ERRORS | Advertencias: $WARNINGS"
  echo ""
  echo "Puedes proceder, pero revisa las advertencias arriba"
else
  echo -e "${RED}❌ INSTALACIÓN INCOMPLETA${NC}"
  echo "   Errores: $ERRORS | Advertencias: $WARNINGS"
  echo ""
  echo "Ejecuta primero:"
  echo "   ./setup-azkaban-arm.sh"
fi
echo "=========================================="
echo ""

exit $ERRORS
