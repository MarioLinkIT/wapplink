(() => {
    function createCanvasUI(ctx) {
    const { state, canvas, toggleScale, Shared } = ctx;
    const clamp = ctx.clamp;
    const normalizeContainer = ctx.normalizeContainer;
    const normalizeButton = ctx.normalizeButton;

    const renderList = () => (typeof ctx.renderList === "function" ? ctx.renderList() : null);
    const renderTree = () => (typeof ctx.renderTree === "function" ? ctx.renderTree() : null);
    const setDirty = (value) =>
      typeof ctx.setDirty === "function" ? ctx.setDirty(value) : null;
    const getCurrentPage = () => (typeof ctx.getCurrentPage === "function" ? ctx.getCurrentPage() : null);
    const getContainerById = (id) =>
      typeof ctx.getContainerById === "function" ? ctx.getContainerById(id) : null;
    const HANDLE_RADIUS = 6;

    function getElementSize(target, element) {
      const width =
        typeof target.width === "number" && target.width > 0 ? target.width : element.offsetWidth;
      const height =
        typeof target.height === "number" && target.height > 0 ? target.height : element.offsetHeight;
      return { width: Math.max(1, width || 1), height: Math.max(1, height || 1) };
    }

    function getOriginOffsets(target, size) {
      const origin = target.origin || { x: 0, y: 0 };
      const offsetX = size.width * clamp(origin.x || 0, 0, 1);
      const offsetY = size.height * clamp(origin.y || 0, 0, 1);
      return { x: offsetX, y: offsetY };
    }

    function setElementPosition(target, element, sizeOverride) {
      const size = sizeOverride || getElementSize(target, element);
      const offsets = getOriginOffsets(target, size);
      element.style.left = `${Math.round(target.x - offsets.x)}px`;
      element.style.top = `${Math.round(target.y - offsets.y)}px`;
    }

    function attachElementMove({
      target,
      element,
      getParentRect,
      isActive,
      requireSelf,
      onMove,
    }) {
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;
      let lastPointerId = null;
      let isMouseDrag = false;

      const onPointerMove = (event) => {
        if (!isDragging) return;
        const rect = getParentRect();
        const size = getElementSize(target, element);
        const offsets = getOriginOffsets(target, size);
        const newDisplayX = clamp(
          event.clientX - rect.left - offsetX,
          0,
          rect.width - size.width
        );
        const newDisplayY = clamp(
          event.clientY - rect.top - offsetY,
          0,
          rect.height - size.height
        );
        target.x = Math.round(newDisplayX + offsets.x);
        target.y = Math.round(newDisplayY + offsets.y);
        setElementPosition(target, element, size);
        if (typeof onMove === "function") {
          onMove();
        }
        renderList();
        setDirty(true);
      };

      const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        if (isMouseDrag) {
          window.removeEventListener("mousemove", onPointerMove);
          window.removeEventListener("mouseup", stopDrag);
          isMouseDrag = false;
          if (element.__refreshAfterDrag) {
            element.__refreshAfterDrag = false;
            renderCanvas();
          }
          return;
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", stopDrag);
        element.releasePointerCapture?.(lastPointerId);
        if (element.__refreshAfterDrag) {
          element.__refreshAfterDrag = false;
          renderCanvas();
        }
      };

      const startDrag = (event, mode) => {
        if (isDragging) return;
        if (typeof isActive === "function" && !isActive()) return;
        if (requireSelf && event.target !== element) return;
        if (mode === "mouse" && event.button !== 0) return;
        event.preventDefault();
        const rect = element.getBoundingClientRect();
        isDragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        if (mode === "mouse") {
          isMouseDrag = true;
          window.addEventListener("mousemove", onPointerMove);
          window.addEventListener("mouseup", stopDrag, { once: true });
          return;
        }
        lastPointerId = event.pointerId;
        element.setPointerCapture(event.pointerId);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopDrag, { once: true });
      };

      element.addEventListener("pointerdown", (event) => startDrag(event, "pointer"));
      element.addEventListener("mousedown", (event) => startDrag(event, "mouse"));
      return startDrag;
    }

    function attachElementResize({ target, handle, getParentRect, onResize }) {
      const onMove = (moveEvent) => {
        const rect = getParentRect();
        const size = {
          width: typeof target.width === "number" && target.width > 0 ? target.width : 1,
          height: typeof target.height === "number" && target.height > 0 ? target.height : 1,
        };
        const offsets = getOriginOffsets(target, size);
        const displayX = target.x - offsets.x;
        const displayY = target.y - offsets.y;
        const newWidth = clamp(
          moveEvent.clientX - rect.left - displayX,
          1,
          rect.width - displayX
        );
        const newHeight = clamp(
          moveEvent.clientY - rect.top - displayY,
          1,
          rect.height - displayY
        );
        onResize(Math.round(newWidth), Math.round(newHeight));
        renderList();
        setDirty(true);
      };

      const stopResize = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stopResize);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", stopResize);
      };

      const startResize = (event, mode) => {
        if (mode === "mouse" && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (mode === "mouse") {
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", stopResize, { once: true });
          return;
        }
        handle.setPointerCapture(event.pointerId);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", stopResize, { once: true });
      };

      handle.addEventListener("pointerdown", (event) => startResize(event, "pointer"));
      handle.addEventListener("mousedown", (event) => startResize(event, "mouse"));
    }

    function createButtonElement(
      button,
      containerId,
      containerElement,
      pageId,
      overlayEl,
      surfaceRect,
      parentRect
    ) {
      const element = Shared.createBaseButton(button);
      Shared.applyElementStyles(button, element);
      element.dataset.buttonId = button.id;
      element.dataset.containerId = containerId;
      if (pageId) {
        element.dataset.pageId = pageId;
      }
      setElementPosition(button, element);
      const isSelected = () =>
        state.selectedNode.type === "button" &&
        state.selectedNode.buttonId === button.id &&
        state.selectedNode.containerId === containerId;
      if (isSelected()) {
        element.classList.add("selected");
      }

      if (isSelected()) {
        const originHandle = document.createElement("div");
        originHandle.className = "canvas-handle origin";
        const resizeOverlay = document.createElement("div");
        resizeOverlay.className = "canvas-handle resize";
        let updateOverlay = null;
        if (overlayEl && surfaceRect && parentRect) {
          updateOverlay = () => {
            const size = getElementSize(button, element);
            const offsets = getOriginOffsets(button, size);
            const displayX = button.x - offsets.x;
            const displayY = button.y - offsets.y;
            const parentOffsetX = parentRect.left - surfaceRect.left;
            const parentOffsetY = parentRect.top - surfaceRect.top;
            originHandle.style.left = `${parentOffsetX + displayX + offsets.x - HANDLE_RADIUS}px`;
            originHandle.style.top = `${parentOffsetY + displayY + offsets.y - HANDLE_RADIUS}px`;
            resizeOverlay.style.left = `${parentOffsetX + displayX + size.width - HANDLE_RADIUS}px`;
            resizeOverlay.style.top = `${parentOffsetY + displayY + size.height - HANDLE_RADIUS}px`;
          };
          updateOverlay();
          element.__updateOverlay = updateOverlay;
          overlayEl.appendChild(originHandle);
          overlayEl.appendChild(resizeOverlay);
        }
        attachElementResize({
          target: button,
          handle: resizeOverlay,
          getParentRect: () => containerElement.getBoundingClientRect(),
          onResize: (newWidth, newHeight) => {
            button.width = newWidth;
            button.height = newHeight;
            Shared.applyButtonSize(button, element);
            setElementPosition(button, element, { width: newWidth, height: newHeight });
            if (typeof element.__updateOverlay === "function") {
              element.__updateOverlay();
            }
          },
        });
      }

      const startDrag = attachElementMove({
        target: button,
        element,
        getParentRect: () => containerElement.getBoundingClientRect(),
        isActive: isSelected,
        requireSelf: false,
        onMove: () => {
          if (typeof element.__updateOverlay === "function") {
            element.__updateOverlay();
          }
        },
      });
      element.__startDrag = (event) => startDrag(event, "mouse");
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        state.selectedNode = {
          type: "button",
          pageId: pageId || null,
          containerId,
          buttonId: button.id,
        };
        renderList();
        renderTree();
      });
      return element;
    }

    let pageSurfaceEl = null;
    let canvasOverlayEl = null;

    function getPageSurfaceRect() {
      if (pageSurfaceEl) {
        return pageSurfaceEl.getBoundingClientRect();
      }
      return canvas.getBoundingClientRect();
    }

    function renderCanvas() {
      canvas.innerHTML = "";
      const page = getCurrentPage();
      if (!page) return;
      pageSurfaceEl = document.createElement("div");
      pageSurfaceEl.className = "page-surface";
      canvas.appendChild(pageSurfaceEl);
      canvasOverlayEl = document.createElement("div");
      canvasOverlayEl.className = "canvas-overlay";
      canvas.appendChild(canvasOverlayEl);
      const rootRect = getPageSurfaceRect();
      if (canvasOverlayEl && rootRect) {
        const canvasRect = canvas.getBoundingClientRect();
        canvasOverlayEl.style.left = `${rootRect.left - canvasRect.left}px`;
        canvasOverlayEl.style.top = `${rootRect.top - canvasRect.top}px`;
        canvasOverlayEl.style.width = `${rootRect.width}px`;
        canvasOverlayEl.style.height = `${rootRect.height}px`;
      }
      const selectedContainerId = state.selectedNode.containerId;
      const selectedButtonId = state.selectedNode.buttonId;
      const hasSelection =
        state.selectedNode.type === "button" || state.selectedNode.type === "container";
      const containerHasDescendant = (container, targetId) => {
        if (!Array.isArray(container.containers) || !container.containers.length) return false;
        return container.containers.some(
          (child) => child.id === targetId || containerHasDescendant(child, targetId)
        );
      };
      const containerHasButton = (container, buttonId) =>
        Array.isArray(container.buttons) &&
        container.buttons.some((button) => button.id === buttonId);
      const containerIsActive = (container) =>
        (selectedContainerId &&
          (container.id === selectedContainerId ||
            containerHasDescendant(container, selectedContainerId))) ||
        (selectedButtonId && containerHasButton(container, selectedButtonId));
      const renderContainer = (container, parentEl, parentRect) => {
        normalizeContainer(container, parentRect);
        const box = document.createElement("div");
        box.className = "container-box";
        const containerSize = { width: container.width, height: container.height };
        const containerOffsets = getOriginOffsets(container, containerSize);
        const displayX = container.x - containerOffsets.x;
        const displayY = container.y - containerOffsets.y;
        box.style.left = `${displayX}px`;
        box.style.top = `${displayY}px`;
        box.style.width = `${container.width}px`;
        box.style.height = `${container.height}px`;
        if (containerIsActive(container)) {
          box.style.pointerEvents = "auto";
        } else {
          box.style.pointerEvents = "none";
        }
        box.dataset.containerId = container.id;
        box.dataset.pageId = page.id;
        Shared.applyElementStyles(container, box);
        const isContainerSelected =
          state.selectedNode.type === "container" &&
          state.selectedNode.containerId === container.id;
        if (isContainerSelected) {
          box.classList.add("selected");
        const originHandle = document.createElement("div");
        originHandle.className = "canvas-handle origin";
        const resizeOverlay = document.createElement("div");
        resizeOverlay.className = "canvas-handle resize";
        if (canvasOverlayEl) {
            const updateOverlay = () => {
              const originOffsets = getOriginOffsets(container, {
                width: container.width,
                height: container.height,
              });
              const parentOffsetX = parentRect.left - rootRect.left;
              const parentOffsetY = parentRect.top - rootRect.top;
              const displayPosX = container.x - originOffsets.x;
              const displayPosY = container.y - originOffsets.y;
              originHandle.style.left = `${parentOffsetX + displayPosX + originOffsets.x - HANDLE_RADIUS}px`;
              originHandle.style.top = `${parentOffsetY + displayPosY + originOffsets.y - HANDLE_RADIUS}px`;
              resizeOverlay.style.left = `${parentOffsetX + displayPosX + container.width - HANDLE_RADIUS}px`;
              resizeOverlay.style.top = `${parentOffsetY + displayPosY + container.height - HANDLE_RADIUS}px`;
            };
            box.__updateOverlay = updateOverlay;
            updateOverlay();
            canvasOverlayEl.appendChild(originHandle);
            canvasOverlayEl.appendChild(resizeOverlay);
          }
          attachElementResize({
            target: container,
            handle: resizeOverlay,
            getParentRect: () => parentRect,
            onResize: (newWidth, newHeight) => {
              const oldWidth = container.width || 1;
              const oldHeight = container.height || 1;
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
              container.width = newWidth;
              container.height = newHeight;
              container.buttons.forEach((btn) => {
                btn.x = clamp(btn.x, 0, container.width - 1);
                btn.y = clamp(btn.y, 0, container.height - 1);
              });
              container.containers.forEach((child) => {
                child.x = clamp(child.x, 0, container.width - 1);
                child.y = clamp(child.y, 0, container.height - 1);
              });
              box.style.width = `${container.width}px`;
              box.style.height = `${container.height}px`;
              const newOffsets = getOriginOffsets(container, {
                width: container.width,
                height: container.height,
              });
              box.style.left = `${container.x - newOffsets.x}px`;
              box.style.top = `${container.y - newOffsets.y}px`;
              if (typeof box.__updateOverlay === "function") {
                box.__updateOverlay();
              }
            },
          });

          attachElementMove({
            target: container,
            element: box,
            getParentRect: () => parentRect,
            isActive: () =>
              state.selectedNode.type === "container" &&
              state.selectedNode.containerId === container.id,
            requireSelf: true,
            onMove: () => {
              if (typeof box.__updateOverlay === "function") {
                box.__updateOverlay();
              }
            },
          });
        }
        box.addEventListener("click", (event) => {
          if (event.target !== box) return;
          state.selectedNode = {
            type: "container",
            pageId: page.id,
            containerId: container.id,
            buttonId: null,
          };
          renderList();
          renderTree();
        });
        container.buttons.forEach((button) => {
          normalizeButton(button);
          const containerRect = {
            left: parentRect.left + displayX,
            top: parentRect.top + displayY,
            width: container.width,
            height: container.height,
          };
          const element = createButtonElement(
            button,
            container.id,
            box,
            page.id,
            canvasOverlayEl,
            rootRect,
            containerRect
          );
          box.appendChild(element);
        });
        if (Array.isArray(container.containers)) {
          const childRect = {
            left: parentRect.left + displayX,
            top: parentRect.top + displayY,
            width: container.width,
            height: container.height,
          };
          container.containers.forEach((child) => {
            renderContainer(child, box, childRect);
          });
        }
        parentEl.appendChild(box);
      };

      page.containers.forEach((container) => {
        renderContainer(container, pageSurfaceEl, rootRect);
      });
    }

    let hitSelectReady = false;
    const handleHitSelect = (event) => {
      if (event.button !== 0) return;
      if (!canvas.contains(event.target)) return;
      let buttonEl = null;
      if (typeof document.elementsFromPoint === "function") {
        const hits = document.elementsFromPoint(event.clientX, event.clientY);
        buttonEl = hits.find((el) => el.classList && el.classList.contains("canvas-button"));
      }
      if (!buttonEl) {
        const buttons = Array.from(canvas.querySelectorAll(".canvas-button"));
        for (let i = 0; i < buttons.length; i += 1) {
          const el = buttons[i];
          const rect = el.getBoundingClientRect();
          const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
          if (inside) {
            buttonEl = el;
          }
        }
      }
      if (!buttonEl) return;
      const buttonId = buttonEl.dataset.buttonId;
      const containerId = buttonEl.dataset.containerId;
      const pageId = buttonEl.dataset.pageId || null;
      if (!buttonId || !containerId) return;
      const alreadySelected =
        state.selectedNode.type === "button" &&
        state.selectedNode.buttonId === buttonId &&
        state.selectedNode.containerId === containerId;
      if (!alreadySelected) {
        canvas.querySelectorAll(".canvas-button.selected").forEach((el) => {
          el.classList.remove("selected");
        });
        canvas.querySelectorAll(".container-box.selected").forEach((el) => {
          el.classList.remove("selected");
        });
        buttonEl.classList.add("selected");
        state.selectedNode = {
          type: "button",
          pageId,
          containerId,
          buttonId,
        };
        renderList();
        renderTree();
      }
      event.preventDefault();
      event.stopPropagation();
      if (!alreadySelected) {
        buttonEl.__refreshAfterDrag = true;
      }
      if (typeof buttonEl.__startDrag === "function") {
        buttonEl.__startDrag(event);
      }
    };
    if (!hitSelectReady) {
      canvas.addEventListener("mousedown", handleHitSelect, true);
      hitSelectReady = true;
    }

    function applyCanvasMode() {
      const isFull = state.canvasMode === "full";
      document.body.classList.toggle("full-canvas", isFull);
      toggleScale.textContent = isFull ? "Fixed size" : "Full size";
    }

    function applyPageBackground(bg, glow) {
      Shared.applyPageBackground(bg, glow);
    }

    return {
      renderCanvas,
      createButtonElement,
      applyCanvasMode,
      applyPageBackground,
      getPageSurfaceRect,
    };
  }

  window.CanvasUI = createCanvasUI;
})();
