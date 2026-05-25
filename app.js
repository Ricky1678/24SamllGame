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
  const DEFAULT_DIFFICULTY = 'hard';
  const DEFAULT_STATUS_MESSAGE = '输入表达式，让四个数字通过加减乘除得到 24。';
  const DIFFICULTY_CONFIGS = {
    easy: {
      id: 'easy',
      label: '简单',
      maxAttempts: 5000,
      maxSolutions: Infinity,
      minNumber: 1,
      solutionSearchLimit: 80,
    },
    normal: {
      id: 'normal',
      label: '普通',
      maxAttempts: 9000,
      maxSolutions: 8,
      minNumber: 1,
      solutionSearchLimit: 9,
    },
    hard: {
      id: 'hard',
      label: '困难',
      avoidObviousPair: true,
      fallbackAfter: 12000,
      fallbackMinNumber: 1,
      maxAttempts: 18000,
      maxSolutions: 3,
      minNumber: 2,
      solutionSearchLimit: 4,
      uniqueNumbers: true,
    },
  };

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

  function getDifficultyConfig(difficulty = DEFAULT_DIFFICULTY) {
    return DIFFICULTY_CONFIGS[difficulty] || DIFFICULTY_CONFIGS[DEFAULT_DIFFICULTY];
  }

  function createCandidateNumbers(config, random = Math.random) {
    const minNumber = config.minNumber || 1;

    if (config.uniqueNumbers) {
      const pool = Array.from({ length: 10 - minNumber }, (_, index) => minNumber + index);
      return Array.from({ length: 4 }, () => {
        const index = Math.floor(random() * pool.length);
        const [number] = pool.splice(index, 1);
        return number;
      });
    }

    const rangeSize = 10 - minNumber;
    return Array.from({ length: 4 }, () => Math.floor(random() * rangeSize) + minNumber);
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

      if (char === '（' || char === '）') {
        const normalized = char === '（' ? '(' : ')';
        tokens.push({ type: normalized, value: normalized });
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

  function buildOperationCandidates(left, right) {
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

    return candidates;
  }

  function collectSolutions(numbers, limit = Infinity) {
    const items = numbers.map((number) => ({
      value: number,
      expression: String(number),
    }));
    const solutions = new Set();

    function search(currentItems) {
      if (solutions.size >= limit) {
        return;
      }

      if (currentItems.length === 1) {
        if (isClose(currentItems[0].value, 24)) {
          solutions.add(currentItems[0].expression);
        }

        return;
      }

      for (let leftIndex = 0; leftIndex < currentItems.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < currentItems.length; rightIndex += 1) {
          const left = currentItems[leftIndex];
          const right = currentItems[rightIndex];
          const rest = currentItems.filter((_, index) => index !== leftIndex && index !== rightIndex);
          const candidates = buildOperationCandidates(left, right);

          for (const candidate of candidates) {
            search([...rest, candidate]);
          }
        }
      }
    }

    search(items);
    return [...solutions];
  }

  function hasObviousPair(numbers) {
    for (let leftIndex = 0; leftIndex < numbers.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < numbers.length; rightIndex += 1) {
        if (numbers[leftIndex] * numbers[rightIndex] === 24) {
          return true;
        }
      }
    }

    return false;
  }

  function analyzePuzzle(numbers, options = {}) {
    const solutionLimit = options.solutionSearchLimit || 80;
    const solutions = collectSolutions(numbers, solutionLimit);
    const solutionCount = solutions.length;

    return {
      numbers: [...numbers],
      solution: solutions[0] || null,
      solutionCount,
      solutions,
      solvable: solutionCount > 0,
      hasObviousPair: hasObviousPair(numbers),
    };
  }

  function matchesDifficulty(analysis, config) {
    if (!analysis.solvable) {
      return false;
    }

    if (Number.isFinite(config.maxSolutions) && analysis.solutionCount > config.maxSolutions) {
      return false;
    }

    if (config.avoidObviousPair && analysis.hasObviousPair) {
      return false;
    }

    return true;
  }

  function findSolution(numbers) {
    return collectSolutions(numbers, 1)[0] || null;
  }

  function generateSolvablePuzzle(difficulty = DEFAULT_DIFFICULTY, random = Math.random) {
    let selectedDifficulty = difficulty;
    let selectedRandom = random;

    if (typeof difficulty === 'function') {
      selectedDifficulty = DEFAULT_DIFFICULTY;
      selectedRandom = difficulty;
    }

    const config = getDifficultyConfig(selectedDifficulty);

    for (let attempt = 0; attempt < config.maxAttempts; attempt += 1) {
      const useFallbackRange = config.fallbackMinNumber && attempt >= config.fallbackAfter;
      const candidateConfig = useFallbackRange
        ? { ...config, minNumber: config.fallbackMinNumber }
        : config;
      const numbers = createCandidateNumbers(candidateConfig, selectedRandom);
      const analysis = analyzePuzzle(numbers, {
        solutionSearchLimit: config.solutionSearchLimit,
      });

      if (matchesDifficulty(analysis, config)) {
        return {
          numbers,
          solution: analysis.solution,
          analysis,
          difficulty: config.id,
        };
      }
    }

    throw new Error('生成题目失败，请重试');
  }

  const state = {
    answered: false,
    answerRevealed: false,
    currentElapsed: 0,
    difficulty: DEFAULT_DIFFICULTY,
    elements: null,
    numbers: [],
    puzzleCache: {},
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
      difficultyTabs: document.querySelector('[data-difficulty-tabs]'),
      difficultyButtons: [...document.querySelectorAll('[data-difficulty]')],
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

  function startTimer(initialElapsed = 0) {
    if (state.timerId) {
      clearInterval(state.timerId);
    }

    state.startTime = now() - initialElapsed;
    state.currentElapsed = initialElapsed;
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

  function updateDifficultyTabs() {
    const elements = getElements();

    elements.difficultyButtons.forEach((button) => {
      const selected = button.dataset.difficulty === state.difficulty;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
  }

  function createPuzzleRecord(difficulty) {
    const puzzle = generateSolvablePuzzle(difficulty);

    return {
      answerHidden: true,
      answerRevealed: false,
      answerText: '',
      answered: false,
      currentElapsed: 0,
      difficulty,
      inputDisabled: false,
      inputValue: '',
      numbers: puzzle.numbers,
      solution: puzzle.solution,
      statusText: DEFAULT_STATUS_MESSAGE,
      statusType: 'neutral',
      submitDisabled: false,
    };
  }

  function saveActivePuzzleState({ pauseTimer = true } = {}) {
    const record = state.puzzleCache[state.difficulty];

    if (!record || typeof document === 'undefined') {
      return;
    }

    const elements = getElements();
    if (pauseTimer) {
      finishTimer();
    } else {
      updateTimer();
    }
    record.answerHidden = elements.answer.hidden;
    record.answerRevealed = state.answerRevealed;
    record.answerText = elements.answer.textContent;
    record.answered = state.answered;
    record.currentElapsed = state.currentElapsed;
    record.inputDisabled = elements.input.disabled;
    record.inputValue = elements.input.value;
    record.numbers = [...state.numbers];
    record.solution = state.solution;
    record.statusText = elements.status.textContent;
    record.statusType = elements.status.dataset.type || 'neutral';
    record.submitDisabled = elements.submit.disabled;
  }

  function applyPuzzleRecord(record) {
    const elements = getElements();

    finishTimer();
    state.answered = record.answered;
    state.answerRevealed = record.answerRevealed;
    state.currentElapsed = record.currentElapsed;
    state.numbers = [...record.numbers];
    state.solution = record.solution;

    elements.answer.hidden = record.answerHidden;
    elements.answer.textContent = record.answerText;
    elements.input.disabled = record.inputDisabled;
    elements.input.value = record.inputValue;
    elements.submit.disabled = record.submitDisabled;

    renderNumbers();
    updateScore();
    updateDifficultyTabs();
    setStatus(record.statusText, record.statusType);
    updateTimer();

    if (!record.answered && !record.answerRevealed) {
      startTimer(record.currentElapsed);
      elements.input.focus();
    }
  }

  function showDifficultyPuzzle(difficulty) {
    saveActivePuzzleState();
    state.difficulty = difficulty;

    if (!state.puzzleCache[difficulty]) {
      state.puzzleCache[difficulty] = createPuzzleRecord(difficulty);
      state.totalPuzzles += 1;
    }

    applyPuzzleRecord(state.puzzleCache[difficulty]);
  }

  function newPuzzle() {
    saveActivePuzzleState();
    state.puzzleCache[state.difficulty] = createPuzzleRecord(state.difficulty);
    state.totalPuzzles += 1;
    applyPuzzleRecord(state.puzzleCache[state.difficulty]);
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
      saveActivePuzzleState({ pauseTimer: false });
      return;
    }

    state.answered = true;
    state.score += 1;
    finishTimer({ countElapsed: true });
    updateScore();
    elements.submit.disabled = true;
    elements.input.disabled = true;
    setStatus(`答案正确，本题用时 ${formatElapsed(state.currentElapsed)}。`, 'success');
    saveActivePuzzleState();
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
    saveActivePuzzleState();
  }

  function handleDifficultyClick(event) {
    const button = event.target.closest('[data-difficulty]');

    if (!button || button.dataset.difficulty === state.difficulty) {
      return;
    }

    showDifficultyPuzzle(button.dataset.difficulty);
  }

  function startGame() {
    if (typeof document === 'undefined') {
      return;
    }

    const elements = getElements();

    elements.form.addEventListener('submit', handleSubmit);
    elements.difficultyTabs.addEventListener('click', handleDifficultyClick);
    elements.newPuzzle.addEventListener('click', newPuzzle);
    elements.showAnswer.addEventListener('click', handleShowAnswer);
    updateScore();
    newPuzzle();
  }

  return {
    analyzePuzzle,
    createCandidateNumbers,
    findSolution,
    formatElapsed,
    formatScore,
    getDifficultyConfig,
    getTotalElapsed,
    generateSolvablePuzzle,
    parseExpression,
    startGame,
    validateAnswer,
  };
});
