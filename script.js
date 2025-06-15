let plantsData = [];
        let expandedPlant = null;
        let expandedRecipe = {};

        // Załaduj dane z pliku json (data.json)
        fetch('data.json')
          .then(r => r.json())
          .then(d => {
              plantsData = d.plants;
              renderPlantList();
          });

        // Renderowanie listy roślin
        function renderPlantList(filtered=plantsData) {
            const ul = document.getElementById('plant-list');
            ul.innerHTML = '';
            filtered.forEach((plant, i) => {
                const li = document.createElement('li');
                li.className = 'plant-item';
                li.onclick = e => {
                    // Rozwijanie/schowanie detali
                    if (expandedPlant !== i) expandedPlant = i;
                    else expandedPlant = null;
                    expandedRecipe = {};
                    renderPlantList(filtered);
                };

                li.innerHTML =
                    <img class="plant-thumb" src="${plant.image}" alt="${plant.name}">
                    <span class="plant-title">${plant.name}</span>
                    <div class="plant-details${expandedPlant === i ? ' open' : ''}">
                        <div class="latin">${plant.latin}</div>
                        <p>${plant.description}</p>
                        <b>Zalecenia:</b> <span>${plant.advice}</span>
                        <div class="recipes">
                            <b>Przepisy:</b>
                            <ul>
                            ${plant.recipes.map((rec, j) => `
                                <li class="recipe-item">
                                    <div class="recipe-title" onclick="event.stopPropagation();toggleRecipe(${i},${j});">
                                        ${rec.name}
                                    </div>
                                    <div class="recipe-details${expandedRecipe[i+'_'+j] ? ' open' : ''}">
                                        <img class="recipe-img" src="${rec.image}" alt="${rec.name}">
                                        <b>Składniki:</b> <span>${rec.ingredients}</span><br>
                                        <b>Opis:</b> <span id="desc_${i}_${j}">${rec.desc_short}</span><br>
                                        <b>Wskazówka:</b> <span>${rec.warning}</span><br>
                                        <button class="more-btn" onclick="event.stopPropagation();toggleDesc(${i},${j});" id="btn_${i}_${j}">pokaż więcej</button>
                                    </div>
                                </li>
                            `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
                ul.appendChild(li);
            });
        }

        function toggleRecipe(i, j) {
            const key = i + '_' + j;
            expandedRecipe[key] = !expandedRecipe[key];
            renderPlantList();
        }
        function toggleDesc(i, j) {
            const rec = plantsData[i].recipes[j];
            const el = document.getElementById('desc_' + i + '_' + j);
            const btn = document.getElementById('btn_' + i + '_' + j);
            if (btn.innerText === "pokaż więcej") {
                el.innerText = rec.desc_long;
                btn.innerText = "pokaż mniej";
            } else {
                el.innerText = rec.desc_short;
                btn.innerText = "pokaż więcej";
            }
        }

        // Pasek wyszukiwania
        document.getElementById('search-toggle').onclick = () => {
            document.getElementById('search-bar').classList.toggle('open');
            setTimeout(()=>document.getElementById('search-input').focus(), 150);
        };
        document.getElementById('search-btn').onclick = () => searchPlant();
        document.getElementById('search-input').onkeydown = e => { if(e.key==='Enter') searchPlant(); };

        function searchPlant() {
            const q = document.getElementById('search-input').value.trim().toLowerCase();
            if (!q) { renderPlantList(); return; }
            const filtered = plantsData.filter(pl =>
                pl.name.toLowerCase().includes(q) ||
                pl.latin.toLowerCase().includes(q) ||
                pl.description.toLowerCase().includes(q) ||
                pl.advice.toLowerCase().includes(q) ||
                pl.recipes.some(r =>
                    r.name.toLowerCase().includes(q) ||
                    r.ingredients.toLowerCase().includes(q) ||
                    r.desc_short.toLowerCase().includes(q) ||
                    r.desc_long.toLowerCase().includes(q)
                )
            );
            renderPlantList(filtered);
        }