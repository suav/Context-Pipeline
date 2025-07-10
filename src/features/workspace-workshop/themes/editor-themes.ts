import { editor } from 'monaco-editor';
import { Theme } from '@/lib/theme-context';
// Monaco editor theme configuration interface
export interface MonacoThemeConfig {
  base: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
  inherit: boolean;
  rules: editor.ITokenThemeRule[];
  colors: Record<string, string>;
}
// Convert app theme to Monaco theme configuration
export function createMonacoTheme(theme: Theme): MonacoThemeConfig {
  const isDark = theme.id.includes('dark') || theme.id === 'space-invaders';
  const baseConfig: MonacoThemeConfig = {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      // TypeScript/JavaScript syntax highlighting
      { token: 'comment', foreground: theme.colors.textMuted.replace('#', '') },
      { token: 'keyword', foreground: theme.colors.primary.replace('#', ''), fontStyle: 'bold' },
      { token: 'string', foreground: theme.colors.success.replace('#', '') },
      { token: 'number', foreground: theme.colors.warning.replace('#', '') },
      { token: 'regexp', foreground: theme.colors.error.replace('#', '') },
      { token: 'type', foreground: theme.colors.secondary.replace('#', '') },
      { token: 'class', foreground: theme.colors.primary.replace('#', ''), fontStyle: 'bold' },
      { token: 'function', foreground: theme.colors.primary.replace('#', '') },
      { token: 'variable', foreground: theme.colors.textPrimary.replace('#', '') },
      { token: 'constant', foreground: theme.colors.warning.replace('#', ''), fontStyle: 'bold' },
      // JSON syntax highlighting
      { token: 'key', foreground: theme.colors.primary.replace('#', '') },
      { token: 'value', foreground: theme.colors.textPrimary.replace('#', '') },
      // CSS syntax highlighting
      { token: 'property', foreground: theme.colors.primary.replace('#', '') },
      { token: 'value.css', foreground: theme.colors.success.replace('#', '') },
      { token: 'selector', foreground: theme.colors.secondary.replace('#', '') },
      // Markdown syntax highlighting
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'header', foreground: theme.colors.primary.replace('#', ''), fontStyle: 'bold' },
      { token: 'link', foreground: theme.colors.primary.replace('#', '') },
      { token: 'code', foreground: theme.colors.secondary.replace('#', '') },
    ],
    colors: {
      // Editor background
      'editor.background': theme.colors.surface,
      'editor.foreground': theme.colors.textPrimary,
      // Line numbers
      'editorLineNumber.foreground': theme.colors.textMuted,
      'editorLineNumber.activeForeground': theme.colors.textSecondary,
      // Cursor and selection
      'editorCursor.foreground': theme.colors.primary,
      'editor.selectionBackground': theme.colors.primary + '40', // 25% opacity
      'editor.selectionHighlightBackground': theme.colors.primary + '20', // 12.5% opacity
      // Gutter
      'editorGutter.background': theme.colors.surface,
      'editorGutter.modifiedBackground': theme.colors.warning,
      'editorGutter.addedBackground': theme.colors.success,
      'editorGutter.deletedBackground': theme.colors.error,
      // Find/replace
      'editor.findMatchBackground': theme.colors.warning + '60',
      'editor.findMatchHighlightBackground': theme.colors.warning + '30',
      'editor.findRangeHighlightBackground': theme.colors.primary + '30',
      // Indentation guides
      'editorIndentGuide.background': theme.colors.border,
      'editorIndentGuide.activeBackground': theme.colors.borderFocus,
      // Brackets
      'editorBracketMatch.background': theme.colors.primary + '40',
      'editorBracketMatch.border': theme.colors.primary,
      // Error/warning squiggles
      'editorError.foreground': theme.colors.error,
      'editorWarning.foreground': theme.colors.warning,
      'editorInfo.foreground': theme.colors.primary,
      'editorHint.foreground': theme.colors.textMuted,
      // Hover
      'editorHoverWidget.background': theme.colors.surfaceElevated,
      'editorHoverWidget.border': theme.colors.border,
      // Suggest widget (IntelliSense)
      'editorSuggestWidget.background': theme.colors.surfaceElevated,
      'editorSuggestWidget.border': theme.colors.border,
      'editorSuggestWidget.selectedBackground': theme.colors.primary + '40',
      'editorSuggestWidget.highlightForeground': theme.colors.primary,
      // Scrollbar
      'scrollbar.shadow': theme.colors.border,
      'scrollbarSlider.background': theme.colors.border + '60',
      'scrollbarSlider.hoverBackground': theme.colors.border + '80',
      'scrollbarSlider.activeBackground': theme.colors.border + 'A0',
      // Minimap
      'minimap.background': theme.colors.surface,
      'minimap.selectionHighlight': theme.colors.primary + '60',
      'minimap.findMatchHighlight': theme.colors.warning + '60',
      // Current line
      'editor.lineHighlightBackground': theme.colors.primary + '10',
      'editor.lineHighlightBorder': 'transparent',
      // Word highlighting
      'editor.wordHighlightBackground': theme.colors.textMuted + '40',
      'editor.wordHighlightStrongBackground': theme.colors.textMuted + '60',
      // Whitespace
      'editorWhitespace.foreground': theme.colors.textMuted + '40',
      // Overview ruler
      'editorOverviewRuler.border': theme.colors.border,
      'editorOverviewRuler.findMatchForeground': theme.colors.warning,
      'editorOverviewRuler.selectionHighlightForeground': theme.colors.primary,
      'editorOverviewRuler.wordHighlightForeground': theme.colors.textMuted,
      'editorOverviewRuler.wordHighlightStrongForeground': theme.colors.textSecondary,
      'editorOverviewRuler.modifiedForeground': theme.colors.warning,
      'editorOverviewRuler.addedForeground': theme.colors.success,
      'editorOverviewRuler.deletedForeground': theme.colors.error,
      'editorOverviewRuler.errorForeground': theme.colors.error,
      'editorOverviewRuler.warningForeground': theme.colors.warning,
      'editorOverviewRuler.infoForeground': theme.colors.primary,
    },
  };
  // Theme-specific customizations
  switch (theme.id) {
    case 'space-invaders':
      return {
        ...baseConfig,
        colors: {
          ...baseConfig.colors,
          'editor.background': '#000000',
          'editor.foreground': '#00ff00',
          'editorLineNumber.foreground': '#008800',
          'editorLineNumber.activeForeground': '#00cc00',
          'editorCursor.foreground': '#00ff00',
          'editor.selectionBackground': '#00ff0040',
          'editor.lineHighlightBackground': '#00220015',
          'editorBracketMatch.background': '#00ff0040',
          'editorBracketMatch.border': '#00ff00',
          'editorHoverWidget.background': '#001100',
          'editorSuggestWidget.background': '#001100',
          'editorSuggestWidget.selectedBackground': '#00ff0040',
        },
        rules: [
          ...baseConfig.rules,
          { token: 'comment', foreground: '008800' },
          { token: 'keyword', foreground: '00ff00', fontStyle: 'bold' },
          { token: 'string', foreground: '00cc00' },
          { token: 'number', foreground: 'ffff00' },
          { token: 'regexp', foreground: 'ff0000' },
          { token: 'type', foreground: '00cccc' },
          { token: 'class', foreground: '00ff00', fontStyle: 'bold' },
          { token: 'function', foreground: '00ffff' },
          { token: 'variable', foreground: '00ff00' },
          { token: 'constant', foreground: 'ffff00', fontStyle: 'bold' },
        ],
      };
    case 'cerulean-city':
      return {
        ...baseConfig,
        colors: {
          ...baseConfig.colors,
          'editor.background': '#e3f2fd',
          'editor.foreground': '#0d47a1',
          'editorLineNumber.foreground': '#1976d2',
          'editorLineNumber.activeForeground': '#1565c0',
          'editorCursor.foreground': '#2196f3',
          'editor.selectionBackground': '#2196f340',
          'editor.lineHighlightBackground': '#bbdefb20',
          'editorBracketMatch.background': '#2196f340',
          'editorBracketMatch.border': '#2196f3',
          'editorHoverWidget.background': '#bbdefb',
          'editorSuggestWidget.background': '#bbdefb',
          'editorSuggestWidget.selectedBackground': '#2196f340',
        },
        rules: [
          ...baseConfig.rules,
          { token: 'comment', foreground: '1976d2' },
          { token: 'keyword', foreground: '2196f3', fontStyle: 'bold' },
          { token: 'string', foreground: '4caf50' },
          { token: 'number', foreground: 'ff9800' },
          { token: 'regexp', foreground: 'f44336' },
          { token: 'type', foreground: '42a5f5' },
          { token: 'class', foreground: '2196f3', fontStyle: 'bold' },
          { token: 'function', foreground: '1e88e5' },
          { token: 'variable', foreground: '0d47a1' },
          { token: 'constant', foreground: 'ff9800', fontStyle: 'bold' },
        ],
      };
    default:
      return baseConfig;
  }
}
// Pre-defined Monaco themes for common app themes
export const monacoThemes: Record<string, MonacoThemeConfig> = {};
// Register Monaco themes
export function registerMonacoThemes(themes: Record<string, Theme>) {
  Object.entries(themes).forEach(([themeId, theme]) => {
    monacoThemes[themeId] = createMonacoTheme(theme);
  });
}
// Get Monaco theme name for app theme
export function getMonacoThemeName(themeId: string): string {
  return `custom-${themeId}`;
}
// Default Monaco editor options
export const defaultMonacoOptions: editor.IStandaloneEditorConstructionOptions = {
  fontSize: 14,
  lineHeight: 21,
  fontFamily: 'var(--font-mono)',
  fontLigatures: true,
  lineNumbers: 'on',
  lineNumbersMinChars: 3,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on',
  minimap: { enabled: true },
  scrollbar: {
    vertical: 'auto',
    horizontal: 'auto',
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
  renderWhitespace: 'selection',
  renderIndentGuides: true,
  folding: true,
  foldingStrategy: 'indentation',
  showFoldingControls: 'mouseover',
  matchBrackets: 'always',
  bracketPairColorization: {
    enabled: true,
  },
  autoIndent: 'advanced',
  formatOnType: true,
  formatOnPaste: true,
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: true,
  trimAutoWhitespace: true,
  acceptSuggestionOnEnter: 'on',
  suggestOnTriggerCharacters: true,
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false,
  },
  parameterHints: {
    enabled: true,
    cycle: true,
  },
  hover: {
    enabled: true,
    delay: 300,
  },
  find: {
    addExtraSpaceOnTop: true,
    autoFindInSelection: 'never',
    seedSearchStringFromSelection: 'selection',
  },
  contextmenu: true,
  mouseWheelZoom: true,
  multiCursorModifier: 'ctrlCmd',
  accessibilitySupport: 'auto',
  inlayHints: {
    enabled: 'on',
  },
  stickyScroll: {
    enabled: true,
  },
  unicodeHighlight: {
    ambiguousCharacters: false,
  },
  guides: {
    bracketPairs: true,
    indentation: true,
    highlightActiveIndentation: true,
  },
  colorDecorators: true,
  links: true,
  occurrencesHighlight: true,
  selectionHighlight: true,
  codeLens: true,
  definitionLinkOpensInPeek: false,
  gotoLocation: {
    multipleDefinitions: 'peek',
    multipleDeclarations: 'peek',
    multipleImplementations: 'peek',
    multipleReferences: 'peek',
  },
};
// Language-specific Monaco options
export const languageSpecificOptions: Record<string, Partial<editor.IStandaloneEditorConstructionOptions>> = {
  typescript: {
    tabSize: 2,
    insertSpaces: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false,
    },
    parameterHints: {
      enabled: true,
      cycle: true,
    },
    suggest: {
      includeCompletionsForImportStatements: true,
      includeCompletionsWithSnippetText: true,
      showWords: false,
    },
    inlayHints: {
      enabled: 'on',
    },
  },
  javascript: {
    tabSize: 2,
    insertSpaces: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false,
    },
    parameterHints: {
      enabled: true,
      cycle: true,
    },
    suggest: {
      includeCompletionsForImportStatements: true,
      includeCompletionsWithSnippetText: true,
      showWords: false,
    },
  },
  json: {
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    formatOnType: true,
    formatOnPaste: true,
  },
  css: {
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    colorDecorators: true,
  },
  scss: {
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true,
    },
    colorDecorators: true,
  },
  markdown: {
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    quickSuggestions: {
      other: false,
      comments: false,
      strings: false,
    },
    minimap: { enabled: false },
    lineNumbers: 'off',
    glyphMargin: false,
    folding: false,
  },
  plaintext: {
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'on',
    quickSuggestions: {
      other: false,
      comments: false,
      strings: false,
    },
    minimap: { enabled: false },
    lineNumbers: 'on',
  },
};