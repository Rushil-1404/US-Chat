(function initChat() {
  window.chatApp.bindLogout();

  const bootstrap = window.APP_BOOTSTRAP || {};
  const currentUserId = bootstrap.currentUserId;
  const conversationId = bootstrap.conversationId;
  const sendTextUrl = bootstrap.sendTextUrl;
  const sendFileUrl = bootstrap.sendFileUrl;

  const messagesList = document.getElementById("messages-list");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");
  const fileInput = document.getElementById("file-input");
  const attachButton = document.getElementById("input-attach");
  const uploadStatus = document.getElementById("upload-status");
  const menuButton = document.getElementById("header-menu");
  const dropdownMenu = document.getElementById("dropdown-menu");

  function scrollToBottom() {
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  function statusMarkup(message) {
    if (!message.is_mine) {
      return "";
    }
    return `<span class="text-[10px] opacity-90" data-status>${window.chatApp.escapeHtml(message.delivery_status)}</span>`;
  }

  function renderMessage(message) {
    const isMine = message.sender_id === currentUserId;
    message.is_mine = isMine;
    const timestamp = window.chatApp.formatDateTime(message.created_at);
    const wrapperClass = isMine ? "justify-end" : "justify-start";

    let content = "";
    if (message.message_type === "text") {
      content = `
        <div class="max-w-[85%] ${isMine ? "bg-wa-green text-white rounded-2xl rounded-tr-none" : "bg-white rounded-2xl rounded-tl-none"} p-3 shadow-sm">
          <p class="text-[14px] ${isMine ? "" : "text-gray-800"} leading-relaxed">${window.chatApp.escapeHtml(message.text_body || "")}</p>
          <div class="flex justify-end items-center mt-1 gap-1">
            <span class="text-[10px] ${isMine ? "opacity-80" : "text-gray-400"}">${timestamp}</span>
            ${statusMarkup(message)}
          </div>
        </div>
      `;
    } else if (message.file && message.message_type === "image") {
      content = `
        <div class="max-w-[85%] bg-white rounded-2xl ${isMine ? "rounded-tr-none" : "rounded-tl-none"} p-2 shadow-sm">
          <div class="relative rounded-xl overflow-hidden mb-2">
            <img src="${window.chatApp.escapeHtml(message.file.preview_url)}" alt="${window.chatApp.escapeHtml(message.file.original_name)}" class="w-full h-auto object-cover max-h-72">
          </div>
          <p class="text-[14px] text-gray-800 px-1">${window.chatApp.escapeHtml(message.file.original_name)}</p>
          <div class="flex justify-end items-center mt-1 gap-1 px-1">
            <span class="text-[10px] text-gray-400">${timestamp}</span>
          </div>
        </div>
      `;
    } else {
      const failedAction = message.file?.upload_status === "failed"
        ? `<button type="button" class="retry-file text-xs font-semibold text-red-500" data-retry-url="${window.chatApp.escapeHtml(message.file.retry_url)}">Retry</button>`
        : "";
      content = `
        <div class="max-w-[85%] ${isMine ? "bg-wa-green text-white rounded-2xl rounded-tr-none border-white/10" : "bg-white text-gray-900 rounded-2xl rounded-tl-none border-gray-100"} p-3 shadow-sm flex items-center gap-3 border">
          <div class="w-10 h-10 rounded-lg ${message.message_type === "document" ? "bg-red-50 text-red-500" : message.message_type === "video" ? "bg-black/20 text-white" : "bg-white/20"} flex items-center justify-center shrink-0">
            <iconify-icon icon="${message.message_type === "video" ? "lucide:play" : message.message_type === "document" ? "lucide:file-text" : "lucide:file"}" width="24"></iconify-icon>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[14px] font-medium truncate">${window.chatApp.escapeHtml(message.file?.original_name || message.text_body || "Attachment")}</p>
            <p class="text-[12px] ${isMine ? "opacity-80" : "text-gray-500"}">${window.chatApp.escapeHtml(message.file?.upload_status || message.delivery_status)}</p>
          </div>
          ${message.file ? `<a href="${window.chatApp.escapeHtml(message.file.download_url)}" class="${isMine ? "text-white/80" : "text-gray-400 hover:text-gray-600"}"><iconify-icon icon="lucide:download" width="18"></iconify-icon></a>` : ""}
          ${failedAction}
        </div>
      `;
    }

    return `
      <div class="message-in flex ${wrapperClass}" data-message-id="${message.id}">
        ${content}
      </div>
    `;
  }

  function upsertMessage(message) {
    message.is_mine = message.sender_id === currentUserId;
    const existing = messagesList.querySelector(`[data-message-id="${message.id}"]`);
    const html = renderMessage(message);
    if (existing) {
      existing.outerHTML = html;
    } else {
      messagesList.insertAdjacentHTML("beforeend", html);
      scrollToBottom();
    }
  }

  async function markDelivered(messageId) {
    try {
      await window.chatApp.request(`/api/messages/${messageId}/delivered`, { method: "POST" });
    } catch (_error) {
      // Best effort acknowledgement.
    }
  }

  async function markRead(messageId) {
    try {
      await window.chatApp.request(`/api/messages/${messageId}/read`, { method: "POST" });
    } catch (_error) {
      // Best effort acknowledgement.
    }
  }

  const socket = window.io ? window.io() : null;
  if (socket) {
    socket.on("connect", () => {
      socket.emit("join_conversation", { conversation_id: conversationId });
    });

    socket.on("message_created", async (message) => {
      if (Number(message.conversation_id) !== Number(conversationId)) {
        return;
      }
      upsertMessage(message);
      if (message.sender_id !== currentUserId) {
        await markDelivered(message.id);
        await markRead(message.id);
      }
    });

    socket.on("message_delivered", (payload) => {
      const node = messagesList.querySelector(`[data-message-id="${payload.message_id}"] [data-status]`);
      if (node) {
        node.textContent = payload.delivery_status;
      }
    });

    socket.on("message_read", (payload) => {
      (payload.message_ids || []).forEach((messageId) => {
        const node = messagesList.querySelector(`[data-message-id="${messageId}"] [data-status]`);
        if (node) {
          node.textContent = "read";
        }
      });
    });
  }

  attachButton?.addEventListener("click", () => fileInput?.click());

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    uploadStatus.textContent = `Uploading ${file.name}...`;
    uploadStatus.classList.remove("hidden");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const payload = await window.chatApp.request(sendFileUrl, {
        method: "POST",
        body: formData,
      });
      if (payload.message) {
        upsertMessage(payload.message);
      }
      window.chatApp.showToast("File shared successfully.", "success");
    } catch (error) {
      if (error.payload?.message_payload) {
        upsertMessage(error.payload.message_payload);
      }
      window.chatApp.showToast(error.message || "Upload failed.", "error");
    } finally {
      fileInput.value = "";
      uploadStatus.classList.add("hidden");
    }
  });

  messageForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textBody = messageInput.value.trim();
    if (!textBody) {
      return;
    }

    try {
      const payload = await window.chatApp.request(sendTextUrl, {
        method: "POST",
        body: { text_body: textBody },
      });
      if (payload.message) {
        upsertMessage(payload.message);
      }
      messageInput.value = "";
      scrollToBottom();
    } catch (error) {
      window.chatApp.showToast(error.message || "Unable to send message.", "error");
    }
  });

  messagesList?.addEventListener("click", async (event) => {
    const retryButton = event.target.closest(".retry-file");
    if (!retryButton) {
      return;
    }

    try {
      const payload = await window.chatApp.request(retryButton.dataset.retryUrl, { method: "POST" });
      if (payload.message) {
        upsertMessage(payload.message);
      }
      window.chatApp.showToast("Upload retried successfully.", "success");
    } catch (error) {
      window.chatApp.showToast(error.message || "Unable to retry upload.", "error");
    }
  });

  menuButton?.addEventListener("click", () => {
    dropdownMenu?.classList.toggle("hidden");
  });

  window.addEventListener("click", (event) => {
    if (!event.target.closest("#header-menu") && !event.target.closest("#dropdown-menu")) {
      dropdownMenu?.classList.add("hidden");
    }
  });

  scrollToBottom();
})();
