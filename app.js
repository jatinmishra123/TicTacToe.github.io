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
let seriesBtns = document.querySelectorAll("#series-toggle .toggle-btn");
let themeBtns = document.querySelectorAll("#theme-toggle .toggle-btn");
let undoBtn = document.querySelector("#undo-btn");
let hintBtn = document.querySelector("#hint-btn");
let markBtns = document.querySelectorAll("#marks-toggle .toggle-btn");
let msgEmoji = document.querySelector("#msg-emoji");
let msgSub = document.querySelector("#msg-sub");
let nameInputs = { O: document.querySelector("#input-o"), X: document.querySelector("#input-x") };
let soundBtn = document.querySelector("#sound-btn");
let downloadBtns = document.querySelectorAll("#download-btn, #msg-download-btn");
let confettiCanvas = document.querySelector("#confetti");
let nameLabels = { O: document.querySelector("#label-o"), X: document.querySelector("#label-x") };
let onlineBox = document.querySelector("#online-box");
let onlineNote = document.querySelector("#online-note");
let inviteEl = document.querySelector("#invite");
let inviteLink = document.querySelector("#invite-link");
let copyBtn = document.querySelector("#copy-btn");
let shareBtn = document.querySelector("#share-btn");
let leaveBtn = document.querySelector("#leave-btn");
let inviteModal = document.querySelector("#invite-modal");
let inviteTitle = document.querySelector("#invite-title");
let inviteText = document.querySelector("#invite-text");
let joinField = document.querySelector("#join-field");
let joinName = document.querySelector("#join-name");
let inviteYes = document.querySelector("#invite-yes");
let inviteNo = document.querySelector("#invite-no");
let chatBtn = document.querySelector("#chat-btn");
let chatBox = document.querySelector("#chat");
let chatTitle = document.querySelector("#chat-title");
let chatLog = document.querySelector("#chat-log");
let chatForm = document.querySelector("#chat-form");
let chatInput = document.querySelector("#chat-input");
let onlineBtn = document.querySelector("#online-btn");
let shareModal = document.querySelector("#share-modal");
let shareText = document.querySelector("#share-text");
let shareReady = document.querySelector("#share-ready");
let shareLink = document.querySelector("#share-link");
let whatsappBtn = document.querySelector("#whatsapp-btn");

const HUMAN = "O";
const COMPUTER = "X";
const WIN_SCORE = 100000;
const LINE_WEIGHTS = [0, 1, 10, 100, 1000]; //value of an open line by marks in it
const SEARCH_MS = 500; //thinking time for the hard computer on the bigger boards
let searchDeadline = 0;
let searchAborted = false;

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
let seriesLength = 0; //0 = free play, otherwise best of this many rounds
let matchOver = false; //a series was just won, the next round starts a fresh one
let moves = []; //cells played this round in order, for undo

//how the two marks are drawn; the game itself always stores "O" and "X"
const MARK_SETS = {
  classic: { O: "O", X: "X" },
  pets: { O: "🐶", X: "🐱" },
  elements: { O: "🔥", X: "💧" },
  sky: { O: "⭐", X: "🌙" },
};
let markSet = "classic";
let timeLeft = 0;
let turnInterval = null;

const WIN_LINES = ["What a move!", "Too good!", "Champion stuff!", "Unstoppable!", "Clean win!"];
const LOSE_LINES = ["So close! Try again.", "Revenge round?", "The next one is yours!"];
const DRAW_LINES = ["Nobody blinked.", "Evenly matched!", "One more to settle it?"];
//each note is [frequency, start, length] in seconds
const SOUNDS = {
  O: [[520, 0, 0.08]],
  X: [[390, 0, 0.08]],
  win: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.3]],
  lose: [[392, 0, 0.15], [311, 0.15, 0.15], [262, 0.3, 0.3]],
  draw: [[440, 0, 0.15], [440, 0.2, 0.15]],
  chat: [[880, 0, 0.07]],
};

let names = { O: "", X: "" }; //typed by the players, empty = default name
let rounds = []; //result of every round since the last score reset: "O", "X" or "draw"
let streak = { player: "", count: 0 };
let soundOn = true;
let audioCtx = null;
let confettiFrame = null;

//online play: two browsers talk directly, the host plays O and the guest plays X.
//on this device names.O is always "my name" while online
const ROOM_PREFIX = "ttt-mca-";
const PAGE_TITLE = document.title;
let online = null; //{ peer, conn, myMark, connected, friend, status, refused } while in online mode
let pendingConn = null; //a guest the host has not answered yet
let modalActions = null;

const sendOnline = (message) => {
  if (online && online.connected) online.conn.send(message);
};

//true while the board belongs to the other device, or nobody is connected yet
const isFriendTurn = () => online !== null && (!online.connected || currentPlayer !== online.myMark);

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
      if (isComputerTurn() || isFriendTurn()) return;
      sendOnline({ type: "move", index: i });
      playMove(i);
    });
    gameEl.appendChild(box);
    boxes.push(box);
  }
  updateRule();
};

const updateRule = () => {
  let text = `${size} x ${size} board - get ${winLength} in a row to win`;
  if (seriesLength > 0) text += ` - best of ${seriesLength}`;
  ruleText.innerText = text;
};

const icon = (player) => MARK_SETS[markSet][player];

