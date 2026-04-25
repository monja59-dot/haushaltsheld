/* =========================================================
   HaushaltsHeld – Zentrales Datensystem
   Datei: hh-data.js

   Ziel:
   - Bestehende LocalStorage-Daten NICHT löschen
   - Finanzdaten aus haushaltsheld_finance_entries_v2 weiter nutzen
   - Einheitliche Schnittstelle für Dashboard, Finanzen, Historie,
     Finanzbericht und Datenzentrale schaffen
   ========================================================= */

(function () {
  "use strict";

  const HH_DATA_KEY = "haushaltsheld_data_v1";

  const LEGACY_KEYS = {
    finance: "haushaltsheld_finance_entries_v2",
    tasks: "haushaltsheld_tasks",
    shopping: "haushaltsheld_shopping_entries_v2",
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
    settings: {}
  };

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
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("HaushaltsHeld: Konnte LocalStorage nicht schreiben:", key, error);
      return false;
    }
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeFinanceEntry(entry) {
    if (!entry || typeof entry !== "object") return null;

    const amountRaw = entry.amount ?? entry.betrag ?? entry.value ?? 0;
    const amount = Number(String(amountRaw).replace(",", "."));
    const typeRaw = String(entry.type || entry.typ || "").toLowerCase();

    let type = typeRaw;
    if (!type) {
      type = amount >= 0 ? "income" : "expense";
    }
    if (type === "einnahme") type = "income";
    if (type === "ausgabe") type = "expense";

    return {
      ...entry,
      id: entry.id || entry.entryId || ("fin_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)),
      title: entry.title || entry.name || entry.beschreibung || entry.description || "Eintrag",
      amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
      type,
      category: entry.category || entry.kategorie || entry.mainCategory || "Sonstiges",
      subcategory: entry.subcategory || entry.subCategory || entry.unterkategorie || "",
      person: entry.person || entry.owner || entry.zuordnung || "",
      date: entry.date || entry.datum || entry.bookingDate || entry.createdAt || new Date().toISOString().slice(0, 10),
      createdAt: entry.createdAt || new Date().toISOString(),
      source: entry.source || entry.sourceType || "manual"
    };
  }

  function getLegacyData() {
    const foodRaw = readJSON(LEGACY_KEYS.food, { essensEintraege: [] });
    const chatRoom = readJSON(LEGACY_KEYS.chatRoom, { messages: [] });

    return {
      financeEntries: ensureArray(readJSON(LEGACY_KEYS.finance, [])).map(normalizeFinanceEntry).filter(Boolean),
      shoppingEntries: ensureArray(readJSON(LEGACY_KEYS.shopping, [])),
      taskEntries: ensureArray(readJSON(LEGACY_KEYS.tasks, [])),
      plannerEntries: ensureArray(readJSON(LEGACY_KEYS.planner, [])),
      foodEntries: Array.isArray(foodRaw) ? foodRaw : ensureArray(foodRaw.essensEintraege),
      chatRoom: chatRoom && typeof chatRoom === "object" ? chatRoom : { messages: [] },
      chatThreads: ensureArray(readJSON(LEGACY_KEYS.chatThreads, [])),
      users: ensureArray(readJSON(LEGACY_KEYS.users, [])),
      activeUser: readJSON(LEGACY_KEYS.activeUser, null)
    };
  }

  function migrateLegacyIntoCentral() {
    const existing = readJSON(HH_DATA_KEY, null);
    const data = existing && typeof existing === "object" ? { ...clone(DEFAULT_DATA), ...existing } : clone(DEFAULT_DATA);
    const legacy = getLegacyData();

    data.finance = data.finance || clone(DEFAULT_DATA.finance);
    data.shopping = data.shopping || clone(DEFAULT_DATA.shopping);
    data.tasks = data.tasks || clone(DEFAULT_DATA.tasks);
    data.planner = data.planner || clone(DEFAULT_DATA.planner);
    data.food = data.food || clone(DEFAULT_DATA.food);
    data.chat = data.chat || clone(DEFAULT_DATA.chat);
    data.users = data.users || clone(DEFAULT_DATA.users);

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

    writeJSON(HH_DATA_KEY, data);
    return data;
  }

  function getData() {
    return migrateLegacyIntoCentral();
  }

  function saveData(nextData) {
    const data = {
      ...clone(DEFAULT_DATA),
      ...(nextData || {}),
      updatedAt: new Date().toISOString()
    };

    writeJSON(HH_DATA_KEY, data);

    /* Rückwärtskompatibel speichern:
       Dadurch funktionieren deine bestehenden Seiten weiter,
       auch wenn sie noch nicht komplett umgebaut sind. */
    writeJSON(LEGACY_KEYS.finance, ensureArray(data.finance?.entries));
    writeJSON(LEGACY_KEYS.shopping, ensureArray(data.shopping?.entries));
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
    const data = getData();
    data.finance.entries = ensureArray(entries).map(normalizeFinanceEntry).filter(Boolean);
    return saveData(data);
  }

  function addFinanceEntry(entry) {
    const entries = getFinanceEntries();
    const normalized = normalizeFinanceEntry(entry);
    if (!normalized) return null;
    entries.push(normalized);
    saveFinanceEntries(entries);
    return normalized;
  }

  function getShoppingEntries() {
    return ensureArray(getData().shopping?.entries);
  }

  function saveShoppingEntries(entries) {
    const data = getData();
    data.shopping.entries = ensureArray(entries);
    return saveData(data);
  }

  function getTaskEntries() {
    return ensureArray(getData().tasks?.entries);
  }

  function saveTaskEntries(entries) {
    const data = getData();
    data.tasks.entries = ensureArray(entries);
    return saveData(data);
  }

  function getPlannerEntries() {
    return ensureArray(getData().planner?.entries);
  }

  function savePlannerEntries(entries) {
    const data = getData();
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

    getTaskEntries,
    saveTaskEntries,

    getPlannerEntries,
    savePlannerEntries,

    getSummary,

    migrateLegacyIntoCentral
  };

  document.addEventListener("DOMContentLoaded", function () {
    migrateLegacyIntoCentral();
    document.dispatchEvent(new CustomEvent("hh:data-ready", { detail: getData() }));
  });
})();
