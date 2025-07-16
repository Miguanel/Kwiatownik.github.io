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
function showFavList() {
    let favs = getFavs();
    let ul = document.getElementById("fav-list");
    ul.innerHTML = "";
    if(favs.length==0) {ul.innerHTML = "<li>Brak ulubionych roślin.</li>"; return;}
    favs.forEach(function(path){
        let [cat, slug] = path.split("/");
        ul.innerHTML += `<li><a href="/${cat}/${slug}">${slug.replace("_"," ")}</a></li>`;
    });
}

function showGardenList() {
    let g = getGarden();
    let ul = document.getElementById("garden-list");
    ul.innerHTML = "";
    if(g.length==0) {ul.innerHTML = "<li>Nie masz roślin w ogrodzie.</li>"; return;}
    g.forEach(function(path){
        let [cat, slug] = path.split("/");
        ul.innerHTML += `<li><a href="/${cat}/${slug}">${slug.replace("_"," ")}</a></li>`;
    });
}

function addCompare(category, slug){
    let url = "/porownaj?roslina1=" + slug + "&roslina2=";
    let val = prompt("Podaj nazwę pliku drugiej rośliny (np. 'pokrzywa'):");
    if(val) url += val;
    window.location = url;
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