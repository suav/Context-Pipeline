# Context Pipeline
## 🎯 Overview
Context Pipeline is a **context engineering and agent deployment platform** that makes AI coding assistants effective within real development workflows. It bridges the gap between AI capabilities and practical software development by ensuring agents have complete context while maintaining developer control.
### Key Features
- **🏗️ Workspace Management**: Each workspace represents a developer working on specific tasks
- **📚 Context Library**: Import and organize context from JIRA, Git repositories, and documents
- **🤖 Agent Integration**: Deploy Claude or Gemini agents with full context awareness
- **🌳 Git Flow Integration**: Built-in git operations following standard development workflows
- **🔒 Permission Control**: Granular permissions with manual approval for dangerous operations
- **⚡ Automation Ready**: Trigger-based workspace creation and agent deployment (coming soon)
## 🚀 Getting Started
### Prerequisites
- Node.js 18+ and npm
- Git installed and configured
- Claude CLI or Gemini CLI (for agent features)
- JIRA access (for ticket imports)
### Installation
```bash
# Clone the repository
git clone <repository-url>
cd Context-Pipeline
# Install dependencies
npm install
# Run development server
npm run dev
```
The application will start on [http://localhost:3001](http://localhost:3001)
### Quick Start Guide
1. **Import Context**: Click "Import" in the library to bring in JIRA tickets or Git repos
2. **Create Workspace**: Select context items and create a workspace
3. **Deploy Agent**: Click on the workspace and deploy an AI agent
4. **Work with Agent**: Use commands or chat to accomplish tasks
5. **Review Changes**: Check git diffs and file changes
6. **Push to Git**: When ready, commit and push changes
## 📖 Documentation
### For Developers
- [CLAUDE.md](./CLAUDE.md) - Navigation guide for AI agents working on this codebase
- [CONCEPT.md](./CONCEPT.md) - High-level vision and design principles
- [Architecture Guide](./docs/README.md) - Detailed technical documentation
### Key Concepts
**Workspace = Developer**: Each workspace represents one developer's focus area with isolated context and git branch.
**Context is King**: The more context provided to agents, the better their output. Context Pipeline excels at aggregating and organizing context.
**Progressive Automation**: Start with manual triggers, build trust, then automate repetitive workflows.
## 🏛️ Architecture
```
Context Pipeline
├── Context Import (JIRA, Git, Files)
├── Context Library (Organized, Searchable)
├── Workspaces (Isolated Environments)
├── Agent Deployment (Claude, Gemini)
├── Git Integration (Diff, Commit, Branch)
└── Permission System (Global + Workspace)
```
## 🔧 Configuration
### Environment Variables
```bash
# Optional - defaults shown
WORKSPACE_DIR=./storage/workspaces
PORT=3001
```
### Agent Configuration
Agents require CLI tools to be installed:
- Claude: `npm install -g @anthropic-ai/claude-cli`
- Gemini: `npm install -g @google/generative-ai-cli`
## 🤝 Contributing
Please read [CLAUDE.md](./CLAUDE.md) for development guidelines and [CONCEPT.md](./CONCEPT.md) for design principles before contributing.
### Priority Areas
1. **Permission System**: Implement comprehensive permission injection
2. **Checkpoint System**: Complete agent state preservation
3. **Git Workflows**: Enhance git integration for full development flow
4. **Dynamic Triggers**: Build event-based automation
## 📄 License
[License information to be added]
## 🙏 Acknowledgments
Built with Next.js, React, and TypeScript. Integrates with Claude and Gemini AI assistants.