const svg = (body: string, size = 20, extra = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${extra} aria-hidden="true">${body}</svg>`;

export const icons = {
  logo: svg('<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"></path>', 20, 'fill="none" stroke="#0F1012" stroke-width="2.4" stroke-linecap="round"'),
  data: svg('<ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"></path><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"></path>'),
  back: svg('<path d="M15 6l-6 6 6 6"></path>'),
  chevron: svg('<path d="M9 6l6 6-6 6"></path>'),
  play: svg('<path d="M7 4l13 8-13 8z"></path>', 18, 'fill="currentColor"'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"></path>', 22, 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'),
  download: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"></path>'),
  upload: svg('<path d="M12 15V3M7 8l5-5 5 5M5 21h14"></path>'),
  clock: svg('<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>')
};
