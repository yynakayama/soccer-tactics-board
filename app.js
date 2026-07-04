const STORAGE_KEY = "soccer-board-state-v1";
const DEFAULT_FORMATION = "4-4-2";
const SVG_NS = "http://www.w3.org/2000/svg";
const DRAW_COLORS = {
  yellow: "#f5d90a",
  red: "#ef4444",
  blue: "#3b82f6",
  white: "#ffffff",
};
const MAX_STROKES = 300;
const MAX_STROKE_POINTS = 600;

// 戦術ガイドの形状（横表示の%座標）。既存CSSマーキングの近似値に揃える:
// PA幅 22-78%・PA奥行き 19% / 81%・ゴール 44-56%。
const GUIDE_PITCH = { min: 3.5, max: 96.5 };
const GUIDE_LANE_YS = [22, 40.67, 59.33, 78];
const GUIDE_BIELSA_LINES = [
  { from: { x: 3.5, y: 44 }, to: { x: 19, y: 22 } },
  { from: { x: 3.5, y: 56 }, to: { x: 19, y: 78 } },
  { from: { x: 96.5, y: 44 }, to: { x: 81, y: 22 } },
  { from: { x: 96.5, y: 56 }, to: { x: 81, y: 78 } },
];
const GUIDE_THIRDS = [
  { from: 3.5, to: 34.5, className: "guide-third defensive" },
  { from: 34.5, to: 65.5, className: "guide-third middle" },
  { from: 65.5, to: 96.5, className: "guide-third attacking" },
];
const GUIDE_THIRD_LINE_XS = [34.5, 65.5];

const FORMATIONS = {
  "4-4-2": [
    [8, 50],
    [24, 18],
    [24, 39],
    [24, 61],
    [24, 82],
    [46, 18],
    [46, 39],
    [46, 61],
    [46, 82],
    [72, 36],
    [72, 64],
  ],
  "4-3-3": [
    [8, 50],
    [24, 17],
    [24, 39],
    [24, 61],
    [24, 83],
    [47, 28],
    [43, 50],
    [47, 72],
    [73, 23],
    [76, 50],
    [73, 77],
  ],
  "4-2-3-1": [
    [8, 50],
    [24, 17],
    [24, 39],
    [24, 61],
    [24, 83],
    [42, 40],
    [42, 60],
    [60, 24],
    [62, 50],
    [60, 76],
    [76, 50],
  ],
  "3-5-2": [
    [8, 50],
    [25, 30],
    [23, 50],
    [25, 70],
    [45, 15],
    [43, 34],
    [45, 50],
    [43, 66],
    [45, 85],
    [72, 38],
    [72, 62],
  ],
};

const els = {
  formationSelect: document.querySelector("#formationSelect"),
  applyFormationBtn: document.querySelector("#applyFormationBtn"),
  toggleOrientationBtn: document.querySelector("#toggleOrientationBtn"),
  toggleLanesBtn: document.querySelector("#toggleLanesBtn"),
  toggleBielsaBtn: document.querySelector("#toggleBielsaBtn"),
  toggleThirdsBtn: document.querySelector("#toggleThirdsBtn"),
  resetBoardBtn: document.querySelector("#resetBoardBtn"),
  clearSelectionBtn: document.querySelector("#clearSelectionBtn"),
  sortRosterBtn: document.querySelector("#sortRosterBtn"),
  resetHomeBtn: document.querySelector("#resetHomeBtn"),
  resetOpponentsBtn: document.querySelector("#resetOpponentsBtn"),
  addPlayerForm: document.querySelector("#addPlayerForm"),
  newNumberInput: document.querySelector("#newNumberInput"),
  newNameInput: document.querySelector("#newNameInput"),
  boardNotes: document.querySelector("#boardNotes"),
  field: document.querySelector("#field"),
  playersLayer: document.querySelector("#playersLayer"),
  guidesLayer: document.querySelector("#guidesLayer"),
  drawLayer: document.querySelector("#drawLayer"),
  toolMoveBtn: document.querySelector("#toolMoveBtn"),
  toolPenBtn: document.querySelector("#toolPenBtn"),
  toolArrowBtn: document.querySelector("#toolArrowBtn"),
  colorSwatches: document.querySelectorAll(".color-swatch"),
  undoDrawBtn: document.querySelector("#undoDrawBtn"),
  clearDrawBtn: document.querySelector("#clearDrawBtn"),
  selectionPanel: document.querySelector("#selectionPanel"),
  substitutionPanel: document.querySelector("#substitutionPanel"),
  sentOffPanel: document.querySelector("#sentOffPanel"),
  homeRoster: document.querySelector("#homeRoster"),
  opponentRoster: document.querySelector("#opponentRoster"),
  homeFieldCount: document.querySelector("#homeFieldCount"),
  awayFieldCount: document.querySelector("#awayFieldCount"),
  homeSentOffBadge: document.querySelector("#homeSentOffBadge"),
  awaySentOffBadge: document.querySelector("#awaySentOffBadge"),
};

let state = {
  formation: DEFAULT_FORMATION,
  homePlayers: [],
  opponentPlayers: [],
  ball: createDefaultBall(),
  selected: null,
  notes: "",
  orientation: "horizontal",
  drawings: [],
  guides: { lanes: false, bielsa: false, thirds: false },
};

let activeDrag = null;
let activeRotate = null;
let activeStroke = null;
let drawTool = "move";
let drawColor = "yellow";

init();

function init() {
  loadState();
  bindEvents();
  renderAll();
}

