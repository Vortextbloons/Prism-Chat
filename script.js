const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const modelSelect = document.getElementById("modelSelect");
const chatList = document.getElementById("chatList");
const newChatButton = document.getElementById("newChatButton");

const OPENROUTER_API_KEY = "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";
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 700;

const STORAGE_KEYS = {
	chats: "aiChat.chats",
	activeChatId: "aiChat.activeChatId",
	model: "aiChat.model"
};

let chats = [];
let currentChatId = null;
let messages = [];

function generateChatId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultWelcomeMessage() {
	return {
		role: "assistant",
		content: "Hi! I’m ready to chat. Ask me anything."
	};
}

function parseNumber(value, fallback) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function autoGrowTextarea() {
	messageInput.style.height = "auto";
	messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function scrollToBottom() {
	chatWindow.scrollTop = chatWindow.scrollHeight;
}

function createMessageElement(role, content, isMarkdown = false) {
	const messageElement = document.createElement("div");
	messageElement.className = `message ${role === "user" ? "user-message" : "ai-message"}`;

	if (isMarkdown && typeof marked !== "undefined") {
		messageElement.innerHTML = marked.parse(content);
	} else {
		messageElement.textContent = content;
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
	chatWindow.innerHTML = "";
	messages.forEach((item) => {
		const isAi = item.role === "assistant";
		chatWindow.appendChild(createMessageElement(item.role, item.content, isAi));
	});
	scrollToBottom();
}

function renderChatList() {
	chatList.innerHTML = "";

	const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
	sortedChats.forEach((chat) => {
		const item = document.createElement("div");
		item.className = `chat-item${chat.id === currentChatId ? " active" : ""}`;

		const titleButton = document.createElement("button");
		titleButton.type = "button";
		titleButton.className = "chat-item-title";
		titleButton.textContent = chat.title;
		titleButton.addEventListener("click", () => {
			setActiveChat(chat.id);
		});

		const actions = document.createElement("div");
		actions.className = "chat-item-actions";

		const renameButton = document.createElement("button");
		renameButton.type = "button";
		renameButton.className = "chat-action";
		renameButton.textContent = "Rename";
		renameButton.addEventListener("click", (event) => {
			event.stopPropagation();
			renameChat(chat.id);
		});

		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.className = "chat-action";
		deleteButton.textContent = "Delete";
		deleteButton.addEventListener("click", (event) => {
			event.stopPropagation();
			deleteChat(chat.id);
		});

		actions.append(renameButton, deleteButton);
		item.append(titleButton, actions);
		chatList.appendChild(item);
	});
}

function updateChatTitleFromMessages() {
	const chat = getCurrentChat();
	if (!chat) {
		return;
	}

	if (chat.title !== "New Chat") {
		return;
	}

	const firstUserMessage = chat.messages.find((item) => item.role === "user");
	if (!firstUserMessage) {
		return;
	}

	chat.title = firstUserMessage.content.slice(0, 36) || "New Chat";
	renderChatList();
}

function setActiveChat(chatId) {
	const chat = chats.find((item) => item.id === chatId);
	if (!chat) {
		return;
	}

	currentChatId = chat.id;
	messages = chat.messages;
	renderMessages();
	renderChatList();
	saveChats();
}

function createChat(activate = true) {
	const chat = {
		id: generateChatId(),
		title: "New Chat",
		messages: [defaultWelcomeMessage()],
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

function renameChat(chatId) {
	const chat = chats.find((item) => item.id === chatId);
	if (!chat) {
		return;
	}

	const newTitle = window.prompt("Rename chat", chat.title);
	if (!newTitle) {
		return;
	}

	chat.title = newTitle.trim().slice(0, 60) || chat.title;
	touchCurrentChat();
	renderChatList();
	saveChats();
}

function deleteChat(chatId) {
	const chat = chats.find((item) => item.id === chatId);
	if (!chat) {
		return;
	}

	if (!window.confirm(`Delete "${chat.title}"?`)) {
		return;
	}

	if (chats.length === 1) {
		chats = [];
		currentChatId = null;
		messages = [];
		createChat(true);
		return;
	}

	chats = chats.filter((item) => item.id !== chatId);
	if (currentChatId === chatId) {
		setActiveChat(chats[0].id);
	} else {
		renderChatList();
		saveChats();
	}
}

function addMessage(role, content, shouldSave = true) {
	const isAi = role === "assistant";
	chatWindow.appendChild(createMessageElement(role, content, isAi));

	if (shouldSave) {
		messages.push({ role, content });
		updateChatTitleFromMessages();
		touchCurrentChat();
		saveChats();
		renderChatList();
	}

	scrollToBottom();
}

function addTypingIndicator() {
	const indicator = document.createElement("div");
	indicator.className = "message ai-message typing";
	indicator.id = "typingIndicator";
	indicator.textContent = "...";
	chatWindow.appendChild(indicator);
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
	if (!apiKey) {
		throw new Error("Missing OpenRouter API key.");
	}

	const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			"HTTP-Referer": window.location.origin || "http://localhost",
			"X-Title": "AI Chat App"
		},
		body: JSON.stringify({
			model: modelSelect?.value || DEFAULT_MODEL,
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
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) {
				continue;
			}

			const payload = trimmed.slice(5).trim();
			if (!payload || payload === "[DONE]") {
				continue;
			}

			let parsed;
			try {
				parsed = JSON.parse(payload);
			} catch {
				continue;
			}

			const chunkText = parsed.choices?.[0]?.delta?.content;
			if (chunkText) {
				onChunk(chunkText);
			}
		}
	}
}

async function handleAssistantReply() {
	addTypingIndicator();

	let streamedElement = null;
	let streamedText = "";

	try {
		await streamOpenRouterReply((chunkText) => {
			if (!streamedElement) {
				removeTypingIndicator();
				streamedElement = createMessageElement("assistant", "", true);
				chatWindow.appendChild(streamedElement);
			}

			streamedText += chunkText;
			if (typeof marked !== "undefined") {
				streamedElement.innerHTML = marked.parse(streamedText);
			} else {
				streamedElement.textContent = streamedText;
			}
			scrollToBottom();
		});

		removeTypingIndicator();

		if (!streamedText.trim()) {
			addMessage("assistant", "No response text returned.");
			return;
		}

		messages.push({ role: "assistant", content: streamedText.trim() });
		touchCurrentChat();
		saveChats();
		renderChatList();
	} catch (error) {
		removeTypingIndicator();
		if (streamedElement && !streamedText) {
			streamedElement.remove();
		}
		addMessage("assistant", `OpenRouter error: ${error.message}`);
	}
}

function handleSendMessage(event) {
	event.preventDefault();

	const text = messageInput.value.trim();
	if (!text) {
		return;
	}

	addMessage("user", text);
	messageInput.value = "";
	autoGrowTextarea();
	sendButton.disabled = true;

	handleAssistantReply().finally(() => {
		sendButton.disabled = false;
		messageInput.focus();
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
		if (!Array.isArray(parsed)) {
			throw new Error("Invalid saved chats payload.");
		}

		chats = parsed
			.map((chat) => {
				if (!chat || typeof chat.id !== "string" || !Array.isArray(chat.messages)) {
					return null;
				}

				const normalizedMessages = chat.messages
					.filter((message) => message && (message.role === "assistant" || message.role === "user"))
					.map((message) => ({
						role: message.role,
						content: String(message.content || "")
					}));

				if (normalizedMessages.length === 0) {
					normalizedMessages.push(defaultWelcomeMessage());
				}

				return {
					id: chat.id,
					title: typeof chat.title === "string" && chat.title.trim() ? chat.title.trim() : "New Chat",
					messages: normalizedMessages,
					createdAt: parseNumber(chat.createdAt, Date.now()),
					updatedAt: parseNumber(chat.updatedAt, Date.now())
				};
			})
			.filter(Boolean);

		if (chats.length === 0) {
			createChat(true);
			return;
		}

		const activeExists = chats.some((chat) => chat.id === savedActiveChatId);
		setActiveChat(activeExists ? savedActiveChatId : chats[0].id);
	} catch {
		localStorage.removeItem(STORAGE_KEYS.chats);
		localStorage.removeItem(STORAGE_KEYS.activeChatId);
		chats = [];
		currentChatId = null;
		messages = [];
		createChat(true);
	}
}

function loadModelSelection() {
	if (!modelSelect) {
		return;
	}

	const savedModel = localStorage.getItem(STORAGE_KEYS.model);
	if (savedModel && [...modelSelect.options].some((option) => option.value === savedModel)) {
		modelSelect.value = savedModel;
		return;
	}

	modelSelect.value = DEFAULT_MODEL;
}

chatForm.addEventListener("submit", handleSendMessage);

messageInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		chatForm.requestSubmit();
	}
});

messageInput.addEventListener("input", autoGrowTextarea);

newChatButton.addEventListener("click", () => {
	createChat(true);
});

if (modelSelect) {
	modelSelect.addEventListener("change", () => {
		localStorage.setItem(STORAGE_KEYS.model, modelSelect.value);
	});
}

loadModelSelection();
loadChats();
autoGrowTextarea();