import {
  useState, useRef, useCallback, useEffect,
  type DragEvent, type ChangeEvent,
} from 'react';
import {
  Shield, Upload, AlertTriangle, CheckCircle, XCircle,
  FileText, Cpu, Image as ImageIcon, Activity, Download,
  Eye, Zap, Search, Server, ChevronRight,
  BarChart2, Database, Wifi,
} from 'lucide-react';

/* ── Pebble palette constants ── */
const P = {
  primary:    '#3D3543',
  secondary:  '#8F8192',
  accent:     '#DEC4B1',
  bg:         '#F6ECF0',
  surface:    'rgba(255,255,255,0.88)',
  surfaceHi:  'rgba(255,255,255,0.96)',
  border:     'rgba(222,196,177,0.55)',
  borderHi:   'rgba(222,196,177,0.85)',
  accentDim:  'rgba(222,196,177,0.25)',
  primaryDim: 'rgba(61,53,67,0.07)',
  shadowSm:   '0 2px 10px rgba(61,53,67,0.09)',
  shadowMd:   '0 4px 24px rgba(61,53,67,0.12)',
  shadowLg:   '0 8px 40px rgba(61,53,67,0.16)',
  statusOk:   '#166534',
  statusWarn: '#92400e',
  statusErr:  '#991b1b',
};

/* ── Types ── */
type AnalysisState = 'idle' | 'scanning' | 'done' | 'error';
interface CNNResult { label: string; confidence: number }
interface ReportData {
  verdict: string; authenticity_score: number;
  cnn_label: string; cnn_confidence: number;
  metadata: string; ela_score: number; ela_risk: string;
  noise_score: number; noise_risk: string;
}
interface AnalysisResult {
  authenticity_score: number; authenticity_verdict: string;
  metadata: Record<string, string | number | null>;
  cnn: CNNResult; noise_score: number; noise_risk: string;
  report: ReportData;
}

/* ── Mock data ── */
function mockAnalysis(file: File): AnalysisResult {
  const s = file.size % 100;
  const ok = s > 38;
  const score = ok ? 68 + (s % 28) : 12 + (s % 32);
  const ela = ok ? 4 + (s % 18) : 28 + (s % 35);
  const noise = ok ? 2 + (s % 12) : 16 + (s % 22);
  const elaRisk = ela < 20 ? 'Low' : ela < 40 ? 'Medium' : 'High';
  const noiseRisk = noise < 12 ? 'Low' : noise < 22 ? 'Medium' : 'High';
  const verdict = score >= 70 ? 'AUTHENTIC' : score >= 40 ? 'SUSPICIOUS' : 'AI GENERATED';
  return {
    authenticity_score: score,
    authenticity_verdict: verdict,
    metadata: {
      'File Name': file.name,
      'File Size': `${(file.size / 1024).toFixed(1)} KB`,
      'MIME Type': file.type || 'image/jpeg',
      'Modified': new Date(file.lastModified).toLocaleString(),
      'Camera Make': ok ? 'Canon Inc.' : null,
      'Camera Model': ok ? 'Canon EOS R5' : null,
      'Focal Length': ok ? '85 mm' : null,
      'ISO Speed': ok ? '400' : null,
      'GPS Data': ok ? 'Present' : 'Absent',
      'Software': ok ? 'Adobe Lightroom 6.1' : 'Midjourney v6.1',
      'Color Space': 'sRGB',
      'EXIF Integrity': ok ? 'Intact' : 'Compromised',
    },
    cnn: {
      label: ok ? 'Authentic Photograph' : 'AI Generated Image',
      confidence: ok ? 79 + (s % 18) : 73 + (s % 20),
    },
    noise_score: noise,
    noise_risk: noiseRisk,
    report: {
      verdict, authenticity_score: score,
      cnn_label: ok ? 'Authentic' : 'AI Generated',
      cnn_confidence: ok ? 79 + (s % 18) : 73 + (s % 20),
      metadata: ok
        ? 'EXIF intact · Camera metadata consistent · GPS present'
        : 'EXIF absent · Editing software signature detected',
      ela_score: ela, ela_risk: elaRisk,
      noise_score: noise, noise_risk: noiseRisk,
    },
  };
}

