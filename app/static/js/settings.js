(function initSettings() {
  window.chatApp.bindLogout();

  const form = document.getElementById("settings-form");
  const errorElement = document.getElementById("settings-error");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorElement.classList.add("hidden");

    const formData = new FormData(form);
    const profilePayload = new FormData();
    profilePayload.append("display_name", formData.get("display_name"));
    profilePayload.append("status_text", formData.get("status_text"));
    const avatar = formData.get("avatar");
    if (avatar && avatar.name) {
      profilePayload.append("avatar", avatar);
    }

    try {
      await window.chatApp.request("/api/me/profile", {
        method: "POST",
        body: profilePayload,
      });

      await window.chatApp.request("/api/me/settings", {
        method: "POST",
        body: {
          browser_notifications_enabled: formData.get("browser_notifications_enabled") === "on",
          sound_enabled: formData.get("sound_enabled") === "on",
          vibration_enabled: formData.get("vibration_enabled") === "on",
          read_receipts_enabled: formData.get("read_receipts_enabled") === "on",
          last_seen_visibility: formData.get("last_seen_visibility") === "on",
          media_auto_download_enabled: formData.get("media_auto_download_enabled") === "on",
          theme: formData.get("theme"),
        },
      });

      window.chatApp.showToast("Settings saved.", "success");
    } catch (error) {
      errorElement.textContent = error.message;
      errorElement.classList.remove("hidden");
    }
  });
})();
