// Dados dos produtos publicados diretamente pelo Google Planilhas.
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtT5ShOCOTiXQUUk78IrNEEM4UZxrRJ7u11iJVnoPRjiYlFsv3SXF67CIE7UtkoaX42v6JmnPzJNSn/pub?gid=0&single=true&output=csv";

// Depois de publicar o Google Apps Script, cole aqui a URL terminada em /exec.
// Enquanto estiver vazio, o site tentará usar imagens locais como "6.jpeg".
const IMAGE_MANIFEST_URL = "https://script.google.com/macros/s/AKfycbyBamiELp0V2NZA2xdA8lMRbpY3MD3TQBIQjCSLbjJe5UIFYn-_GNKX5Y6-8-zmPoWX/exec";
const WHATSAPP_PHONE = "5511997250908";

const catalog = document.querySelector("#catalog");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const statusFilter = document.querySelector("#statusFilter");
const availabilityFilter = document.querySelector("#availabilityFilter");
const sortFilter = document.querySelector("#sortFilter");
const totalDisponiveis = document.querySelector("#totalDisponiveis");
const modal = document.querySelector("#productModal");
const modalContent = document.querySelector("#modalContent");
const closeModal = document.querySelector("#closeModal");

let products = [];
let imageManifest = {};

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
  const number = Number(String(value).replace("R$", "").replaceAll(".", "").replace(",", "."));
  if (Number.isNaN(number)) return value;
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function statusClass(status) {
  return normalize(status) || "disponivel";
}

function isImmediate(product) {
  return normalize(product.retirada).includes("imediata");
}

function isOctober(product) {
  return normalize(product.retirada).includes("outubro") || normalize(product.retirada).includes("10/2026");
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  }[character]));
}

function whatsappLink(product) {
  const message = `Olá! Tenho interesse no produto ID ${product.id} — "${product.nome}" por ${money(product.preco)}. Ainda está disponível?`;
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

function productImage(product) {
  const id = String(product.id || "").trim();
  return imageManifest[id] || `${id}.jpeg`;
}

async function loadImageManifest() {
  if (!IMAGE_MANIFEST_URL) return;

  try {
    const response = await fetch(IMAGE_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar a lista de fotos.");

    const data = await response.json();
    imageManifest = data.images || data;
  } catch (error) {
    console.warn("As fotos do Google Drive não puderam ser carregadas:", error);
    imageManifest = {};
  }
}

function shouldDisplay(product) {
  return normalize(product.exibir) === "sim";
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

function matchesAvailability(product, availability) {
  if (availability === "Todas") return true;
  if (availability === "Imediata") return isImmediate(product);
  if (availability === "Outubro") return isOctober(product);
  return true;
}

function getNumericPrice(product) {
  return Number(String(product.preco).replace("R$", "").replaceAll(".", "").replace(",", ".")) || 0;
}

function getFilteredProducts() {
  const query = normalize(searchInput.value);
  const category = categoryFilter.value;
  const status = statusFilter.value;
  const availability = availabilityFilter.value;
  const sort = sortFilter.value;
  
  let filtered = products.filter(product => {
    const text = normalize(`${product.nome} ${product.categoria} ${product.descricao} ${product.estado}`);
    const matchesQuery = !query || text.includes(query);
    const matchesCategory = category === "Todas" || product.categoria === category;
    const matchesStatus = status === "Todos" || product.status === status;
    const matchesAvailabilityFilter = matchesAvailability(product, availability);
    const isVisible = shouldDisplay(product);
    return isVisible && matchesQuery && matchesCategory && matchesStatus && matchesAvailabilityFilter;
  });

  filtered.sort((a, b) => {
    if (sort === "menor-preco") return getNumericPrice(a) - getNumericPrice(b);
    if (sort === "maior-preco") return getNumericPrice(b) - getNumericPrice(a);
    return String(a.nome).localeCompare(String(b.nome), "pt-BR");
  });

  return filtered;
}

function render() {
  const filtered = getFilteredProducts();
  catalog.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  const available = products.filter(p => shouldDisplay(p) && normalize(p.status) === "disponivel").length;
  totalDisponiveis.textContent = available;

  filtered.forEach(product => {
    const isSold = product.status === "Vendido";
    const article = document.createElement("article");
    article.className = "product-card";
    article.innerHTML = `
      <img class="product-image" src="${escapeHTML(productImage(product))}" alt="Foto de ${escapeHTML(product.nome)}" loading="lazy" role="button" tabindex="0" aria-label="Abrir imagem de ${escapeHTML(product.nome)} em tamanho original">
      <div class="content">
        <span class="badge ${statusClass(product.status)}">${escapeHTML(product.status || "Disponível")}</span>
        <h2>${escapeHTML(product.nome)}</h2>
        <div class="price">${money(product.preco)}</div>
        <div class="meta">${escapeHTML(product.categoria || "Sem categoria")} · ${escapeHTML(product.estado || "Estado não informado")}</div>
        <div class="meta">Qtd.: ${escapeHTML(product.quantidade || 1)}</div>
        <div class="meta">${escapeHTML(product.retirada || "Retirada a combinar")}</div>
        <div class="actions">
          <button class="details" type="button">Detalhes</button>
          <a class="whatsapp ${isSold ? "disabled" : ""}" href="${whatsappLink(product)}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
    `;
    const productImageElement = article.querySelector(".product-image");

    productImageElement.addEventListener("click", () => openImage(product));
    productImageElement.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openImage(product);
      }
    });

    article.querySelector(".details").addEventListener("click", () => openProduct(product));
    catalog.appendChild(article);
  });
}

