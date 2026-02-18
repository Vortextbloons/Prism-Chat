const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const imageUploadButton = document.getElementById("imageUploadButton");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const chatList = document.getElementById("chatList");
const newChatButton = document.getElementById("newChatButton");
const clearAllChatsButton = document.getElementById("clearAllChatsButton");
const studentToolsToggleButton = document.getElementById("studentToolsToggleButton");
const studentToolsSection = document.getElementById("studentToolsSection");
const studentToolsChevron = document.getElementById("studentToolsChevron");
const pinnedContextInput = document.getElementById("pinnedContextInput");
const pomodoroTimeLabel = document.getElementById("pomodoroTimeLabel");
const pomodoroPhaseLabel = document.getElementById("pomodoroPhaseLabel");
const pomodoroToggleButton = document.getElementById("pomodoroToggleButton");
const pomodoroResetButton = document.getElementById("pomodoroResetButton");
const chatSearchInput = document.getElementById("chatSearchInput");
const settingsButton = document.getElementById("settingsButton");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const themeSelect = document.getElementById("themeSelect");
const studyModeSelect = document.getElementById("studyModeSelect");
const exportChatsButton = document.getElementById("exportChatsButton");
const importChatsButton = document.getElementById("importChatsButton");
const importChatsInput = document.getElementById("importChatsInput");

const modelSelectorBtn = document.getElementById("modelSelectorBtn");
const modelDropdown = document.getElementById("modelDropdown");
const selectedModelName = document.getElementById("selectedModelName");
const selectedModelIcon = document.getElementById("selectedModelIcon");
const Groq_API_KEY = "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"
const OPENROUTER_API_KEY = "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";
const GOOGLE_API_KEY = "AIzaSyA856khLsu3viE8CNECPscCf6L3ghBOnkg";
const DEFAULT_MODEL = "openrouter/aurora-alpha";
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 50000;

const MODEL_CATEGORY_ORDER = ["general", "pro", "thinking", "fast", "creative", "media"];
const MODEL_CATEGORY_LABELS = {
    pro: "Pro",
    thinking: "Thinking",
    fast: "Fast",
    creative: "Creative",
    media: "Media",
    general: "General"
};

const MULTIMODAL_MODEL_IDS = new Set([
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen/qwen3-vl-235b-a22b-thinking",
    "gemma-3-27b-it",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash-preview-image-generation"
]);

const CHAT_MODEL_IDS = new Set([
    "openai/gpt-oss-120b:free",
    "deepseek/deepseek-r1-0528:free",
    "qwen/qwen3-coder:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen/qwen3-vl-235b-a22b-thinking",
    "gemma-3-27b-it",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "arcee-ai/trinity-large-preview:free",
    "stepfun/step-3.5-flash:free",
    "z-ai/glm-4.5-air:free",
    "openrouter/aurora-alpha",
    "qwen/qwen3-235b-a22b-thinking-2507",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "veo-3.0-generate-preview",
    "lyria-2.0-generate-preview",
    "gemini-2.0-flash-preview-image-generation"
]);

const ASSISTANT_ERROR_MESSAGE = "Sorry, something went wrong while generating a response. Please try again.";
const STUDY_MODE_PROMPTS = {
    standard: "",
    tutor: "You are a patient tutor. Do not provide final answers immediately. Guide with short hints, ask leading questions, and explain steps clearly.",
    proofreader: "You are a proofreading assistant. Focus on grammar, clarity, structure, and tone. Provide concrete suggestions and a corrected version when useful."
};

const POMODORO_FOCUS_SECONDS = 25 * 60;
const POMODORO_BREAK_SECONDS = 5 * 60;

