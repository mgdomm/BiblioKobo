#!/bin/bash

# 🪄 Scripts útiles para administrar LUMOS

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🪄 LUMOS - Scripts de Administración"
echo ""

# Función para mostrar menú
show_menu() {
    echo "Selecciona una opción:"
    echo "1) Iniciar servidor"
    echo "2) Ver solicitudes pendientes"
    echo "3) Ver estadísticas"
    echo "4) Backup de datos"
    echo "5) Probar envío de email"
    echo "6) Limpiar datos de prueba"
    echo "7) Ver logs del servidor"
    echo "8) Verificar instalación"
    echo "9) Salir"
    echo ""
    read -p "Opción: " option
}

# Función para iniciar servidor
start_server() {
    echo -e "${GREEN}Iniciando servidor...${NC}"
    npm start
}

# Función para ver solicitudes pendientes
view_pending_requests() {
    echo -e "${YELLOW}Solicitudes pendientes:${NC}"
    curl -s http://localhost:3000/api/requests/pending | jq '.'
}

# Función para ver estadísticas
view_stats() {
    echo -e "${YELLOW}Estadísticas del sistema:${NC}"
    curl -s http://localhost:3000/api/admin/stats | jq '.'
}

# Función para backup
backup_data() {
    BACKUP_DIR="./backups/$(date +%Y-%m-%d_%H-%M-%S)"
    echo -e "${GREEN}Creando backup en $BACKUP_DIR${NC}"
    mkdir -p $BACKUP_DIR
    cp data/requests.json $BACKUP_DIR/
    cp data/notifications.json $BACKUP_DIR/
    cp books.json $BACKUP_DIR/
    echo -e "${GREEN}✅ Backup completado${NC}"
    ls -lh $BACKUP_DIR
}

# Función para probar email
test_email() {
    read -p "Email de prueba: " email
    echo -e "${YELLOW}Enviando email de prueba a $email...${NC}"
    
    cat > /tmp/test-email.js << EOF
require('dotenv').config();
const emailService = require('./services/emailService');

async function test() {
  try {
    await emailService.sendBookCapturedEmail(
      '$email',
      'Libro de Prueba - LUMOS',
      'Autor de Prueba',
      'http://localhost:3000/libros'
    );
    console.log('✅ Email enviado correctamente');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
EOF
    
    node /tmp/test-email.js
    rm /tmp/test-email.js
}

# Función para limpiar datos de prueba
clean_test_data() {
    echo -e "${RED}⚠️  ADVERTENCIA: Esto eliminará todos los datos de prueba${NC}"
    read -p "¿Estás seguro? (yes/no): " confirm
    
    if [ "$confirm" == "yes" ]; then
        echo "[]" > data/requests.json
        echo "[]" > data/notifications.json
        echo -e "${GREEN}✅ Datos de prueba eliminados${NC}"
    else
        echo "Operación cancelada"
    fi
}

# Función para ver logs
view_logs() {
    if [ -f server.log ]; then
        echo -e "${YELLOW}Últimas 50 líneas del log:${NC}"
        tail -n 50 server.log
    else
        echo -e "${RED}No se encontró archivo de log${NC}"
    fi
}

# Función para verificar instalación
verify_installation() {
    echo -e "${YELLOW}Verificando instalación...${NC}"
    node test-lumos.js
}

# Menú principal
while true; do
    echo ""
    show_menu
    
    case $option in
        1) start_server ;;
        2) view_pending_requests ;;
        3) view_stats ;;
        4) backup_data ;;
        5) test_email ;;
        6) clean_test_data ;;
        7) view_logs ;;
        8) verify_installation ;;
        9) 
            echo "👋 ¡Hasta pronto!"
            exit 0
            ;;
        *)
            echo -e "${RED}Opción inválida${NC}"
            ;;
    esac
    
    echo ""
    read -p "Presiona Enter para continuar..."
done
