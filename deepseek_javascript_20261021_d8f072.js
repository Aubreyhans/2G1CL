/* =============================================================
   1. VOCABULARY DATA
   ============================================================= */

const themes = {
  housing: {
    name: "Housing & Community 组屋与社区",
    words: [
      { word: "组屋",       pinyin: "zǔ wū",              meaning: "HDB flat" },
      { word: "风景",       pinyin: "fēng jǐng",           meaning: "scenery / landscape" },
      { word: "政府",       pinyin: "zhèng fǔ",            meaning: "government" },
      { word: "建屋发展局", pinyin: "jiàn wū fā zhǎn jú",  meaning: "Housing & Development Board" },
      { word: "实施",       pinyin: "shí shī",             meaning: "to implement" },
      { word: "价格",       pinyin: "jià gé",              meaning: "price" },
      { word: "市镇",       pinyin: "shì zhèn",            meaning: "town / township" },
      { word: "社区",       pinyin: "shè qū",              meaning: "community" },
      { word: "联系",       pinyin: "lián xì",             meaning: "connection / to contact" },
      { word: "小贩",       pinyin: "xiǎo fàn",            meaning: "hawker" },
      { word: "宗教",       pinyin: "zōng jiào",           meaning: "religion" },
      { word: "游乐场",     pinyin: "yóu lè chǎng",        meaning: "playground" },
      { word: "市镇理事会", pinyin: "shì zhèn lǐ shì huì", meaning: "Town Council" },
      { word: "经济",       pinyin: "jīng jì",             meaning: "economy" },
      { word: "发展",       pinyin: "fā zhǎn",             meaning: "development" },
      { word: "快速",       pinyin: "kuài sù",             meaning: "rapid / fast" },
      { word: "驰名",       pinyin: "chí míng",            meaning: "well-known" },
      { word: "标志",       pinyin: "biāo zhì",            meaning: "sign / landmark" }
    ]
  }
};

/* Distractor pool — mixed HSK1–3 chars + housing/community vocabulary */
const distractorPool =
  "日月水火山石土木金风天地人大小中上下左右前后东西南北红黄蓝绿黑白" +
  "的了吧吗呢啊是在有不这那个们我你他她它说看好来去会能要想" +
  "住房屋建市镇区民家国工地生活动行出进开关门路街园公共" +
  "新旧多少高低长短很太更最和与或但而且因为所以";

/* =============================================================
   2. HELPER FUNCTIONS
   ============================================================= */

/* Fisher-Yates shuffle */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Random sample of n words from a theme (or all if fewer) */
function sampleWords(themeKey, n) {
  const words = themes[themeKey].words;
  if (words.length <= n) return shuffle(words);
  return shuffle(words).slice(0, n);
}

/* ---------- Pronunciation via SpeechSynthesis ---------- */
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-CN";
  utter.rate = 0.8;
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.startsWith("zh"));
  if (zhVoice) utter.voice = zhVoice;
  window.speechSynthesis.speak(utter);
}

/* Build 20 tiles for a word: correct chars + random distractors */
function buildCharacterPool(wordData) {
  const correctChars = wordData.word.split("");
  const needed = 20 - correctChars.length;

  const distractors = [];
  for (let i = 0; i < needed; i++) {
    distractors.push(distractorPool[Math.floor(Math.random() * distractorPool.length)]);
  }

  const tiles = correctChars
    .concat(distractors)
    .map((char, i) => ({ id: i, char: char, used: false }));

  return shuffle(tiles);
}

/* =============================================================
   3. GAME STATE
   ============================================================= */

function GameState(words) {
  this.words = words;
  this.currentIndex = 0;
  this.score = 0;
  this.selections = [];
  this.tiles = [];
  this.finished = false;
  this.wrongAttempts = 0;
  this.perfectWords = 0;
}

GameState.prototype.currentWord = function () {
  return this.words[this.currentIndex];
};

GameState.prototype.startWord = function () {
  this.selections = [];
  this.tiles = buildCharacterPool(this.currentWord());
  this.wrongAttempts = 0;
  speak(this.currentWord().word);
};

GameState.prototype.selectTile = function (tileId) {
  const tile = this.tiles.find(t => t.id === tileId);
  if (!tile || tile.used) return null;

  const built = this.selections.map(t => t.char).join("") + tile.char;
  const target = this.currentWord().word;

  if (!target.startsWith(built)) {
    this.wrongAttempts++;
    return { status: "rejected", tileId: tileId };
  }

  tile.used = true;
  this.selections.push(tile);

  if (built === target) {
    if (this.wrongAttempts === 0) this.perfectWords++;
    this.score++;
    return { status: "complete" };
  }
  return { status: "accepted" };
};

