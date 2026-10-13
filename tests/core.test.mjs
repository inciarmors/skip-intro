import test from "node:test";
import assert from "node:assert/strict";
import "../extension/core.js";
const { segment, fromCues, active, seekTarget, mediaIdentity } = globalThis.SkipIntroCore;

test("validates boundaries and rejects unknown/live duration", () => {
  assert.deepEqual(segment(0, 90, 1800), { start: 0, end: 90, source: "chapters" });
  for (const args of [[-1, 80, 1800], [100, 50, 1800], [0, 301, 1800], [0, 80, 50], [0, 80, Infinity], ["", 80, 1800], [" ", 80, 1800], [false, 80, 1800], [[], 80, 1800], [0, NaN, 1800], [null, 80, 1800]]) {
    assert.equal(segment(...args), null);
  }
});
test("recognizes chapter labels without mistaking subtitles, recaps or incidental text for intros", () => {
  for (const label of ["Intro", " Sigla ", "Opening Credits", "Générique", "Vorspann"]) {
    assert.equal(fromCues([{ text: label, startTime: 12, endTime: 80 }], "chapters", 2000)?.end, 80);
  }
  for (const label of ["Previously on", "Recap", "End credits", "Introducing John", "[music]"]) {
    assert.equal(fromCues([{ text: label, startTime: 12, endTime: 80 }], "chapters", 2000), null);
  }
  assert.equal(fromCues([{ text: "Intro", startTime: 0, endTime: 90 }], "subtitles", 1800), null);
});
test("accepts explicit intro metadata and ignores malformed or invalid payloads", () => {
  const cue = text => ({ text, startTime: 10, endTime: 90 });
  assert.equal(fromCues([cue('{"type":"intro","start":15,"end":75}')], "metadata", 200)?.start, 15);
  assert.equal(fromCues([cue('{"type":"intro"}')], "metadata", 200)?.end, 90);
  for (const text of ["{broken", "null", '{"type":"outro"}', '{"type":"intro","start":-5}', '{"type":"intro","end":900}']) {
    assert.equal(fromCues([cue(text)], "metadata", 200), null);
  }
});
test("skip is offered only within the half-open intro interval", () => {
  const intro = segment(10, 90, 1800);
  assert.equal(active(intro, 9.9), false);
  assert.equal(active(intro, 10), true);
  assert.equal(active(intro, 89.9), true);
  assert.equal(active(intro, 90), false);
  assert.equal(active(intro, NaN), false);
});
test("seeks to the exact intro end only when available, including disjoint ranges", () => {
  const intro = segment(10, 90, 1800);
  assert.equal(seekTarget(intro, 30, 1800, [[0, 1800]]), 90);
  assert.equal(seekTarget(intro, 30, 1800, [[0, 40], [80, 100]]), 90);
  for (const ranges of [[], [[0, 40]], [[0, 80], [100, 1800]]]) {
    assert.equal(seekTarget(intro, 30, 1800, ranges), null);
  }
  assert.equal(seekTarget(intro, 5, 1800, [[0, 1800]]), null);
  assert.equal(seekTarget(intro, 30, Infinity, [[0, 1800]]), null);
});
test("saved intervals distinguish episodes, media and players", () => {
  const first = mediaIdentity("https://example.com/watch?ep=1", "blob:one", 100, 0);
  assert.equal(first, mediaIdentity("https://example.com/watch?ep=1", "blob:two", 100, 0));
  assert.notEqual(first, mediaIdentity("https://example.com/watch?ep=2", "blob:one", 100, 0));
  assert.notEqual(first, mediaIdentity("https://example.com/watch?ep=1", "blob:one", 200, 0));
  assert.notEqual(first, mediaIdentity("https://example.com/watch?ep=1", "blob:one", 100, 1));
  assert.equal(mediaIdentity("url", "blob:one", Infinity, 0), null);
});
