// WholesaleHub design tokens — "Trust & professional" direction.
// Refined navy identity + a confident blue action color, restrained accents,
// soft tinted surfaces for badges/chips, and centralized radius/shadow tokens.

export const colors = {
  // Brand / surfaces
  primary: '#1a2740',       // deep navy — brand, headers, primary text emphasis
  primaryLight: '#24314f',  // slightly lifted navy for layered dark surfaces
  accent: '#2563eb',        // (kept for back-compat; same family as `action`)

  // Interactive
  action: '#2563eb',        // blue — buttons, links, active/interactive elements
  actionDark: '#1d4ed8',    // pressed / emphasis
  actionSoft: '#eff4ff',    // tinted background for selected/info states

  // Accent (featured / premium) — amber reads "premium", not "danger"
  highlight: '#f59e0b',
  highlightSoft: '#fef3e2',

  // Neutral surfaces
  background: '#f7f8fa',     // soft cool gray app background
  surface: '#ffffff',
  surfaceAlt: '#f1f3f7',     // subtle chip / meta background

  // Text
  text: '#15203a',          // near-navy ink (warmer than pure black)
  textSecondary: '#5b6577',
  textLight: '#9aa3b2',

  // Lines
  border: '#e6e9ef',
  borderStrong: '#d4d9e2',

  // Status
  success: '#16a34a',
  successSoft: '#e7f6ec',
  warning: '#d97706',
  warningSoft: '#fdf0dd',
  error: '#dc2626',
  errorSoft: '#fdeaea',

  // Ratings
  star: '#f59e0b',

  // Listing types — WTS (sell) green, WTB (buy) blue.
  // Solid versions kept for back-compat; *Soft/*Text for the new pill style.
  wts: '#16a34a',
  wtsSoft: '#e7f6ec',
  wtsText: '#15803d',
  wtb: '#2563eb',
  wtbSoft: '#eff4ff',
  wtbText: '#1d4ed8',
};

export const fonts = {
  regular: { fontSize: 14, lineHeight: 20, color: colors.text },
  medium: { fontSize: 16, lineHeight: 22, fontWeight: '500', color: colors.text },
  bold: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  header: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  price: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: colors.primary, letterSpacing: -0.3 },
  caption: { fontSize: 12, lineHeight: 16, color: colors.textSecondary },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

// Consistent elevation presets — spread these instead of redefining shadows inline.
export const shadows = {
  sm: {
    shadowColor: '#0b1220',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0b1220',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0b1220',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};