function bindEvents() {
  els.formationSelect.addEventListener("change", () => {
    state.formation = getFormationValue();
    saveState();
  });

  els.applyFormationBtn.addEventListener("click", () => {
    state.formation = getFormationValue();
    applyFormationToHome();
    saveState();
    renderAll();
  });

  els.toggleOrientationBtn.addEventListener("click", () => {
    state.orientation = state.orientation === "vertical" ? "horizontal" : "vertical";
    saveState();
    renderAll();
  });

  els.toggleLanesBtn.addEventListener("click", () => toggleGuide("lanes"));
  els.toggleBielsaBtn.addEventListener("click", () => toggleGuide("bielsa"));
  els.toggleThirdsBtn.addEventListener("click", () => toggleGuide("thirds"));

  els.resetBoardBtn.addEventListener("click", () => {
    resetBoard();
  });

  els.clearSelectionBtn.addEventListener("click", clearSelection);

  els.sortRosterBtn.addEventListener("click", () => {
    state.homePlayers.sort(comparePlayersByNumber);
    saveState();
    renderAll();
  });

  els.resetHomeBtn.addEventListener("click", () => {
    const ok = window.confirm("味方の登録と配置を初期状態に戻しますか？");
    if (!ok) return;
    state.homePlayers = createDefaultHomePlayers();
    state.selected = null;
    saveState();
    renderAll();
  });

  els.resetOpponentsBtn.addEventListener("click", () => {
    state.opponentPlayers = createDefaultOpponents(state.formation);
    if (state.selected?.team === "away") state.selected = null;
    saveState();
    renderAll();
  });

  els.addPlayerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const number = sanitizeNumber(els.newNumberInput.value);
    const name = els.newNameInput.value.trim();
    if (!number && !name) return;

    state.homePlayers.push({
      id: makeId("home"),
      number,
      name,
      onField: false,
      x: 50,
      y: 50,
      dir: 0,
      sentOff: false,
    });

    els.newNumberInput.value = "";
    els.newNameInput.value = "";
    saveState();
    renderAll();
  });

  els.boardNotes.addEventListener("input", () => {
    state.notes = els.boardNotes.value;
    saveState();
  });

  els.toolMoveBtn.addEventListener("click", () => setDrawTool("move"));
  els.toolPenBtn.addEventListener("click", () => setDrawTool("pen"));
  els.toolArrowBtn.addEventListener("click", () => setDrawTool("arrow"));

  els.colorSwatches.forEach((swatch) => {
    swatch.addEventListener("click", () => setDrawColor(swatch.dataset.color));
  });

  els.undoDrawBtn.addEventListener("click", undoDrawing);

  els.clearDrawBtn.addEventListener("click", () => {
    if (!state.drawings.length) return;
    const ok = window.confirm("描いた線をすべて消しますか？");
    if (!ok) return;
    state.drawings = [];
    saveState();
    renderDrawings();
  });

  els.drawLayer.addEventListener("pointerdown", startDrawStroke);

  window.addEventListener("resize", renderDrawings);
  window.addEventListener("keydown", handleShortcut);
}

function loadState() {
  const fallback = {
    formation: DEFAULT_FORMATION,
    homePlayers: createDefaultHomePlayers(),
    notes: "",
  };

  let saved = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    saved = null;
  }

  const formation = FORMATIONS[saved?.formation] ? saved.formation : fallback.formation;
  state.formation = formation;
  state.homePlayers = Array.isArray(saved?.homePlayers)
    ? sanitizeHomePlayers(saved.homePlayers)
    : fallback.homePlayers;
  state.notes = typeof saved?.notes === "string" ? saved.notes : fallback.notes;
  state.opponentPlayers = Array.isArray(saved?.opponentPlayers)
    ? sanitizeOpponents(saved.opponentPlayers, formation)
    : createDefaultOpponents(formation);
  state.ball = sanitizeBall(saved?.ball);
  state.drawings = sanitizeDrawings(saved?.drawings);
  state.orientation = saved?.orientation === "vertical" ? "vertical" : "horizontal";
  state.guides = sanitizeGuides(saved?.guides);
  state.selected = null;

  if (!state.homePlayers.length) {
    state.homePlayers = fallback.homePlayers;
  }
  normalizeHomeFieldCount();
  fillMissingHomePositions();
}

function saveState() {
  const payload = {
    formation: state.formation,
    homePlayers: state.homePlayers,
    opponentPlayers: state.opponentPlayers,
    ball: state.ball,
    drawings: state.drawings,
    notes: state.notes,
    orientation: state.orientation,
    guides: state.guides,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // The board still works if local storage is blocked.
  }
}

function sanitizeHomePlayers(players) {
  return players
    .filter((player) => player && typeof player === "object")
    .map((player, index) => {
      const sentOff = Boolean(player.sentOff);
      return {
        id: String(player.id || makeId("home")),
        number: sanitizeNumber(player.number ?? String(index + 1)),
        name: String(player.name || "").slice(0, 16),
        onField: sentOff ? false : Boolean(player.onField),
        x: clamp(Number(player.x) || 50, 4, 96),
        y: clamp(Number(player.y) || 50, 6, 94),
        dir: normalizeDir(player.dir, 0),
        sentOff,
      };
    });
}

function createDefaultHomePlayers() {
  const positions = FORMATIONS[DEFAULT_FORMATION];
  return Array.from({ length: 18 }, (_, index) => {
    const isStarter = index < 11;
    const position = positions[index] || [50, 50];
    return {
      id: `home-${index + 1}`,
      number: String(index + 1),
      name: "",
      onField: isStarter,
      x: position[0],
      y: position[1],
      dir: 0,
      sentOff: false,
    };
  });
}

function createDefaultOpponents(formationName) {
  const positions = FORMATIONS[formationName] || FORMATIONS[DEFAULT_FORMATION];
  return positions.map(([x, y], index) => ({
    id: `away-${index + 1}`,
    number: String(index + 1),
    name: "",
    x: 100 - x,
    y,
    dir: 180,
    sentOff: false,
  }));
}

