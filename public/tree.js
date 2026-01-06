(() => {
  function createTreeUI(ctx) {
    const {
      state,
      treeList,
      clamp,
      normalizeContainer,
      getContainerById,
      getContainerParentId,
      getContainerParentRect,
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
      setDirty,
      canvasUI,
    } = ctx;

    const findPageById = (pageId) =>
      state.pages.find((page) => page.id === pageId) || null;

    const isNodeSelected = (node) => {
      const selected = state.selectedNode || {};
      if (selected.type !== node.type) return false;
      if (node.type === "website") return true;
      return Boolean(selected.nodeId && selected.nodeId === node.id);
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
          nodeId: buttonId,
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
        const rawPageId = parts.length > 3 ? parts[1] : null;
        const rawContainerId = parts.length > 3 ? parts[2] : parts[1];
        const fromPageId = rawPageId ? rawPageId : null;
        const fromContainerId = rawContainerId ? rawContainerId : null;
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
          state.dragPayload = null;
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

      const getContainerListForParent = (pageId, parentContainerId) => {
        const page = findPageById(pageId);
        if (!page) return null;
        if (!parentContainerId) return page.containers;
        const parent = getContainerById(parentContainerId, pageId);
        return parent && Array.isArray(parent.containers) ? parent.containers : null;
      };

      const moveContainerToParentAtIndex = (
        containerId,
        fromPageId,
        targetPageId,
        targetParentId,
        insertIndex
      ) => {
        if (!targetPageId) return;
        if (containerId === targetParentId) return;
        const resolvedFromPageId = fromPageId || targetPageId;
        const list = getContainerListForParent(targetPageId, targetParentId);
        if (!Array.isArray(list)) return;
        const fromParentId = getContainerParentId(containerId, resolvedFromPageId);
        const sameParent =
          resolvedFromPageId === targetPageId && fromParentId === targetParentId;
        if (sameParent) {
          const fromIndex = list.findIndex((item) => item.id === containerId);
          if (fromIndex === -1) return;
          const [moved] = list.splice(fromIndex, 1);
          const safeIndex = Math.max(0, Math.min(insertIndex, list.length));
          const nextIndex = fromIndex < safeIndex ? safeIndex - 1 : safeIndex;
          list.splice(Math.max(0, nextIndex), 0, moved);
        } else {
          const moved = removeContainerFromParent(containerId, resolvedFromPageId);
          if (!moved) return;
          const safeIndex = Math.max(0, Math.min(insertIndex, list.length));
          list.splice(safeIndex, 0, moved);
        }
        state.currentPageId = targetPageId;
        if (!state.expandedPages.includes(targetPageId)) {
          state.expandedPages = [...state.expandedPages, targetPageId];
        }
        if (targetParentId && !state.expandedContainers.includes(targetParentId)) {
          state.expandedContainers = [...state.expandedContainers, targetParentId];
        }
        state.selectedNode = {
          type: "container",
          nodeId: containerId,
        };
        canvasUI.renderCanvas();
        renderList();
        renderTree();
        setDirty(true);
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
          nodeId: containerId,
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
          nodeId: containerId,
        };
        canvasUI.renderCanvas();
        renderList();
        renderTree();
        setDirty(true);
      };

      const getActionMeta = (type, key) => {
        const def = TreeModel.getTypeDef(type) || {};
        const ui = def.ui && def.ui.actions ? def.ui.actions : {};
        return ui[key] || null;
      };

      const makeAction = (type, key, className, fallbackIcon, fallbackTitle, onClick, active) => {
        const meta = getActionMeta(type, key) || {};
        const icon = active ? meta.iconActive || fallbackIcon : meta.icon || fallbackIcon;
        const title = active ? meta.titleActive || fallbackTitle : meta.title || fallbackTitle;
        return makeActionButton(className, icon, title, onClick);
      };

      const makeContainerDropBar = (parentUl, parentPageId, parentContainerId, insertIndex) => {
        if (!canReorderOn("container", "container")) return;
        const bar = document.createElement("li");
        bar.className = "tree-dropbar";
        const line = document.createElement("div");
        line.className = "tree-dropbar-line";
        bar.appendChild(line);
        makeDropTarget(bar, "container", {
          onDragOver: () => bar.classList.add("active"),
          onDragLeave: () => bar.classList.remove("active"),
          onDrop: ({ fromPageId, nodeId }) => {
            bar.classList.remove("active");
            moveContainerToParentAtIndex(
              nodeId,
              fromPageId,
              parentPageId,
              parentContainerId,
              insertIndex
            );
          },
        });
        parentUl.appendChild(bar);
      };

      const nodeHandlers = {
        website: {
          renderActions: (node, actions) => {
            const actionsDef = getTypeActions("website");
            if (typeof addNewPage === "function" && actionsDef.add?.includes("page")) {
              actions.appendChild(
                makeAction("website", "add", "tree-add", "+", "Add page", () => addNewPage())
              );
            }
          },
          renderChildren: (node, item) => {
            if (!node.children || !node.children.length) return;
            const children = document.createElement("ul");
            children.className = "tree-children";
            node.children.forEach((child) => renderNode(child, children));
            item.appendChild(children);
          },
        },
        page: {
          renderActions: (node, actions, row, labelButton) => {
            const actionsDef = getTypeActions("page");
            const isStart = state.startPageId === node.pageId;
            if (actionsDef.star) {
              const star = makeAction(
                "page",
                "star",
                "tree-star",
                isStart ? "★" : "☆",
                isStart ? "Start page" : "Set start page",
                () => {
                  state.startPageId = node.pageId;
                  renderPagesSelect();
                  renderTree();
                  setDirty(true);
                },
                isStart
              );
              star.classList.toggle("active", isStart);
              actions.appendChild(star);
            }
            if (actionsDef.add?.includes("container")) {
              actions.appendChild(
                makeAction("page", "add", "tree-add", "+", "Add container", () => {
                  state.currentPageId = node.pageId;
                  addNewContainer();
                })
              );
            }
            if (actionsDef.remove) {
              actions.appendChild(
                makeAction("page", "remove", "tree-remove", "−", "Remove page", () => {
                  const page = findPageById(node.pageId);
                  const ok = window.confirm(`Delete page "${page ? page.name : "Page"}"?`);
                  if (!ok) return;
                  state.currentPageId = node.pageId;
                  removeCurrentPage();
                })
              );
            }
            const hasChildren = node.children && node.children.length > 0;
            if (hasChildren) {
              const isExpanded = state.expandedPages.includes(node.pageId);
              const toggle = makeActionButton(
                "tree-toggle",
                isExpanded ? "▾" : "▸",
                isExpanded ? "Hide items" : "Show items",
                () => {
                  if (state.expandedPages.includes(node.pageId)) {
                    state.expandedPages = state.expandedPages.filter((id) => id !== node.pageId);
                  } else {
                    state.expandedPages = [...state.expandedPages, node.pageId];
                  }
                  renderTree();
                }
              );
              actions.appendChild(toggle);
            }
            if (canDropOn("container", "page")) {
              const attachDrop = (el) => {
                makeDropTarget(el, "container", {
                  onDragOver: () => row.classList.add("drag-target"),
                  onDragLeave: () => row.classList.remove("drag-target"),
                  onDrop: ({ fromPageId, nodeId }) => {
                    row.classList.remove("drag-target");
                    if (fromPageId === node.pageId) return;
                    moveContainerToPage(nodeId, fromPageId, node.pageId);
                  },
                });
              };
              attachDrop(row);
              attachDrop(labelButton);
            }
          },
          renderChildren: (node, item) => {
            if (!state.expandedPages.includes(node.pageId)) return;
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
            const containerChildren = node.children.filter((child) => child.type === "container");
            containerChildren.forEach((child, index) => {
              makeContainerDropBar(children, node.pageId, null, index);
              renderNode(child, children);
            });
            if (containerChildren.length) {
              makeContainerDropBar(children, node.pageId, null, containerChildren.length);
            }
            if (children.children.length) {
              item.appendChild(children);
            }
          },
        },
        container: {
          renderActions: (node, actions, row, labelButton) => {
            const actionsDef = getTypeActions("container");
            const hasChildren = node.children && node.children.length > 0;
            row.dataset.pageId = node.pageId || "";
            row.dataset.containerId = node.containerId;
            row.classList.toggle("has-children", hasChildren);
            row.classList.toggle("empty-children", !hasChildren);
            if (hasChildren) {
              const isExpanded = state.expandedContainers.includes(node.containerId);
              const toggle = makeActionButton(
                "tree-toggle",
                isExpanded ? "▾" : "▸",
                isExpanded ? "Hide items" : "Show items",
                () => {
                  if (state.expandedContainers.includes(node.containerId)) {
                    state.expandedContainers = state.expandedContainers.filter(
                      (id) => id !== node.containerId
                    );
                  } else {
                    state.expandedContainers = [...state.expandedContainers, node.containerId];
                  }
                  renderTree();
                }
              );
              actions.appendChild(toggle);
            }
            if (actionsDef.add?.length) {
              actions.appendChild(
                makeAction("container", "add", "tree-add", "+", "Add inside container", () => {
                  const container = getContainerById(node.containerId, node.pageId);
                  if (!container) return;
                  const choice = window.prompt(
                    'Add inside container: "b" for button, "c" for container'
                  );
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
                })
              );
            }
            if (actionsDef.remove) {
              actions.appendChild(
                makeAction("container", "remove", "tree-remove", "−", "Remove container", () => {
                  const container = getContainerById(node.containerId, node.pageId);
                  const ok = window.confirm(
                    `Delete container "${container ? container.name : "Container"}"?`
                  );
                  if (!ok) return;
                  state.selectedNode = {
                    type: "container",
                    nodeId: node.containerId,
                  };
                  removeCurrentContainer();
                })
              );
            }
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
              setTimeout(() => {
                state.dragPayload = null;
              }, 200);
            };
              row.addEventListener("dragstart", onDragStart);
              row.addEventListener("dragend", clearDrag);
              labelButton.addEventListener("dragstart", onDragStart);
              labelButton.addEventListener("dragend", clearDrag);
            }
            if (canDropOn("button", "container")) {
              const attachDrop = (el) => {
                makeDropTarget(el, "button", {
                  onDragOver: () => row.classList.add("drag-target"),
                  onDragLeave: () => row.classList.remove("drag-target"),
                  onDrop: ({ fromPageId, fromContainerId, nodeId }) => {
                    row.classList.remove("drag-target");
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
              };
              attachDrop(row);
              attachDrop(labelButton);
            }
            if (canDropOn("container", "container")) {
              const attachDrop = (el) => {
                makeDropTarget(el, "container", {
                  onDragOver: () => row.classList.add("drag-target"),
                  onDragLeave: () => row.classList.remove("drag-target"),
                  onDrop: ({ fromPageId, nodeId }) => {
                    row.classList.remove("drag-target");
                    if (nodeId === node.containerId && fromPageId === node.pageId) return;
                    moveContainerToContainer(nodeId, fromPageId, node.containerId, node.pageId);
                  },
                });
              };
              attachDrop(row);
              attachDrop(labelButton);
            }
          },
          renderChildren: (node, item) => {
            if (!state.expandedContainers.includes(node.containerId)) return;
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
            if (canDropOn("container", "container")) {
              makeDropTarget(children, "container", {
                onDrop: ({ fromPageId, nodeId }) => {
                  if (nodeId === node.containerId && fromPageId === node.pageId) return;
                  moveContainerToContainer(nodeId, fromPageId, node.containerId, node.pageId);
                },
              });
            }
            const containerChildren = node.children.filter((child) => child.type === "container");
            const otherChildren = node.children.filter((child) => child.type !== "container");
            containerChildren.forEach((child, index) => {
              makeContainerDropBar(children, node.pageId, node.containerId, index);
              renderNode(child, children);
            });
            if (containerChildren.length) {
              makeContainerDropBar(
                children,
                node.pageId,
                node.containerId,
                containerChildren.length
              );
            }
            otherChildren.forEach((child) => renderNode(child, children));
            if (children.children.length) {
              item.appendChild(children);
            }
          },
        },
        button: {
          renderActions: (node, actions, row, labelButton) => {
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
              setTimeout(() => {
                state.dragPayload = null;
              }, 200);
            };
            row.addEventListener("dragstart", onDragStart);
            row.addEventListener("dragend", clearDrag);
            labelButton.addEventListener("dragstart", onDragStart);
            labelButton.addEventListener("dragend", clearDrag);
            if (actionsDef.remove) {
              actions.appendChild(
                makeAction("button", "remove", "tree-remove", "−", "Remove button", () => {
                  const container = getContainerById(node.containerId, node.pageId);
                  if (!container) return;
                  const button = container.buttons.find((item) => item.id === node.buttonId);
                  const ok = window.confirm(`Delete button "${button ? button.label : "Button"}"?`);
                  if (!ok) return;
                  container.buttons = container.buttons.filter((item) => item.id !== node.buttonId);
                  state.selectedNode = {
                    type: "container",
                    nodeId: node.containerId,
                  };
                  canvasUI.renderCanvas();
                  renderList();
                  renderTree();
                  setDirty(true);
                })
              );
            }
            if (canDropOn("button", "button")) {
              const attachDrop = (el) => {
                makeDropTarget(el, "button", {
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
                    moveButtonToContainer(
                      nodeId,
                      fromContainerId,
                      node.containerId,
                      fromPageId,
                      node.pageId
                    );
                  },
                });
              };
              attachDrop(labelButton);
              attachDrop(row);
            }
          },
        },
      };

      const renderNode = (node, parentUl) => {
        const handler = nodeHandlers[node.type];
        if (!handler) return;
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
        handler.renderActions(node, actions, row, labelButton);

        row.appendChild(actions);
        item.appendChild(row);
        parentUl.appendChild(item);

        if (typeof handler.renderChildren === "function") {
          handler.renderChildren(node, item);
        }
      };

      const model = TreeModel.buildTreeModel(state);
      renderNode(model, treeList);
    }

    return { renderTree };
  }

  window.TreeUI = createTreeUI;
})();
