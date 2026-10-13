import test from "node:test";
import assert from "node:assert/strict";
import "../extension/core.js";
const { segment, fromCues, fromStructuredData, active, seekTarget, isSkipLabel } = globalThis.SkipIntroCore;

test("rejects invalid boundaries and unknown or live duration", () => {
  assert.deepEqual(segment(0, 90, 1800), { start: 0, end: 90, source: "chapters" });
  for (const args of [[-1, 80, 1800], [100, 50, 1800], [0, 301, 1800], [0, 80, 50], [0, 80, Infinity], ["", 80, 1800], [" ", 80, 1800], [false, 80, 1800], [[], 80, 1800], [0, NaN, 1800]]) assert.equal(segment(...args), null);
});
test("reads intro chapters but rejects dialogue, recaps, credits and subtitles", () => {
  for (const text of ["Intro", " Opening ", "Opening credits", "Title sequence"]) assert.equal(fromCues([{ text, startTime: 12, endTime: 80 }], "chapters", 2000)[0]?.end, 80);
  for (const text of ["Previously on", "Recap", "End credits", "Introducing John", "[music]"]) assert.deepEqual(fromCues([{ text, startTime: 12, endTime: 80 }], "chapters", 2000), []);
  assert.deepEqual(fromCues([{ text: "Intro", startTime: 0, endTime: 90 }], "subtitles", 1800), []);
});
test("reads explicit metadata and multiple valid ranges", () => {
  const cue = text => ({ text, startTime: 10, endTime: 90 });
  assert.equal(fromCues([cue('{"type":"intro","start":15,"end":75}')], "metadata", 200)[0]?.start, 15);
  for (const text of ["{broken", "null", '{"type":"outro"}', '{"type":"intro","start":-5}', '{"type":"intro","end":900}']) assert.deepEqual(fromCues([cue(text)], "metadata", 200), []);
  assert.equal(fromCues([{ text: "Intro", startTime: 10, endTime: 30 }, { text: "Opening", startTime: 40, endTime: 80 }], "chapters", 200).length, 2);
});
test("structured data requires the exact media source and a bounded intro clip", () => {
  const data = { "@type": "VideoObject", contentUrl: "/episode.mp4", hasPart: [{ "@type": "Clip", name: "Intro", startOffset: 10, endOffset: 80 }] };
  assert.equal(fromStructuredData({ "@graph": [data] }, "https://example.com/episode.mp4", "https://example.com/watch", 200)[0]?.end, 80);
  assert.deepEqual(fromStructuredData(data, "https://example.com/other.mp4", "https://example.com/watch", 200), []);
  assert.deepEqual(fromStructuredData(data, "", "https://example.com/watch", 200), []);
});
test("skip labels are precise and do not accept ad or recap controls", () => {
  assert.equal(isSkipLabel(" Skip  intro "), true);
  assert.equal(isSkipLabel("Skip opening credits"), true);
  for (const text of ["Skip", "Skip ad", "Skip recap", "Skip credits", "Learn to skip intro"]) assert.equal(isSkipLabel(text), false);
});
test("seeking is only possible within an active intro and available range", () => {
  const intro = segment(10, 90, 1800);
  assert.equal(active(intro, 9.9), false); assert.equal(active(intro, 10), true); assert.equal(active(intro, 90), false);
  assert.equal(seekTarget(intro, 30, 1800, [[0, 1800]]), 90);
  for (const ranges of [[], [[0, 40]], [[0, 80], [100, 1800]]]) assert.equal(seekTarget(intro, 30, 1800, ranges), null);
  assert.equal(seekTarget(intro, 5, 1800, [[0, 1800]]), null);
  assert.equal(seekTarget(intro, 30, Infinity, [[0, 1800]]), null);
});