function sanitizeOpponents(players, formationName) {
  const positions = FORMATIONS[formationName] || FORMATIONS[DEFAULT_FORMATION];
  const valid = players.filter((player) => player && typeof player === "object");
  if (!valid.length) return createDefaultOpponents(formationName);

  return valid.map((player, index) => {
    const fallback = positions[index] || [50, 50];
    return {
      id: String(player.id || `away-${index + 1}`),
      number: sanitizeNumber(player.number ?? String(index + 1)),
      name: String(player.name || "").slice(0, 16),
      x: clamp(Number(player.x) || 100 - fallback[0], 4, 96),
      y: clamp(Number(player.y) || fallback[1], 6, 94),
      dir: normalizeDir(player.dir, 180),
      sentOff: Boolean(player.sentOff),
    };
  });
}

function createDefaultBall() {
  return { x: 50, y: 50 };
}

function sanitizeBall(ball) {
  return {
    x: clamp(Number(ball?.x) || 50, 2, 98),
    y: clamp(Number(ball?.y) || 50, 2, 98),
  };
}

function sanitizeGuides(guides) {
  return {
    lanes: guides?.lanes === true,
    bielsa: guides?.bielsa === true,
    thirds: guides?.thirds === true,
  };
}

function sanitizeDrawings(drawings) {
  if (!Array.isArray(drawings)) return [];
  return drawings
    .filter((stroke) => stroke && typeof stroke === "object")
    .filter((stroke) => (stroke.tool === "pen" || stroke.tool === "arrow") && Object.hasOwn(DRAW_COLORS, stroke.color))
    .map((stroke) => ({
      id: String(stroke.id || makeId("draw")),
      tool: stroke.tool,
      color: stroke.color,
      points: (Array.isArray(stroke.points) ? stroke.points : [])
        .slice(0, MAX_STROKE_POINTS)
        .map((point) => ({
          x: clamp(Number(point?.x) || 0, 0, 100),
          y: clamp(Number(point?.y) || 0, 0, 100),
        })),
    }))
    .filter((stroke) => stroke.points.length >= 2)
    .slice(0, MAX_STROKES);
}

function resetBoard() {
  state.formation = getFormationValue();
  state.homePlayers.forEach((player) => {
    player.sentOff = false;
  });
  state.opponentPlayers.forEach((player) => {
    player.sentOff = false;
  });
  normalizeHomeFieldCount();
  applyFormationToHome();
  applyFormationToOpponents();
  state.ball = createDefaultBall();
  state.drawings = [];
  state.selected = null;
  state.notes = "";
  saveState();
  renderAll();
}

function clearSelection() {
  state.selected = null;
  renderSelectionPanel();
  renderSubstitutionPanel();
  renderHomeRoster();
  renderOpponentRoster();
  syncSelectedTokens();
}

function normalizeHomeFieldCount() {
  const target = 11 - getHomeSentOffPlayers().length;
  const starters = state.homePlayers.filter((player) => player.onField && !player.sentOff);
  const bench = state.homePlayers.filter((player) => !player.onField && !player.sentOff);

  if (starters.length > target) {
    starters.slice(target).forEach((player) => {
      player.onField = false;
    });
  }

  while (state.homePlayers.filter((player) => player.onField).length < target && bench.length) {
    const next = bench.shift();
    next.onField = true;
  }
}

function fillMissingHomePositions() {
  const positions = FORMATIONS[state.formation] || FORMATIONS[DEFAULT_FORMATION];
  getHomeFieldPlayers().forEach((player, index) => {
    const fallback = positions[index] || [50, 50];
    player.x = clamp(Number(player.x) || fallback[0], 4, 96);
    player.y = clamp(Number(player.y) || fallback[1], 6, 94);
  });
}

function applyFormationToHome() {
  const positions = FORMATIONS[state.formation] || FORMATIONS[DEFAULT_FORMATION];
  getHomeFieldPlayers().forEach((player, index) => {
    const position = positions[index] || [50, 50];
    player.x = position[0];
    player.y = position[1];
    player.dir = 0;
  });
}

function applyFormationToOpponents() {
  const positions = FORMATIONS[state.formation] || FORMATIONS[DEFAULT_FORMATION];
  state.opponentPlayers.forEach((player, index) => {
    const position = positions[index] || [50, 50];
    player.x = 100 - position[0];
    player.y = position[1];
    player.dir = 180;
  });
}

function applyOrientation() {
  const vertical = state.orientation === "vertical";
  els.field.classList.toggle("vertical", vertical);
  els.toggleOrientationBtn.textContent = vertical ? "横表示" : "縦表示";
  els.toggleOrientationBtn.setAttribute("aria-pressed", String(vertical));
}

function toggleGuide(key) {
  state.guides[key] = !state.guides[key];
  saveState();
  renderAll();
}

