
const STORAGE_KEY = "RESEARCH_NOTEBOOK";

// Kısayol fonksiyonu: id ver → o elementi bul
const $ = (id) => document.getElementById(id);

// Uygulamanın tüm verisi (konular + aktif konu)
// Önce localStorage'dan yükle, yoksa boş state oluştur
let state = loadState() || createEmptyState();

// Arama kutusuna yazılan kelime
let searchTerm = "";

// Otomatik kaydetme için timer (debounce için)
let debounceTimer = null;

/**
 * createEmptyState()
 * Uygulama ilk açılınca boş bir state üretir.
 */
function createEmptyState(){
  return { topics: [], activeId: null };
}

/**
 * saveState(s)
 * State'i localStorage'a kaydeder.
 * (Sayfa kapanınca da silinmez)
 */
function saveState(s){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * loadState()
 * localStorage'dan state okur.
 * Eğer veri yoksa veya bozuksa null döner.
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
 * Her konu için benzersiz id üretir.
 * (rastgele + zaman)
 */
function makeId(){
  return ("id_" + Math.random().toString(16).slice(2) + Date.now().toString(16));
}

/**
 * getActiveTopic()
 * activeId'ye göre şu an seçili olan konuyu bulur.
 * Bulamazsa null döner.
 */
function getActiveTopic(){
  return state.topics.find(t => t.id === state.activeId) || null;
}

/**
 * ensureActiveTopic()
 * Aktif konu yoksa otomatik yeni konu açar.
 * Varsa onu döndürür.
 */
function ensureActiveTopic(){
  const existing = getActiveTopic();
  if(existing) return existing;

  // Yeni konu oluştur
  const t = { id: makeId(), title: "Untitled", note: "", updatedAt: Date.now() };

  // Listeye en başa ekle
  state.topics.unshift(t);

  // Bu konuyu aktif yap
  state.activeId = t.id;

  // Kaydet ve listeyi yenile
  saveState(state);
  renderList();

  return t;
}

/**
 * formatDate(ts)
 * Sayıyı (timestamp) okunabilir tarihe çevirir.
 */
function formatDate(ts){
  return new Date(ts).toLocaleString();
}

/**
 * previewText(text)
 * Sol listedeki kartta kısa özet göstermek için.
 * İlk 70 karakteri alır.
 */
function previewText(text){
  const t = (text || "").trim().replace(/\s+/g," ");
  return t.slice(0, 70) + (t.length > 70 ? "..." : "");
}

/**
 * escapeHtml(str)
 * Güvenlik için: < > gibi karakterleri metin olarak gösterir.
 * (İçeride HTML çalışmasın)
 */
function escapeHtml(str){
  return (str || "").replace(/[&<>"']/g, (m) => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[m]
  ));
}

/**
 * renderList()
 * Sol taraftaki konu listesini ekrana çizer.
 */
function renderList(){
  const listEl = $("list");
  listEl.innerHTML = "";

  // Konuları son güncellenene göre sırala
  let topics = [...state.topics].sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));

  // Arama varsa filtrele
  if(searchTerm){
    const q = searchTerm.toLowerCase();
    topics = topics.filter(t => ((t.title||"") + " " + (t.note||"")).toLowerCase().includes(q));
  }

  // Hiç konu yoksa mesaj göster
  if(topics.length === 0){
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Konu bulunamadı.";
    listEl.appendChild(empty);
    return;
  }

  // Her konu için bir kart oluştur
  topics.forEach((t)=>{
    const card = document.createElement("div");

    // Aktif olan kartı farklı göster
    card.className = "topicCard" + (t.id === state.activeId ? " active" : "");

    // Kartın içeriğini yaz
    card.innerHTML =
      `<p class="tTitle">${escapeHtml(t.title || "Untitled")}</p>
       <p class="tDesc">${escapeHtml(previewText(t.note) || "…")}</p>
       <div class="tFoot">
         <span>${escapeHtml(formatDate(t.updatedAt || Date.now()))}</span>
         <button class="del" type="button">Sil</button>
       </div>`;

    // Kart tıklanınca: seçili konu değişsin
    card.addEventListener("click", (e)=>{
      if(e.target.classList.contains("del")) return; // Sil'e basıldıysa geç
      state.activeId = t.id;
      saveState(state);
      loadUI();
      renderList();
    });

    // Sil butonuna basınca: konuyu sil
    card.querySelector(".del").addEventListener("click", (e)=>{
      e.stopPropagation();
      if(!confirm("Bu konuyu silmek istiyor musun?")) return;

      state.topics = state.topics.filter(x => x.id !== t.id);

      // Silinen konu aktifse, ilk konuyu aktif yap
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
 * Sağ taraftaki alanları (title, note, sayaç, tarih) doldurur.
 */
function loadUI(){
  const a = getActiveTopic();

  // Üst başlık (top bar) yazısı
  $("topTitle").textContent = a ? (a.title || "Untitled") : "Untitled";

  // Kullanıcı title yazarken onu bozma: odakta değilse set et
  if(document.activeElement !== $("title")){
    $("title").value = a ? (a.title || "") : "";
  }

  // Kullanıcı note yazarken onu bozma: odakta değilse set et
  if(document.activeElement !== $("note")){
    $("note").value = a ? (a.note || "") : "";
  }

  // Karakter sayısı ve güncelleme tarihi
  $("count").textContent = (a ? (a.note || "").length : 0) + " karakter";
  $("updated").textContent = a ? ("Updated: " + formatDate(a.updatedAt || Date.now())) : "—";

  // Kaydetme durumu
  $("saveText").textContent = "Saved locally";
}

/**
 * scheduleAutosave()
 * Kullanıcı yazdıktan 400ms sonra kaydeder.
 * (Hemen değil, biraz bekleyip tek sefer kaydeder)
 */
function scheduleAutosave(){
  $("saveText").textContent = "Saving...";

  // Önceki bekleyen kaydı iptal et
  clearTimeout(debounceTimer);

  // 400ms sonra kaydet
  debounceTimer = setTimeout(()=>{
    const a = ensureActiveTopic();

    // Ekrandaki değerleri state'e yaz
    a.title = $("title").value ?? "";
    a.note = $("note").value || "";
    a.updatedAt = Date.now();
    state.activeId = a.id;

    // Kaydet ve listeyi yenile
    saveState(state);
    renderList();

    // Sağ taraftaki bilgi alanlarını güncelle
    $("count").textContent = ($("note").value || "").length + " karakter";
    $("updated").textContent = "Updated: " + formatDate(a.updatedAt);
    $("saveText").textContent = "Saved locally";
  }, 400);
}

// Note'a ilk kez girince başlık boşsa otomatik Untitled yap
$("note").addEventListener("focus", ()=>{
  const titleEl = $("title");
  const a = ensureActiveTopic();

  if(titleEl.value.trim() === ""){
    titleEl.value = "Untitled";
    a.title = "Untitled";
    a.updatedAt = Date.now();
    saveState(state);
    renderList();
  }
});

/**
 * insertPrefix(prefix)
 * İmlecin bulunduğu satırın başına "- " gibi bir şey ekler.
 */
function insertPrefix(prefix){
  const n = $("note");
  const start = n.selectionStart;
  const value = n.value;

  // İmlecin bulunduğu satırın başlangıcı
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;

  // Prefix'i satırın başına ekle
  n.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);

  // İmleci doğru yere koy
  const newPos = start + prefix.length;
  n.focus();
  n.setSelectionRange(newPos, newPos);

  // input olayı tetiklensin (autosave çalışsın)
  n.dispatchEvent(new Event("input"));
}

/**
 * toggleTodoOnCurrentLine()
 * Satırda ⬜ varsa ☑️ yapar, ☑️ varsa ⬜ yapar.
 */
function toggleTodoOnCurrentLine(){
  const n = $("note");
  const pos = n.selectionStart;
  const text = n.value;

  // İmlecin olduğu satırı bul
  const ls = text.lastIndexOf("\n", pos - 1) + 1;
  const le = text.indexOf("\n", pos);
  const end = (le === -1 ? text.length : le);
  const line = text.slice(ls, end);

  const hasEmpty = line.includes("⬜");
  const hasDone = line.includes("☑️");
  if(!hasEmpty && !hasDone) return;

  // Tersine çevir
  let newLine = line;
  if(hasDone){
    newLine = newLine.replace("☑️", "⬜");
  }else{
    newLine = newLine.replace("⬜", "☑️");
  }

  // Satırı güncelle
  n.value = text.slice(0, ls) + newLine + text.slice(end);

  // İmleci aynı yerde tut
  n.setSelectionRange(pos, pos);

  // autosave çalışsın
  n.dispatchEvent(new Event("input"));
}

/* EVENTLER (kullanıcı ne yaparsa) */

// Arama yazınca listeyi filtrele
$("search").addEventListener("input", (e)=>{
  searchTerm = (e.target.value || "").trim();
  renderList();
});

// Yeni konu butonu
$("newBtn").addEventListener("click", ()=>{
  const t = { id: makeId(), title: "Untitled", note: "", updatedAt: Date.now() };
  state.topics.unshift(t);
  state.activeId = t.id;
  saveState(state);
  loadUI();
  renderList();

  // Başlığı seç, hemen yazabilsin
  $("title").focus();
  $("title").select();
});

// Madde satırı ekle
$("bulletBtn").addEventListener("click", ()=>{
  ensureActiveTopic();
  insertPrefix("- ");
});

// To-do satırı ekle
$("todoBtn").addEventListener("click", ()=>{
  ensureActiveTopic();
  insertPrefix(" ⬜ ");
});

// Başlık yazınca kaydet
$("title").addEventListener("input", ()=>{
  ensureActiveTopic();
  scheduleAutosave();
});

// Not yazınca kaydet ve karakter sayısını güncelle
$("note").addEventListener("input", ()=>{
  ensureActiveTopic();
  $("count").textContent = ($("note").value || "").length + " karakter";
  scheduleAutosave();
});

// Note'a tıklayınca: satırda todo varsa ☑️ / ⬜ değiştir
$("note").addEventListener("click", ()=>{
  toggleTodoOnCurrentLine();
});

/* --- İLK AÇILIŞ --- */
// Sol listeyi çiz
renderList();

// Sağ tarafı doldur
loadUI();
