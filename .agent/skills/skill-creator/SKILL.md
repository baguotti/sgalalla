---
name: skill-creator
description: Instructions and template for creating new Agent Skills. Use this when the user asks to "create a skill" or "save this as a skill".
license: MIT
metadata:
  version: "1.0.0"
  author: ant-generated
---

# Skill Creation Guide

This skill guides you through creating effective Agent Skills.

## 1. Directory Structure

Create a new directory in `.agent/skills/<skill-name>`.
The directory **MUST** contain a `SKILL.md` file.

## 2. SKILL.md Template

Copy and adapt this template:

```markdown
---
name: <kebab-case-skill-name>
description: <Short description of what the skill does and when to use it>
license: MIT
metadata:
  version: "1.0.0"
  author: <your-name-or-agent>
---

# <Skill Title>

<Detailed description of the skill.>

## Usage

<When and how to use this skill.>

## Instructions / Patterns

### <Pattern Name>

<Code examples, do's and don'ts, and explanations.>

```

## 3. Best Practices

- **Specific**: Skills should focus on ONE topic (e.g., "auth-flow", not "general-coding").
- **Actionable**: Provide copy-pasteable code snippets and concrete patterns.
- **Negative Examples**: Show "Bad" vs "Good" code to prevent common mistakes.
- **Registration**: After creating a skill, add it to `.agent/AGENTS.md` so agents can discover it.
