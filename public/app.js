const canvas = document.getElementById("canvas");
const toggleScale = document.getElementById("toggleScale");
const saveState = document.getElementById("saveState");
const testError = document.getElementById("testError");
const renamePage = document.getElementById("renamePage");
const startPageBtn = document.getElementById("startPageBtn");
const removePage = document.getElementById("removePage");
const pagesSelect = document.getElementById("pagesSelect");
const treeList = document.getElementById("treeList");
const elementsEmpty = document.getElementById("elementsEmpty");
const elementsList = document.getElementById("elementsList");
const notifications = document.getElementById("notifications");
const pageBg = document.getElementById("pageBg");
const pageGlow = document.getElementById("pageGlow");

const DEFAULT_PAGE_BG = "#0b0b10";
const DEFAULT_PAGE_GLOW = "#27f7d7";
const DEFAULT_ELEMENT_BG = "#0b0b10";
const DEFAULT_ELEMENT_BORDER = "#27f7d7";

const state = {
  pages: [],
  currentPageId: null,
  startPageId: null,
  canvasMode: "fixed",
  selectedNode: { type: null, pageId: null, containerId: null, buttonId: null },
  isDirty: false,
  lastSaved: null,
  pageSize: null,
  dragPayload: null,
  expandedContainers: [],
  expandedPages: [],
};

let renderTree = () => {};
let renderList = () => {};
let canvasUI = null;

function addNotice(message, type = "info") {
  if (!notifications) return;
  const notice = document.createElement("div");
  notice.className = `notice ${type}`;
  notice.textContent = message;
  notice.addEventListener("click", () => {
    notice.remove();
  });
  notifications.appendChild(notice);
}

function setStatus(message) {
  addNotice(message, "info");
}

function showError(message) {
  addNotice(message, "error");
}

function clearStatus() {
  if (!notifications) return;
  notifications.innerHTML = "";
}

function setDirty(value) {
  state.isDirty = value;
  saveState.classList.toggle("dirty", state.isDirty);
}

function snapshotState() {
  return JSON.parse(
    JSON.stringify({
      pages: state.pages,
      currentPageId: state.currentPageId,
      startPageId: state.startPageId,
      canvasMode: state.canvasMode,
      pageSize: state.pageSize,
    })
  );
}

function getSavedPage(pageId) {
  if (!state.lastSaved || !Array.isArray(state.lastSaved.pages)) return null;
  return state.lastSaved.pages.find((page) => page.id === pageId) || null;
}

function getSavedContainer(containerId) {
  if (!state.lastSaved || !Array.isArray(state.lastSaved.pages)) return null;
  let result = null;
  state.lastSaved.pages.forEach((page) => {
    if (!Array.isArray(page.containers)) return;
    walkContainers(page.containers, (container) => {
      if (container.id === containerId) {
        result = container;
      }
    });
  });
  if (result) return result;
  return null;
}

function getSavedButton(containerId, buttonId) {
  const container = getSavedContainer(containerId);
  if (!container || !Array.isArray(container.buttons)) return null;
  return container.buttons.find((btn) => btn.id === buttonId) || null;
}

function scaleContainerChildren(container, oldWidth, oldHeight, newWidth, newHeight) {
  if (oldWidth > 0) {
    container.buttons.forEach((btn) => {
      btn.x = Math.round((btn.x / oldWidth) * newWidth);
    });
    container.containers.forEach((child) => {
      child.x = Math.round((child.x / oldWidth) * newWidth);
      child.width = Math.round((child.width / oldWidth) * newWidth);
    });
  }
  if (oldHeight > 0) {
    container.buttons.forEach((btn) => {
      btn.y = Math.round((btn.y / oldHeight) * newHeight);
    });
    container.containers.forEach((child) => {
      child.y = Math.round((child.y / oldHeight) * newHeight);
      child.height = Math.round((child.height / oldHeight) * newHeight);
    });
  }
  container.buttons.forEach((btn) => {
    btn.x = clamp(btn.x, 0, newWidth - 1);
    btn.y = clamp(btn.y, 0, newHeight - 1);
  });
  container.containers.forEach((child) => {
    child.x = clamp(child.x, 0, newWidth - 1);
    child.y = clamp(child.y, 0, newHeight - 1);
    child.width = Math.max(1, child.width);
    child.height = Math.max(1, child.height);
  });
}

