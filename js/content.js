function getTextFromContent(content) {
    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
        return content
            .filter((part) => part?.type === "text" && typeof part.text === "string")
            .map((part) => part.text)
            .join("\n")
            .trim();
    }

    if (content && typeof content === "object" && typeof content.text === "string") {
        return content.text;
    }

    return "";
}

function renderMathInContainer(container) {
    if (!container || typeof renderMathInElement !== "function") return;

    try {
        renderMathInElement(container, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false }
            ],
            throwOnError: false
        });
    } catch {
        // Silently ignore KaTeX rendering errors
    }
}

function getImageFromContent(content) {
    if (content && typeof content === "object" && typeof content.imageDataUrl === "string") {
        return content.imageDataUrl;
    }

    if (Array.isArray(content)) {
        const imagePart = content.find((part) => part?.type === "image_url" && part.image_url?.url);
        return imagePart?.image_url?.url || "";
    }

    return "";
}

function renderUserContent(container, content) {
    const text = getTextFromContent(content);
    const imageUrl = getImageFromContent(content);

    if (text) {
        const textNode = document.createElement("div");
        textNode.textContent = text;
        container.appendChild(textNode);
    }

    if (imageUrl) {
        const imageNode = document.createElement("img");
        imageNode.src = imageUrl;
        imageNode.alt = "Uploaded image";
        imageNode.className = "uploaded-image";
        container.appendChild(imageNode);
    }
}

function renderAssistantContent(container, content, isMarkdown = false) {
    const text = getTextFromContent(content);
    const imageUrl = getImageFromContent(content);
    const videoUrl = typeof content === "object" && content ? content.videoUrl : "";
    const audioUrl = typeof content === "object" && content ? content.audioUrl : "";

    if (text) {
        const textNode = document.createElement("div");
        if (isMarkdown && typeof marked !== "undefined") {
            textNode.innerHTML = marked.parse(text);
            renderMathInContainer(textNode);
        } else {
            textNode.textContent = text;
        }
        container.appendChild(textNode);
    }

    if (imageUrl) {
        const imageNode = document.createElement("img");
        imageNode.src = imageUrl;
        imageNode.alt = "Generated image";
        imageNode.className = "uploaded-image";
        container.appendChild(imageNode);
    }

    if (videoUrl) {
        const videoNode = document.createElement("video");
        videoNode.src = videoUrl;
        videoNode.controls = true;
        videoNode.className = "generated-media";
        container.appendChild(videoNode);
    }

    if (audioUrl) {
        const audioNode = document.createElement("audio");
        audioNode.src = audioUrl;
        audioNode.controls = true;
        audioNode.className = "generated-media";
        container.appendChild(audioNode);
    }
}

function renderImagePreview() {
    if (!imagePreview) return;

    if (!pendingImageDataUrl) {
        imagePreview.innerHTML = "";
        imagePreview.classList.add("hidden");
        return;
    }

    imagePreview.classList.remove("hidden");
    imagePreview.innerHTML = `
        <div class="preview-card">
            <img src="${pendingImageDataUrl}" alt="${pendingImageName || "Selected image"}" class="preview-image" />
            <div class="preview-meta">${pendingImageName || "Image ready"}</div>
            <button id="removeImageButton" type="button" class="preview-remove" aria-label="Remove image">
                <i data-lucide="x"></i>
            </button>
        </div>
    `;

    const removeButton = document.getElementById("removeImageButton");
    if (removeButton) {
        removeButton.addEventListener("click", clearPendingImage);
    }

    if (window.lucide) {
        lucide.createIcons({ root: imagePreview });
    }
}

function clearPendingImage() {
    pendingImageDataUrl = "";
    pendingImageName = "";
    if (imageInput) imageInput.value = "";
    renderImagePreview();
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
    });
}

async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        addMessage("assistant", "Please upload a valid image file.", false);
        clearPendingImage();
        return;
    }

    try {
        pendingImageDataUrl = await readFileAsDataUrl(file);
        pendingImageName = file.name;
        renderImagePreview();
    } catch (error) {
        addMessage("assistant", `Error: ${error.message}`, false);
        clearPendingImage();
    }
}

function dataUrlToInlineData(dataUrl) {
    if (typeof dataUrl !== "string") return null;

    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) return null;

    return {
        mimeType: match[1],
        data: match[2]
    };
}

function mapMessageForGoogle(message) {
    if (message?.role !== "user" && message?.role !== "assistant") {
        return null;
    }

    const apiRole = message.role === "assistant" ? "model" : "user";
    const text = getTextFromContent(message?.content);
    const imageUrl = getImageFromContent(message?.content);
    const parts = [];

    if (typeof text === "string" && text.trim()) {
        parts.push({ text });
    }

    if (apiRole === "user" && imageUrl) {
        const inlineData = dataUrlToInlineData(imageUrl);
        if (inlineData) {
            parts.push({ inlineData });
        }
    }

    if (parts.length === 0) {
        return null;
    }

    return {
        role: apiRole,
        parts
    };
}

function buildGoogleContents(sourceMessages) {
    const mapped = sourceMessages.map(mapMessageForGoogle).filter(Boolean);

    while (mapped.length > 0 && mapped[0].role !== "user") {
        mapped.shift();
    }

    return mapped;
}

function mapMessageForOpenRouter(message) {
    const role = message?.role;
    const text = getTextFromContent(message?.content);
    const imageUrl = getImageFromContent(message?.content);

    if (role !== "user" && role !== "assistant" && role !== "system") {
        return null;
    }

    if (role === "user" && imageUrl) {
        const multimodalContent = [];
        if (text) {
            multimodalContent.push({ type: "text", text });
        }
        multimodalContent.push({
            type: "image_url",
            image_url: { url: imageUrl }
        });

        return {
            role,
            content: multimodalContent
        };
    }

    return {
        role,
        content: text
    };
}

function buildOpenRouterMessages(sourceMessages) {
    return sourceMessages.map(mapMessageForOpenRouter).filter(Boolean);
}
