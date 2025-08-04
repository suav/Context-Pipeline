# Puppeteer Primitive Actions Library

## 🎯 Philosophy

**One Action = One Script**. Every tiny UI interaction gets its own primitive script that can be composed into larger workflows.

## 📁 Architecture

```
puppeteer-primitives/
├── core/                    # Basic browser operations
│   ├── navigate-to-app.js
│   ├── take-screenshot.js
│   ├── wait-for-element.js
│   └── close-browser.js
├── ui/                      # UI component interactions  
│   ├── open-sidebar.js
│   ├── close-sidebar.js
│   ├── open-settings.js
│   └── close-modal.js
├── workspace/               # Workspace operations
│   ├── select-workspace.js
│   ├── create-workspace.js
│   └── navigate-to-workspace.js
├── agent/                   # Agent interactions
│   ├── deploy-agent.js
│   ├── submit-text-to-agent.js
│   ├── wait-for-agent-response.js
│   └── check-agent-status.js
├── file/                    # File operations
│   ├── open-file.js
│   ├── save-file.js
│   └── create-file.js
└── navigation/              # Page navigation
    ├── navigate-away.js
    ├── navigate-back.js
    └── refresh-page.js
```

## 🔧 Usage Pattern

### Individual Primitive
```javascript
const navigateToApp = require('./core/navigate-to-app.js');
await navigateToApp(page);
```

### Composite Test Script
```javascript
const navigateToApp = require('./core/navigate-to-app.js');
const selectWorkspace = require('./workspace/select-workspace.js');
const deployAgent = require('./agent/deploy-agent.js');
const submitText = require('./agent/submit-text-to-agent.js');

// Agent permanence test
await navigateToApp(page);
await selectWorkspace(page, 'workspace-id');
await deployAgent(page, 'claude');
await submitText(page, 'Analyze this workspace');
await navigateAway(page);
await navigateBack(page);
await submitText(page, 'What have you done so far?');
```

## 📋 Primitive Standards

### Function Signature
```javascript
/**
 * Primitive action description
 * @param {Page} page - Puppeteer page object
 * @param {any} params - Action-specific parameters
 * @returns {Promise<ActionResult>} - Standardized result object
 */
async function primitiveAction(page, params = {}) {
  // Implementation
}
```

### Return Format
```javascript
{
  success: boolean,
  action: 'action-name',
  data: any,           // Action-specific return data
  screenshot: string,  // Screenshot filename if taken
  error: string,       // Error message if failed
  duration: number     // Milliseconds taken
}
```

### Error Handling
- Never throw exceptions
- Always return success/failure status
- Include error details in result object
- Take screenshot on failure for debugging

## 🎯 Benefits

1. **Reusability** - Use same primitive in multiple test scenarios
2. **Maintainability** - UI changes only require updating one primitive
3. **Debugging** - Test individual actions in isolation
4. **Composability** - Mix and match to create complex workflows
5. **Reliability** - Each primitive thoroughly tested and robust