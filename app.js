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
const emailOptions = document.getElementById('email-options');
const formStatus = document.getElementById('form-status');
const recipient = 'Albertojohan88@gmail.com';
form.addEventListener('input', () => {
  emailOptions.hidden = true;
  formStatus.textContent = '';
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const name = form.elements.name.value.trim();
  const comment = form.elements.comment.value.trim();
  if (!name || !comment) {
    emailOptions.hidden = true;
    formStatus.textContent = 'Escribe tu nombre y una recomendación.';
    return;
  }
  const subject = 'Johan Music · Recomendación de ' + name;
  const body = 'Nombre: ' + name + '\r\n\r\nRecomendación:\r\n' + comment;
  document.getElementById('email-app').href = 'mailto:' + recipient
    + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  const gmail = new URL('https://mail.google.com/mail/');
  gmail.search = new URLSearchParams({ view: 'cm', fs: '1', to: recipient, su: subject, body });
  document.getElementById('email-gmail').href = gmail.href;
  emailOptions.hidden = false;
  formStatus.textContent = 'Borrador preparado para ' + recipient + '. Abre una opción de correo, revisa el mensaje y pulsa Enviar allí. Aún no se ha enviado.';
});