const {
  clamp,
  makeId,
  makePageId,
  makeContainerId,
  normalizeContainer,
  normalizeButton,
  createPosSizeField,
} = window.AppHelpers;

const renderTreeProxy = () => renderTree();
const renderListProxy = () => renderList();
const selection = Selection.createSelection({
  state,
  renderList: renderListProxy,
  renderTree: renderTreeProxy,
  renderPagesSelect: () => renderPagesSelect(),
  applyCurrentPageBackground: () => applyCurrentPageBackground(),
  getCanvasUI: () => canvasUI,
});

const canvasCtx = {
  state,
  canvas,
  toggleScale,
  Shared,
  clamp,
  normalizeContainer,
  normalizeButton,
  getCurrentPage: () => getCurrentPage(),
  getContainerById: (id) => getContainerById(id),
  renderList: renderListProxy,
  renderTree: renderTreeProxy,
  setDirty,
  selectNode: (node) => selection.applySelection(node),
};
canvasUI = CanvasUI(canvasCtx);

function getCurrentPage() {
  return state.pages.find((page) => page.id === state.currentPageId) || state.pages[0];
}

function applyCurrentPageBackground() {
  const page = getCurrentPage();
  const bg = page && page.bg ? page.bg : DEFAULT_PAGE_BG;
  const glow = page && page.glow ? page.glow : DEFAULT_PAGE_GLOW;
  canvasUI.applyPageBackground(bg, glow);
  if (pageBg) pageBg.value = bg;
  if (pageGlow) pageGlow.value = glow;
}

function walkContainers(containers, visitor, parentId = null) {
  containers.forEach((container) => {
    visitor(container, parentId);
    if (Array.isArray(container.containers) && container.containers.length) {
      walkContainers(container.containers, visitor, container.id);
    }
  });
}

function getPageIdForContainer(containerId) {
  let foundPageId = null;
  state.pages.forEach((page) => {
    if (!Array.isArray(page.containers)) return;
    walkContainers(page.containers, (container) => {
      if (container.id === containerId) {
        foundPageId = page.id;
      }
    });
  });
  return foundPageId;
}

function findContainerById(containerId, pageId = null) {
  const page = pageId
    ? state.pages.find((item) => item.id === pageId)
    : getCurrentPage();
  if (!page) return null;
  let found = null;
  walkContainers(page.containers, (container, parentId) => {
    if (container.id === containerId) {
      found = { container, parentId };
    }
  });
  return found;
}

function getContainerById(containerId, pageId = null) {
  const found = findContainerById(containerId, pageId);
  return found ? found.container : null;
}

function getContainerParentId(containerId, pageId = null) {
  const found = findContainerById(containerId, pageId);
  return found ? found.parentId : null;
}

function getContainerParentRect(containerId, pageId = null) {
  const parentId = getContainerParentId(containerId, pageId);
  if (parentId) {
    const parent = getContainerById(parentId, pageId);
    if (parent) {
      return { width: parent.width, height: parent.height };
    }
  }
  return canvasUI.getPageSurfaceRect();
}

function getCurrentContainer() {
  const page = getCurrentPage();
  if (!page) return null;
  if (state.selectedNode.type === "container") {
    return getContainerById(state.selectedNode.containerId);
  }
  if (state.selectedNode.type === "button") {
    return getContainerById(state.selectedNode.containerId);
  }
  return page.containers[0] || null;
}

function ensureCurrentPage() {
  if (!state.pages.length) {
    const page = {
      id: makePageId(),
      name: "Page 1",
      bg: DEFAULT_PAGE_BG,
      glow: DEFAULT_PAGE_GLOW,
      containers: [
        {
          id: makeContainerId(),
          name: "Container 1",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          origin: { x: 0.5, y: 0.5 },
          borderWidth: 0,
          units: { x: "%", y: "%", width: "%", height: "%" },
          buttons: [],
          containers: [],
        },
      ],
    };
    state.pages.push(page);
    state.currentPageId = page.id;
  }
  if (!state.currentPageId) {
    state.currentPageId = state.pages[0].id;
  }
}

