#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const srcDir = '/home/nricoatarini/Project-Workspace/Context-Pipeline/src';
const rootDir = '/home/nricoatarini/Project-Workspace/Context-Pipeline';
const excludePaths = [
  'node_modules',
  '.next',
  'storage',
  '.git'
];

// File patterns
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
const testExtensions = ['.test.ts', '.test.tsx', '.test.js', '.spec.ts'];

function getAllFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    
    // Skip excluded paths
    if (excludePaths.some(exclude => fullPath.includes(exclude))) {
      continue;
    }
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (sourceExtensions.some(ext => fullPath.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function getImportsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];
    
    // Match import statements
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Only track relative imports (internal files)
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        imports.push(importPath);
      }
    }
    
    // Also check for dynamic imports
    const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        imports.push(importPath);
      }
    }
    
    // Check for require statements
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        imports.push(importPath);
      }
    }
    
    return imports;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return [];
  }
}

function resolveImportPath(importPath, currentFile) {
  let resolvedPath = importPath;
  
  // Handle relative imports
  if (importPath.startsWith('.')) {
    resolvedPath = path.resolve(path.dirname(currentFile), importPath);
  }
  
  // Try different extensions if no extension provided
  if (!sourceExtensions.some(ext => resolvedPath.endsWith(ext))) {
    for (const ext of sourceExtensions) {
      const withExt = resolvedPath + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }
    
    // Try index files
    for (const ext of sourceExtensions) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }
  }
  
  return resolvedPath;
}

function analyzeFiles() {
  console.log('🔍 Analyzing file imports and usage...\n');
  
  const allFiles = getAllFiles(rootDir);
  const srcFiles = allFiles.filter(f => f.startsWith(srcDir));
  const fileUsage = new Map();
  
  // Initialize usage map
  for (const file of srcFiles) {
    fileUsage.set(file, {
      imports: [],
      importedBy: [],
      type: getFileType(file),
      size: fs.statSync(file).size
    });
  }
  
  // Analyze imports
  for (const file of allFiles) {
    const imports = getImportsFromFile(file);
    
    for (const importPath of imports) {
      const resolvedPath = resolveImportPath(importPath, file);
      
      if (fileUsage.has(resolvedPath)) {
        fileUsage.get(resolvedPath).importedBy.push(file);
        
        if (srcFiles.includes(file)) {
          fileUsage.get(file).imports.push(resolvedPath);
        }
      }
    }
  }
  
  return { allFiles: srcFiles, fileUsage };
}

function getFileType(filePath) {
  const fileName = path.basename(filePath);
  const relativePath = path.relative(srcDir, filePath);
  
  if (fileName.endsWith('.old.ts') || fileName.endsWith('.old.tsx')) {
    return 'backup';
  }
  
  if (testExtensions.some(ext => fileName.includes(ext))) {
    return 'test';
  }
  
  if (relativePath.includes('/test/') || relativePath.includes('__tests__')) {
    return 'test';
  }
  
  if (fileName.startsWith('test-') || fileName.includes('.test.')) {
    return 'test';
  }
  
  if (relativePath.includes('/api/')) {
    return 'api-route';
  }
  
  if (fileName === 'route.ts' || fileName === 'route.tsx') {
    return 'api-route';
  }
  
  if (fileName === 'page.tsx' || fileName === 'layout.tsx') {
    return 'next-page';
  }
  
  if (fileName.endsWith('.tsx')) {
    return 'component';
  }
  
  if (fileName.endsWith('.ts')) {
    if (relativePath.includes('/types/')) {
      return 'types';
    }
    if (relativePath.includes('/services/')) {
      return 'service';
    }
    if (relativePath.includes('/utils/')) {
      return 'utility';
    }
    if (relativePath.includes('/hooks/')) {
      return 'hook';
    }
    return 'module';
  }
  
  return 'unknown';
}

function categorizeOrphans(fileUsage) {
  const orphans = [];
  
  for (const [filePath, usage] of fileUsage.entries()) {
    if (usage.importedBy.length === 0) {
      const safetyLevel = getSafetyLevel(filePath, usage);
      orphans.push({
        filePath,
        ...usage,
        safetyLevel
      });
    }
  }
  
  return orphans.sort((a, b) => {
    const safetyOrder = { 'SAFE': 4, 'PROBABLY_SAFE': 3, 'RISKY': 2, 'KEEP': 1 };
    return safetyOrder[b.safetyLevel] - safetyOrder[a.safetyLevel];
  });
}

