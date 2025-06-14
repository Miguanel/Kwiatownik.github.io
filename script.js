
fetch('pokrzywa_mock.json')
  .then(res => res.json())
  .then(data => {
    const plant = data["Pokrzywa zwyczajna"];
    document.getElementById("plant-name").textContent = "Pokrzywa zwyczajna";
    document.getElementById("plant-desc").textContent = plant.opis;
    document.getElementById("plant-vitamins").textContent = plant.cechy.witaminy;
    document.getElementById("plant-harvest").textContent = plant.cechy["zbiór"];

    const imgList = document.getElementById("plant-images");
    plant.obrazy.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "obraz rośliny";
      img.style.width = "150px";
      img.style.borderRadius = "8px";
      imgList.appendChild(img);
    });

    const recipeList = document.getElementById("recipes");
    plant.przepisy.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${p.nazwa}</strong><br>Składniki: ${p.skladniki}<br>${p.opis}<br><em>${p.uwaga}</em>`;
      recipeList.appendChild(li);
    });
  });
