'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Theme definitions
export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    // Background colors
    background: string;
    surface: string;
    surfaceElevated: string;
    
    // Text colors
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    
    // UI colors
    border: string;
    borderFocus: string;
    
    // Semantic colors
    primary: string;
    primaryHover: string;
    secondary: string;
    secondaryHover: string;
    success: string;
    successHover: string;
    warning: string;
    warningHover: string;
    error: string;
    errorHover: string;
    
    // Component-specific
    cardBackground: string;
    cardBorder: string;
    buttonPrimary: string;
    buttonPrimaryHover: string;
    buttonSecondary: string;
    buttonSecondaryHover: string;
    
    // Overlay and modal
    overlay: string;
    modalBackground: string;
    
    // Terminal-specific (for themed terminals)
    terminalBackground?: string;
    terminalText?: string;
    terminalPrompt?: string;
  };
  fonts?: {
    ui: string;
    mono: string;
    heading: string;
  };
  spacing?: {
    cardPadding: string;
    buttonHeight: string;
    borderRadius: string;
  };
}

// Default Light theme (clean, professional)
export const defaultLightTheme: Theme = {
  id: 'default-light',
  name: 'Default Light',
  description: 'Clean and professional light interface',
  colors: {
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceElevated: '#ffffff',
    
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    textInverse: '#ffffff',
    
    border: '#e2e8f0',
    borderFocus: '#3b82f6',
    
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    secondary: '#64748b',
    secondaryHover: '#475569',
    success: '#10b981',
    successHover: '#059669',
    warning: '#f59e0b',
    warningHover: '#d97706',
    error: '#ef4444',
    errorHover: '#dc2626',
    
    cardBackground: '#ffffff',
    cardBorder: '#e2e8f0',
    buttonPrimary: '#3b82f6',
    buttonPrimaryHover: '#2563eb',
    buttonSecondary: '#f1f5f9',
    buttonSecondaryHover: '#e2e8f0',
    
    overlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#ffffff',
    
    terminalBackground: '#000000',
    terminalText: '#00ff00',
    terminalPrompt: '#00ff00',
  },
  fonts: {
    ui: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    heading: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  spacing: {
    cardPadding: '1.5rem',
    buttonHeight: '2.5rem',
    borderRadius: '0.5rem',
  },
};

// Default Dark theme
export const defaultDarkTheme: Theme = {
  id: 'default-dark',
  name: 'Default Dark',
  description: 'Clean and professional dark interface',
  colors: {
    background: '#0f172a',
    surface: '#1e293b',
    surfaceElevated: '#334155',
    
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textInverse: '#0f172a',
    
    border: '#475569',
    borderFocus: '#60a5fa',
    
    primary: '#60a5fa',
    primaryHover: '#3b82f6',
    secondary: '#64748b',
    secondaryHover: '#475569',
    success: '#34d399',
    successHover: '#10b981',
    warning: '#fbbf24',
    warningHover: '#f59e0b',
    error: '#f87171',
    errorHover: '#ef4444',
    
    cardBackground: '#1e293b',
    cardBorder: '#475569',
    buttonPrimary: '#60a5fa',
    buttonPrimaryHover: '#3b82f6',
    buttonSecondary: '#334155',
    buttonSecondaryHover: '#475569',
    
    overlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#1e293b',
    
    terminalBackground: '#000000',
    terminalText: '#00ff00',
    terminalPrompt: '#00ff00',
  },
  fonts: {
    ui: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    heading: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  spacing: {
    cardPadding: '1.5rem',
    buttonHeight: '2.5rem',
    borderRadius: '0.5rem',
  },
};

// Space Invaders theme (retro terminal)
export const spaceInvadersTheme: Theme = {
  id: 'space-invaders',
  name: 'Space Invaders',
  description: 'Retro terminal aesthetic with green phosphor glow',
  colors: {
    background: '#000000',
    surface: '#001100',
    surfaceElevated: '#002200',
    
    textPrimary: '#00ff00',
    textSecondary: '#00cc00',
    textMuted: '#008800',
    textInverse: '#000000',
    
    border: '#00aa00',
    borderFocus: '#00ff00',
    
    primary: '#00ff00',
    primaryHover: '#00cc00',
    secondary: '#008800',
    secondaryHover: '#00aa00',
    success: '#00ff00',
    successHover: '#00cc00',
    warning: '#ffff00',
    warningHover: '#cccc00',
    error: '#ff0000',
    errorHover: '#cc0000',
    
    cardBackground: '#001100',
    cardBorder: '#00aa00',
    buttonPrimary: '#00ff00',
    buttonPrimaryHover: '#00cc00',
    buttonSecondary: '#002200',
    buttonSecondaryHover: '#003300',
    
    overlay: 'rgba(0, 255, 0, 0.1)',
    modalBackground: '#001100',
    
    terminalBackground: '#000000',
    terminalText: '#00ff00',
    terminalPrompt: '#00ff00',
  },
  fonts: {
    ui: '"Courier New", Monaco, monospace',
    mono: '"Courier New", Monaco, monospace',
    heading: '"Courier New", Monaco, monospace',
  },
  spacing: {
    cardPadding: '1rem',
    buttonHeight: '2rem',
    borderRadius: '0.25rem',
  },
};

// Cerulean City theme (Pokemon Game Boy aesthetic - Light Powder Blue)
export const ceruleanCityTheme: Theme = {
  id: 'cerulean-city',
  name: 'Cerulean City',
  description: 'Pokemon-inspired light powder blue theme with retro gaming fonts',
  colors: {
    background: '#e3f2fd',
    surface: '#bbdefb',
    surfaceElevated: '#90caf9',
    
    textPrimary: '#0d47a1',
    textSecondary: '#1565c0',
    textMuted: '#1976d2',
    textInverse: '#ffffff',
    
    border: '#64b5f6',
    borderFocus: '#2196f3',
    
    primary: '#2196f3',
    primaryHover: '#1976d2',
    secondary: '#42a5f5',
    secondaryHover: '#1e88e5',
    success: '#4caf50',
    successHover: '#388e3c',
    warning: '#ff9800',
    warningHover: '#f57c00',
    error: '#f44336',
    errorHover: '#d32f2f',
    
    cardBackground: '#bbdefb',
    cardBorder: '#64b5f6',
    buttonPrimary: '#2196f3',
    buttonPrimaryHover: '#1976d2',
    buttonSecondary: '#e3f2fd',
    buttonSecondaryHover: '#bbdefb',
    
    overlay: 'rgba(13, 71, 161, 0.3)',
    modalBackground: '#bbdefb',
    
    terminalBackground: '#000000',
    terminalText: '#00ff00',
    terminalPrompt: '#00ff00',
  },
  fonts: {
    ui: '"Pokemon Solid", "Press Start 2P", "Pixelify Sans", "Courier New", monospace',
    mono: '"Pokemon Solid", "Press Start 2P", "Pixelify Sans", "Courier New", monospace',
    heading: '"Pokemon Solid", "Press Start 2P", "Pixelify Sans", "Courier New", monospace',
  },
  spacing: {
    cardPadding: '1rem',
    buttonHeight: '2rem',
    borderRadius: '0.25rem',
  },
};

// Available themes
export const themes: Record<string, Theme> = {
  'default-light': defaultLightTheme,
  'default-dark': defaultDarkTheme,
  'space-invaders': spaceInvadersTheme,
  'cerulean-city': ceruleanCityTheme,
};

// Keep backward compatibility
export const defaultTheme = defaultLightTheme;

// Theme context
interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  availableThemes: Record<string, Theme>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
interface ThemeProviderProps {
  children: ReactNode;
  defaultThemeId?: string;
}

export function ThemeProvider({ children, defaultThemeId = 'default-light' }: ThemeProviderProps) {
  const [currentThemeId, setCurrentThemeId] = useState(defaultThemeId);
  const [currentTheme, setCurrentTheme] = useState(themes[defaultThemeId]);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentThemeId(savedTheme);
      setCurrentTheme(themes[savedTheme]);
    }
  }, []);

  // Apply theme CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply color properties
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${kebabCase(key)}`, value);
    });
    
    // Apply font properties
    if (currentTheme.fonts) {
      Object.entries(currentTheme.fonts).forEach(([key, value]) => {
        root.style.setProperty(`--font-${kebabCase(key)}`, value);
      });
    }
    
    // Apply spacing properties
    if (currentTheme.spacing) {
      Object.entries(currentTheme.spacing).forEach(([key, value]) => {
        root.style.setProperty(`--spacing-${kebabCase(key)}`, value);
      });
    }
    
    // Add theme class to body for theme-specific styling
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${currentTheme.id}`);
    
  }, [currentTheme]);

  const setTheme = (themeId: string) => {
    if (themes[themeId]) {
      setCurrentThemeId(themeId);
      setCurrentTheme(themes[themeId]);
      localStorage.setItem('app-theme', themeId);
    }
  };

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      setTheme,
      availableThemes: themes,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Utility function to convert camelCase to kebab-case
function kebabCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

// Theme utilities
export const themeUtils = {
  // Get CSS custom property
  getCSSVar: (property: string) => `var(--${property})`,
  
  // Get color CSS custom property
  getColor: (colorKey: string) => `var(--color-${kebabCase(colorKey)})`,
  
  // Get font CSS custom property
  getFont: (fontKey: string) => `var(--font-${kebabCase(fontKey)})`,
  
  // Get spacing CSS custom property
  getSpacing: (spacingKey: string) => `var(--spacing-${kebabCase(spacingKey)})`,
  
  // Apply theme-aware classes
  themeClass: (baseClass: string, themeSpecific?: Record<string, string>) => {
    return (themeId: string) => {
      if (themeSpecific && themeSpecific[themeId]) {
        return `${baseClass} ${themeSpecific[themeId]}`;
      }
      return baseClass;
    };
  },
};