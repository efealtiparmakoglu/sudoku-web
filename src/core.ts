/* Pure Sudoku core: solver, uniqueness counting, generator with
 * difficulty targets, hint logic and pencil-note helpers.
 * No DOM — fully unit-tested in Node. */

export type Grid = number[]; // 81 values, 0 = empty, row-major

export const ROWS = 9;

export function idx(row: number, col: number): number {
  return row * 9 + col;
}

export function peersOf(cell: number): number[] {
  const row = Math.floor(cell / 9);
  const col = cell % 9;
  const peers = new Set<number>();
  for (let i = 0; i < 9; i++) {
    peers.add(idx(row, i));
    peers.add(idx(i, col));
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      peers.add(idx(r, c));
    }
  }
  peers.delete(cell);
  return [...peers];
}

/** Candidates for a cell given the current grid. */
export function candidates(grid: Grid, cell: number): number[] {
  const used = new Set<number>();
  for (const p of peersOf(cell)) {
    if (grid[p] !== 0) used.add(grid[p] as number);
  }
  const out: number[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    if (!used.has(digit)) out.push(digit);
  }
  return out;
}

/** Solve with constraint-friendly backtracking; returns the solution or
 * null. `randomize` shuffles digit order (used by the generator). */
export function solve(input: Grid, randomize = false, rng: () => number = Math.random): Grid | null {
  const grid = [...input];
  const order = randomOrderCells(grid);
  return backtrack(grid, order, 0, randomize, rng);
}

function randomOrderCells(grid: Grid): number[] {
  const empties: number[] = [];
  for (let cell = 0; cell < 81; cell++) {
    if (grid[cell] === 0) empties.push(cell);
  }
  // most-constrained first: fewest candidates
  return empties.sort(
    (a, b) => candidates(grid, a).length - candidates(grid, b).length,
  );
}

function backtrack(
  grid: Grid,
  empties: number[],
  pos: number,
  randomize: boolean,
  rng: () => number,
): Grid | null {
  if (pos >= empties.length) return grid;
  // re-sort tail for MRV every 12 assignments (cheap heuristic refresh)
  if (pos > 0 && pos % 12 === 0) {
    const tail = empties.slice(pos).sort(
      (a, b) => candidates(grid, a).length - candidates(grid, b).length,
    );
    for (let i = 0; i < tail.length; i++) empties[pos + i] = tail[i] as number;
  }
  const cell = empties[pos] as number;
  let digits = candidates(grid, cell);
  if (randomize) digits = shuffle(digits, rng);
  for (const digit of digits) {
    grid[cell] = digit;
    const result = backtrack(grid, empties, pos + 1, randomize, rng);
    if (result) return result;
    grid[cell] = 0;
  }
  return null;
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** Count solutions up to `limit` (used for uniqueness). */
export function countSolutions(input: Grid, limit = 2): number {
  const grid = [...input];
  let count = 0;
  const walk = (): void => {
    if (count >= limit) return;
    let best = -1;
    let bestCandidates: number[] = [];
    for (let cell = 0; cell < 81; cell++) {
      if (grid[cell] !== 0) continue;
      const cands = candidates(grid, cell);
      if (cands.length === 0) return; // dead end
      if (best === -1 || cands.length < bestCandidates.length) {
        best = cell;
        bestCandidates = cands;
        if (cands.length === 1) break;
      }
    }
    if (best === -1) {
      count++; // complete
      return;
    }
    for (const digit of bestCandidates) {
      grid[best] = digit;
      walk();
      grid[best] = 0;
      if (count >= limit) return;
    }
  };
  walk();
  return count;
}

/** Deterministic RNG (xorshift) for reproducible puzzles. */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  givens: number;
}

export type DifficultyName = "easy" | "medium" | "hard";

const CLUE_TARGETS: Record<DifficultyName, number> = {
  easy: 40,
  medium: 32,
  hard: 26,
};

/**
 * Generate a puzzle: fill a full random solution, then remove clues in
 * random order while the puzzle stays uniquely solvable, stopping at the
 * difficulty's clue target (or when no more removals are possible).
 */
export function generate(difficulty: DifficultyName, rng: () => number = makeRng(1)): Puzzle {
  const full = solve(new Array(81).fill(0), true, rng);
  if (!full) throw new Error("failed to build a full grid");
  const puzzle = [...full];

  const removalOrder = shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    rng,
  );
  let givens = 81;
  const target = CLUE_TARGETS[difficulty];
  for (const cell of removalOrder) {
    if (givens <= target) break;
    const backup = puzzle[cell] as number;
    puzzle[cell] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      givens--;
    } else {
      puzzle[cell] = backup;
    }
  }
  return { puzzle, solution: full, givens };
}

/** Hint: reveal one cell from the solution (most constrained first). */
export function hint(grid: Grid, solution: Grid): number | null {
  let best = -1;
  let bestCount = 10;
  for (let cell = 0; cell < 81; cell++) {
    if (grid[cell] !== 0) continue;
    const count = candidates(grid, cell).length;
    if (count < bestCount) {
      best = cell;
      bestCount = count;
    }
  }
  if (best === -1) return null;
  grid[best] = solution[best] as number;
  return best;
}

/** Pencil notes: recompute the auto-candidates for a cell. */
export function autoNotes(grid: Grid, cell: number): number[] {
  if (grid[cell] !== 0) return [];
  return candidates(grid, cell);
}

/** True when the grid is completely and correctly filled. */
export function isSolved(grid: Grid, solution?: Grid): boolean {
  if (grid.some((v) => v === 0)) return false;
  if (solution) return grid.every((v, i) => v === solution[i]);
  for (let unit = 0; unit < 27; unit++) {
    const seen = new Set<number>();
    for (const cell of unitCells(unit)) {
      seen.add(grid[cell] as number);
    }
    if (seen.size !== 9) return false;
  }
  return true;
}

export function unitCells(unit: number): number[] {
  const cells: number[] = [];
  if (unit < 9) {
    const row = unit;
    for (let c = 0; c < 9; c++) cells.push(idx(row, c));
  } else if (unit < 18) {
    const col = unit - 9;
    for (let r = 0; r < 9; r++) cells.push(idx(r, col));
  } else {
    const box = unit - 18;
    const boxRow = Math.floor(box / 3) * 3;
    const boxCol = (box % 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        cells.push(idx(r, c));
      }
    }
  }
  return cells;
}

/** Format a grid as 81-char text (0 = empty). */
export function toLine(grid: Grid): string {
  return grid.join("");
}

export function fromLine(line: string): Grid {
  if (line.length !== 81 || /[^0-9]/.test(line)) {
    throw new Error("grid must be 81 characters of digits");
  }
  return [...line].map(Number);
}
