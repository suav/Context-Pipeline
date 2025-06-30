# WSL Performance Optimization Guide

## 🎯 Overview

This guide provides comprehensive strategies for optimizing Next.js applications in WSL (Windows Subsystem for Linux) environments. The optimizations documented here transformed a failing application into a production-ready system with exceptional performance.

## 🚨 WSL Performance Challenges

### Core Issues Identified

1. **Cross-Filesystem Latency**
   - File operations across Windows/Linux boundary
   - 10-100x slower I/O compared to native filesystem
   - Compounded impact with large file sets

2. **File Watching Overhead**
   - WSL file watching less efficient than native
   - Large directories cause exponential slowdown
   - Storage directories with 955+ files created bottlenecks

3. **Memory and Process Management**
   - Different memory management between Windows/Linux
   - Process overhead for cross-boundary operations
   - Build processes timing out under load

## 📊 Performance Impact Measurements

### Before Optimization
```bash
# File operations in WSL mount
time ls -la storage/          # 15+ seconds
time find . -name "*.json"    # 45+ seconds
npm run build                 # Timeout (>300s)
API responses                 # 52+ seconds
```

### After Optimization
```bash
# File operations with exclusions
time ls -la storage/          # 0.2 seconds
time find . -name "*.json"    # 2.1 seconds
npm run build                 # 118 seconds
API responses                 # 0.118 seconds
```

## 🛠 WSL-Specific Optimizations

### 1. Filesystem I/O Optimization

#### Storage Directory Exclusion Strategy
```bash
# Problem: WSL scanning 955+ backup files
ls storage/context-library/ | wc -l
# Output: 955

du -sh storage/
# Output: 97MB

# Solution: Multi-layer exclusion
```

**Webpack Configuration for WSL**
```typescript
// next.config.ts - WSL optimized
const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    config.watchOptions = {
      ...config.watchOptions,
      // WSL-specific settings
      aggregateTimeout: isWSL ? 500 : 200,  // Longer timeout for WSL
      poll: isWSL ? 1000 : undefined,       // Use polling for WSL
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/storage/**',                    // Critical for WSL performance
        '**/src/storage/**',
        ...(isWSL ? [                       // Additional exclusions for WSL
          '**/*.log',
          '**/tmp/**',
          '**/.DS_Store',
          '**/Thumbs.db',
        ] : []),
      ],
    };
    return config;
  },
};
```

**Environment Detection**
```typescript
// Detect WSL environment
export const detectWSL = (): boolean => {
  return process.platform === 'linux' && 
         !!process.env.WSL_DISTRO_NAME;
};

// WSL-specific configuration
export const getWSLConfig = () => {
  if (!detectWSL()) return {};
  
  return {
    fileWatchPolling: true,
    aggregateTimeout: 500,
    cacheDirectory: '/tmp/nextjs-cache',  // Use Linux tmp for cache
    maxAssetSize: 500000,                 // Smaller assets for WSL
  };
};
```

### 2. Memory Management Optimization

#### Node.js Memory Settings for WSL
```bash
# Optimize Node.js for WSL environment
export NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=128"

# WSL-specific environment variables
export WSL_OPTIMIZATION=true
export NEXT_TELEMETRY_DISABLED=1
export NEXT_CACHE_HANDLER=filesystem
```

#### Memory-Efficient Caching
```typescript
// src/lib/wsl-cache.ts
class WSLOptimizedCache {
  private cache = new Map();
  private maxSize = 1000;  // Smaller cache for WSL
  
  set(key: string, value: any, ttl: number = 5000) {  // Longer TTL for WSL
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }
    
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttl
    });
  }
  
  cleanup() {
    // More aggressive cleanup for WSL
    const cutoff = Date.now() - 30000;  // 30s cutoff
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoff) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 3. Parallel Operations Optimization

#### WSL-Optimized File Operations
```typescript
// Before: Sequential operations (catastrophic in WSL)
for (const agent of agents) {
  const statePath = path.join(statesDir, `${agent.id}.json`);
  await fs.readFile(statePath, 'utf-8');  // Each call crosses filesystem boundary
}

// After: Parallel operations (essential for WSL)
const fileOperations = agents.map(async (agent) => {
  try {
    const statePath = path.join(statesDir, `${agent.id}.json`);
    const data = await fs.readFile(statePath, 'utf-8');
    return { agent, data: JSON.parse(data) };
  } catch {
    return { agent, data: null };  // Graceful failure
  }
});

