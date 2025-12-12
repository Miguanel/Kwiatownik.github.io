const HIERARCHY = [
  {
    title: "Drzewa",
    groups: [
      { title: "Drzewa iglaste", parts: ["igły/liście","kora","szyszki/nasiona","drewno","żywica"] },
      { title: "Drzewa liściaste", parts: ["liście","kora","pąk","kwiaty","owoce","nasiona","drewno","soki"],
        plants: [
          {key:"dab_szypulkowy", label:"Dąb szypułkowy (Quercus robur)"},
          {key:"dab_bezszypulkowy", label:"Dąb bezszypułkowy (Quercus petraea)"},
          {key:"kasztan_jadalny", label:"Kasztan jadalny (Castanea sativa)"}
        ]
      },
      { title: "Drzewa owocowe", parts: ["liście","kwiaty","owoce","nasiona","kora","drewno"] }
    ]
  },
  {
    title: "Krzewy",
    groups: [
      { title: "Krzewy ziołowe", parts:["liście","kwiaty","owoce","kora","pędy","nasiona","korzenie"] },
      { title: "Krzewy owocowe", parts:["liście","kwiaty","owoce","pędy","kora"] }
    ]
  },
  {
    title: "Rośliny zielne (Zioła)",
    groups: [
      { title: "Jednoroczne" },
      { title: "Wieloletnie",
        plants: [
          {key:"krwawnik_pospolity", label:"Krwawnik pospolity (Achillea millefolium)"},
          // {key:"mniszek_lekarski", label:"Mniszek lekarski (Taraxacum officinale)"},
          // {key:"rumianek_pospolity", label:"Rumianek pospolity (Matricaria chamomilla)"}
        ]
      },
      { title: "Przyprawowe", parts:["liście","kwiaty","pędy","korzenie","cała część nadziemna","nasiona","owoce"] }
    ]
  },
  {
    title: "Korzenie i bulwy",
    groups: [
      { title: "Korzenie lecznicze", parts:["korzeń","liście","pędy"] },
      { title: "Korzenie warzywne", parts:["korzeń","liście","pędy"] },
      { title: "Bulwy", parts:["bulwa","liście","pędy"] }
    ]
  },
  {
    title: "Rośliny wodne i bagienne",
    groups: [
      { title: "Rośliny wodne jadalne", parts:["liście","kwiaty","kłącza","łodygi","owoce"] },
      { title: "Rośliny bagienne lecznicze", parts:["liście","kwiaty","kłącza","łodygi","owoce"] }
    ]
  },
  {
    title: "Grzyby",
    groups: [
      { title: "Grzyby jadalne", parts:["owocnik","zarodniki","grzybnia"] },
      { title: "Grzyby lecznicze", parts:["owocnik","zarodniki","grzybnia"] }
    ]
  },
  { title: "Rośliny cebulowe", groups: [{ title:"(ogólnie)", parts:["cebula","liście","pędy kwiatowe"] }] },
  {
    title: "Trawy i zboża",
    groups: [
      { title: "Zboża", parts:["nasiona (ziarno)","liście","pędy","kwiaty"] },
      { title: "Trawy dzikie", parts:["nasiona","liście","pędy","kwiaty"] }
    ]
  },
  { title: "Pnącza", groups: [{ title:"(ogólnie)", parts:["pędy","liście","owoce","kwiaty"] }] },
  {
    title: "Rośliny egzotyczne",
    groups: [{ title:"(ogólnie)", parts:["liście","owoce","łodygi","kwiaty","soki","nasiona"] }]
  }
];


