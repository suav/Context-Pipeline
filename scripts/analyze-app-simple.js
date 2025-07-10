const http = require('http');
const fs = require('fs').promises;
const path = require('path');
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Try to parse as JSON, fallback to text
          const result = res.headers['content-type']?.includes('application/json')
            ? JSON.parse(data)
            : data;
          resolve({ status: res.statusCode, data: result, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}
async function analyzeApp() {
  const analysisDir = path.join(__dirname, '../analysis');
  await fs.mkdir(analysisDir, { recursive: true });
  console.log('🔍 Analyzing Context Pipeline application...');
  try {
    // Test 1: Health check
    console.log('\n1. Testing API health...');
    const healthResult = await makeRequest('http://localhost:3001/api/health');
    console.log('✅ Health check:', healthResult.status === 200 ? healthResult.data : 'Failed');
    // Test 2: Homepage
    console.log('\n2. Fetching homepage...');
    const homepageResult = await makeRequest('http://localhost:3001');
    const homepageHtml = homepageResult.data;
    // Save for analysis
    await fs.writeFile(path.join(analysisDir, 'homepage.html'), homepageHtml);
    // Analyze homepage content
    const homeAnalysis = analyzeHomepage(homepageHtml);
    console.log('🏠 Homepage analysis:');
    Object.entries(homeAnalysis).forEach(([key, value]) => {
      const icon = value ? '✅' : '❌';
      // console.log removed - contained sensitive data;
    });
    // Test 3: Workspaces API
    console.log('\n3. Testing workspaces API...');
    const workspacesResult = await makeRequest('http://localhost:3001/api/workspaces');
    console.log('📁 Workspaces:', workspacesResult.status === 200 ?
      `${workspacesResult.data.workspaces?.length || 0} workspaces found` : 'API Failed');
    // Test 4: Context library API
    console.log('\n4. Testing context library API...');
    const libraryResult = await makeRequest('http://localhost:3001/api/context-workflow/library');
    console.log('📚 Library:', libraryResult.status === 200 ?
      `${libraryResult.data.items?.length || 0} items in library` : 'API Failed');
    // Test 5: Query templates
    console.log('\n5. Testing JIRA query templates...');
    const queryResult = await makeRequest('http://localhost:3001/api/context-workflow/queries/jira');
    console.log('🎯 JIRA queries:', queryResult.status === 200 ?
      `${queryResult.data.queries?.templates?.popular?.length || 0} templates available` : 'API Failed');
    // Feature completeness assessment
    console.log('\n🎯 Feature Completeness Assessment:');
    const features = analyzeFeatures(homepageHtml);
    const featureList = [
      { name: 'Workspace Management', key: 'workspaceManagement' },
      { name: 'Context Import System', key: 'contextImport' },
      { name: 'Agent Integration', key: 'agentIntegration' },
      { name: 'File Operations', key: 'fileOperations' },
      { name: 'Settings Interface', key: 'settings' },
      { name: 'Library Management', key: 'library' },
      { name: 'Monaco Editor', key: 'monacoEditor' },
      { name: 'Terminal/Chat Interface', key: 'terminal' }
    ];
    featureList.forEach(feature => {
      const status = features[feature.key] ? '✅ Working' : '❌ Missing/Hidden';
      console.log(`   ${status}: ${feature.name}`);
    });
    // API Health Summary
    console.log('\n🔌 API Health Summary:');
    const apiTests = [
      { name: 'Health Endpoint', result: healthResult },
      { name: 'Workspaces API', result: workspacesResult },
      { name: 'Library API', result: libraryResult },
      { name: 'Query Templates', result: queryResult }
    ];
    apiTests.forEach(test => {
      const status = test.result.status === 200 ? '✅ Online' : '❌ Failed';
      console.log(`   ${status}: ${test.name} (${test.result.status})`);
    });
    // Generate recommendations
    const recommendations = generateRecommendations(homeAnalysis, workspacesResult, libraryResult);
    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
    // Save detailed analysis
    const report = {
      timestamp: new Date().toISOString(),
      homepage: homeAnalysis,
      features: features,
      apis: {
        health: healthResult.status === 200,
        workspaces: workspacesResult.status === 200,
        library: libraryResult.status === 200,
        queries: queryResult.status === 200
      },
      recommendations: recommendations
    };
    await fs.writeFile(
      path.join(analysisDir, 'analysis-report.json'),
      JSON.stringify(report, null, 2)
    );
    console.log('\n📊 Analysis complete! Detailed report saved to analysis/analysis-report.json');
    // Overall assessment
    const workingFeatures = featureList.filter(f => features[f.key]).length;
    const totalFeatures = featureList.length;
    const completeness = Math.round((workingFeatures / totalFeatures) * 100);
    console.log(`\n🎯 Overall Assessment: ${completeness}% feature completeness (${workingFeatures}/${totalFeatures} features detected)`);
    return report;
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  }
}
function analyzeHomepage(html) {
  if (!html || typeof html !== 'string') {
    return { error: 'No HTML content received' };
  }
  return {
    hasWorkspaceWorkshop: html.includes('Workspace Workshop'),
    hasContextPipeline: html.includes('Context Pipeline'),
    hasWorkspaceSidebar: html.includes('Workspaces') && html.includes('New Workspace'),
    hasSettings: html.includes('Settings') || html.includes('☰'),
    hasCreateWorkspace: html.includes('Create New Workspace'),
    hasImportButton: html.includes('Import') || html.includes('📥'),
    hasLibraryElements: html.includes('library') || html.includes('Library'),
    hasAgentElements: html.includes('agent') || html.includes('Agent'),
    hasMonacoEditor: html.includes('monaco'),
    hasTerminalElements: html.includes('terminal') || html.includes('Terminal'),
    hasFileExplorer: html.includes('file') && html.includes('tree'),
    hasLoadingStates: html.includes('Loading') || html.includes('loading'),
    totalSize: html.length,
    hasReactElements: html.includes('react') || html.includes('React'),
    hasNextJS: html.includes('next') || html.includes('Next')
  };
}
function analyzeFeatures(html) {
  return {
    workspaceManagement: html.includes('Workspace') && html.includes('New Workspace'),
    contextImport: html.includes('Import') || html.includes('📥'),
    agentIntegration: html.includes('agent') || html.includes('Agent'),
    fileOperations: html.includes('file') || html.includes('File'),
    settings: html.includes('Settings') || html.includes('☰'),
    library: html.includes('Library') || html.includes('library'),
    monacoEditor: html.includes('monaco'),
    terminal: html.includes('terminal') || html.includes('Terminal'),
    gitIntegration: html.includes('git') || html.includes('Git'),
    permissions: html.includes('permission') || html.includes('Permission')
  };
}
function generateRecommendations(homepage, workspaces, library) {
  const recommendations = [];
  if (!homepage.hasWorkspaceSidebar) {
    recommendations.push('Workspace sidebar elements not detected - may need to create a workspace first');
  }
  if (workspaces.status !== 200) {
    recommendations.push('Workspace API is not responding correctly');
  }
  if (library.status !== 200) {
    recommendations.push('Context library API needs attention');
  }
  if (!homepage.hasMonacoEditor) {
    recommendations.push('Monaco editor not detected - check if it loads after workspace selection');
  }
  if (!homepage.hasAgentElements) {
    recommendations.push('Agent UI elements not visible - may require workspace with agents');
  }
  if (homepage.totalSize < 10000) {
    recommendations.push('Homepage seems too small - possible rendering issue');
  }
  return recommendations;
}
// Run analysis
if (require.main === module) {
  analyzeApp().catch(console.error);
}
module.exports = { analyzeApp };