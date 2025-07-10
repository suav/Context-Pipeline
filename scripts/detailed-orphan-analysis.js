#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcDir = '/home/nricoatarini/Project-Workspace/Context-Pipeline/src';
const rootDir = '/home/nricoatarini/Project-Workspace/Context-Pipeline';

// Improved analysis with more conservative approach
function analyzeFiles() {
  console.log('🔍 CONSERVATIVE ORPHANED COMPONENTS ANALYSIS\n');
  console.log('Finding files with ZERO actual imports with high confidence...\n');
  
  const allFiles = getAllSourceFiles();
  const fileUsage = analyzeFileUsage(allFiles);
  const orphans = findTrueOrphans(fileUsage);
  
  return { allFiles, fileUsage, orphans };
}

function getAllSourceFiles() {
  const files = [];
  
  function walkDir(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !shouldSkipDir(fullPath)) {
          walkDir(fullPath);
        } else if (stat.isFile() && isSourceFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }
  }
  
  walkDir(rootDir);
  return files.filter(f => f.startsWith(srcDir));
}

function shouldSkipDir(dirPath) {
  const skipDirs = ['node_modules', '.next', '.git', 'storage', 'test'];
  return skipDirs.some(skip => dirPath.includes(skip));
}

function isSourceFile(filePath) {
  return /\.(ts|tsx|js|jsx)$/.test(filePath);
}

function analyzeFileUsage(allFiles) {
  const usage = new Map();
  
  // Initialize
  for (const file of allFiles) {
    usage.set(file, {
      importedBy: new Set(),
      imports: new Set(),
      type: classifyFile(file),
      content: readFileContent(file)
    });
  }
  
  // Find all imports
  for (const file of allFiles) {
    const imports = extractImports(file);
    const fileData = usage.get(file);
    
    for (const importPath of imports) {
      const resolved = resolveImport(importPath, file, allFiles);
      if (resolved && usage.has(resolved)) {
        usage.get(resolved).importedBy.add(file);
        fileData.imports.add(resolved);
      }
    }
  }
  
  return usage;
}

function classifyFile(filePath) {
  const name = path.basename(filePath);
  const relativePath = path.relative(srcDir, filePath);
  
  // High confidence classifications
  if (name.endsWith('.old.ts') || name.endsWith('.old.tsx') || name.includes('.backup.')) {
    return 'backup';
  }
  
  if (name.includes('.test.') || name.includes('.spec.') || relativePath.includes('/test/')) {
    return 'test';
  }
  
  if (name === 'route.ts' && relativePath.includes('/api/')) {
    return 'api-route';
  }
  
  if (name === 'page.tsx' || name === 'layout.tsx') {
    return 'next-page';
  }
  
  if (name.endsWith('.tsx') && !name.includes('test')) {
    return 'component';
  }
  
  if (relativePath.includes('/types/') && name.endsWith('.ts')) {
    return 'types';
  }
  
  return 'module';
}

function readFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      size: content.length,
      isEmpty: content.trim().length === 0,
      hasDefaultExport: /export\s+default/.test(content),
      hasNamedExports: /export\s+(const|function|class|interface|type|{)/.test(content),
      hasTodo: /\/\/(.*)(TODO|FIXME|HACK)/i.test(content),
      isNewCode: /created|new|placeholder|draft/i.test(content),
      content: content
    };
  } catch (error) {
    return { size: 0, isEmpty: true, error: error.message };
  }
}

function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];
    
    // More comprehensive import patterns
    const patterns = [
      /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g,  // Regular imports
      /import\(['"]([^'"]+)['"]\)/g,                            // Dynamic imports
      /require\(['"]([^'"]+)['"]\)/g,                           // Require
      /from\s+['"]([^'"]+)['"]/g,                              // Re-exports
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          imports.push(importPath);
        }
      }
    }
    
    return [...new Set(imports)]; // Remove duplicates
  } catch (error) {
    return [];
  }
}

function resolveImport(importPath, currentFile, allFiles) {
  const currentDir = path.dirname(currentFile);
  let resolved;
  
  if (importPath.startsWith('.')) {
    resolved = path.resolve(currentDir, importPath);
  } else if (importPath.startsWith('/')) {
    resolved = path.join(rootDir, importPath);
  } else {
    return null; // External import
  }
  
  // Try exact match first
  if (allFiles.includes(resolved)) {
    return resolved;
  }
  
  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (allFiles.includes(withExt)) {
      return withExt;
    }
  }
  
  // Try index files
  for (const ext of extensions) {
    const indexPath = path.join(resolved, `index${ext}`);
    if (allFiles.includes(indexPath)) {
      return indexPath;
    }
  }
  
  return null;
}

