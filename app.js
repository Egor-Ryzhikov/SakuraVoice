const seed=[
 {id:"akira",name:"Акира",initial:"ア",status:"в сети",group:false,unread:2,messages:[
  ["in","Привет! 👋","20:42"],["in","Ты уже посмотрел новую серию?","20:42"],["out","Да! Это было просто эпично! 🔥","20:43"],["in","Вот, держи 😊","20:43"],["out","Спасибо!! Сейчас посмотрю 😍","20:44"]]},
 {id:"ninja",name:"Команда ниндзя",initial:"忍",status:"5 участников",group:true,unread:5,messages:[["in","Саске: Отличная работа всем сегодня! 💪","20:40"],["in","Наруто: Завтра тренировка в 10:00.","20:41"]]},
 {id:"sakura",name:"Сакура Харуно",initial:"桜",status:"была недавно",group:false,unread:1,messages:[["in","Спасибо огромное! 🌸","20:38"]]},
 {id:"kakashi",name:"Какаши-сенсей",initial:"カ",status:"был недавно",group:false,unread:0,messages:[["in","📎 Отправил файл с заданием.","20:15"]]},
 {id:"naruto",name:"Узумаки Наруто",initial:"🍥",status:"в сети",group:false,unread:0,messages:[["in","Давай завтра на тренировку! 😎","19:58"]]},
 {id:"anime",name:"Аниме обсуждение",initial:"A",status:"124 участника",group:true,unread:12,messages:[["in","Кто-нибудь смотрел новую серию?","18:30"]]}
];
let chats=JSON.parse(localStorage.getItem("sakuraChats")||"null")||seed;
let current="akira", filter="all";
const $=id=>document.getElementById(id);
function save(){localStorage.setItem("sakuraChats",JSON.stringify(chats))}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function renderList(){
 const q=$("search").value.toLowerCase();
 $("chatList").innerHTML="";
 chats.filter(c=>(filter==="all"||(filter==="unread"&&c.unread>0)||(filter==="groups"&&c.group))&&c.name.toLowerCase().includes(q)).forEach(c=>{
  const last=c.messages[c.messages.length-1]?.[1]||"";
  const el=document.createElement("div");el.className="chat "+(c.id===current?"active":"");
  el.innerHTML=`<div class="avatar">${esc(c.initial)}</div><div class="info"><div class="name">${esc(c.name)}</div><div class="preview">${esc(last)}</div></div><div>${c.messages.at(-1)?.[2]?`<div class="time">${c.messages.at(-1)[2]}</div>`:""}${c.unread?`<span class="badge">${c.unread}</span>`:""}</div>`;
  el.onclick=()=>openChat(c.id);$("chatList").appendChild(el);
 });
}
function openChat(id){
 current=id;const c=chats.find(x=>x.id===id);if(!c)return;c.unread=0;save();renderList();
 $("headerName").textContent=c.name;$("headerStatus").textContent=c.status;$("headerAvatar").textContent=c.initial;
 const box=$("messages");box.innerHTML='<div class="day">Сегодня</div>';
 c.messages.forEach(m=>addBubble(m));
 box.scrollTop=box.scrollHeight;
}
function addBubble(m){
 const r=document.createElement("div");r.className="row "+(m[0]==="out"?"me":"");
 const safe=esc(m[1]);
 r.innerHTML=`<div class="bubble">${safe}<div class="metaTime">${esc(m[2]||"")} ${m[0]==="out"?"✓✓":""}</div></div>`;
 $("messages").appendChild(r);
}
function now(){return new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}
$("composer").onsubmit=e=>{e.preventDefault();sendMessage()}
function sendMessage(){
 const input=$("messageInput"),text=input.value.trim();if(!text)return;
 const c=chats.find(x=>x.id===current);c.messages.push(["out",text,now()]);save();openChat(current);input.value="";
 $("typing").classList.remove("hidden");setTimeout(()=>{ $("typing").classList.add("hidden"); if(Math.random()<.75){c.messages.push(["in","Получено! ✨",now()]);save();openChat(current)}},900);
}
$("emojiBtn").onclick=()=>{$("messageInput").value+=" 😊";$("messageInput").focus()}
$("attachBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>{const f=e.target.files[0];if(!f)return;const c=chats.find(x=>x.id===current);c.messages.push(["out","📎 "+f.name,now()]);save();openChat(current);e.target.value=""}
$("search").oninput=renderList;
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;renderList()});
$("settingsBtn").onclick=()=>{$("modal").classList.remove("hidden");$("profileName").value=localStorage.getItem("sakuraName")||"Sakura"}
$("closeModal").onclick=()=>$("modal").classList.add("hidden");
$("saveProfile").onclick=()=>{const n=$("profileName").value.trim()||"Sakura";localStorage.setItem("sakuraName",n);$("modal").classList.add("hidden")};
$("callBtn").onclick=()=>alert("Демо-звонок: здесь можно подключить WebRTC для настоящих аудио/видеозвонков.");
renderList();openChat(current);