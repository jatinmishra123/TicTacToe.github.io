let boxes = document.querySelectorAll(".box");
let resetBtn = document.querySelector("#reset-btn");
let newGameBtn = document.querySelector("#new-btn");
let scoreResetBtn = document.querySelector("#score-reset-btn");
let msgContainer = document.querySelector(".msg-container");
let msg = document.querySelector("#msg");
let statusText = document.querySelector("#status");
let modeBtns = document.querySelectorAll("#mode-toggle .toggle-btn");
let levelToggle = document.querySelector("#level-toggle");
let levelBtns = document.querySelectorAll("#level-toggle .toggle-btn");

const HUMAN = "O";
const COMPUTER = "X";

let board = Array(9).fill(""); //single source of truth for the game
let currentPlayer = "O";
let startingPlayer = "O"; //alternates every new game
let gameOver = false;
let vsComputer = false;
let difficulty = "hard";
let scores = { O: 0, X: 0, draw: 0 };
let timer = null; //pending computer move or result popup

const winPatterns = [
  [0, 1, 2],
  [0, 3, 6],
  [0, 4, 8],
  [1, 4, 7],
  [2, 5, 8],
  [2, 4, 6],
  [3, 4, 5],
  [6, 7, 8],
];

const getWinPattern = (b) => {
  for (let pattern of winPatterns) {
    let [a, c, d] = pattern;
    if (b[a] !== "" && b[a] === b[c] && b[c] === b[d]) {
      return pattern;
    }
  }
  return null;
};

const emptyCells = (b) => {
  let cells = [];
  for (let i = 0; i < b.length; i++) {
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
  if (isComputerTurn()) {
    statusText.innerText = "Computer is thinking...";
  } else if (vsComputer) {
    statusText.innerText = "Your turn";
  } else {
    statusText.innerText = `Player ${currentPlayer}'s turn`;
  }
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

const showResult = (text) => {
  statusText.innerText = text;
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
  updateStatus();

  if (isComputerTurn()) {
    timer = setTimeout(computerMove, 450);
  }
};

//minimax with alpha-beta pruning; faster wins and slower losses score better
const minimax = (b, player, depth, alpha, beta) => {
  let pattern = getWinPattern(b);
  if (pattern) {
    return b[pattern[0]] === COMPUTER ? 10 - depth : depth - 10;
  }
  let cells = emptyCells(b);
  if (cells.length === 0) return 0;

  if (player === COMPUTER) {
    let best = -Infinity;
    for (let i of cells) {
      b[i] = COMPUTER;
      best = Math.max(best, minimax(b, HUMAN, depth + 1, alpha, beta));
      b[i] = "";
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i of cells) {
      b[i] = HUMAN;
      best = Math.min(best, minimax(b, COMPUTER, depth + 1, alpha, beta));
      b[i] = "";
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
};

const randomFrom = (list) => list[Math.floor(Math.random() * list.length)];

const bestMove = () => {
  let cells = emptyCells(board);
  let bestScore = -Infinity;
  let bestCells = [];
  for (let i of cells) {
    board[i] = COMPUTER;
    let score = minimax(board, HUMAN, 1, -Infinity, Infinity);
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
  clearTimeout(timer);
  board = Array(9).fill("");
  currentPlayer = startingPlayer;
  gameOver = false;
  for (let box of boxes) {
    box.disabled = false;
    box.innerText = "";
    box.classList.remove("mark-o", "mark-x", "win");
  }
  msgContainer.classList.add("hide");
  updateStatus();

  if (isComputerTurn()) {
    timer = setTimeout(computerMove, 450);
  }
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

boxes.forEach((box, index) => {
  box.addEventListener("click", () => {
    if (isComputerTurn()) return;
    playMove(index);
  });
});

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

newGameBtn.addEventListener("click", newGame);
resetBtn.addEventListener("click", resetGame);
scoreResetBtn.addEventListener("click", resetScores);

updateScores();
updateStatus();
