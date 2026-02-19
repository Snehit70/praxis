# Project Agents Guidelines

This file provides context and rules for AI agents working on the Quiz project.

## 1. Project Overview

- **Name**: Quiz (Praxis)
- **Purpose**: IIT Madras BS program exam practice platform
- **Target Users**: Students preparing for quizzes and exams

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Frontend | React 19, Vite 7, Tailwind CSS v4 |
| Routing | React Router DOM v7 |
| UI Components | Radix UI + shadcn/ui patterns |
| Backend | Convex |
| Icons | Lucide React |

## 3. Routing Structure

```
/                              → HomePage (landing with all exam types)
/exam/:examId                  → ExamPage (shows courses for an exam)
/exam/:examId/course/:courseId → CoursePage (shows papers for exam+course)  
/paper/:paperId                → PaperPage (quiz taking interface)
```

**Exam Types**: quiz1, quiz2, end-term, oppe

**Important**: 
- Course route is nested under exam to preserve hierarchy
- There is NO `/practice` or `/courses` route
- All links must point to existing routes
- Routing preserves exam→course→paper data relationship

## 4. Environment Variables

Required in `.env`:
```
VITE_CONVEX_URL=your-convex-deployment-url
```

The app validates this at startup - it will crash without it.

## 5. CDN & Images

Images are stored in Cloudflare R2 bucket `praxis-images` and served via public URL:

**R2 Public URL**: `https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev`

Image paths:
- Question images: `https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev/question_images/{filename}`
- Option images: `https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev/option_images/{filename}`

Total: 26,652 images (9,186 question + 17,466 option images, ~1.5GB)

## 6. Code Standards

### Component Patterns
- Use `function Component()` not arrow functions for components
- Use `@/` path aliases (defined in tsconfig.json)
- Colocate components with their styles when possible

### Tailwind CSS v4
- Uses CSS variables for theming (see `src/index.css`)
- Use `bg-background`, `text-foreground`, `text-muted-foreground` etc.
- Avoid hardcoded colors - use design tokens

### shadcn/ui Components
- Located in `src/components/ui/`
- Currently: button.tsx, card.tsx
- Use `className` prop for overrides, not style

## 7. Convex Integration

- Schema defined in `convex/schema.ts`
- Queries in `convex/`
- Client initialized in `src/main.tsx`
- Always wrap app with `<ConvexProvider>`

## 8. Common Issues to Avoid

| Issue | Solution |
|-------|----------|
| Broken links | Check App.tsx routes before adding Link |
| Null refs | Always check `document.getElementById()` returns before using |
| Missing env | Validate `import.meta.env.VITE_*` at startup |
| Build fails | Run `bun run build` before committing |

## 9. Git Workflow

- Branch: `feat/...` or `fix/...`
- Commit: conventional (`feat:`, `fix:`, `chore:`)
- Never commit to main directly
- Run `bun run build` before committing

## 10. Testing

Run tests with:
```bash
bun test
```

## 11. Development

```bash
bun install    # Install deps
bun run dev   # Start dev server
bun run build # Production build
```
