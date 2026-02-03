/* =========================================================
   VAULT 131 TERMINAL — single page app
   iPad Safari friendly: click-to-enable audio, touch events
   ========================================================= */

/* ===== FEATURE: CONFIG START ===== */
const CONFIG = {
  // Change to match her badge
  ACCESS_CODE: "101-317-76",

  // 3-digit code for the physical briefcase
  BRIEFCASE_CODE: "731",

  // 5 Fallout-themed riddles (answers case-insensitive)
  RIDDLES: [
    {
      q: "I light the dark but I’m not the sun. In the wastes, I’m priceless when the power’s done. What am I?",
      a: ["pip-boy light", "pipboy light", "pip boy light", "flashlight"]
    },
    {
      q: "Bottle it up, cap it tight — in the ruins I’m worth a fight. I’m not gold, but I’m treated like it. What am I?",
      a: ["nuka-cola", "nuka cola", "nuka"]
    },
    {
      q: "I’m currency to some, and junk to others — but hoard enough and you’ll buy wonders. What am I?",
      a: ["caps", "bottle caps", "cap"]
    },
    {
      q: "You hear the click, then feel the glow. The ground remembers where you go. What am I?",
      a: ["radiation", "rads", "irradiation"]
    },
    {
      q: "A loyal friend with metal skin, whistles softly, follows you in. What am I?",
      a: ["dogmeat", "dog meat"]
    }
  ]
};
/* ===== FEATURE: CONFIG END ===== */


/* ===== FEATURE: DOM HOOKS START ===== */
const screen = document.getElementById("screen");
const statusText = document.getElementById("statusText");

const hum = document.getElementById("hum");
const beep = document.getElementById("beep");

const typeClips = [
  document.getElementById("type1"),
  document.getElementById("type2"),
  document.getElementById("type3"),
].filter(Boolean);

let audioEnabled = false;
/* ===== FEATURE: DOM HOOKS END ===== */


/* ===== FEATURE: STATE (SAVED) START ===== */
const STORAGE_KEY = "vault131_state_v2";

