/* /static/js/generator_v3.js — PODMIEŃ CAŁY PLIK TĄ WERSJĄ
   --------------------------------------------------------
   ZAWIERA:
   - Ładowanie listy roślin z /api/plants_list (drzewa/ziola) + obsługa pustych list
   - Filtry: cele, typy, smaki, pory, księżyc, rośliny
   - Render kart w stylu grim-* (collapsed), ze źródłami (zrodla/zrodlo)
*/
(function(){
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  const state = {
    chips: [],
    cats: new Set(),
    types: new Set(),
    tastes: new Set(),
    timeOfDay: new Set(),
    moon: new Set(),
    plants: new Set(),
  };

  function validQuery(q){ return !!(q && q.trim().length > 1); }

  function addChip(str){
    const val = (str||"").trim().toLowerCase();
    if(!val || state.chips.includes(val)) return;
    state.chips.push(val);
    renderChips();
  }
  function removeChip(val){
    state.chips = state.chips.filter(x => x !== val);
    renderChips();
  }
  function renderChips(){
    const area = $("#chip-area");
    if(!area) return;
    area.innerHTML = "";
    state.chips.forEach(word => {
      const el = document.createElement("span");
      el.className = "chip";
      el.innerHTML = `<span>${word}</span><span class="x">✕</span>`;
      el.querySelector(".x").onclick = () => removeChip(word);
      area.appendChild(el);
    });
  }

  // Suggest – placeholder (wyłączony)
  const asBox = $("#autosuggest");
  async function suggest(q){
    if(!validQuery(q)){ if(asBox) asBox.style.display = "none"; return; }
    if(asBox) asBox.style.display = "none";
  }

  // === LISTA ROŚLIN (DRZEWA / ZIOŁA) ===
  async function loadPlants(){
    const treesBox = $("#plants-trees");
    const herbsBox = $("#plants-herbs");
    if(!treesBox || !herbsBox) return;

    treesBox.innerHTML = `<div class="muted" style="padding:.4rem">Ładowanie…</div>`;
    herbsBox.innerHTML = `<div class="muted" style="padding:.4rem">Ładowanie…</div>`;

    try{
      const res  = await fetch("/api/plants_list");
      const data = await res.json();

      const mkItem = (p) => {
        const slug = p.slug || toSlug(p.name || "");
        const id   = `pl-${slug}`;
        return `<label><input type="checkbox" class="f-plant" value="${slug}" id="${id}"> ${p.name}</label>`;
      };

      const drzewa = Array.isArray(data.drzewa) ? data.drzewa : [];
      const ziola  = Array.isArray(data.ziola)  ? data.ziola  : [];

      treesBox.innerHTML = drzewa.length ? drzewa.map(mkItem).join("") : `<div class="muted" style="padding:.4rem">Brak drzew</div>`;
      herbsBox.innerHTML = ziola.length  ? ziola.map(mkItem).join("")  : `<div class="muted" style="padding:.4rem">Brak ziół</div>`;

      $$(".f-plant").forEach(cb => cb.addEventListener("change", e => {
        e.target.checked ? state.plants.add(e.target.value) : state.plants.delete(e.target.value);
        triggerSearch();
      }));
    }catch(e){
      console.error("Nie udało się pobrać listy roślin:", e);
      treesBox.innerHTML = `<div class="muted" style="padding:.4rem">Błąd ładowania</div>`;
      herbsBox.innerHTML = `<div class="muted" style="padding:.4rem">Błąd ładowania</div>`;
    }
  }

  function toSlug(txt){
    return (txt||"")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "_");
  }

  // === NASŁUCH FILTRÓW ===
  $$(".f-cat").forEach(cb => cb.addEventListener("change", e => {
    e.target.checked ? state.cats.add(e.target.value) : state.cats.delete(e.target.value);
    triggerSearch();
  }));
  $$(".f-type").forEach(cb => cb.addEventListener("change", e => {
    e.target.checked ? state.types.add(e.target.value) : state.types.delete(e.target.value);
    triggerSearch();
  }));
  $$(".f-taste").forEach(cb => cb.addEventListener("change", e => {
    e.target.checked ? state.tastes.add(e.target.value) : state.tastes.delete(e.target.value);
    triggerSearch();
  }));
  $$(".f-time").forEach(cb => cb.addEventListener("change", e => {
    e.target.checked ? state.timeOfDay.add(e.target.value) : state.timeOfDay.delete(e.target.value);
    triggerSearch();
  }));
  $$(".f-moon").forEach(cb => cb.addEventListener("change", e => {
    e.target.checked ? state.moon.add(e.target.value) : state.moon.delete(e.target.value);
    triggerSearch();
  }));

  // === INPUT ===
  const qInput = $("#q");
  if(qInput){
    qInput.addEventListener("input", e => suggest(e.target.value));
    qInput.addEventListener("keydown", e => {
      if(e.key === "Enter"){
        const v = e.target.value.trim();
        if(validQuery(v)){ addChip(v); e.target.value = ""; if(asBox) asBox.style.display = "none"; triggerSearch(); }
        e.preventDefault();
      }
    });
  }

  // === RESET / SZUKAJ ===
  const btnClear  = $("#btn-clear");
  const btnSearch = $("#btn-search");
  if(btnClear){
    btnClear.onclick = () => {
      state.chips = [];
      state.cats.clear(); state.types.clear(); state.tastes.clear();
      state.timeOfDay.clear(); state.moon.clear(); state.plants.clear();
      $$("input[type=checkbox]").forEach(el => el.checked = false);
      renderChips();
      triggerSearch();
    };
  }
  if(btnSearch){
    btnSearch.onclick = () => triggerSearch();
  }

  // === RENDER KARTY (grim-*) ===
  function renderRecipeCard(r) {
    // ŹRÓDŁA — inline (lista lub pojedynczy link)
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
          <div class="grim-text">
            <a href="/ziola/${toSlug(r.roslina)}">${r.roslina}</a>
          </div>
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

  // === API CALL ===
  async function triggerSearch(){
    const payload = {
      q: state.chips.join(" "),
      cele:    [...state.cats],
      typy:    [...state.types],
      smaki:   [...state.tastes],
      pora:    [...state.timeOfDay],   // puste = brak filtra
      ksiezyc: [...state.moon],        // puste = brak filtra
      rosliny: [...state.plants],      // puste = brak filtra (slugi)
    };

    try {
      const res = await fetch("/api/generator_przepisow", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if(!data.results || !data.results.length){
        $("#results").innerHTML = `<div class="muted">Brak wyników. Spróbuj zmienić filtry lub zapytanie.</div>`;
        $("#result-count").textContent = "0 wyników";
        return;
      }

      const html = data.results.map(renderRecipeCard).join("");
      $("#results").innerHTML = html;
      $("#result-count").textContent = `${data.results.length} wyników`;
    } catch(e){
      console.error("❌ Błąd zapytania:", e);
      $("#results").innerHTML = `<div class="muted">Błąd podczas pobierania wyników.</div>`;
      $("#result-count").textContent = "—";
    }
  }

  // Collapsible
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("grim-title")) {
      const card = e.target.closest(".grim-card");
      if (card) card.classList.toggle("collapsed");
    }
  });

  // INIT
  document.addEventListener("DOMContentLoaded", async () => {
    await loadPlants();
    triggerSearch();
  });

})();