//a line through the winning cells, in the winner's colour
const drawWinLine = (pattern) => {
  const SVG = "http://www.w3.org/2000/svg";
  let centre = (box) => [box.offsetLeft + box.offsetWidth / 2, box.offsetTop + box.offsetHeight / 2];
  let [x1, y1] = centre(boxes[pattern[0]]);
  let [x2, y2] = centre(boxes[pattern[pattern.length - 1]]);
  let svg = document.createElementNS(SVG, "svg");
  svg.classList.add("win-line");
  //the viewBox keeps the line in place if the board is resized
  svg.setAttribute("viewBox", `0 0 ${gameEl.clientWidth} ${gameEl.clientHeight}`);
  let line = document.createElementNS(SVG, "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("pathLength", 1);
  line.style.stroke = board[pattern[0]] === "O" ? "var(--color-o)" : "var(--color-x)";
  svg.appendChild(line);
  gameEl.appendChild(svg);
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

//colourful dots flying out of a cell when a mark lands on it
const sparkle = (box) => {
  if (reducedMotion()) return;
  const COLORS = ["var(--color-o)", "var(--color-x)", "var(--accent)", "var(--text)"];
  const COUNT = 10;
  let reach = box.offsetWidth * 0.75;
  for (let k = 0; k < COUNT; k++) {
    let angle = (Math.PI * 2 * k) / COUNT;
    let spark = document.createElement("span");
    spark.className = "spark";
    spark.style.backgroundColor = COLORS[k % COLORS.length];
    spark.style.setProperty("--dx", `${Math.cos(angle) * reach}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * reach}px`);
    box.appendChild(spark);
    setTimeout(() => spark.remove(), 600);
  }
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
  if (online) return player === online.myMark ? names.O || "You" : online.friend || "Friend";
  if (vsComputer && player === COMPUTER) return "Computer";
  if (names[player]) return names[player];
  return vsComputer ? "You" : `Player ${player}`;
};

const scoreLabel = (player) => {
  if (!vsComputer && !online && !names[player]) return `Player ${player}`;
  return `${playerName(player)} (${icon(player)})`;
};

const isComputerTurn = () => vsComputer && currentPlayer === COMPUTER;

const updateStatus = () => {
  if (online && !online.connected) {
    statusText.innerText = online.status;
    statusText.classList.remove("hurry");
    document.querySelector("#card-o").classList.remove("active");
    document.querySelector("#card-x").classList.remove("active");
    return;
  }
  let text;
  if (isComputerTurn()) {
    text = "Computer is thinking...";
  } else if (playerName(currentPlayer) === "You" || (online && currentPlayer === online.myMark)) {
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
      //online, each device times its own player and tells the other about the skip
      if (isFriendTurn()) {
        clearInterval(turnInterval);
        updateStatus();
        return;
      }
      currentPlayer = currentPlayer === "O" ? "X" : "O";
      sendOnline({ type: "skip" });
      beginTurn();
    } else {
      updateStatus();
    }
  }, 1000);
};

//online: buzz the phone and flag the tab so a player notices it is their turn
const alertTurn = () => {
  let mine = online !== null && online.connected && currentPlayer === online.myMark;
  document.title = mine && document.hidden ? "Your turn! - Tic-Tac-Toe" : PAGE_TITLE;
  if (mine && navigator.vibrate) navigator.vibrate(80);
};

//undo is for games on one device; against the computer it also takes back the computer's reply
const canUndo = () => {
  if (online || gameOver || isComputerTurn()) return false;
  return vsComputer ? board.includes(HUMAN) : moves.length > 0;
};

//hints are for games on one device too
const canHint = () => !online && !gameOver && !isComputerTurn();

const updateHelpers = () => {
  undoBtn.classList.toggle("hide", online !== null);
  hintBtn.classList.toggle("hide", online !== null);
  undoBtn.disabled = !canUndo();
  hintBtn.disabled = !canHint();
};

//an empty cell that completes a line for this player, if there is one
const winningCell = (player) => {
  for (let i of emptyCells(board)) {
    board[i] = player;
    let wins = getWinPattern(board) !== null;
    board[i] = "";
    if (wins) return i;
  }
  return null;
};

//hint: win if you can, otherwise block, otherwise the most central free cell
const showHint = () => {
  if (!canHint()) return;
  let other = currentPlayer === "O" ? "X" : "O";
  let index = winningCell(currentPlayer) ?? winningCell(other) ?? emptyCells(board)[0];
  let box = boxes[index];
  box.classList.add("hint");
  setTimeout(() => box.classList.remove("hint"), 1600);
};

const undoMove = () => {
  if (!canUndo()) return;
  let mark;
  do {
    let index = moves.pop();
    mark = board[index];
    board[index] = "";
    boxes[index].innerText = "";
    boxes[index].classList.remove("mark-o", "mark-x");
    boxes[index].disabled = false;
  } while (vsComputer && mark === COMPUTER);
  //whoever made the removed move plays again
  currentPlayer = mark;
  beginTurn();
};

const beginTurn = () => {
  clearInterval(turnInterval);
  if (online && !online.connected) {
    updateStatus();
  } else if (isComputerTurn()) {
    updateStatus();
    timer = setTimeout(computerMove, 450);
  } else {
    startTurnTimer();
    updateStatus();
  }
  alertTurn();
  updateHelpers();
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
    drawWinLine(pattern);
    scores[winner]++;
    rounds.push(winner);
    streak = { player: winner, count: streak.player === winner ? streak.count + 1 : 1 };
    //a best-of series ends as soon as someone has more than half the rounds
    matchOver = seriesLength > 0 && scores[winner] > seriesLength / 2;
    let name = playerName(winner);
    let prize = matchOver ? " the match" : "";
    let text = name === "You" ? `You win${prize}!` : `${name} wins${prize}!`;
    let lost = (vsComputer && winner === COMPUTER) || (online !== null && winner !== online.myMark);
    let sub = randomFrom(lost ? LOSE_LINES : WIN_LINES);
    if (matchOver) sub = `Best of ${seriesLength} finished ${scores.O} - ${scores.X}`;
    else if (!lost && streak.count >= 2) sub = `🔥 ${streak.count} wins in a row!`;
    let emoji = "🏆";
    if (lost) emoji = vsComputer ? "🤖" : "😢";
    else if (matchOver) emoji = "👑";
    showResult(text, emoji, sub, lost ? "lose" : "win");
  } else {
    scores.draw++;
    rounds.push("draw");
    streak = { player: "", count: 0 };
    showResult("It's a draw.", "🤝", randomFrom(DRAW_LINES), "draw");
  }
  recordRound(pattern ? board[pattern[0]] : "draw");
  newGameBtn.innerText = matchOver ? "New Match" : "New Game";
  updateHelpers();
  updateScores();
};

