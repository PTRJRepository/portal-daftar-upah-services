# Git Workflow - Payroll Daftar Upah

## Overview

Dokumen ini menjelaskan workflow Git yang digunakan dalam pengembangan project Payroll Daftar Upah.

---

## 1. Branch Strategy

### Branch Types

| Branch | Purpose | Naming |
|--------|---------|--------|
| `main` | Production code | `main` |
| `develop` | Development integration | `develop` |
| `feature/*` | New features | `feature/feature-name` |
| `bugfix/*` | Bug fixes | `bugfix/bug-description` |
| `hotfix/*` | Emergency production fixes | `hotfix/fix-description` |
| `release/*` | Release preparation | `release/v1.0.0` |

### Branch Flow

```
main
  |
  +-- release/v1.0.0
  |     |
  |     +-- develop
  |           |
  |           +-- feature/new-feature
  |           +-- bugfix/bug-fix
  |
  +-- hotfix/emergency-fix
```

---

## 2. Commit Convention

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting, semicolons, etc |
| `refactor` | Code refactoring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```bash
# Feature
feat(payroll): add overtime tier calculation

# Bug fix
fix(lembur): correct UPJ calculation for missing pay_rate

# Documentation
docs(readme): update installation instructions

# Refactor
refactor(service): extract payroll calculation to separate service
```

---

## 3. Workflow Steps

### 3.1 Starting New Feature

```bash
# 1. Update develop branch
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/new-feature

# 3. Work on feature
git add .
git commit -m "feat: add new feature"

# 4. Push to remote
git push origin feature/new-feature

# 5. Create Pull Request
# (via GitHub/GitLab UI)
```

### 3.2 Bug Fix Workflow

```bash
# 1. Create bugfix branch from develop
git checkout develop
git checkout -b bugfix/bug-description

# 2. Fix the bug
git add .
git commit -m "fix: description of fix"

# 3. Push and create PR
git push origin bugfix/bug-description
```

### 3.3 Hotfix Workflow

```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/emergency-fix

# 2. Fix the issue
git add .
git commit -m "fix: emergency fix description"

# 3. Push and create PR
git push origin hotfix/emergency-fix

# 4. After merge, also merge to develop
git checkout develop
git merge hotfix/emergency-fix
```

---

## 4. Pull Request Guidelines

### PR Title Format

```
[Type] Brief description
```

Example: `[Feature] Add overtime tier calculation`

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing done

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass

## Screenshots (if applicable)
```

### Code Review Process

1. **Self Review** - Review your own code first
2. **Peer Review** - At least 1 approval required
3. **CI/CD** - All tests must pass
4. **Merge** - Squash and merge or merge commit

---

## 5. Merge Strategies

### When to Use Each Strategy

| Strategy | When to Use |
|----------|-------------|
| **Squash and Merge** | Feature branches, single logical change |
| **Merge Commit** | Release branches, preserve history |
| **Rebase and Merge** | Clean history, no merge commits |

### Recommended

- Feature branches: **Squash and Merge**
- Release branches: **Merge Commit**
- Hotfix branches: **Squash and Merge**

---

## 6. Git Commands Reference

### Daily Commands

```bash
# Check status
git status

# Stage changes
git add .
git add file.js

# Commit
git commit -m "message"

# Push
git push origin branch-name

# Pull
git pull origin branch-name

# Create branch
git checkout -b new-branch

# Switch branch
git checkout branch-name
```

### Useful Commands

```bash
# View commit history
git log --oneline --graph

# Stash changes
git stash
git stash pop

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard local changes
git checkout -- file.js
git clean -fd

# Rebase onto develop
git rebase develop

# Cherry-pick commit
git cherry-pick commit-hash
```

---

## 7. .gitignore

### Current .gitignore

```gitignore
# Dependencies
node_modules/
bun.lock

# Build
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test
coverage/

# Temp
*.tmp
*.temp
```

### Files to Never Commit

- `.env` files with secrets
- `node_modules/`
- Build outputs
- IDE settings
- Large binary files

---

## 8. Release Process

### Version Numbering

Format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes

### Release Steps

```bash
# 1. Create release branch
git checkout develop
git checkout -b release/v1.1.0

# 2. Update version
# - Update package.json version
# - Update CHANGELOG.md

# 3. Test thoroughly
npm run test
npm run build

# 4. Merge to main
git checkout main
git merge release/v1.1.0

# 5. Tag release
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# 6. Merge back to develop
git checkout develop
git merge release/v1.1.0

# 7. Delete release branch
git branch -d release/v1.1.0
```

---

## 9. Conflict Resolution

### When Conflicts Occur

```bash
# 1. Try to rebase
git rebase develop

# 2. If conflicts, resolve manually
# Open conflicted files and look for:
<<<<<<< HEAD
your changes
=======
incoming changes
>>>>>>> branch-name

# 3. Mark as resolved
git add resolved-file.js
git rebase --continue

# 4. If stuck, abort
git rebase --abort
```

### Tips to Avoid Conflicts

- Pull frequently from develop
- Keep branches small and focused
- Communicate with team about file changes
- Use feature flags for large changes

---

## 10. Best Practices

### Do's

- Write meaningful commit messages
- Keep commits atomic (one logical change)
- Pull before pushing
- Create branches for all changes
- Review your own code before PR

### Don'ts

- Commit directly to main/develop
- Commit sensitive data
- Make huge commits
- Force push to shared branches
- Ignore merge conflicts

---

## 11. Troubleshooting Git

### Common Issues

#### Accidentally committed to wrong branch

```bash
# Undo commit but keep changes
git reset --soft HEAD~1

# Stash changes
git stash

# Switch to correct branch
git checkout correct-branch

# Apply changes
git stash pop
```

#### Need to undo last push

```bash
# Local reset
git reset --hard HEAD~1

# Force push (use with caution!)
git push origin branch-name --force
```

#### Branch diverged

```bash
# Rebase onto remote
git pull --rebase origin branch-name
```

---

## 12. Git Hooks

### Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting
npm run lint

# Run tests
npm run test
```

### Pre-push Hook

```bash
#!/bin/sh

# Run full test suite
npm run test:full
```

---

## 13. CI/CD Integration

### GitHub Actions (Example)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run build
```

---

## 14. Documentation Updates

### When to Update Docs

- New feature added
- API endpoint changed
- Configuration changed
- Breaking change introduced

### Files to Update

- `README.md` - General info
- `CLAUDE.md` - AI instructions
- `dokumentasi_AI/` - Detailed docs
- `CHANGELOG.md` - Version history

---

**Selanjutnya:** Baca [14_TESTING_GUIDE.md](./14_TESTING_GUIDE.md) untuk memahami cara testing aplikasi.