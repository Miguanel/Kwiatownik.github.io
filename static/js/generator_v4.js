// /static/js/generator_v4.js — PEŁNA LOGIKA FRONTENDU (KAPSUŁKI, AUTOSUGESTIA, AND/OR FILTRY, RENDER)
// =====================================================================================================
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // --- STAN APLIKACJI: grupy filtrów + chips z inputu ---
  const state = {
    chips: new Set(),                   // aktywne tagi z inputu/autosugestii (AND)
    cele: new Set(),                    // OR w grupie
    typy_kulinarne: new Set(),          // OR
    typy_medyczne: new Set(),           // OR
    typy_mieszanki_palenia: new Set(),  // OR
    typy_eliksiry: new Set(),           // OR
    kategorie_roslin: new Set(),        // OR (drzewa/ziola/bulwy/korzenie)
    rosliny: new Set(),                 // OR (slugi roślin)
    smaki: new Set(),                   // OR
    pora: new Set(),                    // OR
    ksiezyc: new Set(),                 // OR
  };

  // --- RENDER CHIPSÓW W "AKTYWNE FILTRY" ---
  function renderActiveChips(){
    const area = $("#chip-area");
    if(!area) return;
    area.innerHTML = "";
    [...state.chips].forEach(word => {
      const el = document.createElement("span");
      el.className = "chip";
      el.innerHTML = `<span>${word}</span><span class="x" title="Usuń">✕</span>`;
      el.querySelector(".x").onclick = () => { state.chips.delete(word); triggerSearch(); renderActiveChips(); };
      area.appendChild(el);
    });
  }

  // --- AUTOSUGESTIA (5 trafień) ---
  const asBox = $("#autosuggest");
  let asTimer = null;
  async function suggest(q){
    if(!asBox) return;
    asBox.className = "autosuggest"; // reset
    asBox.innerHTML = "";
    const qq = (q||"").trim();
    if(qq.length < 2) return;

    try{
      const res = await fetch(`/api/suggest_words?q=${encodeURIComponent(qq)}`);
      const data = await res.json();
      if(!Array.isArray(data) || !data.length) return;

      asBox.classList.add("open");
      asBox.innerHTML = data.slice(0,5).map(w => `<div class="as-item" data-w="${w}">${w}</div>`).join("");
      $$(".as-item", asBox).forEach(el => el.addEventListener("click", () => {
        state.chips.add(el.dataset.w);
        $("#q").value = "";
        asBox.className = "autosuggest";
        asBox.innerHTML = "";
        renderActiveChips();
        triggerSearch();
      }));
    }catch(e){
      // cicho
    }
  }

  // --- ŁADOWANIE KATALOGU KAPSUŁEK (tylko to, co generujemy dynamicznie) ---
  async function loadFiltersCatalog(){
    try{
      const res = await fetch("/api/filters_catalog");
      const cat = await res.json();

      // Kategorie roślin
      const capsKat = $("#caps-kat-roslin");
      capsKat.innerHTML = (cat.kategorie_roslin || []).map(k =>
        `<button class="cap cap-kat" data-group="kategorie_roslin" data-val="${k}">${k}</button>`
      ).join("");

      // Cele
      const capsCele = $("#caps-cele");
      capsCele.innerHTML = (cat.cele || []).map(c =>
        `<button class="cap cap-cele" data-group="cele" data-val="${c}">${c}</button>`
      ).join("");

      // Typy
      $("#caps-typy-kulinarne").innerHTML = (cat.typy_kulinarne || []).map(t =>
        `<button class="cap cap-kul" data-group="typy_kulinarne" data-val="${t}">${t.replace(/_/g," ")}</button>`
      ).join("");

      $("#caps-typy-medyczne").innerHTML = (cat.typy_medyczne || []).map(t =>
        `<button class="cap cap-med" data-group="typy_medyczne" data-val="${t}">${t.replace(/_/g," ")}</button>`
      ).join("");

      $("#caps-typy-pal").innerHTML = (cat.typy_mieszanki_palenia || []).map(t =>
        `<button class="cap cap-pal" data-group="typy_mieszanki_palenia" data-val="${t}">${t.replace(/_/g," ")}</button>`
      ).join("");

      $("#caps-typy-eliksiry").innerHTML = (cat.typy_eliksiry || []).map(t =>
        `<button class="cap cap-elx" data-group="typy_eliksiry" data-val="${t}">${t.replace(/_/g," ")}</button>`
      ).join("");

      // Aktywacja nasłuchiwania na wszystkie kapsułki
      $$(".cap").forEach(btn => {
        btn.addEventListener("click", () => {
          const grp = btn.dataset.group;
          const val = btn.dataset.val;
          // toggle
          if(btn.classList.contains("active")){
            btn.classList.remove("active");
            (state[grp]||new Set()).delete(val);
          }else{
            btn.classList.add("active");
            if(!state[grp]) state[grp] = new Set();
            state[grp].add(val);
          }
          triggerSearch();
        });
      });
    }catch(e){
      console.error("Błąd ładowania katalogu filtrów:", e);
    }
  }

  // --- ŁADOWANIE ROŚLIN (drzewa/ziola/bulwy/korzenie) ---
  async function loadPlants(){
    try{
      const res = await fetch("/api/plants_list");
      const data = await res.json();

      function mk(pl, grpClassId){
        const box = $(grpClassId);
        if(!box) return;
        box.innerHTML = (pl||[]).map(p => `
          <button class="cap cap-plant" data-group="rosliny" data-val="${p.slug}">${p.name}</button>
        `).join("");
      }
      mk(data.drzewa,  "#caps-plants-drzewa");
      mk(data.ziola,   "#caps-plants-ziola");
      mk(data.bulwy,   "#caps-plants-bulwy");
      mk(data.korzenie,"#caps-plants-korzenie");

      // nasłuchiwanie
      $$("#caps-plants-drzewa .cap, #caps-plants-ziola .cap, #caps-plants-bulwy .cap, #caps-plants-korzenie .cap").forEach(btn => {
        btn.addEventListener("click", () => {
          const grp = btn.dataset.group;    // "rosliny"
          const val = btn.dataset.val;      // slug
          if(btn.classList.contains("active")){
            btn.classList.remove("active");
            state[grp].delete(val);
          }else{
            btn.classList.add("active");
            state[grp].add(val);
          }
          triggerSearch();
        });
      });
    }catch(e){
      console.error("Błąd ładowania listy roślin:", e);
    }
  }

  // --- INPUT / PRZYCISKI ---
  const qInput = $("#q");
  if(qInput){
    qInput.addEventListener("input", (e) => {
      const v = e.target.value;
      if(asTimer) clearTimeout(asTimer);
      asTimer = setTimeout(() => suggest(v), 140);
    });
    qInput.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){
        const v = (qInput.value||"").trim();
        if(v.length >= 2){
          state.chips.add(v);
          qInput.value = "";
          asBox.className = "autosuggest"; asBox.innerHTML = "";
          renderActiveChips();
          triggerSearch();
        }
        e.preventDefault();
      }
    });
  }

  const btnAdd = $("#btn-add");
  if(btnAdd){
    btnAdd.addEventListener("click", () => {
      const v = (qInput.value||"").trim();
      if(v.length >= 2){
        state.chips.add(v);
        qInput.value = "";
        asBox.className = "autosuggest"; asBox.innerHTML = "";
        renderActiveChips();
        triggerSearch();
      }
    });
  }

  const btnClear = $("#btn-clear");
  if(btnClear){
    btnClear.addEventListener("click", () => {
      // wyczyść wszystko
      for(const k of Object.keys(state)){
        if(state[k] instanceof Set) state[k].clear();
      }
      qInput.value = "";
      renderActiveChips();
      // odznacz wszystkie aktywne kapsułki
      $$(".cap.active").forEach(b => b.classList.remove("active"));
      $("#results").innerHTML = `<div class="muted">Użyj filtrów lub wyszukiwarki, aby zobaczyć przepisy.</div>`;
      $("#result-count").textContent = "—";
    });
  }

  const btnSearch = $("#btn-search");
  if(btnSearch){ btnSearch.addEventListener("click", () => triggerSearch()); }

  // --- RENDER KART PRZEPISÓW ---
  function renderRecipeCard(r){
    // ŹRÓDŁA — lista lub pojedynczy link
    let zrodloHTML = "";
    const z = r.zrodla || r.zrodlo;
    if (Array.isArray(z) && z.length){
      zrodloHTML = `
        <div class="grim-section">
          <div class="grim-label">📚 ŹRÓDŁA:</div>
          <ul class="grim-list">
            ${z.map(link => `<li><a href="${link}" target="_blank" rel="noopener">${link}</a></li>`).join("")}
          </ul>
        </div>`;
    } else if (typeof z === "string" && z.trim()){
      zrodloHTML = `
        <div class="grim-section">
          <div class="grim-label">📚 ŹRÓDŁA:</div>
          <div class="grim-text"><a href="${z}" target="_blank" rel="noopener">${z}</a></div>
        </div>`;
    }

    return `
    <div class="grim-card collapsed">
      <div class="grim-title">${r.nazwa || "(bez nazwy)"}</div>
      <div class="grim-content">
        ${r.roslina ? `
        <div class="grim-section">
          <div class="grim-label">🌿 ROŚLINA:</div>
          <div class="grim-text">${r.roslina}</div>
        </div>` : ""}

        ${r.rodzaj ? `
        <div class="grim-section">
          <div class="grim-label">⚗️ RODZAJ:</div>
          <div class="grim-text">${(r.rodzaj||"").replace(/_/g, " ")}</div>
        </div>` : ""}

        ${Array.isArray(r.skladniki) && r.skladniki.length ? `
        <div class="grim-section">
          <div class="grim-label">🧪 SKŁADNIKI:</div>
          <ul class="grim-list">
            ${r.skladniki.map(s => `<li>${s}</li>`).join("")}
          </ul>
        </div>` : ""}

        ${r.sposob_przygotowania ? `
        <div class="grim-section">
          <div class="grim-label">🧾 SPOSÓB PRZYGOTOWANIA:</div>
          <div class="grim-text">${r.sposob_przygotowania}</div>
        </div>` : ""}

        ${Array.isArray(r.cechy) && r.cechy.length ? `
        <div class="grim-section">
          <div class="grim-label">🛡️ CECHY:</div>
          <ul class="grim-list">
            ${r.cechy.map(c => `<li>${c}</li>`).join("")}
          </ul>
        </div>` : ""}

        ${Array.isArray(r.wlasciwosci) && r.wlasciwosci.length ? `
        <div class="grim-section">
          <div class="grim-label">💎 WŁAŚCIWOŚCI:</div>
          <ul class="grim-list">
            ${r.wlasciwosci.map(w => `<li>${w}</li>`).join("")}
          </ul>
        </div>` : ""}

        ${r.zastosowanie ? `
        <div class="grim-section">
          <div class="grim-label">🎯 ZASTOSOWANIE:</div>
          <div class="grim-text">${r.zastosowanie}</div>
        </div>` : ""}

        ${zrodloHTML}
      </div>
    </div>
    `;
  }

  // --- Collapsible ---
  document.addEventListener("click", function(e){
    if(e.target.classList.contains("grim-title")){
      const card = e.target.closest(".grim-card");
      if(card) card.classList.toggle("collapsed");
    }
  });

  // --- WYWOŁANIE API Z LOGIKĄ AND/OR (zgodnie z backendem) ---
  async function triggerSearch(){
    const payload = {
      q: "", // nie używamy z qInput, bo chips = źródło prawdy
      chips:    [...state.chips],
      cele:     [...state.cele],
      typy_kulinarne:         [...state.typy_kulinarne],
      typy_medyczne:          [...state.typy_medyczne],
      typy_mieszanki_palenia: [...state.typy_mieszanki_palenia],
      typy_eliksiry:          [...state.typy_eliksiry],
      kategorie_roslin:       [...state.kategorie_roslin],
      rosliny:  [...state.rosliny],
      smaki:    [...state.smaki],
      pora:     [...state.pora],
      ksiezyc:  [...state.ksiezyc],
    };

    try{
      const res = await fetch("/api/generator_przepisow", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if(!data.results || !data.results.length){
        $("#results").innerHTML = `<div class="muted">Brak wyników. Zmień filtry lub dodaj/usuń kapsułki.</div>`;
        $("#result-count").textContent = "0 wyników";
        return;
      }

      $("#results").innerHTML = data.results.map(renderRecipeCard).join("");
      $("#result-count").textContent = `${data.results.length} wyników`;
    }catch(e){
      console.error("Błąd pobierania wyników:", e);
      $("#results").innerHTML = `<div class="muted">Błąd podczas pobierania wyników.</div>`;
      $("#result-count").textContent = "—";
    }
  }

  // --- INIT ---
  document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([loadFiltersCatalog(), loadPlants()]);
    renderActiveChips();
    // Nie wywołujemy od razu triggerSearch() — pusta lista to intencja (wybór filtrów)
  });
})();
