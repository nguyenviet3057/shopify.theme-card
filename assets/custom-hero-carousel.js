document.querySelectorAll('.hero-carousel').forEach(function (root) {
  var track = root.querySelector('.hero-carousel__track');
  var slides = root.querySelectorAll('.hero-carousel__slide');
  var dots = root.querySelectorAll('.hero-carousel__dot');
  var prevBtn = root.querySelector('.hero-carousel__arrow--prev');
  var nextBtn = root.querySelector('.hero-carousel__arrow--next');
  var index = 0;
  var total = slides.length;
  var autoplay = root.dataset.autoplay === 'true';
  var speed = parseInt(root.dataset.speed, 10) || 5000;
  var timer;

  if (total <= 1) return;

  function goTo(i) {
    index = (i + total) % total;
    track.style.transform = 'translateX(-' + (index * 100) + '%)';
    dots.forEach(function (dot, di) {
      dot.classList.toggle('is-active', di === index);
    });
  }

  function play() {
    stop();
    timer = setInterval(function () { goTo(index + 1); }, speed);
  }
  function stop() { clearInterval(timer); }

  prevBtn && prevBtn.addEventListener('click', function () { goTo(index - 1); if (autoplay) play(); });
  nextBtn && nextBtn.addEventListener('click', function () { goTo(index + 1); if (autoplay) play(); });
  dots.forEach(function (dot, di) {
    dot.addEventListener('click', function () { goTo(di); if (autoplay) play(); });
  });

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', function () { if (autoplay) play(); });

  // basic swipe support
  var startX = null;
  track.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 40) { diff < 0 ? goTo(index + 1) : goTo(index - 1); }
    startX = null;
    if (autoplay) play();
  });

  goTo(0);
  if (autoplay) play();
});
