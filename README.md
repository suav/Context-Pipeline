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
- [Architecture Guide](./docs/architecture/CONTEXT_PIPELINE_DESIGN.md) - Detailed technical documentation

### Key Concepts
**Workspace = Developer**: Each workspace represents one developer's focus area with isolated context and git branch.
**Context is King**: The more context provided to agents, the better their output. Context Pipeline excels at aggregating and organizing context.
**Progressive Automation**: Start with manual triggers, build trust, then automate repetitive workflows.

## 🏗️ Architecture

Core system design and architectural decisions:

- **[CONTEXT_PIPELINE_DESIGN.md](docs/architecture/CONTEXT_PIPELINE_DESIGN.md)** - Original design document and vision
- **[CONTEXT_PIPELINE_CURRENT_STATE.md](docs/architecture/CONTEXT_PIPELINE_CURRENT_STATE.md)** - Current system state (January 2025)
- **[WORKSPACE_4_COMPONENT_DESIGN.md](docs/architecture/WORKSPACE_4_COMPONENT_DESIGN.md)** - UI architecture and component design

## 🤖 Agent System

AI agent integration, permissions, and management:

- **[AGENT_BUILD_PLAN.md](docs/agents/AGENT_BUILD_PLAN.md)** - Comprehensive agent system design
- **[AGENT_PERMISSION_SYSTEM.md](docs/agents/AGENT_PERMISSION_SYSTEM.md)** - Permission framework and security
- **[AGENT_DATA_STRUCTURES.md](docs/agents/AGENT_DATA_STRUCTURES.md)** - Type definitions and data models
- **[AGENT_STORAGE_ARCHITECTURE.md](docs/agents/AGENT_STORAGE_ARCHITECTURE.md)** - Agent storage and persistence
- **[CHECKPOINT_SYSTEM_IMPLEMENTATION.md](docs/agents/CHECKPOINT_SYSTEM_IMPLEMENTATION.md)** - Agent state management

## 🔧 Implementation Guides

Step-by-step implementation documentation:

### Core Features
- **[PERMISSIONS_COMMANDS_IMPLEMENTATION_GUIDE.md](docs/implementation/PERMISSIONS_COMMANDS_IMPLEMENTATION_GUIDE.md)** - Permission system implementation
- **[GIT_INTEGRATION_IMPLEMENTATION.md](docs/implementation/GIT_INTEGRATION_IMPLEMENTATION.md)** - Git workflow integration
- **[WORKSPACE_VERSION_CONTROL.md](docs/implementation/WORKSPACE_VERSION_CONTROL.md)** - Version control strategies

### Dynamic Triggers
- **[DYNAMIC_CONTEXT_TRIGGER_DESIGN.md](docs/implementation/DYNAMIC_CONTEXT_TRIGGER_DESIGN.md)** - Automation trigger design
- **[DYNAMIC_CONTEXT_TRIGGER_IMPLEMENTATION_GUIDE.md](docs/implementation/DYNAMIC_CONTEXT_TRIGGER_IMPLEMENTATION_GUIDE.md)** - Implementation steps
- **[DYNAMIC_CONTEXT_TRIGGER_FLOW_DIAGRAMS.md](docs/implementation/DYNAMIC_CONTEXT_TRIGGER_FLOW_DIAGRAMS.md)** - System flow diagrams
- **[DYNAMIC_CONTEXT_TRIGGER_TOUCHPOINTS.md](docs/implementation/DYNAMIC_CONTEXT_TRIGGER_TOUCHPOINTS.md)** - Integration points

### Specific Features
- **[TERMINAL_UI_REQUIREMENTS.md](docs/implementation/TERMINAL_UI_REQUIREMENTS.md)** - Terminal interface design
- **[DAVIN_REMOTE_DEPLOYMENT_FEATURE.md](docs/implementation/DAVIN_REMOTE_DEPLOYMENT_FEATURE.md)** - Remote deployment feature
- **[PROJECT_MANAGER_BRIEFING.md](docs/implementation/PROJECT_MANAGER_BRIEFING.md)** - Multi-agent development plan
- **[DEVELOPMENT_WORKFLOW.md](docs/implementation/DEVELOPMENT_WORKFLOW.md)** - Development processes

