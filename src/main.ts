import './style.css';
import { registerSW } from 'virtual:pwa-register';
import type { AppData } from './types';
import {
  addBodyEntry, addTemplate, commitSession, deleteBodyEntry, deleteSession, computeDecisions, exerciseById, exportAll, exportTemplate,
  load, mergeBackup, parseImport, requestPersistence, save, seed, startSession
} from './store';
import { kindFor, roundToStep } from './progression';
import { formatClock, formatNumber } from './format';
import { renderHome } from './ui/home';
import { nextSetLabel, renderSession, restAfter } from './ui/session';
import { renderSummary } from './ui/summary';
import { renderData, type DataUi } from './ui/data';
import { renderHistory, type HistoryUi } from './ui/history';
import { renderProgress, type ProgressUi } from './ui/progress';
import { bodyDefaults, renderBody, type BodyUi } from './ui/body';

registerSW({ immediate: true });

let data: AppData = load();
const ui: DataUi & { toast: string | null; confirmCancel: boolean } = { persisted: null, pendingImport: null, confirmClear: false, toast: null, confirmCancel: false };
let pendingBackup: AppData | null = null;
const hist: HistoryUi = { filter: 'Toutes', open: null, confirmDelete: null };
const prog: ProgressUi = { exercise: null, selected: null };
const body: BodyUi = { metric: 'weight', selected: null, draftWeight: null, draftWaist: null };
function resetBodyDraft() {
  const d = bodyDefaults(data);
  body.draftWeight = d.weight;
  body.draftWaist = d.waist;
}
resetBodyDraft();
const app = document.getElementById('app')!;

requestPersistence().then((p) => {
  ui.persisted = p;
  if (route() === 'donnees') render();
});

/* ---------- Navigation ---------- */

type Route = 'home' | 'seance' | 'fin' | 'donnees' | 'historique' | 'progres' | 'corps';
const ROUTES: Route[] = ['seance', 'fin', 'donnees', 'historique', 'progres', 'corps'];

function route(): Route {
  const h = location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'home';
}

function go(r: Route) {
  const target = r === 'home' ? '#/' : `#/${r}`;
  if (location.hash !== target) location.hash = target;
  else render();
}

function persist() {
  save(data);
}

let toastTimer = 0;
function toast(msg: string) {
  ui.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast = null;
    document.querySelector('.toast')?.remove();
  }, 2800);
  render();
}

function render() {
  let r = route();
  const s = data.active;
  if (r === 'seance' && (!s || s.finishedAt)) r = s?.finishedAt ? 'fin' : 'home';
  if (r === 'fin' && (!s || !s.finishedAt)) r = s ? 'seance' : 'home';
  if (r !== route()) {
    location.replace(r === 'home' ? '#/' : `#/${r}`);
  }
  let html = '';
  if (r === 'seance' && s) html = renderSession(data, s, ui.confirmCancel);
  else if (r === 'fin' && s) html = renderSummary(data, s, ui.confirmCancel);
  else if (r === 'donnees') html = renderData(data, ui);
  else if (r === 'historique') html = renderHistory(data, hist);
  else if (r === 'progres') html = renderProgress(data, prog);
  else if (r === 'corps') html = renderBody(data, body);
  else html = renderHome(data);
  if (ui.toast) html += `<div class="toast" role="status">${ui.toast}</div>`;
  app.innerHTML = html;
  updateWakeLock(r === 'seance');
  tick();
}

let lastRoute: Route | null = null;
window.addEventListener('hashchange', () => {
  const r = route();
  ui.confirmCancel = false;
  render();
  if (r !== lastRoute) window.scrollTo(0, 0);
  lastRoute = r;
});

/* ---------- Séance ---------- */

function setAt(key: string) {
  const [bi, ei, si] = key.split('-').map(Number);
  const block = data.active!.blocks[bi];
  const log = block.exercises[ei];
  return { bi, ei, si, block, log, set: log.sets[si] };
}

function setWeight(key: string, w: number | null) {
  const s = data.active!;
  const { log, si } = setAt(key);
  log.sets.forEach((set, k) => {
    if (k === si || (s.applyNext && k > si && !set.done)) set.w = w;
  });
}

function startRest(seconds: number, from: string) {
  const s = data.active!;
  s.restEnd = Date.now() + seconds * 1000;
  s.restTotal = seconds;
  s.restFrom = from;
  alerted = false;
  unlockAudio();
}

