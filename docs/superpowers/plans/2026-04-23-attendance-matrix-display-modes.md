# Attendance Matrix Display Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perbaiki scroll matrix absensi, hilangkan kolom alamat, dan tambahkan mode tampilan `Status`/`Amount` dengan jam aktual untuk hari kurang jam.

**Architecture:** Perubahan difokuskan di `GangAttendanceMatrix.jsx` dengan regresi test di `GangAttendanceMatrix.test.jsx`. Scroll diperbaiki lewat CSS flex-safe scrolling, sedangkan rendering cell dipisah berdasarkan mode tampilan agar tetap sederhana.

**Tech Stack:** React 18, Vitest, jsdom

---

### Task 1: Add regression tests

**Files:**
- Modify: `frontend/src/components/GangAttendanceMatrix.test.jsx`
- Test: `frontend/src/components/GangAttendanceMatrix.test.jsx`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Update matrix rendering

**Files:**
- Modify: `frontend/src/components/GangAttendanceMatrix.jsx`
- Test: `frontend/src/components/GangAttendanceMatrix.test.jsx`

- [ ] **Step 1: Add `displayMode` state and toggle buttons**
- [ ] **Step 2: Remove `Alamat` column and adjust sticky layout**
- [ ] **Step 3: Render jam aktual for `kurang jam` in `status` mode**
- [ ] **Step 4: Render compact amount in `amount` mode**
- [ ] **Step 5: Run test to verify behavior**

### Task 3: Fix scroll container behavior

**Files:**
- Modify: `frontend/src/components/GangAttendanceMatrix.jsx`
- Test: `frontend/src/components/GangAttendanceMatrix.test.jsx`

- [ ] **Step 1: Add flex-safe scrolling CSS (`min-height: 0`)**
- [ ] **Step 2: Keep vertical scroll in content area and horizontal scroll in table wrapper**
- [ ] **Step 3: Run test to verify rendered style contract**
