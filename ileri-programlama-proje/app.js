const STORAGE_KEY = "RESEARCH_NOTEBOOK_V3_TOGGLE_ANYWHERE";
const $ = (id) => document.getElementById(id);

let state = loadState() || createEmptyState();
let searchTerm = "";
let debounceTimer = null;

/**
 * createEmptyState()
 * Sayfa ilk açıldığında solda konu yok görünmesi için BOŞ state döndürür.
 */
function createEmptyState(){
  return { topics: [], activeId: null };
}

/**
 * saveState(s)
 * State'i localStorage'a kaydeder.
 */
function saveState(s){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * loadState()
 * localStorage'dan state okur. Bozuksa null döner.
 */
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}

/**
 * makeId()
 * Benzersiz id üretir.
 */
function makeId(){
  return (crypto?.randomUUID?.() || ("id_" + Math.random().toString(16).slice(2) + Date.now().toString(16)));
}

/**
 * getActiveTopic()
 * activeId'ye göre aktif konuyu döndürür.
 */
function getActiveTopic(){
  return state.topics.find(t => t.id === state.activeId) || null;
}

/**
 * ensureActiveTopic()
 * Aktif konu yoksa otomatik "Untitled" bir konu oluşturur.
 */
function ensureActiveTopic(){
  const existing = getActiveTopic();
  if(existing) return existing;

  const t = { id: makeId(), title: "Untitled", note: "", updatedAt: Date.now() };
  state.topics.unshift(t);
  state.activeId = t.id;
  saveState(state);
  renderList();
  return t;
}

/**
 * formatDate(ts)
 * Zaman damgasını okunabilir metne çevirir.
 */
function formatDate(ts){
  return new Date(ts).toLocaleString();
}

/**
 * previewText(text)
 * Liste kartı için kısa önizleme üretir.
 */
function previewText(text){
  const t = (text || "").trim().replace(/\s+/g," ");
  return t.slice(0, 70) + (t.length > 70 ? "..." : "");
}

/**
 * escapeHtml(str)
 * Kart içinde XSS olmasın diye HTML karakterlerini kaçırır.
 */
function escapeHtml(str){
  return (str || "").replace(/[&<>"']/g, (m) => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[m]
  ));
}

/**
 * renderList()
 * Sol taraftaki konu listesini çizer.
 */
function renderList(){
  const listEl = $("list");
  listEl.innerHTML = "";

  let topics = [...state.topics].sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));

  if(searchTerm){
    const q = searchTerm.toLowerCase();
    topics = topics.filter(t => ((t.title||"") + " " + (t.note||"")).toLowerCase().includes(q));
  }

  if(topics.length === 0){
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Konu bulunamadı.";
    listEl.appendChild(empty);
    return;
  }

  topics.forEach((t)=>{
    const card = document.createElement("div");
    card.className = "topicCard" + (t.id === state.activeId ? " active" : "");
    card.innerHTML =
      `<p class="tTitle">${escapeHtml(t.title || "Untitled")}</p>
       <p class="tDesc">${escapeHtml(previewText(t.note) || "…")}</p>
       <div class="tFoot">
         <span>${escapeHtml(formatDate(t.updatedAt || Date.now()))}</span>
         <button class="del" type="button">Sil</button>
       </div>`;

    card.addEventListener("click", (e)=>{
      if(e.target.classList.contains("del")) return;
      state.activeId = t.id;
      saveState(state);
      loadUI();
      renderList();
    });

    card.querySelector(".del").addEventListener("click", (e)=>{
      e.stopPropagation();
      if(!confirm("Bu konuyu silmek istiyor musun?")) return;
      state.topics = state.topics.filter(x => x.id !== t.id);
      if(state.activeId === t.id){
        state.activeId = state.topics[0]?.id || null;
      }
      saveState(state);
      loadUI();
      renderList();
    });

    listEl.appendChild(card);
  });
}

/**
 * loadUI()
 * Sağ taraftaki alanları state'e göre doldurur.
 */
function loadUI(){
  const a = getActiveTopic();

  $("topTitle").textContent = a ? (a.title || "Untitled") : "Untitled";
  $("title").value = a ? (a.title || "") : "";
  $("note").value = a ? (a.note || "") : "";
  $("count").textContent = (a ? (a.note || "").length : 0) + " karakter";
  $("updated").textContent = a ? ("Updated: " + formatDate(a.updatedAt || Date.now())) : "—";
  $("saveText").textContent = "Saved locally";
}

/**
 * scheduleAutosave()
 * Kullanıcı yazdıkça 400ms sonra kaydeder (debounce).
 */
function scheduleAutosave(){
  $("saveText").textContent = "Saving...";
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(()=>{
    const a = ensureActiveTopic();
    a.title = ($("title").value || "Untitled").trim() || "Untitled";
    a.note = $("note").value || "";
    a.updatedAt = Date.now();
    state.activeId = a.id;
    saveState(state);
    loadUI();
    renderList();
  }, 400);
}

/**
 * insertPrefix(prefix)
 * İmlecin bulunduğu satırın başına prefix ekler.
 */
function insertPrefix(prefix){
  const n = $("note");
  const start = n.selectionStart;
  const value = n.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;

  n.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);
  const newPos = start + prefix.length;
  n.focus();
  n.setSelectionRange(newPos, newPos);
  n.dispatchEvent(new Event("input"));
}

/**
 * toggleTodoOnCurrentLine()
 * Satır içinde ⬜ / ☑️ varsa tıkla-toggla.
 */
function toggleTodoOnCurrentLine(){
  const n = $("note");
  const pos = n.selectionStart;
  const text = n.value;

  const ls = text.lastIndexOf("\n", pos - 1) + 1;
  const le = text.indexOf("\n", pos);
  const end = (le === -1 ? text.length : le);
  const line = text.slice(ls, end);

  const hasEmpty = line.includes("⬜");
  const hasDone = line.includes("☑️");
  if(!hasEmpty && !hasDone) return;

  let newLine = line;
  if(hasDone){
    newLine = newLine.replace("☑️", "⬜");
  }else{
    newLine = newLine.replace("⬜", "☑️");
  }

  n.value = text.slice(0, ls) + newLine + text.slice(end);
  n.setSelectionRange(pos, pos);
  n.dispatchEvent(new Event("input"));
}

/* --- EVENTLER --- */
$("search").addEventListener("input", (e)=>{
  searchTerm = (e.target.value || "").trim();
  renderList();
});

$("newBtn").addEventListener("click", ()=>{
  const t = { id: makeId(), title: "Untitled", note: "", updatedAt: Date.now() };
  state.topics.unshift(t);
  state.activeId = t.id;
  saveState(state);
  loadUI();
  renderList();
  $("title").focus();
  $("title").select();
});

$("bulletBtn").addEventListener("click", ()=>{
  ensureActiveTopic();
  insertPrefix("- ");
});

$("todoBtn").addEventListener("click", ()=>{
  ensureActiveTopic();
  insertPrefix(" ⬜ ");
});

$("title").addEventListener("input", ()=>{
  ensureActiveTopic();
  scheduleAutosave();
});

$("note").addEventListener("input", ()=>{
  ensureActiveTopic();
  $("count").textContent = ($("note").value || "").length + " karakter";
  scheduleAutosave();
});

$("note").addEventListener("click", ()=>{
  toggleTodoOnCurrentLine();
});

/* --- İLK AÇILIŞ --- */
renderList();
loadUI();
