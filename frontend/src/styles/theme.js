// frontend/src/styles/theme.js

export const COLORS = {
  // Primary Colors
  primary: '#007BFF',     // A vibrant blue for main actions and highlights
  primaryLight: '#eef6ff', // A very light blue for backgrounds, unread items

  // Accent Colors
  accent: '#FF6347',       // A fiery tomato/orange for streaks and important alerts
  success: '#28a745',     // Green for success states and checkmarks
  danger: '#dc3545',       // Red for destructive actions like delete/forfeit

  // Neutral Colors
  background: '#f0f4f7',  // A very light, clean blueish-grey for screen backgrounds
  surface: '#FFFFFF',
  gold: '#FFD700',     // White for cards, modals, and main content areas
  
  // Text Colors
  textPrimary: '#121212',   // Almost black for main text
  textSecondary: '#6c757d', // Grey for subtext, captions, and placeholders
  textOnPrimary: '#FFFFFF', // White text on blue buttons
};

export const SIZES = {
  // Base size for margins and padding
  base: 8,
  padding: 20,
  
  // Font sizes
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  caption: 12,
  
  // Other sizes
  radius: 12, // Border radius for cards and buttons
};

export const FONTS = {
  h1: { fontFamily: 'Poppins-Bold', fontSize: SIZES.h1, color: COLORS.textPrimary },
  h2: { fontFamily: 'Poppins-SemiBold', fontSize: SIZES.h2, color: COLORS.textPrimary },
  h3: { fontFamily: 'Poppins-SemiBold', fontSize: SIZES.h3, color: COLORS.textPrimary },
  body: { fontFamily: 'Poppins-Regular', fontSize: SIZES.body, color: COLORS.textPrimary, lineHeight: SIZES.body * 1.5 },
  caption: { fontFamily: 'Poppins-Regular', fontSize: SIZES.caption, color: COLORS.textSecondary },
};