function renderPagesSelect() {
  if (pagesSelect) {
    pagesSelect.innerHTML = "";
    state.pages.forEach((page) => {
      const option = document.createElement("option");
      option.value = page.id;
      option.textContent = page.name;
      pagesSelect.appendChild(option);
    });
    pagesSelect.value = state.currentPageId;
  }
  if (startPageBtn) {
    const isStart = state.currentPageId === state.startPageId;
    startPageBtn.textContent = isStart ? "★" : "☆";
    startPageBtn.classList.toggle("active", isStart);
  }
  applyCurrentPageBackground();
}

function createButtonForContainer(container) {
  const centerX = Math.round((container.width || 0) / 2);
  const centerY = Math.round((container.height || 0) / 2);
  const button = {
    id: makeId(),
    label: `Button ${container.buttons.length + 1}`,
    x: centerX,
    y: centerY,
    width: 0,
    height: 0,
    origin: { x: 0.5, y: 0.5 },
    units: { x: "%", y: "%", width: "%", height: "%" },
    action: { type: "none" },
  };
  normalizeButton(button);
  return button;
}

function addNewButton() {
  const rect = canvasUI.getPageSurfaceRect();
  const page = getCurrentPage();
  if (!page) return;
  let container = getCurrentContainer();
  if (!container) {
    const centerX = Math.round((rect.width || 0) / 2);
    const centerY = Math.round((rect.height || 0) / 2);
    container = {
      id: makeContainerId(),
      name: "Container 1",
      x: centerX,
      y: centerY,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      origin: { x: 0.5, y: 0.5 },
      borderWidth: 0,
      units: { x: "%", y: "%", width: "%", height: "%" },
      buttons: [],
      containers: [],
    };
    page.containers.push(container);
  }
  normalizeContainer(container, rect);
  const button = createButtonForContainer(container);
  addButtonToContainer(container, button);
}

function addButtonToContainer(container, button) {
  if (!container) return;
  container.buttons.push(button);
  state.selectedNode = { type: "button", containerId: container.id, buttonId: button.id };
  canvasUI.renderCanvas();
  renderList();
  renderTree();
  setDirty(true);
}

function addChildContainer(parentContainer) {
  if (!parentContainer) return;
  const width = parentContainer.width ? Math.round(parentContainer.width * 0.6) : 240;
  const height = parentContainer.height ? Math.round(parentContainer.height * 0.6) : 160;
  const centerX = Math.round((parentContainer.width || 0) / 2);
  const centerY = Math.round((parentContainer.height || 0) / 2);
  const container = {
    id: makeContainerId(),
    name: `Container ${parentContainer.containers.length + 1}`,
    x: centerX,
    y: centerY,
    width,
    height,
    origin: { x: 0.5, y: 0.5 },
    borderWidth: 0,
    units: { x: "%", y: "%", width: "%", height: "%" },
    buttons: [],
    containers: [],
  };
  parentContainer.containers.push(container);
  state.selectedNode = { type: "container", containerId: container.id, buttonId: null };
  canvasUI.renderCanvas();
  renderList();
  renderTree();
  setDirty(true);
}

function addNewPage() {
  const rect = canvasUI.getPageSurfaceRect();
  const centerX = Math.round((rect.width || 0) / 2);
  const centerY = Math.round((rect.height || 0) / 2);
  const page = {
    id: makePageId(),
    name: `Page ${state.pages.length + 1}`,
    bg: DEFAULT_PAGE_BG,
    glow: DEFAULT_PAGE_GLOW,
    containers: [
      {
        id: makeContainerId(),
        name: "Container 1",
        x: centerX,
        y: centerY,
        width: 320,
        height: 200,
        origin: { x: 0.5, y: 0.5 },
        borderWidth: 0,
        units: { x: "%", y: "%", width: "%", height: "%" },
        buttons: [],
        containers: [],
      },
    ],
  };
  state.pages.push(page);
  if (!state.startPageId) {
    state.startPageId = page.id;
  }
  state.currentPageId = page.id;
  state.expandedPages = [...state.expandedPages, page.id];
  state.selectedNode = { type: "container", containerId: page.containers[0].id, buttonId: null };
  canvasUI.renderCanvas();
  renderList();
  renderTree();
  renderPagesSelect();
  setDirty(true);
}

