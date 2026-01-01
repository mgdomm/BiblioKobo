#!/bin/bash

###############################################################################
# Test rápido de Azkaban Brain en Chromebook ARM
# Prueba la instalación sin iniciar el servidor completo
###############################################################################

echo "🧪 Probando Azkaban Brain..."
echo ""

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLAMA_BIN="$BASE_DIR/llama.cpp/build/bin/main"
MODEL_PATH="$BASE_DIR/models/tinyllama-7b.gguf"

# Verificar archivos
if [ ! -f "$LLAMA_BIN" ]; then
  echo "❌ Error: No se encontró llama.cpp compilado"
  echo "   Ejecuta: ./setup-azkaban-arm.sh"
  exit 1
fi

if [ ! -f "$MODEL_PATH" ]; then
  echo "❌ Error: No se encontró el modelo TinyLlama"
  echo "   Ejecuta: ./setup-azkaban-arm.sh"
  exit 1
fi

echo "✅ Archivos encontrados"
echo ""

# Test simple
echo "📝 Generando respuesta de prueba..."
echo "   Prompt: 'Hola, soy el guardián de Azkaban'"
echo ""

START=$(date +%s)

"$LLAMA_BIN" \
  -m "$MODEL_PATH" \
  -p "Eres Azkaban, guardián de una biblioteca mágica. Responde en español: ¿Quién eres?" \
  -n 100 \
  -t 8 \
  --temp 0.32 \
  --no-display-prompt

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo ""
echo "⏱️  Tiempo: ${ELAPSED}s"
echo ""

if [ $ELAPSED -lt 120 ]; then
  echo "✅ Rendimiento OK para ARM"
else
  echo "⚠️  Respuesta lenta (>${ELAPSED}s)"
  echo "   Considera reducir tokens o cerrar otras apps"
fi

echo ""
echo "🎉 Test completado"
