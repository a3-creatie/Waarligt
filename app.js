const KEY = "waarligt_items_v2";
let items = JSON.parse(localStorage.getItem(KEY) || "null");
if (!items) {
  items = [
    {id:crypto.randomUUID(),name:"Boormachine",location:"Thuis",place:"Garage",note:""},
    {id:crypto.randomUUID(),name:"Campingstekker",location:"Camping",place:"Opbergkast",note:""},
    {id:crypto.randomUUID(),name:"Nietmachine",location:"Werk",place:"Bureau",note:""}
  ];
  save();
}
let activeLocation="Alle";
const $=id=>document.getElementById(id);

function save(){localStorage.setItem(KEY,JSON.stringify(items))}
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function getLocations(){
  const preferred=["Thuis","Werk","Camping"];
  const found=items.map(x=>String(x.location||"").trim()).filter(Boolean);
  return [...preferred.filter(x=>found.some(y=>y.toLowerCase()===x.toLowerCase())),
          ...found.filter((x,i,a)=>!preferred.some(p=>p.toLowerCase()===x.toLowerCase()) &&
            a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i)]
    .filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i);
}

function ensureLocation(name){
  const clean=String(name||"").trim();
  if(!clean) return "";
  const existing=getLocations().find(x=>x.toLowerCase()===clean.toLowerCase());
  return existing || clean.charAt(0).toUpperCase()+clean.slice(1);
}

function renderFilters(){
  const nav=$("filters");
  const locations=getLocations();
  const all=["Alle",...locations];
  if(activeLocation!=="Alle" && !locations.some(x=>x.toLowerCase()===activeLocation.toLowerCase())){
    activeLocation="Alle";
  }
  nav.innerHTML=all.map(loc=>`<button class="filter${loc===activeLocation?" active":""}" data-location="${esc(loc)}">${esc(loc)}</button>`).join("");
  nav.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{
    activeLocation=b.dataset.location;
    render();
  });
}

function render(){
  const q=$("search").value.trim().toLowerCase();
  // Zodra je daadwerkelijk zoekt, zoek altijd in ALLE locaties.
  const filtered=items.filter(x=>
    (q ? true : (activeLocation==="Alle"||x.location===activeLocation)) &&
    [x.name,x.location,x.place,x.note].join(" ").toLowerCase().includes(q)
  );
  renderFilters();
  $("summary").textContent=`${filtered.length} ${filtered.length===1?"spul":"spullen"} gevonden`;
  $("empty").hidden=filtered.length!==0;
  $("list").innerHTML=filtered.map(x=>`
    <article class="card">
      <h3>${esc(x.name)}</h3>
      <div class="meta">📍 <strong>${esc(x.location)}</strong>${x.place ? ` — ${esc(x.place)}` : ""}</div>
      ${x.note?`<div class="note">${esc(x.note)}</div>`:""}
      <div class="actions">
        <button onclick="editItem('${x.id}')">Wijzigen</button>
        <button onclick="deleteItem('${x.id}')">Verwijderen</button>
      </div>
    </article>`).join("");
}

function refreshLocationSelect(selected=""){
  const select=$("location");
  const locations=getLocations();
  const all=[...locations];
  if(selected && !all.some(x=>x.toLowerCase()===selected.toLowerCase())) all.push(selected);
  select.innerHTML=all.map(loc=>`<option>${esc(loc)}</option>`).join("");
  const match=all.find(x=>x.toLowerCase()===String(selected||"").toLowerCase());
  select.value=match || (all.find(x=>x.toLowerCase()==="thuis") || all[0] || "Thuis");
}

function openAdd(prefill={}){
  $("dialogTitle").textContent="Spul toevoegen";
  $("itemId").value="";
  $("name").value=prefill.name||"";
  refreshLocationSelect(prefill.location||"Thuis");
  $("place").value=prefill.place||"";
  $("note").value=prefill.note||"";
  $("itemDialog").showModal();
}
function editItem(id){
  const x=items.find(i=>i.id===id); if(!x)return;
  $("dialogTitle").textContent="Spul wijzigen";
  $("itemId").value=x.id;
  $("name").value=x.name;
  refreshLocationSelect(x.location);
  $("place").value=x.place||"";
  $("note").value=x.note||"";
  $("itemDialog").showModal();
}
function deleteItem(id){
  const x=items.find(i=>i.id===id);
  if(x && confirm(`“${x.name}” verwijderen?`)){items=items.filter(i=>i.id!==id);save();render()}
}

window.editItem=editItem; window.deleteItem=deleteItem;