function applyGuideButtons() {
  const buttons = [
    [els.toggleLanesBtn, state.guides.lanes],
    [els.toggleBielsaBtn, state.guides.bielsa],
    [els.toggleThirdsBtn, state.guides.thirds],
  ];
  buttons.forEach(([button, active]) => {
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderAll() {
  validateSelection();
  applyOrientation();
  applyGuideButtons();
  els.formationSelect.value = state.formation;
  els.boardNotes.value = state.notes;
  renderFieldPlayers();
  renderDrawings();
  renderGuides();
  renderCounts();
  renderSelectionPanel();
  renderSubstitutionPanel();
  renderSentOffPanel();
  renderHomeRoster();
  renderOpponentRoster();
}

function renderFieldPlayers() {
  els.playersLayer.replaceChildren();

  getHomeFieldPlayers().forEach((player) => {
    els.playersLayer.appendChild(createPlayerToken("home", player));
  });

  getActiveOpponents().forEach((player) => {
    els.playersLayer.appendChild(createPlayerToken("away", player));
  });

  els.playersLayer.appendChild(createBallToken());

  syncSelectedTokens();
}

function renderGuides() {
  const svg = els.guidesLayer;
  svg.replaceChildren();

  if (state.guides.thirds) {
    GUIDE_THIRDS.forEach((third) => {
      svg.appendChild(createGuideRect(third.from, third.to, third.className));
    });
    GUIDE_THIRD_LINE_XS.forEach((x) => {
      svg.appendChild(
        createGuideLine({ x, y: GUIDE_PITCH.min }, { x, y: GUIDE_PITCH.max }, "guide-third-line"),
      );
    });
  }

  if (state.guides.lanes) {
    GUIDE_LANE_YS.forEach((y) => {
      svg.appendChild(
        createGuideLine({ x: GUIDE_PITCH.min, y }, { x: GUIDE_PITCH.max, y }, "guide-lane"),
      );
    });
  }

  if (state.guides.bielsa) {
    GUIDE_BIELSA_LINES.forEach((line) => {
      svg.appendChild(createGuideLine(line.from, line.to, "guide-bielsa"));
    });
  }
}

function createGuideLine(from, to, className) {
  const a = toScreenPosition(from);
  const b = toScreenPosition(to);
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("x1", `${a.left}%`);
  line.setAttribute("y1", `${a.top}%`);
  line.setAttribute("x2", `${b.left}%`);
  line.setAttribute("y2", `${b.top}%`);
  line.setAttribute("class", className);
  return line;
}

function createGuideRect(fromX, toX, className) {
  const a = toScreenPosition({ x: fromX, y: GUIDE_PITCH.min });
  const b = toScreenPosition({ x: toX, y: GUIDE_PITCH.max });
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", `${Math.min(a.left, b.left)}%`);
  rect.setAttribute("y", `${Math.min(a.top, b.top)}%`);
  rect.setAttribute("width", `${Math.abs(b.left - a.left)}%`);
  rect.setAttribute("height", `${Math.abs(b.top - a.top)}%`);
  rect.setAttribute("class", className);
  return rect;
}

function renderDrawings() {
  const svg = els.drawLayer;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();
  state.drawings.forEach((stroke) => appendStrokeElements(svg, stroke, width, height));
  if (activeStroke && activeStroke.points.length >= 2) {
    appendStrokeElements(svg, activeStroke, width, height);
  }
}

function appendStrokeElements(svg, stroke, width, height) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", buildStrokePath(stroke.points, width, height));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", DRAW_COLORS[stroke.color]);
  path.setAttribute("stroke-width", "3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("opacity", "0.92");
  svg.appendChild(path);

  if (stroke.tool === "arrow" && stroke.points.length >= 2) {
    svg.appendChild(createArrowHead(stroke, width, height));
  }
}

function buildStrokePath(points, width, height) {
  return points
    .map((point, index) => {
      const pixel = strokePointToPixel(point, width, height);
      return `${index === 0 ? "M" : "L"}${pixel.x.toFixed(1)} ${pixel.y.toFixed(1)}`;
    })
    .join(" ");
}

function strokePointToPixel(point, width, height) {
  const position = toScreenPosition(point);
  return { x: (position.left / 100) * width, y: (position.top / 100) * height };
}

function createArrowHead(stroke, width, height) {
  const points = stroke.points;
  const tip = strokePointToPixel(points[points.length - 1], width, height);
  let baseIndex = points.length - 2;
  let base = strokePointToPixel(points[baseIndex], width, height);
  while (baseIndex > 0 && Math.hypot(tip.x - base.x, tip.y - base.y) < 6) {
    baseIndex -= 1;
    base = strokePointToPixel(points[baseIndex], width, height);
  }
  const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
  const size = 11;
  const spread = 0.5;
  const left = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute(
    "points",
    `${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${left.x.toFixed(1)},${left.y.toFixed(1)} ${right.x.toFixed(1)},${right.y.toFixed(1)}`,
  );
  polygon.setAttribute("fill", DRAW_COLORS[stroke.color]);
  polygon.setAttribute("opacity", "0.92");
  return polygon;
}

function createPlayerToken(team, player) {
  const token = document.createElement("button");
  token.type = "button";
  token.className = `player-token ${team}`;
  token.dataset.team = team;
  token.dataset.id = player.id;
  setTokenPosition(token, player);
  applyTokenDirection(token, player);
  token.setAttribute("aria-label", `${team === "home" ? "味方" : "相手"} ${displayNumber(player)}`);

  const number = document.createElement("span");
  number.className = "number";
  number.textContent = displayNumber(player);
  token.appendChild(number);

  if (player.name) {
    const tag = document.createElement("span");
    tag.className = "name-tag";
    tag.textContent = player.name;
    token.appendChild(tag);
  }

  const arc = document.createElement("span");
  arc.className = "dir-arc";
  token.appendChild(arc);

  const handle = document.createElement("span");
  handle.className = "dir-handle";
  handle.addEventListener("pointerdown", startRotate);
  token.appendChild(handle);

  token.addEventListener("pointerdown", startDrag);
  token.addEventListener("keydown", nudgeSelectedPlayer);
  return token;
}

function createBallToken() {
  const token = document.createElement("button");
  token.type = "button";
  token.className = "ball-token";
  token.dataset.team = "ball";
  token.dataset.id = "ball";
  setTokenPosition(token, state.ball);
  token.setAttribute("aria-label", "ボール");

  token.addEventListener("pointerdown", startDrag);
  token.addEventListener("keydown", nudgeSelectedPlayer);
  return token;
}

function startDrag(event) {
  if (event.button !== undefined && event.button > 0) return;
  if (activeDrag || activeRotate) return;
  event.preventDefault();

  const token = event.currentTarget;
  const team = token.dataset.team;
  const id = token.dataset.id;
  if (team !== "ball") selectPlayer(team, id);

  activeDrag = {
    team,
    id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  };

  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
}

function moveDrag(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  const player = findPlayer(activeDrag.team, activeDrag.id);
  if (!player) return;

  const rect = els.field.getBoundingClientRect();
  const fx = ((event.clientX - rect.left) / rect.width) * 100;
  const fy = ((event.clientY - rect.top) / rect.height) * 100;
  const data = fromScreenFraction(fx, fy);
  player.x = clampX(activeDrag.team, data.x);
  player.y = clampY(activeDrag.team, data.y);

  if (
    Math.abs(event.clientX - activeDrag.startX) > 2 ||
    Math.abs(event.clientY - activeDrag.startY) > 2
  ) {
    activeDrag.moved = true;
  }

  const token = findToken(activeDrag.team, activeDrag.id);
  if (token) {
    setTokenPosition(token, player);
    token.classList.add("dragging");
  }
}

function endDrag(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
  if (activeDrag.moved) {
    saveState();
  }
  activeDrag = null;
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  renderFieldPlayers();
}

function startRotate(event) {
  if (event.button !== undefined && event.button > 0) return;
  if (activeDrag || activeRotate) return;
  event.preventDefault();
  event.stopPropagation();

  const token = event.currentTarget.closest(".player-token");
  if (!token) return;
  selectPlayer(token.dataset.team, token.dataset.id);

  activeRotate = {
    team: token.dataset.team,
    id: token.dataset.id,
    pointerId: event.pointerId,
  };
  window.addEventListener("pointermove", moveRotate);
  window.addEventListener("pointerup", endRotate);
  window.addEventListener("pointercancel", endRotate);
}

function moveRotate(event) {
  if (!activeRotate || event.pointerId !== activeRotate.pointerId) return;
  const player = findPlayer(activeRotate.team, activeRotate.id);
  const token = findToken(activeRotate.team, activeRotate.id);
  const circle = token ? token.querySelector(".number") : null;
  if (!player || !token || !circle) return;

  const rect = circle.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const screenAngle =
    (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
  player.dir = fromScreenAngle(screenAngle);
  applyTokenDirection(token, player);
}

function endRotate(event) {
  if (!activeRotate || event.pointerId !== activeRotate.pointerId) return;
  saveState();
  activeRotate = null;
  window.removeEventListener("pointermove", moveRotate);
  window.removeEventListener("pointerup", endRotate);
  window.removeEventListener("pointercancel", endRotate);
}

function setDrawTool(tool) {
  drawTool = tool;
  els.toolMoveBtn.setAttribute("aria-pressed", String(tool === "move"));
  els.toolPenBtn.setAttribute("aria-pressed", String(tool === "pen"));
  els.toolArrowBtn.setAttribute("aria-pressed", String(tool === "arrow"));
  els.field.classList.toggle("draw-mode", tool !== "move");
}

function setDrawColor(color) {
  if (!Object.hasOwn(DRAW_COLORS, color)) return;
  drawColor = color;
  els.colorSwatches.forEach((swatch) => {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === color));
  });
}

function undoDrawing() {
  if (!state.drawings.length) return;
  state.drawings.pop();
  saveState();
  renderDrawings();
}

function handleShortcut(event) {
  if (event.isComposing) return;

  const target = event.target;
  const tag = target && target.tagName;
  const isTextField =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (target && target.isContentEditable);

  // Ctrl/Cmd+Z: 描画を1つ戻す（入力欄では標準のテキストundoに任せる）
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z"
  ) {
    if (isTextField) return;
    event.preventDefault();
    undoDrawing();
    return;
  }

  // 単キー系（修飾キーなしのみ、入力欄では無効）
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTextField) return;

  switch (event.key) {
    case "v":
    case "V":
      setDrawTool("move");
      break;
    case "p":
    case "P":
      setDrawTool("pen");
      break;
    case "a":
    case "A":
      setDrawTool("arrow");
      break;
    case "r":
    case "R":
      resetBoard();
      break;
    case "Escape":
      clearSelection();
      break;
    default:
      return;
  }
  event.preventDefault();
}

