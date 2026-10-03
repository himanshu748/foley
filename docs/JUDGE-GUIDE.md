# Try Foley

Foley gives a living-room group a shared creative task: make the soundtrack for the same twenty-second picture, then change its mood by recasting a sound. The TV directs the room; paired phones contribute takes.

1. Open the [hosted TV screen](https://foley.13.204.212.172.sslip.io/tv), or sideload the [tested Android TV APK](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30). Select **Start a studio**.
2. Open the same HTTPS origin on a phone. Enter the pairing code and a contributor name. Enable the microphone explicitly, or upload a short audio file you may use.
3. Record three different sounds, such as taps, paper rustling and a squeak. Preview each before sending it. Cast takes as Footsteps, Weather and Creature.
4. Select **Premiere** and play the complete movie. Credits use the actual contributors. Reassign one role and select **Play the next cut** to compare the same picture with a different soundtrack.
5. End the studio when finished; this removes its active recordings and access.

The current public video and APK run use a labeled synthetic tone from an API fixture crew. They establish native emulator playback with captured output audio, not physical phone capture, Fire TV hardware performance or a group playtest. The [event FAQ](https://amazonappdev2026.devpost.com/details/faqs) accepts Google's Android TV emulator.

The **Judge APK** workflow additionally exercises distinct original synthetic sound-design fixtures and a second full cut. Its latest run must pass before those fixtures become new demonstration evidence. The first tone premiere remains the independent captured-audio check.

Lightsail supplies the persistent HTTPS backend. Foley uses no generative AI or AWS model API. See [deployment evidence](../deploy/README.md), [runtime evidence](../android/BUILDING.md) and [observed integration friction](FRICTION-LOG.md).
