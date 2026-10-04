# Try Foley

Foley gives a living-room group a shared creative task: make the soundtrack for the same twenty-second picture, then change its mood by recasting a sound. The TV directs the room; paired phones contribute takes.

1. Open the [hosted TV screen](https://foley.13.204.212.172.sslip.io/tv), or sideload the [tested Android TV APK](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30). Select **Start a studio**.
2. Open the same HTTPS origin on a phone. Enter the pairing code and a contributor name. Enable the microphone explicitly, or upload a short audio file you may use.
3. Record three different sounds, such as taps, paper rustling and a squeak. Preview each before sending it. Cast takes as Footsteps, Weather and Creature.
4. Select **Premiere** and play the complete movie. Credits use the actual contributors. Reassign one role and select **Play the next cut** to compare the same picture with a different soundtrack.
5. End the studio when finished; this removes its active recordings and access.

The [current 89-second public video](https://www.youtube.com/watch?v=G_K0CaCEpnk) combines remote navigation from the original native run with the additional native run's full movie and captured audio. Its main premiere uses three labeled original synthetic sound fixtures from an API test crew. The contributor browser scene is separately labeled as edited stills. This establishes native emulator behavior; physical phone capture, Fire TV hardware performance and a group playtest remain unverified. The [event FAQ](https://amazonappdev2026.devpost.com/details/faqs) accepts Google's Android TV emulator.

The **Judge APK** workflow exercises distinct original synthetic sound-design fixtures and a second full cut. The [3 October public-origin run](https://github.com/himanshu748/foley/actions/runs/37131675427) passed both premieres, the new cast selections and credits. Its first tone premiere remains an independent captured-audio check; the revised submission video shows the distinct-sound premiere.

For installation, use the **30 September release linked in step 1**. Its APK SHA-256 is `6a86e6e77231aa7c4a376e700c48a7dcbd8d3cf68d50bf6bcbaa6289da59de0e`. The separate 3 October CI APK has SHA-256 `42346af2283f791796f6e3d54c50344037ad226684d502222332f62972dae0d6`; it is an additional test artifact, not a replacement release. The launcher source is identical between those builds, and both use the hosted HTTPS origin. Each build has its own verified installation receipt; the checksums are not interchangeable.

Lightsail supplies the persistent HTTPS backend. Foley uses no generative AI or AWS model API. See [deployment evidence](../deploy/README.md), [runtime evidence](../android/BUILDING.md) and [observed integration friction](FRICTION-LOG.md).
