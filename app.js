let gameEl = document.querySelector(".game");
let boxes = []; //built by buildBoard
let resetBtn = document.querySelector("#reset-btn");
let newGameBtn = document.querySelector("#new-btn");
let scoreResetBtn = document.querySelector("#score-reset-btn");
let msgContainer = document.querySelector(".msg-container");
let msg = document.querySelector("#msg");
let statusText = document.querySelector("#status");
let ruleText = document.querySelector("#rule");
let modeBtns = document.querySelectorAll("#mode-toggle .toggle-btn");
let levelToggle = document.querySelector("#level-toggle");
let levelBtns = document.querySelectorAll("#level-toggle .toggle-btn");
let sizeBtns = document.querySelectorAll("#size-toggle .toggle-btn");
let timerBtns = document.querySelectorAll("#timer-toggle .toggle-btn");
let msgEmoji = document.querySelector("#msg-emoji");
let msgSub = document.querySelector("#msg-sub");
let nameInputs = { O: document.querySelector("#input-o"), X: document.querySelector("#input-x") };
let soundBtn = document.querySelector("#sound-btn");
let downloadBtns = document.querySelectorAll("#download-btn, #msg-download-btn");
let confettiCanvas = document.querySelector("#confetti");

const HUMAN = "O";
const COMPUTER = "X";
const WIN_SCORE = 100000;
const LINE_WEIGHTS = [0, 1, 10, 100, 1000]; //value of an open line by marks in it

let size = 3; //board is size x size
let winLength = 3; //marks in a row needed to win
let winPatterns = [];
let cellOrder = []; //cells sorted centre-first, searched in this order

let board = []; //single source of truth for the game
let currentPlayer = "O";
let startingPlayer = "O"; //alternates every new game
let gameOver = false;
let vsComputer = false;
let difficulty = "hard";
let scores = { O: 0, X: 0, draw: 0 };
let timer = null; //pending computer move or result popup

let turnSeconds = 0; //0 = no turn timer
let timeLeft = 0;
let turnInterval = null;

const WIN_LINES = ["What a move!", "Too good!", "Champion stuff!", "Unstoppable!", "Clean win!"];
const LOSE_LINES = ["The computer got you this time.", "So close! Try again.", "Revenge round?"];
const DRAW_LINES = ["Nobody blinked.", "Evenly matched!", "One more to settle it?"];
//each note is [frequency, start, length] in seconds
const SOUNDS = {
  O: [[520, 0, 0.08]],
  X: [[390, 0, 0.08]],
  win: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.3]],
  lose: [[392, 0, 0.15], [311, 0.15, 0.15], [262, 0.3, 0.3]],
  draw: [[440, 0, 0.15], [440, 0.2, 0.15]],
};

let names = { O: "", X: "" }; //typed by the players, empty = default name
let rounds = []; //result of every round since the last score reset: "O", "X" or "draw"
let streak = { player: "", count: 0 };
let soundOn = true;
let audioCtx = null;
let confettiFrame = null;

//storage can be blocked (private mode), the game works without it
const load = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const playSound = (name) => {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    for (let [frequency, start, length] of SOUNDS[name]) {
      let osc = audioCtx.createOscillator();
      let gain = audioCtx.createGain();
      let at = audioCtx.currentTime + start;
      osc.type = "triangle";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.15, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + length);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(at);
      osc.stop(at + length);
    }
  } catch {}
};

const launchConfetti = () => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let ctx = confettiCanvas.getContext("2d");
  let width = (confettiCanvas.width = window.innerWidth);
  let height = (confettiCanvas.height = window.innerHeight);
  let colors = ["#ffd166", "#ef6f6c", "#2ec4b6", "#f4f1de"];
  let pieces = [];
  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.6,
      size: 6 + Math.random() * 7,
      speed: 3 + Math.random() * 4,
      drift: -1.5 + Math.random() * 3,
      spin: Math.random() * Math.PI,
      color: colors[i % colors.length],
    });
  }
  cancelAnimationFrame(confettiFrame);
  let started = performance.now();
  const draw = (now) => {
    ctx.clearRect(0, 0, width, height);
    if (now - started > 3500) return;
    for (let p of pieces) {
      p.y += p.speed;
      p.x += p.drift;
      p.spin += 0.12;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    confettiFrame = requestAnimationFrame(draw);
  };
  confettiFrame = requestAnimationFrame(draw);
};

