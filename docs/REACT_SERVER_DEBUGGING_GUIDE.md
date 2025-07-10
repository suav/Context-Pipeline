# React Server Debugging Guide
## 🚨 Emergency Quick Reference
ALWAYS CHECK FOR TYPESCRIPT ERRORS IN MODIFIED CODE BEFORE RESTARTING SERVER OR TELLING USER TO TEST. IF THE BUILD DIDNT GO, THOSE CHANGES WONT BE REFLECTED.
ALWAYS WRITE NPM RUN COMMANDS INTO A FILE TO LOG/KEEP IT GOING IN ANOTHER PROCESS
### Server Won't Start or Port Already in Use
```bash
# Kill any process on port 3000
lsof -ti:3000 | xargs kill -9
# Alternative: kill all Next.js processes
pkill -f "next"
# Wait a moment then restart
sleep 3 && npm run dev
```
### Full Rebuild with Cache Clear (For Component/Layout Changes)
```bash
# Complete rebuild when changes don't appear
pkill -f "next dev"
rm -rf .next
npm run dev > dev.log 2>&1 &
# Check if server is ready
sleep 30 && curl -s http://localhost:3000/api/health
```
### Changes Not Showing After Save
1. **Hard refresh browser**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Check compilation status** in terminal - look for "✓ Compiled"
3. **If stuck**, restart server (see above)
## 📋 Pre-Flight Checklist
Before debugging, always check:
1. **Is the server running?**
   ```bash
   ps aux | grep "next dev"
   ```
2. **Is port 3000 available?**
   ```bash
   lsof -i :3000
   ```
3. **Are there compilation errors?**
   ```bash
   tail -20 dev.log
   ```
4. **Is the API responding?**
   ```bash
   curl http://localhost:3000/api/health
   ```
## 🔍 Common Issues & Solutions
### 1. Port Already in Use Error
**Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`
**Solution**:
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
# If that doesn't work, kill all Node processes
pkill -f node
# Restart server
npm run dev
```
### 2. Component Changes Not Reflecting
**Symptom**: You edit a component but changes don't appear
**Debugging Steps**:
1. **Check for TypeScript errors**:
   ```bash
   npx tsc --noEmit
   ```
2. **Look for compilation errors in logs**:
   ```bash
   tail -f dev.log | grep -E "(Error|Failed|✗)"
   ```
3. **Test specific component in isolation**:
   ```tsx
   // Create test-component.tsx in src/app/
   export default function TestComponent() {
     return <div>Test: {new Date().toISOString()}</div>
   }
   ```
4. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   npm run dev
   ```
### 3. "Module not found" Errors
**Symptom**: `Module not found: Can't resolve '@/components/...'`
**Solutions**:
1. **Check import paths** - ensure using correct alias:
   ```tsx
   // Correct
   import Component from '@/components/Component'
   // Incorrect
   import Component from '../components/Component'
   ```
2. **Verify file exists**:
   ```bash
   ls src/components/
   ```
