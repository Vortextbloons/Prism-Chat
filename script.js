const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const chatList = document.getElementById("chatList");
const newChatButton = document.getElementById("newChatButton");

// Model Selector Elements
const modelSelectorBtn = document.getElementById("modelSelectorBtn");
const modelDropdown = document.getElementById("modelDropdown");
const selectedModelName = document.getElementById("selectedModelName");
const selectedModelIcon = document.getElementById("selectedModelIcon");

const OPENROUTER_API_KEY = "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";
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 700;

const MODELS = [
    {
        id: "openai/gpt-oss-120b:free",
        name: "GPT OSS",
        description: "Balanced performance for general tasks",
        icon: "box"
    },
    {
        id: "deepseek/deepseek-r1-0528:free",
        name: "DeepSeek R1",
        description: "Strong reasoning and logic capabilities",
        icon: "brain"
    },
    {
        id: "qwen/qwen3-coder:free",
        name: "Qwen3 Coder",
        description: "Optimized for programming and code generation",
        icon: "code"
    },
    {
        id: "nvidia/nemotron-3-nano-30b-a3b:free",
        name: "Nemotron 3",
        description: "Efficient lightweight model",
        icon: "zap"
    },
    {
        id: "arcee-ai/trinity-large-preview:free",
        name: "Arcee Trinity",
        description: "Specialized for creative writing",
        icon: "pen-tool"
    },
     {
        id: "stepfun/step-3.5-flash:free",
        name: "Step 3.5 Flash",
        description: "Fast responses for quick queries",
        icon: "zap"
    },
    {
        id: "z-ai/glm-4.5-air:free",
        name: "GLM 4.5 Air",
        description: "Good all-around conversationalist",
        icon: "message-circle" 
    },
    {
        id: "openrouter/aurora-alpha",
        name: "Aurora Alpha",
        description: "Experimental new model",
        icon: "sparkles"
    },
    {
        id: "qwen/qwen3-235b-a22b-thinking-2507",
        name: "Qwen3 Thinking",
        description: "Large scale thinking model",
        icon: "cpu"
    }
];

const STORAGE_KEYS = {
chats: "eysic.chats",
activeChatId: "eysic.activeChatId",
model: "eysic.model"
};

let chats = [];
let currentChatId = null;
let currentModelId = DEFAULT_MODEL;
let messages = [];

/* --- Model Selector Logic --- */

function initModelSelector() {
    // Load saved model or default
    const savedModel = localStorage.getItem(STORAGE_KEYS.model);
    if (savedModel && MODELS.some(m => m.id === savedModel)) {
        currentModelId = savedModel;
    } else {
        currentModelId = DEFAULT_MODEL;
    }
    
    updateModelUI(currentModelId);
    renderModelDropdown();

    // Toggle dropdown
    if (modelSelectorBtn) {
        modelSelectorBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
    }

    // Close on click outside
    document.addEventListener("click", () => {
        if(modelDropdown) {
            modelDropdown.classList.add("hidden");
            modelDropdown.classList.remove("active");
            if(modelSelectorBtn) modelSelectorBtn.setAttribute("aria-expanded", "false");
        }
    });
}

function toggleDropdown() {
    if(!modelDropdown) return;
    
    const isHidden = modelDropdown.classList.contains("hidden");
    if (isHidden) {
        modelDropdown.classList.remove("hidden");
        // Small delay to allow reflow for transition
        requestAnimationFrame(() => {
            modelDropdown.classList.add("active");
        });
        modelSelectorBtn.setAttribute("aria-expanded", "true");
    } else {
        modelDropdown.classList.remove("active");
        setTimeout(() => modelDropdown.classList.add("hidden"), 200);
        modelSelectorBtn.setAttribute("aria-expanded", "false");
    }
}

function updateModelUI(modelId) {
    const model = MODELS.find(m => m.id === modelId) || MODELS[0];
    if(selectedModelName) selectedModelName.textContent = model.name;
    if(selectedModelIcon) {
        selectedModelIcon.innerHTML = `<i data-lucide="${model.icon}"></i>`;
    }
    if (window.lucide) lucide.createIcons();
}

function renderModelDropdown() {
    if(!modelDropdown) return;
    
    modelDropdown.innerHTML = "";
    MODELS.forEach(model => {
        const option = document.createElement("div");
        option.className = `model-option ${model.id === currentModelId ? "selected" : ""}`;
        option.innerHTML = `
            <div class="option-icon">
                <i data-lucide="${model.icon}"></i>
            </div>
            <div class="option-details">
                <span class="option-name">${model.name}</span>
                <span class="option-desc">${model.description}</span>
            </div>
        `;
        
        option.addEventListener("click", () => {
             selectModel(model.id);
        });
        
        modelDropdown.appendChild(option);
    });
    if (window.lucide) lucide.createIcons();
}

function selectModel(modelId) {
    currentModelId = modelId;
    localStorage.setItem(STORAGE_KEYS.model, modelId);
    updateModelUI(modelId);
    
    // Update selected state in dropdown
    const options = modelDropdown.querySelectorAll(".model-option");
    options.forEach((opt, idx) => {
        if (MODELS[idx].id === modelId) {
            opt.classList.add("selected");
        } else {
            opt.classList.remove("selected");
        }
    });

    modelDropdown.classList.remove("active");
    setTimeout(() => modelDropdown.classList.add("hidden"), 200);
    modelSelectorBtn.setAttribute("aria-expanded", "false");
}

/* --- Chat Logic --- */