const actions: Record<string, (el: HTMLElement) => void> = {
  start(el) {
    const id = el.dataset.id!;
    if (data.active) {
      if (data.active.templateId === id) return go(data.active.finishedAt ? 'fin' : 'seance');
      if (!confirm('Une séance est déjà en cours. L\'abandonner pour en démarrer une autre ?')) return;
    }
    data.active = startSession(data, id);
    persist();
    go('seance');
  },
  'toggle-set'(el) {
    const s = data.active!;
    const { block, log, ei, set } = setAt(el.dataset.key!);
    set.done = !set.done;
    if (s.editing === el.dataset.key) s.editing = null;
    if (set.done) {
      const rest = restAfter(block, ei);
      if (rest > 0) startRest(rest, exerciseById(data, log.exerciseId).name);
    }
    persist();
    render();
  },
  reps(el) {
    const { log, set } = setAt(el.dataset.key!);
    const step = exerciseById(data, log.exerciseId).kind === 'timed' ? 5 : 1;
    set.reps = Math.max(0, set.reps + step * Number(el.dataset.dir));
    persist();
    render();
  },
  'edit-weight'(el) {
    const s = data.active!;
    s.editing = s.editing === el.dataset.key ? null : el.dataset.key!;
    persist();
    render();
  },
  'weight-step'(el) {
    const { log, set } = setAt(el.dataset.key!);
    const step = exerciseById(data, log.exerciseId).step;
    const next = roundToStep(Math.max(0, (set.w ?? 0) + step * Number(el.dataset.dir)), step);
    setWeight(el.dataset.key!, next);
    persist();
    render();
  },
  'close-edit'() {
    data.active!.editing = null;
    persist();
    render();
  },
  'rest-add'(el) {
    const s = data.active!;
    const now = Date.now();
    const base = Math.max(now, s.restEnd);
    s.restEnd = Math.max(now, base + Number(el.dataset.sec) * 1000);
    s.restTotal = Math.max(s.restTotal, Math.ceil((s.restEnd - now) / 1000));
    if (!s.restFrom) s.restFrom = 'repos manuel';
    alerted = false;
    persist();
    tick();
  },
  'rest-skip'() {
    data.active!.restEnd = 0;
    persist();
    tick();
  },
  finish() {
    const s = data.active!;
    s.editing = null;
    s.finishedAt = Date.now();
    s.decisions = computeDecisions(data, s);
    s.editingDecision = null;
    persist();
    go('fin');
  },
  resume() {
    const s = data.active!;
    delete s.finishedAt;
    delete s.decisions;
    persist();
    go('seance');
  },
  'decision-edit'(el) {
    const s = data.active!;
    s.editingDecision = s.editingDecision === el.dataset.id ? null : el.dataset.id!;
    persist();
    render();
  },
  'decision-step'(el) {
    const d = data.active!.decisions!.find((x) => x.exerciseId === el.dataset.id)!;
    const step = exerciseById(data, d.exerciseId).step;
    d.to = roundToStep(Math.max(0, (d.to ?? 0) + step * Number(el.dataset.dir)), step);
    d.kind = kindFor(d.from, d.to);
    d.note = d.from !== null && d.to !== d.from ? `modifié (${d.to > d.from ? '+' : '−'}${formatNumber(Math.abs(d.to - d.from))} kg)` : 'modifié · on garde';
    if (d.kind !== 'down') d.failStreak = d.kind === 'up' ? 0 : d.failStreak;
    persist();
    render();
  },
  'decision-close'() {
    data.active!.editingDecision = null;
    persist();
    render();
  },
  feeling(el) {
    data.active!.feeling = Number(el.dataset.v);
    persist();
    render();
  },
  'cancel-ask'() {
    ui.confirmCancel = true;
    render();
    document.getElementById('cancel-dialog')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  },
  'cancel-dismiss'() {
    ui.confirmCancel = false;
    render();
  },
  'cancel-confirm'() {
    data.active = null;
    ui.confirmCancel = false;
    persist();
    go('home');
    toast('Séance annulée');
  },
  commit() {
    commitSession(data);
    persist();
    go('home');
    toast('Séance enregistrée');
  },

  /* ---------- Historique ---------- */
  'hist-filter'(el) {
    hist.filter = el.dataset.id!;
    render();
  },
  'hist-toggle'(el) {
    hist.open = hist.open === el.dataset.id ? null : el.dataset.id!;
    hist.confirmDelete = null;
    render();
  },
  'hist-delete-ask'(el) {
    hist.confirmDelete = el.dataset.id!;
    render();
  },
  'hist-delete-cancel'() {
    hist.confirmDelete = null;
    render();
  },
  'hist-delete'(el) {
    deleteSession(data, el.dataset.id!);
    hist.open = null;
    hist.confirmDelete = null;
    persist();
    toast('Séance supprimée');
  },

  /* ---------- Progrès et graphiques ---------- */
  'prog-pick'(el) {
    prog.exercise = el.dataset.id!;
    prog.selected = null;
    render();
    if (el.classList.contains('table-row')) window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'chart-pick'(el) {
    const i = Number(el.dataset.i);
    if (el.dataset.chart === 'prog') prog.selected = i;
    else body.selected = i;
    render();
  },

  /* ---------- Corps ---------- */
  'body-step'(el) {
    const dir = Number(el.dataset.dir);
    if (el.dataset.key === 'weight') {
      body.draftWeight = Math.max(0, Math.round(((body.draftWeight ?? 60) + 0.1 * dir) * 10) / 10);
    } else {
      const base = body.draftWaist ?? [...data.body].reverse().find((b) => b.waist !== null)?.waist ?? 75;
      body.draftWaist = body.draftWaist === null ? base : Math.max(0, Math.round((base + 0.5 * dir) * 10) / 10);
    }
    render();
  },
  'body-save'() {
    if (body.draftWeight === null && body.draftWaist === null) return toast('Saisis au moins une mesure');
    addBodyEntry(data, body.draftWeight, body.draftWaist);
    body.selected = null;
    persist();
    toast('Mesure enregistrée');
  },
  'body-metric'(el) {
    body.metric = el.dataset.id === 'waist' ? 'waist' : 'weight';
    body.selected = null;
    render();
  },
  'body-delete'(el) {
    deleteBodyEntry(data, el.dataset.id!);
    body.selected = null;
    persist();
    toast('Mesure supprimée');
  },

  /* ---------- Données ---------- */
  'export-all'() {
    download(`dannythedog-${today()}.json`, exportAll(data));
    data.lastExport = new Date().toISOString();
    persist();
    toast('Sauvegarde exportée');
  },
  'export-template'(el) {
    const t = data.templates.find((x) => x.id === el.dataset.id)!;
    download(`seance-${slug(t.name)}.json`, exportTemplate(data, t.id));
  },
  'import-merge'() {
    if (!pendingBackup) return;
    data = mergeBackup(data, pendingBackup);
    finishImport('Données ajoutées');
  },
  'import-replace'() {
    if (!pendingBackup) return;
    data = { ...pendingBackup, body: pendingBackup.body ?? [], active: null };
    resetBodyDraft();
    finishImport('Données remplacées');
  },
  'import-cancel'() {
    pendingBackup = null;
    ui.pendingImport = null;
    render();
  },
  'clear-ask'() {
    ui.confirmClear = true;
    render();
  },
  'clear-cancel'() {
    ui.confirmClear = false;
    render();
  },
  'clear-confirm'() {
    data = seed();
    resetBodyDraft();
    ui.confirmClear = false;
    persist();
    toast('Données effacées');
  }
};

function finishImport(msg: string) {
  pendingBackup = null;
  ui.pendingImport = null;
  persist();
  toast(msg);
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const fn = actions[el.dataset.action!];
  if (fn) {
    ev.preventDefault();
    fn(el);
  }
});

