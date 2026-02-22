# UI/UX Review

**Date**: February 2026  
**Severity**: Medium  
**Status**: Analysis Complete

## Summary

The application has functional core flows but suffers from **non-functional interactive elements**, **generic visual design**, and **missing user feedback mechanisms**.

---

## 1. Critical Issues (Must Fix)

### 1.1 Dead Buttons

| Button | Location | Current Behavior | Expected |
|--------|----------|------------------|----------|
| "Sign In" | Header | Does nothing | Auth modal or redirect |
| "Get Started" | HomePage hero | Does nothing | Scroll to exams or redirect |
| Mobile menu toggle | Header (mobile) | Does nothing | Open nav drawer |

**Impact**: Users clicking these experience broken UX. CTA button being dead is particularly bad.

**Fix Options**:
1. **Remove buttons** until auth is implemented
2. **Add placeholder behavior** (toast: "Coming soon")
3. **Implement auth** (most effort)

### 1.2 No Loading States

| Page | Issue |
|------|-------|
| ExamPage | Content appears suddenly, no skeleton |
| CoursePage | Papers list pops in |
| PaperPage | Questions appear all at once |

**Impact**: Users don't know if app is loading or broken.

**Fix**: Add skeleton loaders matching content layout.

### 1.3 No Error States

When DynamoDB query fails:
- No error message shown
- Page appears empty
- Console shows error (users don't see)

**Fix**: Add error boundaries with retry buttons.

---

## 2. Design Issues

### 2.1 Generic Aesthetics

Current design exhibits "AI slop" characteristics:
- Default Tailwind purple/indigo gradients
- System font stack (no brand identity)
- Uniform card styling everywhere
- No visual differentiation between exam types

### 2.2 Color Palette

Current (from `src/index.css`):

```css
--primary: oklch(0.637 0.237 25.331);  /* Red-ish */
--secondary: oklch(0.985 0.001 106.423); /* Near white */
--accent: oklch(0.637 0.237 25.331);   /* Same as primary */
```

**Issues**:
- Primary and accent are identical
- No semantic color differentiation
- Dark mode colors not visually distinct enough

### 2.3 Typography

- Using system fonts only
- No heading hierarchy beyond size
- Line heights could be improved for readability
- Question text could use better formatting

### 2.4 Exam Type Visual Identity

All exam types look the same. Recommendation:

| Exam Type | Suggested Color | Icon |
|-----------|-----------------|------|
| Quiz 1 | Blue | `BookOpen` |
| Quiz 2 | Green | `BookCheck` |
| End Term | Orange | `GraduationCap` |
| OPPE | Purple | `Code` |

---

## 3. Navigation Issues

### 3.1 Redundant Links

Header has both "Exams" and "Practice" - they go to the same place (`/`).

**Fix**: Remove one, or make Practice a different view (e.g., random questions mode).

### 3.2 No Breadcrumbs

Deep pages (`/exam/quiz1/course/maths1`) have no way to see hierarchy.

**Recommendation**: Add breadcrumb component:
```
Home > Quiz 1 > Mathematics 1 > 2023 Paper
```

### 3.3 Back Navigation

PaperPage has no explicit back button. Users must use browser back.

**Fix**: Add "← Back to Course" link.

---

## 4. Quiz Experience Issues

### 4.1 No Progress Indicator

During a quiz:
- No question number shown (e.g., "Question 5 of 20")
- No progress bar
- No way to jump to specific question

### 4.2 No Timer

For exam simulation, users need:
- Optional countdown timer
- Time per question tracking
- Total time spent display

### 4.3 No Review Mode

After completing quiz:
- Can't review wrong answers
- Can't see explanations (if available)
- Stats disappear on page refresh

### 4.4 Answer State Not Persisted

If user refreshes mid-quiz:
- All answers lost
- Progress reset to 0
- Must start over

**Fix**: Store state in localStorage.

---

## 5. Accessibility Issues

### 5.1 Keyboard Navigation

- [ ] Focus states not visible enough
- [ ] No skip links
- [ ] Tab order may not match visual order

### 5.2 Screen Reader Support

- [ ] Images missing alt text (question images)
- [ ] Option buttons may not announce selection state
- [ ] No ARIA labels on icon-only buttons

### 5.3 Color Contrast

- Some muted text may not meet WCAG AA
- Correct/incorrect feedback colors need verification

---

## 6. Mobile Experience

### 6.1 Responsive Issues

| Component | Issue |
|-----------|-------|
| Header | Menu button doesn't work |
| Cards | Spacing may be too tight |
| Quiz options | Touch targets could be larger |
| Stats panel | May overflow on small screens |

### 6.2 Touch Interactions

- No swipe gestures for question navigation
- Long-press not utilized
- Pull-to-refresh not implemented

---

## 7. Missing Features (UX Impact)

| Feature | Impact | Effort |
|---------|--------|--------|
| Dark mode toggle | High | Low |
| Quiz timer | High | Medium |
| Progress persistence | High | Medium |
| Bookmark questions | Medium | Medium |
| Search courses | Medium | Low |
| Filter by year | Medium | Low |
| Question reporting | Low | Medium |

---

## 8. Component-Specific Issues

### 8.1 HomePage

```
Issues:
- Hero section "Get Started" button dead
- Exam cards all look identical
- No statistics/motivation (e.g., "50,000 questions available")
- No recent activity section
```

### 8.2 ExamPage

```
Issues:
- Level grouping (Foundation/Diploma/Degree) hardcoded
- No course count per level shown
- No search/filter for courses
- Empty courses still shown (no paper count check)
```

### 8.3 CoursePage

```
Issues:
- Year tabs could be pills instead
- Paper count per year not shown upfront
- No indication of paper difficulty/length
- No "Start Random Quiz" option
```

### 8.4 PaperPage

```
Issues:
- No question navigation sidebar
- Sub-questions indentation could be clearer
- Image zoom not supported
- No "Mark for Review" feature
- Results not shareable
```

---

## 9. Recommendations Priority

### P0 - Critical (This Week)

1. Fix or remove dead Sign In button
2. Fix or remove dead Get Started button
3. Fix mobile menu functionality
4. Add basic loading skeletons

### P1 - High (Next Sprint)

5. Add dark mode toggle
6. Implement localStorage progress persistence
7. Add breadcrumb navigation
8. Add question number indicator
9. Differentiate exam type colors

### P2 - Medium (Backlog)

10. Add quiz timer
11. Implement review mode
12. Add search/filter to course lists
13. Improve accessibility (focus states, ARIA)

### P3 - Nice to Have

14. Swipe gestures for mobile
15. Share results feature
16. Bookmark functionality
17. Spaced repetition system

---

## 10. Design System Suggestions

### Tokens to Add

```css
/* Exam type colors */
--exam-quiz1: oklch(0.6 0.15 250);   /* Blue */
--exam-quiz2: oklch(0.6 0.15 150);   /* Green */
--exam-endterm: oklch(0.65 0.15 50); /* Orange */
--exam-oppe: oklch(0.6 0.15 300);    /* Purple */

/* Feedback colors */
--success: oklch(0.65 0.2 145);
--error: oklch(0.6 0.25 25);
--warning: oklch(0.75 0.15 85);

/* Spacing scale */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
```

### Font Suggestion

Consider adding a display font for headings:
- Inter for body (clean, readable)
- Plus Jakarta Sans or Satoshi for headings (more character)

---

*UI/UX improvements should be tackled after the critical data import gap is resolved.*
