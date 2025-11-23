/* ====================== AYARLAR ====================== */
const ROWS = 6, COLS = 3;
let values = new Array(ROWS * COLS).fill(0);
let currentLevel = 8;
let totalPopped = 0;

// GLOBAL PUAN SİSTEMİ
let globalScore = parseInt(localStorage.getItem("carpanTarlasi_score")) || 0;

/* ====================== AĞIRLIK HAVUZLARI ====================== */
let weightPools = {
    8:  {1:4, 2:5, 3:1, 4:5, 8:2}, 
    12: {1:4, 2:5, 3:5, 4:4, 6:3, 9:1, 12:2},
    16: {1:4, 2:4, 4:5, 3:1, 8:4, 16:2},
    18: {1:4, 2:4, 3:6, 6:3, 8:1, 9:3, 18:2},
    20: {1:4, 2:5, 4:5, 5:4, 8:1, 10:2, 20:2},
    24: {1:4, 2:5, 3:5, 4:4, 6:4, 8:3, 12:2, 15:1, 24:2},
    27: {1:5, 3:8, 9:4, 14:1, 27:2},
    30: {1:4, 2:4, 3:5, 4:2, 5:5, 6:4, 10:3, 12:1, 15:2, 30:2},
    36: {1:4, 2:4, 3:4, 4:4, 6:5, 9:4, 12:3, 14:1, 18:3, 36:2},
    40: {1:4, 2:5, 4:5, 5:5, 6:1, 8:3, 10:3, 20:1, 40:2},
    48: {1:4, 2:4, 3:4, 4:5, 6:4, 8:3, 12:3, 15:1, 16:2, 24:2, 48:2},
    60: {1:4, 2:4, 3:3, 4:3, 5:4, 6:3, 10:3, 12:2, 15:2, 16:1, 20:3, 30:2, 60:2}
};

window.onload = function() {
    updateGlobalScoreUI();
    createStars(); 
};

function weightedRandom() {
    let pool = weightPools[currentLevel];
    if(!pool) pool = {1:5, 2:5, 4:5}; 

    let sum = Object.values(pool).reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let k in pool) {
        if (r < pool[k]) return Number(k);
        r -= pool[k];
    }
}

/* ====================== RENDER ====================== */
function renderGrid() {
    let g = document.getElementById("grid");
    g.innerHTML = "";
    for (let i = 0; i < values.length; i++) {
        let c = document.createElement("div");
        c.className = "cell";
        
        let val = values[i];
        c.textContent = val;
        c.dataset.i = i;
        
        // Asal Sayı Renklendirmesi
        if(val === 2) c.classList.add("prime-2");
        if(val === 3) c.classList.add("prime-3");
        if(val === 5) c.classList.add("prime-5");

        c.addEventListener("mousedown", startDrag);
        c.addEventListener("touchstart", startDrag, {passive: false});
        g.appendChild(c);
    }
}

/* ====================== DRAG-SWAP & HATA ====================== */
let dragIndex = null;

function startDrag(e) {
    if(e.type === 'touchstart') e.preventDefault(); 
    dragIndex = Number(e.target.dataset.i);
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);
}

