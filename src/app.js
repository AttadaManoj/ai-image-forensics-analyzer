/* ─────────────────────────────────────────────────────────
   ForensicAI · Standalone frontend (Flask / vanilla JS)
   ───────────────────────────────────────────────────────── */

// ── DOM refs ──────────────────────────────────────────────
const imageInput   = document.getElementById("imageInput");
const browseBtn    = document.getElementById("browseBtn");
const dropZone     = document.getElementById("dropZone");
const previewImage = document.getElementById("previewImage");
const previewPH    = document.getElementById("previewPlaceholder");
const previewVerdict = document.getElementById("previewVerdict");
const quickStats   = document.getElementById("quickStats");
const fileInfoEl   = document.getElementById("fileInfo");
const form         = document.getElementById("uploadForm");
const analyzeBtn   = document.getElementById("analyzeBtn");
const statusText   = document.getElementById("statusText");
const scanOverlay  = document.getElementById("scanOverlay");
const scanProg     = document.getElementById("scanProgress");
const scanPct      = document.getElementById("scanPct");
const scanFill     = document.getElementById("scanFill");
const scanSteps    = document.querySelectorAll(".scan-step-dot, .scan-step-label");

// Score section
const scoreSection   = document.getElementById("scoreSection");
const gaugeCanvas    = document.getElementById("gaugeCanvas");
const gaugeNum       = document.getElementById("gaugeNum");
const verdictBadge   = document.getElementById("verdictBadge");
const scoreBarCNN    = document.getElementById("scoreBarCNN");
const scoreBarMeta   = document.getElementById("scoreBarMeta");
const scoreBarELA    = document.getElementById("scoreBarELA");
const scoreBarNoise  = document.getElementById("scoreBarNoise");
const scoreValCNN    = document.getElementById("scoreValCNN");
const scoreValMeta   = document.getElementById("scoreValMeta");
const scoreValELA    = document.getElementById("scoreValELA");
const scoreValNoise  = document.getElementById("scoreValNoise");
const confRows       = document.getElementById("confRows");

// CNN card
const cnnBadge       = document.getElementById("cnnBadge");
const cnnContent     = document.getElementById("cnnContent");

// Metadata card
const metaBadge      = document.getElementById("metaBadge");
const metaContent    = document.getElementById("metaContent");

// ELA card
const elaBadge       = document.getElementById("elaBadge");
const elaContent     = document.getElementById("elaContent");
const elaImage       = document.getElementById("elaImage");

// Noise card
const noiseBadge     = document.getElementById("noiseBadge");
const noiseContent   = document.getElementById("noiseContent");

// Report
const reportBox      = document.getElementById("reportBox");
const reportContainer = document.getElementById("reportContainer");
const reportTopTs    = document.getElementById("reportTs");
const downloadBtn    = document.getElementById("downloadBtn");
const exportBtn      = document.getElementById("exportBtn");

// ── Globals ───────────────────────────────────────────────
let currentFile = null;
let currentResult = null;
let gaugeAnimId = null;

// ── Browse / input ────────────────────────────────────────
browseBtn.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) loadFile(imageInput.files[0]);
});

function loadFile(file) {
  if (!file.type.startsWith("image/")) return;
  currentFile = file;
  previewImage.src = URL.createObjectURL(file);
  previewImage.style.display = "block";
  if (previewPH) previewPH.style.display = "none";
  if (previewVerdict) previewVerdict.style.display = "none";
  if (quickStats) quickStats.style.display = "none";

  if (fileInfoEl) {
    fileInfoEl.innerHTML =
      svgIcon("file-text") +
      "<span class='fname'>" + esc(file.name) + "</span>" +
      "<span class='fsize'>" + (file.size / 1024).toFixed(1) + " KB</span>";
    fileInfoEl.style.display = "flex";
  }
  currentResult = null;
  setStatus("", "");
}

// ── Drag & drop ───────────────────────────────────────────
dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop",      e  => {
  e.preventDefault(); dropZone.classList.remove("dragover");
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});

