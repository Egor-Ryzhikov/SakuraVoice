require("dotenv").config();
const express=require("express"),http=require("http"),path=require("path"),cors=require("cors"),bcrypt=require("bcryptjs"),jwt=require("jsonwebtoken");
const {Pool}=require("pg");const {Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:process.env.CLIENT_ORIGIN||"*"}});
const PORT=Number(process.env.PORT||3000),SECRET=process.env.JWT_SECRET;
if(!SECRET) console.warn("JWT_SECRET is not set");
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false});
app.use(cors({origin:process.env.CLIENT_ORIGIN||"*"}));app.use(express.json({limit:"3mb"}));app.use(express.static(path.join(__dirname,"public")));
async function init(){await pool.query(`
CREATE TABLE IF NOT EXISTS users(
 id SERIAL PRIMARY KEY,username VARCHAR(24) UNIQUE NOT NULL,display_name VARCHAR(60) NOT NULL,
 password_hash TEXT NOT NULL,avatar VARCHAR(8) DEFAULT '🌸',role VARCHAR(20) NOT NULL DEFAULT 'user',
 verified BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ DEFAULT NOW(),last_seen TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS messages(
 id BIGSERIAL PRIMARY KEY,sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
 receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL DEFAULT '', message_type VARCHAR(10) NOT NULL DEFAULT 'text', audio_url TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW(),read_at TIMESTAMPTZ);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(10) NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
`);if(process.env.DEVELOPER_USERNAME){await pool.query("UPDATE users SET role='developer',verified=TRUE WHERE username=$1",[process.env.DEVELOPER_USERNAME.toLowerCase().replace(/^@/,"")]);}}
const clean=u=>String(u||"").trim().toLowerCase().replace(/^@/,"");
const token=u=>jwt.sign({sub:u.id,username:u.username,role:u.role},SECRET,{expiresIn:"30d"});
function auth(req,res,next){try{const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))throw 0;req.user=jwt.verify(h.slice(7),SECRET);next()}catch{res.status(401).json({error:"Требуется вход"})}}
function admin(req,res,next){if(!["developer","admin"].includes(req.user.role))return res.status(403).json({error:"Доступ только для администрации"});next()}
app.get("/api/health",async(_,res)=>{try{await pool.query("SELECT 1");res.json({ok:true})}catch{res.status(503).json({ok:false})}});
app.post("/api/auth/register",async(req,res)=>{try{let u=clean(req.body.username),d=String(req.body.displayName||u).trim(),p=String(req.body.password||"");if(!/^[a-z0-9_]{3,24}$/.test(u))return res.status(400).json({error:"Логин: 3–24 символа a-z, 0-9, _"});if(d.length<2||d.length>60)return res.status(400).json({error:"Имя должно быть 2–60 символов"});if(p.length<8)return res.status(400).json({error:"Пароль минимум 8 символов"});let h=await bcrypt.hash(p,12);let r=await pool.query("INSERT INTO users(username,display_name,password_hash) VALUES($1,$2,$3) RETURNING id,username,display_name,avatar,role,verified,last_seen",[u,d,h]);let x=r.rows[0];res.status(201).json({token:token(x),user:x})}catch(e){if(e.code==="23505")return res.status(409).json({error:"Такой логин уже занят"});console.error(e);res.status(500).json({error:"Ошибка сервера"})}});
app.post("/api/auth/login",async(req,res)=>{try{let u=clean(req.body.username),p=String(req.body.password||"");let r=await pool.query("SELECT * FROM users WHERE username=$1",[u]),x=r.rows[0];if(!x||!(await bcrypt.compare(p,x.password_hash)))return res.status(401).json({error:"Неверный логин или пароль"});await pool.query("UPDATE users SET last_seen=NOW() WHERE id=$1",[x.id]);res.json({token:token(x),user:{id:x.id,username:x.username,display_name:x.display_name,avatar:x.avatar,role:x.role,verified:x.verified,last_seen:x.last_seen}})}catch(e){console.error(e);res.status(500).json({error:"Ошибка сервера"})}});
app.get("/api/me",auth,async(req,res)=>{let r=await pool.query("SELECT id,username,display_name,avatar,role,verified,last_seen FROM users WHERE id=$1",[req.user.sub]);if(!r.rows[0])return res.status(404).json({error:"Пользователь не найден"});res.json(r.rows[0])});
app.get("/api/users",auth,async(req,res)=>{let q=String(req.query.q||"").trim().toLowerCase();let r=await pool.query("SELECT id,username,display_name,avatar,role,verified,last_seen FROM users WHERE id<>$1 AND ($2='' OR username LIKE $3 OR lower(display_name) LIKE $3) ORDER BY display_name LIMIT 30",[req.user.sub,q,`%${q}%`]);res.json(r.rows)});
app.get("/api/chats",auth,async(req,res)=>{let r=await pool.query(`SELECT u.id,u.username,u.display_name,u.avatar,u.role,u.verified,u.last_seen,m.body last_message,m.created_at last_message_at,COALESCE((SELECT COUNT(*) FROM messages x WHERE x.sender_id=u.id AND x.receiver_id=$1 AND x.read_at IS NULL),0)::int unread FROM users u LEFT JOIN LATERAL(SELECT body,created_at FROM messages WHERE(sender_id=$1 AND receiver_id=u.id)OR(sender_id=u.id AND receiver_id=$1)ORDER BY created_at DESC LIMIT 1)m ON true WHERE u.id<>$1 ORDER BY m.created_at DESC NULLS LAST,u.display_name`,[req.user.sub]);res.json(r.rows)});
app.get("/api/messages/:id",auth,async(req,res)=>{let o=Number(req.params.id);await pool.query("UPDATE messages SET read_at=NOW() WHERE sender_id=$1 AND receiver_id=$2 AND read_at IS NULL",[o,req.user.sub]);let r=await pool.query("SELECT id,sender_id,receiver_id,body,message_type,audio_url,created_at,read_at FROM messages WHERE(sender_id=$1 AND receiver_id=$2)OR(sender_id=$2 AND receiver_id=$1)ORDER BY created_at LIMIT 500",[req.user.sub,o]);res.json(r.rows)});
app.post("/api/messages",auth,async(req,res)=>{
  const to=Number(req.body.receiverId);
  const type=req.body.messageType==="audio"?"audio":"text";
  const body=String(req.body.body||"").trim();
  const audioUrl=type==="audio"?String(req.body.audioUrl||""):"";
  if(!Number.isInteger(to)||to===Number(req.user.sub)) return res.status(400).json({error:"Некорректный получатель"});
  if(type==="text" && (!body||body.length>4000)) return res.status(400).json({error:"Некорректное сообщение"});
  if(type==="audio" && (!audioUrl.startsWith("data:audio/") || audioUrl.length>2500000)) return res.status(400).json({error:"Голосовое сообщение слишком большое или имеет неверный формат"});
  const r=await pool.query(
    "INSERT INTO messages(sender_id,receiver_id,body,message_type,audio_url) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [req.user.sub,to,type,type==="text"?body:"",type==="audio"?audioUrl:null]
  );
  const m=r.rows[0];
  io.to("u:"+to).emit("message:new",m);
  io.to("u:"+req.user.sub).emit("message:new",m);
  res.status(201).json(m);
});
app.post("/api/messages/:id/read",auth,async(req,res)=>{await pool.query("UPDATE messages SET read_at=NOW() WHERE sender_id=$1 AND receiver_id=$2",[Number(req.params.id),req.user.sub]);res.json({ok:true})});
app.get("/api/admin/users",auth,admin,async(req,res)=>{let r=await pool.query("SELECT id,username,display_name,avatar,role,verified,created_at,last_seen FROM users ORDER BY id");res.json(r.rows)});
app.patch("/api/admin/users/:id",auth,admin,async(req,res)=>{let id=Number(req.params.id),role=["user","admin","developer"].includes(req.body.role)?req.body.role:"user",verified=Boolean(req.body.verified);if(id===Number(req.user.sub)&&role!=="developer")return res.status(400).json({error:"Нельзя снять собственную роль разработчика"});let r=await pool.query("UPDATE users SET role=$1,verified=$2 WHERE id=$3 RETURNING id,username,display_name,avatar,role,verified,last_seen",[role,verified,id]);if(!r.rows[0])return res.status(404).json({error:"Пользователь не найден"});res.json(r.rows[0])});
app.delete("/api/admin/users/:id",auth,admin,async(req,res)=>{let id=Number(req.params.id);if(id===Number(req.user.sub))return res.status(400).json({error:"Нельзя удалить себя"});await pool.query("DELETE FROM users WHERE id=$1",[id]);res.json({ok:true})});
io.use((s,n)=>{try{s.user=jwt.verify(s.handshake.auth.token,SECRET);n()}catch{n(new Error("unauthorized"))}});
io.on("connection",s=>{
  let id=Number(s.user.sub);
  s.join("u:"+id);
  const relay=["call:offer","call:answer","call:ice","call:incoming","call:accepted","call:rejected","call:ended"];
  relay.forEach(event=>{
    s.on(event,data=>{
      const to=Number(data?.to);
      if(!Number.isInteger(to)||to===id)return;
      io.to("u:"+to).emit(event,{...data,from:id});
    });
  });s.on("typing",d=>{let to=Number(d?.to);if(to)io.to("u:"+to).emit("typing",{from:id})});s.on("stop_typing",d=>{let to=Number(d?.to);if(to)io.to("u:"+to).emit("stop_typing",{from:id})});pool.query("UPDATE users SET last_seen=NOW() WHERE id=$1",[id]).catch(()=>{})});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
init().then(()=>server.listen(PORT,()=>console.log("Sakura Messenger online on "+PORT))).catch(e=>{console.error(e);process.exit(1)});
