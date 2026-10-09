# Foley design system

## Direction contract

Code-led continuation of the approved film-and-phone concept. The product is a shared living-room recording studio. Its primary surface operates a film, not a metrics dashboard.

Grounded systems considered: repertory cinema programme, children's animation workshop, radio recording booth, festival screening room, contact sheet, theatre mixing console, sound effects library. The assigned sixth direction is the theatre mixing console: a large uninterrupted picture, transport immediately below, three colour-coded sound buses, and a narrow crew/pairing rail. The control surface stays readable from a sofa. Phone controls reduce to one microphone and its take.

Challengers were judged against audience identification and product clarity. Parametric identity: declined; keep consistent state-derived feedback. Metro typography: competitive for TV legibility; keep large focusable controls, without replacing the warm film world. Seven-segment instrument: declined; keep stable time slots. ASCII scene: declined because it distracts from the child's recognizable performance. Sneaker archive: declined; keep clear labelling of takes. Ocean-depth scrub: declined; keep every animated element on one real timeline. No visual motifs borrowed.

## Built world

Warm programme-paper background (#f3ecdf), ink (#292c27), burnt-red action (#b74028), mint/blue/peach role surfaces. The picture is an original deep-blue Three.js miniature set; its timber cabin and mint clay visitor carry the authored imagery. Rounded creature forms, cream horns, inset eyes, log courses, terracotta roof battens, warm windows, puddles and a scalloped umbrella create the physical world. Self-hosted Bricolage Grotesque for titles and DM Sans for controls. No decorative raster assets or remote font dependency.

## Composition

Landing: a two-line title beside the start action, then a wide playable silent film. Studio: title, picture/transport/timeline and pairing rail, then sound casting. Phone: title, single explicit microphone, audition/save, prompts and personal takes. No invented metrics or customer proof.

## Interaction and states

Actions have pending, success, error and disabled states. A take is visibly cast, active microphones are indicated, recording locks against the premiere, an empty studio explains what to do. D-pad arrows use spatial focus among visible controls; Enter remains native. Focus is a high-contrast red outline. Reduced motion removes decorative status animation; the authored film's timeline remains the content itself. The animated film carries a static accessible description.

## Motion

The focal moment is the visitor opening a handmade umbrella after speaking; six planted steps and two creature cues precede the final shared picture. The film is a deterministic twenty-second 3D animation driven by Web Audio time. A fixed orthographic camera gives the miniature depth without camera drift or pointer parallax. Audio is prepared before playback and scheduled on the same clock. No random animation state. Pause holds the exact frame; the silent landing preview resumes from that frame. Recording level reflects analyser data. UI motion stays limited to useful press and recording feedback.

Three.js is loaded on visibility, and the scene is constructed once per visible lifecycle. Materials and geometry are shared. Static meshes are baked by material and shadow behavior; the creature and rain keep independent transforms. Ninety-six rain streaks use one instanced draw; there are no external textures or authored postprocessing passes. One directional key casts a 1024px shadow, with hemisphere/rim/window fill; DPR is capped at 1.75 desktop and 1.5 narrow screens. Draws only happen when time, size or motion preference changes. Hidden/offscreen scenes dispose geometries, materials, shadow resources and renderer, then recreate at the current content time when visible. Reduced motion holds rain and removes flashes/bob/sway, retaining the requested film. The original 2D film is an explicitly labeled WebGL2/context-loss fallback with the same control/audio path.

## Breakpoints

The explicit `/tv` route uses a side-by-side opening composition, 5% horizontal screen margins, strong four-pixel focus outlines and large remote targets. Stage controls surface actual pairing/casting progress and jump to focused work regions. Resume sits below Start so Down reaches it directly. Premiere aligns the picture in the viewport before playback. Persistent picture quality is an operator choice, with 2D as the TV default in response to measured software-rendering limits; it does not alter cast or cue timing.

At 720px and below, the pairing rail becomes a compact panel, role buses become a horizontal three-way choice and the take inspector follows. Controls retain touch-sized targets. 1700px increases TV control and annotation sizing.

## Verification scope

Review captures are written to .impeccable/review by npm run test:browser. Browser workflow uses a synthetic browser microphone fixture, explicitly not a real phone or Fire TV hardware playtest. The Fire OS wrapper requires device testing before event submission.

The bounded 3D rendering pass uses `npm run test:3d` and writes `3d-*` captures/results. A canvas-local bounded stats record exposes rendering calls, geometry counts and CPU submission samples to the test; it sends no telemetry. The performance record identifies the local browser/machine and distinguishes measured CPU submissions from GPU/TV performance. The scene's diagnostic seek changes only local presentation, never studio state.

Final local 3D sample: Apple M4, Chromium 153 headless, ANGLE SwiftShader software renderer, 1440×1000 viewport at DPR 1. Static batching reduced draw calls from 241 to 56 while retaining 58,898 submitted triangles. The final 48-frame sample measured 0.4 ms median CPU submission (0.5 ms p95), but 118 ms median frame interval (150.1 ms p95). Software rendering remains slow; these results do not establish smooth GPU or Fire TV playback. Original and final JSON records are retained. Shader readback warnings came from screenshots; the forced context-loss test also exposes a lost-context extension warning. No page JavaScript errors were recorded.


## Saved-cut comparison

The A/B cards continue the existing warm theatre palette and follow the picture/transport. Each card lists its three takes and their levels, with an explicit changed-role summary. The current edit stays separate. TV navigation includes Compare cuts; focused-card Play/Pause replays that card. Replacement/deletion confirmations focus the safe Keep action, and Back cancels. Missing audio produces an invalid-cut explanation rather than a substituted soundtrack. Credits retain the replayed snapshot even when the current edit differs. Upload fallback includes a local audition before sending.
