#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
class SecurityPatchAgent {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      branches: {},
      patchesApplied: 0,
      issuesFixed: 0,
      securityImprovements: [],
      warnings: []
    };
    this.securityPatches = {
      // Environment variable exposure fixes
      envVarExposure: {
        pattern: /process\.env\.([A-Z_]+)/g,
        fix: this.fixEnvironmentVariableExposure.bind(this),
        description: "Fix environment variable exposure in client code"
      },
      // Insecure HTTP requests
      insecureHttp: {
        pattern: /fetch\([^)]*['"]http:\/\/[^'"]*['"]/g,
        fix: this.fixInsecureHttpRequests.bind(this),
        description: "Convert HTTP requests to HTTPS"
      },
      // Dangerous innerHTML usage
      dangerousInnerHTML: {
        pattern: /innerHTML\s*=\s*[^`'"]*\+/g,
        fix: this.fixDangerousInnerHTML.bind(this),
        description: "Replace dangerous innerHTML with safer alternatives"
      },
      // Console logging of sensitive data
      sensitiveConsoleLog: {
        pattern: /console\.log\([^)]*(?:password|token|secret|key)[^)]*\)/gi,
        fix: this.fixSensitiveConsoleLog.bind(this),
        description: "Remove sensitive data from console logs"
      },
      // Math.random() for security
      unsafeRandom: {
        pattern: /Math\.random\(\)/g,
        fix: this.fixUnsafeRandom.bind(this),
        description: "Replace Math.random() with crypto-secure alternatives"
      },
      // Hardcoded secrets
      hardcodedSecrets: {
        pattern: /(api[_-]?key|secret[_-]?key|password)[_-]?\s*[:=]\s*["'][^"']{8,}["']/gi,
        fix: this.fixHardcodedSecrets.bind(this),
        description: "Move hardcoded secrets to environment variables"
      }
    };
  }
  async patchBranch(branchName) {
    console.log(`\n🔧 Applying security patches to branch: ${branchName}`);
    const branchResults = {
      branch: branchName,
      patchesApplied: 0,
      issuesFixed: 0,
      filesModified: [],
      securityImprovements: [],
      warnings: []
    };
    try {
      // Checkout branch
      await execAsync(`git checkout ${branchName}`);
      // Get changed files compared to main
      const { stdout: changedFiles } = await execAsync('git diff --name-only main');
      const files = changedFiles.split('\n').filter(f => f.trim() && this.shouldPatchFile(f));
      console.log(`  📁 Patching ${files.length} files...`);
      for (const filePath of files) {
        if (fs.existsSync(filePath)) {
          const patchResult = await this.patchFile(filePath, branchResults);
          if (patchResult.modified) {
            branchResults.filesModified.push(filePath);
          }
        }
      }
      // Add security configuration files
      await this.addSecurityConfiguration(branchResults);
      // Add input validation middleware
      await this.addInputValidation(branchResults);
      // Store results
      this.results.branches[branchName] = branchResults;
      console.log(`  ✅ Security patching complete`);
      console.log(`     Patches Applied: ${branchResults.patchesApplied}`);
      console.log(`     Issues Fixed: ${branchResults.issuesFixed}`);
      console.log(`     Files Modified: ${branchResults.filesModified.length}`);
    } catch (error) {
      console.error(`❌ Error patching branch ${branchName}:`, error.message);
      branchResults.warnings.push(`Patching failed: ${error.message}`);
    }
    return branchResults;
  }
  shouldPatchFile(filePath) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    const excludePaths = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', 'analysis/'];
    // Check if file has patchable extension
    const hasValidExtension = extensions.some(ext => filePath.endsWith(ext));
    // Check if file is not in excluded paths
    const isNotExcluded = !excludePaths.some(exclude => filePath.includes(exclude));
    return hasValidExtension && isNotExcluded;
  }
  async patchFile(filePath, branchResults) {
    try {
      const originalContent = fs.readFileSync(filePath, 'utf8');
      let modifiedContent = originalContent;
      let filePatched = false;
      let patchCount = 0;
      // Apply each security patch
      for (const [patchName, patchConfig] of Object.entries(this.securityPatches)) {
        const patchResult = patchConfig.fix(modifiedContent, filePath);
        if (patchResult.modified) {
          modifiedContent = patchResult.content;
          filePatched = true;
          patchCount += patchResult.patchCount || 1;
          branchResults.securityImprovements.push({
            file: filePath,
            patch: patchName,
            description: patchConfig.description,
            changes: patchResult.changes || []
          });
        }
      }
      // Write modified content if changes were made
      if (filePatched) {
        fs.writeFileSync(filePath, modifiedContent);
        branchResults.patchesApplied += patchCount;
        branchResults.issuesFixed += patchCount;
        console.log(`    🔧 Patched ${filePath} (${patchCount} fixes)`);
      }
      return { modified: filePatched, patchCount };
    } catch (error) {
      console.error(`    ❌ Error patching ${filePath}:`, error.message);
      branchResults.warnings.push(`Failed to patch ${filePath}: ${error.message}`);
      return { modified: false, patchCount: 0 };
    }
  }
  // Security patch implementations
  fixEnvironmentVariableExposure(content, filePath) {
    const pattern = /process\.env\.([A-Z_]+)/g;
    let modified = false;
    const changes = [];
    // Only fix if this is clearly client-side code
    const isClientSide = filePath.includes('/components/') ||
                         filePath.includes('/pages/') ||
                         filePath.includes('client') ||
                         content.includes('useEffect') ||
                         content.includes('useState');
    if (isClientSide) {
      const newContent = content.replace(pattern, (match, envVar) => {
        // Skip if it's already in a server-side context
        if (content.includes('getServerSideProps') ||
            content.includes('getStaticProps') ||
            filePath.includes('api/') ||
            filePath.includes('route.ts')) {
          return match;
        }
        modified = true;
        changes.push(`Removed client-side access to ${envVar}`);
        // Replace with a configuration approach
        return `config.${envVar.toLowerCase()}`;
      });
      if (modified) {
        // Add config import if not present
        if (!content.includes('import') || !content.includes('config')) {
          const configImport = "import { config } from '@/lib/config';\n";
          return {
            modified: true,
            content: configImport + newContent,
            changes: [...changes, 'Added secure configuration import']
          };
        }
      }
      return { modified, content: newContent, changes };
    }
    return { modified: false, content };
  }
  fixInsecureHttpRequests(content, filePath) {
    const pattern = /fetch\((['"])http:\/\/([^'"]*)\1/g;
    let modified = false;
    const changes = [];
    const newContent = content.replace(pattern, (match, quote, url) => {
      // Skip localhost URLs
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return match;
      }
      modified = true;
      changes.push(`Converted HTTP to HTTPS: ${url}`);
      return `fetch(${quote}https://${url}${quote}`;
    });
    return { modified, content: newContent, changes };
  }
  fixDangerousInnerHTML(content, filePath) {
    const pattern = /(\w+)\.innerHTML\s*=\s*([^;]+)/g;
    let modified = false;
    const changes = [];
    const newContent = content.replace(pattern, (match, element, value) => {
      // Skip if it's already sanitized
      if (value.includes('sanitize') || value.includes('escape')) {
        return match;
      }
      modified = true;
      changes.push(`Replaced dangerous innerHTML assignment on ${element}`);
      // Replace with textContent for simple cases
      if (!value.includes('+') && !value.includes('$')) {
        return `${element}.textContent = ${value}`;
      }
      // For complex cases, suggest createElement
      return `
    });
    return { modified, content: newContent, changes };
  }
  fixSensitiveConsoleLog(content, filePath) {
    const pattern = /console\.log\([^)]*(?:password|token|secret|key)[^)]*\)/gi;
    let modified = false;
    const changes = [];
    const newContent = content.replace(pattern, (match) => {
      modified = true;
      changes.push('Removed sensitive console.log statement');
      return '// console.log removed - contained sensitive data';
    });
    return { modified, content: newContent, changes };
  }
  fixUnsafeRandom(content, filePath) {
    const pattern = /Math\.random\(\)/g;
    let modified = false;
    const changes = [];
    // Only fix if this appears to be used for security purposes
    const securityContext = content.includes('token') ||
                           content.includes('id') ||
                           content.includes('session') ||
                           content.includes('nonce');
    if (securityContext) {
      const newContent = content.replace(pattern, (match) => {
        modified = true;
        changes.push('Replaced Math.random() with crypto.randomBytes()');
        return 'crypto.randomBytes(16).toString(\'hex\')';
      });
      if (modified && !content.includes('crypto')) {
        const cryptoImport = "const crypto = require('crypto');\n";
        return {
          modified: true,
          content: cryptoImport + newContent,
          changes: [...changes, 'Added crypto import']
        };
      }
      return { modified, content: newContent, changes };
    }
    return { modified: false, content };
  }
  fixHardcodedSecrets(content, filePath) {
    const pattern = /(api[_-]?key|secret[_-]?key|password)[_-]?\s*[:=]\s*["']([^"']{8,})["']/gi;
    let modified = false;
    const changes = [];
    const newContent = content.replace(pattern, (match, keyType, value) => {
      modified = true;
      const envVarName = keyType.toUpperCase().replace(/-/g, '_');
      changes.push(`Moved ${keyType} to environment variable ${envVarName}`);
      return `${keyType} = process.env.${envVarName} || ''`;
    });
    return { modified, content: newContent, changes };
  }
  async addSecurityConfiguration(branchResults) {
    console.log('    🛡️ Adding security configuration...');
    // Create security configuration file
    const securityConfigPath = 'src/lib/security-config.ts';
    const securityConfig = `
export const securityConfig = {
  // Content Security Policy
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.openai.com", "https://api.anthropic.com"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
  },
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  // CORS settings
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : true,
    credentials: true
  },
  // Input validation
  validation: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['.txt', '.md', '.json', '.csv'],
    maxStringLength: 10000
  }
};
// Sanitization utilities
export const sanitize = {
  html: (input: string): string => {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\\//g, '&#x2F;');
  },
  filename: (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\\.\\./g, '')
      .substring(0, 255);
  },
  workspaceId: (id: string): string => {
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
      throw new Error('Invalid workspace ID format');
    }
    return id.substring(0, 50);
  }
};
// Security headers middleware
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
`;
    if (!fs.existsSync(path.dirname(securityConfigPath))) {
      fs.mkdirSync(path.dirname(securityConfigPath), { recursive: true });
    }
    fs.writeFileSync(securityConfigPath, securityConfig);
    branchResults.securityImprovements.push({
      file: securityConfigPath,
      patch: 'security-config',
      description: 'Added comprehensive security configuration',
      changes: ['Created centralized security configuration']
    });
    branchResults.patchesApplied++;
  }
  async addInputValidation(branchResults) {
    console.log('    🔍 Adding input validation middleware...');
    // Create input validation middleware
    const validationMiddlewarePath = 'src/lib/validation-middleware.ts';
    const validationMiddleware = `
