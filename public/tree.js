(() => {
  function createTreeUI(ctx) {
    const {
      state,
      treeList,
      clamp,
      normalizeContainer,
      getContainerById,
      getContainerParentRect,
      getPageIdForContainer,
      createButtonForContainer,
      addButtonToContainer,
      addChildContainer,
      addNewContainer,
      addNewPage,
      removeCurrentContainer,
      removeCurrentPage,
      renderPagesSelect,
      renderList,
      selectNode,
      applyCurrentPageBackground,
      setDirty,
      canvasUI,
    } = ctx;

    const findPageById = (pageId) =>
      state.pages.find((page) => page.id === pageId) || null;

    const isNodeSelected = (node) => {
      const selected = state.selectedNode || {};
      if (node.type === "website") {
        return selected.type === "website";
      }
      if (node.type === "page") {
        return selected.type === "page" && selected.pageId === node.pageId;
      }
      if (node.type === "container") {
        return selected.type === "container" && selected.containerId === node.containerId;
      }
      if (node.type === "button") {
        return (
          selected.type === "button" &&
          selected.buttonId === node.buttonId &&
          selected.containerId === node.containerId
        );
      }
      return false;
    };

    function renderTree() {
      treeList.innerHTML = "";
      if (!state.pages.length || !window.TreeModel) return;
      TreeModel.ensureConfig(renderTree);
      const getTypeActions = TreeModel.getActions;
      const canDrag = TreeModel.canDrag;
      const canDropOn = TreeModel.canDropOn;
      const canReorderOn = TreeModel.canReorderOn;

      const makeActionButton = (className, label, title, onClick) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        if (title) button.title = title;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          onClick();
        });
        return button;
      };

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

      const getDragPayload = (event, prefix) => {
        if (!event.dataTransfer) return null;
        const payload = event.dataTransfer.getData("text/plain");
        if (!payload || !payload.startsWith(`${prefix}:`)) return null;
        const parts = payload.split(":");
        const fromPageId = parts.length > 3 ? parts[1] : null;
        const fromContainerId = parts.length > 3 ? parts[2] : parts[1];
        const nodeId = parts.length > 3 ? parts[3] : parts[2];
        if (!fromContainerId || !nodeId) return null;
        return { fromPageId, fromContainerId, nodeId, type: prefix };
      };

      const makeDropTarget = (element, payloadType, handlers) => {
        element.addEventListener("dragover", (event) => {
          const payload = getDragPayload(event, payloadType) || state.dragPayload;
          if (payload && payload.type && payload.type !== payloadType) return;
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
          const payload = getDragPayload(event, payloadType) || state.dragPayload;
          if (payload && payload.type && payload.type !== payloadType) return;
          if (!payload) return;
          event.preventDefault();
          if (handlers.onDrop) handlers.onDrop(payload);
        });
      };

      const removeContainerFromParent = (containerId, pageId) => {
        const page = findPageById(pageId);
        if (!page) return null;
        if (!Array.isArray(page.containers)) return null;
        const removeFrom = (list) => {
          const idx = list.findIndex((item) => item.id === containerId);
          if (idx !== -1) {
            const [removed] = list.splice(idx, 1);
            return removed || null;
          }
          for (let i = 0; i < list.length; i += 1) {
            const child = list[i];
            if (!child || !Array.isArray(child.containers)) continue;
            const removed = removeFrom(child.containers);
            if (removed) return removed;
          }
          return null;
        };
        return removeFrom(page.containers);
      };

      const moveContainerToContainer = (containerId, fromPageId, toContainerId, toPageId) => {
        if (containerId === toContainerId && fromPageId === toPageId) return;
        const moved = removeContainerFromParent(containerId, fromPageId);
        const toContainer = getContainerById(toContainerId, toPageId);
        if (!moved || !toContainer) return;
        toContainer.containers = Array.isArray(toContainer.containers)
          ? toContainer.containers
          : [];
        toContainer.containers.push(moved);
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
          type: "container",
          pageId: toPageId || null,
          containerId,
          buttonId: null,
        };
        canvasUI.renderCanvas();
        renderList();
        renderTree();
        setDirty(true);
      };

      const moveContainerToPage = (containerId, fromPageId, toPageId) => {
        if (fromPageId === toPageId) return;
        const moved = removeContainerFromParent(containerId, fromPageId);
        const page = findPageById(toPageId);
        if (!moved || !page) return;
        page.containers = Array.isArray(page.containers) ? page.containers : [];
        page.containers.push(moved);
        state.currentPageId = toPageId;
        if (!state.expandedPages.includes(toPageId)) {
          state.expandedPages = [...state.expandedPages, toPageId];
        }
        state.selectedNode = {
          type: "container",
          pageId: toPageId,
          containerId,
          buttonId: null,
        };
        canvasUI.renderCanvas();
        renderList();
        renderTree();
        setDirty(true);
      };

      const renderNode = (node, parentUl) => {
        const item = document.createElement("li");
        item.className = "tree-item";
        const row = document.createElement("div");
        row.className = "tree-row tree-node-wrap";
        row.dataset.nodeType = node.type;
        if (node.type === "button") {
          row.classList.add("small");
        }
        if (isNodeSelected(node)) {
          row.classList.add("active");
        }
        if (node.type === "page" && state.currentPageId === node.pageId) {
          row.classList.add("active");
        }
        const labelButton = document.createElement("button");
        labelButton.type = "button";
        labelButton.className = "tree-node-label";
        labelButton.textContent = node.label;
        labelButton.addEventListener("click", (event) => {
          event.stopPropagation();
          if (typeof selectNode === "function") {
            selectNode(node);
          }
        });
        row.appendChild(labelButton);

        const actions = document.createElement("span");
        actions.className = "tree-actions-inline";
        const hasChildren = node.children && node.children.length > 0;

        if (node.type === "website") {
          const actionsDef = getTypeActions("website");
          if (typeof addNewPage === "function" && actionsDef.add && actionsDef.add.includes("page")) {
            const addPageBtn = makeActionButton("tree-add", "+", "Add page", () => {
              addNewPage();
            });
            actions.appendChild(addPageBtn);
          }
        }

        if (node.type === "page") {
          const actionsDef = getTypeActions("page");
          const star = document.createElement("button");
          star.type = "button";
          star.className = "tree-star";
          const isStart = state.startPageId === node.pageId;
          star.textContent = isStart ? "★" : "☆";
          star.title = isStart ? "Start page" : "Set start page";
          star.classList.toggle("active", isStart);
          if (actionsDef.star) {
            star.addEventListener("click", (event) => {
              event.stopPropagation();
              state.startPageId = node.pageId;
              renderPagesSelect();
              renderTree();
              setDirty(true);
            });
            actions.appendChild(star);
          }

          if (actionsDef.add && actionsDef.add.includes("container")) {
            const add = makeActionButton("tree-add", "+", "Add container", () => {
              state.currentPageId = node.pageId;
              addNewContainer();
            });
            actions.appendChild(add);
          }

          if (actionsDef.remove) {
            const remove = makeActionButton("tree-remove", "−", "Remove page", () => {
              const page = findPageById(node.pageId);
              const ok = window.confirm(`Delete page "${page ? page.name : "Page"}"?`);
              if (!ok) return;
              state.currentPageId = node.pageId;
              removeCurrentPage();
            });
            actions.appendChild(remove);
          }
        }

        if (node.type === "container") {
          const actionsDef = getTypeActions("container");
          row.dataset.pageId = node.pageId || "";
          row.dataset.containerId = node.containerId;
          if (hasChildren) {
            row.classList.add("has-children");
          } else {
            row.classList.add("empty-children");
          }
          const isExpanded = state.expandedContainers.includes(node.containerId);
          if (hasChildren) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "tree-toggle";
            toggle.textContent = isExpanded ? "▾" : "▸";
            toggle.title = isExpanded ? "Hide items" : "Show items";
            toggle.addEventListener("click", (event) => {
              event.stopPropagation();
              if (state.expandedContainers.includes(node.containerId)) {
                state.expandedContainers = state.expandedContainers.filter(
                  (id) => id !== node.containerId
                );
              } else {
                state.expandedContainers = [...state.expandedContainers, node.containerId];
              }
              renderTree();
            });
            actions.appendChild(toggle);
          }

          if (actionsDef.add && actionsDef.add.length) {
            const add = makeActionButton("tree-add", "+", "Add inside container", () => {
              const container = getContainerById(node.containerId, node.pageId);
              if (!container) return;
              const choice = window.prompt('Add inside container: "b" for button, "c" for container');
              if (!choice) return;
              const normalized = choice.trim().toLowerCase();
              if (normalized.startsWith("b") && actionsDef.add.includes("button")) {
                const button = createButtonForContainer(container);
                addButtonToContainer(container, button);
                if (!state.expandedContainers.includes(container.id)) {
                  state.expandedContainers = [...state.expandedContainers, container.id];
                }
              } else if (normalized.startsWith("c") && actionsDef.add.includes("container")) {
                addChildContainer(container);
                if (!state.expandedContainers.includes(container.id)) {
                  state.expandedContainers = [...state.expandedContainers, container.id];
                }
              }
            });
            actions.appendChild(add);
          }

          if (actionsDef.remove) {
            const remove = makeActionButton("tree-remove", "−", "Remove container", () => {
              const container = getContainerById(node.containerId, node.pageId);
              const ok = window.confirm(
                `Delete container "${container ? container.name : "Container"}"?`
              );
              if (!ok) return;
              state.selectedNode = {
                type: "container",
                containerId: node.containerId,
                buttonId: null,
              };
              removeCurrentContainer();
            });
            actions.appendChild(remove);
          }
        }

        if (node.type === "button") {
          const actionsDef = getTypeActions("button");
          row.draggable = canDrag("button");
          labelButton.draggable = canDrag("button");
          const onDragStart = (event) => {
            if (!event.dataTransfer) return;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "text/plain",
              `button:${node.pageId || ""}:${node.containerId}:${node.buttonId}`
            );
            state.dragPayload = {
              fromPageId: node.pageId || null,
              fromContainerId: node.containerId,
              nodeId: node.buttonId,
              type: "button",
            };
          };
          const clearDrag = () => {
            state.dragPayload = null;
          };
          row.addEventListener("dragstart", onDragStart);
          row.addEventListener("dragend", clearDrag);
          labelButton.addEventListener("dragstart", onDragStart);
          labelButton.addEventListener("dragend", clearDrag);

          if (actionsDef.remove) {
            const remove = makeActionButton("tree-remove", "−", "Remove button", () => {
              const container = getContainerById(node.containerId, node.pageId);
              if (!container) return;
              const button = container.buttons.find((item) => item.id === node.buttonId);
              const ok = window.confirm(`Delete button "${button ? button.label : "Button"}"?`);
              if (!ok) return;
              container.buttons = container.buttons.filter((item) => item.id !== node.buttonId);
              state.selectedNode = {
                type: "container",
                containerId: node.containerId,
                buttonId: null,
              };
              canvasUI.renderCanvas();
              renderList();
              renderTree();
              setDirty(true);
            });
            actions.appendChild(remove);
          }
        }

        row.appendChild(actions);
        item.appendChild(row);
        parentUl.appendChild(item);

        if (node.type === "container") {
          if (canDrag("container")) {
            row.draggable = true;
            labelButton.draggable = true;
            const onDragStart = (event) => {
              if (!event.dataTransfer) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(
                "text/plain",
                `container:${node.pageId || ""}:${node.containerId}:${node.containerId}`
              );
              state.dragPayload = {
                fromPageId: node.pageId || null,
                fromContainerId: node.containerId,
                nodeId: node.containerId,
                type: "container",
              };
            };
            const clearDrag = () => {
              state.dragPayload = null;
            };
            row.addEventListener("dragstart", onDragStart);
            row.addEventListener("dragend", clearDrag);
            labelButton.addEventListener("dragstart", onDragStart);
            labelButton.addEventListener("dragend", clearDrag);
          }
          if (canDropOn("button", "container")) {
            makeDropTarget(row, "button", {
              onDragOver: () => row.classList.add("drag-target"),
              onDragLeave: () => row.classList.remove("drag-target"),
              onDrop: ({ fromPageId, fromContainerId, nodeId }) => {
                row.classList.remove("drag-target");
                if (fromContainerId === node.containerId && fromPageId === node.pageId) return;
                moveButtonToContainer(nodeId, fromContainerId, node.containerId, fromPageId, node.pageId);
              },
            });
            makeDropTarget(labelButton, "button", {
              onDragOver: () => row.classList.add("drag-target"),
              onDragLeave: () => row.classList.remove("drag-target"),
              onDrop: ({ fromPageId, fromContainerId, nodeId }) => {
                row.classList.remove("drag-target");
                if (fromContainerId === node.containerId && fromPageId === node.pageId) return;
                moveButtonToContainer(nodeId, fromContainerId, node.containerId, fromPageId, node.pageId);
              },
            });
          }
          if (canDropOn("container", "container")) {
            makeDropTarget(row, "container", {
              onDragOver: () => row.classList.add("drag-target"),
              onDragLeave: () => row.classList.remove("drag-target"),
              onDrop: ({ fromPageId, nodeId }) => {
                row.classList.remove("drag-target");
                if (nodeId === node.containerId && fromPageId === node.pageId) return;
                moveContainerToContainer(nodeId, fromPageId, node.containerId, node.pageId);
              },
            });
            makeDropTarget(labelButton, "container", {
              onDragOver: () => row.classList.add("drag-target"),
              onDragLeave: () => row.classList.remove("drag-target"),
              onDrop: ({ fromPageId, nodeId }) => {
                row.classList.remove("drag-target");
                if (nodeId === node.containerId && fromPageId === node.pageId) return;
                moveContainerToContainer(nodeId, fromPageId, node.containerId, node.pageId);
              },
            });
          }
        }

        if (node.type === "button" && canDropOn("button", "button")) {
          makeDropTarget(labelButton, "button", {
            onDragOver: () => row.classList.add("drag-target"),
            onDragLeave: () => row.classList.remove("drag-target"),
            onDrop: ({ fromPageId, fromContainerId, nodeId }) => {
              row.classList.remove("drag-target");
              if (
                fromContainerId === node.containerId &&
                fromPageId === node.pageId &&
                canReorderOn("button", "button")
              ) {
                const container = getContainerById(node.containerId, node.pageId);
                if (!container) return;
                reorderButtonInContainer(container, nodeId, node.buttonId);
                renderTree();
                setDirty(true);
                return;
              }
              moveButtonToContainer(nodeId, fromContainerId, node.containerId, fromPageId, node.pageId);
            },
          });
          makeDropTarget(row, "button", {
            onDragOver: () => row.classList.add("drag-target"),
            onDragLeave: () => row.classList.remove("drag-target"),
            onDrop: ({ fromPageId, fromContainerId, nodeId }) => {
              row.classList.remove("drag-target");
              if (
                fromContainerId === node.containerId &&
                fromPageId === node.pageId &&
                canReorderOn("button", "button")
              ) {
                const container = getContainerById(node.containerId, node.pageId);
                if (!container) return;
                reorderButtonInContainer(container, nodeId, node.buttonId);
                renderTree();
                setDirty(true);
                return;
              }
              moveButtonToContainer(nodeId, fromContainerId, node.containerId, fromPageId, node.pageId);
            },
          });
        }

        if (node.type === "website") {
          if (node.children && node.children.length) {
            const children = document.createElement("ul");
            children.className = "tree-children";
            node.children.forEach((child) => {
              renderNode(child, children);
            });
            item.appendChild(children);
          }
          return;
        }

        if (node.type === "page") {
          const hasContainers = node.children && node.children.length > 0;
          if (hasContainers) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "tree-toggle";
            const isExpanded = state.expandedPages.includes(node.pageId);
            toggle.textContent = isExpanded ? "▾" : "▸";
            toggle.title = isExpanded ? "Hide items" : "Show items";
            toggle.addEventListener("click", (event) => {
              event.stopPropagation();
              if (state.expandedPages.includes(node.pageId)) {
                state.expandedPages = state.expandedPages.filter((id) => id !== node.pageId);
              } else {
                state.expandedPages = [...state.expandedPages, node.pageId];
              }
              renderTree();
            });
            actions.appendChild(toggle);
          }
        }

        if (node.type === "page") {
          if (canDropOn("container", "page")) {
            makeDropTarget(row, "container", {
              onDragOver: () => row.classList.add("drag-target"),
              onDragLeave: () => row.classList.remove("drag-target"),
              onDrop: ({ fromPageId, nodeId }) => {
                row.classList.remove("drag-target");
                if (fromPageId === node.pageId) return;
                moveContainerToPage(nodeId, fromPageId, node.pageId);
              },
            });
            makeDropTarget(labelButton, "container", {
              onDragOver: () => row.classList.add("drag-target"),
              onDragLeave: () => row.classList.remove("drag-target"),
              onDrop: ({ fromPageId, nodeId }) => {
                row.classList.remove("drag-target");
                if (fromPageId === node.pageId) return;
                moveContainerToPage(nodeId, fromPageId, node.pageId);
              },
            });
          }
          if (state.expandedPages.includes(node.pageId)) {
            const children = document.createElement("ul");
            children.className = "tree-children";
            if (canDropOn("container", "page")) {
              makeDropTarget(children, "container", {
                onDrop: ({ fromPageId, nodeId }) => {
                  if (fromPageId === node.pageId) return;
                  moveContainerToPage(nodeId, fromPageId, node.pageId);
                },
              });
            }
            node.children.forEach((child) => {
              renderNode(child, children);
            });
            if (children.children.length) {
              item.appendChild(children);
            }
          }
          return;
        }

        if (node.type === "container") {
          if (state.expandedContainers.includes(node.containerId)) {
            const children = document.createElement("ul");
            children.className = "tree-children";
            if (canDropOn("button", "container")) {
              makeDropTarget(children, "button", {
                onDrop: ({ fromPageId, fromContainerId, nodeId }) => {
                  if (fromContainerId === node.containerId && fromPageId === node.pageId) return;
                  moveButtonToContainer(
                    nodeId,
                    fromContainerId,
                    node.containerId,
                    fromPageId,
                    node.pageId
                  );
                },
              });
            }
            node.children.forEach((child) => {
              renderNode(child, children);
            });
            if (children.children.length) {
              item.appendChild(children);
            }
          }
          return;
        }
      };

      const model = TreeModel.buildTreeModel(state);
      renderNode(model, treeList);
    }

    return { renderTree };
  }

  window.TreeUI = createTreeUI;
})();
