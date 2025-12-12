
function buildKontaktUI(){
  return `
    <h2 style="margin:0 0 .35rem;">Kontakt</h2>
    <p>Masz pytanie lub sugestię? Napisz do nas 🌱</p>

    <!-- ukryta ramka: przechwytujemy odpowiedź, zostajemy na stronie -->
    <iframe name="kontakt_iframe" id="kontakt_iframe" style="display:none;"></iframe>

    <form id="kontaktForm" class="form"
      action="https://docs.google.com/forms/u/0/d/e/1FAIpQLSc4Cj-klfVitmYBLLpwYHStZ7vTsIFJ3mugJm7LW5QkiVACGQ/formResponse"
      method="POST" target="kontakt_iframe" novalidate
      style="display:grid; gap:.6rem; margin-top:.8rem; max-width:600px">

      <label for="kt_name">Imię</label>
      <input id="kt_name" name="entry.1654482530" type="text" placeholder="Twoje imię"
             style="padding:.65rem .8rem; border:1px solid var(--line-strong); border-radius:10px; background:#fff9f0; font:inherit;">

      <label for="kt_email">E‑mail (jeśli chcesz odpowiedź)</label>
      <input id="kt_email" name="entry.1776531128" type="email" placeholder="twoj@mail.com"
             style="padding:.65rem .8rem; border:1px solid var(--line-strong); border-radius:10px; background:#fff9f0; font:inherit;">

      <label for="kt_msg">Wiadomość</label>
      <textarea id="kt_msg" name="entry.1817341887" rows="5" required placeholder="Napisz wiadomość…"
                style="padding:.65rem .8rem; border:1px solid var(--line-strong); border-radius:10px; background:#fff9f0; font:inherit;"></textarea>

      <input type="hidden" name="submit" value="Submit">

      <div style="display:flex; gap:.6rem; align-items:center; margin-top:.2rem;">
        <button type="submit" class="btn">Wyślij</button>
        <span class="muted">Wiadomość wyśle się w tle — zostaniesz na tej stronie.</span>
      </div>
    </form>

    <div id="kontaktOk" style="display:none; margin-top:1rem;">
      ✅ Dziękujemy! Wiadomość została wysłana. Odezwiemy się wkrótce.
    </div>
  `;
}

function openKontaktPapyrus(){
  hideCoffeeLayer();
  // złap elementy papirusu jak w innych sekcjach
  const stage       = document.getElementById('stage');
  const cardsLayer  = document.getElementById('cardsLayer');
  const papLayer    = document.getElementById('papyrusLayer');
  const papyrus     = document.getElementById('papyrus');
  const topTitle    = document.getElementById('pap-top-title');
  const topContent  = document.getElementById('pap-top-content');
  const bottomContent = document.getElementById('pap-bottom-content');

  // nagłówek + treść
  topTitle.textContent = 'Kontakt';
  topContent.innerHTML = buildKontaktUI();
  bottomContent.innerHTML = '<p class="placeholder">Formularz działa bez opuszczania strony.</p>';

  // delikatna animacja rozwijania zwoju
  papyrus.classList.add('opening');
  papyrus.addEventListener('animationend', () => {
    papyrus.classList.remove('opening');
  }, { once: true });

  // przejście warstw (dokładnie jak w przepisach/ogrodnictwie)
  const cardsH = cardsLayer.scrollHeight;
  papLayer.style.visibility = 'hidden';
  papLayer.removeAttribute('aria-hidden');
  stage.style.height = cardsH + 'px';
  papLayer.style.transform = 'translateY(100%)';
  cardsLayer.style.transform = 'translateY(0)';
  requestAnimationFrame(() => {
    papLayer.style.visibility = 'visible';
    if (typeof setStageHeightToPapyrus === 'function') {scheduleStageHeight();
attachHeightObservers();}
    cardsLayer.style.transform = 'translateY(-100%)';
    papLayer.style.transform   = 'translateY(0)';
    document.body.classList.add('peek-hidden');
    if (typeof onScrollPeek === 'function') {
      document.addEventListener('scroll', onScrollPeek, { passive:true });
    }
    if (typeof watchPapyrusResize === 'function') watchPapyrusResize();
  });

  // obsługa sukcesu: po załadowaniu odpowiedzi w ukrytym iframe pokaż komunikat
  const iframe = document.getElementById('kontakt_iframe');
  const form   = document.getElementById('kontaktForm');
  const okBox  = document.getElementById('kontaktOk');

  // czyszczone i potwierdzenie po submit
  iframe.addEventListener('load', () => {
    okBox.style.display = 'block';
    form.reset();
    if (typeof updateStageHeightAfterAsyncContent === 'function') {
      updateStageHeightAfterAsyncContent();
    }
  });

  return false;
}

