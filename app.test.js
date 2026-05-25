const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findSolution,
  generateSolvablePuzzle,
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

test('validateAnswer accepts a correct expression using all digits in any order', () => {
  const result = validateAnswer('(8-5)*(9-1)', [9, 1, 8, 5]);

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

test('findSolution returns an expression that validates for a known solvable puzzle', () => {
  const solution = findSolution([1, 3, 4, 6]);
  const result = validateAnswer(solution, [1, 3, 4, 6]);

  assert.equal(typeof solution, 'string');
  assert.equal(result.ok, true);
});

test('generateSolvablePuzzle returns four 1-9 digits with a valid solution', () => {
  const puzzle = generateSolvablePuzzle();
  const result = validateAnswer(puzzle.solution, puzzle.numbers);

  assert.equal(puzzle.numbers.length, 4);
  assert.ok(puzzle.numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 9));
  assert.equal(result.ok, true);
});
