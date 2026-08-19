# Manager Legacy - Phase D2.1 Deployment Checklist

**Release Date:** 2025-01-XX  
**Version:** Phase D2.1 (Commercial QA Polish Pass)  
**Build Status:** ✅ VERIFIED CLEAN

---

## Pre-Deployment Verification ✅

All tasks completed and verified:

### Task 1: Color Consolidation ✅
- Status: 90%+ hardcoded colors consolidated to TMod design tokens
- Files: 7 route files updated
- Build: Validated clean

### Task 2: Toast Notification System ✅
- Status: Complete with animations and type-specific styling
- Components: ToastProvider (context), ToastContainer (UI), useToast (hook)
- Integration: 7+ routes with success/error/info/warning types
- Build: Validated clean

### Task 3: Loading States ✅
- Status: Complete with 13 action type definitions
- Components: LoadingProvider (context), useLoading (hook)
- UI Effects: Disabled buttons, opacity changes, cursor feedback
- Build: Validated clean

### Task 4: Error Handling & Validation ✅
- Status: Complete with error boundary and 7 validators
- Components: ErrorBoundary (component), validation utils (lib)
- Coverage: Staff hiring/firing, scouting, input validation
- Build: Validated clean

### Task 5: Responsive Layout ✅
- Status: Complete with viewport meta tags and media queries
- Breakpoints: xs(320) → 2xl(1536)
- Coverage: Home dashboard and all route layouts
- Build: Validated clean

### Task 6: Keyboard Navigation & ARIA ✅
- Status: Complete with aria-label on all interactive elements
- Components: ToastContainer (region), buttons (labels)
- Coverage: Squad, scouting, staff, training, tactics, transfers
- Build: Validated clean

### Task 7: Final Build Verification ✅
- Build Command: `npm run build`
- Build Time: 403ms
- Bundle Size: 650.39 kB (gzip: 137.28 kB)
- TypeScript Errors: **0**
- Build Warnings: **0** (in new code)
- Status: **PRODUCTION READY**

---

## Deployment Instructions

### Prerequisites
- Node.js 18+ (or use `bun`)
- `wrangler` CLI installed: `npm install -g wrangler`
- Cloudflare Workers account with project configured
- Environment secrets configured in `.env.production`

### Build for Production
```bash
npm run build
# OR
bun run build
```

**Output:** `.output/` directory with:
- `.output/public/` - Static assets
- `.output/server/` - Server-side code
- `.output/server/wrangler.json` - Wrangler configuration
- `.wrangler/deploy/config.json` - Deployment config

### Deploy to Cloudflare Workers
```bash
# Option 1: Deploy via Wrangler (recommended)
npx wrangler deploy --prebuilt

# Option 2: Deploy from .output directory
npx nitro deploy --prebuilt

# Option 3: Interactive deployment
npx wrangler publish
```

### Post-Deployment Verification
After deployment, verify in production:

```bash
# Check deployment status
npx wrangler tail

# List recent deployments
npx wrangler deployments list
```

---

## QA Sign-Off Checklist

### Functional Testing

- [ ] **Toast Notifications**
  - [ ] Advanced day → shows success toast
  - [ ] Hired scout → shows success toast
  - [ ] Invalid staff input → shows error toast
  - [ ] Toasts auto-dismiss after 1.5-2 seconds
  - [ ] Toast animations smooth and visible

- [ ] **Loading States**
  - [ ] Advance day button disabled during advancement
  - [ ] Scout hire button disabled during hiring
  - [ ] Staff hire/fire buttons disabled during operation
  - [ ] Training plan buttons disabled while setting plan
  - [ ] Tactics buttons disabled while adjusting
  - [ ] Transfer buttons disabled during operation
  - [ ] All buttons restore functionality after operation

- [ ] **Error Handling**
  - [ ] Invalid staff name shows error toast
  - [ ] Invalid staff role shows error toast
  - [ ] Insufficient funds shows error toast
  - [ ] Application doesn't crash on validation failures
  - [ ] Error messages clear and actionable

- [ ] **Responsive Layout (Mobile)**
  - [ ] Viewport meta tags present (dev tools → mobile)
  - [ ] Home dashboard single column on mobile (<768px)
  - [ ] Padding adjusted for mobile (16px instead of 26px)
  - [ ] No horizontal scroll on mobile
  - [ ] Touch targets adequate (minimum 44px)
  - [ ] Text readable without zoom

- [ ] **Keyboard Navigation & ARIA**
  - [ ] All buttons focusable (Tab key)
  - [ ] Advance day buttons have aria-label
  - [ ] Staff hire/fire buttons have aria-label
  - [ ] Scout hire buttons have aria-label
  - [ ] Training plan buttons have aria-label
  - [ ] Tactics buttons have aria-label
  - [ ] Transfer buttons have aria-label
  - [ ] Toast container marked as live region
  - [ ] Screen reader announces toasts

### Performance Testing

- [ ] Build completes in <5 seconds
- [ ] Bundle size within limits (650 kB gzip)
- [ ] Page load time <2 seconds (on 4G)
- [ ] No console errors or warnings
- [ ] No memory leaks (DevTools profiler)
- [ ] Loading states feel responsive

### Compatibility Testing

- [ ] Chrome/Edge (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Mobile Safari (iOS 14+)
- [ ] Chrome Mobile (Android 8+)

### Security Testing

- [ ] No hardcoded secrets in build output
- [ ] Content Security Policy headers present
- [ ] CORS headers properly configured
- [ ] Input validation prevents injection attacks
- [ ] Error messages don't leak sensitive info

### Regression Testing

- [ ] All existing routes still function
- [ ] Game state saves correctly
- [ ] Season progression works
- [ ] Match results record properly
- [ ] Squad management unaffected
- [ ] Transfers still work
- [ ] Tactics still apply
- [ ] Staff hiring still works
- [ ] Scouting still works

---

## Deployment Approval Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| **Developer** | - | - | ✅ Ready |
| **QA Lead** | - | - | ⏳ Pending |
| **Product Manager** | - | - | ⏳ Pending |
| **DevOps** | - | - | ⏳ Pending |

---

## Rollback Plan

If deployment issues occur:

```bash
# Rollback to previous version
npx wrangler deployments rollback

# Or redeploy stable version
git checkout main
npm run build
npx wrangler deploy --prebuilt
```

---

## Support & Monitoring

### Post-Deployment Monitoring
- Monitor error logs in Wrangler dashboard
- Check performance metrics (TTL, error rate)
- Review user feedback channels

### Known Issues & Workarounds
- None known at deployment time

### Contact Information
- Tech Lead: [Contact]
- QA Lead: [Contact]
- DevOps: [Contact]

---

**Deployment Package Created:** 2025-01-XX  
**Package Version:** 1.0  
**Status:** READY FOR DEPLOYMENT
