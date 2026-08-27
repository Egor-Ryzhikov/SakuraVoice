let token=localStorage.getItem("sakuraToken"),me=null,current=null,socket=null;
let pc=null,localStream=null,callPeer=null,callType="audio",incomingOffer=null,iceQueue=[];
const $=x=>document.getElementById(x),esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
async function api(p,o={}){let r=await fetch(p,{...o,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})}}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Ошибка");return d}
function t(x){return new Date(x).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}
function badge(u){return u.verified?`<span class="verified" title="Проверенный аккаунт">✓</span>`:""}
async function boot(){if(!token)return;try{me=await api("/api/me");show();connect();loadChats()}catch{logout()}}
function show(){$("auth").classList.add("hidden");$("app").classList.remove("hidden");$("myN").innerHTML=esc(me.display_name)+badge(me);$("myU").textContent="@"+me.username;$("myA").textContent=me.avatar||"🌸";if(["developer","admin"].includes(me.role))$("admin").classList.remove("hidden")}
function authShow(){$("auth").classList.remove("hidden");$("app").classList.add("hidden")}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");window.mode=b.dataset.mode;$("d").classList.toggle("hidden",window.mode!=="register")});
window.mode="login";
$("authForm").onsubmit=async e=>{e.preventDefault();$("err").textContent="";try{let d=await api(window.mode==="login"?"/api/auth/login":"/api/auth/register",{method:"POST",body:JSON.stringify({username:$("u").value,displayName:$("d").value,password:$("p").value})});token=d.token;localStorage.setItem("sakuraToken",token);me=d.user;show();connect();loadChats()}catch(e){$("err").textContent=e.message}};
function connect(){
 socket=io({auth:{token}});
 socket.on("message:new",m=>{let other=Number(m.sender_id)===Number(me.id)?Number(m.receiver_id):Number(m.sender_id);if(current&&current.id===other)add(m);loadChats()});
 socket.on("call:offer",d=>{
   if(pc)return;
   incomingOffer=d;$("incomingName").textContent="Входящий вызов";$("incomingType").textContent=d.type==="video"?"📹 Видеозвонок":"📞 Аудиозвонок";$("incomingModal").classList.remove("hidden");
 });
 socket.on("call:answer",async d=>{if(pc&&d.answer){await pc.setRemoteDescription(d.answer);$("callStatus").textContent="Соединение…"}});
 socket.on("call:ice",async d=>{if(!d.candidate)return;if(pc?.remoteDescription)await pc.addIceCandidate(d.candidate).catch(()=>{});else iceQueue.push(d.candidate)});
 socket.on("call:rejected",()=>{alert("Звонок отклонён.");closeCall()});
 socket.on("call:ended",()=>closeCall());
}
async function loadChats(){let list=await api("/api/chats");$("chats").innerHTML="";list.forEach(c=>{let e=document.createElement("div");e.className="chat "+(current?.id===c.id?"active":"");e.innerHTML=`<div class="avatar">${esc(c.avatar||"🌸")}</div><div class="chatInfo"><div class="chatName">${esc(c.display_name)}${badge(c)}</div><div class="preview">${esc(c.last_message||"Начните общение")}</div></div><div>${c.last_message_at?`<div class="time">${t(c.last_message_at)}</div>`:""}${c.unread?`<span class="badge">${c.unread}</span>`:""}</div>`;e.onclick=()=>open(c);$("chats").appendChild(e)})}
async function open(c){current=c;$("chatN").innerHTML=esc(c.display_name)+badge(c);$("chatS").textContent="@"+c.username;$("chatA").textContent=c.avatar||"🌸";$("msg").disabled=false;$("form button").disabled=false;$("record").disabled=false;$("callAudio").classList.remove("hidden");$("callVideo").classList.remove("hidden");let list=await api("/api/messages/"+c.id);$("messages").innerHTML="";list.forEach(add);await api("/api/messages/"+c.id+"/read",{method:"POST"});loadChats()}
function add(m){
 let w=$("messages"),row=document.createElement("div");
 row.className="row "+(Number(m.sender_id)===Number(me.id)?"me":"");
 const meta=`<div class="meta">${t(m.created_at)} ${row.classList.contains("me")?(m.read_at?"✓✓":"✓"):""}</div>`;
 if(m.message_type==="audio" && m.audio_url){
   row.innerHTML=`<div class="bubble audioBubble"><span>🎙️</span><audio controls preload="metadata" src="${m.audio_url}"></audio>${meta}</div>`;
 }else{
   row.innerHTML=`<div class="bubble">${esc(m.body)}${meta}</div>`;
 }
 w.appendChild(row);w.scrollTop=w.scrollHeight;
}
$("form").onsubmit=async e=>{e.preventDefault();if(!current)return;let input=$("msg"),body=input.value.trim();if(!body)return;try{await api("/api/messages",{method:"POST",body:JSON.stringify({receiverId:current.id,body})});input.value=""}catch(e){alert(e.message)}};
$("search").oninput=async e=>{let q=e.target.value.trim(),box=$("results");if(!q){box.classList.add("hidden");return}try{let us=await api("/api/users?q="+encodeURIComponent(q));box.innerHTML="";us.forEach(u=>{let d=document.createElement("div");d.className="user";d.innerHTML=`<div class="avatar">${esc(u.avatar||"🌸")}</div><div><b>${esc(u.display_name)}${badge(u)}</b><small>@${esc(u.username)}</small></div>`;d.onclick=()=>{box.classList.add("hidden");open(u)};box.appendChild(d)});box.classList.remove("hidden")}catch{}};
$("reload").onclick=loadChats;
$("logout").onclick=()=>logout();