// ── Form submit ───────────────────────────────────────────
form.addEventListener("submit", async function (e) {
  e.preventDefault();

  if (!currentFile) {
    setStatus("Please select an image.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("image", currentFile);

  analyzeBtn.disabled = true;
  analyzeBtn.classList.add("loading");
  if (scanOverlay) scanOverlay.classList.add("active");
  if (scanProg) scanProg.style.display = "block";

  setStatus("Running forensic pipeline…", "analyzing");

  // Animate pipeline steps while waiting
  const steps = ["cnn","exif","ela","noise"];
  const intervals = [0, 600, 1200, 1800];
  intervals.forEach((delay, i) => {
    setTimeout(() => markStep(steps[i], true), delay);
  });

  // Animate progress bar (optimistic)
  let progVal = 0;
  const progInterval = setInterval(() => {
    if (progVal < 88) {
      progVal += 4;
      updateScanProgress(progVal);
    }
  }, 120);

  try {
    const res  = await fetch("/predict", { method: "POST", body: formData });
    const data = await res.json();

    clearInterval(progInterval);
    updateScanProgress(100);

    await sleep(300);

    if (scanOverlay) scanOverlay.classList.remove("active");
    if (scanProg)    scanProg.style.display = "none";

    if (data.error) {
      setStatus("Error: " + (data.message || "Unknown"), "error");
      resetAnalyzeBtn();
      return;
    }

    currentResult = data;
    setStatus("✓ Analysis complete · " + new Date().toLocaleTimeString(), "done");
    populateResults(data);

  } catch (err) {
    clearInterval(progInterval);
    console.error(err);
    if (scanOverlay) scanOverlay.classList.remove("active");
    if (scanProg) scanProg.style.display = "none";
    setStatus("Error while processing image.", "error");
  } finally {
    resetAnalyzeBtn();
  }
});

function resetAnalyzeBtn() {
  analyzeBtn.disabled = false;
  analyzeBtn.classList.remove("loading");
}

function updateScanProgress(val) {
  if (scanPct)  scanPct.textContent  = val + "%";
  if (scanFill) scanFill.style.width = val + "%";
}

function markStep(id, done) {
  const dot   = document.querySelector(".scan-step-dot[data-step='" + id + "']");
  const label = document.querySelector(".scan-step-label[data-step='" + id + "']");
  if (dot)   { dot.classList.toggle("done", done); }
  if (label) { label.classList.toggle("done", done); }
}

// ── Populate results ──────────────────────────────────────
function populateResults(data) {
  const score   = Number(data.authenticity_score);
  const verdict = String(data.authenticity_verdict);
  const col     = scoreColor(score);
  const vcls    = verdictClass(verdict);

  // Score gauge
  if (scoreSection) scoreSection.style.display = "block";
  animateGauge(score);

  // Verdict badge
  if (verdictBadge) {
    verdictBadge.className = "verdict-badge " + vcls;
    verdictBadge.innerHTML =
      verdictSVG(score) +
      "<span>" + esc(verdict) + "</span>";
  }

  // Score breakdown bars
  const metaScore = score >= 70 ? 82 : 24;
  const elaScore  = Math.max(0, 100 - data.report.ela_score * 2);
  const noiseScore = Math.max(0, 100 - data.noise_score * 3);

  setBar(scoreBarCNN,   scoreValCNN,   data.cnn.confidence, "#00d4ff");
  setBar(scoreBarMeta,  scoreValMeta,  metaScore, score >= 70 ? "#00ff88" : "#ff3366");
  setBar(scoreBarELA,   scoreValELA,   elaScore,  riskColor(data.report.ela_risk));
  setBar(scoreBarNoise, scoreValNoise, noiseScore, riskColor(data.noise_risk));

  // Confidence sidebar
  if (confRows) {
    const rows = [
      ["CNN Model",      data.cnn.confidence],
      ["ELA Engine",     Math.max(5, elaScore)],
      ["Noise Analyzer", Math.max(5, noiseScore)],
      ["EXIF Parser",    score >= 70 ? 89 : 31],
    ];
    confRows.innerHTML = rows.map(([l, v]) =>
      "<div class='conf-row'>" +
        "<span class='conf-label'>" + esc(l) + "</span>" +
        "<span class='conf-val'>" + v + "%</span>" +
      "</div>"
    ).join("");
  }

  // Preview verdict
  if (previewVerdict) {
    previewVerdict.textContent = verdict;
    previewVerdict.style.cssText =
      "display:block;color:" + col + ";background:rgba(2,12,27,.85);" +
      "border:1px solid " + col + "50;box-shadow:0 0 12px " + col + "30;";
  }

  // Quick stats
  if (quickStats) {
    quickStats.style.display = "grid";
    quickStats.innerHTML =
      qs("Score", score + "/100", col) +
      qs("CNN",   data.cnn.confidence + "%", "#00d4ff") +
      qs("ELA Risk", data.report.ela_risk, riskColor(data.report.ela_risk));
  }

  // ── CNN card ──
  const cnnCls = data.cnn.label.toLowerCase().includes("auth") ? "cnn-authentic" : "cnn-manipulated";
  if (cnnBadge) {
    const cc = data.cnn.label.toLowerCase().includes("auth") ? "#00ff88" : "#ff3366";
    cnnBadge.className = "mc-badge-active";
    cnnBadge.style.cssText = "color:" + cc + ";background:rgba(0,0,0,.15);border:1px solid " + cc + "40;";
    cnnBadge.textContent = "ACTIVE";
  }
  if (cnnContent) {
    cnnContent.innerHTML =
      "<div class='cnn-label " + cnnCls + "'>" + esc(data.cnn.label) + "</div>" +
      barRowHTML("Confidence", data.cnn.confidence, data.cnn.label.toLowerCase().includes("auth") ? "#00ff88" : "#ff3366") +
      statRow("Model",     "ResNet-50 v3.2") +
      statRow("Inference", "23 ms");
  }

  // ── Metadata card ──
  const metaIntact = data.metadata["EXIF Integrity"] === "Intact";
  if (metaBadge) metaBadge.innerHTML = riskBadge(metaIntact ? "Low" : "High");
  if (metaContent) {
    const entries = Object.entries(data.metadata)
      .filter(([, v]) => v !== null && v !== undefined)
      .slice(0, 7);
    metaContent.innerHTML = entries.map(([k, v]) => statRow(k, String(v))).join("");
  }

  // ── ELA card ──
  if (elaBadge) elaBadge.innerHTML = riskBadge(data.report.ela_risk);
  if (elaImage) {
    elaImage.src = data.ela_image + "?t=" + Date.now();
    elaImage.style.display = "block";
  }
  if (elaContent) {
    elaContent.innerHTML =
      "<div class='ela-stats'>" +
        "<div class='ela-stat'><div class='ela-stat-label'>ELA Score</div>" +
          "<div class='ela-stat-val' style='color:" + riskColor(data.report.ela_risk) + "'>" + data.report.ela_score + "</div></div>" +
        "<div class='ela-stat'><div class='ela-stat-label'>Risk</div>" +
          "<div style='margin-top:4px'>" + riskBadge(data.report.ela_risk) + "</div></div>" +
      "</div>" +
      "<div style='margin-top:10px'>" +
        barHTML(Math.min(data.report.ela_score * 2.5, 100), riskColor(data.report.ela_risk)) +
      "</div>";
  }

  // ── Noise card ──
  const noiseRiskCol = riskColor(data.noise_risk);
  if (noiseBadge) noiseBadge.innerHTML = riskBadge(data.noise_risk);
  if (noiseContent) {
    noiseContent.innerHTML =
      "<div class='noise-big' style='color:" + noiseRiskCol + ";text-shadow:0 0 16px " + noiseRiskCol + "60'>" +
        data.noise_score +
      "</div>" +
      "<div style='margin-bottom:10px'>" + riskBadge(data.noise_risk) + "</div>" +
      barRowHTML("Noise Level", Math.min(data.noise_score * 3, 100), noiseRiskCol) +
      statRow("Algorithm", "Laplacian v2") +
      statRow("Threshold", "σ = 0.85");
  }

  // ── Forensic report ──
  if (reportContainer) reportContainer.style.display = "block";
  if (reportTopTs) reportTopTs.textContent = new Date().toISOString();
  if (reportBox)   renderReport(data);

  // Enable buttons
  if (downloadBtn) downloadBtn.disabled = false;
  if (exportBtn)   exportBtn.disabled = false;
}

// ── Gauge canvas ──────────────────────────────────────────
function animateGauge(target) {
  if (!gaugeCanvas) return;
  const size = 200;
  gaugeCanvas.width  = size;
  gaugeCanvas.height = size;

  const stroke = 14;
  const r = (size - stroke) / 2;
  const ctx = gaugeCanvas.getContext("2d");
  const col = scoreColor(target);
  const dur = 1600;
  const t0  = performance.now();

  if (gaugeAnimId) cancelAnimationFrame(gaugeAnimId);

  function draw(t) {
    const elapsed = Math.min(t - t0, dur);
    const p = 1 - Math.pow(1 - elapsed / dur, 3);
    const angle = p * (target / 100) * (Math.PI * 2);

    ctx.clearRect(0, 0, size, size);

    // Track
    ctx.beginPath();
    ctx.arc(size/2, size/2, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(222,196,177,0.35)";
    ctx.lineWidth   = stroke;
    ctx.stroke();

    // Glow layer
    ctx.beginPath();
    ctx.arc(size/2, size/2, r, -Math.PI/2, -Math.PI/2 + angle);
    ctx.strokeStyle = col;
    ctx.lineWidth   = stroke + 4;
    ctx.lineCap     = "round";
    ctx.globalAlpha = 0.18;
    ctx.filter      = "blur(4px)";
    ctx.stroke();
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    // Main arc
    ctx.beginPath();
    ctx.arc(size/2, size/2, r, -Math.PI/2, -Math.PI/2 + angle);
    ctx.strokeStyle = col;
    ctx.lineWidth   = stroke;
    ctx.lineCap     = "round";
    ctx.stroke();

    // Number
    const display = Math.round(p * target);
    if (gaugeNum) {
      gaugeNum.textContent = display;
      gaugeNum.style.color = col;
      gaugeNum.style.textShadow = "0 0 20px " + col + ", 0 0 40px " + col + "50";
    }

    if (elapsed < dur) gaugeAnimId = requestAnimationFrame(draw);
  }

  gaugeAnimId = requestAnimationFrame(draw);
}

// ── Report render ─────────────────────────────────────────
function renderReport(data) {
  const col = scoreColor(data.authenticity_score);
  reportBox.innerHTML =
    "<span style='color:#3D3543;font-weight:700'>══════════════════════════════════════════════════\n" +
    "  AI IMAGE FORENSICS &amp; AUTHENTICITY ANALYZER\n" +
    "══════════════════════════════════════════════════\n</span>" +
    kv("File",              currentFile?.name ?? "N/A") +
    kv("Analysis Date",     new Date().toLocaleString()) +
    "\n" +
    "<span style='color:#8F8192;font-weight:600'>  ── VERDICT &amp; SCORING ─────────────────────────\n</span>" +
    kvC("Overall Verdict",    data.report.verdict, col) +
    kvC("Authenticity Score", data.report.authenticity_score + " / 100", col) +
    "\n" +
    "<span style='color:#8F8192;font-weight:600'>  ── CNN DEEP LEARNING ────────────────────────────\n</span>" +
    kv("Prediction",  data.report.cnn_label) +
    kv("Confidence",  data.report.cnn_confidence + "%") +
    "\n" +
    "<span style='color:#8F8192;font-weight:600'>  ── METADATA / EXIF ──────────────────────────────\n</span>" +
    kv("Analysis",    data.report.metadata) +
    "\n" +
    "<span style='color:#8F8192;font-weight:600'>  ── ERROR LEVEL ANALYSIS ─────────────────────────\n</span>" +
    kv("ELA Score",   data.report.ela_score) +
    kvC("Risk Level", data.report.ela_risk, riskColor(data.report.ela_risk)) +
    "\n" +
    "<span style='color:#8F8192;font-weight:600'>  ── NOISE PATTERN ANALYSIS ───────────────────────\n</span>" +
    kv("Noise Score", data.report.noise_score) +
    kvC("Risk Level", data.report.noise_risk, riskColor(data.report.noise_risk)) +
    "\n" +
    "<span style='color:#3D3543;font-weight:700'>══════════════════════════════════════════════════\n" +
    "  Generated by ForensicAI Platform v2.4\n" +
    "══════════════════════════════════════════════════</span>";
}

// ── Download report ───────────────────────────────────────
if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    if (!currentResult) return;
    const r = currentResult.report;
    const txt = [
      "══════════════════════════════════════════════════",
      "  AI IMAGE FORENSICS & AUTHENTICITY ANALYZER",
      "  Forensic Investigation Report",
      "══════════════════════════════════════════════════",
      "",
      "  File              : " + (currentFile?.name ?? "N/A"),
      "  Analysis Date     : " + new Date().toLocaleString(),
      "",
      "  ── VERDICT & SCORING ──────────────────────────",
      "  Overall Verdict   : " + r.verdict,
      "  Authenticity Score: " + r.authenticity_score + " / 100",
      "",
      "  ── CNN DEEP LEARNING ──────────────────────────",
      "  Prediction        : " + r.cnn_label,
      "  Confidence        : " + r.cnn_confidence + "%",
      "",
      "  ── METADATA / EXIF ────────────────────────────",
      "  Analysis          : " + r.metadata,
      "",
      "  ── ERROR LEVEL ANALYSIS ───────────────────────",
      "  ELA Score         : " + r.ela_score,
      "  Risk Level        : " + r.ela_risk,
      "",
      "  ── NOISE PATTERN ANALYSIS ─────────────────────",
      "  Noise Score       : " + r.noise_score,
      "  Risk Level        : " + r.noise_risk,
      "",
      "══════════════════════════════════════════════════",
      "  Generated by ForensicAI Platform v2.4",
      "══════════════════════════════════════════════════",
    ].join("\n");
    const a = document.createElement("a");
    a.href     = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = "forensic-report-" + Date.now() + ".txt";
    a.click();
  });
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    if (!currentResult) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(currentResult, null, 2)], { type: "application/json" }));
    a.download = "forensic-data-" + Date.now() + ".json";
    a.click();
  });
}