const MODELS = [
    {
        id: "openai/gpt-oss-120b:free",
        name: "GPT OSS",
        description: "Balanced performance for general tasks",
        icon: "box",
        type: "chat",
        provider: "openrouter",
        category: "creative"
    },
    {
        id: "deepseek/deepseek-r1-0528:free",
        name: "DeepSeek R1",
        description: "Strong reasoning and logic capabilities",
        icon: "brain",
        type: "chat",
        provider: "openrouter",
        category: "thinking"
    },
    {
        id: "qwen/qwen3-coder:free",
        name: "Qwen3 Coder",
        description: "Optimized for programming and code generation",
        icon: "code",
        type: "chat",
        provider: "openrouter",
        category: "pro"
    },
    {
        id: "nvidia/nemotron-nano-12b-v2-vl:free",
        name: "GPT 5.2 Pro",
        description: "Vision-language model for image understanding",
        icon: "image",
        type: "chat",
        provider: "openrouter",
        category: "pro"
    },
    {
        id: "qwen/qwen3-vl-235b-a22b-thinking",
        name: "Qwen3 VL Thinking",
        description: "Large multimodal model with visual reasoning",
        icon: "eye",
        type: "chat",
        provider: "openrouter",
        category: "thinking"
    },
    {
        id: "gemma-3-27b-it",
        name: "Gemma 3 27B",
        description: "Instruction-tuned multimodal assistant",
        icon: "sparkles",
        type: "chat",
        provider: "google",
        category: "fast"
    },
    {
        id: "nvidia/nemotron-3-nano-30b-a3b:free",
        name: "Nemotron 3",
        description: "Efficient lightweight model",
        icon: "zap",
        type: "chat",
        provider: "openrouter",
        category: "fast"
    },
    {
        id: "arcee-ai/trinity-large-preview:free",
        name: "GPT 5 Thinking",
        description: "Specialized for creative writing",
        icon: "pen-tool",
        type: "chat",
        provider: "openrouter",
        category: "general"
    },
    {
        id: "stepfun/step-3.5-flash:free",
        name: "Step 3.5 Flash",
        description: "Fast responses for quick queries",
        icon: "zap",
        type: "chat",
        provider: "openrouter",
        category: "fast"
    },
    {
        id: "z-ai/glm-4.5-air:free",
        name: "GPT 4o",
        description: "Good all-around conversationalist",
        icon: "message-circle",
        type: "chat",
        provider: "openrouter",
        category: "creative"
    },
    {
        id: "openrouter/aurora-alpha",
        name: "GPT 5",
        description: "Best for everday use.",
        icon: "sparkles",
        type: "chat",
        provider: "openrouter",
        category: "general"
    },
    {
        id: "qwen/qwen3-235b-a22b-thinking-2507",
        name: "Qwen3 Thinking",
        description: "Large scale thinking model",
        icon: "cpu",
        type: "chat",
        provider: "openrouter",
        category: "thinking"
    },
    {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Fast multimodal responses for everyday chat",
        icon: "zap",
        type: "chat",
        provider: "google",
        category: "general"
    },
    {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Advanced reasoning for complex requests",
        icon: "brain",
        type: "chat",
        provider: "google",
        category: "pro"
    }
];

const STORAGE_KEYS = {
    chats: "eysic.chats",
    activeChatId: "eysic.activeChatId",
    model: "eysic.model",
    theme: "eysic.theme",
    search: "eysic.search",
    studyMode: "eysic.studyMode",
    pinnedContext: "eysic.pinnedContext",
    studentToolsExpanded: "eysic.studentToolsExpanded"
};

const THEME_CLASS_MAP = {
    dark: "",
    light: "theme-light",
    oled: "theme-oled",
    amethyst: "theme-amethyst"
};

let chats = [];
let currentChatId = null;
let currentModelId = DEFAULT_MODEL;
let messages = [];
let pendingImageDataUrl = "";
let pendingImageName = "";
let activeRequestController = null;
let isGenerating = false;
let chatSearchQuery = "";
let benchmarkModeEnabled = false;
let studyMode = "standard";
let pinnedContext = "";
let pomodoroPhase = "focus";
let pomodoroSecondsLeft = POMODORO_FOCUS_SECONDS;
let pomodoroIntervalId = null;
let pomodoroRunning = false;
let studentToolsExpanded = false;

window.benchmarkModeEnabled = benchmarkModeEnabled;