### Configuration & Setup
- **[agent-configuration-implementation.md](docs/implementation/agent-configuration-implementation.md)** - Agent configuration
- **[agent-configuration-improvements.md](docs/implementation/agent-configuration-improvements.md)** - Configuration improvements
- **[workspace-deselection-implementation.md](docs/implementation/workspace-deselection-implementation.md)** - Workspace management
- **[SSH_KEY_USAGE.md](docs/implementation/SSH_KEY_USAGE.md)** - SSH configuration

## ⚡ Performance

Performance optimization and monitoring:

- **[PERFORMANCE_OPTIMIZATION_COMPLETE.md](docs/performance/PERFORMANCE_OPTIMIZATION_COMPLETE.md)** - Complete optimization story
- **[BUILD_OPTIMIZATION_GUIDE.md](docs/performance/BUILD_OPTIMIZATION_GUIDE.md)** - Build performance improvements
- **[WSL_PERFORMANCE_OPTIMIZATION.md](docs/performance/WSL_PERFORMANCE_OPTIMIZATION.md)** - WSL-specific optimizations
- **[API_CACHING_SYSTEM.md](docs/performance/API_CACHING_SYSTEM.md)** - API caching implementation
- **[OPTIMIZATION_GUIDE.md](docs/performance/OPTIMIZATION_GUIDE.md)** - General optimization strategies
- **[LAZY_LOADING_FRAMEWORK.md](docs/performance/LAZY_LOADING_FRAMEWORK.md)** - Lazy loading implementation
- **[SLOW_BUILD_ANALYSIS.md](docs/performance/SLOW_BUILD_ANALYSIS.md)** - Build performance analysis
- **[EFFICIENCY_EVALUATOR.md](docs/performance/EFFICIENCY_EVALUATOR.md)** - Performance evaluation tools

## 🧪 Testing

Testing strategies, guides, and debugging:

- **[TESTING_GUIDE.md](docs/testing/TESTING_GUIDE.md)** - Comprehensive testing guide
- **[NAVIGATION_GUIDE.md](docs/testing/NAVIGATION_GUIDE.md)** - UI navigation and testing
- **[TESTING_STRATEGY_IMPLEMENTATION.md](docs/testing/TESTING_STRATEGY_IMPLEMENTATION.md)** - Testing framework
- **[PARALLEL_WORKSPACE_TESTING_SYSTEM.md](docs/testing/PARALLEL_WORKSPACE_TESTING_SYSTEM.md)** - Parallel testing
- **[REACT_SERVER_DEBUGGING_GUIDE.md](docs/testing/REACT_SERVER_DEBUGGING_GUIDE.md)** - Debugging techniques
- **[TYPESCRIPT_VALIDATION_SUMMARY.md](docs/testing/TYPESCRIPT_VALIDATION_SUMMARY.md)** - TypeScript validation
- **[TESTING_FRAMEWORK_COMPLETE.md](docs/testing/TESTING_FRAMEWORK_COMPLETE.md)** - Complete testing framework
- **[server-management-when-testing.md](docs/testing/server-management-when-testing.md)** - Test server management

## 📊 Analysis & Reports

Code quality, security, and project analysis:

- **[SECURITY_EVALUATION_REPORT.md](docs/analysis/SECURITY_EVALUATION_REPORT.md)** - Security assessment
- **[SECURITY_PATCH_REPORT.md](docs/analysis/SECURITY_PATCH_REPORT.md)** - Security improvements
- **[FUNCTIONALITY_EVALUATION_REPORT.md](docs/analysis/FUNCTIONALITY_EVALUATION_REPORT.md)** - Feature analysis
- **[CLEANUP_REPORT.md](docs/analysis/CLEANUP_REPORT.md)** - Code cleanup results
- **[CONSERVATIVE_ORPHAN_ANALYSIS.md](docs/analysis/CONSERVATIVE_ORPHAN_ANALYSIS.md)** - Orphaned code analysis
- **[orphaned-components-report.md](docs/analysis/orphaned-components-report.md)** - Component cleanup
- **[VALIDATION_REPORT.md](docs/analysis/VALIDATION_REPORT.md)** - System validation results