function findTrueOrphans(fileUsage) {
  const orphans = [];
  
  for (const [filePath, data] of fileUsage.entries()) {
    if (data.importedBy.size === 0) {
      const analysis = analyzeOrphan(filePath, data);
      orphans.push({
        filePath,
        ...data,
        analysis
      });
    }
  }
  
  // Sort by safety confidence
  return orphans.sort((a, b) => {
    const safetyOrder = { 
      'ABSOLUTELY_SAFE': 5, 
      'VERY_SAFE': 4, 
      'PROBABLY_SAFE': 3, 
      'RISKY': 2, 
      'KEEP': 1 
    };
    
    return (safetyOrder[b.analysis.safetyLevel] || 0) - (safetyOrder[a.analysis.safetyLevel] || 0);
  });
}

function analyzeOrphan(filePath, data) {
  const name = path.basename(filePath);
  const relativePath = path.relative(rootDir, filePath);
  const reasons = [];
  let safetyLevel = 'KEEP'; // Default to most conservative
  
  // ABSOLUTELY_SAFE - Zero risk deletions
  if (data.type === 'backup' && name.endsWith('.old.ts')) {
    safetyLevel = 'ABSOLUTELY_SAFE';
    reasons.push('✅ Clear backup file with .old extension');
  } else if (data.content.isEmpty || data.content.size < 10) {
    safetyLevel = 'ABSOLUTELY_SAFE';
    reasons.push('✅ Empty or nearly empty file');
  } else if (data.type === 'test' && name.includes('.test.') && !data.content.hasDefaultExport) {
    safetyLevel = 'VERY_SAFE';
    reasons.push('✅ Unit test file with clear test naming');
  } 
  
  // VERY_SAFE - High confidence deletions
  else if (data.type === 'test') {
    safetyLevel = 'VERY_SAFE';
    reasons.push('✅ Test file');
  } else if (name.includes('temp') || name.includes('draft') || name.includes('unused')) {
    safetyLevel = 'VERY_SAFE';
    reasons.push('✅ Filename indicates temporary/unused');
  }
  
  // PROBABLY_SAFE - Good candidates but need review
  else if (data.type === 'module' && !data.content.hasDefaultExport && !data.content.hasNamedExports) {
    safetyLevel = 'PROBABLY_SAFE';
    reasons.push('⚠️ Module with no exports');
  } else if (data.content.hasTodo && !data.content.hasDefaultExport) {
    safetyLevel = 'PROBABLY_SAFE';
    reasons.push('⚠️ Has TODO comments, might be incomplete');
  }
  
  // RISKY - Needs careful consideration
  else if (data.type === 'api-route') {
    safetyLevel = 'RISKY';
    reasons.push('⚠️ API route - might be called externally');
  } else if (data.type === 'next-page') {
    safetyLevel = 'RISKY';
    reasons.push('⚠️ Next.js page - accessible via URL');
  } else if (data.type === 'component' && data.content.hasDefaultExport) {
    safetyLevel = 'RISKY';
    reasons.push('⚠️ Component with default export - might be dynamically imported');
  } else if (data.type === 'types') {
    safetyLevel = 'RISKY';
    reasons.push('⚠️ Type definitions - might be used in ways not detectable');
  }
  
  // KEEP - Default for everything else
  else {
    reasons.push('❓ Unclear usage pattern - keeping for safety');
  }
  
  // Additional context
  if (data.content.hasDefaultExport) {
    reasons.push('ℹ️ Has default export');
  }
  if (data.content.hasNamedExports) {
    reasons.push('ℹ️ Has named exports');
  }
  if (data.imports.size > 0) {
    reasons.push(`ℹ️ Imports ${data.imports.size} other files`);
  }
  
  return {
    safetyLevel,
    reasons,
    fileType: data.type,
    size: data.content.size
  };
}

