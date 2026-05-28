# Cleanup Task — payroll refactor_production

Working directory: D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production

## Goal
Clean up all junk/temp/stale files from this payroll project directory. Do NOT touch source code, backend/, frontend/src/, docs/, or any .ts/.tsx/.js files.

## Steps to execute (use bash/rm commands):

### 1. Delete temp logs in root
rm -f _tmp_*.log _tmp_*.err.log _tmp_*.out.log

### 2. Delete temp logs in frontend/
rm -f frontend/_tmp_*.log frontend/_tmp_*.err.log frontend/_tmp_*.out.log
rm -f frontend/vite-*.log frontend/vite-*.err.log frontend/vite-*.out.log
rm -f frontend/build_log.txt frontend/build_log2.txt frontend/build_error_utf8.log frontend/build_success.log

### 3. Delete stale Claude agent worktrees (28 entries, all named agent-*)
rm -rf .claude/worktrees/agent-*/

### 4. Delete Chrome profile data (not source code)
rm -rf "_dev_utils/chrome-wages-comparison-check/"

### 5. Delete misplaced OS path file
rm -f "C:Usersnbgmf.claudeplanssaya-berencana-unutk-mebangun-elegant-falcon-agent-a9ea0e92f56d533d5.md"

### 6. Delete agent tool artifacts
rm -rf .playwright-mcp/ .superpowers/ .agentMemory .qwen/

### 7. Verify what remains
git status --short
echo "=== Remaining in root (non-hidden, non-node_modules) ==="
ls -la | grep -v node_modules

## IMPORTANT
- Do NOT delete: backend/, frontend/src/, docs/, .git/, .gitignore, AGENTS.md, CLAUDE.md, QWEN.md, package.json, docker-compose.yml
- Do NOT delete: .claude/settings.local.json or .claude/worktrees/manual-adjustment-* (those are real worktrees)
- After cleanup, run: git status
- Report: how many files/dirs deleted, what remains
