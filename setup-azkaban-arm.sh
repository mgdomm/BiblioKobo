#!/bin/bash

###############################################################################
# AZKABAN BRAIN - Setup para Chromebook ARM (Snapdragon SC7180)
# Este script instala TinyLlama 7B + llama.cpp para arquitectura ARM64
###############################################################################

set -e  # Detener en errores

echo "🔮 =========================================="
echo "🔮  AZKABAN BRAIN - Instalación ARM64"
echo "🔮 =========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar arquitectura
ARCH=$(uname -m)
if [[ "$ARCH" != "aarch64" && "$ARCH" != "arm64" ]]; then
  echo -e "${RED}❌ Error: Este script es para ARM64/aarch64${NC}"
  echo "   Tu arquitectura es: $ARCH"
  exit 1
fi

echo -e "${GREEN}✅ Arquitectura ARM64 detectada: $ARCH${NC}"
echo ""

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$BASE_DIR/models"
LLAMA_DIR="$BASE_DIR/llama.cpp"

echo "📂 Directorio base: $BASE_DIR"
echo ""

# ========== 1. Verificar dependencias ==========
echo "📦 Verificando dependencias del sistema..."

MISSING_DEPS=()

if ! command -v git &> /dev/null; then
  MISSING_DEPS+=("git")
fi

if ! command -v cmake &> /dev/null; then
  MISSING_DEPS+=("cmake")
fi

if ! command -v make &> /dev/null; then
  MISSING_DEPS+=("build-essential")
fi

if ! command -v wget &> /dev/null; then
  MISSING_DEPS+=("wget")
fi

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Faltan dependencias: ${MISSING_DEPS[*]}${NC}"
  echo ""
  echo "Instalando con apt..."
  sudo apt update
  sudo apt install -y ${MISSING_DEPS[@]}
  echo -e "${GREEN}✅ Dependencias instaladas${NC}"
else
  echo -e "${GREEN}✅ Todas las dependencias están instaladas${NC}"
fi
echo ""

# ========== 2. Clonar y compilar llama.cpp ==========
if [ -d "$LLAMA_DIR" ]; then
  echo -e "${YELLOW}⚠️  llama.cpp ya existe, saltando clonación${NC}"
else
  echo "🔧 Clonando llama.cpp..."
  git clone https://github.com/ggerganov/llama.cpp "$LLAMA_DIR"
  echo -e "${GREEN}✅ llama.cpp clonado${NC}"
fi
echo ""

echo "🔨 Compilando llama.cpp para ARM64..."
cd "$LLAMA_DIR"

if [ -d "build" ]; then
  rm -rf build
fi

mkdir -p build
cd build

echo "   → Ejecutando cmake..."
cmake .. -DCMAKE_BUILD_TYPE=Release

echo "   → Compilando con make (esto puede tardar 3-5 minutos)..."
make -j$(nproc)

if [ -f "bin/main" ]; then
  echo -e "${GREEN}✅ llama.cpp compilado exitosamente${NC}"
else
  echo -e "${RED}❌ Error: No se generó el binario 'main'${NC}"
  exit 1
fi

cd "$BASE_DIR"
echo ""

# ========== 3. Descargar TinyLlama 7B ==========
mkdir -p "$MODELS_DIR"

MODEL_FILE="$MODELS_DIR/tinyllama-7b.gguf"

if [ -f "$MODEL_FILE" ]; then
  echo -e "${YELLOW}⚠️  TinyLlama 7B ya descargado, saltando...${NC}"
else
  echo "📥 Descargando TinyLlama 7B GGUF (~3.5 GB)..."
  echo "   ⚠️  Esto puede tardar 10-30 minutos según tu conexión"
  echo ""
  
  # URL de HuggingFace
  MODEL_URL="https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf"
  
  wget -O "$MODEL_FILE" "$MODEL_URL" --progress=bar:force
  
  if [ -f "$MODEL_FILE" ]; then
    echo -e "${GREEN}✅ TinyLlama descargado${NC}"
  else
    echo -e "${RED}❌ Error descargando modelo${NC}"
    exit 1
  fi
fi
echo ""

# ========== 4. Verificar instalación ==========
echo "🧪 Probando TinyLlama..."

LLAMA_BIN="$LLAMA_DIR/build/bin/main"

TEST_OUTPUT=$("$LLAMA_BIN" \
  -m "$MODEL_FILE" \
  -p "Hola, soy Azkaban" \
  -n 20 \
  -t $(nproc) \
  --no-display-prompt 2>&1 || true)

if [[ "$TEST_OUTPUT" == *"error"* ]] || [[ "$TEST_OUTPUT" == *"failed"* ]]; then
  echo -e "${RED}❌ Error ejecutando TinyLlama${NC}"
  echo "$TEST_OUTPUT"
  exit 1
else
  echo -e "${GREEN}✅ TinyLlama funciona correctamente${NC}"
fi
echo ""

# ========== 5. Actualizar configuración en azkabanBrain.js ==========
echo "⚙️  Actualizando rutas en azkabanBrain.js..."

BRAIN_FILE="$BASE_DIR/services/azkabanBrain.js"

if [ -f "$BRAIN_FILE" ]; then
  # Actualizar rutas absolutas
  sed -i "s|TINYLLAMA_BIN:.*|TINYLLAMA_BIN: path.resolve(__dirname, '../llama.cpp/build/bin/main'),|" "$BRAIN_FILE"
  sed -i "s|MODEL_PATH:.*|MODEL_PATH: path.resolve(__dirname, '../models/tinyllama-7b.gguf'),|" "$BRAIN_FILE"
  
  echo -e "${GREEN}✅ Configuración actualizada${NC}"
else
  echo -e "${YELLOW}⚠️  No se encontró azkabanBrain.js${NC}"
fi
echo ""

# ========== 6. Crear archivo de datos vacío ==========
DATA_DIR="$BASE_DIR/data"
mkdir -p "$DATA_DIR"

CHUNKS_FILE="$DATA_DIR/book-chunks.json"
if [ ! -f "$CHUNKS_FILE" ]; then
  echo '{"chunks":[],"books":{}}' > "$CHUNKS_FILE"
  echo -e "${GREEN}✅ Creado book-chunks.json${NC}"
fi
echo ""

# ========== 7. Resumen final ==========
echo -e "${GREEN}=========================================="
echo "🎉  INSTALACIÓN COMPLETADA"
echo "==========================================${NC}"
echo ""
echo "📍 Rutas importantes:"
echo "   • llama.cpp:     $LLAMA_BIN"
echo "   • Modelo:        $MODEL_FILE"
echo "   • Chunks:        $CHUNKS_FILE"
echo ""
echo "🚀 Próximos pasos:"
echo ""
echo "1. Instalar dependencias de Node.js:"
echo "   cd $BASE_DIR"
echo "   npm install"
echo ""
echo "2. Iniciar el servidor:"
echo "   npm start"
echo ""
echo "3. Probar Azkaban Brain:"
echo "   curl -X POST http://localhost:3000/api/azkaban/ask \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"query\":\"¿Quién es Azkaban?\"}'"
echo ""
echo "4. Indexar tu biblioteca:"
echo "   curl -X POST http://localhost:3000/api/azkaban/index"
echo ""
echo -e "${YELLOW}⚠️  Nota: La primera respuesta puede tardar 1-2 minutos${NC}"
echo -e "${YELLOW}   mientras TinyLlama se carga en memoria${NC}"
echo ""
echo "✨ ¡El guardián de Azkaban te espera!"
echo ""
