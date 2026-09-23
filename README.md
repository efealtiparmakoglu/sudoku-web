# sudoku-web

Offline client-side sudoku: **generator, solver, hints, pencil notes
and print-to-PDF** in one HTML file. Zero dependencies — the single-file
build uses Node's native TypeScript stripping.

```text
$ npm test          # 10 core tests (Node)
$ npm run build     # -> dist/index.html (16 KB, open in any browser)
```

## Features

- **Generator** — fills a random full solution, then removes clues in
  random order while the puzzle stays *uniquely solvable*, stopping at
  the difficulty's clue target (easy 40, medium 32, hard 26). Seeded
  and reproducible.
- **Solver** — most-constrained-cell backtracking with periodic MRV
  refresh; `countSolutions` powers the uniqueness guarantee.
- **Hints** — fills the most constrained empty cell from the stored
  solution; the counter shows how many you used.
- **Pencil notes** — per-cell candidate sets, auto-computed option
  (`autoNotes`), cleared automatically when a digit is placed.
- **Print/PDF** — print stylesheet hides the controls and prints just
  the grid.
- **Autosave** — progress persists in localStorage; 81-char grids can
  also be pasted in.

Wrong entries (clashing with the solution) render red; arrow keys move
the selection; `n` toggles notes mode.

## Development

```console
$ npm test                 # solver, uniqueness, generator, hints, notes
$ npm run build            # regenerate dist/index.html
```

The core (`src/core.ts`) is pure logic, unit-tested in Node; the DOM
layer is inlined next to it in the single dist file.

## License

MIT — see [LICENSE](LICENSE).