//every straight line of winLength cells: rows, columns and both diagonals
const buildWinPatterns = () => {
  let patterns = [];
  let directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (let [dRow, dCol] of directions) {
        let endRow = row + dRow * (winLength - 1);
        let endCol = col + dCol * (winLength - 1);
        if (endRow >= size || endCol < 0 || endCol >= size) continue;
        let pattern = [];
        for (let k = 0; k < winLength; k++) {
          pattern.push((row + dRow * k) * size + (col + dCol * k));
        }
        patterns.push(pattern);
      }
    }
  }
  return patterns;
};

const buildCellOrder = () => {
  let centre = (size - 1) / 2;
  let distance = (i) =>
    Math.abs(Math.floor(i / size) - centre) + Math.abs((i % size) - centre);
  let cells = [];
  for (let i = 0; i < size * size; i++) cells.push(i);
  return cells.sort((a, b) => distance(a) - distance(b));
};

const buildBoard = () => {
  winLength = size === 3 ? 3 : 4;
  winPatterns = buildWinPatterns();
  cellOrder = buildCellOrder();

  gameEl.innerHTML = "";
  gameEl.style.setProperty("--size", size);
  boxes = [];
  for (let i = 0; i < size * size; i++) {
    let box = document.createElement("button");
    box.className = "box";
    box.setAttribute(
      "aria-label",
      `Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}`
    );
    box.addEventListener("click", () => {
      if (isComputerTurn()) return;
      playMove(i);
    });
    gameEl.appendChild(box);
    boxes.push(box);
  }
  ruleText.innerText = `${size} x ${size} board - get ${winLength} in a row to win`;
};

const getWinPattern = (b) => {
  for (let pattern of winPatterns) {
    let first = b[pattern[0]];
    if (first === "") continue;
    let won = true;
    for (let k = 1; k < pattern.length; k++) {
      if (b[pattern[k]] !== first) {
        won = false;
        break;
      }
    }
    if (won) return pattern;
  }
  return null;
};

const emptyCells = (b) => {
  let cells = [];
  for (let i of cellOrder) {
    if (b[i] === "") cells.push(i);
  }
  return cells;
};

const playerName = (player) => {
  if (vsComputer && player === COMPUTER) return "Computer";
  if (names[player]) return names[player];
  return vsComputer ? "You" : `Player ${player}`;
};

const scoreLabel = (player) => {
  if (!vsComputer && !names[player]) return `Player ${player}`;
  return `${playerName(player)} (${player})`;
};

const isComputerTurn = () => vsComputer && currentPlayer === COMPUTER;

const updateStatus = () => {
  let text;
  if (isComputerTurn()) {
    text = "Computer is thinking...";
  } else if (playerName(currentPlayer) === "You") {
    text = "Your turn";
  } else {
    text = `${playerName(currentPlayer)}'s turn`;
  }
  let timed = turnSeconds > 0 && !isComputerTurn();
  if (timed) text += ` - ${timeLeft}s`;
  statusText.innerText = text;
  statusText.classList.toggle("hurry", timed && timeLeft <= 2);
  document.querySelector("#card-o").classList.toggle("active", currentPlayer === "O");
  document.querySelector("#card-x").classList.toggle("active", currentPlayer === "X");
};

const updateScores = () => {
  document.querySelector("#score-o").innerText = scores.O;
  document.querySelector("#score-x").innerText = scores.X;
  document.querySelector("#score-draw").innerText = scores.draw;
  document.querySelector("#name-o").innerText = scoreLabel("O");
  document.querySelector("#name-x").innerText = scoreLabel("X");
};

const stopTimers = () => {
  clearTimeout(timer);
  clearInterval(turnInterval);
};

//running out of time skips the turn
const startTurnTimer = () => {
  clearInterval(turnInterval);
  if (turnSeconds === 0) return;
  timeLeft = turnSeconds;
  turnInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      currentPlayer = currentPlayer === "O" ? "X" : "O";
      beginTurn();
    } else {
      updateStatus();
    }
  }, 1000);
};

