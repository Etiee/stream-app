import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Info, Search, X, ChevronRight, ChevronLeft, Clock, Bookmark,
  Settings, Monitor, Film, ArrowLeft, Trash2, LayoutGrid, User, Dribbble,
  Server, Maximize, Minimize, VolumeX, Volume2, RefreshCw, Square, LogOut,
  Sidebar, AlertCircle, Eye, EyeOff, Mail, Lock, History, SkipForward, TrendingUp,
  Timer, CalendarDays, SortAsc, Filter, PictureInPicture, Subtitles
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInWithCustomToken
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// ─── FIREBASE ────────────────────────────────────────────────────────────────
let firebaseConfig = {};
let fallbackAppId = 'default-app-id';
try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  } else if (typeof import.meta !== 'undefined' && import.meta.env) {
    firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    fallbackAppId = import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id';
  }
} catch (e) { console.warn('Could not load Firebase config'); }

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : fallbackAppId;

// ─── SYSTEM CONFIG ───────────────────────────────────────────────────────────
const GUEST_ACCESS_CODE = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GUEST_CODE ? import.meta.env.VITE_GUEST_CODE : 'Streamonator Password 60000';
const BASE      = 'https://api.themoviedb.org/3';
const IMG       = 'https://image.tmdb.org/t/p/';
const INTRODB   = 'https://api.theintrodb.org/v2';
const DEFAULT_TMDB = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TMDB_KEY ? import.meta.env.VITE_TMDB_KEY : '9517f4751d84886b184cb4a4849e9f91';
const DEFAULT_OMDB = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OMDB_KEY ? import.meta.env.VITE_OMDB_KEY : '93a6d7d6';
const DEFAULT_CC = { size:'1.1rem', bg:'rgba(0,0,0,0.82)', color:'#fff', font:'system-ui,sans-serif', edge:'dropshadow' };
const DEFAULT_VP = { autoNext:true, episodeList:true };
const DEFAULT_SK = { enabled:true, showIntro:true, showRecap:true, showCredits:true, showPreview:false, autoSkip:false, buttonDuration:7 };
const DEFAULT_SETTINGS = {
  apiKey:DEFAULT_TMDB, omdbKey:DEFAULT_OMDB, sourceKey:'videasy',
  algoPrefs:{excluded:[],boosted:[]}, cc:DEFAULT_CC, vp:DEFAULT_VP, skip:DEFAULT_SK,
};

// ─── SOURCES ─────────────────────────────────────────────────────────────────
const SOURCES = {
  videasy: {
    name: 'Videasy',
    url: (t, id, s, e) => t === 'tv'
      ? `https://player.videasy.net/tv/${id}/${s}/${e}?color=F5F5F7&nextEpisode=true&autoplayNextEpisode=false&episodeSelector=true&overlay=true&autoplay=true`
      : `https://player.videasy.net/movie/${id}?color=F5F5F7&overlay=true&autoplay=true`
  },
};

