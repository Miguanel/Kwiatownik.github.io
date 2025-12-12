// === Generator przepisów – logika i mikrointerakcje ===

// Konfiguracja
const MAX_INPUTS = 6;

// Dane wejściowe z backendu
const ALL_PLANTS = (window.ALL_PLANTS || []);

// Zbieranie przepisów z każdej rośliny
function gatherAllRecipes(plants){
  const out = [];
  plants.forEach(plant => {
    ["przepisy_medyczne","przepisy_kulinarne"].forEach(type => {
      const group = (plant.data && plant.data[type]) || {};
      Object.entries(group).forEach(([key, val]) => {
        // Możliwe, że val to obiekt lub tablica – ujednolicamy do tablicy
        const list = Array.isArray(val) ? val : [val];
        list.forEach(przepis => {
          out.push({
            typ: type.includes("medyczne") ? "medyczny" : "kulinarny",
            plant,
            key,
            przepis
          });
        });
      });
    });

    // Przepisy z innymi roślinami – jeśli występują
    const extra = (plant.data && plant.data.przepisy_z_innymi_roslinami) || {};
    Object.entries(extra).forEach(([podtyp, grupy]) => {
      if (!grupy || typeof grupy !== 'object') return;
      Object.values(grupy).forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach(przepis => {
          out.push({
            typ: podtyp === "medyczne" ? "medyczny" : "kulinarny",
            plant,
            key: przepis.nazwa || "przepis",
            przepis
          });
        });
      });
    });
  });
  return out;
}

const ALL_RECIPES = gatherAllRecipes(ALL_PLANTS);

// Węzły DOM
const form = document.getElementById("kw-search-form");
const inputsBox = document.getElementById("kw-inputs");
const resultsBox = document.getElementById("kw-results-list");
const btnExportPdf = document.getElementById("btnExportPdf");
const btnClear = document.getElementById("btnClear");
const dialog = document.getElementById("kw-pdf-dialog");
const pdfOk = document.getElementById("pdfOk");
const pdfCancel = document.getElementById("pdfCancel");

// Filtry po typie (checkboxy w sidebarze)
function currentTypeFilters(){
  const boxes = document.querySelectorAll('.kw-sidebar input[type="checkbox"][data-filter="typ"]');
  const actives = Array.from(boxes).filter(b=>b.checked).map(b=>b.value);
  return new Set(actives);
}

// Validacja frazy
function validQuery(val){ return !!val && val.trim().length >= 3 && val.trim().length <= 120; }

// Sugestie – proste dopasowanie po fragmencie do listy słów z przepisów
function buildVocabulary(recipes){
  const bag = new Set();
  recipes.forEach(({przepis}) => {
    const buckets = [];
    if (Array.isArray(przepis.skladniki)) buckets.push(...przepis.skladniki);
    if (Array.isArray(przepis.cechy)) buckets.push(...przepis.cechy);
    if (Array.isArray(przepis.wlasciwosci)) buckets.push(...przepis.wlasciwosci);
    if (typeof przepis.zastosowanie === 'string') buckets.push(przepis.zastosowanie);
    if (typeof przepis.sposob_przygotowania === 'string') buckets.push(przepis.sposob_przygotowania);
    if (przepis.nazwa || przepis.nazwa_przepisu) buckets.push(przepis.nazwa || przepis.nazwa_przepisu);
    buckets.join(" ").toLowerCase().split(/[^a-ząćęłńóśżź0-9]+/i).forEach(tok=>{
      if (tok && tok.length > 2) bag.add(tok);
    });
  });
  return Array.from(bag);
}
const VOCAB = buildVocabulary(ALL_RECIPES);

