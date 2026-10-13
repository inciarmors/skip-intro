const video = document.querySelector("video");
const status = document.getElementById("status");
const signal = document.getElementById("signal");
const native = document.getElementById("native-intro");
const track = video.addTextTrack("chapters", "Chapters", "en");
track.mode = "hidden";
const metadata = document.createElement("script");
metadata.type = "application/ld+json";
metadata.id = "video-metadata";
document.head.append(metadata);
function syncNative() { native.hidden = signal.value !== "native" || video.currentTime < 3 || video.currentTime >= 9; }
function syncSignals() {
  for (const cue of Array.from(track.cues || [])) track.removeCue(cue);
  if (signal.value === "chapters") track.addCue(new VTTCue(3, 9, "Intro"));
  metadata.textContent = signal.value === "structured" ? JSON.stringify({
    "@context": "https://schema.org", "@type": "VideoObject", contentUrl: video.currentSrc,
    hasPart: [{ "@type": "Clip", name: "Opening credits", startOffset: 3, endOffset: 9 }]
  }) : "{}";
  syncNative();
}
syncSignals();
signal.addEventListener("change", syncSignals);
video.addEventListener("loadedmetadata", syncSignals);
video.addEventListener("timeupdate", syncNative);
native.onclick = () => { video.currentTime = 9; };
document.getElementById("intro").onclick = () => { video.currentTime = 4; };
document.getElementById("fullscreen").onclick = () => document.getElementById("player").requestFullscreen();
document.getElementById("generate").onclick = async event => {
  const button = event.currentTarget;
  button.disabled = true;
  let stream;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 960; canvas.height = 540;
    const ctx = canvas.getContext("2d");
    stream = canvas.captureStream(20);
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/mp4"].find(t => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const done = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    const start = performance.now();
    await new Promise(resolve => {
      const draw = () => {
        const elapsed = (performance.now() - start) / 1000;
        const intro = elapsed >= 3 && elapsed < 9;
        const glow = ctx.createRadialGradient(480, 250, 10, 480, 250, 600);
        glow.addColorStop(0, intro ? "#282828" : "#171717"); glow.addColorStop(1, "#080808");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 960, 540);
        ctx.strokeStyle = "#ffffff0a"; ctx.lineWidth = 1;
        for (let x = 0; x < 960; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 540); ctx.stroke(); }
        ctx.fillStyle = "#8d8d8d"; ctx.font = "13px system-ui"; ctx.fillText("S K I P  I N T R O   /   S Y N T H E T I C  S C E N E", 54, 62);
        ctx.fillStyle = "#f8f8f8"; ctx.font = "500 64px system-ui";
        ctx.fillText(intro ? "Opening credits." : "The story continues.", 54, 266);
        ctx.fillStyle = "#999"; ctx.font = "17px system-ui"; ctx.fillText(intro ? "The signal is present. The button appears." : "No intro. Nothing in your way.", 56, 306);
        ctx.font = "12px monospace"; ctx.fillText(`${elapsed.toFixed(1)} / 16.0`, 56, 445);
        ctx.fillStyle = "#ddd"; ctx.fillRect(56, 471, Math.min(848, elapsed / 16 * 848), 1);
        status.textContent = `Generating synthetic scene in memory… ${Math.min(16, Math.floor(elapsed))}/16 seconds`;
        if (elapsed >= 16) resolve(); else setTimeout(draw, 50);
      }; draw();
    });
    recorder.stop(); await done;
    if (video.src.startsWith("blob:")) URL.revokeObjectURL(video.src);
    video.addEventListener("loadedmetadata", () => {
      if (!Number.isFinite(video.duration)) {
        video.addEventListener("seeked", () => { video.currentTime = 0; }, { once: true });
        video.currentTime = 1e10;
      }
    }, { once: true });
    video.src = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
    status.textContent = "Scene ready. Play it or jump to the intro.";
  } catch (error) { status.textContent = `Unable to generate the scene: ${error.message}`; }
  finally { stream?.getTracks().forEach(track => track.stop()); button.disabled = false; }
};
