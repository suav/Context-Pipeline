#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
class CleanupAgent {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      branches: {},
      totalFilesAnalyzed: 0,
      obsoleteFilesRemoved: 0,
      deadCodeRemoved: 0,
      duplicatesRemoved: 0,
      spaceSaved: 0,
      cleanupActions: []
    };
    this.obsoletePatterns = {
      // Old import patterns
      deprecatedImports: [
        /import.*from ['"][^'"]*\/old\/.*['"];?/g,
        /require\(['"][^'"]*\/deprecated\/.*['"]\);?/g,
        /import.*from ['"]react-dom\/client['"];?/g // Keep this one, this is actually current
      ],
      // Unused utility functions
      unusedUtilities: [
        /function\s+unused\w*\s*\([^)]*\)\s*{[^}]*}/g,
        /const\s+unused\w*\s*=\s*[^;]+;/g,
        /export\s+function\s+deprecated\w*\s*\([^)]*\)\s*{[^}]*}/g
      ],
      // Old console statements (non-security related)
      debugConsole: [
        /console\.debug\([^)]*\);?/g,
        /console\.trace\([^)]*\);?/g,
        /\/\* DEBUG:.*?\*\//gs,
        /\/\/ DEBUG:.*$/gm
      ],
      // Commented out code blocks
      commentedCode: [
        /\/\*[\s\S]*?\*\/\s*(?=\n\s*\/\*|\n\s*$|\n\s*[a-zA-Z])/g, // Multi-line comment blocks
        /\/\/.*TODO.*$/gm,
        /\/\/.*FIXME.*$/gm,
        /\/\/.*HACK.*$/gm
      ],
      // Old test artifacts
      testArtifacts: [
        /describe\.skip\([^)]*\)\s*{[^}]*}/g,
        /it\.skip\([^)]*\)\s*{[^}]*}/g,
        /test\.skip\([^)]*\)\s*{[^}]*}/g,
        /\/\*\s*test\s*\*\/.*$/gm
      ]
    };
    this.duplicateDetection = {
      // Common duplicated utility patterns
      utilityFunctions: [
        /function\s+(\w+)\s*\([^)]*\)\s*{([^}]*)}/g,
        /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*{([^}]*)}/g,
        /export\s+const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*{([^}]*)}/g
      ],
      // Type definitions
      typeDefinitions: [
        /interface\s+(\w+)\s*{([^}]*)}/g,
        /type\s+(\w+)\s*=\s*{([^}]*)}/g,
        /enum\s+(\w+)\s*{([^}]*)}/g
      ]
    };
    this.obsoleteFiles = [
      // Common obsolete file patterns
      /.*\.backup$/,
      /.*\.old$/,
      /.*\.deprecated$/,
      /.*\.unused$/,
      /.*~$/,
      /.*\.tmp$/,
      /.*\.bak$/,
      // Development artifacts
      /.*\.orig$/,
      /.*\.rej$/,
      /.*\.swp$/,
      /.*\.swo$/,
      // Old build artifacts
      /.*\.map\.old$/,
      /build-\d+/,
      /dist-backup/
    ];
  }
  async cleanupBranch(branchName) {
    console.log(`\n🧹 Cleaning up branch: ${branchName}`);
    const branchResults = {
      branch: branchName,
      filesAnalyzed: 0,
      obsoleteFilesRemoved: 0,
      deadCodeRemoved: 0,
      duplicatesRemoved: 0,
      filesModified: [],
      filesRemoved: [],
      cleanupActions: [],
      spaceSaved: 0
    };
    try {
      // Checkout branch
      await execAsync(`git checkout ${branchName}`);
      // Get all files in the branch
      const { stdout: allFiles } = await execAsync('find . -type f -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" | grep -v node_modules | grep -v .git | grep -v .next');
      const files = allFiles.split('\n').filter(f => f.trim());
      console.log(`  📁 Analyzing ${files.length} files...`);
      branchResults.filesAnalyzed = files.length;
      // Step 1: Remove obsolete files
      await this.removeObsoleteFiles(files, branchResults);
      // Step 2: Clean up code in remaining files
      const remainingFiles = files.filter(f => !branchResults.filesRemoved.includes(f));
      for (const filePath of remainingFiles) {
        if (fs.existsSync(filePath) && this.shouldCleanFile(filePath)) {
          await this.cleanFile(filePath, branchResults);
        }
      }
      // Step 3: Detect and remove duplicates
      await this.removeDuplicates(remainingFiles, branchResults);
      // Step 4: Optimize imports and dependencies
      await this.optimizeImports(branchResults);
      // Store results
      this.results.branches[branchName] = branchResults;
      console.log(`  ✅ Cleanup complete`);
      console.log(`     Files Analyzed: ${branchResults.filesAnalyzed}`);
      console.log(`     Obsolete Files Removed: ${branchResults.obsoleteFilesRemoved}`);
      console.log(`     Dead Code Removed: ${branchResults.deadCodeRemoved}`);
      console.log(`     Duplicates Removed: ${branchResults.duplicatesRemoved}`);
      console.log(`     Space Saved: ${(branchResults.spaceSaved / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error(`❌ Error cleaning branch ${branchName}:`, error.message);
    }
    return branchResults;
  }
  async removeObsoleteFiles(files, branchResults) {
    console.log('    🗑️ Removing obsolete files...');
    for (const filePath of files) {
      try {
        // Check if file matches obsolete patterns
        const isObsolete = this.obsoleteFiles.some(pattern => pattern.test(filePath));
        if (isObsolete) {
          const stats = fs.statSync(filePath);
          const fileSize = stats.size;
          fs.unlinkSync(filePath);
          branchResults.filesRemoved.push(filePath);
          branchResults.obsoleteFilesRemoved++;
          branchResults.spaceSaved += fileSize;
          branchResults.cleanupActions.push({
            type: 'file_removal',
            file: filePath,
            reason: 'Obsolete file pattern',
            spaceSaved: fileSize
          });
          console.log(`      🗑️ Removed obsolete file: ${filePath}`);
        }
        // Check for empty or near-empty files
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          const meaningfulLines = content.split('\n').filter(line =>
            line.trim() &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('/*') &&
            !line.trim().startsWith('*')
          ).length;
          if (meaningfulLines <= 2 && content.length < 100) {
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            fs.unlinkSync(filePath);
            branchResults.filesRemoved.push(filePath);
            branchResults.obsoleteFilesRemoved++;
            branchResults.spaceSaved += fileSize;
            branchResults.cleanupActions.push({
              type: 'file_removal',
              file: filePath,
              reason: 'Empty or near-empty file',
              spaceSaved: fileSize
            });
            console.log(`      🗑️ Removed empty file: ${filePath}`);
          }
        }
      } catch (error) {
        console.error(`      ❌ Error processing ${filePath}:`, error.message);
      }
    }
  }
  shouldCleanFile(filePath) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md'];
    const excludePaths = ['node_modules/', '.git/', '.next/', 'dist/', 'build/'];
    const hasValidExtension = extensions.some(ext => filePath.endsWith(ext));
    const isNotExcluded = !excludePaths.some(exclude => filePath.includes(exclude));
    return hasValidExtension && isNotExcluded;
  }
  async cleanFile(filePath, branchResults) {
    try {
      const originalContent = fs.readFileSync(filePath, 'utf8');
      const originalSize = originalContent.length;
      let modifiedContent = originalContent;
      let fileModified = false;
      let cleanupCount = 0;
      // Apply each cleanup pattern
      for (const [categoryName, patterns] of Object.entries(this.obsoletePatterns)) {
        for (const pattern of patterns) {
          const beforeLength = modifiedContent.length;
          modifiedContent = modifiedContent.replace(pattern, '');
          const afterLength = modifiedContent.length;
          if (beforeLength !== afterLength) {
            fileModified = true;
            cleanupCount++;
            branchResults.cleanupActions.push({
              type: 'code_cleanup',
              file: filePath,
              category: categoryName,
              reason: `Removed obsolete ${categoryName}`,
              spaceSaved: beforeLength - afterLength
            });
          }
        }
      }
      // Remove excessive whitespace
      const beforeWhitespace = modifiedContent.length;
      modifiedContent = modifiedContent
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove triple+ newlines
        .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
        .replace(/^\s*\n/gm, '') // Remove empty lines at start
        .trim(); // Trim overall
      const afterWhitespace = modifiedContent.length;
      if (beforeWhitespace !== afterWhitespace) {
        fileModified = true;
        cleanupCount++;
        branchResults.cleanupActions.push({
          type: 'whitespace_cleanup',
          file: filePath,
          reason: 'Removed excessive whitespace',
          spaceSaved: beforeWhitespace - afterWhitespace
        });
      }
      // Write modified content if changes were made
      if (fileModified) {
        fs.writeFileSync(filePath, modifiedContent);
        branchResults.filesModified.push(filePath);
        branchResults.deadCodeRemoved += cleanupCount;
        branchResults.spaceSaved += originalSize - modifiedContent.length;
        console.log(`      🧹 Cleaned ${filePath} (${cleanupCount} items removed)`);
      }
    } catch (error) {
      console.error(`      ❌ Error cleaning ${filePath}:`, error.message);
    }
  }
  async removeDuplicates(files, branchResults) {
    console.log('    🔍 Detecting and removing duplicates...');
    const functionHashes = new Map();
    const typeHashes = new Map();
    for (const filePath of files) {
      if (!fs.existsSync(filePath) || !this.shouldCleanFile(filePath)) {
        continue;
      }
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Check for duplicate functions
        for (const pattern of this.duplicateDetection.utilityFunctions) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const functionName = match[1];
            const functionBody = match[2];
            const normalizedBody = functionBody.replace(/\s+/g, ' ').trim();
            if (functionHashes.has(normalizedBody)) {
              const existing = functionHashes.get(normalizedBody);
              // If this is a duplicate, comment it out
              if (existing.file !== filePath) {
                const modifiedContent = content.replace(match[0], `// Duplicate function removed: ${functionName} (see ${existing.file})`);
                fs.writeFileSync(filePath, modifiedContent);
                branchResults.duplicatesRemoved++;
                branchResults.spaceSaved += match[0].length;
                branchResults.cleanupActions.push({
                  type: 'duplicate_removal',
                  file: filePath,
                  reason: `Removed duplicate function: ${functionName}`,
                  original: existing.file,
                  spaceSaved: match[0].length
                });
                console.log(`      🔍 Removed duplicate function ${functionName} from ${filePath}`);
              }
            } else {
              functionHashes.set(normalizedBody, { file: filePath, name: functionName });
            }
          }
        }
        // Check for duplicate type definitions
        for (const pattern of this.duplicateDetection.typeDefinitions) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const typeName = match[1];
            const typeBody = match[2];
            const normalizedBody = typeBody.replace(/\s+/g, ' ').trim();
            if (typeHashes.has(normalizedBody)) {
              const existing = typeHashes.get(normalizedBody);
              if (existing.file !== filePath) {
                const modifiedContent = content.replace(match[0], `// Duplicate type removed: ${typeName} (see ${existing.file})`);
                fs.writeFileSync(filePath, modifiedContent);
                branchResults.duplicatesRemoved++;
                branchResults.spaceSaved += match[0].length;
                branchResults.cleanupActions.push({
                  type: 'duplicate_removal',
                  file: filePath,
                  reason: `Removed duplicate type: ${typeName}`,
                  original: existing.file,
                  spaceSaved: match[0].length
                });
                console.log(`      🔍 Removed duplicate type ${typeName} from ${filePath}`);
              }
            } else {
              typeHashes.set(normalizedBody, { file: filePath, name: typeName });
            }
          }
        }
      } catch (error) {
        console.error(`      ❌ Error checking duplicates in ${filePath}:`, error.message);
      }
    }
  }
  async optimizeImports(branchResults) {
    console.log('    📦 Optimizing imports...');
    // Find package.json files to check for unused dependencies
    const packageJsonFiles = [];
    try {
      const { stdout } = await execAsync('find . -name "package.json" -not -path "./node_modules/*"');
      packageJsonFiles.push(...stdout.split('\n').filter(f => f.trim()));
    } catch (error) {
      console.error('    ❌ Error finding package.json files:', error.message);
      return;
    }
    for (const packageFile of packageJsonFiles) {
      if (!fs.existsSync(packageFile)) continue;
      try {
        const packageContent = fs.readFileSync(packageFile, 'utf8');
        const packageJson = JSON.parse(packageContent);
        if (packageJson.dependencies) {
          // Check for obviously unused dependencies
          for (const dep of Object.keys(packageJson.dependencies)) {
            // Skip core dependencies
            if (['react', 'next', 'typescript'].includes(dep)) continue;
            try {
              // Search for usage of this dependency
              const { stdout } = await execAsync(`grep -r "import.*${dep}\\|require.*${dep}" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" || true`);
              if (!stdout.trim()) {
                unusedDeps.push(dep);
              }
            } catch (error) {
              // Dependency might be used, keep it
            }
          }
          if (unusedDeps.length > 0) {
            console.log(`      📦 Found potentially unused dependencies in ${packageFile}:`);
            unusedDeps.forEach(dep => {
              console.log(`        - ${dep}`);
            });
            branchResults.cleanupActions.push({
              type: 'unused_dependencies',
              file: packageFile,
              reason: 'Potentially unused dependencies found',
              dependencies: unusedDeps
            });
          }
        }
      } catch (error) {
        console.error(`      ❌ Error analyzing ${packageFile}:`, error.message);
      }
    }
  }
  async generateReport() {
    console.log('\n🧹 Generating Cleanup Report...');
    // Calculate overall metrics
    const branches = Object.values(this.results.branches);
    if (branches.length > 0) {
      this.results.totalFilesAnalyzed = branches.reduce((sum, b) => sum + b.filesAnalyzed, 0);
      this.results.obsoleteFilesRemoved = branches.reduce((sum, b) => sum + b.obsoleteFilesRemoved, 0);
      this.results.deadCodeRemoved = branches.reduce((sum, b) => sum + b.deadCodeRemoved, 0);
      this.results.duplicatesRemoved = branches.reduce((sum, b) => sum + b.duplicatesRemoved, 0);
      this.results.spaceSaved = branches.reduce((sum, b) => sum + b.spaceSaved, 0);
      this.results.cleanupActions = branches.flatMap(b => b.cleanupActions);
    }
    // Save detailed results
    const reportPath = 'analysis/cleanup-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync('analysis/CLEANUP_REPORT.md', markdownReport);
    console.log(`✅ Cleanup Report saved to ${reportPath}`);
    console.log(`📄 Markdown report saved to analysis/CLEANUP_REPORT.md`);
  }
  generateMarkdownReport() {
    const branches = Object.values(this.results.branches);
    let report = `# Cleanup Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;
    // Summary
    report += `## Cleanup Summary\n\n`;
    report += `| Metric | Count |\n`;
    report += `|--------|-------|\n`;
    report += `| Total Files Analyzed | ${this.results.totalFilesAnalyzed} |\n`;
    report += `| Obsolete Files Removed | ${this.results.obsoleteFilesRemoved} |\n`;
    report += `| Dead Code Segments Removed | ${this.results.deadCodeRemoved} |\n`;
    report += `| Duplicates Removed | ${this.results.duplicatesRemoved} |\n`;
    report += `| Space Saved | ${(this.results.spaceSaved / 1024).toFixed(2)} KB |\n`;
    report += `| Branches Cleaned | ${branches.length} |\n\n`;
    // Branch-by-branch results
    report += `## Branch Cleanup Results\n\n`;
    branches.forEach(branch => {
      report += `### ${branch.branch}\n\n`;
      report += `| Metric | Count |\n`;
      report += `|--------|-------|\n`;
      report += `| Files Analyzed | ${branch.filesAnalyzed} |\n`;
      report += `| Obsolete Files Removed | ${branch.obsoleteFilesRemoved} |\n`;
      report += `| Dead Code Removed | ${branch.deadCodeRemoved} |\n`;
      report += `| Duplicates Removed | ${branch.duplicatesRemoved} |\n`;
      report += `| Files Modified | ${branch.filesModified.length} |\n`;
      report += `| Space Saved | ${(branch.spaceSaved / 1024).toFixed(2)} KB |\n\n`;
      // Files removed
      if (branch.filesRemoved.length > 0) {
        report += `**Files Removed:**\n`;
        branch.filesRemoved.forEach(file => {
          report += `- 🗑️ ${file}\n`;
        });
        report += `\n`;
      }
      // Cleanup actions by category
      const actionsByType = branch.cleanupActions.reduce((acc, action) => {
        if (!acc[action.type]) acc[action.type] = [];
        acc[action.type].push(action);
        return acc;
      }, {});
      for (const [actionType, actions] of Object.entries(actionsByType)) {
        if (actions.length > 0) {
          report += `**${actionType.replace(/_/g, ' ').toUpperCase()}:**\n`;
          actions.slice(0, 10).forEach(action => { // Limit to top 10 per category
            report += `- 🧹 ${action.file}: ${action.reason}\n`;
            if (action.spaceSaved) {
              report += `  - Space saved: ${action.spaceSaved} bytes\n`;
            }
          });
          if (actions.length > 10) {
            report += `- ... and ${actions.length - 10} more\n`;
          }
          report += `\n`;
        }
      }
    });
    // Cleanup recommendations
    if (unusedDepActions.length > 0) {
      report += `## Dependency Cleanup Recommendations\n\n`;
      unusedDepActions.forEach(action => {
        report += `### ${action.file}\n\n`;
        report += `**Potentially unused dependencies:**\n`;
        action.dependencies.forEach(dep => {
          report += `- \`${dep}\`\n`;
        });
        report += `\n**Recommendation:** Review these dependencies and remove if truly unused.\n\n`;
        report += `\`\`\`bash\nnpm uninstall ${action.dependencies.join(' ')}\n\`\`\`\n\n`;
      });
    }
    // Overall recommendations
    report += `## Recommendations\n\n`;
    if (this.results.obsoleteFilesRemoved > 0) {
      report += `- ✅ **${this.results.obsoleteFilesRemoved} obsolete files** were automatically removed\n`;
    }
    if (this.results.deadCodeRemoved > 0) {
      report += `- ✅ **${this.results.deadCodeRemoved} dead code segments** were automatically cleaned\n`;
    }
    if (this.results.duplicatesRemoved > 0) {
      report += `- ✅ **${this.results.duplicatesRemoved} duplicate code blocks** were identified and removed\n`;
    }
    if (this.results.spaceSaved > 0) {
      report += `- 💾 **${(this.results.spaceSaved / 1024).toFixed(2)} KB** of disk space was recovered\n`;
    }
    report += `\n**Next Steps:**\n`;
    report += `1. Review the cleanup changes to ensure nothing important was removed\n`;
    report += `2. Test the application to verify functionality is preserved\n`;
    report += `3. Consider the dependency cleanup recommendations\n`;
    report += `4. Update documentation to reflect removed features/files\n`;
    report += `5. Run linting and formatting to ensure code style consistency\n\n`;
    return report;
  }
  async cleanup() {
    // Switch back to main branch
    try {
      await execAsync('git checkout main');
    } catch (error) {
      console.error('Failed to switch back to main branch:', error.message);
    }
  }
  async run() {
    const branches = [
      'feature/permissions-system',
      'feature/checkpoint-system',
      'feature/git-operations',
      'feature/context-import',
      'feature/ui-improvements'
    ];
    console.log('🧹 Cleanup Agent - Starting Code Cleanup...');
    try {
      for (const branch of branches) {
        await this.cleanupBranch(branch);
      }
      await this.generateReport();
      console.log('\n✅ Cleanup complete!');
      console.log(`📁 Files analyzed: ${this.results.totalFilesAnalyzed}`);
      console.log(`🗑️ Obsolete files removed: ${this.results.obsoleteFilesRemoved}`);
      console.log(`🧹 Dead code segments removed: ${this.results.deadCodeRemoved}`);
      console.log(`🔍 Duplicates removed: ${this.results.duplicatesRemoved}`);
      console.log(`💾 Space saved: ${(this.results.spaceSaved / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}
// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const cleaner = new CleanupAgent();
  if (args.includes('--help')) {
    console.log('Cleanup Agent');
    console.log('Usage:');
    console.log('  node cleanup-agent.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help          Show this help');
    console.log('');
    console.log('This agent identifies and removes obsolete code segments,');
    console.log('unused files, duplicates, and deprecated patterns.');
    return;
  }
  await cleaner.run();
}
// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
module.exports = CleanupAgent;