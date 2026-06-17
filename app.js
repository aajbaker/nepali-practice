/* ── Constants ── */
const VOCAB_CATEGORIES = [
  "pronouns","nouns-basic","nouns-school","nouns-family","nouns-food",
  "nouns-activities","nouns-work","nouns-party","nouns-travel",
  "verbs-basic","verbs-school","verbs-family","verbs-food",
  "verbs-activities","verbs-work","verbs-party","verbs-travel",
  "time","grammatical","numbers","colors"
];
const SENTENCE_THEMES = [
  "basic","school","family","food","activities","work","party","travel"
];

/* ── State ── */
let state = {
  mode: "vocab",
  filter: "all",
  showRom: false,
  streak: 0,
  score: 0,
  deck: [],
  deckIndex: 0,
  revealed: false,
  mcAnswered: false,
  produceAnswered: false,
};

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("nepali-state") || "{}");
    if (s.streak !== undefined) state.streak = s.streak;
    if (s.score  !== undefined) state.score  = s.score;
    if (s.mode   !== undefined) state.mode   = s.mode;
    if (s.filter !== undefined) state.filter = s.filter;
  } catch (_) {}
}

function saveState() {
  localStorage.setItem("nepali-state", JSON.stringify({
    streak: state.streak, score: state.score,
    mode: state.mode, filter: state.filter,
  }));
}

/* ── Helpers ── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[।\.!?,;:'"-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function currentItem() { return state.deck[state.deckIndex] || null; }

function isVocabMode()     { return state.mode === "vocab"; }
function isComprehendMode(){ return state.mode === "comprehend"; }
function isProduceMode()   { return state.mode === "produce"; }
function isMCMode()        { return state.mode === "mc"; }

function usesVocab()       { return state.mode === "vocab" || state.mode === "mc"; }

/* ── Filter logic ── */
function filteredData() {
  if (usesVocab()) {
    return state.filter === "all"
      ? VOCAB
      : VOCAB.filter(v => v.category === state.filter);
  } else {
    return state.filter === "all"
      ? SENTENCES
      : SENTENCES.filter(s => s.theme === state.filter);
  }
}

function buildDeck() {
  const data = filteredData();
  if (!data.length) return [];
  return shuffle(data.map((item, i) => ({
    item,
    direction: (isVocabMode() || isMCMode())
      ? (Math.random() < 0.5 ? "eng-to-nep" : "nep-to-eng")
      : "nep-to-eng",
  })));
}

/* ── DOM helpers ── */
const $  = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

function updateStats() {
  $("streak-val").textContent = state.streak;
  $("score-val").textContent  = state.score;
}

function updateProgress() {
  const pct = state.deck.length
    ? Math.round((state.deckIndex / state.deck.length) * 100)
    : 0;
  $("progress-bar").style.width = pct + "%";
}

/* ── Explain button ── */
function makeExplainBtn(item) {
  const wrap   = el("div","explain-wrap");
  const btn    = el("button","explain-btn","Explain ↗");
  const tip    = el("span","explain-tooltip","Copied! Paste into Claude");
  wrap.appendChild(btn);
  wrap.appendChild(tip);

  btn.addEventListener("click", () => {
    const lines = [
      "I'm learning Nepali at a beginner/intermediate level. I'm practicing with a flashcard app and need help with this item:",
      "",
      `Nepali: ${item.dev}`,
      `Romanized: ${item.rom}`,
      `English meaning: ${item.eng}`,
    ];
    if (item.tense) lines.push(`Tense: ${item.tense}`);
    if (item.theme) lines.push(`Theme: ${item.theme}`);
    lines.push("", "Please explain in detail: the grammar, verb conjugation, key vocabulary, and anything that helps me understand and remember it. Keep it concise.");
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    tip.classList.add("show");
    setTimeout(() => tip.classList.remove("show"), 2000);
  });
  return wrap;
}

