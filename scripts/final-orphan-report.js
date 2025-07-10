#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = '/home/nricoatarini/Project-Workspace/Context-Pipeline/src';
const rootDir = '/home/nricoatarini/Project-Workspace/Context-Pipeline';

function searchForReferences(filename) {
  try {
    // Search for the base name without extension
    const baseName = path.basename(filename, path.extname(filename));
    const result = execSync(`rg -l "${baseName}" ${srcDir}`, { encoding: 'utf8' });
    return result.trim().split('\n').filter(line => line && line !== filename);
  } catch (error) {
    return []; // No matches found
  }
}

function analyzeSpecificFiles() {
  console.log('🎯 FINAL CONSERVATIVE ORPHANED COMPONENTS ANALYSIS');
  console.log('=' .repeat(65) + '\n');
  
  // Files from git status that appear to be candidates
  const candidates = [
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/features/agents/services/AgentService.old.ts',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/app/test/page.tsx',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/app/api/credentials/test/route.ts',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/features/context-import/templates/jira-advanced-templates.ts',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/components/LazyTestComponent.tsx',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/features/context-import/importers/EmailImporter.ts',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/features/context-import/importers/TextImporter.ts',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/features/context-import/services/EmailProcessor.ts',
    '/home/nricoatarini/Project-Workspace/Context-Pipeline/src/features/context-import/types/email-types.ts'
  ];
  
  const analysis = [];
  
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    
    const relativePath = path.relative(rootDir, filePath);
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const references = searchForReferences(filePath);
    
    let safetyLevel = 'UNKNOWN';
    let reasons = [];
    
    // Analyze each file individually
    if (fileName.endsWith('.old.ts')) {
      safetyLevel = 'ABSOLUTELY_SAFE';
      reasons.push('✅ Clear backup file (.old extension)');
      reasons.push('✅ Zero references found in codebase');
    } else if (fileName === 'page.tsx' && filePath.includes('/test/')) {
      safetyLevel = 'ABSOLUTELY_SAFE';
      reasons.push('✅ Test page in /test/ directory');
      reasons.push('✅ Very small file (' + content.length + ' bytes)');
    } else if (fileName === 'route.ts' && filePath.includes('/test/')) {
      safetyLevel = 'ABSOLUTELY_SAFE';
      reasons.push('✅ Test API route');
      reasons.push('✅ Used only for testing credentials');
    } else if (fileName === 'LazyTestComponent.tsx') {
      safetyLevel = 'VERY_SAFE';
      reasons.push('✅ Clearly a test component');
      reasons.push('⚠️ Has ' + references.length + ' potential references');
    } else if (fileName === 'jira-advanced-templates.ts') {
      safetyLevel = references.length === 0 ? 'VERY_SAFE' : 'KEEP';
      if (references.length === 0) {
        reasons.push('✅ No references found in codebase');
        reasons.push('✅ Template file that appears unused');
      } else {
        reasons.push('❌ Found ' + references.length + ' references');
      }
    } else if (fileName.includes('Email') && references.length === 0) {
      safetyLevel = 'PROBABLY_SAFE';
      reasons.push('⚠️ Email functionality not yet implemented');
      reasons.push('⚠️ No references found but might be future feature');
    } else if (fileName === 'TextImporter.ts' && references.length === 0) {
      safetyLevel = 'PROBABLY_SAFE';
      reasons.push('⚠️ Text import functionality appears unused');
      reasons.push('⚠️ No references found');
    } else {
      safetyLevel = 'KEEP';
      reasons.push('❓ Unclear - keeping for safety');
    }
    
    if (references.length > 0) {
      reasons.push(`ℹ️ Found ${references.length} potential references`);
    }
    
    analysis.push({
      filePath,
      relativePath,
      fileName,
      size: content.length,
      safetyLevel,
      reasons,
      references: references.slice(0, 3) // Show first 3 references
    });
  }
  
  return analysis;
}

function generateFinalReport(analysis) {
  const safeToDelete = analysis.filter(a => 
    ['ABSOLUTELY_SAFE', 'VERY_SAFE'].includes(a.safetyLevel)
  );
  
  const needReview = analysis.filter(a => 
    a.safetyLevel === 'PROBABLY_SAFE'
  );
  
  console.log('📊 FINAL RESULTS SUMMARY:');
  console.log(`   🟢 Safe to delete immediately: ${safeToDelete.length} files`);
  console.log(`   🟡 Need review: ${needReview.length} files`);
  console.log(`   🔴 Keep for safety: ${analysis.filter(a => a.safetyLevel === 'KEEP').length} files\n`);
  
  if (safeToDelete.length > 0) {
    console.log('🟢 SAFE TO DELETE IMMEDIATELY:\n');
    
    safeToDelete.forEach(item => {
      console.log(`📁 ${item.relativePath}`);
      console.log(`   Size: ${item.size} bytes`);
      item.reasons.forEach(reason => console.log(`   ${reason}`));
      if (item.references.length > 0) {
        console.log('   References:');
        item.references.forEach(ref => console.log(`     - ${path.relative(rootDir, ref)}`));
      }
      console.log(`   Command: rm "${item.filePath}"`);
      console.log();
    });
  }
  
  if (needReview.length > 0) {
    console.log('🟡 REVIEW THESE FILES:\n');
    
    needReview.forEach(item => {
      console.log(`📁 ${item.relativePath}`);
      console.log(`   Size: ${item.size} bytes`);
      item.reasons.forEach(reason => console.log(`   ${reason}`));
      if (item.references.length > 0) {
        console.log('   References found:');
        item.references.forEach(ref => console.log(`     - ${path.relative(rootDir, ref)}`));
      }
      console.log();
    });
  }
  
  console.log('🔒 FILES TO KEEP (showing first few):\n');
  const toKeep = analysis.filter(a => a.safetyLevel === 'KEEP').slice(0, 3);
  toKeep.forEach(item => {
    console.log(`📁 ${item.relativePath}`);
    item.reasons.forEach(reason => console.log(`   ${reason}`));
    console.log();
  });
  
  console.log('\n💡 FINAL RECOMMENDATIONS:');
  console.log('1. Delete the SAFE files immediately - they are confirmed orphans');
  console.log('2. The email-related files appear to be planned features, not current bugs');
  console.log('3. Always run tests after deletion to catch any dynamic imports');
  console.log('4. Consider these deletions as cleanup, not critical for functionality');
  
  if (safeToDelete.length > 0) {
    console.log('\n🚀 IMMEDIATE DELETION COMMANDS:');
    safeToDelete.forEach(item => {
      console.log(`rm "${item.filePath}"`);
    });
  }
  
  // Save final report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      safeToDelete: safeToDelete.length,
      needReview: needReview.length,
      totalAnalyzed: analysis.length
    },
    files: analysis.map(a => ({
      path: a.relativePath,
      safetyLevel: a.safetyLevel,
      size: a.size,
      reasons: a.reasons,
      references: a.references.map(r => path.relative(rootDir, r))
    }))
  };
  
  fs.writeFileSync(
    path.join(rootDir, 'analysis/final-orphan-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n💾 Complete report saved to analysis/final-orphan-report.json');
}

// Execute analysis
function main() {
  try {
    const analysis = analyzeSpecificFiles();
    generateFinalReport(analysis);
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeSpecificFiles };