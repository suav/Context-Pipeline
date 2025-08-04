# Permission Flow Analysis & Solution

## Current State

### What Exists:
1. **Top-level `.claude/settings.local.json`** - Your permissions for working on the app itself
2. **Agent Management Modal > Permissions Tab** - UI showing permission templates but NOT saving them
3. **WorkspaceDocumentGenerator** - Currently reads from top-level settings (wrong source)
4. **Global config** - Has permission templates but no user-specific settings

### The Problem:
- The Permissions tab shows templates but doesn't save user selections
- WorkspaceDocumentGenerator reads from wrong source (top-level instead of user's workspace settings)
- No API to save/retrieve user's chosen workspace permissions

## Required Solution

### 1. Add User Workspace Permissions Storage
Create a new file to store user's chosen permissions for workspaces:
- `storage/config/user-workspace-permissions.json`
- Separate from `.claude/settings.local.json` (which is for the app itself)

### 2. Create Permissions API
```typescript
// src/app/api/permissions/route.ts
- GET: Retrieve user's saved workspace permissions
- POST: Save user's chosen permissions from UI
```

### 3. Update PermissionsTab Component
- Add save button
- Connect to new API
- Save selected template + any customizations

### 4. Update WorkspaceDocumentGenerator
Change priority to:
1. User's saved workspace permissions (from new API)
2. Role-based templates
3. Hardcoded defaults

## Implementation Steps

### Step 1: Create Permissions API
```typescript
// src/app/api/permissions/route.ts
export async function GET() {
  const permissionsPath = path.join(process.cwd(), 'storage/config/user-workspace-permissions.json');
  try {
    const data = await fs.readFile(permissionsPath, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    // Return default if not found
    return NextResponse.json({ selectedTemplate: 'developer', customPermissions: null });
  }
}

export async function POST(request: NextRequest) {
  const { selectedTemplate, customPermissions } = await request.json();
  const permissionsPath = path.join(process.cwd(), 'storage/config/user-workspace-permissions.json');
  await fs.writeFile(permissionsPath, JSON.stringify({ selectedTemplate, customPermissions }, null, 2));
  return NextResponse.json({ success: true });
}
```

### Step 2: Update PermissionsTab to Save
Add save button and API calls to persist user's selection

### Step 3: Update WorkspaceDocumentGenerator
```typescript
private static async determineWorkspacePermissions(workspaceId: string, context?: WorkspaceContext): Promise<WorkspacePermissions> {
  // PRIORITY 1: User's saved workspace permissions
  try {
    const userPermissionsPath = path.join(process.cwd(), 'storage/config/user-workspace-permissions.json');
    const userPerms = JSON.parse(await fs.readFile(userPermissionsPath, 'utf8'));
    
    if (userPerms.customPermissions) {
      return userPerms.customPermissions;
    }
    
    if (userPerms.selectedTemplate) {
      // Use the template they selected in the UI
      const config = await this.configManager.loadConfig();
      const template = config.permissions.templates[userPerms.selectedTemplate];
      if (template) {
        return this.convertPermissionSetToWorkspacePermissions(template);
      }
    }
  } catch (error) {
    console.log('No user workspace permissions found, using defaults');
  }
  
  // ... rest of existing fallback logic
}
```

## The Flow After Implementation

1. **User opens Manage Agents > Permissions tab**
2. **Selects a template or customizes permissions**
3. **Clicks Save → stores to `user-workspace-permissions.json`**
4. **When creating new workspace:**
   - WorkspaceDocumentGenerator reads user's saved permissions
   - Generates `.claude/settings.json` in workspace with those permissions
5. **All future workspaces use those permissions until user changes them**

## Key Benefits
- User's workspace permissions separate from app development permissions
- Settings persist across sessions
- All workspaces use consistent permissions
- Easy to change for all future workspaces
- Existing workspaces keep their permissions (unless regenerated)