function sanitizeCompareModelSelection(modelIds) {
    if (!Array.isArray(modelIds)) {
        return [currentModelId || DEFAULT_MODEL];
    }

    const uniqueIds = [];
    modelIds.forEach((modelId) => {
        if (!MODELS.some((model) => model.id === modelId)) return;
        if (uniqueIds.includes(modelId)) return;
        if (uniqueIds.length >= MAX_COMPARE_MODELS) return;
        uniqueIds.push(modelId);
    });

    if (uniqueIds.length === 0) {
        uniqueIds.push(currentModelId || DEFAULT_MODEL);
    }

    return uniqueIds;
}

function getCompareModels() {
    return sanitizeCompareModelSelection(selectedCompareModelIds)
        .map((modelId) => MODELS.find((model) => model.id === modelId))
        .filter(Boolean);
}

function getRequestedModels() {
    if (compareModeEnabled) {
        return getCompareModels();
    }

    const selectedModel = MODELS.find((model) => model.id === currentModelId);
    return selectedModel ? [selectedModel] : [];
}

function ensureCompareDefaults() {
    if (selectedCompareModelIds.length >= 2) return;
    selectedCompareModelIds = sanitizeCompareModelSelection([
        ...selectedCompareModelIds,
        ...DEFAULT_COMPARE_MODEL_IDS
    ]);
}

function persistModelSelectionState() {
    localStorage.setItem(STORAGE_KEYS.model, currentModelId);
    localStorage.setItem(STORAGE_KEYS.compareMode, compareModeEnabled ? "true" : "false");
    localStorage.setItem(STORAGE_KEYS.compareModels, JSON.stringify(sanitizeCompareModelSelection(selectedCompareModelIds)));
}

function closeModelDropdown() {
    if (!modelDropdown) return;
    modelDropdown.classList.remove("active");
    setTimeout(() => modelDropdown.classList.add("hidden"), 200);
    if (modelSelectorBtn) {
        modelSelectorBtn.setAttribute("aria-expanded", "false");
    }
}

function toggleDropdown() {
    if (!modelDropdown) return;

    const isHidden = modelDropdown.classList.contains("hidden");
    if (isHidden) {
        modelDropdown.classList.remove("hidden");
        requestAnimationFrame(() => {
            modelDropdown.classList.add("active");
        });
        if (modelSelectorBtn) {
            modelSelectorBtn.setAttribute("aria-expanded", "true");
        }
        return;
    }

    closeModelDropdown();
}

function renderCompareSelectionList() {
    if (!compareSelectionList) return;

    compareSelectionList.innerHTML = "";

    getCompareModels().forEach((model) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "compare-chip";
        chip.dataset.modelId = model.id;
        chip.innerHTML = `
            <span class="compare-chip-name">${model.name}</span>
            <span class="compare-chip-remove" aria-hidden="true">×</span>
        `;
        chip.addEventListener("click", () => {
            if (!compareModeEnabled) return;
            toggleCompareModel(model.id);
        });
        compareSelectionList.appendChild(chip);
    });
}

function updateCompareUI() {
    if (compareModeButton) {
        compareModeButton.setAttribute("aria-pressed", String(compareModeEnabled));
        compareModeButton.classList.toggle("active", compareModeEnabled);
        compareModeButton.innerHTML = compareModeEnabled
            ? '<i data-lucide="split-square-vertical"></i> Compare On'
            : '<i data-lucide="split-square-vertical"></i> Compare Off';
    }

    if (compareTray) {
        compareTray.classList.toggle("hidden", !compareModeEnabled);
    }

    renderCompareSelectionList();

    if (window.lucide && compareModeButton) {
        lucide.createIcons({ root: compareModeButton });
    }
}

