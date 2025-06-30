'use client';

import React, { useState } from 'react';
import { useTheme } from '@/lib/theme-context';

interface ThemeSelectorProps {
  className?: string;
  compact?: boolean;
}

export function ThemeSelector({ className = '', compact = false }: ThemeSelectorProps) {
  const { currentTheme, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <span className="text-sm">🎨</span>
          <span className="text-sm font-medium">{currentTheme.name}</span>
          <span className="text-xs">▼</span>
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-0 mt-2 min-w-full bg-white border rounded-lg shadow-lg z-50"
            style={{
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-border)',
            }}
          >
            {Object.values(availableThemes).map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                  currentTheme.id === theme.id ? 'font-medium' : ''
                }`}
                style={{
                  color: 'var(--color-text-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.border,
                    }}
                  />
                  <div>
                    <div className="font-medium">{theme.name}</div>
                    <div 
                      className="text-xs" 
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {theme.description}
                    </div>
                  </div>
                  {currentTheme.id === theme.id && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full theme selector (for settings pages)
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 
        className="text-lg font-semibold"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Choose Theme
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(availableThemes).map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              currentTheme.id === theme.id
                ? 'ring-2 ring-blue-500 ring-offset-2'
                : ''
            }`}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: currentTheme.id === theme.id ? theme.colors.primary : theme.colors.border,
            }}
          >
            <div className="space-y-3">
              {/* Theme preview */}
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded border"
                  style={{
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.border,
                  }}
                />
                <div 
                  className="w-6 h-6 rounded border"
                  style={{
                    backgroundColor: theme.colors.success,
                    borderColor: theme.colors.border,
                  }}
                />
                <div 
                  className="w-6 h-6 rounded border"
                  style={{
                    backgroundColor: theme.colors.warning,
                    borderColor: theme.colors.border,
                  }}
                />
                <div 
                  className="w-6 h-6 rounded border"
                  style={{
                    backgroundColor: theme.colors.error,
                    borderColor: theme.colors.border,
                  }}
                />
              </div>

              {/* Theme info */}
              <div>
                <div 
                  className="font-semibold text-base"
                  style={{ color: theme.colors.textPrimary }}
                >
                  {theme.name}
                  {currentTheme.id === theme.id && (
                    <span className="ml-2 text-sm">✓ Active</span>
                  )}
                </div>
                <div 
                  className="text-sm mt-1"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {theme.description}
                </div>
              </div>

              {/* Sample UI elements */}
              <div className="space-y-2">
                <div 
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.textInverse,
                  }}
                >
                  Primary Button
                </div>
                <div 
                  className="text-xs px-2 py-1 rounded border"
                  style={{
                    backgroundColor: theme.colors.buttonSecondary,
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary,
                  }}
                >
                  Secondary Button
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Current theme details */}
      <div 
        className="p-4 rounded-lg border"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h4 
          className="font-medium mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Current Theme: {currentTheme.name}
        </h4>
        <p 
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {currentTheme.description}
        </p>
        
        {/* Theme-specific features */}
        {currentTheme.id === 'space-invaders' && (
          <div className="mt-2 text-xs text-green-400 font-mono">
            &gt; RETRO_TERMINAL_MODE.ENABLED
          </div>
        )}
        
        {currentTheme.id === 'cerulean-city' && (
          <div className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            🎮 Game Boy aesthetic activated
          </div>
        )}
      </div>
    </div>
  );
}