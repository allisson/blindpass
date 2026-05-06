(function () {
  var t = localStorage.getItem('bp:theme');
  var dark =
    t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