function updateModelUI(modelId) {
    const model = MODELS.find((item) => item.id === modelId) || MODELS[0];
    const compareModels = getCompareModels();

    if (compareModeEnabled) {
        const primaryModel = compareModels[0] || model;
        if (selectedModelName) {
            selectedModelName.textContent = `${compareModels.length} model${compareModels.length === 1 ? "" : "s"} selected`;
        }
        if (selectedModelLabel) {
            selectedModelLabel.textContent = compareModels.map((item) => item.name).join(" • ");
        }
        if (selectedModelIcon) {
            selectedModelIcon.innerHTML = `<i data-lucide="${primaryModel?.icon || "split-square-vertical"}"></i>`;
        }
    } else {
        if (selectedModelName) selectedModelName.textContent = model.name;
        if (selectedModelLabel) selectedModelLabel.textContent = "Current Model";
        if (selectedModelIcon) {
            selectedModelIcon.innerHTML = `<i data-lucide="${model.icon}"></i>`;
        }
    }

    if (window.lucide) {
        lucide.createIcons();
    }
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
            const isSelected = compareModeEnabled
                ? selectedCompareModelIds.includes(model.id)
                : model.id === currentModelId;

            const option = document.createElement("button");
            option.type = "button";
            option.className = `model-option ${isSelected ? "selected" : ""} ${compareModeEnabled ? "compare-selectable" : ""}`;
            option.dataset.modelId = model.id;
            option.innerHTML = `
                <div class="option-icon">
                    <i data-lucide="${model.icon}"></i>
                </div>
                <div class="option-details">
                    <span class="option-name">${model.name}</span>
                    <span class="option-desc">${model.description}</span>
                </div>
                ${compareModeEnabled ? `<span class="model-option-check">${isSelected ? "Selected" : "Add"}</span>` : ""}
            `;

            option.addEventListener("click", () => {
                if (compareModeEnabled) {
                    toggleCompareModel(model.id);
                    return;
                }
                selectModel(model.id);
            });

            section.appendChild(option);
        });

        modelDropdown.appendChild(section);
    });

    if (window.lucide) {
        lucide.createIcons({ root: modelDropdown });
    }
}

function syncModelPickerUI() {
    selectedCompareModelIds = sanitizeCompareModelSelection(selectedCompareModelIds);
    updateModelUI(currentModelId);
    updateCompareUI();
    renderModelDropdown();
    persistModelSelectionState();
}

function selectModel(modelId) {
    currentModelId = modelId;

    if (!selectedCompareModelIds.includes(modelId)) {
        selectedCompareModelIds = sanitizeCompareModelSelection([modelId, ...selectedCompareModelIds]);
    }

    if (!MULTIMODAL_MODEL_IDS.has(modelId) && pendingImageDataUrl) {
        clearPendingImage();
        addMessage("assistant", "Image was removed because this model does not support image input.", false);
    }

    syncModelPickerUI();
    closeModelDropdown();
}

function setCompareMode(enabled) {
    compareModeEnabled = Boolean(enabled);

    if (compareModeEnabled) {
        ensureCompareDefaults();
    }

    syncModelPickerUI();
}

function toggleCompareModel(modelId) {
    const exists = selectedCompareModelIds.includes(modelId);

    if (exists) {
        if (selectedCompareModelIds.length === 1) {
            return;
        }
        selectedCompareModelIds = selectedCompareModelIds.filter((id) => id !== modelId);
        if (currentModelId === modelId) {
            currentModelId = selectedCompareModelIds[0] || DEFAULT_MODEL;
        }
    } else {
        if (selectedCompareModelIds.length >= MAX_COMPARE_MODELS) {
            addMessage("assistant", `Compare mode supports up to ${MAX_COMPARE_MODELS} models at once.`, false);
            return;
        }
        selectedCompareModelIds = sanitizeCompareModelSelection([...selectedCompareModelIds, modelId]);
        currentModelId = modelId;
    }

    if (pendingImageDataUrl) {
        const hasUnsupportedModel = selectedCompareModelIds.some((id) => !MULTIMODAL_MODEL_IDS.has(id));
        if (hasUnsupportedModel) {
            clearPendingImage();
            addMessage("assistant", "Image was removed because every compare model must support image input.", false);
        }
    }

    syncModelPickerUI();
}

function initModelSelector() {
    const savedModel = localStorage.getItem(STORAGE_KEYS.model);
    currentModelId = MODELS.some((model) => model.id === savedModel) ? savedModel : DEFAULT_MODEL;

    const savedCompareMode = localStorage.getItem(STORAGE_KEYS.compareMode);
    const savedCompareModels = localStorage.getItem(STORAGE_KEYS.compareModels);

    compareModeEnabled = savedCompareMode === "true";

    try {
        const parsedCompareModels = savedCompareModels ? JSON.parse(savedCompareModels) : [];
        selectedCompareModelIds = sanitizeCompareModelSelection(parsedCompareModels.length > 0 ? parsedCompareModels : [currentModelId]);
    } catch {
        selectedCompareModelIds = [currentModelId];
    }

    if (compareModeEnabled) {
        ensureCompareDefaults();
    }

    syncModelPickerUI();

    if (modelSelectorBtn) {
        modelSelectorBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleDropdown();
        });
    }

    if (compareModeButton) {
        compareModeButton.addEventListener("click", (event) => {
            event.stopPropagation();
            setCompareMode(!compareModeEnabled);
        });
    }

    document.addEventListener("click", () => {
        closeModelDropdown();
    });
}