const playMove = (index) => {
  if (gameOver || board[index] !== "") return;

  board[index] = currentPlayer;
  moves.push(index);
  boxes[index].innerText = icon(currentPlayer);
  boxes[index].classList.add(currentPlayer === "O" ? "mark-o" : "mark-x");
  boxes[index].disabled = true;
  sparkle(boxes[index]);
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
  //out of thinking time: this pass is thrown away by bestMove
  if (searchAborted || performance.now() > searchDeadline) {
    searchAborted = true;
    return 0;
  }
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

const randomFrom = (list) => list[Math.floor(Math.random() * list.length)];

//looks one move deeper on every pass until the limit or the thinking time is reached,
//and plays from the last pass that finished. 3x3 is always searched to the end
const bestMove = (depthLimit) => {
  let cells = emptyCells(board);
  let best = [cells[0]];
  searchDeadline = performance.now() + SEARCH_MS;
  searchAborted = false;
  for (let maxDepth = 1; maxDepth <= Math.min(depthLimit, cells.length); maxDepth++) {
    let bestScore = -Infinity;
    let bestCells = [];
    let scored = [];
    for (let i of cells) {
      board[i] = COMPUTER;
      //the window opens just below the best so far, so equally good moves keep exact scores
      let score = minimax(board, HUMAN, 1, maxDepth, bestScore - 1, Infinity);
      board[i] = "";
      scored.push([i, score]);
      if (score > bestScore) {
        bestScore = score;
        bestCells = [i];
      } else if (score === bestScore) {
        bestCells.push(i);
      }
    }
    if (searchAborted) break;
    best = bestCells;
    //a forced win or loss does not change by looking deeper
    if (Math.abs(bestScore) > WIN_SCORE / 2) break;
    //strongest moves first on the next pass, which prunes far more
    cells = scored.sort((a, b) => b[1] - a[1]).map(([i]) => i);
  }
  //pick randomly among equally good moves so games don't repeat
  return randomFrom(best);
};

//easy takes a win and blocks half the time, medium sees two moves ahead, hard thinks as deep as it can
const computerMove = () => {
  if (gameOver) return;
  let index;
  if (difficulty === "hard") {
    index = bestMove(Infinity);
  } else if (difficulty === "medium") {
    index = bestMove(2);
  } else {
    let block = Math.random() < 0.5 ? winningCell(HUMAN) : null;
    index = winningCell(COMPUTER) ?? block ?? randomFrom(emptyCells(board));
  }
  playMove(index);
};

const startRound = () => {
  stopTimers();
  if (matchOver) resetScores();
  moves = [];
  gameEl.querySelector(".win-line")?.remove();
  board = Array(size * size).fill("");
  currentPlayer = startingPlayer;
  gameOver = false;
  for (let box of boxes) {
    box.disabled = false;
    box.innerText = "";
    box.classList.remove("mark-o", "mark-x", "win", "hint");
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
  matchOver = false;
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

//whose scorecard it is: the person on this device, or both players when they share one
const scorecardOwner = () => {
  let played = rounds.length > 0;
  let mark = online ? online.myMark : vsComputer ? HUMAN : "";
  if (mark === "") {
    let leader = scores.O === scores.X ? "" : playerName(scores.O > scores.X ? "O" : "X");
    let badge = "🎮 READY TO PLAY";
    if (leader) badge = `🏆 ${leader.toUpperCase()} LEADS`;
    else if (played) badge = "🤝 ALL LEVEL";
    return {
      mark,
      name: `${playerName("O")} vs ${playerName("X")}`,
      initial: "VS",
      label: "M A T C H   B E T W E E N",
      badge,
      stat: ["Leader", leader || "-"],
    };
  }
  let mine = scores[mark];
  let theirs = scores[mark === "O" ? "X" : "O"];
  let name = names.O || "Guest Player";
  let badge = "🎮 READY TO PLAY";
  if (mine > theirs) badge = "🏆 WINNER";
  else if (mine < theirs) badge = "💪 RUNNER-UP";
  else if (played) badge = "🤝 ALL LEVEL";
  return {
    mark,
    name,
    initial: name[0].toUpperCase(),
    label: "T H I S   S C O R E C A R D   B E L O N G S   T O",
    badge,
    stat: ["Win rate", played ? `${Math.round((mine / rounds.length) * 100)}%` : "-"],
  };
};

//draws the scorecard on a canvas and saves it as a PNG
const downloadScorecard = () => {
  const WIDTH = 900;
  const HEIGHT = 1200;
  const MID = WIDTH / 2;
  const FONT = '"Segoe UI", system-ui, sans-serif';
  const TEXT = "#f4f1de";
  const MUTED = "#a9c4c4";
  const ACCENT = "#2ec4b6";
  const PANEL = "#1b4a52";
  const MARK_COLORS = { O: "#ffd166", X: "#ef6f6c", draw: MUTED };
  let owner = scorecardOwner();
  let canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  let ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  //maxWidth squeezes long text instead of letting it run off the card
  const write = (text, x, y, font, color, maxWidth) => {
    ctx.font = `${font} ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y, maxWidth);
  };

  let bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#1f5660");
  bg.addColorStop(1, "#0d272c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 0.06;
  write("X", 120, 360, "700 280px", MARK_COLORS.X);
  write("O", 780, 1060, "700 280px", MARK_COLORS.O);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(46, 196, 182, 0.5)";
  ctx.lineWidth = 3;
  roundRect(ctx, 24, 24, WIDTH - 48, HEIGHT - 48, 36);
  ctx.stroke();

  write("TIC TAC TOE", MID, 112, "700 60px", TEXT);
  write("S C O R E   C A R D", MID, 152, "600 22px", ACCENT);

  //who the card belongs to
  let ring = ctx.createLinearGradient(MID - 50, 185, MID + 50, 285);
  ring.addColorStop(0, MARK_COLORS.O);
  ring.addColorStop(1, ACCENT);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(MID, 235, 50, 0, Math.PI * 2);
  ctx.fill();
  if (owner.initial.length > 1) write(owner.initial, MID, 247, "700 34px", "#06282c");
  else write(owner.initial, MID, 253, "700 52px", "#06282c");
  write(owner.label, MID, 325, "600 17px", MUTED);
  write(owner.name, MID, 388, "700 58px", MARK_COLORS.O, 760);
  ctx.font = `700 22px ${FONT}`;
  let badgeWidth = ctx.measureText(owner.badge).width + 64;
  ctx.fillStyle = "rgba(46, 196, 182, 0.18)";
  roundRect(ctx, MID - badgeWidth / 2, 412, badgeWidth, 48, 24);
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.stroke();
  write(owner.badge, MID, 444, "700 22px", ACCENT);

  //the two scores, the owner's side is brighter
  for (let [player, x] of [["O", 60], ["X", 470]]) {
    let own = player === owner.mark;
    ctx.fillStyle = own ? "#256069" : PANEL;
    roundRect(ctx, x, 490, 370, 230, 28);
    ctx.fill();
    ctx.strokeStyle = MARK_COLORS[player];
    ctx.lineWidth = own ? 6 : 3;
    ctx.stroke();
    write(own ? owner.name : playerName(player), x + 185, 545, "600 32px", TEXT, 330);
    write(`playing ${player}`, x + 185, 578, "400 20px", MUTED);
    write(scores[player], x + 185, 695, "700 110px", MARK_COLORS[player]);
  }
  ctx.fillStyle = "#12343b";
  ctx.beginPath();
  ctx.arc(MID, 605, 30, 0, Math.PI * 2);
  ctx.fill();
  write("VS", MID, 612, "700 20px", TEXT);

  let stats = [["Rounds", rounds.length], ["Draws", scores.draw], owner.stat];
  stats.forEach(([label, value], i) => {
    let x = 60 + i * 267;
    ctx.fillStyle = PANEL;
    roundRect(ctx, x, 750, 246, 100, 22);
    ctx.fill();
    write(value, x + 123, 798, "700 34px", TEXT, 220);
    write(label, x + 123, 830, "400 18px", MUTED);
  });

  //one coloured dot per round, newest on the right
  write("L A S T   R O U N D S", MID, 905, "600 17px", MUTED);
  let recent = rounds.slice(-10);
  if (recent.length === 0) write("No rounds played yet", MID, 962, "400 24px", TEXT);
  recent.forEach((result, i) => {
    let x = MID - (recent.length - 1) * 31 + i * 62;
    ctx.fillStyle = MARK_COLORS[result];
    ctx.beginPath();
    ctx.arc(x, 955, 24, 0, Math.PI * 2);
    ctx.fill();
    write(result === "draw" ? "=" : result, x, 964, "700 26px", "#06282c");
  });

  let mode = online ? "Online match" : vsComputer ? `vs Computer (${difficulty})` : "2 Players";
  if (seriesLength > 0) mode += `  |  Best of ${seriesLength}`;
  write(`${size} x ${size} board  |  ${mode}`, MID, 1050, "400 24px", TEXT);
  write(new Date().toLocaleString(), MID, 1084, "400 20px", MUTED);
  write("tic-tac-toe-game-mca.netlify.app", MID, 1128, "600 22px", ACCENT);
  write("Made by Jatin Mishra", MID, 1158, "400 18px", MUTED);

  canvas.toBlob((blob) => {
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scorecard-${owner.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
};

//the X box shows the computer or the online friend, who can't be renamed from here
const syncNameInputs = () => {
  nameInputs.O.value = names.O;
  nameInputs.X.value = vsComputer ? "Computer" : online ? online.friend : names.X;
  nameInputs.X.disabled = vsComputer || online !== null;
  nameLabels.O.innerText = online ? `Your name (${icon(online.myMark)})` : "Player O";
  nameLabels.X.innerText = online ? "Friend" : "Player X";
  //only the host picks the board and timer
  let guest = online !== null && online.myMark === "X";
  [...sizeBtns, ...timerBtns, ...seriesBtns].forEach((btn) => (btn.disabled = guest));
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
    if (btn.dataset.mode === "online") {
      if (!online) enterOnline();
      return;
    }
    leaveOnline();
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
    sendOnline({ type: "config", size, turnSeconds, seriesLength, startingPlayer });
  });
});

timerBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    turnSeconds = Number(btn.dataset.seconds);
    setActive(timerBtns, btn);
    startRound();
    sendOnline({ type: "config", size, turnSeconds, seriesLength, startingPlayer });
  });
});

seriesBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    seriesLength = Number(btn.dataset.series);
    setActive(seriesBtns, btn);
    updateRule();
    startingPlayer = "O";
    resetScores();
    startRound();
    sendOnline({ type: "config", size, turnSeconds, seriesLength, startingPlayer });
  });
});

const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  themeBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.theme === theme));
};

themeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    setTheme(btn.dataset.theme);
    save("ttt-theme", btn.dataset.theme);
  });
});

undoBtn.addEventListener("click", undoMove);
hintBtn.addEventListener("click", showHint);

//each device picks its own mark style, so online friends can use different ones
const setMarks = (name) => {
  markSet = MARK_SETS[name] ? name : "classic";
  markBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.marks === markSet));
  board.forEach((mark, i) => {
    if (mark !== "") boxes[i].innerText = icon(mark);
  });
  syncNameInputs();
  updateScores();
};

markBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    setMarks(btn.dataset.marks);
    save("ttt-marks", markSet);
  });
});

//online, the friend's device repeats whatever these buttons do
newGameBtn.addEventListener("click", () => {
  newGame();
  sendOnline({ type: "round", startingPlayer });
});
resetBtn.addEventListener("click", () => {
  resetGame();
  sendOnline({ type: "round", startingPlayer });
});
scoreResetBtn.addEventListener("click", () => {
  resetScores();
  sendOnline({ type: "scores" });
});
downloadBtns.forEach((btn) => btn.addEventListener("click", downloadScorecard));

for (let player of ["O", "X"]) {
  nameInputs[player].addEventListener("input", () => {
    names[player] = nameInputs[player].value.trim();
    save(`ttt-name-${player}`, names[player]);
    if (player === "O") sendOnline({ type: "name", name: names.O });
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
    mark.style.setProperty("--dur", `${12 + Math.random() * 14}s`);
    mark.style.animationDelay = `${-Math.random() * 20}s`;
    floaters.appendChild(mark);
  }
};

//players dashboard: every finished round is kept on this device (newest last)
const HISTORY_KEY = "ttt-history";
const HISTORY_MAX = 500;
const MODES = {
  pvp: { label: "2 Players", color: "var(--accent)" },
  cpu: { label: "vs Computer", color: "var(--color-o)" },
  online: { label: "Online", color: "var(--color-x)" },
};
let dash = document.querySelector("#dash");
let dashTip = document.querySelector("#dash-tip");

const loadHistory = () => {
  try {
    let list = JSON.parse(load(HISTORY_KEY, "[]"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const recordRound = (winner) => {
  let history = loadHistory();
  history.push({
    t: Date.now(),
    o: playerName("O"),
    x: playerName("X"),
    w: winner,
    mode: online ? "online" : vsComputer ? "cpu" : "pvp",
    level: vsComputer ? difficulty : "",
    size,
  });
  save(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_MAX)));
};

const timeAgo = (t) => {
  let minutes = Math.floor((Date.now() - t) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  let hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString();
};

const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);

//builds an element with text, so player names never become HTML
const el = (tag, className, text) => {
  let node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.innerText = text;
  return node;
};

const playerStats = (history) => {
  let stats = new Map();
  for (let round of history) {
    for (let [mark, name] of [["O", round.o], ["X", round.x]]) {
      let s = stats.get(name) || { name, played: 0, won: 0, lost: 0, draw: 0 };
      s.played++;
      if (round.w === "draw") s.draw++;
      else if (round.w === mark) s.won++;
      else s.lost++;
      stats.set(name, s);
    }
  }
  return [...stats.values()].sort((a, b) => b.won - a.won || b.won / b.played - a.won / a.played);
};

const showTip = (target, text) => {
  dashTip.innerText = text;
  dashTip.classList.remove("hide");
  let box = target.getBoundingClientRect();
  dashTip.style.left = `${box.left + box.width / 2}px`;
  dashTip.style.top = `${box.top - 8}px`;
};

const hideTip = () => dashTip.classList.add("hide");

//hover and keyboard focus both show the tooltip
const withTip = (node, text) => {
  node.tabIndex = 0;
  node.setAttribute("aria-label", text);
  node.addEventListener("mouseenter", () => showTip(node, text));
  node.addEventListener("focus", () => showTip(node, text));
  node.addEventListener("mouseleave", hideTip);
  node.addEventListener("blur", hideTip);
};

const renderDashboard = () => {
  let history = loadHistory();
  let empty = history.length === 0;
  document.querySelector("#dash-empty").classList.toggle("hide", !empty);
  document.querySelector("#dash-body").classList.toggle("hide", empty);
  if (empty) return;

  let players = playerStats(history);
  let today = startOfDay(Date.now());
  let draws = history.filter((round) => round.w === "draw").length;
  document.querySelector("#dash-games").innerText = history.length;
  document.querySelector("#dash-players").innerText = players.length;
  document.querySelector("#dash-today").innerText = history.filter((round) => round.t >= today).length;
  document.querySelector("#dash-draws").innerText = `${Math.round((draws / history.length) * 100)}%`;

  let leaders = document.querySelector("#dash-leaders");
  leaders.innerHTML = "";
  players.slice(0, 10).forEach((s, i) => {
    let row = el("tr");
    let rate = Math.round((s.won / s.played) * 100);
    row.append(el("td", "dash-rank", ["🥇", "🥈", "🥉"][i] || i + 1));
    row.append(el("td", "dash-name", s.name));
    for (let value of [s.played, s.won, s.lost, s.draw]) row.append(el("td", "", value));
    let rateCell = el("td", "dash-rate");
    let meter = el("span", "dash-meter");
    let fill = el("span");
    fill.style.width = `${rate}%`;
    meter.append(fill);
    rateCell.append(meter, el("span", "", `${rate}%`));
    row.append(rateCell);
    leaders.append(row);
  });

  //one bar per day, oldest on the left
  let week = document.querySelector("#dash-week");
  week.innerHTML = "";
  let days = [];
  for (let k = 6; k >= 0; k--) {
    let start = new Date(today);
    start.setDate(start.getDate() - k);
    let end = new Date(start);
    end.setDate(end.getDate() + 1);
    let count = history.filter((round) => round.t >= start && round.t < end).length;
    days.push({ start, count });
  }
  let most = Math.max(1, ...days.map((day) => day.count));
  for (let { start, count } of days) {
    let col = el("div", "dash-col");
    let label = (format) => start.toLocaleDateString(undefined, format);
    let bar = el("div", "dash-bar");
    bar.style.height = `${(count / most) * 100}%`;
    let track = el("div", "dash-track");
    track.append(el("span", "dash-count", count || ""), bar);
    withTip(track, `${label({ weekday: "long", day: "numeric", month: "short" })}: ${count} game${count === 1 ? "" : "s"}`);
    col.append(track, el("span", "dash-day", label({ weekday: "short" })));
    week.append(col);
  }

  //share of rounds per game mode, with a legend so colour is never the only clue
  let split = document.querySelector("#dash-split");
  let legend = document.querySelector("#dash-legend");
  split.innerHTML = "";
  legend.innerHTML = "";
  for (let [key, { label, color }] of Object.entries(MODES)) {
    let count = history.filter((round) => round.mode === key).length;
    let share = Math.round((count / history.length) * 100);
    if (count > 0) {
      let part = el("span", "dash-part");
      part.style.flexGrow = count;
      part.style.backgroundColor = color;
      withTip(part, `${label}: ${count} games (${share}%)`);
      split.append(part);
    }
    let item = el("li");
    let swatch = el("span", "dash-swatch");
    swatch.style.backgroundColor = color;
    item.append(swatch, el("span", "", label), el("strong", "", `${count} · ${share}%`));
    legend.append(item);
  }

  let recent = document.querySelector("#dash-recent");
  recent.innerHTML = "";
  for (let round of history.slice(-10).reverse()) {
    let item = el("li");
    let match = el("span", "dash-match");
    match.append(
      el("span", round.w === "O" ? "dash-winner" : "", `${round.o}${round.w === "O" ? " 🏆" : ""}`),
      el("span", "dash-vs", "vs"),
      el("span", round.w === "X" ? "dash-winner" : "", `${round.x}${round.w === "X" ? " 🏆" : ""}`)
    );
    if (round.w === "draw") match.append(el("span", "dash-tag", "Draw"));
    let mode = (MODES[round.mode] || MODES.pvp).label + (round.level ? ` (${round.level})` : "");
    item.append(match, el("span", "dash-meta", `${round.size} x ${round.size} · ${mode} · ${timeAgo(round.t)}`));
    recent.append(item);
  }
};

const openDashboard = (open) => {
  hideTip();
  dash.classList.toggle("hide", !open);
  if (open) {
    closePanels();
    renderDashboard();
    document.querySelector("#dash-close").focus();
  }
};

document.querySelector("#dash-btn").addEventListener("click", () => openDashboard(true));
document.querySelector("#dash-close").addEventListener("click", () => openDashboard(false));
dash.addEventListener("click", (event) => {
  if (event.target === dash) openDashboard(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dash.classList.contains("hide")) openDashboard(false);
});
dash.addEventListener("scroll", hideTip);
document.querySelector("#dash-clear").addEventListener("click", () => {
  if (!confirm("Delete all saved rounds from this device?")) return;
  save(HISTORY_KEY, "[]");
  renderDashboard();
});

const cleanName = (value) => String(value ?? "").trim().slice(0, 12);

const clearRoomFromUrl = () => history.replaceState(null, "", location.pathname);

//note goes in the setup panel, status is the short line above the board
const setNote = (note, status) => {
  online.status = status;
  onlineNote.innerText = note;
  shareText.innerText = note;
  updateOnlineBtn();
  if (!online.connected) updateStatus();
};

const updateOnlineBtn = () => {
  if (!online) onlineBtn.innerText = "🌐 Play Online";
  else onlineBtn.innerText = online.connected ? "🟢 Online" : "⏳ Waiting";
};

//the invite link lives in the setup panel and in the invite popup
const showInvite = (visible) => {
  inviteEl.classList.toggle("hide", !visible);
  shareReady.classList.toggle("hide", !visible);
};

const setInviteLink = (url) => {
  inviteLink.value = url;
  shareLink.value = url;
  whatsappBtn.href = `https://wa.me/?text=${encodeURIComponent(`Play Tic Tac Toe with me! ${url}`)}`;
};

//one popup for both sides: the guest's "send request" and the host's "accept"
const askModal = ({ title, text, yes, no, withName, onYes, onNo }) => {
  inviteTitle.innerText = title;
  inviteText.innerText = text;
  inviteYes.innerText = yes;
  inviteNo.innerText = no;
  joinField.classList.toggle("hide", !withName);
  modalActions = { onYes, onNo };
  inviteModal.classList.remove("hide");
};

inviteYes.addEventListener("click", () => {
  inviteModal.classList.add("hide");
  modalActions.onYes();
});
inviteNo.addEventListener("click", () => {
  inviteModal.classList.add("hide");
  modalActions.onNo();
});

//chat between the two online players
let unread = 0;

const showUnread = (count) => {
  unread = count;
  chatBtn.dataset.unread = count;
};

const openChat = (open) => {
  chatBox.classList.toggle("hide", !open);
  if (!open) return;
  showUnread(0);
  chatLog.scrollTop = chatLog.scrollHeight;
  //on phones focusing would pop the keyboard over the board
  if (window.matchMedia("(min-width: 960px)").matches) chatInput.focus();
};

const addChatLine = (text, mine) => {
  let line = document.createElement("p");
  line.className = mine ? "chat-line mine" : "chat-line";
  line.innerText = text;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
};

//a message that is only an emoji or two also flies up the screen on both devices
const showReaction = (text) => {
  if (/[\x00-\x7F]/.test(text) || [...text].length > 4 || reducedMotion()) return;
  for (let k = 0; k < 7; k++) {
    let emoji = document.createElement("span");
    emoji.className = "reaction";
    emoji.innerText = text;
    emoji.style.left = `${5 + Math.random() * 85}%`;
    emoji.style.animationDelay = `${k * 0.12}s`;
    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 3600);
  }
};

const sendChat = (text) => {
  text = text.trim().slice(0, 200);
  if (text === "" || !online || !online.connected) return;
  sendOnline({ type: "chat", text });
  addChatLine(text, true);
  showReaction(text);
};

const receiveChat = (text) => {
  text = String(text ?? "").trim().slice(0, 200);
  if (text === "") return;
  addChatLine(text, false);
  showReaction(text);
  if (chatBox.classList.contains("hide")) showUnread(unread + 1);
  playSound("chat");
};

//the chat button only shows during an online match, and every match starts with an empty chat
const setChat = (available) => {
  chatBtn.classList.toggle("hide", !available);
  //the background comes alive while the two players are connected
  document.body.classList.toggle("live", available);
  showUnread(0);
  if (available) {
    chatLog.innerHTML = "";
    chatTitle.innerText = `Chat with ${online.friend || "Friend"}`;
  } else {
    openChat(false);
  }
};

chatBtn.addEventListener("click", () => openChat(chatBox.classList.contains("hide")));
document.querySelector("#chat-close").addEventListener("click", () => openChat(false));
chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendChat(chatInput.value);
  chatInput.value = "";
});
document.querySelectorAll(".chat-quick button").forEach((btn) => {
  btn.addEventListener("click", () => sendChat(btn.innerText));
});

const startMatch = () => {
  setChat(true);
  setNote(`Connected with ${playerName(online.myMark === "O" ? "X" : "O")}. Have fun!`, "");
  showInvite(false);
  closePanels();
  syncNameInputs();
  startingPlayer = "O";
  resetScores();
  startRound();
};

const applyConfig = (message) => {
  if ([3, 4, 5].includes(message.size) && message.size !== size) {
    size = message.size;
    buildBoard();
    resetScores();
  }
  if ([0, 5, 10].includes(message.turnSeconds)) turnSeconds = message.turnSeconds;
  if ([0, 3, 5].includes(message.seriesLength) && message.seriesLength !== seriesLength) {
    seriesLength = message.seriesLength;
    resetScores();
    updateRule();
  }
  seriesBtns.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.series) === seriesLength));
  sizeBtns.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.size) === size));
  timerBtns.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.seconds) === turnSeconds));
  startingPlayer = message.startingPlayer === "X" ? "X" : "O";
};