// (opcjonalnie) PODPIĘCIE KLIKNIĘCIA W NAV:
// Upewnij się, że link w nawigacji ma data-section="kontakt"
document.querySelectorAll('a[data-section="kontakt"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    openKontaktPapyrus();
  });
});
function showCoffeeThanks(){
  const stage       = document.getElementById('stage');
  const cardsLayer  = document.getElementById('cardsLayer');
  const papLayer    = document.getElementById('papyrusLayer');
  const coffeeLayer = document.getElementById('coffeeLayer');

  // schowaj papirus
  papLayer.style.transform = 'translateY(100%)';
  papLayer.setAttribute('aria-hidden','true');

  // pokaż warstwę kawy
  coffeeLayer.style.display = 'block';
  coffeeLayer.removeAttribute('aria-hidden');

  // animacja wejścia (jak papirus)
  const cardsH = cardsLayer.scrollHeight;
  stage.style.height = cardsH + 'px';
  cardsLayer.style.transform = 'translateY(0)';

  requestAnimationFrame(()=>{
    // ustaw wysokość sceny do zawartości kawy
    stage.style.height = Math.max(560, coffeeLayer.scrollHeight) + 'px';
    cardsLayer.style.transform = 'translateY(-100%)';
  });
}

document.querySelectorAll('[data-action="coffee"]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    showCoffeeThanks();          // pokazujemy podziękowanie
    // brak preventDefault -> link otwiera się w nowej karcie dzięki target="_blank"
  });
});

function showPapyrusLayer(){
  const papLayer = document.getElementById('papyrusLayer');
  const stage = document.getElementById('stage');
  const cardsLayer = document.getElementById('cardsLayer');
  if(!papLayer) return;

  papLayer.style.visibility = 'hidden';
  papLayer.removeAttribute('aria-hidden');
  papLayer.style.transform = 'translateY(100%)';
  cardsLayer.style.transform = 'translateY(0)';

  requestAnimationFrame(()=>{
    papLayer.style.visibility = 'visible';
    if (typeof setStageHeightToPapyrus === 'function') {
        scheduleStageHeight();
        attachHeightObservers();
    }
    cardsLayer.style.transform = 'translateY(-100%)';
    papLayer.style.transform   = 'translateY(0)';
  });
}
function hideCoffeeLayer(){
  const coffeeLayer = document.getElementById('coffeeLayer');
  if(!coffeeLayer) return;
  coffeeLayer.style.display = 'none';
  coffeeLayer.setAttribute('aria-hidden','true');
}


</script>
<script>
(function(){
  const stage = document.getElementById('stage');
  const cardsLayer = document.getElementById('cardsLayer');

  function setStageHeightToCards(){
    if(!stage || !cardsLayer) return;
    stage.style.height = cardsLayer.scrollHeight + 'px';
  }

  // 1) Kiedy obrazki w kartach dokończą się ładować
  document.querySelectorAll('#cards img').forEach(img=>{
    if(!img.complete){
      img.addEventListener('load', setStageHeightToCards, {once:true});
      img.addEventListener('error', setStageHeightToCards, {once:true});
    }
  });

  // 2) Na starcie i przy zmianie rozmiaru
  window.addEventListener('load', setStageHeightToCards);
  window.addEventListener('resize', setStageHeightToCards);

  // 3) (opcjonalnie) krótka zwłoka na layout
  requestAnimationFrame(setStageHeightToCards);
})();