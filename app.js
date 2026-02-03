/* =========================================================
   VAULT 131 TERMINAL — single page app (FULL REWRITE)
   iPad Safari: AudioContext unlock + buffer-based SFX
   ========================================================= */

/* ===== FEATURE: CONFIG START ===== */
const CONFIG = {
  ACCESS_CODE: "101-317-76",
  BRIEFCASE_CODE: "731",
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
const hum = document.getElementById("hum"); // <audio> loop
/* ===== FEATURE: DOM HOOKS END ===== */


/* ===== FEATURE: STATE (SAVED) START ===== */
const STORAGE_KEY = "vault131_state_v3";
/*
  We do NOT store access code so you never “spoil” it.
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
    const safe = { ...s, code: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  }catch(e){}
}
function resetState(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
}

let state = loadState() || {
  stage: "boot",   // boot | login | riddles | success
  name: "",
  code: "",        // never persisted
  riddleIndex: 0
};
/* ===== FEATURE: STATE (SAVED) END ===== */


/* ===== FEATURE: AUDIO ENGINE (iPAD PROOF) START ===== */
let audioEnabled = false;
let audioCtx = null;
let buffersLoaded = false;

let beepBuf = null;
let typeBufs = [];

let lastTypeAt = 0;
const TYPE_THROTTLE_MS = 55;

function setStatus(text){
  statusText.textContent = text;
}

function getAudioLabel(){
  return audioEnabled ? "AUDIO: ON" : "AUDIO: OFF";
}

async function ensureAudioContext(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioCtx.state === "suspended"){
    await audioCtx.resume().catch(()=>{});
  }
  return audioCtx;
}

async function fetchArrayBuffer(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.arrayBuffer();
}

async function loadAudioBuffers(){
  if(buffersLoaded) return;
  const ctx = await ensureAudioContext();

  // Load + decode MP3 SFX
  const beepData = await fetchArrayBuffer("assets/ui-beep.mp3");
  beepBuf = await ctx.decodeAudioData(beepData);

  const t1 = await fetchArrayBuffer("assets/type1.mp3");
  const t2 = await fetchArrayBuffer("assets/type2.mp3");
  const t3 = await fetchArrayBuffer("assets/type3.mp3");

  typeBufs = [
    await ctx.decodeAudioData(t1),
    await ctx.decodeAudioData(t2),
    await ctx.decodeAudioData(t3),
  ];

  buffersLoaded = true;
}

function playBuffer(buf, { volume = 0.25, rate = 1.0 } = {}){
  if(!audioEnabled || !audioCtx || !buf) return false;

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

// Guaranteed audible test beep even if MP3 fails
function playOscBeep(){
  if(!audioEnabled || !audioCtx) return;
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
  }catch(e){}
}

function stopHum(){
  try{
    if(hum){
      hum.pause();
      hum.currentTime = 0;
    }
  }catch(e){}
}

async function startHum(){
  if(!hum) return;
  hum.volume = 0.22;

  // iOS may reject; that's okay — SFX still work via WebAudio
  try{
    await hum.play();
  }catch(e){}
}

// Toggle that always updates UI button labels
async function enableAudio(){
  audioEnabled = true;
  await ensureAudioContext();

  // Load SFX buffers (if this fails, we still do oscillator beep)
  try{
    await loadAudioBuffers();
  }catch(e){
    // Not fatal
    console.log("Buffer load failed:", e);
  }

  await startHum();

  // Confirm with a beep
  if(!playBuffer(beepBuf, { volume: 0.22, rate: 1.0 })){
    playOscBeep();
  }

  setStatus("Audio enabled.");
  updateAllAudioButtons();
}

function disableAudio(){
  audioEnabled = false;
  stopHum();
  setStatus("Audio disabled.");
  updateAllAudioButtons();
}

async function toggleAudio(){
  // IMPORTANT: must be called from a user gesture (tap/click)
  if(audioEnabled) disableAudio();
  else await enableAudio();
}

// Auto-unlock ability: first tap anywhere can enable audio if you want.
// We won't force-enable; we only “prep” the context.
document.addEventListener("touchstart", () => {
  // Create/resume context early (does not start sound)
  ensureAudioContext();
}, { once:true, passive:true });

/* ===== FEATURE: AUDIO ENGINE (iPAD PROOF) END ===== */


/* ===== FEATURE: SFX HOOKS START ===== */
function wireAudioButton(root = document){
  const btns = root.querySelectorAll("[data-audio-toggle]");
  btns.forEach(btn => {
    // Use pointerdown for iPad reliability
    btn.addEventListener("pointerdown", async (e) => {
      e.preventDefault();
      await toggleAudio();
    });
  });
}

function updateAllAudioButtons(){
  document.querySelectorAll("[data-audio-toggle]").forEach(btn => {
    btn.textContent = getAudioLabel();
  });
}

function playBeep(){
  if(!audioEnabled) return;
  if(!playBuffer(beepBuf, { volume: 0.22, rate: 1.0 })) playOscBeep();
}

function playType(){
  if(!audioEnabled) return;

  const now = performance.now();
  if(now - lastTypeAt < TYPE_THROTTLE_MS) return;
  lastTypeAt = now;

  if(typeBufs && typeBufs.length){
    const idx = Math.floor(Math.random() * typeBufs.length);
    const rate = 0.95 + Math.random() * 0.12;
    const vol = 0.12 + Math.random() * 0.10;
    playBuffer(typeBufs[idx], { volume: vol, rate });
  }else{
    // If mp3 buffers didn't load, at least a tiny tick
    playOscBeep();
  }
}

