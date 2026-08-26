const items=[
 {t:"Ночные хроники",g:"Фэнтези",d:"Тайны города после заката",c:"radial-gradient(circle at 70% 20%,#ef79ff,transparent 20%),linear-gradient(135deg,#27124b,#141a39)"},
 {t:"Неоновый рейд",g:"Экшен",d:"Команда в городе будущего",c:"radial-gradient(circle at 30% 30%,#54b7ff,transparent 20%),linear-gradient(135deg,#102f55,#261238)"},
 {t:"Лунный сад",g:"Романтика",d:"История под светом луны",c:"radial-gradient(circle at 65% 25%,#ffd06b,transparent 18%),linear-radient(135deg,#22275d,#3c174c)"},
 {t:"Шёпот океана",g:"Приключения",d:"Путь к неизвестным островам",c:"radial-gradient(circle at 30% 30%,#62e4ff,transparent 18%),linear-gradient(135deg,#0b4260,#101b3d)"},
 {t:"Академия звёзд",g:"Школа",d:"Новая глава для необычных учеников",c:"radial-gradient(circle at 75% 20%,#ff8ac4,transparent 18%),linear-gradient(135deg,#39204d,#17162f)"},
 {t:"Стальной ветер",g:"Фантастика",d:"Механизмы и тайны прошлого",c:"radial-gradient(circle at 30% 20%,#a9c7ff,transparent 16%),linear-gradient(135deg,#273244,#11131e)"},
 {t:"Последний фонарь",g:"Драма",d:"Маленький город и большие решения",c:"radial-gradient(circle at 50% 25%,#ffb46b,transparent 18%),linear-gradient(135deg,#45231b,#151422)"},
 {t:"Код рассвета",g:"Триллер",d:"Загадка, которую нельзя оставить",c:"radial-gradient(circle at 70% 30%,#75ffb0,transparent 18%),linear-gradient(135deg,#123b37,#15152b)"}
];
const cards=document.querySelector("#cards"),empty=document.querySelector("#empty"),search=document.querySelector("#search"),filters=document.querySelector("#filters");
const genres=["Все",...new Set(items.map(x=>x.g))]; let genre="Все";
filters.innerHTML=genres.map(x=>`<button class="filter ${x==="Все"?"active":""}" data-g="${x}">${x}</button>`).join("");
filters.onclick=e=>{if(!e.target.matches(".filter"))return;genre=e.target.dataset.g;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));e.target.classList.add("active");render()};
search.oninput=render;
function render(){const q=search.value.toLowerCase();const list=items.filter(x=>(genre==="Все"||x.g===genre)&&(x.t+" "+x.g+" "+x.d).toLowerCase().includes(q));cards.innerHTML=list.map(x=>`<article class="card"><div class="card-art" style="--art:${x.c}"></div><div class="card-body"><span class="tag">${x.g}</span><h3>${x.t}</h3><p>${x.d}</p></div></article>`).join("");empty.style.display=list.length?"none":"block"}render();

const synth=window.speechSynthesis,voice=document.querySelector("#voice"),text=document.querySelector("#text"),rate=document.querySelector("#rate"),pitch=document.querySelector("#pitch"),status=document.querySelector("#status"),bar=document.querySelector("#progressBar");
function loadVoices(){const vs=synth.getVoices();voice.innerHTML=vs.length?vs.map((v,i)=>`<option value="${i}">${v.name} — ${v.lang}</option>`).join(""):`<option>Голоса браузера не найдены</option>`}loadVoices();if("onvoiceschanged"in synth)synth.onvoiceschanged=loadVoices;
rate.oninput=()=>document.querySelector("#rateVal").textContent=rate.value+"×";pitch.oninput=()=>document.querySelector("#pitchVal").textContent=pitch.value;
document.querySelector("#speak").onclick=()=>{if(!text.value.trim()){status.textContent="Сначала введи текст.";return}synth.cancel();const u=new SpeechSynthesisUtterance(text.value),vs=synth.getVoices();u.voice=vs[Number(voice.value)]||null;u.rate=Number(rate.value);u.pitch=Number(pitch.value);u.onstart=()=>{status.textContent="Озвучка идёт…";bar.style.width="25%"};u.onend=()=>{status.textContent="Готово.";bar.style.width="100%";setTimeout(()=>bar.style.width="0",500)};u.onerror=()=>{status.textContent="Браузер не смог запустить озвучку.";bar.style.width="0"};synth.speak(u)};
document.querySelector("#pause").onclick=()=>{if(synth.paused){synth.resume();status.textContent="Продолжено."}else if(synth.speaking){synth.pause();status.textContent="Пауза."}};
document.querySelector("#stop").onclick=()=>{synth.cancel();bar.style.width="0";status.textContent="Остановлено."};
document.querySelector("#clear").onclick=()=>{text.value="";status.textContent="Поле очищено."};
document.querySelector("#themeBtn").onclick=()=>{document.body.classList.toggle("light");status.textContent="Тема переключена (демо)."};