function addNewContainer() {
  const page = getCurrentPage();
  if (!page) return;
  const rect = canvasUI.getPageSurfaceRect();
  const centerX = Math.round((rect.width || 0) / 2);
  const centerY = Math.round((rect.height || 0) / 2);
  const container = {
    id: makeContainerId(),
    name: `Container ${page.containers.length + 1}`,
    x: centerX,
    y: centerY,
    width: 320,
    height: 200,
    origin: { x: 0.5, y: 0.5 },
    borderWidth: 0,
    units: { x: "%", y: "%", width: "%", height: "%" },
    buttons: [],
    containers: [],
  };
  page.containers.push(container);
  state.selectedNode = { type: "container", containerId: container.id, buttonId: null };
  canvasUI.renderCanvas();
  renderList();
  renderTree();
  renderPagesSelect();
  setDirty(true);
}

function removeCurrentContainer() {
  const page = getCurrentPage();
  const current = getCurrentContainer();
  if (!page || !current) return;
  const parentId = getContainerParentId(current.id);
  if (!parentId && page.containers.length <= 1) {
    setStatus("At least one container is required.");
    return;
  }
  if (parentId) {
    const parent = getContainerById(parentId);
    if (parent) {
      parent.containers = parent.containers.filter((item) => item.id !== current.id);
      state.selectedNode = { type: "container", containerId: parent.id, buttonId: null };
    }
  } else {
    page.containers = page.containers.filter((item) => item.id !== current.id);
    const next = page.containers[0];
    state.selectedNode = next
      ? { type: "container", containerId: next.id, buttonId: null }
      : { type: null, containerId: null, buttonId: null };
  }
  canvasUI.renderCanvas();
  renderList();
  renderTree();
  renderPagesSelect();
  setDirty(true);
}

function renameCurrentContainer() {
  const container = getCurrentContainer();
  if (!container) return;
  const next = window.prompt("Container name:", container.name);
  if (next && next.trim()) {
    container.name = next.trim();
    renderTree();
    setDirty(true);
  }
}

const elementPanel = ElementPanel({
  state,
  elementsList,
  elementsEmpty,
  getCurrentPage,
  getContainerById,
  getContainerParentId,
  getContainerParentRect,
  normalizeContainer,
  normalizeButton,
  createPosSizeField,
  scaleContainerChildren,
  canvasUI,
  setDirty,
  renderTree: renderTreeProxy,
  renderPagesSelect,
  applyCurrentPageBackground,
  getSavedPage,
  getSavedContainer,
  getSavedButton,
  removeCurrentContainer,
  DEFAULT_PAGE_BG,
  DEFAULT_PAGE_GLOW,
  DEFAULT_ELEMENT_BG,
  DEFAULT_ELEMENT_BORDER,
});

renderList = elementPanel.renderList;

const treeUI = TreeUI({
  state,
  treeList,
  clamp,
  normalizeContainer,
  getCurrentPage,
  getContainerById,
  getContainerParentRect,
  getContainerParentId,
  getPageIdForContainer,
  createButtonForContainer,
  addButtonToContainer,
  addChildContainer,
  addNewContainer,
  addNewPage,
  removeCurrentContainer,
  removeCurrentPage,
  renderPagesSelect,
  renderList: renderListProxy,
  applyCurrentPageBackground,
  setDirty,
  canvasUI,
  selectNode: (node) => selection.applySelection(node),
});

renderTree = treeUI.renderTree;

