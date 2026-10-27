'use strict';
const audio = document.getElementById('reproductor');
const status = document.getElementById('player-status');
document.querySelectorAll('button.track[data-src]').forEach(button => {
  button.addEventListener('click', async () => {
    document.querySelectorAll('button.track').forEach(track => {
      const selected = track === button;
      track.classList.toggle('active', selected);
      track.setAttribute('aria-pressed', String(selected));
    });
    stopYoutube();
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
form.addEventListener('input', () => { formStatus.textContent = ''; });
form.addEventListener('submit', event => {
  const name = form.elements.name.value.trim();
  const comment = form.elements.comment.value.trim();
  if (!name || !comment) {
    event.preventDefault();
    formStatus.textContent = 'Escribe tu nombre y una recomendación.';
    return;
  }
  formStatus.textContent = 'Continuarás en FormSubmit para completar el envío. Si se solicita una verificación, sigue sus instrucciones.';
});

const youtubePlayer = document.getElementById('youtube-player');
const youtubeExternal = document.getElementById('youtube-external');
function stopYoutube() {
  youtubePlayer.replaceChildren();
  youtubePlayer.hidden = true;
  youtubeExternal.hidden = true;
  audio.hidden = false;
}
audio.addEventListener('play', stopYoutube);
function playYoutube(video, selectedButton) {
  audio.pause();
  audio.hidden = true;
  document.querySelectorAll('button.track').forEach(button => {
    const active = button === selectedButton;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('track-title').textContent = video.title;
  document.getElementById('track-artist').textContent = video.artist;
  const frame = document.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/' + video.id + '?autoplay=1&rel=0';
  frame.title = 'YouTube: ' + video.title;
  frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  youtubePlayer.replaceChildren(frame);
  youtubePlayer.hidden = false;
  youtubeExternal.href = 'https://www.youtube.com/watch?v=' + video.id;
  youtubeExternal.hidden = false;
  status.textContent = 'Resultado de YouTube: ' + (video.youtubeTitle || video.title) + '. Si no se reproduce aquí, ábrelo en YouTube.';
}
async function loadYoutubeCatalog() {
  const container = document.getElementById('youtube-catalog');
  try {
    const response = await fetch('videos.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Catalog unavailable');
    const videos = await response.json();
    if (!Array.isArray(videos)) throw new Error('Invalid catalog');
    const valid = videos.filter(v => v && typeof v.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v.id) && typeof v.title === 'string' && typeof v.artist === 'string');
    valid.forEach((video, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'track youtube-track'; button.setAttribute('aria-pressed', 'false');
      const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 7).padStart(2, '0');
      const text = document.createElement('span');
      const title = document.createElement('strong'); title.textContent = video.title;
      const artist = document.createElement('small'); artist.textContent = video.artist;
      text.append(title, artist);
      const action = document.createElement('span'); action.className = 'track-state'; action.textContent = '▶ YouTube';
      button.append(number, text, action);
      button.addEventListener('click', () => playYoutube(video, button));
      container.append(button);
    });
    document.querySelector('.counter').textContent = '06 MP3 · ' + valid.length + ' EN YOUTUBE';
  } catch { container.textContent = 'No se pudo cargar la lista de YouTube. Recarga para intentarlo de nuevo.'; }
  const availability = document.getElementById('search-availability');
  try {
    const response = await fetch('youtube-status.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Status unavailable');
    const state = await response.json();
    availability.textContent = state.searchEnabled === true
      ? 'Búsqueda automática disponible. El resultado aparecerá tras procesarse y publicarse la petición.'
      : 'La búsqueda automática está pendiente de activación. Las peticiones quedarán en GitHub para procesarlas cuando se active.';
  } catch { availability.textContent = 'No se pudo comprobar la búsqueda automática. La petición puede quedar pendiente en GitHub.'; }
}
loadYoutubeCatalog();
const requestForm = document.getElementById('song-request-form');
const requestStatus = document.getElementById('request-status');
const requestLink = document.getElementById('github-request');
requestForm.addEventListener('input', () => { requestLink.hidden = true; requestStatus.textContent = ''; });
requestForm.addEventListener('submit', event => {
  event.preventDefault();
  requestLink.hidden = true;
  const title = requestForm.elements.song.value.trim();
  const artist = requestForm.elements.artist.value.trim();
  if (!title || !artist) { requestStatus.textContent = 'Escribe el nombre de la canción y el artista.'; return; }
  const url = new URL('https://github.com/Albertojohan88/MP3-2/issues/new');
  url.search = new URLSearchParams({
    title: 'Petición musical: ' + title,
    body: '### Canción\n\n' + title + '\n\n### Artista\n\n' + artist
  });
  requestLink.href = url.href;
  requestLink.hidden = false;
  requestStatus.textContent = 'Petición preparada. Continúa en GitHub y pulsa Create para enviarla. No necesitas buscar el enlace de YouTube.';
});
