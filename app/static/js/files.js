(function initFilesPage() {
  const tabs = Array.from(document.querySelectorAll(".file-tab"));
  const cards = Array.from(document.querySelectorAll(".gallery-card"));

  function activateTab(filter) {
    tabs.forEach((tab) => {
      const active = tab.dataset.filter === filter;
      tab.classList.toggle("text-wa-green", active);
      tab.classList.toggle("border-b-2", active);
      tab.classList.toggle("border-wa-green", active);
      tab.classList.toggle("font-semibold", active);
      tab.classList.toggle("text-gray-400", !active);
      tab.classList.toggle("font-medium", !active);
    });

    cards.forEach((card) => {
      const matches = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("hidden", !matches);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.filter));
  });

  document.getElementById("gallery-grid")?.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".delete-file");
    const retryButton = event.target.closest(".retry-file");

    if (retryButton) {
      try {
        await window.chatApp.request(retryButton.dataset.retryUrl, { method: "POST" });
        window.location.reload();
      } catch (error) {
        window.chatApp.showToast(error.message || "Unable to retry upload.", "error");
      }
      return;
    }

    if (deleteButton) {
      try {
        await window.chatApp.request(deleteButton.dataset.deleteUrl, { method: "DELETE" });
        deleteButton.closest(".gallery-card")?.remove();
        window.chatApp.showToast("File removed.", "success");
      } catch (error) {
        window.chatApp.showToast(error.message || "Unable to remove file.", "error");
      }
    }
  });
})();