function wireButtonSfx(root = document){
  root.querySelectorAll("button").forEach(btn => {
    // Don’t beep on the audio toggle itself? (optional—comment out if you want beeps there too)
    const isAudio = btn.hasAttribute("data-audio-toggle");

    btn.addEventListener("mouseenter", () => {
      btn.classList.add("glow");
      if(!isAudio) playBeep();
    });
    btn.addEventListener("mouseleave", () => btn.classList.remove("glow"));

    btn.addEventListener("touchstart", () => {
      btn.classList.add("glow");
      if(!isAudio) playBeep();
    }, { passive:true });
    btn.addEventListener("touchend", () => btn.classList.remove("glow"));
  });
}

function wireTypingSfx(root = document){
  root.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("keydown", () => playType());
    inp.addEventListener("input", () => playType());
    inp.addEventListener("change", () => playType());
  });
}
/* ===== FEATURE: SFX HOOKS END ===== */


/* ===== FEATURE: RENDER SCREENS START ===== */
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function render(){
  if(state.stage === "boot") return renderBoot();
  if(state.stage === "login") return renderLogin();
  if(state.stage === "riddles") return renderRiddles();
  if(state.stage === "success") return renderSuccess();
}

function audioButtonHtml(){
  return `<button class="small" data-audio-toggle>${getAudioLabel()}</button>`;
}

function renderBoot(){
  setStatus("Initializing Vault-Tec terminal…");

  screen.innerHTML = `
    <h1>VAULT 131 DATABASE</h1>
    <div class="dim">WELCOME, OPERATIVE.</div>
    <hr/>
    <div class="row" style="margin-top:12px;">
      ${audioButtonHtml()}
      <button id="continueBtn">CONTINUE</button>
      <button id="resetBtn" class="small">RESET SESSION</button>
    </div>
    <hr/>
    <div class="faint small">
      NOTICE: Audio requires a tap to enable on iPad Safari.
    </div>
  `;

  document.getElementById("continueBtn").addEventListener("click", () => {
    state.stage = "login";
    saveState(state);
    render();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetState();
    state = { stage:"boot", name:"", code:"", riddleIndex:0 };
    disableAudio();
    render();
  });

  wireAudioButton(screen);
  wireButtonSfx(screen);
  updateAllAudioButtons();
}

function renderLogin(){
  setStatus("Manual page vault131(1) — authorization required");

  screen.innerHTML = `
    <h2>AUTHORIZATION REQUIRED</h2>
    <div class="dim">Vault-Tec Industries — Personnel Access</div>
    <hr/>

    <label>NAME (as printed on identification)</label>
    <input id="nameInput" autocomplete="off" autocapitalize="words"
      placeholder="(refer to issued identification)" value="${escapeHtml(state.name)}" />

    <label style="margin-top:14px;">ACCESS CODE</label>
    <input id="codeInput" autocomplete="off" inputmode="text" autocapitalize="characters"
      placeholder="___-___-__" value="" />

    <div class="faint small" style="margin-top:10px;">
      Access code is printed on issued identification.
    </div>

    <div class="row" style="margin-top:14px;">
      <button id="loginBtn">LOGIN</button>
      ${audioButtonHtml()}
      <button id="resetBtn" class="small">RESET</button>
    </div>

    <hr/>
    <div class="faint small">
      Tip: If audio is OFF, tap the AUDIO button once.
    </div>
  `;

  const nameInput = document.getElementById("nameInput");
  const codeInput = document.getElementById("codeInput");

  document.getElementById("loginBtn").addEventListener("click", () => {
    const name = (nameInput.value || "").trim();
    const code = (codeInput.value || "").trim();

    state.name = name;
    state.code = ""; // never store code

    if(!name){
      setStatus("ERROR: Name field empty. Provide identification.");
      return;
    }
    if(code !== CONFIG.ACCESS_CODE){
      setStatus("ACCESS DENIED: Invalid access code.");
      return;
    }

    playBeep();
    setStatus("ACCESS GRANTED: Loading riddle protocol…");
    state.stage = "riddles";
    state.riddleIndex = 0;
    saveState(state);
    render();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetState();
    state = { stage:"boot", name:"", code:"", riddleIndex:0 };
    disableAudio();
    render();
  });

  wireAudioButton(screen);
  wireTypingSfx(screen);
  wireButtonSfx(screen);
  updateAllAudioButtons();
}

function renderRiddles(){
  const i = state.riddleIndex;
  const total = CONFIG.RIDDLES.length;
  const current = CONFIG.RIDDLES[i];

  setStatus(`RIDDLE PROTOCOL: ${i+1}/${total}`);

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
      ${audioButtonHtml()}
      <button id="resetBtn" class="small">RESET</button>
    </div>

    <hr/>
    <div class="faint small">
      NOTE: Responses are not case-sensitive. Punctuation doesn’t matter much.
    </div>
  `;

  const answerInput = document.getElementById("answerInput");
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
    }else{
      state.stage = "success";
      saveState(state);
      render();
    }
  };

  document.getElementById("submitBtn").addEventListener("click", submit);
  answerInput.addEventListener("keydown", (e) => {
    if(e.key === "Enter") submit();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetState();
    state = { stage:"boot", name:"", code:"", riddleIndex:0 };
    disableAudio();
    render();
  });

  wireAudioButton(screen);
  wireTypingSfx(screen);
  wireButtonSfx(screen);
  updateAllAudioButtons();
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
      ${audioButtonHtml()}
      <button id="resetBtn" class="small">RESET SESSION</button>
    </div>
  `;

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetState();
    state = { stage:"boot", name:"", code:"", riddleIndex:0 };
    disableAudio();
    render();
  });

  wireAudioButton(screen);
  wireButtonSfx(screen);
  updateAllAudioButtons();
}
/* ===== FEATURE: RENDER SCREENS END ===== */


/* ===== FEATURE: INIT START ===== */
render();
/* ===== FEATURE: INIT END ===== */