document.addEventListener("DOMContentLoaded", function() {
    const input = document.getElementById("tree-search");
    input.addEventListener("input", function() {
        const query = this.value.trim().toLowerCase();
        const minLen =1, maxLen = 80;
        // Pobierz wszystkie segmenty
        document.querySelectorAll('.tree-segment').forEach(segment => {
            let anyVisible = false;
            // Pokaż/ukryj elementy w segmentach
            segment.querySelectorAll('.tree-gatunek').forEach(li => {
                const text = li.textContent.toLowerCase();
                if(query.length >= minLen && query.length <= maxLen) {
                    if(text.includes(query)) {
                        li.style.display = "";
                        anyVisible = true;
                    } else {
                        li.style.display = "none";
                    }
                } else {
                    li.style.display = "";
                    anyVisible = true;
                }
            });
            // Ukryj cały segment jeśli nie ma żadnych widocznych wyników
            segment.style.display = anyVisible ? "" : "none";
            // Pokaż/ukryj grupy (labels) jeśli są potrzebne
            segment.querySelectorAll('.tree-group-label').forEach(label => {
                // Czy w tej grupie są jakieś widoczne elementy?
                let ul = label.nextElementSibling;
                let hasVisible = ul && ul.querySelectorAll('.tree-gatunek:not([style*="display: none"])').length > 0;
                label.style.display = hasVisible ? "" : "none";
                if(ul) ul.style.display = hasVisible ? "" : "none";
            });
        });
    });
});

