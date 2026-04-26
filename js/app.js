(function () {
  "use strict";

  const STORAGE_KEYS = {
    appData: "hh_app_data",
    currentUser: "haushaltsheld_user",
    permissions: "hh_permissions_v2",
    settings: "hh_settings"
  };

  const DEFAULT_DATA = {
    users: [
      { id: "mama", name: "Mama", role: "parent" },
      { id: "kind1", name: "Kind 1", role: "child" }
    ],
    finances: [],
    shopping: [],
    tasks: [],
    receipts: [],
    goals: [],
    wishes: [],
    planner: [],
    chat: []
  };

  const DEFAULT_PERMISSIONS = {
    kind1: {
      // Neues einheitliches Format (kompatibel mit permissions.js / HHPermissions)
      money: false,
      appointments: false,
      scanner: false,
      shopping: false,
      // Legacy-Felder für Rückwärtskompatibilität
      canViewMoney: false,
      canUseChat: true,
      canScanReceipts: false,
      canCreateWish: true,
      canManageTasks: false
    }
  };

  const DEFAULT_SETTINGS = {
    appName: "Haushaltsheld",
    currency: "EUR",
    language: "de"
  };

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function load(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return safeParse(raw, fallback);
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function deepMerge(base, extra) {
    if (Array.isArray(base) || Array.isArray(extra)) {
      return extra ?? base;
    }

    const result = { ...base };

    if (!extra || typeof extra !== "object") {
      return result;
    }

    Object.keys(extra).forEach((key) => {
      const baseValue = base?.[key];
      const extraValue = extra[key];

      if (
        baseValue &&
        extraValue &&
        typeof baseValue === "object" &&
        typeof extraValue === "object" &&
        !Array.isArray(baseValue) &&
        !Array.isArray(extraValue)
      ) {
        result[key] = deepMerge(baseValue, extraValue);
      } else {
        result[key] = extraValue;
      }
    });

    return result;
  }

  const App = {
    getData() {
      const stored = load(STORAGE_KEYS.appData, null);
      return stored ? deepMerge(DEFAULT_DATA, stored) : structuredClone(DEFAULT_DATA);
    },

    setData(newData) {
      return save(STORAGE_KEYS.appData, newData);
    },

    updateData(updater) {
      const current = this.getData();
      const updated = updater(structuredClone(current));
      this.setData(updated);
      return updated;
    },

    getSettings() {
      const stored = load(STORAGE_KEYS.settings, null);
      return stored ? deepMerge(DEFAULT_SETTINGS, stored) : structuredClone(DEFAULT_SETTINGS);
    },

    setSettings(newSettings) {
      return save(STORAGE_KEYS.settings, newSettings);
    },

    getPermissions() {
      const stored = load(STORAGE_KEYS.permissions, null);
      return stored ? deepMerge(DEFAULT_PERMISSIONS, stored) : structuredClone(DEFAULT_PERMISSIONS);
    },

    setPermissions(newPermissions) {
      return save(STORAGE_KEYS.permissions, newPermissions);
    },

    getCurrentUser() {
      const stored = load(STORAGE_KEYS.currentUser, null);
      if (stored) return stored;

      const defaultUser = { id: "mama", name: "Mama", role: "parent" };
      this.setCurrentUser(defaultUser);
      return defaultUser;
    },

    setCurrentUser(user) {
      return save(STORAGE_KEYS.currentUser, user);
    },

    isParent() {
      return this.getCurrentUser().role === "parent";
    },

    isChild() {
      return this.getCurrentUser().role === "child";
    },

    can(permissionName, userId = null) {
      const current = this.getCurrentUser();
      const targetUserId = userId || current.id;

      if (current.role === "parent") return true;

      // Zuerst HHPermissions (hh_permissions_v2) prüfen
      try {
        const v2 = JSON.parse(localStorage.getItem("hh_permissions_v2") || "{}");
        if (v2[targetUserId] && permissionName in v2[targetUserId]) {
          return !!v2[targetUserId][permissionName];
        }
      } catch(e) {}

      // Fallback auf eigene Permissions
      const permissions = this.getPermissions();
      return !!permissions?.[targetUserId]?.[permissionName];
    },

    formatEuro(value) {
      const amount = Number(value || 0);
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR"
      }).format(amount);
    },

    setActiveNav() {
      const fileName = window.location.pathname.split("/").pop() || "index.html";
      const links = document.querySelectorAll("a[href]");

      links.forEach((link) => {
        const href = link.getAttribute("href");
        if (!href) return;

        const normalizedHref = href.split("#")[0].split("?")[0];
        if (normalizedHref === fileName) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
      });
    },

    applyRoleVisibility() {
      document.querySelectorAll("[data-parent-only]").forEach((el) => {
        el.style.display = this.isParent() ? "" : "none";
      });

      document.querySelectorAll("[data-child-only]").forEach((el) => {
        el.style.display = this.isChild() ? "" : "none";
      });
    },

    applyPermissionVisibility() {
      document.querySelectorAll("[data-permission]").forEach((el) => {
        const permission = el.getAttribute("data-permission");
        el.style.display = this.can(permission) ? "" : "none";
      });
    },

    fillCurrentUserText() {
      const currentUser = this.getCurrentUser();

      document.querySelectorAll("[data-current-user-name]").forEach((el) => {
        el.textContent = currentUser.name;
      });

      document.querySelectorAll("[data-current-user-role]").forEach((el) => {
        el.textContent = currentUser.role === "parent" ? "Elternmodus" : "Kindermodus";
      });
    },

    initUserSwitcher() {
      const switchers = document.querySelectorAll("[data-user-switcher]");

      if (!switchers.length) return;

      const data = this.getData();
      const users = data.users || [];
      const currentUser = this.getCurrentUser();

      switchers.forEach((select) => {
        select.innerHTML = "";

        users.forEach((user) => {
          const option = document.createElement("option");
          option.value = user.id;
          option.textContent = `${user.name} (${user.role === "parent" ? "Eltern" : "Kind"})`;

          if (user.id === currentUser.id) {
            option.selected = true;
          }

          select.appendChild(option);
        });

        select.addEventListener("change", (event) => {
          const selectedId = event.target.value;
          const selectedUser = users.find((user) => user.id === selectedId);

          if (!selectedUser) return;

          this.setCurrentUser(selectedUser);
          window.location.reload();
        });
      });
    },

    emit(eventName, detail = {}) {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    },

    on(eventName, handler) {
      document.addEventListener(eventName, handler);
    },

    init() {
      this.getData();
      this.getPermissions();
      this.getSettings();
      this.getCurrentUser();

      this.setActiveNav();
      this.applyRoleVisibility();
      this.applyPermissionVisibility();
      this.fillCurrentUserText();
      this.initUserSwitcher();
    }
  };

  window.HHApp = App;

  document.addEventListener("DOMContentLoaded", () => {
    App.init();
  });
})();