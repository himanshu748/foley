# Foley
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Delegated continuation of the approved brief: React and Vite; Node 22 SQLite and ffmpeg. A Fire OS WebView wrapper is supplied separately. User explicitly authorized autonomous implementation before AWS access.

## Users
Families and friends sharing a television. One host directs the scene; phones record contributions. One phone can be passed between people.

## Product Purpose
Turn everyday sounds into a synchronized soundtrack for one original twenty-second monster film. Watch, perform, direct, premiere, remix.

## Operating Context
The TV owns casting and playback. A phone pairs through a short-lived code and records a maximum eight-second clip. Recordings, casting and two saved A/B soundtracks survive page reloads while a session remains active. Replaying a saved cut preserves the current edit.

## Capabilities and Constraints
Three roles: footsteps, weather and creature. No TV microphone assumption, accounts, public feed, third-party films or AWS dependency. Phone microphone needs HTTPS or localhost. Fire TV runtime acceptance requires a real hardware or permitted simulator recording; browser verification alone is insufficient.

## Evidence on Hand
Approved concept in ../foley-build-brief.md. Application [`68b235ab5dade3dfb67ad36ae5866f24a7c72cac`](https://github.com/himanshu748/foley/commit/68b235ab5dade3dfb67ad36ae5866f24a7c72cac) is deployed on [Amazon Lightsail](deploy/README.md) with passing hosted A/B acceptance. The [9 October v1.1 judging prerelease](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-09-v1-1) passed its [public-origin Android TV run](https://github.com/himanshu748/foley/actions/runs/37896967098), including four synthetic-input premieres, saved A/B replay, unchanged current B casts/revision and captured emulator output audio. See [runtime evidence](android/BUILDING.md). Physical Fire TV, physical Android-phone microphone capture and a customer/group playtest remain unverified.

## Product Principles
The group's own sounds are the content. The host explicitly casts each role. The timeline is deterministic. Recording is explicit and recordings expire with their session.

## Accessibility & Inclusion
Large D-pad focus targets on TV. Keyboard control and responsive phone operation. Reduced-motion UI preference does not alter the film timeline; a static scene description accompanies it.