function startDrawStroke(event) {
  if (drawTool === "move") return;
  if (event.button !== undefined && event.button > 0) return;
  if (activeStroke || activeDrag || activeRotate) return;
  event.preventDefault();

  activeStroke = {
    id: makeId("draw"),
    tool: drawTool,
    color: drawColor,
    pointerId: event.pointerId,
    points: [drawPointFromEvent(event)],
  };
  els.drawLayer.setPointerCapture(event.pointerId);
  els.drawLayer.addEventListener("pointermove", moveDrawStroke);
  els.drawLayer.addEventListener("pointerup", endDrawStroke);
  els.drawLayer.addEventListener("pointercancel", endDrawStroke);
}

function moveDrawStroke(event) {
  if (!activeStroke || event.pointerId !== activeStroke.pointerId) return;
  if (activeStroke.points.length >= MAX_STROKE_POINTS) return;
  const point = drawPointFromEvent(event);
  const last = activeStroke.points[activeStroke.points.length - 1];
  if (Math.hypot(point.x - last.x, point.y - last.y) < 0.8) return;
  activeStroke.points.push(point);
  renderDrawings();
}

function endDrawStroke(event) {
  if (!activeStroke || event.pointerId !== activeStroke.pointerId) return;
  els.drawLayer.removeEventListener("pointermove", moveDrawStroke);
  els.drawLayer.removeEventListener("pointerup", endDrawStroke);
  els.drawLayer.removeEventListener("pointercancel", endDrawStroke);
  if (activeStroke.points.length >= 2 && state.drawings.length < MAX_STROKES) {
    state.drawings.push({
      id: activeStroke.id,
      tool: activeStroke.tool,
      color: activeStroke.color,
      points: activeStroke.points,
    });
    saveState();
  }
  activeStroke = null;
  renderDrawings();
}

