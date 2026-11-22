# Animated splash screen (short design)

## Why

When Lumi opens, it shows Android's still logo, then a spinner with the old
"Cycle Tracker" name while the database gets ready. The owner wants what major
apps do instead: the logo animates for a moment, the app loads behind it, and
when the animation ends Home is already there.

## Approaches

1. **Animate the whole logo (chosen).** The real logo turns and breathes as one piece, then fades into Home. Exact brand match, no new dependencies.
2. Cut the PNG into three ribbon layers and swirl them together. Rejected: the ribbons are see-through and overlap, so the cut layers carry blended colours that show as ragged patches once they move apart.
3. Redraw the logo as vectors and animate each ribbon drawing in. Rejected for now: the logo was generated as an image, so any vector version is a redrawing that would drift from the app icon. That is a logo redesign, not a splash screen.

A Lottie animation made by a motion designer from the original idea can later replace approach 1 in the same place.

## Design

- **Seamless start.** Android always draws its own still launch screen first (logo on the background colour). The animated screen starts with the logo at exactly the same size and position, so the handover is invisible. Android's screen stays up until the animated one has drawn its first frame.
- **The motion.** A slow quarter turn in the direction the ribbons curl, with a soft breath (grows a few percent and settles), then the logo lifts slightly and the whole screen fades to reveal Home. About 1.2 seconds in all.
- **Never hides a half-loaded app.** The fade-out waits until the database is ready and Home has rendered underneath. If loading takes longer than the motion, the logo keeps breathing gently until it's ready. It never adds waiting time once loading is done.
- **Reduce motion.** When the phone's "remove animations" setting is on, the logo just fades out.
- **Dark mode.** The launch background follows the phone's theme, both on Android's screen and the animated one, so a dark-mode user doesn't get a white flash.
- **Gone:** the "Cycle Tracker" spinner at launch. The small in-screen loading spinners elsewhere stay, without the old name.
- **Errors.** If the database fails, the existing error message still shows, after the logo.

## Not in scope

- Animating ribbons separately, or changing the logo or app icon.
- Sound or vibration.

## Left to the builder

- Exact easing curves and timings, within the 1.2-second budget.
- Native splash configuration needed for the size match and the dark background.
- Verified on the emulator in light and dark mode, and with animations turned off.
