# IV Drip Rate — Release Checklist

Owned by IV Clinical Safety. This is the release gate. No build ships to
nurses without every applicable item ticked and a signed bedside acceptance
run on file.

The app is a **prototype, not a medical device.** These items exist to keep
the prototype's failure modes visible and to keep the wording honest.

---

## 1. Drop-factor selector and confirm-before-change modal (TEST-6)

The drop factor drives the mL/hr math (`mL/hr = drops/min × 60 / factor`).
Picking the wrong factor for the tubing set on the pole can change the
reported volume by up to 3× — a nurse titrating from a wrong number can
over- or under-deliver by the same ratio. Every user-facing change goes
through a confirmation modal.

### Selector — verbatim labels

Values in this exact order:

- `10 gtt/mL`
- `15 gtt/mL`
- `20 gtt/mL (default)`
- `60 gtt/mL`

Accessible name on the control: `Drop factor`.

### Placement

- Rendered inline in the stats bar, immediately adjacent to `mL/hr`.
- Current factor value is visible at all times as part of the stats bar
  (the existing `factor` stat with `gtt/mL` hint stays; tapping it opens
  the picker).
- Not hidden behind a settings screen, hamburger menu, or long-press.
- Visible in both portrait and landscape.

### Picker interaction

- Tap the `factor` stat to open the picker (native `<select>` is fine on
  mobile; on desktop, a lightweight radio-style menu is acceptable).
- Choosing any value in the picker — including the currently selected
  value — commits the choice through the confirm modal (see below). This
  is deliberate: the modal is a safety belt, not a diff check.

### Confirm-before-change modal — verbatim copy

Title:

> Confirm drop factor change

Body (Markdown-safe plain text; bold marks the values):

> Changing the drop factor changes the mL/hr shown for the same drops/min.
> Picking the wrong factor for the tubing set on the pole can change the
> reported volume by up to 3×.
>
> Current: **{current} gtt/mL**
> New: **{new} gtt/mL**
> Same drops/min will report about **{ratio}×** the current mL/hr.
>
> Check the drop factor printed on the giving set before you confirm.

Buttons, in this order (left → right on desktop, stacked on mobile with
the confirm button on the bottom):

1. `Cancel` — default focus, closes modal, factor unchanged.
2. `Confirm change to {new} gtt/mL` — primary action, commits the new
   factor and persists it.

`{ratio}` is rendered to one decimal (e.g. `3.0×`, `1.5×`, `0.3×`). When
`new` equals `current`, render `1.0×` and still show the modal — no
short-circuit.

### Modal behavior — non-negotiables

- Fires on **every** user-initiated selection commit, including
  default → non-default, non-default → default, and same → same.
- Cancel is default focus. `Escape`, `Cancel`, and scrim tap all dismiss
  with factor unchanged.
- Focus is trapped inside the modal while open; `aria-modal="true"`;
  `aria-labelledby` points at the title.
- The modal is the only path from a user tap to a committed factor
  change. The `window.__ivDrop.setFactor` bridge exposed by the estimator
  hook is a developer/bench tool and must not be triggered by production
  UI code.

### Persistence

- Storage key: `ivDropRate.factor` in `localStorage`.
- Written after every confirmed change.
- Read once at app mount.
- Fallback to `20` if the key is missing, not a number, or not in
  `[10, 15, 20, 60]`. Never surface a stored invalid value to the user.
- On page reload, the stats bar shows the persisted factor next to
  `mL/hr` before the camera is started.
- **Never** silently change the default from `20` on an app upgrade. If
  a future release changes the default, existing users keep their stored
  choice, and Safety writes explicit release notes.

### Manual test (release gate)

Run on a real phone, production URL, camera pointed at any solid target
(the numbers don't need to be live for this test — the modal and
persistence are the gate).

- [ ] Open the picker, select `60 gtt/mL`. Modal appears with the header
      `Current: 20 gtt/mL`, `New: 60 gtt/mL`, `~3.0×` warning. Cancel.
      Factor in stats bar is still `20`.
- [ ] Repeat, this time Confirm. Factor in stats bar is now `60`.
- [ ] Reload the page. Stats bar shows `factor 60 gtt/mL` before starting
      the camera.
- [ ] Open the picker, select `20 gtt/mL` (back to default). Modal
      appears with `~0.3×`. Cancel and Confirm both behave as above.
- [ ] Open the picker, tap `60 gtt/mL` again while it is already the
      current value. Modal appears with `~1.0×`. Confirm. No error.
- [ ] Escape key inside the modal cancels the change.
- [ ] With the app running, put a bad value in
      `localStorage['ivDropRate.factor']` (e.g. `"7"` or `"foo"`), reload.
      Factor renders as `20`, no crash.

Copy sign-off:

- [ ] Selector labels match verbatim.
- [ ] Modal title, body, and button text match verbatim.

---

## 2. Persistent disclaimer copy (TEST-7)

Placeholder. Owned by TEST-7. Will cover:

- Pre-camera acknowledge gate copy.
- Always-visible strip near the stats bar while numbers are on screen.
- Wording review of every user-facing string on the app.

---

## 3. Bedside acceptance recipe (TEST-7)

Placeholder. Owned by TEST-7. Will cover:

- Real gravity IV chamber, real iOS phone, real Android phone.
- Light conditions, distance, chamber alignment.
- Expected vs measured drops/min and mL/hr for pinned test rates.
- Pass/fail thresholds and sign-off record.

---

## Release gate

A build ships to a nurse only if:

- Every checkbox in the applicable numbered section above is ticked in
  a real run, on a real phone, against production URL.
- The signed acceptance record from section 3 is attached to the release
  issue.
- Every string in sections 1–2 renders exactly as quoted here, on the
  device.
