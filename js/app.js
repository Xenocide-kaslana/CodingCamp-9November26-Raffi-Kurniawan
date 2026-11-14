/* =============================================================
   Expense & Budget Visualizer — app.js
   Single JavaScript file. No frameworks, no build step.

   Architecture:
     User Action -> Event Handler -> Validation -> State Update
       -> Local Storage Sync -> UI Render

   Sections:
     1. Constants
     2. Storage module
     3. State (single source of truth)
     4. Validator
     5. Utilities (id generation, formatting)
     6. DOM references (cached in init)
     7. Render functions (stubs — filled in by later tasks)
     8. Event handlers (stubs — wired in later tasks)
     9. Initialization
   ============================================================= */

(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. Constants
     --------------------------------------------------------- */
  const STORAGE_KEY = "ebv_transactions";
  const THEME_KEY = "ebv_theme";
  const CATEGORIES = ["Food", "Transport", "Fun"];

  // Fixed category colors so chart slices stay consistent across renders.
  // These mirror the CSS custom properties (--cat-food, --cat-transport,
  // --cat-fun) but are plain hex values because Chart.js needs concrete
  // colors rather than CSS variable references.
  const CATEGORY_COLORS = {
    Food: "#ea580c",
    Transport: "#2563eb",
    Fun: "#db2777"
  };

  /* ---------------------------------------------------------
     2. Storage module
     --------------------------------------------------------- */

  // Flag set by isStorageAvailable(); read elsewhere to decide
  // whether persistence is possible for this session.
  let storageAvailable = true;

  /**
   * Tests whether localStorage can be accessed. Sets the module
   * flag `storageAvailable` and returns a boolean.
   */
  function isStorageAvailable() {
    try {
      const testKey = "__ebv_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      storageAvailable = true;
      return true;
    } catch (e) {
      storageAvailable = false;
      return false;
    }
  }

  /**
   * Reads and parses the saved transactions array from localStorage.
   * Returns an empty array on corruption, when unavailable, or when
   * no data is saved. Logs a warning when saved data is corrupt.
   */
  function loadTransactions() {
    if (!isStorageAvailable()) {
      return [];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn("Saved transactions are not an array; starting fresh.");
        return [];
      }
      return parsed;
    } catch (e) {
      console.warn("Could not parse saved transactions; starting fresh.", e);
      return [];
    }
  }

  /**
   * Persists the transactions array to localStorage as JSON.
   * Returns true on success, false on failure. On failure the
   * in-memory state is left intact (caller decides how to notify).
   */
  function saveTransactions(transactions) {
    if (!storageAvailable) {
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (e) {
      console.warn("Failed to save transactions to localStorage.", e);
      return false;
    }
  }

  /**
   * Reads the saved theme preference. Returns "light", "dark", or
   * null if nothing is saved (or storage is unavailable).
   */
  function loadTheme() {
    if (!isStorageAvailable()) {
      return null;
    }
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw === "light" || raw === "dark") {
        return raw;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Persists the theme string to localStorage. Wrapped in try/catch
   * so a failure never throws to the caller.
   */
  function saveTheme(theme) {
    if (!storageAvailable) {
      return;
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      console.warn("Failed to save theme to localStorage.", e);
    }
  }

  /* ---------------------------------------------------------
     3. State (single source of truth)
     --------------------------------------------------------- */
  const state = {
    transactions: [],        // Transaction[] — loaded from / synced to localStorage
    sortMode: "default",     // "default" | "amount" | "category"
    selectedMonth: null,     // Date — first day of the currently viewed month
    theme: "light"           // "light" | "dark"
  };

  /* ---------------------------------------------------------
     Chart instance (created once in initChart, updated in place)
     --------------------------------------------------------- */
  let pieChartInstance = null;

  /* ---------------------------------------------------------
     4. Validator
     --------------------------------------------------------- */

  /**
   * Validates a transaction's input fields.
   * @param {string} name      - the item name (raw, will be trimmed)
   * @param {*} amount         - the amount (may be string or number)
   * @param {string} category  - the category string
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  function validateTransaction(name, amount, category) {
    const errors = {};

    // Name: must be a non-empty string after trimming whitespace.
    if (typeof name !== "string" || name.trim().length === 0) {
      errors.name = "Item name is required.";
    }

    // Amount: must parse to a finite number greater than zero.
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      errors.amount = "Amount must be a valid positive number.";
    }

    // Category: must be one of the allowed categories.
    if (CATEGORIES.indexOf(category) === -1) {
      errors.category = "Please select a valid category.";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors
    };
  }

  /* ---------------------------------------------------------
     5. Utilities
     --------------------------------------------------------- */

  /**
   * Generates a unique id for a transaction. Uses crypto.randomUUID
   * when available, falling back to a timestamp + random string.
   */
  function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  // Consistent currency-style formatter used across the app.
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  /**
   * Formats a number as a currency string (e.g. 12.5 -> "$12.50").
   */
  function formatAmount(value) {
    return currencyFormatter.format(Number(value) || 0);
  }

  /**
   * Returns a new Date set to the first day of the month of the
   * given date. Used to normalize state.selectedMonth.
   */
  function getFirstOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /* ---------------------------------------------------------
     6. DOM references (cached in init)
     --------------------------------------------------------- */
  const dom = {
    themeToggle: null,
    themeLabel: null,
    totalAmount: null,
    expenseForm: null,
    itemName: null,
    amount: null,
    category: null,
    formErrors: null,
    sortSelect: null,
    transactionList: null,
    listEmpty: null,
    pieChart: null,
    chartEmpty: null,
    prevMonth: null,
    nextMonth: null,
    monthLabel: null,
    monthlyTotal: null,
    monthlyBreakdown: null
  };

  /* ---------------------------------------------------------
     7. Render functions (stubs — filled in by later tasks)
     ---------------------------------------------------------
     These are safe to call during init even before their full
     implementations are added. Later tasks replace the bodies.
     --------------------------------------------------------- */

  /**
   * Renders the total spending: sums all transaction amounts and
   * displays the formatted currency value in the total card.
   * Guards against a null DOM reference.
   */
  function renderTotal() {
    var total = state.transactions.reduce(function (sum, tx) {
      return sum + (Number(tx.amount) || 0);
    }, 0);
    if (dom.totalAmount) {
      dom.totalAmount.textContent = formatAmount(total);
    }
  }

  /**
   * Renders the transaction list from state. Applies the current
   * sort mode to a DISPLAY COPY so state.transactions is never
   * mutated. Toggles the empty-state message as needed.
   */
  function renderTransactionList() {
    if (!dom.transactionList) {
      return;
    }

    // 1. Produce a display copy sorted by the current sort mode.
    //    Never mutate state.transactions — always copy first.
    var display = state.transactions.slice();

    if (state.sortMode === "amount") {
      // Ascending: smallest amount first.
      display.sort(function (a, b) {
        return a.amount - b.amount;
      });
    } else if (state.sortMode === "category") {
      // Ascending: category name alphabetically.
      display.sort(function (a, b) {
        if (a.category < b.category) {
          return -1;
        }
        if (a.category > b.category) {
          return 1;
        }
        return 0;
      });
    }
    // "default" keeps the original order of state.transactions.

    // 2. Clear any existing list rows before re-rendering.
    dom.transactionList.textContent = "";

    // 3. Toggle the empty-state message.
    if (state.transactions.length === 0) {
      if (dom.listEmpty) {
        dom.listEmpty.classList.remove("hidden");
      }
      return;
    }

    if (dom.listEmpty) {
      dom.listEmpty.classList.add("hidden");
    }

    // 4. Build a row for each transaction in the display copy.
    //    Use a DocumentFragment to minimize reflows.
    var fragment = document.createDocumentFragment();

    display.forEach(function (tx) {
      var li = document.createElement("li");
      li.className = "transaction-list__item";

      // Item name
      var nameSpan = document.createElement("span");
      nameSpan.className = "transaction-list__name";
      nameSpan.textContent = tx.name;
      li.appendChild(nameSpan);

      // Amount (formatted as currency)
      var amountSpan = document.createElement("span");
      amountSpan.className = "transaction-list__amount";
      amountSpan.textContent = formatAmount(tx.amount);
      li.appendChild(amountSpan);

      // Category badge
      var badgeSpan = document.createElement("span");
      badgeSpan.className = "category-badge category-badge--" + tx.category;
      badgeSpan.textContent = tx.category;
      li.appendChild(badgeSpan);

      // Date (human-readable, derived from the ISO timestamp)
      var dateSpan = document.createElement("span");
      dateSpan.className = "transaction-list__date";
      try {
        dateSpan.textContent = new Date(tx.timestamp).toLocaleDateString(
          undefined,
          { year: "numeric", month: "short", day: "numeric" }
        );
      } catch (e) {
        // Fall back to the raw value if the timestamp is invalid.
        dateSpan.textContent = tx.timestamp;
      }
      li.appendChild(dateSpan);

      // Delete button (event-delegation target; carries the id)
      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "transaction-list__delete";
      deleteBtn.setAttribute("data-id", tx.id);
      deleteBtn.textContent = "Delete";
      li.appendChild(deleteBtn);

      fragment.appendChild(li);
    });

    dom.transactionList.appendChild(fragment);
  }

  /**
   * Computes the per-category totals from state.transactions.
   * Returns an object { Food: number, Transport: number, Fun: number }
   * where each value is the sum of amounts for that category. Categories
   * with no transactions have a total of 0.
   */
  function computeCategoryTotals() {
    const totals = { Food: 0, Transport: 0, Fun: 0 };
    state.transactions.forEach(function (tx) {
      if (Object.prototype.hasOwnProperty.call(totals, tx.category)) {
        totals[tx.category] += Number(tx.amount) || 0;
      }
    });
    return totals;
  }

  /**
   * Creates the Chart.js pie chart instance once on init. The instance
   * is stored in pieChartInstance and updated in place by renderChart()
   * (never destroyed and recreated). Guards against a missing canvas or
   * an unavailable Chart constructor.
   */
  function initChart() {
    if (!dom.pieChart || typeof Chart === "undefined") {
      return;
    }
    const ctx = dom.pieChart.getContext("2d");
    pieChartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: []
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom"
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const value = context.parsed;
                return label + ": " + formatAmount(value);
              }
            }
          }
        }
      }
    });
  }

  /**
   * Renders the spending distribution pie chart from state.transactions.
   * Computes category totals, excludes categories with a zero total, and
   * updates the single Chart.js instance in place via chart.update(). When
   * there is no spending data, the canvas is hidden and the empty-state
   * message is shown instead.
   */
  function renderChart() {
    // Guard: nothing to render if the chart instance was never created
    // (e.g. Chart.js failed to load or the canvas is missing).
    if (!pieChartInstance) {
      return;
    }

    // 1. Compute category totals from the current state.
    const totals = computeCategoryTotals();

    // 2. Build parallel arrays of labels, data, and colors for categories
    //    whose total is greater than zero. Zero-total categories are excluded
    //    so they never appear as slices.
    const labels = [];
    const data = [];
    const backgroundColors = [];

    CATEGORIES.forEach(function (category) {
      const total = totals[category];
      if (total > 0) {
        labels.push(category);
        data.push(total);
        backgroundColors.push(CATEGORY_COLORS[category]);
      }
    });

    // 3. Empty state: no spending data at all. Hide the canvas and show the
    //    empty-state message instead of rendering an empty chart.
    if (data.length === 0) {
      if (dom.pieChart) {
        dom.pieChart.classList.add("hidden");
      }
      if (dom.chartEmpty) {
        dom.chartEmpty.classList.remove("hidden");
      }
      return;
    }

    // 4. There is data: show the canvas, hide the empty state.
    if (dom.pieChart) {
      dom.pieChart.classList.remove("hidden");
    }
    if (dom.chartEmpty) {
      dom.chartEmpty.classList.add("hidden");
    }

    // 5. Update the chart instance in place (do not destroy/recreate).
    pieChartInstance.data.labels = labels;
    pieChartInstance.data.datasets[0].data = data;
    pieChartInstance.data.datasets[0].backgroundColor = backgroundColors;
    pieChartInstance.update();
  }

  /**
   * Renders the monthly summary for the currently selected month
   * (state.selectedMonth). Filters state.transactions to only those
   * whose timestamp falls within the selected month (same year and
   * month), computes the monthly total and a per-category breakdown,
   * and updates the month label, monthly total, and breakdown DOM
   * elements. Month navigation only changes state.selectedMonth and
   * the display — it never modifies state.transactions or saved data.
   * Guards against null DOM references.
   */
  function renderMonthlySummary() {
    if (!dom.monthLabel || !dom.monthlyTotal || !dom.monthlyBreakdown) {
      return;
    }

    // 1. Display the currently viewed month as a readable label
    //    (e.g., "October 2025").
    dom.monthLabel.textContent = state.selectedMonth.toLocaleDateString(
      undefined,
      { year: "numeric", month: "long" }
    );

    // 2. Filter transactions to those whose timestamp falls within the
    //    selected month (same year and same month). Never mutate
    //    state.transactions — filter produces a new array for display.
    var year = state.selectedMonth.getFullYear();
    var month = state.selectedMonth.getMonth();
    var monthlyTx = state.transactions.filter(function (tx) {
      var d = new Date(tx.timestamp);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    // 3. Compute the monthly total (sum of amounts in the month).
    var monthlyTotal = monthlyTx.reduce(function (sum, tx) {
      return sum + (Number(tx.amount) || 0);
    }, 0);
    dom.monthlyTotal.textContent = formatAmount(monthlyTotal);

    // 4. Clear any existing breakdown rows before re-rendering.
    dom.monthlyBreakdown.textContent = "";

    // 5. Empty state: no transactions in the selected month.
    if (monthlyTx.length === 0) {
      var emptyMsg = document.createElement("p");
      emptyMsg.className = "empty-state";
      emptyMsg.textContent = "No transactions in this month.";
      dom.monthlyBreakdown.appendChild(emptyMsg);
      return;
    }

    // 6. Compute per-category totals from the filtered transactions.
    var categoryTotals = { Food: 0, Transport: 0, Fun: 0 };
    monthlyTx.forEach(function (tx) {
      if (Object.prototype.hasOwnProperty.call(categoryTotals, tx.category)) {
        categoryTotals[tx.category] += Number(tx.amount) || 0;
      }
    });

    // 7. Build a breakdown row for each category, showing the category
    //    name with a colored dot and its total for the month.
    var fragment = document.createDocumentFragment();

    CATEGORIES.forEach(function (category) {
      var item = document.createElement("div");
      item.className = "monthly-breakdown__item";

      var label = document.createElement("span");
      label.className = "monthly-breakdown__label";

      var dot = document.createElement("span");
      dot.className =
        "monthly-breakdown__dot monthly-breakdown__dot--" + category;
      label.appendChild(dot);

      var labelText = document.createTextNode(" " + category);
      label.appendChild(labelText);

      item.appendChild(label);

      var value = document.createElement("span");
      value.className = "monthly-breakdown__value";
      value.textContent = formatAmount(categoryTotals[category]);
      item.appendChild(value);

      fragment.appendChild(item);
    });

    dom.monthlyBreakdown.appendChild(fragment);
  }

  /**
   * Handles clicks on the previous-month button: moves state.selectedMonth
   * back one month (to the first day of the previous month) and re-renders
   * the monthly summary. Month navigation only changes the display — it
   * never modifies state.transactions or saved data.
   */
  function handlePrevMonth() {
    state.selectedMonth = new Date(
      state.selectedMonth.getFullYear(),
      state.selectedMonth.getMonth() - 1,
      1
    );
    renderMonthlySummary();
  }

  /**
   * Handles clicks on the next-month button: moves state.selectedMonth
   * forward one month (to the first day of the next month) and re-renders
   * the monthly summary. Month navigation only changes the display — it
   * never modifies state.transactions or saved data.
   */
  function handleNextMonth() {
    state.selectedMonth = new Date(
      state.selectedMonth.getFullYear(),
      state.selectedMonth.getMonth() + 1,
      1
    );
    renderMonthlySummary();
  }

  /* ---------------------------------------------------------
     8. Event handlers (stubs — wired in later tasks)
     ---------------------------------------------------------
     Form submit, delete, sort change, theme toggle, and month
     navigation listeners are added by their respective tasks.
     --------------------------------------------------------- */

  /**
   * Updates the theme toggle button label and aria-pressed state
   * to reflect the current value of state.theme.
   */
  function updateThemeToggleUI() {
    if (dom.themeLabel) {
      dom.themeLabel.textContent = state.theme === "dark" ? "Light mode" : "Dark mode";
    }
    if (dom.themeToggle) {
      dom.themeToggle.setAttribute("aria-pressed", String(state.theme === "dark"));
    }
  }

  /**
   * Applies state.theme to the document element and refreshes the
   * toggle button label. Called during init before first render.
   */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    updateThemeToggleUI();
  }

  /**
   * Removes all inline validation messages and `.invalid` styling
   * from the form fields. Called before each validation pass and
   * after a successful submission.
   */
  function clearFormErrors() {
    if (dom.formErrors) {
      dom.formErrors.textContent = "";
    }
    if (dom.itemName) {
      dom.itemName.classList.remove("invalid");
    }
    if (dom.amount) {
      dom.amount.classList.remove("invalid");
    }
    if (dom.category) {
      dom.category.classList.remove("invalid");
    }
  }

  /**
   * Handles the expense form's submit event: validates the input,
   * creates a transaction on success, persists it (keeping the
   * in-memory copy even if the save fails), resets the form, and
   * re-renders the affected views.
   */
  function handleFormSubmit(event) {
    event.preventDefault();

    // 1. Read and trim inputs.
    const name = dom.itemName.value.trim();
    const amount = dom.amount.value;
    const category = dom.category.value;

    // 2. Clear any previous validation messages/styling before re-validating.
    clearFormErrors();

    // 3. Validate the input fields.
    const result = validateTransaction(name, amount, category);

    if (!result.valid) {
      // Show inline messages for each invalid field and mark the inputs.
      const errors = result.errors;
      const messages = [];
      if (errors.name) {
        dom.itemName.classList.add("invalid");
        messages.push(errors.name);
      }
      if (errors.amount) {
        dom.amount.classList.add("invalid");
        messages.push(errors.amount);
      }
      if (errors.category) {
        dom.category.classList.add("invalid");
        messages.push(errors.category);
      }
      // Error strings are constants from the validator, so this is safe.
      dom.formErrors.innerHTML = messages.join("<br />");
      return;
    }

    // 4. Build the new transaction object.
    const transaction = {
      id: generateId(),
      name: name,
      amount: Number(amount),
      category: category,
      timestamp: new Date().toISOString()
    };

    // 5. Add to state (single source of truth) and persist.
    state.transactions.push(transaction);
    const saved = saveTransactions(state.transactions);

    // 6. Reset the form inputs and clear validation styling.
    dom.expenseForm.reset();
    clearFormErrors();

    // 7. If persistence failed, warn the user but keep the in-memory
    //    transaction so the current session still reflects it.
    if (!saved) {
      dom.formErrors.textContent =
        "Could not save to local storage. Your transaction is visible but may not persist.";
    }

    // 8. Re-render the views that depend on the transaction list.
    renderTotal();
    renderTransactionList();
    renderChart();
    renderMonthlySummary();
  }

  /**
   * Handles clicks on delete buttons in the transaction list via
   * event delegation. Reads the transaction id from the clicked
   * button's data-id attribute, removes the matching transaction
   * from state, persists the change, and re-renders the views.
   * No-ops gracefully if the id is not found in state.
   */
  function handleDeleteClick(event) {
    // Find the delete button that was clicked (event delegation),
    // walking up from the click target to the matching ancestor.
    var target = event.target;
    var deleteBtn =
      target && typeof target.closest === "function"
        ? target.closest(".transaction-list__delete")
        : null;
    if (!deleteBtn) {
      return;
    }

    var id = deleteBtn.getAttribute("data-id");
    if (!id) {
      return;
    }

    // Locate the transaction by id; no-op if it doesn't exist.
    var index = state.transactions.findIndex(function (tx) {
      return tx.id === id;
    });
    if (index === -1) {
      return;
    }

    // Remove from state (single source of truth) and persist.
    state.transactions.splice(index, 1);
    var deleteSaved = saveTransactions(state.transactions);

    // If persistence failed, warn the user. The in-memory state already
    // reflects the deletion, but Local Storage may still contain the
    // transaction (it could reappear after a page refresh).
    if (!deleteSaved && dom.formErrors) {
      dom.formErrors.textContent =
        "Could not save deletion to local storage. The transaction may reappear after refresh.";
    }

    // Re-render the views that depend on the transaction list.
    renderTotal();
    renderTransactionList();
    renderChart();
    renderMonthlySummary();
  }

  /**
   * Handles clicks on the theme toggle button: switches the current
   * theme between "light" and "dark", applies it to the document
   * (which also updates the toggle button label and aria-pressed),
   * and persists the preference to localStorage.
   */
  function handleThemeToggle() {
    // 1. Flip the current theme value.
    state.theme = state.theme === "dark" ? "light" : "dark";

    // 2. Apply the new theme to the document and update the toggle UI.
    applyTheme();

    // 3. Persist the preference so it survives page reloads.
    saveTheme(state.theme);
  }

  /**
   * Handles changes to the sort dropdown: updates state.sortMode to
   * the selected value and re-renders the transaction list. Sorting
   * only affects the display copy produced by renderTransactionList()
   * — state.transactions (and therefore Local Storage) is never
   * modified by sorting.
   */
  function handleSortChange() {
    // 1. Read the newly selected sort option.
    var selected = dom.sortSelect.value;

    // 2. Update the sort mode in state (single source of truth).
    state.sortMode = selected;

    // 3. Re-render the list with the new sort applied. The function
    //    creates a sorted DISPLAY COPY, so state.transactions is
    //    left untouched and Local Storage order is preserved.
    renderTransactionList();
  }

  /**
   * Wires up all DOM event listeners. Later tasks attach their own
   * listeners here (sort, theme toggle, month navigation).
   * Must run after DOM references are cached.
   */
  function setupEventHandlers() {
    if (dom.expenseForm) {
      dom.expenseForm.addEventListener("submit", handleFormSubmit);
    }
    // Delete via event delegation on the transaction list so it
    // works for the dynamically created rows.
    if (dom.transactionList) {
      dom.transactionList.addEventListener("click", handleDeleteClick);
    }
    // Theme toggle: switch between light and dark on click.
    if (dom.themeToggle) {
      dom.themeToggle.addEventListener("click", handleThemeToggle);
    }
    // Sort dropdown: change the display order of transactions.
    // Sorting only affects the display copy; state and Local
    // Storage are never reordered.
    if (dom.sortSelect) {
      dom.sortSelect.addEventListener("change", handleSortChange);
    }
    // Month navigation: move the viewed month backward or forward.
    // Navigation only changes state.selectedMonth and re-renders the
    // summary; it never modifies state.transactions or saved data.
    if (dom.prevMonth) {
      dom.prevMonth.addEventListener("click", handlePrevMonth);
    }
    if (dom.nextMonth) {
      dom.nextMonth.addEventListener("click", handleNextMonth);
    }
  }

  /* ---------------------------------------------------------
     9. Initialization
     --------------------------------------------------------- */

  /**
   * Shows a banner at the top of the main content informing the
   * user that Local Storage is unavailable for this session.
   */
  function showStorageBanner(message) {
    const banner = document.createElement("div");
    banner.setAttribute("role", "alert");
    banner.textContent = message;
    banner.style.cssText =
      "padding:0.75rem 1rem;border-radius:8px;margin-bottom:1rem;" +
      "background-color:var(--danger-soft);color:var(--danger);" +
      "border:1px solid var(--danger);font-size:0.9rem;font-weight:600;";
    const main = document.querySelector(".app-main");
    if (main) {
      main.insertBefore(banner, main.firstChild);
    } else {
      console.warn(message);
    }
  }

  /**
   * Caches references to all DOM elements needed by the app.
   * Must run after the DOM is ready.
   */
  function cacheDomReferences() {
    dom.themeToggle = document.getElementById("theme-toggle");
    dom.themeLabel = document.querySelector(".theme-toggle__label");
    dom.totalAmount = document.getElementById("total-amount");
    dom.expenseForm = document.getElementById("expense-form");
    dom.itemName = document.getElementById("item-name");
    dom.amount = document.getElementById("amount");
    dom.category = document.getElementById("category");
    dom.formErrors = document.getElementById("form-errors");
    dom.sortSelect = document.getElementById("sort-select");
    dom.transactionList = document.getElementById("transaction-list");
    dom.listEmpty = document.getElementById("list-empty");
    dom.pieChart = document.getElementById("pie-chart");
    dom.chartEmpty = document.getElementById("chart-empty");
    dom.prevMonth = document.getElementById("prev-month");
    dom.nextMonth = document.getElementById("next-month");
    dom.monthLabel = document.getElementById("month-label");
    dom.monthlyTotal = document.getElementById("monthly-total");
    dom.monthlyBreakdown = document.getElementById("monthly-breakdown");
  }

  /**
   * Initialization: loads saved data, applies the theme, sets up
   * DOM references, and renders the initial view. Called once
   * on DOMContentLoaded (or immediately if the DOM is ready).
   */
  function init() {
    // 1. Check Local Storage availability.
    if (!isStorageAvailable()) {
      showStorageBanner(
        "Local Storage is unavailable in this browser. " +
        "Your data will not persist between sessions, but the app " +
        "still works for this session."
      );
    }

    // 2. Load saved transactions into state.
    state.transactions = loadTransactions();

    // 3. Load saved theme (default to light when not set).
    const savedTheme = loadTheme();
    state.theme = savedTheme === "dark" ? "dark" : "light";

    // 4. Set the currently viewed month to the first day of this month.
    state.selectedMonth = getFirstOfMonth(new Date());

    // 5. Apply the theme BEFORE first render to avoid a flash.
    applyTheme();

    // 6. Cache DOM references for later use.
    cacheDomReferences();

    // 7. Set up event listeners (form submit + later task listeners).
    setupEventHandlers();

    // 8. Initialize the Chart.js pie chart instance (must happen before
    //    renderChart() runs so the instance exists when it updates data).
    initChart();

    // 9. Render the initial view.
    renderTotal();
    renderTransactionList();
    renderChart();
    renderMonthlySummary();
  }

  /* ---------------------------------------------------------
     Bootstrap
     --------------------------------------------------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM is already parsed (script sits at end of body).
    init();
  }
})();