/*
  We intentionally DO NOT store the access code.
  So even if you test it, it won't reappear and "spoil" it.
*/
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}
function saveState(s){
  try{
    // Never store access code
    const safe = { ...s, code: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  }catch(e){}
}
function resetState(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
}

let state = loadState() || {
  stage: "boot", // boot | login | riddles | success
  name: "",
  code: "",      // NOT saved
  riddleIndex: 0
};
/* ===== FEATURE: STATE (SAVED) END ===== */


/* ===== FEATURE: iPAD AUDIO HARDENING (WEB AUDIO) START ===== */
let audioCtx = null;
let beepBuf = null;
let typeBufs = [];

let lastTypeIndex = -1;
let lastTypeAt = 0;
const TYPE_THROTTLE_MS = 55;

async function fetchArrayBuffer(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.arrayBuffer();
}

async function initWebAudio(){
  if(audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // iOS requires resume after a user gesture
  if(audioCtx.state !== "running"){
    await audioCtx.resume().catch(()=>{});
  }

  try{
    const beepData = await fetchArrayBuffer("assets/ui-beep.mp3");
    beepBuf = await audioCtx.decodeAudioData(beepData);

    const t1 = await fetchArrayBuffer("assets/type1.mp3");
    const t2 = await fetchArrayBuffer("assets/type2.mp3");
    const t3 = await fetchArrayBuffer("assets/type3.mp3");

    typeBufs = [
      await audioCtx.decodeAudioData(t1),
      await audioCtx.decodeAudioData(t2),
      await audioCtx.decodeAudioData(t3),
    ];
  }catch(e){
    // If WebAudio decoding fails, HTMLAudio fallback still works
    console.log("WebAudio init failed:", e);
  }
}

function playBuffer(buf, { volume = 0.3, rate = 1.0 } = {}){
  if(!audioCtx || !buf) return false;

  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();

  src.buffer = buf;
  src.playbackRate.value = rate;
  gain.gain.value = volume;

  src.connect(gain);
  gain.connect(audioCtx.destination);

  src.start(0);
  return true;
}
/* ===== FEATURE: iPAD AUDIO HARDENING (WEB AUDIO) END ===== */


/* ===== FEATURE: AUDIO CONTROL + DIAGNOSTICS START ===== */
let audioCtx = null;
let beepBuf = null;
let typeBufs = [];
let lastTypeAt = 0;
const TYPE_THROTTLE_MS = 55;

// iPad-proof: create / resume AudioContext ONLY from user gesture
async function ensureAudioContext(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioCtx.state !== "running"){
    await audioCtx.resume().catch(()=>{});
  }
  return audioCtx;
}

async function fetchOK(url){
  try{
    const res = await fetch(url, { cache: "no-store" });
    return { ok: res.ok, status: res.status };
  }catch(e){
    return { ok: false, status: "fetch_failed" };
  }
}

async function loadBuffers(){
  // If buffers already loaded, skip
  if(beepBuf && typeBufs.length) return;

  try{
    const ctx = await ensureAudioContext();

    // Fetch + decode
    const beepData = await (await fetch("assets/ui-beep.mp3", { cache:"no-store" })).arrayBuffer();
    beepBuf = await ctx.decodeAudioData(beepData);

    const t1 = await (await fetch("assets/type1.mp3", { cache:"no-store" })).arrayBuffer();
    const t2 = await (await fetch("assets/type2.mp3", { cache:"no-store" })).arrayBuffer();
    const t3 = await (await fetch("assets/type3.mp3", { cache:"no-store" })).arrayBuffer();

    typeBufs = [
      await ctx.decodeAudioData(t1),
      await ctx.decodeAudioData(t2),
      await ctx.decodeAudioData(t3),
    ];
  }catch(e){
    // We'll still have oscillator beep as a fallback.
    console.log("Buffer decode failed:", e);
  }
}

function playOscBeep(){
  // Guaranteed audible if audio is actually unlocked
  if(!audioCtx) return false;
  try{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.0001;

    o.connect(g);
    g.connect(audioCtx.destination);

    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

    o.start(t);
    o.stop(t + 0.09);
    return true;
  }catch(e){
    return false;
  }
}

function playBuffer(buf, { volume = 0.25, rate = 1.0 } = {}){
  if(!audioCtx || !buf) return false;
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(0);
  return true;
}

async function primeAudio(){
  audioEnabled = true;

  // 1) Ensure AudioContext is running (user gesture!)
  await ensureAudioContext();

  // 2) Try to start HTMLAudio hum (optional; some iPads block it even when SFX works)
  try{
    if(hum){
      hum.volume = 0.22;
      hum.currentTime = 0;
      await hum.play();
    }
  }catch(e){
    // not fatal
  }

  // 3) Load decoded buffers for beep/type (most reliable)
  await loadBuffers();

  // 4) Make a guaranteed oscillator beep so you KNOW it unlocked
  const ok = playOscBeep();
  if(ok){
    setStatus("AUDIO: unlocked ✅ (if you heard a short beep)");
  }else{
    setStatus("AUDIO: still locked ❌ (tap ENABLE AUDIO again)");
  }

  // 5) Diagnostics: check if assets can be fetched
  const d1 = await fetchOK("assets/ui-beep.mp3");
  const d2 = await fetchOK("assets/type1.mp3");
  const d3 = await fetchOK("assets/crt-hum.mp3");
  setStatus(`AUDIO CHECK → beep:${d1.ok ? "OK" : d1.status} type1:${d2.ok ? "OK" : d2.status} hum:${d3.ok ? "OK" : d3.status}`);
}

function playBeep(){
  if(!audioEnabled) return;

  // Prefer decoded buffer; fallback to oscillator beep
  if(playBuffer(beepBuf, { volume: 0.22, rate: 1.0 })) return;
  playOscBeep();
}

function playType(){
  if(!audioEnabled) return;

  const now = performance.now();
  if(now - lastTypeAt < TYPE_THROTTLE_MS) return;
  lastTypeAt = now;

  // Prefer decoded typing buffers
  if(typeBufs && typeBufs.length){
    const idx = Math.floor(Math.random() * typeBufs.length);
    const rate = 0.95 + Math.random() * 0.12;
    const vol = 0.12 + Math.random() * 0.08;
    playBuffer(typeBufs[idx], { volume: vol, rate });
    return;
  }

  // Last resort: tiny oscillator tick
  playOscBeep();
}
/* ===== FEATURE: AUDIO CONTROL + DIAGNOSTICS END ===== */


/* ===== FEATURE: BUTTON HOVER/TAP SFX START ===== */
function wireButtonSfx(root = document){
  const buttons = root.querySelectorAll("button");

  buttons.forEach(btn => {
    // Hover for mouse/trackpad
    btn.addEventListener("mouseenter", () => { btn.classList.add("glow"); playBeep(); });
    btn.addEventListener("mouseleave", () => btn.classList.remove("glow"));

    // Touch fallback (iPad)
    btn.addEventListener("touchstart", () => { btn.classList.add("glow"); playBeep(); }, {passive:true});
    btn.addEventListener("touchend", () => btn.classList.remove("glow"));
  });
}
/* ===== FEATURE: BUTTON HOVER/TAP SFX END ===== */


/* ===== FEATURE: TYPING SFX START ===== */
function wireTypingSfx(root = document){
  const inputs = root.querySelectorAll("input");

  inputs.forEach(inp => {
    // External keyboard / real keystrokes
    inp.addEventListener("keydown", () => playType());

    // iPad virtual keyboard + autocorrect fallback
    inp.addEventListener("input", () => playType());
    inp.addEventListener("change", () => playType());
  });
}
/* ===== FEATURE: TYPING SFX END ===== */


/* ===== FEATURE: RENDER SCREENS START ===== */
function setStatus(text){
  statusText.textContent = text;
}

function render(){
  if(state.stage === "boot") return renderBoot();
  if(state.stage === "login") return renderLogin();
  if(state.stage === "riddles") return renderRiddles();
  if(state.stage === "success") return renderSuccess();
}

function renderBoot(){
  setStatus("Initializing Vault-Tec terminal… (press H for help or q to quit)");

  screen.innerHTML = `
    <h1>VAULT 131 DATABASE</h1>
    <div class="dim">WELCOME, OPERATIVE.</div>
    <hr/>
    <div class="dim small">NOTICE: Audio is locked by iPad Safari until you tap once.</div>
    <div class="row" style="margin-top:12px;">
      <button id="enableAudioBtn">CLICK TO ENABLE AUDIO</button>
      <button id="continueBtn">CONTINUE</button>
      <button id="resetBtn" class="small">RESET SESSION</button>
    </div>
    <hr/>
    <div class="faint small">
      Only the most useful options are listed here; see below for the remainder.
      g++ accepts mostly the same options as gcc.
    </div>
  `;

  const enableAudioBtn = document.getElementById("enableAudioBtn");
  const continueBtn = document.getElementById("continueBtn");
  const resetBtn = document.getElementById("resetBtn");

  enableAudioBtn.addEventListener("click", primeAudio);

  continueBtn.addEventListener("click", () => {
    state.stage = "login";
    saveState(state);
    render();
  });

  resetBtn.addEventListener("click", () => {
    resetState();
    state = { stage:"boot", name:"", code:"", riddleIndex:0 };
    render();
  });

  wireButtonSfx(screen);
}

function renderLogin(){
  setStatus("Manual page vault131(1) line 12 (enter credentials)");

  screen.innerHTML = `
    <h2>AUTHORIZATION REQUIRED</h2>
    <div class="dim">Vault-Tec Industries — Personnel Access</div>
    <hr/>

    <label>NAME (as printed on identification)</label>
    <input id="nameInput"
      autocomplete="off"
      autocapitalize="words"
      placeholder="(refer to issued identification)"
      value="${escapeHtml(state.name)}"/>

    <label style="margin-top:14px;">ACCESS CODE</label>
    <input id="codeInput"
      autocomplete="off"
      inputmode="text"
      autocapitalize="characters"
      placeholder="___-___-__"
      value=""/>

    <div class="faint small" style="margin-top:10px;">
      Access code is printed on issued identification.
    </div>

    <div class="row" style="margin-top:14px;">
      <button id="loginBtn">LOGIN</button>
      <button id="audioBtn" class="small">ENABLE / RE-ENABLE AUDIO</button>
    </div>

    <hr/>
    <div class="faint small">
      Tip: If audio doesn’t play, tap “ENABLE / RE-ENABLE AUDIO” once.
    </div>
  `;

  const nameInput = document.getElementById("nameInput");
  const codeInput = document.getElementById("codeInput");
  const loginBtn = document.getElementById("loginBtn");
  const audioBtn = document.getElementById("audioBtn");

  wireButtonSfx(screen);
  wireTypingSfx(screen);

  audioBtn.addEventListener("click", primeAudio);

  loginBtn.addEventListener("click", () => {
    const name = (nameInput.value || "").trim();
    const code = (codeInput.value || "").trim();

    // Save name only — do NOT store code
    state.name = name;
    state.code = "";

    if(!name){
      setStatus("ERROR: Name field empty. Provide identification.");
      return;
    }
    if(code !== CONFIG.ACCESS_CODE){
      setStatus("ACCESS DENIED: Invalid access code.");
      return;
    }

    setStatus("ACCESS GRANTED: Loading riddle protocol…");
    state.stage = "riddles";
    state.riddleIndex = 0;
    saveState(state);
    render();
  });
}

function renderRiddles(){
  const i = state.riddleIndex;
  const total = CONFIG.RIDDLES.length;
  const current = CONFIG.RIDDLES[i];

  setStatus(`RIDDLE PROTOCOL: ${i+1}/${total} — answer to proceed`);

  screen.innerHTML = `
    <h2>VAULT 131 VERIFICATION</h2>
    <div class="dim">Subject: ${escapeHtml(state.name || "UNKNOWN")}</div>
    <hr/>

    <div class="dim">RIDDLE ${i+1} OF ${total}</div>
    <div style="margin-top:10px;">${escapeHtml(current.q)}</div>

    <label style="margin-top:14px;">ANSWER</label>
    <input id="answerInput" autocomplete="off" placeholder="Enter response…" />

    <div class="row" style="margin-top:14px;">
      <button id="submitBtn">SUBMIT</button>
      <button id="resetBtn" class="small">RESET SESSION</button>
      <button id="audioBtn" class="small">ENABLE / RE-ENABLE AUDIO</button>
    </div>

    <hr/>
    <div class="faint small">
      NOTE: Responses are not case-sensitive. Punctuation doesn’t matter much.
    </div>
  `;

  const answerInput = document.getElementById("answerInput");
  const submitBtn = document.getElementById("submitBtn");
  const resetBtn = document.getElementById("resetBtn");
  const audioBtn = document.getElementById("audioBtn");

  wireButtonSfx(screen);
  wireTypingSfx(screen);

  audioBtn.addEventListener("click", primeAudio);

  answerInput.focus();

  const submit = () => {
    const raw = (answerInput.value || "").trim().toLowerCase();
    const cleaned = raw.replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g," ").trim();

    const accepted = current.a.some(a => {
      const ca = a.toLowerCase().replace(/\s+/g," ").trim();
      return cleaned === ca;
    });

    if(!accepted){
      setStatus("INCORRECT: Try again.");
      return;
    }

    playBeep();
    if(i < total - 1){
      state.riddleIndex += 1;
      saveState(state);
      render();
    } else {
      state.stage = "success";
      saveState(state);
      render();
    }
  };

  submitBtn.addEventListener("click", submit);
  answerInput.addEventListener("keydown", (e) => {
    if(e.key === "Enter") submit();
  });

  resetBtn.addEventListener("click", () => {
    resetState();
    state = { stage:"boot", name:"", code:"", riddleIndex:0 };
    render();
  });
}

