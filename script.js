
/* Wheel of Life Tracker , Client-only app
 * Storage schema (localStorage key: WOL_ENTRIES_V1):
 * [ { id, date, scores: {Category: value}, note } ]
 */
(function () {
    const STORAGE_KEY = 'WOL_ENTRIES_V1';
    const THEME_KEY = 'WOL_THEME';
    const categories = [
      'Business / Career',
      'Finances',
      'Health',
      'Family and Friends',
      'Romance',
      'Personal Development',
      'Fun and Recreation',
      'Contribution to Society'
    ];
    const colors = [
      '#8b5cf6', '#06b6d4', '#22c55e', '#f97316', '#ef4444', '#0ea5e9', '#eab308', '#14b8a6'
    ];
  
    // DOM refs
    const avgCanvas = document.getElementById('avgChart');
    const avgStats = document.getElementById('avgStats');
    const entryCanvas = document.getElementById('entryChart');
    const entryDate = document.getElementById('entryDate');
    const entryNote = document.getElementById('entryNote');
    const entryForm = document.getElementById('entryForm');
    const editIdInput = document.getElementById('editId');
    const resetEntryBtn = document.getElementById('resetEntryBtn');
    const viewEntriesBtn = document.getElementById('viewEntriesBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const themeToggle = document.getElementById('themeToggle');
    const toastEl = document.getElementById('toast');
    const entriesModal = document.getElementById('entriesModal');
    const closeEntriesBtn = document.getElementById('closeEntries');
    const entriesList = document.getElementById('entriesList');
    const importModal = document.getElementById('importModal');
    const closeImportBtn = document.getElementById('closeImport');
    const importFileInput = document.getElementById('importFileInput');
    const fileNameSpan = document.getElementById('fileName');
    const entryDetailModal = document.getElementById('entryDetailModal');
    const closeDetailBtn = document.getElementById('closeDetail');
    const detailChart = document.getElementById('detailChart');
    const aboutBtn = document.getElementById('aboutBtn');
    const aboutModal = document.getElementById('aboutModal');
    const closeAboutBtn = document.getElementById('closeAbout');
  
    // State
    let entries = loadEntries();
    let entryValues = new Array(categories.length).fill(0); // current entry values 0..10
    let activeIndex = null; // which category is being adjusted via drag
    let isDragging = false;
    let completionFeedbackShown = false; // track if completion confetti was shown for current entry
  
    // Theme init
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'light' ? '🌙' : '🌞';
  
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(THEME_KEY, next);
      themeToggle.textContent = next === 'light' ? '🌙' : '🌞';
      
      // Update chart label colors for the new theme
      updateChartLabelColors();
    });
  
    // Date default
    entryDate.valueAsNumber = Date.now() - (new Date()).getTimezoneOffset()*60000; // local today
  
    // Charts
    const baseOptions = {
      type: 'radar',
      options: {
        responsive: true,
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true, callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}` } }
        },
        scales: {
          r: {
            min: 0, max: 10, beginAtZero: true, ticks: { stepSize: 2, showLabelBackdrop: false },
            grid: { color: 'rgba(148,163,184,.3)' }, angleLines: { color: 'rgba(148,163,184,.25)' },
            pointLabels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') }
          }
        }
      }
    };
  
    // Average chart
    const avgChart = new Chart(avgCanvas.getContext('2d'), {
      ...baseOptions,
      data: {
        labels: categories,
        datasets: [{
          label: 'Average', data: new Array(categories.length).fill(0),
          backgroundColor: 'rgba(14,165,233,0.25)',
          borderColor: '#0ea5e9', borderWidth: 2, pointBackgroundColor: colors
        }]
      }
    });
  
    // Entry chart (interactive)
    const entryChart = new Chart(entryCanvas.getContext('2d'), {
      ...baseOptions,
      options: {
        ...baseOptions.options,
        events: ['mousemove','mousedown','mouseup','click','touchstart','touchmove','touchend'],
        plugins: { ...baseOptions.options.plugins, tooltip: { enabled: false } }
      },
      data: {
        labels: categories,
        datasets: [{
          label: 'Entry', data: entryValues,
          backgroundColor: 'rgba(124,58,237,0.22)',
          borderColor: '#7c3aed', borderWidth: 2, pointBackgroundColor: colors, pointRadius: 4
        }]
      }
    });
  
    // Utility: toast
    function toast(msg) {
      toastEl.textContent = msg;
      gsap.killTweensOf(toastEl);
      gsap.set(toastEl, { y: 40, opacity: 0 });
      gsap.to(toastEl, { opacity: 1, y: 0, duration: .25, ease: 'power3.out' });
      gsap.to(toastEl, { delay: 2.2, opacity: 0, y: 20, duration: .35, ease: 'power3.in' });
    }
  
    // Utility: confetti celebration
    function triggerConfetti() {
      const count = 150;
      const defaults = {
        origin: { y: 0.7 },
        zIndex: 9999
      };
  
      function fire(particleRatio, opts) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      }
  
      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });
      fire(0.2, {
        spread: 60,
      });
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
      });
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });
    }
  
    // Utility: show celebration message
    function showCelebrationMessage(msg, duration = 3000) {
      toastEl.textContent = msg;
      toastEl.style.fontSize = '15px';
      toastEl.style.maxWidth = '500px';
      toastEl.style.textAlign = 'center';
      toastEl.style.lineHeight = '1.5';
      gsap.killTweensOf(toastEl);
      gsap.set(toastEl, { y: 40, opacity: 0 });
      gsap.to(toastEl, { opacity: 1, y: 0, duration: .3, ease: 'power3.out' });
      gsap.to(toastEl, { delay: duration / 1000, opacity: 0, y: 20, duration: .35, ease: 'power3.in', onComplete: () => {
        toastEl.style.fontSize = '';
        toastEl.style.maxWidth = '';
        toastEl.style.textAlign = '';
        toastEl.style.lineHeight = '';
      }});
    }
  
    // Check if all 8 areas are filled and trigger completion feedback
    function checkCompletionFeedback() {
      if (!completionFeedbackShown && entryValues.every(v => v > 0)) {
        completionFeedbackShown = true;
        triggerConfetti();
        showCelebrationMessage("🎉 Nice! All 8 areas done, just check your date and note before saving.", 3500);
      }
    }
  
    // Update chart label colors when theme changes
    function updateChartLabelColors() {
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text');
      
      if (avgChart.options.scales.r) {
        avgChart.options.scales.r.pointLabels.color = textColor;
        avgChart.update();
      }
      
      if (entryChart.options.scales.r) {
        entryChart.options.scales.r.pointLabels.color = textColor;
        entryChart.update();
      }
      
      if (detailChartInstance && detailChartInstance.options.scales.r) {
        detailChartInstance.options.scales.r.pointLabels.color = textColor;
        detailChartInstance.update();
      }
    }
  
    // Storage helpers
    function loadEntries() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch { return []; }
    }
    function saveEntries(next) {
      entries = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  
    // Compute averages per category (handles empty)
    function computeAverages() {
      const sums = new Array(categories.length).fill(0);
      if (!entries.length) return sums;
      for (const e of entries) {
        categories.forEach((c, i) => { sums[i] += Number(e.scores[c] ?? 0); });
      }
      return sums.map(x => +(x / entries.length).toFixed(2));
    }
  
    function renderAvg() {
      const avgs = computeAverages();
      avgChart.data.datasets[0].data = avgs;
      avgChart.update();
  
      // Stats grid
      avgStats.innerHTML = '';
      categories.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'stat';
        div.innerHTML = `<span class="label">${c}</span><span class="val">${avgs[i] || 0}</span>`;
        avgStats.appendChild(div);
      });
    }
  
    // Interactive entry chart: click to select index; drag to set value by radius
    function getRelativePos(evt, chart) {
      const canvasPosition = Chart.helpers.getRelativePosition(evt, chart);
      return canvasPosition; // {x,y} relative to canvas
    }
    function setValueFromEvent(evt, chart, index) {
      const pos = getRelativePos(evt, chart);
      const rScale = chart.scales.r;
      const dx = pos.x - rScale.xCenter;
      const dy = pos.y - rScale.yCenter;
      const dist = Math.hypot(dx, dy);
      const value = Math.max(0, Math.min(10, Math.round((dist / rScale.drawingArea) * 10)));
      entryValues[index] = value;
      chart.data.datasets[0].data = entryValues;
      chart.update();
      checkCompletionFeedback();
    }
    function nearestIndexByAngle(evt, chart) {
      // Map pointer angle to nearest category angle
      const pos = getRelativePos(evt, chart);
      const rScale = chart.scales.r;
      const dx = pos.x - rScale.xCenter;
      const dy = pos.y - rScale.yCenter;
      
      // Chart.js radar charts start at top (12 o'clock) and go clockwise
      // atan2 gives 0 at right (3 o'clock), so we need to rotate by -90 degrees (-PI/2)
      let angle = Math.atan2(dx, -dy); // Swapped and negated to align with chart
      if (angle < 0) angle += Math.PI * 2;
      const sector = (Math.PI * 2) / categories.length;
      return Math.round(angle / sector) % categories.length;
    }
  
    function handlePointerDown(evt) {
      // Check if click is within the chart area
      const pos = getRelativePos(evt, entryChart);
      const rScale = entryChart.scales.r;
      const dx = pos.x - rScale.xCenter;
      const dy = pos.y - rScale.yCenter;
      const dist = Math.hypot(dx, dy);
      
      // Only register clicks inside the chart's drawing area
      if (dist > rScale.drawingArea) return;
      
      activeIndex = nearestIndexByAngle(evt, entryChart);
      isDragging = true;
      setValueFromEvent(evt, entryChart, activeIndex);
    }
    function handlePointerMove(evt) {
      if (!isDragging || activeIndex == null) return;
      setValueFromEvent(evt, entryChart, activeIndex);
    }
    function handlePointerUp() {
      isDragging = false; activeIndex = null;
    }
  
    // Attach events (mouse + touch)
    entryCanvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    entryCanvas.addEventListener('touchstart', e => { e.preventDefault(); handlePointerDown(e.changedTouches[0]); });
    window.addEventListener('touchmove', e => { if (e.changedTouches[0]) handlePointerMove(e.changedTouches[0]); });
    window.addEventListener('touchend', handlePointerUp);
  
    // Reset entry values
    function resetEntry() {
      entryValues = new Array(categories.length).fill(0);
      entryChart.data.datasets[0].data = entryValues;
      entryChart.update();
      editIdInput.value = '';
      entryNote.value = '';
      entryDate.valueAsNumber = Date.now() - (new Date()).getTimezoneOffset()*60000;
      completionFeedbackShown = false; // Reset completion feedback flag
    }
    resetEntryBtn.addEventListener('click', resetEntry);
  
    // Save entry (new or update)
    entryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // Validation: ensure all categories rated (>=1)
      if (entryValues.some(v => v === 0)) {
        toast('Please rate all categories (1–10). Drag each spoke outward.');
        return;
      }
      const payload = {
        id: editIdInput.value || `${Date.now()}`,
        date: entryDate.value,
        scores: Object.fromEntries(categories.map((c, i) => [c, entryValues[i]])),
        note: (entryNote.value || '').trim()
      };
  
      const idx = entries.findIndex(e => e.id === payload.id);
      if (idx >= 0) {
        entries[idx] = payload;
        triggerConfetti();
        showCelebrationMessage('Entry updated successfully! 🎉', 2500);
      } else {
        entries.push(payload);
        triggerConfetti();
        showCelebrationMessage('Entry saved successfully! 🎉 Woohoo!', 2500);
      }
      saveEntries(entries);
      renderAvg();
      resetEntry();
    });
  
    // Entries modal
    function openEntries() {
      renderEntriesList();
      entriesModal.showModal();
    }
    function closeEntries() { entriesModal.close(); }
    viewEntriesBtn.addEventListener('click', openEntries);
    closeEntriesBtn.addEventListener('click', closeEntries);
  
    function renderEntriesList() {
      entriesList.innerHTML = '';
      if (!entries.length) {
        entriesList.innerHTML = '<p class="muted">No entries yet. Create your first one on the right.</p>';
        return;
      }
      // Newest first
      const sorted = [...entries].sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  
      sorted.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'entry-card';
  
        const canvas = document.createElement('canvas');
        canvas.className = 'entry-mini';
  
        const meta = document.createElement('div');
        meta.className = 'meta';
        const d = document.createElement('div'); d.className = 'date'; d.textContent = entry.date || '(no date)';
        const n = document.createElement('div'); n.className = 'note'; n.textContent = entry.note || '';
        meta.appendChild(d); meta.appendChild(n);
  
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const editBtn = document.createElement('button'); editBtn.className = 'btn ghost'; editBtn.textContent = 'Edit';
        const delBtn = document.createElement('button'); delBtn.className = 'btn danger'; delBtn.textContent = 'Delete';
        actions.appendChild(editBtn); actions.appendChild(delBtn);
  
        card.appendChild(canvas); card.appendChild(meta); card.appendChild(actions);
        entriesList.appendChild(card);
  
        // Mini chart
        new Chart(canvas.getContext('2d'), {
          type: 'polarArea',
          data: {
            labels: categories,
            datasets: [{ data: categories.map(c => Number(entry.scores[c] || 0)), backgroundColor: colors.map(c => `${c}55`), borderColor: colors, borderWidth: 1 }]
          },
          options: { responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { r: { min: 0, max: 10 } } }
        });
  
        // Click card to view details
        card.addEventListener('click', () => {
          openEntryDetail(entry);
        });
        
        // Edit / Delete handlers (stop propagation to prevent detail modal)
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Load into form
          entryValues = categories.map(c => Number(entry.scores[c] || 0));
          entryChart.data.datasets[0].data = entryValues; entryChart.update();
          entryDate.value = entry.date || '';
          entryNote.value = entry.note || '';
          editIdInput.value = entry.id;
          closeEntries();
          toast('Loaded entry into editor. Make changes and Save.');
        });
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Delete this entry? This cannot be undone.')) {
            saveEntries(entries.filter(e => e.id !== entry.id));
            renderAvg();
            renderEntriesList();
            toast('Entry deleted.');
          }
        });
      });
    }
  
    // Export
    exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'wheel-of-life-entries.json'; a.click();
      URL.revokeObjectURL(url);
      toast('Data exported.');
    });

    // Import Modal
    function openImportModal() {
      fileNameSpan.textContent = 'No file selected';
      importModal.showModal();
    }
    function closeImportModal() { importModal.close(); }
    
    importBtn.addEventListener('click', openImportModal);
    closeImportBtn.addEventListener('click', closeImportModal);
    
    importFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      fileNameSpan.textContent = file.name;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('Invalid file format');
        saveEntries(data);
        renderAvg();
        toast('Data imported successfully.');
        closeImportModal();
      } catch (err) {
        console.error(err);
        toast('Import failed. Ensure a valid JSON export.');
      } finally {
        importFileInput.value = '';
      }
    });
  
    // Clear all data
    clearDataBtn.addEventListener('click', () => {
      if (!entries.length) { toast('Nothing to clear.'); return; }
      if (confirm('Clear ALL saved entries?')) {
        saveEntries([]);
        renderAvg();
        toast('All data cleared.');
      }
    });

    // Entry Detail Modal
    let detailChartInstance = null;
    
    function openEntryDetail(entry) {
      entryDetailModal.showModal();
      
      // Update meta
      const detailDateEl = entryDetailModal.querySelector('.detail-date');
      const detailNoteEl = entryDetailModal.querySelector('.detail-note');
      const detailScoresEl = entryDetailModal.querySelector('.detail-scores');
      
      detailDateEl.textContent = entry.date || '(no date)';
      detailNoteEl.textContent = entry.note || 'No notes added';
      
      // Render scores grid
      detailScoresEl.innerHTML = '';
      categories.forEach((cat, idx) => {
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'detail-score';
        scoreDiv.innerHTML = `
          <div class="label">${cat}</div>
          <div class="value" style="color: ${colors[idx]}">${entry.scores[cat] || 0}</div>
        `;
        detailScoresEl.appendChild(scoreDiv);
      });
      
      // Destroy previous chart if exists
      if (detailChartInstance) {
        detailChartInstance.destroy();
      }
      
      // Create detail chart
      detailChartInstance = new Chart(detailChart.getContext('2d'), {
        type: 'radar',
        data: {
          labels: categories,
          datasets: [{
            label: 'Scores',
            data: categories.map(c => Number(entry.scores[c] || 0)),
            backgroundColor: 'rgba(14,165,233,0.25)',
            borderColor: '#0ea5e9',
            borderWidth: 2,
            pointBackgroundColor: colors,
            pointRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true }
          },
          scales: {
            r: {
              min: 0, max: 10, beginAtZero: true,
              ticks: { stepSize: 2, showLabelBackdrop: false },
              grid: { color: 'rgba(148,163,184,.3)' },
              angleLines: { color: 'rgba(148,163,184,.25)' },
              pointLabels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text'), font: { size: 12 } }
            }
          }
        }
      });
    }
    
    function closeEntryDetail() { 
      entryDetailModal.close(); 
      if (detailChartInstance) {
        detailChartInstance.destroy();
        detailChartInstance = null;
      }
    }
    
    closeDetailBtn.addEventListener('click', closeEntryDetail);

    // About Modal
    function openAbout() {
      aboutModal.showModal();
    }
    function closeAbout() {
      aboutModal.close();
    }
    
    aboutBtn.addEventListener('click', openAbout);
    closeAboutBtn.addEventListener('click', closeAbout);

    // Initial render
    renderAvg();
  })();
  