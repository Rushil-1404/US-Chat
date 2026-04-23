window.chatApp = (() => {
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) {
      return;
    }

    const toast = document.createElement("div");
    const palette = {
      info: "bg-gray-900 text-white",
      success: "bg-green-600 text-white",
      error: "bg-red-600 text-white",
    };
    toast.className = `px-4 py-3 rounded-2xl shadow-lg text-sm ${palette[type] || palette.info}`;
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-1", "transition-all", "duration-300");
      window.setTimeout(() => toast.remove(), 350);
    }, 2600);
  }

  async function request(url, options = {}) {
    const config = { ...options };
    config.headers = { "X-Requested-With": "XMLHttpRequest", ...(config.headers || {}) };

    if (config.body && !(config.body instanceof FormData) && typeof config.body === "object") {
      config.headers["Content-Type"] = "application/json";
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok || (payload && payload.ok === false)) {
      const message = payload?.message || `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function logout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch (error) {
      showToast(error.message || "Unable to log out right now.", "error");
      return;
    }
    window.location.href = "/";
  }

  function bindLogout(selector = "[data-logout]") {
    document.querySelectorAll(selector).forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        logout();
      });
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(value) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function humanFileSize(bytes) {
    const numeric = Number(bytes || 0);
    if (numeric <= 0) {
      return "0 B";
    }
    const units = ["B", "KB", "MB", "GB"];
    let size = numeric;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  return {
    request,
    showToast,
    bindLogout,
    escapeHtml,
    formatDateTime,
    humanFileSize,
  };
})();