3. **Check tsconfig.json paths**:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```
### 4. Build/Compile Errors
**Symptom**: Page shows "500 Internal Server Error" or blank
**Debug Process**:
1. **Run type check**:
   ```bash
   npx tsc --noEmit
   ```
2. **Run lint**:
   ```bash
   npm run lint
   ```
3. **Check individual files**:
   ```bash
   # Test compile specific file
   npx tsc src/app/page.tsx --noEmit
   ```
4. **Isolate problem component**:
   ```tsx
   // Temporarily comment out components one by one
   // in src/app/page.tsx to find the culprit
   ```
### 5. API Routes Not Working
**Symptom**: API calls return 404 or don't update
**Solutions**:
1. **Verify route structure**:
   ```
   src/app/api/
   └── health/
       └── route.ts  // Must be named 'route.ts'
   ```
2. **Test API directly**:
   ```bash
   curl -X GET http://localhost:3000/api/health
   curl -X POST http://localhost:3000/api/context-workflow/queries/jira
   ```
3. **Check route handler exports**:
   ```typescript
   // route.ts must export named functions
   export async function GET() { }
   export async function POST() { }
   ```
## 🛠️ Advanced Debugging Techniques
### 1. Component-by-Component Testing
When the app won't build, test components individually:
```tsx
// src/app/test/page.tsx
import { Suspense } from 'react'
// Import one component at a time
import Component1 from '@/components/Component1'
// import Component2 from '@/components/Component2'
export default function TestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component1 />
      {/* Add components one by one */}
    </Suspense>
  )
}
```
### 2. Progressive Feature Testing
1. **Start with minimal page**:
   ```tsx
   // src/app/page.tsx
   export default function Page() {
     return <div>Hello World</div>
   }
   ```
2. **Add features incrementally**:
   - Static content first
   - Client components next
   - API calls last
### 3. Logging Strategy
Add strategic console logs:
```tsx
// In components
console.log('[ComponentName] Rendering:', { props, state })
// In API routes
console.log('[API Route] Request:', { method, body })
// In data fetching
console.log('[Fetch] URL:', url, 'Response:', response.status)
```
### 4. Network Debugging
Use browser DevTools Network tab:
1. Filter by "Fetch/XHR"
2. Check request URLs match expectations
3. Verify response status codes
4. Inspect response payloads
## 📊 Performance Debugging
### Slow Hot Reload
1. **Check for large files**:
   ```bash
   find src -name "*.ts*" -size +100k
   ```
2. **Monitor compilation time**:
   ```bash
   tail -f dev.log | grep "Compiled"
   ```
3. **Reduce imported modules**:
   - Use dynamic imports for large libraries
   - Split large components
### Memory Issues
1. **Check Node memory usage**:
   ```bash
   ps aux | grep node | awk '{print $2, $4"%", $11}'
   ```
2. **Increase memory if needed**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run dev
   ```
## 🔄 Full Reset Procedure
When nothing else works:
```bash
# 1. Stop all processes
pkill -f "next"
pkill -f "node"
# 2. Clean everything
rm -rf .next
rm -rf node_modules
rm package-lock.json
# 3. Reinstall
npm install
# 4. Start fresh
npm run dev
```
## 📝 Debugging Checklist
Before asking for help, check:
- [ ] Server is running (`ps aux | grep next`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No lint errors (`npm run lint`)
- [ ] Browser hard refreshed (`Ctrl+Shift+R`)
- [ ] Checked browser console for errors
- [ ] Tested in incognito/private window
- [ ] API endpoints responding (`curl localhost:3000/api/health`)
- [ ] Checked dev.log for compilation errors
- [ ] Tried component in isolation
- [ ] Cleared Next.js cache (`.next` folder)
## 🚀 Best Practices
1. **Always check logs first** - Most errors are clearly shown
2. **Test incrementally** - Don't make 10 changes at once
3. **Use TypeScript** - Catches errors before runtime
4. **Keep components small** - Easier to debug
5. **Use proper error boundaries** - Prevents whole app crashes
6. **Commit working code frequently** - Easy rollback if needed
## 🔗 Useful Commands Reference
```bash
# Server Management
npm run dev                          # Start dev server
pkill -f "next"                     # Kill Next.js
lsof -ti:3000 | xargs kill -9      # Kill port 3000
# Debugging
tail -f dev.log                     # Watch logs
npx tsc --noEmit                    # Type check
npm run lint                        # Lint check
# Cleanup
rm -rf .next                        # Clear build cache
rm -rf node_modules && npm install # Full reinstall
# Testing
curl http://localhost:3000/api/health  # Test API
```
## 📞 When to Restart vs. When to Debug
**Restart when**:
- Added new dependencies
- Changed configuration files
- Modified environment variables
- Seeing "stale" compilation
**Debug when**:
- TypeScript errors
- Component not rendering
- API returning wrong data
- Specific feature broken
Remember: Most Next.js issues are solved by checking TypeScript errors and doing a hard browser refresh!