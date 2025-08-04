# Agent Puppeteer Testing Guide

This guide helps agents understand how to use Puppeteer to test UI functionality directly in Context Pipeline.

## Prerequisites

**✅ Required Setup:**
1. Install Chrome for Puppeteer: `npx puppeteer browsers install chrome`
2. Ensure the development server is running: `npm run dev` (port 3001)
3. Use the MCP Puppeteer tools available in Claude Code

## Basic Puppeteer Usage

### 1. Navigate to Application
```javascript
// Always start by navigating to the app
await mcp__puppeteer__puppeteer_navigate({
  url: "http://localhost:3001",
  launchOptions: {
    "headless": false,  // Set to true for headless testing
    "executablePath": "/usr/bin/chromium-browser",
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  },
  allowDangerous: true
});
```

### 2. Take Screenshots
```javascript
// Take screenshots to see current state
await mcp__puppeteer__puppeteer_screenshot({
  name: "current-state-description"
});
```

### 3. Click Elements
```javascript
// Click buttons, links, or elements by text
await mcp__puppeteer__puppeteer_click({
  selector: "text=Button Text"
});

// Click by CSS selector
await mcp__puppeteer__puppeteer_click({
  selector: "button.primary"
});
```

### 4. Fill Forms
```javascript
// Fill input fields
await mcp__puppeteer__puppeteer_fill({
  selector: "input[placeholder='Enter text']",
  value: "Your text here"
});
```

### 5. Select Dropdowns
```javascript
// Select from dropdown menus
await mcp__puppeteer__puppeteer_select({
  selector: "select",
  value: "option-value"
});
```

### 6. Execute JavaScript
```javascript
// Run custom JavaScript to inspect or modify page state
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Find all select elements
    const selects = document.querySelectorAll('select');
    selects.forEach((sel, index) => {
      console.log('Select', index + ':', sel.innerHTML);
    });
    'JavaScript executed successfully';
  `
});
```

## Context Pipeline Specific Testing

### Testing Import Functionality

**1. Access Import Modal:**
```javascript
// Navigate to import
await mcp__puppeteer__puppeteer_click({ selector: "text=Import from Library" });
await mcp__puppeteer__puppeteer_click({ selector: "text=Import" });
```

**2. Test Git Import:**
```javascript
// Select Git Repositories
await mcp__puppeteer__puppeteer_click({ selector: "text=Git Repositories" });

// Select a query template  
await mcp__puppeteer__puppeteer_click({ selector: "text=Grab Entire Repository" });

// Execute query
await mcp__puppeteer__puppeteer_click({ selector: "text=Execute Query" });
```

**3. Test Credential Switching:**
```javascript
// Switch credentials using JavaScript evaluation
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    const selects = document.querySelectorAll('select');
    const credentialsSelect = selects[3]; // Usually the 4th select
    if (credentialsSelect) {
      credentialsSelect.value = 'git-repo-2'; // Change to different credential
      credentialsSelect.dispatchEvent(new Event('change'));
      'Changed credential successfully';
    } else {
      'Credentials select not found';
    }
  `
});
```

### Testing Workspace Functionality

**1. Create Workspace:**
```javascript
await mcp__puppeteer__puppeteer_click({ selector: "text=Create New Workspace" });
```

**2. Navigate Workspace Interface:**
```javascript
// Test file explorer, editor, terminal areas
await mcp__puppeteer__puppeteer_click({ selector: "[data-testid='file-explorer']" });
```

### Testing Agent Integration

**1. Deploy Agent:**
```javascript
// Click on agent in workspace
await mcp__puppeteer__puppeteer_click({ selector: "text=Claude" });
```

**2. Test Chat Interface:**
```javascript
// Fill chat input
await mcp__puppeteer__puppeteer_fill({
  selector: "textarea[placeholder*='message']",
  value: "Test message for agent"
});

// Send message
await mcp__puppeteer__puppeteer_click({ selector: "button[type='submit']" });
```

## Advanced Testing Patterns

### 1. Wait for Dynamic Content
```javascript
// Take multiple screenshots to wait for loading
await mcp__puppeteer__puppeteer_screenshot({ name: "before-action" });
// Perform action...
await mcp__puppeteer__puppeteer_screenshot({ name: "after-action" });
```

