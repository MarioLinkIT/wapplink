(() => {
  const UNIT_OPTIONS = ["%", "px", "rem", "cm"];
  const REM_IN_PX = 16;
  const CM_IN_PX = 37.7952755906;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function makeId(prefix = "btn") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  function makePageId() {
    return makeId("page");
  }

  function makeContainerId() {
    return makeId("container");
  }

  function ensureElementUnits(element) {
    if (!element.units) {
      element.units = { x: "%", y: "%", width: "%", height: "%" };
    }
    ["x", "y", "width", "height"].forEach((key) => {
      if (!element.units[key]) element.units[key] = "%";
    });
  }

  function ensureContainerUnits(container) {
    ensureElementUnits(container);
  }

  function pxToUnit(px, unit, base) {
    if (unit === "%") return base ? (px / base) * 100 : 0;
    if (unit === "px") return px;
    if (unit === "rem") return px / REM_IN_PX;
    if (unit === "cm") return px / CM_IN_PX;
    return px;
  }

  function unitToPx(value, unit, base) {
    if (unit === "%") return base ? (base * value) / 100 : 0;
    if (unit === "px") return value;
    if (unit === "rem") return value * REM_IN_PX;
    if (unit === "cm") return value * CM_IN_PX;
    return value;
  }

  function normalizeContainer(container, canvasRect) {
    const rect = canvasRect || { width: 0, height: 0 };
    ensureContainerUnits(container);
    if (!Array.isArray(container.containers)) container.containers = [];
    if (!Array.isArray(container.buttons)) container.buttons = [];
    if (typeof container.x !== "number" || Number.isNaN(container.x)) container.x = 0;
    if (typeof container.y !== "number" || Number.isNaN(container.y)) container.y = 0;
    if (typeof container.width !== "number" || container.width <= 0) {
      container.width = Math.round(rect.width);
    }
    if (typeof container.height !== "number" || container.height <= 0) {
      container.height = Math.round(rect.height);
    }
  }

  function measureButtonSize(label) {
    const temp = document.createElement("button");
    temp.className = "canvas-button";
    temp.textContent = label;
    temp.style.position = "absolute";
    temp.style.visibility = "hidden";
    temp.style.left = "-9999px";
    temp.style.top = "-9999px";
    document.body.appendChild(temp);
    const rect = temp.getBoundingClientRect();
    temp.remove();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  }

  function normalizeButton(button) {
    ensureElementUnits(button);
    if (typeof button.x !== "number" || Number.isNaN(button.x)) button.x = 0;
    if (typeof button.y !== "number" || Number.isNaN(button.y)) button.y = 0;
    if (typeof button.width !== "number" || button.width <= 0) {
      const size = measureButtonSize(button.label || "Button");
      button.width = size.width || 120;
      button.height = size.height || 40;
    }
    if (typeof button.height !== "number" || button.height <= 0) {
      button.height = 40;
    }
  }

  function createPosSizeField({
    target,
    getParentRect,
    onResizeChildren,
    onRenderCanvas,
    onRenderList,
    onDirty,
    labelText = "pos & size",
  }) {
    ensureElementUnits(target);
    const block = document.createElement("div");
    block.className = "position-field";
    const grid = document.createElement("div");
    grid.className = "pos-grid";
    const handle = document.createElement("div");
    handle.className = "pos-handle tl";
    const handleBR = document.createElement("div");
    handleBR.className = "pos-handle br";
    const handleSize = document.createElement("div");
    handleSize.className = "pos-handle size";
    const label = document.createElement("span");
    label.className = "grid-label";
    label.textContent = labelText;
    grid.append(handle, handleBR, handleSize, label);

    const inputs = document.createElement("div");
    inputs.className = "pos-inputs";
    const xInput = document.createElement("input");
    xInput.type = "number";
    xInput.className = "action-select";
    const xLabel = document.createElement("span");
    xLabel.className = "field-label";
    xLabel.textContent = "x:";
    const yInput = document.createElement("input");
    yInput.type = "number";
    yInput.className = "action-select";
    const yLabel = document.createElement("span");
    yLabel.className = "field-label";
    yLabel.textContent = "y:";
    const wInput = document.createElement("input");
    wInput.type = "number";
    wInput.className = "action-select";
    const wLabel = document.createElement("span");
    wLabel.className = "field-label";
    wLabel.textContent = "w:";
    const hInput = document.createElement("input");
    hInput.type = "number";
    hInput.className = "action-select";
    const hLabel = document.createElement("span");
    hLabel.className = "field-label";
    hLabel.textContent = "h:";
    const posUnit = document.createElement("select");
    posUnit.className = "unit-select";
    UNIT_OPTIONS.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = unit;
      posUnit.appendChild(option);
    });
    const posUnitLabel = document.createElement("span");
    posUnitLabel.className = "field-label";
    posUnitLabel.textContent = "p:";
    const sizeUnit = document.createElement("select");
    sizeUnit.className = "unit-select";
    UNIT_OPTIONS.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = unit;
      sizeUnit.appendChild(option);
    });
    const sizeUnitLabel = document.createElement("span");
    sizeUnitLabel.className = "field-label";
    sizeUnitLabel.textContent = "s:";

    const renderCanvas = onRenderCanvas || (() => {});
    const renderList = onRenderList || (() => {});
    const markDirty = onDirty || (() => {});
    const resizeChildren = typeof onResizeChildren === "function" ? onResizeChildren : () => {};

    const updateInputs = () => {
      const rect = getParentRect();
      const baseX = rect.width || 1;
      const baseY = rect.height || 1;
      const unitValue = target.units.x;
      const xDisplay = pxToUnit(target.x, unitValue, baseX);
      const yDisplay = pxToUnit(target.y, unitValue, baseY);
      xInput.min = "0";
      yInput.min = "0";
      xInput.value = Math.max(0, Math.round(xDisplay));
      yInput.value = Math.max(0, Math.round(yDisplay));
      posUnit.value = unitValue;
      const sizeUnitValue = target.units.width;
      const wDisplay = pxToUnit(target.width, sizeUnitValue, baseX);
      const hDisplay = pxToUnit(target.height, sizeUnitValue, baseY);
      const maxValue = sizeUnitValue === "%" ? 100 : 1000;
      wInput.min = "1";
      hInput.min = "1";
      wInput.max = String(maxValue);
      hInput.max = String(maxValue);
      wInput.value = Math.max(1, Math.min(maxValue, Math.round(wDisplay)));
      hInput.value = Math.max(1, Math.min(maxValue, Math.round(hDisplay)));
      sizeUnit.value = sizeUnitValue;
      const percentX = baseX ? clamp((target.x / baseX) * 100, 0, 100) : 0;
      const percentY = baseY ? clamp((target.y / baseY) * 100, 0, 100) : 0;
      const percentBRX = baseX
        ? clamp(((target.x + target.width) / baseX) * 100, 0, 100)
        : 0;
      const percentBRY = baseY
        ? clamp(((target.y + target.height) / baseY) * 100, 0, 100)
        : 0;
      const percentSizeX = baseX
        ? clamp(100 - (target.width / baseX) * 100, 0, 100)
        : 0;
      const percentSizeY = baseY
        ? clamp((target.height / baseY) * 100, 0, 100)
        : 0;
      handle.style.left = `${percentX}%`;
      handle.style.top = `${percentY}%`;
      handleBR.style.left = `${percentBRX}%`;
      handleBR.style.top = `${percentBRY}%`;
      handleSize.style.left = `${percentSizeX}%`;
      handleSize.style.top = `${percentSizeY}%`;
    };

    const applyAxisValue = (axis, value) => {
      const rect = getParentRect();
      const base = axis === "x" ? rect.width : rect.height;
      const unit = target.units[axis];
      const clamped = Math.max(0, value);
      const nextPx = unitToPx(clamped, unit, base);
      target[axis] = Math.max(0, Math.round(nextPx));
    };

    const applySizeAxisValue = (axis, value) => {
      const rect = getParentRect();
      const base = axis === "width" ? rect.width : rect.height;
      const unit = target.units[axis];
      const clamped =
        unit === "%" ? Math.min(100, Math.max(1, value)) : Math.max(1, value);
      const nextPx = unitToPx(clamped, unit, base);
      const newSize = Math.max(1, Math.round(nextPx));
      const oldWidth = target.width || newSize;
      const oldHeight = target.height || newSize;
      if (axis === "width") {
        resizeChildren(oldWidth, oldHeight, newSize, oldHeight);
        target.width = newSize;
      } else {
        resizeChildren(oldWidth, oldHeight, oldWidth, newSize);
        target.height = newSize;
      }
    };

    const applyGrid = (clientX, clientY) => {
      const rect = getParentRect();
      const gridRect = grid.getBoundingClientRect();
      const px = clamp((clientX - gridRect.left) / gridRect.width, 0, 1);
      const py = clamp((clientY - gridRect.top) / gridRect.height, 0, 1);
      const brX = target.x + target.width;
      const brY = target.y + target.height;
      const newX = Math.min(Math.round(rect.width * px), brX - 1);
      const newY = Math.min(Math.round(rect.height * py), brY - 1);
      const oldWidth = target.width || 1;
      const oldHeight = target.height || 1;
      const newWidth = Math.max(1, brX - newX);
      const newHeight = Math.max(1, brY - newY);
      resizeChildren(oldWidth, oldHeight, newWidth, newHeight);
      target.x = newX;
      target.y = newY;
      target.width = newWidth;
      target.height = newHeight;
      updateInputs();
      renderCanvas();
      markDirty(true);
    };

    const applyResize = (clientX, clientY) => {
      const rect = getParentRect();
      const gridRect = grid.getBoundingClientRect();
      const px = clamp((clientX - gridRect.left) / gridRect.width, 0, 1);
      const py = clamp((clientY - gridRect.top) / gridRect.height, 0, 1);
      const oldWidth = target.width || 1;
      const oldHeight = target.height || 1;
      const newWidth = Math.max(1, Math.round(rect.width * px - target.x));
      const newHeight = Math.max(1, Math.round(rect.height * py - target.y));
      resizeChildren(oldWidth, oldHeight, newWidth, newHeight);
      target.width = newWidth;
      target.height = newHeight;
      updateInputs();
      renderCanvas();
      markDirty(true);
    };

    const applySizeGrid = (clientX, clientY) => {
      const rect = getParentRect();
      const gridRect = grid.getBoundingClientRect();
      const px = clamp((clientX - gridRect.left) / gridRect.width, 0.01, 1);
      const py = clamp((clientY - gridRect.top) / gridRect.height, 0.01, 1);
      const oldWidth = target.width || 1;
      const oldHeight = target.height || 1;
      const centerX = target.x + oldWidth / 2;
      const centerY = target.y + oldHeight / 2;
      const newWidth = Math.max(1, Math.round(rect.width * (1 - px)));
      const newHeight = Math.round(rect.height * py);
      resizeChildren(oldWidth, oldHeight, newWidth, newHeight);
      target.width = newWidth;
      target.height = newHeight;
      target.x = Math.round(centerX - newWidth / 2);
      target.y = Math.round(centerY - newHeight / 2);
      updateInputs();
      renderCanvas();
      markDirty(true);
    };

    grid.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      grid.setPointerCapture(event.pointerId);
      applyGrid(event.clientX, event.clientY);
      const onMove = (moveEvent) => {
        applyGrid(moveEvent.clientX, moveEvent.clientY);
      };
      const onUp = () => {
        grid.removeEventListener("pointermove", onMove);
        grid.removeEventListener("pointerup", onUp);
      };
      grid.addEventListener("pointermove", onMove);
      grid.addEventListener("pointerup", onUp, { once: true });
    });
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      applyGrid(event.clientX, event.clientY);
      const onMove = (moveEvent) => {
        applyGrid(moveEvent.clientX, moveEvent.clientY);
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp, { once: true });
    });
    handleBR.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleBR.setPointerCapture(event.pointerId);
      applyResize(event.clientX, event.clientY);
      const onMove = (moveEvent) => {
        applyResize(moveEvent.clientX, moveEvent.clientY);
      };
      const onUp = () => {
        handleBR.removeEventListener("pointermove", onMove);
        handleBR.removeEventListener("pointerup", onUp);
      };
      handleBR.addEventListener("pointermove", onMove);
      handleBR.addEventListener("pointerup", onUp, { once: true });
    });
    handleSize.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleSize.setPointerCapture(event.pointerId);
      applySizeGrid(event.clientX, event.clientY);
      const onMove = (moveEvent) => {
        applySizeGrid(moveEvent.clientX, moveEvent.clientY);
      };
      const onUp = () => {
        handleSize.removeEventListener("pointermove", onMove);
        handleSize.removeEventListener("pointerup", onUp);
      };
      handleSize.addEventListener("pointermove", onMove);
      handleSize.addEventListener("pointerup", onUp, { once: true });
    });

    xInput.addEventListener("change", () => {
      applyAxisValue("x", Number(xInput.value));
      updateInputs();
      renderCanvas();
      renderList();
      markDirty(true);
    });
    yInput.addEventListener("change", () => {
      applyAxisValue("y", Number(yInput.value));
      updateInputs();
      renderCanvas();
      renderList();
      markDirty(true);
    });
    posUnit.addEventListener("change", () => {
      target.units.x = posUnit.value;
      target.units.y = posUnit.value;
      updateInputs();
      renderCanvas();
      markDirty(true);
    });
    wInput.addEventListener("change", () => {
      applySizeAxisValue("width", Number(wInput.value));
      updateInputs();
      renderCanvas();
      renderList();
      markDirty(true);
    });
    hInput.addEventListener("change", () => {
      applySizeAxisValue("height", Number(hInput.value));
      updateInputs();
      renderCanvas();
      renderList();
      markDirty(true);
    });
    sizeUnit.addEventListener("change", () => {
      target.units.width = sizeUnit.value;
      target.units.height = sizeUnit.value;
      if (sizeUnit.value === "%") {
        const rect = getParentRect();
        const nextWidth = Math.min(
          100,
          Math.round(pxToUnit(target.width, "%", rect.width))
        );
        const nextHeight = Math.min(
          100,
          Math.round(pxToUnit(target.height, "%", rect.height))
        );
        applySizeAxisValue("width", nextWidth);
        applySizeAxisValue("height", nextHeight);
      }
      updateInputs();
      renderCanvas();
      markDirty(true);
    });

    inputs.append(
      posUnitLabel,
      posUnit,
      sizeUnitLabel,
      sizeUnit,
      xLabel,
      xInput,
      wLabel,
      wInput,
      yLabel,
      yInput,
      hLabel,
      hInput
    );
    block.append(grid, inputs);
    updateInputs();
    return block;
  }

  window.AppHelpers = {
    UNIT_OPTIONS,
    clamp,
    makeId,
    makePageId,
    makeContainerId,
    ensureElementUnits,
    ensureContainerUnits,
    pxToUnit,
    unitToPx,
    normalizeContainer,
    normalizeButton,
    createPosSizeField,
  };
})();