import { NextRequest, NextResponse } from 'next/server';
import { sanitize, securityConfig } from './security-config';
export // Duplicate type removed: ValidationRule (see ./src/lib/validation-middleware.ts)
export class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(\`Validation error for field '\${field}': \${message}\`);
    this.name = 'ValidationError';
  }
}
export function validateInput(data: any, rules: ValidationRule[]): any {
  const validated: any = {};
  for (const rule of rules) {
    const value = data[rule.field];
    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(rule.field, 'Field is required');
    }
    // Skip validation for optional empty fields
    if (!rule.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    // Type validation
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ValidationError(rule.field, 'Must be a string');
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          throw new ValidationError(rule.field, \`Must be no longer than \${rule.maxLength} characters\`);
        }
        if (value.length > securityConfig.validation.maxStringLength) {
          throw new ValidationError(rule.field, 'String too long');
        }
        validated[rule.field] = sanitize.html(value);
        break;
      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new ValidationError(rule.field, 'Must be a number');
        }
        validated[rule.field] = numValue;
        break;
      case 'email':
        if (typeof value !== 'string' || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
          throw new ValidationError(rule.field, 'Must be a valid email address');
        }
        validated[rule.field] = value.toLowerCase();
        break;
      case 'workspaceId':
        validated[rule.field] = sanitize.workspaceId(value);
        break;
      case 'filename':
        validated[rule.field] = sanitize.filename(value);
        break;
      default:
        validated[rule.field] = value;
    }
    // Pattern validation
    if (rule.pattern && !rule.pattern.test(validated[rule.field])) {
      throw new ValidationError(rule.field, 'Invalid format');
    }
  }
  return validated;
}
export // Duplicate function removed: withValidation (see ./src/lib/validation-middleware.ts);
        // Parse request data
        if (req.method === 'POST' || req.method === 'PUT') {
          const contentType = req.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await req.json();
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData();
            data = Object.fromEntries(formData.entries());
          }
        }
        // Add URL parameters
        const url = new URL(req.url);
        for (const [key, value] of url.searchParams.entries()) {
          data[key] = value;
        }
        // Validate input
        const validatedData = validateInput(data, rules);
        // Call the handler with validated data
        return await handler(req, validatedData);
      } catch (error) {
        if (error instanceof ValidationError) {
          return NextResponse.json(
            { error: 'Validation failed', details: error.message },
            { status: 400 }
          );
        }
        console.error('Validation middleware error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    };
  };
}
// Common validation rules
export const commonRules = {
  workspaceId: { field: 'workspaceId', type: 'workspaceId' as const, required: true },
  agentId: { field: 'agentId', type: 'string' as const, required: true, maxLength: 50 },
  message: { field: 'message', type: 'string' as const, required: true, maxLength: 10000 },
  filename: { field: 'filename', type: 'filename' as const, required: true },
  email: { field: 'email', type: 'email' as const, required: true }
};
`;
    if (!fs.existsSync(path.dirname(validationMiddlewarePath))) {
      fs.mkdirSync(path.dirname(validationMiddlewarePath), { recursive: true });
    }
    fs.writeFileSync(validationMiddlewarePath, validationMiddleware);
    branchResults.securityImprovements.push({
      file: validationMiddlewarePath,
      patch: 'input-validation',
      description: 'Added comprehensive input validation middleware',
      changes: ['Created input validation system with sanitization']
    });
    branchResults.patchesApplied++;
  }
  async generateReport() {
    console.log('\n🔧 Generating Security Patch Report...');
    // Calculate overall metrics
    const branches = Object.values(this.results.branches);
    if (branches.length > 0) {
      this.results.patchesApplied = branches.reduce((sum, b) => sum + b.patchesApplied, 0);
      this.results.issuesFixed = branches.reduce((sum, b) => sum + b.issuesFixed, 0);
      this.results.securityImprovements = branches.flatMap(b => b.securityImprovements);
      this.results.warnings = branches.flatMap(b => b.warnings);
    }
    // Save detailed results
    const reportPath = 'analysis/security-patch-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync('analysis/SECURITY_PATCH_REPORT.md', markdownReport);
    console.log(`✅ Security Patch Report saved to ${reportPath}`);
    console.log(`📄 Markdown report saved to analysis/SECURITY_PATCH_REPORT.md`);
  }
  generateMarkdownReport() {
    const branches = Object.values(this.results.branches);
    let report = `# Security Patch Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;
    // Summary
    report += `## Patch Summary\n\n`;
    report += `| Metric | Count |\n`;
    report += `|--------|-------|\n`;
    report += `| Total Patches Applied | ${this.results.patchesApplied} |\n`;
    report += `| Issues Fixed | ${this.results.issuesFixed} |\n`;
    report += `| Branches Patched | ${branches.length} |\n`;
    report += `| Security Improvements | ${this.results.securityImprovements.length} |\n`;
    report += `| Warnings | ${this.results.warnings.length} |\n\n`;
    // Branch-by-branch results
    report += `## Branch Patch Results\n\n`;
    branches.forEach(branch => {
      report += `### ${branch.branch}\n\n`;
      report += `| Metric | Count |\n`;
      report += `|--------|-------|\n`;
      report += `| Patches Applied | ${branch.patchesApplied} |\n`;
      report += `| Issues Fixed | ${branch.issuesFixed} |\n`;
      report += `| Files Modified | ${branch.filesModified.length} |\n\n`;
      if (branch.securityImprovements.length > 0) {
        report += `**Security Improvements:**\n`;
        branch.securityImprovements.forEach(improvement => {
          report += `- 🔧 **${improvement.patch}**: ${improvement.description}\n`;
          report += `  - File: \`${improvement.file}\`\n`;
          if (improvement.changes && improvement.changes.length > 0) {
            improvement.changes.forEach(change => {
              report += `  - Change: ${change}\n`;
            });
          }
        });
        report += `\n`;
      }
      if (branch.warnings.length > 0) {
        report += `**Warnings:**\n`;
        branch.warnings.forEach(warning => {
          report += `- ⚠️ ${warning}\n`;
        });
        report += `\n`;
      }
    });
    // Security improvements added
    if (this.results.securityImprovements.length > 0) {
      report += `## Security Infrastructure Added\n\n`;
      const infrastructureImprovements = this.results.securityImprovements.filter(
        imp => ['security-config', 'input-validation'].includes(imp.patch)
      );
      infrastructureImprovements.forEach(improvement => {
        report += `### ${improvement.description}\n`;
        report += `**File:** \`${improvement.file}\`\n\n`;
        report += `**Changes:**\n`;
        improvement.changes?.forEach(change => {
          report += `- ${change}\n`;
        });
        report += `\n`;
      });
    }
    // Next steps
    report += `## Next Steps\n\n`;
    report += `1. **Re-run Security Evaluation** - Verify patches have resolved security issues\n`;
    report += `2. **Test Functionality** - Ensure patches don't break existing features\n`;
    report += `3. **Update API Endpoints** - Apply input validation to all API routes\n`;
    report += `4. **Security Testing** - Perform penetration testing on patched code\n`;
    report += `5. **Documentation** - Update security documentation with new measures\n\n`;
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
    console.log('🔧 Security Patch Agent - Starting Security Fixes...');
    try {
      for (const branch of branches) {
        await this.patchBranch(branch);
      }
      await this.generateReport();
      console.log('\n✅ Security patching complete!');
      console.log(`🔧 Total patches applied: ${this.results.patchesApplied}`);
      console.log(`🛡️ Security issues fixed: ${this.results.issuesFixed}`);
    } catch (error) {
      console.error('❌ Security patching failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }
}
// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const patcher = new SecurityPatchAgent();
  if (args.includes('--help')) {
    console.log('Security Patch Agent');
    console.log('Usage:');
    console.log('  node security-patch-agent.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help          Show this help');
    console.log('');
    console.log('This agent automatically fixes critical security vulnerabilities');
    console.log('identified by the security evaluation agent.');
    return;
  }
  await patcher.run();
}
// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
module.exports = SecurityPatchAgent;