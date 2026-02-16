function applyTheme(themeName) {
    const validTheme = Object.hasOwn(THEME_CLASS_MAP, themeName) ? themeName : "dark";
    const classes = Object.values(THEME_CLASS_MAP).filter(Boolean);
    document.body.classList.remove(...classes);

    const className = THEME_CLASS_MAP[validTheme];
    if (className) {
        document.body.classList.add(className);
    }

    if (themeSelect) {
        themeSelect.value = validTheme;
    }

    localStorage.setItem(STORAGE_KEYS.theme, validTheme);
}

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
    applyTheme(savedTheme);
}

function openSettings() {
    if (!settingsModal) return;
    settingsModal.classList.remove("hidden");
}

function closeSettings() {
    if (!settingsModal) return;
    settingsModal.classList.add("hidden");
}

function initSettingsUI() {
    if (settingsButton) {
        settingsButton.addEventListener("click", openSettings);
    }

    if (closeSettingsButton) {
        closeSettingsButton.addEventListener("click", closeSettings);
    }

    if (settingsModal) {
        settingsModal.addEventListener("click", (event) => {
            if (event.target === settingsModal) {
                closeSettings();
            }
        });
    }

    if (themeSelect) {
        themeSelect.addEventListener("change", (event) => {
            applyTheme(event.target.value);
        });
    }
}