(function(){
  const nav = document.getElementById('nav');
  const peek = document.getElementById('peek');
  const stage = document.getElementById('stage');
  const cardsLayer = document.getElementById('cardsLayer');
  const papLayer = document.getElementById('papyrusLayer');
  const papyrus = document.getElementById('papyrus');
  const topTitle = document.getElementById('pap-top-title');
  const topContent = document.getElementById('pap-top-content');
  const bottomContent = document.getElementById('pap-bottom-content');

  // Aktualna wysokość nav dla sticky peeka
  function setNavH(){
    const h = nav.offsetHeight || 56;
    document.documentElement.style.setProperty('--navH', h + 'px');
  }
  setNavH(); window.addEventListener('resize', setNavH);

  // Budowa UI (hierarchia / inputy)
  const TOP_ICONS = {
  "Drzewa": "{{ url_for('static', filename='icons/drzewa.png') }}",
  "Krzewy": "{{ url_for('static', filename='icons/krzewy.png') }}",
  "Rośliny zielne (Zioła)": "{{ url_for('static', filename='icons/ziola.png') }}",
  "Korzenie i bulwy": "{{ url_for('static', filename='icons/bulwy.png') }}",
  "Rośliny wodne i bagienne": "{{ url_for('static', filename='icons/wodne.png') }}",
  "Grzyby": "{{ url_for('static', filename='icons/grzyby.png') }}",
  "Rośliny cebulowe": "{{ url_for('static', filename='icons/cebule.png') }}",
  "Trawy i zboża": "{{ url_for('static', filename='icons/zboza.png') }}",
  "Pnącza": "{{ url_for('static', filename='icons/pnacza.png') }}",
  "Rośliny egzotyczne": "{{ url_for('static', filename='icons/egzotyczne.png') }}"
};

function groupByTop(plants) {
  const map = new Map();
  (plants || []).forEach(p => {
    const top = p.top || 'Inne';
    if (!map.has(top)) map.set(top, []);
    map.get(top).push(p);
  });
  map.forEach(list => list.sort((a,b)=> (a.name||'').localeCompare((b.name||''), 'pl')));

  return Array.from(map.entries());
}

function buildHierarchy(mode){
  const groups = groupByTop(PLANTS);
  if (!groups.length) {
    return `<p class="placeholder">Brak danych roślin w <code>/static/data/rosliny</code>.</p>`;
  }
  let html = `
    <div class="tree-controls" style="display:flex;gap:.6rem;align-items:center;margin:.2rem 0 .6rem;">
      <button type="button" class="btn" data-tree-expand>Rozwiń wszystko</button>
      <button type="button" class="btn" data-tree-collapse>Zwiń wszystko</button>
      <span class="muted" style="margin-left:.3rem;">Steruj listą roślin jednym kliknięciem</span>
    </div>
    <p class="placeholder" style="margin-bottom:8px;">Otwórz listy, by odkrywać rośliny i ich sekrety.</p>
    <div class="tree" role="tree">`;

  groups.forEach(([top, list], i) => {
    const icon = TOP_ICONS[top] || "{{ url_for('static', filename='icons/egzotyczne.png') }}";
    html += `<details ${i===0?'open':''}>
      <summary role="treeitem" aria-expanded="${i===0?'true':'false'}">
        <img class="grp-ico" alt="" aria-hidden="true" src="${icon}">${top}
      </summary>
      <ul>`;
    list.forEach(p => {
      html += `<li>
        <a href="#" data-plant="${p.slug}">${p.name}</a>
        ${p.latin ? ` <i style="color:#6b5947">(${p.latin})</i>` : ''}
      </li>`;
    });
    html += `</ul></details>`;
  });

  html += `</div>`;
  return html;
}


// ——— ROOT-y danych (NOWE) ———
const DATA_ROOT     = "{{ url_for('static', filename='data') }}";
const PLANTS_ROOT   = DATA_ROOT + "/rosliny";
const RECIPES_ROOT  = DATA_ROOT + "/przepisy";

  // Prosty indeks plików JSON (możesz dopisać kolejne)
const PLANTS = {{ all_plants|tojson|safe }};
const PLANT_INDEX = Object.fromEntries((PLANTS || []).map(p => [p.slug, `${PLANTS_ROOT}/${p.category}/${p.slug}.json`]));
// === Globalne pliki przepisów (Jinja/Flask) ===
const KUL_GLOBAL_URL = RECIPES_ROOT + "/przepisy_kulinarne_global.json";
const MED_GLOBAL_URL = RECIPES_ROOT + "/przepisy_medyczne_global.json";


// mapowanie rekordu z globalnych JSON do formatu używanego przez renderer
function mapGlobalRecipe(rec){
  return {
    t: rec.tytul || rec.title || rec.nazwa || 'Przepis',
    typ: rec.typ || '',              // 'kulinarne' / 'medyczny'
    metoda: rec.metoda || '',
    tagi: asArray(rec.tagi),
    surowce: asArray(rec.skladniki).map(asString),
    raw: rec                         // ← renderer czyta z tego Sposób przygotowania / Dawkowanie / Źródła
  };
}

async function loadGlobalRecipes(){
  const [kul, med] = await Promise.all([
    fetch(KUL_GLOBAL_URL, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({przepisy:[]})),
    fetch(MED_GLOBAL_URL, {credentials:'same-origin'}).then(r=>r.json()).catch(()=>({przepisy:[]}))
  ]);
  return []
    .concat((kul.przepisy||[]).map(mapGlobalRecipe))
    .concat((med.przepisy||[]).map(mapGlobalRecipe));
}

async function loadPlantData(slug){
  const url = PLANT_INDEX[slug] || `/static/data/rosliny/${slug}.json`;
  if(!url){ throw new Error('Brak ścieżki do JSON dla: ' + slug); }
  const res = await fetch(url, {credentials:'same-origin'});
  if(!res.ok){ throw new Error('Nie mogę wczytać: ' + url); }
  return await res.json();
}



/* ---------- SCHEMA NORMALIZER (obsługa nowych/różnych struktur JSON) ---------- */
function normalizeData(raw){
  return {
    gatunek: getOneOf(raw, ['gatunek','gatunek_nazwa','nazwa','nazwa_pospolita'], 'Wybrany gatunek'),
    nazwa_lacinska: getOneOf(raw, ['nazwa_lacinska','nazwa_łacińska','taksonomia.lacinska','taksonomia.łacińska','latin','scientific_name'], ''),

    // NOWE:
    sciezka: normalizeSciezka(raw),
    taksonomia: normalizeTaksonomia(getOneOf(raw, ['taksonomia','taxonomia','taxonomy'])),

    zdjecia: normalizePhotos(raw),

    // Gałąź Ogrodnictwo (DODANE) + stare aliasy:
    wystepowanie: normalizeWystepowanie(getOneOf(raw, ['Ogrodnictwo.wystepowanie','Ogrodnictwo.występowanie','wystepowanie','występowanie','range','wyst'])),
    uprawa:       normalizeUprawa(getOneOf(raw, ['Ogrodnictwo.uprawa','uprawa','uprawa_i_pielegnacja','uprawa_i_pielęgnacja','cultivation'])),
    kalendarz:    normalizeKalendarz(getOneOf(raw, ['Ogrodnictwo.kalendarz','kalendarz','kalendarz_prac','calendar'])),
    permakultura: normalizePermakultura(getOneOf(raw, ['Ogrodnictwo.permakultura','permakultura','permaculture','gildie','companions'])),

    wlasciwosci_i_skladniki: normalizeWlasciwosci(raw),
    cechy_i_historia: normalizeCechyHistoria(getOneOf(raw, ['cechy_i_historia','historia','legendy'])),
    uwagi_i_ostrzezenia: normalizeUwagi(getOneOf(raw, ['uwagi_i_ostrzezenia','uwagi_i_ostrzeżenia','uwagi','ostrzezenia'])),
    inne_zastosowania: normalizeInneZastosowania(getOneOf(raw, ['inne_zastosowania','zastosowania_pozostale','other_uses'])),
    recipes_flat: normalizeRecipes(raw),
  };
}


function normalizeTaksonomia(t){
  t = t || {};
  return {
    krolestwo: getOneOf(t, ['krolestwo','królestwo','kingdom']),
    gromada:   getOneOf(t, ['gromada','phylum','dział']),
    klasa:     getOneOf(t, ['klasa','class']),
    rzad:      getOneOf(t, ['rząd','rzad','order']),
    rodzina:   getOneOf(t, ['rodzina','family']),
    rodzaj:    getOneOf(t, ['rodzaj','genus']),
    gatunek:   getOneOf(t, ['gatunek','species']),
    podgatunek:getOneOf(t, ['podgatunek','subspecies']),
    odmiana:   getOneOf(t, ['odmiana','varietas','var']),
    autor:     getOneOf(t, ['autor','author'])
  };
}
function normalizeSciezka(raw){
  let s = getOneOf(raw, ['nazwa_zbioru','ścieżka','sciezka','path','klasyfikacja']);
  if(!s) return [];
  if(Array.isArray(s)) return s.map(x=>String(x));
  return String(s).split(/[>→]/).map(x=>x.trim()).filter(Boolean);
}


function getOneOf(obj, paths, fallback=null){
  for(const p of paths){
    // p może być np. "taksonomia.lacinska" albo "uprawa.zbior|uprawa.zbiór"
    const variants = p.split('|');
    for(const v of variants){
      const val = v.split('.').reduce((o,k)=> (o && o[k]!==undefined) ? o[k] : undefined, obj);
      if(val !== undefined && val !== null) return val;
    }
  }
  return fallback;
}

function asArray(x){ return x == null ? [] : (Array.isArray(x) ? x : [x]); }

function asString(x){
  if (x == null) return '';
  if (typeof x === 'string') return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

function normalizeKalendarz(kalRaw){
  if(!kalRaw || typeof kalRaw!=='object') return null;
  const out = {};
  Object.entries(kalRaw).forEach(([event, payload])=>{
    const mies  = getOneOf(payload, ['miesiące','miesiace','m','months'], []);
    out[event] = {
      miesiace:   asArray(mies),
      warunki:    getOneOf(payload, ['warunki','war','conditions'], ''),
      ksiezyc:    getOneOf(payload, ['zalecana_faza_ksiezyca','zalecana_faza_księżyca','faza_ksiezyca','moon_phase'], 'bez znaczenia'),
      pora_dnia:  getOneOf(payload, ['pora_dnia','pory_dnia','daytime','czas_dnia'], '—'),
      typ:        getOneOf(payload, ['typ','rodzaj','category'], ''),
      intensywnosc: getOneOf(payload, ['intensywność','intensywnosc','intensity'], ''),
      czynnosci:  getOneOf(payload, ['czynności','czynnosc','opis','description','notes'], ''),
      uwagi:      getOneOf(payload, ['uwagi','notes','remark'], ''),
      zrodla:     asArray(getOneOf(payload, ['źródło','zrodlo','zrodla','źródła','sources']))
    };
  });
  return out;
}


function normalizeUprawa(up){
  if(!up || typeof up!=='object') return null;
  return {
    gleba:        getOneOf(up, ['gleba','soil']),
    stanowisko:   getOneOf(up, ['stanowisko','stanowisko_uprawy','exposure','position']),
    wysiew:       getOneOf(up, ['wysiew','rozmnażanie','rozmnażanie_wegetatywne','siew','propagation']),
    zbior:        getOneOf(up, ['zbior|zbiór','zbiory','harvest']),
    podlewanie:   getOneOf(up, ['podlewanie','nawadnianie','watering']),
    nawozenie:    getOneOf(up, ['nawożenie','nawozenie','fertilization']),
    przycinanie:  getOneOf(up, ['cięcie','ciecie','przycinanie','pruning']),
    ochrona:      getOneOf(up, ['ochrona','protection','choroby_i_szkodniki']),
    plodozmian:   getOneOf(up, ['płodozmian','plodozmian','crop_rotation']),
    tipy:         asArray(getOneOf(up, ['tipy_ogrodowe','wskazowki','wskazówki','tips'])).filter(Boolean)
  };
}

function normalizeWystepowanie(w){
  if(!w || typeof w!=='object') return null;
  return {
    obszar:   getOneOf(w, ['obszar','range','area']),
    w_polsce: getOneOf(w, ['w_polsce','polska','in_poland'])
  };
}

function normalizePermakultura(p){
  if(!p || typeof p!=='object') return null;
  return {
    opis:     getOneOf(p, ['opis','desc','description']),
    funkcje:  asArray(getOneOf(p, ['funkcje','functions'])),
    gildie:   asArray(getOneOf(p, ['gildie','sąsiedztwo','companions','guilds']))
  };
}

function normalizeWlasciwosci(raw){
  const arr = asArray(getOneOf(raw, ['wlasciwosci_i_skladniki','właściwości_i_składniki','skladniki','składniki','properties','constituents']));
  return arr.map(it=>{
    if(typeof it==='string') return { nazwa: it, dzialanie: '', zrodla: [] };
    return {
      nazwa: getOneOf(it, ['nazwa','name'], 'Składnik'),
      dzialanie: getOneOf(it, ['działanie','dzialanie','effect','action'], ''),
      zrodla: asArray(getOneOf(it, ['zrodla','źródła','zrodlo','źródło','sources','refs']))
    };
  });
}


function normalizeCechyHistoria(chRaw){
  const opis = getOneOf(chRaw||{}, ['opis','description','tekst']);
  const cechy = asArray(getOneOf(chRaw||{}, ['cechy','features']));
  const hist  = asArray(getOneOf(chRaw||{}, ['zastosowanie_historyczne','history','użycia_historyczne']));
  const ciek  = asArray(getOneOf(chRaw||{}, ['ciekawostki','ciekawostki_kulturowe','curiosities']));
  return { opis, cechy, zastosowanie_historyczne: hist, ciekawostki: ciek };
}

function normalizeUwagi(uwRaw){
  const arr = asArray(getOneOf({uwRaw}, ['uwRaw','uwagi_i_ostrzezenia','uwagi_i_ostrzeżenia','uwagi','ostrzezenia','ostrzeżenia']));
  return arr.map(u=>{
    if(typeof u==='string') return { uwaga: u, rozwiazanie: '' };
    return {
      uwaga: getOneOf(u, ['uwaga','warning','note'], ''),
      rozwiazanie: getOneOf(u, ['rozwiazanie','rozwiązanie','mitigation','remedy'], '')
    };
  });
}

function normalizeInneZastosowania(z){
  if(!z || typeof z!=='object') return null;
  const out = {};
  Object.entries(z).forEach(([k,v])=>{
    const opis = getOneOf(v||{}, ['opis','description','zastosowanie','use'], '');
    out[k] = { opis };
  });
  return out;
}

function normalizePhotos(raw){
  const arr = asArray(getOneOf(raw, ['zdjecia','zdjęcia','photos','images']));
  return arr.filter(Boolean);
}

function normalizeBibliografia(raw){
  const bib = getOneOf(raw, ['Bibliografia','bibliografia','references','zrodla_globalne','źródła_globalne']);
  if(!bib) return {};
  const map = {};
  if(Array.isArray(bib)){
    // lista: ["https://...", {id:"Kew", url:"..."}, ...]
    bib.forEach((it,i)=>{
      if(typeof it === 'string') map[String(i+1)] = it;
      else if (it && typeof it === 'object') {
        const id  = it.id || it.key || String(i+1);
        const url = it.url || it.href || it.link || it.source || '';
        if(url) map[String(id)] = url;
      }
    });
  }else if(typeof bib === 'object'){
    // słownik: { "Kew": "https://...", "PFAF": {url:"..."} }
    Object.entries(bib).forEach(([k,v])=>{
      map[String(k)] = (typeof v === 'string') ? v : (v?.url || v?.href || v?.link || '');
    });
  }
  return map;
}
function rootUrl(u){
  try{
    const url = new URL(u, window.location.origin); // obsłuży brak protokołu
    return url.origin;                               // tylko protokół + domena
  }catch{
    return u;
  }
}

function asUrlMaybe(x){
  if(typeof x !== 'string') return '';
  return /^(https?:)?\/\//i.test(x) ? x : '';
}

function refLinks(refs, bibMap){
  const arr = asArray(refs).filter(Boolean);
  if(!arr.length) return '';
  let n = 0;
  const links = arr.map(r=>{
    const byBib = bibMap && (bibMap[String(r)] || bibMap[r]);
    const url = asUrlMaybe(byBib || r);
    if(!url) return '';
    n += 1;
    const short = rootUrl(url);
    return `<a href="${short}" target="_blank" rel="noopener">[${n}]</a>`;
  }).filter(Boolean).join(' ');
  return links ? ` <small>${links}</small>` : '';
}


function normalizeRecipes(raw){
  const srcMed = asArray(getOneOf(raw, ['przepisy_medyczne','fitoterapia','recipes_medical']));
  const srcKul = asArray(getOneOf(raw, ['przepisy_kulinarne','recipes_culinary']));

  const med = srcMed.map(x => ({
    typ: 'medyczny',
    t: getOneOf(x, ['nazwa','tytul','tytuł','title'], 'Przepis'),
    tagi: asArray(getOneOf(x, ['tagi','tags','skladniki','składniki'])).map(asString),
    surowce: asArray(getOneOf(x, ['skladniki','składniki'])).map(asString),
    metoda: getOneOf(x, ['metoda','forma','typ','rodzaj'], ''),
    raw: x                               // ⬅️ zachowujemy oryginalny wpis
  }));

  const kul = srcKul.map(x => ({
    typ: 'kulinarne',
    t: getOneOf(x, ['nazwa','tytul','tytuł','title'], 'Przepis'),
    tagi: asArray(getOneOf(x, ['tagi','tags','skladniki','składniki'])).map(asString),
    surowce: asArray(getOneOf(x, ['skladniki','składniki'])).map(asString),
    metoda: getOneOf(x, ['metoda','forma','typ','rodzaj'], ''),
    raw: x                               // ⬅️ zachowujemy oryginalny wpis
  }));

  return [...med, ...kul];
}






const __DBG = true; // ← ustaw na false gdy skończysz
function dbg(...a){ if(__DBG) console.log('[Kwiatownik]', ...a); }





/* ---------- WSPÓLNE UTILSY DO RENDEROWANIA ---------- */

function section(title, html, id){
  if(!html) return '';
  const _id = id ? ` id="${id}"` : '';
  return `
    <section class="pap-sec"${_id}>
      <header class="pap-sec__head">
        <h4 class="pap-sec__title">${title}</h4>
      </header>
      <div class="pap-sec__body">
        ${html}
      </div>
    </section>
  `;
}


function list(arr){
  if(!arr || !arr.length) return '';
  return `<ul>${arr.map(x=>`<li>${typeof x==='string' ? x : (x.nazwa||asString(x))}</li>`).join('')}</ul>`;
}

function dl(pairs){
  if(!pairs || !Object.keys(pairs).length) return '';
  return `<dl>${Object.entries(pairs).map(([k,v])=>`
    <dt>${k}</dt><dd>${Array.isArray(v)? v.join(', ') : (typeof v==='object' ? asString(v) : v)}</dd>`).join('')}
  </dl>`;
}






function renderAUTO(raw){
  try{
    // Pomiń oczywiste “ciężary” (zdjęcia itp.), pokaż resztę w czytelnej formie
    const { zdjecia, zdjęcia, photos, images, ...rest } = raw || {};
    const html = autoListify(rest);
    return html || '<p class="muted">Brak rozpoznanych pól do wyświetlenia.</p>';
  }catch(e){
    return `<pre class="code">${(e && e.message) || String(e)}</pre>`;
  }
}

function renderMetaTrail(norm){
  const crumbs = [];
  if(norm.sciezka?.length){
    crumbs.push(`<span class="crumb">${norm.sciezka.join(' → ')}</span>`);
  }
  const t = norm.taksonomia || {};
  const taxBits = ['rodzina','rodzaj','gatunek','podgatunek','odmiana']
    .filter(k=>t[k]).map(k=>`${k}: <i>${t[k]}</i>`);
  if(taxBits.length) crumbs.push(`<span class="crumb">${taxBits.join(' • ')}</span>`);
  return crumbs.length ? `<div class="breadcrumbs">${crumbs.join('')}</div>` : '';
}




/* ---------- RENDER: OGRODNICTWO ---------- */
function renderOGROD(norm){
  const meta = renderMetaTrail(norm);
  const thisMonth = (new Date()).getMonth() + 1;

  // ——— U P R A W A ———
  const U = norm.uprawa || {};
  const upPairs = {};
  let zbiorHTML = '';

  if (U.gleba)       upPairs["Gleba"] = U.gleba;
  if (U.stanowisko)  upPairs["Stanowisko"] = U.stanowisko;
  if (U.wysiew)      upPairs["Wysiew / rozmnażanie"] = U.wysiew;

  // Jeśli 'zbior' to obiekt — pokaż tabelę szczegółową
  if (U.zbior){
    if (typeof U.zbior === 'object' && !Array.isArray(U.zbior)) {
      zbiorHTML = renderZbior(U.zbior);
    } else {
      upPairs["Zbiór"] = U.zbior;
    }
  }

  if (U.podlewanie)  upPairs["Podlewanie"] = U.podlewanie;
  if (U.nawozenie)   upPairs["Nawożenie"] = U.nawozenie;
  if (U.przycinanie) upPairs["Przycinanie"] = U.przycinanie;
  if (U.ochrona)     upPairs["Ochrona"] = U.ochrona;
  if (U.plodozmian)  upPairs["Płodozmian"] = U.plodozmian;

  const upHTML = dl(upPairs)
    + (U.tipy?.length ? `<h5>Tipy ogrodowe</h5><ul>${U.tipy.map(t=>`<li>${t}</li>`).join('')}</ul>` : '')
    + (zbiorHTML ? `<h5>Zbiory (szczegółowe)</h5>${zbiorHTML}` : '');

  // ——— K A L E N D A R Z ———
  let kalTable = '';
  let kalDetails = '';

  if (norm.kalendarz && Object.keys(norm.kalendarz).length){
    const months = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    const head = `<tr><th>Zabieg</th>${months.map((m,i)=>`<th class="${(i+1)===thisMonth?'current-month':''}">${m}</th>`).join('')}</tr>`;

    const rows = Object.entries(norm.kalendarz).map(([ev,o])=>{
      const mies = o.miesiace || [];
      const tds = [];
      for(let m=1;m<=12;m++){
        const active = mies.includes(m);
        tds.push(`<td class="${active?'aktywny':''} ${(m===thisMonth)?'current':''}">${active?'✔️':''}</td>`);
      }
      return `<tr>
        <td><a class="zabieg-link" href="#zabieg-${ev}">${(ev||'').replaceAll('_',' ')}</a></td>
        ${tds.join('')}
      </tr>`;
    }).join('');

    kalTable = `
      <div class="calendar-wrapper">
        <label style="display:inline-flex;gap:.4em;align-items:center;">
          <input id="only-current-toggle" type="checkbox"> tylko bieżący miesiąc
        </label>
        <table class="kalendarz-tabela">
          <thead>${head}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    kalDetails = `
      <div class="kalendarz-legenda">
        <h3>📖 Opisy zabiegów</h3>
        ${Object.entries(norm.kalendarz).map(([ev,o])=>{
          const miesRoman = fmtMonths(o.miesiace || []);
          const faza   = o.ksiezyc && o.ksiezyc!=='bez znaczenia' ? o.ksiezyc : '';
          const pora   = o.pora_dnia && o.pora_dnia!=='—' ? o.pora_dnia : '';
          const intens = o.intensywnosc || '';
          const uwagi  = o.uwagi || '';
          const czyn   = o.czynnosci || '';
          const zrod   = o.zrodla || [];

          const zrodHTML = Array.isArray(zrod) && zrod.length
          ? `<p><small><b>Źródła:</b> ${
              zrod.map((u,i)=>{
                const short = rootUrl(u);
                return `<a href="${short}" target="_blank" rel="noopener">[${i+1}]</a>`;
              }).join(' ')
            }</small></p>`
          : '';

          return `
          <div id="zabieg-${ev}" class="legenda-zabieg ${ (o.miesiace||[]).includes(thisMonth) ? 'aktywny-teraz' : '' }">
            <strong>${ev.replaceAll('_',' ')}</strong>
            <ul style="margin-top:.5em">
              ${o.typ ? `<li><b>Typ:</b> ${o.typ}</li>` : ''}
              ${faza   ? `<li><b>Faza księżyca:</b> ${faza}</li>` : ''}
              ${pora   ? `<li><b>Pora dnia:</b> ${pora}</li>` : ''}
              ${intens ? `<li><b>Intensywność:</b> ${intens}</li>` : ''}
              ${miesRoman ? `<li><b>Miesiące:</b> ${miesRoman}</li>` : ''}
              ${czyn  ? `<li><b>Czynność:</b> ${czyn}</li>` : ''}
              ${uwagi ? `<li><b>Uwagi:</b> ${uwagi}</li>` : ''}
            </ul>
            ${zrodHTML}
          </div>`;
        }).join('')}
      </div>`;
  }

  // ——— Występowanie + Permakultura ———
  const wyst = norm.wystepowanie ? dl({
    "Obszar": norm.wystepowanie.obszar || '',
    "W Polsce": norm.wystepowanie.w_polsce || ''
  }) : '';

  let perm = '';
  if (norm.permakultura){
    if (norm.permakultura.opis) perm += `<p>${norm.permakultura.opis}</p>`;
    if (norm.permakultura.funkcje?.length) perm += `<h5>Funkcje w ogrodzie</h5><ul>${norm.permakultura.funkcje.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    if (norm.permakultura.gildie?.length)  perm += `<h5>Gildie / sąsiedztwo</h5><ul>${norm.permakultura.gildie.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  }

  return `
    <article class="pap-article">
      ${meta}
      ${section('Uprawa', upHTML)}
      ${section('Kalendarz zabiegów', kalTable + kalDetails)}
      ${section('Występowanie', wyst)}
      ${section('Permakultura', perm)}
    </article>
  `;
}

/* ---------- RENDER: LEGENDY / OPISY — WERSJA POPRAWIONA ---------- */

function renderLEGENDY(plant, mountEl){
  const isArr = v => Array.isArray(v) && v.length;
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

  const mkUL = arr => isArr(arr) ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const mkLinks = arr => isArr(arr)
    ? `<ul class="source-list">${arr.map(u => {
        const href = (u == null ? '' : String(u));
        return href ? `<li><a href="${esc(href)}" target="_blank" rel="noopener">${esc(href)}</a></li>` : '';
      }).join('')}</ul>` : '';

  const section = (title, body, sources='') => (body && body.trim())
    ? `<section class="pap-sec"><div class="pap-sec__head"><h4 class="pap-sec__title">${esc(title)}</h4></div><div class="pap-sec__body">${body}</div>${sources}</section>`
    : '';

  const C  = isObj(plant.Cechy) ? plant.Cechy : {};
  const OB = isObj(C.opis_botaniczny) ? C.opis_botaniczny : null;
  const W  = isObj(C.wystepowanie) ? C.wystepowanie : null;

  // 1) Ciekawostki + rozszerzenia
  let ciekHTML = '';
  if (isArr(plant.ciekawostki_kulturowe)) ciekHTML += mkUL(plant.ciekawostki_kulturowe);
  if (isArr(plant.legendy))    ciekHTML += `<h5>Legendy i przekazy</h5>${mkUL(plant.legendy)}`;
  if (isArr(plant.symbolika))  ciekHTML += `<h5>Symbolika</h5>${mkUL(plant.symbolika)}`;
  if (isArr(plant.zwyczaje))   ciekHTML += `<h5>Zwyczaje i obrzędy</h5>${mkUL(plant.zwyczaje)}`;
  if (isArr(plant.dawne_nazwy))ciekHTML += `<h5>Dawne nazwy</h5>${mkUL(plant.dawne_nazwy)}`;
  if (isArr(plant.przyslowia)) ciekHTML += `<h5>Przysłowia</h5>${mkUL(plant.przyslowia)}`;
  const sekCiek = section('Ciekawostki kulturowe', ciekHTML);

  // 2) Cechy i historia (jeśli występuje)
  let histHTML = '';
  if (isObj(C.cechy_i_historia)) {
    const H = C.cechy_i_historia;
    if (H.opis) histHTML += `<p>${esc(H.opis)}</p>`;
    if (isArr(H.cechy)) histHTML += `<h5>Cechy</h5>${mkUL(H.cechy)}`;
    if (isArr(H.zastosowanie_historyczne)) histHTML += `<h5>Zastosowania dawniej</h5>${mkUL(H.zastosowanie_historyczne)}`;
    if (isArr(H.ciekawostki)) histHTML += `<h5>Notatki</h5>${mkUL(H.ciekawostki)}`;
  }
  const sekHistoria = section('Cechy i historia', histHTML);

  // 3) Opis botaniczny
  let opisHTML = '', opisSrc = '';
  if (OB){
    const row = (k,v) => v ? `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>` : '';
    opisHTML = `<dl>
      ${row('pokrój', OB.pokroj)}
      ${row('łodyga', OB.lodyga)}
      ${row('liście', OB.liscie)}
      ${row('kwiaty', OB.kwiaty)}
      ${row('owoce', OB.owoce)}
      ${row('zapach', OB.zapach)}
      ${row('cecha wyróżniająca', OB.cecha_wyrozniajaca)}
    </dl>`;
    opisSrc = mkLinks(OB.zrodlo);
  }
  const sekBot = section('Opis botaniczny', opisHTML, opisSrc);

  // 4) Występowanie
  let wystHTML = '', wystSrc = '';
  if (W){
    const row = (k,v) => v ? `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>` : '';
    wystHTML = `<dl>
      ${row('obszar', W.obszar)}
      ${row('w Polsce', W.w_polsce)}
      ${row('siedlisko', W.siedlisko)}
      ${row('gleba', W.gleba)}
      ${row('ekspozycja', W.ekspozycja)}
    </dl>`;
    wystSrc = mkLinks(W.zrodlo);
  }
  const sekWyst = section('Występowanie i siedlisko', wystHTML, wystSrc);

  // 5) Permakultura / ogrodnictwo
  let permHTML = '', permSrc = '';
  if (isObj(plant.permakultura)) {
    const P = plant.permakultura;
    if (P.opis) permHTML += `<p>${esc(P.opis)}</p>`;
    if (isArr(P.funkcje)) permHTML += `<h5>Funkcje</h5>${mkUL(P.funkcje)}`;
    if (isArr(P.gildie))  permHTML += `<h5>Gildie</h5>${mkUL(P.gildie)}`;
    permSrc = mkLinks(P.zrodlo);
  }
  if (isObj(plant.ogrodnictwo)) {
    const O = plant.ogrodnictwo;
    if (O.opis) permHTML += `<h5>Uwagi ogrodnicze</h5><p>${esc(O.opis)}</p>`;
    if (isArr(O.zabiegi)) permHTML += `<h5>Praktyka</h5>${mkUL(O.zabiegi)}`;
    permSrc = permSrc || mkLinks(O.zrodlo);
  }
  const sekPerm = section('Permakultura i ogrodnictwo', permHTML, permSrc);

  // 6) Składniki aktywne
  let chemHTML = '';
  if (isArr(C.wlasciwosci_i_skladniki)) {
    chemHTML = '<ul>' + C.wlasciwosci_i_skladniki.map(it => {
      const nazwa = esc(it?.nazwa || '');
      const dz    = esc(it?.dzialanie || it?.działanie || '');
      const skl   = esc(it?.sklad || it?.skład || '');
      const src   = mkLinks(it?.zrodla || it?.zrodlo || it?.źródła || it?.źródło);
      return `<li><strong>${nazwa}</strong>${dz?`<br><em>Działanie:</em> ${dz}`:''}${skl?`<br><em>Skład:</em> ${skl}`:''}${src?src:''}</li>`;
    }).join('') + '</ul>';
  }
  const sekChem = section('Składniki aktywne i właściwości', chemHTML);

  // 7) Inne zastosowania
  let inneHTML = '';
  if (isArr(plant.inne_zastosowania)) inneHTML += mkUL(plant.inne_zastosowania);
  if (isArr(C.inne_zastosowania))     inneHTML += mkUL(C.inne_zastosowania);
  const sekInne = section('Zastosowania użytkowe', inneHTML);

  // 8) Uwagi i bezpieczeństwo
  let warnHTML = '';
  if (isArr(C.uwagi))            warnHTML += `<h5>Uwagi</h5>${mkUL(C.uwagi)}`;
  if (isArr(C.ostrzezenia) || isArr(C.ostrzeżenia))
    warnHTML += `<h5>Ostrzeżenia</h5>${mkUL(C.ostrzezenia || C.ostrzeżenia)}`;
  if (isArr(C.przeciwwskazania)) warnHTML += `<h5>Przeciwwskazania</h5>${mkUL(C.przeciwwskazania)}`;
  const sekWarn = section('Uwagi i bezpieczeństwo', warnHTML);

  // 9) Ikonografia
  let galHTML = '';
  if (isArr(plant.zdjecia)) {
    galHTML = `<div class="gallery">${plant.zdjecia.map(src => {
      const s = (src == null ? '' : String(src));
      return s ? `<a href="${esc(s)}" target="_blank" rel="noopener"><img src="${esc(s)}" alt="" loading="lazy" decoding="async"></a>` : '';
    }).join('')}</div>`;
  }
  const sekGal = section('Ikonografia i ryciny', galHTML);

  const html = [
    sekCiek, sekHistoria, sekBot, sekWyst, sekPerm, sekChem, sekInne, sekWarn, sekGal
  ].filter(Boolean).join('');

  mountEl.innerHTML = html || `<section class="pap-sec"><div class="pap-sec__body"><p class="placeholder">Brak dodatkowych treści.</p></div></section>`;
}



/* ---------- RENDER: PRZEPISY (wyszukiwarka po nowych JSON-ach) ---------- */

function renderRecipesTokens(recipes, tokens){
  // każde słowo kluczowe musi się znaleźć w tytule, tagach albo surowcach
  const Q = tokens.map(t=>t.trim().toLowerCase()).filter(Boolean);
  if(!Q.length) return recipes;

  return recipes.filter(r=>{
    const hay = [
      r.t,
      ...(r.tagi||[]),
      ...(r.surowce||[]),
      r.metoda||'',
      r.typ||''
    ].join(' ').toLowerCase();
    return Q.every(q => hay.includes(q));
  });
}

function renderRecipesUI(norm, a, b){
  const tokens = [a,b].join(' ').split(/[,\s]+/).filter(Boolean);
  const found = renderRecipesTokens(norm.recipes_flat || [], tokens);

  if(!found.length){
    return `<p class="placeholder">Brak wyników dla: <b>${a||'—'}</b> + <b>${b||'—'}</b>. Spróbuj innych haseł.</p>`;
  }

  return `<ul class="results-list">${
    found.map(r=>`
      <li class="result-item">
        <h4>${r.t}</h4>
        <p class="muted">${[
          r.typ==='medyczny' ? 'medyczny' : 'kulinarne',
          r.metoda||null,
          (r.tagi?.length ? r.tagi.join(' • ') : null)
        ].filter(Boolean).join(' • ')}</p>
      </li>
    `).join('')
  }</ul>`;
}

/* ---------- GŁÓWNY RENDER ROŚLINY Z ADAPTEREM ---------- */

async function renderPlant(slug, mode){
  bottomContent.innerHTML = `<p class="placeholder">Ładuję dane rośliny…</p>`;
  try{
    const raw  = await loadPlantData(slug);
    const norm = normalizeData(raw);

    const titleName = norm.gatunek || 'Wybrany gatunek';
    const latin     = norm.nazwa_lacinska || '';
    topTitle.textContent = `${titleName}${latin ? ' ('+latin+')' : ''}`;

    let html = (mode === 'ogrodnictwo') ? renderOGROD(norm) : renderLEGENDY(norm, raw);


    // Fallback, jeśli treści jest bardzo mało
    const onlyGallery = !html.replace(/<img[^>]*>/g,'').replace(/<[^>]+>/g,'').trim();
    if (onlyGallery) {
      html += section('Auto-podgląd (surowe dane)', renderAUTO(raw));
    }

    // Zawsze pokaż „pozostałe pola”, jeśli są
<!--    const leftovers = renderPozostale(raw);-->
<!--    if (leftovers) {-->
<!--      html += section('Pozostałe pola (auto-podgląd)', leftovers);-->
<!--    }-->

    bottomContent.innerHTML = `<article class="pap-article">${html}</article>`;

    attachHeightObservers();
    scheduleStageHeight();
    wireCalendarUI(bottomContent);
    watchImagesForHeightUpdates(bottomContent);
    updateStageHeightAfterAsyncContent();

  } catch(err){
    bottomContent.innerHTML = `<p class="placeholder">Nie udało się wczytać danych. ${err.message}</p>`;
    updateStageHeightAfterAsyncContent();
  }
}



/* ---------- Nadpisanie zachowania sekcji "Przepisy" by używała nowego JSON ---------- */



// === Helpers: formatowanie uprawy ===
function wireCalendarUI(root = bottomContent){
  // poczekaj jedną klatkę, aby DOM już był wstawiony
  requestAnimationFrame(()=>{
    const box   = root.querySelector('#only-current-toggle');     // checkbox „tylko bieżący miesiąc”
    const table = root.querySelector('.kalendarz-tabela');         // tabela kalendarza
    if(!box || !table) return;

    box.addEventListener('change', ()=>{
      table.querySelectorAll('tbody tr').forEach(tr=>{
        tr.querySelectorAll('td').forEach((td,i)=>{
          if(i===0) return; // kolumna z nazwą zabiegu
          const isCurrent = td.classList.contains('current');
          td.style.opacity = (box.checked && !isCurrent) ? .15 : '';
        });
      });
    });
  });
}

function wireTreeControls(root){
  if(!root) return;
  const treeBox = root.querySelector('.tree');
  if(!treeBox) return;

  const expandBtn  = root.querySelector('[data-tree-expand]');
  const collapseBtn= root.querySelector('[data-tree-collapse]');

  if (expandBtn){
    expandBtn.addEventListener('click', () => {
      treeBox.querySelectorAll('details').forEach(d => d.open = true);
    });
  }
  if (collapseBtn){
    collapseBtn.addEventListener('click', () => {
      treeBox.querySelectorAll('details').forEach(d => d.open = false);
    });
  }
}



function isPlainObject(v){ return v && typeof v==='object' && !Array.isArray(v); }

function fmtMonths(arr){
  if(!arr) return '—';
  const map = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII',9:'IX',10:'X',11:'XI',12:'XII'};
  return arr.map(m=>{
    if(typeof m==='number') return map[m]||m;
    // już rzymskie? zostaw
    return m;
  }).join(', ');
}

function renderZbior(zbior){
  if(!zbior) return '<p class="muted">Brak danych o zbiorach.</p>';
  if(typeof zbior==='string') return `<p>${zbior}</p>`;

  if(isPlainObject(zbior)){
    const rows = Object.entries(zbior).map(([surowiec, v])=>{
      const mies = fmtMonths(v.miesiace || v['miesiące'] || []);
      const war  = Array.isArray(v.warunki) ? v.warunki.join(' ') : (v.warunki || '—');
      return `<tr>
        <td><strong>${surowiec.replaceAll('_',' ')}</strong></td>
        <td>${mies}</td>
        <td>${war}</td>
      </tr>`;
    }).join('');
    return `
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Surowiec</th><th>Miesiące</th><th>Warunki</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // fallback dla rzadkich formatów
  try{ return `<pre class="code">${JSON.stringify(zbior,null,2)}</pre>`; }
  catch(e){ return `<p>${String(zbior)}</p>`; }
}


  // helpery openPapyrus
  let papRO = null; // ResizeObserver dla papirusu

  function setStageHeightToPapyrus(min = 560){
    // Ustaw wysokość sceny do aktualnej wysokości papirusu
    const papH = papyrus.scrollHeight;
    stage.style.height = Math.max(min, papH) + 'px';
  }
    // ——— mobilny pasek adresu / obrót / top-bounce
    function recalcAllHeights(){
      setNavH();               // wysokość sticky nawigacji (gdy się ścieśnia/rozszerza)
      setStageHeightToPapyrus();
    }

    // iOS/Android: zmiana "wizualnego" viewportu
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', recalcAllHeights, {passive:true});
    }

    // Gdy wracamy na samą górę (bounce do y≈0) – dociągnij wysokość
    window.addEventListener('scroll', () => {
      if (window.scrollY < 4) recalcAllHeights();
    }, {passive:true});

    // rotacja ekranu
    window.addEventListener('orientationchange', () => {
      // drobne opóźnienie aż układ się ustali
      setTimeout(recalcAllHeights, 60);
    });

  function watchPapyrusResize(){
    if(papRO) papRO.disconnect();
    papRO = new ResizeObserver(() => setStageHeightToPapyrus());
    papRO.observe(papyrus);
  }

  function updateStageHeightAfterAsyncContent(){
    // natychmiast
    scheduleStageHeight();
    attachHeightObservers();
    // po następnym malowaniu (np. po wstawieniu HTML)
    requestAnimationFrame(() => setStageHeightToPapyrus());
    // po załadowaniu obrazków
    papyrus.querySelectorAll('img').forEach(img=>{
      if(img.complete) return;           // już gotowy
      img.addEventListener('load', setStageHeightToPapyrus, {once:true});
      img.addEventListener('error', setStageHeightToPapyrus, {once:true});
    });
  }
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => {
    if (typeof updateStageHeightAfterAsyncContent === 'function') {
      updateStageHeightAfterAsyncContent();
    } else if (typeof scheduleStageHeight === 'function') {
      scheduleStageHeight();
    }
  }, { passive: true });
}
function ensureResultsVisible(){
  // autoscroll tylko w sekcji PRZEPISY i tylko na urządzeniach dotykowych
  if (window.CURRENT_SECTION !== 'przepisy') return;
  if (!matchMedia('(pointer: coarse)').matches) return;

  const box = document.getElementById('pap-bottom-content');
  if(!box) return;
  try{
    box.scrollIntoView({ behavior:'smooth', block:'start' });
  }catch{}
}

function injectMatchModeToggle(){
  const wrap = document.querySelector('#pap-top-content .search-zone');
  if(!wrap || wrap.querySelector('[data-matchmode]')) return;

  const bar = document.createElement('div');
  bar.setAttribute('data-matchmode','');
  bar.style.cssText = 'display:flex;gap:.6rem;align-items:center;font-size:.9rem;color:#6b5947';
  bar.innerHTML = `
    <span>Tryb dopasowania:</span>
    <label><input type="radio" name="mmode" value="AND" checked> wszystkie słowa</label>
    <label><input type="radio" name="mmode" value="OR"> dowolne słowo</label>
  `;
  bar.addEventListener('change', e => {
    if(e.target.name === 'mmode'){
      MATCH_MODE = e.target.value === 'OR' ? 'OR' : 'AND';
      applyRecipeFilters();
    }
  });
  wrap.appendChild(bar);
}



/* === Przepisy: podpowiedzi + tagi (nowy silnik) === */
function buildRecipeSearchUI(){
  return `
    <div class="search-zone">
      <input id="recipeSearch" type="search" placeholder="Szukaj: składnik, efekt, objaw…" autocomplete="off" enterkeyhint="search" />
      <div id="recipeSuggestions" class="suggestions" aria-live="polite"></div>
      <div id="recipeTags" class="tags"></div>
      <p class="muted">Podpowiedzi pojawiają się nad polem. Kliknij lub naciśnij Enter, by dodać filtr-tag.</p>
    </div>
  `;
}

let RECIPES = [];          // aktualnie dostępne przepisy (z wybranego JSON-a rośliny)
let LEXICON = [];          // słownik słów kluczowych
const ACTIVE_TAGS = new Set();
const TAG_COLORS = new Map();
const COLOR_CLASSES = ['c0','c1','c2','c3','c4','c5'];

// normalizacja tekstu pod wyszukiwanie (usuwa znaki diakrytyczne i interpunkcję)
const normalizeText = s => (s||'')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')      // usuń diakrytyki
  .replace(/[^\p{L}\p{N}\s-]/gu, ' ')                   // wytnij interpunkcję
  .replace(/\s+/g,' ')
  .trim();

const splitTokens = s => normalizeText(s).split(' ').filter(Boolean);
const isWord = t => /^[\p{L}\p{N}-]{2,}$/u.test(t);

// --- Spłaszczanie całej treści obiektu do tekstu ---
function _collectStrings(val, out){
  if (val == null) return;
  if (typeof val === 'string'){
    out.push(val);
    return;
  }
  if (Array.isArray(val)){
    val.forEach(v => _collectStrings(v, out));
    return;
  }
  if (typeof val === 'object'){
    // Jeżeli obiekt ma kroki, potraktuj je jako sensowną listę
    const steps = val.kroki || val.steps;
    if (Array.isArray(steps)){
      steps.forEach(v => _collectStrings(v, out));
    }
    Object.values(val).forEach(v => _collectStrings(v, out));
  }
}

function objectToText(o){
  const bag = [];
  _collectStrings(o, bag);
  return normalizeText(bag.join(' '));
}

// Zbuduj „stóg siana” z CAŁEJ karty przepisu
function buildRecipeHay(r){
  // cache, żeby nie liczyć w kółko
  if (r.__hay) return r.__hay;

  const pieces = [
    r.t, r.metoda, r.typ,
    ...(r.tagi || []),
    ...(r.surowce || [])
  ];
  // pełna zawartość surowego wpisu (w tym: przygotowanie, zastosowanie, dawkowanie, uwagi, źródła itd.)
  if (r.raw) {
    pieces.push(objectToText(r.raw));
  }

  r.__hay = normalizeText(pieces.join(' '));
  return r.__hay;
}

function buildLexiconFromRecipes(list){
  const set = new Set();
  list.forEach(r=>{
    // standardowe pola
    splitTokens(r.t).forEach(t => isWord(t) && set.add(t));
    (r.tagi||[]).forEach(sk => splitTokens(sk).forEach(t => isWord(t) && set.add(t)));
    (r.surowce||[]).forEach(sk => splitTokens(sk).forEach(t => isWord(t) && set.add(t)));
    splitTokens(r.metoda||'').forEach(t => isWord(t) && set.add(t));
    splitTokens(r.typ||'').forEach(t => isWord(t) && set.add(t));

    // pełna treść surowa (ograniczamy do ~2000 znaków, by nie „zagazować” UI)
    const full = buildRecipeHay(r);
    splitTokens(full.slice(0, 2000)).forEach(t => isWord(t) && set.add(t));
  });

  // kilka uniwersalnych haseł
  ['napar','odwar','macerat','syrop','maść','okład','nalewka','herbata','blanszowane','świeże','suszone','młode']
    .forEach(t=>set.add(normalizeText(t)));

  return Array.from(set).sort();
}



function renderRecipeSuggestions(prefix){
  const box = document.getElementById('recipeSuggestions');
  if(!box) return;
  box.innerHTML = '';
  const q = normalizeText(prefix);
  if(!q || q.length<2) return;
  const items = LEXICON.filter(w => w.startsWith(q)).slice(0,12);
  items.forEach(w=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'suggestion';
    b.textContent = w;
    b.addEventListener('click', ()=> addRecipeTag(w));
    box.appendChild(b);
  });
}

async function addRecipeTag(tag){
  const t = normalizeText(tag);
  if(!t || ACTIVE_TAGS.has(t)) return;
  ACTIVE_TAGS.add(t);
  if(!TAG_COLORS.has(t)){
    TAG_COLORS.set(t, COLOR_CLASSES[(TAG_COLORS.size)%COLOR_CLASSES.length]);
  }
  const input = document.getElementById('recipeSearch');
  if(input){ input.value = ''; }
  const sugg = document.getElementById('recipeSuggestions');
  if(sugg){ sugg.innerHTML = ''; }

  renderRecipeTags();

  // klucz: poczekaj, aż recepty będą wczytane
  if(RECIPES_READY) { try{ await RECIPES_READY; }catch{} }

  applyRecipeFilters();
  ensureResultsVisible();
}


function removeRecipeTag(tag){
  ACTIVE_TAGS.delete(tag);
  renderRecipeTags();
  applyRecipeFilters();
}

function renderRecipeTags(){
  const wrap = document.getElementById('recipeTags');
  if(!wrap) return;
  wrap.innerHTML = '';
  Array.from(ACTIVE_TAGS).forEach(t=>{
    const span = document.createElement('span');
    span.className = `tag ${TAG_COLORS.get(t)}`;
    span.innerHTML = `<span>#${t}</span><span class="x" title="Usuń">×</span>`;
    span.querySelector('.x').addEventListener('click', ()=> removeRecipeTag(t));
    wrap.appendChild(span);
  });
}

function recipeMatches(r, terms){
  const hay = buildRecipeHay(r); // pełna treść
  if (!terms || !terms.length) return true;
  if (window.MATCH_MODE === 'OR'){
    return terms.some(t => hay.includes(t));
  }
  // domyślnie AND
  return terms.every(t => hay.includes(t));
}

function applyRecipeFilters(){
  const terms = Array.from(ACTIVE_TAGS);
  const list = terms.length ? RECIPES.filter(r=>recipeMatches(r, terms)) : RECIPES.slice();
  renderRecipeResults(list, terms);
}
// Pomocnicze
function toArray(x){
  if(!x) return [];
  if(Array.isArray(x)) return x.filter(Boolean);
  if(typeof x === 'string') return x.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  return [];
}
function safeHTML(s){ return (s||'').toString()
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// GŁÓWNY RENDERER „Legendy / Cechy i historia”
function renderLegendsView(plant){
  const box = document.getElementById('pap-bottom-content');
  if(!box) return;

  // Elastycznie znajdź sekcję w JSON (różne możliwe nazwy)
  const S = plant?.cechy_i_historia || plant?.legendy || plant?.legenda || plant?.historia || {};

  const opis = S.opis || S.description || plant?.opis_historyczny || '';
  const cechy = toArray(S.cechy || S.wyjatkowe_cechy || S.atrybuty);
  const zastos = toArray(S.zastosowanie_historyczne || S.zastosowania_historyczne || S.hist_zastosowania);
  const ciekaw = toArray(S.ciekawostki || S.fun_facts || S.anegdoty);

  // (opcjonalnie) źródła, jeśli przechowujesz je w tej sekcji
  const zrodla = toArray(S.zrodla || S.zrodlo || plant?.zrodla_legend);

  // Składanie HTML
  const hOpis = opis
    ? `<section class="card"><h3>Opis</h3><p>${safeHTML(opis)}</p></section>`
    : '';

  const hCechy = cechy.length
    ? `<section class="card"><h3>Cechy</h3><ul>${cechy.map(i=>`<li>${safeHTML(i)}</li>`).join('')}</ul></section>`
    : '';

  const hZastos = zastos.length
    ? `<section class="card"><h3>Zastosowanie historyczne</h3><ul>${zastos.map(i=>`<li>${safeHTML(i)}</li>`).join('')}</ul></section>`
    : '';

  const hCiekaw = ciekaw.length
    ? `<section class="card"><h3>Ciekawostki</h3><ul>${ciekaw.map(i=>`<li>${safeHTML(i)}</li>`).join('')}</ul></section>`
    : '';

  const hZrodla = zrodla.length
    ? `<section class="card"><h4 style="margin:.8rem 0 0.2rem">Źródła</h4>
         <ul class="muted">
           ${zrodla.map(u=>{
              // jeżeli to URL, zrób link; jeżeli opis książki – pokaż jako tekst
              const looksURL = /^https?:\/\//i.test(u);
              return `<li>${looksURL ? `<a href="${safeHTML(u)}" target="_blank" rel="noopener">${safeHTML(u)}</a>` : safeHTML(u)}</li>`;
            }).join('')}
         </ul>
       </section>`
    : '';

  const emptyState = (!opis && !cechy.length && !zastos.length && !ciekaw.length)
    ? `<p class="muted">Brak danych w sekcji „Cechy i historia” dla tej rośliny.</p>` : '';

  box.innerHTML = `
    <div class="stack" style="gap:1rem">
      <h2 style="margin:0">Cechy i historia</h2>
      ${hOpis}${hCechy}${hZastos}${hCiekaw}${hZrodla}${emptyState}
    </div>
  `;

  // Jeżeli masz helpery do aktualizacji wysokości „papirusu”, wywołaj:
  try{
    if (typeof updateStageHeightAfterAsyncContent === 'function') updateStageHeightAfterAsyncContent();
    else if (typeof scheduleStageHeight === 'function') scheduleStageHeight();
    if (typeof attachHeightObservers === 'function') attachHeightObservers();
  }catch{}
}

function renderRecipeResults(arr, terms){
  const box = document.getElementById('pap-bottom-content');
  if(!box) return;

  // Bezpieczna aktualizacja wysokości (fallback, gdy helpery nie istnieją)
  const safeUpdate = () => {
    try{
      if (typeof updateStageHeightAfterAsyncContent === 'function') {
        updateStageHeightAfterAsyncContent();
      } else {
        if (typeof scheduleStageHeight === 'function') scheduleStageHeight();
        if (typeof attachHeightObservers === 'function') attachHeightObservers();
      }
    }catch{}
  };

  // Czytelna etykieta użytych filtrów
  const filtersBadge = terms?.length
    ? `<p class="muted" style="margin:0 0 .6rem;">
         Filtry: ${terms.map(t=>`<b>#${t}</b>`).join(' ')}
       </p>`
    : '';

  // Stan „brak wyników”
  if(!arr || !arr.length){
    box.innerHTML = `
      ${filtersBadge || ''}
      <p class="placeholder" role="status" aria-live="polite">
        Brak wyników ${terms?.length ? `dla: ${terms.map(t=>`<b>#${t}</b>`).join(' ')}` : ''}.
        Spróbuj innego słowa lub usuń część tagów.
      </p>`;
    safeUpdate();
    return;
  }

  // Pomocnicze formatowanie wartości do HTML
  const asHTML = (val) => {
    if(val == null || val === '') return '';
    if(Array.isArray(val)){
      if(!val.length) return '';
      const allStrings = val.every(x => typeof x === 'string');
      if(allStrings) return '<ol>' + val.map(x=>`<li>${x}</li>`).join('') + '</ol>';
      return '<ul>' + val.map(x=>`<li>${asString(x)}</li>`).join('') + '</ul>';
    }
    if(typeof val === 'object'){
      const steps = getOneOf(val, ['kroki','steps']);
      if(Array.isArray(steps)) return '<ol>' + steps.map(x=>`<li>${x}</li>`).join('') + '</ol>';
      return autoListify(val);
    }
    return `<p>${val}</p>`;
  };

  // Linki/źródła
  const toUrl = (x) => {
    if(!x) return '';
    if(typeof x === 'string') return x;
    if(typeof x === 'object') return x.url || x.href || x.link || x.source || x.src || '';
    return '';
  };
      const simplifyUrl = (u) => {
      try {
        const url = new URL(u, window.location.href); // obsłuży też brak protokołu
        return url.origin; // tylko protokół + domena
      } catch {
        return u;
      }
    };

    const renderSources = (arr) => {
      const list = asArray(arr).map(toUrl).filter(Boolean);
      if(!list.length) return '';
      return '<ul class="source-list">' + list.map(u=>{
        const isHttp = /^(https?:)?\/\//i.test(u);
        if(!isHttp) return `<li>${u}</li>`;
        const short = rootUrl(u);
        return `<li><a href="${short}" target="_blank" rel="noopener">${short}</a></li>`;
      }).join('') + '</ul>';
    };

  // NAGŁÓWEK listy (licznik + filtry)
  const header = `
    <div class="muted" style="display:flex;justify-content:space-between;align-items:center;margin:0 0 .6rem;">
      <span role="status" aria-live="polite">Znaleziono: <b>${arr.length}</b></span>
      <span>${terms?.length ? `Filtry: ${terms.map(t=>`<b>#${t}</b>`).join(' ')}` : ''}</span>
    </div>`;

  // KARTY wyników
  const listHTML = '<ul class="results-list">' + arr.map(r=>{
    const R = r.raw || {};

    // ===== META (BEZ typu) =====
    const roslina = R.roslina || r.roslina || '';
    const latin   = R.nazwa_lacinska || R['nazwa_łacińska'] || r.nazwa_lacinska || '';
    const metaLine = [
      r.metoda || null,
      (roslina || latin) ? `roślina: ${roslina}${latin?` (${latin})`:''}` : null
    ].filter(Boolean).join(' • ');

    // ===== Cechy i Właściwości – pełne =====
    // ===== Cechy i Właściwości – OSOBNO =====
const cechyList = asArray(getOneOf(R, ['cechy','Cechy']))
  .map(asString)
  .filter(Boolean);

// Właściwości: bierz zarówno listę skrótów,
// jak i rozpisane "właściwości_i_składniki" (mapowane do "nazwa — działanie")
const wlasciwosciList = [
  ...asArray(getOneOf(R, ['właściwości','wlasciwosci'])).map(asString),
  ...asArray(getOneOf(R, ['właściwości_i_składniki','wlasciwosci_i_skladniki'])).map(it => {
    if (typeof it === 'string') return it;
    if (it && typeof it === 'object') {
      const name = it.nazwa || it.name;
      const eff  = it.działanie || it.dzialanie || it.effect || '';
      return name ? (eff ? `${name} — ${eff}` : name) : asString(it);
    }
    return '';
  })
].filter(Boolean);

// Gotowe HTML-e do wstrzyknięcia
const cechyHTML = cechyList.length
  ? `<ul>${cechyList.map(x=>`<li>${x}</li>`).join('')}</ul>` : '';

const wlasciwosciHTML = wlasciwosciList.length
  ? `<ul>${wlasciwosciList.map(x=>`<li>${x}</li>`).join('')}</ul>` : '';


    // Składniki
    const skladniki = r.surowce?.length
      ? r.surowce
      : asArray(getOneOf(R,['skladniki','składniki','surowce'])).map(asString);

    // Sposób przygotowania
    const przygotRaw = getOneOf(R, [
      'sposób przygotowania','sposob przygotowania',
      'sposob_przygotowania','sposób_przygotowania',
      'przygotowanie','wykonanie','instrukcja','kroki','steps'
    ]);
    const prepHTML = asHTML(przygotRaw);

    // Zastosowanie + Dawkowanie + Uwagi (obsługa różnych aliasów i struktur)
    const zastosowanie = getOneOf(R, [
      'zastosowanie','zastosowania',
      'zastosowanie_medyczne','zastosowanie_kulinarne',
      'stosowanie','sposob_stosowania','sposób_stosowania',
      'application','applications','use','uses'
    ]);

    const dawk = getOneOf(R, [
      'dawkowanie','dawka','dawki','porcja','porcje',
      'ile_razy_dziennie','częstotliwość','czestotliwosc',
      'stosowanie_dawkowanie','dawkowanie_i_stosowanie','dawkowanie_i_zastosowanie'
    ]);

    const uwagi  = getOneOf(R, [
      'uwagi','przeciwwskazania','ostrzezenia','ostrzeżenia','notatki'
    ]);
    // Źródła (pełne URL-e)
    const zrodlaList = [
      ...asArray(getOneOf(R, ['zrodla','źródła','sources','refs','bibliografia'])),
      ...asArray(getOneOf(R, ['zrodlo','źródło','source','link']))
    ].filter(Boolean);
    const zrodlaUniq = Array.from(new Set(zrodlaList));

    return `
      <li class="result-item">
        <div class="recipe-head">
          <h4>${r.t}</h4>
          <div class="badges">
            <span class="badge ${r.typ==='medyczny'?'med':'kul'}">${r.typ==='medyczny'?'medyczny':'kulinarny'}</span>
            ${r.metoda ? `<span class="badge met">${r.metoda}</span>` : ''}
          </div>
        </div>

        ${ metaLine ? `<div class="meta-line">${metaLine}</div>` : '' }
        ${ (r.tagi?.length) ? `<div class="tags-line">${r.tagi.map(t=>`#${t}`).join(' ')}</div>` : ''}

        ${ cechyHTML ? `
  <div class="recipe-sec">
    <h5>Cechy</h5>
    ${cechyHTML}
  </div>` : '' }

${ wlasciwosciHTML ? `
  <div class="recipe-sec">
    <h5>Właściwości</h5>
    ${wlasciwosciHTML}
  </div>` : '' }


        ${ skladniki?.length ? `
          <div class="recipe-sec">
            <h5>Składniki</h5>
            <ul>${skladniki.map(s=>`<li>${s}</li>`).join('')}</ul>
          </div>` : '' }

        ${ prepHTML ? `
          <div class="recipe-sec">
            <h5>Sposób przygotowania</h5>
            ${prepHTML}
          </div>` : '' }

        ${ zastosowanie ? `
          <div class="recipe-sec">
            <h5>Zastosowanie</h5>
            ${asHTML(zastosowanie)}
          </div>` : '' }

        ${ dawk ? `
          <div class="recipe-sec">
            <h5>Dawkowanie</h5>
            ${asHTML(dawk)}
          </div>` : '' }

        ${ uwagi ? `
          <div class="recipe-sec">
            <h5>Uwagi</h5>
            ${asHTML(uwagi)}
          </div>` : '' }

        ${ zrodlaUniq.length ? `
          <div class="recipe-sec">
            ${zrodlaUniq.length > 0 ? `<h5>Źródł${zrodlaUniq.length === 1 ? 'o' : 'a'}</h5>` : ''}
            ${renderSources(zrodlaUniq)}
          </div>` : '' }
      </li>
    `;
  }).join('') + '</ul>';

  // Wstaw wynik + aktualizacja wysokości (przydatne na telefonie)
  box.innerHTML = header + listHTML;
    if (typeof watchImagesForHeightUpdates === 'function') {
      watchImagesForHeightUpdates(box);
    }
    if (typeof updateStageHeightAfterAsyncContent === 'function') {
      updateStageHeightAfterAsyncContent();        // obrazki / długi HTML
    } else {
      if (typeof scheduleStageHeight === 'function') scheduleStageHeight();
      if (typeof attachHeightObservers === 'function') attachHeightObservers();
    }
    requestAnimationFrame(() => {
      if (typeof updateStageHeight === 'function') updateStageHeight();
    });
  if (typeof watchImagesForHeightUpdates === 'function') {
    watchImagesForHeightUpdates(box);
  }
  safeUpdate();

}


async function openPapyrus(section){
  // zakładamy, że te elementy są już pobrane gdzieś wyżej w Twoim kodzie:
  // const stage = document.getElementById('stage');
  // const cardsLayer = document.getElementById('cardsLayer');
  // const papLayer = document.getElementById('papyrusLayer');
  // const papyrus = document.getElementById('papyrus');
  // const topTitle = document.getElementById('pap-top-title');
  // const topContent = document.getElementById('pap-top-content');
  // const bottomContent = document.getElementById('pap-bottom-content');

  // --- globalne „flagi” dla przepisów (jeśli jeszcze nie istnieją) ---
  if (typeof window.RECIPES_READY === 'undefined') window.RECIPES_READY = null;  // Promise: wczytanie globalnych JSON-ów
  if (typeof window.MATCH_MODE    === 'undefined') window.MATCH_MODE    = 'AND'; // 'AND' / 'OR'

  // --- lokalne pomocnicze (bezpieczne dla mobile) ---
  function ensureResultsVisible(){
      // autoscroll tylko w sekcji PRZEPISY i tylko na urządzeniach dotykowych
      if (window.CURRENT_SECTION !== 'przepisy') return;
      if (!matchMedia('(pointer: coarse)').matches) return;

      const box = document.getElementById('pap-bottom-content');
      if(!box) return;
      try{
        box.scrollIntoView({ behavior:'smooth', block:'start' });
      }catch{}
    }

  function injectMatchModeToggle(){
    const wrap = document.querySelector('#pap-top-content .search-zone');
    if(!wrap || wrap.querySelector('[data-matchmode]')) return;

    const bar = document.createElement('div');
    bar.setAttribute('data-matchmode','');
    bar.style.cssText = 'display:flex;gap:.6rem;align-items:center;font-size:.9rem;color:#6b5947';
    bar.innerHTML = `
      <span>Tryb dopasowania:</span>
      <label><input type="radio" name="mmode" value="AND" checked> wszystkie słowa</label>
      <label><input type="radio" name="mmode" value="OR"> dowolne słowo</label>
    `;
    bar.addEventListener('change', e => {
      if(e.target.name === 'mmode'){
        window.MATCH_MODE = e.target.value === 'OR' ? 'OR' : 'AND';
        applyRecipeFilters?.();
      }
    });
    wrap.appendChild(bar);
  }

  // Delikatny patch: uodpornij addRecipeTag na „wyścig” ładowania + przewiń do listy
  if (typeof window.addRecipeTag === 'function' && typeof window.__origAddRecipeTag === 'undefined'){
    window.__origAddRecipeTag = window.addRecipeTag;
    window.addRecipeTag = async function(tag){
      if (window.RECIPES_READY) { try{ await window.RECIPES_READY; }catch{} }
      const res = window.__origAddRecipeTag.call(this, tag);
      ensureResultsVisible();
      return res;
    };
  }

  // pomocnicze: bezpieczne aktualizowanie wysokości po asynchronicznej treści
  hideCoffeeLayer?.();
  const updateAfterAsync = () => {
    try{
      if(typeof updateStageHeightAfterAsyncContent === 'function'){
        updateStageHeightAfterAsyncContent();
      }else{
        // fallback – ustal wysokość sceny do wysokości papirusu
        scheduleStageHeight?.();
        attachHeightObservers?.();
      }
    }catch{}
  };

  // WSPÓLNA ANIMACJA WEJŚCIA PAPIRUSU
  const animatePapyrusIn = () => {
    const cardsH = cardsLayer.scrollHeight;
    papLayer.style.visibility = 'hidden';
    papLayer.removeAttribute('aria-hidden');
    stage.style.height = cardsH + 'px';
    papLayer.style.transform = 'translateY(100%)';
    cardsLayer.style.transform = 'translateY(0)';

    requestAnimationFrame(()=>{
      papLayer.style.visibility = 'visible';
      scheduleStageHeight?.();
      attachHeightObservers?.();
      cardsLayer.style.transform = 'translateY(-100%)';
      papLayer.style.transform = 'translateY(0)';
      document.body.classList.add('peek-hidden');
      document.addEventListener('scroll', onScrollPeek, {passive:true});
      if(typeof watchPapyrusResize === 'function') watchPapyrusResize();
    });
  };

  // WSPÓLNY „efekt rozwinięcia” samego zwoju
  const playOpenAnim = () => {
    papyrus.classList.add('opening');
    papyrus.addEventListener('animationend', () => {
      papyrus.classList.remove('opening');
    }, { once: true });
  };

  // ==== SEKCJE ====
  if(section === 'przepisy'){
    topTitle.textContent = 'Przepisy: kulinarne i medyczne';
    topContent.innerHTML = buildRecipeSearchUI();
    bottomContent.innerHTML = '<p class="placeholder">Ładuję przepisy…</p>';

    // drobny UX na mobile: dopnij enterkeyhint/type gdyby UI builder nie ustawił
    const rs = document.getElementById('recipeSearch');
    if (rs){
      rs.setAttribute('type','search');
      rs.setAttribute('enterkeyhint','search');
    }

    playOpenAnim();

    // Wczytaj przepisy PEWNIE i dopiero wtedy podpinaj logikę Enter + podpowiedzi
    window.RECIPES_READY = (async () => {
      const list = await loadGlobalRecipes();
      RECIPES = list;
      LEXICON  = buildLexiconFromRecipes(list);

      const input = document.getElementById('recipeSearch');
      if(input){
        input.addEventListener('input', (e)=> renderRecipeSuggestions(e.target.value));
        input.addEventListener('keydown', (e)=>{
          if(e.key==='Enter'){
            e.preventDefault();
            const q = normalizeText(input.value);
            if(!q) return;
            const first = LEXICON.find(w => w.startsWith(q));
            addRecipeTag(first || q);      // bezpośrednio dodaj filtr
          }
        });
      }

      injectMatchModeToggle();   // przełącznik AND/OR
      applyRecipeFilters();      // startowo: pokaż wszystko
    })().catch(err=>{
      bottomContent.innerHTML = `<p class="placeholder">Nie udało się wczytać globalnych przepisów. ${err?.message||err}</p>`;
    }).finally(()=>{
      ensureResultsVisible();
      updateAfterAsync();
    });

    animatePapyrusIn();
    return;
  }

  else if(section === 'ogrodnictwo'){
    topTitle.textContent = 'Ogrodnictwo';
    topContent.innerHTML = buildHierarchy('ogrodnictwo');
    wireTreeControls(topContent);
    bottomContent.innerHTML = '<p class="placeholder">Wybierz roślinę, by o niej poczytać.</p>';
    playOpenAnim();
    topContent.querySelectorAll('[data-plant]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        renderPlant(a.getAttribute('data-plant'), 'ogrodnictwo');
        updateAfterAsync();
      });
    });
    updateAfterAsync();
  }

  else if(section === 'legendy'){
    topTitle.textContent = 'Legendy i historia';
    topContent.innerHTML = buildHierarchy('legendy');
    wireTreeControls(topContent);
    bottomContent.innerHTML = '<p class="placeholder">Wybierz roślinę, by o niej poczytać.</p>';
    playOpenAnim();
    topContent.querySelectorAll('[data-plant]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        renderPlant(a.getAttribute('data-plant'), 'legendy');
        updateAfterAsync();
      });
    });
    updateAfterAsync();
  }

  else if(section === 'kontakt'){
    // sekcja kontakt ma własną funkcję z animacją – po prostu deleguj
    if (typeof openKontaktPapyrus === 'function'){
      openKontaktPapyrus();
      return;
    }
  }

  // ===== DOMYŚLNE (gdyby przyszły inne sekcje) =====
  else{
    topTitle.textContent = 'Sekcja';
    topContent.innerHTML = '<p class="muted">Wybrano sekcję: ' + section + '</p>';
    bottomContent.innerHTML = '<p class="placeholder">Treść w przygotowaniu…</p>';
    playOpenAnim();
  }

  // wspólne domyślne wejście papirusu (dla ogrodnictwo/legendy/other)
  const cardsH = cardsLayer.scrollHeight;
  papLayer.style.visibility = 'hidden';
  papLayer.removeAttribute('aria-hidden');
  stage.style.height = cardsH + 'px';
  papLayer.style.transform = 'translateY(100%)';
  cardsLayer.style.transform = 'translateY(0)';

  requestAnimationFrame(()=>{
    papLayer.style.visibility = 'visible';
    scheduleStageHeight?.();
    attachHeightObservers?.();
    cardsLayer.style.transform = 'translateY(-100%)';
    papLayer.style.transform = 'translateY(0)';
    document.body.classList.add('peek-hidden');
    document.addEventListener('scroll', onScrollPeek, {passive:true});
    if(typeof watchPapyrusResize === 'function') watchPapyrusResize();
  });
}


// no-op, gdy nie ma modułu z kawą
window.hideCoffeeLayer = window.hideCoffeeLayer || function(){};


  // ZAMKNIĘCIE (Esc): papirus w dół, karty wracają
  function closePapyrus(){
    heightRO.disconnect();
    if(papRO){ papRO.disconnect(); papRO = null; }
    const cardsH = cardsLayer.scrollHeight;
    stage.style.height = cardsH + 'px';
    cardsLayer.style.transform = 'translateY(0%)';
    papLayer.style.transform = 'translateY(100%)';
    setTimeout(()=>{
      papLayer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('peek-visible','peek-hidden');
      document.removeEventListener('scroll', onScrollPeek);
    }, 620);
  }

  // PEEK: pokazuj tylko na samej górze strony
  function onScrollPeek(){
    if (!peek) return; // ⬅️ brak peeka? nic nie rób
    if (papLayer.getAttribute('aria-hidden') === 'true') return;
    const atTop = window.scrollY <= 2;
    document.body.classList.toggle('peek-visible', atTop);
    document.body.classList.toggle('peek-hidden', !atTop);
    peek.setAttribute('aria-hidden', atTop ? 'false' : 'true');
  }



  // Podpinanie klików (karty, nav, peek)
  function hookOpeners(root){
  if(!root) return;
    root.querySelectorAll('[data-section]').forEach(el=>{
      el.addEventListener('click', (e)=>{
        e.preventDefault();
        hideCoffeeLayer();
        openPapyrus(el.getAttribute('data-section'));
        history.replaceState(null, '', '#' + el.getAttribute('data-section'));
      });
    });
  }
  hookOpeners(document);
  if (peek) hookOpeners(peek);

  // ESC zamyka papirus
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape' && papLayer.getAttribute('aria-hidden')==='false'){
      closePapyrus();
      history.replaceState(null, '', ' ');
    }
  });

  // Otwórz po hashu
  const hash=(location.hash||'').replace('#','');
    if(!window.__openedByHash && ['legendy','przepisy','ogrodnictwo'].includes(hash)){
      openPapyrus(hash);
    }
  // Startowa wysokość sceny = wysokość kart
  function setStageStart(){ stage.style.height = cardsLayer.scrollHeight + 'px'; }
  setStageStart(); window.addEventListener('resize', setStageStart);
})();

// ——— AUTO-DOPASOWANIE WYSOKOŚCI SCENY ———
let __hRaf = null; // (jeśli nie przeniosłeś wyżej – zostaw tutaj)

function updateStageHeight(){
  // bezpiecznie pobierz elementy za każdym razem
  requestAnimationFrame(()=>{
    const papyrus = document.getElementById('papyrus');
    const stage   = document.getElementById('stage');
    if(!papyrus || !stage) return;
    const papH = papyrus.scrollHeight;
    stage.style.height = Math.max(560, papH) + 'px';
  });
}

// Obserwuj zmiany rozmiaru i treści w papirusie
const resizeObserver   = new ResizeObserver(()=> scheduleStageHeight());
const mutationObserver = new MutationObserver(()=> scheduleStageHeight());

const __pap = document.getElementById('papyrus');
if (__pap){
  resizeObserver.observe(__pap);
  mutationObserver.observe(__pap, { childList: true, subtree: true });
}

// Helper: po każdej zmianie zawartości (np. klik w hierarchii) podepnij „load” na obrazkach
function watchImagesForHeightUpdates(root = papyrus){
  root.querySelectorAll('img').forEach(img=>{
    if(!img.complete){
      img.addEventListener('load', updateStageHeight, { once:true });
      img.addEventListener('error', updateStageHeight, { once:true });
    }
  });
}

function scheduleStageHeight(min = 560){
  if (__hRaf) return;
  __hRaf = requestAnimationFrame(()=>{
    __hRaf = null;
    const papyrus = document.getElementById('papyrus');
    const stage = document.getElementById('stage');
    if(!papyrus || !stage) return;
    const h = Math.max(min, papyrus.scrollHeight);
    // wyłącz tranzycję na czas „ustawiania startu”, aby nie powodować zacięć
    const prev = stage.style.transition;
    stage.style.transition = (document.body.classList.contains('is-opening')) ? 'none' : prev;
    stage.style.height = h + 'px';
    // po klatce przywróć transition
    if (document.body.classList.contains('is-opening')){
      requestAnimationFrame(()=>{ stage.style.transition = prev; });
    }
  });
}

const heightRO = new ResizeObserver(()=> scheduleStageHeight());
function attachHeightObservers(){
  const papyrus = document.getElementById('papyrus');
  heightRO.disconnect();
  if (papyrus) heightRO.observe(papyrus);
  // jednorazowe podbicie wysokości po doładowaniu obrazów
  papyrus?.querySelectorAll('img').forEach(img=>{
    if(!img.complete){
      img.addEventListener('load', scheduleStageHeight, {once:true});
      img.addEventListener('error', scheduleStageHeight, {once:true});
    }
  });
}
function rootUrl(u){
  try{
    const url = new URL(u, location.origin);
    const host = url.hostname.replace(/^www\./,'');
    return `${url.protocol}//${host}/`;
  }catch{ return u; }
}
function domainLabel(u){
  try{
    return new URL(u, location.origin).hostname.replace(/^www\./,'');
  }catch{ return u; }
}


// === Fallback: zamień dowolne struktury na czytelny HTML ===
function autoListify(val){
  if(val == null) return '';
  if(Array.isArray(val)){
    if(!val.length) return '';
    return '<ul>' + val.map(v=>{
      if(typeof v === 'object')
        return `<li>${Object.entries(v).map(([k,x])=>`<b>${k}:</b> ${autoListify(x)}`).join('; ')}</li>`;
      // << NOWE: domena zamiast pełnego URL
      if(typeof v === 'string' && /^(https?:)?\/\//i.test(v)){
        const href = rootUrl(v);
        const txt  = domainLabel(v);
        return `<li><a href="${href}" target="_blank" rel="noopener">${txt}</a></li>`;
      }
      return `<li>${String(v)}</li>`;
    }).join('') + '</ul>';
  }
  if(typeof val === 'object'){
    const rows = Object.entries(val).map(([k,v])=>`<dt>${k.replaceAll('_',' ')}</dt><dd>${autoListify(v) || '—'}</dd>`).join('');
    return rows ? `<dl>${rows}</dl>` : '';
  }
  // << NOWE: domena zamiast pełnego URL także dla pojedynczego stringa
  if(typeof val === 'string' && /^(https?:)?\/\//i.test(val)){
    const href = rootUrl(val);
    const txt  = domainLabel(val);
    return `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;
  }
  return String(val);
}

function renderAUTO(raw){
  try{
    const { zdjecia, zdjęcia, photos, images, ...rest } = raw || {};
    const html = autoListify(rest);
    return html || '<p class="muted">Brak rozpoznanych pól do wyświetlenia.</p>';
  }catch(e){
    return `<pre class="code">${(e && e.message) || String(e)}</pre>`;
  }
}

// klik w nazwę zabiegu = przewiń + podświetl cel
document.addEventListener('click', (e) => {
  const a = e.target.closest('.zabieg-link');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = document.getElementById(id);
  if (!el) return;
  requestAnimationFrame(() => {
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 1700);
  });
});
// po otwarciu papirusu
stage.style.overflow = 'visible';

// a gdy wracasz do kart (zamykanie papirusu)
stage.style.overflow = 'hidden';

