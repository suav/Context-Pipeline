# Context Pipeline - UI Testing Framework

Comprehensive Puppeteer-based testing suite for validating all critical UI workflows in headful mode.

## 🎯 Overview

This testing framework validates that Context Pipeline's UI workflows remain functional and well-styled. Tests run in **headful mode** for visual validation and cover all critical user journeys.

## 📋 Test Structure

### Individual Test Scripts
- `01-basic-ui-validation.js` - Theme switching, navigation, responsive design
- `02-credentials-management.js` - JIRA/Git credential CRUD operations  
- `03-import-and-library.js` - Content import from all sources + library management
- `04-workspace-lifecycle.js` - Workspace creation, drafts, publishing, unpublishing
- `05-agent-interaction.js` - Agent deployment, chat, navigation persistence
- `06-file-editor-operations.js` - Monaco editor, file tree, CRUD operations
- `07-git-integration.js` - Git diff viewing, branch operations, staging
- `08-advanced-features.js` - Checkpoints, permissions, search, commands

### Pathway Test Suites
- `pathways/foundation-pathway.js` - Core UI + Credentials (must pass first)
- `pathways/content-pathway.js` - Import + Library Management
- `pathways/workflow-pathway.js` - Workspaces + Agents (core value prop)
- `pathways/integration-pathway.js` - Files + Git + Advanced Features

## 🚀 Running Tests

### Quick Test (3-5 minutes)
Tests foundation only - good for rapid validation:
```bash
node scripts/puppeteer-tests/run-quick-test.js
```

### Full Test Suite (15-20 minutes)
Comprehensive testing of all workflows:
```bash
node scripts/puppeteer-tests/run-all-tests.js
```

### Individual Tests
Run specific test scripts:
```bash
node scripts/puppeteer-tests/01-basic-ui-validation.js
node scripts/puppeteer-tests/05-agent-interaction.js
# etc.
```

## 📊 Test Pathways Explained

### 1. Foundation Pathway (CRITICAL)
**Dependencies**: None  
**Tests**: Basic UI + Credentials  
**Why Critical**: Nothing else works without proper UI and credential management

**Key Validations**:
- Theme switching works and persists
- Navigation is functional
- Settings modal opens/closes
- Credential CRUD operations work
- JIRA and Git credentials can be created/edited/deleted

### 2. Content Pathway
**Dependencies**: Foundation Pathway  
**Tests**: Import + Library Management  
**Purpose**: Validates content can be imported and organized

**Key Validations**:
- JIRA import works with credentials
- Git repository import functions
- File upload accepts various formats
- Text import processes correctly
- Library items can be searched, filtered, archived

### 3. Workflow Pathway (CORE VALUE)
**Dependencies**: Foundation + Content  
**Tests**: Workspaces + Agents  
**Purpose**: Validates the primary user journey and value proposition

**Key Validations**:
- Workspaces can be created from library items
- Draft/publish workflow functions
- Agents can be deployed successfully
- Chat interaction works with streaming responses
- Navigation persistence (nav away and back, conversation remains)
- Agent memory and context work across sessions

### 4. Integration Pathway
**Dependencies**: All previous pathways  
**Tests**: Files + Git + Advanced Features  
**Purpose**: Validates advanced IDE-like functionality

**Key Validations**:
- Monaco editor loads and functions
- File tree operations work (create, edit, delete, rename)
- Git diff viewing and branch operations
- Advanced features like checkpoints and permissions
- Keyboard shortcuts and accessibility

## 🔧 Test Requirements

### Prerequisites
1. **Server Running**: `npm run dev` on port 3001
2. **Chrome/Chromium**: Installed and accessible
3. **Test Data**: Some library items for workspace creation (optional)

### Browser Requirements
- Tests run in **headful mode** for visual validation
- Chrome/Chromium must be installed
- Tests will keep browser open briefly between phases for observation

## 📸 Test Output

### Screenshots
All tests capture screenshots at key moments:
- `screenshots/01-basic-ui/` - UI validation screenshots
- `screenshots/02-credentials/` - Credential management screens
- `screenshots/05-agent-interaction/` - Agent chat and navigation
- etc.

### Results
- `results/comprehensive-test-results.json` - Detailed JSON results
- `results/test-report.html` - Visual HTML report
- `results/*-results.json` - Individual test results

### Console Output
Tests provide real-time feedback:
- ✅ Passed operations
- ❌ Failed operations  
- 📸 Screenshot captures
- ⏸️ Pauses for visual validation

## 🎯 Critical Workflows Tested

### User Journey 1: Setup and Configuration
1. Access application → Basic UI loads properly
2. Open settings → Credentials manager accessible
3. Add JIRA credential → Validation and storage work
4. Add Git credential → Multiple credential types supported

### User Journey 2: Content Import and Organization
1. Access import → Import modal opens with all source options
2. Import from JIRA → Credential selection and import process
3. Import from Git → Repository cloning and file extraction
4. Organize in library → Search, filter, archive functions

### User Journey 3: Workspace and Agent Interaction (CORE)
1. Create workspace → Select library items and publish
2. Enter workspace → File explorer and editor interface load
3. Deploy agent → Agent becomes available for interaction
4. Chat with agent → Streaming responses and tool usage
5. Navigate away → Return to same workspace
6. Verify persistence → Conversation and context maintained

### User Journey 4: Development Workflow
1. Edit files → Monaco editor with syntax highlighting
2. View git diff → Changes displayed properly
3. Use advanced features → Checkpoints, permissions, search
4. Test performance → System remains responsive

## 🚨 Failure Handling

### Foundation Pathway Failure
**Impact**: Critical - all other functionality blocked  
**Action**: Fix immediately before proceeding

### Content Pathway Failure  
**Impact**: Medium - workspaces can't be created with content  
**Action**: Check credential configuration and import APIs

### Workflow Pathway Failure
**Impact**: Critical - core value proposition broken  
**Action**: Primary development priority

### Integration Pathway Failure
**Impact**: Low-Medium - advanced features affected  
**Action**: Core functionality still works, fix for full feature set

## 💡 Development Usage

### During Feature Development
```bash
# Quick validation of foundation
node scripts/puppeteer-tests/run-quick-test.js

# Test specific workflow
node scripts/puppeteer-tests/05-agent-interaction.js
```

### Before Deployment
```bash
# Full validation
node scripts/puppeteer-tests/run-all-tests.js
```

### Debugging Issues
1. Run individual test script for problematic area
2. Check screenshots in `screenshots/` folder
3. Review detailed results in `results/` folder
4. Browser stays open briefly - watch for visual issues

## 🔧 Customization

### Adding New Tests
1. Create test script following existing patterns
2. Add to appropriate pathway in `pathways/`
3. Update main runner in `run-all-tests.js`

### Modifying Test Order
Edit pathway files to change test sequence within each pathway.

### Adjusting Timeouts
Most tests use 2-3 second waits for UI interactions. Increase if needed for slower systems.

## 📚 Test Philosophy

**Visual Validation**: Tests run headful to catch styling and UX issues that headless tests miss.

**User Journey Focus**: Tests follow real user workflows rather than isolated component testing.

**Failure Isolation**: Pathway structure allows identifying which major system areas have issues.

**Comprehensive Coverage**: Every critical user interaction is tested to ensure no regressions.

**Performance Awareness**: Tests include pauses and performance observations to catch slowdowns.

This framework ensures Context Pipeline remains functional, well-styled, and provides a great user experience across all critical workflows.