(function () {
  "use strict";

  const DEFAULT_PERMISSIONS = {
    kind1: {
      money: false,
      appointments: false,
      scanner: false,
      shopping: false
    }
  };

  const DEFAULT_REQUESTS = [];

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

  const Permissions = {
    getAll() {
      return load("hh_permissions_v2", structuredClone(DEFAULT_PERMISSIONS));
    },

    saveAll(data) {
      return save("hh_permissions_v2", data);
    },

    getForUser(userId) {
      const all = this.getAll();
      return all[userId] || {
        money: false,
        appointments: false,
        scanner: false,
        shopping: false
      };
    },

    setPermission(userId, permissionName, value) {
      const all = this.getAll();

      if (!all[userId]) {
        all[userId] = {};
      }

      all[userId][permissionName] = value;
      this.saveAll(all);
      return all[userId];
    },

    hasPermission(userId, permissionName) {
      const userPermissions = this.getForUser(userId);
      return !!userPermissions[permissionName];
    },

    getRequests() {
      return load("hh_requests", structuredClone(DEFAULT_REQUESTS));
    },

    saveRequests(requests) {
      return save("hh_requests", requests);
    },

    createRequest(fromUserId, type) {
      const requests = this.getRequests();

      const newRequest = {
        id: "req_" + Date.now(),
        from: fromUserId,
        type: type,
        status: "open",
        createdAt: new Date().toISOString()
      };

      requests.push(newRequest);
      this.saveRequests(requests);
      return newRequest;
    },

    answerRequest(requestId, answer) {
      const requests = this.getRequests();

      const request = requests.find((item) => item.id === requestId);
      if (!request) return null;

      request.status = answer;
      request.answeredAt = new Date().toISOString();

      if (answer === "approved") {
        if (request.type === "money_access") {
          this.setPermission(request.from, "money", true);
        }
        if (request.type === "appointments_access") {
          this.setPermission(request.from, "appointments", true);
        }
        if (request.type === "scanner_access") {
          this.setPermission(request.from, "scanner", true);
        }
        if (request.type === "shopping_access") {
          this.setPermission(request.from, "shopping", true);
        }
      }

      this.saveRequests(requests);
      return request;
    }
  };

  window.HHPermissions = Permissions;
})();