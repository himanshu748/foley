# Vega gate — checked 15 October 2026

No Vega client or `.vpkg` is claimed. `vega` is not on PATH and the normal `~/vega` and `~/kepler` locations were absent. `df -h .` showed approximately 3.1 GB available. Amazon documents 20 GB available for SDK installation and development. Installing the SDK on this volume cannot meet that prerequisite; no installer was run and no files were deleted to make space.

Owner steps, about 30–45 minutes after freeing space:

1. Make at least 20 GB available on the intended development volume. Keep project/recovery files; choose any cleanup yourself.
2. Follow [Amazon's current installation guide](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk). Install Homebrew, Node 18+ and the listed macOS utilities, including Rosetta if needed. Close VS Code before installation. The current guide supplies a public installer; this audit did not encounter a login gate. If the installer redirects to a developer login or asks for a license, complete it yourself.
3. Review the official installer, then run its documented command in your terminal:

```sh
curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash
source ~/vega/env
vega --version
```

The installer changes shell profiles and installs the SDK, CLI, Studio extension and VVD. Return the version and available disk space to resume the port. Installation alone does not create a Foley Vega app.

4. After a Foley React Native for Vega/WebView client is implemented and built for aarch64, start `VirtualDevice:Tv` in Vega Studio and launch that actual package. Amazon's [run guide](https://developer.amazon.com/docs/vega/0.24/run-apps) documents `vega run-app <vpkg-path> <app-id> -d VirtualDevice`; these parameters must come from a built app. No Foley package currently exists, so there is no runnable Foley Vega command yet.

For the deadline, the [signed Fire OS sideload path](FIRE-TV-CAPTURE.md) needs an existing Fire OS device and no Vega SDK.
