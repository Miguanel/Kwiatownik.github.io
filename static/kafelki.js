let dataGlobal = {};



function updateRecipeCounts(data) {
  if (!data) return;

  let medyczne = 0;
  let kulinarne = 0;
  let napoje = 0;

  if (data.przepisy_medyczne) {
    for (const val of Object.values(data.przepisy_medyczne)) {
      if (typeof val === "object" && val !== null) medyczne++;
    }
  }

  if (data.przepisy_kulinarne) {
    for (const val of Object.values(data.przepisy_kulinarne)) {
      if (typeof val === "object" && val !== null) kulinarne++;
    }
  }

  if (data.przepisy_kulinarne_napoje) {
    for (const val of Object.values(data.przepisy_kulinarne_napoje)) {
      if (typeof val === "object" && val !== null) napoje++;
    }
  }

  const setCount = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `[${count}]`;
  };

  setCount("count-medyczne", medyczne);
  setCount("count-kulinarne", kulinarne);
  setCount("count-napoje", napoje);
}



function highlightSelectedTile(tileId) {
  document.querySelectorAll('.sub-tile').forEach(el => {
    el.classList.remove('active');
  });
  const active = document.querySelector(`.sub-tile[data-category="${tileId}"]`);
  if (active) active.classList.add("active");
}


function formatTitle(txt) {
  if (!txt) return "";
  return txt.charAt(0).toUpperCase() + txt.slice(1).replace(/_/g, " ");
}
// Updated triggerSearch to support grouping by type or flat list of recipe titles
function triggerSearch() {
    const queries = Array.from(document.querySelectorAll('.recipe-search-input'))
        .map(e => e.value.trim().toLowerCase())
        .filter(q => q.length >= 3 && q.length <= 120);
    const resultsDiv = document.getElementById("searchResults");
    if (!queries.length) {
        resultsDiv.innerHTML = "<i>Wpisz co najmniej jedno słowo kluczowe (3–120 znaków)…</i>";
        return;
    }

    // Filter recipes
    const found = ALL_RECIPES.filter(({ przepis }) =>
      queries.every(q =>
        (Array.isArray(przepis.skladniki) &&
          przepis.skladniki.some(s => typeof s === "string" && s.toLowerCase().includes(q))) ||

        (Array.isArray(przepis.wlasciwosci) &&
          przepis.wlasciwosci.some(w => typeof w === "string" && w.toLowerCase().includes(q))) ||

        (Array.isArray(przepis.cechy) &&
          przepis.cechy.some(c => typeof c === "string" && c.toLowerCase().includes(q))) ||

        (typeof przepis.zastosowanie === "string" &&
          przepis.zastosowanie.toLowerCase().includes(q)) ||

        (typeof przepis.sposob_przygotowania === "string" &&
          przepis.sposob_przygotowania.toLowerCase().includes(q)) ||

        (typeof przepis.nazwa === "string" &&
          przepis.nazwa.toLowerCase().includes(q))
      )
    );


    if (!found.length) {
        resultsDiv.innerHTML = "<div style='margin-top:1.5em;color:#c43;font-weight:bold;'>Brak przepisów spełniających wszystkie warunki.</div>";
        return;
    }

    // Option A: Group by type
    const grouped = found.reduce((acc, { typ, nazwa }) => {
        (acc[typ] = acc[typ] || []).push(nazwa);
        return acc;
    }, {});
    let html = '';
    for (const [type, recipes] of Object.entries(grouped)) {
        html += `<h3 style="text-transform: capitalize;">${type}</h3><ul>`;
        recipes.forEach(name => html += `<li>${name}</li>`);
        html += '</ul>';
    }

    // Option B: Flat list of recipe titles
    // Uncomment below to use a simple list instead of grouping
    // html = '<ul>' + found.map(item => `<li>"${item.nazwa}"</li>`).join('') + '</ul>';

    resultsDiv.innerHTML = html;
}


document.addEventListener("DOMContentLoaded", () => {
  dataGlobal = window.data || {};
  updateRecipeCounts(dataGlobal);

  document.querySelectorAll(".sub-tile").forEach(el => {
    el.addEventListener("click", () => {
      const cat = el.dataset.category;
      if (!cat) return;

      const categoryMap = {
      medyczne: "przepisy_medyczne",
      kulinarne: "przepisy_kulinarne",
      napoje: "przepisy_kulinarne_napoje",
      chemiczne: "chemiczne",
      biologiczne: "biologiczne",
      magiczne: "magiczne"
    };

      const categoryKey = categoryMap[cat] || cat;
      if (["chemiczne", "biologiczne", "magiczne"].includes(categoryKey)) {
        renderWlasciwosci(categoryKey);
      } else {
//         renderFragment(categoryKey);
      }
      highlightSelectedTile(cat);

      const box = document.getElementById("dynamic-content");
      if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
});