/* =========================================================
   VAULT 131 TERMINAL — single page app
   iPad Safari friendly: click-to-enable audio, touch events
   ========================================================= */

/* ===== FEATURE: CONFIG START ===== */
const CONFIG = {
  // You can change this to match her badge access code:
  ACCESS_CODE: "101-317-76",

  // After 5 correct riddles, she gets this 3-digit briefcase code:
  BRIEFCASE_CODE: "731",

  // 5 Fallout-themed riddles (answers are case-insensitive)
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
/* ===== FEATURE: TYPING VARIANTS START ===== */
const typeClips = [
  document.getElementById("type1"),
  document.getElementById("type2"),
  document.getElementById("type3"),
].filter(Boolean);

let lastTypeIndex = -1;
let lastTypeAt = 0;
const TYPE_THROTTLE_MS = 55;
/* ===== FEATURE: TYPING VARIANTS END ===== */

let audioEnabled = false;
/* ===== FEATURE: DOM HOOKS END ===== */


/* ===== FEATURE: STATE (SAVED) START ===== */
const STORAGE_KEY = "vault131_state_v1";

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}
function saveState(state){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}
function resetState(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
}

let state = loadState() || {
  stage: "boot", // boot | login | riddles | success
  name: "",
  code: "",
  riddleIndex: 0
};
/* ===== FEATURE: STATE (SAVED) END ===== */


/* ===== FEATURE: AUDIO CONTROL START ===== */
function primeAudio(){
  // Must be called from a user gesture (click/tap) on iPad Safari
  audioEnabled = true;

  // Set volumes (feel free to tweak)
  hum.volume = 0.22;
  beep.volume = 0.35;
  typeClips.forEach(a => a.volume = 0.22);

  // Try to play hum
  hum.play().catch(()=>{ /* ignore */ });

  // A tiny “beep” to confirm audio is unlocked
  playBeep();
}

function playBeep(){
  if(!audioEnabled) return;
  beep.currentTime = 0;
  beep.play().catch(()=>{});
}

/* ===== FEATURE: ALTERNATING TYPE SOUND START ===== */
function playType(){
  if(!audioEnabled || typeClips.length === 0) return;

  // Pick a different clip than last time (when possible)
  let idx = Math.floor(Math.random() * typeClips.length);
  if(typeClips.length > 1 && idx === lastTypeIndex){
    idx = (idx + 1) % typeClips.length;
  }
  lastTypeIndex = idx;

  const a = typeClips[idx];

  // Small human-ish variation
  a.playbackRate = 0.92 + Math.random() * 0.22; // 0.92–1.14
  a.volume = 0.18 + Math.random() * 0.10;       // 0.18–0.28

  try { a.currentTime = 0; } catch(e) {}
  a.play().catch(()=>{});
}
/* ===== FEATURE: ALTERNATING TYPE SOUND END ===== */

/* ===== FEATURE: AUDIO CONTROL END ===== */


/* ===== FEATURE: BUTTON HOVER/TAP SFX START ===== */
function wireButtonSfx(root = document){
  const buttons = root.querySelectorAll("button");

  buttons.forEach(btn => {
    // Hover for mouse/trackpad users
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
    inp.addEventListener("input", () => playType());
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
    <input id="nameInput" autocomplete="off" autocapitalize="words" placeholder="ANSEL - SEXTON, IZABELLA" value="${escapeHtml(state.name)}"/>

    <label style="margin-top:14px;">ACCESS CODE</label>
    <input id="codeInput" autocomplete="off" inputmode="text" autocapitalize="characters" placeholder="101-317-76" value="${escapeHtml(state.code)}"/>

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

    state.name = name;
    state.code = code;

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
    <input id="answerInput" autocomplete="off" placeholder="Type your answer…" />

    <div class="row" style="margin-top:14px;">
      <button id="submitBtn">SUBMIT</button>
      <button id="resetBtn" class="small">RESET SESSION</button>
    </div>

    <hr/>
    <div class="faint small">
      NOTE: Responses are not case-sensitive. Punctuation doesn’t matter much.
    </div>
  `;

  const answerInput = document.getElementById("answerInput");
  const submitBtn = document.getElementById("submitBtn");
  const resetBtn = document.getElementById("resetBtn");

  wireButtonSfx(screen);
  wireTypingSfx(screen);

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