app.addEventListener('change', async (ev) => {
  const el = ev.target as HTMLInputElement;
  const kind = el.dataset.change;
  if (kind === 'weight-input') {
    const v = parseFloat(el.value.replace(',', '.'));
    setWeight(el.dataset.key!, Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);
    persist();
    render();
  } else if (kind === 'body-input') {
    const v = parseFloat(el.value.replace(',', '.'));
    const val = Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : null;
    if (el.dataset.key === 'weight') body.draftWeight = val;
    else body.draftWaist = val;
  } else if (kind === 'apply-next') {
    data.active!.applyNext = el.checked;
    persist();
  } else if (kind === 'import-file' && el.files?.[0]) {
    const file = el.files[0];
    try {
      const result = parseImport(await file.text());
      if (result.kind === 'template') {
        const t = addTemplate(data, result.template, result.exercises);
        persist();
        toast(`Séance « ${t.name} » ajoutée`);
      } else {
        pendingBackup = result.backup;
        ui.pendingImport = { name: file.name, sessions: result.backup.history.length };
        render();
      }
    } catch (err) {
      toast((err as Error).message);
    }
  }
});

/* ---------- Minuteur ---------- */

let alerted = true;
let audio: AudioContext | null = null;

function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

function beep() {
  if (!audio) return;
  const t0 = audio.currentTime;
  [0, 0.25].forEach((dt) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0 + dt);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + dt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
    osc.connect(gain).connect(audio!.destination);
    osc.start(t0 + dt);
    osc.stop(t0 + dt + 0.2);
  });
}

function tick() {
  const s = data.active;
  if (!s || route() !== 'seance') return;
  const now = Date.now();
  const elapsed = document.getElementById('elapsed');
  if (elapsed) elapsed.textContent = formatClock((now - s.startedAt) / 1000);
  const remaining = s.restEnd ? (s.restEnd - now) / 1000 : 0;
  const running = remaining > 0;
  const title = document.getElementById('timer-title');
  const clock = document.getElementById('timer-clock');
  const bar = document.getElementById('timer-bar');
  const next = document.getElementById('timer-next');
  if (title) title.textContent = running ? `Repos · après ${s.restFrom}` : 'À toi de jouer';
  if (clock) {
    clock.textContent = running ? formatClock(remaining) : 'GO';
    clock.classList.toggle('go', !running);
  }
  if (bar) bar.style.width = running ? `${Math.min(100, (remaining / Math.max(1, s.restTotal)) * 100)}%` : '0%';
  if (next) {
    const label = nextSetLabel(data, s);
    next.textContent = label ? `Ensuite : ${label}` : 'Toutes les séries sont faites';
  }
  if (!running && s.restEnd && !alerted) {
    alerted = true;
    navigator.vibrate?.([200, 100, 200]);
    beep();
  }
}

setInterval(tick, 250);

/* ---------- Écran allumé pendant la séance ---------- */

let wakeLock: WakeLockSentinel | null = null;
async function updateWakeLock(want: boolean) {
  try {
    if (want && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!want && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    data = load();
    render();
  }
});

render();
lastRoute = route();