function drawPointFromEvent(event) {
  const rect = els.drawLayer.getBoundingClientRect();
  const fx = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
  const fy = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
  const data = fromScreenFraction(fx, fy);
  return { x: clamp(data.x, 0, 100), y: clamp(data.y, 0, 100) };
}

function nudgeSelectedPlayer(event) {
  const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();

  const team = event.currentTarget.dataset.team;
  const id = event.currentTarget.dataset.id;
  const player = findPlayer(team, id);
  if (!player) return;

  if (team !== "ball") selectPlayer(team, id);
  const step = event.shiftKey ? 3 : 1;
  if (state.orientation === "vertical") {
    if (event.key === "ArrowUp") player.x += step;
    if (event.key === "ArrowDown") player.x -= step;
    if (event.key === "ArrowRight") player.y += step;
    if (event.key === "ArrowLeft") player.y -= step;
  } else {
    if (event.key === "ArrowUp") player.y -= step;
    if (event.key === "ArrowDown") player.y += step;
    if (event.key === "ArrowRight") player.x += step;
    if (event.key === "ArrowLeft") player.x -= step;
  }
  player.x = clampX(team, player.x);
  player.y = clampY(team, player.y);
  saveState();
  renderFieldPlayers();
}

function renderCounts() {
  els.homeFieldCount.textContent = String(getHomeFieldPlayers().length);
  els.awayFieldCount.textContent = String(getActiveOpponents().length);
  updateSentOffBadge(els.homeSentOffBadge, getHomeSentOffPlayers().length);
  updateSentOffBadge(els.awaySentOffBadge, getOpponentSentOffPlayers().length);
}

