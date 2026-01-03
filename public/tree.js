(() => {
  function createTreeUI(ctx) {
    const {
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
      removeCurrentContainer,
      removeCurrentPage,
      renderPagesSelect,
      renderList,
      applyCurrentPageBackground,
      addNewContainer,
      setDirty,
      canvasUI,
    } = ctx;

    function renderTree() {
      treeList.innerHTML = "";
      if (!state.pages.length) return;

      const removeButtonFromContainer = (container, buttonId) => {
        const idx = container.buttons.findIndex((btn) => btn.id === buttonId);
        if (idx === -1) return null;
        const [removed] = container.buttons.splice(idx, 1);
        return removed || null;
      };

      const reorderButtonInContainer = (container, buttonId, targetId) => {
        const fromIndex = container.buttons.findIndex((btn) => btn.id === buttonId);
        const targetIndex = container.buttons.findIndex((btn) => btn.id === targetId);
        if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) return;
        const [moved] = container.buttons.splice(fromIndex, 1);
        const nextIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
        container.buttons.splice(nextIndex, 0, moved);
      };

      const moveButtonToContainer = (
        buttonId,
        fromContainerId,
        toContainerId,
        fromPageId,
        toPageId
      ) => {
        if (fromContainerId === toContainerId && fromPageId === toPageId) return;
        const fromContainer = getContainerById(fromContainerId, fromPageId);
        const toContainer = getContainerById(toContainerId, toPageId);
        if (!fromContainer || !toContainer) return;
        const button = removeButtonFromContainer(fromContainer, buttonId);
        if (!button) return;
        normalizeContainer(toContainer, getContainerParentRect(toContainerId, toPageId));
        button.x = clamp(button.x, 0, Math.max(0, toContainer.width - 1));
        button.y = clamp(button.y, 0, Math.max(0, toContainer.height - 1));
        toContainer.buttons.push(button);
        if (!state.expandedContainers.includes(toContainerId)) {
          state.expandedContainers = [...state.expandedContainers, toContainerId];
        }
        if (toPageId) {
          state.currentPageId = toPageId;
          if (!state.expandedPages.includes(toPageId)) {
            state.expandedPages = [...state.expandedPages, toPageId];
          }
        }
        state.selectedNode = {
          type: "button",
          pageId: toPageId || null,
          containerId: toContainerId,
          buttonId,
        };
        canvasUI.renderCanvas();
        renderList();
        renderTree();
        setDirty(true);
      };

      const getButtonDragPayload = (event) => {
        if (!event.dataTransfer) return null;
        const payload = event.dataTransfer.getData("text/plain");
        if (!payload || !payload.startsWith("button:")) return null;
        const parts = payload.split(":");
        const fromPageId = parts.length > 3 ? parts[1] : null;
        const fromContainerId = parts.length > 3 ? parts[2] : parts[1];
        const buttonId = parts.length > 3 ? parts[3] : parts[2];
        if (!fromContainerId || !buttonId) return null;
        return { fromPageId, fromContainerId, buttonId };
      };

      const makeButtonDropTarget = (element, handlers) => {
        element.addEventListener("dragover", (event) => {
          const payload = getButtonDragPayload(event) || state.dragPayload;
          if (!payload) return;
          event.preventDefault();
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
          }
          if (handlers.onDragOver) handlers.onDragOver();
        });
        element.addEventListener("dragleave", () => {
          if (handlers.onDragLeave) handlers.onDragLeave();
        });
        element.addEventListener("drop", (event) => {
          const payload = getButtonDragPayload(event) || state.dragPayload;
          if (!payload) return;
          event.preventDefault();
          if (handlers.onDrop) handlers.onDrop(payload);
        });
      };

      const renderContainerNode = (container, parentUl, pageId) => {
        const item = document.createElement("li");
        item.className = "tree-item";
        const row = document.createElement("div");
        row.className = "tree-row tree-node-wrap";
        row.dataset.pageId = pageId || "";
        const hasChildren = container.containers.length > 0 || container.buttons.length > 0;
        row.classList.toggle("has-children", hasChildren);
        row.classList.toggle("empty-children", !hasChildren);
        const containerButton = document.createElement("button");
        containerButton.type = "button";
        containerButton.className = "tree-node-label";
        containerButton.textContent = container.name;
        row.dataset.containerId = container.id;
        makeButtonDropTarget(row, {
          onDragOver: () => row.classList.add("drag-target"),
          onDragLeave: () => row.classList.remove("drag-target"),
          onDrop: ({ fromPageId, fromContainerId, buttonId }) => {
            row.classList.remove("drag-target");
            if (fromContainerId === container.id && fromPageId === pageId) return;
            moveButtonToContainer(buttonId, fromContainerId, container.id, fromPageId, pageId);
          },
        });
        makeButtonDropTarget(containerButton, {
          onDragOver: () => row.classList.add("drag-target"),
          onDragLeave: () => row.classList.remove("drag-target"),
          onDrop: ({ fromPageId, fromContainerId, buttonId }) => {
            row.classList.remove("drag-target");
            if (fromContainerId === container.id && fromPageId === pageId) return;
            moveButtonToContainer(buttonId, fromContainerId, container.id, fromPageId, pageId);
          },
        });
        if (
          state.selectedNode.type === "container" &&
          state.selectedNode.containerId === container.id
        ) {
          row.classList.add("active");
        }
        containerButton.addEventListener("click", () => {
          if (pageId) {
            state.currentPageId = pageId;
          }
          state.selectedNode = {
            type: "container",
            pageId: pageId || null,
            containerId: container.id,
            buttonId: null,
          };
          canvasUI.renderCanvas();
          renderList();
          renderTree();
        });
        const actions = document.createElement("span");
        actions.className = "tree-actions-inline";
        if (hasChildren) {
          const isExpanded = state.expandedContainers.includes(container.id);
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "tree-toggle";
          toggle.textContent = isExpanded ? "▾" : "▸";
          toggle.title = isExpanded ? "Hide items" : "Show items";
          toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            if (state.expandedContainers.includes(container.id)) {
              state.expandedContainers = state.expandedContainers.filter((id) => id !== container.id);
            } else {
              state.expandedContainers = [...state.expandedContainers, container.id];
            }
            renderTree();
          });
          actions.append(toggle);
        }
        const add = document.createElement("button");
        add.type = "button";
        add.className = "tree-add";
        add.textContent = "+";
        add.title = "Add inside container";
        add.addEventListener("click", (event) => {
          event.stopPropagation();
          const choice = window.prompt('Add inside container: "b" for button, "c" for container');
          if (!choice) return;
          const normalized = choice.trim().toLowerCase();
          if (normalized.startsWith("b")) {
            const button = createButtonForContainer(container);
            addButtonToContainer(container, button);
            if (!state.expandedContainers.includes(container.id)) {
              state.expandedContainers = [...state.expandedContainers, container.id];
            }
          } else if (normalized.startsWith("c")) {
            addChildContainer(container);
            if (!state.expandedContainers.includes(container.id)) {
              state.expandedContainers = [...state.expandedContainers, container.id];
            }
          }
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "tree-remove";
        remove.textContent = "−";
        remove.title = "Remove container";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          const ok = window.confirm(`Delete container "${container.name}"?`);
          if (!ok) return;
          state.selectedNode = { type: "container", containerId: container.id, buttonId: null };
          removeCurrentContainer();
        });
        actions.append(add, remove);
        row.append(containerButton, actions);
        item.appendChild(row);

        if (state.expandedContainers.includes(container.id)) {
          const children = document.createElement("ul");
          children.className = "tree-children";
          makeButtonDropTarget(children, {
            onDrop: ({ fromPageId, fromContainerId, buttonId }) => {
              if (fromContainerId === container.id && fromPageId === pageId) return;
              moveButtonToContainer(
                buttonId,
                fromContainerId,
                container.id,
                fromPageId,
                pageId
              );
            },
          });
          container.containers.forEach((childContainer) => {
            renderContainerNode(childContainer, children, pageId);
          });
          if (container.buttons.length) {
            container.buttons.forEach((button) => {
              const child = document.createElement("li");
              const row = document.createElement("div");
              row.className = "tree-row tree-node-wrap small";
              makeButtonDropTarget(row, {
                onDragOver: () => row.classList.add("drag-target"),
                onDragLeave: () => row.classList.remove("drag-target"),
                onDrop: ({ fromPageId, fromContainerId, buttonId }) => {
                  row.classList.remove("drag-target");
                  if (fromContainerId === container.id && fromPageId === pageId) {
                    reorderButtonInContainer(container, buttonId, button.id);
                    renderTree();
                    setDirty(true);
                    return;
                  }
                  moveButtonToContainer(buttonId, fromContainerId, container.id, fromPageId, pageId);
                },
              });
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "tree-node-label";
              btn.textContent = button.label;
              row.draggable = true;
              const onDragStart = (event) => {
                if (!event.dataTransfer) return;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                  "text/plain",
                  `button:${pageId || ""}:${container.id}:${button.id}`
                );
                state.dragPayload = {
                  fromPageId: pageId || null,
                  fromContainerId: container.id,
                  buttonId: button.id,
                };
              };
              row.addEventListener("dragstart", onDragStart);
              row.addEventListener("dragend", () => {
                state.dragPayload = null;
              });
              btn.draggable = true;
              btn.addEventListener("dragstart", onDragStart);
              btn.addEventListener("dragend", () => {
                state.dragPayload = null;
              });
              makeButtonDropTarget(btn, {
                onDragOver: () => row.classList.add("drag-target"),
                onDragLeave: () => row.classList.remove("drag-target"),
                onDrop: ({ fromPageId, fromContainerId, buttonId }) => {
                  row.classList.remove("drag-target");
                  if (fromContainerId === container.id && fromPageId === pageId) {
                    reorderButtonInContainer(container, buttonId, button.id);
                    renderTree();
                    setDirty(true);
                    return;
                  }
                  moveButtonToContainer(buttonId, fromContainerId, container.id, fromPageId, pageId);
                },
              });
              if (
                state.selectedNode.type === "button" &&
                state.selectedNode.buttonId === button.id &&
                state.selectedNode.containerId === container.id
              ) {
                row.classList.add("active");
              }
              btn.addEventListener("click", (event) => {
                event.stopPropagation();
                if (pageId) {
                  state.currentPageId = pageId;
                }
                state.selectedNode = {
                  type: "button",
                  pageId: pageId || null,
                  containerId: container.id,
                  buttonId: button.id,
                };
                canvasUI.renderCanvas();
                renderList();
                renderTree();
              });
              const remove = document.createElement("button");
              remove.type = "button";
              remove.className = "tree-remove";
              remove.textContent = "−";
              remove.title = "Remove button";
              remove.addEventListener("click", (event) => {
                event.stopPropagation();
                const ok = window.confirm(`Delete button "${button.label}"?`);
                if (!ok) return;
                container.buttons = container.buttons.filter((item) => item.id !== button.id);
                state.selectedNode = {
                  type: "container",
                  containerId: container.id,
                  buttonId: null,
                };
                canvasUI.renderCanvas();
                renderList();
                renderTree();
                setDirty(true);
              });
              row.append(btn, remove);
              child.appendChild(row);
              children.appendChild(child);
            });
          }
          if (children.children.length) {
            item.appendChild(children);
          }
        }
        parentUl.appendChild(item);
      };

      const renderPageNode = (page) => {
        const item = document.createElement("li");
        item.className = "tree-item";
        const row = document.createElement("div");
        row.className = "tree-row tree-node-wrap tree-page";
        const pageButton = document.createElement("button");
        pageButton.type = "button";
        pageButton.className = "tree-node-label";
        pageButton.textContent = page.name;
        if (state.currentPageId === page.id) {
          row.classList.add("active");
        }
        pageButton.addEventListener("click", () => {
          state.currentPageId = page.id;
          state.selectedNode = { type: "page", pageId: page.id, containerId: null, buttonId: null };
          renderPagesSelect();
          canvasUI.renderCanvas();
          renderList();
          renderTree();
          applyCurrentPageBackground();
        });
        const actions = document.createElement("span");
        actions.className = "tree-actions-inline";
        const star = document.createElement("button");
        star.type = "button";
        star.className = "tree-star";
        const isStart = state.startPageId === page.id;
        star.textContent = isStart ? "★" : "☆";
        star.title = isStart ? "Start page" : "Set start page";
        star.classList.toggle("active", isStart);
        star.addEventListener("click", (event) => {
          event.stopPropagation();
          state.startPageId = page.id;
          renderPagesSelect();
          renderTree();
          setDirty(true);
        });
        actions.append(star);
        const add = document.createElement("button");
        add.type = "button";
        add.className = "tree-add";
        add.textContent = "+";
        add.title = "Add container";
        add.addEventListener("click", (event) => {
          event.stopPropagation();
          state.currentPageId = page.id;
          addNewContainer();
        });
        actions.append(add);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "tree-remove";
        remove.textContent = "−";
        remove.title = "Remove page";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          const ok = window.confirm(`Delete page "${page.name}"?`);
          if (!ok) return;
          state.currentPageId = page.id;
          removeCurrentPage();
        });
        actions.append(remove);
        const hasChildren = page.containers.length > 0;
        if (hasChildren) {
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "tree-toggle";
          const isExpanded = state.expandedPages.includes(page.id);
          toggle.textContent = isExpanded ? "▾" : "▸";
          toggle.title = isExpanded ? "Hide items" : "Show items";
          toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            if (state.expandedPages.includes(page.id)) {
              state.expandedPages = state.expandedPages.filter((id) => id !== page.id);
            } else {
              state.expandedPages = [...state.expandedPages, page.id];
            }
            renderTree();
          });
          actions.append(toggle);
        }
        row.append(pageButton, actions);
        item.appendChild(row);

        if (state.expandedPages.includes(page.id)) {
          const children = document.createElement("ul");
          children.className = "tree-children";
          page.containers.forEach((container) => {
            renderContainerNode(container, children, page.id);
          });
          if (children.children.length) {
            item.appendChild(children);
          }
        }
        treeList.appendChild(item);
      };

      state.pages.forEach((page) => {
        renderPageNode(page);
      });
    }

    return { renderTree };
  }

  window.TreeUI = createTreeUI;
})();
