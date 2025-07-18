function toggleSection(header) {
    let content = header.nextElementSibling;
    let btn = header.querySelector('.toggle-btn');
    let isOpen = content.style.display !== "none";
    if(isOpen) {
        content.style.display = "none";
        btn.textContent = "rozwiń";
    } else {
        content.style.display = "";
        btn.textContent = "zwiń";
    }
}
window.onload = function() {
    if(typeof updateFavIcons === "function") updateFavIcons();
}
// ---- Karuzela zdjęć (jeśli jest) ----
let current = 0;
function carouselShow(idx) {
    const imgs = document.querySelectorAll("#carousel img");
    imgs.forEach((img,i) => img.style.display = (i===idx ? "block" : "none"));
}
function carouselPrev() {
    const imgs = document.querySelectorAll("#carousel img");
    current = (current-1+imgs.length)%imgs.length;
    carouselShow(current);
}
function carouselNext() {
    const imgs = document.querySelectorAll("#carousel img");
    current = (current+1)%imgs.length;
    carouselShow(current);
}

// ---- Obsługa ulubionych i ogrodu (z favs.js) ----
function getFavs() {
    return JSON.parse(localStorage.getItem("favs") || "[]");
}
function getGarden() {
    return JSON.parse(localStorage.getItem("garden") || "[]");
}

function updateFavIcons() {
    let favs = getFavs();
    let g = getGarden();
    document.querySelectorAll('.fav-btn').forEach(function(btn){
        if(favs.includes(btn.dataset.plant)) btn.style.opacity="1";
        else btn.style.opacity="0.4";
    });
    document.querySelectorAll('.garden-btn').forEach(function(btn){
        if(g.includes(btn.dataset.plant)) btn.style.opacity="1";
        else btn.style.opacity="0.4";
    });
}
// function showFavList() {
//     let favs = getFavs();
//     let ul = document.getElementById("fav-list");
//     ul.innerHTML = "";
//     if(favs.length==0) {ul.innerHTML = "<li>Brak ulubionych roślin.</li>"; return;}
//     favs.forEach(function(path){
//         let [cat, slug] = path.split("/");
//         // Znajdź polską nazwę:
//         let plant = allPlantsData.find(p => p.category === cat && p.slug === slug);
//         let name = plant ? plant.name : slug.replace("_"," ");
//         ul.innerHTML += `<li><a href="/${cat}/${slug}">${name}</a></li>`;
//     });
// }
// function showFavList() {
//     let favs = getFavs();
//     let ul = document.getElementById("fav-list");
//     ul.innerHTML = "";
//     if(favs.length==0) {ul.innerHTML = "<li>Brak ulubionych roślin.</li>"; return;}
//     favs.forEach(function(path){
//         let [cat, slug] = path.split("/");
//         let plant = allPlantsData.find(p => p.category === cat && p.slug === slug);
//         if(!plant) return;
//         ul.innerHTML += `
//         <li style="margin-bottom: 1.1em;">
//             <a href="/${cat}/${slug}">
//                 <b>${plant.name}</b>
//             </a>
//             <i style="color:#789044;">(${plant.latin})</i>
//             <span class="fav-btn" data-plant="${cat}/${slug}" onclick="toggleFav('${cat}/${slug}')">💚</span>
//             <span class="garden-btn" data-plant="${cat}/${slug}" onclick="toggleGarden('${cat}/${slug}')">🌱</span>
//             <br>
//             <small>${plant.data.nazwa_zbioru ? plant.data.nazwa_zbioru.join(" → ") : ""}</small>
//         </li>`;
//     });
// }
// function showFavList() {
//     let favs = getFavs();
//     let ul = document.getElementById("fav-list");
//     ul.innerHTML = "";
//     if(favs.length==0) {ul.innerHTML = "<li>Brak ulubionych roślin.</li>"; return;}
//     favs.forEach(function(path){
//         let [cat, slug] = path.split("/");
//         let plant = allPlantsData.find(p => {
//             console.log('Porównuję:', p.category, cat, '|', p.slug, slug);
//             return p.category === cat && p.slug === slug;
//         });
//         let name = plant ? plant.name : slug.replace("_"," ");
//         ul.innerHTML += `<li><a href="/${cat}/${slug}">${name}</a></li>`;
//     });
// }
function showFavList() {
    let favs = getFavs();
    let ul = document.getElementById("fav-list");
    ul.innerHTML = "";
    if(favs.length==0) {
        ul.innerHTML = "<li>Brak ulubionych roślin.</li>";
        return;
    }
    favs.forEach(function(path){
        let [cat, slug] = path.split("/");
        let plant = allPlantsData.find(p => p.category === cat && p.slug === slug);
        let name = plant ? plant.name : slug.replace("_"," ");
        ul.innerHTML += `<li><a href="/${cat}/${slug}">${name}</a></li>`;
    });
}
function showGardenList() {
    let g = getGarden();
    let ul = document.getElementById("garden-list");
    ul.innerHTML = "";
    if(g.length==0) {ul.innerHTML = "<li>Nie masz roślin w ogrodzie.</li>"; return;}
    g.forEach(function(path){
        let [cat, slug] = path.split("/");
        let plant = allPlantsData.find(p => p.category === cat && p.slug === slug);
        let name = plant ? plant.name : slug.replace("_"," ");
        ul.innerHTML += `<li><a href="/${cat}/${slug}">${name}</a></li>`;
    });
}
function addCompare(category, slug){
    let url = "/porownaj?roslina1=" + slug + "&roslina2=";
    let val = prompt("Podaj nazwę pliku drugiej rośliny (np. 'pokrzywa'):");
    if(val) url += val;
    window.location = url;
}