async function endDrag(e) {
    document.removeEventListener("mouseup", endDrag);
    document.removeEventListener("touchend", endDrag);

    let clientX, clientY;
    if(e.type === 'touchend') {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    let target = document.elementFromPoint(clientX, clientY);
    if (!target || !target.classList.contains("cell")) return;

    let dropIndex = Number(target.dataset.i);

    if (Math.abs(dragIndex - dropIndex) === COLS) {
        await softSwap(dragIndex, dropIndex);
        
        let matches = findMatches();
        if (matches.length > 0) {
            await processMove();
        } else {
            await triggerErrorEffect();
            await softSwap(dragIndex, dropIndex); 
        }
    }
}

async function triggerErrorEffect() {
    let g = document.getElementById("grid");
    g.classList.add("error-shake"); 
    await delay(400); 
    g.classList.remove("error-shake"); 
}

function softSwap(a, b) {
    return new Promise(res => {
        let g = document.getElementById("grid");
        let ca = g.children[a], cb = g.children[b];
        let isDown = (b - a === COLS); 
        let dy = isDown ? "100%" : "-100%"; 
        let dyRev = isDown ? "-100%" : "100%";

        ca.style.setProperty("--dy", dy);
        cb.style.setProperty("--dy", dyRev);
        ca.classList.add("swap-anim");
        cb.classList.add("swap-anim");

        setTimeout(() => {
            [values[a], values[b]] = [values[b], values[a]];
            renderGrid();
            res();
        }, 180);
    });
}

/* ====================== OYUN MANTIĞI ====================== */
function findMatches() {
    let rows = [];
    for (let r = 0; r < ROWS; r++) {
        let i = r * COLS;
        let p = values[i] * values[i + 1] * values[i + 2];
        if (p === currentLevel) rows.push(r);
    }
    return rows;
}

function spawnParticles(i) {
    const cell = document.getElementById("grid").children[i];
    if(!cell) return;
    const rect = cell.getBoundingClientRect();
    const size = rect.width;

    for (let p = 0; p < 14; p++) {
        let part = document.createElement("div");
        part.className = "particle";
        part.style.left = (rect.left + size/2) + "px";
        part.style.top = (rect.top + size/2) + "px";
        part.style.setProperty("--dx", (Math.random() * 140 - 70) + "px");
        part.style.setProperty("--dy", (Math.random() * 140 - 70) + "px");
        document.body.appendChild(part);
        setTimeout(() => part.remove(), 600);
    }
}

/* ====================== PUANLAMA & BONUS ====================== */
function popRow(r) {
    let base = r * COLS;
    let earnedPoints = 0;
    let bonusPoints = 0;

    for (let c = 0; c < COLS; c++) {
        let idx = base + c;
        let val = values[idx];

        spawnParticles(idx);
        values[idx] = 0;
        
        let point = 3;
        
        // Asal Sayı Bonusu
        if(val === 2 || val === 3 || val === 5) {
            point += 7; 
            bonusPoints += 7; 
        }
        
        earnedPoints += point;
    }
    totalPopped += 3;
    globalScore += earnedPoints;
    
    // Bonus Efekti
    if(bonusPoints > 0) {
        showFloatingBonus(bonusPoints);
    }
    
    localStorage.setItem("carpanTarlasi_score", globalScore);
    updateScoreUI();
}

function showFloatingBonus(amount) {
    let scoreBox = document.querySelector(".score-box");
    if(!scoreBox) return;
    let rect = scoreBox.getBoundingClientRect();

    let floater = document.createElement("div");
    floater.className = "floating-bonus";
    floater.textContent = "Asal Sayı Bonusu +" + amount;
    
    // Ekranın sağına yaslı olduğu için biraz sola alıyoruz
    floater.style.left = (rect.left - 40) + "px"; 
    floater.style.top = (rect.bottom + 5) + "px";

    document.body.appendChild(floater);

    setTimeout(() => {
        floater.remove();
    }, 2000);
}

function applyGravity() {
    for (let c = 0; c < COLS; c++) {
        let col = [];
        for (let r = 0; r < ROWS; r++) {
            let i = r * COLS + c;
            if (values[i] !== 0) col.push(values[i]);
        }
        while (col.length < ROWS) col.unshift(weightedRandom());
        for (let r = 0; r < ROWS; r++) {
            values[r * COLS + c] = col[r];
        }
    }
}

function isStuck() {
    if (findMatches().length > 0) return false;
    for (let r = 0; r < ROWS - 1; r++) {
        for (let c = 0; c < COLS; c++) {
            let i = r * COLS + c, j = (r + 1) * COLS + c;
            [values[i], values[j]] = [values[j], values[i]];
            let m = findMatches().length;
            [values[i], values[j]] = [values[j], values[i]];
            if (m > 0) return false;
        }
    }
    return true;
}

async function reshuffle() {
    showMsg("Karıştırılıyor...");
    let g = document.getElementById("grid");
    g.style.opacity = "0.5"; 
    await delay(350);

    let ok = false;
    while (!ok) {
        for (let i = 0; i < values.length; i++) {
            values[i] = weightedRandom();
        }
        applyGravity();
        renderGrid();
        if (findMatches().length > 0) continue;
        if (!isStuck()) ok = true;
    }

    g.style.opacity = "1"; 
    await delay(350);
    showMsg("Hazır ✔️");
}

async function processMove() {
    let loop = true;
    while (loop) {
        let matches = findMatches();
        if (matches.length === 0) {
            if (isStuck()) await reshuffle();
            return;
        }
        for (let r of matches) popRow(r);
        applyGravity();
        renderGrid();
        await delay(200);

        if (totalPopped >= 24) {
            await delay(500);
            showVictory();
            return;
        }
    }
}

/* ====================== YÖNETİM & UI ====================== */
async function generatePlayableBoard() {
    let ok = false;
    while (!ok) {
        for (let i = 0; i < values.length; i++) {
            values[i] = weightedRandom();
        }
        applyGravity();
        renderGrid();
        if (findMatches().length > 0) continue;
        if (!isStuck()) ok = true;
    }
}

async function startLevel(lvl) {
    currentLevel = lvl;
    totalPopped = 0;
    
    document.getElementById("menu").style.display = "none";
    let gameEl = document.getElementById("game");
    gameEl.style.display = "flex";
    
    // --- OYUN AÇILIŞ ANİMASYONU ---
    // Önce sınıfı kaldır, sonra tekrar ekle ki animasyon baştan oynasın
    gameEl.classList.remove("game-enter");
    void gameEl.offsetWidth; // CSS Reflow tetikleyici
    gameEl.classList.add("game-enter");

    let targetEl = document.getElementById("targetVal");
    if(targetEl) targetEl.textContent = lvl; 
    
    updateScoreUI();
    
    await generatePlayableBoard();
}

function updateScoreUI() {
    document.getElementById("progressVal").textContent = totalPopped + " / 24";
    updateGlobalScoreUI();
}

function updateGlobalScoreUI() {
    let hudScore = document.getElementById("globalScoreVal");
    let menuScore = document.getElementById("menuScoreDisplay");
    
    if(hudScore) hudScore.textContent = globalScore;
    if(menuScore) menuScore.textContent = "Puan: " + globalScore;
}

function showMsg(t, timeout = 1200) {
    let m = document.getElementById("msg");
    m.textContent = t;
    if (timeout > 0) setTimeout(() => m.textContent = "", timeout);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function showVictory() {
    document.getElementById("victoryOverlay").style.display = "flex";
    document.getElementById("victoryScore").textContent = "Toplam Puan: " + globalScore;
}

function backToMenu() {
    document.getElementById("victoryOverlay").style.display = "none";
    document.getElementById("game").style.display = "none";
    document.getElementById("menu").style.display = "flex";
    updateGlobalScoreUI(); 
}

function createStars() {
    const bg = document.getElementById("background-layer");
    if(!bg) return;
    bg.innerHTML = "";
    const starCount = 100; 

    for(let i=0; i<starCount; i++) {
        let star = document.createElement("div");
        star.className = "bg-star";
        
        let x = Math.random() * 100;
        let y = Math.random() * 100;
        let size = Math.random() * 2 + 1;
        let duration = Math.random() * 3 + 2; 

        star.style.left = x + "%";
        star.style.top = y + "%";
        star.style.width = size + "px";
        star.style.height = size + "px";
        star.style.animationDuration = duration + "s";

        bg.appendChild(star);
    }
}
