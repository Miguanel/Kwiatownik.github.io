document.addEventListener("DOMContentLoaded", function() {
  const input = document.getElementById("tree-search");
  if (input) {
    input.addEventListener("input", function() {
      const query = this.value.trim().toLowerCase();
      const minLen = 1, maxLen = 80;
      document.querySelectorAll('.tree-segment').forEach(segment => {
        let anyVisible = false;
        segment.querySelectorAll('.tree-gatunek').forEach(li => {
          const text = li.textContent.toLowerCase();
          if (query.length >= minLen && query.length <= maxLen) {
            if (text.includes(query)) {
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
        segment.style.display = anyVisible ? "" : "none";
        segment.querySelectorAll('.tree-group-label').forEach(label => {
          let ul = label.nextElementSibling;
          let hasVisible = ul && ul.querySelectorAll('.tree-gatunek:not([style*=\"display: none\"])').length > 0;
          label.style.display = hasVisible ? "" : "none";
          if (ul) ul.style.display = hasVisible ? "" : "none";
        });
      });
    });
  }
});
