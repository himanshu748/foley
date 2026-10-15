# Observed friction

15 October 2026. This log records observed development work; older observations are in [the dated integration log](docs/FRICTION-LOG.md). It contains no claimed user research or device run.

| Task | Steps | Expected | Actual | Severity | Workaround | Suggestion |
| --- | --- | --- | --- | --- | --- | --- |
| Prepare Vega on the Mac | Check `vega` on PATH, normal SDK locations and `df -h .` | Installed SDK or enough space for Amazon's 20 GB prerequisite | No CLI found; about 3.1 GB available | Blocking Vega port | Use existing Fire OS APK path; owner makes space before SDK setup | Show disk-space preflight before downloading SDK packages |
| Recheck judging evidence | Read README, judge guide and native workflow | Fire TV/Vega evidence clearly separated | Docs described Google Android TV as accepted; existing video is that emulator with synthetic input | High | Corrected headline/status and added physical-device capture guide | Include explicit runtime identity in every capture receipt |
| Refresh remote source | Run git remote lookup in sandbox | GitHub reachable | DNS blocked; permitted network execution succeeded | Low, environment | Use authorized network execution | Distinguish network failure from expired authentication |

| Run local tests | Invoke npm, inspect runtime and HTTP failures | Node 22 and loopback access | Shell npm selected Homebrew Node 24; sandbox denied listen on 127.0.0.1 | Medium, environment | Pin Node 22.17.1 on PATH and run with permitted localhost access; 31 unit/API checks then passed | Verify runtime executable before a test run |

| Verify saved-cut phone audition | Select an audio file and assert its preview source | Preview has a blob URL | Browser test reached the mounted audio before the React effect attached the URL | Low, test timing | Wait for the blob source while retaining the assertion | Synchronize async UI checks to observable readiness |

| Repeat native/browser CI | Run the same application after a test-only commit | Pairing-expiry failure test observes the injected 503 | Browser job timed out waiting for the alert while the test clock was paused; preceding run passed | Medium, test clock | Wait for the actual failed response and advance the paused render clock before checking the alert | Synchronize response-render tests explicitly |

Owner confirmation required: physical Fire TV model, microphone/TV output, remote lifecycle behavior and new recording. They have not been exercised in this pass.