function renderSuccess(){
  setStatus("VERIFIED: Issuing physical access code…");

  screen.innerHTML = `
    <h2>VERIFICATION COMPLETE</h2>
    <div class="dim">Vault-Tec Industries — Access Granted</div>
    <hr/>
    <div class="dim">BRIEFCASE UNLOCK CODE</div>
    <div style="margin-top:10px;">
      <span class="codebox">${CONFIG.BRIEFCASE_CODE}</span>
    </div>

    <hr/>
    <div class="faint small">
      Present this code to the Vault-Tec containment unit for immediate access.
    </div>

    <div class="row" style="margin-top:14px;">
      <button id="resetBtn" class="small">RESET SESSION</button>
      <button id="audioBtn" class="small">ENABLE / RE-ENABLE AUDIO</button>
    </div>
  `;

  const resetBtn = document.getElementById("resetBtn");
  const audioBtn = document.getElementById("audioBtn");

  wireButtonSfx(screen);

  resetBtn.addEventListener("click", () => {
    resetState();
    state = { stage:"boot", name:"", code:"", riddleIndex:0 };
    render();
  });

  audioBtn.addEventListener("click", primeAudio);
}
/* ===== FEATURE: RENDER SCREENS END ===== */


/* ===== FEATURE: HELPERS START ===== */
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
/* ===== FEATURE: HELPERS END ===== */


/* ===== FEATURE: INIT START ===== */
render();
/* ===== FEATURE: INIT END ===== */