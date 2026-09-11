// Before installing: set the @match line below to your own TANSS ticket
// system URL. Examples:
//   // @match     https://ticket.example.com/*
//   // @match     https://tanss.mycompany.de/*
// Multiple @match lines are allowed if you use several TANSS instances.

// ==UserScript==
// @name         tanss-checklist-rightside
// @namespace    https://github.com/compositiv/tanss-tools
// @version      2026-09-11.12-00
// @updateURL    https://raw.githubusercontent.com/compositiv/tanss-tools/main/tampermonkey/tanss-checklist-rightside.user.js
// @downloadURL  https://raw.githubusercontent.com/compositiv/tanss-tools/main/tampermonkey/tanss-checklist-rightside.user.js
// @homepageURL  https://github.com/compositiv/tanss-tools
// @supportURL   https://github.com/compositiv/tanss-tools/issues
// @description  Verschiebt TANSS-Checklisten in eine fixierte, resizebare Seitenleiste rechts und macht das Ticket links unabhaengig scrollbar
// @match        https://your-tanss-host.example.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const SIDEBAR_ID = "tcr-sidebar";
  const TOGGLE_BTN_ID = "tcr-toggle";
  const RESIZER_ID = "tcr-resizer";
  const EMPTY_MSG_ID = "tcr-empty";
  const BACKDROP_ID = "tcr-popup-backdrop";

  const CHECKLIST_SELECTOR = ".tns-checklist-container";
  const OPEN_CHECKLIST_SELECTOR =
    ".tns-checklist-container:not(.checklist-completed)";

  const POPUP_SELECTORS = [
    ".tns-ticket-texts-editor.lt-hover-container",
    ".tns-picker-quick-edit.lt-hover-container"
  ];

  const LS_WIDTH = "tcr.width";

  const MIN_WIDTH = 280;
  const MAX_WIDTH = 1200;
  const DEFAULT_WIDTH = 420;
  const COLLAPSED_WIDTH = 28;

  GM_addStyle(`
    body.tcr-active {
      --tcr-width: ${DEFAULT_WIDTH}px;
    }

    body.tcr-active #v4_overallContainer {
      padding-right: var(--tcr-width);
      box-sizing: border-box;
      transition: padding-right 0.12s ease;
    }

    body.tcr-active.tcr-collapsed #v4_overallContainer {
      padding-right: ${COLLAPSED_WIDTH}px;
    }

    /* Sidebar */
    #${SIDEBAR_ID} {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: var(--tcr-width, ${DEFAULT_WIDTH}px);
      display: none;
      flex-direction: column;
      background: var(--tns-color-white, #fff);
      border-left: 1px solid var(--tns-color-grey-1, #ccc);
      box-shadow: -2px 0 6px rgba(0, 0, 0, 0.08);
      font-family: Inter, sans-serif;
      transition: width 0.12s ease;
      z-index: 10002;
      pointer-events: auto;
    }

    body.tcr-active #${SIDEBAR_ID} {
      display: flex;
    }

    #${SIDEBAR_ID}:hover {
      z-index: 10005;
    }

    body.tcr-collapsed #${SIDEBAR_ID} {
      width: ${COLLAPSED_WIDTH}px;
    }

    #${SIDEBAR_ID} .tcr-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      padding: 6px 10px;
      background: #2a354b;
      color: #fff;
      border-bottom: 1px solid var(--tns-color-grey-1, #ccc);
      font-size: 12px;
      font-weight: 600;
      user-select: none;
    }

    body.tcr-collapsed #${SIDEBAR_ID} .tcr-header {
      justify-content: center;
      padding: 6px 2px;
    }

    body.tcr-collapsed #${SIDEBAR_ID} .tcr-title {
      display: none;
    }

    #${TOGGLE_BTN_ID} {
      padding: 1px 7px;
      background: var(--tns-color-white, #fff);
      color: inherit;
      border: 1px solid var(--tns-color-grey-1, #ccc);
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
    }

    #${TOGGLE_BTN_ID}:hover {
      background: var(--tns-color-grey-1, #ddd);
    }

    #${SIDEBAR_ID} .tcr-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    body.tcr-collapsed #${SIDEBAR_ID} .tcr-content {
      display: none;
    }

    #${EMPTY_MSG_ID} {
      padding: 14px 8px;
      color: var(--tns-color-grey-1, #888);
      font-size: 12px;
      font-style: italic;
      text-align: center;
    }

    /* Resize */
    #${RESIZER_ID} {
      position: absolute;
      top: 0;
      bottom: 0;
      left: -2px;
      width: 6px;
      background: transparent;
      cursor: ew-resize;
      z-index: 1;
    }

    #${RESIZER_ID}:hover,
    #${RESIZER_ID}.tcr-resizing {
      background: var(--tns-color-blue-1, #4a90e2);
      opacity: 0.6;
    }

    body.tcr-collapsed #${RESIZER_ID} {
      display: none;
    }

    body.tcr-resizing,
    body.tcr-resizing * {
      cursor: ew-resize !important;
      user-select: none !important;
    }

    body.tcr-resizing #${SIDEBAR_ID},
    body.tcr-resizing #v4_overallContainer {
      transition: none !important;
    }

    /* Backdrop */
    #${BACKDROP_ID} {
      position: fixed;
      inset: 0;
      display: none;
      background-color: color-mix(
        in srgb,
        var(--tns-color-black) 10%,
        transparent
      ) !important;
      z-index: 10001;
      pointer-events: auto;
    }

    #${BACKDROP_ID}.tcr-visible {
      display: block;
    }

    /* Popup: nur die bekannten Checklisten-Quick-Edit-Popups anheben. */
    /* .lt-hover-container/.lt-container sind generische TANSS-Klassen, die */
    /* auch fuer fachfremde Hover-Tooltips verwendet werden (z.B. den Chat- */
    /* Ungelesen-Hinweis) - daher hier bewusst nicht pauschal, sondern ueber */
    /* die konkreten POPUP_SELECTORS angesprochen. */
    ${POPUP_SELECTORS.join(",\n    ")} {
      z-index: 10003 !important;
      pointer-events: none !important;
    }

    ${POPUP_SELECTORS.map((s) => `${s} > .lt-container`).join(",\n    ")} {
      pointer-events: auto !important;
    }

    .tns-date-picker-popup {
      z-index: 10004 !important;
      pointer-events: auto !important;
    }
  `);

  let sidebar = null;
  let content = null;
  let emptyMsg = null;
  let backdrop = null;

  let lastUrl = "";
  let userToggledThisTicket = false;
  let lastChecklistState = "";

  function isTicketView() {
    const params = new URLSearchParams(location.search);

    return (
      params.get("section") === "bug" &&
      params.get("sub") === "view" &&
      params.has("bugID")
    );
  }

  function applyStoredWidth() {
    const stored = parseInt(localStorage.getItem(LS_WIDTH), 10);

    const width =
      stored >= MIN_WIDTH && stored <= MAX_WIDTH
        ? stored
        : DEFAULT_WIDTH;

    document.body.style.setProperty("--tcr-width", width + "px");
  }

  function updateToggleIcon() {
    const button = document.getElementById(TOGGLE_BTN_ID);

    if (!button) {
      return;
    }

    const collapsed =
      document.body.classList.contains("tcr-collapsed");

    button.textContent = collapsed ? "‹" : "›";
    button.title = collapsed
      ? "Checklisten einblenden"
      : "Checklisten ausblenden";
  }

  function toggleCollapsed() {
    userToggledThisTicket = true;

    document.body.classList.toggle("tcr-collapsed");
    updateToggleIcon();
  }

  function setupResize(handle) {
    let startX = 0;
    let startWidth = 0;

    function onMove(event) {
      const delta = startX - event.clientX;

      const nextWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth + delta)
      );

      document.body.style.setProperty(
        "--tcr-width",
        nextWidth + "px"
      );
    }

    function onUp() {
      handle.classList.remove("tcr-resizing");
      document.body.classList.remove("tcr-resizing");

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      const currentWidth = getComputedStyle(document.body)
        .getPropertyValue("--tcr-width");

      const parsedWidth = parseInt(currentWidth, 10);

      if (parsedWidth) {
        localStorage.setItem(LS_WIDTH, String(parsedWidth));
      }
    }

    handle.addEventListener("mousedown", function (event) {
      if (document.body.classList.contains("tcr-collapsed")) {
        return;
      }

      event.preventDefault();

      handle.classList.add("tcr-resizing");
      document.body.classList.add("tcr-resizing");

      startX = event.clientX;

      const currentWidth = getComputedStyle(document.body)
        .getPropertyValue("--tcr-width");

      startWidth =
        parseInt(currentWidth, 10) || DEFAULT_WIDTH;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function buildBackdrop() {
    backdrop = document.getElementById(BACKDROP_ID);

    if (backdrop) {
      return;
    }

    backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.setAttribute("aria-hidden", "true");

    document.body.appendChild(backdrop);
  }

  function buildSidebar() {
    sidebar = document.getElementById(SIDEBAR_ID);

    if (sidebar) {
      content = sidebar.querySelector(".tcr-content");
      emptyMsg = document.getElementById(EMPTY_MSG_ID);
      return;
    }

    sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;

    const resizer = document.createElement("div");
    resizer.id = RESIZER_ID;

    const header = document.createElement("div");
    header.className = "tcr-header";

    const title = document.createElement("span");
    title.className = "tcr-title";
    title.textContent = "Checklisten";

    const toggleButton = document.createElement("button");
    toggleButton.id = TOGGLE_BTN_ID;
    toggleButton.type = "button";
    toggleButton.addEventListener("click", toggleCollapsed);

    header.appendChild(title);
    header.appendChild(toggleButton);

    content = document.createElement("div");
    content.className = "tcr-content";

    emptyMsg = document.createElement("div");
    emptyMsg.id = EMPTY_MSG_ID;
    emptyMsg.textContent =
      "Keine Checkliste in diesem Ticket.";

    content.appendChild(emptyMsg);

    sidebar.appendChild(resizer);
    sidebar.appendChild(header);
    sidebar.appendChild(content);

    document.body.appendChild(sidebar);

    setupResize(resizer);
    applyStoredWidth();
    updateToggleIcon();
  }

  function isElementVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function isWantedPopupOpen() {
    return POPUP_SELECTORS.some((selector) => {
      return Array.from(
        document.querySelectorAll(selector)
      ).some(isElementVisible);
    });
  }

  function updateBackdrop() {
    buildBackdrop();

    backdrop.classList.toggle(
      "tcr-visible",
      isWantedPopupOpen()
    );
  }

  function updateChecklistState() {
    if (!content || !emptyMsg) {
      return;
    }

    const allChecklists =
      content.querySelectorAll(CHECKLIST_SELECTOR);

    const openChecklists =
      content.querySelectorAll(OPEN_CHECKLIST_SELECTOR);

    const state =
      allChecklists.length === 0
        ? "empty"
        : openChecklists.length > 0
          ? "open"
          : "completed";

    emptyMsg.style.display =
      state === "empty" ? "" : "none";

    if (state === lastChecklistState) {
      return;
    }

    lastChecklistState = state;

    if (state === "empty") {
      if (!userToggledThisTicket) {
        document.body.classList.add("tcr-collapsed");
      }
    } else if (state === "open") {
      document.body.classList.remove("tcr-collapsed");
      userToggledThisTicket = false;
    } else if (
      state === "completed" &&
      !userToggledThisTicket
    ) {
      document.body.classList.add("tcr-collapsed");
    }

    updateToggleIcon();
  }

  function moveChecklists() {
    if (!content || !sidebar) {
      return;
    }

    document
      .querySelectorAll(CHECKLIST_SELECTOR)
      .forEach((checklist) => {
        if (!sidebar.contains(checklist)) {
          content.appendChild(checklist);
        }
      });

    updateChecklistState();
  }

  function clearSidebar() {
    if (!content) {
      return;
    }

    content
      .querySelectorAll(CHECKLIST_SELECTOR)
      .forEach((element) => element.remove());

    lastChecklistState = "";
    updateChecklistState();
  }

  function update() {
    buildBackdrop();

    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearSidebar();
      userToggledThisTicket = false;
      lastChecklistState = "";
    }

    if (isTicketView()) {
      buildSidebar();
      document.body.classList.add("tcr-active");
      moveChecklists();
    } else {
      document.body.classList.remove(
        "tcr-active",
        "tcr-collapsed"
      );
    }

    updateBackdrop();
  }

  let scheduled = false;

  function scheduleUpdate() {
    if (scheduled) {
      return;
    }

    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }

  const observer = new MutationObserver((mutations) => {
    // Eigene Schreibzugriffe (Resize-Drag setzt bei jedem mousemove
    // --tcr-width auf body, Collapse-Toggle togglet body-Klassen, das
    // Backdrop togglet seine eigene Klasse) sollen sich nicht selbst
    // erneut ein update() ausloesen.
    const relevant = mutations.some(
      (m) =>
        m.type !== "attributes" ||
        (m.target !== document.body && m.target !== backdrop)
    );
    if (relevant) scheduleUpdate();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"]
  });

  update();
})();
