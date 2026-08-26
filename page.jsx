import Link from "next/link";
import {Search, Play, Star, Volume2, Bell, UserRound, ChevronRight} from "lucide-react";

const items=[
 ["Игра Дарвина","2020","12 серий","Экшен • Триллер","8.6","https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80"],
 ["Идеальный муж и Часть 2","2017","13 серий","Романтика • Комедия","8.1","https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80"],
 ["Сказание о демонах и богах","2024","154 серии","Фэнтези • Экшен","9.0","https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80"],
 ["Клинок мастера","2023","24 серии","Экшен • Фэнтези","8.8","https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=600&q=80"]
];

function Header(){
 return <><div className="cover"><div className="cover-art"></div></div><header><div className="head"><div className="logo">YA</div><div><b>Yummy Anime</b><small>YA ◆ anime</small></div><nav><Link href="/">ГЛАВНАЯ</Link><Link href="/catalog">КАТАЛОГ</Link><Link href="/catalog">ТОП-100</Link><Link href="/watch">СЛУЧАЙНОЕ</Link><Link href="/profile">СООБЩЕСТВО</Link><Link href="/watch">ВИДЕО</Link><Link href="/catalog">ПОМОЩЬ</Link></nav><div className="account"><span>♡</span><span>✉</span><span>☰</span></div></div></header></>
}
function SearchBar(){return <div className="searchbar"><Search size={18}/><input placeholder="НАЙТИ АНИМЕ ПО НАЗВАНИЮ"/></div>}
function AnimeCard({a}){return <article className="anime-card"><div className="thumb"><img src={a[5]} alt=""/><div className="score"><Star size={12} fill="currentColor"/> {a[4]}</div></div><div className="card-body"><Link href="/watch"><h3>{a[0]} ({a[1]})</h3></Link><p><b>Статус:</b> <i>Завершён</i></p><p><b>Тип:</b> TV • Серий: {a[2].replace(" серий","")}</p><p><b>Жанр:</b> {a[3]}</p><div className="voice"><Volume2 size={12}/> Русская озвучка</div></div></article>}

export default function Home(){
 return <><Header/><main><SearchBar/>
 <section className="slider"><div className="slider-copy"><span>ПРЕМЬЕРА</span><h1>Аниме с русской<br/>озвучкой онлайн</h1><p>Новые серии, популярные тайтлы и удобный просмотр в одном месте.</p><Link className="red-btn" href="/watch"><Play size={15} fill="currentColor"/> СМОТРЕТЬ</Link></div><div className="slider-image"></div></section>
 <div className="columns"><section><div className="bar"><b>ОБНОВЛЕНИЯ АНИМЕ</b><a>Все серии →</a></div><div className="feed">{items.map((a,i)=><div className="feed-row" key={i}><span>Пн 12:2{i}</span><img src={a[5]}/><Link href="/watch">{a[0]} — Добавлена {i+1} серия</Link></div>)}</div></section><aside><div className="bar"><b>НОВОСТИ</b><a>Все новости</a></div>{["Новые аниме сезона уже доступны","Большое обновление каталога","Премьеры недели","Новости сообщества","Новые серии популярных тайтлов"].map((x,i)=><p className="news" key={i}>{x}<small>12.08.2026</small></p>)}</aside></div>
 <section><div className="bar"><b>ПОПУЛЯРНОЕ В ПРОСМОТРЕ</b><a>Все аниме →</a></div><div className="wide-grid">{items.slice(0,3).map((a,i)=><Link href="/watch" className="wide" key={i}><img src={a[5]}/><strong>{a[0]}</strong><span>⭐ {a[4]} • 🎙 Озвучка</span></Link>)}</div></section>
 <div className="bar"><b>ПОСЛЕДНИЕ СЕРИИ</b><a>Каталог →</a></div><div className="catalog-home">{items.map((a,i)=><AnimeCard key={i} a={a}/>)}</div>
 </main><footer>YUMMY ANIME • Демонстрационный интерфейс. Для публикации используй только контент, изображения и видеоматериалы, на которые у тебя есть права.</footer></>
}