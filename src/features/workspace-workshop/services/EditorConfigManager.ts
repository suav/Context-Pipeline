import * as monaco from 'monaco-editor';
import { Theme } from '@/lib/theme-context';
import {
  createMonacoTheme,
  getMonacoThemeName,
  defaultMonacoOptions,
  languageSpecificOptions,
  registerMonacoThemes,
  MonacoThemeConfig
} from '../themes/editor-themes';
// File content cache interface
interface FileCache {
  content: string;
  lastModified: number;
  isDirty: boolean;
  language: string;
}
// Editor configuration interface
interface EditorConfig {
  theme: string;
  fontSize: number;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: 'on' | 'off' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  autoSave: boolean;
  autoSaveDelay: number;
  enableInlayHints: boolean;
  enableBracketPairColorization: boolean;
  formatOnSave: boolean;
  formatOnType: boolean;
  formatOnPaste: boolean;
}
// Default editor configuration
const defaultEditorConfig: EditorConfig = {
  theme: 'default-light',
  fontSize: 14,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',
  autoSave: true,
  autoSaveDelay: 2000,
  enableInlayHints: true,
  enableBracketPairColorization: true,
  formatOnSave: true,
  formatOnType: true,
  formatOnPaste: true,
};
// Auto-save manager
class AutoSaveManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private saveCallback: (filePath: string, content: string) => Promise<void>;
  private delay: number;
  constructor(saveCallback: (filePath: string, content: string) => Promise<void>, delay: number = 2000) {
    this.saveCallback = saveCallback;
    this.delay = delay;
  }
  scheduleAutoSave(filePath: string, content: string) {
    // Clear existing timer
    const existingTimer = this.timers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    // Set new timer
    const timer = setTimeout(async () => {
      try {
        await this.saveCallback(filePath, content);
        this.timers.delete(filePath);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.delay);
    this.timers.set(filePath, timer);
  }
  cancelAutoSave(filePath: string) {
    const timer = this.timers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(filePath);
    }
  }
  cancelAllAutoSaves() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }
  updateDelay(delay: number) {
    this.delay = delay;
  }
}
// Language detection utility
class LanguageDetector {
  private static readonly extensions: Record<string, string> = {
    // TypeScript/JavaScript
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    // Web languages
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'less': 'less',
    // Configuration
    'json': 'json',
    'jsonc': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'conf': 'ini',
    'config': 'ini',
    // Documentation
    'md': 'markdown',
    'markdown': 'markdown',
    'rst': 'restructuredtext',
    'txt': 'plaintext',
    // Programming languages
    'py': 'python',
    'rb': 'ruby',
    'php': 'php',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'kt': 'kotlin',
    'swift': 'swift',
    // Shell and scripts
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'ps1': 'powershell',
    'bat': 'bat',
    'cmd': 'bat',
    // Database
    'sql': 'sql',
    // Other
    'xml': 'xml',
    'svg': 'xml',
    'dockerfile': 'dockerfile',
    'gitignore': 'ignore',
    'env': 'dotenv',
    'log': 'log',
  };
  static detectLanguage(filePath: string): string {
    const filename = filePath.split('/').pop() || '';
    // Check for specific filenames
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename === 'dockerfile') return 'dockerfile';
    if (lowerFilename === 'makefile') return 'makefile';
    if (lowerFilename.startsWith('.env')) return 'dotenv';
    if (lowerFilename === 'package.json') return 'json';
    if (lowerFilename === 'tsconfig.json') return 'json';
    if (lowerFilename.endsWith('.config.js')) return 'javascript';
    if (lowerFilename.endsWith('.config.ts')) return 'typescript';
    // Check extension
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension && this.extensions[extension]) {
      return this.extensions[extension];
    }
    return 'plaintext';
  }
  static isCodeFile(filePath: string): boolean {
    const language = this.detectLanguage(filePath);
    return language !== 'plaintext' && language !== 'log';
  }
}
// Main Editor Configuration Manager
export class EditorConfigManager {
  private static instance: EditorConfigManager;
  private fileCache: Map<string, FileCache> = new Map();
  private config: EditorConfig;
  private autoSaveManager: AutoSaveManager;
  private themeRegistered: Set<string> = new Set();
  private currentTheme: Theme | null = null;
  private monacoInstance: typeof monaco | null = null;
  private activeEditors: Map<string, monaco.editor.IStandaloneCodeEditor> = new Map();
  private constructor() {
    this.config = this.loadConfig();
    this.autoSaveManager = new AutoSaveManager(
      this.handleAutoSave.bind(this),
      this.config.autoSaveDelay
    );
  }
  static getInstance(): EditorConfigManager {
    if (!EditorConfigManager.instance) {
      EditorConfigManager.instance = new EditorConfigManager();
    }
    return EditorConfigManager.instance;
  }
  // Initialize Monaco editor
  setMonacoInstance(monacoInstance: typeof monaco) {
    this.monacoInstance = monacoInstance;
  }
  // Configuration management
  private loadConfig(): EditorConfig {
    try {
      const saved = localStorage.getItem('editor-config');
      if (saved) {
        return { ...defaultEditorConfig, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load editor config:', error);
    }
    return defaultEditorConfig;
  }
  private saveConfig() {
    try {
      localStorage.setItem('editor-config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save editor config:', error);
    }
  }
  // Public configuration methods
  getConfig(): EditorConfig {
    return { ...this.config };
  }
  updateConfig(updates: Partial<EditorConfig>) {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.autoSaveManager.updateDelay(this.config.autoSaveDelay);
    this.applyConfigToEditors();
  }
  // Theme management
  registerTheme(theme: Theme) {
    if (!this.monacoInstance) return;
    const themeId = getMonacoThemeName(theme.id);
    if (this.themeRegistered.has(themeId)) return;
    const monacoTheme = createMonacoTheme(theme);
    this.monacoInstance.editor.defineTheme(themeId, monacoTheme);
    this.themeRegistered.add(themeId);
    this.currentTheme = theme;
  }
  setTheme(theme: Theme) {
    this.registerTheme(theme);
    const themeId = getMonacoThemeName(theme.id);
    this.config.theme = theme.id;
    this.saveConfig();
    if (this.monacoInstance) {
      this.monacoInstance.editor.setTheme(themeId);
    }
  }
  // Editor options generation
  getEditorOptions(filePath: string, language?: string): monaco.editor.IStandaloneEditorConstructionOptions {
    const detectedLanguage = language || LanguageDetector.detectLanguage(filePath);
    const languageOptions = languageSpecificOptions[detectedLanguage] || {};
    return {
      ...defaultMonacoOptions,
      ...languageOptions,
      theme: this.currentTheme ? getMonacoThemeName(this.currentTheme.id) : 'vs',
      fontSize: this.config.fontSize,
      tabSize: this.config.tabSize,
      insertSpaces: this.config.insertSpaces,
      wordWrap: this.config.wordWrap,
      minimap: { 
        enabled: this.config.minimap,
        side: 'right',
        showSlider: 'mouseover',
        renderCharacters: true,
        maxColumn: 120,
        scale: 1
      },
      lineNumbers: this.config.lineNumbers,
      formatOnType: this.config.formatOnType,
      formatOnPaste: this.config.formatOnPaste,
      inlayHints: { enabled: this.config.enableInlayHints ? 'on' : 'off' },
      bracketPairColorization: { enabled: this.config.enableBracketPairColorization },
      readOnly: false,
    };
  }
  // Apply configuration to existing editors
  private applyConfigToEditors() {
    this.activeEditors.forEach((editor, filePath) => {
      const language = this.getFileLanguage(filePath);
      const options = this.getEditorOptions(filePath, language);
      editor.updateOptions(options);
    });
  }
  // File management
  registerEditor(filePath: string, editor: monaco.editor.IStandaloneCodeEditor) {
    this.activeEditors.set(filePath, editor);
    // Set up auto-save if enabled
    if (this.config.autoSave) {
      editor.onDidChangeModelContent(() => {
        const content = editor.getValue();
        this.updateFileCache(filePath, content, true);
        this.autoSaveManager.scheduleAutoSave(filePath, content);
      });
    }
  }
  unregisterEditor(filePath: string) {
    this.activeEditors.delete(filePath);
    this.autoSaveManager.cancelAutoSave(filePath);
  }
  // File cache management
  updateFileCache(filePath: string, content: string, isDirty: boolean = false) {
    const language = LanguageDetector.detectLanguage(filePath);
    this.fileCache.set(filePath, {
      content,
      lastModified: Date.now(),
      isDirty,
      language,
    });
  }
  getFileFromCache(filePath: string): FileCache | null {
    return this.fileCache.get(filePath) || null;
  }
  getFileLanguage(filePath: string): string {
    const cached = this.fileCache.get(filePath);
    return cached?.language || LanguageDetector.detectLanguage(filePath);
  }
  isFileDirty(filePath: string): boolean {
    const cached = this.fileCache.get(filePath);
    return cached?.isDirty || false;
  }
  markFileClean(filePath: string) {
    const cached = this.fileCache.get(filePath);
    if (cached) {
      cached.isDirty = false;
      this.fileCache.set(filePath, cached);
    }
  }
  // Auto-save handler
  private async handleAutoSave(filePath: string, content: string) {
    try {
      // This should be implemented by the component using this manager
      // For now, we'll emit a custom event
      const event = new CustomEvent('editorAutoSave', {
        detail: { filePath, content }
      });
      window.dispatchEvent(event);
      this.markFileClean(filePath);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }
  // Format document
  async formatDocument(filePath: string): Promise<boolean> {
    const editor = this.activeEditors.get(filePath);
    if (!editor) return false;
    try {
      await editor.getAction('editor.action.formatDocument')?.run();
      return true;
    } catch (error) {
      console.error('Format document failed:', error);
      return false;
    }
  }
  // Save file
  async saveFile(filePath: string, saveCallback: (filePath: string, content: string) => Promise<void>): Promise<boolean> {
    const editor = this.activeEditors.get(filePath);
    if (!editor) return false;
    try {
      const content = editor.getValue();
      // Format on save if enabled
      if (this.config.formatOnSave) {
        await this.formatDocument(filePath);
      }
      await saveCallback(filePath, content);
      this.markFileClean(filePath);
      this.autoSaveManager.cancelAutoSave(filePath);
      return true;
    } catch (error) {
      console.error('Save file failed:', error);
      return false;
    }
  }
  // Language detection
  static detectLanguage = LanguageDetector.detectLanguage;
  static isCodeFile = LanguageDetector.isCodeFile;
  // Cleanup
  dispose() {
    this.autoSaveManager.cancelAllAutoSaves();
    this.activeEditors.clear();
    this.fileCache.clear();
  }
}
// Export default instance
export const editorConfigManager = EditorConfigManager.getInstance();
// Export utilities
export { LanguageDetector };
export type { EditorConfig, FileCache, MonacoThemeConfig };