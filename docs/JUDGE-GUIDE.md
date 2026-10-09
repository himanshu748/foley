# Try Foley

Foley gives a living-room group a shared creative task: make the soundtrack for the same twenty-second picture, then change its mood by recasting a sound. The TV directs the room; paired phones contribute takes.

1. Open the [hosted TV screen](https://foley.13.204.212.172.sslip.io/tv), or sideload the [tested Android TV APK](https://github.com/himanshu748/foley/releases/tag/judge-2026-10-09-v1-1). Select **Start a studio**.
2. Open the same HTTPS origin on a phone. Enter the pairing code and a contributor name. Enable the microphone explicitly, or upload a short audio file you may use.
3. Record three different sounds, such as taps, paper rustling and a squeak. Preview each before sending it. Cast takes as Footsteps, Weather and Creature.
4. Select **Premiere** and play the complete movie. Credits use the actual contributors. Open **Compare cuts** and save the complete soundtrack as A.
5. Change only Creature, save B, then play A and B. The cards identify the changed role and level; each replay keeps the current edit intact. Replacing an existing slot requires confirmation.
6. End the studio when finished; this removes its active recordings and access.

The [current 89-second public video](https://www.youtube.com/watch?v=G_K0CaCEpnk) combines remote navigation from the original native run with the additional native run's full movie and captured audio. Its main premiere uses three labeled original synthetic sound fixtures from an API test crew. The contributor browser scene is separately labeled as edited stills. This establishes native emulator behavior; physical phone capture, Fire TV hardware performance and a group playtest remain unverified. The [event FAQ](https://amazonappdev2026.devpost.com/details/faqs) accepts Google's Android TV emulator.

The [9 October public-origin run](https://github.com/himanshu748/foley/actions/runs/37896967098) passed four full premieres on application [`68b235a`](https://github.com/himanshu748/foley/commit/68b235ab5dade3dfb67ad36ae5866f24a7c72cac): the initial generated tone, the distinct synthetic soundtrack, saved A and saved B with only Creature changed. It verified saved credits, four receipts and unchanged current B casts/revision. The native recording contains emulator output audio; automated detection confirms the original 260 Hz fixture. Physical phone capture remains pending.

Install the **9 October v1.1 prerelease linked in step 1**. APK SHA-256: `ad595d936b7ff4d5375be624f2195b858fd5a90ae4cbd0c6a2afbdb74c342d50`. Its `build.json` identifies application commit `68b235ab5dade3dfb67ad36ae5866f24a7c72cac`, the public origin and verified installed hash. It is debug-signed for sideloading; a differently signed earlier test build must be uninstalled before installation.

Historical evidence is preserved separately: the [30 September release](https://github.com/himanshu748/foley/releases/tag/judge-2026-09-30) has APK SHA-256 `6a86e6e77231aa7c4a376e700c48a7dcbd8d3cf68d50bf6bcbaa6289da59de0e`. The [3 October run](https://github.com/himanshu748/foley/actions/runs/37131675427) produced the distinct-sound footage used in the still-current 89-second public video. Neither older receipt establishes saved slots; each artifact keeps its own checksum.

Lightsail supplies the persistent HTTPS backend. Foley uses no generative AI or AWS model API. See [deployment evidence](../deploy/README.md), [runtime evidence](../android/BUILDING.md) and [observed integration friction](FRICTION-LOG.md).


## Saved-cut comparison in v1.1

On the deployed v1.1 app, use **Compare cuts** to save the first complete soundtrack as A. Change only Creature, save B, then play A and B. The cards identify the changed role and its level; replay leaves the current cast unchanged. Replace prompts before overwriting a slot. Removed takes invalidate affected snapshots until they are saved again. The 9 October native receipt above establishes this flow with synthetic input; the current public video predates it. See [saved-cut verification](SAVED-CUTS.md).
