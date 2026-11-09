import type { AppData } from '../types';
import { escapeHtml as e } from '../format';
import { icons } from './icons';

export const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function templateMeta(t: { day: number; optional: boolean; blocks: { items: unknown[] }[] }): string {
  const count = t.blocks.reduce((n, b) => n + b.items.length, 0);
  const supers = t.blocks.filter((b) => b.items.length > 1).length;
  const day = t.day >= 1 && t.day <= 7 ? DAY_NAMES[t.day - 1] : 'sans jour fixe';
  const parts = [day.charAt(0).toUpperCase() + day.slice(1)];
  if (t.optional) parts.push('optionnelle');
  parts.push(`${count} exercice${count > 1 ? 's' : ''}`);
  if (supers) parts.push(`${supers} superset${supers > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

export function renderTemplates(data: AppData, confirmDelete: string | null): string {
  const cards = data.templates.map((t) => {
    const confirm = confirmDelete === t.id
      ? `<div class="dialog" style="border-color:var(--danger)">
          <span class="small">Supprimer « ${e(t.name)} » ? Les séances déjà faites restent dans l'historique.</span>
          <button type="button" class="btn" style="color:var(--danger);border-color:var(--danger)" data-action="tpl-delete" data-id="${e(t.id)}">Oui, supprimer</button>
          <button type="button" class="btn btn-ghost" data-action="tpl-delete-cancel">Annuler</button>
        </div>`
      : `<div class="row" style="gap:8px">
          <button type="button" class="btn" style="flex:1" data-action="tpl-edit" data-id="${e(t.id)}">Modifier</button>
          <button type="button" class="btn" data-action="tpl-duplicate" data-id="${e(t.id)}">Dupliquer</button>
          <button type="button" class="icon-btn" style="border:none;background:transparent;color:var(--danger)" data-action="tpl-delete-ask" data-id="${e(t.id)}" aria-label="Supprimer ${e(t.name)}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg>
          </button>
        </div>`;
    return `
      <article class="card section" style="padding:14px 16px;gap:12px">
        <div class="row">
          <span class="hist-letter">${e(t.id)}</span>
          <span class="section" style="flex:1;gap:2px;min-width:0"><span style="font-size:15px;font-weight:600">${e(t.name)}</span><span class="muted small">${e(templateMeta(t))}</span></span>
        </div>
        ${confirm}
      </article>`;
  }).join('');

  return `
  <div class="screen">
    <header class="row">
      <a class="icon-btn" href="#/" aria-label="Retour à l'accueil">${icons.back}</a>
      <h1 class="title" style="font-size:26px">Mes séances</h1>
    </header>
    ${cards || '<span class="muted small">Aucune séance. Crée la première !</span>'}
    <button type="button" class="btn btn-dashed" data-action="tpl-new">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
      Nouvelle séance
    </button>
    <span class="muted xsmall" style="padding:0 4px">Les séances déjà faites restent dans l'historique, même si tu modifies ou supprimes leur modèle.</span>
  </div>`;
}
