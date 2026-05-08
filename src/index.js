/**
 * Populate the parts table with data
 * This function is exposed to FileMaker to call from the webviewer
 * @param {Array} data - Array of part objects with properties: stockNumber, SerialNumber, ItemDescription, pickQty, f_stocked
 */

let allData = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';
let listenersInitialized = false;
let qtyDebounceTimer = null;

window.displayPartsTable = function(data) {
  // Handle both parsed objects and JSON strings
  const parsedData = typeof data === "string" ? JSON.parse(data) : data;
  
  // Ensure data is an array
  allData = Array.isArray(parsedData) ? parsedData : [parsedData];
  
  // Initialize event listeners
  if (!listenersInitialized) {
    initializeEventListeners();
    listenersInitialized = true;
  }
  
  // Render the table
  renderTable(allData);
  
  console.log(`Displayed ${allData.length} parts in table`);
  return true;
};

function initializeEventListeners() {
  // Sort headers
  document.querySelectorAll(".sortable").forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.dataset.column;
      
      if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
      }
      
      updateSortIndicators();
      applyFiltersAndSort();
    });
  });
  
  // Filter inputs
  document.getElementById("filter-stock").addEventListener("input", applyFiltersAndSort);
  document.getElementById("filter-serial").addEventListener("input", applyFiltersAndSort);
  document.getElementById("filter-desc").addEventListener("input", applyFiltersAndSort);
  document.getElementById("filter-qty").addEventListener("input", applyFiltersAndSort);
  
  // Clear filters button
  document.getElementById("clear-filters").addEventListener("click", clearFilters);
}

function applyFiltersAndSort() {
  let filtered = [...allData];
  
  // Apply filters
  const stockFilter = document.getElementById("filter-stock").value.toLowerCase();
  const serialFilter = document.getElementById("filter-serial").value.toLowerCase();
  const descFilter = document.getElementById("filter-desc").value.toLowerCase();
  const qtyFilter = document.getElementById("filter-qty").value.toLowerCase();
  
  filtered = filtered.filter((item) => {
    if (stockFilter && !String(item.stockNumber || "").toLowerCase().includes(stockFilter)) return false;
    if (serialFilter && !String(item.SerialNumber || "").toLowerCase().includes(serialFilter)) return false;
    if (descFilter && !String(item.ItemDescription || "").toLowerCase().includes(descFilter)) return false;
    if (qtyFilter && !String(item.pickQty || "").toLowerCase().includes(qtyFilter)) return false;
    return true;
  });
  
  // Apply sorting
  if (currentSortColumn) {
    filtered.sort((a, b) => {
      let aVal = a[currentSortColumn];
      let bVal = b[currentSortColumn];
      
      // Handle numeric and boolean values
      if (typeof aVal === "number" && typeof bVal === "number") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else {
        aVal = String(aVal || "").toLowerCase();
        bVal = String(bVal || "").toLowerCase();
      }
      
      if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  renderTable(filtered);
}

function updateSortIndicators() {
  document.querySelectorAll(".sortable i").forEach((icon) => {
    icon.className = "fas fa-arrows-v";
  });
  
  if (currentSortColumn) {
    const activeHeader = document.querySelector(`.sortable[data-column="${currentSortColumn}"]`);
    if (activeHeader) {
      const icon = activeHeader.querySelector("i");
      icon.className = currentSortDirection === 'asc' ? "fas fa-arrow-up" : "fas fa-arrow-down";
    }
  }
}

function clearFilters() {
  document.getElementById("filter-stock").value = "";
  document.getElementById("filter-serial").value = "";
  document.getElementById("filter-desc").value = "";
  document.getElementById("filter-qty").value = "";
  
  currentSortColumn = null;
  currentSortDirection = 'asc';
  updateSortIndicators();
  
  renderTable(allData);
}

function renderTable(dataToRender) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  
  dataToRender.forEach((item) => {
    const row = document.createElement("tr");
    
    const stockCell = document.createElement("td");
    const stockInput = document.createElement("input");
    stockInput.type = "text";
    stockInput.value = item.stockNumber || "";
    stockInput.className = "form-control form-control-sm stock-input";
    stockInput.maxLength = 3;
    stockInput.placeholder = "000";
    stockInput.addEventListener("input", () => {
      stockInput.value = stockInput.value.replace(/\D/g, "").slice(0, 3);
      item.stockNumber = stockInput.value;
      const isValid = /^\d{3}$/.test(stockInput.value);
      stockInput.classList.toggle("is-invalid", !isValid);
      stockInput.classList.toggle("is-valid", isValid);
      if (isValid) {
        callFileMakerScript(item);
      }
    });
    stockCell.appendChild(stockInput);
    
    const serialCell = document.createElement("td");
    serialCell.textContent = item.SerialNumber || "";
    serialCell.classList.add("align-middle");
    
    const descCell = document.createElement("td");
    descCell.textContent = item.ItemDescription || "";
    descCell.classList.add("align-middle");
    
    const qtyCell = document.createElement("td");
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.value = item.pickQty || "";
    qtyInput.className = "form-control form-control-sm qty-input";
    qtyInput.setAttribute("min", "0");
    qtyInput.setAttribute("step", "1");
    qtyInput.addEventListener("input", () => {
      item.pickQty = qtyInput.value;
    });
    qtyInput.addEventListener("change", () => {
      item.pickQty = qtyInput.value;
      clearTimeout(qtyDebounceTimer);
      qtyDebounceTimer = setTimeout(() => callFileMakerScript(item), 400);
    });
    qtyCell.appendChild(qtyInput);
    
    const printCell = document.createElement("td");
    printCell.classList.add("text-center", "align-middle");
    const printBtn = document.createElement("button");
    printBtn.className = "btn btn-sm btn-outline-secondary print-btn";
    printBtn.innerHTML = '<i class="fas fa-print"></i>';
    printBtn.addEventListener("click", () => {
      callFileMakerScript(item, "print");
    });
    printCell.appendChild(printBtn);

    row.appendChild(descCell);
    row.appendChild(serialCell);
    row.appendChild(stockCell);
    row.appendChild(qtyCell);
    row.appendChild(printCell);
    
    tbody.appendChild(row);
  });

  const countEl = document.getElementById("row-count");
  if (countEl) countEl.textContent = dataToRender.length;
}

function callFileMakerScript(item, mode = "edit") {
  if (typeof FileMaker === "undefined") return;
  const parameter = JSON.stringify({
    mode,
    record: {
      __ID: item.__ID,
      stockNumber: item.stockNumber,
      SerialNumber: item.SerialNumber,
      ItemDescription: item.ItemDescription,
      pickQty: item.pickQty,
      f_stocked: item.f_stocked
    }
  });
  FileMaker.PerformScript("PRT_S001 - Stocked Parts", parameter);
}