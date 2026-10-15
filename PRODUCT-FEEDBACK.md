# Product feedback — owner-editable draft

Draft for the owner to adapt to the exact Devpost questions. No form has been opened or edited.

- **Tools/SDKs and purpose:** Android SDK/Java WebView launcher for the Fire OS TV surface; React/Vite and Three.js for the shared studio/film; Node 22, SQLite and ffmpeg for pairing, private media processing and saved cuts; Amazon Lightsail with Docker/Caddy for persistent HTTPS hosting. OpenAI Codex assisted this repair pass. Kiro, Vega implementation, Bedrock and AgentCore use are not claimed.
- **What worked:** Existing browser/native regression tests and dated Lightsail acceptance receipts cover the shared workflow. The phone provides the microphone while the TV remains a remote-controlled director.
- **What needs work:** Physical Fire TV output/lifecycle validation and a qualifying live demo remain pending. The Google emulator video cannot fill that gate. Group playtesting and measured latency are not available.
- **Onboarding:** The current Mac has insufficient free disk for Vega's documented prerequisite. The signed APK fallback avoids an SDK migration but still requires a Fire OS device and ADB approval.
- **Would you build again?** Draft: yes, because the remote/phone split creates a small collaborative activity with a tangible replay. Owner must confirm this opinion after physical-device testing.
- **AWS Builder:** Lightsail is the documented AWS integration; the app does not call an AWS inference service. Use the dated hosting receipts and describe their limits accurately.

Confirm actual tools personally used, SDK versions, device results and your own opinions before copying answers. No invented friction or customer feedback is included.