let recorder=null,audioChunks=[],recording=false;
$("record").onclick=async()=>{
 if(!current)return;
 if(recording){recorder.stop();return}
 if(!navigator.mediaDevices?.getUserMedia){alert("Ваш браузер не поддерживает запись голоса.");return}
 try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const preferred=MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":"audio/webm";
   recorder=new MediaRecorder(stream,{mimeType:preferred});
   audioChunks=[];recording=true;$("record").classList.add("recording");$("record").textContent="⏹️";
   recorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};
   recorder.onstop=async()=>{
     recording=false;$("record").classList.remove("recording");$("record").textContent="🎙️";
     stream.getTracks().forEach(t=>t.stop());
     const blob=new Blob(audioChunks,{type:recorder.mimeType||"audio/webm"});
     if(blob.size>1800000){alert("Запись слишком длинная. Сделайте голосовое короче.");return}
     const reader=new FileReader();
     reader.onload=async()=>{
       try{
         await api("/api/messages",{method:"POST",body:JSON.stringify({
           receiverId:current.id,messageType:"audio",audioUrl:reader.result
         })});
       }catch(e){alert(e.message)}
     };
     reader.readAsDataURL(blob);
   };
   recorder.start();
 }catch(e){alert("Не удалось получить доступ к микрофону. Разрешите микрофон для сайта.")}
};


