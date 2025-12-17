# Language Switcher Debug Guide

## Issue
Navbar translates correctly, but page content shows opposite language.

## Likely Causes
1. **Browser cache** - Old localStorage language setting
2. **Initial language detection** - Browser language vs selected language mismatch

## Solution

### Quick Fix (For User)
1. Open browser console (F12)
2. Run: `localStorage.clear()`
3. Refresh page (F5)
4. Try language switcher again

### Alternative
- Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

### If Still Not Working
The i18n configuration looks correct. The issue is likely:
- Cached language setting from before translations were added
- Browser automatically detecting Portuguese and conflicting with the switcher

## Technical Details
- i18n config: `services/i18n.ts`
- Translations: `locales/resources.ts`
- Landing page: `components/LandingPage.tsx`
- Detection order: localStorage → navigator (browser language)
