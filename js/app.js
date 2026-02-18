if (chatForm) chatForm.addEventListener("submit", handleSendMessage);

if (messageInput) {
    messageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            chatForm.requestSubmit();
        }
    });

    messageInput.addEventListener("input", autoGrowTextarea);
}

if (newChatButton) {
    newChatButton.addEventListener("click", () => {
        createChat(true);
    });
}

if (clearAllChatsButton) {
    clearAllChatsButton.addEventListener("click", clearAllChats);
}

if (chatSearchInput) {
    chatSearchInput.addEventListener("input", (event) => {
        setChatSearchQuery(event.target.value);
    });
}

if (imageUploadButton) {
    imageUploadButton.addEventListener("click", () => {
        if (!MULTIMODAL_MODEL_IDS.has(currentModelId)) {
            addMessage(
                "assistant",
                "Image upload is blocked for this model. Switch to Gemini 2.5 Flash, Gemini 2.5 Pro, or Nano Banana.",
                false
            );
            return;
        }
        if (imageInput) imageInput.click();
    });
}

if (imageInput) {
    imageInput.addEventListener("change", handleImageUpload);
}

configureMarkdown();
initTheme();
initSettingsUI();
if (typeof window.initStudyFeatures === "function") {
    window.initStudyFeatures();
}
initModelSelector();
loadChats();
autoGrowTextarea();
if (typeof window.initSendButton === "function") {
    window.initSendButton();
}
if (window.lucide) lucide.createIcons();

// Fallback: ensure student tools toggle is always bound
const _toggleBtn = document.getElementById("studentToolsToggleButton");
if (_toggleBtn && !_toggleBtn.dataset.bound) {
    _toggleBtn.addEventListener("click", function () {
        if (typeof window.toggleStudentToolsSection === "function") {
            window.toggleStudentToolsSection();
        }
    });
    _toggleBtn.dataset.bound = "true";
}