function getSafetyLevel(filePath, usage) {
  const fileName = path.basename(filePath);
  const relativePath = path.relative(srcDir, filePath);
  
  // SAFE TO DELETE - Very high confidence
  if (usage.type === 'backup') {
    return 'SAFE';
  }
  
  if (usage.type === 'test' && !relativePath.includes('cypress')) {
    return 'SAFE';
  }
  
  if (fileName.includes('.old.') || fileName.includes('.backup.')) {
    return 'SAFE';
  }
  
  // PROBABLY SAFE - High confidence but some risk
  if (usage.type === 'test') {
    return 'PROBABLY_SAFE';
  }
  
  if (fileName.startsWith('temp-') || fileName.includes('temp')) {
    return 'PROBABLY_SAFE';
  }
  
  if (fileName.includes('unused') || fileName.includes('deprecated')) {
    return 'PROBABLY_SAFE';
  }
  
  // RISKY - Might be needed
  if (usage.type === 'api-route') {
    return 'RISKY'; // API routes might be called by external clients
  }
  
  if (usage.type === 'next-page') {
    return 'RISKY'; // Pages might be accessed directly via URL
  }
  
  if (usage.type === 'component' && fileName.includes('Modal')) {
    return 'RISKY'; // Modals might be dynamically imported
  }
  
  if (usage.type === 'types') {
    return 'RISKY'; // Type files might be imported in ways we can't detect
  }
  
  // KEEP - Default to keeping files we're unsure about
  return 'KEEP';
}

function getEvidenceForOrphan(filePath, usage) {
  const evidence = [];
  const fileName = path.basename(filePath);
  const relativePath = path.relative(srcDir, filePath);
  
  if (usage.type === 'backup') {
    evidence.push('✅ Clear backup file (.old extension)');
  }
  
  if (usage.type === 'test') {
    evidence.push('✅ Test file - safe to remove if not needed');
  }
  
  if (usage.type === 'api-route') {
    evidence.push('⚠️ API route - might be called externally');
  }
  
  if (usage.type === 'next-page') {
    evidence.push('⚠️ Next.js page - might be accessed via URL');
  }
  
  if (fileName.includes('unused') || fileName.includes('deprecated')) {
    evidence.push('✅ Filename suggests intentionally unused');
  }
  
  if (usage.size === 0) {
    evidence.push('✅ Empty file');
  }
  
  if (usage.size < 100) {
    evidence.push('ℹ️ Very small file (' + usage.size + ' bytes)');
  }
  
  // Check for common patterns that indicate the file might still be needed
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('export default')) {
      evidence.push('⚠️ Has default export - might be dynamically imported');
    }
    
    if (content.includes('export {') || content.includes('export const') || content.includes('export function')) {
      evidence.push('⚠️ Has named exports - might be selectively imported');
    }
    
    if (content.includes('// TODO') || content.includes('// FIXME')) {
      evidence.push('⚠️ Has TODO/FIXME comments - work in progress');
    }
    
    if (content.includes('future') || content.includes('planned')) {
      evidence.push('⚠️ Comments mention future/planned use');
    }
    
    if (content.length < 50 && content.trim().length === 0) {
      evidence.push('✅ Empty or whitespace-only file');
    }
    
  } catch (error) {
    evidence.push('❌ Could not read file content');
  }
  
  if (evidence.length === 0) {
    evidence.push('❓ No clear evidence either way');
  }
  
  return evidence;
}

