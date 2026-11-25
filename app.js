/**
 * Controlador Principal de la Aplicación
 * Coordina la navegación entre las 6 pestañas, sincroniza el experimento activo
 * en Tablas, Gráficos, Análisis Matemático, Simulador y Galería.
 */
(function (global) {
  'use strict';

  const appState = {
    experiments: [],
    activeId: null,
    activeTab: 'datos'
  };

  function getActiveExperiment() {
    return (
      appState.experiments.find((e) => e.id === appState.activeId) ||
      appState.experiments[0] ||
      global.LabCalculations.BASE_EXPERIMENT
    );
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function switchTab(tabId) {
    appState.activeTab = tabId;
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    if (tabId === 'datos') {
      const activeExp = getActiveExperiment();
      const analysis = global.LabCalculations.analyzeExperiment(activeExp);
      global.LabCharts.renderAll(activeExp, analysis);
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-msg">${escapeHtml(message)}</span>
      <button type="button" class="toast-close" aria-label="Cerrar">✕</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade');
      setTimeout(() => toast.remove(), 300);
    }, 4200);
  }

  function renderHeaderAndSelectors() {
    const activeExp = getActiveExperiment();
    const badgeTitle = document.getElementById('header-active-title');
    const badgeMeta = document.getElementById('header-active-meta');
    if (badgeTitle) badgeTitle.textContent = activeExp.title;
    if (badgeMeta) {
      badgeMeta.textContent = `${activeExp.substrate} • ${activeExp.stressAgent || 'NaCl'} ${activeExp.stressConcentrationPct}%`;
    }

    const selector = document.getElementById('active-experiment-select');
    if (selector) {
      selector.innerHTML = '';
      appState.experiments.forEach((exp) => {
        const opt = document.createElement('option');
        opt.value = exp.id;
        opt.textContent = exp.isBase ? `★ ${exp.title} (Precargado)` : `${exp.title} (${exp.studentOrGroup})`;
        opt.selected = exp.id === activeExp.id;
        selector.appendChild(opt);
      });
    }

    const storageBadge = document.getElementById('storage-mode-badge');
    if (storageBadge) {
      const mode = global.ExperimentStorage.getStorageMode();
      storageBadge.textContent =
        mode === 'indexeddb'
          ? 'Persistencia: IndexedDB activa (soporta imágenes de alta resolución)'
          : 'Persistencia: localStorage (respaldo activo)';
    }
  }

  function renderTab1DesignAndData(activeExp, analysis) {
    // 1. Tarjetas de parámetros experimentales
    const ctrlCount = analysis.controlSummary.count;
    const stressCount = analysis.stressSummary.count;
    const osmotic = global.LabCalculations.computeOsmoticPotentialMPa(activeExp.stressConcentrationPct);

    document.getElementById('param-substrate').textContent = activeExp.substrate;
    document.getElementById('param-substrate-sub').textContent = `${activeExp.studentOrGroup} • ${activeExp.date}`;

    document.getElementById('param-replicas').textContent = `${activeExp.replicates.length} Vasos Totales`;
    document.getElementById('param-replicas-sub').textContent = `${ctrlCount} Control (Agua) y ${stressCount} Estrés (${activeExp.stressAgent || 'NaCl'} ${activeExp.stressConcentrationPct}%)`;

    document.getElementById('param-seeds').textContent = activeExp.seedType;
    document.getElementById('param-seeds-sub').textContent = `${activeExp.seedsPerCup} semillas/vaso (${analysis.totalSeeds} semillas totales)`;

    document.getElementById('param-volume').textContent = `${activeExp.initialVolumeMl} ml / muestra`;
    document.getElementById('param-volume-sub').textContent = 'Saturación inicial y balance gravimétrico a 1h y 24h.';

    document.getElementById('param-effluent').textContent = `${activeExp.stressAgent || 'NaCl'} ${activeExp.stressConcentrationPct}%`;
    document.getElementById('param-effluent-sub').textContent =
      activeExp.stressConcentrationPct > 0
        ? `Potencial osmótico teórico Ψs = ${osmotic.toFixed(2)} MPa (24 °C)`
        : 'Sin carga salina en el grupo de tratamiento.';

    // 2. Tabla de masas y cálculos
    const tbody = document.getElementById('results-table-body');
    tbody.innerHTML = '';

    const fmt = global.LabCalculations.formatNum;

    const appendReplicateRow = (rep) => {
      const m = rep.metrics;
      const tr = document.createElement('tr');
      if (rep.highlight) tr.className = 'row-highlight-success';
      else if (m.isAnomaly) tr.className = 'row-highlight-warning';

      const treatBadge =
        rep.treatment === 'Control'
          ? '<span class="badge-sky">Control (Agua)</span>'
          : `<span class="badge-rose">Estrés (${escapeHtml(activeExp.stressAgent || 'NaCl')} ${activeExp.stressConcentrationPct}%)</span>`;

      const pmpDisplay =
        m.pctPMP !== null
          ? `<span class="font-mono font-bold">${m.pctPMP.toFixed(2)}%</span>`
          : '<span class="badge-nd" title="No Determinado">N/D</span>';

      const germBadge =
        Number(rep.germinated) > 0
          ? `<span class="badge-success">${rep.germinated}/${activeExp.seedsPerCup} (${fmt(m.pctGermination, 2)}%)</span>`
          : `<span class="text-muted">${rep.germinated}/${activeExp.seedsPerCup} (0%)</span>`;

      let obsHtml = '';
      if (m.massIncreaseAnomaly) {
        obsHtml += '<span class="badge-amber">⚠ Anomalía: M24h &gt; M1h</span> ';
      } else if (m.negativeRetentionAnomaly) {
        obsHtml += '<span class="badge-danger">⚠ Retención negativa</span> ';
      } else if (m.isAnomaly) {
        obsHtml += '<span class="badge-amber">⚠ Anomalía experimental</span> ';
      }
      if (rep.note) {
        obsHtml += `<span class="row-note-text">${escapeHtml(rep.note)}</span>`;
      }
      if (!obsHtml) obsHtml = '<span class="badge-ok-subtle">Normal</span>';

      tr.innerHTML = `
        <td class="font-bold">${escapeHtml(rep.label)}</td>
        <td>${treatBadge}</td>
        <td class="num-col">${fmt(rep.mCup, 4)}</td>
        <td class="num-col">${fmt(rep.mSoil, 4)}</td>
        <td class="num-col">${fmt(m.mInicial, 4)}</td>
        <td class="num-col">${fmt(rep.m1h, 4)}</td>
        <td class="num-col ${m.massIncreaseAnomaly ? 'text-amber-bold' : ''}">${fmt(rep.m24h, 4)}${m.massIncreaseAnomaly ? '*' : ''}</td>
        <td class="num-col font-bold">${fmt(m.cc, 4)}</td>
        <td class="num-col font-bold">${fmt(m.pctCC, 2)}%</td>
        <td class="num-col">${fmt(m.volInfiltrado, 2)}</td>
        <td class="center-col">${germBadge}</td>
        <td class="center-col">${pmpDisplay}</td>
        <td>${obsHtml}</td>
      `;
      tbody.appendChild(tr);
    };

    const appendGroupSummaryRow = (summary, label, rowClass) => {
      if (summary.count === 0) return;
      const tr = document.createElement('tr');
      tr.className = rowClass;
      tr.innerHTML = `
        <td colspan="7">${label} (${summary.count} ${summary.count === 1 ? 'muestra' : 'muestras'})</td>
        <td class="num-col">${fmt(summary.avgCC, 4)}</td>
        <td class="num-col">${fmt(summary.avgPctCC, 2)}%</td>
        <td class="num-col">${fmt(summary.avgVolInfiltrado, 2)}</td>
        <td class="center-col">${summary.totalGerminated}/${summary.totalSeeds} (${fmt(summary.pctGermination, 2)}%)</td>
        <td class="center-col">${summary.avgPctPMP !== null ? `${summary.avgPctPMP.toFixed(2)}%` : 'N/D'}</td>
        <td>Promedio del grupo</td>
      `;
      tbody.appendChild(tr);
    };

    const controlReps = analysis.replicates.filter((r) => r.treatment === 'Control');
    const stressReps = analysis.replicates.filter((r) => r.treatment === 'Estrés');

    controlReps.forEach(appendReplicateRow);
    appendGroupSummaryRow(analysis.controlSummary, 'Promedio Grupo Control (Agua)', 'summary-row-sky');

    stressReps.forEach(appendReplicateRow);
    appendGroupSummaryRow(
      analysis.stressSummary,
      `Promedio Grupo Estrés (${activeExp.stressAgent || 'NaCl'} ${activeExp.stressConcentrationPct}%)`,
      'summary-row-rose'
    );

    // 3. Notas de PMP y observaciones
    const pmpStatusEl = document.getElementById('active-pmp-note');
    if (pmpStatusEl) {
      if (analysis.hasAnyPMP) {
        const pmpCtrl = analysis.controlSummary.avgPctPMP !== null ? `${analysis.controlSummary.avgPctPMP.toFixed(2)}%` : 'N/D';
        const pmpStr = analysis.stressSummary.avgPctPMP !== null ? `${analysis.stressSummary.avgPctPMP.toFixed(2)}%` : 'N/D';
        pmpStatusEl.innerHTML = `<strong>PMP Calculado:</strong> Control: <strong>${pmpCtrl}</strong> • Estrés: <strong>${pmpStr}</strong>`;
      } else {
        pmpStatusEl.innerHTML = `<strong>PMP: No Determinado (N/D)</strong> — ${escapeHtml(activeExp.pmpNote || 'No se registraron masas en punto de marchitez permanente.')}`;
      }
    }

    const obsBox = document.getElementById('active-observations-text');
    if (obsBox) {
      obsBox.textContent = activeExp.observations || 'Sin observaciones registradas.';
    }

    // 4. Tira rápida de fotos en Pestaña 1 si existen
    const photoPreviewCard = document.getElementById('tab1-photos-card');
    const photoPreviewGrid = document.getElementById('tab1-photos-grid');
    const photos = activeExp.photos || [];
    if (photoPreviewCard && photoPreviewGrid) {
      if (photos.length === 0) {
        photoPreviewCard.classList.add('hidden');
      } else {
        photoPreviewCard.classList.remove('hidden');
        photoPreviewGrid.innerHTML = '';
        photos.forEach((p, idx) => {
          const thumb = document.createElement('button');
          thumb.type = 'button';
          thumb.className = 'mini-photo-btn';
          thumb.innerHTML = `<img src="${p.dataUrl}" alt="${escapeHtml(p.caption)}"><span>${escapeHtml(p.caption)}</span>`;
          thumb.addEventListener('click', () => global.LabExperiments.openLightbox(photos, idx));
          photoPreviewGrid.appendChild(thumb);
        });
      }
    }
  }

  function renderTab3DynamicExample(activeExp, analysis) {
    const box = document.getElementById('math-dynamic-example');
    if (!box) return;

    const fmt = global.LabCalculations.formatNum;
    const sample =
      analysis.replicates.find((r) => r.highlight) ||
      analysis.replicates.find((r) => r.treatment === 'Control' && !r.metrics.isAnomaly) ||
      analysis.replicates[0];

    if (!sample) {
      box.innerHTML = '<p>Agrega réplicas al experimento para visualizar el ejemplo numérico paso a paso.</p>';
      return;
    }

    const m = sample.metrics;
    const osmotic = global.LabCalculations.computeOsmoticPotentialMPa(activeExp.stressConcentrationPct);
    const ctrl = analysis.controlSummary;
    const str = analysis.stressSummary;

    box.innerHTML = `
      <div class="worked-example-head">
        <span class="badge-base">Ejemplo Paso a Paso — Experimento Activo</span>
        <strong>${escapeHtml(activeExp.title)} • Muestra: ${escapeHtml(sample.label)} (${sample.treatment})</strong>
      </div>
      <div class="worked-example-grid">
        <div class="worked-step">
          <p class="step-title">1. Masa Inicial y Capacidad de Campo</p>
          <p>M<sub>inicial</sub> = ${fmt(sample.mCup, 4)} + ${fmt(sample.mSoil, 4)} = <strong>${fmt(m.mInicial, 4)} g</strong></p>
          <p>CC = ${fmt(sample.m24h, 4)} − ${fmt(m.mInicial, 4)} = <strong>${fmt(m.cc, 4)} g (ml)</strong></p>
          <p>%CC = (${fmt(m.cc, 4)} / ${fmt(sample.mSoil, 4)}) × 100 = <strong>${fmt(m.pctCC, 2)}%</strong></p>
        </div>
        <div class="worked-step">
          <p class="step-title">2. Volumen Infiltrado y Drenaje</p>
          <p>V<sub>infiltrado</sub> = ${activeExp.initialVolumeMl} − ${fmt(m.cc, 4)} = <strong>${fmt(m.volInfiltrado, 2)} ml</strong></p>
          <p>Drenaje (1h → 24h) = ${fmt(sample.m1h, 4)} − ${fmt(sample.m24h, 4)} = <strong>${fmt(m.drainage1hTo24h, 4)} g</strong></p>
        </div>
        <div class="worked-step">
          <p class="step-title">3. Germinación, PMP y Potencial Osmótico</p>
          <p>%G (${escapeHtml(sample.label)}) = (${sample.germinated} / ${activeExp.seedsPerCup}) × 100 = <strong>${fmt(m.pctGermination, 2)}%</strong></p>
          <p>%G Control: <strong>${ctrl.count > 0 ? `${ctrl.totalGerminated}/${ctrl.totalSeeds} (${fmt(ctrl.pctGermination, 2)}%)` : '—'}</strong> | Estrés: <strong>${str.count > 0 ? `${str.totalGerminated}/${str.totalSeeds} (${fmt(str.pctGermination, 2)}%)` : '—'}</strong></p>
          <p>PMP: <strong>${m.pctPMP !== null ? `${m.pctPMP.toFixed(2)}%` : 'N/D'}</strong> | Ψs (${activeExp.stressConcentrationPct}%): <strong>${osmotic.toFixed(2)} MPa</strong></p>
        </div>
      </div>
    `;
  }

  async function refreshAllViews(preferredActiveId = null) {
    appState.experiments = await global.ExperimentStorage.getAllExperiments();

    let targetId = preferredActiveId || appState.activeId || (await global.ExperimentStorage.getActiveExperimentId());
    if (!appState.experiments.some((e) => e.id === targetId)) {
      targetId = global.LabCalculations.BASE_EXPERIMENT.id;
    }
    appState.activeId = targetId;
    await global.ExperimentStorage.setActiveExperimentId(targetId);

    const activeExp = getActiveExperiment();
    const analysis = global.LabCalculations.analyzeExperiment(activeExp);

    renderHeaderAndSelectors();
    renderTab1DesignAndData(activeExp, analysis);
    renderTab3DynamicExample(activeExp, analysis);
    global.LabCharts.renderAll(activeExp, analysis);
    global.LabExperiments.renderSavedExperimentsList(appState.experiments, appState.activeId);
    global.LabExperiments.renderActiveExperimentGallery(activeExp);
  }

  async function selectExperiment(id) {
    appState.activeId = id;
    await global.ExperimentStorage.setActiveExperimentId(id);
    await refreshAllViews(id);
  }

  function bindGlobalEvents() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.cite-ref').forEach((btn) => {
      btn.addEventListener('click', () => {
        const refId = btn.getAttribute('data-cite');
        switchTab('referencias');
        const target = document.getElementById(`ref-${refId}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.borderColor = '#059669';
          target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.2)';
          setTimeout(() => {
            target.style.borderColor = '';
            target.style.boxShadow = '';
          }, 1800);
        }
      });
    });

    const copyIeeeBtn = document.getElementById('btn-copy-ieee');
    if (copyIeeeBtn) {
      copyIeeeBtn.addEventListener('click', async () => {
        const items = Array.from(document.querySelectorAll('#panel-referencias .ieee-item')).map((li) => {
          const num = li.querySelector('.ieee-num')?.textContent.trim() || '';
          const bodyClone = li.querySelector('.ieee-body')?.cloneNode(true);
          if (bodyClone) {
            bodyClone.querySelectorAll('.ieee-role').forEach((el) => el.remove());
          }
          const text = (bodyClone?.textContent || '').replace(/\s+/g, ' ').trim();
          return `${num} ${text}`;
        });
        const fullText = items.join('\n');
        try {
          await navigator.clipboard.writeText(fullText);
          showToast('12 referencias copiadas en formato IEEE al portapapeles.', 'success');
        } catch {
          showToast('No se pudo acceder al portapapeles automáticamente.', 'info');
        }
      });
    }

    const selector = document.getElementById('active-experiment-select');
    if (selector) {
      selector.addEventListener('change', async (e) => {
        await selectExperiment(e.target.value);
        const activeExp = getActiveExperiment();
        showToast(`Experimento activo cambiado a "${activeExp.title}".`, 'info');
      });
    }

    const syncSimBtn = document.getElementById('btn-sync-simulator');
    if (syncSimBtn) {
      syncSimBtn.addEventListener('click', () => {
        const activeExp = getActiveExperiment();
        global.LabSimulator.loadFromExperiment(activeExp);
        switchTab('simulador');
        showToast(`Parámetros de "${activeExp.title}" cargados en el Simulador Interactivo.`, 'success');
      });
    }

    const goUploadBtn = document.getElementById('btn-go-experiments');
    if (goUploadBtn) {
      goUploadBtn.addEventListener('click', () => switchTab('experimentos'));
    }

    const exportActiveBtn = document.getElementById('btn-export-active-json');
    if (exportActiveBtn) {
      exportActiveBtn.addEventListener('click', () => {
        global.LabExperiments.exportExperimentJson(getActiveExperiment());
      });
    }

    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => global.print());
    }
  }

  async function bootstrap() {
    await global.ExperimentStorage.init();
    bindGlobalEvents();
    global.LabSimulator.init();
    global.LabExperiments.init({
      onExperimentsChanged: async (newActiveId) => {
        await refreshAllViews(newActiveId);
      },
      onSelectExperiment: async (id) => {
        await selectExperiment(id);
      },
      showToast,
      switchTab
    });

    await refreshAllViews();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})(window);
