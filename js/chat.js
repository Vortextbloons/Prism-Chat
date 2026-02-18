function configureMarkdown() {
    if (typeof marked === "undefined") return;

    marked.setOptions({
        breaks: true,
        gfm: true
    });
}

function applyCodeHighlighting(rootElement) {
    if (!rootElement || typeof hljs === "undefined") return;

    const codeBlocks = rootElement.querySelectorAll("pre code");
    codeBlocks.forEach((block) => {
        hljs.highlightElement(block);
    });
}

function generateChatId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function logApiErrorResponse(providerName, response) {
    if (!response) return;

    let responseText = "";
    try {
        responseText = await response.text();
    } catch {
        responseText = "";
    }

    console.error(`${providerName} API request failed`, {
        status: response.status,
        statusText: response.statusText,
        body: responseText || "<empty response body>"
    });
}

function autoGrowTextarea() {
    if (!messageInput) return;
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function scrollToBottom() {
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function initSendButton() {
    setGenerationState(false);
}

function setGenerationState(generating) {
    isGenerating = generating;

    if (!sendButton) return;

    if (generating) {
        sendButton.setAttribute("aria-label", "Stop");
        sendButton.innerHTML = '<i data-lucide="square"></i>';
    } else {
        sendButton.setAttribute("aria-label", "Send");
        sendButton.innerHTML = '<i data-lucide="send-horizontal"></i>';
    }

    if (window.lucide) {
        lucide.createIcons({ root: sendButton });
    }
}

function stopActiveGeneration() {
    if (activeRequestController) {
        activeRequestController.abort();
    }
}

function copyMessageText(content, triggerButton) {
    const text = getTextFromContent(content);
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        if (!triggerButton) return;
        const original = triggerButton.getAttribute("aria-label") || "Copy response";
        triggerButton.setAttribute("aria-label", "Copied");
        triggerButton.classList.add("copied");
        setTimeout(() => {
            triggerButton.setAttribute("aria-label", original);
            triggerButton.classList.remove("copied");
        }, 1200);
    }).catch(() => {
        console.error("Failed to copy response text.");
    });
}

function createMessageActions(role, content, messageIndex) {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    if (role === "assistant") {
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "message-action-btn";
        copyButton.setAttribute("aria-label", "Copy response");
        copyButton.innerHTML = '<i data-lucide="copy"></i>';
        copyButton.addEventListener("click", () => {
            copyMessageText(content, copyButton);
        });
        actions.appendChild(copyButton);

        const chat = getCurrentChat();
        const isLatestAssistant = Number.isInteger(messageIndex)
            && chat
            && messageIndex === chat.messages.length - 1
            && chat.messages[messageIndex]?.role === "assistant";

        if (isLatestAssistant) {
            const regenerateButton = document.createElement("button");
            regenerateButton.type = "button";
            regenerateButton.className = "message-action-btn";
            regenerateButton.setAttribute("aria-label", "Regenerate response");
            regenerateButton.innerHTML = '<i data-lucide="refresh-cw"></i>';
            regenerateButton.addEventListener("click", () => {
                regenerateAssistantReply(messageIndex);
            });
            actions.appendChild(regenerateButton);
        }
    }

    if (role === "user" && Number.isInteger(messageIndex)) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "message-action-btn";
        editButton.setAttribute("aria-label", "Edit and resend");
        editButton.innerHTML = '<i data-lucide="pencil"></i>';
        editButton.addEventListener("click", () => {
            editAndResendMessage(messageIndex);
        });
        actions.appendChild(editButton);
    }

    if (actions.childElementCount === 0) {
        return null;
    }

    return actions;
}