function removeCurrentPage() {
  if (state.pages.length <= 1) {
    setStatus("At least one page is required.");
    return;
  }
  state.pages = state.pages.filter((page) => page.id !== state.currentPageId);
  state.expandedPages = state.expandedPages.filter((id) => id !== state.currentPageId);
  state.currentPageId = state.pages[0].id;
  if (state.startPageId === state.currentPageId || !state.startPageId) {
    state.startPageId = state.pages[0].id;
  }
  const firstContainer = state.pages[0].containers[0];
  state.selectedNode = firstContainer
    ? { type: "container", containerId: firstContainer.id, buttonId: null }
    : { type: null, containerId: null, buttonId: null };
  canvasUI.renderCanvas();
  renderList();
  renderTree();
  setDirty(true);
}

async function loadState() {
  try {
    const res = await fetch("/state");
    const data = await res.json();
    const normalizeOrigin = (origin) => {
      if (!origin || typeof origin !== "object") return { x: 0.5, y: 0.5 };
      const ox = Number(origin.x);
      const oy = Number(origin.y);
      const clamp = (value) =>
        Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
      return { x: clamp(ox), y: clamp(oy) };
    };
    const normalizeLoadedContainer = (container, index = 0) => {
      const normalized = {
        id: container.id || makeContainerId(),
        name: container.name || `Container ${index + 1}`,
        x: typeof container.x === "number" ? container.x : 0,
        y: typeof container.y === "number" ? container.y : 0,
        width: typeof container.width === "number" ? container.width : 0,
        height: typeof container.height === "number" ? container.height : 0,
        origin: normalizeOrigin(container.origin),
        units: container.units || { x: "%", y: "%", width: "%", height: "%" },
        buttons: Array.isArray(container.buttons)
          ? container.buttons.map((btn, btnIndex) => ({
              id: btn.id || makeId(),
              label: btn.label || `Button ${btnIndex + 1}`,
              x: typeof btn.x === "number" ? btn.x : 40,
              y: typeof btn.y === "number" ? btn.y : 40,
              width: typeof btn.width === "number" ? btn.width : 0,
              height: typeof btn.height === "number" ? btn.height : 0,
              origin: normalizeOrigin(btn.origin),
              units: btn.units || { x: "%", y: "%", width: "%", height: "%" },
              bgColor: typeof btn.bgColor === "string" ? btn.bgColor : "",
              borderColor: typeof btn.borderColor === "string" ? btn.borderColor : "",
              borderStyle: typeof btn.borderStyle === "string" ? btn.borderStyle : "",
              borderWidth:
                typeof btn.borderWidth === "number" && Number.isFinite(btn.borderWidth)
                  ? btn.borderWidth
                  : null,
              action:
                btn.action && btn.action.type
                  ? {
                      type: btn.action.type,
                      pageId: btn.action.pageId || null,
                    }
                  : { type: "none" },
            }))
          : [],
        containers: Array.isArray(container.containers)
          ? container.containers.map((child, childIndex) =>
              normalizeLoadedContainer(child, childIndex)
            )
          : [],
        bgColor: typeof container.bgColor === "string" ? container.bgColor : "",
        borderColor: typeof container.borderColor === "string" ? container.borderColor : "",
        borderStyle: typeof container.borderStyle === "string" ? container.borderStyle : "",
        borderWidth:
          typeof container.borderWidth === "number" && Number.isFinite(container.borderWidth)
            ? container.borderWidth
            : null,
      };
      return normalized;
    };
    const fallbackBg =
      typeof data.guestBg === "string" && data.guestBg.trim()
        ? data.guestBg
        : DEFAULT_PAGE_BG;
    if (
      data.pageSize &&
      typeof data.pageSize === "object" &&
      Number.isFinite(data.pageSize.width) &&
      Number.isFinite(data.pageSize.height)
    ) {
      state.pageSize = {
        width: Number(data.pageSize.width),
        height: Number(data.pageSize.height),
      };
    } else {
      state.pageSize = null;
    }
    if (Array.isArray(data.pages) && data.pages.length) {
      state.pages = data.pages.map((page, pageIndex) => {
        const containers = Array.isArray(page.containers)
          ? page.containers.map((container, containerIndex) =>
              normalizeLoadedContainer(container, containerIndex)
            )
          : [];
        if (!containers.length && Array.isArray(page.buttons)) {
          containers.push({
            id: makeContainerId(),
            name: "Container 1",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            origin: { x: 0.5, y: 0.5 },
            borderWidth: 0,
            units: { x: "%", y: "%", width: "%", height: "%" },
            buttons: page.buttons.map((btn, index) => ({
              id: btn.id || makeId(),
              label: btn.label || `Button ${index + 1}`,
              x: typeof btn.x === "number" ? btn.x : 40,
              y: typeof btn.y === "number" ? btn.y : 40,
              width: typeof btn.width === "number" ? btn.width : 0,
              height: typeof btn.height === "number" ? btn.height : 0,
              origin: normalizeOrigin(btn.origin),
              units: btn.units || { x: "%", y: "%", width: "%", height: "%" },
              bgColor: typeof btn.bgColor === "string" ? btn.bgColor : "",
              borderColor: typeof btn.borderColor === "string" ? btn.borderColor : "",
              borderStyle: typeof btn.borderStyle === "string" ? btn.borderStyle : "",
              borderWidth:
                typeof btn.borderWidth === "number" && Number.isFinite(btn.borderWidth)
                  ? btn.borderWidth
                  : null,
              action:
                btn.action && btn.action.type
                  ? {
                      type: btn.action.type,
                      pageId: btn.action.pageId || null,
                    }
                  : { type: "none" },
            })),
            containers: [],
          });
        }
        if (!containers.length) {
          containers.push({
            id: makeContainerId(),
            name: "Container 1",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            origin: { x: 0.5, y: 0.5 },
            borderWidth: 0,
            units: { x: "%", y: "%", width: "%", height: "%" },
            buttons: [],
            containers: [],
          });
        }
        return {
          id: page.id || makePageId(),
          name: page.name || `Page ${pageIndex + 1}`,
          bg: typeof page.bg === "string" && page.bg.trim() ? page.bg : fallbackBg,
          glow:
            typeof page.glow === "string" && page.glow.trim()
              ? page.glow
              : DEFAULT_PAGE_GLOW,
          containers,
        };
      });
      state.currentPageId = data.currentPageId || state.pages[0].id;
      state.startPageId = data.startPageId || state.pages[0].id;
    } else if (Array.isArray(data.buttons)) {
      const page = {
        id: makePageId(),
        name: "Page 1",
        bg: fallbackBg,
        glow: DEFAULT_PAGE_GLOW,
        containers: [
          {
            id: makeContainerId(),
            name: "Container 1",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            origin: { x: 0.5, y: 0.5 },
            borderWidth: 0,
            units: { x: "%", y: "%", width: "%", height: "%" },
            buttons: data.buttons.map((btn, index) => ({
              id: btn.id || makeId(),
              label: btn.label || `Button ${index + 1}`,
              x: typeof btn.x === "number" ? btn.x : 40,
              y: typeof btn.y === "number" ? btn.y : 40,
              width: typeof btn.width === "number" ? btn.width : 0,
              height: typeof btn.height === "number" ? btn.height : 0,
              origin: normalizeOrigin(btn.origin),
              units: btn.units || { x: "%", y: "%", width: "%", height: "%" },
              bgColor: typeof btn.bgColor === "string" ? btn.bgColor : "",
              borderColor: typeof btn.borderColor === "string" ? btn.borderColor : "",
              borderStyle: typeof btn.borderStyle === "string" ? btn.borderStyle : "",
              borderWidth:
                typeof btn.borderWidth === "number" && Number.isFinite(btn.borderWidth)
                  ? btn.borderWidth
                  : null,
              action: { type: "none" },
            })),
            containers: [],
          },
        ],
      };
      state.pages = [page];
      state.currentPageId = page.id;
      state.startPageId = page.id;
    }
    state.canvasMode = data.canvasMode === "full" ? "full" : "fixed";
    if (Array.isArray(data.expandedContainers)) {
      state.expandedContainers = data.expandedContainers.filter((id) => typeof id === "string");
    } else if (Array.isArray(data.expandedContainerIds)) {
      state.expandedContainers = data.expandedContainerIds.filter((id) => typeof id === "string");
    } else {
      state.expandedContainers = [];
    }
    if (Array.isArray(data.expandedPages)) {
      state.expandedPages = data.expandedPages.filter((id) => typeof id === "string");
    } else if (Array.isArray(data.expandedPageIds)) {
      state.expandedPages = data.expandedPageIds.filter((id) => typeof id === "string");
    } else {
      state.expandedPages = [];
    }
    if (data.selectedNode && typeof data.selectedNode === "object") {
      const selected = data.selectedNode;
      if (selected.type === "page" && typeof selected.pageId === "string") {
        const page = state.pages.find((item) => item.id === selected.pageId);
        if (page) {
          state.currentPageId = page.id;
          state.selectedNode = {
            type: "page",
            pageId: page.id,
            containerId: null,
            buttonId: null,
          };
        }
      } else if (selected.type === "website") {
        state.selectedNode = {
          type: "website",
          pageId: null,
          containerId: null,
          buttonId: null,
        };
      } else if (
        selected.type === "container" &&
        typeof selected.containerId === "string"
      ) {
        const container = getContainerById(selected.containerId);
        const pageId = container ? getPageIdForContainer(container.id) : null;
        if (container && pageId) {
          state.currentPageId = pageId;
          state.selectedNode = {
            type: "container",
            pageId,
            containerId: container.id,
            buttonId: null,
          };
        }
      } else if (
        selected.type === "button" &&
        typeof selected.containerId === "string" &&
        typeof selected.buttonId === "string"
      ) {
        const container = getContainerById(selected.containerId);
        const button =
          container &&
          Array.isArray(container.buttons) &&
          container.buttons.find((item) => item.id === selected.buttonId);
        const pageId = container ? getPageIdForContainer(container.id) : null;
        if (container && button && pageId) {
          state.currentPageId = pageId;
          state.selectedNode = {
            type: "button",
            pageId,
            containerId: container.id,
            buttonId: button.id,
          };
        }
      }
    }
  } catch (err) {
    setStatus("No saved state yet.");
  }
  ensureCurrentPage();
  if (!state.selectedNode.type) {
    const firstContainer = getCurrentContainer();
    state.selectedNode = firstContainer
      ? { type: "container", containerId: firstContainer.id, buttonId: null, pageId: null }
      : { type: null, containerId: null, buttonId: null, pageId: null };
  }
  if (state.selectedNode.type === "page" && state.selectedNode.pageId) {
    if (!state.expandedPages.includes(state.selectedNode.pageId)) {
      state.expandedPages = [...state.expandedPages, state.selectedNode.pageId];
    }
  }
  if (state.selectedNode.type === "container" && state.selectedNode.containerId) {
    const pageId = getPageIdForContainer(state.selectedNode.containerId);
    if (pageId && !state.expandedPages.includes(pageId)) {
      state.expandedPages = [...state.expandedPages, pageId];
    }
    let currentId = state.selectedNode.containerId;
    while (currentId) {
      if (!state.expandedContainers.includes(currentId)) {
        state.expandedContainers = [...state.expandedContainers, currentId];
      }
      currentId = getContainerParentId(currentId);
    }
  }
  if (state.selectedNode.type === "button" && state.selectedNode.containerId) {
    const pageId = getPageIdForContainer(state.selectedNode.containerId);
    if (pageId && !state.expandedPages.includes(pageId)) {
      state.expandedPages = [...state.expandedPages, pageId];
    }
    let currentId = state.selectedNode.containerId;
    while (currentId) {
      if (!state.expandedContainers.includes(currentId)) {
        state.expandedContainers = [...state.expandedContainers, currentId];
      }
      currentId = getContainerParentId(currentId);
    }
  }
  canvasUI.renderCanvas();
  renderList();
  renderTree();
  if (treeList && !treeList.children.length && state.pages.length) {
    state.expandedPages = state.pages.map((page) => page.id);
    const containerIds = [];
    state.pages.forEach((page) => {
      if (!Array.isArray(page.containers)) return;
      walkContainers(page.containers, (container) => {
        containerIds.push(container.id);
      });
    });
    state.expandedContainers = containerIds;
    renderTree();
  }
  renderPagesSelect();
  canvasUI.applyCanvasMode();
  applyCurrentPageBackground();
  state.lastSaved = snapshotState();
  setDirty(false);
}

