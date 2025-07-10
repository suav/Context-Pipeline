// Use built-in fetch in Node 18+
const fetch = globalThis.fetch || require('https').get;
const fs = require('fs').promises;
const path = require('path');
async // Duplicate function removed: analyzeApp (see ./scripts/analyze-app-simple.js));
  console.log('🔍 Analyzing Context Pipeline application...');
  try {
    // Test 1: Health check
    console.log('\n1. Testing API health...');
    const healthResponse = await fetch('http://localhost:3001/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    // Test 2: Homepage
    console.log('\n2. Fetching homepage...');
    const homepageResponse = await fetch('http://localhost:3001');
    const homepageHtml = await homepageResponse.text();
    // Save for analysis
    await fs.writeFile(path.join(analysisDir, 'homepage.html'), homepageHtml);
    // Analyze homepage content
    const homeAnalysis = analyzeHomepage(homepageHtml);
    console.log('🏠 Homepage analysis:', homeAnalysis);
    // Test 3: Workspaces API
    console.log('\n3. Testing workspaces API...');
    const workspacesResponse = await fetch('http://localhost:3001/api/workspaces');
    const workspacesData = await workspacesResponse.json();
    console.log('📁 Workspaces:', workspacesData);
    // Test 4: Context library API
    console.log('\n4. Testing context library API...');
    const libraryResponse = await fetch('http://localhost:3001/api/context-workflow/library');
    const libraryData = await libraryResponse.json();
    console.log('📚 Library:', libraryData);
    // Test 5: Query templates
    console.log('\n5. Testing JIRA query templates...');
    const queryResponse = await fetch('http://localhost:3001/api/context-workflow/queries/jira');
    const queryData = await queryResponse.json();
    console.log('🎯 JIRA queries available:', queryData.success ? queryData.queries.templates.popular.length : 'Failed');
    // Test 6: File operations (if workspaces exist)
    if (workspacesData.success && workspacesData.workspaces.length > 0) {
      const firstWorkspace = workspacesData.workspaces[0];
      console.log(`\n6. Testing file operations for workspace: ${firstWorkspace.name}`);
      const filesResponse = await fetch(`http://localhost:3001/api/workspaces/${firstWorkspace.id}/files`);
      const filesData = await filesResponse.json();
      console.log('📄 Files in workspace:', filesData.success ? `${filesData.files?.length || 0} files` : 'Failed');
    }
    // Generate comprehensive analysis report
    const report = {
      timestamp: new Date().toISOString(),
      health: healthData,
      homepage: homeAnalysis,
      apis: {
        workspaces: workspacesData,
        library: libraryData,
        queries: queryData.success ? 'Available' : 'Failed'
      },
      features: analyzeFeatures(homepageHtml),
      recommendations: generateRecommendations(homeAnalysis, workspacesData, libraryData)
    };
    await fs.writeFile(
      path.join(analysisDir, 'app-analysis-report.json'),
      JSON.stringify(report, null, 2)
    );
    console.log('\n📊 Analysis complete! Check analysis/ directory for detailed report.');
    console.log('\n🎯 Feature completeness assessment:');
    const features = report.features;
    console.log(`✅ Workspace Management: ${features.workspaceManagement ? 'Working' : 'Missing'}`);
    console.log(`✅ Context Import: ${features.contextImport ? 'Working' : 'Missing'}`);
    console.log(`✅ Agent Integration: ${features.agentIntegration ? 'Working' : 'Missing'}`);
    console.log(`✅ File Operations: ${features.fileOperations ? 'Working' : 'Missing'}`);
    console.log(`✅ Settings & Config: ${features.settings ? 'Working' : 'Missing'}`);
    return report;
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  }
}
function analyzeHomepage(html) {
  const analysis = {
    hasWorkspaceWorkshop: html.includes('Workspace Workshop'),
    hasContextPipeline: html.includes('Context Pipeline'),
    hasWorkspaceSidebar: html.includes('Workspaces') && html.includes('New Workspace'),
    hasSettings: html.includes('Settings') || html.includes('☰'),
    hasCreateWorkspace: html.includes('Create New Workspace'),
    hasImportButton: html.includes('Import'),
    hasLibraryView: html.includes('library') || html.includes('Library'),
    hasAgentElements: html.includes('agent') || html.includes('Agent'),
    hasMonacoEditor: html.includes('monaco'),
    hasTerminal: html.includes('terminal') || html.includes('Terminal'),
    hasFileExplorer: html.includes('file') && html.includes('tree'),
    totalSize: html.length,
    scriptTags: (html.match(/<script/g) || []).length,
    styleTags: (html.match(/<style/g) || []).length
  };
  return analysis;
}
function analyzeFeatures(html) {
  return {
    workspaceManagement: html.includes('Workspace') && html.includes('New Workspace'),
    contextImport: html.includes('Import') || html.includes('📥'),
    agentIntegration: html.includes('agent') || html.includes('Agent'),
    fileOperations: html.includes('file') || html.includes('File'),
    settings: html.includes('Settings') || html.includes('☰'),
    library: html.includes('Library') || html.includes('library'),
    gitIntegration: html.includes('git') || html.includes('Git'),
    permissions: html.includes('permission') || html.includes('Permission')
  };
}
function generateRecommendations(homepage, workspaces, library) {
  const recommendations = [];
  if (!homepage.hasWorkspaceSidebar) {
    recommendations.push('Workspace sidebar may not be rendering correctly');
  }
  if (!workspaces.success) {
    recommendations.push('Workspace API is not functioning properly');
  }
  if (!library.success) {
    recommendations.push('Context library API needs attention');
  }
  if (workspaces.success && workspaces.workspaces.length === 0) {
    recommendations.push('No workspaces exist - create test workspace for full feature testing');
  }
  if (!homepage.hasMonacoEditor) {
    recommendations.push('Monaco editor may not be loading properly');
  }
  if (!homepage.hasAgentElements) {
    recommendations.push('Agent integration UI may not be visible');
  }
  return recommendations;
}
// Export for use in other scripts
if (require.main === module) {
  analyzeApp().catch(console.error);
}
module.exports = { analyzeApp };