function findNextEvent(monthArray, label) {
    if(!monthArray) return null;
    let now = new Date();
    let currentMonth = now.getMonth() + 1;
    let currentDay = now.getDate();
    let currentYear = now.getFullYear();
    let sorted = monthArray.slice().sort((a,b)=>a-b);
    for(let i=0; i<sorted.length; ++i) {
        let m = sorted[i];
        if(m > currentMonth || (m === currentMonth && currentDay < 25)) {
            let date = new Date(currentYear, m-1, 1);
            let diff = Math.round((date - now) / (1000*60*60*24*7));
            return { label: label, month: m, weeks: diff };
        }
        if(m === currentMonth && currentDay >= 1 && currentDay <= 25) {
            return { label: label, month: m, weeks: 0 };
        }
    }
    if(sorted.length) {
        let m = sorted[0];
        let date = new Date(currentYear+1, m-1, 1);
        let diff = Math.round((date - now) / (1000*60*60*24*7));
        return { label: label, month: m, weeks: diff };
    }
    return null;
}

function showCalendar() {
    let favs = getFavs();
    let root = document.getElementById("calendar");
    if(favs.length==0) {root.innerHTML = "<i>Brak roślin w ulubionych.</i>"; return;}
    let months = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    let html = "<table class='calendar-table'><tr><th>Roślina</th>";
    for(let m=0;m<12;m++) html += `<th>${months[m]}</th>`;
    html += "<th>Status</th></tr>";
    favs.forEach(function(path){
        let [cat, slug] = path.split("/");
        let plant = allPlantsData.find(p=>p.category === cat && p.slug === slug);
        if(!plant) return;
        let kal = plant.data.kalendarz || {};
        let events = [];
        let nextZbior = findNextEvent(kal.zbior, "zbiór");
        let nextSiew = findNextEvent(kal.siew, "siew");
        let nextSadzenie = findNextEvent(kal.sadzenie, "sadzenie");
        [nextZbior, nextSiew, nextSadzenie].forEach(e=>{
            if(e && e.weeks >= 0 && e.weeks <= 8) events.push(e);
        });
        html += `<tr><td><b>${plant.name}</b> <i style="color:#789044;">(${plant.latin})</i></td>`;
        for(let m=1;m<=12;m++) {
            let ikony = '';
            if(kal.siew && kal.siew.includes(m)) ikony += '🌱';
            if(kal.sadzenie && kal.sadzenie.includes(m)) ikony += '🥬';
            if(kal.zbior && kal.zbior.includes(m)) ikony += '🍃';
            html += `<td style="text-align:center;">${ikony}</td>`;
        }
        if(events.length) {
            html += `<td style="color:#39790e;font-weight:bold;">`;
            events.forEach(e => {
                if(e.weeks === 0)
                    html += `<span style="color:#d95d1a;">Trwa ${e.label}!</span><br>`;
                else
                    html += `Za ${e.weeks} tyg. → <b>${e.label}</b><br>`;
            });
            html += `</td>`;
        } else {
            html += `<td style="color:#999;">Brak nadchodzących wydarzeń</td>`;
        }
        html += "</tr>";
    });
    html += "</table>";
    root.innerHTML = html;
}
// ---- Obsługa dynamicznego ładowania fragmentów rośliny ----
document.addEventListener('DOMContentLoaded', function() {

    if(document.querySelectorAll("#carousel img").length > 0)
        carouselShow(0);

    if(typeof updateFavIcons === "function") updateFavIcons();

    // Fragmenty rośliny (kafelkowe menu)
    const tilesMenu = document.getElementById("tiles-menu");
    const contentDiv = document.getElementById("plant-content");
    if(tilesMenu && contentDiv) {
        const btns = tilesMenu.querySelectorAll('.tile');
        // Wszystkie URL-e generuje Flask przez Jinja2 w atrybutach!
        const urls = {};
        btns.forEach(btn => {
            // Flask powinien dodać atrybut data-url do każdego kafelka:
            // <button class="tile" data-group="historia" data-url="/drzewa/dab_szypulkowy/fragment/historia">Historia</button>
            if(btn.dataset.url && btn.dataset.group) urls[btn.dataset.group] = btn.dataset.url;
        });
        // fallback (gdy nie ma data-url: budujemy z window.location)
        function buildUrl(group) {
            // np. "/drzewa/dab_szypulkowy/fragment/historia"
            let path = window.location.pathname;
            let parts = path.split('/').filter(Boolean);
            if(parts.length>=2)
                return `/${parts[0]}/${parts[1]}/fragment/${group}`;
            return `/fragment/${group}`;
        }
        function getUrl(group) {
            return urls[group] || buildUrl(group);
        }


        function loadPlantFragment(group) {
            if(!group) return;
            fetch(getUrl(group))
                .then(resp => {
                    if(!resp.ok) throw new Error("Błąd fragmentu: " + resp.status);
                    return resp.text();
                })
                .then(html => {
                    contentDiv.innerHTML = html;
                    if(typeof activatePrzepisyAccordion === "function") activatePrzepisyAccordion();
                    if(typeof setupAccordionSections === "function") setupAccordionSections();
                });
        }
        // Domyślnie historia lub pierwszy kafelek
        let first = btns[0];
        if(btns.length > 0) {
            let defaultGroup = first.dataset.group;
            loadPlantFragment(defaultGroup);
            first.classList.add("active");
        }
        btns.forEach(btn => {
            btn.onclick = function() {
                btns.forEach(b=>b.classList.remove("active"));
                btn.classList.add("active");
                loadPlantFragment(btn.dataset.group);
                setTimeout(() => {
                    contentDiv.scrollIntoView({behavior:"smooth"});
                }, 100);
            };
        });
    }
})

function toggleFav(category, slug) {
    let favs = getFavs();
    let key = category + "/" + slug;
    if(favs.includes(key)) favs = favs.filter(x=>x!==key);
    else favs.push(key);
    localStorage.setItem("favs", JSON.stringify(favs));
    updateFavIcons();
}

function toggleGarden(category, slug) {
    let g = getGarden();
    let key = category + "/" + slug;
    if(g.includes(key)) g = g.filter(x=>x!==key);
    else g.push(key);
    localStorage.setItem("garden", JSON.stringify(g));
    updateFavIcons();
}
function setupAccordionSections() {
    document.querySelectorAll("#plant-content .section-header").forEach(function(header){
        header.onclick = function() {
            toggleSection(header);
        }
        // Opcjonalnie: domyślnie zwinięte
        let content = header.nextElementSibling;
        if(content) content.style.display = "none";
        let btn = header.querySelector('.toggle-btn');
        if(!btn) {
            let span = document.createElement('span');
            span.className = "toggle-btn";
            span.textContent = "rozwiń";
            header.appendChild(span);
        }
    });
}
function activatePrzepisyAccordion() {
    document.querySelectorAll("#plant-content .przepis-card").forEach(function(card){
        let header = card.querySelector(".przepis-title");
        if(header) {
            header.onclick = function() {
                card.classList.toggle("collapsed");
            }
        }
    });
}