function createMessageElement(role, content, isMarkdown = false, messageIndex = null) {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${role === "user" ? "user" : "assistant"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    if (role === "user") {
        avatar.innerHTML = `<i data-lucide="user"></i>`;
    } else {
        avatar.innerHTML = `<i data-lucide="sparkles"></i>`;
    }

    const textContent = document.createElement("div");
    textContent.className = "message-content";

    if (role === "user") {
        renderUserContent(textContent, content);
    } else {
        renderAssistantContent(textContent, content, isMarkdown);
        if (isMarkdown) {
            applyCodeHighlighting(textContent);
        }
    }

    messageElement.appendChild(avatar);
    messageElement.appendChild(textContent);

    const actions = createMessageActions(role, content, messageIndex);
    if (actions) {
        textContent.appendChild(actions);
    }

    if (window.lucide) {
        requestAnimationFrame(() => lucide.createIcons({ root: messageElement }));
    }

    return messageElement;
}

function getCurrentChat() {
    return chats.find((chat) => chat.id === currentChatId) || null;
}

function saveChats() {
    localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats));
    if (currentChatId) {
        localStorage.setItem(STORAGE_KEYS.activeChatId, currentChatId);
    }
}

function touchCurrentChat() {
    const chat = getCurrentChat();
    if (!chat) {
        return;
    }
    chat.updatedAt = Date.now();
}

function renderMessages() {
    if (!chatWindow) return;
    chatWindow.innerHTML = "";
    if (messages.length === 0) return;

    messages.forEach((item, index) => {
        const isAi = item.role === "assistant";
        chatWindow.appendChild(createMessageElement(item.role, item.content, isAi, index));
    });
    scrollToBottom();
}

function setChatSearchQuery(value) {
    chatSearchQuery = String(value || "").trim().toLowerCase();
    localStorage.setItem(STORAGE_KEYS.search, value || "");
    renderChatList();
}

function chatMatchesSearch(chat) {
    if (!chatSearchQuery) return true;

    const title = String(chat.title || "").toLowerCase();
    if (title.includes(chatSearchQuery)) return true;

    const conversationText = (chat.messages || [])
        .map((message) => getTextFromContent(message.content))
        .join("\n")
        .toLowerCase();

    return conversationText.includes(chatSearchQuery);
}

function renameChat(chatId) {
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;

    const renamed = prompt("Rename conversation", chat.title);
    if (renamed === null) return;

    const trimmed = renamed.trim();
    if (!trimmed) return;

    chat.title = trimmed.slice(0, 60);
    chat.updatedAt = Date.now();
    saveChats();
    renderChatList();
}

function deleteChat(chatId) {
    const index = chats.findIndex((item) => item.id === chatId);
    if (index === -1) return;

    const [removed] = chats.splice(index, 1);

    if (chats.length === 0) {
        createChat(true);
        return;
    }

    const shouldSwitch = removed.id === currentChatId;
    saveChats();

    if (shouldSwitch) {
        const nextChat = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        setActiveChat(nextChat.id);
    } else {
        renderChatList();
    }
}

function clearAllChats() {
    if (!confirm("Delete all conversations?")) return;

    chats = [];
    localStorage.removeItem(STORAGE_KEYS.chats);
    localStorage.removeItem(STORAGE_KEYS.activeChatId);
    createChat(true);
}

