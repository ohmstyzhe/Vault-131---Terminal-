/* =========================================================
   VAULT 131 TERMINAL — single page app
   Audio rewrite: WebAudio-only (iPad Safari reliable)
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
/* ===== FEATURE: DOM HOOKS END ===== */


/* ===== FEATURE: STATE (SAVED) START ===== */
const STORAGE_KEY = "vault131_state_v4";
/*
  Important: we NEVER store the access code (don’t spoil it).
*/
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
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
  stage: "boot", // boot | login | riddles | success
  name: "",
  code: "",      // never persisted
  riddleIndex: 0
};
/* ===== FEATURE: STATE (SAVED) END ===== */


/* ===== FEATURE: STATUS START ===== */
function setStatus(text){
  statusText.textContent = text;
}
/* ===== FEATURE: STATUS END ===== */


/* ===== FEATURE: WEB AUDIO ENGINE START ===== */
let audioEnabled = false;
let audioCtx = null;

let humBuf = null;
let beepBuf = null;
let typeBufs = [];

let humSource = null;
let humGain = null;
let sfxGain = null;

let lastTypeIndex = -1;
let lastTypeAt = 0;
const TYPE_THROTTLE_MS = 55;

// Required assets
const ASSETS = {
  hum: "assets/crt-hum.mp3",
  beep: "assets/ui-beep.mp3",
  type: ["assets/type1.mp3", "assets/type2.mp3", "assets/type3.mp3"]
};

function audioLabel(){
  return audioEnabled ? "AUDIO: ON" : "AUDIO: OFF";
}

async function ensureAudio(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioCtx.state === "suspended"){
    await audioCtx.resume().catch(()=>{});
  }
  // Create gains once
  if(!humGain){
    humGain = audioCtx.createGain();
    humGain.gain.value = 0.18;
    humGain.connect(audioCtx.destination);
  }
  if(!sfxGain){
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(audioCtx.destination);
  }
}

async function fetchArrayBuffer(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.arrayBuffer();
}

async function decodeMp3(url){
  const data = await fetchArrayBuffer(url);
  return await audioCtx.decodeAudioData(data);
}

async function loadAllAudio(){
  await ensureAudio();

  // Load once
  if(humBuf && beepBuf && typeBufs.length === 3) return;

  // Any failure here means paths/filenames are wrong or cached deploy
  humBuf = await decodeMp3(ASSETS.hum);
  beepBuf = await decodeMp3(ASSETS.beep);

  typeBufs = [];
  for(const t of ASSETS.type){
    typeBufs.push(await decodeMp3(t));
  }
}

function startHum(){
  if(!audioEnabled || !humBuf || !audioCtx) return;
  stopHum();

  humSource = audioCtx.createBufferSource();
  humSource.buffer = humBuf;
  humSource.loop = true;

  humSource.connect(humGain);
  humSource.start(0);
}

function stopHum(){
  try{
    if(humSource){
      humSource.stop(0);
      humSource.disconnect();
      humSource = null;
    }
  }catch(e){}
}

function playBuffer(buf, { volume = 0.25, rate = 1.0 } = {}){
  if(!audioEnabled || !audioCtx || !buf) return;

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;

  const g = audioCtx.createGain();
  g.gain.value = volume;

  src.connect(g);
  g.connect(sfxGain);

  src.start(0);
}

function playBeep(){
  if(!beepBuf) return;
  playBuffer(beepBuf, { volume: 0.22, rate: 1.0 });
}

function playType(){
  if(!typeBufs.length) return;

  const now = performance.now();
  if(now - lastTypeAt < TYPE_THROTTLE_MS) return;
  lastTypeAt = now;

  // pick a different clip than last time if possible
  let idx = Math.floor(Math.random() * typeBufs.length);
  if(typeBufs.length > 1 && idx === lastTypeIndex){
    idx = (idx + 1) % typeBufs.length;
  }
  lastTypeIndex = idx;

  const rate = 0.95 + Math.random() * 0.12;
  const vol  = 0.11 + Math.random() * 0.10;
  playBuffer(typeBufs[idx], { volume: vol, rate });
}

async function enableAudio(){
  // Must be called from user gesture (tap)
  try{
    await ensureAudio();
    await loadAllAudio();

    audioEnabled = true;
    startHum();
    playBeep();

    setStatus("Audio enabled.");
  }catch(e){
    audioEnabled = false;
    stopHum();
    setStatus("Audio failed — check /assets file names and refresh.");
    console.log(e);
  }

  updateAudioButtons();
}

function disableAudio(){
  audioEnabled = false;
  stopHum();
  setStatus("Audio disabled.");
  updateAudioButtons();
}

async function toggleAudio(){
  if(audioEnabled) disableAudio();
  else await enableAudio();
}

// Optional: prepare the context on first interaction (doesn’t start audio)
document.addEventListener("touchstart", () => {
  ensureAudio();
}, { once:true, passive:true });
/* ===== FEATURE: WEB AUDIO ENGINE END ===== */


