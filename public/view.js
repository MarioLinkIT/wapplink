const canvas = document.getElementById("canvas");
const runtime = {
  pages: [],
  currentPageId: null,
  pageSize: null,
};
const DEFAULT_PAGE_BG = "#0b0b10";
const DEFAULT_PAGE_GLOW = "#27f7d7";

function createButtonElement(button) {
  const element = Shared.createBaseButton(button, "view-only");
  Shared.applyElementStyles(button, element);
  if (button.action && button.action.type === "page" && button.action.pageId) {
    element.addEventListener("click", () => {
      runtime.currentPageId = button.action.pageId;
      render();
    });
  }
  return element;
}

function resolveValue(value, unit, savedSize, currentSize) {
  if (unit === "%" && currentSize > 0) {
    if (savedSize > 0) {
      return (value / savedSize) * currentSize;
    }
    if (value <= 100) {
      return (value / 100) * currentSize;
    }
  }
  return value;
}

function resolveRect(target, parentCurrent, parentSaved) {
  const units = target.units || {};
  const savedWidth = parentSaved && parentSaved.width ? parentSaved.width : 0;
  const savedHeight = parentSaved && parentSaved.height ? parentSaved.height : 0;
  const currentWidth = parentCurrent.width || 0;
  const currentHeight = parentCurrent.height || 0;
  return {
    x: resolveValue(target.x || 0, units.x || "%", savedWidth, currentWidth),
    y: resolveValue(target.y || 0, units.y || "%", savedHeight, currentHeight),
    width: resolveValue(
      target.width || 0,
      units.width || "%",
      savedWidth,
      currentWidth
    ),
    height: resolveValue(
      target.height || 0,
      units.height || "%",
      savedHeight,
      currentHeight
    ),
  };
}

function applyOriginOffset(target, rect) {
  const origin = target.origin || { x: 0, y: 0 };
  const ox = Math.min(1, Math.max(0, origin.x || 0));
  const oy = Math.min(1, Math.max(0, origin.y || 0));
  const offsetX = rect.width * ox;
  const offsetY = rect.height * oy;
  return {
    x: rect.x - offsetX,
    y: rect.y - offsetY,
    width: rect.width,
    height: rect.height,
  };
}

function render() {
  const page =
    runtime.pages.find((item) => item.id === runtime.currentPageId) || runtime.pages[0];
  if (page) {
    Shared.applyPageBackground(
      typeof page.bg === "string" && page.bg.trim() ? page.bg : DEFAULT_PAGE_BG,
      typeof page.glow === "string" && page.glow.trim() ? page.glow : DEFAULT_PAGE_GLOW
    );
  }
  const containers = page && Array.isArray(page.containers) ? page.containers : [];
  canvas.innerHTML = "";
  const pageSurface = document.createElement("div");
  pageSurface.className = "page-surface";
  canvas.appendChild(pageSurface);
  const pageRect = pageSurface.getBoundingClientRect();
  const basePageSize =
    runtime.pageSize && runtime.pageSize.width && runtime.pageSize.height
      ? runtime.pageSize
      : { width: 0, height: 0 };
  const renderContainer = (container, parentEl, parentRect, parentSaved) => {
    const resolved = resolveRect(container, parentRect, parentSaved);
    const display = applyOriginOffset(container, resolved);
    const box = document.createElement("div");
    box.className = "container-box";
    box.style.left = `${display.x}px`;
    box.style.top = `${display.y}px`;
    box.style.width = `${resolved.width}px`;
    box.style.height = `${resolved.height}px`;
    Shared.applyElementStyles(container, box);
    const buttons = Array.isArray(container.buttons) ? container.buttons : [];
    buttons.forEach((button) => {
      const buttonRect = resolveRect(button, resolved, {
        width: container.width || 0,
        height: container.height || 0,
      });
      const buttonDisplay = applyOriginOffset(button, buttonRect);
      const element = createButtonElement({
        ...button,
        x: buttonDisplay.x,
        y: buttonDisplay.y,
        width: buttonDisplay.width,
        height: buttonDisplay.height,
      });
      box.appendChild(element);
    });
    const children = Array.isArray(container.containers) ? container.containers : [];
    children.forEach((child) => {
      renderContainer(
        child,
        box,
        { width: resolved.width, height: resolved.height },
        { width: container.width || 0, height: container.height || 0 }
      );
    });
    parentEl.appendChild(box);
  };
  containers.forEach((container) => {
    renderContainer(
      container,
      pageSurface,
      { width: pageRect.width, height: pageRect.height },
      basePageSize
    );
  });
}

async function loadState() {
  try {
    const res = await fetch("/state");
    const data = await res.json();
    if (
      data.pageSize &&
      typeof data.pageSize === "object" &&
      Number.isFinite(data.pageSize.width) &&
      Number.isFinite(data.pageSize.height)
    ) {
      runtime.pageSize = {
        width: Number(data.pageSize.width),
        height: Number(data.pageSize.height),
      };
    } else {
      runtime.pageSize = null;
    }
    const fallbackBg =
      typeof data.guestBg === "string" && data.guestBg.trim()
        ? data.guestBg
        : DEFAULT_PAGE_BG;
    if (Array.isArray(data.pages) && data.pages.length) {
      runtime.pages = data.pages.map((page) => {
        if (Array.isArray(page.containers)) {
          return {
            ...page,
            bg: typeof page.bg === "string" && page.bg.trim() ? page.bg : fallbackBg,
            glow:
              typeof page.glow === "string" && page.glow.trim()
                ? page.glow
                : DEFAULT_PAGE_GLOW,
          };
        }
        if (Array.isArray(page.buttons)) {
          return {
            ...page,
            bg: typeof page.bg === "string" && page.bg.trim() ? page.bg : fallbackBg,
            glow:
              typeof page.glow === "string" && page.glow.trim()
                ? page.glow
                : DEFAULT_PAGE_GLOW,
            containers: [
              {
                id: "container_1",
                name: "Container 1",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                buttons: page.buttons,
              },
            ],
          };
        }
        return {
          ...page,
          bg: typeof page.bg === "string" && page.bg.trim() ? page.bg : fallbackBg,
          glow:
            typeof page.glow === "string" && page.glow.trim()
              ? page.glow
              : DEFAULT_PAGE_GLOW,
          containers: [],
        };
      });
      runtime.currentPageId = data.startPageId || data.currentPageId || data.pages[0].id;
    } else if (Array.isArray(data.buttons)) {
      runtime.pages = [
        {
          id: "page_1",
          name: "Page 1",
          bg: fallbackBg,
          glow: DEFAULT_PAGE_GLOW,
          containers: [{ id: "container_1", name: "Container 1", buttons: data.buttons }],
        },
      ];
      runtime.currentPageId = "page_1";
    } else {
      return;
    }
    render();
  } catch (err) {
    canvas.textContent = "No saved layout yet.";
  }
}

loadState();