function renderChatList() {
    if (!chatList) return;
    chatList.innerHTML = "";

    const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
    const filteredChats = sortedChats.filter(chatMatchesSearch);

    if (filteredChats.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "chat-list-empty";
        emptyState.textContent = "No chats found";
        chatList.appendChild(emptyState);
        return;
    }

    filteredChats.forEach((chat) => {
        const item = document.createElement("div");
        item.className = `chat-item${chat.id === currentChatId ? " active" : ""}`;

        const title = document.createElement("span");
        title.className = "chat-item-title";
        title.textContent = chat.title;

        const actions = document.createElement("div");
        actions.className = "chat-item-actions";

        const renameButton = document.createElement("button");
        renameButton.className = "chat-action";
        renameButton.type = "button";
        renameButton.setAttribute("aria-label", "Rename conversation");
        renameButton.innerHTML = '<i data-lucide="pencil"></i>';
        renameButton.addEventListener("click", (event) => {
            event.stopPropagation();
            renameChat(chat.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "chat-action";
        deleteButton.type = "button";
        deleteButton.setAttribute("aria-label", "Delete conversation");
        deleteButton.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            deleteChat(chat.id);
        });

        actions.appendChild(renameButton);
        actions.appendChild(deleteButton);
        item.appendChild(title);
        item.appendChild(actions);

        item.addEventListener("click", () => setActiveChat(chat.id));
        chatList.appendChild(item);
    });

    if (window.lucide) {
        requestAnimationFrame(() => lucide.createIcons({ root: chatList }));
    }
}

function updateChatTitleFromMessages() {
    const chat = getCurrentChat();
    if (!chat) return;
    if (chat.title !== "New Chat") return;

    const firstUserMessage = chat.messages.find((item) => item.role === "user");
    if (!firstUserMessage) return;

    chat.title = getTextFromContent(firstUserMessage.content).slice(0, 30) || "New Chat";
    renderChatList();
}

function setActiveChat(chatId) {
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;

    currentChatId = chat.id;
    messages = JSON.parse(JSON.stringify(chat.messages));
    renderMessages();
    renderChatList();
    saveChats();
}

function createChat(activate = true) {
    const chat = {
        id: generateChatId(),
        title: "New Chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    chats.push(chat);
    saveChats();
    renderChatList();

    if (activate) {
        setActiveChat(chat.id);
    }
}

function addMessage(role, content, shouldSave = true) {
    let messageIndex = null;

    if (shouldSave) {
        const chat = getCurrentChat();
        if (chat) {
            chat.messages.push({ role, content });
            messageIndex = chat.messages.length - 1;
            messages = chat.messages;
            updateChatTitleFromMessages();
            touchCurrentChat();
            saveChats();
            renderChatList();
        }
    }

    const isAi = role === "assistant";
    if (chatWindow) chatWindow.appendChild(createMessageElement(role, content, isAi, messageIndex));

    scrollToBottom();
}

function addTypingIndicator(label = "Thinking...") {
    const indicator = document.createElement("div");
    indicator.className = "message assistant typing";
    indicator.id = "typingIndicator";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerHTML = `<i data-lucide="sparkles"></i>`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.textContent = label;

    indicator.appendChild(avatar);
    indicator.appendChild(contentDiv);

    if (chatWindow) chatWindow.appendChild(indicator);
    if (window.lucide) lucide.createIcons({ root: indicator });
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById("typingIndicator");
    if (indicator) {
        indicator.remove();
    }
}

function extractGeminiChunkText(payload) {
    if (!payload || !Array.isArray(payload.candidates)) return "";

    let chunkText = "";
    payload.candidates.forEach((candidate) => {
        const parts = candidate?.content?.parts;
        if (!Array.isArray(parts)) return;

        parts.forEach((part) => {
            if (typeof part?.text === "string") {
                chunkText += part.text;
            }
        });
    });

    return chunkText;
}

function getSelectedModel() {
    return MODELS.find((model) => model.id === currentModelId) || null;
}

function isGenerationModelType(type) {
    return type === "video" || type === "music" || type === "image";
}

function extractInlineDataUrl(part) {
    const mimeType = part?.inlineData?.mimeType;
    const base64Data = part?.inlineData?.data;
    if (!mimeType || !base64Data) return "";
    return `data:${mimeType};base64,${base64Data}`;
}

function extractFileUrl(part) {
    if (!part || typeof part !== "object") return "";
    const fileData = part.fileData || part.file || null;
    if (!fileData || typeof fileData !== "object") return "";

    if (typeof fileData.fileUri === "string") return fileData.fileUri;
    if (typeof fileData.uri === "string") return fileData.uri;
    if (typeof fileData.url === "string") return fileData.url;
    return "";
}

function parseGoogleGenerationResult(payload, modelType) {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        return { text: "Generation started. No preview content was returned yet." };
    }

    const text = parts
        .filter((part) => typeof part?.text === "string")
        .map((part) => part.text)
        .join("\n")
        .trim();

    const mediaDataUrl = parts.map(extractInlineDataUrl).find(Boolean) || "";
    const mediaFileUrl = parts.map(extractFileUrl).find(Boolean) || "";
    const mediaUrl = mediaDataUrl || mediaFileUrl;

    if (modelType === "image" && mediaUrl) {
        return {
            text: text || "Generated image ready.",
            imageDataUrl: mediaUrl
        };
    }

    if (modelType === "video" && mediaUrl) {
        return {
            text: text || "Generated video ready.",
            videoUrl: mediaUrl
        };
    }

    if (modelType === "music" && mediaUrl) {
        return {
            text: text || "Generated audio ready.",
            audioUrl: mediaUrl
        };
    }

    return {
        text: text || "Generation completed, but no media preview URL was returned by the API."
    };
}

async function generateGoogleMediaReply(signal) {
    const apiKey = GOOGLE_API_KEY.trim();
    const selectedModel = getSelectedModel();

    if (!selectedModel || selectedModel.provider !== "google") {
        throw new Error("Invalid Google model selection.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel.id)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const contents = buildGoogleContents(messages);
    if (contents.length === 0) {
        throw new Error("No valid user message to send.");
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        signal,
        body: JSON.stringify({
            contents,
            generationConfig: {
                temperature: DEFAULT_TEMPERATURE,
                maxOutputTokens: DEFAULT_MAX_TOKENS
            }
        })
    });

    if (!response.ok) {
        await logApiErrorResponse("Google generation", response);
        throw new Error(`Google generation API request failed with status ${response.status}.`);
    }

    const payload = await response.json();
    return parseGoogleGenerationResult(payload, selectedModel.type);
}

async function streamOpenRouterReply(onChunk, signal) {
    const apiKey = OPENROUTER_API_KEY.trim();
    const selectedModel = getSelectedModel();

    if (!selectedModel || selectedModel.provider !== "openrouter") {
        throw new Error("Invalid OpenRouter model selection.");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin || "http://localhost",
            "X-Title": "Eysic AI"
        },
        signal,
        body: JSON.stringify({
            model: selectedModel.id,
            temperature: DEFAULT_TEMPERATURE,
            max_tokens: DEFAULT_MAX_TOKENS,
            stream: true,
            messages: buildOpenRouterMessages(messages)
        })
    });

    if (!response.ok) {
        await logApiErrorResponse("OpenRouter", response);
        throw new Error(`OpenRouter API request failed with status ${response.status}.`);
    }

    if (!response.body) {
        throw new Error("Streaming response body is unavailable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let parsed;
            try {
                parsed = JSON.parse(payload);
            } catch {
                continue;
            }

            const chunkText = parsed.choices?.[0]?.delta?.content;
            if (chunkText) onChunk(chunkText);
        }
    }
}

