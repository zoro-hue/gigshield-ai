

# Story Mode Takeover with Real Worker Image

## Overview
Build the complete Story Mode Takeover feature from scratch (previous components were never created). The key visual centerpiece is an **AI-generated realistic image** of a gig delivery worker facing backward in heavy rain, wearing a raincoat with a delivery bag on their shoulders. This image will be generated via the Lovable AI image gateway and stored in the project assets.

## Step 1 — Generate Worker Image
Use the `google/gemini-3-pro-image-preview` model via an Edge Function or direct generation to create:
- **Prompt**: "A realistic photograph of a food delivery worker seen from behind, standing alone in heavy monsoon rain on a dark urban Indian street at night. The worker wears a yellow/orange raincoat and carries a large insulated delivery backpack on their shoulders. Rain is pouring heavily, street lights create a moody atmospheric glow. Cinematic, emotional, dark tones, shallow depth of field. No text, no logos."
- Save the generated image to `src/assets/worker-rain.png`
- This replaces the silhouette concept from the original script with a real, emotional photograph

## Step 2 — Create Rain Canvas: `src/components/RainCanvas.tsx`
- Full-screen HTML5 canvas with animated rain drops (~400 desktop, ~150 mobile)
- Splash effects at ground level, puddle ripples
- Thunder/lightning flashes (random intervals)
- Rain intensity fades based on `scrollProgress` prop
- Respects `prefers-reduced-motion`

## Step 3 — Create Light Overlay: `src/components/LightOverlay.tsx`
- Radial gradient glow from bottom center
- Grows as user scrolls deeper into the story
- Two layers: atmospheric glow + ground reflection

## Step 4 — Create Story Mode Component: `src/components/StoryMode.tsx`
- Fixed fullscreen container (`position: fixed, inset: 0, z-index: 9995`)
- Background: pure black (#000)
- Internal scroll container (~800vh total)
- Disables body scroll when active

**Story content from the script (with modifications):**
- Line 1: "It's 11 PM." / "The city is asleep."
- Line 2: "But not everyone." / "Thousands of gig workers are still on the road."
- Line 3: "Rain. Heat. Floods. Curfews." / "When disruptions hit — they lose income."
- Line 4: "No safety net. No insurance. No protection."
- Line 5: "Until now."
- Worker image reveal section (the generated rain worker image, centered, with atmospheric effects)
- **How It Works** (4 steps with scroll-driven reveal):
  - 01: Sign Up → Quick KYC
  - 02: AI Assesses Risk → Personalized premium
  - 03: Get Instant Coverage → Protected from shift start
  - 04: **AutoClaim — Zero Touch** → "Disruption detected. Payout sent. Automatically." (modified per user request — no sub-dialogue about tapping)
- Final CTA: **"Secure Your Shift"** button → exits story mode

**Animations:**
- Each text line fades in + translates up based on scroll position
- Worker image parallax + subtle scale on scroll
- Process steps slide in from right with stagger
- CTA scales from 0.96 → 1 with glow animation

## Step 5 — Create Entry Button: `src/components/StoryEntryButton.tsx`
- Position: fixed, bottom-left (24px from edges)
- Style: glassmorphic pill, `Clapperboard` icon from lucide-react + "What's this?" label
- Subtle pulse every 4s
- Hover: scale 1.05 + soft glow
- z-index: 9980
- Mobile: compact icon only, label appears briefly on tap

## Step 6 — Integrate into Homepage: `src/pages/Index.tsx`
- Add `isStoryMode` state
- Import StoryEntryButton and StoryMode
- When `isStoryMode = true`:
  - Homepage content fades to `opacity: 0`, `pointer-events: none`
  - StoryMode renders on top
- On exit ("Secure Your Shift" click):
  - Store and restore `window.scrollY`
  - Fade out story, fade in homepage
  - No reload, seamless return

## Step 7 — Testimonials Carousel: `src/components/TestimonialsCarousel.tsx`
- Auto-scrolling horizontal carousel (CSS `translateX` animation)
- 6 testimonial cards with gig worker personas
- Glass-card style, pauses on hover
- Duplicated items for infinite seamless loop
- Inserted after "How GigShield Works" section on homepage

## Files Created
- `src/assets/worker-rain.png` (AI-generated image)
- `src/components/RainCanvas.tsx`
- `src/components/LightOverlay.tsx`
- `src/components/StoryMode.tsx`
- `src/components/StoryEntryButton.tsx`
- `src/components/TestimonialsCarousel.tsx`

## Files Modified
- `src/pages/Index.tsx` — Story mode state + entry button + testimonials section

## Technical Notes
- Image generated via `google/gemini-3-pro-image-preview` through the Lovable AI gateway in an Edge Function, then base64-decoded and saved as a project asset
- No new DB tables or migrations needed
- All animations use framer-motion + raw scroll calculations
- `prefers-reduced-motion` respected throughout

