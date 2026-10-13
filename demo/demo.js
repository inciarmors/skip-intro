const video = document.querySelector("video");
const status = document.getElementById("status");
const track = video.addTextTrack("chapters", "Capitoli", "it");
track.mode = "hidden";
function chapters(on) {
  for (const cue of Array.from(track.cues || [])) track.removeCue(cue);
  if (on) track.addCue(new VTTCue(3, 9, "Sigla"));
}
chapters(true);
document.getElementById("chapters").onclick = () => chapters(true);
document.getElementById("manual").onclick = () => chapters(false);
document.getElementById("intro").onclick = () => { video.currentTime = 4; };
document.getElementById("fullscreen").onclick = () => document.getElementById("player").requestFullscreen();
document.getElementById("generate").onclick = async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 960; canvas.height = 540;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(20);
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
        ctx.fillStyle = intro ? "#233823" : "#192237"; ctx.fillRect(0, 0, 960, 540);
        ctx.fillStyle = intro ? "#b9ff83" : "#eef1f8"; ctx.font = "bold 64px system-ui";
        ctx.fillText(intro ? "SIGLA INIZIALE" : "LA STORIA CONTINUA", 60, 260);
        ctx.font = "24px system-ui"; ctx.fillText(`${elapsed.toFixed(1)} s / 16 s`, 60, 320);
        ctx.fillStyle = "#b9ff83"; ctx.fillRect(60, 440, Math.min(840, elapsed / 16 * 840), 4);
        status.textContent = `Generazione locale… ${Math.min(16, Math.floor(elapsed))}/16 secondi`;
        if (elapsed >= 16) resolve(); else requestAnimationFrame(draw);
      }; draw();
    });
    recorder.stop(); await done; stream.getTracks().forEach(track => track.stop());
    if (video.src.startsWith("blob:")) URL.revokeObjectURL(video.src);
    video.src = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
    // MediaRecorder WebM may initially report Infinity until the last frame is probed.
    video.addEventListener("loadedmetadata", () => {
      if (!Number.isFinite(video.duration)) {
        video.addEventListener("seeked", () => { video.currentTime = 0; }, { once: true });
        video.currentTime = 1e10;
      }
    }, { once: true });
    status.textContent = "Clip pronta. Premi Vai alla sigla oppure Play.";
  } catch (error) { status.textContent = `Generazione non disponibile: ${error.message}`; }
  finally { button.disabled = false; }
};
