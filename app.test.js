const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  analyzePuzzle,
  createCandidateNumbers,
  findSolution,
  formatScore,
  getTotalElapsed,
  generateSolvablePuzzle,
  getDifficultyConfig,
  parseExpression,
  validateAnswer,
} = require('./app.js');

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should be close to ${expected}`);
}

test('parseExpression honors parentheses and operator precedence', () => {
  const result = parseExpression('(8-5)*(9-1)');

  closeTo(result.value, 24);
  assert.deepEqual(result.numbers, [8, 5, 9, 1]);
});

test('parseExpression supports Chinese parentheses', () => {
  const result = parseExpression('（8-5）*（9-1）');

  closeTo(result.value, 24);
  assert.deepEqual(result.numbers, [8, 5, 9, 1]);
});

test('validateAnswer accepts a correct expression using all digits in any order', () => {
  const result = validateAnswer('(8-5)*(9-1)', [9, 1, 8, 5]);

  assert.equal(result.ok, true);
  closeTo(result.value, 24);
});

test('validateAnswer accepts Chinese parentheses in a correct answer', () => {
  const result = validateAnswer('（8-5）*（9-1）', [9, 1, 8, 5]);

  assert.equal(result.ok, true);
  closeTo(result.value, 24);
});

test('validateAnswer rejects expressions that do not use exactly the puzzle digits', () => {
  const result = validateAnswer('8*(5-2)', [8, 5, 9, 1]);

  assert.equal(result.ok, false);
  assert.match(result.message, /数字/);
});

test('validateAnswer rejects concatenated multi-digit numbers', () => {
  const result = validateAnswer('12+3+4+5', [1, 2, 3, 4]);

  assert.equal(result.ok, false);
  assert.match(result.message, /多位数/);
});

test('validateAnswer reports mismatched parentheses clearly', () => {
  const result = validateAnswer('(8-5*(9-1)', [8, 5, 9, 1]);

  assert.equal(result.ok, false);
  assert.match(result.message, /括号/);
});

test('parseExpression rejects division that produces a fraction', () => {
  assert.throws(
    () => parseExpression('5/2+8+9+1'),
    /整除/,
  );
});

test('validateAnswer allows division when the quotient is an integer', () => {
  const result = validateAnswer('8/(4-2)*6', [8, 4, 2, 6]);

  assert.equal(result.ok, true);
  closeTo(result.value, 24);
});

test('findSolution returns an expression that validates for a known solvable puzzle', () => {
  const solution = findSolution([8, 4, 2, 6]);
  const result = validateAnswer(solution, [8, 4, 2, 6]);

  assert.equal(typeof solution, 'string');
  assert.equal(result.ok, true);
});

test('analyzePuzzle counts integer-division solutions', () => {
  const analysis = analyzePuzzle([8, 4, 2, 6]);

  assert.equal(analysis.solvable, true);
  assert.ok(analysis.solutionCount > 0);
  assert.equal(typeof analysis.solution, 'string');
});

test('hard candidate generation avoids 1 and repeated numbers by default', () => {
  const numbers = createCandidateNumbers(getDifficultyConfig('hard'), () => 0);

  assert.deepEqual(numbers, [2, 3, 4, 5]);
  assert.equal(new Set(numbers).size, 4);
});

test('hard puzzle generation prefers numbers without 1 or repeats and limited solutions', () => {
  const puzzle = generateSolvablePuzzle('hard');
  const result = validateAnswer(puzzle.solution, puzzle.numbers);

  assert.equal(result.ok, true);
  assert.ok(puzzle.numbers.every((number) => number >= 2));
  assert.equal(new Set(puzzle.numbers).size, 4);
  assert.ok(puzzle.analysis.solutionCount <= getDifficultyConfig('hard').maxSolutions);
});

test('default difficulty is hard', () => {
  assert.equal(getDifficultyConfig().id, 'hard');
});

test('findSolution does not use non-integer division steps', () => {
  const solution = findSolution([1, 5, 5, 5]);
  const result = validateAnswer(solution, [1, 5, 5, 5]);

  assert.equal(solution, null);
  assert.equal(result.ok, false);
  assert.match(result.message, /请输入表达式/);
});

test('generateSolvablePuzzle returns four 1-9 digits with a valid solution', () => {
  const puzzle = generateSolvablePuzzle();
  const result = validateAnswer(puzzle.solution, puzzle.numbers);

  assert.equal(puzzle.numbers.length, 4);
  assert.ok(puzzle.numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 9));
  assert.equal(result.ok, true);
});

test('getTotalElapsed excludes current unfinished puzzle time', () => {
  assert.equal(getTotalElapsed(12_000, 3_500), 12_000);
});

test('formatScore shows correct answers over total generated puzzles', () => {
  assert.equal(formatScore(3, 7), '3 / 7');
});

test('index shows total elapsed time instead of previous puzzle time', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  assert.match(html, /总用时/);
  assert.doesNotMatch(html, /上题用时/);
  assert.match(html, /data-total-time/);
  assert.match(html, /data-score>0 \/ 0</);
});

test('index hides difficulty switching tabs', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  assert.doesNotMatch(html, /data-difficulty-tabs/);
  assert.doesNotMatch(html, /data-difficulty="easy"/);
  assert.doesNotMatch(html, /data-difficulty="normal"/);
  assert.doesNotMatch(html, /data-difficulty="hard"/);
});

test('startGame does not bind difficulty tab events', () => {
  const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const startMatch = source.match(/function startGame[\s\S]*?\n  return \{/);

  assert.ok(startMatch, 'startGame should exist');
  assert.doesNotMatch(startMatch[0], /difficultyTabs/);
  assert.doesNotMatch(startMatch[0], /handleDifficultyClick/);
});
