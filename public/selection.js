(() => {
  function createSelection(ctx) {
    const {
      state,
      renderList,
      renderTree,
      renderPagesSelect,
      applyCurrentPageBackground,
      getCanvasUI,
    } = ctx;

    const getCanvas = () => (typeof getCanvasUI === "function" ? getCanvasUI() : null);

    const applySelection = (node) => {
      if (!node || !node.type) return;
      if (node.type === "website") {
        state.selectedNode = {
          type: "website",
          nodeId: "website",
        };
        if (typeof renderList === "function") renderList();
        if (typeof renderTree === "function") renderTree();
        return;
      }
      if (node.type === "page") {
        state.currentPageId = node.pageId;
        state.selectedNode = {
          type: "page",
          nodeId: node.pageId || node.id || null,
        };
        if (typeof renderPagesSelect === "function") renderPagesSelect();
        if (getCanvas()) getCanvas().renderCanvas();
        if (typeof renderList === "function") renderList();
        if (typeof renderTree === "function") renderTree();
        if (typeof applyCurrentPageBackground === "function") applyCurrentPageBackground();
        return;
      }
      if (node.type === "container") {
        if (node.pageId) state.currentPageId = node.pageId;
        state.selectedNode = {
          type: "container",
          nodeId: node.containerId || node.id || null,
        };
        if (getCanvas()) getCanvas().renderCanvas();
        if (typeof renderList === "function") renderList();
        if (typeof renderTree === "function") renderTree();
        return;
      }
      if (node.type === "button") {
        if (node.pageId) state.currentPageId = node.pageId;
        state.selectedNode = {
          type: "button",
          nodeId: node.buttonId || node.id || null,
        };
        if (getCanvas()) getCanvas().renderCanvas();
        if (typeof renderList === "function") renderList();
        if (typeof renderTree === "function") renderTree();
      }
    };

    return { applySelection };
  }

  window.Selection = { createSelection };
})();