const connectionClosed = (conn) => {
  if (conn === pendingConn) {
    pendingConn = null;
    inviteModal.classList.add("hide");
  }
  if (!online || conn !== online.conn) return;
  online.connected = false;
  online.conn = null;
  online.friend = "";
  stopTimers();
  setChat(false);
  if (online.myMark === "O") {
    showInvite(true);
    setNote("Your friend left. Share the link to play again.", "Waiting for a friend to join...");
  } else if (!online.refused) {
    setNote("The connection to your friend was lost. Ask for a new link to play again.", "Disconnected");
  }
  syncNameInputs();
  updateScores();
};

//everything the other device can tell us
const handleMessage = (message) => {
  if (!online || !message) return;
  if (!online.connected) {
    if (online.myMark !== "X") return;
    if (message.type === "accept") {
      online.connected = true;
      online.friend = cleanName(message.name);
      applyConfig(message);
      startMatch();
    } else if (message.type === "decline" || message.type === "busy") {
      online.refused = true;
      let busy = message.type === "busy";
      setNote(
        busy ? "This room already has two players." : "Your friend declined the request.",
        busy ? "Room is full" : "Request declined"
      );
    }
    return;
  }
  switch (message.type) {
    case "move":
      if (currentPlayer !== online.myMark) playMove(message.index);
      break;
    case "skip":
      if (currentPlayer !== online.myMark && !gameOver) {
        currentPlayer = online.myMark;
        beginTurn();
      }
      break;
    case "round":
      startingPlayer = message.startingPlayer === "X" ? "X" : "O";
      startRound();
      break;
    case "scores":
      resetScores();
      break;
    case "config":
      if (online.myMark === "X") {
        applyConfig(message);
        startRound();
      }
      break;
    case "name":
      online.friend = cleanName(message.name);
      syncNameInputs();
      updateScores();
      if (!gameOver) updateStatus();
      break;
    case "chat":
      receiveChat(message.text);
      break;
    case "bye":
      connectionClosed(online.conn);
      break;
  }
};

