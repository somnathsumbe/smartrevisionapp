/* Smart Revision & Exam Practice — Vanilla JavaScript ES6 */
(() => {
  'use strict';

  const STUDENT_NAME = 'Shivansh Sumbe';
  const SUBJECTS = [
    { id: 'english', name: 'English', className: 'Class 4', file: 'english.json' },
    { id: 'marathi', name: 'Marathi', className: 'Class 4', file: 'question-banks/marathi.json' },
    { id: 'hindi', name: 'Hindi', className: 'Class 4', file: 'question-banks/hindi.json' },
    { id: 'mathematics', name: 'Mathematics', className: 'Class 4', file: 'question-banks/mathematics.json' },
    { id: 'computer', name: 'Computer', className: 'Class 4', file: 'question-banks/computer.json' },
    { id: 'evs-1', name: 'EVS 1', className: 'Class 4', file: 'question-banks/evs1.json' },
    { id: 'evs-2', name: 'EVS 2', className: 'Class 4', file: 'question-banks/evs2.json' }
  ];
  const els = Object.fromEntries([
    'alertArea', 'heroQuestionCount', 'subjectSelect', 'paperSubjectSelect', 'jsonUpload',
    'setupPanel', 'generatorPanel', 'examPaper', 'questionCountSelect', 'marksPerQuestion',
    'timeAllowed', 'paperNotice', 'generatePaperBtn', 'printPaperBtn', 'printAnswerKeyBtn',
    'quizPanel', 'resultPanel', 'quizSubtitle', 'quizTitle', 'studentGreeting', 'progressLabel',
    'scoreLabel', 'progressBar', 'questionContainer', 'feedbackBox', 'prevBtn', 'checkBtn',
    'nextBtn', 'submitBtn', 'changeSetupBtn', 'startBtn', 'resultTitle', 'resultSubtitle',
    'resultPercent', 'resultStats', 'reviewList', 'retryWrongBtn', 'retryAllBtn', 'changeSubjectBtn', 'printBtn',
    'exportResultBtn', 'downloadTemplateBtn'
  ].map(id => [id, document.getElementById(id)]));

  const state = {
    data: null, activeBankId: null, bankCache: new Map(), subject: null, questions: [], originalQuestions: [], answers: new Map(),
    checked: new Map(), index: 0, mode: 'practice', result: null
  };
  const TYPE_LABELS = {
    mcq: 'Multiple choice', 'fill-blank': 'Fill in the blank', 'true-false': 'True or false',
    'short-answer': 'Short answer', 'long-answer': 'Long answer', 'word-meanings': 'Word meanings',
    sentence: 'Sentence'
  };
  const template = {
    appName: 'Smart Revision & Exam Practice',
    version: 1,
    settings: { caseInsensitive: true, trimAnswers: true },
    subjects: [{
      id: 'sample-subject', name: 'Subject name', className: 'Class 4', board: 'State Board',
      chapters: [{
        id: 'sample-demo', name: 'Demo Practice',
        questions: [{
          id: 'q1', type: 'fill-blank', question: 'Fill in the blank.',
          items: [{ prompt: 'The sun rises in the _____.', answer: 'east' }], marks: 1
        }]
      }]
    }]
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const clone = value => JSON.parse(JSON.stringify(value));
  const normalize = value => {
    const text = String(value ?? '').trim().replace(/\s+/g, ' ');
    return state.data?.settings?.caseInsensitive === false ? text : text.toLocaleLowerCase();
  };
  const questionsFor = subject => subject.questions || [];

  function alertMsg(message, type = 'warning') {
    els.alertArea.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${esc(message)}<button type="button" class="btn-close" aria-label="Close"></button></div>`;
    els.alertArea.querySelector('.btn-close').addEventListener('click', () => els.alertArea.replaceChildren());
  }

  function normalizeData(data) {
    if (Array.isArray(data?.subjects)) {
      data.subjects.forEach(subject => {
        if (!Array.isArray(subject.questions) && Array.isArray(subject.chapters)) {
          subject.questions = subject.chapters.flatMap(chapter => chapter.questions || []);
        }
      });
      return data;
    }
    if (Array.isArray(data?.questions)) {
      return {
        appName: data.title || 'Smart Revision & Exam Practice',
        version: 1,
        description: data.description || '',
        settings: { caseInsensitive: true, trimAnswers: true },
        subjects: [{
          id: 'imported-subject',
          name: data.subject || 'English',
          className: typeof data.class === 'number' ? `Class ${data.class}` : data.className || '',
          questions: data.questions.map((question, index) => {
            const imported = {
              ...question,
              id: question.id || `imported-${index + 1}`,
              type: question.type || question.questionType || 'short-answer',
              question: question.question || `Question ${index + 1}`
            };
            if (!imported.items && Array.isArray(question.subQuestions)) {
              imported.items = question.subQuestions.map(item => ({ prompt: item.question, answer: item.answer }));
            }
            if (!imported.items && Array.isArray(question.answer) && question.answer.every(item => item && typeof item === 'object')) {
              imported.items = question.answer.map(item => ({
                prompt: item.word || item.statement || item.prompt || item.scrambled || '',
                answer: item.answer || item.answers?.join(', ') || '',
                options: item.options
              }));
            }
            if (!imported.items && question.answer !== undefined) {
              imported.items = [{
                prompt: imported.question,
                answer: question.answer,
                acceptedAnswers: question.acceptedAnswers,
                options: question.options
              }];
            }
            return imported;
          })
        }]
      };
    }
    throw new Error('JSON must contain a subjects array or a questions array.');
  }

  function validate(data) {
    const bank = normalizeData(data);
    if (!bank.subjects.length) throw new Error('No subjects found in this JSON.');
    bank.settings = { caseInsensitive: true, trimAnswers: true, ...bank.settings };
    bank.subjects.forEach(subject => {
      if (!subject.name || !Array.isArray(subject.questions) || !subject.questions.length) {
        throw new Error(`Subject ${subject.name || '(unnamed)'} must have a name and questions.`);
      }
      subject.questions.forEach((question, index) => {
        if (!question.id || !question.type || !question.question) {
          throw new Error(`${subject.name}: question ${index + 1} needs id, type and question.`);
        }
        if (question.type === 'mcq' &&
            !((Array.isArray(question.options) && question.options.length) ||
              question.items?.some(item => Array.isArray(item.options) && item.options.length))) {
          throw new Error(`${subject.name}: multiple-choice question ${index + 1} needs options.`);
        }
        if (question.items) {
          question.items.forEach((item, itemIndex) => {
            if (item.prompt === undefined) item.prompt = `Item ${itemIndex + 1}`;
            if (item.answer === undefined) item.answer = '';
            if (item.options === undefined && question.options) item.options = question.options;
          });
        } else {
          question.items = [{
            prompt: question.question,
            answer: question.answer ?? '',
            acceptedAnswers: question.acceptedAnswers,
            options: question.options
          }];
        }
      });
    });
    return bank;
  }

  async function loadData() {
    populateSubjects();
    try {
      await activateSubjectBank('english');
      updateCount();
    } catch (error) {
      state.data = null;
      state.activeBankId = null;
      updateCount();
      alertMsg(`Could not load the English question bank: ${error.message} Run this folder through a local server or load a subject JSON file.`, 'warning');
    }
  }

  function allQuestions() {
    return state.data?.subjects.flatMap(questionsFor) || [];
  }

  function updateCount() {
    els.heroQuestionCount.textContent = state.data ? String(allQuestions().length) : '—';
  }

  function populateSubjects(selectedSubjectName) {
    const options = SUBJECTS.map(subject =>
      `<option value="${esc(subject.id)}">${esc(subject.name)}${subject.className ? ` — ${esc(subject.className)}` : ''}</option>`
    ).join('');
    [els.subjectSelect, els.paperSubjectSelect].forEach(select => {
      select.innerHTML = options;
      const subject = SUBJECTS.find(item => item.name === selectedSubjectName);
      if (subject) select.value = subject.id;
    });
  }

  function selectedSubject(select = els.subjectSelect) {
    return SUBJECTS.find(subject => subject.id === select.value) || SUBJECTS[0];
  }

  async function loadSubjectBank(subjectConfig) {
    const cached = state.bankCache.get(subjectConfig.id);
    if (cached) return cached;
    if (!subjectConfig.file) throw new Error(`No JSON file is mapped to ${subjectConfig.name}.`);
    const response = await fetch(`./${subjectConfig.file}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${subjectConfig.file} could not be found.`);
    const bank = validate(await response.json());
    const subject = bank.subjects.find(item =>
      item.name.trim().toLocaleLowerCase() === subjectConfig.name.toLocaleLowerCase()
    );
    if (!subject) throw new Error(`${subjectConfig.file} does not contain the ${subjectConfig.name} subject.`);
    const normalizedBank = { ...bank, subjects: [subject] };
    state.bankCache.set(subjectConfig.id, normalizedBank);
    return normalizedBank;
  }

  async function activateSubjectBank(subjectId) {
    const subjectConfig = SUBJECTS.find(item => item.id === subjectId);
    if (!subjectConfig) throw new Error('Select a valid subject.');
    const bank = await loadSubjectBank(subjectConfig);
    state.data = bank;
    state.activeBankId = subjectId;
    updateCount();
    return bank.subjects[0];
  }

  async function handleSubjectChange(select) {
    const subject = selectedSubject(select);
    if (select === els.paperSubjectSelect) {
      els.examPaper.classList.add('d-none');
      els.printPaperBtn.classList.add('d-none');
      els.printAnswerKeyBtn.classList.add('d-none');
    }
    try {
      const bank = await loadSubjectBank(subject);
      if (select.value === subject.id) {
        state.data = bank;
        state.activeBankId = subject.id;
        updateCount();
        els.alertArea.replaceChildren();
      }
    } catch (error) {
      if (select.value === subject.id) {
        state.data = null;
        state.activeBankId = null;
        updateCount();
        alertMsg(`Could not load ${subject.name}: ${error.message}`, 'danger');
      }
    }
  }

  async function startQuiz(subset = null) {
    const subjectConfig = state.subject && subset
      ? SUBJECTS.find(item => item.name === state.subject.name)
      : selectedSubject();
    let subject;
    try {
      subject = await activateSubjectBank(subjectConfig.id);
    } catch (error) {
      alertMsg(`Could not load ${subjectConfig.name}: ${error.message}`, 'danger');
      return;
    }
    const list = subset || questionsFor(subject);
    if (!list.length) return alertMsg(`No questions are available for ${subject.name}.`, 'warning');
    state.subject = subject;
    state.questions = list.map(clone);
    state.originalQuestions = list.map(clone);
    state.answers = new Map();
    state.checked = new Map();
    state.index = 0;
    state.mode = document.querySelector('input[name="mode"]:checked')?.value || 'practice';
    state.result = null;
    els.setupPanel.classList.add('d-none');
    els.generatorPanel.classList.add('d-none');
    els.resultPanel.classList.add('d-none');
    els.quizPanel.classList.remove('d-none');
    els.quizSubtitle.textContent = state.mode === 'exam' ? 'EXAM MODE' : 'REVISION MODE';
    els.quizTitle.textContent = `${subject.name} practice`;
    els.studentGreeting.textContent = `Student: ${STUDENT_NAME}`;
    renderQuestion();
    els.quizPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function current() {
    return state.questions[state.index];
  }

  function renderQuestion() {
    const question = current();
    const saved = state.answers.get(question.id) || {};
    const checked = state.checked.get(question.id);
    const locked = Boolean(checked) && state.mode !== 'exam';
    const total = state.questions.length;
    els.progressLabel.textContent = `Question ${state.index + 1} of ${total}`;
    const progress = Math.round((state.index + 1) / total * 100);
    els.progressBar.style.width = `${progress}%`;
    els.progressBar.parentElement.setAttribute('aria-valuenow', String(progress));
    updateScore();

    const itemHtml = question.items.map((item, index) => {
      const value = Object.prototype.hasOwnProperty.call(saved, index) ? saved[index] : '';
      const itemResult = checked?.items[index];
      let input;
      if (question.type === 'mcq') {
        input = `<div class="choice-list">${item.options.map(option =>
          `<label class="choice-option"><input type="radio" name="answer-${index}" data-item="${index}" value="${esc(option)}" ${normalize(value) === normalize(option) ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${esc(option)}</span></label>`
        ).join('')}</div>`;
      } else if (question.type === 'true-false') {
        input = `<div class="d-flex gap-2"><label class="btn btn-outline-primary"><input class="form-check-input me-1" type="radio" name="answer-${index}" data-item="${index}" value="True" ${normalize(value) === 'true' ? 'checked' : ''} ${locked ? 'disabled' : ''}> True</label><label class="btn btn-outline-primary"><input class="form-check-input me-1" type="radio" name="answer-${index}" data-item="${index}" value="False" ${normalize(value) === 'false' ? 'checked' : ''} ${locked ? 'disabled' : ''}> False</label></div>`;
      } else {
        input = `<input class="form-control answer-input" data-item="${index}" value="${esc(value)}" placeholder="Type your answer..." ${locked ? 'disabled' : ''}>`;
      }
      const resultClass = itemResult ? (itemResult.correct ? 'correct-item' : 'wrong-item') : '';
      const correctText = itemResult && !itemResult.correct
        ? `<div class="small text-danger mt-2">Correct answer: ${esc(displayAnswer(item))}</div>` : '';
      return `<div class="question-item ${resultClass}"><div class="item-prompt">${esc(item.prompt)}</div>${input}${correctText}</div>`;
    }).join('');

    els.questionContainer.innerHTML = `<span class="question-type">${esc(TYPE_LABELS[question.type] || question.type)}</span><h3 class="question-text">${esc(question.question)}</h3>${question.description ? `<p class="text-secondary">${esc(question.description)}</p>` : ''}${itemHtml}`;
    els.questionContainer.querySelectorAll('[data-item]').forEach(input => {
      input.addEventListener('input', saveAnswer);
      input.addEventListener('change', saveAnswer);
    });
    function saveAnswer(event) {
      const answers = { ...(state.answers.get(question.id) || {}) };
      answers[event.currentTarget.dataset.item] = event.currentTarget.value;
      state.answers.set(question.id, answers);
      if (state.mode === 'practice') state.checked.delete(question.id);
      updateScore();
    }

    if (checked && state.mode === 'practice') {
      els.feedbackBox.classList.remove('d-none', 'success', 'error');
      els.feedbackBox.classList.add(checked.correct ? 'success' : 'error');
      els.feedbackBox.textContent = checked.correct ? '✓ Correct answer!' : '✕ Review the answer shown above.';
    } else {
      els.feedbackBox.classList.add('d-none');
      els.feedbackBox.textContent = '';
    }
    els.prevBtn.disabled = state.index === 0;
    const lastQuestion = state.index === total - 1;
    els.nextBtn.classList.toggle('d-none', lastQuestion);
    els.submitBtn.classList.toggle('d-none', !lastQuestion);
    els.checkBtn.classList.toggle('d-none', state.mode === 'exam' || Boolean(checked));
  }

  function displayAnswer(item) {
    return Array.isArray(item.answer) ? item.answer.join(', ') : String(item.answer ?? '');
  }

  function itemCorrect(item, value) {
    if (value === undefined || value === null || String(value).trim() === '') return false;
    const accepted = Array.isArray(item.acceptedAnswers) ? item.acceptedAnswers : [item.answer];
    return accepted.some(answer => normalize(value) === normalize(answer));
  }

  function evaluate(question) {
    const answers = state.answers.get(question.id) || {};
    const items = question.items.map((item, index) => ({
      correct: itemCorrect(item, answers[index]),
      answer: answers[index] ?? '',
      correctAnswer: displayAnswer(item),
      prompt: item.prompt
    }));
    return { correct: items.every(item => item.correct), items, correctCount: items.filter(item => item.correct).length, total: items.length };
  }

  function checkCurrent() {
    state.checked.set(current().id, evaluate(current()));
    renderQuestion();
  }

  function updateScore() {
    let correct = 0;
    let total = 0;
    state.questions.forEach(question => {
      const result = state.checked.get(question.id);
      if (result) {
        correct += result.correctCount;
        total += result.total;
      }
    });
    els.scoreLabel.textContent = `Correct answers: ${correct}${total ? ` / ${total}` : ''}`;
  }

  function next() {
    if (state.index < state.questions.length - 1) {
      state.index += 1;
      renderQuestion();
    }
  }

  function previous() {
    if (state.index > 0) {
      state.index -= 1;
      renderQuestion();
    }
  }

  function submit() {
    state.questions.forEach(question => {
      if (!state.checked.has(question.id) || state.mode === 'exam') {
        state.checked.set(question.id, evaluate(question));
      }
    });
    const answers = state.questions.flatMap(question => state.checked.get(question.id).items.map(item => ({
      questionId: question.id,
      question: question.question,
      prompt: item.prompt,
      userAnswer: item.answer || 'Not answered',
      correctAnswer: item.correctAnswer,
      correct: item.correct,
      type: question.type,
      marks: question.marks || 1
    })));
    const correctCount = answers.filter(answer => answer.correct).length;
    state.result = {
      appName: state.data.appName, studentName: STUDENT_NAME, subject: state.subject.name,
      mode: state.mode, completedAt: new Date().toISOString(), totalQuestions: state.questions.length,
      totalItems: answers.length, correctCount, wrongCount: answers.length - correctCount,
      percentage: answers.length ? Math.round(correctCount / answers.length * 100) : 0, answers
    };
    showResults();
  }

  function showResults() {
    const result = state.result;
    els.quizPanel.classList.add('d-none');
    els.resultPanel.classList.remove('d-none');
    els.resultTitle.textContent = result.percentage >= 90 ? 'Excellent revision!' : result.percentage >= 70 ? 'Good work — keep practising!' : 'Keep going — practice makes progress!';
    els.resultSubtitle.textContent = `Student: ${STUDENT_NAME} · ${result.subject}`;
    els.resultPercent.textContent = `${result.percentage}%`;
    els.resultStats.innerHTML = [
      { label: 'Correct answers', number: `${result.correctCount} / ${result.totalItems}` },
      { label: 'Question groups', number: result.totalQuestions },
      { label: 'Needs revision', number: result.wrongCount }
    ].map(item => `<div class="col-12 col-md-4"><div class="stat-card"><div class="number">${esc(item.number)}</div><div class="label">${esc(item.label)}</div></div></div>`).join('');
    els.retryWrongBtn.classList.toggle('d-none', !result.answers.some(answer => !answer.correct));
    els.reviewList.innerHTML = result.answers.map((answer, index) =>
      `<article class="review-item ${answer.correct ? 'review-correct' : 'review-wrong'}"><div class="review-question">${index + 1}. ${esc(answer.prompt || answer.question)}</div><div class="review-answer"><strong>Your answer:</strong> ${esc(answer.userAnswer)}</div>${!answer.correct ? `<div class="review-answer"><strong>Correct answer:</strong> ${esc(answer.correctAnswer)}</div>` : ''}<div class="small text-secondary mt-1">${esc(TYPE_LABELS[answer.type] || answer.type)}</div></article>`
    ).join('');
    els.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function retryWrong() {
    const wrongIds = new Set(state.result.answers.filter(answer => !answer.correct).map(answer => answer.questionId));
    const subset = state.originalQuestions.filter(question => wrongIds.has(question.id));
    if (subset.length) startQuiz(subset);
  }

  function backToSetup() {
    els.quizPanel.classList.add('d-none');
    els.resultPanel.classList.add('d-none');
    els.setupPanel.classList.remove('d-none');
    els.generatorPanel.classList.remove('d-none');
    els.setupPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function shuffledUniqueQuestions(subject) {
    const unique = [];
    const ids = new Set();
    questionsFor(subject).forEach(question => {
      if (!ids.has(question.id)) {
        ids.add(question.id);
        unique.push(question);
      }
    });
    for (let index = unique.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [unique[index], unique[swapIndex]] = [unique[swapIndex], unique[index]];
    }
    return unique;
  }

  async function generatePaper() {
    const subjectConfig = selectedSubject(els.paperSubjectSelect);
    els.examPaper.classList.add('d-none');
    els.printPaperBtn.classList.add('d-none');
    els.printAnswerKeyBtn.classList.add('d-none');
    let subject;
    try {
      subject = await activateSubjectBank(subjectConfig.id);
    } catch (error) {
      alertMsg(`Could not load ${subjectConfig.name}: ${error.message}`, 'danger');
      return;
    }
    const marks = Number(els.marksPerQuestion.value);
    if (!Number.isInteger(marks) || marks < 1 || marks > 100) {
      return alertMsg('Marks per question must be a whole number from 1 to 100.', 'warning');
    }
    const available = shuffledUniqueQuestions(subject);
    const requested = els.questionCountSelect.value === 'all' ? available.length : Number(els.questionCountSelect.value);
    const questions = available.slice(0, requested);
    if (!questions.length) return alertMsg(`No questions are available for ${subject.name}.`, 'warning');
    const totalMarks = questions.length * marks;
    const date = new Date().toLocaleDateString();
    const warning = questions.length < requested
      ? `Only ${questions.length} unique question${questions.length === 1 ? '' : 's'} are available for ${subject.name}; no duplicates were added.`
      : `${questions.length} shuffled questions included.`;
    els.paperNotice.textContent = warning;
    els.examPaper.innerHTML = `
      <div class="paper-actions no-print"><strong>${esc(warning)}</strong><div class="d-flex flex-wrap gap-2 mt-2"><button class="btn btn-primary" id="paperPrintAction" type="button">Print Exam Paper</button><button class="btn btn-outline-secondary" id="keyPrintAction" type="button">Print Answer Key</button></div></div>
      <section class="student-paper">
        <header class="paper-heading"><div class="paper-school">SMART REVISION &amp; EXAM PRACTICE</div><div class="paper-demo">DEMO PAPER — REPLACE WITH YOUR SYLLABUS</div><h2>${esc(subject.name)} Examination</h2><div class="paper-meta"><span><strong>Student:</strong> ${STUDENT_NAME}</span><span><strong>Date:</strong> ${date}</span><span><strong>Roll No.:</strong> __________________</span><span><strong>Time Allowed:</strong> ${esc(els.timeAllowed.value || '30 minutes')}</span><span><strong>Total Marks:</strong> ${totalMarks}</span></div></header>
        <div class="paper-instructions"><strong>Instructions:</strong><ol><li>Read every question carefully.</li><li>Answer all questions. Each question carries ${marks} mark${marks === 1 ? '' : 's'}.</li><li>For multiple-choice questions, tick one answer. Write other answers neatly in the space provided.</li></ol></div>
        <ol class="paper-questions">${questions.map(question => paperQuestion(question, marks)).join('')}</ol>
        <div class="paper-end">— End of Paper —</div>
      </section>
      <section class="answer-key"><h2>Answer Key — ${esc(subject.name)}</h2><p>Student: ${STUDENT_NAME} · Total Marks: ${totalMarks}</p><ol>${questions.map(question => `<li>${esc(question.question)} <strong>(${marks} mark${marks === 1 ? '' : 's'})</strong>${question.items.map(item => `<div class="key-answer">${item.prompt && item.prompt !== question.question ? `${esc(item.prompt)}: ` : ''}${esc(displayAnswer(item))}</div>`).join('')}</li>`).join('')}</ol></section>`;
    els.examPaper.classList.remove('d-none');
    els.printPaperBtn.classList.remove('d-none');
    els.printAnswerKeyBtn.classList.remove('d-none');
    els.examPaper.querySelector('#paperPrintAction').addEventListener('click', printPaper);
    els.examPaper.querySelector('#keyPrintAction').addEventListener('click', printAnswerKey);
    els.examPaper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function paperQuestion(question, marks) {
    const items = question.items.map(item => {
      const prompt = item.prompt && item.prompt !== question.question
        ? `<div class="paper-item-prompt">${esc(item.prompt)}</div>` : '';
      let response;
      if (question.type === 'mcq') {
        response = `<ul class="paper-options">${item.options.map(option => `<li>☐ ${esc(option)}</li>`).join('')}</ul>`;
      } else if (question.type === 'true-false') {
        response = '<div class="paper-options"><span>☐ True</span><span>☐ False</span></div>';
      } else {
        response = '<div class="paper-writing-line"></div>';
      }
      return `<div class="paper-subquestion">${prompt}${response}</div>`;
    }).join('');
    return `<li class="paper-question"><div class="paper-question-text">${esc(question.question)} <span class="paper-marks">[${marks} mark${marks === 1 ? '' : 's'}]</span></div>${items}</li>`;
  }

  function printPaper() {
    document.body.classList.remove('print-answer-key');
    window.print();
  }

  function printAnswerKey() {
    document.body.classList.add('print-answer-key');
    window.print();
  }

  function printReport() {
    document.body.classList.add('print-report');
    window.print();
  }

  function download(name, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function uploadJson(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const currentSubject = selectedSubject();
    try {
      const banks = await Promise.all(files.map(async file => validate(JSON.parse(await file.text()))));
      banks.forEach(bank => bank.subjects.forEach(subject => {
        let subjectConfig = SUBJECTS.find(existing =>
          existing.name.trim().toLocaleLowerCase() === subject.name.trim().toLocaleLowerCase()
        );
        if (!subjectConfig) {
          let id = String(subject.id || subject.name).toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          while (SUBJECTS.some(existing => existing.id === id)) id = `${id}-imported`;
          subjectConfig = { id, name: subject.name, className: subject.className || '', file: null };
          SUBJECTS.push(subjectConfig);
        }
        state.bankCache.set(subjectConfig.id, validate({
          appName: bank.appName,
          version: bank.version,
          settings: bank.settings,
          subjects: [subject]
        }));
      }));
      populateSubjects(currentSubject?.name);
      await handleSubjectChange(els.subjectSelect);
      await handleSubjectChange(els.paperSubjectSelect);
      els.examPaper.classList.add('d-none');
      els.printPaperBtn.classList.add('d-none');
      els.printAnswerKeyBtn.classList.add('d-none');
      alertMsg(`Loaded ${files.length} JSON file${files.length === 1 ? '' : 's'} successfully.`, 'success');
    } catch (error) {
      alertMsg(`Could not load JSON: ${error.message}`, 'danger');
    } finally {
      event.target.value = '';
    }
  }

  els.subjectSelect.addEventListener('change', () => handleSubjectChange(els.subjectSelect));
  els.paperSubjectSelect.addEventListener('change', () => handleSubjectChange(els.paperSubjectSelect));
  els.startBtn.addEventListener('click', () => startQuiz());
  els.jsonUpload.addEventListener('change', uploadJson);
  els.downloadTemplateBtn.addEventListener('click', () => download('questions-template.json', JSON.stringify(template, null, 2)));
  els.prevBtn.addEventListener('click', previous);
  els.nextBtn.addEventListener('click', next);
  els.checkBtn.addEventListener('click', checkCurrent);
  els.submitBtn.addEventListener('click', submit);
  els.changeSetupBtn.addEventListener('click', backToSetup);
  els.changeSubjectBtn.addEventListener('click', backToSetup);
  els.retryAllBtn.addEventListener('click', () => startQuiz());
  els.retryWrongBtn.addEventListener('click', retryWrong);
  els.printBtn.addEventListener('click', printReport);
  els.exportResultBtn.addEventListener('click', () => {
    if (state.result) download('revision-result.json', JSON.stringify(state.result, null, 2));
  });
  els.generatePaperBtn.addEventListener('click', generatePaper);
  els.printPaperBtn.addEventListener('click', printPaper);
  els.printAnswerKeyBtn.addEventListener('click', printAnswerKey);
  window.addEventListener('afterprint', () => document.body.classList.remove('print-answer-key', 'print-report'));

  loadData();
})();
