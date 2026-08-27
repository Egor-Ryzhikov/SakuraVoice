let token=localStorage.getItem("animeToken"),user=JSON.parse(localStorage.getItem("animeUser")||"null");
let socket,room="lobby",stream,rtcConfig={iceServers:[{urls:"stun:stun.l.google.com:19302"}]};
const peers=new Map(),online=new Set(),$=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path,opt={}){opt.headers={...(opt.headers||{}),Authorization:"Bearer "+token};if(opt.body&&!opt.headers["Content-Type"])opt.headers["Content-Type"]="application/json";const r=await fetch(path,opt),d=await r.json();if(!r.ok)throw Error(d.error||"Ошибка");return d}
async function auth(mode){try{const r=await fetch("/api/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:$("name").value,password:$("pass").value})}),d=await r.json();if(!r.ok)throw Error(d.error);token=d.token;user=d.user;localStorage.setItem("animeToken",token);localStorage.setItem("animeUser",JSON.stringify(user));boot()}catch(e){$("error").textContent=e.message}}
async function boot(){try{user=(await api("/api/me")).user;localStorage.setItem("animeUser",JSON.stringify(user));$("auth").classList.add("hidden");$("app").classList.remove("hidden");$("me").textContent="👤 "+user.name;socket=io({auth:{token}});socket.on("presence",p=>{p.online?online.add(p.userId):online.delete(p.userId);});socket.on("chat:message",m=>{if(m.roomId===room)addMessage(m)});socket.on("connect",()=>joinRoom(room));await loadRooms()}catch{localStorage.clear();location.reload()}}
async function loadRooms(){const rooms=await api("/api/rooms");$("sideList").innerHTML="<h3>Чаты</h3>"+rooms.map(r=>`<div class="room" onclick="openRoom('${r.id}','${esc(r.name)}')">💬 ${esc(r.name)}</div>`).join("");if(rooms.some(r=>r.id===room))await openRoom(room,rooms.find(r=>r.id===room).name);else await openRoom("lobby","🌸 Аниме-фанаты")}
async function openRoom(id,name){room=id;$("roomTitle").textContent=name;joinRoom(id);$("messages").innerHTML="";try{const a=await api("/api/rooms/"+encodeURIComponent(id)+"/messages");a.forEach(addMessage)}catch{}}
function joinRoom(r){if(socket)socket.emit("room:join",r)}
function addMessage(m){const d=document.createElement("div");d.className="m"+(m.userId===user.id?" mine":"");const t=new Date(m.createdAt||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});d.innerHTML="<b>"+esc(m.name||m.userId)+"</b><br>"+esc(m.text)+"<time>"+t+"</time>";$("messages").appendChild(d);$("messages").scrollTop=$("messages").scrollHeight}
function send(e){e.preventDefault();const t=$("msg").value.trim();if(t&&socket){socket.emit("chat:message",{room,text:t});$("msg").value=""}}
function sticker(s){$("msg").value+=s;$("msg").focus()}
async function showFriends(){const a=await api("/api/friends");$("sideList").innerHTML="<h3>👥 Друзья</h3>"+a.map(x=>`<div class="person">💜 ${esc(x.name)} <button onclick="dm('${x.id}')">💬</button></div>`).join("")}
async function showUsers(){const a=await api("/api/users?q=");$("sideList").innerHTML="<h3>🔎 Люди</h3>"+a.map(x=>`<div class="person">✨ ${esc(x.name)} <button onclick="friend('${x.id}')">+</button></div>`).join("")}
async function friend(id){await api("/api/friends/"+id,{method:"POST"});showFriends()}
async function dm(id){const d=await api("/api/dm/"+id,{method:"POST"});await openRoom(d.room.id,d.room.name)}
async function createGroup(){const name=prompt("Название группы:");if(!name)return;const d=await api("/api/rooms",{method:"POST",body:JSON.stringify({name})});await loadRooms();await openRoom(d.room.id,d.room.name)}
async function editProfile(){const name=prompt("Имя:",user.name);if(!name)return;const bio=prompt("О себе:",user.bio||"")??user.bio;const d=await api("/api/me",{method:"PATCH",body:JSON.stringify({name,bio})});user=d.user;localStorage.setItem("animeUser",JSON.stringify(user));$("me").textContent="👤 "+user.name}
async function startCall(video){try{if(!socket)return;const cfg=await api("/api/webrtc-config");rtcConfig=cfg;$("call").classList.remove("hidden");$("callStatus").textContent="Подключение…";stream=await navigator.mediaDevices.getUserMedia({audio:true,video});$("local").srcObject=stream;socket.emit("call:join",room);$("callStatus").textContent=video?"Видеозвонок":"Голосовой звонок"}catch(e){$("callStatus").textContent="Не удалось получить камеру/микрофон: "+e.message}}
socket.on("call:peers",async list=>{for(const p of list)await makePeer(p.socketId,true)});
socket.on("call:user-joined",p=>makePeer(p.socketId,false));
async function makePeer(target,initiator){if(peers.has(target))return peers.get(target);const pc=new RTCPeerConnection(rtcConfig);peers.set(target,pc);stream?.getTracks().forEach(t=>pc.addTrack(t,stream));pc.onicecandidate=e=>e.candidate&&socket.emit("call:ice",{target,candidate:e.candidate});pc.ontrack=e=>{let v=$("v-"+target);if(!v){v=document.createElement("video");v.id="v-"+target;v.autoplay=true;v.playsInline=true;$("remotes").appendChild(v)}v.srcObject=e.streams[0]};pc.onconnectionstatechange=()=>{if(["failed","closed"].includes(pc.connectionState))removePeer(target)};if(initiator){const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("call:offer",{target,offer})}return pc}
socket.on("call:offer",async({from,offer})=>{const pc=await makePeer(from,false);await pc.setRemoteDescription(offer);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);socket.emit("call:answer",{target:from,answer})});
socket.on("call:answer",async({from,answer})=>{const pc=peers.get(from);if(pc)await pc.setRemoteDescription(answer)});
socket.on("call:ice",async({from,candidate})=>{const pc=peers.get(from);if(pc)try{await pc.addIceCandidate(candidate)}catch{}});
socket.on("call:user-left",({socketId})=>removePeer(socketId));
function removePeer(id){peers.get(id)?.close();peers.delete(id);$("v-"+id)?.remove()}
function toggleMic(){const t=stream?.getAudioTracks()[0];if(t)t.enabled=!t.enabled}
function toggleCam(){const t=stream?.getVideoTracks()[0];if(t)t.enabled=!t.enabled}
function hangup(){for(const [id] of peers)removePeer(id);stream?.getTracks().forEach(t=>t.stop());stream=null;if(socket)socket.emit("call:leave",room);$("call").classList.add("hidden")}
window.addEventListener("beforeunload",hangup);
if(token&&user)boot();