const onlineError = (peer, err) => {
  if (!online || online.peer !== peer || online.connected) return;
  if (err.type === "peer-unavailable") {
    online.refused = true;
    setNote("This invite link is no longer active. Ask your friend for a new one.", "Link expired");
  } else {
    setNote("Could not connect. Check your internet and try again.", "Not connected");
  }
};

//host: open a room and wait for a friend's request
const hostRoom = () => {
  let code = Math.random().toString(36).slice(2, 8);
  setNote("Creating your room...", "Creating your room...");
  let peer = (online.peer = new Peer(ROOM_PREFIX + code));
  peer.on("open", () => {
    if (!online || online.peer !== peer) return;
    setInviteLink(`${location.origin}${location.pathname}?room=${code}`);
    showInvite(true);
    setNote(
      "Send this link to a friend. The match starts when you accept their request.",
      "Waiting for a friend to join..."
    );
  });
  peer.on("connection", (conn) => {
    conn.on("data", (message) => {
      if (!online || online.peer !== peer || !message) return;
      if (conn === online.conn) return handleMessage(message);
      if (message.type !== "join") return;
      if (online.connected || pendingConn) return conn.send({ type: "busy" });
      let friend = cleanName(message.name);
      pendingConn = conn;
      shareModal.classList.add("hide");
      askModal({
        title: `${friend || "A friend"} wants to play`,
        text: "Accept the request to start the match.",
        yes: "Accept",
        no: "Decline",
        withName: false,
        onYes: () => {
          pendingConn = null;
          online.conn = conn;
          online.connected = true;
          online.friend = friend;
          startingPlayer = "O";
          conn.send({ type: "accept", name: names.O, size, turnSeconds, seriesLength, startingPlayer });
          startMatch();
        },
        onNo: () => {
          pendingConn = null;
          conn.send({ type: "decline" });
        },
      });
    });
    conn.on("close", () => connectionClosed(conn));
  });
  //the room stays listed only while the link to the server is up
  peer.on("disconnected", () => {
    if (!peer.destroyed) peer.reconnect();
  });
  peer.on("error", (err) => {
    if (err.type === "unavailable-id" && online && online.peer === peer) {
      peer.destroy();
      hostRoom();
    } else {
      onlineError(peer, err);
    }
  });
};