// UI: dodawanie pól i tokenów
const tokens = []; // aktywne słowa-klucze
function renderInputs(){
  inputsBox.innerHTML = "";
  // tokeny
  tokens.forEach((t,idx)=>{
    const chip = document.createElement('span');
    chip.className = "kw-token";
    chip.innerHTML = `${escapeHtml(t)} <button aria-label="Usuń" data-x="${idx}">✕</button>`;
    chip.querySelector('button').onclick = (e)=>{ tokens.splice(idx,1); renderInputs(); triggerSearch(); };
    inputsBox.appendChild(chip);
  });
  // aktywne pole
  const wrap = document.createElement('div');
  wrap.className = "kw-input";
  wrap.innerHTML = `<input type="text" placeholder="np. kaszel, nalewka, pokrzywa…" id="kw-live">
                    <div class="kw-suggest" id="kw-suggest"></div>`;
  inputsBox.appendChild(wrap);

  const input = wrap.querySelector('#kw-live');
  const suggest = wrap.querySelector('#kw-suggest');

  input.oninput = (e)=>{
    const q = e.target.value.trim().toLowerCase();
    if (!q){ suggest.classList.remove('open'); suggest.innerHTML = ""; return; }
    const matches = VOCAB.filter(v=>v.includes(q)).slice(0,10);
    if (matches.length === 0){ suggest.classList.remove('open'); suggest.innerHTML = ""; return; }
    suggest.innerHTML = matches.map(m=>`<button type="button" data-sug="${m}">${escapeHtml(m)}</button>`).join("");
    suggest.classList.add('open');
    suggest.querySelectorAll('button').forEach(b=> b.onclick = ()=>{ addToken(b.dataset.sug); input.value=""; suggest.classList.remove('open'); });
  };
  input.onkeydown = (e)=>{
    if (e.key === 'Enter'){
      e.preventDefault();
      const v = input.value.trim();
      if (validQuery(v)){ addToken(v); input.value=""; }
    }
  };
  input.focus();
}
function addToken(t){
  if (tokens.length >= MAX_INPUTS) return;
  if (!tokens.includes(t)){ tokens.push(t); renderInputs(); triggerSearch(); }
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, (ch)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
}

// Klik na szybkie chipy w sidebarze
document.addEventListener('click', (e)=>{
  const chip = e.target.closest('.kw-chip');
  if (!chip) return;
  addToken(chip.dataset.chip);
});

// Wyszukiwanie
function formatTitle(raw){
  if (!raw) return "";
  const withSpaces = String(raw).replaceAll('_',' ');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
function highlightMany(text, queries){
  if (!text) return "";
  let html = String(text);
  const palette = ['#a6f0c5','#7dd9ff','#ffe49d','#ffb3c7','#cdb6ff','#ffd7a8'];
  queries.forEach((q, i)=>{
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'gi');
    html = html.replace(re, (m)=> `<span style="background:${palette[i%palette.length]}; color:#00130a; border-radius:4px; padding:0 .15em;">${m}</span>`);
  });
  return html;
}
function passesAllQueries(przepis, queries){
  const hay = [];
  if (Array.isArray(przepis.skladniki)) hay.push(przepis.skladniki.join(" "));
  if (Array.isArray(przepis.cechy)) hay.push(przepis.cechy.join(" "));
  if (Array.isArray(przepis.wlasciwosci)) hay.push(przepis.wlasciwosci.join(" "));
  if (przepis.zastosowanie) hay.push(przepis.zastosowanie);
  if (przepis.sposob_przygotowania) hay.push(przepis.sposob_przygotowania);
  if (przepis.nazwa || przepis.nazwa_przepisu) hay.push(przepis.nazwa || przepis.nazwa_przepisu);
  const blob = hay.join(" ").toLowerCase();
  return queries.every(q => blob.includes(q));
}

