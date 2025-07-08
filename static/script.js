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
};
