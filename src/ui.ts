/* DOM layer: grid rendering, keyboard input, pencil notes, hint button,
 * difficulty selector, mistake checking and print-to-PDF. */

import {
  autoNotes,
  fromLine,
  generate,
  hint,
  isSolved,
  makeRng,
  type DifficultyName,
  type Grid,
  type Puzzle,
} from "./core.ts";

const STORAGE_KEY = "sudoku-web-saved";

let puzzle: Grid = new Array(81).fill(0);
let solution: Grid = new Array(81).fill(0);
let user: Grid = new Array(81).fill(0);
let notes: Map<number, Set<number>> = new Map();
let selected = -1;
let noteMode = false;
let hintsUsed = 0;

function newGame(difficulty: DifficultyName): void {
  const rng = makeRng((Date.now() & 0x7fffffff) || 1);
  const result: Puzzle = generate(difficulty, rng);
  puzzle = result.puzzle;
  solution = result.solution;
  user = [...puzzle];
  notes = new Map();
  hintsUsed = 0;
  selected = -1;
  persist();
  paint();
}

function persist(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ puzzle, solution, user, hintsUsed }),
    );
  } catch {
    /* private mode: play without saving */
  }
}

function restore(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as {
      puzzle: Grid; solution: Grid; user: Grid; hintsUsed: number;
    };
    if (!saved.puzzle || saved.puzzle.length !== 81) return false;
    puzzle = saved.puzzle;
    solution = saved.solution;
    user = saved.user;
    hintsUsed = saved.hintsUsed ?? 0;
    notes = new Map();
    return true;
  } catch {
    return false;
  }
}

function buildBoard(): void {
  const boardEl = document.getElementById("board") as HTMLElement;
  boardEl.innerHTML = "";
  for (let cell = 0; cell < 81; cell++) {
    const cellEl = document.createElement("div");
    cellEl.className = "cell";
    cellEl.dataset.cell = String(cell);
    cellEl.addEventListener("click", () => {
      selected = cell;
      paint();
    });
    boardEl.appendChild(cellEl);
    if (cell % 9 === 8 && cell % 27 !== 26) {
      const gap = document.createElement("div");
      gap.className = "vgap";
      boardEl.appendChild(gap);
    }
    if (cell % 27 === 26 && cell !== 80) {
      const gap = document.createElement("div");
      gap.className = "hgap-full";
      boardEl.appendChild(gap);
    }
  }
}

function paint(): void {
  const cells = document.querySelectorAll<HTMLDivElement>("#board .cell");
  cells.forEach((cellEl) => {
    const cell = Number(cellEl.dataset.cell);
    const given = puzzle[cell] !== 0;
    const value = given ? puzzle[cell] : user[cell];
    cellEl.classList.toggle("given", given);
    cellEl.classList.toggle("selected", cell === selected);
    cellEl.classList.toggle(
      "wrong",
      !given && user[cell] !== 0 && user[cell] !== solution[cell],
    );
    if (value !== 0) {
      cellEl.textContent = String(value);
      cellEl.classList.remove("notes");
    } else {
      const noteSet = notes.get(cell);
      cellEl.textContent = noteSet && noteSet.size > 0 ? [...noteSet].sort().join("") : "";
      cellEl.classList.toggle("notes", !!noteSet && noteSet.size > 0);
    }
  });
  const status = document.getElementById("status") as HTMLElement;
  const filled = user.filter((v) => v !== 0).length;
  status.textContent =
    `filled ${filled}/81 · hints ${hintsUsed}` +
    (isSolved(user, solution) ? " — SOLVED ✔" : "");
}

function onDigit(digit: number): void {
  if (selected === -1 || puzzle[selected] !== 0) return;
  if (noteMode) {
    const noteSet = notes.get(selected) ?? new Set<number>();
    if (noteSet.has(digit)) {
      noteSet.delete(digit);
    } else {
      noteSet.add(digit);
    }
    notes.set(selected, noteSet);
    user[selected] = 0;
  } else {
    user[selected] = digit;
    // clear the cell's notes once a real digit is placed
    notes.delete(selected);
    if (isSolved(user, solution)) {
      persist();
    }
  }
  persist();
  paint();
}

function useHint(): void {
  const grid = [...puzzle];
  for (let i = 0; i < 81; i++) {
    if (user[i] !== 0) grid[i] = user[i];
  }
  const cell = hint(grid, solution);
  if (cell === null) return;
  hintsUsed++;
  user[cell] = solution[cell] as number;
  notes.delete(cell);
  persist();
  paint();
}

function setup(): void {
  buildBoard();
  if (!restore()) {
    newGame("easy");
  }
  paint();

  document.getElementById("new-easy")?.addEventListener("click", () => newGame("easy"));
  document.getElementById("new-medium")?.addEventListener("click", () => newGame("medium"));
  document.getElementById("new-hard")?.addEventListener("click", () => newGame("hard"));
  document.getElementById("hint")?.addEventListener("click", useHint);
  document.getElementById("solve")?.addEventListener("click", () => {
    user = [...solution];
    persist();
    paint();
  });
  document.getElementById("print")?.addEventListener("click", () => window.print());
  document.getElementById("note-mode")?.addEventListener("click", () => {
    noteMode = !noteMode;
    (document.getElementById("note-mode") as HTMLButtonElement).classList.toggle(
      "active",
      noteMode,
    );
  });
  document.getElementById("load-line")?.addEventListener("click", () => {
    const line = (document.getElementById("grid-line") as HTMLInputElement).value;
    try {
      puzzle = fromLine(line);
      solution = solve(puzzle) ?? [...puzzle];
      user = [...puzzle];
      persist();
      paint();
    } catch (error) {
      alert(String(error));
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key >= "1" && event.key <= "9") {
      onDigit(Number(event.key));
    } else if (event.key.toLowerCase() === "n") {
      noteMode = !noteMode;
      (document.getElementById("note-mode") as HTMLButtonElement).classList.toggle(
        "active",
        noteMode,
      );
    } else if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      if (selected === -1) selected = 40;
      else {
        const col = selected % 9;
        const row = Math.floor(selected / 9);
        if (event.key === "ArrowLeft" && col > 0) selected--;
        if (event.key === "ArrowRight" && col < 8) selected++;
        if (event.key === "ArrowUp" && row > 0) selected -= 9;
        if (event.key === "ArrowDown" && row < 8) selected += 9;
      }
      paint();
    }
  });
}

if (typeof document !== "undefined" && document.getElementById("board")) {
  setup();
}
