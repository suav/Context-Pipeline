#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.startTime = Date.now();
    this.resultsFile = 'performance-results.json';
  }
  // Measure build time
  async measureBuildTime() {
    console.log('📦 Measuring build time...');
    const start = performance.now();
    try {
      await execAsync('npm run build');
      const duration = performance.now() - start;
      this.metrics.buildTime = Math.round(duration);
      console.log(`✅ Build completed in ${Math.round(duration / 1000)}s`);
      return duration;
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      this.metrics.buildTime = -1;
      return -1;
    }
  }
  // Measure development server start time
  async measureDevStartTime() {
    console.log('🚀 Measuring dev server start time...');
    const start = performance.now();
    return new Promise((resolve) => {
      const devProcess = exec('npm run dev');
      let started = false;
      devProcess.stdout.on('data', (data) => {
        if (data.includes('Ready') || data.includes('Local:')) {
          if (!started) {
            started = true;
            const duration = performance.now() - start;
            this.metrics.devStartTime = Math.round(duration);
            console.log(`✅ Dev server started in ${Math.round(duration / 1000)}s`);
            devProcess.kill();
            resolve(duration);
          }
        }
      });
      // Timeout after 30 seconds
      setTimeout(() => {
        if (!started) {
          console.error('❌ Dev server failed to start within 30s');
          this.metrics.devStartTime = -1;
          devProcess.kill();
          resolve(-1);
        }
      }, 30000);
    });
  }
  // Measure bundle size
  async measureBundleSize() {
    console.log('📊 Measuring bundle size...');
    const buildDir = '.next';
    if (!fs.existsSync(buildDir)) {
      console.warn('⚠️ No build directory found, running build first...');
      await this.measureBuildTime();
    }
    try {
      const { stdout } = await execAsync('du -sh .next');
      const sizeMatch = stdout.match(/(\d+\.?\d*[KMG]?)\s/);
      const size = sizeMatch ? sizeMatch[1] : 'unknown';
      this.metrics.bundleSize = size;
      console.log(`📦 Bundle size: ${size}`);
      return size;
    } catch (error) {
      console.error('❌ Failed to measure bundle size:', error.message);
      this.metrics.bundleSize = 'unknown';
      return 'unknown';
    }
  }
  // Measure API response times
  async measureAPIResponseTimes() {
    console.log('🌐 Measuring API response times...');
    const endpoints = [
      '/api/workspaces',
      '/api/agents',
      '/api/context-workflow'
    ];
    this.metrics.apiResponseTimes = {};
    for (const endpoint of endpoints) {
      try {
        const start = performance.now();
        const response = await fetch(`http://localhost:3001${endpoint}`);
        const duration = performance.now() - start;
        this.metrics.apiResponseTimes[endpoint] = {
          duration: Math.round(duration),
          status: response.status,
          success: response.ok
        };
        console.log(`  ${endpoint}: ${Math.round(duration)}ms (${response.status})`);
      } catch (error) {
        this.metrics.apiResponseTimes[endpoint] = {
          duration: -1,
          status: 'error',
          success: false,
          error: error.message
        };
        console.log(`  ${endpoint}: ERROR - ${error.message}`);
      }
    }
  }
  // Measure file operations
  async measureFileOperations() {
    console.log('📁 Measuring file operations...');
    const testFile = 'temp-performance-test.txt';
    const testContent = 'Performance test content';
    // Write performance
    const writeStart = performance.now();
    fs.writeFileSync(testFile, testContent);
    const writeDuration = performance.now() - writeStart;
    // Read performance
    const readStart = performance.now();
    fs.readFileSync(testFile, 'utf8');
    const readDuration = performance.now() - readStart;
    // Delete performance
    const deleteStart = performance.now();
    fs.unlinkSync(testFile);
    const deleteDuration = performance.now() - deleteStart;
    this.metrics.fileOperations = {
      write: Math.round(writeDuration * 1000) / 1000, // microseconds precision
      read: Math.round(readDuration * 1000) / 1000,
      delete: Math.round(deleteDuration * 1000) / 1000
    };
    console.log(`  Write: ${this.metrics.fileOperations.write}ms`);
    console.log(`  Read: ${this.metrics.fileOperations.read}ms`);
    console.log(`  Delete: ${this.metrics.fileOperations.delete}ms`);
  }
  // Measure memory usage
  measureMemoryUsage() {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    console.log(`💾 Memory usage: ${this.metrics.memoryUsage.heapUsed}MB used / ${this.metrics.memoryUsage.heapTotal}MB total`);
  }
  // Load previous results for comparison
  loadPreviousResults() {
    try {
      if (fs.existsSync(this.resultsFile)) {
        const data = fs.readFileSync(this.resultsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('⚠️ Could not load previous results:', error.message);
    }
    return null;
  }
  // Save current results
  saveResults() {
    const results = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      totalTestTime: Date.now() - this.startTime
    };
    try {
      // Load existing results
      let allResults = [];
      if (fs.existsSync(this.resultsFile)) {
        const existing = fs.readFileSync(this.resultsFile, 'utf8');
        allResults = JSON.parse(existing);
      }
      // Add new results
      allResults.push(results);
      // Keep only last 10 results
      if (allResults.length > 10) {
        allResults = allResults.slice(-10);
      }
      fs.writeFileSync(this.resultsFile, JSON.stringify(allResults, null, 2));
      console.log(`💾 Results saved to ${this.resultsFile}`);
    } catch (error) {
      console.error('❌ Failed to save results:', error.message);
    }
  }
  // Compare with previous results
  compareResults() {
    const previous = this.loadPreviousResults();
    if (!previous || previous.length < 2) {
      console.log('📊 No previous results for comparison');
      return;
    }
    const prev = previous[previous.length - 2].metrics;
    const curr = this.metrics;
    console.log('\n📈 Performance Comparison:');
    if (prev.buildTime && curr.buildTime && prev.buildTime > 0 && curr.buildTime > 0) {
      const diff = curr.buildTime - prev.buildTime;
      const symbol = diff > 0 ? '📈' : '📉';
      console.log(`  Build Time: ${symbol} ${diff > 0 ? '+' : ''}${Math.round(diff/1000)}s`);
    }
    if (prev.bundleSize && curr.bundleSize) {
      console.log(`  Bundle Size: ${prev.bundleSize} → ${curr.bundleSize}`);
    }
    if (prev.memoryUsage && curr.memoryUsage) {
      const memDiff = curr.memoryUsage.heapUsed - prev.memoryUsage.heapUsed;
      const symbol = memDiff > 0 ? '📈' : '📉';
      console.log(`  Memory Usage: ${symbol} ${memDiff > 0 ? '+' : ''}${memDiff}MB`);
    }
  }
  // Generate performance report
  generateReport() {
    console.log('\n🎯 Performance Report:');
    console.log('═'.repeat(50));
    if (this.metrics.buildTime) {
      const status = this.metrics.buildTime < 4000 ? '✅' : '⚠️';
      console.log(`${status} Build Time: ${Math.round(this.metrics.buildTime/1000)}s (target: <4s)`);
    }
    if (this.metrics.devStartTime) {
      const status = this.metrics.devStartTime < 2000 ? '✅' : '⚠️';
      console.log(`${status} Dev Start: ${Math.round(this.metrics.devStartTime/1000)}s (target: <2s)`);
    }
    if (this.metrics.bundleSize) {
      console.log(`📦 Bundle Size: ${this.metrics.bundleSize}`);
    }
    if (this.metrics.memoryUsage) {
      const status = this.metrics.memoryUsage.heapUsed < 200 ? '✅' : '⚠️';
      console.log(`${status} Memory: ${this.metrics.memoryUsage.heapUsed}MB (heap used)`);
    }
    if (this.metrics.apiResponseTimes) {
      console.log('\n🌐 API Response Times:');
      for (const [endpoint, data] of Object.entries(this.metrics.apiResponseTimes)) {
        const status = data.success && data.duration < 1000 ? '✅' : '⚠️';
        console.log(`  ${status} ${endpoint}: ${data.duration}ms`);
      }
    }
    if (this.metrics.fileOperations) {
      const avgFileOp = (this.metrics.fileOperations.read + this.metrics.fileOperations.write) / 2;
      const status = avgFileOp < 1 ? '✅' : '⚠️';
      console.log(`${status} File Operations: ${avgFileOp.toFixed(2)}ms average`);
    }
    console.log('═'.repeat(50));
  }
  // Run comprehensive performance test
  async runFullTest() {
    console.log('🚀 Context Pipeline Performance Monitor');
    console.log('Starting comprehensive performance analysis...\n');
    // Measure memory at start
    this.measureMemoryUsage();
    // Build performance
    await this.measureBuildTime();
    // Bundle size
    await this.measureBundleSize();
    // Development server (skip in CI)
    if (!process.env.CI) {
      await this.measureDevStartTime();
    }
    // File operations
    await this.measureFileOperations();
    // Memory after tests
    this.measureMemoryUsage();
    // Save and compare results
    this.saveResults();
    this.compareResults();
    this.generateReport();
    console.log('\n✅ Performance analysis complete!');
  }
  // Quick performance check
  async runQuickTest() {
    console.log('⚡ Quick Performance Check\n');
    this.measureMemoryUsage();
    await this.measureFileOperations();
    await this.measureBundleSize();
    this.generateReport();
  }
}
// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const monitor = new PerformanceMonitor();
  if (args.includes('--help')) {
    console.log('Context Pipeline Performance Monitor');
    console.log('Usage:');
    console.log('  node performance-monitor.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --full          Run comprehensive performance test');
    console.log('  --quick         Run quick performance check');
    console.log('  --build-only    Measure build time only');
    console.log('  --report        Show latest performance report');
    console.log('  --compare       Compare with previous results');
    console.log('  --help          Show this help');
    return;
  }
  if (args.includes('--build-only')) {
    await monitor.measureBuildTime();
    monitor.generateReport();
  } else if (args.includes('--quick')) {
    await monitor.runQuickTest();
  } else if (args.includes('--report')) {
    const previous = monitor.loadPreviousResults();
    if (previous && previous.length > 0) {
      monitor.metrics = previous[previous.length - 1].metrics;
      monitor.generateReport();
    } else {
      console.log('No previous results found');
    }
  } else if (args.includes('--compare')) {
    monitor.compareResults();
  } else {
    await monitor.runFullTest();
  }
}
// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
module.exports = PerformanceMonitor;