### 2. Inspect Element State
```javascript
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Check if element exists and is visible
    const element = document.querySelector('.target-element');
    if (element) {
      return {
        exists: true,
        visible: element.offsetParent !== null,
        text: element.textContent,
        classes: element.className
      };
    }
    return { exists: false };
  `
});
```

### 3. Form Validation Testing
```javascript
// Test required field validation
await mcp__puppeteer__puppeteer_fill({ selector: "#email", value: "invalid-email" });
await mcp__puppeteer__puppeteer_click({ selector: "button[type='submit']" });
await mcp__puppeteer__puppeteer_screenshot({ name: "validation-errors" });
```

### 4. Multi-Step Workflows
```javascript
// Test complete user flows
async function testCompleteImportFlow() {
  // Step 1: Open import
  await mcp__puppeteer__puppeteer_click({ selector: "text=Import" });
  await mcp__puppeteer__puppeteer_screenshot({ name: "step1-import-modal" });
  
  // Step 2: Select source
  await mcp__puppeteer__puppeteer_click({ selector: "text=Git Repositories" });
  await mcp__puppeteer__puppeteer_screenshot({ name: "step2-git-selected" });
  
  // Step 3: Configure and execute
  await mcp__puppeteer__puppeteer_click({ selector: "text=Grab Entire Repository" });
  await mcp__puppeteer__puppeteer_click({ selector: "text=Execute Query" });
  await mcp__puppeteer__puppeteer_screenshot({ name: "step3-query-executed" });
}
```

## Debugging Tips

### 1. Console Inspection
```javascript
// Check for JavaScript errors
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Log current page state
    console.log('Current URL:', window.location.href);
    console.log('Page title:', document.title);
    console.log('Active element:', document.activeElement);
    'Debug info logged';
  `
});
```

### 2. Element Discovery
```javascript
// Find elements when selectors don't work
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Find all buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      console.log('Button', i + ':', btn.textContent, btn.className);
    });
    
    // Find all inputs
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach((input, i) => {
      console.log('Input', i + ':', input.type, input.placeholder, input.name);
    });
    
    'Elements discovered';
  `
});
```

### 3. State Verification
```javascript
// Verify expected state after actions
await mcp__puppeteer__puppeteer_evaluate({
  script: `
    // Check if import results are visible
    const results = document.querySelector('[data-testid="import-results"]');
    const isVisible = results && results.offsetParent !== null;
    console.log('Import results visible:', isVisible);
    
    if (results) {
      console.log('Results content:', results.textContent);
    }
    
    isVisible ? 'Results are visible' : 'Results not found';
  `
});
```

## Common Selectors in Context Pipeline

| Element | Selector |
|---------|----------|
| Import Button | `text=Import` |
| Create Workspace | `text=Create New Workspace` |
| Git Repositories | `text=Git Repositories` |
| Execute Query | `text=Execute Query` |
| Credentials Dropdown | `select` (usually 4th select element) |
| Agent Chat Input | `textarea[placeholder*='message']` |
| File Explorer | `[data-testid='file-explorer']` |
| Monaco Editor | `.monaco-editor` |
| Terminal Area | `[data-testid='terminal']` |

## Error Handling

```javascript
try {
  await mcp__puppeteer__puppeteer_click({ selector: "text=Might Not Exist" });
} catch (error) {
  console.log('Element not found, trying alternative...');
  await mcp__puppeteer__puppeteer_click({ selector: ".alternative-selector" });
}
```

## Best Practices

1. **Always take screenshots** to understand current state
2. **Use descriptive names** for screenshots (e.g., "after-credential-switch")
3. **Test incrementally** - verify each step works before proceeding
4. **Handle dynamic content** by checking state before actions
5. **Use JavaScript evaluation** for complex element discovery
6. **Test error scenarios** as well as happy paths
7. **Clean up state** between tests if needed

## Example: Complete Test Script

```javascript
// Example: Test credential switching in Git import
async function testCredentialSwitching() {
  // 1. Navigate to app
  await mcp__puppeteer__puppeteer_navigate({
    url: "http://localhost:3001",
    launchOptions: { headless: false, executablePath: "/usr/bin/chromium-browser", args: ["--no-sandbox"] },
    allowDangerous: true
  });
  
  // 2. Open import modal
  await mcp__puppeteer__puppeteer_click({ selector: "text=Import from Library" });
  await mcp__puppeteer__puppeteer_click({ selector: "text=Import" });
  await mcp__puppeteer__puppeteer_click({ selector: "text=Git Repositories" });
  
  // 3. Test first credential
  await mcp__puppeteer__puppeteer_click({ selector: "text=Grab Entire Repository" });
  await mcp__puppeteer__puppeteer_screenshot({ name: "credential-1-selected" });
  await mcp__puppeteer__puppeteer_click({ selector: "text=Execute Query" });
  await mcp__puppeteer__puppeteer_screenshot({ name: "credential-1-results" });
  
  // 4. Switch to second credential
  await mcp__puppeteer__puppeteer_evaluate({
    script: `
      const selects = document.querySelectorAll('select');
      const credSelect = selects[3];
      if (credSelect) {
        credSelect.value = 'git-repo-2';
        credSelect.dispatchEvent(new Event('change'));
        'Switched to credential 2';
      } else {
        'Credential select not found';
      }
    `
  });
  
  // 5. Test second credential
  await mcp__puppeteer__puppeteer_click({ selector: "text=Execute Query" });
  await mcp__puppeteer__puppeteer_screenshot({ name: "credential-2-results" });
  
  // 6. Verify different results
  await mcp__puppeteer__puppeteer_evaluate({
    script: `
      const results = document.querySelector('.import-results');
      if (results) {
        console.log('Final results:', results.textContent);
        'Test completed successfully';
      } else {
        'No results found';
      }
    `
  });
}
```

This guide provides agents with everything they need to effectively test Context Pipeline's UI using Puppeteer!