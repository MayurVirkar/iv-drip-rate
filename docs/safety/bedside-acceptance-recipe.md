# Bedside Acceptance Recipe — IV Drip Rate App

**Version:** 1.0  
**Last Updated:** 2026-09-01  
**Purpose:** Reproducible procedure to validate the IV Drip Rate app against a real gravity IV chamber on iOS and Android phones before release.

---

## Prerequisites

### Equipment Required

- **IV Administration Set:**
  - Standard gravity IV set with drip chamber
  - Known drop factor printed on packet (10, 15, 20, or 60 gtt/mL)
  - IV fluid bag (normal saline or equivalent)
  - IV stand or hook

- **Test Devices:**
  - iOS device (iPhone with rear camera, iOS 14+)
  - Android device (rear camera, Android 9+)
  - Both devices charged and with stable network for initial load

- **Reference Equipment:**
  - Stopwatch or smartphone timer
  - Tally counter or pen/paper for manual counting
  - Tape measure (to check distance)
  - Adequate lighting (simulating ward conditions — not pitch dark, not direct sunlight)

---

## Setup

1. **Prepare the IV Set:**
   - Hang the IV bag on the stand at a height that allows comfortable phone positioning (~arm's length below chamber)
   - Prime the IV line completely (no air bubbles in the chamber)
   - Note the drop factor from the packet: __________ gtt/mL

2. **Load the App:**
   - Navigate to: <https://mayurvirkar.github.io/iv-drip-rate/>
   - On first load, acknowledge the safety disclaimer
   - Verify the disclaimer strip appears at the top
   - Check that the drop factor selector shows 20 gtt/mL by default

3. **Configure Drop Factor:**
   - Tap the factor selector next to mL/hr
   - Change to match your IV set's printed factor
   - Confirm the warning modal appears showing the ratio
   - Tap "Confirm change to X gtt/mL"
   - Verify the factor persists after page reload

4. **Grant Camera Permission:**
   - Tap "Start Camera"
   - Grant camera permission when prompted
   - Verify the rear camera preview appears

---

## Test Procedure

### Trial Format

For **each drip rate** (slow, normal, fast) and **each phone** (iOS, Android):

1. **Adjust Flow Rate:**
   - Use the roller clamp to set a target drops/min rate:
     - **Slow:** ~10-15 drops/min (one drop every 4-6 seconds)
     - **Normal:** ~20-30 drops/min (one drop every 2-3 seconds)
     - **Fast:** ~40-60 drops/min (roughly one drop per second)

2. **Frame the Chamber:**
   - Hold the phone ~15-30 cm from the chamber
   - Align the drip chamber inside the bright dashed guide rectangle
   - Ensure the horizontal tripwire line passes through the middle of the chamber where drops fall
   - Confirm chamber is well-lit and drops are visible to the camera

3. **Manual Reference Count (30 seconds minimum):**
   - Start stopwatch
   - Count drops manually using a tally counter or tally marks
   - Stop after exactly 30 seconds
   - Calculate manual drops/min: `(count / 30) × 60 = _____ drops/min`

4. **App Reading:**
   - Wait for app state to show "live" (may take 10-20 seconds to settle)
   - Record the app's displayed drops/min: _____ drops/min
   - Note the calculated mL/hr: _____ mL/hr

5. **Pass/Fail Criteria:**
   - **Pass:** App reading within **±10% or ±2 drops/min** (whichever is larger) of manual count
   - **Fail:** App reading outside tolerance, or state stuck on "unknown"/"settling" for > 60 seconds

6. **Failure Mode Checks (one trial per phone):**

   a. **Covered Camera:**
      - Cover camera lens with hand
      - Verify stats change to "—" within 5 seconds
      - Verify state shows "unknown"
      - ✅ PASS / ❌ FAIL

   b. **Solid Stream (no discrete drops):**
      - Open roller clamp fully to create continuous stream
      - Verify stats change to "—" or hold last value with increasing age
      - Verify does NOT show fake "0"
      - ✅ PASS / ❌ FAIL

   c. **Drop Factor Modal:**
      - Change drop factor from current to a different value
      - Verify modal fires with warning about ratio change
      - Tap "Cancel" — verify factor unchanged
      - Change again and tap "Confirm" — verify factor updates
      - Verify mL/hr recalculates appropriately
      - ✅ PASS / ❌ FAIL

   d. **App Backgrounding:**
      - With camera active, switch to home screen or another app
      - Wait 5-10 seconds, then return to IV Drip Rate app
      - Verify camera restarts cleanly (may show resume button)
      - ✅ PASS / ❌ FAIL

---

## Test Record Sheet

### Trial 1: Slow Rate (~10-15 drops/min)

| Device  | Manual Count (drops/min) | App Reading (drops/min) | mL/hr | Pass/Fail | Notes |
|---------|--------------------------|-------------------------|-------|-----------|-------|
| iOS     |                          |                         |       |           |       |
| Android |                          |                         |       |           |       |

### Trial 2: Normal Rate (~20-30 drops/min)

| Device  | Manual Count (drops/min) | App Reading (drops/min) | mL/hr | Pass/Fail | Notes |
|---------|--------------------------|-------------------------|-------|-----------|-------|
| iOS     |                          |                         |       |           |       |
| Android |                          |                         |       |           |       |

### Trial 3: Fast Rate (~40-60 drops/min)

| Device  | Manual Count (drops/min) | App Reading (drops/min) | mL/hr | Pass/Fail | Notes |
|---------|--------------------------|-------------------------|-------|-----------|-------|
| iOS     |                          |                         |       |           |       |
| Android |                          |                         |       |           |       |

### Failure Mode Checks

| Check                  | iOS Result | Android Result | Notes |
|------------------------|------------|----------------|-------|
| Covered camera → dash  | ✅ / ❌     | ✅ / ❌          |       |
| Solid stream → dash    | ✅ / ❌     | ✅ / ❌          |       |
| Drop factor modal      | ✅ / ❌     | ✅ / ❌          |       |
| App backgrounding      | ✅ / ❌     | ✅ / ❌          |       |

---

## Sign-Off

**Overall Result:** ✅ PASS / ❌ FAIL

**Tester Name:** ______________________________  
**Date:** ______________________________  
**iOS Device Model:** ______________________________  
**Android Device Model:** ______________________________  
**IV Set Drop Factor:** __________ gtt/mL  
**Lighting Conditions:** ______________________________  

**Comments / Issues Encountered:**

---

## Notes for Testers

- **Drops must be discrete:** If chamber walls are wet or lighting is poor, drops may merge visually. Wipe chamber, adjust lighting, or slow the rate.
- **Slow rates take longer to settle:** App needs 2-4 drop intervals to reach "live" state. At 10 drops/min, this can take 20-30 seconds.
- **Phone distance matters:** Too close = chamber fills frame but tripwire samples wrong area. Too far = drops too small to detect. ~20 cm is typical sweet spot.
- **Never test on a real patient:** This is a prototype. All testing is with saline on a stand, never at a bedside with a live infusion.

---

**Acceptance Criteria for Release:**
- All 6 primary trials (3 rates × 2 phones) must PASS
- All 4 failure mode checks on both phones must PASS
- Signed record must be posted to TEST-7 before release
