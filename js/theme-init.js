(function () {
  'use strict';

  var STORAGE_KEY = 'theme';

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    var normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    var root = document.documentElement;
    var targetIsDark = normalizedTheme === 'dark';
    if (root.getAttribute('data-theme') === normalizedTheme && root.classList.contains('dark') === targetIsDark) {
      if (document.body && document.body.classList.contains('dark-mode') === targetIsDark) {
        return normalizedTheme;
      }
    }
    root.setAttribute('data-theme', normalizedTheme);
    root.classList.toggle('dark', targetIsDark);
    if (document.body) {
      document.body.classList.toggle('dark-mode', targetIsDark);
    }
    return normalizedTheme;
  }

  function applySavedTheme() {
    var savedTheme = null;
    try {
      savedTheme = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    return applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : getSystemTheme());
  }

  function setTheme(theme) {
    var normalizedTheme = theme === 'dark' ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEY, normalizedTheme);
    } catch (e) {}
    return applyTheme(normalizedTheme);
  }

  window.ThemeManager = {
    getCurrentTheme: getCurrentTheme,
    applySavedTheme: applySavedTheme,
    setTheme: setTheme
  };

  applySavedTheme();

  // Trusted Types default policy for DOM-XSS protection
  if (typeof window !== 'undefined' && window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      window.trustedTypes.createPolicy('default', {
        createHTML: function (html) { return html; },
        createScriptURL: function (url) { return url; },
        createScript: function (script) { return script; }
      });
    } catch (e) {}
  }
  // Activate any asynchronous non-blocking stylesheets
  document.addEventListener('DOMContentLoaded', function () {
    var asyncLinks = document.querySelectorAll('link[data-async-css]');
    for (var i = 0; i < asyncLinks.length; i++) {
      if (asyncLinks[i].media !== 'all') {
        asyncLinks[i].media = 'all';
      }
    }
  });

  window.addEventListener('error', function (e) {
    var target = e.target;
    if (target && target.tagName === 'IMG') {
      if (target.classList.contains('site-logo-img')) {
        target.srcset = '';
        target.src = '/images/logo.svg';
      } else if (!target.dataset.fallbackApplied) {
        target.dataset.fallbackApplied = 'true';
        target.src = '/images/product-placeholder.jpg';
      }
    }
  }, true);
})();