function openImage(product) {
  modal.classList.add("image-viewer");
  modalContent.innerHTML = `
    <div class="image-only-wrap">
      <img src="${escapeHTML(productImage(product))}" alt="Foto ampliada de ${escapeHTML(product.nome)}">
    </div>
  `;
  modal.showModal();
}

function openProduct(product) {
  modal.classList.remove("image-viewer");
  const isSold = product.status === "Vendido";
  modalContent.innerHTML = `
    <div class="modal-body">
      <img src="${escapeHTML(productImage(product))}" alt="Foto de ${escapeHTML(product.nome)}">
      <div class="modal-info">
        <span class="badge ${statusClass(product.status)}">${escapeHTML(product.status || "Disponível")}</span>
        <h2>${escapeHTML(product.nome)}</h2>
        <p class="price">${money(product.preco)}</p>
        <p>${escapeHTML(product.descricao || "Sem descrição.")}</p>
        <p class="meta"><strong>Categoria:</strong> ${escapeHTML(product.categoria || "—")}</p>
        <p class="meta"><strong>Estado:</strong> ${escapeHTML(product.estado || "—")}</p>
        <p class="meta"><strong>Quantidade:</strong> ${escapeHTML(product.quantidade || 1)}</p>
        <p class="meta"><strong>Medidas:</strong> ${escapeHTML(product.medidas || "—")}</p>
        <p class="meta"><strong>Retirada:</strong> ${escapeHTML(product.retirada || "Combinar")}</p>
        <a class="whatsapp ${isSold ? "disabled" : ""}" href="${whatsappLink(product)}" target="_blank" rel="noopener">Reservar pelo WhatsApp</a>
      </div>
    </div>
  `;
  modal.showModal();
}

async function loadProducts() {
  try {
    const [response] = await Promise.all([
      fetch(SHEET_CSV_URL, { cache: "no-store" }),
      loadImageManifest()
    ]);
    if (!response.ok) throw new Error("Não foi possível carregar a planilha.");
    const text = await response.text();
    products = parseCSV(text).filter(shouldDisplay);
    fillCategories();
    render();
  } catch (error) {
    catalog.innerHTML = `<p class="empty">Erro ao carregar produtos: ${escapeHTML(error.message)}</p>`;
  }
}

[searchInput, categoryFilter, statusFilter, availabilityFilter, sortFilter].forEach(input => {
  input.addEventListener("input", render);
});

function closeProductModal() {
  modal.close();
  modal.classList.remove("image-viewer");
}

closeModal.addEventListener("click", closeProductModal);
modal.addEventListener("click", event => {
  if (event.target === modal) closeProductModal();
});

loadProducts();
