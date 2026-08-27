import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import { Server } from "socket.io";

const app=express();
const server=http.createServer(app);
const PORT=Number(process.env.PORT||3000);
const SECRET=process.env.JWT_SECRET||"dev-secret-change-me";
const db=new Database("animechat.db");

db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY,
 name TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 avatar TEXT DEFAULT '',
 bio TEXT DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS friendships(
 user_id TEXT NOT NULL,
 friend_id TEXT NOT NULL,
 UNIQUE(user_id,friend_id)
);
CREATE TABLE IF NOT EXISTS rooms(
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'group',
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS room_members(
 room_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 UNIQUE(room_id,user_id)
);
CREATE TABLE IF NOT EXISTS messages(
 id TEXT PRIMARY KEY,
 room_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 text TEXT NOT NULL,
 created_at TEXT NOT NULL
);
`);

app.use(cors({origin:process.env.CORS_ORIGIN||"*"}));
app.use(express.json({limit:"4mb"}));
app.use(express.static("public"));

const hash=s=>crypto.createHash("sha256").update(String(s)).digest("hex");
const cleanName=s=>String(s||"").trim().slice(0,32);
const publicUser=u=>({id:u.id,name:u.name,avatar:u.avatar||"",bio:u.bio||""});
const makeToken=u=>jwt.sign({sub:u.id},SECRET,{expiresIn:"7d"});

function auth(req,res,next){
  try{
    const raw=(req.headers.authorization||"").replace(/^Bearer\s+/,"");
    req.auth=jwt.verify(raw,SECRET);
    next();
  }catch{res.status(401).json({error:"Требуется вход"});}
}

function ensureRoom(roomId,name,kind="group"){
  const r=db.prepare("SELECT id,name,kind FROM rooms WHERE id=?").get(roomId);
  if(r)return r;
  const now=new Date().toISOString();
  db.prepare("INSERT INTO rooms(id,name,kind,created_at) VALUES(?,?,?,?)").run(roomId,name,kind,now);
  return {id:roomId,name,kind};
}

// Default public room.
ensureRoom("lobby","🌸 Аниме-фанаты","group");

app.get("/api/health",(_,res)=>res.json({ok:true,name:"AnimeChat",version:"1.0.0"}));

app.post("/api/register",(req,res)=>{
  const name=cleanName(req.body?.name), password=String(req.body?.password||"");
  if(name.length<2||password.length<4)return res.status(400).json({error:"Имя минимум 2 символа, пароль минимум 4"});
  if(db.prepare("SELECT id FROM users WHERE name=?").get(name))return res.status(409).json({error:"Такое имя уже занято"});
  const u={id:crypto.randomUUID(),name,password_hash:hash(password),avatar:"",bio:"",created_at:new Date().toISOString()};
  db.prepare("INSERT INTO users(id,name,password_hash,avatar,bio,created_at) VALUES(?,?,?,?,?,?)").run(u.id,u.name,u.password_hash,u.avatar,u.bio,u.created_at);
  db.prepare("INSERT OR IGNORE INTO room_members(room_id,user_id) VALUES(?,?)").run("lobby",u.id);
  res.json({token:makeToken(u),user:publicUser(u)});
});

app.post("/api/login",(req,res)=>{
  const name=cleanName(req.body?.name), password=String(req.body?.password||"");
  const u=db.prepare("SELECT * FROM users WHERE name=? AND password_hash=?").get(name,hash(password));
  if(!u)return res.status(401).json({error:"Неверное имя или пароль"});
  res.json({token:makeToken(u),user:publicUser(u)});
});

app.get("/api/me",auth,(req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE id=?").get(req.auth.sub);
  if(!u)return res.status(404).json({error:"Пользователь не найден"});
  res.json({user:publicUser(u)});
});

app.patch("/api/me",auth,(req,res)=>{
  const old=db.prepare("SELECT * FROM users WHERE id=?").get(req.auth.sub);
  const name=cleanName(req.body?.name ?? old.name);
  const bio=String(req.body?.bio ?? old.bio).slice(0,240);
  const avatar=String(req.body?.avatar ?? old.avatar).slice(0,3500000);
  if(name.length<2)return res.status(400).json({error:"Имя слишком короткое"});
  try{
    db.prepare("UPDATE users SET name=?,bio=?,avatar=? WHERE id=?").run(name,bio,avatar,old.id);
  }catch{
    return res.status(409).json({error:"Такое имя уже занято"});
  }
  res.json({user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(old.id))});
});

app.get("/api/users",auth,(req,res)=>{
  const q=`%${String(req.query.q||"").trim()}%`;
  const rows=db.prepare("SELECT id,name,avatar,bio FROM users WHERE id<>? AND name LIKE ? ORDER BY name LIMIT 50").all(req.auth.sub,q);
  res.json(rows);
});

app.get("/api/friends",auth,(req,res)=>{
  res.json(db.prepare(`
    SELECT u.id,u.name,u.avatar,u.bio
    FROM friendships f JOIN users u ON u.id=f.friend_id
    WHERE f.user_id=? ORDER BY u.name
  `).all(req.auth.sub));
});

app.post("/api/friends/:id",auth,(req,res)=>{
  const id=req.params.id;
  if(id===req.auth.sub)return res.status(400).json({error:"Нельзя добавить себя"});
  if(!db.prepare("SELECT id FROM users WHERE id=?").get(id))return res.status(404).json({error:"Пользователь не найден"});
  db.prepare("INSERT OR IGNORE INTO friendships(user_id,friend_id) VALUES(?,?)").run(req.auth.sub,id);
  db.prepare("INSERT OR IGNORE INTO friendships(user_id,friend_id) VALUES(?,?)").run(id,req.auth.sub);
  res.json({ok:true});
});

app.get("/api/rooms",auth,(req,res)=>{
  const rows=db.prepare(`
    SELECT r.id,r.name,r.kind
    FROM rooms r JOIN room_members m ON m.room_id=r.id
    WHERE m.user_id=? ORDER BY r.created_at DESC
  `).all(req.auth.sub);
  res.json(rows);
});

app.post("/api/rooms",auth,(req,res)=>{
  const name=String(req.body?.name||"Новая группа").trim().slice(0,80);
  if(!name)return res.status(400).json({error:"Введите название"});
  const id=crypto.randomUUID();
  db.prepare("INSERT INTO rooms(id,name,kind,created_at) VALUES(?,?,?,?)").run(id,name,"group",new Date().toISOString());
  db.prepare("INSERT INTO room_members(room_id,user_id) VALUES(?,?)").run(id,req.auth.sub);
  for(const member of Array.isArray(req.body?.members)?req.body.members:[]){
    if(member!==req.auth.sub && db.prepare("SELECT id FROM users WHERE id=?").get(member))
      db.prepare("INSERT OR IGNORE INTO room_members(room_id,user_id) VALUES(?,?)").run(id,member);
  }
  res.json({room:{id,name,kind:"group"}});
});

app.post("/api/dm/:friendId",auth,(req,res)=>{
  const friend=req.params.friendId;
  if(!db.prepare("SELECT id FROM users WHERE id=?").get(friend))return res.status(404).json({error:"Пользователь не найден"});
  const ids=[req.auth.sub,friend].sort();
  const id="dm-"+ids.join("-");
  const a=db.prepare("SELECT name FROM users WHERE id=?").get(req.auth.sub);
  const b=db.prepare("SELECT name FROM users WHERE id=?").get(friend);
  ensureRoom(id,`${a.name} • ${b.name}`,"dm");
  db.prepare("INSERT OR IGNORE INTO room_members(room_id,user_id) VALUES(?,?)").run(id,req.auth.sub);
  db.prepare("INSERT OR IGNORE INTO room_members(room_id,user_id) VALUES(?,?)").run(id,friend);
  res.json({room:{id,name:`${a.name} • ${b.name}`,kind:"dm"}});
});

app.post("/api/rooms/:id/members",auth,(req,res)=>{
  const room=req.params.id, userId=String(req.body?.userId||"");
  const isMember=db.prepare("SELECT 1 FROM room_members WHERE room_id=? AND user_id=?").get(room,req.auth.sub);
  if(!isMember)return res.status(403).json({error:"Нет доступа"});
  if(!db.prepare("SELECT id FROM users WHERE id=?").get(userId))return res.status(404).json({error:"Пользователь не найден"});
  db.prepare("INSERT OR IGNORE INTO room_members(room_id,user_id) VALUES(?,?)").run(room,userId);
  res.json({ok:true});
});

app.get("/api/rooms/:id/messages",auth,(req,res)=>{
  const room=req.params.id;
  if(!db.prepare("SELECT 1 FROM room_members WHERE room_id=? AND user_id=?").get(room,req.auth.sub))
    return res.status(403).json({error:"Нет доступа"});
  const rows=db.prepare(`
    SELECT m.id,m.text,m.created_at createdAt,m.user_id userId,u.name,u.avatar
    FROM messages m JOIN users u ON u.id=m.user_id
    WHERE m.room_id=? ORDER BY m.created_at DESC LIMIT 100
  `).all(room);
  res.json(rows.reverse());
});

app.get("/api/webrtc-config",auth,(_,res)=>{
  const ice=[{urls:"stun:stun.l.google.com:19302"}];
  if(process.env.TURN_URL)ice.push({
    urls:process.env.TURN_URL,
    username:process.env.TURN_USERNAME||"",
    credential:process.env.TURN_CREDENTIAL||""
  });
  res.json({iceServers:ice});
});

const io=new Server(server,{cors:{origin:process.env.CORS_ORIGIN||"*"}});
io.use((socket,next)=>{
  try{
    socket.user=jwt.verify(socket.handshake.auth?.token||"",SECRET);
    next();
  }catch{next(new Error("auth failed"));}
});

const online=new Map();

io.on("connection",socket=>{
  const uid=socket.user.sub;
  online.set(uid,(online.get(uid)||0)+1);
  io.emit("presence",{userId:uid,online:true});

  socket.on("room:join",room=>{
    if(db.prepare("SELECT 1 FROM room_members WHERE room_id=? AND user_id=?").get(room,uid))
      socket.join("room:"+room);
  });

  socket.on("chat:message",({room,text})=>{
    const allowed=db.prepare("SELECT 1 FROM room_members WHERE room_id=? AND user_id=?").get(room,uid);
    const clean=String(text||"").trim().slice(0,4000);
    if(!allowed||!clean)return;
    const id=crypto.randomUUID(),createdAt=new Date().toISOString();
    db.prepare("INSERT INTO messages(id,room_id,user_id,text,created_at) VALUES(?,?,?,?,?)").run(id,room,uid,clean,createdAt);
    const u=db.prepare("SELECT name,avatar FROM users WHERE id=?").get(uid);
    io.to("room:"+room).emit("chat:message",{id,roomId:room,userId:uid,text:clean,createdAt,name:u.name,avatar:u.avatar});
  });

  // WebRTC signaling. Audio/video never passes through this Node server.
  socket.on("call:join",room=>{
    if(!db.prepare("SELECT 1 FROM room_members WHERE room_id=? AND user_id=?").get(room,uid))return;
    socket.join("call:"+room);
    const peers=[...(io.sockets.adapter.rooms.get("call:"+room)||[])]
      .filter(s=>s!==socket.id)
      .map(s=>({socketId:s,userId:io.sockets.sockets.get(s)?.user?.sub}));
    socket.emit("call:peers",peers);
    socket.to("call:"+room).emit("call:user-joined",{socketId:socket.id,userId:uid});
  });
  socket.on("call:offer",({target,offer})=>io.to(target).emit("call:offer",{from:socket.id,offer}));
  socket.on("call:answer",({target,answer})=>io.to(target).emit("call:answer",{from:socket.id,answer}));
  socket.on("call:ice",({target,candidate})=>io.to(target).emit("call:ice",{from:socket.id,candidate}));
  socket.on("call:leave",room=>{
    socket.to("call:"+room).emit("call:user-left",{socketId:socket.id});
    socket.leave("call:"+room);
  });

  socket.on("disconnect",()=>{
    for(const [r,sockets] of io.sockets.adapter.rooms){
      if(r.startsWith("call:") && sockets.has(socket.id))
        socket.to(r).emit("call:user-left",{socketId:socket.id});
    }
    const n=(online.get(uid)||1)-1;
    if(n<=0){online.delete(uid);io.emit("presence",{userId:uid,online:false});}
    else online.set(uid,n);
  });
});

server.listen(PORT,()=>console.log(`AnimeChat: http://localhost:${PORT}`));