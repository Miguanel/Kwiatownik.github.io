function getFavs() {
    return JSON.parse(localStorage.getItem("favs") || "[]");
}
function getGarden() {
    return JSON.parse(localStorage.getItem("garden") || "[]");
}
function toggleFav(slug) {
    let favs = getFavs();
    if(favs.includes(slug)) favs = favs.filter(x=>x!==slug);
    else favs.push(slug);
    localStorage.setItem("favs", JSON.stringify(favs));
    updateFavIcons();
}
function toggleGarden(slug) {
    let g = getGarden();
    if(g.includes(slug)) g = g.filter(x=>x!==slug);
    else g.push(slug);
    localStorage.setItem("garden", JSON.stringify(g));
    updateFavIcons();
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
    favs.forEach(function(slug){
        ul.innerHTML += `<li><a href="/ziola/${slug}">${slug.replace("_"," ")}</a></li>`;
    });
}
function showGardenList() {
    let g = getGarden();
    let ul = document.getElementById("garden-list");
    ul.innerHTML = "";
    if(g.length==0) {ul.innerHTML = "<li>Nie masz roślin w ogrodzie.</li>"; return;}
    g.forEach(function(slug){
        ul.innerHTML += `<li><a href="/ziola/${slug}">${slug.replace("_"," ")}</a></li>`;
    });
}
function addCompare(slug,category){
    let url = "/porownaj?roslina1="+slug+"&roslina2=";
    let val = prompt("Podaj nazwę pliku drugiej rośliny (np. 'pokrzywa'):");
    if(val) url += val;
    window.location = url;
}