/* ── Color helpers ── */
function scoreColor(n: number) {
  if (n >= 70) return P.statusOk;
  if (n >= 40) return P.statusWarn;
  return P.statusErr;
}
function riskColor(r: string) {
  if (r === 'Low')    return P.statusOk;
  if (r === 'Medium') return P.statusWarn;
  return P.statusErr;
}
function riskBgColor(r: string) {
  if (r === 'Low')    return 'rgba(22,101,52,0.08)';
  if (r === 'Medium') return 'rgba(146,64,14,0.08)';
  return 'rgba(153,27,27,0.08)';
}
function riskBorderColor(r: string) {
  if (r === 'Low')    return 'rgba(22,101,52,0.32)';
  if (r === 'Medium') return 'rgba(146,64,14,0.32)';
  return 'rgba(153,27,27,0.32)';
}
function verdictClass(v: string) {
  if (v.includes('AUTH')) return 'verdict-authentic';
  if (v.includes('SUSP')) return 'verdict-suspicious';
  return 'verdict-aigenerated';
}

/* ── Circular Gauge ── */
function CircularGauge({ score, size = 200 }: { score: number | null; size?: number }) {
  const [display, setDisplay] = useState(0);
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = score !== null ? circ - (score / 100) * circ : circ;
  const col = score !== null ? scoreColor(score) : P.accent;

  useEffect(() => {
    if (score === null) { setDisplay(0); return; }
    const target = score;
    const dur = 1500;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {score !== null && (
        <>
          <div className="ring-expand" style={{ inset: -16, animationDelay: '0s' }} />
          <div className="ring-expand" style={{ inset: -16, animationDelay: '1.25s' }} />
        </>
      )}
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(222,196,177,0.35)" strokeWidth={stroke} />
        {score !== null && (
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={col} strokeWidth={stroke + 4} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            opacity={0.15}
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,.64,1), stroke 0.3s', filter: 'blur(5px)' }} />
        )}
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,.64,1), stroke 0.3s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black leading-none"
          style={{ fontSize: size * 0.22, color: col,
            fontFamily: "'JetBrains Mono',monospace", transition: 'color 0.3s' }}>
          {display}
        </span>
        <span className="font-semibold tracking-widest mt-1" style={{ fontSize: size * 0.065, color: P.secondary }}>
          / 100
        </span>
      </div>
    </div>
  );
}

/* ── Progress Bar ── */
function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(61,53,67,0.08)' }}>
      <div className="h-full rounded-full progress-fill"
        style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

/* ── Risk Badge ── */
function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className="inline-block px-3 py-0.5 rounded-full text-xs font-bold tracking-wide"
      style={{ color: riskColor(risk), background: riskBgColor(risk), border: `1px solid ${riskBorderColor(risk)}` }}>
      {risk.toUpperCase()}
    </span>
  );
}

/* ── Stat Row ── */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0"
      style={{ borderColor: 'rgba(222,196,177,0.4)' }}>
      <span className="text-xs" style={{ color: P.secondary }}>{label}</span>
      <span className="text-xs font-medium text-right ml-4 truncate max-w-[160px] font-mono"
        style={{ color: P.primary }}>{value}</span>
    </div>
  );
}

