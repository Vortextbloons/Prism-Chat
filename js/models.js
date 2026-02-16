function initModelSelector() {
    const savedModel = localStorage.getItem(STORAGE_KEYS.model);
    if (savedModel && MODELS.some((m) => m.id === savedModel)) {
        currentModelId = savedModel;
    } else {
        currentModelId = DEFAULT_MODEL;
    }

    updateModelUI(currentModelId);
    renderModelDropdown();

    if (modelSelectorBtn) {
        modelSelectorBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDropdown();
        });
    }

    document.addEventListener("click", () => {
        if (modelDropdown) {
            modelDropdown.classList.add("hidden");
            modelDropdown.classList.remove("active");
            if (modelSelectorBtn) modelSelectorBtn.setAttribute("aria-expanded", "false");
        }
    });
}

function toggleDropdown() {
    if (!modelDropdown) return;

    const isHidden = modelDropdown.classList.contains("hidden");
    if (isHidden) {
        modelDropdown.classList.remove("hidden");
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
    const model = MODELS.find((m) => m.id === modelId) || MODELS[0];
    if (selectedModelName) selectedModelName.textContent = model.name;
    if (selectedModelIcon) {
        selectedModelIcon.innerHTML = `<i data-lucide="${model.icon}"></i>`;
    }
    if (window.lucide) lucide.createIcons();
}

function renderModelDropdown() {
    if (!modelDropdown) return;

    modelDropdown.innerHTML = "";

    const groupedModels = MODELS.reduce((acc, model) => {
        const category = model.category || "general";
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(model);
        return acc;
    }, {});

    MODEL_CATEGORY_ORDER.forEach((categoryKey) => {
        const categoryModels = groupedModels[categoryKey];
        if (!categoryModels || categoryModels.length === 0) return;

        const section = document.createElement("div");
        section.className = "model-group";

        const label = document.createElement("div");
        label.className = "model-group-label";
        label.textContent = MODEL_CATEGORY_LABELS[categoryKey] || "Models";
        section.appendChild(label);

        categoryModels.forEach((model) => {
            const option = document.createElement("div");
            option.className = `model-option ${model.id === currentModelId ? "selected" : ""}`;
            option.dataset.modelId = model.id;
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

            section.appendChild(option);
        });

        modelDropdown.appendChild(section);
    });

    if (window.lucide) lucide.createIcons();
}

function selectModel(modelId) {
    currentModelId = modelId;
    localStorage.setItem(STORAGE_KEYS.model, modelId);
    updateModelUI(modelId);

    if (!MULTIMODAL_MODEL_IDS.has(modelId) && pendingImageDataUrl) {
        clearPendingImage();
        addMessage("assistant", "Image was removed because this model does not support image input.", false);
    }

    const options = modelDropdown.querySelectorAll(".model-option");
    options.forEach((opt) => {
        if (opt.dataset.modelId === modelId) {
            opt.classList.add("selected");
        } else {
            opt.classList.remove("selected");
        }
    });

    modelDropdown.classList.remove("active");
    setTimeout(() => modelDropdown.classList.add("hidden"), 200);
    modelSelectorBtn.setAttribute("aria-expanded", "false");
}
