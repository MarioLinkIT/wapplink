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
          pageId: null,
          containerId: null,
          buttonId: null,
        };
        if (typeof renderList === "function") renderList();
        if (typeof renderTree === "function") renderTree();
        return;
      }
      if (node.type === "page") {
        state.currentPageId = node.pageId;
        state.selectedNode = {
          type: "page",
          pageId: node.pageId,
          containerId: null,
          buttonId: null,
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
          pageId: node.pageId || null,
          containerId: node.containerId,
          buttonId: null,
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
          pageId: node.pageId || null,
          containerId: node.containerId,
          buttonId: node.buttonId,
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