$("addBtn").onclick=()=>openAdd();
$("cancelBtn").onclick=()=>$("itemDialog").close();
$("itemForm").onsubmit=e=>{
  e.preventDefault();
  const id=$("itemId").value;
  const data={name:$("name").value.trim(),location:$("location").value,place:$("place").value.trim(),note:$("note").value.trim()};
  if(!data.name)return;
  if(id){Object.assign(items.find(x=>x.id===id),data)}else{items.push({id:crypto.randomUUID(),...data})}
  save();render();$("itemDialog").close();
};
$("search").oninput=render;
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{
  activeLocation=b.dataset.location;
  document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));
  render();
});

function showToast(msg){
  $("toast").textContent=msg;$("toast").hidden=false;
  clearTimeout(showToast.t);showToast.t=setTimeout(()=>$("toast").hidden=true,3000);
}

// Voice recognition: create a fresh recognizer for every recording.
// This is more reliable on Android browsers than reusing one SpeechRecognition instance.
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null;

function voiceErrorMessage(code){
  const messages={
    "not-allowed":"Microfoon geblokkeerd. Geef WaarLigt toestemming voor de microfoon.",
    "service-not-allowed":"De spraakdienst van deze browser is niet beschikbaar.",
    "network":"De spraakdienst kon niet worden bereikt. Controleer je internetverbinding.",
    "no-speech":"Ik hoorde geen spraak. Probeer iets dichter bij de telefoon te spreken.",
    "audio-capture":"De microfoon kon niet worden geopend.",
    "language-not-supported":"Nederlandse spraakherkenning wordt hier niet ondersteund.",
    "aborted":"Spraakopname gestopt."
  };
  return messages[code] || `Spraakherkenning gaf fout: ${code||"onbekend"}.`;
}

function clearListening(){
  document.querySelectorAll(".voice,.mic").forEach(b=>b.classList.remove("listening"));
}

function makeRecognition(){
  if(!SpeechRecognition)return null;
  const r=new SpeechRecognition();
  r.lang="nl-NL";
  r.interimResults=true;
  r.continuous=false;
  r.maxAlternatives=3;
  return r;
}

function startRecognition(onText){
  if(!SpeechRecognition){
    showToast("Deze browser ondersteunt geen web-spraakherkenning. Gebruik de microfoon van je toetsenbord.");
    return false;
  }
  recognition=makeRecognition();
  let handled=false;
  recognition.onstart=()=>document.querySelectorAll(".voice,.mic").forEach(b=>b.classList.add("listening"));
  recognition.onerror=e=>{
    if(handled)return;
    handled=true;
    clearListening();
    showToast(voiceErrorMessage(e.error));
  };
  recognition.onresult=e=>{
    let text="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      text += e.results[i][0].transcript+" ";
      if(e.results[i].isFinal){
        const heard=text.trim();
        if(heard){handled=true;onText(heard);}
      }
    }
  };
  recognition.onend=()=>{
    clearListening();
    recognition=null;
  };
  try{
    recognition.start();
    return true;
  }catch(e){
    clearListening();
    showToast("Spraakopname kon niet starten. Druk nogmaals op de microfoon.");
    recognition=null;
    return false;
  }
}

function listen(mode){
  startRecognition(text=>{
    if(mode==="search"){
      activeLocation="Alle";
      document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x.dataset.location==="Alle"));
      $("search").value=text.replace(/^waar ligt (mijn|de|het)\s+/i,"");
      render(); showToast(`Gezocht naar: ${text}`);
    }else{
      handleVoiceCommand(text);
    }
  });
}

