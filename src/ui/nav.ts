export type Tab = 'home' | 'historique' | 'progres' | 'corps';

const svg = (body: string) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const TABS: { id: Tab; href: string; label: string; icon: string }[] = [
  { id: 'home', href: '#/', label: 'Accueil', icon: svg('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path>') },
  { id: 'historique', href: '#/historique', label: 'Historique', icon: svg('<rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M3 9h18M8 2v4M16 2v4"></path>') },
  { id: 'progres', href: '#/progres', label: 'Progrès', icon: svg('<path d="M3 17l6-6 4 4 8-8"></path><path d="M15 7h6v6"></path>') },
  { id: 'corps', href: '#/corps', label: 'Corps', icon: svg('<circle cx="12" cy="5" r="2.5"></circle><path d="M6 9h12M12 9v6M9 21l3-6 3 6"></path>') }
];

export function renderNav(active: Tab): string {
  return `<nav class="tabbar" aria-label="Navigation principale">${TABS.map(
    (t) => `<a href="${t.href}"${t.id === active ? ' aria-current="page"' : ''}>${t.icon}<span>${t.label}</span></a>`
  ).join('')}</nav>`;
}
