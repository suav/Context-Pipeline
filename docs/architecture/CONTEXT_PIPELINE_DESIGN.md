# Context Pipeline Design
## 🎯 Core Concept
**Everything is context.** Tickets, emails, files, messages - all get processed through a unified pipeline and stored in a standardized format.
## 📦 Universal Context Processing Pipeline
```
[Context Source] → [Import] → [Process] → [Store] → [Manifest] → [Workspace]
     ↓              ↓         ↓         ↓         ↓           ↓
  JIRA Ticket   → Parse    → Extract  → Save    → Add to    → Available
  Email         → Content  → Metadata → File    → Manifest  → for Use
  Slack Msg     → Convert  → Tags     → JSON    → Update    → in Workspace
  File/Doc      → Format   → Preview  → Store   → Index     →
```
## 📋 Context Manifest Structure
Each workspace gets a `context-manifest.json`:
```json
{
  "workspace_id": "ticket-TEST-123",
  "created": "2025-06-27T21:00:00Z",
  "last_updated": "2025-06-27T21:30:00Z",
  "total_items": 3,
  "context_items": [
    {
      "id": "ctx-001",
      "type": "jira_ticket",
      "title": "TEST-123: Fix authentication bug",
      "description": "JIRA ticket containing bug report and requirements",
      "content_file": "context/jira/TEST-123.json",
      "preview": "Users cannot log in due to session timeout issue...",
      "metadata": {
        "source": "jira",
        "ticket_id": "TEST-123",
        "priority": "High",
        "assignee": "john.doe@example.com"
      },
      "tags": ["bug", "authentication", "urgent"],
      "added_at": "2025-06-27T21:00:00Z",
      "size_bytes": 4567
    },
    {
      "id": "ctx-002",
      "type": "email_thread",
      "title": "Customer feedback on login issues",
      "description": "Email thread from customer support about authentication problems",
      "content_file": "context/email/thread-5678.json",
      "preview": "Multiple customers reporting login failures...",
      "metadata": {
        "source": "email",
        "thread_id": "5678",
        "participants": ["support@company.com", "customer@email.com"]
      },
      "tags": ["customer-feedback", "authentication"],
      "added_at": "2025-06-27T21:15:00Z",
      "size_bytes": 2345
    },
    {
      "id": "ctx-003",
      "type": "documentation",
      "title": "Authentication Flow Diagram",
      "description": "Technical documentation showing current auth flow",
      "content_file": "context/files/auth-flow.pdf",
      "preview": "Sequence diagram showing OAuth2 implementation...",
      "metadata": {
        "source": "file",
        "file_type": "pdf",
        "original_name": "auth-flow-v2.pdf"
      },
      "tags": ["documentation", "technical-spec"],
      "added_at": "2025-06-27T21:30:00Z",
      "size_bytes": 156789
    }
  ],
  "context_summary": "Workspace contains authentication bug context including JIRA ticket, customer feedback emails, and technical documentation."
}
```
## 🔄 Unified Context Import Flow
### 1. Source Selection
```
┌─────────────────────────────────────┐
│ 📥 Add Context to Workspace         │
├─────────────────────────────────────┤
│ Choose Source:                      │
│ [🎫 JIRA] [📧 Email] [💬 Slack]    │
│ [📄 Files] [📁 Git] [🌐 Web]       │
└─────────────────────────────────────┘
```
### 2. Content Processing (Same for All Sources)
```javascript
// Universal content processor
async function processContext(rawContent, sourceType, metadata) {
  const contextItem = {
    id: generateContextId(),
    type: inferContextType(sourceType, rawContent),
    title: extractTitle(rawContent, metadata),
    description: generateDescription(sourceType, metadata),
    content: sanitizeContent(rawContent),
    preview: generatePreview(rawContent),
    metadata: enrichMetadata(metadata, sourceType),
    tags: extractTags(rawContent, metadata),
    added_at: new Date().toISOString(),
    size_bytes: calculateSize(rawContent)
  };
  return contextItem;
}
```
### 3. Storage (Standardized)
```
workspace/
├── context/
│   ├── jira/
│   │   └── TEST-123.json
│   ├── email/
│   │   └── thread-5678.json
│   ├── files/
│   │   └── auth-flow.pdf
│   └── slack/
│       └── channel-discussion.json
├── context-manifest.json
└── workspace.json
```
## 🎛️ New UI: "Context Manager"
Replace "Ticket Creation Hub" with universal "Context Manager":
```
┌─────────────────────────────────────────────────────┐
│ 🗃️ Context Manager                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Current Context (3 items):                         │
│ • 🎫 TEST-123: Fix auth bug          [View] [Edit]  │
│ • 📧 Customer feedback thread        [View] [Edit]  │
│ • 📄 Auth flow documentation         [View] [Edit]  │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📥 Add New Context                              │ │
│ │ [🎫 JIRA] [📧 Email] [💬 Slack] [📄 Files]     │ │
│ │ [📁 Git] [🌐 Web] [✏️ Manual]                   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [🏗️ Build Workspace] [👀 Preview Context]          │
└─────────────────────────────────────────────────────┘
```
## 🔧 Implementation Benefits
1. **Unified Processing**: Same code handles all context types
2. **Consistent Storage**: Everything stored in same format
3. **Easy Extension**: Add new sources by implementing processor
4. **Rich Metadata**: Context manifest shows exactly what's included
5. **Searchable**: Can search across all context types
6. **Portable**: Workspaces are self-contained with all context
## 🚀 Migration Strategy
1. **Create** `ContextManager` component (replaces TicketCreationHub)
2. **Implement** universal context processing pipeline
3. **Convert** existing JIRA functionality to use new pipeline
4. **Add** other context sources (email, files, etc.)
5. **Remove** old ticket-specific code
This makes "tickets" just one input type in a much more powerful and flexible system!