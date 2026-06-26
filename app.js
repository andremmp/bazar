// 1) Publique sua planilha em CSV.
// 2) Cole o link CSV abaixo.
// Enquanto você não colar o link, o site usa produtos_exemplo.csv.
const SHEET_CSV_URL = "produtos_exemplo.csv";

const catalog = document.querySelector("#catalog");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const statusFilter = document.querySelector("#statusFilter");
const sortFilter = document.querySelector("#sortFilter");
const totalDisponiveis = document.querySelector("#totalDisponiveis");
const modal = document.querySelector("#productModal");
const modalContent = document.querySelector("#modalContent");
const closeModal = document.querySelector("#closeModal");

let products = [];

function parseCSV(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current || row.length) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
      }
      if (char === "\r" && next === "\n") i++;
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current.trim());
    rows.push(row);
  }

  const headers = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length > 1).map(row => {
    const item = {};
    headers.forEach((header, index) => item[header] = row[index] || "");
    return item;
  });
}

function money(value) {
  const number = Number(String(value).replace("R$", "").replace(".", "").replace(",", "."));
  if (Number.isNaN(number)) return value;
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function statusClass(status) {
  return normalize(status).replace("i", "i").replace("í", "i") || "disponivel";
}

function whatsappLink(product) {
  const phone = product.whatsapp || "5519999999999";
  const message = `Olá! Tenho interesse no item "${product.nome}" por ${money(product.preco)}. Ainda está disponível?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function fillCategories() {
  const categories = [...new Set(products.map(p => p.categoria).filter(Boolean))].sort();
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function getFilteredProducts() {
  const query = normalize(searchInput.value);
  const category = categoryFilter.value;
  const status = statusFilter.value;
  const sort = sortFilter.value;

  let filtered = products.filter(product => {
    const text = normalize(`${product.nome} ${product.categoria} ${product.descricao} ${product.estado}`);
    const matchesQuery = !query || text.includes(query);
    const matchesCategory = category === "Todas" || product.categoria === category;
    const matchesStatus = status === "Todos" || product.status === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === "menor-preco") return Number(a.preco) - Number(b.preco);
    if (sort === "maior-preco") return Number(b.preco) - Number(a.preco);
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });

  return filtered;
}

function render() {
  const filtered = getFilteredProducts();
  catalog.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  const available = products.filter(p => p.status === "Disponível").length;
  totalDisponiveis.textContent = available;

  filtered.forEach(product => {
    const isSold = product.status === "Vendido";
    const article = document.createElement("article");
    article.className = "product-card";
    article.innerHTML = `
      <img src="${product.foto1}" alt="Foto de ${product.nome}" loading="lazy">
      <div class="content">
        <span class="badge ${statusClass(product.status)}">${product.status || "Disponível"}</span>
        <h2>${product.nome}</h2>
        <div class="price">${money(product.preco)}</div>
        <div class="meta">${product.categoria || "Sem categoria"} · ${product.estado || "Estado não informado"}</div>
        <div class="meta">Qtd.: ${product.quantidade || 1}</div>
        <div class="actions">
          <button class="details" type="button">Detalhes</button>
          <a class="whatsapp ${isSold ? "disabled" : ""}" href="${whatsappLink(product)}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
    `;
    article.querySelector(".details").addEventListener("click", () => openProduct(product));
    catalog.appendChild(article);
  });
}

function openProduct(product) {
  const isSold = product.status === "Vendido";
  modalContent.innerHTML = `
    <div class="modal-body">
      <img src="${product.foto1}" alt="Foto de ${product.nome}">
      <div class="modal-info">
        <span class="badge ${statusClass(product.status)}">${product.status || "Disponível"}</span>
        <h2>${product.nome}</h2>
        <p class="price">${money(product.preco)}</p>
        <p>${product.descricao || "Sem descrição."}</p>
        <p class="meta"><strong>Categoria:</strong> ${product.categoria || "—"}</p>
        <p class="meta"><strong>Estado:</strong> ${product.estado || "—"}</p>
        <p class="meta"><strong>Medidas:</strong> ${product.medidas || "—"}</p>
        <p class="meta"><strong>Retirada:</strong> ${product.retirada || "Combinar"}</p>
        <a class="whatsapp ${isSold ? "disabled" : ""}" href="${whatsappLink(product)}" target="_blank" rel="noopener">Reservar pelo WhatsApp</a>
      </div>
    </div>
  `;
  modal.showModal();
}

async function loadProducts() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Não foi possível carregar a planilha.");
    const text = await response.text();
    products = parseCSV(text);
    fillCategories();
    render();
  } catch (error) {
    catalog.innerHTML = `<p class="empty">Erro ao carregar produtos: ${error.message}</p>`;
  }
}

[searchInput, categoryFilter, statusFilter, sortFilter].forEach(input => {
  input.addEventListener("input", render);
});

closeModal.addEventListener("click", () => modal.close());
modal.addEventListener("click", event => {
  if (event.target === modal) modal.close();
});

loadProducts();