//guest: connect to the host's room and ask to play
const joinRoom = (code) => {
  setNote("Connecting to your friend...", "Connecting...");
  let peer = (online.peer = new Peer());
  peer.on("open", () => {
    if (!online || online.peer !== peer) return;
    let conn = (online.conn = peer.connect(ROOM_PREFIX + code, { reliable: true }));
    conn.on("open", () => {
      conn.send({ type: "join", name: names.O });
      setNote("Request sent. The match starts when your friend accepts.", "Waiting for your friend to accept...");
    });
    conn.on("data", handleMessage);
    conn.on("close", () => connectionClosed(conn));
  });
  peer.on("error", (err) => onlineError(peer, err));
};

const enterOnline = (joinCode) => {
  vsComputer = false;
  online = { peer: null, conn: null, myMark: joinCode ? "X" : "O", connected: false, friend: "", status: "", refused: false };
  modeBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === "online"));
  levelToggle.classList.add("hide");
  onlineBox.classList.remove("hide");
  showInvite(false);
  //the host goes straight to the invite popup
  shareModal.classList.toggle("hide", Boolean(joinCode));
  closePanels();
  syncNameInputs();
  startingPlayer = "O";
  resetScores();
  startRound();
  if (typeof Peer === "undefined") {
    setNote("Online play needs internet. Reload the page and try again.", "Not connected");
  } else if (joinCode) {
    joinRoom(joinCode);
  } else {
    hostRoom();
  }
};

