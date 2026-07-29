/**
 * PINK GLAM CALCULATOR - CORE APPLICATION LOGIC WITH SUPABASE CLOUD SYNC
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- DEFAULT SUPABASE CREDENTIALS ---
  const DEFAULT_SUPABASE_URL = 'https://zamqqaiipwatbaubvlpq.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphbXFxYWlpcHdhdGJhdWJ2bHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNzY0ODMsImV4cCI6MjEwMDg1MjQ4M30.cbMqVG_zNbLJPz2VYGTLOAMd3WslBEA0Bng4JKriByA';

  // --- STATE MANAGEMENT ---
  const state = {
    currentInput: '0',
    expression: '',
    previousResult: null,
    memory: 0,
    angleUnit: 'DEG', // 'DEG' or 'RAD'
    isScientific: false,
    soundEnabled: true,
    theme: 'neon', // 'neon' or 'pastel'
    history: JSON.parse(localStorage.getItem('pinkcalc_history') || '[]'),
    shouldResetDisplay: false,
    
    // Supabase State pre-configured
    supabaseUrl: localStorage.getItem('pinkcalc_supabase_url') || DEFAULT_SUPABASE_URL,
    supabaseKey: localStorage.getItem('pinkcalc_supabase_key') || DEFAULT_SUPABASE_KEY,
    supabaseClient: null,
    isCloudConnected: false
  };

  // --- DOM ELEMENTS ---
  const mainDisplay = document.getElementById('main-display');
  const expressionDisplay = document.getElementById('expression');
  const badgeAngle = document.getElementById('badge-angle');
  const badgeMemory = document.getElementById('badge-memory');
  const badgeSci = document.getElementById('badge-sci');
  const badgeCloudStatus = document.getElementById('badge-cloud-status');
  const cloudDot = document.getElementById('cloud-dot');
  const angleModeBtn = document.getElementById('angle-mode');
  const soundIcon = document.getElementById('sound-icon');
  const modeText = document.getElementById('mode-text');
  const scientificGrid = document.getElementById('scientific-grid');
  const calcContainer = document.getElementById('calculator');
  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');
  const historySourceTag = document.getElementById('history-source-tag');
  const toast = document.getElementById('toast');

  // Modal Elements
  const supabaseModal = document.getElementById('supabase-modal');
  const inputUrl = document.getElementById('input-supabase-url');
  const inputKey = document.getElementById('input-supabase-key');
  const btnSaveSupabase = document.getElementById('btn-save-supabase');
  const btnDisconnectSupabase = document.getElementById('btn-disconnect-supabase');

  // --- SUPABASE CLIENT INITIALIZATION ---
  function initSupabase() {
    if (state.supabaseUrl && state.supabaseKey && window.supabase) {
      try {
        state.supabaseClient = window.supabase.createClient(state.supabaseUrl, state.supabaseKey);
        state.isCloudConnected = true;
        cloudDot.className = 'cloud-dot connected';
        badgeCloudStatus.textContent = 'Cloud 🟢';
        historySourceTag.textContent = '(Supabase Cloud)';
        fetchCloudHistory();
      } catch (err) {
        console.warn('Error al conectar Supabase:', err);
        setDisconnectedState();
      }
    } else {
      setDisconnectedState();
    }
  }

  function setDisconnectedState() {
    state.supabaseClient = null;
    state.isCloudConnected = false;
    cloudDot.className = 'cloud-dot disconnected';
    badgeCloudStatus.textContent = 'Local 🟡';
    historySourceTag.textContent = '(Local)';
  }

  async function fetchCloudHistory() {
    if (!state.supabaseClient) return;
    try {
      const { data, error } = await state.supabaseClient
        .from('calculations')
        .select('expression, result, created_at')
        .order('created_at', { ascending: false })
        .limit(25);

      if (!error && data && data.length > 0) {
        state.history = data.map(item => ({
          expr: item.expression,
          res: item.result
        }));
        localStorage.setItem('pinkcalc_history', JSON.stringify(state.history));
        renderHistory();
      }
    } catch (err) {
      console.warn('Error al obtener historial de Supabase:', err);
    }
  }

  async function saveToCloud(expr, res) {
    if (!state.supabaseClient) return;
    try {
      await state.supabaseClient
        .from('calculations')
        .insert([{ expression: expr, result: res }]);
    } catch (err) {
      console.warn('Error al guardar en Supabase:', err);
    }
  }

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  let audioCtx = null;

  function playSound(freq = 600, type = 'sine', duration = 0.04) {
    if (!state.soundEnabled) return;
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // --- RIPPLE EFFECT ON BUTTON PRESS ---
  function createRipple(e) {
    const btn = e.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius = diameter / 2;

    const rect = btn.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${e.clientX - rect.left - radius}px`;
    circle.style.top = `${e.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');

    const existing = btn.getElementsByClassName('ripple')[0];
    if (existing) existing.remove();

    btn.appendChild(circle);
  }

  document.querySelectorAll('.btn, .icon-btn').forEach(button => {
    button.addEventListener('mousedown', createRipple);
  });

  // --- TOAST MESSAGES ---
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // --- DISPLAY UPDATER ---
  function updateDisplay() {
    mainDisplay.textContent = state.currentInput;
    expressionDisplay.textContent = state.expression;
    badgeAngle.textContent = state.angleUnit;
    angleModeBtn.textContent = state.angleUnit;
    badgeMemory.style.display = state.memory !== 0 ? 'inline-block' : 'none';
    badgeSci.style.display = state.isScientific ? 'inline-block' : 'none';

    if (state.currentInput.length > 11) {
      mainDisplay.style.fontSize = '1.75rem';
    } else if (state.currentInput.length > 8) {
      mainDisplay.style.fontSize = '2.1rem';
    } else {
      mainDisplay.style.fontSize = '2.5rem';
    }
  }

  // --- INPUT HANDLERS ---
  function handleNumber(num) {
    playSound(750, 'sine', 0.03);
    if (state.shouldResetDisplay) {
      state.currentInput = num === '.' ? '0.' : num;
      state.shouldResetDisplay = false;
    } else {
      if (num === '.') {
        if (!state.currentInput.includes('.')) {
          state.currentInput += '.';
        }
      } else {
        if (state.currentInput === '0') {
          state.currentInput = num;
        } else {
          state.currentInput += num;
        }
      }
    }
    updateDisplay();
  }

  function handleOperator(op) {
    playSound(550, 'triangle', 0.05);
    
    const lastChar = state.expression.trim().slice(-1);
    const operators = ['+', '-', '×', '÷', '^'];

    if (state.shouldResetDisplay) {
      state.expression = `${state.currentInput} ${op} `;
      state.shouldResetDisplay = false;
    } else {
      if (state.expression && operators.includes(lastChar) && state.currentInput === '0') {
        state.expression = state.expression.slice(0, -2) + ` ${op} `;
      } else {
        state.expression += `${state.currentInput} ${op} `;
      }
    }
    state.currentInput = '0';
    updateDisplay();
  }

  function handleParens() {
    playSound(650, 'sine', 0.03);
    const openCount = (state.expression.match(/\(/g) || []).length;
    const closeCount = (state.expression.match(/\)/g) || []).length;

    if (openCount > closeCount && state.currentInput !== '0') {
      state.expression += `${state.currentInput} ) `;
      state.currentInput = '0';
    } else {
      if (state.currentInput === '0') {
        state.expression += '( ';
      } else {
        state.expression += `${state.currentInput} × ( `;
        state.currentInput = '0';
      }
    }
    updateDisplay();
  }

  function handleNegate() {
    playSound(600, 'sine', 0.03);
    if (state.currentInput !== '0') {
      if (state.currentInput.startsWith('-')) {
        state.currentInput = state.currentInput.substring(1);
      } else {
        state.currentInput = '-' + state.currentInput;
      }
      updateDisplay();
    }
  }

  function handleClear() {
    playSound(400, 'sawtooth', 0.06);
    state.currentInput = '0';
    state.expression = '';
    state.shouldResetDisplay = false;
    updateDisplay();
  }

  function handleBackspace() {
    playSound(500, 'sine', 0.03);
    if (state.currentInput.length > 1) {
      state.currentInput = state.currentInput.slice(0, -1);
    } else {
      state.currentInput = '0';
    }
    updateDisplay();
  }

  // --- SCIENTIFIC FUNCTIONS ---
  function handleScientific(action) {
    playSound(680, 'sine', 0.04);
    let val = parseFloat(state.currentInput);
    let result = 0;

    const toRad = (x) => state.angleUnit === 'DEG' ? (x * Math.PI) / 180 : x;
    const fromRad = (x) => state.angleUnit === 'DEG' ? (x * 180) / Math.PI : x;

    switch (action) {
      case 'sin':
        result = Math.sin(toRad(val));
        state.expression = `sin(${state.currentInput})`;
        break;
      case 'cos':
        result = Math.cos(toRad(val));
        state.expression = `cos(${state.currentInput})`;
        break;
      case 'tan':
        result = Math.tan(toRad(val));
        state.expression = `tan(${state.currentInput})`;
        break;
      case 'asin':
        result = fromRad(Math.asin(val));
        state.expression = `asin(${state.currentInput})`;
        break;
      case 'acos':
        result = fromRad(Math.acos(val));
        state.expression = `acos(${state.currentInput})`;
        break;
      case 'atan':
        result = fromRad(Math.atan(val));
        state.expression = `atan(${state.currentInput})`;
        break;
      case 'ln':
        result = Math.log(val);
        state.expression = `ln(${state.currentInput})`;
        break;
      case 'log':
        result = Math.log10(val);
        state.expression = `log(${state.currentInput})`;
        break;
      case 'sqrt':
        result = Math.sqrt(val);
        state.expression = `√(${state.currentInput})`;
        break;
      case 'square':
        result = Math.pow(val, 2);
        state.expression = `(${state.currentInput})²`;
        break;
      case 'power':
        handleOperator('^');
        return;
      case 'reciprocal':
        result = 1 / val;
        state.expression = `1/(${state.currentInput})`;
        break;
      case 'pi':
        state.currentInput = Math.PI.toString();
        updateDisplay();
        return;
      case 'e':
        state.currentInput = Math.E.toString();
        updateDisplay();
        return;
      case 'factorial':
        result = calculateFactorial(Math.floor(val));
        state.expression = `${val}!`;
        break;
      case 'ans':
        if (state.previousResult !== null) {
          state.currentInput = state.previousResult.toString();
          updateDisplay();
        }
        return;
    }

    if (isNaN(result) || !isFinite(result)) {
      state.currentInput = 'Error';
    } else {
      state.currentInput = cleanNumberFormat(result);
      state.previousResult = result;
      addHistory(state.expression, state.currentInput);
      saveToCloud(state.expression, state.currentInput);
    }
    state.shouldResetDisplay = true;
    updateDisplay();
  }

  function calculateFactorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let fact = 1;
    for (let i = 2; i <= n; i++) fact *= i;
    return fact;
  }

  // --- MEMORY FUNCTIONS ---
  function handleMemory(action) {
    playSound(620, 'triangle', 0.04);
    const val = parseFloat(state.currentInput) || 0;
    switch (action) {
      case 'mc':
        state.memory = 0;
        showToast('Memoria borrada');
        break;
      case 'mr':
        state.currentInput = cleanNumberFormat(state.memory);
        state.shouldResetDisplay = true;
        showToast(`Memoria recuperada: ${state.memory}`);
        break;
      case 'm-plus':
        state.memory += val;
        showToast(`Memoria: ${state.memory}`);
        break;
      case 'm-minus':
        state.memory -= val;
        showToast(`Memoria: ${state.memory}`);
        break;
    }
    updateDisplay();
  }

  // --- CALCULATION ENGINE ---
  function calculate() {
    playSound(850, 'sine', 0.06);

    let fullExpr = state.expression + state.currentInput;
    if (!fullExpr) return;

    try {
      let parsedExpr = fullExpr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**');

      const openParen = (parsedExpr.match(/\(/g) || []).length;
      const closeParen = (parsedExpr.match(/\)/g) || []).length;
      for (let i = 0; i < openParen - closeParen; i++) {
        parsedExpr += ')';
        fullExpr += ' )';
      }

      const evalFunc = new Function(`return ${parsedExpr}`);
      const rawResult = evalFunc();

      if (isNaN(rawResult) || !isFinite(rawResult)) {
        state.currentInput = 'Error';
      } else {
        const formattedResult = cleanNumberFormat(rawResult);
        addHistory(fullExpr, formattedResult);
        saveToCloud(fullExpr, formattedResult);
        state.previousResult = rawResult;
        state.expression = `${fullExpr} =`;
        state.currentInput = formattedResult;
        state.shouldResetDisplay = true;
      }
    } catch (err) {
      state.currentInput = 'Error';
      state.shouldResetDisplay = true;
    }

    updateDisplay();
  }

  function cleanNumberFormat(num) {
    if (Number.isInteger(num)) return num.toString();
    return parseFloat(num.toFixed(10)).toString();
  }

  // --- HISTORIAL SYSTEM ---
  function addHistory(expr, res) {
    if (res === 'Error') return;
    state.history.unshift({ expr, res });
    if (state.history.length > 25) state.history.pop();
    localStorage.setItem('pinkcalc_history', JSON.stringify(state.history));
    renderHistory();
  }

  function renderHistory() {
    if (state.history.length === 0) {
      historyList.innerHTML = '<p class="empty-history">No hay operaciones recientes</p>';
      return;
    }

    historyList.innerHTML = state.history.map((item, index) => `
      <div class="history-item" data-index="${index}">
        <span class="history-expr">${item.expr}</span>
        <span class="history-res">${item.res}</span>
      </div>
    `).join('');

    document.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const idx = e.currentTarget.dataset.index;
        const entry = state.history[idx];
        if (entry) {
          state.currentInput = entry.res;
          state.expression = entry.expr;
          state.shouldResetDisplay = true;
          updateDisplay();
          historyPanel.classList.remove('open');
          showToast(`Cargado: ${entry.res}`);
        }
      });
    });
  }

  // --- BUTTON EVENT LISTENERS ---
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      const value = btn.dataset.value;

      if (value !== undefined) {
        if (action === 'op') {
          handleOperator(value);
        } else {
          handleNumber(value);
        }
      } else if (action) {
        switch (action) {
          case 'clear': handleClear(); break;
          case 'backspace': handleBackspace(); break;
          case 'parens': handleParens(); break;
          case 'negate': handleNegate(); break;
          case 'calculate': calculate(); break;
          case 'mc': case 'mr': case 'm-plus': case 'm-minus':
            handleMemory(action); break;
          default:
            handleScientific(action); break;
        }
      }
    });
  });

  // Header controls
  document.getElementById('btn-mode-toggle').addEventListener('click', () => {
    playSound(650, 'sine', 0.03);
    state.isScientific = !state.isScientific;
    scientificGrid.classList.toggle('open', state.isScientific);
    calcContainer.classList.toggle('scientific-active', state.isScientific);
    modeText.textContent = state.isScientific ? 'Estándar' : 'Científica';
    updateDisplay();
  });

  angleModeBtn.addEventListener('click', () => {
    playSound(650, 'sine', 0.03);
    state.angleUnit = state.angleUnit === 'DEG' ? 'RAD' : 'DEG';
    updateDisplay();
  });

  document.getElementById('btn-sound').addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    soundIcon.className = state.soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    showToast(state.soundEnabled ? 'Sonido activado 🔊' : 'Sonido desactivado 🔇');
    if (state.soundEnabled) playSound(800, 'sine', 0.04);
  });

  document.getElementById('btn-theme').addEventListener('click', () => {
    playSound(700, 'sine', 0.04);
    state.theme = state.theme === 'neon' ? 'pastel' : 'neon';
    document.documentElement.setAttribute('data-theme', state.theme);
    showToast(state.theme === 'neon' ? 'Tema: Rosa Neón 💖' : 'Tema: Rosa Pastel 🌸');
  });

  document.getElementById('btn-history-toggle').addEventListener('click', () => {
    playSound(600, 'sine', 0.03);
    renderHistory();
    historyPanel.classList.add('open');
  });

  document.getElementById('btn-close-history').addEventListener('click', () => {
    historyPanel.classList.remove('open');
  });

  document.getElementById('btn-clear-history').addEventListener('click', async () => {
    playSound(400, 'sawtooth', 0.05);
    state.history = [];
    localStorage.removeItem('pinkcalc_history');
    if (state.supabaseClient) {
      try {
        await state.supabaseClient.from('calculations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {}
    }
    renderHistory();
    showToast('Historial borrado');
  });

  document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(state.currentInput).then(() => {
      showToast('¡Resultado copiado! 📋💖');
      playSound(900, 'sine', 0.05);
    }).catch(() => {
      showToast('Error al copiar');
    });
  });

  // --- SUPABASE MODAL HANDLERS ---
  document.getElementById('btn-supabase').addEventListener('click', () => {
    playSound(600, 'sine', 0.03);
    inputUrl.value = state.supabaseUrl;
    inputKey.value = state.supabaseKey;
    supabaseModal.classList.add('open');
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    supabaseModal.classList.remove('open');
  });

  btnSaveSupabase.addEventListener('click', () => {
    const url = inputUrl.value.trim();
    const key = inputKey.value.trim();

    if (!url || !key) {
      showToast('Ingresa la URL y Key válidas');
      return;
    }

    state.supabaseUrl = url;
    state.supabaseKey = key;
    localStorage.setItem('pinkcalc_supabase_url', url);
    localStorage.setItem('pinkcalc_supabase_key', key);

    initSupabase();
    supabaseModal.classList.remove('open');
    showToast('¡Supabase Conectado! ☁️🟢');
  });

  btnDisconnectSupabase.addEventListener('click', () => {
    state.supabaseUrl = '';
    state.supabaseKey = '';
    localStorage.removeItem('pinkcalc_supabase_url');
    localStorage.removeItem('pinkcalc_supabase_key');
    setDisconnectedState();
    supabaseModal.classList.remove('open');
    showToast('Supabase Desconectado');
  });

  document.getElementById('btn-copy-sql').addEventListener('click', () => {
    const sqlText = document.getElementById('sql-snippet').textContent;
    navigator.clipboard.writeText(sqlText).then(() => {
      showToast('¡Código SQL copiado! 📋');
    });
  });

  // --- KEYBOARD SUPPORT ---
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;

    if (e.key >= '0' && e.key <= '9') {
      handleNumber(e.key);
    } else if (e.key === '.' || e.key === ',') {
      handleNumber('.');
    } else if (e.key === '+') {
      handleOperator('+');
    } else if (e.key === '-') {
      handleOperator('-');
    } else if (e.key === '*') {
      handleOperator('×');
    } else if (e.key === '/') {
      e.preventDefault();
      handleOperator('÷');
    } else if (e.key === '^') {
      handleOperator('^');
    } else if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      calculate();
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Escape') {
      handleClear();
    } else if (e.key === '(' || e.key === ')') {
      handleParens();
    }
  });

  // Initialize Supabase & App
  initSupabase();
  renderHistory();
  updateDisplay();

});
