(() => {
  const DEFAULT_CONFIG = {
    rootType: "website",
    types: {
      website: {
        label: "Website",
        role: "root",
        children: [{ type: "page", collection: "pages" }],
        actions: { add: ["page"] },
      },
      page: {
        labelField: "name",
        idField: "id",
        role: "branch",
        children: [{ type: "container", collection: "containers" }],
        actions: { add: ["container"], remove: true, star: true },
      },
      container: {
        labelField: "name",
        idField: "id",
        role: "branch",
        children: [
          { type: "container", collection: "containers" },
          { type: "button", collection: "buttons" },
        ],
        actions: { add: ["button", "container"], remove: true },
      },
      button: {
        labelField: "label",
        idField: "id",
        role: "leaf",
        draggable: true,
        actions: { remove: true },
      },
    },
    dragDrop: {
      button: {
        accept: ["container", "button"],
        reorderWithin: ["button"],
        moveInto: ["container"],
      },
    },
  };

  let config = DEFAULT_CONFIG;
  let isLoaded = false;
  let loadPromise = null;

  function loadConfig() {
    if (loadPromise) return loadPromise;
    loadPromise = fetch("/tree-node-types.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          config = data;
          isLoaded = true;
        }
      })
      .catch(() => {});
    return loadPromise;
  }

  function ensureConfig(onReady) {
    if (!isLoaded) {
      loadConfig().then(() => {
        if (typeof onReady === "function") onReady();
      });
    }
    return config;
  }

  function buildNodeFromItem(type, item, parent) {
    const typeDef = (config.types && config.types[type]) || {};
    const idField = typeDef.idField || "id";
    const labelField = typeDef.labelField;
    const id = item && item[idField] ? item[idField] : type;
    const label =
      labelField && item && item[labelField] ? item[labelField] : typeDef.label || type;
    const node = {
      type,
      id,
      label,
      pageId: parent ? parent.pageId : null,
      containerId: parent ? parent.containerId : null,
      buttonId: null,
      children: [],
    };
    if (type === "page") {
      node.pageId = id;
      node.containerId = null;
      node.buttonId = null;
    } else if (type === "container") {
      node.containerId = id;
      node.buttonId = null;
    } else if (type === "button") {
      node.buttonId = id;
    }
    return node;
  }

  function buildChildren(node, source, typeDef) {
    if (!typeDef.children || !Array.isArray(typeDef.children)) return;
    typeDef.children.forEach((childSpec) => {
      const collection = source && source[childSpec.collection];
      if (!Array.isArray(collection)) return;
      collection.forEach((item) => {
        const childNode = buildNodeFromItem(childSpec.type, item, node);
        const childDef = (config.types && config.types[childSpec.type]) || {};
        buildChildren(childNode, item, childDef);
        node.children.push(childNode);
      });
    });
  }

  function buildTreeModel(state) {
    const cfg = config;
    const rootType = cfg.rootType || "website";
    const rootDef = (cfg.types && cfg.types[rootType]) || {};
    const root = {
      type: rootType,
      id: rootType,
      label: rootDef.label || rootType,
      pageId: null,
      containerId: null,
      buttonId: null,
      children: [],
    };
    if (!state || !Array.isArray(state.pages)) return root;
    buildChildren(root, state, rootDef);
    return root;
  }

  window.TreeModel = {
    buildTreeModel,
    ensureConfig,
    getConfig: () => config,
    getTypeDef: (type) => (config.types && config.types[type] ? config.types[type] : {}),
    getActions: (type) => {
      const def = config.types && config.types[type] ? config.types[type] : {};
      return def.actions ? def.actions : {};
    },
    canDrag: (type) => {
      const def = config.types && config.types[type] ? config.types[type] : {};
      return Boolean(def.draggable);
    },
    canDropOn: (payloadType, targetType) => {
      const rules = config.dragDrop && config.dragDrop[payloadType];
      return Boolean(rules && Array.isArray(rules.accept) && rules.accept.includes(targetType));
    },
    canReorderOn: (payloadType, targetType) => {
      const rules = config.dragDrop && config.dragDrop[payloadType];
      return Boolean(
        rules && Array.isArray(rules.reorderWithin) && rules.reorderWithin.includes(targetType)
      );
    },
  };
})();
