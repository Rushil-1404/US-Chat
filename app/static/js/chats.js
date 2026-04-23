(function initChats() {
  window.chatApp.bindLogout();

  const searchInput = document.getElementById("chat-search-input");
  const modal = document.getElementById("new-chat-modal");
  const modalOpenButton = document.getElementById("fab-new-chat");
  const modalCloseButton = document.getElementById("close-new-chat-modal");
  const newChatForm = document.getElementById("new-chat-form");
  const errorElement = document.getElementById("new-chat-error");

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    document.querySelectorAll(".conversation-item").forEach((item) => {
      const name = (item.dataset.name || "").toLowerCase();
      item.classList.toggle("hidden", query && !name.includes(query));
    });
  });

  function toggleModal(show) {
    modal?.classList.toggle("hidden", !show);
    modal?.classList.toggle("flex", show);
  }

  modalOpenButton?.addEventListener("click", () => toggleModal(true));
  modalCloseButton?.addEventListener("click", () => toggleModal(false));
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      toggleModal(false);
    }
  });

  newChatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorElement.classList.add("hidden");
    const formData = new FormData(newChatForm);

    try {
      const payload = await window.chatApp.request("/api/conversations/resolve-by-phone", {
        method: "POST",
        body: { phone_number: formData.get("phone_number") },
      });
      window.location.href = payload.redirect_url;
    } catch (error) {
      errorElement.textContent = error.message;
      errorElement.classList.remove("hidden");
    }
  });
})();
