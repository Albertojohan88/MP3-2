'use strict';
const audio = document.getElementById('reproductor');
const status = document.getElementById('player-status');
document.querySelectorAll('button.track').forEach(button => {
  button.addEventListener('click', async () => {
    document.querySelectorAll('button.track').forEach(track => {
      const selected = track === button;
      track.classList.toggle('active', selected);
      track.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('track-title').textContent = button.dataset.title;
    document.getElementById('track-artist').textContent = button.dataset.artist;
    if (audio.getAttribute('src') !== button.dataset.src) {
      audio.src = button.dataset.src;
      audio.load();
    }
    try { await audio.play(); }
    catch { status.textContent = 'No se pudo reproducir. Comprueba que el archivo esté disponible e inténtalo con los controles.'; }
  });
});
audio.addEventListener('playing', () => {
  status.textContent = 'Reproduciendo · Disfruta la música.';
});
audio.addEventListener('pause', () => { status.textContent = 'En pausa. Sigue a tu ritmo.'; });
audio.addEventListener('ended', () => { status.textContent = '¿Otra vez? Pulsa reproducir.'; });
audio.addEventListener('error', () => { status.textContent = 'El audio no está disponible. Comprueba que el archivo de esta canción esté publicado junto con la página.'; });
const form = document.getElementById('guest-form');
const formStatus = document.getElementById('form-status');
const draftKey = 'johan-music-recommendation-draft';
try {
  const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
  if (saved && typeof saved.name === 'string' && typeof saved.comment === 'string') {
    form.elements.name.value = saved.name.slice(0, 80);
    form.elements.comment.value = saved.comment.slice(0, 500);
  }
} catch { /* The form remains usable when storage is unavailable. */ }
form.addEventListener('input', () => { formStatus.textContent = ''; });
form.addEventListener('submit', event => {
  event.preventDefault();
  const name = form.elements.name.value.trim();
  const comment = form.elements.comment.value.trim();
  if (!name || !comment) {
    formStatus.textContent = 'Escribe tu nombre y una recomendación.';
    return;
  }
  try {
    localStorage.setItem(draftKey, JSON.stringify({ name, comment }));
    formStatus.textContent = 'Borrador guardado solo en este navegador. No se ha enviado.';
  } catch {
    formStatus.textContent = 'No se pudo guardar el borrador. Copia tu texto para conservarlo. No se ha enviado.';
  }
});
