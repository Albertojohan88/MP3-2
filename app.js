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
    document.getElementById('track-title').textContent = button.dataset.title;
    document.getElementById('track-artist').textContent = button.dataset.artist;
    document.getElementById('external-source').hidden = true;
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
audio.addEventListener('error', () => { status.textContent = audio.getAttribute('src')?.startsWith('Musica/') ? 'El archivo MP3 no está disponible.' : 'El audio de Audius no está disponible en este momento. Prueba el enlace de la plataforma.'; });
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


let apiBase = '';
let requestingSong = false;
const requestForm = document.getElementById('song-request-form');
const requestStatus = document.getElementById('request-status');
const availability = document.getElementById('search-availability');
const requestButton = requestForm.querySelector('button');
const requestedCatalog = document.getElementById('requested-catalog');
function renderRequestedTracks(tracks) {
  requestedCatalog.replaceChildren();
  const valid = tracks.filter(track => track && typeof track.title === 'string' && typeof track.artist === 'string'
    && typeof track.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(track.id)
    && track.stream === 'https://discoveryprovider.audius.co/v1/tracks/' + track.id + '/stream?app_name=JohanMusic');
  valid.forEach((track, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'track requested-track'; button.setAttribute('aria-pressed', 'false');
    const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 7).padStart(2, '0');
    const text = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = track.title;
    const artist = document.createElement('small'); artist.textContent = track.artist;
    text.append(title, artist);
    const source = document.createElement('span'); source.className = 'track-state'; source.textContent = '▶ Audius';
    button.append(number, text, source);
    button.addEventListener('click', async () => {
      document.querySelectorAll('button.track').forEach(other => {
        const active = other === button;
        other.classList.toggle('active', active); other.setAttribute('aria-pressed', String(active));
      });
      document.getElementById('track-title').textContent = track.title;
      document.getElementById('track-artist').textContent = track.artist;
      const external = document.getElementById('external-source');
      try {
        const link = new URL(track.url);
        if (link.protocol !== 'https:' || !['audius.co', 'www.audius.co'].includes(link.hostname) || link.username || link.password) throw new Error('Invalid link');
        external.href = link.href; external.hidden = false;
      } catch { external.hidden = true; }
      if (audio.getAttribute('src') !== track.stream) { audio.src = track.stream; audio.load(); }
      try { await audio.play(); }
      catch { status.textContent = 'No se pudo iniciar el audio de Audius. Usa sus controles o abre el enlace de la plataforma.'; }
    });
    requestedCatalog.append(button);
  });
  document.querySelector('.counter').textContent = '06 MP3 · ' + valid.length + ' EN AUDIUS';
}
async function loadSharedTracks() {
  const response = await fetch(apiBase + '/api/tracks', { cache: 'no-store' });
  if (!response.ok) throw new Error('Service unavailable');
  const result = await response.json();
  if (!Array.isArray(result.tracks)) throw new Error('Invalid catalog');
  renderRequestedTracks(result.tracks);
}
async function configureRequests() {
  requestButton.disabled = true;
  try {
    const response = await fetch('site-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Missing config');
    const config = await response.json();
    if (!config.apiBase) {
      availability.textContent = 'El servicio de peticiones está pendiente de activación. Por ahora no se pueden buscar ni añadir canciones.';
      return;
    }
    const url = new URL(config.apiBase);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid config');
    apiBase = url.origin;
    await loadSharedTracks();
    availability.textContent = 'Peticiones disponibles. Busca una canción para añadirla al listado de todos.';
    requestButton.disabled = false;
  } catch {
    availability.textContent = 'El servicio de peticiones no está disponible. Vuelve a intentarlo recargando la página.';
  }
}
requestForm.addEventListener('input', () => { requestStatus.textContent = ''; });
requestForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!apiBase || requestButton.disabled || requestingSong) {
    requestStatus.textContent = 'El servicio aún no está disponible. No se ha enviado ninguna petición.'; return;
  }
  const title = requestForm.elements.song.value.trim();
  const artist = requestForm.elements.artist.value.trim();
  if (!title || !artist) { requestStatus.textContent = 'Escribe el nombre de la canción y el artista.'; return; }
  requestingSong = true; requestButton.disabled = true;
  requestStatus.textContent = 'Buscando la canción y el artista en Audius…';
  try {
    const response = await fetch(apiBase + '/api/requests', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, artist }) });
    const result = await response.json();
    if (!response.ok) {
      requestStatus.textContent = typeof result.error === 'string' ? result.error : 'No se pudo procesar la petición.';
      return;
    }
    if (!result.track || typeof result.track.title !== 'string') throw new Error('Invalid result');
    const confirmation = result.created ? 'Añadida a la colección pública: ' : 'Esta canción ya está en la colección: ';
    requestStatus.textContent = confirmation + result.track.title + ' · ' + result.track.artist;
    try { await loadSharedTracks(); }
    catch { requestStatus.textContent += '. No se pudo actualizar la lista; recarga para verla.'; }
  } catch {
    requestStatus.textContent = 'No se pudo confirmar la petición. Tu texto sigue aquí. Inténtalo más tarde; no se añadirán duplicados.';
  } finally { requestingSong = false; requestButton.disabled = false; }
});
configureRequests();
