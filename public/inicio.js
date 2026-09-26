// Tema, idioma y service worker antes de pintar la página. Es un archivo aparte (no un
// <script> en línea) para que la política de seguridad (CSP) pueda prohibir scripts en línea.
  (function() {
    try {
      var t = localStorage.getItem('origgo_theme') || localStorage.getItem('hunter_theme');
      if (t === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      var l = localStorage.getItem('origgo_lang');
      if (l === 'en') {
        document.documentElement.lang = 'en';
      } else {
        document.documentElement.lang = 'es';
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
          reg.update();
        }).catch(function() {});
      }
    } catch(e) {}
  })();
