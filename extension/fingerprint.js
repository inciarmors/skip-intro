/* Non-ML sequence matching over compact perceptual descriptors, never media files. */
(() => {
  "use strict";
  const WINDOW = 8, MIN_REPEAT = 18, MAX_INTRO = 240;
  const bits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  const validVideo = value => typeof value === "string" && /^[0-9a-f]{16}$/.test(value);
  const validAudio = value => typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
  function hamming(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += bits[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
    return sum;
  }
  function similar(a, b) {
    const visual = validVideo(a.v) && validVideo(b.v);
    const audio = validAudio(a.a) && validAudio(b.a);
    if (!visual && !audio) return false;
    if (visual && hamming(a.v, b.v) > (audio ? 8 : 5)) return false;
    if (audio) {
      let distance = 0;
      for (let i = 0; i < 32; i++) distance += Math.abs(parseInt(a.a[i], 16) - parseInt(b.a[i], 16));
      if (distance / 32 > (visual ? 2 : 0.8)) return false;
    }
    return true;
  }
  function contiguous(samples) {
    return samples.every((sample, i) => !i || (sample.t - samples[i - 1].t >= 0.4 && sample.t - samples[i - 1].t <= 1.8));
  }
  function distinctive(samples) {
    const visual = samples.filter(sample => validVideo(sample.v));
    if (visual.length >= 6 && new Set(visual.map(sample => sample.v)).size >= 5 && visual.some(sample => hamming(sample.v, visual[0].v) >= 10)) return true;
    const audio = samples.filter(sample => validAudio(sample.a));
    return audio.length === samples.length && new Set(audio.map(sample => sample.a)).size >= 6 && audio.some(sample => !similar({ a: sample.a }, { a: audio[0].a }));
  }
  function windowMatch(live, reference) {
    return live.length === WINDOW && reference.length === WINDOW && contiguous(live) && contiguous(reference) &&
      distinctive(reference) && live.filter((sample, i) => similar(sample, reference[i])).length >= WINDOW - 1;
  }
  function cleanSamples(samples, maxTime = 600) {
    if (!Array.isArray(samples)) return [];
    return samples.slice(0, 601).filter(sample => sample && Number.isFinite(sample.t) && sample.t >= 0 && sample.t <= maxTime &&
      (validVideo(sample.v) || validAudio(sample.a))).map(sample => ({ t: sample.t, v: validVideo(sample.v) ? sample.v : null, a: validAudio(sample.a) ? sample.a : null }));
  }
  function cleanLibrary(value) {
    return {
      episodes: Array.isArray(value?.episodes) ? value.episodes.slice(-4).filter(ep => typeof ep?.id === "string").map(ep => ({ id: ep.id, samples: cleanSamples(ep.samples) })) : [],
      templates: Array.isArray(value?.templates) ? value.templates.slice(-4).filter(t => Number.isFinite(t?.duration) && t.duration >= MIN_REPEAT && t.duration <= MAX_INTRO).map(t => ({ duration: t.duration, samples: cleanSamples(t.samples, MAX_INTRO) })).filter(t => t.samples.length >= MIN_REPEAT) : []
    };
  }

  class Matcher {
    constructor(library, id) {
      this.library = cleanLibrary(library);
      this.id = id;
      this.samples = [];
      this.window = [];
      this.run = null;
      this.candidate = null;
      this.dirty = false;
    }
    add(sample) {
      if (!cleanSamples([sample]).length) { this.interrupt(); return null; }
      const previous = this.window.at(-1);
      if (previous && (sample.t - previous.t < 0.4 || sample.t - previous.t > 1.8)) this.interrupt();
      this.samples.push(sample);
      this.samples = this.samples.slice(-601);
      this.window.push(sample);
      this.window = this.window.slice(-WINDOW);
      this.candidate = null;
      for (const template of this.library.templates) {
        for (let j = WINDOW - 1; j < template.samples.length; j++) {
          if (!windowMatch(this.window, template.samples.slice(j - WINDOW + 1, j + 1))) continue;
          const start = sample.t - template.samples[j].t;
          const end = start + template.duration;
          if (start >= 0 && sample.t < end - 1) { this.candidate = { start, end, source: "recurring-sequence", observedAt: sample.t }; break; }
        }
        if (this.candidate) break;
      }
      this.learn(sample);
      return this.candidate;
    }
    learn(sample) {
      if (this.run) {
        const run = this.run;
        const index = run.reference.samples.findIndex((s, i) => i > run.lastIndex && Math.abs((sample.t - s.t) - run.offset) < 0.65);
        if (index !== -1 && similar(sample, run.reference.samples[index])) {
          run.lastIndex = index; run.misses = 0;
        } else if (++run.misses >= 3) {
          const matched = run.reference.samples.slice(run.startIndex, run.lastIndex + 1);
          const duration = matched.at(-1).t - matched[0].t;
          // A conservative endpoint stops at the final confirmed matching sample.
          if (duration >= MIN_REPEAT && duration <= MAX_INTRO && contiguous(matched) && distinctive(matched)) {
            const samples = matched.map(s => ({ ...s, t: s.t - matched[0].t }));
            this.library.templates.push({ duration, samples });
            this.library.templates = this.library.templates.slice(-4);
            this.dirty = true;
          }
          this.run = null;
        }
        if (this.run) return;
      }
      if (this.window.length < WINDOW) return;
      for (const reference of this.library.episodes) {
        if (reference.id === this.id) continue;
        for (let j = WINDOW - 1; j < reference.samples.length; j++) {
          if (windowMatch(this.window, reference.samples.slice(j - WINDOW + 1, j + 1))) {
            // A window tolerates one mismatch; never include that mismatch as a boundary.
            let first = 0, last = WINDOW - 1;
            const base = j - WINDOW + 1;
            while (first < last && !similar(this.window[first], reference.samples[base + first])) first++;
            while (last > first && !similar(this.window[last], reference.samples[base + last])) last--;
            this.run = { reference, startIndex: base + first, lastIndex: base + last, offset: sample.t - reference.samples[j].t, misses: WINDOW - 1 - last };
            return;
          }
        }
      }
    }
    interrupt() { this.window = []; this.run = null; this.candidate = null; }
    snapshot() {
      const episodes = this.library.episodes.filter(ep => ep.id !== this.id);
      if (this.samples.length >= WINDOW) episodes.push({ id: this.id, samples: this.samples });
      return cleanLibrary({ episodes: episodes.slice(-4), templates: this.library.templates });
    }
  }
  globalThis.SkipIntroFingerprint = Object.freeze({ Matcher, similar, windowMatch, cleanLibrary });
})();