const beginTurn = () => {
  clearInterval(turnInterval);
  if (isComputerTurn()) {
    updateStatus();
    timer = setTimeout(computerMove, 450);
  } else {
    startTurnTimer();
    updateStatus();
  }
};

const showResult = (text, emoji, sub, sound) => {
  statusText.innerText = text;
  statusText.classList.remove("hurry");
  //short delay so the winning line is visible before the popup
  timer = setTimeout(() => {
    msg.innerText = text;
    msgEmoji.innerText = emoji;
    msgSub.innerText = sub;
    msgContainer.classList.remove("hide");
    playSound(sound);
    if (sound === "win") launchConfetti();
  }, 700);
};

const disableBoxes = () => {
  for (let box of boxes) {
    box.disabled = true;
  }
};

const finishGame = (pattern) => {
  gameOver = true;
  stopTimers();
  disableBoxes();
  document.querySelector("#card-o").classList.remove("active");
  document.querySelector("#card-x").classList.remove("active");

  if (pattern) {
    let winner = board[pattern[0]];
    for (let i of pattern) {
      boxes[i].classList.add("win");
    }
    scores[winner]++;
    rounds.push(winner);
    streak = { player: winner, count: streak.player === winner ? streak.count + 1 : 1 };
    let name = playerName(winner);
    let text = name === "You" ? "You win!" : `${name} wins!`;
    if (vsComputer && winner === COMPUTER) {
      showResult(text, "🤖", randomFrom(LOSE_LINES), "lose");
    } else {
      let sub = streak.count >= 2 ? `🔥 ${streak.count} wins in a row!` : randomFrom(WIN_LINES);
      showResult(text, "🏆", sub, "win");
    }
  } else {
    scores.draw++;
    rounds.push("draw");
    streak = { player: "", count: 0 };
    showResult("It's a draw.", "🤝", randomFrom(DRAW_LINES), "draw");
  }
  updateScores();
};

const playMove = (index) => {
  if (gameOver || board[index] !== "") return;

  board[index] = currentPlayer;
  boxes[index].innerText = currentPlayer;
  boxes[index].classList.add(currentPlayer === "O" ? "mark-o" : "mark-x");
  boxes[index].disabled = true;
  playSound(currentPlayer);

  let pattern = getWinPattern(board);
  if (pattern || emptyCells(board).length === 0) {
    finishGame(pattern);
    return;
  }

  currentPlayer = currentPlayer === "O" ? "X" : "O";
  beginTurn();
};

//scores a position that is not finished: lines only one side can still complete
const evaluate = (b) => {
  let total = 0;
  for (let pattern of winPatterns) {
    let computer = 0;
    let human = 0;
    for (let i of pattern) {
      if (b[i] === COMPUTER) computer++;
      else if (b[i] === HUMAN) human++;
    }
    if (human === 0) total += LINE_WEIGHTS[computer];
    else if (computer === 0) total -= LINE_WEIGHTS[human];
  }
  return total;
};