async function streamGoogleReply(onChunk, signal) {
    const apiKey = GOOGLE_API_KEY.trim();
    const selectedModel = getSelectedModel();

    if (!selectedModel) {
        throw new Error("Invalid model selection.");
    }

    if (!CHAT_MODEL_IDS.has(selectedModel.id)) {
        throw new Error("Selected model does not support chat.");
    }

    if (selectedModel.provider !== "google") {
        throw new Error("Invalid Google model selection.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel.id)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const createRequestBody = (contents) => ({
        contents,
        generationConfig: {
            temperature: DEFAULT_TEMPERATURE,
            maxOutputTokens: DEFAULT_MAX_TOKENS
        }
    });

    let contents = buildGoogleContents(messages);
    if (contents.length === 0) {
        throw new Error("No valid user message to send.");
    }

    let response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        signal,
        body: JSON.stringify(createRequestBody(contents))
    });

    if (!response.ok && response.status === 400 && contents.length > 1) {
        const latestUserTurn = [...contents].reverse().find((item) => item.role === "user");
        if (latestUserTurn) {
            contents = [latestUserTurn];
            response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                signal,
                body: JSON.stringify(createRequestBody(contents))
            });
        }
    }

    if (!response.ok) {
        await logApiErrorResponse("Google", response);
        throw new Error(`Google API request failed with status ${response.status}.`);
    }

    if (!response.body) {
        throw new Error("Streaming response body is unavailable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let parsed;
            try {
                parsed = JSON.parse(payload);
            } catch {
                continue;
            }

            const chunkText = extractGeminiChunkText(parsed);
            if (chunkText) onChunk(chunkText);
        }
    }
}

async function streamModelReply(onChunk, signal) {
    const selectedModel = getSelectedModel();
    if (!selectedModel) {
        throw new Error("Invalid model selection.");
    }

    if (selectedModel.provider === "google") {
        await streamGoogleReply(onChunk, signal);
        return;
    }

    if (selectedModel.provider === "openrouter") {
        await streamOpenRouterReply(onChunk, signal);
        return;
    }

    throw new Error("Unsupported model provider.");
}

