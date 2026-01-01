#!/bin/bash

###############################################################################
# Ejemplos de uso de Azkaban Brain
# Demostraciones prácticas de las capacidades del sistema
###############################################################################

echo "🔮 AZKABAN BRAIN - Ejemplos de Uso"
echo "=================================="
echo ""

BASE_URL="http://localhost:3000"

# Colores
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Función para hacer requests
ask() {
  local query="$1"
  echo -e "${CYAN}📝 Pregunta:${NC} $query"
  echo ""
  
  curl -s -X POST "$BASE_URL/api/azkaban/ask" \
    -H 'Content-Type: application/json' \
    -d "{\"query\":\"$query\"}" | \
    python3 -m json.tool
  
  echo ""
  echo "---"
  echo ""
}

# Verificar que el servidor esté corriendo
echo "🔍 Verificando servidor..."
if ! curl -s "$BASE_URL/api/azkaban/status" > /dev/null 2>&1; then
  echo "❌ Error: Servidor no está corriendo"
  echo "   Ejecuta: npm start"
  exit 1
fi
echo -e "${GREEN}✅ Servidor activo${NC}"
echo ""
echo "=================================="
echo ""

# ========== EJEMPLO 1: Pregunta simple ==========
echo "🎯 EJEMPLO 1: Pregunta Simple"
echo "=================================="
ask "¿Quién eres?"

sleep 2

# ========== EJEMPLO 2: Búsqueda de libro ==========
echo "🎯 EJEMPLO 2: Búsqueda de Libro"
echo "=================================="
ask "¿Tienes información sobre El Señor de los Anillos?"

sleep 2

# ========== EJEMPLO 3: Recomendación ==========
echo "🎯 EJEMPLO 3: Recomendación por Tema"
echo "=================================="
ask "Recomiéndame libros de fantasía con dragones"

sleep 2

# ========== EJEMPLO 4: Autor específico ==========
echo "🎯 EJEMPLO 4: Consulta sobre Autor"
echo "=================================="
ask "¿Qué libros tienes de J.K. Rowling?"

sleep 2

# ========== EJEMPLO 5: Género literario ==========
echo "🎯 EJEMPLO 5: Búsqueda por Género"
echo "=================================="
ask "Dame opciones de ciencia ficción"

sleep 2

# ========== EJEMPLO 6: Comparación ==========
echo "🎯 EJEMPLO 6: Comparación de Libros"
echo "=================================="
ask "¿Cuál es la diferencia entre El Hobbit y El Señor de los Anillos?"

sleep 2

# ========== EJEMPLO 7: Resumen (endpoint dedicado) ==========
echo "🎯 EJEMPLO 7: Resumen de Libro"
echo "=================================="
echo -e "${CYAN}📝 Solicitud:${NC} Resumen de '1984'"
echo ""

curl -s -X POST "$BASE_URL/api/azkaban/summarize" \
  -H 'Content-Type: application/json' \
  -d '{"bookTitle":"1984"}' | \
  python3 -m json.tool

echo ""
echo "---"
echo ""

sleep 2

# ========== EJEMPLO 8: Estado del sistema ==========
echo "🎯 EJEMPLO 8: Estado del Sistema"
echo "=================================="
echo -e "${CYAN}📝 Solicitud:${NC} GET /api/azkaban/status"
echo ""

curl -s "$BASE_URL/api/azkaban/status" | python3 -m json.tool

echo ""
echo "---"
echo ""

# ========== RESUMEN ==========
echo "=================================="
echo -e "${GREEN}✅ Ejemplos completados${NC}"
echo "=================================="
echo ""
echo "🔧 Otros comandos útiles:"
echo ""
echo "  # Indexar biblioteca"
echo "  curl -X POST $BASE_URL/api/azkaban/index"
echo ""
echo "  # Ver logs en vivo"
echo "  npm start | tee azkaban.log"
echo ""
echo "  # Interfaz web"
echo "  open http://localhost:3000/test-azkaban.html"
echo ""
echo "🎉 ¡Explora el sistema!"