function generateChatId() {
return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultWelcomeMessage() {
return {
role: "assistant",
content: "Hi! Im Eysic. How can I help you today?"
};
}

function parseNumber(value, fallback) {
const parsed = Number(value);
return Number.isFinite(parsed) ? parsed : fallback;
}

function autoGrowTextarea() {
    if(!messageInput) return;
messageInput.style.height = "auto";
messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function scrollToBottom() {
    if(chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
}

function createMessageElement(role, content, isMarkdown = false) {
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

if (isMarkdown && typeof marked !== "undefined") {
textContent.innerHTML = marked.parse(content);
} else {
textContent.textContent = content;
}

    messageElement.appendChild(avatar);
    messageElement.appendChild(textContent);
    
    if(window.lucide) {
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
    if(!chatWindow) return;
chatWindow.innerHTML = "";
    if (messages.length === 0) return;
    
messages.forEach((item) => {
const isAi = item.role === "assistant";
chatWindow.appendChild(createMessageElement(item.role, item.content, isAi));
});
scrollToBottom();
}

function renderChatList() {
    if(!chatList) return;
chatList.innerHTML = "";

const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
sortedChats.forEach((chat) => {
const item = document.createElement("div");
item.className = `chat-item${chat.id === currentChatId ? " active" : ""}`;
        item.textContent = chat.title;
        item.addEventListener("click", () => setActiveChat(chat.id));
chatList.appendChild(item);
});
}

function updateChatTitleFromMessages() {
const chat = getCurrentChat();
if (!chat) return;
if (chat.title !== "New Chat") return;

const firstUserMessage = chat.messages.find((item) => item.role === "user");
if (!firstUserMessage) return;

chat.title = firstUserMessage.content.slice(0, 30) || "New Chat";
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
const isAi = role === "assistant";
    if(chatWindow) chatWindow.appendChild(createMessageElement(role, content, isAi));

if (shouldSave) {
        const chat = getCurrentChat();
        if(chat) {
            chat.messages.push({ role, content });
            messages = chat.messages;
            updateChatTitleFromMessages();
            touchCurrentChat();
            saveChats();
            renderChatList();
        }
}

scrollToBottom();
}

function addTypingIndicator() {
const indicator = document.createElement("div");
indicator.className = "message assistant typing";
indicator.id = "typingIndicator";
    
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerHTML = `<i data-lucide="sparkles"></i>`;
    
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
contentDiv.textContent = "Thinking...";
    
    indicator.appendChild(avatar);
    indicator.appendChild(contentDiv);
    
if(chatWindow) chatWindow.appendChild(indicator);
    if(window.lucide) lucide.createIcons({root: indicator});
scrollToBottom();
}

function removeTypingIndicator() {
const indicator = document.getElementById("typingIndicator");
if (indicator) {
indicator.remove();
}
}

async function streamOpenRouterReply(onChunk) {
const apiKey = OPENROUTER_API_KEY.trim();
    const modelToUse = currentModelId;

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
method: "POST",
headers: {
"Authorization": `Bearer ${apiKey}`,
"Content-Type": "application/json",
"HTTP-Referer": window.location.origin || "http://localhost",
"X-Title": "Eysic AI"
},
body: JSON.stringify({
model: modelToUse,
temperature: DEFAULT_TEMPERATURE,
max_tokens: DEFAULT_MAX_TOKENS,
stream: true,
messages
})
});

if (!response.ok) {
const errorText = await response.text();
throw new Error(errorText || "OpenRouter request failed.");
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
try { parsed = JSON.parse(payload); } catch { continue; }

const chunkText = parsed.choices?.[0]?.delta?.content;
if (chunkText) onChunk(chunkText);
}
}
}

async function handleAssistantReply() {
addTypingIndicator();

let streamedElement = null;
    let streamedContentDiv = null;
let streamedText = "";

try {
        await streamOpenRouterReply((chunkText) => {
if (!streamedElement) {
removeTypingIndicator();
streamedElement = createMessageElement("assistant", "", true);
                streamedContentDiv = streamedElement.querySelector(".message-content");
chatWindow.appendChild(streamedElement);
}

streamedText += chunkText;
if (typeof marked !== "undefined") {
streamedContentDiv.innerHTML = marked.parse(streamedText);
} else {
streamedContentDiv.textContent = streamedText;
}
scrollToBottom();
});

removeTypingIndicator();

if (!streamedText.trim()) return;
        
        const chat = getCurrentChat();
        if(chat) {
            chat.messages.push({ role: "assistant", content: streamedText.trim() });
            messages = chat.messages;
            touchCurrentChat();
            saveChats();
            renderChatList();
        }

} catch (error) {
removeTypingIndicator();
if (streamedElement && !streamedText) {
streamedElement.remove();
}
addMessage("assistant", `Error: ${error.message}`);
}
}

function handleSendMessage(event) {
event.preventDefault();

const text = messageInput.value.trim();
if (!text) return;

addMessage("user", text);
messageInput.value = "";
autoGrowTextarea();
sendButton.disabled = true;

handleAssistantReply().finally(() => {
sendButton.disabled = false;
if(messageInput) messageInput.focus();
});
}

function loadChats() {
const savedChats = localStorage.getItem(STORAGE_KEYS.chats);
const savedActiveChatId = localStorage.getItem(STORAGE_KEYS.activeChatId);

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

if(chatForm) chatForm.addEventListener("submit", handleSendMessage);

if(messageInput) {
    messageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            chatForm.requestSubmit();
        }
    });

    messageInput.addEventListener("input", autoGrowTextarea);
}

if(newChatButton) {
    newChatButton.addEventListener("click", () => {
        createChat(true);
    });
}

// Initialize
initModelSelector();
loadChats();
autoGrowTextarea();
if(window.lucide) lucide.createIcons();
