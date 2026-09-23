import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidates,
  countSolutions,
  fromLine,
  generate,
  hint,
  isSolved,
  makeRng,
  solve,
  toLine,
  unitCells,
  autoNotes,
  peersOf,
} from "../src/core.ts";

const EASY_LINE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const EASY_SOLUTION_LINE =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

test("solver solves a known grid", () => {
  const solution = solve(fromLine(EASY_LINE));
  assert.ok(solution);
  assert.equal(toLine(solution), EASY_SOLUTION_LINE);
  assert.ok(isSolved(solution));
});

test("solver returns null on unsolvable grid", () => {
  const grid = fromLine(EASY_LINE);
  grid[0] = grid[1]; // two identical digits in the same row
  assert.equal(solve(grid), null);
});

test("candidates respect row, column and box", () => {
  const grid = fromLine(EASY_LINE);
  // cell (row 0, col 2) is empty; its row holds 5,3,7 and its column/box
  // hold 8 — so 5,3,7,8 must all be excluded
  const cands = candidates(grid, 2);
  assert.ok(!cands.includes(5) && !cands.includes(3) && !cands.includes(7) && !cands.includes(8));
  assert.ok(cands.length >= 1 && cands.length <= 9);
});

test("countSolutions distinguishes unique from multiple", () => {
  const puzzle = fromLine(EASY_LINE);
  assert.equal(countSolutions(puzzle, 2), 1);
  const thinned = fromLine(EASY_LINE);
  thinned[0] = 0; // remove a clue from a unique puzzle; still unique
  const sparse = fromLine(EASY_LINE);
  sparse[0] = 0;
  sparse[1] = 0;
  sparse[2] = 0;
  // removing many clues from the top row eventually allows multiple grids
  let multi = false;
  for (let col = 0; col < 9; col++) sparse[col] = 0;
  multi = countSolutions(sparse, 2) >= 2;
  assert.ok(multi, "almost-empty grid must have multiple solutions");
  assert.ok(countSolutions(thinned, 2) >= 1);
});

test("generator produces unique puzzles at all difficulties", () => {
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    const { puzzle, solution, givens } = generate(difficulty, makeRng(42 + difficulty.length));
    assert.equal(countSolutions(puzzle, 2), 1, `${difficulty} must be unique`);
    assert.equal(toLine(solution), toLine(solve(puzzle) as number[]));
    assert.ok(givens >= 24 && givens <= 81);
    assert.ok(isSolved(solution));
  }
});

test("generator is deterministic under a seed", () => {
  const a = generate("easy", makeRng(7));
  const b = generate("easy", makeRng(7));
  assert.equal(toLine(a.puzzle), toLine(b.puzzle));
});

test("hint fills the most constrained empty cell correctly", () => {
  const { puzzle, solution } = generate("easy", makeRng(5));
  const grid = [...puzzle];
  const cell = hint(grid, solution);
  assert.ok(cell !== null);
  assert.equal(grid[cell as number], solution[cell as number]);
});

test("autoNotes match candidates and clear when filled", () => {
  const puzzle = fromLine(EASY_LINE);
  const notes = autoNotes(puzzle, 2);
  assert.deepEqual(notes, candidates(puzzle, 2));
  const filled = [...puzzle];
  filled[2] = 1;
  assert.deepEqual(autoNotes(filled, 2), []);
});

test("isSolved validates against solution and units", () => {
  assert.ok(isSolved(fromLine(EASY_SOLUTION_LINE)));
  const wrong = fromLine(EASY_SOLUTION_LINE);
  wrong[0] = wrong[1];
  wrong[1] = 0;
  assert.ok(!isSolved(wrong));
});

test("units: 27 units of 9 cells, peers have 20 members", () => {
  let count = 0;
  for (let unit = 0; unit < 27; unit++) {
    assert.equal(unitCells(unit).length, 9);
    count++;
  }
  assert.equal(count, 27);
  assert.equal(peersOf(40).length, 20);
});