// ─── LIVE TV CHANNELS ────────────────────────────────────────────────────────
const LIVE_CH = [
  { id:'l_cnn',    name:'CNN',           cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg',                                                                                                                     url:'https://turnerlive.warnermediacdn.com/hls/live/586495/cnngo/cnn_slate/VIDEO_0_3564000.m3u8' },
  { id:'l_cbs',    name:'CBS News',      cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/2/2e/CBS_News_2020_%28Stacked_II%29.svg',                                                                                          url:'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8' },
  { id:'l_fox',    name:'Fox News',      cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/6/67/Fox_News_Channel_logo.svg',                                                                                                   url:'https://stream.livenewsplay.com:9555/hls/foxnewssd/index.m3u8?token=438097d01370fd77d1f642d0c9492f41&expires=1772883456&sig=f85beda0fcbbca7bd35ff9bef12a5f77a395d18ccc89d4cf7b3576e616443c2c' },
  { id:'l_nbc',    name:'NBC News',      cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NBC_logo.svg/1280px-NBC_logo.svg.png',                                                                                  url:'https://d1bl6tskrpq9ze.cloudfront.net/hls/master.m3u8?ads.xumo_channelId=99984003' },
  { id:'l_abc',    name:'ABC News',      cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/ABC_News_logo_2021.svg/1280px-ABC_News_logo_2021.svg.png',                                                              url:'https://aegis-cloudfront-1.tubi.video/d6cbb0de-68e4-4f3b-82f9-bf5d526e0bde/index.m3u8' },
  { id:'l_gbl',    name:'Global News',   cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Global_News.svg/1280px-Global_News.svg.png',                                                                            url:'https://live.corusdigitaldev.com/groupd/live/49a91e7f-1023-430f-8d66-561055f3d0f7/live.isml/.m3u8' },
  { id:'l_cpac',   name:'CPAC',          cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/1/17/CPAC_logo_black_color.png',                                                                                                   url:'', type:'youtube', ytChannelId:'UCiGdXn0NhyZ7X8GFkQwsQ7Q' },
  { id:'l_cbc',    name:'CBC News',      cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/CBC_News_Logo.svg/960px-CBC_News_Logo.svg.png',                                                                         url:'https://amg00788-cbc-amg00788c4-xumo-us-3045.playouts.now.amagi.tv/master.m3u8' },
  { id:'l_cbcnat', name:'CBC National',  cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/CBC_News_Logo.svg/960px-CBC_News_Logo.svg.png',                                                                         url:'https://cbcrclinear-tor.akamaized.net/hls/live/2042769/geo_allow_ca/CBCRCLINEAR_TOR_15/master5.m3u8' },
  { id:'l_city',   name:'CityNews',      cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/CityNews_logo.svg/960px-CityNews_logo.svg.png',                                                                         url:'https://citynewsregional.akamaized.net/hls/live/1024053/Regional_Live_8/master.m3u8' },
  { id:'l_msnow',  name:'MS NOW',        cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/MS_NOW_logo.svg/500px-MS_NOW_logo.svg.png',                                                                             url:'https://cdn.livenewsplayer.com/hls/msnbcsd/msnbcsd/playlist.m3u8?newzstarttime=1774664019&newzendtime=1774671219&newzhash=IbezTiU2SD07J9mpNPCApt3IWvb9wcUendK7y2581hI5Xe4FxZrhQfX1mHBc6bs3iKtar8MPSa5qGDLZ42ojKw==' },
  { id:'l_bbc',    name:'BBC News',      cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/BBC_News_2022_%28Alt%29.svg/1280px-BBC_News_2022_%28Alt%29.svg.png',                                                    url:'https://dash2.antik.sk/live/test_bbc_world/playlist.m3u8' },
  { id:'l_cnbc',   name:'CNBC',          cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/e/e3/CNBC_logo.svg',                                                                                                               url:'https://stream.livenewsplay.com:9443/hls/cnbc/cnbcsd.m3u8' },
  { id:'l_blm',    name:'Bloomberg',     cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/5/5d/New_Bloomberg_Logo.svg',                                                                                                      url:'https://cdn4.skygo.mn/live/disk1/Bloomberg/HLSv3-FTA/Bloomberg.m3u8' },
  { id:'l_reu',    name:'Reuters',       cat:'News', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Reuters_logo_2024.svg/1280px-Reuters_logo_2024.svg.png',                                                                url:'https://amg00453-reuters-amg00453c1-plex-us-2106.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-plexus/playlist.m3u8' },
];

// ─── GENRES ──────────────────────────────────────────────────────────────────
const GENRES = {
  movie:[{id:28,name:'Action'},{id:12,name:'Adventure'},{id:16,name:'Animation'},{id:35,name:'Comedy'},{id:80,name:'Crime'},{id:99,name:'Documentary'},{id:18,name:'Drama'},{id:10751,name:'Family'},{id:14,name:'Fantasy'},{id:27,name:'Horror'},{id:878,name:'Sci-Fi'},{id:53,name:'Thriller'},{id:10752,name:'War'},{id:37,name:'Western'}],
  tv:   [{id:10759,name:'Action & Adventure'},{id:16,name:'Animation'},{id:35,name:'Comedy'},{id:80,name:'Crime'},{id:99,name:'Documentary'},{id:18,name:'Drama'},{id:10765,name:'Sci-Fi & Fantasy'},{id:10767,name:'Talk'},{id:10768,name:'War & Politics'}],
};
const ALL_GENRES=[];[...GENRES.movie,...GENRES.tv].forEach(g=>{if(!ALL_GENRES.some(u=>u.name===g.name))ALL_GENRES.push(g);});ALL_GENRES.sort((a,b)=>a.name.localeCompare(b.name));

// ─── UTILS ───────────────────────────────────────────────────────────────────
const cache=new Map(),pending=new Map();
const fetch2=async url=>{
  const h=cache.get(url);if(h&&Date.now()-h.t<300000)return h.d;
  if(pending.has(url))return pending.get(url);
  const p=fetch(url).then(r=>r.json()).then(d=>{if(cache.size>500)cache.delete(cache.keys().next().value);cache.set(url,{d,t:Date.now()});pending.delete(url);return d;}).catch(e=>{pending.delete(url);throw e;});
  pending.set(url,p);return p;
};
let _sl=0;
const lock=()=>{_sl++;document.body.style.overflow='hidden';};
const unlock=()=>{_sl=Math.max(_sl-1,0);if(!_sl)document.body.style.overflow='';};
const cn=(...c)=>c.filter(Boolean).join(' ');
const fmtYear=d=>(d||'').slice(0,4);
const fmtDate=d=>d?new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
const fmtDT=d=>d?new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
const fmtDuration=s=>{if(!s||s<60)return s>0?`${s}s`:'';const m=Math.floor(s/60);if(m<60)return`${m}m`;return`${Math.floor(m/60)}h ${m%60}m`;};
const loadHls=cb=>{if(window.Hls){cb();return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/hls.js@latest';s.onload=cb;document.body.appendChild(s);};
const initHls=(vid,src,main,cb)=>{
  if(!window.Hls)return null;
  if(window.Hls.isSupported()){
    const h=new window.Hls({
      maxMaxBufferLength: main ? 30 : 10,
      capLevelToPlayerSize: true,
      enableWorker: true
    });
    h.loadSource(src);
    h.attachMedia(vid);
    if(cb.onParsed)h.on(window.Hls.Events.MANIFEST_PARSED,cb.onParsed);
    if(cb.onError)h.on(window.Hls.Events.ERROR,cb.onError);
    return h;
  }else if(vid.canPlayType('application/vnd.apple.mpegurl')){
    vid.src=src;
    if(cb.onParsed)vid.addEventListener('loadedmetadata',cb.onParsed);
  }
  return null;
};

const groupByDate = (items) => {
  const groups = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
  const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth()-1);
  const buckets = { 'Today':[], 'Yesterday':[], 'This Week':[], 'This Month':[], 'Earlier':[] };
  items.forEach(item => {
    const d = new Date(item.watchedAt); d.setHours(0,0,0,0);
    if (d >= today) buckets['Today'].push(item);
    else if (d >= yesterday) buckets['Yesterday'].push(item);
    else if (d >= weekAgo) buckets['This Week'].push(item);
    else if (d >= monthAgo) buckets['This Month'].push(item);
    else buckets['Earlier'].push(item);
  });
  Object.entries(buckets).forEach(([label, items]) => { if (items.length) groups.push({ label, items }); });
  return groups;
};

// ─── HOOKS ───────────────────────────────────────────────────────────────────
const useLS=(k,d)=>{
  const[v,sv]=useState(()=>{try{const i=localStorage.getItem(k);return i?JSON.parse(i):d;}catch{return d;}});
  const set=useCallback(n=>{
    sv(prev=>{
      try{
        const s=n instanceof Function?n(prev):n;
        localStorage.setItem(k,JSON.stringify(s));
        return s;
      }catch{return prev;}
    });
  },[k]);
  return[v,set];
};
const useDebounce=(v,ms)=>{const[d,setD]=useState(v);useEffect(()=>{const t=setTimeout(()=>setD(v),ms);return()=>clearTimeout(t);},[v,ms]);return d;};

// ─── USER DATA HOOK ──────────────────────────────────────────────────────────
const useUserData=(uid,isGuest)=>{
  const pfx=`ud_${uid||'g'}`;
  const store=isGuest?sessionStorage:localStorage;
  const timers=useRef({});const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const[settings,setS]=useState(()=>{try{const v=store.getItem(`${pfx}_s`);return v?{...DEFAULT_SETTINGS,...JSON.parse(v)}:DEFAULT_SETTINGS;}catch{return DEFAULT_SETTINGS;}});
  const[history,setH]=useState(()=>{try{const v=store.getItem(`${pfx}_h`);return v?JSON.parse(v):[];}catch{return[];}});
  const[watchlist,setW]=useState(()=>{try{const v=store.getItem(`${pfx}_w`);return v?JSON.parse(v):[];}catch{return[];}});
  const[loaded,setLoaded]=useState(false);
  useEffect(()=>{
    if(!uid||isGuest){setLoaded(true);return;}
    let ok=true;
    (async()=>{
      try{
        const[sd,hd,wd]=await Promise.all([
          getDoc(doc(db,'artifacts',appId,'users',uid,'data','settings')),
          getDoc(doc(db,'artifacts',appId,'users',uid,'data','history')),
          getDoc(doc(db,'artifacts',appId,'users',uid,'data','watchlist'))
        ]);
        if(!ok)return;
        if(sd.exists()){const v={...DEFAULT_SETTINGS,...sd.data()};setS(v);localStorage.setItem(`${pfx}_s`,JSON.stringify(v));}
        if(hd.exists()){const v=hd.data().items||[];setH(v);localStorage.setItem(`${pfx}_h`,JSON.stringify(v));}
        if(wd.exists()){const v=wd.data().items||[];setW(v);localStorage.setItem(`${pfx}_w`,JSON.stringify(v));}
      }catch(e){console.error(e);}
      if(ok)setLoaded(true);
    })();
    return()=>{ok=false;};
  },[uid,isGuest,pfx]);
  const save=(key,getData)=>{
    if(!uid||isGuest)return;
    clearTimeout(timers.current[key]);
    timers.current[key]=setTimeout(async()=>{try{const v=getData();await setDoc(doc(db,'artifacts',appId,'users',uid,'data',key),key==='settings'?v:{items:v});}catch(e){console.error(e);}},1500);
  };
  const saveSettings=useCallback(val=>{const n=val instanceof Function?val(settings):val;setS(n);store.setItem(`${pfx}_s`,JSON.stringify(n));save('settings',()=>n);},[settings,pfx]);
  const saveHistory=useCallback(val=>{const n=val instanceof Function?val(history):val;setH(n);store.setItem(`${pfx}_h`,JSON.stringify(n));save('history',()=>n);},[history,pfx]);
  const saveWatchlist=useCallback(val=>{const n=val instanceof Function?val(watchlist):val;setW(n);store.setItem(`${pfx}_w`,JSON.stringify(n));save('watchlist',()=>n);},[watchlist,pfx]);
  return{settings,saveSettings,history,saveHistory,watchlist,saveWatchlist,loaded};
};

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
const G=()=>(
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
    ::-webkit-scrollbar{display:none;}*{-ms-overflow-style:none;scrollbar-width:none;}
    body{background:#000;color:#f5f5f7;font-family:'Outfit',sans-serif;-webkit-font-smoothing:antialiased;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
    @keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
    @keyframes pulse3{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .au{animation:fadeUp .6s cubic-bezier(0.16,1,0.3,1) both;}
    .as{animation:scaleIn .5s cubic-bezier(0.16,1,0.3,1) both;}
    .sk{background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.03) 75%);background-size:400% 100%;animation:shimmer 1.8s infinite;}
    .lp{animation:pulse3 1.5s ease-in-out infinite;}
    .sp{animation:spin 1s linear infinite;}
    .rank-number text{font-family:'Arial Black',Impact,sans-serif;font-weight:900;stroke:rgba(255,255,255,0.8);stroke-width:3px;stroke-linejoin:round;fill:transparent;transition:all 0.3s ease;}
    .group:hover .rank-number text{fill:#fff;stroke:#fff;}
    .cs{appearance:none;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,.45)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e");background-repeat:no-repeat;background-position:right .75rem center;background-size:.9em;}
    input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:99px;background:rgba(255,255,255,.15);outline:none;}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.5);}
    :fullscreen,:-webkit-full-screen{border-radius:0!important;}
    .spoil{filter:blur(7px);cursor:pointer;transition:filter .3s}.spoil:hover{filter:blur(3px)}
    .row-edge-left{pointer-events:none;position:absolute;left:0;top:0;bottom:0;width:80px;z-index:20;background:linear-gradient(to right,#050505 0%,rgba(5,5,5,0.7) 50%,transparent 100%);}
    .row-edge-right{pointer-events:none;position:absolute;right:0;top:0;bottom:0;width:80px;z-index:20;background:linear-gradient(to left,#050505 0%,rgba(5,5,5,0.7) 50%,transparent 100%);}
    .vol-slider{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;background:rgba(255,255,255,.2);outline:none;transition:.2s;}
    .vol-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;cursor:pointer;transition:.2s;box-shadow:0 0 8px rgba(0,0,0,.6)}
    .vol-slider::-webkit-slider-thumb:hover{transform:scale(1.2)}
  `}</style>
);

const Spin=({sz=8,c='#fff'})=><div className={`w-${sz} h-${sz} rounded-full border-[3px] sp`} style={{borderColor:`${c}33`,borderTopColor:c}}/>;

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
const LoginScreen=({onGuest})=>{
  const[tab,setTab]=useState('in');
  const[email,setEmail]=useState('');
  const[pw,setPw]=useState('');
  const[guestCode,setGuestCode]=useState('');
  const[showPw,setShowPw]=useState(false);
  const[err,setErr]=useState('');
  const[msg,setMsg]=useState('');
  const[loading,setLoading]=useState(false);
  const fmtErr=e=>{const m=e?.code||'';if(m.includes('user-not-found')||m.includes('wrong-password')||m.includes('invalid-credential'))return'Incorrect email or password.';if(m.includes('email-already'))return'An account with this email already exists.';if(m.includes('weak-password'))return'Password must be at least 6 characters.';if(m.includes('invalid-email'))return'Please enter a valid email address.';if(m.includes('too-many-requests'))return'Too many attempts. Please wait a moment.';return e?.message||'Something went wrong. Please try again.';};
  const submit=async evt=>{
    evt.preventDefault();setErr('');setMsg('');setLoading(true);
    try{
      if(tab==='reset'){await sendPasswordResetEmail(auth,email);setMsg('Password reset email sent. Check your inbox.');setTab('in');}
      else if(tab==='up'){await createUserWithEmailAndPassword(auth,email,pw);}
      else{await signInWithEmailAndPassword(auth,email,pw);}
    }catch(e){setErr(fmtErr(e));}
    setLoading(false);
  };
  const handleGuest=()=>{if(guestCode!==GUEST_ACCESS_CODE){setErr('Invalid Guest Access Code.');return;}onGuest();};
  return(
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-5 relative overflow-hidden">
      <G/>
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[80vw] h-[80vw] rounded-full opacity-[0.03] blur-3xl" style={{background:'radial-gradient(circle,#ffffff 0%,transparent 60%)'}}/>
      </div>
      <div className="w-full max-w-sm relative z-10 au">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
            <Play className="w-8 h-8 fill-black text-black ml-1"/>
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-center text-white mb-2">
          {tab==='in'?'Sign In':tab==='up'?'Create Account':'Reset Password'}
        </h1>
        <p className="text-white/60 text-[15px] text-center mb-8 font-medium">
          {tab==='in'?'Enter your details to continue':tab==='up'?'Enter your email and a password':'Instructions will be sent to your email'}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"/>
            <input type="email" placeholder="Email address" value={email} onChange={e=>{setEmail(e.target.value);setErr('');}} required
              className="w-full bg-[#121212] border border-white/10 text-white pl-12 pr-5 py-4 rounded-xl outline-none focus:border-white/30 focus:bg-[#18181b] placeholder:text-white/40 text-[15px] transition-all"/>
          </div>
          {tab!=='reset'&&(
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"/>
              <input type={showPw?'text':'password'} placeholder="Password" value={pw} onChange={e=>{setPw(e.target.value);setErr('');}} required
                className="w-full bg-[#121212] border border-white/10 text-white pl-12 pr-12 py-4 rounded-xl outline-none focus:border-white/30 focus:bg-[#18181b] placeholder:text-white/40 text-[15px] transition-all"/>
              <button type="button" onClick={()=>setShowPw(v=>!v)} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/90 outline-none transition-colors">
                {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
              </button>
            </div>
          )}
          {err&&<p className="text-red-400 text-[13px] py-3 px-4 bg-red-500/10 rounded-xl border border-red-500/20">{err}</p>}
          {msg&&<p className="text-green-400 text-[13px] py-3 px-4 bg-green-500/10 rounded-xl border border-green-500/20">{msg}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-4 mt-2 rounded-xl font-bold text-[15px] transition-all disabled:opacity-50 flex items-center justify-center bg-white text-black hover:bg-gray-200">
            {loading?<Spin sz={5} c="#000"/>:tab==='in'?'Sign In':tab==='up'?'Register':'Send Instructions'}
          </button>
        </form>
        <div className="mt-6 space-y-3 text-center">
          {tab==='in'&&<button onClick={()=>{setTab('reset');setErr('');setMsg('');}} className="text-[14px] text-white/60 hover:text-white transition-colors outline-none font-medium">Forgot password?</button>}
          <div className="text-[14px] text-white/60 font-medium">
            {tab==='in'?<>Don't have an account? <button onClick={()=>{setTab('up');setErr('');}} className="text-white hover:underline font-bold outline-none ml-1">Sign up</button></> :<>Already have an account? <button onClick={()=>{setTab('in');setErr('');}} className="text-white hover:underline font-bold outline-none ml-1">Sign in</button></>}
          </div>
        </div>
        {tab==='in'&&(
          <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"/>
              <input type="password" placeholder="Guest Access Code" value={guestCode} onChange={e=>{setGuestCode(e.target.value);setErr('');}}
                className="w-full bg-[#121212] border border-white/10 text-white pl-12 px-5 py-4 rounded-xl outline-none focus:border-white/30 focus:bg-[#18181b] placeholder:text-white/40 text-[15px] transition-all"/>
            </div>
            <button onClick={handleGuest} disabled={!guestCode.trim()}
              className="w-full py-3.5 rounded-xl text-[14px] font-bold text-white/80 bg-[#121212] border border-white/10 hover:bg-[#18181b] transition-all outline-none disabled:opacity-50">
              Continue as Guest
            </button>
            <p className="text-white/40 text-[12px] text-center mt-3 font-medium">Guest mode does not save watch history.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TOP NAV ─────────────────────────────────────────────────────────────────
const TopNav=React.memo(({tab,setTab,focus,user,isGuest})=>{
  const[scroll,setScroll]=useState(false);
  const[menu,setMenu]=useState(false);
  const menuRef=useRef(null);
  useEffect(()=>{let t=false;const h=()=>{if(!t){requestAnimationFrame(()=>{setScroll(window.scrollY>20);t=false;});t=true;}};window.addEventListener('scroll',h,{passive:true});return()=>window.removeEventListener('scroll',h);},[]);
  useEffect(()=>{const h=e=>{if(menuRef.current&&!menuRef.current.contains(e.target))setMenu(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  const main=[{id:'home',l:'Home'},{id:'movies',l:'Movies'},{id:'tv',l:'Series'},{id:'live',l:'Live TV'},{id:'sports',l:'Sports'}];
  const utils=[{id:'search',I:Search},{id:'watchlist',I:Bookmark},{id:'history',I:Clock}];
  const initial=(user?.displayName||user?.email||'G')[0].toUpperCase();
  return(
    <header className={cn('fixed top-0 inset-x-0 z-[60] flex flex-col items-center transition-all duration-500',focus?'-translate-y-full':scroll?'bg-[#050505]/95 backdrop-blur-md border-b border-white/10':'bg-gradient-to-b from-black/60 to-transparent')}>
      <nav className="w-full max-w-[1800px] flex items-center justify-between px-4 md:px-12 lg:px-16 h-[72px] md:h-[80px]">
        <div className="flex items-center gap-6 md:gap-10">
          <button onClick={()=>setTab('home')} className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg outline-none shrink-0">
            <Play className="w-4 h-4 fill-black text-black ml-0.5"/>
          </button>
          <div className="hidden md:flex items-center gap-8">
            {main.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className={cn('text-[15px] font-bold tracking-wide transition-all outline-none py-1 text-white',tab===t.id?'opacity-100':'opacity-60 hover:opacity-100')}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-5">
          <div className="md:hidden flex items-center overflow-x-auto gap-5 mr-1 max-w-[38vw]">
            {main.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className={cn('text-[13px] font-bold whitespace-nowrap outline-none shrink-0 text-white',tab===t.id?'opacity-100':'opacity-55 hover:opacity-100')}>
                {t.l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {utils.map(u=>(
              <button key={u.id} onClick={()=>setTab(u.id)} className={cn('p-2 md:p-2.5 rounded-full transition-all outline-none',tab===u.id?'text-black bg-white shadow-lg':'text-white opacity-80 hover:opacity-100')}>
                <u.I className="w-[18px] h-[18px] md:w-[20px] md:h-[20px]"/>
              </button>
            ))}
            <div className="relative ml-1 md:ml-2" ref={menuRef}>
              <button onClick={()=>setMenu(v=>!v)} className={cn('p-1.5 rounded-full flex items-center justify-center font-bold transition-all outline-none text-white',menu?'bg-white/20':'opacity-90 hover:opacity-100')}>
                {isGuest?<User className="w-[22px] h-[22px]"/>:<div className="w-[28px] h-[28px] rounded-full border-2 border-current flex items-center justify-center text-[13px]">{initial}</div>}
              </button>
              {menu&&(
                <div className="absolute right-0 top-12 w-60 md:w-64 bg-[#121212] border border-white/10 rounded-2xl p-3 shadow-2xl as z-[200]">
                  {!isGuest&&<div className="flex flex-col items-center mb-3 pb-4 border-b border-white/10 pt-2">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 flex items-center justify-center text-xl md:text-2xl font-bold mb-3 shadow-inner text-white">{initial}</div>
                    <p className="text-white font-bold text-[15px] truncate w-full text-center px-2">{user?.displayName||user?.email}</p>
                    <p className="text-white/50 text-[12px] font-medium mt-0.5 truncate w-full text-center px-2">{user?.email}</p>
                  </div>}
                  <button onClick={()=>{setTab('settings');setMenu(false);}} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-[#27272a] text-white/90 hover:text-white text-[14px] font-bold transition-all outline-none">
                    <Settings className="w-4 h-4"/>Settings
                  </button>
                  <button onClick={()=>firebaseSignOut(auth)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 text-[14px] font-bold transition-all outline-none mt-1">
                    <LogOut className="w-4 h-4"/>Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
});

// ─── POSTER CARD ─────────────────────────────────────────────────────────────
const PosterCard=React.memo(({media,onClick,isReplay})=>{
  const[loaded,setLoaded]=useState(false);
  const src=media.poster_path?`${IMG}w342${media.poster_path}`:null;
  const title=media.title||media.name||'';
  const dateStr=isReplay?fmtDate(media.release_date||media.first_air_date):fmtYear(media.release_date||media.first_air_date);
  return(
    <div onClick={()=>onClick(media)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onClick(media);}}
      className="flex flex-col gap-2 md:gap-3 group cursor-pointer select-none outline-none w-full relative">
      <div className="relative w-full overflow-hidden rounded-xl md:rounded-2xl bg-[#18181b] border border-white/5 transition-all duration-300 group-hover:ring-1 ring-white/30 group-hover:-translate-y-1 shadow-md" style={{aspectRatio:'2/3'}}>
        {!loaded&&<div className="absolute inset-0 sk"/>}
        {src?(
          <img src={src} alt={title} loading="lazy" decoding="async" draggable="false"
            className={cn('absolute inset-0 w-full h-full object-cover transition-all duration-500',loaded?'opacity-100':'opacity-0')}
            onLoad={()=>setLoaded(true)} onError={()=>setLoaded(true)}/>
        ):(
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
            <Film className="w-8 h-8 text-white/10"/>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300"/>
        {media.progress>0&&<div className="absolute bottom-0 left-0 right-0 h-[4px] bg-white/10"><div className="h-full rounded-full bg-white" style={{width:`${Math.min(media.progress,100)}%`}}/></div>}
      </div>
      <div className="px-0.5 flex flex-col">
        <h4 className="text-white/95 font-bold text-[13px] md:text-[15px] leading-snug truncate group-hover:text-white transition-colors">{title}</h4>
        <div className="flex items-center gap-1.5 text-white/50 text-[11px] md:text-[13px] font-medium mt-0.5">
          {dateStr&&<span>{dateStr}</span>}
          {dateStr&&!isReplay&&media.vote_average>0&&<span>•</span>}
          {!isReplay&&media.vote_average>0&&<span className="text-white/70 font-semibold">{Math.round(media.vote_average*10)}%</span>}
        </div>
      </div>
    </div>
  );
});

// ─── CONTENT ROW ─────────────────────────────────────────────────────────────
const Row=React.memo(({title,url,onCard,apiKey,ranking=false,data=null,isReplay=false})=>{
  const[items,setItems]=useState([]);
  const[fetched,setFetched]=useState(false);
  const[vis,setVis]=useState(false);
  const[isDragging,setIsDragging]=useState(false);
  const[startX,setStartX]=useState(0);
  const[scrollLeftPos,setScrollLeftPos]=useState(0);
  const[dragMoved,setDragMoved]=useState(false);
  const ref=useRef(null),sr=useRef(null),obs=useRef(null);
  const setRef=useCallback(n=>{if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVis(true);obs.current?.disconnect();}},{rootMargin:'600px'});if(n){ref.current=n;obs.current.observe(n);}},[]);
  useEffect(()=>{
    if(data){setItems(ranking?data.slice(0,10):data);setFetched(true);return;}
    if(!apiKey||!url||!vis||fetched)return;
    let ok=true;
    (async()=>{
      try{
        const s=url.includes('?')?'&':'?';
        const[d1,d2]=await Promise.all([fetch2(`${BASE}${url}${s}api_key=${apiKey}&page=1`),fetch2(`${BASE}${url}${s}api_key=${apiKey}&page=2`)]);
        if(!ok)return;
        const r=[...(d1.results||[]),...(d2.results||[])].filter(i=>i.poster_path);
        setItems(ranking?Array.from(new Map(r.map(i=>[i.id,i])).values()).slice(0,10):Array.from(new Map(r.map(i=>[i.id,i])).values()));
        setFetched(true);
      }catch{}
    })();
    return()=>{ok=false;};
  },[url,apiKey,data,vis,fetched,ranking]);
  const scrl=d=>{if(sr.current)sr.current.scrollBy({left:d==='r'?sr.current.clientWidth*.75:-sr.current.clientWidth*.75,behavior:'smooth'});};
  const isInfinite=items.length>4;
  const disp=isInfinite?[...items,...items,...items]:items;
  const handleScroll=useCallback((e)=>{
    if(!isInfinite||isDragging||!sr.current)return;
    const s=e.target;
    const firstChild=s.children[0];
    const nextSetChild=s.children[items.length];
    if(!firstChild||!nextSetChild)return;
    const setWidth=nextSetChild.offsetLeft-firstChild.offsetLeft;
    if(s.scrollLeft<=10){s.style.scrollBehavior='auto';s.scrollLeft+=setWidth;requestAnimationFrame(()=>{s.style.scrollBehavior='smooth';});}
    else if(s.scrollLeft>=(setWidth*2)-10){s.style.scrollBehavior='auto';s.scrollLeft-=setWidth;requestAnimationFrame(()=>{s.style.scrollBehavior='smooth';});}
  },[isInfinite,isDragging,items.length]);
  useEffect(()=>{
    if(sr.current&&isInfinite&&sr.current.children.length>items.length){
      const firstChild=sr.current.children[0];
      const nextSetChild=sr.current.children[items.length];
      if(firstChild&&nextSetChild){
        const setWidth=nextSetChild.offsetLeft-firstChild.offsetLeft;
        sr.current.style.scrollBehavior='auto';
        sr.current.scrollLeft=setWidth;
        requestAnimationFrame(()=>{if(sr.current)sr.current.style.scrollBehavior='smooth';});
      }
    }
  },[items.length,isInfinite]);
  const onMouseDown=(e)=>{setIsDragging(true);setDragMoved(false);setStartX(e.pageX-sr.current.offsetLeft);setScrollLeftPos(sr.current.scrollLeft);if(sr.current)sr.current.style.scrollBehavior='auto';};
  const onMouseLeave=()=>{setIsDragging(false);if(sr.current)sr.current.style.scrollBehavior='smooth';};
  const onMouseUp=()=>{setIsDragging(false);if(sr.current)sr.current.style.scrollBehavior='smooth';};
  const onMouseMove=(e)=>{
    if(!isDragging||!sr.current)return;
    e.preventDefault();
    const x=e.pageX-sr.current.offsetLeft;
    const walk=(x-startX)*1.5;
    if(Math.abs(walk)>5)setDragMoved(true);
    let nextScrollLeft=scrollLeftPos-walk;
    if(isInfinite){
      const firstChild=sr.current.children[0];
      const nextSetChild=sr.current.children[items.length];
      if(firstChild&&nextSetChild){
        const setWidth=nextSetChild.offsetLeft-firstChild.offsetLeft;
        if(nextScrollLeft<=10){nextScrollLeft+=setWidth;setScrollLeftPos(prev=>prev+setWidth);}
        else if(nextScrollLeft>=(setWidth*2)-10){nextScrollLeft-=setWidth;setScrollLeftPos(prev=>prev-setWidth);}
      }
    }
    sr.current.scrollLeft=nextScrollLeft;
  };
  const handleCardClick=(m)=>{if(dragMoved)return;onCard(m);};
  if(!data&&!fetched)return<div ref={setRef} className="mb-14 w-full" style={{height:'20rem'}}/>;
  if(!items.length)return null;
  return(
    <div ref={setRef} className="mb-10 md:mb-14 group/row">
      <div className="px-4 md:px-12 lg:px-16 mb-4 md:mb-5 max-w-[1800px] mx-auto">
        <h2 className="text-[17px] md:text-[22px] font-bold tracking-tight text-white">{title}</h2>
      </div>
      <div className="relative group/nav w-full">
        {/* Persistent edge gradients — always visible */}
        <div className="row-edge-left" style={{bottom:'60px'}}/>
        <div className="row-edge-right" style={{bottom:'60px'}}/>
        {/* Nav buttons — appear on hover above the gradients */}
        <button onClick={()=>scrl('l')} className="absolute left-0 inset-y-0 pb-[60px] w-20 z-30 hidden md:flex items-center justify-start pl-4 opacity-0 group-hover/nav:opacity-100 transition-all outline-none pointer-events-none group-hover/nav:pointer-events-auto">
          <div className="w-10 h-10 rounded-full bg-[#18181b] border border-white/15 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shadow-xl"><ChevronLeft className="w-5 h-5"/></div>
        </button>
        <div ref={sr} onScroll={handleScroll} onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove}
          className={cn('flex overflow-x-auto gap-3 md:gap-5 pb-6 pt-2 px-4 md:px-12 lg:px-16',isDragging?'cursor-grabbing snap-none select-none':'cursor-grab snap-x snap-mandatory scrollbar-hide')}
          style={{scrollBehavior:'smooth'}}>
          {disp.map((m,i)=>
            <div key={`${m.id}_${i}`} className={cn('flex-shrink-0 snap-start relative group',ranking?'w-[120px] md:w-[150px] ml-7 md:ml-12':'w-[110px] sm:w-[130px] md:w-[160px]')}>
              {ranking&&(
                <svg className="absolute -left-10 md:-left-16 bottom-10 z-20 pointer-events-none rank-number" width="100" height="100" viewBox="0 0 100 100" style={{overflow:'visible'}}>
                  <text x="50" y="85" fontSize="85" textAnchor="middle">{(i%items.length)+1}</text>
                </svg>
              )}
              <PosterCard media={m} onClick={()=>handleCardClick(m)} isReplay={isReplay}/>
            </div>
          )}
        </div>
        <button onClick={()=>scrl('r')} className="absolute right-0 inset-y-0 pb-[60px] w-20 z-30 hidden md:flex items-center justify-end pr-4 opacity-0 group-hover/nav:opacity-100 transition-all outline-none pointer-events-none group-hover/nav:pointer-events-auto">
          <div className="w-10 h-10 rounded-full bg-[#18181b] border border-white/15 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shadow-xl"><ChevronRight className="w-5 h-5"/></div>
        </button>
      </div>
    </div>
  );
});

// ─── HERO ────────────────────────────────────────────────────────────────────
const Hero=React.memo(({onPlay,onInfo,apiKey,type='all',toggleWL,watchlist})=>{
  const[slides,setSlides]=useState([]);
  const[active,setActive]=useState(0);
  useEffect(()=>{
    if(!apiKey)return;
    let ok=true;
    (async()=>{
      try{
        const ep=type==='all'?'/trending/all/day':type==='movie'?'/trending/movie/day':'/trending/tv/day';
        const res=await fetch2(`${BASE}${ep}?api_key=${apiKey}`);
        if(!ok||!res.results)return;
        const top=res.results.filter(i=>i.backdrop_path&&!i.adult).slice(0,5);
        const detailedSlides=await Promise.all(top.map(async(m)=>{
          const mt=m.media_type||(type==='tv'?'tv':'movie');
          try{
            const det=await fetch2(`${BASE}/${mt}/${m.id}?api_key=${apiKey}&append_to_response=images,external_ids`);
            const logos=det.images?.logos||[];
            let bestLogo=logos.find(l=>l.iso_639_1==='en'&&l.aspect_ratio>1.8)||logos.find(l=>l.iso_639_1==='en'&&l.aspect_ratio>1)||logos.find(l=>l.aspect_ratio>1.5)||logos[0];
            let omdb=null;
            const imdbId=det.imdb_id||det.external_ids?.imdb_id;
            if(imdbId&&DEFAULT_OMDB){try{const o=await fetch2(`https://www.omdbapi.com/?i=${imdbId}&apikey=${DEFAULT_OMDB}`);if(!o.Error)omdb=o;}catch(e){}}
            return{...det,logo:bestLogo?.file_path,media_type:mt,omdb};
          }catch{return m;}
        }));
        if(ok)setSlides(detailedSlides.filter(s=>s.backdrop_path));
      }catch{}
    })();
    return()=>{ok=false;};
  },[apiKey,type]);
  useEffect(()=>{
    if(slides.length<=1)return;
    const timer=setInterval(()=>setActive(p=>(p+1)%slides.length),35000);
    return()=>clearInterval(timer);
  },[slides.length]);
  if(!slides.length)return<div className="h-screen bg-black"/>;
  return(
    <div className="relative w-full min-h-[80vh] md:min-h-screen flex flex-col justify-end overflow-hidden bg-[#050505] mb-8 group">
      {slides.map((m,i)=>{
        const isSaved=watchlist?.some(w=>w.id===m.id);
        const matchScore=m.vote_average>0?Math.round(m.vote_average*10):null;
        return(
          <div key={m.id} className={cn('absolute inset-0 transition-opacity duration-1000',i===active?'opacity-100 z-10':'opacity-0 z-0 pointer-events-none')}>
            <img src={`${IMG}original${m.backdrop_path}`} alt="" className="absolute inset-0 w-full h-full object-cover object-center" decoding="async" draggable="false"/>
            {/* Top gradient for nav readability */}
            <div className="absolute top-0 left-0 w-full h-[22%] pointer-events-none" style={{background:'linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 100%)'}}/>
            {/* Bottom gradient — smooth cinematic fade into #050505 */}
            <div className="absolute bottom-0 left-0 w-full pointer-events-none" style={{height:'70%',background:'linear-gradient(to top,#050505 0%,rgba(5,5,5,0.96) 18%,rgba(5,5,5,0.78) 35%,rgba(5,5,5,0.45) 55%,rgba(5,5,5,0.15) 75%,transparent 100%)'}}/>
            <div className="absolute inset-0 px-4 md:px-12 lg:px-16 pb-14 md:pb-28 pt-40 max-w-[1800px] mx-auto w-full flex flex-col justify-end">
              <div className="max-w-[580px] au relative z-10 text-white">
                {m.logo?(
                  <img src={`${IMG}w500${m.logo}`} alt={m.title||m.name} className="h-auto w-auto max-w-[240px] md:max-w-[340px] max-h-[60px] md:max-h-[85px] object-contain object-left-bottom mb-5"/>
                ):(
                  <h1 className="text-3xl sm:text-4xl md:text-[56px] font-bold tracking-tighter leading-[1.05] mb-5">{m.title||m.name}</h1>
                )}
                <div className="flex items-center flex-wrap gap-2 text-[11px] md:text-[13px] font-bold mb-3 tracking-wide text-white/90">
                  {matchScore&&<span className="font-extrabold">{matchScore}% Score</span>}
                  {matchScore&&<span className="opacity-40 mx-0.5">|</span>}
                  <span>{fmtYear(m.release_date||m.first_air_date)}</span>
                  {m.genres&&m.genres.length>0&&(<><span className="opacity-40 mx-0.5">|</span><span className="truncate">{m.genres.slice(0,3).map(g=>g.name).join(' | ')}</span></>)}
                </div>
                <p className="text-[13px] md:text-[15px] font-semibold leading-relaxed line-clamp-3 mb-7 max-w-[480px] text-white/90">{m.overview}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={()=>onPlay(m)} className="flex items-center justify-center gap-2 bg-white text-black px-7 md:px-8 py-3 md:py-3.5 rounded-full font-bold text-[14px] md:text-[15px] hover:bg-gray-200 transition-transform outline-none">
                    <Play className="w-4 h-4 md:w-5 md:h-5 fill-black ml-0.5"/>Play
                  </button>
                  <button onClick={()=>onInfo(m)} className="flex items-center justify-center gap-2 bg-black/20 border border-white/20 text-white px-6 md:px-7 py-3 md:py-3.5 rounded-full font-bold text-[14px] md:text-[15px] hover:bg-black/40 transition-transform outline-none">
                    <Info className="w-4 h-4 md:w-5 md:h-5"/>Info
                  </button>
                  <button onClick={()=>toggleWL(m)} className={cn('flex items-center justify-center w-12 h-12 md:w-[52px] md:h-[52px] rounded-full border transition-transform outline-none hover:scale-105',isSaved?'bg-white/30 text-white border-white/40':'bg-black/20 text-white border-white/20 hover:bg-black/40')} title={isSaved?'Remove from Library':'Add to Library'}>
                    <Bookmark className="w-4 h-4 md:w-5 md:h-5" fill={isSaved?'currentColor':'none'}/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {slides.length>1&&(
        <div className="absolute bottom-6 md:bottom-8 left-4 md:left-12 lg:left-16 flex items-center gap-2 md:gap-2.5 z-20">
          {slides.map((_,i)=>(
            <button key={i} onClick={()=>setActive(i)} className={cn('h-1.5 rounded-full transition-all',i===active?'w-7 md:w-8 bg-white':'w-2 md:w-2.5 bg-white/40 hover:bg-white/70')}/>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
const HomeView=React.memo(({apiKey,history,watchlist,algoPrefs,onPlay,onInfo,toggleWL})=>{
  const[dynRows,setDynRows]=useState([]);
  const[hasMore,setHasMore]=useState(true);
  const obs=useRef(null);
  const used=useRef(new Set(['t10','cont','onair','topM','topT']));
  const cont=useMemo(()=>history.filter(i=>i.progress>0&&i.progress<95).slice(0,10),[history]);
  const genRow=useCallback(()=>{for(const s of [...history,...watchlist].sort(()=>.5-Math.random())){const k=`rec_${s.id}`;if(!used.current.has(k)){used.current.add(k);const t=s.media_type||'movie';return{id:k,title:`Because you ${history.some(h=>h.id===s.id)?'watched':'saved'} "${(s.title||s.name||'').slice(0,25)}"`,url:`/${t}/${s.id}/recommendations`};}}for(const g of ALL_GENRES.filter(g=>!algoPrefs.excluded.includes(g.id)).sort(()=>.5-Math.random())){const km=`gm_${g.id}`;if(!used.current.has(km)){used.current.add(km);return{id:km,title:`${g.name} Movies`,url:`/discover/movie?with_genres=${g.id}&sort_by=popularity.desc`};}const kt=`gt_${g.id}`;if(!used.current.has(kt)){used.current.add(kt);return{id:kt,title:`${g.name} Series`,url:`/discover/tv?with_genres=${g.id}&sort_by=popularity.desc`};}}return null;},[algoPrefs,history,watchlist]);
  const lastRef=useCallback(n=>{if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting&&hasMore){setDynRows(p=>{const nr=[];for(let i=0;i<3;i++){const r=genRow();if(r)nr.push(r);}if(!nr.length)setHasMore(false);return[...p,...nr];});}},{rootMargin:'800px'});if(n)obs.current.observe(n);},[hasMore,genRow]);
  return(
    <div className="pb-28 bg-[#050505] min-h-screen">
      <Hero onPlay={onPlay} onInfo={onInfo} apiKey={apiKey} toggleWL={toggleWL} watchlist={watchlist}/>
      <div className="relative z-10 pb-12">
        {cont.length>0&&<Row title="Continue Watching" data={cont} onCard={onInfo}/>}
        <Row title="Top 10 Today" url="/trending/all/day" onCard={onInfo} apiKey={apiKey} ranking/>
        <Row title="Trending Now" url="/trending/all/week" onCard={onInfo} apiKey={apiKey}/>
        <Row title="New in Theatres" url="/movie/now_playing" onCard={onInfo} apiKey={apiKey}/>
        <Row title="Now Airing" url="/tv/on_the_air" onCard={onInfo} apiKey={apiKey}/>
        <Row title="Highest Rated Movies" url="/movie/top_rated" onCard={onInfo} apiKey={apiKey}/>
        <Row title="Acclaimed Series" url="/tv/top_rated" onCard={onInfo} apiKey={apiKey}/>
        {dynRows.map(r=><Row key={r.id} title={r.title} url={r.url} onCard={onInfo} apiKey={apiKey}/>)}
        {hasMore&&<div ref={lastRef} className="h-10 flex items-center justify-center"><Spin sz={5}/></div>}
      </div>
    </div>
  );
});

// ─── GRID VIEW ───────────────────────────────────────────────────────────────
const GridView=React.memo(({apiKey,type,genreId,onCard})=>{
  const[res,setRes]=useState([]),[pg,setPg]=useState(1),[more,setMore]=useState(true),[load,setLoad]=useState(false);
  const obs=useRef();
  const gObj=ALL_GENRES.find(g=>g.id===genreId);
  useEffect(()=>{setRes([]);setPg(1);setMore(true);},[genreId,type]);
  useEffect(()=>{let ok=true;setLoad(true);(async()=>{try{let u=`${BASE}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&page=${pg}`;if(gObj)u+=`&with_genres=${gObj.id}`;const d=await fetch2(u);if(!ok)return;if(d.results?.length){setRes(p=>Array.from(new Map([...p,...d.results.filter(i=>i.poster_path)].map(i=>[i.id,i])).values()));if(pg>=d.total_pages||pg>=50)setMore(false);}else setMore(false);}catch{}if(ok)setLoad(false);})();return()=>{ok=false;};},[apiKey,type,genreId,pg,gObj]);
  const last=useCallback(n=>{if(load)return;if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting&&more)setPg(p=>p+1);},{rootMargin:'600px'});if(n)obs.current.observe(n);},[load,more]);
  return(
    <div className="pt-28 md:pt-36 px-4 md:px-12 lg:px-16 min-h-screen bg-[#050505] max-w-[1800px] mx-auto pb-28 au">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-8 text-white">{gObj?.name||'Discover'} {type==='movie'?'Movies':'Series'}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 md:gap-x-4 gap-y-7 md:gap-y-8 pb-12">
        {res.map(i=><PosterCard key={i.id} media={i} onClick={onCard}/>)}
      </div>
      {more&&<div ref={last} className="py-10 flex justify-center"><Spin/></div>}
    </div>
  );
});

// ─── SEARCH VIEW ─────────────────────────────────────────────────────────────
const SearchView=React.memo(({apiKey,history,onCard})=>{
  const[q,setQ]=useState('');
  const dq=useDebounce(q,500);
  const[res,setRes]=useState([]),[pg,setPg]=useState(1),[more,setMore]=useState(true),[loading,setLoading]=useState(false);
  const[fType,setFType]=useState('all'),[fSort,setFSort]=useState('popularity.desc');
  const[fGenre,setFGenre]=useState(''),[fYear,setFYear]=useState(''),[fRating,setFRating]=useState('');
  const obs=useRef();
  const cy=new Date().getFullYear();
  const yrs=[...Array(40)].map((_,i)=>cy-i).map(String);
  useEffect(()=>{setRes([]);setPg(1);setMore(true);},[dq,fType,fSort,fGenre,fYear,fRating]);
  useEffect(()=>{
    let ok=true;
    (async()=>{
      setLoading(true);
      try{
        let nr=[],tp=1;
        if(!dq){
          const types=fType==='all'?['movie','tv']:[fType];
          const urls=[];
          types.forEach(t=>{let u=`${BASE}/discover/${t}?api_key=${apiKey}&sort_by=${fSort}&page=${pg}`;if(fGenre)u+=`&with_genres=${fGenre}`;if(fYear)u+=`&${t==='movie'?'primary_release_year':'first_air_date_year'}=${fYear}`;if(fRating)u+=`&vote_average.gte=${fRating}&vote_count.gte=50`;urls.push(u,u.replace(`page=${pg}`,`page=${pg+1}`));});
          const rs=await Promise.all(urls.map(u=>fetch2(u)));if(!ok)return;
          rs.forEach(d=>{if(d.results)nr.push(...d.results.filter(i=>i.poster_path).map(i=>({...i,media_type:i.media_type||(fType==='all'?'movie':fType)})));tp=Math.max(tp,d.total_pages||1);});
        }else{
          const cq=dq.replace(/ movies?| films?| shows?| series/gi,'').trim();
          const rs=await Promise.all([1,2,3].map(n=>fetch2(`${BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(cq)}&page=${pg+n-1}`)));if(!ok)return;
          rs.forEach(d=>{if(d.results){let v=d.results.filter(i=>(i.media_type==='movie'||i.media_type==='tv')&&i.poster_path);if(fType!=='all')v=v.filter(i=>i.media_type===fType);if(fRating)v=v.filter(i=>(i.vote_average||0)>=parseFloat(fRating));if(fYear)v=v.filter(i=>(i.release_date||i.first_air_date||'').startsWith(fYear));if(fGenre)v=v.filter(i=>(i.genre_ids||[]).includes(parseInt(fGenre)));nr.push(...v);tp=Math.max(tp,d.total_pages||1);}});
        }
        const dd=Array.from(new Map(nr.map(i=>[i.id,i])).values()).sort((a,b)=>fSort.includes('vote_average')?(b.vote_average||0)-(a.vote_average||0):(b.popularity||0)-(a.popularity||0));
        setRes(p=>pg===1?dd:[...p,...dd.filter(i=>!p.some(x=>x.id===i.id))]);
        if(pg>=tp||pg>=40)setMore(false);
      }catch{}finally{if(ok)setLoading(false);}
    })();return()=>{ok=false;};
  },[dq,apiKey,fType,fSort,fGenre,fYear,fRating,pg]);
  const lastRef=useCallback(n=>{if(loading)return;if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting&&more)setPg(p=>p+(dq?3:2));},{rootMargin:'600px'});if(n)obs.current.observe(n);},[loading,more,dq]);
  return(
    <div className="pt-20 md:pt-32 px-4 md:px-12 lg:px-16 min-h-screen bg-[#050505] max-w-[1800px] mx-auto pb-28 au">
      <div className="sticky top-[72px] md:top-[80px] bg-[#050505]/95 backdrop-blur-md pt-2 pb-5 md:pb-6 z-40 w-full mb-6 md:mb-8">
        <div className="relative mb-4 md:mb-5">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"/>
          <input type="text" placeholder="Movies, series, genres…" value={q} onChange={e=>setQ(e.target.value)} autoFocus
            className="w-full bg-[#18181b] border border-white/10 text-white pl-14 pr-12 py-4 md:py-5 rounded-full outline-none placeholder:text-white/30 focus:bg-[#27272a] focus:border-white/20 text-[16px] md:text-[18px] font-medium transition-all shadow-inner"/>
          {q&&<button onClick={()=>setQ('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white outline-none"><X className="w-5 h-5 md:w-6 md:h-6"/></button>}
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex bg-[#18181b] border border-white/10 rounded-full p-1 shrink-0">
            {[['all','All'],['movie','Movies'],['tv','Series']].map(([v,l])=>(
              <button key={v} onClick={()=>setFType(v)} className={cn('px-4 py-2 rounded-full text-[13px] font-bold transition-all outline-none',fType===v?'bg-[#27272a] text-white shadow-md':'text-white/40 hover:text-white')}>{l}</button>
            ))}
          </div>
          {[
            [fSort,setFSort,[['popularity.desc','Popular'],['vote_average.desc','Top Rated'],['primary_release_date.desc','Newest'],['revenue.desc','Box Office']]],
            [fGenre,setFGenre,[['','Any Genre'],...ALL_GENRES.map(g=>[String(g.id),g.name])]],
            [fYear,setFYear,[['','Any Year'],...yrs.map(y=>[y,y])]],
            [fRating,setFRating,[['','Any Rating'],['9','9+ ★'],['8','8+ ★'],['7','7+ ★'],['6','6+ ★']]],
          ].map(([val,setter,opts],i)=>(
            <select key={i} value={val} onChange={e=>setter(e.target.value)} className="cs bg-[#18181b] border border-white/10 text-white/80 rounded-full px-4 py-2.5 outline-none text-[13px] font-bold pr-9 shrink-0 cursor-pointer transition-all hover:bg-[#27272a]">
              {opts.map(([v,l])=><option key={v} value={v} className="bg-[#1C1C1E]">{l}</option>)}
            </select>
          ))}
        </div>
      </div>
      {res.length>0?(<>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 md:gap-x-5 gap-y-8 md:gap-y-10 pb-10">
          {res.map(i=><PosterCard key={i.id} media={i} onClick={onCard}/>)}
        </div>
        {more&&<div ref={lastRef} className="py-10 flex justify-center"><Spin/></div>}
      </>):loading?(<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">{[...Array(10)].map((_,i)=><div key={i} className="aspect-[2/3] sk rounded-2xl"/>)}</div>):(
        <div className="py-32 text-center text-white/30"><Search className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 opacity-20"/><p className="text-lg md:text-xl font-medium">Find your next favorite</p></div>
      )}
    </div>
  );
});

// ─── LIVE TV ─────────────────────────────────────────────────────────────────
const YoutubeLiveTile=React.memo(({ch,isMain,onFocusClick,idle,hasAudio})=>{
  const embedSrc=`https://www.youtube.com/embed/live_stream?channel=${ch.ytChannelId}&autoplay=1&mute=1&rel=0&modestbranding=1`;
  return(
    <div onClick={onFocusClick} className={cn('relative w-full h-full overflow-hidden rounded-xl md:rounded-2xl bg-black cursor-pointer transition-all duration-300', hasAudio ? 'ring-1 ring-white shadow-[0_0_20px_rgba(255,255,255,0.2)] z-10' : 'ring-1 ring-white/10 hover:ring-white/30 z-0')}>
      <iframe src={embedSrc} className="w-full h-full border-0 object-contain pointer-events-none" allow="autoplay; fullscreen" allowFullScreen title={ch.name}/>
      <div className={cn("absolute top-3 left-3 md:top-4 md:left-4 z-10 pointer-events-none transition-opacity duration-500", idle ? "opacity-0" : "opacity-100")}>
        <div className="bg-white/95 rounded-md px-1.5 py-1 md:px-2 md:py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center">
          <img src={ch.logo} className="h-3 md:h-4 w-auto max-w-[60px] object-contain" alt="" onError={e=>{e.target.style.display='none';}}/>
        </div>
      </div>
    </div>
  );
});

const LiveTile=React.memo(({ch,isMain,onFocus,hasAudio,onAudio,vol,onVol})=>{
  const vRef=useRef(null),hlsRef=useRef(null),cRef=useRef(null);
  const[hasVid,setHasVid]=useState(false),[err,setErr]=useState(false),[inView,setInView]=useState(false),[playing,setPlaying]=useState(true);
  const[idle,setIdle]=useState(true);
  const[ccActive,setCcActive]=useState(false);
  const idleTimer=useRef(null);

  const resetIdle = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 3000);
  }, []);

  useEffect(() => {
    return () => clearTimeout(idleTimer.current);
  }, []);

  useEffect(()=>{const o=new IntersectionObserver(([e])=>setInView(e.isIntersecting),{threshold:.01, rootMargin: '300px'});if(cRef.current)o.observe(cRef.current);return()=>o.disconnect();},[]);
  
  const load=useCallback(()=>{
    setErr(false);setHasVid(false);const v=vRef.current;if(!v)return null;
    return initHls(v,ch.url,isMain,{
      onParsed:()=>{ v.play().then(()=>{setHasVid(true);setPlaying(true);}).catch(()=>{}); },
      onError:(e,d)=>{
        if(d.fatal){
          if(d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR&&hlsRef.current)hlsRef.current.startLoad();
          else if(d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR&&hlsRef.current)hlsRef.current.recoverMediaError();
          else{if(hlsRef.current)hlsRef.current.destroy();setErr(true);}
        }
      }
    });
  },[ch.url,isMain]);

  useEffect(()=>{if(!inView)return;let i;loadHls(()=>{i=load();hlsRef.current=i;});return()=>{if(i)i.destroy();if(vRef.current){vRef.current.pause();vRef.current.removeAttribute('src');vRef.current.load();}};},[inView,load]);
  useEffect(()=>{if(vRef.current){vRef.current.muted=!hasAudio;vRef.current.volume=vol;}},[hasAudio,vol]);
  
  const tog=useCallback(e=>{if(e)e.stopPropagation();if(vRef.current){playing?vRef.current.pause():vRef.current.play().catch(()=>{});setPlaying(!playing);}},[playing]);
  const retry=e=>{e.stopPropagation();if(hlsRef.current)hlsRef.current.destroy();load();};
  
  const togglePiP=async e=>{
    e.stopPropagation();
    try{
      if(document.pictureInPictureElement) await document.exitPictureInPicture();
      else if(vRef.current) await vRef.current.requestPictureInPicture();
    }catch(err){console.error(err);}
  };

  const toggleCC=useCallback(e=>{
    e.stopPropagation();
    if(vRef.current){
      let found=false;
      for(let i=0; i<vRef.current.textTracks.length; i++){
        const track=vRef.current.textTracks[i];
        if(track.kind==='captions'||track.kind==='subtitles'){
          track.mode = track.mode==='showing' ? 'hidden' : 'showing';
          setCcActive(track.mode==='showing');
          found=true;
          break;
        }
      }
      if(!found) setCcActive(p=>!p);
    }
  },[]);

  const handleFocusClick = useCallback((e) => {
    if (!isMain && onFocus) onFocus(ch.id);
    else if (isMain) tog(e);
  }, [isMain, onFocus, ch.id, tog]);

  const handleAudioClick = useCallback((e) => {
    e.stopPropagation();
    if (onAudio) onAudio(ch.id);
  }, [onAudio, ch.id]);

  if(ch.type==='youtube') {
    return <div onMouseMove={resetIdle} onTouchStart={resetIdle} onMouseLeave={()=>setIdle(true)} className="w-full h-full aspect-video"><YoutubeLiveTile ch={ch} isMain={isMain} onFocusClick={handleFocusClick} idle={idle} hasAudio={hasAudio}/></div>;
  }

  if(err)return(
    <div ref={cRef} onClick={handleFocusClick} className="w-full h-full aspect-video rounded-xl md:rounded-2xl border border-white/5 bg-[#121212] flex items-center justify-center cursor-pointer relative">
      <div className="text-center"><div className="w-10 h-10 mx-auto mb-2 bg-white/95 rounded-xl flex items-center justify-center p-2"><img src={ch.logo} className="w-full h-full object-contain opacity-80 grayscale" alt="" onError={e=>{e.target.style.display='none';}}/></div>{isMain&&<button onClick={retry} className="text-[13px] font-bold text-white/50 hover:text-white flex items-center gap-1.5 mx-auto mt-2"><RefreshCw className="w-3.5 h-3.5"/>Retry</button>}</div>
    </div>
  );

  return(
    <div ref={cRef} onMouseMove={resetIdle} onTouchStart={resetIdle} onMouseLeave={()=>setIdle(true)} onClick={handleFocusClick} className={cn('relative w-full h-full aspect-video overflow-hidden rounded-xl md:rounded-2xl bg-black cursor-pointer transition-all duration-300', hasAudio ? 'shadow-[0_0_20px_rgba(255,255,255,0.25)] ring-[1.5px] ring-white/90 z-10' : 'ring-1 ring-white/10 hover:ring-white/30 z-0')}>
      <video ref={vRef} muted={!hasAudio} playsInline className={cn('absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-700',hasVid?'opacity-100':'opacity-0')}/>
      {!hasVid&&<div className="absolute inset-0 flex items-center justify-center bg-[#18181b]"><Spin sz={6}/></div>}
      
      <div className={cn("absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none transition-opacity duration-500", idle ? "opacity-0" : "opacity-100")}/>
      
      {/* Sleek Frosted Logo */}
      <div className={cn("absolute top-3 left-3 md:top-4 md:left-4 z-10 pointer-events-none transition-opacity duration-500", idle ? "opacity-0" : "opacity-100")}>
        <div className="bg-white/95 rounded-md px-1.5 py-1 md:px-2 md:py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center">
          <img src={ch.logo} className="h-3 md:h-4 w-auto max-w-[60px] object-contain" alt="" onError={e=>{e.target.style.display='none';}}/>
        </div>
      </div>

      {/* Play/Pause Center Indicator */}
      {isMain && (
        <div className={cn("absolute inset-0 flex items-center justify-center pointer-events-none z-10 transition-all duration-500", idle ? "opacity-0 scale-95" : "opacity-100 scale-100")}>
          <div className="bg-black/40 backdrop-blur-md border border-white/20 text-white rounded-full flex items-center justify-center w-14 h-14 md:w-16 md:h-16 shadow-2xl">
            {playing?<Pause className="fill-current w-6 h-6 md:w-7 md:h-7"/>:<Play className="fill-current ml-1 w-6 h-6 md:w-7 md:h-7"/>}
          </div>
        </div>
      )}

      {/* Sleek Media Controls */}
      <div 
        className={cn("absolute bottom-2 right-2 md:bottom-4 md:right-4 z-20 flex items-center transition-all duration-500 max-w-[calc(100%-1rem)] cursor-default", idle ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-100 translate-y-0")}
        draggable={false}
        onPointerDown={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-1 sm:p-1.5 shadow-2xl gap-0.5 overflow-hidden max-w-full">
          <button onClick={handleAudioClick} className={cn('p-1.5 md:p-2 rounded-full outline-none transition-colors text-white shrink-0',hasAudio?'bg-white/20':'hover:bg-white/20')} title={hasAudio?"Mute":"Unmute"}>
            {hasAudio?<Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4"/>:<VolumeX className="w-3.5 h-3.5 md:w-4 md:h-4"/>}
          </button>
          
          {hasAudio&&<div className="w-12 sm:w-16 md:w-20 mx-0.5 sm:mx-1 transition-all duration-300 flex items-center shrink">
            <input type="range" min="0" max="1" step=".01" value={vol} onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onChange={e=>onVol(parseFloat(e.target.value))} className="w-full vol-slider m-0 min-w-[40px]" style={{background: `linear-gradient(to right, white ${vol*100}%, rgba(255,255,255,0.2) ${vol*100}%)`}}/>
          </div>}

          {ch.type!=='youtube'&&<button onClick={toggleCC} className={cn('p-1.5 md:p-2 rounded-full outline-none transition-colors hidden sm:flex items-center justify-center font-bold text-[10px] md:text-[12px] shrink-0',ccActive?'bg-white text-black':'text-white hover:bg-white/20')} title="Closed Captions">CC</button>}
          
          {ch.type!=='youtube'&&<button onClick={togglePiP} className="p-1.5 md:p-2 rounded-full text-white hover:bg-white/20 outline-none transition-colors hidden sm:block shrink-0" title="Picture in Picture"><PictureInPicture className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>}
          
          <button onClick={retry} className="p-1.5 md:p-2 rounded-full text-white hover:bg-white/20 outline-none transition-colors shrink-0" title="Refresh Stream"><RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4"/></button>
        </div>
      </div>
    </div>
  );
});

const LiveTvView=React.memo(({focus,setFocus})=>{
  const[view,setView]=useLS('ltv_v','sidebar');
  const[cols,setCols]=useLS('ltv_c',3);
  const[chOrder,setChOrder]=useLS('ltv_ord',LIVE_CH.map(c=>c.id));
  
  const orderedChannels = useMemo(()=>{
    const map = new Map(LIVE_CH.map(c=>[c.id,c]));
    const list = chOrder.map(id=>map.get(id)).filter(Boolean);
    LIVE_CH.forEach(c=>{if(!list.find(x=>x.id===c.id))list.push(c);});
    return list;
  }, [chOrder]);

  const[main,setMain]=useState(orderedChannels[0]?.id||LIVE_CH[0].id);
  const[audio,setAudio]=useState([orderedChannels[0]?.id||LIVE_CH[0].id]);
  const[vol,setVol]=useLS('ltv_vol',1);
  
  const[appIdle, setAppIdle]=useState(false);
  const appIdleTimer=useRef(null);

  const resetAppIdle = useCallback(() => {
    setAppIdle(false);
    clearTimeout(appIdleTimer.current);
    appIdleTimer.current = setTimeout(() => setAppIdle(true), 3000);
  }, []);

  useEffect(() => {
    resetAppIdle();
    return () => clearTimeout(appIdleTimer.current);
  }, [resetAppIdle, focus]);

  const reqAudio=useCallback(id=>setAudio(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]), []);
  const setFocusCh=useCallback(id=>{setMain(id);setAudio([id]);setView(v=>v==='grid'?'sidebar':v);},[setView]);
  
  const mainCh=orderedChannels.find(c=>c.id===main)||orderedChannels[0];
  const others=orderedChannels.filter(c=>c.id!==main);
  const colCls=['','grid-cols-1 w-full max-w-6xl mx-auto','grid-cols-2','grid-cols-2 md:grid-cols-3','grid-cols-2 md:grid-cols-4','grid-cols-3 md:grid-cols-5'][cols]||'grid-cols-3';

  const fsContainer = useRef(null);
  const dragItem = useRef(null);
  const[dragState, setDragState] = useState({ index: null, pos: null });

  useEffect(() => {
    const handleFSChange = () => { 
      if (!document.fullscreenElement) setFocus(false); 
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, [setFocus]);

  const toggleFocus = async () => {
    if (!focus) {
      setFocus(true);
      try { if (fsContainer.current && !document.fullscreenElement) await fsContainer.current.requestFullscreen(); } catch(err) {}
    } else {
      setFocus(false);
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch(err) {}
    }
  };

  const handleSort = () => {
    if (dragItem.current === null || dragState.index === null) return;
    const _ordered = [...orderedChannels];
    const dragged = _ordered.splice(dragItem.current, 1)[0];
    let targetIdx = dragState.index;
    if (dragItem.current < targetIdx) targetIdx--;
    if (dragState.pos === 'after') targetIdx++;

    _ordered.splice(targetIdx, 0, dragged);
    setChOrder(_ordered.map(c=>c.id));
    dragItem.current = null;
    setDragState({ index: null, pos: null });
  };

  const handleDragStart = (e, index) => { dragItem.current = index; e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = useCallback((e, index, layout) => {
    e.preventDefault(); e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isCol = layout === 'grid' ? false : window.innerWidth >= 1024;
    let pos = 'before';
    if (isCol) { pos = (e.clientY - rect.top) > rect.height / 2 ? 'after' : 'before'; }
    else { pos = (e.clientX - rect.left) > rect.width / 2 ? 'after' : 'before'; }
    if (dragState.index !== index || dragState.pos !== pos) setDragState({ index, pos });
  }, [dragState]);
  const handleDrop = (e) => { e.preventDefault(); handleSort(); };
  const handleDragEnd = () => { dragItem.current = null; setDragState({ index: null, pos: null }); };

  return(
    <div ref={fsContainer} onMouseMove={resetAppIdle} onTouchStart={resetAppIdle} className={cn('bg-[#050505] flex flex-col w-full overflow-hidden', focus ? 'fixed inset-0 z-[200] p-0 md:p-0' : 'h-[100dvh] pt-[72px] md:pt-[80px]')}>
      {!focus && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 px-4 md:px-12 lg:px-16 max-w-[1800px] mx-auto w-full pt-4 border-b border-white/10 shrink-0 pb-4">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 md:mb-0">Live TV</h2>
          <div className="flex gap-2 md:gap-4 overflow-x-auto pb-2 md:pb-0">
            {view==='grid'&&<div className="flex items-center gap-2 md:gap-3 bg-[#18181b] border border-white/10 px-3 md:px-5 py-2 md:py-2.5 rounded-full shrink-0"><span className="text-[13px] text-white/60 hidden sm:block font-bold">Cols</span><input type="range" min="1" max="5" value={cols} onChange={e=>setCols(+e.target.value)} className="w-16 md:w-20 cursor-pointer"/><span className="text-[13px] md:text-[14px] font-bold text-white w-4">{cols}</span></div>}
            <div className="bg-[#18181b] border border-white/10 p-1 md:p-1.5 rounded-full flex gap-1 md:gap-1.5 shadow-lg shrink-0">
              {[['grid',<LayoutGrid key="g" className="w-3.5 h-3.5 md:w-4 md:h-4"/>],['sidebar',<Sidebar key="s" className="w-3.5 h-3.5 md:w-4 md:h-4"/>],['single',<Square key="sq" className="w-3.5 h-3.5 md:w-4 md:h-4"/>]].map(([id,icon])=>(
                <button key={id} onClick={()=>setView(id)} className={cn('px-3 md:px-5 py-2 md:py-2.5 rounded-full text-[12px] md:text-[14px] font-bold transition-all outline-none flex items-center gap-1.5 md:gap-2 capitalize',view===id?'bg-[#27272a] text-white shadow-sm':'text-white/50 hover:text-white')}>
                  {icon}<span className="hidden sm:inline">{id}</span>
                </button>
              ))}
              <div className="w-px bg-white/10 self-stretch mx-0.5 md:mx-1 hidden sm:block"/>
              <button onClick={toggleFocus} className={cn('px-3 md:px-4 py-2 md:py-2.5 rounded-full text-[12px] md:text-[14px] font-bold transition-all outline-none flex items-center justify-center',focus?'bg-white/20 text-white':'text-white/50 hover:text-white')} title="Fullscreen Mode">
                <Maximize className="w-4 h-4 md:w-5 md:h-5"/>
              </button>
            </div>
          </div>
        </div>
      )}

      {focus && (
        <button onClick={toggleFocus} className={cn("absolute top-4 right-4 md:top-6 md:right-6 z-[250] bg-black/50 backdrop-blur-md border border-white/10 p-2.5 md:p-3 rounded-full text-white/80 hover:bg-white/20 hover:text-white transition-all duration-500 shadow-xl outline-none group", appIdle ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100 translate-y-0")} title="Exit Fullscreen">
          <Minimize className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-90 transition-transform"/>
        </button>
      )}

      <div className={cn("flex-1 flex flex-col min-h-0", !focus && "px-4 md:px-12 lg:px-16 max-w-[1800px] mx-auto w-full pb-4")}>
        {view==='sidebar'&&<div className="flex flex-col lg:flex-row gap-3 md:gap-4 lg:gap-6 h-full min-h-0 pt-4 md:pt-6">
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden w-full">
            <div className="w-full h-full max-h-full aspect-video relative rounded-xl md:rounded-2xl overflow-hidden shadow-2xl bg-black">
              <LiveTile ch={mainCh} isMain hasAudio={audio.includes(mainCh.id)} onAudio={reqAudio} vol={vol} onVol={setVol}/>
            </div>
          </div>
          <div className="h-28 sm:h-36 lg:h-auto lg:w-[280px] xl:w-[340px] flex-shrink-0 flex flex-row lg:flex-col gap-2 md:gap-3 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 pr-1 md:pr-2 scrollbar-hide">
            {others.map((c)=>{
              const index = orderedChannels.findIndex(x=>x.id===c.id);
              const isOver = dragState.index === index;
              const isDragObj = dragItem.current === index;
              const isCol = window.innerWidth >= 1024;
              return (
                <div key={c.id} 
                  className={cn("relative cursor-grab active:cursor-grabbing transition-transform duration-200 h-full w-auto aspect-video lg:w-full lg:h-auto flex-shrink-0", isDragObj && "opacity-50 scale-95")}
                  draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index, 'sidebar')} onDrop={handleDrop} onDragEnd={handleDragEnd}
                >
                  {isOver && dragState.pos === 'before' && isCol && <div className="absolute -top-1.5 left-0 right-0 h-1 bg-white rounded-full z-50 shadow-[0_0_8px_#fff] pointer-events-none" />}
                  {isOver && dragState.pos === 'after' && isCol && <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-white rounded-full z-50 shadow-[0_0_8px_#fff] pointer-events-none" />}
                  {isOver && dragState.pos === 'before' && !isCol && <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-white rounded-full z-50 shadow-[0_0_8px_#fff] pointer-events-none" />}
                  {isOver && dragState.pos === 'after' && !isCol && <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-white rounded-full z-50 shadow-[0_0_8px_#fff] pointer-events-none" />}
                  <LiveTile ch={c} isMain={false} onFocus={setFocusCh} hasAudio={audio.includes(c.id)} onAudio={reqAudio} vol={vol} onVol={setVol}/>
                </div>
              );
            })}
          </div>
        </div>}
        {view==='single'&&<div className="flex-1 min-h-0 w-full flex items-center justify-center mt-4 md:mt-6">
          <div className="w-full h-full max-h-full aspect-video relative rounded-xl md:rounded-2xl overflow-hidden shadow-2xl bg-black group">
            <div className={cn("absolute top-4 md:top-6 right-4 md:right-6 z-20 transition-all duration-500", appIdle ? "opacity-0 -translate-y-2 pointer-events-none" : "opacity-100 translate-y-0")}>
              <select value={mainCh.id} onChange={e=>setFocusCh(e.target.value)} className="cs bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-4 md:px-6 py-2.5 md:py-3 outline-none text-[14px] md:text-[15px] font-bold pr-10 md:pr-12 text-white shadow-xl cursor-pointer hover:bg-black/80 transition-colors">
                {orderedChannels.map(c=><option key={c.id} value={c.id} className="bg-[#121212]">{c.name}</option>)}
              </select>
            </div>
            <LiveTile ch={mainCh} isMain hasAudio={audio.includes(mainCh.id)} onAudio={reqAudio} vol={vol} onVol={setVol}/>
          </div>
        </div>}
        {view==='grid'&&<div className={cn('grid gap-3 md:gap-4 overflow-y-auto h-full min-h-0 pr-1 pt-4 md:pt-6 pb-28',colCls)}>
          {orderedChannels.map((c, index) => {
            const isOver = dragState.index === index;
            const isDragObj = dragItem.current === index;
            return (
              <div key={c.id} 
                className={cn("relative cursor-grab active:cursor-grabbing transition-transform duration-200 aspect-video flex-shrink-0", isDragObj && "opacity-50 scale-95")}
                draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index, 'grid')} onDrop={handleDrop} onDragEnd={handleDragEnd}
              >
                {isOver && dragState.pos === 'before' && <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-white rounded-full z-50 shadow-[0_0_8px_#fff] pointer-events-none" />}
                {isOver && dragState.pos === 'after' && <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-white rounded-full z-50 shadow-[0_0_8px_#fff] pointer-events-none" />}
                <LiveTile ch={c} isMain={false} onFocus={setFocusCh} hasAudio={audio.includes(c.id)} onAudio={reqAudio} vol={vol} onVol={setVol}/>
              </div>
            );
          })}
        </div>}
      </div>
    </div>
  );
});

// ─── SPORTS ──────────────────────────────────────────────────────────────────
const fmtSport=n=>{if(!n)return'';const m={'football':'Soccer','american-football':'NFL','basketball':'NBA','baseball':'MLB','hockey':'NHL','tennis':'Tennis','mma':'MMA','boxing':'Boxing','cricket':'Cricket','rugby':'Rugby','motor-sports':'Motorsport','wrestling':'Wrestling'};return m[n.toLowerCase()]||n.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');};
const fetchTeamLogo=async(teamName)=>{if(!teamName)return null;try{const res=await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`);const data=await res.json();return data.teams?.[0]?.strTeamBadge||null;}catch{return null;}};
const SportCard=({match,live,fmtT,onPlay})=>{
  const[homeLogo,setHomeLogo]=useState(null);
  const[awayLogo,setAwayLogo]=useState(null);
  useEffect(()=>{if(match.teams?.home&&!match.teams.home.badge)fetchTeamLogo(match.teams.home.name).then(logo=>{if(logo)setHomeLogo(logo);});if(match.teams?.away&&!match.teams.away.badge)fetchTeamLogo(match.teams.away.name).then(logo=>{if(logo)setAwayLogo(logo);});},[match]);
  const isGeneric=!match.teams?.home||!match.teams?.away;
  const hBadge=match.teams?.home?.badge?`https://streamed.pk/api/images/badge/${match.teams.home.badge}.webp`:homeLogo;
  const aBadge=match.teams?.away?.badge?`https://streamed.pk/api/images/badge/${match.teams.away.badge}.webp`:awayLogo;
  return(
    <div onClick={()=>onPlay(match)} className="flex flex-col gap-3 group cursor-pointer outline-none w-full relative" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onPlay(match);}}>
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden aspect-[16/9] bg-[#121212] border border-white/5 hover:border-white/20 transition-all duration-300 flex flex-col items-center justify-center p-3 md:p-5 shadow-md hover:shadow-xl hover:-translate-y-1">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1c] to-[#0a0a0c] opacity-80 pointer-events-none"/>
        <div className="absolute top-3 left-3 md:top-4 md:left-5 z-10"><span className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-white/50">{fmtSport(match.category)}</span></div>
        <div className="absolute top-3 right-3 md:top-4 md:right-5 z-10">
          {live?(
            <div className="flex items-center gap-1.5 text-[9px] md:text-[11px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-2 md:px-2.5 py-1 rounded-md border border-red-500/20 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500"/>LIVE
            </div>
          ):(
            <span className="text-[10px] md:text-[12px] font-bold text-white/50">{fmtT(match.date)}</span>
          )}
        </div>
        {!isGeneric?(
          <div className="flex items-center justify-between w-full mt-4 relative z-10 px-1 md:px-2">
            <div className="flex flex-col items-center gap-2 w-[42%]">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-[#18181b] flex items-center justify-center overflow-hidden p-1.5 md:p-2.5 border border-white/10 shadow-sm shrink-0 relative">
                <div className="absolute inset-0 rounded-full bg-white/5 pointer-events-none"/>
                {hBadge?<img src={hBadge} className="max-w-full max-h-full object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.85)] relative z-10" alt="" onError={e=>{e.target.style.display='none';}}/>:<span className="text-lg md:text-xl font-black text-white/30 relative z-10">{match.teams.home.name?.[0]||'?'}</span>}
              </div>
              <span className="text-white/90 font-bold text-[11px] md:text-[14px] text-center line-clamp-2 leading-tight px-1">{match.teams.home.name}</span>
            </div>
            <div className="text-white/20 font-black text-sm italic w-[16%] text-center select-none">VS</div>
            <div className="flex flex-col items-center gap-2 w-[42%]">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-[#18181b] flex items-center justify-center overflow-hidden p-1.5 md:p-2.5 border border-white/10 shadow-sm shrink-0 relative">
                <div className="absolute inset-0 rounded-full bg-white/5 pointer-events-none"/>
                {aBadge?<img src={aBadge} className="max-w-full max-h-full object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.85)] relative z-10" alt="" onError={e=>{e.target.style.display='none';}}/>:<span className="text-lg md:text-xl font-black text-white/30 relative z-10">{match.teams.away.name?.[0]||'?'}</span>}
              </div>
              <span className="text-white/90 font-bold text-[11px] md:text-[14px] text-center line-clamp-2 leading-tight px-1">{match.teams.away.name}</span>
            </div>
          </div>
        ):(
          <div className="flex flex-col items-center justify-center h-full relative z-10 w-full px-4">
            <h3 className="text-white/90 font-bold text-[14px] md:text-[18px] text-center leading-snug">{String(match.title||match.name)}</h3>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 backdrop-blur-[2px]">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-black flex items-center justify-center transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-2xl">
            <Play className="w-5 h-5 md:w-6 md:h-6 fill-current ml-1"/>
          </div>
        </div>
      </div>
    </div>
  );
};
const CANADIAN_SPORTS=['NHL','NBA','Soccer','MLB','NFL'];
const displaySport=(s)=>({'NHL':'Hockey','NBA':'Basketball','NFL':'Football','MLB':'Baseball','Soccer':'Soccer'})[s]||s;
const SportsView=React.memo(({apiKey,onPlay,onCard})=>{
  const[allLive,setAllLive]=useState([]);
  const[loadLive,setLoadLive]=useState(true);
  const[cat,setCat]=useState('All');
  const[searchQuery,setSearchQuery]=useState('');
  const[replayData,setReplayData]=useState(null);
  const[loadingReplays,setLoadingReplays]=useState(false);
  useEffect(()=>{
    let ok=true;
    (async()=>{
      try{
        const d=await fetch2('https://streamed.pk/api/matches/all');
        let md=[];
        if(Array.isArray(d))md=d;else if(typeof d==='object')Object.values(d).forEach(v=>{if(Array.isArray(v))md.push(...v);});
        const um=new Map();
        md.forEach(m=>{const k=m.teams?.home&&m.teams?.away?[m.teams.home.name,m.teams.away.name].sort().join('|'):(m.title||m.id||'').trim();if(!k)return;const ex=um.get(k);if(!ex||(m.teams?.home?.badge&&!ex.teams?.home?.badge))um.set(k,m);});
        if(ok)setAllLive(Array.from(um.values()).filter(m=>!m.isReplay&&m.category!=='wrestling'));
      }catch{}
      if(ok)setLoadLive(false);
    })();
    return()=>{ok=false;};
  },[]);
  useEffect(()=>{
    if(cat!=='Replays'||replayData)return;
    let ok=true;setLoadingReplays(true);
    const isNonGame=(t)=>{if(!t)return true;const lower=t.toLowerCase();return lower.includes('countdown')||lower.includes('embedded')||lower.includes('weigh-in')||lower.includes('weigh in')||lower.includes('press conference')||lower.includes('documentary')||lower.includes('road to')||lower.includes('story of')||lower.includes('q&a');};
    const exGen=[99,18,35,16,80,27,878,10751,10749,14,10402,9648,10752,37];
    (async()=>{
      try{
        let ufcPPV=[],ufcFN=[];
        try{const ufcRes=await fetch2(`${BASE}/person/108222/combined_credits?api_key=${apiKey}`);if(ufcRes&&ok){const combined=[...(ufcRes.cast||[]),...(ufcRes.crew||[])];const uniqueUfc=new Map();combined.forEach(m=>{if(m.poster_path&&!uniqueUfc.has(m.id))uniqueUfc.set(m.id,m);});const cleanUfc=Array.from(uniqueUfc.values()).filter(m=>{if(m.genre_ids?.some(g=>exGen.includes(g)))return false;return!isNonGame(m.title||m.name);});cleanUfc.sort((a,b)=>new Date(b.release_date||b.first_air_date||0)-new Date(a.release_date||a.first_air_date||0));ufcPPV=cleanUfc.filter(m=>/^UFC\s\d+(?::|$)/i.test(m.title||m.name)).slice(0,20);ufcFN=cleanUfc.filter(m=>/^UFC Fight Night/i.test(m.title||m.name)).slice(0,20);}}catch(e){}
        const fetchWithActors=async(queries,pages=1,titleRegex=null)=>{let results=[];for(const q of queries){for(let p=1;p<=pages;p++){try{const res=await fetch2(`${BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(q)}&page=${p}`);if(res.results)results.push(...res.results);}catch(e){}}}const unique=new Map();results.forEach(m=>{if(m.poster_path&&(m.media_type==='movie'||m.media_type==='tv')){const t=m.title||m.name;if(!unique.has(m.id)&&!m.genre_ids?.some(g=>exGen.includes(g))&&!isNonGame(t)){if(!titleRegex||titleRegex.test(t)){unique.set(m.id,m);}}}});const candidates=Array.from(unique.values()).sort((a,b)=>new Date(b.release_date||b.first_air_date||0)-new Date(a.release_date||a.first_air_date||0)).slice(0,40);const validated=[];for(const m of candidates){try{const det=await fetch2(`${BASE}/${m.media_type}/${m.id}?api_key=${apiKey}&append_to_response=credits`);if(det.credits?.cast?.length>0)validated.push(m);}catch(e){}}return validated.sort((a,b)=>new Date(b.release_date||b.first_air_date||0)-new Date(a.release_date||a.first_air_date||0));};
        const[wweValid,luchaValid]=await Promise.all([fetchWithActors(['WrestleMania','Royal Rumble','SummerSlam','Survivor Series','Money in the Bank','WWE Raw','WWE SmackDown','WWE Clash','WWE Backlash'],2),fetchWithActors(['CMLL'],1,/CMLL/i)]);
        if(ok)setReplayData({ufcPPV,ufcFN,wwe:wweValid,lucha:luchaValid});
      }catch(e){}
      if(ok)setLoadingReplays(false);
    })();
    return()=>{ok=false;};
  },[cat,apiKey,replayData]);
  const isLive=useCallback(d=>{const n=Date.now(),m=new Date(d).getTime();return n>=m&&n<=m+10800000;},[]);
  const fmtT=d=>{const dt=new Date(d),t=new Date(),tm=new Date();tm.setDate(tm.getDate()+1);const ts=dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(dt.toDateString()===t.toDateString())return`Today ${ts}`;if(dt.toDateString()===tm.toDateString())return`Tomorrow ${ts}`;return`${dt.toLocaleDateString([],{month:'short',day:'numeric'})} ${ts}`;};
  const liveSportsCount=useMemo(()=>{const counts={};allLive.forEach(m=>{const s=fmtSport(m.category);counts[s]=(counts[s]||0)+1;});return counts;},[allLive]);
  const tabs=useMemo(()=>{const activeSports=CANADIAN_SPORTS.filter(s=>liveSportsCount[s]>=5);return['All',...activeSports.slice(0,5),'Replays'];},[liveSportsCount]);
  const sortedLive=useMemo(()=>{let filtered=allLive;if(cat!=='All'&&cat!=='Replays')filtered=allLive.filter(m=>fmtSport(m.category)===cat);if(searchQuery.trim()){const q=searchQuery.toLowerCase();filtered=filtered.filter(m=>(m.teams?.home?.name||'').toLowerCase().includes(q)||(m.teams?.away?.name||'').toLowerCase().includes(q)||(m.title||m.name||'').toLowerCase().includes(q)||fmtSport(m.category).toLowerCase().includes(q));}return filtered.sort((a,b)=>{const aLive=isLive(a.date);const bLive=isLive(b.date);if(aLive!==bLive)return aLive?-1:1;if(cat==='All'){const getPri=(m)=>{const idx=CANADIAN_SPORTS.indexOf(fmtSport(m.category));return idx!==-1?idx:999;};const pA=getPri(a);const pB=getPri(b);if(pA!==pB)return pA-pB;}return new Date(a.date)-new Date(b.date);});},[allLive,isLive,cat,searchQuery]);
  const filteredReplays=useCallback((data)=>{if(!searchQuery.trim())return data;const q=searchQuery.toLowerCase();return data.filter(m=>(m.title||m.name||'').toLowerCase().includes(q));},[searchQuery]);
  return(
    <div className="pt-20 md:pt-32 min-h-screen bg-[#050505] pb-28 au">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 px-4 md:px-12 lg:px-16 max-w-[1800px] mx-auto mb-8 md:mb-10 pt-4 border-b border-white/10">
        <div className="flex gap-5 md:gap-6 overflow-x-auto pr-4 pt-2 w-full md:w-auto">
          {tabs.map(s=>(
            <button key={s} onClick={()=>setCat(s)} className={cn('text-[14px] md:text-[16px] font-bold tracking-wide whitespace-nowrap outline-none transition-all relative pb-3 md:pb-4',cat===s?'text-white':'text-white/40 hover:text-white/80')}>
              {displaySport(s)}{cat===s&&<div className="absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"/>}
            </button>
          ))}
        </div>
        <div className="relative shrink-0 w-full md:w-56 mb-3 md:mb-2">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"/>
          <input type="text" placeholder="Search events..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full bg-transparent border border-transparent border-b-white/20 text-white pl-7 pr-7 py-2 outline-none placeholder:text-white/30 focus:border-b-white/70 text-[13px] md:text-[14px] font-medium transition-all"/>
          {searchQuery&&<button onClick={()=>setSearchQuery('')} className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 hover:text-white outline-none"><X className="w-4 h-4"/></button>}
        </div>
      </div>
      {cat==='Replays'?(
        <div className="w-full">
          {loadingReplays?(<div className="py-32 flex justify-center"><Spin sz={8}/></div>):replayData?(<>
            {replayData.ufcPPV?.length>0&&filteredReplays(replayData.ufcPPV).length>0&&<Row title="UFC Pay-Per-Views" data={filteredReplays(replayData.ufcPPV)} onCard={onCard} apiKey={apiKey} isReplay={true}/>}
            {replayData.ufcFN?.length>0&&filteredReplays(replayData.ufcFN).length>0&&<Row title="UFC Fight Nights" data={filteredReplays(replayData.ufcFN)} onCard={onCard} apiKey={apiKey} isReplay={true}/>}
            {replayData.wwe?.length>0&&filteredReplays(replayData.wwe).length>0&&<Row title="WWE Premium Live Events" data={filteredReplays(replayData.wwe)} onCard={onCard} apiKey={apiKey} isReplay={true}/>}
            {replayData.lucha?.length>0&&filteredReplays(replayData.lucha).length>0&&<Row title="Lucha Libre" data={filteredReplays(replayData.lucha)} onCard={onCard} apiKey={apiKey} isReplay={true}/>}
          </>):null}
        </div>
      ):(
        <div className="px-4 md:px-12 lg:px-16 max-w-[1800px] mx-auto">
          {loadLive?(<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">{[...Array(8)].map((_,i)=><div key={i} className="aspect-[16/9] sk rounded-2xl md:rounded-[2rem]"/>)}</div>):(
            <>
              {sortedLive.length>0&&(
                <div className="mb-12">
                  <h2 className="text-lg md:text-2xl font-bold tracking-tight text-white mb-5 md:mb-6 flex items-center gap-3">
                    {cat==='All'?'Live & Upcoming Events':`${displaySport(cat)} Events`}
                    {sortedLive.some(m=>isLive(m.date))&&<span className="text-[11px] md:text-[12px] text-red-500 bg-red-500/10 px-2.5 md:px-3 py-1 md:py-1.5 rounded-md font-bold border border-red-500/20"><div className="w-1.5 h-1.5 rounded-full bg-red-500 lp inline-block mr-1.5"/>{sortedLive.filter(m=>isLive(m.date)).length} Live</span>}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {sortedLive.map(m=><SportCard key={m.id} match={m} live={isLive(m.date)} fmtT={fmtT} onPlay={onPlay}/>)}
                  </div>
                </div>
              )}
              {sortedLive.length===0&&(<div className="py-32 flex flex-col items-center text-white/30"><Dribbble className="w-14 h-14 md:w-16 md:h-16 mb-4 opacity-20"/><p className="text-[14px] md:text-[15px] font-bold">No events currently scheduled</p></div>)}
            </>
          )}
        </div>
      )}
    </div>
  );
});

// ─── SKIP TIMESTAMPS ─────────────────────────────────────────────────────────
const SkipBtn=React.memo(({mediaId,isTv,season,episode,elapsed,onSkip,settings})=>{
  const[ts,setTs]=useState(null),[seg,setSeg]=useState(null),[vis,setVis]=useState(false);
  const[autoSkipped,setAS]=useState({});const dismissed=useRef({});const prevKey=useRef(null);const ht=useRef(null);
  useEffect(()=>{if(!settings?.enabled||!mediaId)return;let ok=true;(async()=>{try{let url,data;if(isTv&&season&&episode){url=`${INTRODB}/show/${mediaId}/season/${season}/episode/${episode}`;const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(r.ok)data=await r.json();}else if(!isTv){url=`${INTRODB}/movie/${mediaId}`;const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(r.ok)data=await r.json();}if(!ok||!data)return;const norm={};const toMs=v=>v>10000?v:v*1000;if(Array.isArray(data?.timestamps))data.timestamps.forEach(t=>{if(t.type)norm[t.type]={startMs:toMs(t.start??t.startTime??0),endMs:toMs(t.end??t.endTime??0)};});else['intro','recap','credits','preview','outro','opening','ending'].forEach(k=>{const s=data[k];if(!s)return;const sm=s.start_ms??toMs(s.startTime??s.start??0);const em=s.end_ms??toMs(s.endTime??s.end??0);if(em>sm)norm[k]={startMs:sm,endMs:em};});if(ok&&Object.keys(norm).length)setTs(norm);}catch{}})();return()=>{ok=false;};},[mediaId,isTv,season,episode,settings?.enabled]);
  useEffect(()=>{setTs(null);setSeg(null);setVis(false);setAS({});dismissed.current={};clearTimeout(ht.current);prevKey.current=null;},[mediaId,season,episode]);
  useEffect(()=>{if(!ts||!settings?.enabled)return;const elMs=elapsed*1000;const types=[['intro',settings.showIntro],['recap',settings.showRecap],['credits',settings.showCredits],['preview',settings.showPreview],['outro',settings.showCredits],['opening',settings.showIntro],['ending',settings.showCredits]];let found=null;for(const[type,en]of types){if(!en)continue;const s=ts[type];if(!s)continue;const k=`${type}_${s.startMs}`;if(dismissed.current[k])continue;if(elMs>=s.startMs&&elMs<=s.endMs){found={type,key:k,...s};break;}}if(found?.key!==prevKey.current){prevKey.current=found?.key||null;setSeg(found);if(found){if(settings.autoSkip&&!autoSkipped[found.key]){setAS(p=>({...p,[found.key]:true}));dismissed.current[found.key]=true;onSkip(Math.floor(found.endMs/1000));}else{setVis(true);clearTimeout(ht.current);ht.current=setTimeout(()=>setVis(false),(settings.buttonDuration||7)*1000);}}else setVis(false);}},[elapsed,ts,settings,autoSkipped,onSkip]);
  const skip=()=>{if(!seg)return;dismissed.current[seg.key]=true;setVis(false);setSeg(null);prevKey.current=null;clearTimeout(ht.current);onSkip(Math.floor(seg.endMs/1000));};
  const labels={intro:'Skip Intro',recap:'Skip Recap',credits:'Skip Credits',preview:'Skip Preview',outro:'Skip Credits',opening:'Skip Intro',ending:'Skip Credits'};
  if(!vis||!seg||!settings?.enabled)return null;
  return(
    <div className="absolute bottom-20 md:bottom-24 right-4 md:right-10 z-50 au">
      <button onClick={skip} className="flex items-center gap-2 md:gap-3 bg-white text-black px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-[14px] md:text-[15px] transition-all shadow-2xl outline-none group hover:scale-105">
        {labels[seg.type]||'Skip'}<SkipForward className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform"/>
      </button>
    </div>
  );
});

// ─── PLAYER ──────────────────────────────────────────────────────────────────
const Player=({media,config,onClose,sourceKey,vpSettings,skipSettings})=>{
  const[loading,setLoading]=useState(true),[err,setErr]=useState(false),[showCtrl,setShowCtrl]=useState(true);
  const[src,setSrc]=useState(''),[srcKey,setSrcKey]=useState('videasy'),[ifrKey,setIfrKey]=useState(0);
  const[elapsed,setElapsed]=useState(0),[skipTime,setSkipTime]=useState(0);
  const vRef=useRef(null),ctrlT=useRef(null),elT=useRef(null),elO=useRef(null),loadT=useRef(null),m=useRef(true);
  const elapsedRef=useRef(0);
  const isLive=media.isLive;
  const isTv=!isLive&&(media.media_type==='tv'||(!media.release_date&&media.name));
  const cfg=config||{season:1,episode:1};
  useEffect(()=>{elapsedRef.current=elapsed;},[elapsed]);
  useEffect(()=>{m.current=true;lock();return()=>{m.current=false;unlock();};},[]);
  useEffect(()=>{const h=e=>{if(e.key==='Escape')onClose(elapsedRef.current);};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[onClose]);
  const buildSrc=useCallback((sk,st=0)=>{
    if(isLive)return media.url||'';
    const id=media.id;if(!id)return'';
    const{season:s=1,episode:e=1}=cfg;
    const t=isTv?'tv':'movie';
    const fn=SOURCES[sk]?.url;
    if(!fn)return'';
    let url=fn(t,id,s,e);
    if(st>0)url+=`&progress=${Math.floor(st)}`;
    return url;
  },[isLive,isTv,media,cfg]);
  useEffect(()=>{
    setLoading(true);setErr(false);
    setSrc(buildSrc(srcKey,0));setSkipTime(0);setElapsed(0);
    clearInterval(elT.current);clearTimeout(loadT.current);
    loadT.current=setTimeout(()=>{if(m.current&&!isLive)setLoading(false);},15000);
  },[srcKey,buildSrc,isLive]);
  const startElapsed=useCallback((from=0)=>{clearInterval(elT.current);elO.current=Date.now()-from*1000;elT.current=setInterval(()=>{if(m.current)setElapsed(Math.floor((Date.now()-elO.current)/1000));},500);},[]);
  useEffect(()=>()=>{clearInterval(elT.current);clearTimeout(loadT.current);},[]);
  useEffect(()=>{
    const handleMessage=(e)=>{
      try{
        const data=typeof e.data==='string'?JSON.parse(e.data):e.data;
        if(data&&typeof data.timestamp==='number'){if(m.current)setElapsed(Math.floor(data.timestamp));}
      }catch(err){}
    };
    window.addEventListener('message',handleMessage);
    return()=>window.removeEventListener('message',handleMessage);
  },[]);
  const onLoad=useCallback(()=>{if(!m.current)return;clearTimeout(loadT.current);setLoading(false);setErr(false);startElapsed(skipTime);},[skipTime,startElapsed]);
  const onSkipTo=useCallback(endSec=>{if(!m.current)return;setSrc(buildSrc(srcKey,endSec));setSkipTime(endSec);setIfrKey(k=>k+1);setLoading(true);setErr(false);clearTimeout(loadT.current);loadT.current=setTimeout(()=>{if(m.current)setLoading(false);},15000);startElapsed(endSec);setElapsed(endSec);},[srcKey,buildSrc,startElapsed]);
  useEffect(()=>{if(!isLive||!src?.includes?.('.m3u8'))return;let hls;loadHls(()=>{setLoading(false);const v=vRef.current;if(!v)return;hls=initHls(v,src,true,{onParsed:()=>v.play().catch(()=>{}),onError:(e,d)=>{if(d.fatal){if(hls&&d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR)hls.startLoad();else if(hls&&d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR)hls.recoverMediaError();else{if(hls)hls.destroy();setErr(true);}}}});});return()=>{if(hls)hls.destroy();};},[isLive,src]);
  const mMove=useCallback(()=>{setShowCtrl(true);clearTimeout(ctrlT.current);ctrlT.current=setTimeout(()=>{if(m.current)setShowCtrl(false);},3500);},[]);
  useEffect(()=>{window.addEventListener('mousemove',mMove);window.addEventListener('touchstart',mMove,{passive:true});mMove();return()=>{window.removeEventListener('mousemove',mMove);window.removeEventListener('touchstart',mMove);clearTimeout(ctrlT.current);};},[mMove]);
  const handleClose=()=>onClose(elapsedRef.current);
  return(
    <div className="fixed inset-0 z-[200] bg-black flex flex-col" style={{animation:'fadeUp .4s cubic-bezier(0.16,1,0.3,1) both'}}>
      {loading&&!isLive&&(
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 pointer-events-none">
          <Spin sz={12}/><p className="text-white/50 text-[14px] md:text-[16px] font-bold mt-6 tracking-wide uppercase">{SOURCES[srcKey]?.name||'Loading'}</p>
        </div>
      )}
      {!showCtrl&&(
        <div className="absolute top-0 left-0 right-0 h-32 z-40" onMouseEnter={mMove} onMouseMove={mMove} onTouchStart={mMove}/>
      )}
      <div className={cn('absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 md:p-8 bg-gradient-to-b from-black/90 to-transparent transition-opacity duration-500',showCtrl?'opacity-100 pointer-events-auto':'opacity-0 pointer-events-none')}>
        <button onClick={handleClose} className="flex items-center gap-2 md:gap-3 bg-[#18181b] border border-white/10 text-white hover:bg-white hover:text-black px-5 md:px-6 py-3 md:py-3.5 rounded-full font-bold text-[14px] md:text-[15px] transition-all outline-none shadow-2xl hover:scale-105">
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5"/>Back
        </button>
        {isLive&&<div className="flex items-center gap-2 md:gap-3 bg-black/60 border border-white/10 px-4 md:px-6 py-2.5 md:py-3 rounded-full shadow-lg"><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-600 lp"/><span className="text-white text-[13px] md:text-[15px] font-bold">{String(media.name||'Live Stream')}</span></div>}
      </div>
      <div className="flex-1 relative bg-black">
        {isLive&&media.type==='iframe'&&<iframe src={src} className="w-full h-full border-0" allowFullScreen allow="autoplay; fullscreen; encrypted-media" onLoad={()=>{if(m.current)setLoading(false);}}/>}
        {isLive&&src?.includes?.('.m3u8')&&<video ref={vRef} controls autoPlay playsInline className="w-full h-full outline-none"/>}
        {!isLive&&(
          <iframe key={ifrKey} src={src} className="w-full h-full border-0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen referrerPolicy="origin"
            onLoad={onLoad} onError={()=>{if(m.current){setErr(true);setLoading(false);}}}
            title="Media Player"/>
        )}
        {err&&!isLive&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-20 px-6">
            <AlertCircle className="w-12 h-12 md:w-16 md:h-16 text-white/30 mb-6"/>
            <p className="text-white text-xl md:text-2xl font-bold mb-3 tracking-tight text-center">Stream Unavailable</p>
            <p className="text-white/50 text-[14px] md:text-[16px] mb-10 font-medium text-center">Please check your connection and try again.</p>
            <button onClick={()=>{setErr(false);setIfrKey(k=>k+1);setLoading(true);loadT.current=setTimeout(()=>{if(m.current)setLoading(false);},15000);}} className="px-8 md:px-10 py-3.5 md:py-4 bg-white/10 border border-white/10 text-white rounded-full font-bold text-[14px] md:text-[15px] hover:bg-white/20 outline-none transition-all">Retry</button>
          </div>
        )}
      </div>
      {!isLive&&skipSettings?.enabled&&<SkipBtn mediaId={media.id} isTv={isTv} season={cfg.season} episode={cfg.episode} elapsed={elapsed} onSkip={onSkipTo} settings={skipSettings}/>}
    </div>
  );
};

// ─── PERSON MODAL ────────────────────────────────────────────────────────────
const PersonModal=({id,apiKey,onClose,onCard})=>{
  const[det,setDet]=useState(null),[cred,setCred]=useState([]);
  useEffect(()=>{lock();return()=>unlock();},[]);
  useEffect(()=>{if(!id||!apiKey)return;let ok=true;(async()=>{try{const[d,c]=await Promise.all([fetch2(`${BASE}/person/${id}?api_key=${apiKey}`),fetch2(`${BASE}/person/${id}/combined_credits?api_key=${apiKey}`)]);if(!ok)return;setDet(d);setCred(Array.from(new Map((c.cast?.filter(x=>x.poster_path).sort((a,b)=>(b.popularity||0)-(a.popularity||0))||[]).map(i=>[i.id,i])).values()).slice(0,14));}catch{}})();return()=>{ok=false;};},[id,apiKey]);
  if(!det)return<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80"><Spin sz={10}/></div>;
  return(
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-10 au">
      <div className="absolute inset-0 bg-black/90" onClick={onClose}/>
      <div className="relative bg-[#050505] md:border border-white/10 w-full md:max-w-[1100px] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] as">
        <button onClick={onClose} className="absolute top-4 right-4 md:top-6 md:right-6 p-3.5 md:p-4 bg-[#18181b] border border-white/5 rounded-full text-white z-10 hover:bg-white hover:text-black transition-all outline-none"><X className="w-5 h-5 md:w-6 md:h-6"/></button>
        <div className="p-6 pt-14 md:p-16 flex flex-col md:flex-row gap-8 md:gap-12 overflow-y-auto scrollbar-hide">
          <div className="md:w-72 shrink-0 flex flex-col items-center md:items-start">
            <div className="w-32 h-32 md:w-72 md:h-72 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl mb-6 md:mb-8 bg-[#18181b] border border-white/5">
              {det.profile_path?<img src={`${IMG}w500${det.profile_path}`} className="w-full h-full object-cover" alt="" decoding="async"/>:<div className="w-full h-full flex items-center justify-center"><User className="w-16 h-16 md:w-20 md:h-20 text-white/20"/></div>}
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-white text-center md:text-left tracking-tight leading-tight">{det.name}</h2>
            {det.known_for_department&&<p className="text-white/60 text-[13px] md:text-[16px] font-bold mt-2 md:mt-3 uppercase tracking-widest">{det.known_for_department}</p>}
            {det.birthday&&<p className="text-white/40 text-[13px] md:text-[15px] mt-1 md:mt-2 font-medium">b. {fmtDate(det.birthday)}</p>}
          </div>
          <div className="flex-1 space-y-8 md:space-y-12">
            {det.biography&&<div><h3 className="text-white text-xl md:text-2xl font-bold mb-3 md:mb-4 tracking-tight">Biography</h3><p className="text-white/80 text-[14px] md:text-[18px] leading-relaxed line-clamp-5 hover:line-clamp-none cursor-pointer transition-all font-medium">{det.biography}</p></div>}
            <div><h3 className="text-white text-xl md:text-2xl font-bold mb-4 md:mb-6 tracking-tight">Known For</h3><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 md:gap-x-5 gap-y-6 md:gap-y-8">{cred.map(m=><PosterCard key={m.id} media={m} onClick={x=>{onCard(x);onClose();}}/>)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DETAIL MODAL ────────────────────────────────────────────────────────────
const DetailModal=({media,onClose,onPlay,isOpen,toggleWL,inWL,apiKey,omdbKey,onPerson,onCard})=>{
  const[det,setDet]=useState(null),[omdb,setOmdb]=useState(null),[trailer,setTrailer]=useState(null);
  const[season,setSeason]=useState(1),[eps,setEps]=useState([]),[similar,setSimilar]=useState([]);
  const[loading,setLoading]=useState(true),[showTr,setShowTr]=useState(false);
  const[spoilers,setSpoilers]=useState({}),[tab,setTab]=useState('overview'),[epsLoad,setEpsLoad]=useState(true);
  useEffect(()=>{if(isOpen)lock();else unlock();return()=>unlock();},[isOpen]);
  useEffect(()=>{
    if(!isOpen||!media||!apiKey||media.isLive)return;
    setLoading(true);setDet(null);setOmdb(null);setTrailer(null);setEps([]);setShowTr(false);setTab('overview');setSpoilers({});
    setSeason(JSON.parse(localStorage.getItem(`ses_${media.id}`)||'1'));
    let ok=true;
    (async()=>{
      try{
        const t=media.media_type==='tv'||(!media.release_date&&media.name)?'tv':'movie';
        const d=await fetch2(`${BASE}/${t}/${media.id}?api_key=${apiKey}&append_to_response=credits,similar,videos,external_ids,images`);
        if(!ok)return;setDet(d);
        const vt=d.videos?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube'&&v.official)||d.videos?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube');
        if(vt)setTrailer(vt.key);
        const imdb=d.imdb_id||d.external_ids?.imdb_id;
        if(omdbKey&&imdb){const o=await fetch2(`https://www.omdbapi.com/?i=${imdb}&apikey=${omdbKey}`);if(ok&&o&&!o.Error)setOmdb(o);}
        setSimilar(Array.from(new Map((d.similar?.results?.filter(i=>i.poster_path)||[]).map(i=>[i.id,i])).values()).slice(0,14));
      }catch{}
      if(ok)setLoading(false);
    })();return()=>{ok=false;};
  },[isOpen,media,apiKey,omdbKey]);
  useEffect(()=>{
    const isTvM=det&&(media?.media_type==='tv'||(!media?.release_date&&media?.name));
    if(!isTvM||media?.isLive||!apiKey||!det||tab!=='episodes')return;
    let ok=true;setEpsLoad(true);
    (async()=>{try{const d=await fetch2(`${BASE}/tv/${media.id}/season/${season}?api_key=${apiKey}`);if(ok)setEps(d.episodes||[]);}catch{if(ok)setEps([]);}finally{if(ok)setEpsLoad(false);}})();return()=>{ok=false;};
  },[season,media,apiKey,det,tab]);
  if(!isOpen||!media||media.isLive)return null;
  const isTv=det?(det.number_of_seasons>0):media.media_type==='tv';
  const bg=`${IMG}original${media.backdrop_path||media.poster_path}`;
  const cast=Array.from(new Map(det?.credits?.cast?.map(p=>[p.id,p])||[]).values()).slice(0,12);
  const imdb=omdb?.imdbRating&&omdb.imdbRating!=='N/A'?omdb.imdbRating:null;
  const rt=omdb?.Ratings?.find(r=>r.Source==='Rotten Tomatoes')?.Value;
  const meta=omdb?.Metascore&&omdb.Metascore!=='N/A'?omdb.Metascore:null;
  const tmdb=media.vote_average>0?media.vote_average.toFixed(1):null;
  const genres=(det?.genres||[]).map(g=>g.name);
  const runtime=det?.runtime?`${Math.floor(det.runtime/60)}h ${det.runtime%60}m`:det?.number_of_seasons?`${det.number_of_seasons} Season${det.number_of_seasons>1?'s':''}`:null;
  const logos=det?.images?.logos||[];
  let bestLogo=logos.find(l=>l.iso_639_1==='en'&&l.aspect_ratio>1.8)||logos.find(l=>l.iso_639_1==='en'&&l.aspect_ratio>1)||logos.find(l=>l.aspect_ratio>1.5)||logos[0];
  const logoUrl=bestLogo?bestLogo.file_path:null;
  return(
    <div className="fixed inset-0 z-[80] bg-black overflow-hidden" style={{animation:'fadeUp .3s ease both'}}>
      <button onClick={onClose} className="fixed top-4 right-4 md:top-6 md:right-6 p-3.5 md:p-4 bg-white/5 border border-white/10 rounded-full text-white z-[170] shadow-2xl outline-none transition-all hover:bg-white hover:text-black hover:scale-110"><X className="w-5 h-5 md:w-6 md:h-6"/></button>
      {showTr&&trailer&&(
        <div className="fixed inset-0 z-[180] bg-black/95 flex items-center justify-center" style={{animation:'scaleIn .2s ease both'}}>
          <button onClick={()=>setShowTr(false)} className="absolute top-4 right-4 md:top-6 md:right-6 p-3.5 md:p-4 bg-white/10 rounded-full text-white hover:bg-white hover:text-black outline-none z-10 transition-all"><X className="w-5 h-5 md:w-6 md:h-6"/></button>
          <div className="w-full max-w-6xl px-4">
            <div style={{position:'relative',paddingTop:'56.25%',borderRadius:'1.5rem',overflow:'hidden',boxShadow:'0 30px 60px rgba(0,0,0,0.6)'}}>
              <iframe style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}} src={`https://tube.rvere.com/embed?v=${trailer}&autoplay=1&rel=0`} title="Trailer" allowFullScreen allow="autoplay;fullscreen"/>
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover object-top opacity-50 scale-[1.01]" decoding="async"/>
        <div className="absolute top-0 left-0 w-full h-[25%] pointer-events-none" style={{background:'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)'}}/>
        <div className="absolute bottom-0 left-0 w-full h-[75%] pointer-events-none" style={{background:'linear-gradient(to top,#000 0%,rgba(0,0,0,0.85) 15%,rgba(0,0,0,0.5) 45%,transparent 100%)'}}/>
      </div>
      <div className="relative z-10 w-full h-full overflow-y-auto pb-20 scrollbar-hide">
        <div className="min-h-[75vh] md:min-h-[80vh] flex flex-col justify-end px-4 md:px-12 lg:px-16 pt-28 md:pt-32 pb-8 md:pb-12 max-w-[1800px] mx-auto w-full">
          <div className="max-w-4xl">
            {loading&&!det&&<div className="py-10 flex items-center gap-4 text-white/50"><Spin sz={6}/><span className="text-[16px] md:text-[18px] font-bold tracking-tight">Loading…</span></div>}
            {det&&(<>
              <div className="text-white mb-5 md:mb-6">
                {logoUrl?(
                  <img src={`${IMG}w500${logoUrl}`} alt={media.title||media.name} className="h-auto w-auto max-w-[200px] md:max-w-[360px] max-h-[50px] md:max-h-[100px] object-contain object-left-bottom mb-4 md:mb-5"/>
                ):(
                  <h1 className="text-3xl sm:text-5xl md:text-[80px] font-bold tracking-tighter leading-[1] text-white mb-4 md:mb-5">{media.title||media.name}</h1>
                )}
                <div className="flex items-center gap-2 md:gap-3 flex-wrap mb-3 md:mb-4">
                  {isTv&&<span className="text-[10px] md:text-[11px] font-extrabold uppercase tracking-widest bg-white/20 text-white px-2 py-0.5 md:py-1 rounded-md">Series</span>}
                  {det.status&&<span className="text-[10px] md:text-[11px] font-bold text-white/80 uppercase tracking-widest">{det.status}</span>}
                </div>
                <div className="flex items-center gap-2 md:gap-3 flex-wrap text-[12px] md:text-[14px] font-bold text-white/90 mb-6 md:mb-8 tracking-wide">
                  {imdb&&<div className="flex items-center gap-1"><span className="font-extrabold text-[10px] md:text-[12px] leading-none">IMDb</span><span className="font-bold text-[13px] md:text-[14px] leading-none">{imdb}</span></div>}
                  {rt&&<div className="flex items-center gap-1"><span className="font-bold text-[13px] md:text-[14px] leading-none">🍅 {rt}</span></div>}
                  {meta&&<div className="flex items-center gap-1"><span className="font-extrabold text-[10px] md:text-[11px] uppercase tracking-widest leading-none">Meta</span><span className="font-bold text-[13px] md:text-[14px] leading-none">{meta}</span></div>}
                  {!imdb&&!rt&&tmdb&&<span>{Math.round(tmdb*10)}% Score</span>}
                  <span className="opacity-40 mx-0.5">|</span>
                  <span>{fmtYear(det.release_date||det.first_air_date)}</span>
                  {runtime&&<><span className="opacity-40 mx-0.5">|</span><span>{runtime}</span></>}
                  {genres.slice(0,3).map((g,i)=><React.Fragment key={g}><span className="opacity-40 mx-0.5">|</span><span>{g}</span></React.Fragment>)}
                </div>
                {det.tagline&&<p className="text-white/90 text-base md:text-xl font-bold mb-3 md:mb-4 tracking-tight">{det.tagline}</p>}
                <p className="text-[13px] md:text-[16px] leading-relaxed max-w-3xl mb-7 md:mb-10 font-semibold">{media.overview}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <button onClick={()=>onPlay(media,isTv?{season,episode:1}:null)} className="flex items-center justify-center gap-2 bg-white text-black px-7 md:px-10 py-3.5 md:py-4 rounded-full font-bold text-[14px] md:text-[15px] hover:bg-gray-200 transition-transform outline-none">
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-black ml-0.5"/>Play
                </button>
                {trailer&&<button onClick={()=>setShowTr(true)} className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-full font-bold text-[14px] md:text-[15px] hover:bg-white/20 transition-transform outline-none">
                  <Film className="w-4 h-4 md:w-5 md:h-5"/>Trailer
                </button>}
                <button onClick={()=>toggleWL(media)} className={cn('flex items-center justify-center w-12 h-12 md:w-[54px] md:h-[54px] rounded-full border transition-transform outline-none hover:scale-105',inWL?'bg-white/30 text-white border-white/40':'bg-white/10 text-white border-white/20 hover:bg-white/20')} title={inWL?'Remove from Library':'Add to Library'}>
                  <Bookmark className="w-4 h-4 md:w-5 md:h-5" fill={inWL?'currentColor':'none'}/>
                </button>
              </div>
            </>)}
          </div>
        </div>
        <div className="px-4 md:px-12 lg:px-16 max-w-[1800px] mx-auto w-full relative z-20">
          {det&&(<>
            <div className="flex items-center gap-7 md:gap-10 border-b border-white/10 mb-8 md:mb-12 overflow-x-auto">
              {['overview',isTv?'episodes':null,'similar'].filter(Boolean).map(t=>(
                <button key={t} onClick={()=>setTab(t)} className={cn('text-[16px] md:text-[20px] font-bold capitalize pb-3 md:pb-4 shrink-0 relative outline-none transition-colors',tab===t?'text-white':'text-white/40 hover:text-white/80')}>
                  {t}{tab===t&&<div className="absolute bottom-0 left-0 w-full h-[3px] md:h-[4px] rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"/>}
                </button>
              ))}
            </div>
            {tab==='overview'&&(
              <div className="flex flex-col lg:flex-row gap-8 md:gap-12 lg:gap-20 au">
                {cast.length>0&&(
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-xl md:text-2xl mb-4 md:mb-6 tracking-tight">Cast & Crew</h3>
                    <div className="flex overflow-x-auto gap-3 md:gap-6 pb-6 scrollbar-hide">
                      {cast.map(p=>(
                        <button key={p.id} onClick={()=>onPerson(p.id)} className="flex flex-col items-center gap-2 md:gap-3 outline-none group min-w-[70px] md:min-w-[90px] shrink-0">
                          <div className="w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden bg-white/5 border border-white/10 transition-all group-hover:scale-105 group-hover:border-white/30 shadow-lg">
                            {p.profile_path?<img src={`${IMG}w200${p.profile_path}`} className="w-full h-full object-cover" alt="" decoding="async"/>:<User className="w-6 h-6 m-auto mt-5 md:mt-8 text-white/30"/>}
                          </div>
                          <div className="text-center w-full">
                            <p className="text-white font-bold text-[12px] md:text-[14px] group-hover:text-white/90 truncate">{p.name}</p>
                            <p className="text-white/50 text-[11px] md:text-[12px] font-medium truncate mt-0.5">{p.character?.split('/')[0]}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="lg:w-[350px] shrink-0 flex flex-col gap-4 md:gap-6">
                  <h3 className="text-white font-bold text-xl md:text-2xl tracking-tight">Information</h3>
                  <div className="grid grid-cols-2 gap-x-4 md:gap-x-6 gap-y-4 md:gap-y-6">
                    {[['Status',det.status],['Language',(det.original_language||'').toUpperCase()],['Budget',det.budget?`$${(det.budget/1e6).toFixed(1)}M`:null],['Revenue',det.revenue?`$${(det.revenue/1e6).toFixed(1)}M`:null],['Seasons',det.number_of_seasons?String(det.number_of_seasons):null],['Episodes',det.number_of_episodes?String(det.number_of_episodes):null]].filter(([,v])=>v).map(([l,v])=>(
                      <div key={l} className="flex flex-col gap-1 border-l-2 border-white/10 pl-3 md:pl-4">
                        <span className="text-white/40 text-[10px] md:text-[11px] uppercase tracking-widest font-bold">{l}</span>
                        <span className="text-white font-bold text-[13px] md:text-[15px]">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {tab==='episodes'&&isTv&&(
              <div className="au space-y-8 md:space-y-10">
                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4">
                  {det.seasons?.filter(s=>s.season_number>0&&s.episode_count>0).map(s=>(
                    <button key={s.id} onClick={()=>{setSeason(s.season_number);localStorage.setItem(`ses_${media.id}`,JSON.stringify(s.season_number));}}
                      className={cn('px-6 md:px-8 py-3 md:py-4 rounded-full text-[13px] md:text-[15px] font-bold border shrink-0 transition-all outline-none',season===s.season_number?'bg-white text-black border-white shadow-xl':'bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10')}>
                      Season {s.season_number}
                    </button>
                  ))}
                </div>
                {epsLoad?<div className="py-24 flex justify-center text-white/40"><Spin sz={8}/></div>:(
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-8">
                    {eps.map(ep=>{
                      const di=ep.air_date?new Date(ep.air_date):null;const future=di&&di>new Date();
                      const rev=spoilers[ep.id];
                      const bg2=ep.still_path?`${IMG}w500${ep.still_path}`:null;
                      return(
                        <div key={ep.id} className="group bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl md:rounded-3xl overflow-hidden transition-all shadow-lg hover:shadow-2xl hover:-translate-y-1.5">
                          <div className="relative aspect-video bg-black overflow-hidden">
                            {bg2?<img src={bg2} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500" alt=""/>:<div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 md:w-10 md:h-10 text-white/20"/></div>}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity duration-300">
                              {!future&&<button onClick={()=>onPlay(media,{season,episode:ep.episode_number})} className="bg-white/20 backdrop-blur-md border border-white/10 text-white p-4 md:p-5 rounded-full hover:bg-white hover:text-black hover:scale-110 transition-all shadow-2xl outline-none"><Play className="w-6 h-6 md:w-7 md:h-7 fill-current ml-1"/></button>}
                            </div>
                          </div>
                          <div className="p-4 md:p-6">
                            <div className="flex items-center justify-between mb-2 md:mb-3">
                              <span className="text-[12px] md:text-[13px] font-black tracking-widest text-white">
                                EP {ep.episode_number}
                                {!future&&di&&(new Date()-di)/86400000<=14&&<span className="text-[9px] md:text-[10px] font-black uppercase bg-white text-black px-1.5 md:px-2 py-0.5 md:py-1 rounded-md ml-2 md:ml-3">New</span>}
                                {future&&<span className="text-white/50 text-[10px] ml-2 md:ml-3">Upcoming</span>}
                              </span>
                              {ep.runtime&&<span className="text-white/50 text-[12px] md:text-[13px] font-mono font-bold">{ep.runtime}m</span>}
                            </div>
                            <h4 className="text-white font-bold text-[14px] md:text-[16px] mb-1.5 md:mb-2 line-clamp-1">{String(ep.name||`Episode ${ep.episode_number}`)}</h4>
                            {di&&<p className="text-white/50 text-[12px] md:text-[13px] font-bold mb-3 md:mb-4">{fmtDate(ep.air_date)}</p>}
                            {ep.overview&&<p className={cn('text-[13px] md:text-[14px] text-white/80 leading-relaxed line-clamp-3 font-medium',!rev&&'spoil')} onClick={()=>setSpoilers(p=>({...p,[ep.id]:true}))}>{ep.overview}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {tab==='similar'&&(
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 md:gap-x-5 gap-y-7 md:gap-y-10 au">
                {similar.map(i=><PosterCard key={i.id} media={i} onClick={x=>{setTab('overview');onCard?.(x);}}/>)}
                {!similar.length&&!loading&&<p className="col-span-full text-center text-white/50 py-24 text-xl font-bold">No similar titles found</p>}
              </div>
            )}
          </>)}
        </div>
      </div>
    </div>
  );
};

// ─── SETTINGS ────────────────────────────────────────────────────────────────
const SettingsView=({settings,save,user})=>{
  const[sec,setSec]=useState('playback');
  const set=(k,v)=>save(s=>({...s,[k]:v instanceof Function?v(s[k]):v}));
  const setN=(k,sk,v)=>set(k,p=>({...(p||{}),[sk]:v}));
  const vp={...DEFAULT_VP,...(settings.vp||{})};
  const sk={...DEFAULT_SK,...(settings.skip||{})};
  const cc={...DEFAULT_CC,...(settings.cc||{})};
  const getTs=s=>({dropshadow:'0 2px 6px rgba(0,0,0,.9)',raised:'-1px -1px 0 rgba(255,255,255,.2)',outline:'-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000',none:'none'}[s]||'none');
  const Toggle=({v,on})=><button onClick={on} className={cn('w-11 h-6 md:w-12 md:h-7 rounded-full transition-colors relative shrink-0 outline-none border border-white/10',v?'bg-white':'bg-white/10')}><div className={cn('w-5 h-5 md:w-6 md:h-6 bg-[#000] rounded-full absolute top-[1px] transition-transform shadow',v?'translate-x-[22px] md:translate-x-5':'translate-x-[1px]')}/></button>;
  const InfoRow=({l,s,children})=><div className="flex items-center justify-between py-5 md:py-6 border-b border-white/5 last:border-0 gap-4"><div><p className="text-white/90 font-bold text-[14px] md:text-[16px]">{l}</p>{s&&<p className="text-white/50 text-[13px] md:text-[14px] mt-1 font-medium">{s}</p>}</div><div className="shrink-0">{children}</div></div>;
  const sections=[{id:'playback',l:'Playback',I:Play},{id:'display',l:'Display',I:Monitor},{id:'discover',l:'Discover',I:TrendingUp},{id:'api',l:'API Keys',I:Server},{id:'account',l:'Account',I:User}];
  return(
    <div className="pt-20 md:pt-32 px-4 md:px-12 lg:px-16 pb-28 max-w-6xl mx-auto min-h-screen bg-[#050505] au">
      <div className="flex items-center gap-4 mb-8 md:mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white">Settings</h1>
      </div>
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        <div className="md:w-64 shrink-0">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {sections.map(({id,l,I})=>(
              <button key={id} onClick={()=>setSec(id)} className={cn('flex items-center gap-3 md:gap-4 px-5 md:px-6 py-3.5 md:py-4 rounded-full text-[13px] md:text-[15px] font-bold transition-all whitespace-nowrap outline-none shrink-0 md:w-full text-left',sec===id?'bg-white text-black shadow-xl':'text-white/60 hover:bg-[#18181b] hover:text-white')}>
                <I className="w-4 h-4 md:w-5 md:h-5 shrink-0"/>{l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl" key={sec}>
          {sec==='playback'&&(<>
            <div className="p-6 md:p-10 pb-4 md:pb-6">
              <p className="text-[12px] md:text-[13px] font-black text-white/50 uppercase tracking-widest mb-4 md:mb-6">Default Source</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {Object.entries(SOURCES).map(([k,v])=>(
                  <button key={k} onClick={()=>set('sourceKey',k)} className={cn('px-5 md:px-6 py-4 md:py-5 rounded-xl md:rounded-2xl text-left text-[13px] md:text-[15px] font-bold transition-all outline-none border',settings.sourceKey===k?'bg-white border-white text-black shadow-xl':'bg-white/5 border-white/5 text-white/70 hover:border-white/30 hover:text-white')}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 md:px-10 divide-y divide-white/5">
              <InfoRow l="Auto-next episode"><Toggle v={vp.autoNext!==false} on={()=>setN('vp','autoNext',!(vp.autoNext!==false))}/></InfoRow>
              <InfoRow l="Skip Timestamps" s="Powered by TheIntroDB"><Toggle v={sk.enabled} on={()=>set('skip',p=>({...p,enabled:!p.enabled}))}/></InfoRow>
              {sk.enabled&&(<div className="py-5 md:py-6 space-y-4 md:space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">{[['Intro','showIntro'],['Recap','showRecap'],['Credits','showCredits'],['Preview','showPreview']].map(([l,k])=><button key={k} onClick={()=>set('skip',p=>({...p,[k]:!p[k]}))} className={cn('py-3.5 md:py-4 rounded-xl md:rounded-2xl text-[13px] md:text-[14px] font-bold border transition-all outline-none',sk[k]?'bg-white/30 text-white border-white/40':'bg-white/5 border-white/5 text-white/50 hover:text-white hover:bg-white/10')}>{l}</button>)}</div>
                <InfoRow l="Auto-skip"><Toggle v={sk.autoSkip} on={()=>set('skip',p=>({...p,autoSkip:!p.autoSkip}))}/></InfoRow>
              </div>)}
            </div>
          </>)}
          {sec==='display'&&(
            <div className="p-6 md:p-10">
              <p className="text-[12px] md:text-[13px] font-black text-white/50 uppercase tracking-widest mb-6 md:mb-8">Subtitle Appearance</p>
              <div className="w-full aspect-[16/7] bg-black rounded-2xl md:rounded-3xl overflow-hidden relative mb-8 md:mb-10 shadow-inner flex items-end justify-center pb-6 md:pb-8 border border-white/10">
                <img src="https://image.tmdb.org/t/p/w780/8Y43POKjjKDGI9MH89NW0NAzzp8.jpg" className="absolute inset-0 w-full h-full object-cover opacity-60" alt=""/>
                <div className="relative z-10 text-center">
                  {['Subtitle line one.','Subtitle line two.'].map((l,i)=><div key={i} className="inline-block px-4 md:px-5 py-1.5 md:py-2 rounded-xl mb-1 block" style={{fontFamily:cc.font,fontSize:cc.size,color:cc.color,backgroundColor:cc.bg,textShadow:getTs(cc.edge),fontWeight:600,lineHeight:1.5}}>{l}</div>)}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-5">
                {[
                  [cc.font,v=>setN('cc','font',v),[['system-ui,sans-serif','System'],['Georgia,serif','Serif'],['monospace','Mono'],["'Comic Sans MS',sans-serif",'Casual']]],
                  [cc.size,v=>setN('cc','size',v),[['0.85rem','Small'],['1.1rem','Medium'],['1.45rem','Large']]],
                  [cc.color,v=>setN('cc','color',v),[['#ffffff','White'],['#fcd34d','Yellow'],['#4ade80','Green'],['#22d3ee','Cyan']]],
                  [cc.bg,v=>setN('cc','bg',v),[['rgba(0,0,0,0.82)','Dark'],['rgba(0,0,0,1)','Black'],['rgba(255,255,255,.12)','Light'],['transparent','None']]],
                  [cc.edge,v=>setN('cc','edge',v),[['dropshadow','Shadow'],['raised','Raised'],['outline','Outline'],['none','None']]],
                ].map(([val,setter,opts],i)=>(
                  <select key={i} value={val} onChange={e=>setter(e.target.value)} className="cs bg-[#18181b] border border-white/5 text-white/90 rounded-xl md:rounded-2xl px-4 md:px-6 py-3.5 md:py-4 outline-none cursor-pointer text-[13px] md:text-[15px] font-bold pr-10 md:pr-12 shadow-inner hover:bg-[#27272a] transition-colors">
                    {opts.map(([v,l])=><option key={v} value={v} className="bg-black">{l}</option>)}
                  </select>
                ))}
              </div>
            </div>
          )}
          {sec==='discover'&&(
            <div className="p-6 md:p-10">
              <p className="text-[12px] md:text-[13px] font-black text-white/50 uppercase tracking-widest mb-3 md:mb-4">Genre Preferences</p>
              <p className="text-white/60 text-[13px] md:text-[15px] mb-7 md:mb-10 font-bold">Tap to cycle: Default → Boosted → Hidden</p>
              <div className="flex flex-wrap gap-3 md:gap-4">
                {ALL_GENRES.map(g=>{const b=settings.algoPrefs.boosted.includes(g.id),ex=settings.algoPrefs.excluded.includes(g.id);return(
                  <button key={g.id} onClick={()=>set('algoPrefs',p=>{if(p.boosted.includes(g.id))return{boosted:p.boosted.filter(x=>x!==g.id),excluded:[...p.excluded,g.id]};if(p.excluded.includes(g.id))return{boosted:p.boosted,excluded:p.excluded.filter(x=>x!==g.id)};return{boosted:[...p.boosted,g.id],excluded:p.excluded};})} className={cn('px-4 md:px-6 py-2.5 md:py-3 rounded-full text-[12px] md:text-[14px] font-bold border transition-all outline-none',ex?'bg-red-500/10 text-red-400 border-red-500/20':b?'bg-white text-black border-white shadow-lg':'bg-white/5 text-white/70 border-white/5 hover:text-white hover:border-white/20 hover:bg-white/10')}>
                    {g.name}{b?' ★':''}
                  </button>
                );})}
              </div>
            </div>
          )}
          {sec==='api'&&(
            <div className="p-6 md:p-10 space-y-8 md:space-y-10">
              {[{l:'TMDB API Key',s:'Required for metadata',k:'apiKey',ph:'Enter API key…',link:'https://www.themoviedb.org/settings/api'},{l:'OMDb API Key',s:'Enables IMDb ratings',k:'omdbKey',ph:'e.g. 93a6d7d6',link:'https://www.omdbapi.com/apikey.aspx'}].map(({l,s,k,ph,link})=>(
                <div key={k}>
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div><p className="text-white/95 font-bold text-[16px] md:text-[18px] tracking-tight">{l}</p><p className="text-white/60 text-[13px] md:text-[14px] mt-1 font-bold">{s} — <a href={link} target="_blank" rel="noreferrer" className="text-white/90 hover:text-white underline">Get key</a></p></div>
                  </div>
                  <input type="text" value={settings[k]||''} onChange={e=>set(k,e.target.value)} placeholder={ph} spellCheck="false"
                    className="w-full bg-[#18181b] border border-white/5 rounded-xl md:rounded-2xl px-5 md:px-6 py-4 md:py-5 font-mono text-[13px] md:text-[15px] text-white/90 focus:border-white/30 focus:bg-[#27272a] outline-none transition-all shadow-inner"/>
                </div>
              ))}
            </div>
          )}
          {sec==='account'&&(
            <div className="p-6 md:p-10">
              <div className="flex items-center gap-4 md:gap-6 mb-8 md:mb-10 p-6 md:p-8 bg-white/5 border border-white/5 rounded-2xl md:rounded-3xl">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl font-black text-black bg-white shadow-xl">{user?.displayName?.[0]||user?.email?.[0]||'?'}</div>
                <div>
                  <p className="text-white font-bold text-xl md:text-2xl tracking-tight">{user?.displayName||'User Account'}</p>
                  <p className="text-white/60 text-[14px] md:text-[16px] font-bold mt-1">{user?.email||'Guest'}</p>
                </div>
              </div>
              <button onClick={()=>firebaseSignOut(auth)} className="w-full flex items-center justify-center gap-2.5 md:gap-3 py-4 md:py-5 rounded-xl md:rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-bold text-[14px] md:text-[16px] transition-all outline-none">
                <LogOut className="w-5 h-5 md:w-6 md:h-6"/>Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── HISTORY VIEW ────────────────────────────────────────────────────────────
const HistoryView=React.memo(({history,saveHistory,onPlay,onCard})=>{
  const[search,setSearch]=useState('');
  const[typeFilter,setTypeFilter]=useState('all');
  const[sortBy,setSortBy]=useState('recent');
  const[grouped,setGrouped]=useState(true);
  const[page,setPage]=useState(1);
  const PER_PAGE=30;
  const dSearch=useDebounce(search,300);
  useEffect(()=>setPage(1),[dSearch,typeFilter,sortBy]);
  const filtered=useMemo(()=>{
    let h=[...history];
    if(dSearch.trim()){const q=dSearch.toLowerCase();h=h.filter(i=>(i.title||i.name||'').toLowerCase().includes(q));}
    if(typeFilter==='movie')h=h.filter(i=>i.media_type!=='tv'&&i.release_date);
    if(typeFilter==='tv')h=h.filter(i=>i.media_type==='tv'||(!i.release_date&&i.name));
    if(sortBy==='oldest')h.sort((a,b)=>new Date(a.watchedAt)-new Date(b.watchedAt));
    else if(sortBy==='az')h.sort((a,b)=>(a.title||a.name||'').localeCompare(b.title||b.name||''));
    else if(sortBy==='za')h.sort((a,b)=>(b.title||b.name||'').localeCompare(a.title||a.name||''));
    else if(sortBy==='duration')h.sort((a,b)=>(b.watchDuration||0)-(a.watchDuration||0));
    else h.sort((a,b)=>new Date(b.watchedAt)-new Date(a.watchedAt));
    return h;
  },[history,dSearch,typeFilter,sortBy]);
  const paginated=filtered.slice(0,page*PER_PAGE);
  const hasMore=paginated.length<filtered.length;
  const obs=useRef();
  const lastRef=useCallback(n=>{if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting&&hasMore)setPage(p=>p+1);},{rootMargin:'400px'});if(n)obs.current.observe(n);},[hasMore]);
  const isTvItem=i=>i.media_type==='tv'||(!i.release_date&&i.name);
  const renderCard=(item)=>(
    <div key={`${item.id}_${item.watchedAt}`} className="bg-[#111111] border border-white/[0.07] hover:border-white/20 rounded-2xl overflow-hidden transition-all group shadow-sm hover:shadow-lg">
      <div className="flex gap-3 md:gap-4 p-3 md:p-4 items-center">
        <button onClick={()=>onCard(item)} className="relative w-14 md:w-20 shrink-0 outline-none">
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a1a]">
            {item.poster_path?<img src={`${IMG}w200${item.poster_path}`} className="w-full h-full object-cover" alt="" onError={e=>{e.target.style.display='none';}}/>:<div className="w-full h-full flex items-center justify-center"><Film className="w-5 h-5 text-white/20"/></div>}
          </div>
          {item.progress>0&&<div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 rounded-b-xl"><div className="h-full rounded-full bg-white/70" style={{width:`${Math.min(item.progress,100)}%`}}/></div>}
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-white/95 text-[14px] md:text-[16px] truncate mb-1.5 leading-tight">{item.title||item.name}</h4>
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="text-[10px] font-bold text-white/70 bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-widest">{isTvItem(item)?'Series':'Movie'}</span>
            {item.config&&<span className="text-[10px] font-bold text-black bg-white px-2 py-0.5 rounded-full">S{item.config.season}·E{item.config.episode}</span>}
          </div>
          <div className="flex items-center gap-3 text-white/40 text-[12px] font-medium flex-wrap">
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3"/>{fmtDT(item.watchedAt)}</span>
            {item.watchDuration>60&&<span className="flex items-center gap-1"><Timer className="w-3 h-3"/>{fmtDuration(item.watchDuration)}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={()=>onPlay(item,item.config)} className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 shadow-lg outline-none transition-transform"><Play className="w-4 h-4 fill-current ml-0.5"/></button>
          <button onClick={()=>saveHistory(p=>p.filter(h=>!(h.id===item.id&&h.watchedAt===item.watchedAt)))} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-full outline-none transition-all"><X className="w-4 h-4"/></button>
        </div>
      </div>
    </div>
  );
  const dateGroups=useMemo(()=>grouped&&sortBy==='recent'?groupByDate(paginated):null,[grouped,sortBy,paginated]);
  return(
    <div className="pt-20 md:pt-32 px-4 md:px-12 lg:px-16 min-h-screen bg-[#050505] max-w-[1800px] mx-auto au">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-3 md:gap-5">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">History</h2>
        <div className="flex items-center gap-3">
          {history.length>0&&(
            <button onClick={()=>saveHistory([])} className="text-[13px] text-red-400 hover:text-red-300 flex items-center gap-2 px-4 py-2 rounded-full hover:bg-red-500/10 font-bold outline-none transition-all border border-red-500/20 hover:border-red-500/30">
              <Trash2 className="w-3.5 h-3.5"/>Clear All
            </button>
          )}
        </div>
      </div>
      {/* Stats bar */}
      {history.length>0&&(
        <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8 p-4 bg-white/5 border border-white/8 rounded-2xl flex-wrap">
          <div className="flex flex-col">
            <span className="text-white font-bold text-xl md:text-2xl">{history.length}</span>
            <span className="text-white/50 text-[11px] md:text-[12px] font-medium uppercase tracking-wide">Titles</span>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block"/>
          <div className="flex flex-col">
            <span className="text-white font-bold text-xl md:text-2xl">{history.filter(i=>i.media_type==='tv'||(!i.release_date&&i.name)).length}</span>
            <span className="text-white/50 text-[11px] md:text-[12px] font-medium uppercase tracking-wide">Series</span>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block"/>
          <div className="flex flex-col">
            <span className="text-white font-bold text-xl md:text-2xl">{history.filter(i=>!(i.media_type==='tv'||(!i.release_date&&i.name))).length}</span>
            <span className="text-white/50 text-[11px] md:text-[12px] font-medium uppercase tracking-wide">Movies</span>
          </div>
          {history.some(i=>i.watchDuration)&&(
            <>
              <div className="w-px h-8 bg-white/10 hidden sm:block"/>
              <div className="flex flex-col">
                <span className="text-white font-bold text-xl md:text-2xl">{fmtDuration(history.reduce((a,i)=>a+(i.watchDuration||0),0))}</span>
                <span className="text-white/50 text-[11px] md:text-[12px] font-medium uppercase tracking-wide">Watched</span>
              </div>
            </>
          )}
        </div>
      )}
      {/* Controls */}
      <div className="sticky top-[72px] md:top-[80px] bg-[#050505]/95 backdrop-blur-md z-40 pb-4 mb-5 md:mb-6 pt-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"/>
            <input type="text" placeholder="Search history…" value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full bg-[#18181b] border border-white/10 text-white pl-11 pr-10 py-3.5 rounded-full outline-none placeholder:text-white/30 focus:bg-[#27272a] focus:border-white/20 text-[14px] font-medium transition-all"/>
            {search&&<button onClick={()=>setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white outline-none"><X className="w-4 h-4"/></button>}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Type filter */}
            <div className="flex bg-[#18181b] border border-white/10 rounded-full p-1 shrink-0">
              {[['all','All'],['movie','Movies'],['tv','Series']].map(([v,l])=>(
                <button key={v} onClick={()=>setTypeFilter(v)} className={cn('px-4 py-2 rounded-full text-[12px] font-bold transition-all outline-none whitespace-nowrap',typeFilter===v?'bg-[#27272a] text-white':'text-white/40 hover:text-white')}>{l}</button>
              ))}
            </div>
            {/* Sort */}
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="cs bg-[#18181b] border border-white/10 text-white/80 rounded-full px-4 py-2.5 outline-none text-[12px] font-bold pr-9 shrink-0 cursor-pointer hover:bg-[#27272a] transition-colors">
              <option value="recent" className="bg-[#1C1C1E]">Most Recent</option>
              <option value="oldest" className="bg-[#1C1C1E]">Oldest First</option>
              <option value="az" className="bg-[#1C1C1E]">A → Z</option>
              <option value="za" className="bg-[#1C1C1E]">Z → A</option>
              <option value="duration" className="bg-[#1C1C1E]">Most Watched</option>
            </select>
            {/* Group toggle */}
            {sortBy==='recent'&&(
              <button onClick={()=>setGrouped(v=>!v)} className={cn('px-4 py-2.5 rounded-full text-[12px] font-bold border transition-all outline-none shrink-0 flex items-center gap-1.5',grouped?'bg-white/15 text-white border-white/20':'bg-[#18181b] text-white/50 border-white/10 hover:text-white')}>
                <CalendarDays className="w-3.5 h-3.5"/>Group
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Content */}
      {filtered.length===0?(
        history.length===0?(
          <div className="flex flex-col items-center py-32 md:py-40 text-white/30">
            <Clock className="w-14 h-14 md:w-16 md:h-16 mb-5 opacity-30"/>
            <p className="text-lg md:text-xl font-semibold tracking-tight">No watch history yet</p>
            <p className="text-white/25 text-[13px] md:text-[14px] mt-2 font-medium">Start watching to build your history</p>
          </div>
        ):(
          <div className="flex flex-col items-center py-24 text-white/30">
            <Search className="w-12 h-12 mb-4 opacity-20"/>
            <p className="text-lg font-semibold">No results for "{search}"</p>
          </div>
        )
      ):(
        <div className="pb-28">
          {dateGroups?(
            dateGroups.map(({label,items})=>(
              <div key={label} className="mb-8 md:mb-10">
                <h3 className="text-white/50 text-[11px] md:text-[12px] font-black uppercase tracking-widest mb-4 flex items-center gap-3">
                  {label}
                  <span className="text-white/25 font-medium normal-case tracking-normal text-[12px] md:text-[13px]">{items.length} {items.length===1?'title':'titles'}</span>
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3">
                  {items.map(item=>renderCard(item))}
                </div>
              </div>
            ))
          ):(
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3">
              {paginated.map(item=>renderCard(item))}
            </div>
          )}
          {hasMore&&<div ref={lastRef} className="py-8 flex justify-center"><Spin sz={6}/></div>}
          <p className="text-center text-white/25 text-[12px] md:text-[13px] font-medium pt-4">
            {filtered.length} title{filtered.length!==1?'s':''} {filtered.length!==history.length?`(filtered from ${history.length})`:''}
          </p>
        </div>
      )}
    </div>
  );
});

// ─── ROOT APP ────────────────────────────────────────────────────────────────
export default function App(){
  const[mounted,setMounted]=useState(false);
  const[user,setUser]=useState(undefined);
  const[isGuest,setIsGuest]=useState(false);
  const[tab,setTabRaw]=useState('home');
  const[genre,setGenre]=useState('All');
  const[focus,setFocus]=useState(false);
  const[selMedia,setSelMedia]=useState(null);
  const[selPerson,setSelPerson]=useState(null);
  const[playMedia,setPlayMedia]=useState(null);
  const[playCfg,setPlayCfg]=useState(null);
  const playStartRef=useRef(null);
  useEffect(()=>{
    const initAuth=async()=>{if(typeof __initial_auth_token!=='undefined'&&__initial_auth_token){await signInWithCustomToken(auth,__initial_auth_token);}};
    initAuth();
    const u=onAuthStateChanged(auth,u=>{setUser(u||null);setMounted(true);});
    return u;
  },[]);
  const uid=user?.uid||null;
  const{settings,saveSettings,history,saveHistory,watchlist,saveWatchlist,loaded}=useUserData(uid,isGuest||!user);
  const histRef=useRef(history),wlRef=useRef(watchlist);
  useEffect(()=>{histRef.current=history;},[history]);
  useEffect(()=>{wlRef.current=watchlist;},[watchlist]);
  const setTab=useCallback(t=>{setTabRaw(t);if(t!=='live')setFocus(false);setGenre('All');},[]);
  const handlePlay=useCallback((media,cfg=null)=>{
    if(media.isLive){setPlayMedia(media);setPlayCfg(null);setSelMedia(null);return;}
    const ex=histRef.current.find(h=>h.id===media.id);
    const fc=cfg||ex?.config||{season:1,episode:1};
    setPlayMedia(media);setPlayCfg(fc);setSelMedia(null);
    playStartRef.current=Date.now();
    saveHistory(p=>[{...media,watchedAt:new Date().toISOString(),config:fc,progress:ex?.progress||0,watchDuration:ex?.watchDuration||0},...p.filter(h=>h.id!==media.id)].slice(0,500));
  },[saveHistory]);
  const handlePlayerClose=useCallback((elapsed)=>{
    // Update watch duration when player closes
    if(playMedia&&!playMedia.isLive&&elapsed>30){
      saveHistory(p=>p.map(h=>h.id===playMedia.id&&h.watchedAt===p.find(x=>x.id===playMedia.id)?.watchedAt?{...h,watchDuration:Math.max(h.watchDuration||0,elapsed)}:h));
    }
    setPlayMedia(null);
  },[playMedia,saveHistory]);
  const handleSport=useCallback(match=>new Promise(async res=>{
    if(!match){res();return;}
    if(match.isReplay||match.category==='wrestling'){setPlayMedia({isLive:true,type:'iframe',name:String(match.title||match.name||'Replay'),url:match.url});res();return;}
    let url='',isIfr=true;
    if(match.sources?.length){for(const src of match.sources){try{const r=await fetch(`https://streamed.pk/api/stream/${src.source}/${src.id}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)continue;const ss=await r.json();const streams=Array.isArray(ss)?ss:Object.values(ss||{}).flat();const best=streams.find(s=>s.hd)||streams[0];if(best){const su=best.embedUrl||best.streamUrl||best.url||best.stream_url;if(su){url=su;isIfr=!su.includes('.m3u8');break;}}}catch{}}}
    if(!url&&match.id){url=`https://streamed.pk/watch/${match.id}`;isIfr=true;}
    if(url)setPlayMedia({isLive:true,type:isIfr?'iframe':'m3u8',name:String(match.title||match.name||'Live Sport'),url});
    res();
  }),[]);
  const toggleWL=useCallback(m=>saveWatchlist(p=>p.find(x=>x.id===m.id)?p.filter(x=>x.id!==m.id):[m,...p]),[saveWatchlist]);
  if(!mounted||user===undefined)return<div className="min-h-screen bg-[#050505] flex items-center justify-center"><G/><Spin sz={12}/></div>;
  if(!user&&!isGuest)return<LoginScreen onGuest={()=>setIsGuest(true)}/>;
  if(!loaded)return<div className="min-h-screen bg-[#050505] flex items-center justify-center"><G/><Spin sz={12}/></div>;
  const apiKey=settings.apiKey;
  const vpS={...DEFAULT_VP,...(settings.vp||{})};
  const skipS={...DEFAULT_SK,...(settings.skip||{})};
  const algoPrefs=settings.algoPrefs||{excluded:[],boosted:[]};
  return(
    <div className="min-h-screen bg-[#050505] text-[#f5f5f7] overflow-x-hidden selection:bg-white/30 selection:text-white">
      <G/>
      <TopNav tab={tab} setTab={setTab} focus={focus} user={user} isGuest={isGuest}/>
      <main>
        {tab==='home'&&<HomeView apiKey={apiKey} history={history} watchlist={watchlist} algoPrefs={algoPrefs} onPlay={handlePlay} onInfo={setSelMedia} toggleWL={toggleWL}/>}
        {tab==='live'&&<LiveTvView focus={focus} setFocus={setFocus}/>}
        {tab==='sports'&&<SportsView onPlay={handleSport} apiKey={apiKey} onCard={setSelMedia}/>}
        {tab==='movies'&&(
          <div className="pb-28 bg-[#050505] min-h-screen">
            {genre==='All'?(<>
              <Hero onPlay={handlePlay} onInfo={setSelMedia} apiKey={apiKey} type="movie" toggleWL={toggleWL} watchlist={watchlist}/>
              <div className="relative z-10 pb-12">
                <Row title="Top 10 Movies Today" url="/trending/movie/day" onCard={setSelMedia} apiKey={apiKey} ranking/>
                <Row title="Trending Movies" url="/trending/movie/week" onCard={setSelMedia} apiKey={apiKey}/>
                <Row title="In Theatres Now" url="/movie/now_playing" onCard={setSelMedia} apiKey={apiKey}/>
                <Row title="All-Time Greats" url="/movie/top_rated" onCard={setSelMedia} apiKey={apiKey}/>
                {GENRES.movie.map(g=><Row key={g.id} title={g.name} url={`/discover/movie?with_genres=${g.id}&sort_by=popularity.desc`} onCard={setSelMedia} apiKey={apiKey}/>)}
              </div>
            </>):<GridView apiKey={apiKey} type="movie" genreId={genre} onCard={setSelMedia}/>}
          </div>
        )}
        {tab==='tv'&&(
          <div className="pb-28 bg-[#050505] min-h-screen">
            {genre==='All'?(<>
              <Hero onPlay={handlePlay} onInfo={setSelMedia} apiKey={apiKey} type="tv" toggleWL={toggleWL} watchlist={watchlist}/>
              <div className="relative z-10 pb-12">
                <Row title="Top 10 Series Today" url="/trending/tv/day" onCard={setSelMedia} apiKey={apiKey} ranking/>
                <Row title="Trending Series" url="/trending/tv/week" onCard={setSelMedia} apiKey={apiKey}/>
                <Row title="On Air Now" url="/tv/on_the_air" onCard={setSelMedia} apiKey={apiKey}/>
                <Row title="Critically Acclaimed" url="/tv/top_rated" onCard={setSelMedia} apiKey={apiKey}/>
                {GENRES.tv.map(g=><Row key={g.id} title={g.name} url={`/discover/tv?with_genres=${g.id}&sort_by=popularity.desc`} onCard={setSelMedia} apiKey={apiKey}/>)}
              </div>
            </>):<GridView apiKey={apiKey} type="tv" genreId={genre} onCard={setSelMedia}/>}
          </div>
        )}
        {tab==='search'&&<SearchView apiKey={apiKey} history={history} onCard={setSelMedia}/>}
        {tab==='watchlist'&&(
          <div className="px-4 md:px-12 lg:px-16 min-h-screen bg-[#050505] max-w-[1800px] mx-auto pt-20 md:pt-36 au">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-8 md:mb-10">Library</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 md:gap-x-4 gap-y-6 md:gap-y-8 pb-28">
              {watchlist.map(i=><PosterCard key={i.id} media={i} onClick={setSelMedia}/>)}
            </div>
            {!watchlist.length&&<div className="flex flex-col items-center py-32 md:py-40 text-white/40"><Bookmark className="w-14 h-14 md:w-16 md:h-16 mb-5 opacity-30"/><p className="text-lg md:text-xl font-semibold tracking-tight">Your library is empty</p></div>}
          </div>
        )}
        {tab==='history'&&<HistoryView history={history} saveHistory={saveHistory} onPlay={handlePlay} onCard={setSelMedia}/>}
        {tab==='settings'&&<SettingsView settings={settings} save={saveSettings} user={user}/>}
      </main>
      <DetailModal
        isOpen={!!selMedia} media={selMedia} onClose={()=>setSelMedia(null)}
        onPlay={handlePlay} toggleWL={toggleWL}
        inWL={selMedia?wlRef.current.some(m=>m.id===selMedia.id):false}
        apiKey={apiKey} omdbKey={settings.omdbKey}
        onPerson={setSelPerson} onCard={setSelMedia}
      />
      {selPerson&&<PersonModal id={selPerson} apiKey={apiKey} onClose={()=>setSelPerson(null)} onCard={m=>{setSelPerson(null);setSelMedia(m);}}/>}
      {playMedia&&<Player media={playMedia} config={playCfg} onClose={handlePlayerClose} sourceKey={settings.sourceKey} vpSettings={vpS} skipSettings={skipS}/>}
    </div>
  );
}