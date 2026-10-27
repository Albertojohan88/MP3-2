'use strict';
const audio = document.getElementById('reproductor');
const status = document.getElementById('player-status');
document.querySelectorAll('button.track').forEach(button => {
  button.addEventListener('click', async () => {
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
audio.addEventListener('error', () => { status.textContent = 'El audio no está disponible. Comprueba que Musica/Para.mp3 esté publicado junto con la página.'; });
const form = document.getElementById('guest-form');
const messages = document.getElementById('messages');
let entries = [];
try {
  const saved = JSON.parse(localStorage.getItem('johan-music-messages') || '[]');
  if (Array.isArray(saved)) entries = saved.filter(e => e && typeof e.name === 'string' && typeof e.comment === 'string').slice(0, 20);
} catch { /* Storage may be unavailable in private browsers. */ }
function renderMessages() {
  messages.replaceChildren();
  entries.forEach(entry => {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    const comment = document.createElement('p');
    name.textContent = entry.name;
    comment.textContent = entry.comment;
    li.append(name, comment);
    messages.append(li);
  });
}
renderMessages();
form.addEventListener('submit', event => {
  event.preventDefault();
  const name = form.elements.name.value.trim();
  const comment = form.elements.comment.value.trim();
  if (!name || !comment) { document.getElementById('form-status').textContent = 'Escribe tu nombre y una recomendación.'; return; }
  const updated = [{ name, comment }, ...entries].slice(0, 20);
  try {
    localStorage.setItem('johan-music-messages', JSON.stringify(updated));
    entries = updated;
    renderMessages();
    form.reset();
    document.getElementById('form-status').textContent = 'Mensaje guardado en este navegador. ¡Gracias!';
  } catch { document.getElementById('form-status').textContent = 'Este navegador no permite guardar mensajes. Revisa sus permisos de almacenamiento.'; }
});
