(function () {
  'use strict';

  var eye = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var eyeOff = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a14.5 14.5 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M10 10a3 3 0 0 0 4 4"/></svg>';

  function enhance(input) {
    if (input.dataset.visibilityReady) return;
    input.dataset.visibilityReady = 'true';

    var wrapper = document.createElement('span');
    wrapper.className = 'password-visibility';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'password-visibility-button';
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Show password';
    button.innerHTML = eye;
    button.addEventListener('click', function () {
      var visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
      button.setAttribute('aria-pressed', String(visible));
      button.title = visible ? 'Hide password' : 'Show password';
      button.innerHTML = visible ? eyeOff : eye;
      input.focus({ preventScroll: true });
    });
    wrapper.appendChild(button);
  }

  function scan(root) {
    if (root.matches && root.matches('input[type="password"]')) enhance(root);
    if (root.querySelectorAll) root.querySelectorAll('input[type="password"]').forEach(enhance);
  }

  scan(document);
  new MutationObserver(function (changes) {
    changes.forEach(function (change) {
      change.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
