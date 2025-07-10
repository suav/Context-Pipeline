#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const execAsync = promisify(exec);
class SecurityEvaluator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      branches: {},
      overall: {
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        totalFiles: 0,
        securityScore: 100
      },
      patterns: this.getSecurityPatterns()
    };
  }
  getSecurityPatterns() {
    return {
      critical: [
        {
          pattern: /eval\s*\(/gi,
          description: "Use of eval() function - code injection risk",
          severity: "CRITICAL",
          recommendation: "Replace eval() with safer alternatives like JSON.parse() or Function constructor"
        },
        {
          pattern: /document\.write\s*\(/gi,
          description: "Use of document.write() - XSS vulnerability",
          severity: "CRITICAL",
          recommendation: "Use safer DOM manipulation methods like createElement() and appendChild()"
        },
        {
          pattern: /innerHTML\s*=\s*[^`'"]*\+/gi,
          description: "Dynamic innerHTML assignment - XSS risk",
          severity: "CRITICAL",
          recommendation: "Use textContent or createElement() for dynamic content"
        },
        {
          pattern: /process\.env\.[A-Z_]+/gi,
          description: "Environment variable exposure in client code",
          severity: "CRITICAL",
          recommendation: "Ensure environment variables are only used server-side"
        }
      ],
      high: [
        {
          pattern: /localStorage\.setItem\([^,]+,\s*[^)]*password[^)]*\)/gi,
          description: "Storing sensitive data in localStorage",
          severity: "HIGH",
          recommendation: "Use secure storage methods or encrypt sensitive data"
        },
        {
          pattern: /sessionStorage\.setItem\([^,]+,\s*[^)]*token[^)]*\)/gi,
          description: "Storing tokens in sessionStorage without encryption",
          severity: "HIGH",
          recommendation: "Consider httpOnly cookies or encrypted storage"
        },
        {
          pattern: /fetch\([^)]*http:\/\//gi,
          description: "Insecure HTTP requests",
          severity: "HIGH",
          recommendation: "Use HTTPS for all API requests"
        },
        {
          pattern: /dangerouslySetInnerHTML/gi,
          description: "Use of dangerouslySetInnerHTML - XSS risk",
          severity: "HIGH",
          recommendation: "Sanitize content or use safer alternatives"
        },
        {
          pattern: /exec\s*\(|spawn\s*\(|execSync\s*\(/gi,
          description: "Command execution functions - injection risk",
          severity: "HIGH",
          recommendation: "Validate and sanitize all inputs to exec functions"
        }
      ],
      medium: [
        {
          pattern: /Math\.random\(\)/gi,
          description: "Use of Math.random() for security purposes",
          severity: "MEDIUM",
          recommendation: "Use crypto.randomBytes() for cryptographic purposes"
        },
        {
          pattern: /console\.log\([^)]*password|console\.log\([^)]*token|console\.log\([^)]*secret/gi,
          description: "Logging sensitive information",
          severity: "MEDIUM",
          recommendation: "Remove sensitive data from console logs"
        },
        {
          pattern: /\/\*.*password.*\*\/|\/\/.*password/gi,
          description: "Sensitive information in comments",
          severity: "MEDIUM",
          recommendation: "Remove sensitive information from comments"
        },
        {
          pattern: /TODO.*security|FIXME.*security|HACK.*security/gi,
          description: "Security-related TODO/FIXME comments",
          severity: "MEDIUM",
          recommendation: "Address security-related TODO items before production"
        }
      ],
      low: [
        {
          pattern: /alert\s*\(/gi,
          description: "Use of alert() function",
          severity: "LOW",
          recommendation: "Use proper notification components instead of alert()"
        },
        {
          pattern: /confirm\s*\(/gi,
          description: "Use of confirm() function",
          severity: "LOW",
          recommendation: "Use proper modal components instead of confirm()"
        },
        {
          pattern: /var\s+/gi,
          description: "Use of var keyword",
          severity: "LOW",
          recommendation: "Use let or const instead of var for better scoping"
        }
      ]
    };
  }
  async evaluateBranch(branchName) {
    console.log(`\n🔒 Evaluating security for branch: ${branchName}`);
    const branchResults = {
      branch: branchName,
      issues: {
        critical: [],
        high: [],
        medium: [],
        low: []
      },
      fileScans: {},
      metrics: {
        totalFiles: 0,
        scannedFiles: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        securityScore: 100
      },
      recommendations: []
    };
    try {
      // Checkout branch
      await execAsync(`git checkout ${branchName}`);
      // Get changed files compared to main
      const { stdout: changedFiles } = await execAsync('git diff --name-only main');
      const files = changedFiles.split('\n').filter(f => f.trim() && this.shouldScanFile(f));
      console.log(`  📁 Scanning ${files.length} changed files...`);
      branchResults.metrics.totalFiles = files.length;
      for (const filePath of files) {
        if (fs.existsSync(filePath)) {
          await this.scanFile(filePath, branchResults);
        }
      }
      // Calculate security score
      branchResults.metrics.securityScore = this.calculateSecurityScore(branchResults.metrics);
      // Generate file-specific recommendations
      this.generateSecurityRecommendations(branchResults);
      // Store results
      this.results.branches[branchName] = branchResults;
      console.log(`  ✅ Security scan complete`);
      console.log(`     Critical: ${branchResults.metrics.criticalIssues}`);
      console.log(`     High: ${branchResults.metrics.highIssues}`);
      console.log(`     Medium: ${branchResults.metrics.mediumIssues}`);
      console.log(`     Low: ${branchResults.metrics.lowIssues}`);
      console.log(`     Security Score: ${branchResults.metrics.securityScore}/100`);
    } catch (error) {
      console.error(`❌ Error scanning branch ${branchName}:`, error.message);
    }
    return branchResults;
  }
  shouldScanFile(filePath) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.env', '.md'];
    const excludePaths = ['node_modules/', '.git/', '.next/', 'dist/', 'build/'];
    // Check if file has scannable extension
    const hasValidExtension = extensions.some(ext => filePath.endsWith(ext));
    // Check if file is not in excluded paths
    const isNotExcluded = !excludePaths.some(exclude => filePath.includes(exclude));
    return hasValidExtension && isNotExcluded;
  }
  async scanFile(filePath, branchResults) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      branchResults.metrics.scannedFiles++;
      const fileResults = {
        path: filePath,
        size: content.length,
        issues: {
          critical: [],
          high: [],
          medium: [],
          low: []
        },
        metrics: {
          linesOfCode: content.split('\n').length,
          hasSecurityImports: false,
          hasAuthenticationCode: false,
          hasDataValidation: false
        }
      };
      // Scan for security patterns
      this.scanForPatterns(content, fileResults, filePath);
      // Additional security checks
      this.performAdditionalChecks(content, fileResults, filePath);
      // Update branch metrics
      branchResults.metrics.criticalIssues += fileResults.issues.critical.length;
      branchResults.metrics.highIssues += fileResults.issues.high.length;
      branchResults.metrics.mediumIssues += fileResults.issues.medium.length;
      branchResults.metrics.lowIssues += fileResults.issues.low.length;
      // Add to branch results
      branchResults.issues.critical.push(...fileResults.issues.critical);
      branchResults.issues.high.push(...fileResults.issues.high);
      branchResults.issues.medium.push(...fileResults.issues.medium);
      branchResults.issues.low.push(...fileResults.issues.low);
      branchResults.fileScans[filePath] = fileResults;
    } catch (error) {
      console.error(`    ❌ Error scanning ${filePath}:`, error.message);
    }
  }
  scanForPatterns(content, fileResults, filePath) {
    const allPatterns = [
      ...this.results.patterns.critical,
      ...this.results.patterns.high,
      ...this.results.patterns.medium,
      ...this.results.patterns.low
    ];
    const lines = content.split('\n');
    allPatterns.forEach(patternData => {
      const matches = content.match(patternData.pattern);
      if (matches) {
        matches.forEach(match => {
          // Find line number
          let lineNumber = 1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(match)) {
              lineNumber = i + 1;
              break;
            }
          }
          const issue = {
            file: filePath,
            line: lineNumber,
            match: match.trim(),
            description: patternData.description,
            severity: patternData.severity,
            recommendation: patternData.recommendation,
            context: lines[lineNumber - 1]?.trim() || ''
          };
          const severity = patternData.severity.toLowerCase();
          fileResults.issues[severity].push(issue);
        });
      }
    });
  }
  performAdditionalChecks(content, fileResults, filePath) {
    // Check for security-related imports
    const securityImports = [
      'bcrypt', 'crypto', 'helmet', 'cors', 'express-rate-limit',
      'jsonwebtoken', 'passport', 'validator'
    ];
    securityImports.forEach(importName => {
      if (content.includes(`import`) && content.includes(importName) ||
          content.includes(`require`) && content.includes(importName)) {
        fileResults.metrics.hasSecurityImports = true;
      }
    });
    // Check for authentication patterns
    const authPatterns = ['authentication', 'authorization', 'jwt', 'token', 'login', 'password'];
    authPatterns.forEach(pattern => {
      if (content.toLowerCase().includes(pattern)) {
        fileResults.metrics.hasAuthenticationCode = true;
      }
    });
    // Check for data validation
    const validationPatterns = ['validate', 'sanitize', 'escape', 'filter'];
    validationPatterns.forEach(pattern => {
      if (content.toLowerCase().includes(pattern)) {
        fileResults.metrics.hasDataValidation = true;
      }
    });
    // Check for hardcoded secrets
    const secretPatterns = [
      /api[_-]?key[_-]?=\s*["'][^"']+["']/gi,
      /secret[_-]?key[_-]?=\s*["'][^"']+["']/gi,
      /password[_-]?=\s*["'][^"']+["']/gi,
      /token[_-]?=\s*["'][a-zA-Z0-9]{20,}["']/gi
    ];
    secretPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lines = content.split('\n');
          let lineNumber = 1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(match)) {
              lineNumber = i + 1;
              break;
            }
          }
          fileResults.issues.critical.push({
            file: filePath,
            line: lineNumber,
            match: match.replace(/["'][^"']*["']/, '"***"'), // Hide actual secret
            description: "Hardcoded secret detected",
            severity: "CRITICAL",
            recommendation: "Move secrets to environment variables or secure configuration",
            context: lines[lineNumber - 1]?.replace(/["'][^"']*["']/, '"***"') || ''
          });
        });
      }
    });
    // Check for SQL injection risks
    if (content.includes('sql') || content.includes('query')) {
      const sqlInjectionPatterns = [
        /query\s*\([^)]*\+[^)]*\)/gi,
        /execute\s*\([^)]*\+[^)]*\)/gi,
        /\$\{[^}]*\}/gi // Template literals in SQL
      ];
      sqlInjectionPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            fileResults.issues.high.push({
              file: filePath,
              line: 1, // Would need more complex line detection
              match: match.trim(),
              description: "Potential SQL injection vulnerability",
              severity: "HIGH",
              recommendation: "Use parameterized queries or prepared statements",
              context: match.trim()
            });
          });
        }
      });
    }
  }
  calculateSecurityScore(metrics) {
    let score = 100;
    // Deduct points based on severity
    score -= metrics.criticalIssues * 25;
    score -= metrics.highIssues * 10;
    score -= metrics.mediumIssues * 5;
    score -= metrics.lowIssues * 1;
    return Math.max(0, score);
  }
  generateSecurityRecommendations(branchResults) {
    const recommendations = [];
    if (branchResults.metrics.criticalIssues > 0) {
      recommendations.push({
        priority: "CRITICAL",
        message: `${branchResults.metrics.criticalIssues} critical security issues found. These must be fixed before deployment.`,
        action: "Review and fix all critical issues immediately"
      });
    }
    if (branchResults.metrics.highIssues > 0) {
      recommendations.push({
        priority: "HIGH",
        message: `${branchResults.metrics.highIssues} high-severity security issues found.`,
        action: "Address high-severity issues in current sprint"
      });
    }
    // Check for authentication files without security imports
    const authFiles = Object.entries(branchResults.fileScans).filter(([path, scan]) =>
      scan.metrics.hasAuthenticationCode && !scan.metrics.hasSecurityImports
    );
    if (authFiles.length > 0) {
      recommendations.push({
        priority: "HIGH",
        message: "Authentication code found without security libraries.",
        action: "Add proper security libraries (bcrypt, helmet, etc.)"
      });
    }
    // Check for files with no data validation
    const filesWithoutValidation = Object.entries(branchResults.fileScans).filter(([path, scan]) =>
      path.includes('api/') && !scan.metrics.hasDataValidation
    );
    if (filesWithoutValidation.length > 0) {
      recommendations.push({
        priority: "MEDIUM",
        message: "API files found without input validation.",
        action: "Add input validation and sanitization to API endpoints"
      });
    }
    branchResults.recommendations = recommendations;
  }
  async generateReport() {
    console.log('\n🔒 Generating Security Evaluation Report...');
    // Calculate overall metrics
    const branches = Object.values(this.results.branches);
    if (branches.length > 0) {
      this.results.overall.criticalIssues = branches.reduce((sum, b) => sum + b.metrics.criticalIssues, 0);
      this.results.overall.highIssues = branches.reduce((sum, b) => sum + b.metrics.highIssues, 0);
      this.results.overall.mediumIssues = branches.reduce((sum, b) => sum + b.metrics.mediumIssues, 0);
      this.results.overall.lowIssues = branches.reduce((sum, b) => sum + b.metrics.lowIssues, 0);
      this.results.overall.totalFiles = branches.reduce((sum, b) => sum + b.metrics.totalFiles, 0);
      this.results.overall.securityScore = branches.reduce((sum, b) => sum + b.metrics.securityScore, 0) / branches.length;
    }
    // Save detailed results
    const reportPath = 'analysis/security-evaluation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync('analysis/SECURITY_EVALUATION_REPORT.md', markdownReport);
    console.log(`✅ Security Evaluation Report saved to ${reportPath}`);
    console.log(`📄 Markdown report saved to analysis/SECURITY_EVALUATION_REPORT.md`);
  }
  generateMarkdownReport() {
    const branches = Object.values(this.results.branches);
    const overall = this.results.overall;
    let report = `# Security Evaluation Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;
    // Overall security status
    report += `## Overall Security Status\n\n`;
    report += `| Metric | Count | Status |\n`;
    report += `|--------|-------|--------|\n`;
    report += `| Critical Issues | ${overall.criticalIssues} | ${overall.criticalIssues === 0 ? '✅' : '🚨'} |\n`;
    report += `| High Issues | ${overall.highIssues} | ${overall.highIssues === 0 ? '✅' : '⚠️'} |\n`;
    report += `| Medium Issues | ${overall.mediumIssues} | ${overall.mediumIssues <= 2 ? '✅' : '⚠️'} |\n`;
    report += `| Low Issues | ${overall.lowIssues} | ${overall.lowIssues <= 5 ? '✅' : '⚠️'} |\n`;
    report += `| Security Score | ${overall.securityScore.toFixed(1)}/100 | ${overall.securityScore >= 80 ? '✅' : overall.securityScore >= 60 ? '⚠️' : '🚨'} |\n`;
    report += `| Files Scanned | ${overall.totalFiles} | ℹ️ |\n\n`;
    // Security recommendations
    if (overall.criticalIssues > 0 || overall.highIssues > 0) {
      report += `## 🚨 Immediate Action Required\n\n`;
      if (overall.criticalIssues > 0) {
        report += `**CRITICAL:** ${overall.criticalIssues} critical security issues must be fixed before deployment.\n\n`;
      }
      if (overall.highIssues > 0) {
        report += `**HIGH PRIORITY:** ${overall.highIssues} high-severity issues should be addressed immediately.\n\n`;
      }
    }
    // Branch-by-branch analysis
    report += `## Branch Security Analysis\n\n`;
    branches.forEach(branch => {
      report += `### ${branch.branch}\n\n`;
      report += `| Metric | Count |\n`;
      report += `|--------|---------|\n`;
      report += `| Critical | ${branch.metrics.criticalIssues} |\n`;
      report += `| High | ${branch.metrics.highIssues} |\n`;
      report += `| Medium | ${branch.metrics.mediumIssues} |\n`;
      report += `| Low | ${branch.metrics.lowIssues} |\n`;
      report += `| Security Score | ${branch.metrics.securityScore}/100 |\n`;
      report += `| Files Scanned | ${branch.metrics.scannedFiles}/${branch.metrics.totalFiles} |\n\n`;
      // Branch recommendations
      if (branch.recommendations.length > 0) {
        report += `**Recommendations:**\n`;
        branch.recommendations.forEach(rec => {
          const icon = rec.priority === 'CRITICAL' ? '🚨' : rec.priority === 'HIGH' ? '⚠️' : 'ℹ️';
          report += `- ${icon} **${rec.priority}**: ${rec.message}\n`;
          report += `  - Action: ${rec.action}\n`;
        });
        report += `\n`;
      }
      // Top issues for this branch
      const topIssues = [
        ...branch.issues.critical.slice(0, 3),
        ...branch.issues.high.slice(0, 3)
      ];
      if (topIssues.length > 0) {
        report += `**Top Issues:**\n`;
        topIssues.forEach(issue => {
          const icon = issue.severity === 'CRITICAL' ? '🚨' : '⚠️';
          report += `- ${icon} **${issue.severity}**: ${issue.description}\n`;
          report += `  - File: \`${issue.file}:${issue.line}\`\n`;
          report += `  - Code: \`${issue.match}\`\n`;
          report += `  - Fix: ${issue.recommendation}\n`;
        });
        report += `\n`;
      }
    });
    // Security patterns reference
    report += `## Security Patterns Checked\n\n`;
    report += `This evaluation checked for the following security patterns:\n\n`;
    const allPatterns = [
      ...this.results.patterns.critical,
      ...this.results.patterns.high,
      ...this.results.patterns.medium,
      ...this.results.patterns.low
    ];
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(severity => {
      const patterns = allPatterns.filter(p => p.severity === severity);
      if (patterns.length > 0) {
        report += `### ${severity} Severity\n\n`;
        patterns.forEach(pattern => {
          report += `- **${pattern.description}**\n`;
          report += `  - Recommendation: ${pattern.recommendation}\n`;
        });
        report += `\n`;
      }
    });
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
    console.log('🔒 Security Evaluator Agent - Starting Analysis...');
    try {
      for (const branch of branches) {
        await this.evaluateBranch(branch);
      }
      await this.generateReport();
    } catch (error) {
      console.error('❌ Security evaluation failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}
// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const evaluator = new SecurityEvaluator();
  if (args.includes('--help')) {
    console.log('Security Evaluator Agent');
    console.log('Usage:');
    console.log('  node security-evaluator.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help          Show this help');
    return;
  }
  await evaluator.run();
}
// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
module.exports = SecurityEvaluator;