/* ── Romanization toggle ── */
function makePronToggle(romEl) {
  const btn = el("button","pron-toggle",
    state.showRom ? "hide pronunciation" : "pronunciation");
  if (state.showRom) romEl.classList.add("visible");
  btn.addEventListener("click", () => {
    state.showRom = !state.showRom;
    saveState();
    romEl.classList.toggle("visible", state.showRom);
    btn.textContent = state.showRom ? "hide pronunciation" : "pronunciation";
  });
  return btn;
}

/* ── Resolve card (animate out, then advance) ── */
function resolveCard(correct) {
  const card = document.querySelector(".card");
  if (!card) { nextCard(correct); return; }
  card.classList.add(correct ? "fly-right" : "fly-left");
  card.addEventListener("animationend", () => nextCard(correct), { once: true });
}

/* ── Next card ── */
function nextCard(correct) {
  if (correct === true)  { state.streak++; state.score++; }
  if (correct === false) { state.streak = 0; }
  saveState();
  updateStats();

  state.deckIndex++;
  state.revealed = false;
  state.mcAnswered = false;
  state.produceAnswered = false;
  state.showRom = false;

  if (state.deckIndex >= state.deck.length) {
    renderCompletion();
  } else {
    updateProgress();
    renderCard();
  }
}

/* ── Render card ── */
function renderCard() {
  const area = $("card-area");
  area.innerHTML = "";

  const entry = currentItem();
  if (!entry) { renderEmpty(); return; }

  if (isVocabMode())      renderVocab(area, entry);
  else if (isComprehendMode()) renderComprehend(area, entry);
  else if (isProduceMode())    renderProduce(area, entry);
  else if (isMCMode())         renderMC(area, entry);
}

/* ── Flip card builder ── */
function buildFlipCard(frontNodes, backNodes) {
  const card  = el("div", "card");
  const inner = el("div", "card-inner");
  const front = el("div", "card-front");
  const back  = el("div", "card-back");

  frontNodes.forEach(n => front.appendChild(n));
  backNodes.forEach(n  => back.appendChild(n));
  inner.appendChild(front);
  inner.appendChild(back);
  card.appendChild(inner);

  // Click to flip (desktop)
  let swipeHandled = false;
  card.addEventListener("click", (e) => {
    if (swipeHandled) { swipeHandled = false; return; }
    if (e.target.closest("button")) return;
    state.revealed = !state.revealed;
    card.classList.toggle("flipped", state.revealed);
  });

  // Swipe (mobile)
  let t0x = 0, t0y = 0, tMoved = false;
  card.addEventListener("touchstart", (e) => {
    t0x = e.touches[0].clientX;
    t0y = e.touches[0].clientY;
    swipeHandled = false;
    tMoved = false;
  }, { passive: true });

  card.addEventListener("touchmove", (e) => {
    const dx = e.touches[0].clientX - t0x;
    const dy = e.touches[0].clientY - t0y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) tMoved = true;
    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault(); // block horizontal scroll during swipe
  }, { passive: false });

  card.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - t0x;
    const dy = e.changedTouches[0].clientY - t0y;
    const adx = Math.abs(dx), ady = Math.abs(dy);

    if (adx > ady && adx > 45 && state.revealed) {
      // Horizontal swipe → resolve
      swipeHandled = true;
      resolveCard(dx > 0);
    } else if (tMoved) {
      // Finger moved but wasn't a clean swipe (scrolling) → suppress click
      swipeHandled = true;
    }
    // else: clean tap → let the click event fire and flip
  }, { passive: true });

  if (state.revealed) card.classList.add("flipped");
  return card;
}

function makeGotItRow() {
  const row     = el("div", "btn-row");
  const missBtn = el("button", "btn btn-danger btn-action");
  missBtn.innerHTML = "<span>←</span><span>Missed it</span>";
  const gotBtn  = el("button", "btn btn-success btn-action");
  gotBtn.innerHTML  = "<span>Got it</span><span>→</span>";
  missBtn.addEventListener("click", (e) => { e.stopPropagation(); resolveCard(false); });
  gotBtn.addEventListener( "click", (e) => { e.stopPropagation(); resolveCard(true);  });
  row.appendChild(missBtn);
  row.appendChild(gotBtn);
  return row;
}

