import type { AppData } from '../types';
import { escapeHtml as e, formatDate } from '../format';
import { icons } from './icons';
import { backupOverdue } from './home';

export interface DataUi {
  persisted: boolean | null;
  pendingImport: { name: string; sessions: number; templates: number; body: number } | null;
  confirmClear: boolean;
}

export function renderData(data: AppData, ui: DataUi): string {
  const sizeKb = Math.max(1, Math.round((localStorage.getItem('dannythedog:data')?.length ?? 0) / 1024));
  const lastExport = data.lastExport
    ? `Dernier export : ${formatDate(Date.parse(data.lastExport), { day: 'numeric', month: 'short' })}`
    : 'Aucun export pour le moment';

  const importDialog = ui.pendingImport ? `
    <div class="dialog" role="dialog" aria-label="Importer une sauvegarde">
      <span style="font-weight:600">${e(ui.pendingImport.name)}</span>
      <span class="muted small">Contient ${ui.pendingImport.sessions} séance(s), ${ui.pendingImport.templates} modèle(s) et ${ui.pendingImport.body} mesure(s).</span>
      <button type="button" class="btn btn-primary" style="min-height:44px;font-size:15px" data-action="import-merge">Fusionner</button>
      <span class="muted xsmall">Ajoute les séances et mesures manquantes. Pour les modèles, exercices et charges présents des deux côtés, la version la plus récente l'emporte.</span>
      <button type="button" class="btn" data-action="import-replace">Tout remplacer</button>
      <span class="muted xsmall">Ce téléphone reprend exactement le contenu du fichier.</span>
      <button type="button" class="btn btn-ghost" data-action="import-cancel">Annuler</button>
    </div>` : '';

  const templates = data.templates.map((t) => `
    <div class="row between card" style="padding:10px 10px 10px 16px;border-radius:14px">
      <span style="font-size:15px;font-weight:600">${e(t.name)}</span>
      <button type="button" class="btn" data-action="export-template" data-id="${e(t.id)}" aria-label="Exporter ${e(t.name)}">Exporter</button>
    </div>`).join('');

  const clear = ui.confirmClear ? `
    <div class="dialog" style="border-color:var(--danger)">
      <span class="small">Tout l'historique et les charges seront effacés de ce téléphone. Exporte d'abord si tu veux les garder.</span>
      <button type="button" class="btn" style="color:var(--danger);border-color:var(--danger)" data-action="clear-confirm">Oui, tout effacer</button>
      <button type="button" class="btn btn-ghost" data-action="clear-cancel">Annuler</button>
    </div>` : `<button type="button" class="btn btn-danger" data-action="clear-ask">Effacer toutes les données…</button>`;

  return `
  <div class="screen">
    <header class="row">
      <a class="icon-btn" href="#/" aria-label="Retour à l'accueil">${icons.back}</a>
      <h1 class="title" style="font-size:24px">Données</h1>
    </header>
    <section class="card section" aria-label="État du stockage" style="gap:12px">
      <div class="row between">
        <span class="muted" style="font-size:14px">Stockage sur ce téléphone</span>
        ${ui.persisted ? '<span class="badge">Persistant</span>' : '<span class="badge down">Non garanti</span>'}
      </div>
      <div class="stats" style="gap:8px">
        <div class="section" style="gap:2px"><b class="title" style="font-size:22px">${data.history.length}</b><span class="muted xsmall">séances</span></div>
        <div class="section" style="gap:2px"><b class="title" style="font-size:22px">${data.body.length}</b><span class="muted xsmall">mesures</span></div>
        <div class="section" style="gap:2px"><b class="title" style="font-size:22px">${sizeKb} Ko</b><span class="muted xsmall">utilisés</span></div>
      </div>
    </section>
    <section class="section" aria-label="Sauvegarde">
      <h2 class="section-title">Sauvegarde</h2>
      <div class="${backupOverdue(data) !== null ? 'banner-warn' : 'banner-warn banner-ok'}">${icons.clock}<span>${lastExport}</span></div>
      <button type="button" class="btn btn-primary" data-action="export-all">${icons.download} Exporter tout (JSON)</button>
      <label class="btn btn-block" style="min-height:52px;font-size:16px">${icons.upload} Importer un fichier
        <input type="file" class="visually-hidden" data-change="import-file">
      </label>
      ${importDialog}
      <span class="muted xsmall" style="padding:0 4px">Une sauvegarde complète te laisse choisir : fusionner avec ce téléphone, ou tout remplacer. Un modèle de séance partagé est ajouté à ta liste.</span>
    </section>
    <section class="section" aria-label="Partager une séance">
      <h2 class="section-title">Partager un modèle de séance</h2>
      ${templates}
    </section>
    <div style="margin-top:auto" class="section">${clear}</div>
  </div>`;
}
