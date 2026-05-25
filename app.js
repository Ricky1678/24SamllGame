(function attachGame(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.Game24 = api;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', api.startGame);
    } else {
      api.startGame();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis, function createGameApi() {
  const EPSILON = 1e-9;

  class ExpressionError extends Error {}

  function isClose(actual, expected) {
    return Math.abs(actual - expected) < EPSILON;
  }

  function isWholeNumber(value) {
    return isClose(value, Math.round(value));
  }

  function now() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }

    return Date.now();
  }

  function formatNumber(value) {
    if (isClose(value, Math.round(value))) {
      return String(Math.round(value));
    }

    return String(Math.round(value * 1000) / 1000);
  }

  function formatElapsed(milliseconds) {
    return `${(milliseconds / 1000).toFixed(1)} 秒`;
  }

  function formatScore(correctCount, totalCount) {
    return `${correctCount} / ${totalCount}`;
  }

  function getTotalElapsed(completedElapsed) {
    return completedElapsed;
  }

  function tokenize(expression) {
    const tokens = [];
    let index = 0;

    while (index < expression.length) {
      const char = expression[index];

      if (/\s/.test(char)) {
        index += 1;
        continue;
      }

      if (/[1-9]/.test(char)) {
        if (/[0-9]/.test(expression[index + 1] || '')) {
          throw new ExpressionError('不能拼接多位数，每个数字只能单独使用');
        }

        tokens.push({ type: 'number', value: Number(char) });
        index += 1;
        continue;
      }

      if (/[+\-*/()]/.test(char)) {
        tokens.push({ type: char, value: char });
        index += 1;
        continue;
      }

      if (/[0-9]/.test(char)) {
        throw new ExpressionError('只能使用 1-9 的数字');
      }

      throw new ExpressionError('表达式包含非法字符');
    }

    return tokens;
  }

  function parseExpression(expression) {
    const tokens = tokenize(String(expression || ''));
    const usedNumbers = [];
    let index = 0;

    if (tokens.length === 0) {
      throw new ExpressionError('请输入表达式');
    }

    function peek() {
      return tokens[index];
    }

    function consume(type) {
      if (peek() && peek().type === type) {
        index += 1;
        return true;
      }

      return false;
    }

    function parseFactor() {
      const token = peek();

      if (!token) {
        throw new ExpressionError('表达式不完整');
      }

      if (consume('+')) {
        return parseFactor();
      }

      if (consume('-')) {
        return -parseFactor();
      }

      if (token.type === 'number') {
        index += 1;
        usedNumbers.push(token.value);
        return token.value;
      }

      if (consume('(')) {
        const value = parseAddSubtract();

        if (!consume(')')) {
          throw new ExpressionError('括号不匹配');
        }

        return value;
      }

      if (token.type === ')') {
        throw new ExpressionError('括号不匹配');
      }

      throw new ExpressionError('表达式无效');
    }

    function parseMultiplyDivide() {
      let value = parseFactor();

      while (peek() && (peek().type === '*' || peek().type === '/')) {
        const operator = peek().type;
        index += 1;
        const right = parseFactor();

        if (operator === '*') {
          value *= right;
        } else {
          if (isClose(right, 0)) {
            throw new ExpressionError('不能除以 0');
          }

          const quotient = value / right;

          if (!isWholeNumber(quotient)) {
            throw new ExpressionError('除法只能使用整除，不能产生小数或分数');
          }

          value = quotient;
        }
      }

      return value;
    }

    function parseAddSubtract() {
      let value = parseMultiplyDivide();

      while (peek() && (peek().type === '+' || peek().type === '-')) {
        const operator = peek().type;
        index += 1;
        const right = parseMultiplyDivide();
        value = operator === '+' ? value + right : value - right;
      }

      return value;
    }

    const value = parseAddSubtract();

    if (index < tokens.length) {
      if (tokens[index].type === ')') {
        throw new ExpressionError('括号不匹配');
      }

      throw new ExpressionError('表达式无效');
    }

    return {
      value,
      numbers: usedNumbers,
    };
  }

  function sortedNumbers(numbers) {
    return [...numbers].sort((a, b) => a - b);
  }

  function usesExactNumbers(usedNumbers, targetNumbers) {
    const used = sortedNumbers(usedNumbers);
    const target = sortedNumbers(targetNumbers);

    if (used.length !== target.length) {
      return false;
    }

    return used.every((number, index) => number === target[index]);
  }

  function validateAnswer(expression, targetNumbers) {
    let parsed;

    try {
      parsed = parseExpression(expression);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof ExpressionError ? error.message : '表达式无效',
      };
    }

    if (!usesExactNumbers(parsed.numbers, targetNumbers)) {
      return {
        ok: false,
        message: '必须且只能使用题目中的四个数字，每个数字用一次',
        value: parsed.value,
      };
    }

    if (!isClose(parsed.value, 24)) {
      return {
        ok: false,
        message: `结果是 ${formatNumber(parsed.value)}，不是 24`,
        value: parsed.value,
      };
    }

    return {
      ok: true,
      message: '答案正确',
      value: parsed.value,
    };
  }

  function findSolution(numbers) {
    const items = numbers.map((number) => ({
      value: number,
      expression: String(number),
    }));

    function search(currentItems) {
      if (currentItems.length === 1) {
        return isClose(currentItems[0].value, 24) ? currentItems[0].expression : null;
      }

      for (let leftIndex = 0; leftIndex < currentItems.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < currentItems.length; rightIndex += 1) {
          const left = currentItems[leftIndex];
          const right = currentItems[rightIndex];
          const rest = currentItems.filter((_, index) => index !== leftIndex && index !== rightIndex);
          const candidates = [
            {
              value: left.value + right.value,
              expression: `(${left.expression}+${right.expression})`,
            },
            {
              value: left.value - right.value,
              expression: `(${left.expression}-${right.expression})`,
            },
            {
              value: right.value - left.value,
              expression: `(${right.expression}-${left.expression})`,
            },
            {
              value: left.value * right.value,
              expression: `(${left.expression}*${right.expression})`,
            },
          ];

          if (!isClose(right.value, 0) && isWholeNumber(left.value / right.value)) {
            candidates.push({
              value: left.value / right.value,
              expression: `(${left.expression}/${right.expression})`,
            });
          }

          if (!isClose(left.value, 0) && isWholeNumber(right.value / left.value)) {
            candidates.push({
              value: right.value / left.value,
              expression: `(${right.expression}/${left.expression})`,
            });
          }

          for (const candidate of candidates) {
            const solution = search([...rest, candidate]);

            if (solution) {
              return solution;
            }
          }
        }
      }

      return null;
    }

    return search(items);
  }

  function generateSolvablePuzzle(random = Math.random) {
    for (let attempt = 0; attempt < 5000; attempt += 1) {
      const numbers = Array.from({ length: 4 }, () => Math.floor(random() * 9) + 1);
      const solution = findSolution(numbers);

      if (solution) {
        return {
          numbers,
          solution,
        };
      }
    }

    throw new Error('生成题目失败，请重试');
  }

  const state = {
    answered: false,
    answerRevealed: false,
    currentElapsed: 0,
    elements: null,
    numbers: [],
    score: 0,
    solution: '',
    startTime: 0,
    timerActive: false,
    timerId: null,
    totalElapsed: 0,
    totalPuzzles: 0,
  };

  function getElements() {
    if (state.elements) {
      return state.elements;
    }

    state.elements = {
      answer: document.querySelector('[data-answer]'),
      form: document.querySelector('[data-form]'),
      input: document.querySelector('[data-expression]'),
      newPuzzle: document.querySelector('[data-new-puzzle]'),
      numbers: document.querySelector('[data-numbers]'),
      score: document.querySelector('[data-score]'),
      showAnswer: document.querySelector('[data-show-answer]'),
      status: document.querySelector('[data-status]'),
      submit: document.querySelector('[data-submit]'),
      timer: document.querySelector('[data-timer]'),
      totalTime: document.querySelector('[data-total-time]'),
    };

    return state.elements;
  }

  function setStatus(message, type = 'neutral') {
    const elements = getElements();
    elements.status.textContent = message;
    elements.status.dataset.type = type;
  }

  function updateTimer() {
    const elements = getElements();
    if (state.timerActive) {
      state.currentElapsed = now() - state.startTime;
    }

    elements.timer.textContent = formatElapsed(state.currentElapsed);
    elements.totalTime.textContent = formatElapsed(getTotalElapsed(state.totalElapsed));
  }

  function finishTimer({ countElapsed = false } = {}) {
    if (!state.timerActive) {
      updateTimer();
      return;
    }

    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }

    updateTimer();
    if (countElapsed) {
      state.totalElapsed += state.currentElapsed;
    }

    state.timerActive = false;
    updateTimer();
  }

  function startTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
    }

    state.startTime = now();
    state.currentElapsed = 0;
    state.timerActive = true;
    updateTimer();
    state.timerId = setInterval(updateTimer, 250);
  }

  function renderNumbers() {
    const elements = getElements();
    elements.numbers.replaceChildren();

    state.numbers.forEach((number) => {
      const tile = document.createElement('div');
      tile.className = 'number-tile';
      tile.textContent = String(number);
      elements.numbers.append(tile);
    });
  }

  function updateScore() {
    const elements = getElements();
    elements.score.textContent = formatScore(state.score, state.totalPuzzles);
  }

  function newPuzzle() {
    const elements = getElements();

    finishTimer();

    const puzzle = generateSolvablePuzzle();

    state.answered = false;
    state.answerRevealed = false;
    state.numbers = puzzle.numbers;
    state.solution = puzzle.solution;
    state.totalPuzzles += 1;
    elements.answer.hidden = true;
    elements.answer.textContent = '';
    elements.input.disabled = false;
    elements.input.value = '';
    elements.submit.disabled = false;

    renderNumbers();
    updateScore();
    setStatus('输入表达式，让四个数字通过加减乘除得到 24。', 'neutral');
    startTimer();
    elements.input.focus();
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (state.answered || state.answerRevealed) {
      return;
    }

    const elements = getElements();
    const result = validateAnswer(elements.input.value, state.numbers);

    if (!result.ok) {
      setStatus(result.message, 'error');
      return;
    }

    state.answered = true;
    state.score += 1;
    finishTimer({ countElapsed: true });
    updateScore();
    elements.submit.disabled = true;
    elements.input.disabled = true;
    setStatus(`答案正确，本题用时 ${formatElapsed(state.currentElapsed)}。`, 'success');
  }

  function handleShowAnswer() {
    const elements = getElements();

    state.answerRevealed = true;
    elements.answer.textContent = `参考答案：${state.solution}`;
    elements.answer.hidden = false;
    elements.submit.disabled = true;
    elements.input.disabled = true;
    finishTimer();
    setStatus('已查看答案，本题不计分。点击“换一题”继续。', 'neutral');
  }

  function startGame() {
    if (typeof document === 'undefined') {
      return;
    }

    const elements = getElements();

    elements.form.addEventListener('submit', handleSubmit);
    elements.newPuzzle.addEventListener('click', newPuzzle);
    elements.showAnswer.addEventListener('click', handleShowAnswer);
    updateScore();
    newPuzzle();
  }

  return {
    findSolution,
    formatElapsed,
    formatScore,
    getTotalElapsed,
    generateSolvablePuzzle,
    parseExpression,
    startGame,
    validateAnswer,
  };
});