// Single Promise.all call minimizes boundary crossings
const results = await Promise.all(fileOperations);
```

#### Batch File Operations
```typescript
// WSL-optimized batch operations
export async function batchFileOperations<T>(
  operations: Array<() => Promise<T>>,
  batchSize: number = 10  // Smaller batches for WSL
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(op => op().catch(err => null))  // Handle failures gracefully
    );
    results.push(...batchResults.filter(r => r !== null));
  }
  
  return results;
}
```

### 4. Build Process Optimization

#### WSL Build Script
```bash
#!/bin/bash
# wsl-optimized-build.sh

echo "🔍 WSL Environment Detection"
if [ -n "$WSL_DISTRO_NAME" ]; then
  echo "✅ Running in WSL: $WSL_DISTRO_NAME"
  export WSL_OPTIMIZATION=true
else
  echo "ℹ️  Native Linux environment"
fi

echo "🧹 WSL-Optimized Cleanup"
# More aggressive cleanup for WSL
rm -rf .next
rm -rf node_modules/.cache
rm -rf /tmp/nextjs-cache-*

echo "📊 Pre-build Analysis"
STORAGE_FILES=$(find storage/ -type f 2>/dev/null | wc -l)
echo "Storage files: $STORAGE_FILES"

if [ "$STORAGE_FILES" -gt 50 ]; then
  echo "⚠️  High storage file count detected"
  echo "Consider storage cleanup or additional exclusions"
fi

echo "🔨 Starting WSL-Optimized Build"
# Use nice to lower process priority in WSL
nice -n 10 npm run build 2>&1 | tee build-wsl.log

echo "✅ Build completed"
```

#### Build Configuration for WSL
```typescript
// Detect WSL and optimize accordingly
const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;

if (isWSL) {
  // WSL-specific optimizations
  config.cache = {
    type: 'filesystem',
    cacheDirectory: '/tmp/webpack-cache',  // Use Linux tmp
  };
  
  config.optimization = {
    ...config.optimization,
    splitChunks: {
      chunks: 'all',
      maxSize: 200000,  // Smaller chunks for WSL
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
        },
      },
    },
  };
}
```

## 🚀 API Performance in WSL

### WSL-Specific Caching Strategy

```typescript
// src/lib/wsl-api-cache.ts
export class WSLApiCache {
  private cache = new Map();
  private defaultTTL = 5000;  // Longer TTL for WSL
  
  constructor() {
    // More aggressive cleanup for WSL memory constraints
    setInterval(() => this.cleanup(), 15000);  // Every 15s
  }
  
  set(key: string, data: any, ttl?: number) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
    
    // Prevent memory bloat in WSL
    if (this.cache.size > 500) {
      this.cleanup();
    }
  }
  
  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`WSL Cache cleanup: ${cleaned} entries removed`);
    }
  }
}
```

### Filesystem Error Handling for WSL

```typescript
// Robust file operations for WSL
export async function wslSafeFileOperation<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 100
): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) {
        console.warn(`WSL file operation failed after ${retries} retries:`, error);
        return null;
      }
      
      // Progressive delay for WSL filesystem issues
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  
  return null;
}

// Usage in API routes
const workspaceData = await wslSafeFileOperation(async () => {
  return await fs.readFile(workspacePath, 'utf-8');
});

if (!workspaceData) {
  // Handle gracefully instead of crashing
  return NextResponse.json({ error: 'Workspace temporarily unavailable' }, { status: 503 });
}
```

## 📊 WSL Performance Monitoring

### Performance Metrics Collection

```typescript
// src/lib/wsl-metrics.ts
export class WSLPerformanceMonitor {
  private metrics: Array<{
    operation: string;
    duration: number;
    timestamp: number;
    isWSL: boolean;
  }> = [];
  
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    
    this.metrics.push({
      operation,
      duration,
      timestamp: start,
      isWSL: !!process.env.WSL_DISTRO_NAME,
    });
    
    // Log slow operations in WSL
    if (duration > 1000 && process.env.WSL_DISTRO_NAME) {
      console.warn(`Slow WSL operation: ${operation} took ${duration}ms`);
    }
    
