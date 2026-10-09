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
  if (!vsComputer) return `Player ${player}`;
  return player === HUMAN ? "You" : "Computer";
};

const isComputerTurn = () => vsComputer && currentPlayer === COMPUTER;

const updateStatus = () => {
  let text;
  if (isComputerTurn()) {
    text = "Computer is thinking...";
  } else if (vsComputer) {
    text = "Your turn";
  } else {
    text = `Player ${currentPlayer}'s turn`;
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
  document.querySelector("#name-o").innerText = vsComputer ? "You (O)" : "Player O";
  document.querySelector("#name-x").innerText = vsComputer ? "Computer (X)" : "Player X";
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

const showResult = (text) => {
  statusText.innerText = text;
  statusText.classList.remove("hurry");
  //short delay so the winning line is visible before the popup
  timer = setTimeout(() => {
    msg.innerText = text;
    msgContainer.classList.remove("hide");
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
    let name = playerName(winner);
    showResult(name === "You" ? "You win!" : `${name} wins!`);
  } else {
    scores.draw++;
    showResult("It's a draw.");
  }
  updateScores();
};

const playMove = (index) => {
  if (gameOver || board[index] !== "") return;

  board[index] = currentPlayer;
  boxes[index].innerText = currentPlayer;
  boxes[index].classList.add(currentPlayer === "O" ? "mark-o" : "mark-x");
  boxes[index].disabled = true;

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
  updateScores();
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

buildBoard();
updateScores();
startRound();
