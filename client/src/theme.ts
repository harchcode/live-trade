export const themes = {
  dark: {
    bg: '#0a0a0c',
    grid: 'rgba(255, 255, 255, 0.03)',
    widgetBg: 'rgba(25, 25, 30, 0.85)',
    widgetBorder: 'rgba(255, 255, 255, 0.1)',
    widgetHeaderBg: 'rgba(30, 30, 35, 0.95)',
    textPrimary: '#ffffff',
    textSecondary: '#8b8b9e',
    colorBuy: '#00e676',
    colorSell: '#ff1744',
    hudBg: 'rgba(30, 30, 35, 0.85)',
    dropdownBg: '#1e1e25',
    dropdownHover: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(0,0,0,0.5)',
    scrollThumb: 'rgba(255,255,255,0.2)',
    scrollThumbHover: 'rgba(255,255,255,0.4)',
  },
  light: {
    bg: '#f0f4f8',
    grid: 'rgba(0, 0, 0, 0.04)',
    widgetBg: 'rgba(255, 255, 255, 0.9)',
    widgetBorder: 'rgba(0, 0, 0, 0.08)',
    widgetHeaderBg: 'rgba(248, 250, 252, 0.95)',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    colorBuy: '#10b981', // green-500
    colorSell: '#ef4444', // red-500
    hudBg: 'rgba(255, 255, 255, 0.85)',
    dropdownBg: '#ffffff',
    dropdownHover: 'rgba(0, 0, 0, 0.05)',
    shadow: 'rgba(0,0,0,0.1)',
    scrollThumb: 'rgba(0,0,0,0.15)',
    scrollThumbHover: 'rgba(0,0,0,0.3)',
  }
};

export let currentTheme: 'dark' | 'light' = 'dark';

export function getTheme() {
  return themes[currentTheme];
}

export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyThemeToDOM();
}

export function applyThemeToDOM() {
  const t = getTheme();
  document.body.style.background = t.bg;
  
  const root = document.documentElement;
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--hud-bg', t.hudBg);
  root.style.setProperty('--border', t.widgetBorder);
  root.style.setProperty('--text-primary', t.textPrimary);
  root.style.setProperty('--text-secondary', t.textSecondary);
  root.style.setProperty('--dropdown-bg', t.dropdownBg);
  root.style.setProperty('--dropdown-hover', t.dropdownHover);
  root.style.setProperty('--shadow', t.shadow);
  root.style.setProperty('--scroll-thumb', t.scrollThumb);
  root.style.setProperty('--scroll-thumb-hover', t.scrollThumbHover);
}