function updateSentOffBadge(el, count) {
  if (count > 0) {
    el.textContent = `🟥${count}`;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}

function renderSelectionPanel() {
  els.selectionPanel.replaceChildren();
  const selected = getSelectedPlayer();

  if (!selected) {
    els.selectionPanel.appendChild(emptyState("選択なし"));
    return;
  }

  const card = document.createElement("div");
  card.className = "selection-card";

  const meta = document.createElement("div");
  meta.className = "selection-meta";
  const pill = document.createElement("span");
  pill.className = `pill ${selected.team}`;
  pill.textContent = selected.team === "home" ? "味方" : "相手";
  const status = document.createElement("span");
  status.textContent =
    selected.team === "home" ? (selected.player.onField ? "ピッチ" : "控え") : "ピッチ";
  meta.append(pill, status);

  const grid = document.createElement("div");
  grid.className = "field-grid";

  const numberLabel = document.createElement("label");
  numberLabel.textContent = "背番号";
  const numberInput = document.createElement("input");
  numberInput.type = "text";
  numberInput.inputMode = "numeric";
  numberInput.maxLength = 3;
  numberInput.value = selected.player.number;
  numberLabel.appendChild(numberInput);

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "名前";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.maxLength = 16;
  nameInput.value = selected.player.name || "";
  nameLabel.appendChild(nameInput);

  grid.append(numberLabel, nameLabel);

  const refreshAfterEdit = () => {
    saveState();
    renderFieldPlayers();
    if (selected.team === "home") {
      renderHomeRoster();
      renderSubstitutionPanel();
    } else {
      renderOpponentRoster();
    }
  };

  numberInput.addEventListener("input", () => {
    numberInput.value = sanitizeNumber(numberInput.value);
    selected.player.number = numberInput.value;
    refreshAfterEdit();
  });

  nameInput.addEventListener("input", () => {
    selected.player.name = nameInput.value.slice(0, 16);
    refreshAfterEdit();
  });

  card.append(meta, grid);

  const canSendOff =
    selected.team === "away" || (selected.team === "home" && selected.player.onField);
  if (canSendOff) {
    const sendOffBtn = document.createElement("button");
    sendOffBtn.type = "button";
    sendOffBtn.className = "danger-button send-off-button";
    sendOffBtn.textContent = "退場させる";
    sendOffBtn.addEventListener("click", () => sendOffPlayer(selected.team, selected.player.id));
    card.appendChild(sendOffBtn);
  }

  els.selectionPanel.appendChild(card);
}

function renderSubstitutionPanel() {
  els.substitutionPanel.replaceChildren();
  const selected = getSelectedPlayer();

  if (!selected || selected.team !== "home") {
    els.substitutionPanel.appendChild(emptyState("味方選手を選択"));
    return;
  }

  if (selected.player.onField) {
    const bench = getHomeBenchPlayers();
    if (!bench.length) {
      els.substitutionPanel.appendChild(emptyState("控えなし"));
      return;
    }
    els.substitutionPanel.appendChild(createSubstitutionList(bench, (benchPlayer) => {
      swapHomePlayers(selected.player.id, benchPlayer.id);
    }));
    return;
  }

  const starters = getHomeFieldPlayers();
  if (!starters.length) {
    els.substitutionPanel.appendChild(emptyState("ピッチの選手なし"));
    return;
  }
  els.substitutionPanel.appendChild(createSubstitutionList(starters, (starter) => {
    swapHomePlayers(starter.id, selected.player.id);
  }));
}

function createSubstitutionList(players, onSwap) {
  const list = document.createElement("div");
  list.className = "roster-list";
  players.forEach((player) => {
    list.appendChild(createPlayerRow({
      player,
      team: "home",
      actions: [
        {
          label: "交代",
          className: "mini-button primary",
          onClick: () => onSwap(player),
        },
      ],
    }));
  });
  return list;
}

function renderSentOffPanel() {
  els.sentOffPanel.replaceChildren();
  const homeSentOff = getHomeSentOffPlayers();
  const awaySentOff = getOpponentSentOffPlayers();

  if (!homeSentOff.length && !awaySentOff.length) {
    els.sentOffPanel.appendChild(emptyState("退場者なし"));
    return;
  }

  const list = document.createElement("div");
  list.className = "roster-list";
  homeSentOff.forEach((player) => list.appendChild(createSentOffRow("home", player)));
  awaySentOff.forEach((player) => list.appendChild(createSentOffRow("away", player)));
  els.sentOffPanel.appendChild(list);
}

function createSentOffRow(team, player) {
  const row = document.createElement("div");
  row.className = "sent-off-row";

  const card = document.createElement("span");
  card.className = "red-card";
  card.setAttribute("aria-hidden", "true");

  const pill = document.createElement("span");
  pill.className = `pill ${team}`;
  pill.textContent = team === "home" ? "味方" : "相手";

  const badge = document.createElement("div");
  badge.className = `number-badge ${team}`;
  badge.textContent = displayNumber(player);

  const name = document.createElement("div");
  name.className = "player-name";
  const primary = document.createElement("strong");
  primary.textContent = team === "home" ? player.name || "名前未登録" : player.name || "相手";
  name.appendChild(primary);

  const actionWrap = document.createElement("div");
  actionWrap.className = "row-actions";
  const restoreBtn = document.createElement("button");
  restoreBtn.type = "button";
  restoreBtn.className = "mini-button primary";
  restoreBtn.textContent = "復帰";
  restoreBtn.addEventListener("click", () => restorePlayer(team, player.id));
  actionWrap.appendChild(restoreBtn);

  row.append(card, pill, badge, name, actionWrap);
  return row;
}

function renderHomeRoster() {
  els.homeRoster.replaceChildren();
  const fieldPlayers = getHomeFieldPlayers();
  const benchPlayers = getHomeBenchPlayers();
  els.homeRoster.appendChild(createRosterGroup(`ピッチ ${fieldPlayers.length}`, fieldPlayers));
  els.homeRoster.appendChild(createRosterGroup(`控え ${benchPlayers.length}`, benchPlayers));
}

function createRosterGroup(title, players) {
  const group = document.createElement("div");
  group.className = "roster-group";

  const heading = document.createElement("div");
  heading.className = "group-heading";
  heading.textContent = title;
  group.appendChild(heading);

  if (!players.length) {
    group.appendChild(emptyState("該当なし"));
    return group;
  }

  players.forEach((player) => {
    const actions = [
      {
        label: "選択",
        className: "mini-button",
        onClick: () => selectPlayer("home", player.id),
      },
    ];

    const selected = getSelectedPlayer();
    if (selected?.team === "home" && selected.player.onField && !player.onField) {
      actions.unshift({
        label: "交代",
        className: "mini-button primary",
        onClick: () => swapHomePlayers(selected.player.id, player.id),
      });
    }

    if (selected?.team === "home" && !selected.player.onField && player.onField) {
      actions.unshift({
        label: "交代",
        className: "mini-button primary",
        onClick: () => swapHomePlayers(player.id, selected.player.id),
      });
    }

    if (!player.onField) {
      actions.push({
        label: "削除",
        className: "mini-button danger",
        onClick: () => removeHomePlayer(player.id),
      });
    }

    group.appendChild(createPlayerRow({ player, team: "home", actions }));
  });

  return group;
}

function renderOpponentRoster() {
  els.opponentRoster.replaceChildren();
  getActiveOpponents().forEach((player) => {
    const row = document.createElement("div");
    row.className = "opponent-row";
    if (isSelected("away", player.id)) row.classList.add("selected");

    const focusAway = () => {
      state.selected = { team: "away", id: player.id };
      renderSelectionPanel();
      renderSubstitutionPanel();
      syncSelectedTokens();
    };

    const numberInput = document.createElement("input");
    numberInput.className = "opponent-input number";
    numberInput.type = "text";
    numberInput.inputMode = "numeric";
    numberInput.maxLength = 3;
    numberInput.value = player.number;
    numberInput.setAttribute("aria-label", "相手 背番号");
    numberInput.addEventListener("focus", focusAway);
    numberInput.addEventListener("input", () => {
      numberInput.value = sanitizeNumber(numberInput.value);
      player.number = numberInput.value;
      saveState();
      renderFieldPlayers();
      renderSelectionPanel();
    });

    const nameInput = document.createElement("input");
    nameInput.className = "opponent-input name";
    nameInput.type = "text";
    nameInput.maxLength = 16;
    nameInput.value = player.name || "";
    nameInput.placeholder = "名前";
    nameInput.setAttribute("aria-label", "相手 名前");
    nameInput.addEventListener("focus", focusAway);
    nameInput.addEventListener("input", () => {
      player.name = nameInput.value.slice(0, 16);
      saveState();
      renderFieldPlayers();
      renderSelectionPanel();
    });

    row.append(numberInput, nameInput);
    els.opponentRoster.appendChild(row);
  });
}

function createPlayerRow({ player, team, actions }) {
  const row = document.createElement("div");
  row.className = "player-row";
  if (isSelected(team, player.id)) row.classList.add("selected");

  const badge = document.createElement("div");
  badge.className = `number-badge ${team}`;
  badge.textContent = displayNumber(player);

  const name = document.createElement("div");
  name.className = "player-name";
  const primary = document.createElement("strong");
  primary.textContent = team === "home" ? player.name || "名前未登録" : "相手";
  const secondary = document.createElement("span");
  secondary.textContent = player.onField ? "ピッチ" : "控え";
  name.append(primary, secondary);

  const actionWrap = document.createElement("div");
  actionWrap.className = "row-actions";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = action.className;
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    actionWrap.appendChild(button);
  });

  row.append(badge, name, actionWrap);
  return row;
}

