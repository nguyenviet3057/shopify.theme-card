document.addEventListener('DOMContentLoaded', function () {
  var MAX_CHARS = 9;
  var BREAKPOINT = 749; // px

  var headings = document.querySelectorAll('.product-card__content h3, .trending__card-title');
  console.log('[truncate] headings found:', headings.length, headings);

  function truncateHeadings() {
    var isSmallScreen = window.innerWidth <= BREAKPOINT;
    console.log('[truncate] window.innerWidth:', window.innerWidth, '| isSmallScreen:', isSmallScreen);

    headings.forEach(function (heading, index) {
      console.log('[truncate] --- heading #' + index + ' ---');
      console.log('[truncate] element:', heading);
      console.log('[truncate] current textContent:', JSON.stringify(heading.textContent));
      console.log('[truncate] existing data-full-text:', heading.dataset.fullText);

      if (!heading.dataset.fullText) {
        heading.dataset.fullText = heading.textContent.trim();
        console.log('[truncate] saved new fullText:', heading.dataset.fullText);
      }

      var fullText = heading.dataset.fullText;
      console.log('[truncate] fullText:', fullText, '| length:', fullText.length);

      if (isSmallScreen && fullText.length > MAX_CHARS) {
        var sliced = fullText.slice(0, MAX_CHARS) + '...';
        heading.textContent = sliced;
        console.log('[truncate] TRUNCATED to:', sliced);
      } else {
        heading.textContent = fullText;
        console.log('[truncate] RESTORED full text (not small screen or short enough)');
      }
    });
  }

  truncateHeadings();

  var resizeTimer;
  window.addEventListener('resize', function () {
    console.log('[truncate] resize event fired');
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(truncateHeadings, 150);
  });
});