/* ── Vocab mode ── */
function renderVocab(area, { item, direction }) {
  // Front
  const frontNodes = [
    el("div","card-direction", direction === "eng-to-nep" ? "English → Nepali" : "Nepali → English"),
  ];
  if (direction === "eng-to-nep") {
    frontNodes.push(el("div","card-eng", item.eng));
    frontNodes.push(el("div","card-hint","What is this in Nepali?"));
  } else {
    const rom = el("div","card-rom", item.rom);
    frontNodes.push(el("div","card-dev", item.dev));
    frontNodes.push(makePronToggle(rom));
    frontNodes.push(rom);
  }

  // Back
  const backNodes = [
    el("div","card-direction","Answer"),
  ];
  if (direction === "eng-to-nep") {
    const rom = el("div","card-rom", item.rom);
    backNodes.push(el("div","card-dev", item.dev));
    backNodes.push(makePronToggle(rom));
    backNodes.push(rom);
  } else {
    backNodes.push(el("div","card-eng", item.eng));
  }
  backNodes.push(makeExplainBtn(item));
  backNodes.push(makeGotItRow());

  area.appendChild(buildFlipCard(frontNodes, backNodes));
}

/* ── Comprehend mode ── */
function renderComprehend(area, { item }) {
  // Front
  const rom = el("div","card-rom", item.rom);
  const frontNodes = [
    el("div","card-direction","Nepali sentence → understand it"),
    el("div","card-dev", item.dev),
    makePronToggle(rom),
    rom,
    el("div","card-hint", `Tense: ${item.tense || "—"} · Theme: ${item.theme || "—"}`),
  ];

  // Back
  const backNodes = [
    el("div","card-direction","Translation"),
    el("div","card-eng", item.eng),
    makeExplainBtn(item),
    makeGotItRow(),
  ];

  area.appendChild(buildFlipCard(frontNodes, backNodes));
}

/* ── Produce mode ── */
function renderProduce(area, { item }) {
  // Front
  const frontNodes = [
    el("div","card-direction","English → say it in Nepali"),
    el("div","card-eng", item.eng),
    el("div","card-hint","Say it aloud, then flip to check"),
  ];

  // Back
  const rom = el("div","card-rom", item.rom);
  const backNodes = [
    el("div","card-direction","Answer"),
    el("div","card-dev", item.dev),
    makePronToggle(rom),
    rom,
    makeExplainBtn(item),
    makeGotItRow(),
  ];

  area.appendChild(buildFlipCard(frontNodes, backNodes));
}

/* ── Multiple choice ── */
function renderMC(area, { item, direction }) {
  const card  = el("div","card card-mc");
  const face  = el("div","card-front");
  face.style.position = "relative"; // keep card-direction absolute anchor

  face.appendChild(el("div","card-direction",
    direction === "eng-to-nep" ? "English → Nepali" : "Nepali → English"));

  if (direction === "eng-to-nep") {
    face.appendChild(el("div","card-eng", item.eng));
  } else {
    const rom = el("div","card-rom", item.rom);
    face.appendChild(el("div","card-dev", item.dev));
    face.appendChild(makePronToggle(rom));
    face.appendChild(rom);
  }

  face.appendChild(makeExplainBtn(item));
  card.appendChild(face);
  area.appendChild(card);

  // Build 4 options: correct + 3 distractors
  const pool   = VOCAB.filter(v => v !== item);
  const wrongs = shuffle(pool).slice(0, 3);
  const opts   = shuffle([item, ...wrongs]);

  const grid = el("div","","");
  grid.id = "mc-options";

  opts.forEach(opt => {
    const btn = el("button","mc-option",
      direction === "eng-to-nep" ? opt.dev : opt.eng);

    btn.addEventListener("click", () => {
      if (state.mcAnswered) return;
      state.mcAnswered = true;
      const isCorrect = opt === item;

      // Mark all options
      grid.querySelectorAll(".mc-option").forEach(b => {
        b.disabled = true;
        const bOpt = opts[Array.from(grid.children).indexOf(b)];
        if (bOpt === item) b.classList.add("correct");
      });
      if (!isCorrect) btn.classList.add("wrong");

      setTimeout(() => nextCard(isCorrect), 900);
    });

    grid.appendChild(btn);
  });

  area.appendChild(grid);
}

