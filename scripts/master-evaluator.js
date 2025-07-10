#!/usr/bin/env node
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);
class MasterEvaluator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      evaluationSummary: {
        ui: { status: 'pending', score: 0, issues: 0 },
        security: { status: 'pending', score: 0, issues: 0 },
        functionality: { status: 'pending', score: 0, issues: 0 },
        performance: { status: 'pending', score: 0, issues: 0 }
      },
      overallScore: 0,
      readinessStatus: 'unknown',
      recommendations: [],
      branches: [
        'feature/permissions-system',
        'feature/checkpoint-system',
        'feature/git-operations',
        'feature/context-import',
        'feature/ui-improvements'
      ]
    };
  }
  async runEvaluation() {
    console.log('🎯 Master Evaluator - Comprehensive Analysis Starting...\n');
    try {
      // Create analysis directory if it doesn't exist
      if (!fs.existsSync('analysis')) {
        fs.mkdirSync('analysis', { recursive: true });
      }
      // Run all evaluators in parallel for efficiency
      const evaluations = [
        this.runUIEvaluation(),
        this.runSecurityEvaluation(),
        this.runFunctionalityEvaluation(),
        this.runPerformanceEvaluation()
      ];
      await Promise.allSettled(evaluations);
      // Compile results
      await this.compileResults();
      // Generate master report
      await this.generateMasterReport();
      // Display summary
      this.displaySummary();
    } catch (error) {
      console.error('❌ Master evaluation failed:', error.message);
    }
  }
  async runUIEvaluation() {
    console.log('🎨 Starting UI/UX Evaluation...');
    try {
      // Check if UI evaluator exists
      const uiEvaluatorPath = './scripts/ui-evaluator.js';
      if (!fs.existsSync(uiEvaluatorPath)) {
        console.log('   ⚠️ UI Evaluator script not found, skipping...');
        this.results.evaluationSummary.ui.status = 'skipped';
        return;
      }
      // Run UI evaluation
      const { stdout, stderr } = await execAsync('node scripts/ui-evaluator.js', { timeout: 600000 });
      if (stderr && stderr.includes('error')) {
        console.log('   ⚠️ UI Evaluation completed with warnings');
        this.results.evaluationSummary.ui.status = 'completed_with_warnings';
      } else {
        console.log('   ✅ UI Evaluation completed successfully');
        this.results.evaluationSummary.ui.status = 'completed';
      }
      // Parse UI results if available
      await this.parseUIResults();
    } catch (error) {
      console.error('   ❌ UI Evaluation failed:', error.message);
      this.results.evaluationSummary.ui.status = 'failed';
      this.results.evaluationSummary.ui.issues = 1;
    }
  }
  async runSecurityEvaluation() {
    console.log('🔒 Starting Security Evaluation...');
    try {
      // Run security evaluation
      const { stdout, stderr } = await execAsync('node scripts/security-evaluator.js', { timeout: 300000 });
      console.log('   ✅ Security Evaluation completed successfully');
      this.results.evaluationSummary.security.status = 'completed';
      // Parse security results
      await this.parseSecurityResults();
    } catch (error) {
      console.error('   ❌ Security Evaluation failed:', error.message);
      this.results.evaluationSummary.security.status = 'failed';
      this.results.evaluationSummary.security.issues = 1;
    }
  }
  async runFunctionalityEvaluation() {
    console.log('⚙️ Starting Functionality Evaluation...');
    try {
      // Run functionality evaluation
      const { stdout, stderr } = await execAsync('node scripts/functionality-evaluator.js', { timeout: 600000 });
      console.log('   ✅ Functionality Evaluation completed successfully');
      this.results.evaluationSummary.functionality.status = 'completed';
      // Parse functionality results
      await this.parseFunctionalityResults();
    } catch (error) {
      console.error('   ❌ Functionality Evaluation failed:', error.message);
      this.results.evaluationSummary.functionality.status = 'failed';
      this.results.evaluationSummary.functionality.issues = 1;
    }
  }
  async runPerformanceEvaluation() {
    console.log('⚡ Starting Performance Evaluation...');
    try {
      // Run performance evaluation
      const { stdout, stderr } = await execAsync('node scripts/performance-monitor.js --quick', { timeout: 180000 });
      console.log('   ✅ Performance Evaluation completed successfully');
      this.results.evaluationSummary.performance.status = 'completed';
      // Parse performance results
      await this.parsePerformanceResults();
    } catch (error) {
      console.error('   ❌ Performance Evaluation failed:', error.message);
      this.results.evaluationSummary.performance.status = 'failed';
      this.results.evaluationSummary.performance.issues = 1;
    }
  }
  async parseUIResults() {
    try {
      const uiReportPath = 'analysis/ui-evaluation-report.json';
      if (fs.existsSync(uiReportPath)) {
        const uiData = JSON.parse(fs.readFileSync(uiReportPath, 'utf8'));
        const avgScore = (
          uiData.overall.visibility +
          uiData.overall.clarity +
          uiData.overall.responsiveness +
          uiData.overall.accessibility +
          uiData.overall.performance
        ) / 5;
        this.results.evaluationSummary.ui.score = Math.round(avgScore);
        // Count issues
        const branches = Object.values(uiData.branches);
        this.results.evaluationSummary.ui.issues = branches.reduce((sum, branch) =>
          sum + branch.issues.length, 0);
      }
    } catch (error) {
      console.error('Failed to parse UI results:', error.message);
    }
  }
  async parseSecurityResults() {
    try {
      const securityReportPath = 'analysis/security-evaluation-report.json';
      if (fs.existsSync(securityReportPath)) {
        const securityData = JSON.parse(fs.readFileSync(securityReportPath, 'utf8'));
        this.results.evaluationSummary.security.score = Math.round(securityData.overall.securityScore);
        this.results.evaluationSummary.security.issues =
          securityData.overall.criticalIssues +
          securityData.overall.highIssues;
      }
    } catch (error) {
      console.error('Failed to parse security results:', error.message);
    }
  }
  async parseFunctionalityResults() {
    try {
      const functionalityReportPath = 'analysis/functionality-evaluation-report.json';
      if (fs.existsSync(functionalityReportPath)) {
        const functionalityData = JSON.parse(fs.readFileSync(functionalityReportPath, 'utf8'));
        this.results.evaluationSummary.functionality.score = Math.round(functionalityData.overall.functionalityScore);
        this.results.evaluationSummary.functionality.issues =
          functionalityData.overall.brokenFeatures +
          functionalityData.overall.missingFeatures;
      }
    } catch (error) {
      console.error('Failed to parse functionality results:', error.message);
    }
  }
  async parsePerformanceResults() {
    try {
      const performanceReportPath = 'performance-results.json';
      if (fs.existsSync(performanceReportPath)) {
        const performanceData = JSON.parse(fs.readFileSync(performanceReportPath, 'utf8'));
        if (performanceData.length > 0) {
          const latest = performanceData[performanceData.length - 1];
          // Calculate performance score based on metrics
          let score = 100;
          if (latest.metrics.buildTime > 4000) score -= 20;
          if (latest.metrics.devStartTime > 2000) score -= 15;
          if (latest.metrics.memoryUsage && latest.metrics.memoryUsage.heapUsed > 200) score -= 10;
          if (latest.metrics.bundleSize === '69M') score -= 30; // This is quite large
          this.results.evaluationSummary.performance.score = Math.max(0, score);
          this.results.evaluationSummary.performance.issues = score < 80 ? 1 : 0;
        }
      }
    } catch (error) {
      console.error('Failed to parse performance results:', error.message);
    }
  }
  async compileResults() {
    console.log('\n📊 Compiling comprehensive evaluation results...');
    // Calculate overall score
    const scores = [
      this.results.evaluationSummary.ui.score,
      this.results.evaluationSummary.security.score,
      this.results.evaluationSummary.functionality.score,
      this.results.evaluationSummary.performance.score
    ].filter(score => score > 0);
    if (scores.length > 0) {
      this.results.overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }
    // Determine readiness status
    this.determineReadinessStatus();
    // Generate recommendations
    this.generateRecommendations();
  }
  determineReadinessStatus() {
    const { ui, security, functionality, performance } = this.results.evaluationSummary;
    // Critical blockers
    if (security.score < 70 || security.issues > 0) {
      this.results.readinessStatus = 'blocked_security';
      return;
    }
    if (functionality.score < 60 || functionality.issues > 3) {
      this.results.readinessStatus = 'blocked_functionality';
      return;
    }
    // Ready for testing
    if (this.results.overallScore >= 80 &&
        functionality.score >= 70 &&
        security.score >= 80) {
      this.results.readinessStatus = 'ready_for_testing';
      return;
    }
    // Needs work
    if (this.results.overallScore >= 60) {
      this.results.readinessStatus = 'needs_improvement';
      return;
    }
    // Not ready
    this.results.readinessStatus = 'not_ready';
  }
  generateRecommendations() {
    const recommendations = [];
    const { ui, security, functionality, performance } = this.results.evaluationSummary;
    // Security recommendations
    if (security.issues > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Security',
        message: `${security.issues} security issues found - must be resolved before deployment`,
        action: 'Review security evaluation report and fix all critical/high issues'
      });
    }
    // Functionality recommendations
    if (functionality.score < 70) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Functionality',
        message: `Functionality score is ${functionality.score}/100 - features are not ready`,
        action: 'Complete missing features and fix broken implementations'
      });
    }
    // Performance recommendations
    if (performance.score < 70) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Performance',
        message: `Performance score is ${performance.score}/100 - optimization needed`,
        action: 'Optimize bundle size, build times, and runtime performance'
      });
    }
    // UI recommendations
    if (ui.score < 70) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'UI/UX',
        message: `UI/UX score is ${ui.score}/100 - user experience needs improvement`,
        action: 'Address visibility, clarity, and accessibility issues'
      });
    }
    // Overall recommendations based on readiness status
    switch (this.results.readinessStatus) {
      case 'ready_for_testing':
        recommendations.push({
          priority: 'INFO',
          category: 'Next Steps',
          message: 'All evaluations passed - ready for user acceptance testing',
          action: 'Deploy to testing environment and gather user feedback'
        });
        break;
      case 'needs_improvement':
        recommendations.push({
          priority: 'MEDIUM',
          category: 'Next Steps',
          message: 'Most features working but improvements needed before testing',
          action: 'Address medium-priority issues and re-evaluate'
        });
        break;
      case 'not_ready':
        recommendations.push({
          priority: 'HIGH',
          category: 'Next Steps',
          message: 'Significant work needed before deployment consideration',
          action: 'Focus on completing core features and fixing critical issues'
        });
        break;
    }
    this.results.recommendations = recommendations;
  }
  async generateMasterReport() {
    console.log('📄 Generating Master Evaluation Report...');
    // Save detailed JSON report
    const jsonReportPath = 'analysis/master-evaluation-report.json';
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.results, null, 2));
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync('analysis/MASTER_EVALUATION_REPORT.md', markdownReport);
    console.log(`✅ Master report saved to ${jsonReportPath}`);
    console.log(`📄 Markdown report saved to analysis/MASTER_EVALUATION_REPORT.md`);
  }
  generateMarkdownReport() {
    const { ui, security, functionality, performance } = this.results.evaluationSummary;
    let report = `# Master Evaluation Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n`;
    report += `**Overall Score:** ${this.results.overallScore}/100\n`;
    report += `**Readiness Status:** ${this.getReadinessStatusEmoji()} ${this.results.readinessStatus.replace(/_/g, ' ').toUpperCase()}\n\n`;
    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += `This comprehensive evaluation assessed Context Pipeline across four critical dimensions: UI/UX, Security, Functionality, and Performance. `;
    switch (this.results.readinessStatus) {
      case 'ready_for_testing':
        report += `The application is **ready for user acceptance testing** with all major systems functional and secure.\n\n`;
        break;
      case 'needs_improvement':
        report += `The application requires **minor improvements** before testing but core functionality is working.\n\n`;
        break;
      case 'blocked_security':
        report += `The application is **blocked by security issues** that must be resolved before any deployment.\n\n`;
        break;
      case 'blocked_functionality':
        report += `The application is **blocked by functionality issues** with core features not working properly.\n\n`;
        break;
      default:
        report += `The application requires **significant work** before it can be considered for testing or deployment.\n\n`;
    }
    // Evaluation Summary
    report += `## Evaluation Summary\n\n`;
    report += `| Category | Score | Status | Issues | Report |\n`;
    report += `|----------|-------|--------|--------|---------|\n`;
    report += `| UI/UX | ${ui.score}/100 | ${this.getStatusEmoji(ui.status)} ${ui.status} | ${ui.issues} | [UI Report](./ui-evaluation-report.json) |\n`;
    report += `| Security | ${security.score}/100 | ${this.getStatusEmoji(security.status)} ${security.status} | ${security.issues} | [Security Report](./security-evaluation-report.json) |\n`;
    report += `| Functionality | ${functionality.score}/100 | ${this.getStatusEmoji(functionality.status)} ${functionality.status} | ${functionality.issues} | [Functionality Report](./functionality-evaluation-report.json) |\n`;
    report += `| Performance | ${performance.score}/100 | ${this.getStatusEmoji(performance.status)} ${performance.status} | ${performance.issues} | [Performance Report](../performance-results.json) |\n\n`;
    // Key Findings
    report += `## Key Findings\n\n`;
    // Strengths
    const strengths = [];
    if (security.score >= 80) strengths.push('Strong security posture');
    if (functionality.score >= 80) strengths.push('Core functionality working well');
    if (ui.score >= 80) strengths.push('Good user experience');
    if (performance.score >= 80) strengths.push('Optimal performance');
    if (strengths.length > 0) {
      report += `### Strengths\n`;
      strengths.forEach(strength => {
        report += `- ✅ ${strength}\n`;
      });
      report += `\n`;
    }
    // Critical Issues
    const criticalIssues = [];
    if (security.issues > 0) criticalIssues.push(`${security.issues} security vulnerabilities`);
    if (functionality.issues > 3) criticalIssues.push(`${functionality.issues} broken/missing features`);
    if (performance.score < 50) criticalIssues.push('Poor performance metrics');
    if (ui.score < 50) criticalIssues.push('Significant UI/UX problems');
    if (criticalIssues.length > 0) {
      report += `### Critical Issues\n`;
      criticalIssues.forEach(issue => {
        report += `- 🚨 ${issue}\n`;
      });
      report += `\n`;
    }
    // Recommendations
    if (this.results.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      const criticalRecs = this.results.recommendations.filter(r => r.priority === 'CRITICAL');
      const highRecs = this.results.recommendations.filter(r => r.priority === 'HIGH');
      const mediumRecs = this.results.recommendations.filter(r => r.priority === 'MEDIUM');
      const infoRecs = this.results.recommendations.filter(r => r.priority === 'INFO');
      if (criticalRecs.length > 0) {
        report += `### 🚨 Critical Priority\n`;
        criticalRecs.forEach(rec => {
          report += `**${rec.category}**: ${rec.message}\n`;
          report += `- *Action Required*: ${rec.action}\n\n`;
        });
      }
      if (highRecs.length > 0) {
        report += `### ⚠️ High Priority\n`;
        highRecs.forEach(rec => {
          report += `**${rec.category}**: ${rec.message}\n`;
          report += `- *Action Required*: ${rec.action}\n\n`;
        });
      }
      if (mediumRecs.length > 0) {
        report += `### 📋 Medium Priority\n`;
        mediumRecs.forEach(rec => {
          report += `**${rec.category}**: ${rec.message}\n`;
          report += `- *Action Required*: ${rec.action}\n\n`;
        });
      }
      if (infoRecs.length > 0) {
        report += `### ℹ️ Information\n`;
        infoRecs.forEach(rec => {
          report += `**${rec.category}**: ${rec.message}\n`;
          report += `- *Next Step*: ${rec.action}\n\n`;
        });
      }
    }
    // Next Steps
    report += `## Next Steps\n\n`;
    switch (this.results.readinessStatus) {
      case 'ready_for_testing':
        report += `1. ✅ **Deploy to Testing Environment** - All evaluations passed\n`;
        report += `2. 🧪 **Conduct User Acceptance Testing** - Gather real user feedback\n`;
        report += `3. 📊 **Monitor Performance** - Watch for issues in testing environment\n`;
        report += `4. 🚀 **Prepare for Production** - Final deployment preparations\n\n`;
        break;
      case 'needs_improvement':
        report += `1. 🔧 **Address Medium Priority Issues** - Focus on identified improvements\n`;
        report += `2. 🔄 **Re-run Evaluations** - Verify improvements are effective\n`;
        report += `3. 🧪 **Limited Testing** - Test specific improved areas\n`;
        report += `4. ✅ **Full Re-evaluation** - Complete assessment before deployment\n\n`;
        break;
      default:
        report += `1. 🚨 **Fix Critical Issues** - Address all blocking problems first\n`;
        report += `2. ⚙️ **Complete Core Features** - Ensure basic functionality works\n`;
        report += `3. 🔄 **Incremental Testing** - Test fixes as they are implemented\n`;
        report += `4. 📊 **Re-run Full Evaluation** - Complete reassessment when ready\n\n`;
    }
    // Detailed Reports
    report += `## Detailed Reports\n\n`;
    report += `For comprehensive details on each evaluation category:\n\n`;
    report += `- 🎨 **[UI/UX Evaluation Report](./UI_EVALUATION_REPORT.md)** - User interface and experience analysis\n`;
    report += `- 🔒 **[Security Evaluation Report](./SECURITY_EVALUATION_REPORT.md)** - Security vulnerability assessment\n`;
    report += `- ⚙️ **[Functionality Evaluation Report](./FUNCTIONALITY_EVALUATION_REPORT.md)** - Feature implementation status\n`;
    report += `- ⚡ **[Performance Results](../performance-results.json)** - Performance metrics and analysis\n\n`;
    report += `---\n\n`;
    report += `*This master evaluation was conducted using automated analysis tools. Results should be validated through manual testing and code review.*\n`;
    return report;
  }
  getStatusEmoji(status) {
    switch (status) {
      case 'completed': return '✅';
      case 'completed_with_warnings': return '⚠️';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  }
  getReadinessStatusEmoji() {
    switch (this.results.readinessStatus) {
      case 'ready_for_testing': return '✅';
      case 'needs_improvement': return '⚠️';
      case 'blocked_security': return '🚨';
      case 'blocked_functionality': return '🔴';
      case 'not_ready': return '❌';
      default: return '❓';
    }
  }
  displaySummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MASTER EVALUATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎯 Overall Score: ${this.results.overallScore}/100`);
    console.log(`📈 Readiness: ${this.getReadinessStatusEmoji()} ${this.results.readinessStatus.replace(/_/g, ' ').toUpperCase()}`);
    console.log('\n📋 Category Breakdown:');
    const { ui, security, functionality, performance } = this.results.evaluationSummary;
    console.log(`   🎨 UI/UX:        ${ui.score}/100        ${this.getStatusEmoji(ui.status)} (${ui.issues} issues)`);
    console.log(`   🔒 Security:     ${security.score}/100        ${this.getStatusEmoji(security.status)} (${security.issues} issues)`);
    console.log(`   ⚙️ Functionality: ${functionality.score}/100        ${this.getStatusEmoji(functionality.status)} (${functionality.issues} issues)`);
    console.log(`   ⚡ Performance:  ${performance.score}/100        ${this.getStatusEmoji(performance.status)} (${performance.issues} issues)`);
    if (this.results.recommendations.length > 0) {
      console.log('\n🎯 Top Recommendations:');
      this.results.recommendations.slice(0, 3).forEach(rec => {
        const icon = rec.priority === 'CRITICAL' ? '🚨' : rec.priority === 'HIGH' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${rec.category}: ${rec.message}`);
      });
    }
    console.log('\n📄 Detailed reports available in analysis/ directory');
    console.log('='.repeat(60));
  }
}
// CLI interface
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Master Evaluator - Comprehensive Analysis Coordinator');
    console.log('Usage:');
    console.log('  node master-evaluator.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help          Show this help');
    console.log('');
    console.log('This tool coordinates all evaluation agents to provide a comprehensive');
    console.log('assessment of Context Pipeline across UI/UX, Security, Functionality,');
    console.log('and Performance dimensions.');
    return;
  }
  const evaluator = new MasterEvaluator();
  await evaluator.runEvaluation();
}
// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
module.exports = MasterEvaluator;