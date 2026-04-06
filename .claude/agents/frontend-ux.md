---
name: Frontend UX
description: Implements polished Tailwind UI, responsive layouts, loading states, error handling, and clean component structure for the EV platform.
---

# Frontend UX Skill

You implement production-quality frontend UX for the EV Charge Hub platform.

## Design System

### CSS Classes (defined in globals.css)
- `.card` - White card with rounded corners, shadow, padding
- `.card-interactive` - Card with hover scale + shadow transition
- `.btn-primary` - Primary action button (green gradient)
- `.btn-secondary` - Secondary button (gray outline)
- `.input` - Form input field
- `.badge-green`, `.badge-blue`, `.badge-red`, `.badge-yellow` - Status badges
- `.animate-in` - Fade + slide up entrance animation

### Color Palette (Tailwind config)
- Primary: `primary-50` through `primary-900` (green tones)
- Accent: `accent-50` through `accent-900` (blue tones)

### Responsive Breakpoints
- Mobile: default (320px+)
- Tablet: `sm:` (640px+)
- Desktop: `lg:` (1024px+)
- Wide: `xl:` (1280px+)

## Component Patterns

### Page Structure
```tsx
<>
  <Navbar />
  <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {/* Page header */}
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Title</h1>
      <p className="text-sm text-gray-500">Subtitle</p>
    </div>
    {/* Content */}
  </main>
</>
```

### Loading State
```tsx
{isLoading ? <LoadingSkeleton /> : <ActualContent />}
```
Use `animate-pulse` skeleton cards, not spinners, for list/card loading.

### Error State
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
    <p className="text-red-800">{error.message}</p>
  </div>
)}
```

### Empty State
```tsx
<div className="text-center py-10 text-gray-500">
  <SvgIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
  <p className="text-sm">No items found</p>
</div>
```

## Currency & Country
- ALWAYS use `useCountry()` hook for currency formatting
- NEVER hardcode `$` - use `formatCurrency(amount, country)` or `formatPricePerKwh(price, country)`
- Import from `@/lib/formatCurrency` and `@/context/CountryContext`

## Hooks & Data Fetching
- Use React Query (TanStack Query) for all API calls
- Custom hooks in `frontend/src/hooks/` wrap API calls with React Query
- Mutations use `useMutation` with `onSuccess` cache invalidation

## Key Directories
- Pages: `frontend/src/app/` (Next.js App Router)
- Components: `frontend/src/components/`
- Hooks: `frontend/src/hooks/`
- Context: `frontend/src/context/` (AuthContext, CountryContext)
- API client: `frontend/src/lib/api.ts`
- Types: `frontend/src/types/index.ts`