async function saveCurrentState() {
  try {
    const pageSurface = document.querySelector(".page-surface");
    if (pageSurface) {
      const rect = pageSurface.getBoundingClientRect();
      state.pageSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
    }
    const res = await fetch("/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error("Save failed");
    saveState.classList.remove("save-ok");
    void saveState.offsetWidth;
    saveState.classList.add("save-ok");
    saveState.addEventListener(
      "animationend",
      () => {
        saveState.classList.remove("save-ok");
      },
      { once: true }
    );
    state.lastSaved = snapshotState();
    setDirty(false);
  } catch (err) {
    showError("Save failed. Click to dismiss.");
  }
}

saveState.addEventListener("click", saveCurrentState);
toggleScale.addEventListener("click", () => {
  window.open("/", "_blank", "noopener,noreferrer");
});
if (pageBg) {
  pageBg.addEventListener("input", () => {
    const page = getCurrentPage();
    if (!page) return;
    page.bg = pageBg.value;
    applyCurrentPageBackground();
    setDirty(true);
  });
}
if (pageGlow) {
  pageGlow.addEventListener("input", () => {
    const page = getCurrentPage();
    if (!page) return;
    page.glow = pageGlow.value;
    applyCurrentPageBackground();
    setDirty(true);
  });
}
function renameCurrentPage() {
  const current = getCurrentPage();
  if (!current) return;
  const next = window.prompt("Page name:", current.name);
  if (next && next.trim()) {
    const candidate = next.trim();
    const exists = state.pages.some(
      (page) => page.id !== current.id && page.name.toLowerCase() === candidate.toLowerCase()
    );
    if (exists) {
      window.alert("Page name already in use.");
      return;
    }
    current.name = candidate;
    renderPagesSelect();
    renderTree();
    renderList();
    setDirty(true);
  }
}

if (renamePage) {
  renamePage.addEventListener("click", () => {
    renameCurrentPage();
  });
}
if (startPageBtn) {
  startPageBtn.addEventListener("click", () => {
    if (!state.currentPageId) return;
    state.startPageId = state.currentPageId;
    renderPagesSelect();
    renderTree();
    setDirty(true);
  });
}
if (removePage) {
  removePage.addEventListener("click", () => {
    const page = getCurrentPage();
    if (!page) return;
    const ok = window.confirm(`Delete page "${page.name}"?`);
    if (!ok) return;
    removeCurrentPage();
  });
}
if (pagesSelect) {
  pagesSelect.addEventListener("change", () => {
    state.currentPageId = pagesSelect.value;
    const page = getCurrentPage();
    const firstContainer = page && page.containers[0];
    state.selectedNode = firstContainer
      ? { type: "container", containerId: firstContainer.id, buttonId: null }
      : { type: null, containerId: null, buttonId: null };
    canvasUI.renderCanvas();
    renderList();
    renderTree();
    renderPagesSelect();
    applyCurrentPageBackground();
  });
}

if (testError) {
  testError.addEventListener("click", () => {
    showError("Test error. Click to dismiss.");
  });
}
treeList.addEventListener("dblclick", (event) => {
  const node = event.target.closest(".tree-node-wrap");
  if (!node) return;
  if (node.classList.contains("small")) return;
  renameCurrentContainer();
});
canvas.addEventListener("click", (event) => {
  if (event.target !== canvas) return;
  state.selectedNode = { type: null, containerId: null, buttonId: null };
  canvasUI.renderCanvas();
  renderList();
  renderTree();
});
document.addEventListener("keydown", (event) => {
  const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
  if (tag === "input" || tag === "textarea") return;
  if (state.selectedNode.type !== "button") return;
  if (event.key === "Delete" || event.key === "Backspace") {
    const container = getContainerById(state.selectedNode.containerId);
    if (!container) return;
    container.buttons = container.buttons.filter((item) => item.id !== state.selectedNode.buttonId);
    state.selectedNode = { type: "container", containerId: container.id, buttonId: null };
    canvasUI.renderCanvas();
    renderList();
    renderTree();
    setDirty(true);
  }
});

loadState();
