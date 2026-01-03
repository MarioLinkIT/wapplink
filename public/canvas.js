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

    function attachDrag(button, element, containerElement, isActive) {
      let isDragging = false;
      let offsetX = 0;
      let offsetY = 0;

      const onPointerMove = (event) => {
        if (!isDragging) return;
        const rect = containerElement.getBoundingClientRect();
        const newX = clamp(event.clientX - rect.left - offsetX, 0, rect.width - element.offsetWidth);
        const newY = clamp(event.clientY - rect.top - offsetY, 0, rect.height - element.offsetHeight);
        button.x = newX;
        button.y = newY;
        Shared.updateButtonPosition(button, element);
        renderList();
        setDirty(true);
      };

      const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", stopDrag);
      };

      element.addEventListener("pointerdown", (event) => {
        if (typeof isActive === "function" && !isActive()) return;
        const rect = element.getBoundingClientRect();
        isDragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        element.setPointerCapture(event.pointerId);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopDrag, { once: true });
      });
    }

    function createButtonElement(button, containerId, containerElement) {
      const element = Shared.createBaseButton(button);
      Shared.applyElementStyles(button, element);
      const isSelected =
        state.selectedNode.type === "button" &&
        state.selectedNode.buttonId === button.id &&
        state.selectedNode.containerId === containerId;
      if (
        state.selectedNode.type === "button" &&
        state.selectedNode.buttonId === button.id &&
        state.selectedNode.containerId === containerId
      ) {
        element.classList.add("selected");
      }

      if (isSelected) {
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "canvas-handle resize";
        element.appendChild(resizeHandle);
        resizeHandle.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          resizeHandle.setPointerCapture(event.pointerId);
          const onMove = (moveEvent) => {
            const rect = containerElement.getBoundingClientRect();
            const newWidth = clamp(
              moveEvent.clientX - rect.left - button.x,
              1,
              rect.width - button.x
            );
            const newHeight = clamp(
              moveEvent.clientY - rect.top - button.y,
              1,
              rect.height - button.y
            );
            button.width = Math.round(newWidth);
            button.height = Math.round(newHeight);
            Shared.applyButtonSize(button, element);
            renderList();
            setDirty(true);
          };
          const onUp = () => {
            resizeHandle.removeEventListener("pointermove", onMove);
            resizeHandle.removeEventListener("pointerup", onUp);
          };
          resizeHandle.addEventListener("pointermove", onMove);
          resizeHandle.addEventListener("pointerup", onUp, { once: true });
        });
      }

      attachDrag(button, element, containerElement, () => isSelected);
      return element;
    }

    let pageSurfaceEl = null;

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
      const rootRect = getPageSurfaceRect();
      const renderContainer = (container, parentEl, parentRect) => {
        normalizeContainer(container, parentRect);
        const box = document.createElement("div");
        box.className = "container-box";
        box.style.left = `${container.x}px`;
        box.style.top = `${container.y}px`;
        box.style.width = `${container.width}px`;
        box.style.height = `${container.height}px`;
        Shared.applyElementStyles(container, box);
        const isContainerSelected =
          state.selectedNode.type === "container" &&
          state.selectedNode.containerId === container.id;
        if (isContainerSelected) {
          box.classList.add("selected");
          const resizeHandle = document.createElement("div");
          resizeHandle.className = "canvas-handle resize";
          box.appendChild(resizeHandle);
          resizeHandle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            resizeHandle.setPointerCapture(event.pointerId);
            const onMove = (moveEvent) => {
              const canvasRect = parentRect;
              const oldWidth = container.width || 1;
              const oldHeight = container.height || 1;
              const newWidth = clamp(
                moveEvent.clientX - canvasRect.left - container.x,
                1,
                canvasRect.width - container.x
              );
              const newHeight = clamp(
                moveEvent.clientY - canvasRect.top - container.y,
                1,
                canvasRect.height - container.y
              );
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
              container.width = Math.round(newWidth);
              container.height = Math.round(newHeight);
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
              renderList();
              setDirty(true);
            };
            const onUp = () => {
              resizeHandle.removeEventListener("pointermove", onMove);
              resizeHandle.removeEventListener("pointerup", onUp);
            };
            resizeHandle.addEventListener("pointermove", onMove);
            resizeHandle.addEventListener("pointerup", onUp, { once: true });
          });

          box.addEventListener("pointerdown", (event) => {
            if (event.target !== box) return;
            event.preventDefault();
            box.setPointerCapture(event.pointerId);
            const offsetX = event.clientX - box.getBoundingClientRect().left;
            const offsetY = event.clientY - box.getBoundingClientRect().top;
            const onMove = (moveEvent) => {
              const canvasRect = parentRect;
              const newX = clamp(
                moveEvent.clientX - canvasRect.left - offsetX,
                0,
                canvasRect.width - container.width
              );
              const newY = clamp(
                moveEvent.clientY - canvasRect.top - offsetY,
                0,
                canvasRect.height - container.height
              );
              container.x = Math.round(newX);
              container.y = Math.round(newY);
              box.style.left = `${container.x}px`;
              box.style.top = `${container.y}px`;
              renderList();
              setDirty(true);
            };
            const onUp = () => {
              box.removeEventListener("pointermove", onMove);
              box.removeEventListener("pointerup", onUp);
            };
            box.addEventListener("pointermove", onMove);
            box.addEventListener("pointerup", onUp, { once: true });
          });
        }
        container.buttons.forEach((button) => {
          normalizeButton(button);
          const element = createButtonElement(button, container.id, box);
          box.appendChild(element);
        });
        if (Array.isArray(container.containers)) {
          const childRect = {
            left: parentRect.left + container.x,
            top: parentRect.top + container.y,
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
      attachDrag,
      applyCanvasMode,
      applyPageBackground,
      getPageSurfaceRect,
    };
  }

  window.CanvasUI = createCanvasUI;
})();
