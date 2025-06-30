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

// Default theme (clean, professional)
export const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',
  description: 'Clean and professional interface',
  colors: {
    background: '#f9fafb',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    
    textPrimary: '#111827',
    textSecondary: '#374151',
    textMuted: '#6b7280',
    textInverse: '#ffffff',
    
    border: '#e5e7eb',
    borderFocus: '#3b82f6',
    
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    secondary: '#6b7280',
    secondaryHover: '#4b5563',
    success: '#10b981',
    successHover: '#059669',
    warning: '#f59e0b',
    warningHover: '#d97706',
    error: '#ef4444',
    errorHover: '#dc2626',
    
    cardBackground: '#ffffff',
    cardBorder: '#e5e7eb',
    buttonPrimary: '#3b82f6',
    buttonPrimaryHover: '#2563eb',
    buttonSecondary: '#f3f4f6',
    buttonSecondaryHover: '#e5e7eb',
    
    overlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#ffffff',
  },
  fonts: {
    ui: 'ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    heading: 'ui-sans-serif, system-ui, sans-serif',
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

// Cerulean City theme (Pokemon Game Boy aesthetic)
export const ceruleanCityTheme: Theme = {
  id: 'cerulean-city',
  name: 'Cerulean City',
  description: 'Pokemon Game Boy inspired blue monochrome palette',
  colors: {
    background: '#9bbc0f',
    surface: '#8bac0f',
    surfaceElevated: '#306230',
    
    textPrimary: '#0f380f',
    textSecondary: '#1e5d1e',
    textMuted: '#4f7f4f',
    textInverse: '#9bbc0f',
    
    border: '#306230',
    borderFocus: '#0f380f',
    
    primary: '#0f380f',
    primaryHover: '#1e5d1e',
    secondary: '#4f7f4f',
    secondaryHover: '#306230',
    success: '#0f380f',
    successHover: '#1e5d1e',
    warning: '#8bac0f',
    warningHover: '#7a9b0f',
    error: '#5a2f2f',
    errorHover: '#4a1f1f',
    
    cardBackground: '#8bac0f',
    cardBorder: '#306230',
    buttonPrimary: '#0f380f',
    buttonPrimaryHover: '#1e5d1e',
    buttonSecondary: '#4f7f4f',
    buttonSecondaryHover: '#306230',
    
    overlay: 'rgba(15, 56, 15, 0.3)',
    modalBackground: '#8bac0f',
    
    terminalBackground: '#9bbc0f',
    terminalText: '#0f380f',
    terminalPrompt: '#1e5d1e',
  },
  fonts: {
    ui: '"Pixelify Sans", "Courier New", monospace',
    mono: '"Pixelify Sans", "Courier New", monospace',
    heading: '"Pixelify Sans", "Courier New", monospace',
  },
  spacing: {
    cardPadding: '1rem',
    buttonHeight: '2rem',
    borderRadius: '0.125rem',
  },
};

// Available themes
export const themes: Record<string, Theme> = {
  default: defaultTheme,
  'space-invaders': spaceInvadersTheme,
  'cerulean-city': ceruleanCityTheme,
};

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

export function ThemeProvider({ children, defaultThemeId = 'default' }: ThemeProviderProps) {
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