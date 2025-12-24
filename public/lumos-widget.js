/**
 * LUMOS Widget - Asistente de Azkaban Reads
 * Integración para cualquier página del sitio
 */

(function() {
  'use strict';

  // Verificar si ya está cargado
  if (window.LumosWidget) {
    return;
  }

  // CSS del widget
  const styles = `
    #lumos-trigger {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: transparent;
      border: 2px solid #19E6D6;
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: 0.25s;
      padding: 0;
      color: #19E6D6;
    }

    #lumos-trigger:hover {
      box-shadow: 0 0 15px rgba(25,230,214,0.5);
      transform: scale(1.1);
    }

    #lumos-trigger:hover #lumos-label {
      opacity: 1;
      width: auto;
      max-width: 200px;
      padding: 0 15px;
    }

    #lumos-trigger.hidden {
      display: none;
    }

    #lumos-label {
      position: absolute;
      right: 50px;
      background: transparent;
      color: #19E6D6;
      font-family: 'MedievalSharp', cursive;
      font-size: 24px;
      font-weight: bold;
      letter-spacing: 2px;
      white-space: nowrap;
      opacity: 0;
      width: 0;
      max-width: 0;
      padding: 0;
      overflow: hidden;
      transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      filter: drop-shadow(0 0 10px rgba(25, 230, 214, 0.8));
    }

    #lumos-iframe-container {
      position: fixed;
      bottom: 120px;
      right: 30px;
      width: 420px;
      height: 600px;
      z-index: 10000;
      display: none;
      border-radius: 15px;
      box-shadow: 0 10px 50px rgba(0, 0, 0, 0.8);
      overflow: hidden;
      animation: slideIn 0.3s ease;
    }

    #lumos-iframe-container.active {
      display: block;
    }

    #lumos-iframe-container:not(.active) {
      display: none !important;
    }

    #lumos-iframe {
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 15px;
    }

    #lumos-iframe-container:not(.active) {
      display: none !important;
      visibility: hidden;
      pointer-events: none;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      #lumos-iframe-container {
        width: 100%;
        height: 100%;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }

      #lumos-trigger {
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        font-size: 28px;
      }
    }
  `;

  // Inyectar estilos
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Crear elementos del widget
  const trigger = document.createElement('div');
  trigger.id = 'lumos-trigger';
  trigger.innerHTML = `
    <span id="lumos-label">LUMOS</span>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 4V2"></path>
      <path d="M15 16v-2"></path>
      <path d="M8 9h2"></path>
      <path d="M20 9h2"></path>
      <path d="M17.8 11.8 19 13"></path>
      <path d="M15 9h0"></path>
      <path d="M17.8 6.2 19 5"></path>
      <path d="m3 21 9-9"></path>
      <path d="M12.2 6.2 11 5"></path>
    </svg>
  `;

  const iframeContainer = document.createElement('div');
  iframeContainer.id = 'lumos-iframe-container';

  const iframe = document.createElement('iframe');
  iframe.id = 'lumos-iframe';
  iframe.src = '/lumos.html';
  iframe.title = 'LUMOS - Asistente de Azkaban Reads';

  iframeContainer.appendChild(iframe);

  // Añadir al DOM cuando el documento esté listo
  function initWidget() {
    document.body.appendChild(trigger);
    document.body.appendChild(iframeContainer);

    // Event listeners
    trigger.addEventListener('click', toggleLumos);
  }

  // Toggle LUMOS
  function toggleLumos() {
    const isActive = iframeContainer.classList.contains('active');
    if (isActive) {
      // Cerrando
      iframeContainer.classList.remove('active');
      trigger.classList.remove('hidden');
    } else {
      // Abriendo
      trigger.classList.add('hidden');
      iframeContainer.classList.add('active');
    }
  }

  // Escuchar mensajes del iframe
  window.addEventListener('message', function(event) {
    if (event.data === 'lumos-close') {
      // Forzar cierre desde el padre
      iframeContainer.classList.remove('active');
      trigger.classList.remove('hidden');
    }
  });

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }

  // Exponer API pública
  window.LumosWidget = {
    open: function() {
      if (!iframeContainer.classList.contains('active')) {
        toggleLumos();
      }
    },
    close: function() {
      if (iframeContainer.classList.contains('active')) {
        toggleLumos();
      }
    },
    toggle: toggleLumos
  };

})();
