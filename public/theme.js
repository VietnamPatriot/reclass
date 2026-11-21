try {
  document.documentElement.dataset.theme = localStorage.getItem('reclass-theme') === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}