GameState.prototype.nextWord = function () {
  if (this.currentIndex < this.words.length - 1) {
    this.currentIndex++;
    this.startWord();
    return true;
  }
  this.finished = true;
  return false;
};

GameState.prototype.replay = function () {
  speak(this.currentWord().word);
};

/* =============================================================
   4. UI / RENDERING
   ============================================================= */

const app = document.getElementById("app");
let game = null;
let currentThemeKey = null;

function renderThemeSelect() {
  app.innerHTML =
    '<h1>Chinese Vocab Games</h1>' +
    '<p class="subtitle">Choose a theme</p>' +
    '<div class="theme-grid">' +
      Object.keys(themes).map(function (key) {
        const t = themes[key];
        return (
          '<button class="theme-btn" data-theme="' + key + '">' +
            '<span class="theme-name">' + t.name + '</span>' +
            '<span class="theme-count">' +
              Math.min(10, t.words.length) + ' of ' + t.words.length + ' words' +
            '</span>' +
          '</button>'
        );
      }).join("") +
    "</div>";

  app.querySelectorAll(".theme-btn").forEach(function (btn) {
    btn.onclick = function () { startGame(btn.dataset.theme); };
  });
}

function startGame(themeKey) {
  currentThemeKey = themeKey;
  const words = sampleWords(themeKey, 10);
  game = new GameState(words);
  game.startWord();
  renderGame();
}

function renderGame() {
  const word = game.currentWord();

  const selectedChars = game.selections.map(function (t) {
    return '<span class="answer-char">' + t.char + "</span>";
  }).join("");

  const remaining = word.word.length - game.selections.length;
  const placeholder = remaining > 0
    ? '<span class="placeholder">' + "·".repeat(remaining) + "</span>"
    : "";

  const tilesHtml = game.tiles.map(function (t) {
    return (
      '<button class="tile ' + (t.used ? "used" : "") + '" data-id="' + t.id + '">' +
        t.char +
      "</button>"
    );
  }).join("");

  app.innerHTML =
    '<div class="game-header">' +
      '<span class="progress">Word ' + (game.currentIndex + 1) + " / " + game.words.length + "</span>" +
      '<span class="score">Score: ' + game.score + "</span>" +
      '<button id="quit-btn">Quit</button>' +
    "</div>" +
    '<div class="prompt">' +
      '<div class="pinyin">' + word.pinyin + "</div>" +
      '<div class="meaning">' + word.meaning + "</div>" +
      '<button id="play-audio">🔊 Hear again</button>' +
    "</div>" +
    '<div class="answer-slot" id="answer-slot">' + selectedChars + placeholder + "</div>" +
    '<div class="tile-grid" id="tile-grid">' + tilesHtml + "</div>";

  document.getElementById("play-audio").onclick = function () { game.replay(); };
  document.getElementById("quit-btn").onclick = renderThemeSelect;

  app.querySelectorAll(".tile").forEach(function (btn) {
    btn.onclick = function () { handleTileClick(Number(btn.dataset.id)); };
  });
}

function handleTileClick(tileId) {
  const result = game.selectTile(tileId);
  if (!result) return;

  const tileEl = app.querySelector('.tile[data-id="' + tileId + '"]');

  if (result.status === "rejected") {
    if (tileEl) {
      tileEl.classList.add("shake");
      setTimeout(function () { tileEl.classList.remove("shake"); }, 500);
    }
    return;
  }

  if (result.status === "complete") {
    const slot = document.getElementById("answer-slot");
    if (slot) slot.classList.add("correct-flash");

    setTimeout(function () {
      if (game.nextWord()) {
        renderGame();
      } else {
        renderResults();
      }
    }, 900);
    return;
  }

  renderGame();
}

function renderResults() {
  app.innerHTML =
    '<div class="results">' +
      "<h2>Finished! 🎉</h2>" +
      '<p class="final-score">' + game.score + " / " + game.words.length + "</p>" +
      '<p class="perfect-stat">Perfect words: ' + game.perfectWords + " / " + game.words.length + "</p>" +
      '<button id="play-again">Play again</button>' +
      '<button id="home">Choose theme</button>' +
    "</div>";

  document.getElementById("play-again").onclick = function () {
    startGame(currentThemeKey);
  };
  document.getElementById("home").onclick = renderThemeSelect;
}

/* =============================================================
   5. KICK OFF
   ============================================================= */

renderThemeSelect();