function triggerSearch(){
console.log("🔍 Payload do API:", payload);
  const typeSet = currentTypeFilters();
  const queries = tokens.map(t=>t.toLowerCase()).filter(validQuery);
  resultsBox.innerHTML = "";
  if (queries.length === 0){
    resultsBox.innerHTML = `<div class="kw-card"><i>Dodaj co najmniej jedną frazę, aby rozpocząć wyszukiwanie.</i></div>`;
    return;
  }
  const found = ALL_RECIPES.filter(({typ, przepis}) => typeSet.has(typ) && passesAllQueries(przepis, queries));
  if (found.length === 0){
    resultsBox.innerHTML = `<div class="kw-card" style="border-color:#3b1d22;background:#150d0e;color:#ffb3c1;">
      Brak przepisów spełniających wszystkie warunki.
    </div>`;
    return;
  }
  const html = found.map(({typ, plant, key, przepis})=>{
    const name = formatTitle(przepis.nazwa || przepis.nazwa_przepisu || key);
    const plantLine = `<a href="/${plant.category}/${plant.slug}" class="kw-link">${escapeHtml(plant.name)}</a>
                       <span class="kw-type">${typ}</span>`;
    const sklad = (przepis.skladniki || []).map(s=>`<li>${highlightMany(String(s), queries)}</li>`).join("");
    const cechy = (przepis.cechy || []).map(s=>`<li>${highlightMany(String(s), queries)}</li>`).join("");
    const wlas = (przepis.wlasciwosci || []).map(s=>`<li>${highlightMany(String(s), queries)}</li>`).join("");
    const zastos = przepis.zastosowanie ? `<div>${highlightMany(przepis.zastosowanie, queries)}</div>` : "";
    const sposob = przepis.sposob_przygotowania ? `<div>${highlightMany(przepis.sposob_przygotowania, queries)}</div>` : "";

    return `<article class="kw-card">
      <div class="kw-plant">${plantLine}</div>
      <div class="kw-title">${highlightMany(name, queries)}</div>
      ${(przepis.skladniki && przepis.skladniki.length) ? `<b>Składniki:</b><ul class="kw-bullets">${sklad}</ul>` : ""}
      ${przepis.sposob_przygotowania ? `<b>Sposób przygotowania:</b>${sposob}` : ""}
      ${(przepis.cechy && przepis.cechy.length) ? `<b>Cechy:</b><ul class="kw-bullets">${cechy}</ul>` : ""}
      ${(przepis.wlasciwosci && przepis.wlasciwosci.length) ? `<b>Właściwości:</b><ul class="kw-bullets">${wlas}</ul>` : ""}
      ${przepis.dawkowanie ? `<b>Dawkowanie:</b><div>${highlightMany(przepis.dawkowanie, queries)}</div>` : ""}
      ${zastos}
    </article>`;
  }).join("");
  console.log("🔍 Payload do API:", payload);
  resultsBox.innerHTML = html;
}

// PDF dialog
btnExportPdf && btnExportPdf.addEventListener('click', ()=>{
  dialog.setAttribute('aria-hidden','false');
  setTimeout(()=>{ document.getElementById('pdfScale').focus(); }, 30);
});
pdfCancel && pdfCancel.addEventListener('click', ()=> dialog.setAttribute('aria-hidden','true'));

pdfOk && pdfOk.addEventListener('click', ()=>{
  dialog.setAttribute('aria-hidden','true');
  const keep = document.getElementById('pdfHighlight').checked;
  let scale = parseFloat(String(document.getElementById('pdfScale').value).replace(',','.'));
  if (isNaN(scale)) scale = 1.0;
  scale = Math.min(1.5, Math.max(0.5, scale));

  const section = document.querySelector('.kw-results');
  const clone = section.cloneNode(true);

  // Usuń podświetlenia, gdy wyłączone
  if(!keep){
    clone.querySelectorAll('span').forEach(s=>{
      const bg = window.getComputedStyle(s).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)'){
        const txt = document.createTextNode(s.textContent);
        s.parentNode.replaceChild(txt, s);
      }
    });
  }
  clone.style.fontSize = (1.0 * scale) + 'em';

  const opt = {
    margin: 0.3 * scale,
    filename: 'kwiatownik-przepisy.pdf',
    image: { type: 'jpeg', quality: 0.97 },
    html2canvas: { scale: 2, backgroundColor: null },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(clone).save();
});

// Czyszczenie
btnClear && btnClear.addEventListener('click', ()=>{
  tokens.length = 0;
  renderInputs();
  triggerSearch();
});

// Inicjalizacja
renderInputs();
triggerSearch();


// ===== Drobne mikrointerakcje (hover/focus) =====
document.addEventListener('pointermove', (e)=>{
  const card = e.target.closest('.kw-card');
  if(!card) return;
  const r = card.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  card.style.setProperty('--x', x+'px');
  card.style.setProperty('--y', y+'px');
});
