export interface FileIconConfig {
  icon: string;
  color?: string;
  category: 'source' | 'config' | 'documentation' | 'asset' | 'data' | 'build' | 'test' | 'other';
  description: string;
}
// Comprehensive file icon mappings
const FILE_ICON_MAP: Record<string, FileIconConfig> = {
  // React/JavaScript ecosystem
  'tsx': { icon: '⚛️', color: '#61DAFB', category: 'source', description: 'TypeScript React Component' },
  'jsx': { icon: '⚛️', color: '#61DAFB', category: 'source', description: 'JavaScript React Component' },
  'ts': { icon: '📘', color: '#3178C6', category: 'source', description: 'TypeScript File' },
  'js': { icon: '📙', color: '#F7DF1E', category: 'source', description: 'JavaScript File' },
  'mjs': { icon: '📙', color: '#F7DF1E', category: 'source', description: 'ES Module JavaScript' },
  'cjs': { icon: '📙', color: '#F7DF1E', category: 'source', description: 'CommonJS Module' },
  // Web languages
  'html': { icon: '🌐', color: '#E34F26', category: 'source', description: 'HTML Document' },
  'htm': { icon: '🌐', color: '#E34F26', category: 'source', description: 'HTML Document' },
  'css': { icon: '🎨', color: '#1572B6', category: 'source', description: 'CSS Stylesheet' },
  'scss': { icon: '🎨', color: '#CF649A', category: 'source', description: 'Sass Stylesheet' },
  'sass': { icon: '🎨', color: '#CF649A', category: 'source', description: 'Sass Stylesheet' },
  'less': { icon: '🎨', color: '#1D365D', category: 'source', description: 'Less Stylesheet' },
  'vue': { icon: '💚', color: '#4FC08D', category: 'source', description: 'Vue.js Component' },
  'svelte': { icon: '🧡', color: '#FF3E00', category: 'source', description: 'Svelte Component' },
  // Configuration files
  'json': { icon: '📋', color: '#FFCA28', category: 'config', description: 'JSON Data' },
  'jsonc': { icon: '📋', color: '#FFCA28', category: 'config', description: 'JSON with Comments' },
  'yaml': { icon: '📄', color: '#CB171E', category: 'config', description: 'YAML Configuration' },
  'yml': { icon: '📄', color: '#CB171E', category: 'config', description: 'YAML Configuration' },
  'toml': { icon: '📄', color: '#9C4221', category: 'config', description: 'TOML Configuration' },
  'ini': { icon: '⚙️', color: '#6C757D', category: 'config', description: 'INI Configuration' },
  'conf': { icon: '⚙️', color: '#6C757D', category: 'config', description: 'Configuration File' },
  'config': { icon: '⚙️', color: '#6C757D', category: 'config', description: 'Configuration File' },
  'env': { icon: '🔐', color: '#EF4444', category: 'config', description: 'Environment Variables' },
  'gitignore': { icon: '🚫', color: '#F05032', category: 'config', description: 'Git Ignore Rules' },
  'dockerignore': { icon: '🚫', color: '#2496ED', category: 'config', description: 'Docker Ignore Rules' },
  'eslintrc': { icon: '🔍', color: '#4B32C3', category: 'config', description: 'ESLint Configuration' },
  'prettierrc': { icon: '💅', color: '#F7B93E', category: 'config', description: 'Prettier Configuration' },
  // Documentation
  'md': { icon: '📝', color: '#083FA1', category: 'documentation', description: 'Markdown Document' },
  'markdown': { icon: '📝', color: '#083FA1', category: 'documentation', description: 'Markdown Document' },
  'mdx': { icon: '📝', color: '#1B1F24', category: 'documentation', description: 'MDX Document' },
  'rst': { icon: '📃', color: '#8CA1AF', category: 'documentation', description: 'reStructuredText' },
  'txt': { icon: '📄', color: '#6C757D', category: 'documentation', description: 'Text File' },
  'readme': { icon: '📖', color: '#083FA1', category: 'documentation', description: 'README File' },
  'changelog': { icon: '📋', color: '#28A745', category: 'documentation', description: 'Changelog' },
  'license': { icon: '📜', color: '#FD7E14', category: 'documentation', description: 'License File' },
  // Programming languages
  'py': { icon: '🐍', color: '#3776AB', category: 'source', description: 'Python Script' },
  'rb': { icon: '💎', color: '#CC342D', category: 'source', description: 'Ruby Script' },
  'php': { icon: '🐘', color: '#777BB4', category: 'source', description: 'PHP Script' },
  'java': { icon: '☕', color: '#ED8B00', category: 'source', description: 'Java Source' },
  'class': { icon: '☕', color: '#ED8B00', category: 'build', description: 'Java Class' },
  'jar': { icon: '📦', color: '#ED8B00', category: 'build', description: 'Java Archive' },
  'c': { icon: '⚙️', color: '#A8B9CC', category: 'source', description: 'C Source' },
  'cpp': { icon: '⚙️', color: '#00599C', category: 'source', description: 'C++ Source' },
  'cc': { icon: '⚙️', color: '#00599C', category: 'source', description: 'C++ Source' },
  'cxx': { icon: '⚙️', color: '#00599C', category: 'source', description: 'C++ Source' },
  'h': { icon: '📄', color: '#A8B9CC', category: 'source', description: 'C Header' },
  'hpp': { icon: '📄', color: '#00599C', category: 'source', description: 'C++ Header' },
  'cs': { icon: '💠', color: '#239120', category: 'source', description: 'C# Source' },
  'go': { icon: '🐹', color: '#00ADD8', category: 'source', description: 'Go Source' },
  'rs': { icon: '🦀', color: '#CE422B', category: 'source', description: 'Rust Source' },
  'kt': { icon: '🎯', color: '#A97BFF', category: 'source', description: 'Kotlin Source' },
  'swift': { icon: '🔶', color: '#FA7343', category: 'source', description: 'Swift Source' },
  'dart': { icon: '🎯', color: '#0175C2', category: 'source', description: 'Dart Source' },
  'scala': { icon: '🏛️', color: '#DC322F', category: 'source', description: 'Scala Source' },
  'lua': { icon: '🌙', color: '#2C2D72', category: 'source', description: 'Lua Script' },
  'r': { icon: '📊', color: '#276DC3', category: 'source', description: 'R Script' },
  'matlab': { icon: '📊', color: '#0076A8', category: 'source', description: 'MATLAB Script' },
  'm': { icon: '📊', color: '#0076A8', category: 'source', description: 'MATLAB/Objective-C' },
  // Shell and scripts
  'sh': { icon: '🐚', color: '#89E051', category: 'source', description: 'Shell Script' },
  'bash': { icon: '🐚', color: '#89E051', category: 'source', description: 'Bash Script' },
  'zsh': { icon: '🐚', color: '#89E051', category: 'source', description: 'Zsh Script' },
  'fish': { icon: '🐠', color: '#89E051', category: 'source', description: 'Fish Script' },
  'ps1': { icon: '💙', color: '#012456', category: 'source', description: 'PowerShell Script' },
  'bat': { icon: '⚫', color: '#C1F12E', category: 'source', description: 'Batch File' },
  'cmd': { icon: '⚫', color: '#C1F12E', category: 'source', description: 'Command File' },
  // Database
  'sql': { icon: '🗃️', color: '#E38C00', category: 'data', description: 'SQL Script' },
  'db': { icon: '🗄️', color: '#336791', category: 'data', description: 'Database File' },
  'sqlite': { icon: '🗄️', color: '#003B57', category: 'data', description: 'SQLite Database' },
  'sqlite3': { icon: '🗄️', color: '#003B57', category: 'data', description: 'SQLite Database' },
  // Data formats
  'xml': { icon: '📋', color: '#FF6600', category: 'data', description: 'XML Document' },
  'svg': { icon: '🎨', color: '#FF9900', category: 'asset', description: 'SVG Vector' },
  'csv': { icon: '📊', color: '#34A853', category: 'data', description: 'CSV Data' },
  'tsv': { icon: '📊', color: '#34A853', category: 'data', description: 'TSV Data' },
  'parquet': { icon: '📊', color: '#326CE5', category: 'data', description: 'Parquet Data' },
  // Images
  'png': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'PNG Image' },
  'jpg': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'JPEG Image' },
  'jpeg': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'JPEG Image' },
  'gif': { icon: '🎞️', color: '#FF69B4', category: 'asset', description: 'GIF Animation' },
  'webp': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'WebP Image' },
  'ico': { icon: '🔷', color: '#FF69B4', category: 'asset', description: 'Icon File' },
  'bmp': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'Bitmap Image' },
  'tiff': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'TIFF Image' },
  'tif': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'TIFF Image' },
  // Audio/Video
  'mp3': { icon: '🎵', color: '#FF5722', category: 'asset', description: 'MP3 Audio' },
  'wav': { icon: '🎵', color: '#FF5722', category: 'asset', description: 'WAV Audio' },
  'flac': { icon: '🎵', color: '#FF5722', category: 'asset', description: 'FLAC Audio' },
  'mp4': { icon: '🎬', color: '#FF5722', category: 'asset', description: 'MP4 Video' },
  'avi': { icon: '🎬', color: '#FF5722', category: 'asset', description: 'AVI Video' },
  'mov': { icon: '🎬', color: '#FF5722', category: 'asset', description: 'MOV Video' },
  'mkv': { icon: '🎬', color: '#FF5722', category: 'asset', description: 'MKV Video' },
  // Archives
  'zip': { icon: '🗜️', color: '#FFC107', category: 'other', description: 'ZIP Archive' },
  'rar': { icon: '🗜️', color: '#FFC107', category: 'other', description: 'RAR Archive' },
  '7z': { icon: '🗜️', color: '#FFC107', category: 'other', description: '7-Zip Archive' },
  'tar': { icon: '🗜️', color: '#FFC107', category: 'other', description: 'TAR Archive' },
  'gz': { icon: '🗜️', color: '#FFC107', category: 'other', description: 'Gzip Archive' },
  'bz2': { icon: '🗜️', color: '#FFC107', category: 'other', description: 'Bzip2 Archive' },
  'xz': { icon: '🗜️', color: '#FFC107', category: 'other', description: 'XZ Archive' },
  // Build and package files
  'dockerfile': { icon: '🐳', color: '#2496ED', category: 'config', description: 'Docker Configuration' },
  'makefile': { icon: '🔨', color: '#427819', category: 'build', description: 'Makefile' },
  'cmake': { icon: '🔨', color: '#064F8C', category: 'build', description: 'CMake File' },
  'gradle': { icon: '🐘', color: '#02303A', category: 'build', description: 'Gradle Build' },
  'pom': { icon: '📦', color: '#C71A36', category: 'build', description: 'Maven POM' },
  'lock': { icon: '🔒', color: '#6C757D', category: 'build', description: 'Lock File' },
  'log': { icon: '📜', color: '#6C757D', category: 'other', description: 'Log File' },
  // Test files
  'test': { icon: '🧪', color: '#28A745', category: 'test', description: 'Test File' },
  'spec': { icon: '🧪', color: '#28A745', category: 'test', description: 'Spec File' },
  // Special files
  'gitkeep': { icon: '📍', color: '#F05032', category: 'config', description: 'Git Keep File' },
  'editorconfig': { icon: '⚙️', color: '#FEFEFE', category: 'config', description: 'Editor Configuration' },
  'nvmrc': { icon: '💚', color: '#339933', category: 'config', description: 'Node Version' },
  'node-version': { icon: '💚', color: '#339933', category: 'config', description: 'Node Version' },
  'browserslistrc': { icon: '🌐', color: '#FF6B35', category: 'config', description: 'Browserslist Config' },
};
// Special filename mappings (full filename matches)
const SPECIAL_FILES: Record<string, FileIconConfig> = {
  'package.json': { icon: '📦', color: '#CB3837', category: 'config', description: 'NPM Package' },
  'package-lock.json': { icon: '🔒', color: '#CB3837', category: 'build', description: 'NPM Lock File' },
  'yarn.lock': { icon: '🧶', color: '#2C8EBB', category: 'build', description: 'Yarn Lock File' },
  'pnpm-lock.yaml': { icon: '📦', color: '#F69220', category: 'build', description: 'PNPM Lock File' },
  'composer.json': { icon: '🎼', color: '#885630', category: 'config', description: 'Composer Package' },
  'composer.lock': { icon: '🔒', color: '#885630', category: 'build', description: 'Composer Lock' },
  'requirements.txt': { icon: '📋', color: '#3776AB', category: 'config', description: 'Python Requirements' },
  'pipfile': { icon: '🐍', color: '#3776AB', category: 'config', description: 'Pipenv File' },
  'pipfile.lock': { icon: '🔒', color: '#3776AB', category: 'build', description: 'Pipenv Lock' },
  'cargo.toml': { icon: '🦀', color: '#CE422B', category: 'config', description: 'Cargo Package' },
  'cargo.lock': { icon: '🔒', color: '#CE422B', category: 'build', description: 'Cargo Lock' },
  'go.mod': { icon: '🐹', color: '#00ADD8', category: 'config', description: 'Go Module' },
  'go.sum': { icon: '🔒', color: '#00ADD8', category: 'build', description: 'Go Checksum' },
  'tsconfig.json': { icon: '🔧', color: '#3178C6', category: 'config', description: 'TypeScript Config' },
  'jsconfig.json': { icon: '🔧', color: '#F7DF1E', category: 'config', description: 'JavaScript Config' },
  'webpack.config.js': { icon: '📦', color: '#8DD6F9', category: 'config', description: 'Webpack Config' },
  'vite.config.js': { icon: '⚡', color: '#646CFF', category: 'config', description: 'Vite Config' },
  'next.config.js': { icon: '▲', color: '#000000', category: 'config', description: 'Next.js Config' },
  'nuxt.config.js': { icon: '💚', color: '#00C58E', category: 'config', description: 'Nuxt.js Config' },
  'rollup.config.js': { icon: '📦', color: '#EC4A3F', category: 'config', description: 'Rollup Config' },
  'babel.config.js': { icon: '🐠', color: '#F9DC3E', category: 'config', description: 'Babel Config' },
  'jest.config.js': { icon: '🃏', color: '#C21325', category: 'config', description: 'Jest Config' },
  'vitest.config.js': { icon: '🧪', color: '#6E9F18', category: 'config', description: 'Vitest Config' },
  'cypress.config.js': { icon: '🌲', color: '#17202C', category: 'config', description: 'Cypress Config' },
  'playwright.config.js': { icon: '🎭', color: '#2EAD33', category: 'config', description: 'Playwright Config' },
  'tailwind.config.js': { icon: '💨', color: '#06B6D4', category: 'config', description: 'Tailwind Config' },
  'postcss.config.js': { icon: '📮', color: '#DD3A0A', category: 'config', description: 'PostCSS Config' },
  'readme.md': { icon: '📖', color: '#083FA1', category: 'documentation', description: 'README' },
  'changelog.md': { icon: '📋', color: '#28A745', category: 'documentation', description: 'Changelog' },
  'contributing.md': { icon: '🤝', color: '#6F42C1', category: 'documentation', description: 'Contributing Guide' },
  'license': { icon: '📜', color: '#FD7E14', category: 'documentation', description: 'License' },
  'dockerfile': { icon: '🐳', color: '#2496ED', category: 'config', description: 'Dockerfile' },
  'docker-compose.yml': { icon: '🐳', color: '#2496ED', category: 'config', description: 'Docker Compose' },
  'docker-compose.yaml': { icon: '🐳', color: '#2496ED', category: 'config', description: 'Docker Compose' },
  '.gitignore': { icon: '🚫', color: '#F05032', category: 'config', description: 'Git Ignore' },
  '.gitattributes': { icon: '📄', color: '#F05032', category: 'config', description: 'Git Attributes' },
  '.env': { icon: '🔐', color: '#EF4444', category: 'config', description: 'Environment Variables' },
  '.env.local': { icon: '🔐', color: '#EF4444', category: 'config', description: 'Local Environment' },
  '.env.example': { icon: '🔐', color: '#6C757D', category: 'config', description: 'Environment Template' },
  '.eslintrc.js': { icon: '🔍', color: '#4B32C3', category: 'config', description: 'ESLint Config' },
  '.eslintrc.json': { icon: '🔍', color: '#4B32C3', category: 'config', description: 'ESLint Config' },
  '.prettierrc': { icon: '💅', color: '#F7B93E', category: 'config', description: 'Prettier Config' },
  '.prettierrc.json': { icon: '💅', color: '#F7B93E', category: 'config', description: 'Prettier Config' },
  '.editorconfig': { icon: '⚙️', color: '#FEFEFE', category: 'config', description: 'Editor Config' },
  '.nvmrc': { icon: '💚', color: '#339933', category: 'config', description: 'Node Version' },
  '.node-version': { icon: '💚', color: '#339933', category: 'config', description: 'Node Version' },
  '.browserslistrc': { icon: '🌐', color: '#FF6B35', category: 'config', description: 'Browserslist' },
  'makefile': { icon: '🔨', color: '#427819', category: 'build', description: 'Makefile' },
  'dockerfile': { icon: '🐳', color: '#2496ED', category: 'config', description: 'Dockerfile' },
};
// Folder icons
const FOLDER_ICONS: Record<string, FileIconConfig> = {
  'src': { icon: '📁', color: '#007ACC', category: 'source', description: 'Source Code' },
  'lib': { icon: '📚', color: '#FF6B35', category: 'source', description: 'Library Code' },
  'components': { icon: '🧩', color: '#61DAFB', category: 'source', description: 'UI Components' },
  'pages': { icon: '📄', color: '#FF6B35', category: 'source', description: 'Page Components' },
  'views': { icon: '👁️', color: '#FF6B35', category: 'source', description: 'View Components' },
  'layouts': { icon: '🏗️', color: '#FF6B35', category: 'source', description: 'Layout Components' },
  'hooks': { icon: '🪝', color: '#61DAFB', category: 'source', description: 'React Hooks' },
  'utils': { icon: '🔧', color: '#FFC107', category: 'source', description: 'Utility Functions' },
  'helpers': { icon: '🤝', color: '#FFC107', category: 'source', description: 'Helper Functions' },
  'services': { icon: '⚙️', color: '#28A745', category: 'source', description: 'Service Layer' },
  'api': { icon: '🔌', color: '#DC3545', category: 'source', description: 'API Routes' },
  'types': { icon: '🏷️', color: '#3178C6', category: 'source', description: 'Type Definitions' },
  'interfaces': { icon: '🔗', color: '#3178C6', category: 'source', description: 'Interfaces' },
  'models': { icon: '🗃️', color: '#6F42C1', category: 'source', description: 'Data Models' },
  'schemas': { icon: '📋', color: '#6F42C1', category: 'source', description: 'Data Schemas' },
  'config': { icon: '⚙️', color: '#6C757D', category: 'config', description: 'Configuration' },
  'configs': { icon: '⚙️', color: '#6C757D', category: 'config', description: 'Configuration' },
  'settings': { icon: '⚙️', color: '#6C757D', category: 'config', description: 'Settings' },
  'constants': { icon: '🔒', color: '#FD7E14', category: 'source', description: 'Constants' },
  'assets': { icon: '🎨', color: '#E91E63', category: 'asset', description: 'Static Assets' },
  'images': { icon: '🖼️', color: '#FF69B4', category: 'asset', description: 'Image Files' },
  'icons': { icon: '🎨', color: '#FF69B4', category: 'asset', description: 'Icon Files' },
  'fonts': { icon: '🔤', color: '#9C27B0', category: 'asset', description: 'Font Files' },
  'styles': { icon: '🎨', color: '#1572B6', category: 'source', description: 'Style Files' },
  'css': { icon: '🎨', color: '#1572B6', category: 'source', description: 'CSS Files' },
  'scss': { icon: '🎨', color: '#CF649A', category: 'source', description: 'SCSS Files' },
  'sass': { icon: '🎨', color: '#CF649A', category: 'source', description: 'Sass Files' },
  'public': { icon: '🌐', color: '#FFC107', category: 'asset', description: 'Public Assets' },
  'static': { icon: '📄', color: '#6C757D', category: 'asset', description: 'Static Files' },
  'docs': { icon: '📚', color: '#007ACC', category: 'documentation', description: 'Documentation' },
  'documentation': { icon: '📚', color: '#007ACC', category: 'documentation', description: 'Documentation' },
  'tests': { icon: '🧪', color: '#28A745', category: 'test', description: 'Test Files' },
  'test': { icon: '🧪', color: '#28A745', category: 'test', description: 'Test Files' },
  '__tests__': { icon: '🧪', color: '#28A745', category: 'test', description: 'Jest Tests' },
  'spec': { icon: '🧪', color: '#28A745', category: 'test', description: 'Spec Files' },
  'cypress': { icon: '🌲', color: '#17202C', category: 'test', description: 'Cypress Tests' },
  'e2e': { icon: '🔗', color: '#28A745', category: 'test', description: 'E2E Tests' },
  'build': { icon: '🏗️', color: '#FD7E14', category: 'build', description: 'Build Output' },
  'dist': { icon: '📦', color: '#FD7E14', category: 'build', description: 'Distribution' },
  'out': { icon: '📤', color: '#FD7E14', category: 'build', description: 'Output Files' },
  'coverage': { icon: '📊', color: '#28A745', category: 'test', description: 'Test Coverage' },
  'node_modules': { icon: '📦', color: '#CB3837', category: 'build', description: 'Dependencies' },
  '.git': { icon: '🌿', color: '#F05032', category: 'config', description: 'Git Repository' },
  '.github': { icon: '🐙', color: '#181717', category: 'config', description: 'GitHub Config' },
  '.vscode': { icon: '💙', color: '#007ACC', category: 'config', description: 'VS Code Config' },
  '.idea': { icon: '💡', color: '#000000', category: 'config', description: 'IntelliJ Config' },
  'scripts': { icon: '📜', color: '#89E051', category: 'build', description: 'Build Scripts' },
  'tools': { icon: '🔨', color: '#FFC107', category: 'build', description: 'Development Tools' },
  'bin': { icon: '⚙️', color: '#6C757D', category: 'build', description: 'Binary Files' },
  'vendor': { icon: '📦', color: '#6C757D', category: 'build', description: 'Vendor Libraries' },
  'migrations': { icon: '🔄', color: '#6F42C1', category: 'data', description: 'Database Migrations' },
  'seeds': { icon: '🌱', color: '#28A745', category: 'data', description: 'Database Seeds' },
  'database': { icon: '🗄️', color: '#336791', category: 'data', description: 'Database Files' },
  'storage': { icon: '💾', color: '#6C757D', category: 'data', description: 'Storage Files' },
  'logs': { icon: '📜', color: '#6C757D', category: 'other', description: 'Log Files' },
  'tmp': { icon: '🗂️', color: '#6C757D', category: 'other', description: 'Temporary Files' },
  'temp': { icon: '🗂️', color: '#6C757D', category: 'other', description: 'Temporary Files' },
  'cache': { icon: '⚡', color: '#FFC107', category: 'other', description: 'Cache Files' },
};
export class FileIconService {
  static getFileIcon(filename: string): FileIconConfig {
    const lowerFilename = filename.toLowerCase();
    // Check special filenames first
    if (SPECIAL_FILES[lowerFilename]) {
      return SPECIAL_FILES[lowerFilename];
    }
    // Check if it's a test file by filename pattern
    if (lowerFilename.includes('.test.') || lowerFilename.includes('.spec.')) {
      return { icon: '🧪', color: '#28A745', category: 'test', description: 'Test File' };
    }
    // Check by extension
    const extension = this.getFileExtension(filename);
    if (extension && FILE_ICON_MAP[extension]) {
      return FILE_ICON_MAP[extension];
    }
    // Default file icon
    return { icon: '📄', color: '#6C757D', category: 'other', description: 'Unknown File' };
  }
  static getFolderIcon(folderName: string): FileIconConfig {
    const lowerFolderName = folderName.toLowerCase();
    if (FOLDER_ICONS[lowerFolderName]) {
      return FOLDER_ICONS[lowerFolderName];
    }
    // Check for common patterns
    if (lowerFolderName.includes('test') || lowerFolderName.includes('spec')) {
      return { icon: '🧪', color: '#28A745', category: 'test', description: 'Test Directory' };
    }
    if (lowerFolderName.includes('component')) {
      return { icon: '🧩', color: '#61DAFB', category: 'source', description: 'Components' };
    }
    if (lowerFolderName.includes('config')) {
      return { icon: '⚙️', color: '#6C757D', category: 'config', description: 'Configuration' };
    }
    if (lowerFolderName.includes('util')) {
      return { icon: '🔧', color: '#FFC107', category: 'source', description: 'Utilities' };
    }
    // Default folder icon
    return { icon: '📁', color: '#FFC107', category: 'other', description: 'Folder' };
  }
  static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length < 2) return '';
    const extension = parts[parts.length - 1].toLowerCase();
    // Handle compound extensions
    if (parts.length >= 3) {
      const compound = `${parts[parts.length - 2]}.${extension}`;
      if (FILE_ICON_MAP[compound]) {
        return compound;
      }
    }
    return extension;
  }
  static isCodeFile(filename: string): boolean {
    const config = this.getFileIcon(filename);
    return config.category === 'source';
  }
  static isConfigFile(filename: string): boolean {
    const config = this.getFileIcon(filename);
    return config.category === 'config';
  }
  static isTestFile(filename: string): boolean {
    const config = this.getFileIcon(filename);
    return config.category === 'test';
  }
  static groupFilesByCategory(filenames: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    filenames.forEach(filename => {
      const config = this.getFileIcon(filename);
      if (!groups[config.category]) {
        groups[config.category] = [];
      }
      groups[config.category].push(filename);
    });
    return groups;
  }
  static getCategories(): string[] {
    return ['source', 'config', 'documentation', 'asset', 'data', 'build', 'test', 'other'];
  }
  static searchFiles(filenames: string[], pattern: string): Array<{filename: string, icon: FileIconConfig}> {
    const regex = new RegExp(pattern, 'i');
    return filenames
      .filter(filename => regex.test(filename))
      .map(filename => ({
        filename,
        icon: this.getFileIcon(filename)
      }));
  }
}