/* ── Section Label ── */
function SectionLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <Icon size={15} className="flex-shrink-0" style={{ color: P.secondary }} />
      <span className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: P.secondary }}>{text}</span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${P.border}, transparent)` }} />
    </div>
  );
}

/* ── Module Card ── */
function ModuleCard({
  icon: Icon, title, badge, children, delay = 0,
}: {
  icon: React.ElementType; title: string; badge?: React.ReactNode;
  children: React.ReactNode; delay?: number;
}) {
  return (
    <div className="glass module-card rounded-2xl p-5 anim-fade-up"
      style={{ animationDelay: `${delay}ms`, borderColor: P.border }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: P.accentDim, border: `1px solid ${P.border}` }}>
            <Icon size={15} style={{ color: P.primary }} />
          </div>
          <span className="font-semibold text-sm" style={{ color: P.primary }}>{title}</span>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ── Warm Background ── */
function WarmBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="bg-pebble-grid absolute inset-0" />
      <div className="absolute rounded-full"
        style={{ width: 600, height: 600, top: -200, left: -150,
          background: 'radial-gradient(circle, rgba(222,196,177,0.25) 0%, transparent 70%)',
          animation: 'orb1 18s ease-in-out infinite' }} />
      <div className="absolute rounded-full"
        style={{ width: 450, height: 450, bottom: -130, right: -100,
          background: 'radial-gradient(circle, rgba(143,129,146,0.18) 0%, transparent 70%)',
          animation: 'orb2 22s ease-in-out infinite' }} />
      <div className="absolute rounded-full"
        style={{ width: 320, height: 320, top: '35%', right: '18%',
          background: 'radial-gradient(circle, rgba(246,236,240,0.6) 0%, transparent 70%)',
          animation: 'orb3 14s ease-in-out infinite' }} />
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(246,236,240,0.55) 100%)' }} />
    </div>
  );
}

/* ── Scanning Overlay ── */
function ScanningOverlay() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none" style={{ zIndex: 20 }}>
      <div className="scan-line" />
      <div className="absolute inset-0 rounded-2xl"
        style={{ background: 'rgba(222,196,177,0.06)', border: `1px solid ${P.accent}` }} />
    </div>
  );
}

/* ── Navbar ── */
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full"
      style={{ background: 'rgba(246,236,240,0.97)', borderBottom: `1px solid ${P.border}`,
        backdropFilter: 'blur(20px)', boxShadow: P.shadowSm }}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center pulse-accent"
            style={{ background: `linear-gradient(135deg, ${P.primary}, ${P.secondary})`,
              boxShadow: '0 3px 10px rgba(61,53,67,0.3)' }}>
            <Shield size={15} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide" style={{ color: P.primary }}>ForensicAI</span>
            <span className="text-xs ml-1.5 font-mono font-semibold" style={{ color: P.secondary }}>v2.4</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {['Dashboard', 'Analysis', 'Reports', 'Settings'].map(item => (
            <span key={item} className="text-sm font-medium cursor-pointer transition-colors"
              style={{ color: P.secondary }}
              onMouseEnter={e => (e.currentTarget.style.color = P.primary)}
              onMouseLeave={e => (e.currentTarget.style.color = P.secondary)}>
              {item}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(22,101,52,0.08)', border: '1px solid rgba(22,101,52,0.25)', color: P.statusOk }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: P.statusOk, animation: 'blink 2s infinite' }} />
            SYSTEM ONLINE
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ── Main App ── */
export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<AnalysisState>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) return;
    setFile(f);
    setImgUrl(URL.createObjectURL(f));
    setResult(null);
    setState('idle');
    setScanProgress(0);
  }, []);

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };
  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    setState('scanning');
    setScanProgress(0);
    for (const s of [12, 28, 46, 63, 79, 92, 100]) {
      await new Promise(r => setTimeout(r, 290));
      setScanProgress(s);
    }
    await new Promise(r => setTimeout(r, 280));
    setResult(mockAnalysis(file));
    setState('done');
  };

  const downloadReport = () => {
    if (!result) return;
    const r = result.report;
    const txt = [
      '══════════════════════════════════════════════════',
      '  AI IMAGE FORENSICS & AUTHENTICITY ANALYZER',
      '  ForensicAI Platform v2.4  ·  Forensic Report',
      '══════════════════════════════════════════════════',
      '', `  File              : ${file?.name ?? 'N/A'}`,
      `  Analysis Date     : ${new Date().toLocaleString()}`, '',
      '  ── VERDICT & SCORING ──────────────────────────',
      `  Overall Verdict   : ${r.verdict}`,
      `  Authenticity Score: ${r.authenticity_score} / 100`, '',
      '  ── CNN DEEP LEARNING ──────────────────────────',
      `  Prediction        : ${r.cnn_label}`,
      `  Confidence        : ${r.cnn_confidence}%`, '',
      '  ── METADATA / EXIF ────────────────────────────',
      `  Analysis          : ${r.metadata}`, '',
      '  ── ERROR LEVEL ANALYSIS ───────────────────────',
      `  ELA Score         : ${r.ela_score}`,
      `  Risk Level        : ${r.ela_risk}`, '',
      '  ── NOISE PATTERN ANALYSIS ─────────────────────',
      `  Noise Score       : ${r.noise_score}`,
      `  Risk Level        : ${r.noise_risk}`, '',
      '══════════════════════════════════════════════════',
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `forensic-report-${Date.now()}.txt`;
    a.click();
  };

  const score = result?.authenticity_score ?? null;
  const col   = score !== null ? scoreColor(score) : P.primary;

  return (
    <div className="min-h-screen" style={{ background: P.bg }}>
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-16" style={{ background: P.bg }}>
        <WarmBackground />
        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 anim-fade-up"
            style={{ background: P.accentDim, border: `1px solid ${P.accent}`, color: P.primary }}>
            <Zap size={11} style={{ color: P.secondary }} />
            HYBRID FORENSIC ANALYSIS ENGINE · NEURAL + METADATA + ELA + NOISE
          </div>

          <h1 className="shimmer-text font-black tracking-tight mb-4 anim-fade-up delay-1 hero-title"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', lineHeight: 1.1 }}>
            AI Image Forensics &amp;<br />Authenticity Analyzer
          </h1>

          <p className="max-w-2xl mx-auto mb-8 anim-fade-up delay-2"
            style={{ fontSize: 'clamp(0.9rem,1.5vw,1.05rem)', lineHeight: 1.7, color: P.secondary }}>
            Enterprise-grade image verification platform combining deep neural networks,
            EXIF forensics, error-level analysis, and noise profiling to detect AI-generated
            and manipulated images with high confidence.
          </p>

          <div className="flex items-center justify-center gap-6 flex-wrap anim-fade-up delay-3">
            {[
              { icon: Cpu,       label: 'CNN Deep Learning' },
              { icon: Database,  label: 'EXIF Forensics' },
              { icon: Activity,  label: 'Error Level Analysis' },
              { icon: BarChart2, label: 'Noise Profiling' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm" style={{ color: P.secondary }}>
                <Icon size={14} style={{ color: P.primary }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 pb-20 space-y-5">

        {/* ── Upload + Preview ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Upload */}
          <div className="glass rounded-2xl p-6 anim-fade-up" style={{ borderColor: P.border }}>
            <SectionLabel icon={Upload} text="Image Upload" />

            <div
              className={`drop-zone rounded-xl p-8 text-center cursor-pointer ${dragging ? 'dragover' : ''}`}
              style={{ border: `1.5px dashed ${P.accent}`, background: P.accentDim }}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center anim-float"
                style={{ background: `linear-gradient(135deg, rgba(61,53,67,0.08), rgba(222,196,177,0.2))`,
                  border: `1px solid ${P.accent}`, boxShadow: P.shadowSm }}>
                <Upload size={22} style={{ color: P.primary }} />
              </div>
              <p className="font-semibold text-base mb-1" style={{ color: P.primary }}>
                Drag &amp; Drop Image
              </p>
              <p className="text-sm mb-5" style={{ color: P.secondary }}>
                or click to browse · PNG, JPG, WEBP supported
              </p>
              <button type="button"
                onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                className="px-5 py-2 text-sm font-bold rounded-lg transition-all"
                style={{ background: P.accentDim, border: `1px solid ${P.accent}`,
                  color: P.primary, boxShadow: P.shadowSm }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(222,196,177,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.background = P.accentDim)}
              >
                Browse Files
              </button>
              <input ref={inputRef} type="file" accept="image/*" hidden onChange={onInput} />
            </div>

            {file && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: P.accentDim, border: `1px solid ${P.border}` }}>
                <FileText size={13} style={{ color: P.secondary, flexShrink: 0 }} />
                <span className="text-xs font-mono truncate" style={{ color: P.primary }}>{file.name}</span>
                <span className="text-xs ml-auto flex-shrink-0" style={{ color: P.secondary }}>
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            {/* Pipeline progress */}
            {state === 'scanning' && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span style={{ color: P.secondary }}>FORENSIC PIPELINE</span>
                  <span style={{ color: P.primary, fontWeight: 700 }}>{scanProgress}%</span>
                </div>
                <ProgressBar value={scanProgress} color={P.primary} />
                <div className="flex gap-5 mt-2">
                  {[
                    { label: 'CNN',   done: scanProgress > 20 },
                    { label: 'EXIF',  done: scanProgress > 40 },
                    { label: 'ELA',   done: scanProgress > 60 },
                    { label: 'NOISE', done: scanProgress > 80 },
                  ].map(({ label, done }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: done ? P.statusOk : 'rgba(61,53,67,0.2)' }} />
                      <span style={{ color: done ? P.statusOk : P.secondary }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={analyze}
              disabled={!file || state === 'scanning'}
              className="mt-5 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: (!file || state === 'scanning')
                  ? 'rgba(61,53,67,0.06)'
                  : `linear-gradient(135deg, ${P.primary}, ${P.secondary})`,
                color: (!file || state === 'scanning') ? P.secondary : '#fff',
                border: (!file || state === 'scanning') ? `1px solid ${P.border}` : 'none',
                boxShadow: (!file || state === 'scanning') ? 'none' : '0 4px 18px rgba(61,53,67,0.28)',
                cursor: (!file || state === 'scanning') ? 'not-allowed' : 'pointer',
              }}
            >
              {state === 'scanning' ? (
                <>
                  <span className="anim-spin inline-block w-4 h-4 rounded-full border-2"
                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  Analyzing Image...
                </>
              ) : state === 'done' ? (
                <><CheckCircle size={16} />Re-Analyze Image</>
              ) : (
                <><Search size={16} />Run Forensic Analysis</>
              )}
            </button>

            {state === 'done' && (
              <p className="mt-3 text-center text-xs font-semibold font-mono"
                style={{ color: P.statusOk }}>
                ✓ Analysis complete · {new Date().toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Preview */}
          <div className="glass rounded-2xl p-6 relative anim-fade-up delay-1" style={{ borderColor: P.border }}>
            <SectionLabel icon={Eye} text="Image Preview" />
            {state === 'scanning' && <ScanningOverlay />}

            {imgUrl ? (
              <div className="relative">
                <img src={imgUrl} alt="Preview"
                  className="w-full rounded-xl object-contain"
                  style={{ maxHeight: 280, border: `1px solid ${P.border}`,
                    background: 'rgba(246,236,240,0.5)', boxShadow: P.shadowSm }} />
                {state === 'done' && result && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold font-mono"
                    style={{ color: col, background: 'rgba(246,236,240,0.95)',
                      border: `1px solid ${col}40`, boxShadow: P.shadowSm }}>
                    {result.authenticity_verdict}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl"
                style={{ height: 280, border: `1.5px dashed ${P.border}`, background: P.accentDim }}>
                <ImageIcon size={40} style={{ color: P.accent, marginBottom: 12 }} />
                <span className="text-sm" style={{ color: P.secondary }}>No image loaded</span>
                <span className="text-xs mt-1" style={{ color: P.accent }}>Upload an image to begin analysis</span>
              </div>
            )}

            {state === 'done' && result && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'Score', value: `${result.authenticity_score}/100`, color: col },
                  { label: 'CNN',   value: `${result.cnn.confidence}%`,       color: P.primary },
                  { label: 'ELA',   value: result.report.ela_risk,             color: riskColor(result.report.ela_risk) },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg p-2 text-center"
                    style={{ background: P.accentDim, border: `1px solid ${P.border}` }}>
                    <div className="text-xs mb-0.5" style={{ color: P.secondary }}>{label}</div>
                    <div className="text-sm font-bold font-mono" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Authenticity Score ── */}
        <div className="glass rounded-2xl p-8 anim-fade-up" style={{ borderColor: P.border }}>
          <SectionLabel icon={Shield} text="Authenticity Assessment" />
          <div className="flex flex-col md:flex-row items-center gap-10">

            <div className="relative flex-shrink-0">
              <CircularGauge score={score} size={200} />
            </div>

            <div className="flex-1 space-y-3 w-full">
              {score !== null && result ? (
                <>
                  <div className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-lg font-black tracking-wider ${verdictClass(result.authenticity_verdict)}`}>
                    {score >= 70
                      ? <CheckCircle size={20} />
                      : score >= 40
                        ? <AlertTriangle size={20} />
                        : <XCircle size={20} />}
                    {result.authenticity_verdict}
                  </div>
                  <div className="space-y-3 mt-2">
                    {[
                      { label: 'CNN Confidence',     value: result.cnn.confidence,                             color: P.primary },
                      { label: 'Metadata Integrity', value: score >= 70 ? 82 : 24,                             color: score >= 70 ? P.statusOk : P.statusErr },
                      { label: 'ELA Consistency',    value: Math.max(0, 100 - result.report.ela_score * 2),   color: riskColor(result.report.ela_risk) },
                      { label: 'Noise Pattern',      value: Math.max(0, 100 - result.noise_score * 3),         color: riskColor(result.noise_risk) },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span style={{ color: P.secondary }}>{label}</span>
                          <span className="font-mono font-bold" style={{ color }}>{value}%</span>
                        </div>
                        <ProgressBar value={value} color={color} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-lg font-medium" style={{ color: P.secondary }}>Awaiting Analysis</div>
                  <p className="text-sm max-w-md" style={{ color: P.secondary, lineHeight: 1.6 }}>
                    Upload an image and run the forensic pipeline to receive a comprehensive
                    authenticity assessment with a 0–100 confidence score.
                  </p>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-5 rounded"
                      style={{ background: 'rgba(222,196,177,0.25)', width: `${80 - i * 8}%` }} />
                  ))}
                </div>
              )}
            </div>

            {score !== null && result && (
              <div className="flex-shrink-0 w-52 space-y-0">
                <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: P.secondary }}>
                  Module Confidence
                </div>
                {[
                  { label: 'CNN Model',      v: result.cnn.confidence },
                  { label: 'ELA Engine',     v: Math.max(5, 100 - result.report.ela_score * 2) },
                  { label: 'Noise Analyzer', v: Math.max(5, 100 - result.noise_score * 2) },
                  { label: 'EXIF Parser',    v: score >= 70 ? 89 : 31 },
                ].map(({ label, v }) => (
                  <div key={label} className="flex justify-between items-center py-2.5 border-b"
                    style={{ borderColor: 'rgba(222,196,177,0.4)' }}>
                    <span className="text-xs" style={{ color: P.secondary }}>{label}</span>
                    <span className="font-mono text-xs font-bold" style={{ color: P.primary }}>{v}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Forensic Modules ── */}
        <div>
          <SectionLabel icon={Server} text="Forensic Analysis Modules" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

            {/* CNN */}
            <ModuleCard icon={Cpu} title="CNN Analysis" delay={0}
              badge={
                result ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg font-mono"
                    style={{
                      color: result.cnn.label.includes('Auth') ? P.statusOk : P.statusErr,
                      background: result.cnn.label.includes('Auth') ? 'rgba(22,101,52,0.08)' : 'rgba(153,27,27,0.08)',
                      border: `1px solid ${result.cnn.label.includes('Auth') ? 'rgba(22,101,52,0.3)' : 'rgba(153,27,27,0.3)'}`,
                    }}>ACTIVE</span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg font-mono"
                    style={{ background: P.primaryDim, border: `1px solid ${P.border}`, color: P.secondary }}>
                    STANDBY
                  </span>
                )
              }
            >
              {result ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: P.secondary }}>Prediction</div>
                    <div className="text-base font-bold leading-tight"
                      style={{ color: result.cnn.label.includes('Auth') ? P.statusOk : P.statusErr }}>
                      {result.cnn.label}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="uppercase tracking-wide" style={{ color: P.secondary }}>Confidence</span>
                      <span className="font-mono font-bold" style={{ color: P.primary }}>{result.cnn.confidence}%</span>
                    </div>
                    <ProgressBar value={result.cnn.confidence}
                      color={result.cnn.label.includes('Auth') ? P.statusOk : P.statusErr} />
                  </div>
                  <StatRow label="Model" value="ResNet-50 v3.2" />
                  <StatRow label="Inference" value="23 ms" />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[70, 50, 90, 60].map((w, i) => (
                    <div key={i} className="h-4 rounded" style={{ background: P.accentDim, width: `${w}%` }} />
                  ))}
                </div>
              )}
            </ModuleCard>

            {/* Metadata */}
            <ModuleCard icon={Database} title="Metadata Analysis" delay={100}
              badge={result ? <RiskBadge risk={result.metadata['EXIF Integrity'] === 'Intact' ? 'Low' : 'High'} /> : undefined}>
              {result ? (
                <div className="space-y-0">
                  {Object.entries(result.metadata)
                    .filter(([, v]) => v !== null).slice(0, 6)
                    .map(([k, v]) => <StatRow key={k} label={k} value={String(v)} />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <div className="h-3 rounded" style={{ background: P.accentDim, width: '45%' }} />
                      <div className="h-3 rounded" style={{ background: P.accentDim, width: '38%' }} />
                    </div>
                  ))}
                </div>
              )}
            </ModuleCard>

            {/* ELA */}
            <ModuleCard icon={Activity} title="Error Level Analysis" delay={200}
              badge={result ? <RiskBadge risk={result.report.ela_risk} /> : undefined}>
              {result && imgUrl ? (
                <div className="space-y-3">
                  <div className="ela-wrapper">
                    <img src={imgUrl} alt="ELA"
                      className="w-full rounded-xl object-contain"
                      style={{ maxHeight: 120, filter: 'saturate(5) contrast(2) brightness(0.85)',
                        border: `1px solid ${P.border}` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'ELA Score', value: String(result.report.ela_score), color: riskColor(result.report.ela_risk) },
                      { label: 'Risk',      value: null },
                    ].map(({ label, value, color }, i) => (
                      <div key={i} className="rounded-lg p-2 text-center"
                        style={{ background: P.accentDim, border: `1px solid ${P.border}` }}>
                        <div className="text-xs mb-0.5" style={{ color: P.secondary }}>{label}</div>
                        {value ? (
                          <div className="text-lg font-black font-mono" style={{ color }}>{value}</div>
                        ) : (
                          <div className="mt-1"><RiskBadge risk={result.report.ela_risk} /></div>
                        )}
                      </div>
                    ))}
                  </div>
                  <ProgressBar value={Math.min(result.report.ela_score * 2.5, 100)}
                    color={riskColor(result.report.ela_risk)} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-24 rounded-xl" style={{ background: P.accentDim }} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-14 rounded-lg" style={{ background: P.accentDim }} />
                    <div className="h-14 rounded-lg" style={{ background: P.accentDim }} />
                  </div>
                </div>
              )}
            </ModuleCard>

            {/* Noise */}
            <ModuleCard icon={Wifi} title="Noise Pattern Analysis" delay={300}
              badge={result ? <RiskBadge risk={result.noise_risk} /> : undefined}>
              {result ? (
                <div className="space-y-4">
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black font-mono leading-none"
                      style={{ color: riskColor(result.noise_risk) }}>
                      {result.noise_score}
                    </span>
                    <span className="text-sm mb-1" style={{ color: P.secondary }}>/ 100</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="uppercase tracking-wide" style={{ color: P.secondary }}>Noise Level</span>
                      <span className="font-mono" style={{ color: P.secondary }}>
                        {Math.min(result.noise_score * 3, 100).toFixed(0)}%
                      </span>
                    </div>
                    <ProgressBar value={Math.min(result.noise_score * 3, 100)} color={riskColor(result.noise_risk)} />
                  </div>
                  <StatRow label="Risk Level" value={result.noise_risk} />
                  <StatRow label="Algorithm" value="Laplacian v2" />
                  <StatRow label="Threshold" value="σ = 0.85" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="h-12 rounded" style={{ background: P.accentDim }} />
                  {[75, 55, 85].map((w, i) => (
                    <div key={i} className="h-4 rounded" style={{ background: P.accentDim, width: `${w}%` }} />
                  ))}
                </div>
              )}
            </ModuleCard>
          </div>
        </div>

        {/* ── Forensic Report ── */}
        <div className="glass rounded-2xl p-6 anim-fade-up" style={{ borderColor: P.border }}>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <SectionLabel icon={FileText} text="Forensic Investigation Report" />
            <div className="flex gap-3">
              {[
                { label: 'Download Report', icon: Download,      disabled: !result,
                  style: { background: P.accentDim, border: `1px solid ${P.accent}`, color: P.primary },
                  hoverBg: 'rgba(222,196,177,0.4)', onClick: downloadReport },
                { label: 'Export JSON',     icon: ChevronRight,  disabled: !result,
                  style: { background: P.primaryDim, border: `1px solid rgba(61,53,67,0.2)`, color: P.primary },
                  hoverBg: 'rgba(61,53,67,0.12)', onClick: undefined },
              ].map(({ label, icon: Icon, disabled, style, hoverBg, onClick }) => (
                <button key={label} onClick={onClick} disabled={disabled}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  style={{ ...style, opacity: disabled ? 0.35 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => !disabled && (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={e => !disabled && (e.currentTarget.style.background = style.background)}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {result ? (
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(246,236,240,0.6)', border: `1px solid ${P.border}` }}>
              <div className="px-5 py-3 flex items-center gap-2"
                style={{ background: P.accentDim, borderBottom: `1px solid ${P.border}` }}>
                <Shield size={11} style={{ color: P.secondary }} />
                <span className="text-xs font-mono font-bold tracking-widest" style={{ color: P.primary }}>
                  FORENSIC REPORT · CONFIDENTIAL
                </span>
                <span className="ml-auto text-xs font-mono" style={{ color: P.secondary }}>
                  {new Date().toISOString()}
                </span>
              </div>

              <pre className="font-mono px-5 py-4 overflow-auto"
                style={{ fontSize: 12, lineHeight: 1.85, whiteSpace: 'pre-wrap', maxHeight: 340, background: 'transparent' }}>
<span style={{ color: P.primary, fontWeight: 700 }}>{'══════════════════════════════════════════════════\n'}
{'  AI IMAGE FORENSICS & AUTHENTICITY ANALYZER\n'}
{'══════════════════════════════════════════════════\n'}</span>
<span style={{ color: P.secondary }}>{'  File              : '}</span><span style={{ color: P.primary }}>{file?.name ?? 'N/A'}{'\n'}</span>
<span style={{ color: P.secondary }}>{'  Analysis Date     : '}</span><span style={{ color: P.primary }}>{new Date().toLocaleString()}{'\n'}</span>
{'\n'}
<span style={{ color: P.secondary, fontWeight: 600 }}>{'  ── VERDICT & SCORING ─────────────────────────\n'}</span>
<span style={{ color: P.secondary }}>{'  Overall Verdict   : '}</span><span style={{ color: col, fontWeight: 700 }}>{result.report.verdict}{'\n'}</span>
<span style={{ color: P.secondary }}>{'  Authenticity Score: '}</span><span style={{ color: col, fontWeight: 700 }}>{result.report.authenticity_score} / 100{'\n'}</span>
{'\n'}
<span style={{ color: P.secondary, fontWeight: 600 }}>{'  ── CNN DEEP LEARNING ──────────────────────────\n'}</span>
<span style={{ color: P.secondary }}>{'  Prediction        : '}</span><span style={{ color: P.primary }}>{result.report.cnn_label}{'\n'}</span>
<span style={{ color: P.secondary }}>{'  Confidence        : '}</span><span style={{ color: P.primary }}>{result.report.cnn_confidence}%{'\n'}</span>
{'\n'}
<span style={{ color: P.secondary, fontWeight: 600 }}>{'  ── METADATA / EXIF ────────────────────────────\n'}</span>
<span style={{ color: P.secondary }}>{'  Analysis          : '}</span><span style={{ color: P.primary }}>{result.report.metadata}{'\n'}</span>
{'\n'}
<span style={{ color: P.secondary, fontWeight: 600 }}>{'  ── ERROR LEVEL ANALYSIS ───────────────────────\n'}</span>
<span style={{ color: P.secondary }}>{'  ELA Score         : '}</span><span style={{ color: P.primary }}>{result.report.ela_score}{'\n'}</span>
<span style={{ color: P.secondary }}>{'  Risk Level        : '}</span><span style={{ color: riskColor(result.report.ela_risk) }}>{result.report.ela_risk}{'\n'}</span>
{'\n'}
<span style={{ color: P.secondary, fontWeight: 600 }}>{'  ── NOISE PATTERN ANALYSIS ─────────────────────\n'}</span>
<span style={{ color: P.secondary }}>{'  Noise Score       : '}</span><span style={{ color: P.primary }}>{result.report.noise_score}{'\n'}</span>
<span style={{ color: P.secondary }}>{'  Risk Level        : '}</span><span style={{ color: riskColor(result.report.noise_risk) }}>{result.report.noise_risk}{'\n'}</span>
{'\n'}
<span style={{ color: P.primary, fontWeight: 700 }}>{'══════════════════════════════════════════════════\n'}
{'  Generated by ForensicAI Platform v2.4\n'}
{'══════════════════════════════════════════════════'}</span>
              </pre>
            </div>
          ) : (
            <div className="rounded-xl flex flex-col items-center justify-center py-16"
              style={{ background: P.accentDim, border: `1px solid ${P.border}` }}>
              <FileText size={36} style={{ color: P.accent, marginBottom: 12 }} />
              <span className="text-sm" style={{ color: P.secondary }}>No report generated yet</span>
              <span className="text-xs mt-1" style={{ color: P.accent }}>
                Complete a forensic analysis to generate the report
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-4 pb-2 flex-wrap gap-2"
          style={{ borderTop: `1px solid ${P.border}` }}>
          <div className="flex items-center gap-2">
            <Shield size={13} style={{ color: P.secondary }} />
            <span className="text-xs font-mono" style={{ color: P.secondary }}>
              ForensicAI Platform v2.4 · Hybrid Image Verification
            </span>
          </div>
          <span className="text-xs" style={{ color: P.accent }}>CNN · ELA · EXIF · Noise</span>
        </div>

      </div>
    </div>
  );
}
