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

/* ── Vocab mode ── */
function renderVocab(area, { item, direction }) {
  const card = el("div","card");
  const dir  = el("div","card-direction",
    direction === "eng-to-nep" ? "English → Nepali" : "Nepali → English");
  card.appendChild(dir);

  if (direction === "eng-to-nep") {
    card.appendChild(el("div","card-eng", item.eng));
    card.appendChild(el("div","card-hint","What is this in Nepali?"));
  } else {
    const dev = el("div","card-dev", item.dev);
    const rom = el("div","card-rom", item.rom);
    card.appendChild(dev);
    card.appendChild(makePronToggle(rom));
    card.appendChild(rom);
  }

  card.appendChild(makeExplainBtn(item));
  area.appendChild(card);

  if (!state.revealed) {
    const revBtn = el("button","btn btn-ghost","Show answer");
    revBtn.id = "reveal-btn";
    revBtn.addEventListener("click", () => {
      state.revealed = true;
      renderVocabAnswer(area, item, direction);
      revBtn.remove();
    });
    area.appendChild(revBtn);
  } else {
    renderVocabAnswer(area, item, direction);
  }
}

function renderVocabAnswer(area, item, direction) {
  const box = el("div","answer-box");
  if (direction === "eng-to-nep") {
    box.appendChild(el("div","ans-dev", item.dev));
    const rom = el("div","card-rom", item.rom);
    if (state.showRom) rom.classList.add("visible");
    box.appendChild(rom);
    const togBtn = el("button","pron-toggle",
      state.showRom ? "hide pronunciation" : "pronunciation");
    togBtn.addEventListener("click", () => {
      state.showRom = !state.showRom;
      saveState();
      rom.classList.toggle("visible", state.showRom);
      togBtn.textContent = state.showRom ? "hide pronunciation" : "pronunciation";
    });
    box.appendChild(togBtn);
  } else {
    box.appendChild(el("div","ans-eng", item.eng));
  }
  area.appendChild(box);

  const row = el("div","btn-row");
  const gotBtn = el("button","btn btn-success","✓ Got it");
  const missBtn= el("button","btn btn-danger","✗ Missed it");
  gotBtn.addEventListener("click",  () => nextCard(true));
  missBtn.addEventListener("click", () => nextCard(false));
  row.appendChild(missBtn);
  row.appendChild(gotBtn);
  area.appendChild(row);
}

/* ── Comprehend mode ── */
function renderComprehend(area, { item }) {
  const card = el("div","card");
  card.appendChild(el("div","card-direction","Nepali sentence → understand it"));
  card.appendChild(el("div","card-dev", item.dev));
  const rom = el("div","card-rom", item.rom);
  card.appendChild(makePronToggle(rom));
  card.appendChild(rom);
  card.appendChild(el("div","card-hint",
    `Tense: ${item.tense || "—"} · Theme: ${item.theme || "—"}`));
  card.appendChild(makeExplainBtn(item));
  area.appendChild(card);

  if (!state.revealed) {
    const revBtn = el("button","btn btn-ghost","Reveal translation");
    revBtn.id = "reveal-btn";
    revBtn.addEventListener("click", () => {
      state.revealed = true;
      renderComprehendAnswer(area, item);
      revBtn.remove();
    });
    area.appendChild(revBtn);
  } else {
    renderComprehendAnswer(area, item);
  }
}

function renderComprehendAnswer(area, item) {
  const box = el("div","answer-box");
  box.appendChild(el("div","ans-eng", item.eng));
  area.appendChild(box);

  const row = el("div","btn-row");
  const gotBtn  = el("button","btn btn-success","✓ Got it");
  const missBtn = el("button","btn btn-danger","✗ Missed it");
  gotBtn.addEventListener("click",  () => nextCard(true));
  missBtn.addEventListener("click", () => nextCard(false));
  row.appendChild(missBtn);
  row.appendChild(gotBtn);
  area.appendChild(row);
}

/* ── Produce mode — flashcard, English shown, say it aloud, self-report ── */
function renderProduce(area, { item }) {
  const card = el("div","card");
  card.appendChild(el("div","card-direction","English → say it in Nepali"));
  card.appendChild(el("div","card-eng", item.eng));
  card.appendChild(el("div","card-hint","Say it aloud, then reveal to check yourself"));
  card.appendChild(makeExplainBtn(item));
  area.appendChild(card);

  if (!state.revealed) {
    const revBtn = el("button","btn btn-ghost","Show answer");
    revBtn.id = "reveal-btn";
    revBtn.addEventListener("click", () => {
      state.revealed = true;
      renderProduceAnswer(area, item);
      revBtn.remove();
    });
    area.appendChild(revBtn);
  } else {
    renderProduceAnswer(area, item);
  }
}

function renderProduceAnswer(area, item) {
  const box = el("div","answer-box");
  box.appendChild(el("div","ans-dev", item.dev));
  const rom = el("div","card-rom", item.rom);
  if (state.showRom) rom.classList.add("visible");
  box.appendChild(rom);
  const togBtn = el("button","pron-toggle",
    state.showRom ? "hide pronunciation" : "pronunciation");
  togBtn.addEventListener("click", () => {
    state.showRom = !state.showRom;
    saveState();
    rom.classList.toggle("visible", state.showRom);
    togBtn.textContent = state.showRom ? "hide pronunciation" : "pronunciation";
  });
  box.appendChild(togBtn);
  area.appendChild(box);

  const row = el("div","btn-row");
  const gotBtn  = el("button","btn btn-success","✓ Got it");
  const missBtn = el("button","btn btn-danger","✗ Missed it");
  gotBtn.addEventListener("click",  () => nextCard(true));
  missBtn.addEventListener("click", () => nextCard(false));
  row.appendChild(missBtn);
  row.appendChild(gotBtn);
  area.appendChild(row);
}

/* ── Multiple choice ── */
function renderMC(area, { item, direction }) {
  const card = el("div","card");
  card.appendChild(el("div","card-direction",
    direction === "eng-to-nep" ? "English → Nepali" : "Nepali → English"));

  if (direction === "eng-to-nep") {
    card.appendChild(el("div","card-eng", item.eng));
  } else {
    const dev = el("div","card-dev", item.dev);
    const rom = el("div","card-rom", item.rom);
    card.appendChild(dev);
    card.appendChild(makePronToggle(rom));
    card.appendChild(rom);
  }

  card.appendChild(makeExplainBtn(item));
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
  bar.innerHTML = "<label>Filter:</label>";

  const filters = usesVocab()
    ? ["all", ...VOCAB_CATEGORIES]
    : ["all", ...SENTENCE_THEMES];

  filters.forEach(f => {
    const chip = el("button","filter-chip", f === "all" ? "All" : f);
    if (f === state.filter) chip.classList.add("active");
    chip.addEventListener("click", () => {
      state.filter = f;
      saveState();
      buildFilterBar();
      startDeck();
    });
    bar.appendChild(chip);
  });
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
  document.querySelectorAll(".mode-btn").forEach(btn => {
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
    if (btn.dataset.mode === state.mode) btn.classList.add("active");
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

/* ── Boot ── */
loadState();
updateStats();
initModeBtns();
buildFilterBar();
startDeck();