function generateReport(orphans, fileUsage) {
  console.log('📊 ORPHANED COMPONENTS ANALYSIS REPORT');
  console.log('=' .repeat(60) + '\n');
  
  console.log(`Total files analyzed: ${fileUsage.size}`);
  console.log(`Orphaned files found: ${orphans.length}\n`);
  
  // Summary by safety level
  const bySafety = orphans.reduce((acc, orphan) => {
    acc[orphan.safetyLevel] = (acc[orphan.safetyLevel] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📈 SUMMARY BY SAFETY LEVEL:');
  console.log(`   SAFE TO DELETE: ${bySafety.SAFE || 0} files`);
  console.log(`   PROBABLY SAFE:  ${bySafety.PROBABLY_SAFE || 0} files`);
  console.log(`   RISKY:          ${bySafety.RISKY || 0} files`);
  console.log(`   KEEP:           ${bySafety.KEEP || 0} files\n`);
  
  // Detailed analysis by category
  for (const safetyLevel of ['SAFE', 'PROBABLY_SAFE', 'RISKY', 'KEEP']) {
    const filesInCategory = orphans.filter(o => o.safetyLevel === safetyLevel);
    
    if (filesInCategory.length === 0) continue;
    
    const icon = {
      'SAFE': '🟢',
      'PROBABLY_SAFE': '🟡', 
      'RISKY': '🟠',
      'KEEP': '🔴'
    }[safetyLevel];
    
    console.log(`${icon} ${safetyLevel} (${filesInCategory.length} files):`);
    console.log('-'.repeat(40));
    
    for (const orphan of filesInCategory) {
      const relativePath = path.relative(rootDir, orphan.filePath);
      console.log(`\n📁 ${relativePath}`);
      console.log(`   Type: ${orphan.type}`);
      console.log(`   Size: ${orphan.size} bytes`);
      console.log(`   Import count: ${orphan.imports.length}`);
      
      const evidence = getEvidenceForOrphan(orphan.filePath, orphan);
      console.log(`   Evidence:`);
      for (const item of evidence) {
        console.log(`     ${item}`);
      }
      
      // Show potential dependencies that would also become orphaned
      const dependentOrphans = orphan.imports.filter(importPath => {
        const importUsage = fileUsage.get(importPath);
        return importUsage && importUsage.importedBy.length === 1 && importUsage.importedBy[0] === orphan.filePath;
      });
      
      if (dependentOrphans.length > 0) {
        console.log(`   ⚠️ Would also orphan ${dependentOrphans.length} dependencies:`);
        for (const dep of dependentOrphans.slice(0, 3)) {
          console.log(`     - ${path.relative(rootDir, dep)}`);
        }
        if (dependentOrphans.length > 3) {
          console.log(`     ... and ${dependentOrphans.length - 3} more`);
        }
      }
    }
    
    console.log('\n');
  }
  
  // Generate deletion recommendations
  console.log('💡 DELETION RECOMMENDATIONS:');
  console.log('=' .repeat(40));
  
  const safeFiles = orphans.filter(o => o.safetyLevel === 'SAFE');
  const probablySafeFiles = orphans.filter(o => o.safetyLevel === 'PROBABLY_SAFE');
  
  if (safeFiles.length > 0) {
    console.log(`\n🟢 IMMEDIATE DELETION (${safeFiles.length} files):`);
    console.log('These files can be safely deleted with very low risk:');
    for (const file of safeFiles) {
      console.log(`   rm "${file.filePath}"`);
    }
  }
  
  if (probablySafeFiles.length > 0) {
    console.log(`\n🟡 REVIEW AND DELETE (${probablySafeFiles.length} files):`);
    console.log('Review these files and delete if confirmed unused:');
    for (const file of probablySafeFiles) {
      console.log(`   # Review: ${path.relative(rootDir, file.filePath)}`);
    }
  }
  
  console.log('\n⚠️ IMPORTANT NOTES:');
  console.log('- This analysis only detects static imports');
  console.log('- Dynamic imports and external references may not be detected');
  console.log('- API routes might be called by external clients');
  console.log('- Always test functionality after deletion');
  console.log('- Consider running your test suite before and after deletion');
}

// Main execution
function main() {
  try {
    const { allFiles, fileUsage } = analyzeFiles();
    const orphans = categorizeOrphans(fileUsage);
    generateReport(orphans, fileUsage);
    
    // Save detailed results to JSON for further analysis
    const results = {
      timestamp: new Date().toISOString(),
      totalFiles: allFiles.length,
      orphanedFiles: orphans.length,
      orphans: orphans.map(o => ({
        path: path.relative(rootDir, o.filePath),
        type: o.type,
        safetyLevel: o.safetyLevel,
        size: o.size,
        imports: o.imports.length,
        evidence: getEvidenceForOrphan(o.filePath, o)
      }))
    };
    
    const outputFile = path.join(rootDir, 'analysis/orphan-analysis.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${path.relative(rootDir, outputFile)}`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeFiles, categorizeOrphans, getSafetyLevel };