const rtcConfig={iceServers:[
 {urls:"stun:stun.l.google.com:19302"},
 {urls:"stun:stun1.l.google.com:19302"}
]};
function closeCall(){
  if(localStream)localStream.getTracks().forEach(t=>t.stop());
  if(pc){pc.ontrack=null;pc.onicecandidate=null;pc.close();}
  pc=null;localStream=null;callPeer=null;incomingOffer=null;iceQueue=[];
  $("callModal").classList.add("hidden");$("incomingModal").classList.add("hidden");
  $("remoteVideo").srcObject=null;$("localVideo").srcObject=null;
}
async function startCall(type){
  if(!current)return;
  try{
    callPeer=current.id;callType=type;
    localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:type==="video"});
    $("localVideo").srcObject=localStream;$("remoteVideo").srcObject=null;
    $("callTitle").textContent=type==="video"?"Видеозвонок":"Аудиозвонок";
    $("callStatus").textContent="Вызов…";$("callModal").classList.remove("hidden");
    pc=new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));
    pc.onicecandidate=e=>{if(e.candidate)socket.emit("call:ice",{to:callPeer,candidate:e.candidate})};
    pc.ontrack=e=>{$("remoteVideo").srcObject=e.streams[0];$("callStatus").textContent="Соединено"};
    pc.onconnectionstatechange=()=>{if(["failed","disconnected","closed"].includes(pc?.connectionState))closeCall()};
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    socket.emit("call:offer",{to:callPeer,offer,type});
  }catch(e){alert("Не удалось начать звонок. Разрешите доступ к микрофону/камере.");closeCall()}
}
async function acceptCall(){
  $("incomingModal").classList.add("hidden");
  try{
    callPeer=incomingOffer.from;callType=incomingOffer.type;
    localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:callType==="video"});
    $("localVideo").srcObject=localStream;$("callTitle").textContent=callType==="video"?"Видеозвонок":"Аудиозвонок";$("callStatus").textContent="Соединение…";$("callModal").classList.remove("hidden");
    pc=new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));
    pc.onicecandidate=e=>{if(e.candidate)socket.emit("call:ice",{to:callPeer,candidate:e.candidate})};
    pc.ontrack=e=>{$("remoteVideo").srcObject=e.streams[0];$("callStatus").textContent="Соединено"};
    await pc.setRemoteDescription(incomingOffer.offer);
    for(const c of iceQueue)await pc.addIceCandidate(c).catch(()=>{});iceQueue=[];
    const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    socket.emit("call:answer",{to:callPeer,answer});
  }catch(e){socket.emit("call:rejected",{to:callPeer});closeCall()}
}
$("callAudio").onclick=()=>startCall("audio");
$("callVideo").onclick=()=>startCall("video");
$("endCall").onclick=()=>{if(callPeer)socket.emit("call:ended",{to:callPeer});closeCall()};
$("rejectCall").onclick=()=>{if(incomingOffer)socket.emit("call:rejected",{to:incomingOffer.from});closeCall()};
$("acceptCall").onclick=acceptCall;
$("muteBtn").onclick=()=>{const t=localStream?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;$("muteBtn").textContent=t.enabled?"🎙️":"🔇"}};
$("cameraBtn").onclick=()=>{const t=localStream?.getVideoTracks()[0];if(t){t.enabled=!t.enabled;$("cameraBtn").textContent=t.enabled?"📹":"🚫"}};

function logout(){localStorage.removeItem("sakuraToken");location.reload()}
$("admin").onclick=async()=>{try{let users=await api("/api/admin/users");$("adminUsers").innerHTML="";users.forEach(u=>{let r=document.createElement("div");r.className="adminRow";r.innerHTML=`<div class="avatar">${esc(u.avatar||"🌸")}</div><div class="grow"><b>${esc(u.display_name)} ${badge(u)}</b><small>@${esc(u.username)} · ${esc(u.role)}</small></div><select class="role"><option value="user">user</option><option value="admin">admin</option><option value="developer">developer</option></select><label><input class="check" type="checkbox" ${u.verified?"checked":""}> ✓</label><button class="danger">Удалить</button>`;let sel=r.querySelector("select");sel.value=u.role;sel.onchange=()=>updateUser(u.id,{role:sel.value,verified:r.querySelector(".check").checked});r.querySelector(".check").onchange=()=>updateUser(u.id,{role:sel.value,verified:r.querySelector(".check").checked});r.querySelector(".danger").onclick=async()=>{if(confirm("Удалить аккаунт?")){await api("/api/admin/users/"+u.id,{method:"DELETE"});$("admin").click()}};$("adminUsers").appendChild(r)});$("panel").classList.remove("hidden")}catch(e){alert(e.message)}};
async function updateUser(id,data){try{await api("/api/admin/users/"+id,{method:"PATCH",body:JSON.stringify(data)});loadChats()}catch(e){alert(e.message)}}
$("close").onclick=()=>$("panel").classList.add("hidden");
boot();