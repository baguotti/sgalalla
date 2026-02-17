---
name: find-skills
description: Discover and install skills for AI agents using the Skills CLI.
---

# Find Skills

This skill empowers you to discover and install new capabilities (skills) from the open agent ecosystem.

## Usage

### 1. Search for Skills
When you need to perform a task you don't have a specific skill for, or when the user asks to find a tool, use the `find` command:

```bash
npx skills find "[query]"
```
*Examples:*
- `npx skills find "react optimization"`
- `npx skills find "database migration"`
- `npx skills find "deployment"`

### 2. Install a Skill
If you find a relevant skill in the search results, you can install it. The search output will provide the package name.

```bash
npx skills add <package_name>
```
*Example:*
```bash
npx skills add vercel-labs/agent-skills@vercel-react-best-practices
```

### 3. Maintenance
- **Check for updates**: `npx skills check`
- **Update installed skills**: `npx skills update`
