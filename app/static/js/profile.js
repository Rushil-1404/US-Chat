(function initProfileSetup() {
  const form = document.getElementById("profile-setup-form");
  const errorElement = document.getElementById("profile-error");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorElement.classList.add("hidden");

    const formData = new FormData(form);
    try {
      const payload = await window.chatApp.request("/api/me/profile", {
        method: "POST",
        body: formData,
      });
      window.location.href = payload.redirect_url;
    } catch (error) {
      errorElement.textContent = error.message;
      errorElement.classList.remove("hidden");
    }
  });
})();