const leaveOnline = () => {
  if (!online) return;
  sendOnline({ type: "bye" });
  let peer = online.peer;
  online = null;
  pendingConn = null;
  if (peer) peer.destroy();
  onlineBox.classList.add("hide");
  inviteModal.classList.add("hide");
  setChat(false);
  shareModal.classList.add("hide");
  updateOnlineBtn();
  clearRoomFromUrl();
};

leaveBtn.addEventListener("click", () => modeBtns[0].click());
window.addEventListener("pagehide", () => sendOnline({ type: "bye" }));

//top bar shortcut: start an online room, or reopen the invite while still waiting
onlineBtn.addEventListener("click", () => {
  if (!online) enterOnline();
  else if (online.myMark === "O" && !online.connected) shareModal.classList.remove("hide");
});
document.querySelector("#share-close").addEventListener("click", () => shareModal.classList.add("hide"));

//the same copy and share buttons sit in the setup panel and in the invite popup
const copyInvite = async (btn, input) => {
  try {
    await navigator.clipboard.writeText(input.value);
    btn.innerText = "Copied!";
    setTimeout(() => (btn.innerText = "Copy link"), 1500);
  } catch {
    //no clipboard access: select it so the player can copy by hand
    input.select();
  }
};
copyBtn.addEventListener("click", () => copyInvite(copyBtn, inviteLink));
let shareCopyBtn = document.querySelector("#share-copy-btn");
shareCopyBtn.addEventListener("click", () => copyInvite(shareCopyBtn, shareLink));

