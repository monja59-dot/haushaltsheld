/* =========================================================
   HaushaltsHeld – Zentrales Datensystem
   Datei: hh-data.js

   Schritt 5:
   - Einkauf kann automatisch als Finanz-Ausgabe übernommen werden
   - Doppelte Finanzbuchungen werden verhindert
   - Kompatibel mit alten Speichern:
     haushaltsheld_shopping_entries_v2
     haushaltsheld_einkaufsliste_stabil_v1
   ========================================================= */

(function () {
  "use strict";

  const HH_DATA_KEY = "haushaltsheld_data_v1";
  const SHOPPING_FINANCE_PREFIX = "shopping:auto:";
  let internalWrite = false;

  const LEGACY_KEYS = {
    finance: "haushaltsheld_finance_entries_v2",
    tasks: "haushaltsheld_tasks",
    shopping: "haushaltsheld_shopping_entries_v2",
    shoppingStable: "haushaltsheld_einkaufsliste_stabil_v1",
    planner: "haushaltsheld_family_planner",
    food: "haushaltsheld_food_data",
    chatRoom: "hh_family_chat_room",
    chatThreads: "hh_family_chat_threads",
    users: "haushaltsheld_users",
    activeUser: "haushaltsheld_user"
  };

  const DEFAULT_DATA = {
    version: 1,
    updatedAt: "",
    finance: {
      entries: [],
      bankSources: [],
      budgets: [],
      recurring: []
    },
    shopping: {
      entries: []
    },
    tasks: {
      entries: []
    },
    planner: {
      entries: []
    },
    food: {
      entries: []
    },
    chat: {
      room: { messages: [] },
      threads: []
    },
    users: {
      list: [],
      active: null
    },
    settings: {
      autoBookShoppingToFinance: true
    }
  };

  const nativeSetItem = Storage.prototype.setItem;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (error) {
      console.warn("HaushaltsHeld: Konnte LocalStorage nicht lesen:", key, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      internalWrite = true;
      nativeSetItem.call(localStorage, key, JSON.stringify(value));
      internalWrite = false;
      return true;
    } catch (error) {
      internalWrite = false;
      console.warn("HaushaltsHeld: Konnte LocalStorage nicht schreiben:", key, error);
      return false;
    }
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function parseAmount(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? "")
      .replace(/\s/g, "")
      .replace(/€/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function uid(prefix) {
    return (prefix || "hh") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function todayDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().split("T")[0];
  }

  function normalizeFinanceEntry(entry) {
    if (!entry || typeof entry !== "object") return null;

    const amountRaw = entry.amount ?? entry.betrag ?? entry.value ?? entry.price ?? 0;
    const amount = parseAmount(amountRaw);
    const typeRaw = String(entry.type || entry.typ || "").toLowerCase();

    let type = typeRaw;
    if (!type) type = amount >= 0 ? "income" : "expense";
    if (type === "einnahme" || type === "income") type = "income";
    if (type === "ausgabe" || type === "expense") type = "expense";
    if (type !== "income" && type !== "saving") type = "expense";

    const kontoId = entry.kontoId || entry.accountId || entry.account || entry.payment || entry.konto || "";

    return {
      ...entry,
      id: entry.id || entry.entryId || uid("fin"),
      title: entry.title || entry.name || entry.beschreibung || entry.description || "Eintrag",
      amount: Math.abs(amount),
      type,
      mainCategory: entry.mainCategory || entry.category || entry.kategorie || "Sonstiges",
      category: entry.category || entry.kategorie || entry.subcategory || entry.subCategory || "Sonstiges",
      subcategory: entry.subcategory || entry.subCategory || entry.unterkategorie || "",
      person: entry.person || entry.owner || entry.zuordnung || entry.buyer || "",
      date: entry.date || entry.datum || entry.bookingDate || entry.createdAt || todayDate(),
      createdAt: entry.createdAt || new Date().toISOString(),
      source: entry.source || entry.sourceType || "manual",
      origin: entry.origin || entry.source || "manual",
      kontoId,
      accountId: entry.accountId || kontoId,
      accountName: entry.accountName || entry.kontoName || entry.payment || entry.konto || "",
      accountType: entry.accountType || entry.kontoArt || "",
      bankName: entry.bankName || entry.bank || "",
      financeLinkKey: entry.financeLinkKey || entry.sourceKey || entry.importKey || ""
    };
  }

  function normalizeShoppingEntry(entry) {
    if (!entry || typeof entry !== "object") return null;

    const amount = parseAmount(entry.amount ?? entry.price ?? entry.total ?? entry.summe ?? entry.betrag ?? 0);
    const title = entry.title || entry.name || entry.baseGroup || entry.item || entry.items || entry.source || "Einkauf";
    const store = entry.store || entry.shop || entry.source || entry.market || "";
    const person = entry.person || entry.buyer || entry.owner || entry.zuordnung || "";
    const sourceKey = entry.sourceKey || entry.importKey || entry.id || "";

    return {
      ...entry,
      id: entry.id || uid("shop"),
      title,
      baseGroup: entry.baseGroup || title,
      date: entry.date || entry.datum || entry.createdAt || todayDate(),
      purchaseKind: entry.purchaseKind || "Alltag",
      category: entry.category || entry.kategorie || "Lebensmittel",
      priority: entry.priority || "Pflicht",
      origin: entry.origin || "Einkaufsliste",
      status: entry.status || (entry.checked || entry.done ? "erledigt" : "offen"),
      quantity: entry.quantity ?? entry.qty ?? null,
      unit: entry.unit || "",
      store,
      price: amount || null,
      amount: amount || null,
      buyer: person,
      person,
      note: entry.note || entry.text || "",
      payment: entry.payment || entry.kontoId || entry.accountId || "",
      accountId: entry.accountId || entry.kontoId || entry.payment || "",
      accountName: entry.accountName || entry.kontoName || entry.payment || "",
      accountType: entry.accountType || entry.kontoArt || "",
      bankName: entry.bankName || entry.bank || "",
      occasion: entry.occasion || "",
      type: entry.type || "Ausgabe",
      importKey: entry.importKey || "",
      sourceKey
    };
  }

  function dedupeByStableKey(entries) {
    const seen = new Set();
    const result = [];
    ensureArray(entries).forEach((entry) => {
      const key = entry?.sourceKey || entry?.importKey || entry?.id || JSON.stringify(entry);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(entry);
    });
    return result;
  }

  function getShoppingFinanceKey(entry) {
    const stable = entry.sourceKey || entry.importKey || entry.id || [entry.title, entry.date, entry.amount, entry.store].join("|");
    return SHOPPING_FINANCE_PREFIX + stable;
  }

  function shoppingEntryToFinanceEntry(entry) {
    const shop = normalizeShoppingEntry(entry);
    if (!shop) return null;
    const amount = parseAmount(shop.amount ?? shop.price);
    if (!amount || amount <= 0) return null;

    const financeLinkKey = getShoppingFinanceKey(shop);
    const titleParts = [];
    titleParts.push(shop.store ? "Einkauf " + shop.store : "Einkauf");
    if (shop.title && shop.title !== shop.store) titleParts.push(shop.title);

    return normalizeFinanceEntry({
      id: "fin_" + financeLinkKey.replace(/[^a-zA-Z0-9_-]/g, "_"),
      title: titleParts.join(" – "),
      amount,
      type: "expense",
      mainCategory: "Variable Ausgaben",
      category: shop.category || "Lebensmittel",
      subcategory: shop.purchaseKind || "Einkauf",
      person: shop.person || shop.buyer || "",
      date: shop.date || todayDate(),
      createdAt: new Date().toISOString(),
      source: "shopping_auto",
      origin: "Einkaufsliste",
      note: shop.note || "Automatisch aus Einkauf übernommen",
      store: shop.store || "",
      kontoId: shop.accountId || shop.payment || "",
      accountId: shop.accountId || shop.payment || "",
      accountName: shop.accountName || shop.payment || "",
      accountType: shop.accountType || "",
      bankName: shop.bankName || "",
      importKey: shop.importKey || "",
      sourceKey: shop.sourceKey || shop.id || "",
      financeLinkKey,
      linkedShoppingId: shop.id
    });
  }

  function getLegacyData() {
    const foodRaw = readJSON(LEGACY_KEYS.food, { essensEintraege: [] });
    const chatRoom = readJSON(LEGACY_KEYS.chatRoom, { messages: [] });
    const shoppingPrimary = ensureArray(readJSON(LEGACY_KEYS.shopping, [])).map(normalizeShoppingEntry).filter(Boolean);
    const shoppingStable = ensureArray(readJSON(LEGACY_KEYS.shoppingStable, [])).map(normalizeShoppingEntry).filter(Boolean);

    return {
      financeEntries: ensureArray(readJSON(LEGACY_KEYS.finance, [])).map(normalizeFinanceEntry).filter(Boolean),
      shoppingEntries: dedupeByStableKey([...shoppingPrimary, ...shoppingStable]),
      taskEntries: ensureArray(readJSON(LEGACY_KEYS.tasks, [])),
      plannerEntries: ensureArray(readJSON(LEGACY_KEYS.planner, [])),
      foodEntries: Array.isArray(foodRaw) ? foodRaw : ensureArray(foodRaw.essensEintraege),
      chatRoom: chatRoom && typeof chatRoom === "object" ? chatRoom : { messages: [] },
      chatThreads: ensureArray(readJSON(LEGACY_KEYS.chatThreads, [])),
      users: ensureArray(readJSON(LEGACY_KEYS.users, [])),
      activeUser: readJSON(LEGACY_KEYS.activeUser, null)
    };
  }

  function getDataRaw() {
    const existing = readJSON(HH_DATA_KEY, null);
    return existing && typeof existing === "object" ? { ...clone(DEFAULT_DATA), ...existing } : clone(DEFAULT_DATA);
  }

  function syncShoppingToFinance(data) {
    const settings = data.settings || DEFAULT_DATA.settings;
    if (settings.autoBookShoppingToFinance === false) return data;

    const financeEntries = ensureArray(data.finance?.entries).map(normalizeFinanceEntry).filter(Boolean);
    const shoppingEntries = ensureArray(data.shopping?.entries).map(normalizeShoppingEntry).filter(Boolean);
    const existingKeys = new Set(financeEntries.map((entry) => entry.financeLinkKey || entry.sourceKey || entry.importKey || entry.id));

    shoppingEntries.forEach((shop) => {
      const amount = parseAmount(shop.amount ?? shop.price);
      const status = String(shop.status || "").toLowerCase();
      if (!amount || amount <= 0) return;
      if (status === "gelöscht" || status === "deleted") return;

      const financeLinkKey = getShoppingFinanceKey(shop);
      if (existingKeys.has(financeLinkKey)) return;

      const financeEntry = shoppingEntryToFinanceEntry(shop);
      if (!financeEntry) return;
      financeEntries.push(financeEntry);
      existingKeys.add(financeLinkKey);
    });

    data.finance.entries = financeEntries;
    data.shopping.entries = shoppingEntries;
    return data;
  }

  function migrateLegacyIntoCentral() {
    const data = getDataRaw();
    const legacy = getLegacyData();

    data.finance = data.finance || clone(DEFAULT_DATA.finance);
    data.shopping = data.shopping || clone(DEFAULT_DATA.shopping);
    data.tasks = data.tasks || clone(DEFAULT_DATA.tasks);
    data.planner = data.planner || clone(DEFAULT_DATA.planner);
    data.food = data.food || clone(DEFAULT_DATA.food);
    data.chat = data.chat || clone(DEFAULT_DATA.chat);
    data.users = data.users || clone(DEFAULT_DATA.users);
    data.settings = { ...clone(DEFAULT_DATA.settings), ...(data.settings || {}) };

    data.finance.entries = legacy.financeEntries;
    data.shopping.entries = legacy.shoppingEntries;
    data.tasks.entries = legacy.taskEntries;
    data.planner.entries = legacy.plannerEntries;
    data.food.entries = legacy.foodEntries;
    data.chat.room = legacy.chatRoom;
    data.chat.threads = legacy.chatThreads;
    data.users.list = legacy.users;
    data.users.active = legacy.activeUser;
    data.updatedAt = new Date().toISOString();

    syncShoppingToFinance(data);
    writeJSON(HH_DATA_KEY, data);
    writeJSON(LEGACY_KEYS.finance, ensureArray(data.finance?.entries));
    writeJSON(LEGACY_KEYS.shopping, ensureArray(data.shopping?.entries));
    writeJSON(LEGACY_KEYS.shoppingStable, ensureArray(data.shopping?.entries));
    return data;
  }

  function getData() {
    return migrateLegacyIntoCentral();
  }

  function saveData(nextData) {
    const data = {
      ...clone(DEFAULT_DATA),
      ...(nextData || {}),
      settings: { ...clone(DEFAULT_DATA.settings), ...((nextData || {}).settings || {}) },
      updatedAt: new Date().toISOString()
    };

    data.finance = data.finance || clone(DEFAULT_DATA.finance);
    data.shopping = data.shopping || clone(DEFAULT_DATA.shopping);
    data.finance.entries = ensureArray(data.finance.entries).map(normalizeFinanceEntry).filter(Boolean);
    data.shopping.entries = ensureArray(data.shopping.entries).map(normalizeShoppingEntry).filter(Boolean);

    syncShoppingToFinance(data);

    writeJSON(HH_DATA_KEY, data);

    /* Rückwärtskompatibel speichern */
    writeJSON(LEGACY_KEYS.finance, ensureArray(data.finance?.entries));
    writeJSON(LEGACY_KEYS.shopping, ensureArray(data.shopping?.entries));
    writeJSON(LEGACY_KEYS.shoppingStable, ensureArray(data.shopping?.entries));
    writeJSON(LEGACY_KEYS.tasks, ensureArray(data.tasks?.entries));
    writeJSON(LEGACY_KEYS.planner, ensureArray(data.planner?.entries));
    writeJSON(LEGACY_KEYS.chatRoom, data.chat?.room || { messages: [] });
    writeJSON(LEGACY_KEYS.chatThreads, ensureArray(data.chat?.threads));

    return data;
  }

  function getFinanceEntries() {
    return ensureArray(getData().finance?.entries);
  }

  function saveFinanceEntries(entries) {
    const data = getDataRaw();
    data.finance = data.finance || clone(DEFAULT_DATA.finance);
    data.finance.entries = ensureArray(entries).map(normalizeFinanceEntry).filter(Boolean);
    return saveData(data);
  }

  function addFinanceEntry(entry) {
    const entries = getFinanceEntries();
    const normalized = normalizeFinanceEntry(entry);
    if (!normalized) return null;
    const key = normalized.financeLinkKey || normalized.sourceKey || normalized.importKey || normalized.id;
    const exists = entries.some((item) => (item.financeLinkKey || item.sourceKey || item.importKey || item.id) === key);
    if (!exists) entries.push(normalized);
    saveFinanceEntries(entries);
    return normalized;
  }

  function getShoppingEntries() {
    return ensureArray(getData().shopping?.entries);
  }

  function saveShoppingEntries(entries) {
    const data = getDataRaw();
    data.shopping = data.shopping || clone(DEFAULT_DATA.shopping);
    data.shopping.entries = ensureArray(entries).map(normalizeShoppingEntry).filter(Boolean);
    return saveData(data);
  }

  function addShoppingEntry(entry, options) {
    const entries = getShoppingEntries();
    const normalized = normalizeShoppingEntry(entry);
    if (!normalized) return null;
    entries.push(normalized);

    const data = getDataRaw();
    data.shopping = data.shopping || clone(DEFAULT_DATA.shopping);
    data.settings = { ...clone(DEFAULT_DATA.settings), ...(data.settings || {}) };
    if (options && options.autoBookToFinance === false) data.settings.autoBookShoppingToFinance = false;
    data.shopping.entries = entries;
    saveData(data);
    return normalized;
  }

  function getTaskEntries() {
    return ensureArray(getData().tasks?.entries);
  }

  function saveTaskEntries(entries) {
    const data = getDataRaw();
    data.tasks = data.tasks || clone(DEFAULT_DATA.tasks);
    data.tasks.entries = ensureArray(entries);
    return saveData(data);
  }

  function getPlannerEntries() {
    return ensureArray(getData().planner?.entries);
  }

  function savePlannerEntries(entries) {
    const data = getDataRaw();
    data.planner = data.planner || clone(DEFAULT_DATA.planner);
    data.planner.entries = ensureArray(entries);
    return saveData(data);
  }

  function getSummary() {
    const entries = getFinanceEntries();
    const income = entries
      .filter(e => e.type === "income")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const expense = entries
      .filter(e => e.type !== "income")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      income,
      expense,
      balance: income - expense,
      financeCount: entries.length,
      shoppingCount: getShoppingEntries().length,
      taskCount: getTaskEntries().length,
      plannerCount: getPlannerEntries().length
    };
  }

  function setAutoBookShoppingToFinance(enabled) {
    const data = getDataRaw();
    data.settings = { ...clone(DEFAULT_DATA.settings), ...(data.settings || {}) };
    data.settings.autoBookShoppingToFinance = !!enabled;
    return saveData(data);
  }

  /* Falls eine ältere Seite direkt localStorage.setItem(...) nutzt,
     erkennen wir Änderungen am Einkaufs-Speicher trotzdem und buchen
     vorhandene Einkaufsbeträge automatisch in Finanzen nach. */
  if (!window.__HH_DATA_LOCALSTORAGE_PATCHED__) {
    window.__HH_DATA_LOCALSTORAGE_PATCHED__ = true;
    Storage.prototype.setItem = function (key, value) {
      nativeSetItem.call(this, key, value);
      if (internalWrite) return;
      if (key === LEGACY_KEYS.shopping || key === LEGACY_KEYS.shoppingStable) {
        setTimeout(function () {
          try { migrateLegacyIntoCentral(); } catch (error) { console.warn("HaushaltsHeld: Einkauf-Finanzen Sync fehlgeschlagen", error); }
        }, 0);
      }
    };
  }

  window.HHData = {
    key: HH_DATA_KEY,
    legacyKeys: LEGACY_KEYS,

    getData,
    saveData,

    getFinanceEntries,
    saveFinanceEntries,
    addFinanceEntry,

    getShoppingEntries,
    saveShoppingEntries,
    addShoppingEntry,
    shoppingEntryToFinanceEntry,
    syncShoppingToFinance: function () {
      return saveData(getDataRaw());
    },
    setAutoBookShoppingToFinance,

    getTaskEntries,
    saveTaskEntries,

    getPlannerEntries,
    savePlannerEntries,

    getSummary,

    migrateLegacyIntoCentral
  };

  document.addEventListener("DOMContentLoaded", function () {
    const data = migrateLegacyIntoCentral();
    document.dispatchEvent(new CustomEvent("hh:data-ready", { detail: data }));
  });
})();