/* ── Empty / completion ── */
function renderEmpty() {
  const area = $("card-area");
  area.innerHTML = "";
  const d = el("div","","");
  d.id = "empty-state";
  d.appendChild(el("p","","No items match this filter. Try selecting a different category."));
  area.appendChild(d);
}

function renderCompletion() {
  const area = $("card-area");
  area.innerHTML = "";
  $("progress-bar").style.width = "100%";
  const d = el("div","","");
  d.id = "completion";
  d.appendChild(el("h2","","🎉 Deck complete!"));
  d.appendChild(el("p","",`Score this round: ${state.score} correct · Streak: ${state.streak}`));
  const restartBtn = el("button","btn btn-primary","Shuffle & restart");
  restartBtn.addEventListener("click", startDeck);
  d.appendChild(restartBtn);
  area.appendChild(d);
}

/* ── Filter bar ── */
function buildFilterBar() {
  const bar = $("filter-bar");
  bar.innerHTML = "<label for='filter-select'>Filter:</label>";

  const filters = usesVocab()
    ? ["all", ...VOCAB_CATEGORIES]
    : ["all", ...SENTENCE_THEMES];

  const select = document.createElement("select");
  select.id = "filter-select";
  filters.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f === "all" ? "All" : f;
    if (f === state.filter) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    state.filter = select.value;
    saveState();
    startDeck();
  });
  bar.appendChild(select);
}

/* ── Start / restart deck ── */
function startDeck() {
  state.deck = buildDeck();
  state.deckIndex = 0;
  state.revealed = false;
  state.mcAnswered = false;
  state.produceAnswered = false;
  state.showRom = false;
  updateProgress();
  renderCard();
}

/* ── Mode buttons ── */
function initModeBtns() {
  // Clear the hardcoded HTML active class, then apply from saved state
  document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".mode-btn").forEach(btn => {
    if (btn.dataset.mode === state.mode) btn.classList.add("active");
    btn.addEventListener("click", () => {
      state.mode = btn.dataset.mode;
      // reset filter to "all" when switching between vocab and sentence modes
      if (usesVocab() && SENTENCE_THEMES.includes(state.filter)) {
        state.filter = "all";
      }
      if (!usesVocab() && VOCAB_CATEGORIES.includes(state.filter)) {
        state.filter = "all";
      }
      saveState();
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      buildFilterBar();
      startDeck();
    });
  });
}

/* ── Reset ── */
$("reset-btn").addEventListener("click", () => {
  if (!confirm("Clear session progress?")) return;
  localStorage.removeItem("nepali-state");
  state.streak = 0;
  state.score  = 0;
  state.filter = "all";
  state.mode   = "vocab";
  saveState();
  updateStats();
  document.querySelectorAll(".mode-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === "vocab"));
  buildFilterBar();
  startDeck();
});

/* ── Keyboard shortcuts ── */
document.addEventListener("keydown", (e) => {
  if (isMCMode()) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  const card = document.querySelector(".card");

  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    if (!card) return;
    state.revealed = !state.revealed;
    card.classList.toggle("flipped", state.revealed);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (state.revealed) resolveCard(true);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (state.revealed) resolveCard(false);
  }
});

/* ── Boot ── */
loadState();
updateStats();
initModeBtns();
buildFilterBar();
startDeck();