/* ===== FEATURE: UI AUDIO BUTTON START ===== */
function audioButtonHtml(){
  return `<button class="small" data-audio-toggle>${audioLabel()}</button>`;
}

function updateAudioButtons(){
  document.querySelectorAll("[data-audio-toggle]").forEach(btn => {
    btn.textContent = audioLabel();
  });
}

function wireAudioButton(root = document){
  root.querySelectorAll("[data-audio-toggle]").forEach(btn => {
    // pointerdown is best on iPad for gesture recognition
    btn.addEventListener("pointerdown", async (e) => {
      e.preventDefault();
      await toggleAudio();
    });
  });
}
/* ===== FEATURE: UI AUDIO BUTTON END ===== */


/* ===== FEATURE: BUTTON GLOW + SFX START ===== */
function wireButtonSfx(root = document){
  const buttons = root.querySelectorAll("button");

  buttons.forEach(btn => {
    const isAudioToggle = btn.hasAttribute("data-audio-toggle");

    btn.addEventListener("mouseenter", () => {
      btn.classList.add("glow");
      if(audioEnabled && !isAudioToggle) playBeep();
    });
    btn.addEventListener("mouseleave", () => btn.classList.remove("glow"));

    btn.addEventListener("touchstart", () => {
      btn.classList.add("glow");
      if(audioEnabled && !isAudioToggle) playBeep();
    }, { passive:true });
    btn.addEventListener("touchend", () => btn.classList.remove("glow"));
  });
}
/* ===== FEATURE: BUTTON GLOW + SFX END ===== */


/* ===== FEATURE: TYPING SFX START ===== */
function wireTypingSfx(root = document){
  const inputs = root.querySelectorAll("input");
  inputs.forEach(inp => {
    inp.addEventListener("keydown", () => { if(audioEnabled) playType(); });
    inp.addEventListener("input", () => { if(audioEnabled) playType(); });
    inp.addEventListener("change", () => { if(audioEnabled) playType(); });
  });
}
/* ===== FEATURE: TYPING SFX END ===== */


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


/* ===== FEATURE: RENDER SCREENS START ===== */
function render(){
  if(state.stage === "boot") return renderBoot();
  if(state.stage === "login") return renderLogin();
  if(state.stage === "riddles") return renderRiddles();
  if(state.stage === "success") return renderSuccess();
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
      NOTICE: On iPad Safari, tap AUDIO once to enable sound.
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
  updateAudioButtons();
}

function renderLogin(){
  setStatus("Manual page vault131(1) — authorization required");

  screen.innerHTML = `
    <h2>AUTHORIZATION REQUIRED</h2>
    <div class="dim">Vault-Tec Industries — Personnel Access</div>
    <hr/>

    <label>NAME (as printed on identification)</label>
    <input id="nameInput"
      autocomplete="off"
      autocapitalize="words"
      placeholder="(refer to issued identification)"
      value="${escapeHtml(state.name)}"
    />

    <label style="margin-top:14px;">ACCESS CODE</label>
    <input id="codeInput"
      autocomplete="off"
      inputmode="text"
      autocapitalize="characters"
      placeholder="___-___-__"
      value=""
    />

    <div class="faint small" style="margin-top:10px;">
      Access code is printed on issued identification.
    </div>

    <div class="row" style="margin-top:14px;">
      <button id="loginBtn">LOGIN</button>
      ${audioButtonHtml()}
      <button id="backBtn" class="small">BACK</button>
    </div>
  `;

  const nameInput = document.getElementById("nameInput");
  const codeInput = document.getElementById("codeInput");

  document.getElementById("loginBtn").addEventListener("click", () => {
    const name = (nameInput.value || "").trim();
    const code = (codeInput.value || "").trim();

    state.name = name;
    state.code = ""; // never store access code

    if(!name){
      setStatus("ERROR: Name field empty. Provide identification.");
      return;
    }
    if(code !== CONFIG.ACCESS_CODE){
      setStatus("ACCESS DENIED: Invalid access code.");
      return;
    }

    if(audioEnabled) playBeep();
    setStatus("ACCESS GRANTED: Loading riddle protocol…");
    state.stage = "riddles";
    state.riddleIndex = 0;
    saveState(state);
    render();
  });

  document.getElementById("backBtn").addEventListener("click", () => {
    state.stage = "boot";
    saveState(state);
    render();
  });

  wireAudioButton(screen);
  wireTypingSfx(screen);
  wireButtonSfx(screen);
  updateAudioButtons();
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

    if(audioEnabled) playBeep();

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
  updateAudioButtons();
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
  updateAudioButtons();
}
/* ===== FEATURE: RENDER SCREENS END ===== */


/* ===== FEATURE: INIT START ===== */
render();
/* ===== FEATURE: INIT END ===== */