function swapHomePlayers(starterId, benchId) {
  const starter = state.homePlayers.find((player) => player.id === starterId);
  const bench = state.homePlayers.find((player) => player.id === benchId);
  if (!starter || !bench || !starter.onField || bench.onField || bench.sentOff) return;

  const position = [starter.x, starter.y];
  starter.onField = false;
  bench.onField = true;
  bench.x = position[0];
  bench.y = position[1];
  state.selected = { team: "home", id: bench.id };
  saveState();
  renderAll();
}

function sendOffPlayer(team, id) {
  const player = findPlayer(team, id);
  if (!player || player.sentOff) return;
  if (team === "home") {
    if (!player.onField) return;
    player.onField = false;
  }
  player.sentOff = true;
  state.selected = null;
  saveState();
  renderAll();
}

function restorePlayer(team, id) {
  const player = findPlayer(team, id);
  if (!player || !player.sentOff) return;
  player.sentOff = false;
  saveState();
  renderAll();
}

function removeHomePlayer(id) {
  const player = state.homePlayers.find((item) => item.id === id);
  if (!player || player.onField || player.sentOff) return;
  const label = player.name || `No.${displayNumber(player)}`;
  const ok = window.confirm(`${label}を削除しますか？`);
  if (!ok) return;

  state.homePlayers = state.homePlayers.filter((item) => item.id !== id);
  if (isSelected("home", id)) state.selected = null;
  saveState();
  renderAll();
}

function selectPlayer(team, id) {
  if (!findPlayer(team, id)) return;
  state.selected = { team, id };
  renderSelectionPanel();
  renderSubstitutionPanel();
  renderHomeRoster();
  renderOpponentRoster();
  syncSelectedTokens();
}

function validateSelection() {
  if (!state.selected) return;
  if (!findPlayer(state.selected.team, state.selected.id)) {
    state.selected = null;
  }
}

function getSelectedPlayer() {
  if (!state.selected) return null;
  const player = findPlayer(state.selected.team, state.selected.id);
  if (!player) return null;
  return {
    team: state.selected.team,
    player,
  };
}

function findPlayer(team, id) {
  if (team === "ball") return state.ball;
  if (team === "home") {
    return state.homePlayers.find((player) => player.id === id);
  }
  return state.opponentPlayers.find((player) => player.id === id);
}

function getHomeFieldPlayers() {
  return state.homePlayers.filter((player) => player.onField && !player.sentOff);
}

function getHomeBenchPlayers() {
  return state.homePlayers.filter((player) => !player.onField && !player.sentOff);
}

function getHomeSentOffPlayers() {
  return state.homePlayers.filter((player) => player.sentOff);
}

function getActiveOpponents() {
  return state.opponentPlayers.filter((player) => !player.sentOff);
}

function getOpponentSentOffPlayers() {
  return state.opponentPlayers.filter((player) => player.sentOff);
}

function syncSelectedTokens() {
  els.playersLayer.querySelectorAll(".player-token").forEach((token) => {
    token.classList.toggle("selected", isSelected(token.dataset.team, token.dataset.id));
  });
}

function findToken(team, id) {
  return Array.from(els.playersLayer.children).find(
    (token) => token.dataset.team === team && token.dataset.id === id,
  );
}

function isSelected(team, id) {
  return state.selected?.team === team && state.selected?.id === id;
}

function displayNumber(player) {
  return player.number || "-";
}

function sanitizeNumber(value) {
  return String(value || "")
    .replace(/[^\d]/g, "")
    .slice(0, 3);
}

function comparePlayersByNumber(a, b) {
  const aNumber = Number.parseInt(a.number, 10);
  const bNumber = Number.parseInt(b.number, 10);
  const aScore = Number.isFinite(aNumber) ? aNumber : 999;
  const bScore = Number.isFinite(bNumber) ? bNumber : 999;
  if (aScore !== bScore) return aScore - bScore;
  return (a.name || "").localeCompare(b.name || "", "ja");
}

function getFormationValue() {
  return FORMATIONS[els.formationSelect.value] ? els.formationSelect.value : DEFAULT_FORMATION;
}

function makeId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState(text) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = text;
  return div;
}

function toScreenPosition(entity) {
  if (state.orientation === "vertical") {
    return { left: entity.y, top: 100 - entity.x };
  }
  return { left: entity.x, top: entity.y };
}

function setTokenPosition(token, entity) {
  const position = toScreenPosition(entity);
  token.style.left = `${position.left}%`;
  token.style.top = `${position.top}%`;
}

function applyTokenDirection(token, player) {
  token.style.setProperty("--dir-screen", `${toScreenAngle(normalizeDir(player.dir, 0))}deg`);
}

function toScreenAngle(dir) {
  return state.orientation === "vertical" ? dir - 90 : dir;
}

function fromScreenAngle(angle) {
  const dir = state.orientation === "vertical" ? angle + 90 : angle;
  return normalizeDir(dir, 0);
}

function fromScreenFraction(fx, fy) {
  if (state.orientation === "vertical") {
    return { x: 100 - fy, y: fx };
  }
  return { x: fx, y: fy };
}

function clampX(team, value) {
  return team === "ball" ? clamp(value, 2, 98) : clamp(value, 4, 96);
}

function clampY(team, value) {
  return team === "ball" ? clamp(value, 2, 98) : clamp(value, 6, 94);
}

function normalizeDir(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return ((num % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
