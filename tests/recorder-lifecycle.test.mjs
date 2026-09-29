// Exercise the real Microphone callbacks under overlapping permission promises.
// App's busy UI normally serializes clicks; this harness deliberately permits a
// newer invocation so stale async work cannot undo that invocation's cleanup.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const text = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const source = ts.createSourceFile("main.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "Microphone");
assert(component, "Microphone component must be present");
const compiled = ts.transpileModule("export " + component.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

function harness() {
  const effects = [], listeners = new Map(), permissions = [], tracks = [], calls = [];
  let starts = 0;
  const exports = {};
  const surface = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) };
  const context = {
    exports,
    useRef: (current) => ({ current }),
    useState: (value) => [value, () => {}],
    useEffect: (effect) => effects.push(effect),
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    roles: [], roleInfo: {}, Mic: () => {}, Square: () => {}, ArrowUpRight: () => {}, Take: () => {}, UploadTake: () => {},
    document: surface, window: surface,
    api: async (_path, _method, body) => { calls.push(body.active); },
    fetch: async (_path, options) => { calls.push(JSON.parse(options.body).active); },
    navigator: { mediaDevices: { getUserMedia: () => new Promise((resolve) => permissions.push(() => {
      const track = { stopped: false, stop() { this.stopped = true; } };
      tracks.push(track);
      resolve({ getTracks: () => [track] });
    })) } },
    MediaRecorder: class {
      static isTypeSupported() { return true; }
      state = "inactive";
      start() { this.state = "recording"; starts++; }
      stop() { this.state = "inactive"; }
    },
    AudioContext: class {
      createAnalyser() { return { frequencyBinCount: 2, getByteFrequencyData: () => {} }; }
      createMediaStreamSource() { return { connect: () => {} }; }
      close() {}
    },
    Uint8Array, Blob, URL,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    setTimeout: () => 1, clearTimeout: () => {},
  };
  vm.runInNewContext(compiled, context);
  const tree = exports.Microphone({ session: { id: "test", me: { id: "crew" }, clips: [], playingUntil: 0 }, busy: "", action: (_label, fn) => fn(), notice: () => {} });
  const findRecord = (node) => node?.props?.["aria-label"] === "Record a take" ? node : node?.children?.flat(Infinity).map(findRecord).find(Boolean);
  const button = findRecord(tree);
  assert(button);
  effects.forEach((effect) => effect());
  return {
    record: button.props.onClick, permissions, tracks, calls,
    starts: () => starts,
    hide() { surface.hidden = true; listeners.get("visibilitychange")(); },
    show() { surface.hidden = false; },
    exit() { listeners.get("pagehide")(); },
  };
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

test("Late finish from a canceled request cannot clear a newer microphone opening", async () => {
  const mic = harness();
  const first = mic.record();
  await settled();
  assert.equal(mic.permissions.length, 1);
  mic.hide();
  mic.show();
  const second = mic.record();
  await settled();
  assert.equal(mic.permissions.length, 2);
  mic.permissions[0]();
  await first;
  assert.equal(mic.tracks[0].stopped, true);
  mic.hide();
  mic.permissions[1]();
  await second;
  assert.equal(mic.tracks[1].stopped, true, "The second suspension must cancel the newer permission request");
  assert.equal(mic.starts(), 0, "Neither late grant may start recording while hidden");
});

test("Leaving an idle microphone does not send a redundant lease release", () => {
  const mic = harness();
  mic.exit();
  assert.deepEqual(mic.calls, []);
});