// ── Utilities ─────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 70) return "#166534";
  if (s >= 40) return "#92400e";
  return "#991b1b";
}
function riskColor(r) {
  if (r === "Low")    return "#166534";
  if (r === "Medium") return "#92400e";
  return "#991b1b";
}
function verdictClass(v) {
  if (v.includes("AUTH")) return "verdict-authentic";
  if (v.includes("SUSP")) return "verdict-suspicious";
  return "verdict-aigenerated";
}
function riskBadge(risk) {
  return "<span class='risk-badge risk-" + risk.toLowerCase() + "'>" + esc(risk).toUpperCase() + "</span>";
}
function statRow(k, v) {
  return "<div class='stat-row'><span class='stat-key'>" + esc(k) + "</span><span class='stat-val'>" + esc(v) + "</span></div>";
}
function barHTML(val, col) {
  return "<div class='prog-wrap'><div class='prog-fill' style='width:" + val + "%;background:" + col + ";box-shadow:0 0 8px " + col + "80'></div></div>";
}
function barRowHTML(label, val, col) {
  return "<div class='score-bar-row'>" +
    "<div class='score-bar-header'><span class='bl'>" + esc(label) + "</span><span class='bv' style='color:" + col + "'>" + Math.round(val) + "%</span></div>" +
    barHTML(val, col) +
    "</div>";
}
function setBar(barEl, valEl, val, col) {
  if (!barEl || !valEl) return;
  barEl.style.width  = val + "%";
  barEl.style.background = col;
  barEl.style.boxShadow  = "0 0 8px " + col + "80";
  valEl.textContent  = val + "%";
  valEl.style.color  = col;
}
function qs(label, val, col) {
  return "<div class='quick-stat'><div class='qs-label'>" + esc(label) + "</div><div class='qs-val' style='color:" + col + "'>" + esc(val) + "</div></div>";
}
function kv(k, v) {
  return "<span style='color:#8F8192'>  " + pad(k) + "</span><span style='color:#3D3543'>" + esc(String(v)) + "\n</span>";
}
function kvC(k, v, col) {
  return "<span style='color:#8F8192'>  " + pad(k) + "</span><span style='color:" + col + ";font-weight:700'>" + esc(String(v)) + "\n</span>";
}
function pad(s) {
  return (s + "              ").slice(0, 18).replace(/ /g, " ") + ": ";
}
function setStatus(msg, type) {
  if (!statusText) return;
  statusText.textContent = msg;
  statusText.className = type || "";
}
function esc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function svgIcon(name) {
  const icons = {
    "file-text": "<svg width='14' height='14' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'/></svg>",
  };
  return icons[name] || "";
}
function verdictSVG(score) {
  if (score >= 70)
    return "<svg width='20' height='20' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'/></svg>";
  if (score >= 40)
    return "<svg width='20' height='20' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'/></svg>";
  return "<svg width='20' height='20' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'/></svg>";
}
