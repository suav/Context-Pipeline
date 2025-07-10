# Server Management When Testing
This guide explains how the Next.js development server works and how to handle changes during testing.
## 🚀 How Next.js Development Server Works
### Current Setup
- **Framework**: Next.js 15.3.4 with Turbopack
- **Port**: http://localhost:3000
- **Hot Reload**: Automatic for most changes
- **API Routes**: Live reload enabled
### Server Status Check
```bash
# Check if server is running
curl -s http://localhost:3000/api/health
# Expected response:
{"status":"healthy","timestamp":"2025-06-28T01:08:33.378Z","pipeline":"context-import-v2-nextjs"}
```
## 🔄 When Changes Don't Load
### 1. Browser Caching Issues
**Problem**: Browser shows old version even after code changes
**Solution**: Hard refresh in browser
- **Chrome/Edge**: `Ctrl + Shift + R` or `Cmd + Shift + R`
- **Firefox**: `Ctrl + F5` or `Cmd + Shift + R`
- **Alternative**: Open private/incognito window
### 2. Next.js Hot Reload Stuck
**Problem**: Code changes but page doesn't update
**Solution**:
```bash
# Check development logs
tail -f dev.log
# Look for compilation errors or warnings
# Next.js should show: "✓ Compiled / in Xs"
```
### 3. Server Restart Required
**Problem**: Deep changes or configuration updates not reflecting
**Solution**:
```bash
# Kill the development server
pkill -f "next dev"
# Wait a moment
sleep 2
# Restart development server
npm run dev > dev.log 2>&1 &
# Wait for ready message (usually 30-60 seconds)
sleep 30
```
## 🛠️ Common Development Workflows
### Quick Code Changes
1. Edit React components in `src/app/page.tsx`
2. Save file (`Ctrl + S`)
3. Next.js automatically compiles (watch logs)
4. Browser auto-refreshes (or hard refresh if needed)
### API Route Changes
1. Edit files in `src/app/api/`
2. Save file
3. API endpoints update immediately
4. Test with curl: `curl http://localhost:3000/api/health`
### Major Structural Changes
1. Adding new dependencies (`npm install`)
2. Configuration changes (`next.config.ts`, `tailwind.config.ts`)
3. TypeScript type changes
4. **Requires full restart**
## 🔍 Troubleshooting Commands
### Check Server Status
```bash
# Is Next.js running?
ps aux | grep "next dev"
# Is port 3000 in use?
lsof -i :3000
# Recent logs
tail -20 dev.log
```
### Force Clean Restart
```bash
# Kill all Next.js processes
pkill -f "next"
# Clear Next.js cache (if issues persist)
rm -rf .next
# Full restart
npm run dev > dev.log 2>&1 &
```
### Monitor Real-time Changes
```bash
# Watch development logs
tail -f dev.log
# Look for these patterns:
# ✓ Compiled successfully    (good)
# ○ Compiling...             (in progress)
# ⚠ Warning                  (potential issue)
# ✗ Error                    (needs fixing)
```
## 📝 Development Log Patterns
### Successful Hot Reload
```
○ Compiling /page ...
✓ Compiled /page in 2.1s
GET / 200 in 124ms
```
### API Route Update
```
○ Compiling /api/health ...
✓ Compiled /api/health in 1.2s
GET /api/health 200 in 45ms
```
### Error State
```
✗ Failed to compile
./src/app/page.tsx
Error: ...
```
## 🎯 Testing Best Practices
### 1. Always Check Logs First
Before restarting, check `dev.log` to see what Next.js is doing
### 2. Use Browser Dev Tools
- Network tab: See if requests are being made
- Console: Check for JavaScript errors
- Elements: Verify HTML structure updated
### 3. Test API Endpoints Separately
```bash
# Test specific API routes
curl http://localhost:3000/api/health
curl http://localhost:3000/api/context-workflow/queries/jira
```
### 4. Incremental Testing
- Make small changes
- Test each change
- Don't batch multiple large changes
## ⚡ Quick Recovery Commands
```bash
# Emergency full restart
pkill -f "next" && sleep 3 && npm run dev > dev.log 2>&1 &
# Check if working
sleep 30 && curl -s http://localhost:3000/api/health
# Hard browser refresh
# Ctrl + Shift + R (or Cmd + Shift + R on Mac)
```
## 🚨 When All Else Fails
1. **Check Node.js version**: `node --version` (should be 18+)
2. **Reinstall dependencies**: `rm -rf node_modules && npm install`
3. **Clear all caches**: `rm -rf .next node_modules && npm install`
4. **Check for port conflicts**: `lsof -i :3000`
## 📊 Performance Notes
- **Initial startup**: 30-60 seconds (normal)
- **Hot reload**: 1-5 seconds (normal)
- **API responses**: <2 seconds (normal)
- **Full rebuild**: 10-30 seconds (after major changes)
---
**Current Status**: Next.js development server running on http://localhost:3000
**Last Updated**: June 28, 2025