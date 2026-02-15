/**
 * Static Tailwind Color Class Map
 * 
 * Tailwind JIT purges dynamic classes like `bg-${color}-500/10`.
 * This utility maps color names to pre-defined static class strings
 * so Tailwind can detect them at build time.
 */

const COLOR_MAP = {
  green: {
    bg5: 'bg-green-500/5',
    bg10: 'bg-green-500/10',
    bg20: 'bg-green-500/20',
    border10: 'border-green-500/10',
    border20: 'border-green-500/20',
    border40: 'border-green-500/40',
    borderSolid: 'border-green-500',
    text300: 'text-green-300',
    text400: 'text-green-400',
    text500: 'text-green-500',
    bg400: 'bg-green-400',
    bg500: 'bg-green-500',
    ring40: 'ring-green-500/40',
  },
  red: {
    bg5: 'bg-red-500/5',
    bg10: 'bg-red-500/10',
    bg20: 'bg-red-500/20',
    border10: 'border-red-500/10',
    border20: 'border-red-500/20',
    border40: 'border-red-500/40',
    borderSolid: 'border-red-500',
    text300: 'text-red-300',
    text400: 'text-red-400',
    text500: 'text-red-500',
    bg400: 'bg-red-400',
    bg500: 'bg-red-500',
    ring40: 'ring-red-500/40',
  },
  blue: {
    bg5: 'bg-blue-500/5',
    bg10: 'bg-blue-500/10',
    bg20: 'bg-blue-500/20',
    border10: 'border-blue-500/10',
    border20: 'border-blue-500/20',
    border40: 'border-blue-500/40',
    borderSolid: 'border-blue-500',
    text300: 'text-blue-300',
    text400: 'text-blue-400',
    text500: 'text-blue-500',
    bg400: 'bg-blue-400',
    bg500: 'bg-blue-500',
    ring40: 'ring-blue-500/40',
  },
  yellow: {
    bg5: 'bg-yellow-500/5',
    bg10: 'bg-yellow-500/10',
    bg20: 'bg-yellow-500/20',
    border10: 'border-yellow-500/10',
    border20: 'border-yellow-500/20',
    border40: 'border-yellow-500/40',
    borderSolid: 'border-yellow-500',
    text300: 'text-yellow-300',
    text400: 'text-yellow-400',
    text500: 'text-yellow-500',
    bg400: 'bg-yellow-400',
    bg500: 'bg-yellow-500',
    ring40: 'ring-yellow-500/40',
  },
  amber: {
    bg5: 'bg-amber-500/5',
    bg10: 'bg-amber-500/10',
    bg20: 'bg-amber-500/20',
    border10: 'border-amber-500/10',
    border20: 'border-amber-500/20',
    border40: 'border-amber-500/40',
    borderSolid: 'border-amber-500',
    text300: 'text-amber-300',
    text400: 'text-amber-400',
    text500: 'text-amber-500',
    bg400: 'bg-amber-400',
    bg500: 'bg-amber-500',
    ring40: 'ring-amber-500/40',
  },
  emerald: {
    bg5: 'bg-emerald-500/5',
    bg10: 'bg-emerald-500/10',
    bg20: 'bg-emerald-500/20',
    border10: 'border-emerald-500/10',
    border20: 'border-emerald-500/20',
    border40: 'border-emerald-500/40',
    borderSolid: 'border-emerald-500',
    text300: 'text-emerald-300',
    text400: 'text-emerald-400',
    text500: 'text-emerald-500',
    bg400: 'bg-emerald-400',
    bg500: 'bg-emerald-500',
    ring40: 'ring-emerald-500/40',
  },
  purple: {
    bg5: 'bg-purple-500/5',
    bg10: 'bg-purple-500/10',
    bg20: 'bg-purple-500/20',
    border10: 'border-purple-500/10',
    border20: 'border-purple-500/20',
    border40: 'border-purple-500/40',
    borderSolid: 'border-purple-500',
    text300: 'text-purple-300',
    text400: 'text-purple-400',
    text500: 'text-purple-500',
    bg400: 'bg-purple-400',
    bg500: 'bg-purple-500',
    ring40: 'ring-purple-500/40',
  },
  cyan: {
    bg5: 'bg-cyan-500/5',
    bg10: 'bg-cyan-500/10',
    bg20: 'bg-cyan-500/20',
    border10: 'border-cyan-500/10',
    border20: 'border-cyan-500/20',
    border40: 'border-cyan-500/40',
    borderSolid: 'border-cyan-500',
    text300: 'text-cyan-300',
    text400: 'text-cyan-400',
    text500: 'text-cyan-500',
    bg400: 'bg-cyan-400',
    bg500: 'bg-cyan-500',
    ring40: 'ring-cyan-500/40',
  },
  pink: {
    bg5: 'bg-pink-500/5',
    bg10: 'bg-pink-500/10',
    bg20: 'bg-pink-500/20',
    border10: 'border-pink-500/10',
    border20: 'border-pink-500/20',
    border40: 'border-pink-500/40',
    borderSolid: 'border-pink-500',
    text300: 'text-pink-300',
    text400: 'text-pink-400',
    text500: 'text-pink-500',
    bg400: 'bg-pink-400',
    bg500: 'bg-pink-500',
    ring40: 'ring-pink-500/40',
  },
  slate: {
    bg5: 'bg-slate-500/5',
    bg10: 'bg-slate-500/10',
    bg20: 'bg-slate-500/20',
    border10: 'border-slate-500/10',
    border20: 'border-slate-500/20',
    border40: 'border-slate-500/40',
    borderSolid: 'border-slate-500',
    text300: 'text-slate-300',
    text400: 'text-slate-400',
    text500: 'text-slate-500',
    bg400: 'bg-slate-400',
    bg500: 'bg-slate-500',
    ring40: 'ring-slate-500/40',
  },
  gray: {
    bg5: 'bg-gray-500/5',
    bg10: 'bg-gray-500/10',
    bg20: 'bg-gray-500/20',
    border10: 'border-gray-500/10',
    border20: 'border-gray-500/20',
    border40: 'border-gray-500/40',
    borderSolid: 'border-gray-500',
    text300: 'text-gray-300',
    text400: 'text-gray-400',
    text500: 'text-gray-500',
    bg400: 'bg-gray-400',
    bg500: 'bg-gray-500',
    ring40: 'ring-gray-500/40',
  },
};

// Fallback to gray if color not found
const FALLBACK = COLOR_MAP.gray;

/**
 * Get a specific Tailwind class for a color name
 * @param {string} color - Color name (e.g., 'green', 'red', 'blue')
 * @param {string} variant - Class variant (e.g., 'bg10', 'text400', 'border20')
 * @returns {string} Static Tailwind class
 */
export const tw = (color, variant) => {
  return (COLOR_MAP[color] || FALLBACK)[variant] || '';
};

/**
 * Get the full color map for a color name
 * @param {string} color - Color name
 * @returns {object} All class variants for that color
 */
export const twColor = (color) => {
  return COLOR_MAP[color] || FALLBACK;
};

export default COLOR_MAP;