async function handleAssistantReply() {
    const selectedModel = getSelectedModel();
    const typingLabel = selectedModel?.type === "video"
        ? "Generating video..."
        : selectedModel?.type === "music"
            ? "Generating audio..."
            : selectedModel?.type === "image"
                ? "Generating image..."
                : "Thinking...";
    addTypingIndicator(typingLabel);
    setGenerationState(true);
    activeRequestController = new AbortController();
    const { signal } = activeRequestController;

    let streamedElement = null;
    let streamedContentDiv = null;
    let streamedText = "";

    try {
        if (selectedModel && isGenerationModelType(selectedModel.type)) {
            const generatedContent = await generateGoogleMediaReply(signal);
            addMessage("assistant", generatedContent);
            return;
        }

        await streamModelReply((chunkText) => {
            if (!streamedElement) {
                removeTypingIndicator();
                streamedElement = createMessageElement("assistant", "", true);
                streamedContentDiv = streamedElement.querySelector(".message-content");
                chatWindow.appendChild(streamedElement);
            }

            streamedText += chunkText;
            if (typeof marked !== "undefined") {
                streamedContentDiv.innerHTML = marked.parse(streamedText);
                applyCodeHighlighting(streamedContentDiv);
            } else {
                streamedContentDiv.textContent = streamedText;
            }
            scrollToBottom();
        }, signal);

        if (!streamedText.trim()) return;

        const chat = getCurrentChat();
        if (chat) {
            chat.messages.push({ role: "assistant", content: streamedText.trim() });
            messages = chat.messages;
            touchCurrentChat();
            saveChats();
            renderChatList();
            renderMessages();
        }
    } catch (error) {
        const aborted = error?.name === "AbortError";

        if (aborted) {
            if (streamedText.trim()) {
                const chat = getCurrentChat();
                if (chat) {
                    chat.messages.push({ role: "assistant", content: streamedText.trim() });
                    messages = chat.messages;
                    touchCurrentChat();
                    saveChats();
                    renderChatList();
                    renderMessages();
                }
            } else if (streamedElement) {
                streamedElement.remove();
            }
            return;
        }

        console.error(error);
        if (streamedElement && !streamedText) {
            streamedElement.remove();
        }
        addMessage("assistant", ASSISTANT_ERROR_MESSAGE, false);
    } finally {
        removeTypingIndicator();
        activeRequestController = null;
        setGenerationState(false);
    }
}

async function submitUserContent(userContent) {
    addMessage("user", userContent);
    if (messageInput) {
        messageInput.value = "";
        autoGrowTextarea();
    }
    clearPendingImage();
    await handleAssistantReply();
}

function regenerateAssistantReply(messageIndex) {
    if (isGenerating) return;

    const chat = getCurrentChat();
    if (!chat || !Number.isInteger(messageIndex)) return;
    if (chat.messages[messageIndex]?.role !== "assistant") return;

    let previousUserIndex = -1;
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
        if (chat.messages[index]?.role === "user") {
            previousUserIndex = index;
            break;
        }
    }

    if (previousUserIndex === -1) return;

    chat.messages = chat.messages.slice(0, previousUserIndex + 1);
    messages = chat.messages;
    touchCurrentChat();
    saveChats();
    renderMessages();
    renderChatList();

    handleAssistantReply().finally(() => {
        if (messageInput) messageInput.focus();
    });
}

function editAndResendMessage(messageIndex) {
    if (isGenerating) return;

    const chat = getCurrentChat();
    if (!chat || !Number.isInteger(messageIndex)) return;

    const target = chat.messages[messageIndex];
    if (!target || target.role !== "user") return;

    const existingText = getTextFromContent(target.content);
    const edited = prompt("Edit your message", existingText);
    if (edited === null) return;

    const trimmed = edited.trim();
    if (!trimmed) return;

    chat.messages = chat.messages.slice(0, messageIndex);
    messages = chat.messages;
    touchCurrentChat();
    saveChats();
    renderMessages();
    renderChatList();

    const hasImage = typeof target.content === "object" && target.content?.imageDataUrl;
    const userContent = hasImage
        ? {
            text: trimmed,
            imageDataUrl: target.content.imageDataUrl,
            imageName: target.content.imageName || ""
        }
        : trimmed;

    submitUserContent(userContent).finally(() => {
        if (messageInput) messageInput.focus();
    });
}