function normalizeItemName(value){
  return String(value||"").toLowerCase()
    .replace(/^(?:mijn|de|het|een)\s+/i,"")
    .replace(/\s+/g," ").trim();
}
function findItemByName(value){
  const n=normalizeItemName(value);
  if(!n) return null;
  return items.find(x=>normalizeItemName(x.name)===n) ||
         items.find(x=>normalizeItemName(x.name).includes(n)||n.includes(normalizeItemName(x.name)));
}
function cap(value){
  return value ? value.charAt(0).toUpperCase()+value.slice(1) : value;
}
const ARTICLES=/^(?:de|het|een|mijn)\s+/i;
const MOVE_WORDS=/\b(?:meegenomen|gebracht|verhuisd|verplaatst|gelegd|gezet|geplaatst|opgeborgen|neergelegd|weggelegd)\b/i;
const RELATIONS=/^(?:naar|in|op|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+/i;

function cleanDestination(value){
  return String(value||"").replace(ARTICLES,"").replace(/[.!?]+$/g,"").trim();
}

/*
  Destination semantics:
  - "naar de opslag", "in de schuur", "naar de garage" => main location.
  - "op de bovenste plank in de schuur" => location=Schuur, place=bovenste plank.
  - "in de kast in de schuur" => location=Schuur, place=de kast.
  - A destination that is a known main location is always a location.
  - New destination nouns such as "opslag" or "schuur" become new locations automatically.
*/
function parseDestination(raw){
  let s=cleanDestination(raw);
  s=s.replace(/^naar\s+/i,"").trim();
  const locations=getLocations();
  const locationWords=["thuis","werk","camping","opslag","schuur","garage","berging","zolder","kelder","loods","box","garagebox","magazijn","kantoor","werkplaats","tuinhuis"];

  // IMPORTANT: Dutch natural speech often puts the location first and the
  // exact place after it: "in de schuur op de eerste plank".
  // That means: location = Schuur, place = eerste plank.
  let m=s.match(/^(?:in|naar|bij|op)\s+(?:de|het|een)\s+(.+?)\s+(?:op|in|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+(?:de|het|een)?\s*(.+)$/i);
  if(m){
    const possibleLocation=cleanDestination(m[1]);
    const possiblePlace=cleanDestination(m[2]);
    const known=locations.find(x=>x.toLowerCase()===possibleLocation.toLowerCase());
    if(known || locationWords.includes(possibleLocation.toLowerCase()))
      return {location:ensureLocation(possibleLocation), place:possiblePlace};
  }

  // Same construction without an article before the location:
  // "schuur op de eerste plank".
  m=s.match(/^(.+?)\s+(?:op|in|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+(?:de|het|een)?\s*(.+)$/i);
  if(m){
    const possibleLocation=cleanDestination(m[1]);
    const possiblePlace=cleanDestination(m[2]);
    const known=locations.find(x=>x.toLowerCase()===possibleLocation.toLowerCase());
    if(known || locationWords.includes(possibleLocation.toLowerCase()))
      return {location:ensureLocation(possibleLocation), place:possiblePlace};
  }

  // "op de bovenste plank in de schuur" => location Schuur, place bovenste plank.
  m=s.match(/^(?:op|in|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+(?:de|het|een)?\s*(.+?)\s+(?:in|op|bij|naar)\s+(?:de|het|een)?\s*(.+)$/i);
  if(m){
    const possiblePlace=cleanDestination(m[1]);
    const possibleLocation=cleanDestination(m[2]);
    const known=locations.find(x=>x.toLowerCase()===possibleLocation.toLowerCase());
    if(known || locationWords.includes(possibleLocation.toLowerCase()))
      return {location:ensureLocation(possibleLocation), place:possiblePlace};
  }

  // Direct destination: "schuur", "opslag", "garage", etc. = location.
  const direct=locations.find(x=>x.toLowerCase()===s.toLowerCase());
  if(direct) return {location:direct, place:""};

  if(locationWords.includes(s.toLowerCase()))
    return {location:ensureLocation(s), place:""};

  // Otherwise treat the spoken destination as a place only.
  return {location:"", place:cap(s)};
}

function updateItemLocation(item, parsed){
  if(parsed.location) item.location=ensureLocation(parsed.location);
  if(parsed.place !== undefined) item.place=parsed.place || "";
}

function handleVoiceCommand(text){
  const t=text.toLowerCase().trim().replace(/[.!?]+$/g,"");

  // "Ik heb de boormachine van werk naar thuis gebracht."
  const transfer=t.match(/^(?:ik heb\s+)?(?:mijn|de|het)?\s*(.+?)\s+van\s+(.+?)\s+naar\s+(.+?)(?:\s+(?:gebracht|verplaatst|meegenomen|verhuisd))?$/i);
  if(transfer){
    const item=findItemByName(transfer[1]);
    if(!item){showToast(`Ik kan “${cap(transfer[1])}” niet vinden. Voeg het eerst als artikel toe.`);return;}
    const dest=cleanDestination(transfer[3]);
    const location=ensureLocation(dest);
    item.location=location;
    item.place="";
    save();render();
    showToast(`${item.name} staat nu bij ${item.location}.`);
    return;
  }

  const patterns=[
    /^(?:ik heb\s+)?(?:mijn|de|het)?\s*(.+?)\s+(?:meegenomen|gebracht|verhuisd|verplaatst)\s+(?:naar\s+)?(.+)$/i,
    /^(?:ik heb\s+)?(?:mijn|de|het)?\s*(.+?)\s+(?:naar|in|op|bij)\s+(.+?)\s+(?:verplaatst|gelegd|gezet|geplaatst|opgeborgen|neergelegd|weggelegd)$/i,
    /^(?:zet|leg|plaats|breng)\s+(?:mijn|de|het)?\s*(.+?)\s+(?:naar|in|op|bij)\s+(.+)$/i,
    /^(?:mijn|de|het)?\s*(.+?)\s+(?:staat|ligt)(?: nu)?\s+(?:in|op|bij)\s+(.+)$/i
  ];
  for(const pattern of patterns){
    const m=t.match(pattern); if(!m) continue;
    const item=findItemByName(m[1]);
    if(!item){showToast(`Ik kan “${cap(m[1])}” niet vinden. Voeg het eerst als artikel toe.`);return;}
    const parsed=parseDestination(m[2]);
    if(parsed.location){
      item.location=parsed.location;
      item.place=parsed.place||"";
      save();render();
      showToast(`${item.name} staat nu bij ${item.location}${item.place ? " — "+item.place : ""}.`);
    }else{
      item.place=parsed.place||"";
      save();render();
      showToast(`${item.name} staat nu op/in ${item.place}.`);
    }
    return;
  }

  const m=t.match(/^waar ligt (mijn |de |het )?(.+?)[?!.]*$/i);
  if(m){
    $("search").value=m[2].trim();
    activeLocation="Alle";
    render();
    showToast(`Ik zoek naar: ${m[2].trim()}`);
    return;
  }

  // Add command: "voeg sleutels toe, thuis, hal kastje"
  let add=t.replace(/^voeg( een)?\s+/i,"").replace(/\btoe\b/i,"").trim();
  if(/^sla op\b/i.test(add)) add=add.replace(/^sla op\b/i,"").trim();

  const comma=add.split(",").map(x=>x.trim()).filter(Boolean);
  let loc="Thuis", name="", place="";
  if(comma.length>=2){
    name=comma[0];
    const first=comma[1];
    if(["thuis","werk","camping"].includes(first.toLowerCase())){
      loc=cap(first.toLowerCase());
      place=comma.slice(2).join(", ").trim();
    }else{
      // A new location can be spoken directly after the item.
      loc=ensureLocation(first);
      place=comma.slice(2).join(", ").trim();
    }
  }else{
    const mainLoc=add.match(/\b(thuis|werk|camping|opslag|schuur|garage|berging|zolder|kelder|loods|box|magazijn|kantoor|werkplaats|tuinhuis)\b/i);
    if(mainLoc){
      loc=ensureLocation(mainLoc[1]);
      name=add.slice(0,mainLoc.index).trim();
      place=add.slice(mainLoc.index+mainLoc[0].length).trim();
      place=place.replace(/^(?:in|op|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+(?:de|het|een)\s+/i,"");
    }else{
      const pm=add.match(/^(.*?)\s+(?:in|op|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+(?:de|het|een)?\s*(.+)$/i);
      if(pm){name=pm[1].trim();place=pm[2].trim();}
      else name=add.trim();
    }
  }
  name=normalizeItemName(name);
  if(name){
    openAdd({name:cap(name),location:loc,place:place ? cap(place) : ""});
    showToast("Ik heb het formulier met je stem ingevuld.");
  }else{
    showToast("Zeg bijvoorbeeld: “Voeg sleutels toe, thuis, hal kastje.”");
  }
}

$("voiceBtn").onclick=()=>listen("command");
$("searchVoiceBtn").onclick=()=>listen("search");

function listenIntoField(fieldId, mode="replace") {
  startRecognition(heard=>{
    const field=$(fieldId);
    if(!field)return;
    if(mode==="append"){
      const old=field.value.trim();
      field.value=old ? old+" "+heard : heard;
    }else{
      field.value=heard.replace(/^(?:mijn|de|het|een)\s+/i,"").trim();
    }
    field.focus();
    showToast(mode==="append" ? "Tekst aan de notitie toegevoegd." : "Veld ingevuld met je stem.");
  });
}

function tryMoveFromSpeech(spoken){
  const t=spoken.toLowerCase().trim().replace(/[.!?]+$/g,"");

  const transfer=t.match(/^(?:ik heb\s+)?(?:mijn|de|het)?\s*(.+?)\s+van\s+(.+?)\s+naar\s+(.+?)(?:\s+(?:gebracht|verplaatst|meegenomen|verhuisd))?$/i);
  if(transfer){
    const item=findItemByName(transfer[1]);
    if(!item)return false;
    item.location=ensureLocation(cleanDestination(transfer[3]));
    item.place="";
    save();render();try{$("itemDialog").close()}catch(e){}
    showToast(`${item.name} staat nu bij ${item.location}.`);
    return true;
  }

  const patterns=[
    /^(?:ik heb\s+)?(?:mijn|de|het)?\s*(.+?)\s+(?:meegenomen|gebracht|verhuisd|verplaatst)\s+(?:naar\s+)?(.+)$/i,
    /^(?:ik heb\s+)?(?:mijn|de|het)?\s*(.+?)\s+(?:naar|in|op|bij)\s+(.+?)\s+(?:verplaatst|gelegd|gezet|geplaatst|opgeborgen|neergelegd|weggelegd)$/i,
    /^(?:zet|leg|plaats|breng)\s+(?:mijn|de|het)?\s*(.+?)\s+(?:naar|in|op|bij)\s+(.+)$/i,
    /^(?:mijn|de|het)?\s*(.+?)\s+(?:staat|ligt)(?: nu)?\s+(?:in|op|bij)\s+(.+)$/i
  ];
  for(const pattern of patterns){
    const m=t.match(pattern);if(!m)continue;
    const item=findItemByName(m[1]);if(!item)return false;
    const parsed=parseDestination(m[2]);
    if(parsed.location){item.location=parsed.location;item.place=parsed.place||"";}
    else item.place=parsed.place||"";
    save();render();try{$("itemDialog").close()}catch(e){}
    showToast(`${item.name} staat nu bij ${item.location}${item.place?" — "+item.place:""}.`);
    return true;
  }
  return false;
}

function fillAddFormFromSpeech(spoken){
  if(tryMoveFromSpeech(spoken))return;
  let s=spoken.replace(/[.!?]+$/g,"").replace(/\s+/g," ").trim();
  s=s.replace(/^(?:ik heb(?: nu)?|ik wil|ik heb|voeg(?: een)?|zet|leg|plaats)\s+/i,"").trim();
  s=s.replace(/^(?:er staat|er ligt|er zit)\s+/i,"").trim();

  let loc="Thuis", formName="", formPlace="";
  const comma=s.split(",").map(x=>x.trim()).filter(Boolean);

  if(comma.length>=2){
    formName=normalizeItemName(comma[0]);
    let rest=comma.slice(1);
    const first=rest[0];
    if(first && ["thuis","werk","camping"].includes(first.toLowerCase())){
      loc=cap(first.toLowerCase());
      rest=rest.slice(1);
    }else if(first){
      // New location names such as "opslag" and "schuur" are valid.
      loc=ensureLocation(first);
      rest=rest.slice(1);
    }
    formPlace=rest.join(", ").trim();
  }else{
    const mainLoc=s.match(/\b(thuis|werk|camping|opslag|schuur|garage|berging|zolder|kelder|loods|box|magazijn|kantoor|werkplaats|tuinhuis)\b/i);
    if(mainLoc){
      loc=ensureLocation(mainLoc[1]);
      const before=s.slice(0,mainLoc.index).trim();
      let after=s.slice(mainLoc.index+mainLoc[0].length).trim();
      formName=normalizeItemName(before);
      after=after.replace(/^(?:gelegd|gezet|geplaatst|opgeborgen|verplaatst|neergelegd|weggelegd)\s+/i,"");
      after=after.replace(/^(?:in|op|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+(?:de|het|een)\s+/i,"");
      formPlace=after.trim();
    }else{
      const pm=s.match(/^(.*?)\s+(?:in|op|bij|onder|naast|achter|voor|boven|tussen|tegen)\s+(?:de|het|een)?\s*(.+)$/i);
      if(pm){formName=normalizeItemName(pm[1]);formPlace=pm[2].trim();}
      else formName=normalizeItemName(s);
    }
  }

  // "luchtbed luchtbed" and similar recognition duplication guard.
  if(formName){
    const doubled=new RegExp("^("+formName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")\\s+\\1$","i");
    formName=formName.replace(doubled,"$1");
  }
  formPlace=formPlace.replace(/^(?:thuis|werk|camping)\s*(?:,|;|-)?\s*/i,"").trim();

  if(formName){
    $("name").value=cap(formName);
    refreshLocationSelect(loc);
    $("place").value=formPlace ? cap(formPlace) : "";
    showToast("Ik heb het formulier met je stem ingevuld.");
  }else{
    showToast("Ik kon de naam van het artikel niet goed verstaan.");
  }
}

ensureFieldMicrophones();
$("addVoiceNameBtn").onclick=()=>listenIntoField("name","replace");
$("addVoicePlaceBtn").onclick=()=>listenIntoField("place","replace");
$("addVoiceNoteBtn").onclick=()=>listenIntoField("note","append");
render();