if (navigator.share) {
  for (let btn of [shareBtn, document.querySelector("#share-native-btn")]) {
    btn.classList.remove("hide");
    btn.addEventListener("click", () => {
      navigator
        .share({ title: "Tic Tac Toe", text: "Play Tic Tac Toe with me!", url: inviteLink.value })
        .catch(() => {});
    });
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) document.title = PAGE_TITLE;
});

//repeat the ticker items so the strip loops without a gap
let tickerTrack = document.querySelector(".ticker-track");
tickerTrack.innerHTML += tickerTrack.innerHTML;

startSlider();
buildFloaters();

names.O = load("ttt-name-O", "");
names.X = load("ttt-name-X", "");
soundOn = load("ttt-sound", "on") === "on";
setTheme(load("ttt-theme", "teal"));
setMarks(load("ttt-marks", "classic"));
syncNameInputs();
updateSoundBtn();

buildBoard();
updateScores();
startRound();

//opened from a friend's invite link
let invitedRoom = new URLSearchParams(location.search).get("room");
if (/^[a-z0-9]{4,10}$/.test(invitedRoom || "")) {
  joinName.value = names.O;
  askModal({
    title: "You're invited!",
    text: "Enter your name and send a request to play.",
    yes: "Send request",
    no: "Not now",
    withName: true,
    onYes: () => {
      names.O = cleanName(joinName.value);
      save("ttt-name-O", names.O);
      enterOnline(invitedRoom);
    },
    onNo: clearRoomFromUrl,
  });
}