//minimax with alpha-beta pruning; faster wins and slower losses score better
const minimax = (b, player, depth, maxDepth, alpha, beta) => {
  let pattern = getWinPattern(b);
  if (pattern) {
    return b[pattern[0]] === COMPUTER ? WIN_SCORE - depth : depth - WIN_SCORE;
  }
  let cells = emptyCells(b);
  if (cells.length === 0) return 0;
  if (depth >= maxDepth) return evaluate(b);

  if (player === COMPUTER) {
    let best = -Infinity;
    for (let i of cells) {
      b[i] = COMPUTER;
      best = Math.max(best, minimax(b, HUMAN, depth + 1, maxDepth, alpha, beta));
      b[i] = "";
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i of cells) {
      b[i] = HUMAN;
      best = Math.min(best, minimax(b, COMPUTER, depth + 1, maxDepth, alpha, beta));
      b[i] = "";
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
};

//3x3 is searched to the end; bigger boards look deeper as they fill up
const searchDepth = (empty) => {
  if (size === 3 || empty <= 10) return empty;
  if (empty <= 13) return 6;
  if (empty <= 17) return 5;
  return 4;
};

const randomFrom = (list) => list[Math.floor(Math.random() * list.length)];

const bestMove = () => {
  let cells = emptyCells(board);
  let maxDepth = searchDepth(cells.length);
  let bestScore = -Infinity;
  let bestCells = [];
  for (let i of cells) {
    board[i] = COMPUTER;
    let score = minimax(board, HUMAN, 1, maxDepth, -Infinity, Infinity);
    board[i] = "";
    if (score > bestScore) {
      bestScore = score;
      bestCells = [i];
    } else if (score === bestScore) {
      bestCells.push(i);
    }
  }
  //pick randomly among equally good moves so games don't repeat
  return randomFrom(bestCells);
};

const computerMove = () => {
  if (gameOver) return;
  let index = difficulty === "hard" ? bestMove() : randomFrom(emptyCells(board));
  playMove(index);
};

const startRound = () => {
  stopTimers();
  board = Array(size * size).fill("");
  currentPlayer = startingPlayer;
  gameOver = false;
  for (let box of boxes) {
    box.disabled = false;
    box.innerText = "";
    box.classList.remove("mark-o", "mark-x", "win");
  }
  msgContainer.classList.add("hide");
  beginTurn();
};

//same starter again
const resetGame = () => {
  startRound();
};

//the other player starts the next game
const newGame = () => {
  startingPlayer = startingPlayer === "O" ? "X" : "O";
  startRound();
};

const resetScores = () => {
  scores = { O: 0, X: 0, draw: 0 };
  rounds = [];
  streak = { player: "", count: 0 };
  updateScores();
};

const roundRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

//draws the scorecard on a canvas and saves it as a PNG
const downloadScorecard = () => {
  const WIDTH = 900;
  const HEIGHT = 1200;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  let canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  let ctx = canvas.getContext("2d");
  const write = (text, x, y, font, color, align = "center") => {
    ctx.font = `${font} ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  let bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#1f5660");
  bg.addColorStop(1, "#12343b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  write("TIC TAC TOE", WIDTH / 2, 120, "700 68px", "#f4f1de");
  write("S C O R E   C A R D", WIDTH / 2, 170, "600 24px", "#2ec4b6");

  let panels = [
    { player: "O", x: 60, color: "#ffd166" },
    { player: "X", x: 470, color: "#ef6f6c" },
  ];
  for (let { player, x, color } of panels) {
    ctx.fillStyle = "#1b4a52";
    roundRect(ctx, x, 230, 370, 290, 28);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    write(playerName(player), x + 185, 295, "600 36px", "#f4f1de");
    write(`playing ${player}`, x + 185, 335, "400 22px", "#a9c4c4");
    write(scores[player], x + 185, 475, "700 130px", color);
  }

  ctx.fillStyle = "#1b4a52";
  roundRect(ctx, 60, 550, 780, 90, 28);
  ctx.fill();
  write(`Draws: ${scores.draw}`, 250, 606, "600 30px", "#f4f1de");
  write(`Rounds played: ${rounds.length}`, 630, 606, "600 30px", "#f4f1de");

  let verdict = "No rounds played yet";
  if (scores.O !== scores.X) {
    let leader = playerName(scores.O > scores.X ? "O" : "X");
    verdict = leader === "You" ? "You are leading!" : `${leader} is leading!`;
  } else if (rounds.length > 0) {
    verdict = "It's all level!";
  }
  write(verdict, WIDTH / 2, 730, "700 44px", "#2ec4b6");

  let recent = rounds.slice(-6);
  let firstRound = rounds.length - recent.length + 1;
  recent.forEach((result, i) => {
    let text = result === "draw" ? "Draw" : `${playerName(result)} won`;
    write(`Round ${firstRound + i}  -  ${text}`, WIDTH / 2, 800 + i * 44, "400 26px", "#f4f1de");
  });

  let mode = vsComputer ? `vs Computer (${difficulty})` : "2 Players";
  write(`${size} x ${size} board  |  ${mode}`, WIDTH / 2, 1100, "400 24px", "#a9c4c4");
  write(new Date().toLocaleString(), WIDTH / 2, 1136, "400 22px", "#a9c4c4");
  write("Tic Tac Toe by Jatin Mishra", WIDTH / 2, 1172, "400 20px", "#a9c4c4");

  canvas.toBlob((blob) => {
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tictactoe-scorecard-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
};

//the X name is the computer's while playing against it
const syncNameInputs = () => {
  nameInputs.O.value = names.O;
  nameInputs.X.value = vsComputer ? "Computer" : names.X;
  nameInputs.X.disabled = vsComputer;
};

const updateSoundBtn = () => {
  soundBtn.innerText = soundOn ? "🔊" : "🔇";
  soundBtn.setAttribute("aria-pressed", soundOn);
};

const setActive = (btns, activeBtn) => {
  for (let btn of btns) {
    btn.classList.toggle("active", btn === activeBtn);
  }
};

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    vsComputer = btn.dataset.mode === "cpu";
    setActive(modeBtns, btn);
    levelToggle.classList.toggle("hide", !vsComputer);
    syncNameInputs();
    startingPlayer = "O";
    resetScores();
    startRound();
  });
});

levelBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    difficulty = btn.dataset.level;
    setActive(levelBtns, btn);
    startRound();
  });
});

sizeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    size = Number(btn.dataset.size);
    setActive(sizeBtns, btn);
    startingPlayer = "O";
    buildBoard();
    resetScores();
    startRound();
  });
});

timerBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    turnSeconds = Number(btn.dataset.seconds);
    setActive(timerBtns, btn);
    startRound();
  });
});

newGameBtn.addEventListener("click", newGame);
resetBtn.addEventListener("click", resetGame);
scoreResetBtn.addEventListener("click", resetScores);
downloadBtns.forEach((btn) => btn.addEventListener("click", downloadScorecard));

for (let player of ["O", "X"]) {
  nameInputs[player].addEventListener("input", () => {
    names[player] = nameInputs[player].value.trim();
    save(`ttt-name-${player}`, names[player]);
    updateScores();
    if (!gameOver) updateStatus();
  });
}

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  save("ttt-sound", soundOn ? "on" : "off");
  updateSoundBtn();
});

//on small screens the side panels are drawers opened from the top bar
let panels = document.querySelectorAll(".panel");
let backdrop = document.querySelector(".backdrop");

const closePanels = () => {
  panels.forEach((panel) => panel.classList.remove("open"));
  backdrop.classList.add("hide");
};

document.querySelectorAll(".panel-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    closePanels();
    document.getElementById(btn.dataset.panel).classList.add("open");
    backdrop.classList.remove("hide");
  });
});
document.querySelectorAll(".panel-close").forEach((btn) => btn.addEventListener("click", closePanels));
backdrop.addEventListener("click", closePanels);

//tips in the about panel change on their own every few seconds
const startSlider = () => {
  let slides = document.querySelectorAll(".slide");
  let dotsEl = document.querySelector(".dots");
  let current = 0;
  let interval = null;
  const show = (index) => {
    current = index;
    slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
    [...dotsEl.children].forEach((dot, i) => dot.classList.toggle("active", i === index));
    clearInterval(interval);
    interval = setInterval(() => show((current + 1) % slides.length), 3500);
  };
  slides.forEach((slide, i) => {
    let dot = document.createElement("button");
    dot.className = "dot";
    dot.setAttribute("aria-label", `Tip ${i + 1}`);
    dot.addEventListener("click", () => show(i));
    dotsEl.appendChild(dot);
  });
  show(0);
};

//X and O marks drifting up behind the game
const buildFloaters = () => {
  let floaters = document.querySelector(".floaters");
  for (let i = 0; i < 12; i++) {
    let mark = document.createElement("span");
    mark.innerText = i % 2 ? "X" : "O";
    mark.style.color = i % 2 ? "var(--color-x)" : "var(--color-o)";
    mark.style.left = `${Math.random() * 95}%`;
    mark.style.fontSize = `${1.5 + Math.random() * 3}rem`;
    mark.style.animationDuration = `${12 + Math.random() * 14}s`;
    mark.style.animationDelay = `${-Math.random() * 20}s`;
    floaters.appendChild(mark);
  }
};

startSlider();
buildFloaters();

names.O = load("ttt-name-O", "");
names.X = load("ttt-name-X", "");
soundOn = load("ttt-sound", "on") === "on";
syncNameInputs();
updateSoundBtn();

buildBoard();
updateScores();
startRound();