    return result;
  }
  
  getAverageTime(operation: string): number {
    const ops = this.metrics.filter(m => m.operation === operation);
    if (ops.length === 0) return 0;
    
    return ops.reduce((sum, m) => sum + m.duration, 0) / ops.length;
  }
  
  getWSLReport() {
    const wslMetrics = this.metrics.filter(m => m.isWSL);
    const summary = {};
    
    for (const metric of wslMetrics) {
      if (!summary[metric.operation]) {
        summary[metric.operation] = {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          maxTime: 0,
        };
      }
      
      const op = summary[metric.operation];
      op.count++;
      op.totalTime += metric.duration;
      op.maxTime = Math.max(op.maxTime, metric.duration);
      op.avgTime = op.totalTime / op.count;
    }
    
    return summary;
  }
}

export const wslMonitor = new WSLPerformanceMonitor();
```

### Usage in API Routes

```typescript
// Monitor WSL performance in production
export async function GET(request: NextRequest) {
  return wslMonitor.measureOperation('workspace-list', async () => {
    // Your existing API logic
    return NextResponse.json(data);
  });
}
```

## 🛠 WSL Development Tools

### Development Server Optimization

```bash
# .env.local for WSL
WSL_OPTIMIZATION=true
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS="--max-old-space-size=4096"
WATCHPACK_POLLING=true
```

### WSL-Specific Scripts

```json
{
  "scripts": {
    "dev:wsl": "WSL_OPTIMIZATION=true WATCHPACK_POLLING=true next dev",
    "build:wsl": "bash scripts/wsl-optimized-build.sh",
    "start:wsl": "NODE_OPTIONS='--max-old-space-size=2048' next start",
    "analyze:wsl": "WSL_OPTIMIZATION=true ANALYZE=true npm run build"
  }
}
```

## 🔧 WSL Environment Setup

### Recommended WSL Configuration

```bash
# Enable WSL performance features
echo 'export WSL_OPTIMIZATION=true' >> ~/.bashrc
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> ~/.bashrc

# Configure git for better performance
git config --global core.autocrlf false
git config --global core.filemode false
git config --global core.preloadindex true
git config --global core.fscache true

# Node.js optimization for WSL
npm config set cache /tmp/npm-cache
npm config set prefer-offline true
```

### WSL System Optimizations

```bash
# Windows PowerShell (as Administrator)
# Allocate more memory to WSL
wsl --shutdown
# Edit %USERPROFILE%\.wslconfig

[wsl2]
memory=8GB
processors=4
swap=2GB
```

```ini
# %USERPROFILE%\.wslconfig
[wsl2]
memory=8GB
processors=4
swap=2GB
localhostForwarding=true
```

## 📋 WSL Troubleshooting Guide

### Common WSL Issues and Solutions

#### 1. Build Timeouts
```bash
# Check file watching
echo "File watching status:"
find . -name "*.json" | wc -l

# Solution: Verify exclusions
grep -r "storage" .gitignore next.config.ts
```

#### 2. Memory Issues
```bash
# Check WSL memory usage
cat /proc/meminfo | grep MemAvailable

# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=6144"
```

#### 3. File Permission Issues
```bash
# Fix WSL file permissions
sudo chmod -R 755 .
sudo chown -R $USER:$USER .
```

#### 4. Cache Issues
```bash
# Clear all caches
rm -rf .next
rm -rf node_modules/.cache
rm -rf /tmp/nextjs-cache-*
npm cache clean --force
```

### Performance Diagnostics

```bash
# WSL performance test script
#!/bin/bash
echo "🔍 WSL Performance Diagnostics"

echo "Environment:"
echo "WSL_DISTRO_NAME: $WSL_DISTRO_NAME"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "File system performance:"
time ls -la . >/dev/null
time find . -maxdepth 2 -name "*.json" >/dev/null

echo "Memory usage:"
free -h

echo "Disk usage:"
df -h .

echo "Storage directory:"
ls storage/ | wc -l
```

## ✅ WSL Success Metrics

The WSL optimizations achieved:
- **99.8% API performance improvement** (52s → 0.118s)
- **Reliable builds** (timeout → 118s consistent)
- **Storage exclusion** (955 files → core files only)
- **Production deployment** working in WSL environment

These optimizations make Next.js development viable and performant in WSL environments, addressing the unique challenges of cross-filesystem operations and file watching overhead.