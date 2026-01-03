(() => {
  function updateButtonPosition(button, element) {
    element.style.left = `${button.x}px`;
    element.style.top = `${button.y}px`;
  }

  function applyButtonSize(button, element) {
    if (typeof button.width === "number" && button.width > 0) {
      element.style.width = `${button.width}px`;
    } else {
      element.style.removeProperty("width");
    }
    if (typeof button.height === "number" && button.height > 0) {
      element.style.height = `${button.height}px`;
    } else {
      element.style.removeProperty("height");
    }
  }

  function applyPageBackground(bg, glow) {
    if (typeof bg === "object" && bg) {
      glow = bg.glow;
      bg = bg.bg;
    }
    if (typeof bg === "string" && bg.trim()) {
      document.documentElement.style.setProperty("--page-bg", bg);
    }
    if (typeof glow === "string" && glow.trim()) {
      document.documentElement.style.setProperty("--page-glow", glow);
    }
  }

  function applyElementStyles(target, element) {
    if (!target || !element) return;
    const bgColor = typeof target.bgColor === "string" ? target.bgColor.trim() : "";
    const borderColor =
      typeof target.borderColor === "string" ? target.borderColor.trim() : "";
    const borderStyle =
      typeof target.borderStyle === "string" ? target.borderStyle.trim() : "";
    const borderWidth =
      typeof target.borderWidth === "number" && Number.isFinite(target.borderWidth)
        ? target.borderWidth
        : null;
    if (bgColor) {
      element.style.background = bgColor;
    } else {
      element.style.removeProperty("background");
    }
    const shouldApplyBorder = borderColor || borderStyle || borderWidth !== null;
    if (shouldApplyBorder) {
      if (borderStyle === "none" || borderWidth === 0) {
        element.style.border = "none";
      } else {
        element.style.borderStyle = borderStyle || "solid";
        element.style.borderWidth = `${borderWidth !== null ? borderWidth : 1}px`;
        element.style.borderColor = borderColor || "rgba(39, 247, 215, 0.25)";
      }
    } else {
      element.style.removeProperty("border");
      element.style.removeProperty("border-style");
      element.style.removeProperty("border-width");
      element.style.removeProperty("border-color");
    }
  }

  function createBaseButton(button, extraClass = "") {
    const element = document.createElement("button");
    element.className = `canvas-button${extraClass ? ` ${extraClass}` : ""}`;
    element.textContent = button.label;
    applyButtonSize(button, element);
    updateButtonPosition(button, element);
    return element;
  }

  window.Shared = {
    updateButtonPosition,
    applyButtonSize,
    applyPageBackground,
    applyElementStyles,
    createBaseButton,
  };
})();