## 🚀 Quick Start for Developers

### New to the Project?
1. Start with **[CLAUDE.md](./CLAUDE.md)** - Main navigation guide
2. Read **[CONCEPT.md](./CONCEPT.md)** - Understand the vision
3. Review **[docs/architecture/CONTEXT_PIPELINE_CURRENT_STATE.md](docs/architecture/CONTEXT_PIPELINE_CURRENT_STATE.md)** - Current system state

### Working on Features?
1. **Permissions System**: [docs/implementation/PERMISSIONS_COMMANDS_IMPLEMENTATION_GUIDE.md](docs/implementation/PERMISSIONS_COMMANDS_IMPLEMENTATION_GUIDE.md)
2. **Agent Checkpoints**: [docs/agents/AGENT_BUILD_PLAN.md](docs/agents/AGENT_BUILD_PLAN.md)
3. **Git Integration**: [docs/implementation/GIT_INTEGRATION_IMPLEMENTATION.md](docs/implementation/GIT_INTEGRATION_IMPLEMENTATION.md)

### Performance Issues?
1. **WSL Environment**: [docs/performance/WSL_PERFORMANCE_OPTIMIZATION.md](docs/performance/WSL_PERFORMANCE_OPTIMIZATION.md)
2. **API Performance**: [docs/performance/API_CACHING_SYSTEM.md](docs/performance/API_CACHING_SYSTEM.md)
3. **Build Performance**: [docs/performance/BUILD_OPTIMIZATION_GUIDE.md](docs/performance/BUILD_OPTIMIZATION_GUIDE.md)

### Testing & Quality?
1. **Testing Guide**: [docs/testing/TESTING_GUIDE.md](docs/testing/TESTING_GUIDE.md)
2. **UI Navigation**: [docs/testing/NAVIGATION_GUIDE.md](docs/testing/NAVIGATION_GUIDE.md)
3. **Security**: [docs/analysis/SECURITY_EVALUATION_REPORT.md](docs/analysis/SECURITY_EVALUATION_REPORT.md)

## 📝 Documentation Standards

- **Architecture**: High-level design and system overview
- **Implementation**: Step-by-step guides with code examples
- **Testing**: Validation, debugging, and quality assurance
- **Performance**: Optimization strategies and measurements
- **Analysis**: Reports, evaluations, and assessments

All documentation follows the project's vision of being a **context engineering and agent deployment platform** that makes AI coding assistants effective within real development workflows.

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

## 📁 Project Structure

```
Context-Pipeline/
├── src/                     # Source code
├── docs/                    # Documentation
│   ├── architecture/        # System design docs
│   ├── agents/              # Agent system docs
│   ├── implementation/      # Implementation guides
│   ├── performance/         # Performance docs
│   ├── testing/             # Testing guides
│   └── analysis/            # Analysis reports
├── scripts/                 # Utility scripts
├── storage/                 # Data storage (git-ignored)
├── logs/                    # Application logs (git-ignored)
├── public/                  # Static assets
├── test/                    # Test files
│
├── README.md                # This file
├── CLAUDE.md                # AI agent guide
├── CONCEPT.md               # Project vision
├── OWNERSHIP.md             # Project ownership
│
└── [config files]           # Build & tool configs
    ├── package.json         # Dependencies
    ├── tsconfig.json        # TypeScript config
    ├── next.config.ts       # Next.js config
    ├── tailwind.config.js   # Tailwind CSS
    ├── postcss.config.mjs   # PostCSS config
    └── eslint.config.mjs    # ESLint rules
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