import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import "../extension/fingerprint.js";
const { Matcher, windowMatch, cleanLibrary } = globalThis.SkipIntroFingerprint;
const hash = value => createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
const sample = (t, value) => ({ t, v: hash(value), a: null });

test("learns a recurring sequence after two distinct episodes and recognizes it in a third", () => {
  const first = new Matcher({}, "episode-1");
  for (let t = 0; t < 100; t++) first.add(sample(t, t));
  assert.equal(first.candidate, null);
  const second = new Matcher(first.snapshot(), "episode-2");
  for (let t = 0; t < 100; t++) second.add(sample(t, t >= 40 && t <= 80 ? t - 30 : t + 1000));
  assert.equal(second.library.templates.length, 1);
  assert.equal(second.library.templates[0].duration, 40);
  const third = new Matcher(second.snapshot(), "episode-3");
  for (let t = 20; t <= 27; t++) third.add(sample(t, t - 10));
  assert.equal(third.candidate?.start, 20);
  assert.equal(third.candidate?.end, 60);
  third.interrupt();
  assert.equal(third.candidate, null);
});
test("does not learn from replaying the same episode or from static frames", () => {
  const first = new Matcher({}, "same-episode");
  for (let t = 0; t < 60; t++) first.add(sample(t, t));
  const second = new Matcher(first.snapshot(), "same-episode");
  for (let t = 0; t < 60; t++) second.add(sample(t, t));
  assert.equal(second.library.templates.length, 0);
  const still = Array.from({ length: 8 }, (_, t) => sample(t, 1));
  assert.equal(windowMatch(still, still), false);
});
test("rejects discontinuities and malformed persisted descriptors", () => {
  const sequence = Array.from({ length: 8 }, (_, t) => sample(t, t));
  assert.equal(windowMatch(sequence, sequence), true);
  const discontinuous = sequence.map((s, i) => ({ ...s, t: s.t + (i > 3 ? 100 : 0) }));
  assert.equal(windowMatch(discontinuous, sequence), false);
  assert.deepEqual(cleanLibrary({ templates: [{ duration: Infinity }], episodes: [{ id: "e", samples: [{ t: 2, v: "bad" }] }] }), { episodes: [{ id: "e", samples: [] }], templates: [] });
});
