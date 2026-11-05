import { useStore } from './store.jsx';

// Validated categorical slots (blue / orange / aqua / yellow) and surface tokens per theme.
const PAL = {
  light: { s: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'], grid: '#e4e3df', ink2: '#52514e', surface: '#fcfcfb' },
  dark: { s: ['#3987e5', '#d95926', '#199e70', '#c98500'], grid: '#2c2c2a', ink2: '#c3c2b7', surface: '#1a1a19' },
};
export const useColors = () => PAL[useStore().theme === 'dark' ? 'dark' : 'light'];

// Reserved status colours
export const MODE = {
  NORMAL: { text: 'text-normal', bg: 'bg-normal', soft: 'bg-normal/15', hex: '#1f9d55', label: 'NORMAL' },
  ALERT: { text: 'text-alert', bg: 'bg-alert', soft: 'bg-alert/15', hex: '#e34948', label: 'ALERT' },
  WARNING: { text: 'text-warn', bg: 'bg-warn', soft: 'bg-warn/15', hex: '#d99a00', label: 'WARNING' },
  OFFLINE: { text: 'text-offline', bg: 'bg-offline', soft: 'bg-offline/15', hex: '#8a8f98', label: 'OFFLINE' },
};
