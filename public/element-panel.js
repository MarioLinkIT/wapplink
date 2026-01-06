(() => {
  function createElementPanel(ctx) {
    const {
      state,
      elementsList,
      elementsEmpty,
      getCurrentPage,
      getContainerById,
      getContainerParentId,
      getContainerParentRect,
      getContainerForButton,
      normalizeContainer,
      normalizeButton,
      createPosSizeField,
      scaleContainerChildren,
      canvasUI,
      setDirty,
      renderTree,
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
    } = ctx;

    function createStyleFields(target) {
      const row = document.createElement("div");
      row.className = "style-row";
      const makeColorField = (labelText, value, onChange) => {
        const field = document.createElement("label");
        field.className = "style-field";
        const label = document.createElement("span");
        label.className = "style-label";
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "color";
        input.className = "style-color";
        input.value = value;
        input.addEventListener("input", () => {
          onChange(input.value);
        });
        field.append(label, input);
        return field;
      };
      const makeSelectField = (labelText, value, onChange) => {
        const field = document.createElement("label");
        field.className = "style-field";
        const label = document.createElement("span");
        label.className = "style-label";
        label.textContent = labelText;
        const select = document.createElement("select");
        select.className = "style-select";
        select.innerHTML = `
          <option value="default">Default</option>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="none">None</option>
        `;
        select.value = value || "default";
        select.addEventListener("change", () => {
          onChange(select.value);
        });
        field.append(label, select);
        return field;
      };
      const makeNumberField = (labelText, value, onChange) => {
        const field = document.createElement("label");
        field.className = "style-field";
        const label = document.createElement("span");
        label.className = "style-label";
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "20";
        input.step = "1";
        input.className = "style-input";
        input.value = String(value);
        input.addEventListener("input", () => {
          const next = Number(input.value);
          onChange(Number.isFinite(next) ? next : null);
        });
        field.append(label, input);
        return field;
      };
      const onStyleChange = () => {
        canvasUI.renderCanvas();
        renderList();
        setDirty(true);
      };
      const bgValue =
        typeof target.bgColor === "string" && target.bgColor.trim()
          ? target.bgColor
          : DEFAULT_ELEMENT_BG;
      const borderColorValue =
        typeof target.borderColor === "string" && target.borderColor.trim()
          ? target.borderColor
          : DEFAULT_ELEMENT_BORDER;
      const borderStyleValue =
        typeof target.borderStyle === "string" && target.borderStyle.trim()
          ? target.borderStyle
          : "default";
      const borderWidthValue =
        typeof target.borderWidth === "number" && Number.isFinite(target.borderWidth)
          ? target.borderWidth
          : 1;
      row.append(
        makeColorField("BG", bgValue, (value) => {
          target.bgColor = value;
          onStyleChange();
        }),
        makeColorField("Border", borderColorValue, (value) => {
          target.borderColor = value;
          onStyleChange();
        }),
        makeSelectField("Style", borderStyleValue, (value) => {
          target.borderStyle = value === "default" ? "" : value;
          onStyleChange();
        }),
        makeNumberField("Width", borderWidthValue, (value) => {
          target.borderWidth = value;
          onStyleChange();
        })
      );
      return row;
    }

    function renderList() {
      elementsList.innerHTML = "";
      const page = getCurrentPage();
      if (!page) return;
      let container = null;
      let visibleButtons = [];
      if (state.selectedNode.type === "website") {
        container = null;
        visibleButtons = [];
      } else if (state.selectedNode.type === "page") {
        container = null;
        visibleButtons = [];
      } else if (state.selectedNode.type === "container") {
        container = getContainerById(state.selectedNode.nodeId);
        visibleButtons = [];
      } else if (state.selectedNode.type === "button") {
        const found = getContainerForButton(state.selectedNode.nodeId);
        container = found ? found.container : null;
        visibleButtons = found ? [found.button] : [];
      }
      if (container) {
        normalizeContainer(container, getContainerParentRect(container.id));
      }
      const hasWebsite = state.selectedNode.type === "website";
      const hasPage = state.selectedNode.type === "page" && Boolean(page);
      const hasContainer = Boolean(container);
      const hasContent = hasWebsite || hasPage || hasContainer || visibleButtons.length;
      elementsEmpty.style.display = hasContent ? "none" : "block";
      elementsList.style.display = hasContent ? "grid" : "none";
      if (state.selectedNode.type === "website") {
        const li = document.createElement("li");
        li.classList.add("website-properties");
        const header = document.createElement("div");
        header.className = "meta-row";
        const label = document.createElement("span");
        label.textContent = "Website";
        label.className = "editable-label";
        const meta = document.createElement("span");
        const pageCount = state.pages.length;
        const current = state.pages.find((item) => item.id === state.currentPageId);
        meta.textContent = `${pageCount} page${pageCount === 1 ? "" : "s"} · ${
          current ? current.name : "No page"
        }`;
        header.append(label, meta);
        li.appendChild(header);
        elementsList.appendChild(li);
      }
      if (state.selectedNode.type === "page" && page) {
        const li = document.createElement("li");
        li.classList.add("page-properties");
        const header = document.createElement("div");
        header.className = "meta-row";
        const label = document.createElement("span");
        label.textContent = page.name;
        label.className = "editable-label";
        label.title = "Rename page";
        label.addEventListener("click", () => {
          const next = window.prompt("Page name:", page.name);
          if (next && next.trim()) {
            const candidate = next.trim();
            const exists = state.pages.some(
              (item) => item.id !== page.id && item.name.toLowerCase() === candidate.toLowerCase()
            );
            if (exists) {
              window.alert("Page name already in use.");
              return;
            }
            page.name = candidate;
            renderPagesSelect();
            renderTree();
            renderList();
            setDirty(true);
          }
        });
        const meta = document.createElement("span");
        meta.textContent = `${page.containers.length} container${
          page.containers.length === 1 ? "" : "s"
        }`;
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "reset-btn";
        reset.textContent = "Reset";
        reset.addEventListener("click", () => {
          const saved = getSavedPage(page.id);
          if (!saved) return;
          page.name = saved.name || page.name;
          page.bg = typeof saved.bg === "string" ? saved.bg : page.bg;
          page.glow = typeof saved.glow === "string" ? saved.glow : page.glow;
          renderPagesSelect();
          renderTree();
          renderList();
          applyCurrentPageBackground();
          setDirty(true);
        });
        header.append(label, meta, reset);
        const colors = document.createElement("div");
        colors.className = "style-row";
        const bgField = document.createElement("label");
        bgField.className = "style-field";
        const bgLabel = document.createElement("span");
        bgLabel.className = "style-label";
        bgLabel.textContent = "BG";
        const bgInput = document.createElement("input");
        bgInput.type = "color";
        bgInput.className = "style-color";
        bgInput.value = page.bg || DEFAULT_PAGE_BG;
        bgInput.addEventListener("input", () => {
          page.bg = bgInput.value;
          applyCurrentPageBackground();
          setDirty(true);
        });
        bgField.append(bgLabel, bgInput);
        const glowField = document.createElement("label");
        glowField.className = "style-field";
        const glowLabel = document.createElement("span");
        glowLabel.className = "style-label";
        glowLabel.textContent = "Glow";
        const glowInput = document.createElement("input");
        glowInput.type = "color";
        glowInput.className = "style-color";
        glowInput.value = page.glow || DEFAULT_PAGE_GLOW;
        glowInput.addEventListener("input", () => {
          page.glow = glowInput.value;
          applyCurrentPageBackground();
          setDirty(true);
        });
        glowField.append(glowLabel, glowInput);
        colors.append(bgField, glowField);
        li.append(header, colors);
        elementsList.appendChild(li);
      }

      if (state.selectedNode.type === "container" && container) {
        normalizeContainer(container, getContainerParentRect(container.id));
        const li = document.createElement("li");
        li.classList.add("container-properties");
        const header = document.createElement("div");
        header.className = "meta-row";
        const label = document.createElement("span");
        label.textContent = container.name;
        label.className = "editable-label";
        label.title = "Rename container";
        label.addEventListener("click", () => {
          const next = window.prompt("Container name:", container.name);
          if (next && next.trim()) {
            container.name = next.trim();
            renderTree();
            renderList();
            setDirty(true);
          }
        });
        const meta = document.createElement("span");
        meta.textContent = `${container.buttons.length} button${
          container.buttons.length === 1 ? "" : "s"
        }`;
        const fields = document.createElement("div");
        fields.className = "action-row";

        const parentId = getContainerParentId(container.id);
        const parentContainer = parentId
          ? getContainerById(parentId)
          : null;
        const posSizeField = createPosSizeField({
          target: container,
          getParentRect: () =>
            parentContainer
              ? { width: parentContainer.width, height: parentContainer.height }
              : canvasUI.getPageSurfaceRect(),
          onResizeChildren: (oldWidth, oldHeight, newWidth, newHeight) => {
            scaleContainerChildren(container, oldWidth, oldHeight, newWidth, newHeight);
          },
          onRenderCanvas: canvasUI.renderCanvas,
          onRenderList: renderList,
          onDirty: setDirty,
        });

        const styleRow = createStyleFields(container);
        fields.append(posSizeField, styleRow);
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "reset-btn";
        reset.textContent = "Reset";
        reset.addEventListener("click", () => {
          const saved = getSavedContainer(container.id);
          if (!saved) return;
          const clone = JSON.parse(JSON.stringify(saved));
          container.name = clone.name || container.name;
          container.x = typeof clone.x === "number" ? clone.x : container.x;
          container.y = typeof clone.y === "number" ? clone.y : container.y;
          container.width = typeof clone.width === "number" ? clone.width : container.width;
          container.height = typeof clone.height === "number" ? clone.height : container.height;
          container.units = clone.units || container.units;
          container.bgColor =
            typeof clone.bgColor === "string" ? clone.bgColor : container.bgColor;
          container.borderColor =
            typeof clone.borderColor === "string" ? clone.borderColor : container.borderColor;
          container.borderStyle =
            typeof clone.borderStyle === "string" ? clone.borderStyle : container.borderStyle;
          container.borderWidth =
            typeof clone.borderWidth === "number" ? clone.borderWidth : container.borderWidth;
          container.buttons = Array.isArray(clone.buttons) ? clone.buttons : [];
          container.containers = Array.isArray(clone.containers) ? clone.containers : [];
          canvasUI.renderCanvas();
          renderList();
          renderTree();
          setDirty(true);
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-btn";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          const ok = window.confirm(`Delete container "${container.name}"?`);
          if (!ok) return;
          state.selectedNode = { type: "container", nodeId: container.id };
          removeCurrentContainer();
        });
        header.append(label, meta, reset, remove);
        li.append(header, fields);
        elementsList.appendChild(li);
      }

      visibleButtons.forEach((button) => {
        const li = document.createElement("li");
        const header = document.createElement("div");
        header.className = "meta-row";
        if (state.selectedNode.type === "button" && button.id === state.selectedNode.nodeId) {
          li.classList.add("selected");
        }
        const label = document.createElement("span");
        label.textContent = button.label;
        label.className = "editable-label";
        label.title = "Rename button";
        label.addEventListener("click", () => {
          const next = window.prompt("Button label:", button.label);
          if (next && next.trim()) {
            button.label = next.trim();
            canvasUI.renderCanvas();
            renderList();
            renderTree();
            setDirty(true);
          }
        });
        const meta = document.createElement("span");
        meta.textContent = `${Math.round(button.x)}, ${Math.round(button.y)}`;
        const styleRow = createStyleFields(button);
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "reset-btn";
        reset.textContent = "Reset";
        reset.addEventListener("click", () => {
          if (!container) return;
          const saved = getSavedButton(container.id, button.id);
          if (!saved) return;
          button.label = saved.label || button.label;
          button.x = typeof saved.x === "number" ? saved.x : button.x;
          button.y = typeof saved.y === "number" ? saved.y : button.y;
          button.width = typeof saved.width === "number" ? saved.width : button.width;
          button.height = typeof saved.height === "number" ? saved.height : button.height;
          button.units = saved.units || button.units;
          button.bgColor =
            typeof saved.bgColor === "string" ? saved.bgColor : button.bgColor;
          button.borderColor =
            typeof saved.borderColor === "string" ? saved.borderColor : button.borderColor;
          button.borderStyle =
            typeof saved.borderStyle === "string" ? saved.borderStyle : button.borderStyle;
          button.borderWidth =
            typeof saved.borderWidth === "number" ? saved.borderWidth : button.borderWidth;
          button.action = saved.action ? { ...saved.action } : button.action;
          canvasUI.renderCanvas();
          renderList();
          renderTree();
          setDirty(true);
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-btn";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          if (!container) return;
          const ok = window.confirm(`Delete button "${button.label}"?`);
          if (!ok) return;
          container.buttons = container.buttons.filter((item) => item.id !== button.id);
          if (
            state.selectedNode.type === "button" &&
            state.selectedNode.nodeId === button.id
          ) {
            state.selectedNode = { type: "container", nodeId: container.id };
          }
          canvasUI.renderCanvas();
          renderList();
          renderTree();
          setDirty(true);
        });
        header.append(label, meta, reset, remove);
        if (container) {
          normalizeButton(button);
        }
        const posSizeField =
          container &&
          createPosSizeField({
            target: button,
            getParentRect: () => ({ width: container.width, height: container.height }),
            onRenderCanvas: canvasUI.renderCanvas,
            onRenderList: renderList,
            onDirty: setDirty,
          });
        const actionRow = document.createElement("div");
        actionRow.className = "action-row";
        const actionSelect = document.createElement("select");
        actionSelect.className = "action-select";
        actionSelect.innerHTML = `
          <option value="none">No action</option>
          <option value="page">Switch page</option>
        `;
        const currentAction = button.action && button.action.type ? button.action.type : "none";
        actionSelect.value = currentAction;
        actionSelect.addEventListener("change", () => {
          const type = actionSelect.value;
          if (type === "page") {
            const fallback = state.pages.find((p) => p.id !== page.id) || state.pages[0];
            button.action = {
              type,
              pageId:
                (button.action && button.action.pageId) || (fallback && fallback.id) || page.id,
            };
          } else {
            button.action = { type: "none" };
          }
          renderList();
          renderTree();
          setDirty(true);
        });
        actionRow.appendChild(actionSelect);
        if (currentAction === "page") {
          const pageSelect = document.createElement("select");
          pageSelect.className = "action-select";
          state.pages.forEach((p) => {
            const option = document.createElement("option");
            option.value = p.id;
            option.textContent = p.name;
            pageSelect.appendChild(option);
          });
          pageSelect.value =
            button.action && button.action.pageId ? button.action.pageId : page.id;
          pageSelect.addEventListener("change", () => {
            button.action = { type: "page", pageId: pageSelect.value };
            setDirty(true);
          });
          actionRow.appendChild(pageSelect);
        }
        if (posSizeField) {
          li.append(header, posSizeField, styleRow, actionRow);
        } else {
          li.append(header, styleRow, actionRow);
        }
        elementsList.appendChild(li);
      });
    }

    return { renderList };
  }

  window.ElementPanel = createElementPanel;
})();
