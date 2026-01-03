const canvas = document.getElementById("canvas");
const runtime = {
  pages: [],
  currentPageId: null,
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
  const renderContainer = (container, parentEl) => {
    const box = document.createElement("div");
    box.className = "container-box";
    box.style.left = `${container.x || 0}px`;
    box.style.top = `${container.y || 0}px`;
    box.style.width = `${container.width || 0}px`;
    box.style.height = `${container.height || 0}px`;
    Shared.applyElementStyles(container, box);
    const buttons = Array.isArray(container.buttons) ? container.buttons : [];
    buttons.forEach((button) => {
      const element = createButtonElement(button);
      box.appendChild(element);
    });
    const children = Array.isArray(container.containers) ? container.containers : [];
    children.forEach((child) => {
      renderContainer(child, box);
    });
    parentEl.appendChild(box);
  };
  containers.forEach((container) => {
    renderContainer(container, pageSurface);
  });
}

async function loadState() {
  try {
    const res = await fetch("/state");
    const data = await res.json();
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