function generateDetailedReport(orphans) {
  console.log('📊 DETAILED ORPHAN ANALYSIS RESULTS');
  console.log('=' .repeat(60) + '\n');
  
  const counts = orphans.reduce((acc, o) => {
    acc[o.analysis.safetyLevel] = (acc[o.analysis.safetyLevel] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📈 SAFETY DISTRIBUTION:');
  Object.entries(counts).forEach(([level, count]) => {
    const icon = {
      'ABSOLUTELY_SAFE': '🟢',
      'VERY_SAFE': '🟢', 
      'PROBABLY_SAFE': '🟡',
      'RISKY': '🟠',
      'KEEP': '🔴'
    }[level] || '⚪';
    console.log(`   ${icon} ${level}: ${count} files`);
  });
  
  console.log('\n🎯 IMMEDIATE DELETION CANDIDATES:\n');
  
  const absolutelySafe = orphans.filter(o => o.analysis.safetyLevel === 'ABSOLUTELY_SAFE');
  const verySafe = orphans.filter(o => o.analysis.safetyLevel === 'VERY_SAFE');
  
  if (absolutelySafe.length > 0) {
    console.log('🟢 ABSOLUTELY SAFE TO DELETE:');
    console.log('These can be deleted immediately with zero risk:\n');
    
    absolutelySafe.forEach(o => {
      const relativePath = path.relative(rootDir, o.filePath);
      console.log(`📁 ${relativePath}`);
      console.log(`   Size: ${o.content.size} bytes`);
      o.analysis.reasons.forEach(reason => console.log(`   ${reason}`));
      console.log(`   Command: rm "${o.filePath}"`);
      console.log();
    });
  }
  
  if (verySafe.length > 0) {
    console.log('🟢 VERY SAFE TO DELETE:');
    console.log('High confidence deletions (quick review recommended):\n');
    
    verySafe.forEach(o => {
      const relativePath = path.relative(rootDir, o.filePath);
      console.log(`📁 ${relativePath}`);
      console.log(`   Size: ${o.content.size} bytes`);
      o.analysis.reasons.forEach(reason => console.log(`   ${reason}`));
      console.log();
    });
  }
  
  const probablySafe = orphans.filter(o => o.analysis.safetyLevel === 'PROBABLY_SAFE');
  if (probablySafe.length > 0) {
    console.log('\n🟡 REVIEW BEFORE DELETION:');
    console.log('Probably safe but needs manual verification:\n');
    
    probablySafe.forEach(o => {
      const relativePath = path.relative(rootDir, o.filePath);
      console.log(`📁 ${relativePath}`);
      o.analysis.reasons.forEach(reason => console.log(`   ${reason}`));
      console.log();
    });
  }
  
  // Show dangerous dependencies
  console.log('\n⚠️ DEPENDENCY CHAIN ANALYSIS:');
  for (const orphan of [...absolutelySafe, ...verySafe]) {
    const wouldOrphan = [];
    for (const importPath of orphan.imports) {
      const imported = orphans.find(o => o.filePath === importPath);
      if (imported && imported.importedBy.size === 1) {
        wouldOrphan.push(imported);
      }
    }
    
    if (wouldOrphan.length > 0) {
      const relativePath = path.relative(rootDir, orphan.filePath);
      console.log(`\n🔗 Deleting ${relativePath} would also orphan:`);
      wouldOrphan.forEach(w => {
        console.log(`   - ${path.relative(rootDir, w.filePath)}`);
      });
    }
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Start with ABSOLUTELY_SAFE files');
  console.log('2. Run tests after each deletion');
  console.log('3. Review VERY_SAFE files quickly');
  console.log('4. Be cautious with dependency chains');
  console.log('5. Commit changes incrementally');
  
  // Generate deletion script
  const safeToDelete = [...absolutelySafe, ...verySafe];
  if (safeToDelete.length > 0) {
    console.log('\n🤖 DELETION SCRIPT:');
    console.log('# Copy and run these commands after review:');
    safeToDelete.forEach(o => {
      console.log(`rm "${o.filePath}"`);
    });
  }
}

// Main execution
function main() {
  const { orphans } = analyzeFiles();
  generateDetailedReport(orphans);
  
  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    analysis: 'conservative-orphan-analysis',
    totalOrphans: orphans.length,
    safeToDelete: orphans.filter(o => 
      ['ABSOLUTELY_SAFE', 'VERY_SAFE'].includes(o.analysis.safetyLevel)
    ).length,
    orphans: orphans.map(o => ({
      path: path.relative(rootDir, o.filePath),
      safetyLevel: o.analysis.safetyLevel,
      type: o.analysis.fileType,
      size: o.analysis.size,
      reasons: o.analysis.reasons
    }))
  };
  
  fs.writeFileSync(
    path.join(rootDir, 'analysis/conservative-orphan-analysis.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n💾 Results saved to analysis/conservative-orphan-analysis.json');
}

if (require.main === module) {
  main();
}

module.exports = { analyzeFiles, findTrueOrphans };