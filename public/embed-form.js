/*
  Talco Form Builder Embed
  Usage:
    <div id="talco-form" data-form="YOUR_FORM_SLUG"></div>
    <script src="https://ms.talco.id/embed-form.js" async></script>

  This script injects an iframe pointing to https://ms.talco.id/f/{slug}
*/
(function () {
  var FORM_SELECTOR = '#talco-form,[data-form]';
  var BASE_URL = 'https://ms.talco.id/f/';

  function createIframe(slug) {
    var iframe = document.createElement('iframe');
    iframe.src = BASE_URL + encodeURIComponent(slug);
    iframe.width = '100%';
    iframe.height = '800';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('loading', 'lazy');
    iframe.style.border = 'none';
    iframe.style.minHeight = '600px';
    return iframe;
  }

  function mount(container) {
    if (!container || container.__talcoFormMounted) return;
    var slug = container.getAttribute('data-form');
    if (!slug) return;

    container.__talcoFormMounted = true;
    container.innerHTML = '';
    container.appendChild(createIframe(slug));
  }

  function init() {
    var nodes = document.querySelectorAll(FORM_SELECTOR);
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