function handleSendMessage(event) {
    event.preventDefault();

    if (isGenerating) {
        stopActiveGeneration();
        return;
    }

    const text = messageInput.value.trim();
    if (!text && !pendingImageDataUrl) return;

    const selectedModel = getSelectedModel();
    if (!CHAT_MODEL_IDS.has(currentModelId) && !isGenerationModelType(selectedModel?.type)) {
        addMessage("assistant", "Selected model is not configured for chat or generation yet.", false);
        return;
    }

    if (pendingImageDataUrl && !MULTIMODAL_MODEL_IDS.has(currentModelId)) {
        addMessage(
            "assistant",
            "Image input is blocked for this model. Use Gemini 2.5 Flash or Gemini 2.5 Pro.",
            false
        );
        return;
    }

    const userContent = pendingImageDataUrl
        ? {
              text,
              imageDataUrl: pendingImageDataUrl,
              imageName: pendingImageName
          }
        : text;

    submitUserContent(userContent).finally(() => {
        if (messageInput) messageInput.focus();
    });
}

function exportChatsToFile() {
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        chats
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `eysic-chats-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function normalizeImportedMessage(message) {
    if (!message || typeof message !== "object") return null;
    if (message.role !== "user" && message.role !== "assistant") return null;

    const content = message.content;
    const isValidString = typeof content === "string";
    const isValidObject = content && typeof content === "object";
    if (!isValidString && !isValidObject) return null;

    return {
        role: message.role,
        content
    };
}

function normalizeImportedChat(chat) {
    if (!chat || typeof chat !== "object") return null;

    const parsedMessages = Array.isArray(chat.messages)
        ? chat.messages.map(normalizeImportedMessage).filter(Boolean)
        : [];

    return {
        id: typeof chat.id === "string" && chat.id ? chat.id : generateChatId(),
        title: typeof chat.title === "string" && chat.title.trim() ? chat.title.trim().slice(0, 60) : "Imported Chat",
        messages: parsedMessages,
        createdAt: parseNumber(chat.createdAt, Date.now()),
        updatedAt: parseNumber(chat.updatedAt, Date.now())
    };
}

async function importChatsFromFileInput(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
        const rawText = await file.text();
        const parsed = JSON.parse(rawText);
        const sourceChats = Array.isArray(parsed) ? parsed : parsed?.chats;

        if (!Array.isArray(sourceChats)) {
            throw new Error("The selected file does not include a chats array.");
        }

        const importedChats = sourceChats
            .map(normalizeImportedChat)
            .filter(Boolean);

        if (importedChats.length === 0) {
            throw new Error("No valid chats were found in this file.");
        }

        if (chats.length > 0 && !confirm("Import will replace current chats. Continue?")) {
            return;
        }

        chats = importedChats;
        currentChatId = importedChats[0].id;
        messages = importedChats[0].messages;
        saveChats();
        setActiveChat(currentChatId);
        renderChatList();

        if (typeof closeSettings === "function") {
            closeSettings();
        }
    } catch (error) {
        console.error(error);
        addMessage("assistant", "Import failed. Please use a valid chat export file.", false);
    }
}

window.exportChatsToFile = exportChatsToFile;
window.importChatsFromFileInput = importChatsFromFileInput;
window.initSendButton = initSendButton;

function loadChats() {
    const savedChats = localStorage.getItem(STORAGE_KEYS.chats);
    const savedActiveChatId = localStorage.getItem(STORAGE_KEYS.activeChatId);
    const savedSearch = localStorage.getItem(STORAGE_KEYS.search) || "";
    chatSearchQuery = savedSearch.trim().toLowerCase();

    if (chatSearchInput) {
        chatSearchInput.value = savedSearch;
    }

    if (!savedChats) {
        createChat(true);
        return;
    }

    try {
        const parsed = JSON.parse(savedChats);
        chats = parsed;

        if (chats.length === 0) {
            createChat(true);
            return;
        }

        const activeExists = chats.some((chat) => chat.id === savedActiveChatId);
        setActiveChat(activeExists ? savedActiveChatId : chats[0].id);
    } catch (e) {
        console.error(e);
        chats = [];
        createChat(true);
    }
}
