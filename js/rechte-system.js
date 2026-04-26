/* =========================================================
   HaushaltsHeld – Zentrales Rechte-System
   Datei: rechte-system.js

   Zweck:
   - Liest den aktiven Nutzer
   - Liest Rechte aus admin.html / hh_rights_system_v1
   - Unterstützt alte Rechte aus hh_permissions_v2
   - Prüft Sichtbarkeit, Rollen, Kinderrechte und Freigaben
   - Schützt private Inhalte von Erwachsenen und Geschwistern
   ========================================================= */

(function () {
  "use strict";

  const KEYS = {
    activeUser: "haushaltsheld_user",
    activeUserLegacy: "haushaltsheld_current_user",
    users: "haushaltsheld_users",
    rights: "hh_rights_system_v1",
    oldPermissions: "hh_permissions_v2",
    requests: "hh_share_requests_v1",
    grants: "hh_active_grants_v1",
    audit: "hh_audit_log_v1"
  };

  const DEFAULT_RIGHTS = {
    roles: {},
    protection: {},
    child: {},
    privacy: {},
    finance: {},
    chat: {}
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9äöüß_-]/gi, "");
  }

  function getUserId(user) {
    if (!user) return "";
    return user.id || user.userId || user.username || slugify(user.name || user.displayName || "user");
  }

  function normalizeRole(role) {
    const value = String(role || "").toLowerCase();

    if (value === "owner" || value === "admin" || value === "familien-verwalter") return "owner";
    if (value === "parent" || value === "eltern" || value === "elternteil") return "parent";
    if (value === "parent_limited" || value === "eingeschränktes elternteil") return "parent_limited";
    if (value === "teen" || value === "jugend" || value === "jugendkonto") return "teen";
    if (value === "child" || value === "kind" || value === "kinderkonto") return "child";
    if (value === "guest" || value === "gast") return "guest";

    return "guest";
  }

  function roleLabel(role) {
    const normalized = normalizeRole(role);

    const labels = {
      owner: "Familien-Verwalter",
      parent: "Elternteil",
      parent_limited: "Eingeschränktes Elternteil",
      teen: "Jugendkonto",
      child: "Kinderkonto",
      guest: "Gast / Betreuung"
    };

    return labels[normalized] || "Nutzer";
  }

  function areaLabel(area) {
    const labels = {
      finance: "Finanzen",
      appointments: "Termine",
      shopping: "Einkäufe",
      tasks: "Aufgaben",
      receipts: "Belege",
      documents: "Dokumente",
      chat: "Chat",
      ai: "KI-Auswertung",
      privacy: "Privatsphäre"
    };

    return labels[area] || area || "Bereich";
  }

  function accessLabel(level) {
    const labels = {
      summary: "Nur Summe / Zeitblock",
      masked: "Betrag oder Titel ohne Details",
      full: "Volle Details",
      once: "Einmalig",
      private_amount: "Privat, aber planungsrelevant",
      busy_only: "Nur beschäftigt",
      hidden: "Verborgen"
    };

    return labels[level] || level || "Freigabe";
  }

  function getCurrentUser() {
    return (
      readJSON(KEYS.activeUser, null) ||
      readJSON(KEYS.activeUserLegacy, null) ||
      null
    );
  }

  function getAllUsers() {
    const users = readJSON(KEYS.users, []);
    return Array.isArray(users) ? users : [];
  }

  function getUserById(userId) {
    const users = getAllUsers();
    return users.find((user) => getUserId(user) === userId) || null;
  }

  function getRights() {
    const stored = readJSON(KEYS.rights, {});
    return {
      roles: stored.roles || {},
      protection: stored.protection || {},
      child: stored.child || {},
      privacy: stored.privacy || {},
      finance: stored.finance || {},
      chat: stored.chat || {}
    };
  }

  function saveRights(rights) {
    return writeJSON(KEYS.rights, {
      ...DEFAULT_RIGHTS,
      ...(rights || {})
    });
  }

  function getRole(userOrId) {
    const rights = getRights();
    const user = typeof userOrId === "string" ? getUserById(userOrId) : userOrId;
    const userId = typeof userOrId === "string" ? userOrId : getUserId(user);

    const storedRole = rights.roles?.[userId];
    if (storedRole) return normalizeRole(storedRole);

    if (user && user.role) return normalizeRole(user.role);

    return "guest";
  }

  function isOwner(userOrId) {
    return getRole(userOrId) === "owner";
  }

  function isParent(userOrId) {
    const role = getRole(userOrId);
    return role === "owner" || role === "parent" || role === "parent_limited";
  }

  function isFullParent(userOrId) {
    const role = getRole(userOrId);
    return role === "owner" || role === "parent";
  }

  function isChild(userOrId) {
    const role = getRole(userOrId);
    return role === "child";
  }

  function isTeen(userOrId) {
    const role = getRole(userOrId);
    return role === "teen";
  }

  function isMinor(userOrId) {
    const role = getRole(userOrId);
    return role === "child" || role === "teen";
  }

  function isAdult(userOrId) {
    return isParent(userOrId);
  }

  function getProtectionLevel(userOrId) {
    const rights = getRights();
    const user = typeof userOrId === "string" ? getUserById(userOrId) : userOrId;
    const userId = typeof userOrId === "string" ? userOrId : getUserId(user);
    const role = getRole(userOrId);

    if (rights.protection?.[userId]) return rights.protection[userId];
    if (role === "child") return "protected";
    if (role === "teen") return "independent";

    return "custom";
  }

  function getChildRights(userId) {
    const rights = getRights();
    const oldPermissions = readJSON(KEYS.oldPermissions, {});

    const newer = rights.child?.[userId] || {};
    const old = oldPermissions?.[userId] || {};

    return {
      tasks_view: newer.tasks_view ?? true,
      tasks_done: newer.tasks_done ?? old.canManageTasks ?? true,
      family_chat: newer.family_chat ?? old.canUseChat ?? true,
      parent_chat: newer.parent_chat ?? true,
      shopping_suggest: newer.shopping_suggest ?? old.shopping ?? old.canCreateWish ?? false,
      money_view: newer.money_view ?? old.money ?? old.canViewMoney ?? false,
      appointments_view: newer.appointments_view ?? old.appointments ?? false,
      ki_child: newer.ki_child ?? false,
      private_chat: newer.private_chat ?? false,
      attachments: newer.attachments ?? false,
      scanner: newer.scanner ?? old.scanner ?? old.canScanReceipts ?? false
    };
  }

  function hasChildRight(userId, rightName) {
    const role = getRole(userId);

    if (role === "owner" || role === "parent" || role === "parent_limited") return true;

    const rights = getChildRights(userId);
    return !!rights[rightName];
  }

  function getPrivacySettings(userId) {
    const rights = getRights();

    return rights.privacy?.[userId] || {
      appointments: "private",
      appointmentDetails: "busy_only",
      shopping: "family",
      tasks: "private"
    };
  }

  function getFinanceSettings(userId) {
    const rights = getRights();

    return rights.finance?.[userId] || {
      visibility: "private",
      balance: "hidden",
      privateMode: "masked_amount",
      hideIban: true,
      hideReceipts: true,
      planningRelevant: true
    };
  }

  function getChatSettings(userId) {
    const rights = getRights();

    return rights.chat?.[userId] || {
      parentChildChat: true,
      privateChildChat: false,
      reportChat: true,
      attachments: false
    };
  }

  function getActiveGrants() {
    const grants = readJSON(KEYS.grants, []);
    return Array.isArray(grants) ? grants : [];
  }

  function hasGrant(ownerId, viewerId, area, level) {
    const grants = getActiveGrants();

    return grants.some((grant) => {
      const ownerMatches = grant.ownerId === ownerId;
      const viewerMatches = grant.grantedTo === viewerId;
      const areaMatches = !area || grant.area === area;
      const levelMatches = !level || grant.level === level || grant.level === "full";

      return ownerMatches && viewerMatches && areaMatches && levelMatches;
    });
  }

  function addAudit(action, affectedUserId, note) {
    const current = getCurrentUser();
    const audit = readJSON(KEYS.audit, []);

    const entry = {
      id: "audit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      time: new Date().toISOString(),
      actorId: getUserId(current),
      actorName: current?.name || current?.username || "System",
      affectedUserId: affectedUserId || "",
      action: action || "Aktion",
      note: note || ""
    };

    audit.unshift(entry);
    writeJSON(KEYS.audit, audit.slice(0, 150));

    return entry;
  }

  function createShareRequest(ownerId, area, level, note) {
    const current = getCurrentUser();
    const requesterId = getUserId(current);

    if (!ownerId || !requesterId) return null;

    if (ownerId === requesterId) {
      return {
        ok: false,
        message: "Eigene Inhalte kannst du selbst verwalten."
      };
    }

    const requests = readJSON(KEYS.requests, []);

    const request = {
      id: "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      requesterId,
      ownerId,
      area,
      level,
      note: note || "Freigabe wurde angefragt.",
      status: "open",
      createdAt: new Date().toISOString()
    };

    requests.unshift(request);
    writeJSON(KEYS.requests, requests);

    addAudit("Freigabe angefragt", ownerId, areaLabel(area) + " · " + accessLabel(level));

    return {
      ok: true,
      request
    };
  }

  function answerShareRequest(requestId, answer) {
    const current = getCurrentUser();
    const currentId = getUserId(current);

    const requests = readJSON(KEYS.requests, []);
    const grants = readJSON(KEYS.grants, []);

    const request = requests.find((item) => item.id === requestId);
    if (!request) return null;

    if (request.ownerId !== currentId && !isOwner(current)) {
      return {
        ok: false,
        message: "Nur der Besitzer kann diese Freigabe beantworten."
      };
    }

    request.status = answer === "approved" ? "approved" : "denied";
    request.answeredAt = new Date().toISOString();

    if (request.status === "approved") {
      grants.unshift({
        id: "grant_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        ownerId: request.ownerId,
        grantedTo: request.requesterId,
        area: request.area,
        level: request.level,
        createdAt: new Date().toISOString()
      });

      writeJSON(KEYS.grants, grants);
      addAudit("Freigabe erteilt", request.ownerId, areaLabel(request.area) + " · " + accessLabel(request.level));
    } else {
      addAudit("Freigabe abgelehnt", request.ownerId, areaLabel(request.area) + " · " + accessLabel(request.level));
    }

    writeJSON(KEYS.requests, requests);

    return {
      ok: true,
      request
    };
  }

  function revokeGrant(grantId) {
    const current = getCurrentUser();
    const currentId = getUserId(current);
    const grants = readJSON(KEYS.grants, []);

    const grant = grants.find((item) => item.id === grantId);
    if (!grant) return null;

    if (grant.ownerId !== currentId && !isOwner(current)) {
      return {
        ok: false,
        message: "Nur der Besitzer kann diese Freigabe widerrufen."
      };
    }

    const next = grants.filter((item) => item.id !== grantId);
    writeJSON(KEYS.grants, next);

    addAudit("Freigabe widerrufen", grant.ownerId, areaLabel(grant.area));

    return {
      ok: true
    };
  }

  function getEntryOwnerId(entry) {
    if (!entry) return "";
    return entry.ownerId || entry.userId || entry.personId || entry.createdBy || entry.owner || entry.person || "";
  }

  function getEntryVisibility(entry) {
    if (!entry) return "private";
    return entry.visibility || entry.sichtbarkeit || "family";
  }

  function getEntrySharedWith(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.sharedWith)) return entry.sharedWith;
    if (Array.isArray(entry.shared_with)) return entry.shared_with;
    return [];
  }

  function getEntryPlanningImpact(entry) {
    if (!entry) return "none";
    return entry.planningImpact || entry.planning_impact || "full";
  }

  function getEntryDetailVisibility(entry) {
    if (!entry) return "hidden";
    return entry.detailVisibility || entry.detail_visibility || "full";
  }

  function canViewEntry(viewer, entry, area) {
    if (!viewer || !entry) return false;

    const viewerId = getUserId(viewer);
    const ownerId = getEntryOwnerId(entry);
    const visibility = getEntryVisibility(entry);
    const sharedWith = getEntrySharedWith(entry);

    if (!ownerId) return true;
    if (viewerId === ownerId) return true;

    const owner = getUserById(ownerId);

    if (isAdult(owner) && isAdult(viewer) && visibility === "private") {
      return hasGrant(ownerId, viewerId, area, "full") || hasGrant(ownerId, viewerId, area, "masked") || hasGrant(ownerId, viewerId, area, "summary");
    }

    if (isMinor(owner) && isMinor(viewer) && ownerId !== viewerId && visibility === "private") {
      return false;
    }

    if (visibility === "family") return true;

    if (visibility === "parents") return isParent(viewer);

    if (visibility === "partner") {
      return isAdult(viewer) && (hasGrant(ownerId, viewerId, area) || sharedWith.includes(viewerId));
    }

    if (visibility === "selected") {
      return sharedWith.includes(viewerId) || hasGrant(ownerId, viewerId, area);
    }

    if (visibility === "private") {
      return hasGrant(ownerId, viewerId, area);
    }

    return false;
  }

  function getDisplayMode(viewer, entry, area) {
    if (!viewer || !entry) return "hidden";

    const viewerId = getUserId(viewer);
    const ownerId = getEntryOwnerId(entry);
    const planningImpact = getEntryPlanningImpact(entry);
    const detailVisibility = getEntryDetailVisibility(entry);

    if (viewerId === ownerId) return "full";

    if (canViewEntry(viewer, entry, area)) {
      if (detailVisibility === "busy_only") return "busy_only";
      if (detailVisibility === "masked") return "masked";
      if (detailVisibility === "hidden") return "hidden";
      return "full";
    }

    if (planningImpact === "private_amount") return "masked";
    if (planningImpact === "summary_only") return "summary";
    if (detailVisibility === "busy_only") return "busy_only";

    return "hidden";
  }

  function maskEntryForViewer(viewer, entry, area) {
    const mode = getDisplayMode(viewer, entry, area);

    if (mode === "full") return { ...entry, __displayMode: "full" };

    if (mode === "busy_only") {
      return {
        id: entry.id,
        ownerId: getEntryOwnerId(entry),
        title: "Privater Termin",
        date: entry.date || entry.start || entry.start_time || "",
        start: entry.start || entry.start_time || "",
        end: entry.end || entry.end_time || "",
        visibility: "private",
        __displayMode: "busy_only",
        __masked: true
      };
    }

    if (mode === "masked") {
      return {
        id: entry.id,
        ownerId: getEntryOwnerId(entry),
        title: area === "finance" ? "Private Ausgabe" : "Privater Eintrag",
        amount: entry.amount ?? entry.betrag ?? null,
        date: entry.date || entry.datum || "",
        category: "Privat",
        visibility: "private",
        __displayMode: "masked",
        __masked: true
      };
    }

    if (mode === "summary") {
      return {
        id: entry.id,
        ownerId: getEntryOwnerId(entry),
        title: "Private Summe",
        amount: entry.amount ?? entry.betrag ?? null,
        visibility: "private",
        __displayMode: "summary",
        __masked: true
      };
    }

    return null;
  }

  function filterEntriesForCurrentUser(entries, area) {
    const viewer = getCurrentUser();
    if (!Array.isArray(entries)) return [];

    return entries
      .map((entry) => maskEntryForViewer(viewer, entry, area))
      .filter(Boolean);
  }

  function canAccessAdmin(user) {
    return isOwner(user) || isFullParent(user);
  }

  function canManageChildren(user) {
    return isOwner(user) || isFullParent(user);
  }

  function canUseFamilyChat(user) {
    if (!user) return false;
    return true;
  }

  function canUseParentChildChat(user) {
    if (!user) return false;
    return true;
  }

  function canUsePrivateChildChat(user) {
    const userId = getUserId(user);
    const chat = getChatSettings(userId);

    if (isTeen(user)) return !!chat.privateChildChat;
    if (isChild(user)) return !!chat.privateChildChat;

    return true;
  }

  function canUseAttachmentInChat(user) {
    const userId = getUserId(user);
    const chat = getChatSettings(userId);

    if (isChild(user) || isTeen(user)) return !!chat.attachments;

    return true;
  }

  function bootstrap() {
    const current = getCurrentUser();
    const body = document.body;

    if (!body || !current) return;

    const role = getRole(current);
    body.dataset.hhRole = role;

    if (isParent(current)) body.classList.add("hh-role-parent");
    if (isOwner(current)) body.classList.add("hh-role-owner");
    if (isChild(current)) body.classList.add("hh-role-child");
    if (isTeen(current)) body.classList.add("hh-role-teen");

    document.querySelectorAll("[data-hh-parent-only]").forEach((el) => {
      el.style.display = isParent(current) ? "" : "none";
    });

    document.querySelectorAll("[data-hh-child-only]").forEach((el) => {
      el.style.display = isMinor(current) ? "" : "none";
    });

    document.querySelectorAll("[data-hh-admin-only]").forEach((el) => {
      el.style.display = canAccessAdmin(current) ? "" : "none";
    });
  }

  const HHRechte = {
    keys: KEYS,

    readJSON,
    writeJSON,

    getCurrentUser,
    getAllUsers,
    getUserById,
    getUserId,

    getRights,
    saveRights,

    normalizeRole,
    roleLabel,
    areaLabel,
    accessLabel,

    getRole,
    isOwner,
    isParent,
    isFullParent,
    isAdult,
    isChild,
    isTeen,
    isMinor,

    getProtectionLevel,

    getChildRights,
    hasChildRight,

    getPrivacySettings,
    getFinanceSettings,
    getChatSettings,

    getActiveGrants,
    hasGrant,

    createShareRequest,
    answerShareRequest,
    revokeGrant,

    addAudit,

    canViewEntry,
    getDisplayMode,
    maskEntryForViewer,
    filterEntriesForCurrentUser,

    canAccessAdmin,
    canManageChildren,
    canUseFamilyChat,
    canUseParentChildChat,
    canUsePrivateChildChat,
    canUseAttachmentInChat,

    bootstrap
  };

  window.HHRechte = HHRechte;

  document.addEventListener("DOMContentLoaded", bootstrap);
})();