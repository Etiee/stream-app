import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, Info, Search, X, ChevronRight, ChevronLeft, Clock, Bookmark,
  Settings, Monitor, Film, ArrowLeft, Trash2, LayoutGrid, Star, Shuffle,
  User, Filter, Dribbble, Server, ChevronDown, Sparkles, Send, Maximize,
  Minimize, VolumeX, Volume2, RefreshCw, Square, LogOut, Sidebar,
  AlertCircle, Plus, Check, Globe, SkipForward, TrendingUp, Zap,
  Eye, EyeOff, Mail, Lock
} from 'lucide-react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const ACCENT    = '#0071E3';        // Apple blue
const ACCENT_DK = '#0058B0';
const BASE      = 'https://api.themoviedb.org/3';
const IMG       = 'https://image.tmdb.org/t/p/';
const INTRODB   = 'https://api.theintrodb.org/v2';

const DEFAULT_TMDB = '9517f4751d84886b184cb4a4849e9f91';
const DEFAULT_OMDB = '93a6d7d6';

const DEFAULT_CC = { size:'1.1rem', bg:'rgba(0,0,0,0.82)', color:'#fff', font:'system-ui,sans-serif', edge:'dropshadow' };
const DEFAULT_VP = { icons:'lucide', autoNext:true, episodeList:true, serverIcon:true, subtitleFont:'Inter', subtitleFontSize:20, subtitleOpacity:0.5 };
const DEFAULT_SK = { enabled:true, showIntro:true, showRecap:true, showCredits:true, showPreview:false, autoSkip:false, buttonDuration:7, minConfidence:0.3 };
const DEFAULT_SETTINGS = {
  apiKey:DEFAULT_TMDB, omdbKey:DEFAULT_OMDB, sourceKey:'vidplus', geminiKey:'',
  algoPrefs:{excluded:[],boosted:[]}, cc:DEFAULT_CC, vp:DEFAULT_VP, skip:DEFAULT_SK,
};

// ─── SOURCES ─────────────────────────────────────────────────────────────────
const SOURCES = {
  vidplus:    { name:'VidPlus',    url:(t,id,s,e)=>t==='tv'?`https://player.vidplus.to/embed/tv/${id}/${s}/${e}?autoplay=true&primarycolor=0071E3`:`https://player.vidplus.to/embed/movie/${id}?autoplay=true&primarycolor=0071E3` },
  vidsrc:     { name:'VidSrc',     url:(t,id,s,e)=>t==='tv'?`https://vidsrc.net/embed/tv?tmdb=${id}&season=${s}&episode=${e}`:`https://vidsrc.net/embed/movie?tmdb=${id}` },
  autoembed:  { name:'AutoEmbed',  url:(t,id,s,e)=>t==='tv'?`https://autoembed.cc/tv/tmdb/${id}-${s}-${e}`:`https://autoembed.cc/movie/tmdb/${id}` },
  multiembed: { name:'MultiEmbed', url:(t,id,s,e)=>t==='tv'?`https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`:`https://multiembed.mov/?video_id=${id}&tmdb=1` },
  embed2:     { name:'2Embed',     url:(t,id,s,e)=>t==='tv'?`https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`:`https://www.2embed.cc/embed/${id}` },
  vidlink:    { name:'VidLink',    url:(t,id,s,e)=>t==='tv'?`https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true`:`https://vidlink.pro/movie/${id}?autoplay=true` },
};

const GENRES = {
  movie:[{id:28,name:'Action'},{id:12,name:'Adventure'},{id:16,name:'Animation'},{id:35,name:'Comedy'},{id:80,name:'Crime'},{id:99,name:'Documentary'},{id:18,name:'Drama'},{id:10751,name:'Family'},{id:14,name:'Fantasy'},{id:27,name:'Horror'},{id:878,name:'Sci-Fi'},{id:53,name:'Thriller'},{id:10752,name:'War'},{id:37,name:'Western'}],
  tv:   [{id:10759,name:'Action & Adventure'},{id:16,name:'Animation'},{id:35,name:'Comedy'},{id:80,name:'Crime'},{id:99,name:'Documentary'},{id:18,name:'Drama'},{id:10765,name:'Sci-Fi & Fantasy'},{id:10767,name:'Talk'},{id:10768,name:'War & Politics'}],
};
const ALL_GENRES=[];[...GENRES.movie,...GENRES.tv].forEach(g=>{if(!ALL_GENRES.some(u=>u.name===g.name))ALL_GENRES.push(g);});ALL_GENRES.sort((a,b)=>a.name.localeCompare(b.name));

const LIVE_CH = [
  {id:'l_cnn', name:'CNN',      cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg',url:'https://turnerlive.warnermediacdn.com/hls/live/586495/cnngo/cnn_slate/VIDEO_0_3564000.m3u8'},
  {id:'l_cbs', name:'CBS News', cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/2/2e/CBS_News_2020_%28Stacked_II%29.svg',url:'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8'},
  {id:'l_fox', name:'Fox News', cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/6/67/Fox_News_Channel_logo.svg',url:'https://stream.livenewsplay.com:9555/hls/foxnewssd/index.m3u8'},
  {id:'l_abc', name:'ABC News', cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/ABC_News_logo_2021.svg/800px-ABC_News_logo_2021.svg.png',url:'https://aegis-cloudfront-1.tubi.video/d6cbb0de-68e4-4f3b-82f9-bf5d526e0bde/index.m3u8'},
  {id:'l_bbc', name:'BBC News', cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/BBC_News_2022_%28Alt%29.svg/800px-BBC_News_2022_%28Alt%29.svg.png',url:'https://dash2.antik.sk/live/test_bbc_world/playlist.m3u8'},
  {id:'l_cnbc',name:'CNBC',     cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/e/e3/CNBC_logo.svg',url:'https://stream.livenewsplay.com:9443/hls/cnbc/cnbcsd.m3u8'},
  {id:'l_blm', name:'Bloomberg',cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/5/5d/New_Bloomberg_Logo.svg',url:'https://cdn4.skygo.mn/live/disk1/Bloomberg/HLSv3-FTA/Bloomberg.m3u8'},
  {id:'l_reu', name:'Reuters',  cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Reuters_logo_2024.svg/800px-Reuters_logo_2024.svg.png',url:'https://amg00453-reuters-amg00453c1-plex-us-2106.playouts.now.amagi.tv/playlist/amg00453-reuters-reuters-plexus/playlist.m3u8'},
  {id:'l_cbc', name:'CBC News', cat:'News',logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/CBC_News_Logo.svg/960px-CBC_News_Logo.svg.png',url:'https://amg00788-cbc-amg00788c4-xumo-us-3045.playouts.now.amagi.tv/master.m3u8'},
];

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
const isTouchDev=()=>'ontouchstart' in window||navigator.maxTouchPoints>0;

const loadHls=cb=>{if(window.Hls){cb();return;}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/hls.js@latest';s.onload=cb;document.body.appendChild(s);};
const initHls=(vid,src,main,cb)=>{if(!window.Hls)return null;if(window.Hls.isSupported()){const h=new window.Hls({maxMaxBufferLength:main?30:8,liveSyncDurationCount:3,capLevelToPlayerSize:true,enableWorker:true});h.loadSource(src);h.attachMedia(vid);if(cb.onParsed)h.on(window.Hls.Events.MANIFEST_PARSED,cb.onParsed);if(cb.onError)h.on(window.Hls.Events.ERROR,cb.onError);return h;}else if(vid.canPlayType('application/vnd.apple.mpegurl')){vid.src=src;if(cb.onParsed)vid.addEventListener('loadedmetadata',cb.onParsed);}return null;};

// ─── HOOKS ───────────────────────────────────────────────────────────────────
const useLS=(k,d)=>{const[v,sv]=useState(()=>{try{const i=localStorage.getItem(k);return i?JSON.parse(i):d;}catch{return d;}});const set=n=>{try{const s=n instanceof Function?n(v):n;sv(s);localStorage.setItem(k,JSON.stringify(s));}catch{}};return[v,set];};
const useSS=(k,d)=>{const[v,sv]=useState(()=>{try{const i=sessionStorage.getItem(k);return i?JSON.parse(i):d;}catch{return d;}});const set=n=>{try{const s=n instanceof Function?n(v):n;sv(s);sessionStorage.setItem(k,JSON.stringify(s));}catch{}};return[v,set];};
const useDebounce=(v,ms)=>{const[d,setD]=useState(v);useEffect(()=>{const t=setTimeout(()=>setD(v),ms);return()=>clearTimeout(t);},[v,ms]);return d;};

// ─── USER DATA HOOK ──────────────────────────────────────────────────────────
const useUserData=(uid,isGuest)=>{
  const pfx=`ud_${uid||'g'}`;
  const store=isGuest?sessionStorage:localStorage;
  const cloud=useRef({});const timers=useRef({});const mounted=useRef(true);
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
        const[sd,hd,wd]=await Promise.all([getDoc(doc(db,'users',uid,'data','settings')),getDoc(doc(db,'users',uid,'data','history')),getDoc(doc(db,'users',uid,'data','watchlist'))]);
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
    timers.current[key]=setTimeout(async()=>{try{const v=getData();await setDoc(doc(db,'users',uid,'data',key),key==='settings'?v:{items:v});}catch(e){console.error(e);}},1500);
  };

  const saveSettings=useCallback(val=>{const n=val instanceof Function?val(settings):val;setS(n);store.setItem(`${pfx}_s`,JSON.stringify(n));save('settings',()=>n);},[settings,pfx]);
  const saveHistory=useCallback(val=>{const n=val instanceof Function?val(history):val;setH(n);store.setItem(`${pfx}_h`,JSON.stringify(n));save('history',()=>n);},[history,pfx]);
  const saveWatchlist=useCallback(val=>{const n=val instanceof Function?val(watchlist):val;setW(n);store.setItem(`${pfx}_w`,JSON.stringify(n));save('watchlist',()=>n);},[watchlist,pfx]);

  return{settings,saveSettings,history,saveHistory,watchlist,saveWatchlist,loaded};
};

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
const G=()=>(
  <style>{`
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
    ::-webkit-scrollbar{display:none;}*{-ms-overflow-style:none;scrollbar-width:none;}
    body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;}
    .glass{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
    .glass2{background:rgba(0,0,0,0.55);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);}
    .fade-r{mask-image:linear-gradient(to right,#000 80%,transparent 100%);-webkit-mask-image:linear-gradient(to right,#000 80%,transparent 100%);}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
    @keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
    @keyframes pulse3{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .au{animation:fadeUp .5s cubic-bezier(.16,1,.3,1) both;}
    .as{animation:scaleIn .4s cubic-bezier(.16,1,.3,1) both;}
    .sk{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 75%);background-size:400% 100%;animation:shimmer 1.8s infinite;}
    .lp{animation:pulse3 1.5s ease-in-out infinite;}
    .sp{animation:spin 1s linear infinite;}
    .cs{appearance:none;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,.45)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e");background-repeat:no-repeat;background-position:right .75rem center;background-size:.9em;}
    input[type=range]{-webkit-appearance:none;appearance:none;height:3px;border-radius:99px;background:rgba(255,255,255,.15);outline:none;}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.5);}
    :fullscreen,:-webkit-full-screen{border-radius:0!important;}
    .spoil{filter:blur(7px);cursor:pointer;transition:filter .3s}.spoil:hover{filter:blur(3px)}
  `}</style>
);

// ─── LOADER ──────────────────────────────────────────────────────────────────
const Spin=({sz=8,c=ACCENT})=><div className={`w-${sz} h-${sz} rounded-full border-2 sp`} style={{borderColor:`${c}33`,borderTopColor:c}}/>;

// ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
const LoginScreen=({onGuest})=>{
  const[tab,setTab]=useState('in');  // in | up | reset
  const[email,setEmail]=useState('');
  const[pw,setPw]=useState('');
  const[pw2,setPw2]=useState('');
  const[showPw,setShowPw]=useState(false);
  const[err,setErr]=useState('');
  const[msg,setMsg]=useState('');
  const[loading,setLoading]=useState(false);

  const fmtErr=e=>{const m=e?.code||'';if(m.includes('user-not-found')||m.includes('wrong-password')||m.includes('invalid-credential'))return'Incorrect email or password.';if(m.includes('email-already'))return'An account with this email already exists.';if(m.includes('weak-password'))return'Password must be at least 6 characters.';if(m.includes('invalid-email'))return'Please enter a valid email address.';if(m.includes('too-many-requests'))return'Too many attempts. Please wait a moment.';return e?.message||'Something went wrong. Please try again.';};

  const submit=async evt=>{
    evt.preventDefault();setErr('');setMsg('');setLoading(true);
    try{
      if(tab==='reset'){await sendPasswordResetEmail(auth,email);setMsg('Password reset email sent. Check your inbox.');setTab('in');}
      else if(tab==='up'){if(pw!==pw2){setErr('Passwords do not match.');setLoading(false);return;}await createUserWithEmailAndPassword(auth,email,pw);}
      else{await signInWithEmailAndPassword(auth,email,pw);}
    }catch(e){setErr(fmtErr(e));}
    setLoading(false);
  };

  const googleSignIn=async()=>{
    setErr('');setLoading(true);
    try{await signInWithPopup(auth,new GoogleAuthProvider());}
    catch(e){setErr(fmtErr(e));}
    setLoading(false);
  };

  return(
    <div className="min-h-screen bg-black flex items-center justify-center p-5 relative overflow-hidden">
      <G/>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[60vw] h-[60vw] rounded-full opacity-20" style={{background:`radial-gradient(circle,${ACCENT} 0%,transparent 70%)`}}/>
      </div>
      <div className="w-full max-w-sm relative z-10 au">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="w-14 h-14 rounded-[18px] bg-white flex items-center justify-center shadow-2xl">
            <Play className="w-7 h-7 fill-black text-black ml-0.5"/>
          </div>
        </div>
        <h1 className="text-[2rem] font-bold tracking-tight text-center text-white mb-1">
          {tab==='in'?'Welcome back':tab==='up'?'Create account':'Reset password'}
        </h1>
        <p className="text-white/40 text-sm text-center mb-8">
          {tab==='in'?'Sign in to continue watching':tab==='up'?'Your private streaming space':'Enter your email to reset'}
        </p>

        {/* Google */}
        {tab!=='reset'&&(
          <button onClick={googleSignIn} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white text-[#111] font-semibold text-[14px] hover:bg-white/92 transition-all mb-3 disabled:opacity-50 outline-none">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
        )}

        {/* Divider */}
        {tab!=='reset'&&<div className="flex items-center gap-3 mb-3"><div className="flex-1 h-px bg-white/10"/><span className="text-white/25 text-xs font-medium">or</span><div className="flex-1 h-px bg-white/10"/></div>}

        <form onSubmit={submit} className="space-y-2.5">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"/>
            <input type="email" placeholder="Email address" value={email} onChange={e=>{setEmail(e.target.value);setErr('');}} required
              className="w-full bg-white/[0.07] border border-white/[0.09] text-white pl-11 pr-4 py-3.5 rounded-2xl outline-none focus:border-white/25 focus:bg-white/10 placeholder:text-white/25 text-sm transition-all"/>
          </div>
          {tab!=='reset'&&(
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"/>
              <input type={showPw?'text':'password'} placeholder="Password" value={pw} onChange={e=>{setPw(e.target.value);setErr('');}} required
                className="w-full bg-white/[0.07] border border-white/[0.09] text-white pl-11 pr-11 py-3.5 rounded-2xl outline-none focus:border-white/25 focus:bg-white/10 placeholder:text-white/25 text-sm transition-all"/>
              <button type="button" onClick={()=>setShowPw(v=>!v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 outline-none transition-colors">
                {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
              </button>
            </div>
          )}
          {tab==='up'&&(
            <input type="password" placeholder="Confirm password" value={pw2} onChange={e=>{setPw2(e.target.value);setErr('');}} required
              className="w-full bg-white/[0.07] border border-white/[0.09] text-white px-4 py-3.5 rounded-2xl outline-none focus:border-white/25 placeholder:text-white/25 text-sm transition-all"/>
          )}
          {err&&<p className="text-red-400 text-xs py-2 px-3 bg-red-500/8 rounded-xl border border-red-400/15">{err}</p>}
          {msg&&<p className="text-green-400 text-xs py-2 px-3 bg-green-500/8 rounded-xl border border-green-400/15">{msg}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center text-white"
            style={{background:ACCENT}}>
            {loading?<Spin sz={5} c="#fff"/>:tab==='in'?'Sign In':tab==='up'?'Create Account':'Send Reset Email'}
          </button>
        </form>

        {/* Toggle & forgot */}
        <div className="mt-5 space-y-2 text-center">
          {tab==='in'&&<button onClick={()=>{setTab('reset');setErr('');setMsg('');}} className="text-xs text-white/35 hover:text-white/60 transition-colors outline-none">Forgot password?</button>}
          <div className="text-xs text-white/35">
            {tab==='in'?<>No account? <button onClick={()=>{setTab('up');setErr('');}} className="text-white/60 hover:text-white font-semibold outline-none">Sign up</button></>
            :<>Have an account? <button onClick={()=>{setTab('in');setErr('');}} className="text-white/60 hover:text-white font-semibold outline-none">Sign in</button></>}
          </div>
        </div>

        {/* Guest */}
        <div className="mt-6 pt-5 border-t border-white/[0.07]">
          <button onClick={onGuest}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-white/45 border border-white/[0.09] hover:text-white/70 hover:border-white/18 hover:bg-white/5 transition-all outline-none">
            Continue as Guest
          </button>
          <p className="text-white/20 text-[11px] text-center mt-2">Watch history not saved in guest mode</p>
        </div>
      </div>
    </div>
  );
};

// ─── TOP NAV ─────────────────────────────────────────────────────────────────
const TopNav=React.memo(({tab,setTab,genre,setGenre,focus,user,isGuest})=>{
  const[scroll,setScroll]=useState(false);
  const[menu,setMenu]=useState(false);
  const menuRef=useRef(null);
  useEffect(()=>{let t=false;const h=()=>{if(!t){requestAnimationFrame(()=>{setScroll(window.scrollY>40);t=false;});t=true;}};window.addEventListener('scroll',h,{passive:true});return()=>window.removeEventListener('scroll',h);},[]);
  useEffect(()=>{const h=e=>{if(menuRef.current&&!menuRef.current.contains(e.target))setMenu(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);

  const main=[{id:'home',l:'Home'},{id:'movies',l:'Movies'},{id:'tv',l:'Series'},{id:'live',l:'Live TV'},{id:'sports',l:'Sports'}];
  const utils=[{id:'search',I:Search},{id:'watchlist',I:Bookmark},{id:'history',I:Clock}];
  const showSub=tab==='movies'||tab==='tv';
  const genres=tab==='movies'?GENRES.movie:GENRES.tv;
  const initial=(user?.displayName||user?.email||'G')[0].toUpperCase();

  return(
    <header className={cn('fixed top-0 inset-x-0 z-[60] flex flex-col items-center transition-all duration-500',focus?'-translate-y-full':scroll?'bg-black/90 backdrop-blur-3xl border-b border-white/[0.06]':'bg-gradient-to-b from-black/75 to-transparent')}>
      <nav className="w-full max-w-[1800px] flex items-center justify-between px-5 md:px-10 lg:px-14 h-[64px]">
        <div className="flex items-center gap-7">
          <button onClick={()=>setTab('home')} className="w-8 h-8 rounded-[10px] bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg outline-none shrink-0">
            <Play className="w-3.5 h-3.5 fill-black text-black ml-[1px]"/>
          </button>
          <div className="hidden md:flex items-center gap-6">
            {main.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className={cn('text-[13px] font-semibold tracking-[-0.01em] transition-all outline-none relative py-1',tab===t.id?'text-white':'text-white/45 hover:text-white/75')}>
                {t.l}{tab===t.id&&<div className="absolute -bottom-[1px] left-0 w-full h-[2px] rounded-full" style={{background:ACCENT}}/>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Mobile tabs */}
          <div className="md:hidden flex items-center overflow-x-auto gap-4 mr-2 max-w-[38vw] fade-r">
            {main.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className={cn('text-[12px] font-semibold whitespace-nowrap outline-none relative shrink-0',tab===t.id?'text-white':'text-white/40')}>
                {t.l}{tab===t.id&&<div className="absolute -bottom-0.5 left-0 w-full h-[2px] rounded-full" style={{background:ACCENT}}/>}
              </button>
            ))}
          </div>
          {utils.map(u=>(
            <button key={u.id} onClick={()=>setTab(u.id)} className={cn('p-2.5 rounded-full transition-all outline-none',tab===u.id?'text-white':'text-white/45 hover:text-white hover:bg-white/8')} style={tab===u.id?{background:`${ACCENT}33`}:{}}>
              <u.I className="w-[17px] h-[17px]"/>
            </button>
          ))}
          {/* Settings / User menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={()=>setMenu(v=>!v)} className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all outline-none border text-white',menu?'border-white/30 bg-white/10':'border-white/15 hover:border-white/30 bg-white/5')}>
              {isGuest?<User className="w-4 h-4"/>:initial}
            </button>
            {menu&&(
              <div className="absolute right-0 top-11 w-48 glass2 border border-white/10 rounded-2xl p-2 shadow-2xl as z-[200]">
                {!isGuest&&<div className="px-3 pt-2 pb-3 border-b border-white/8"><p className="text-white/80 font-semibold text-sm truncate">{user?.displayName||user?.email}</p><p className="text-white/35 text-xs mt-0.5 truncate">{user?.email}</p></div>}
                <button onClick={()=>{setTab('settings');setMenu(false);}} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/8 text-white/70 hover:text-white text-sm font-medium transition-all outline-none mt-1">
                  <Settings className="w-4 h-4"/>Settings
                </button>
                <button onClick={()=>firebaseSignOut(auth)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400/70 hover:text-red-400 text-sm font-medium transition-all outline-none">
                  <LogOut className="w-4 h-4"/>Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      {/* Genre sub-nav */}
      <div className={cn('w-full max-w-[1800px] overflow-hidden transition-all duration-300',showSub?'max-h-10 opacity-100 pb-2.5':'max-h-0 opacity-0')}>
        <div className="flex items-center overflow-x-auto gap-5 px-5 md:px-10 lg:px-14 fade-r">
          <button onClick={()=>setGenre('All')} className={cn('text-[12px] font-semibold whitespace-nowrap shrink-0 relative py-0.5 outline-none transition-colors',genre==='All'?'text-white':'text-white/38 hover:text-white/65')}>
            All{genre==='All'&&<div className="absolute -bottom-0.5 left-0 w-full h-[2px] rounded-full" style={{background:ACCENT}}/>}
          </button>
          {genres.map(g=>(
            <button key={g.id} onClick={()=>setGenre(g.id)} className={cn('text-[12px] font-semibold whitespace-nowrap shrink-0 relative py-0.5 outline-none transition-colors',genre===g.id?'text-white':'text-white/38 hover:text-white/65')}>
              {g.name}{genre===g.id&&<div className="absolute -bottom-0.5 left-0 w-full h-[2px] rounded-full" style={{background:ACCENT}}/>}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
});

// ─── MEDIA CARDS ─────────────────────────────────────────────────────────────
// PosterCard — portrait 2:3, title+year always visible as gradient overlay inside
const PosterCard=React.memo(({media,onClick,rank=null})=>{
  const[loaded,setLoaded]=useState(false);
  const src=media.poster_path?`${IMG}w342${media.poster_path}`:null;
  const title=media.title||media.name||'';
  const year=fmtYear(media.release_date||media.first_air_date);
  const rating=media.vote_average;
  return(
    <div onClick={()=>onClick(media)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onClick(media);}}
      className="relative group cursor-pointer select-none outline-none flex-shrink-0 snap-start w-full">
      {rank!=null&&(
        <div className="absolute -left-1 bottom-[52px] z-20 select-none pointer-events-none leading-none font-black"
          style={{fontSize:'clamp(3rem,7vw,5.5rem)',color:'transparent',WebkitTextStroke:'2px rgba(255,255,255,.18)',letterSpacing:'-0.04em'}}>
          {rank}
        </div>
      )}
      <div className="relative overflow-hidden rounded-2xl bg-white/[0.05] border border-white/[0.07] transition-all duration-300 group-hover:shadow-[0_20px_50px_-5px_rgba(0,0,0,.9)] group-hover:border-white/[0.15] group-hover:scale-[1.03]" style={{aspectRatio:'2/3'}}>
        {!loaded&&<div className="absolute inset-0 sk"/>}
        {src?(
          <img src={src} alt={title} loading="lazy" decoding="async" draggable="false"
            className={cn('absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.04]',loaded?'opacity-100':'opacity-0')}
            onLoad={()=>setLoaded(true)} onError={()=>setLoaded(true)}/>
        ):(
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
            <Film className="w-7 h-7 text-white/15"/>
            <span className="text-white/25 text-[10px] text-center leading-tight line-clamp-3">{title}</span>
          </div>
        )}
        {/* Always-on bottom gradient with title */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 pb-3 px-3 pointer-events-none">
          <h4 className="text-white font-semibold text-[12px] leading-snug line-clamp-2 mb-0.5 drop-shadow">{title}</h4>
          <div className="flex items-center gap-1.5">
            {year&&<span className="text-white/45 text-[10px] font-medium">{year}</span>}
            {rating>=1&&<><span className="text-white/20 text-[9px]">·</span><span className="text-yellow-400/80 text-[10px] font-semibold flex items-center gap-0.5"><Star className="w-2 h-2 fill-current"/>{rating.toFixed(1)}</span></>}
          </div>
        </div>
        {/* Hover play */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
          <div className="w-12 h-12 rounded-full glass2 border border-white/25 flex items-center justify-center"><Play className="w-5 h-5 fill-white ml-0.5"/></div>
        </div>
        {/* Progress */}
        {media.progress>0&&<div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10"><div className="h-full rounded-full" style={{width:`${Math.min(media.progress,100)}%`,background:ACCENT}}/></div>}
      </div>
    </div>
  );
});

// LandscapeCard — 16:9 backdrop with overlay info (for Trending, Continue Watching rows)
const LandscapeCard=React.memo(({media,onClick})=>{
  const[loaded,setLoaded]=useState(false);
  const src=media.backdrop_path?`${IMG}w780${media.backdrop_path}`:media.poster_path?`${IMG}w342${media.poster_path}`:null;
  const title=media.title||media.name||'';
  const year=fmtYear(media.release_date||media.first_air_date);
  const rating=media.vote_average;
  const isTv=media.media_type==='tv'||(!media.release_date&&media.name&&!media.title);
  return(
    <div onClick={()=>onClick(media)} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onClick(media);}}
      className="relative group cursor-pointer select-none outline-none flex-shrink-0 snap-start w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] transition-all duration-300 group-hover:border-white/[0.18] group-hover:shadow-[0_20px_50px_-5px_rgba(0,0,0,.8)] group-hover:scale-[1.02]"
      style={{aspectRatio:'16/9'}}>
      {!loaded&&<div className="absolute inset-0 sk"/>}
      {src?(
        <img src={src} alt={title} loading="lazy" decoding="async" draggable="false"
          className={cn('absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]',loaded?'opacity-100':'opacity-0')}
          onLoad={()=>setLoaded(true)} onError={()=>setLoaded(true)}/>
      ):(
        <div className="absolute inset-0 flex items-center justify-center"><Film className="w-8 h-8 text-white/15"/></div>
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none"/>
      {/* Top badges */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-white/70 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md">{isTv?'Series':'Movie'}</span>
        {rating>=1&&<span className="text-[9px] font-bold text-yellow-400 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-0.5"><Star className="w-2 h-2 fill-current"/>{rating.toFixed(1)}</span>}
      </div>
      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-3 pointer-events-none">
        <h4 className="text-white font-bold text-[13px] leading-tight mb-0.5 line-clamp-1 drop-shadow-lg">{title}</h4>
        {year&&<p className="text-white/45 text-[11px] font-medium">{year}</p>}
      </div>
      {/* Hover play */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
        <div className="w-11 h-11 rounded-full glass2 border border-white/25 flex items-center justify-center"><Play className="w-4 h-4 fill-white ml-0.5"/></div>
      </div>
      {/* Progress */}
      {media.progress>0&&<div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10"><div className="h-full rounded-full" style={{width:`${Math.min(media.progress,100)}%`,background:ACCENT}}/></div>}
    </div>
  );
});

// ─── CONTENT ROW ─────────────────────────────────────────────────────────────
const Row=React.memo(({title,url,onCard,apiKey,landscape=false,ranking=false,data=null})=>{
  const[items,setItems]=useState([]);
  const[fetched,setFetched]=useState(false);
  const[vis,setVis]=useState(false);
  const ref=useRef(null),sr=useRef(null),obs=useRef(null);
  const dn=useRef(false),sx=useRef(0),sl=useRef(0),drag=useRef(false),st=useRef(null);
  const loop=items.length>=6&&!ranking&&!landscape;
  const disp=loop?[...items,...items,...items]:items;

  const setRef=useCallback(n=>{if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVis(true);obs.current?.disconnect();}},{rootMargin:'600px'});if(n){ref.current=n;obs.current.observe(n);}},[]);
  useEffect(()=>{if(data){setItems(data);setFetched(true);return;}if(!apiKey||!url||!vis||fetched)return;let ok=true;(async()=>{try{const s=url.includes('?')?'&':'?';const[d1,d2]=await Promise.all([fetch2(`${BASE}${url}${s}api_key=${apiKey}&page=1`),fetch2(`${BASE}${url}${s}api_key=${apiKey}&page=2`)]);if(!ok)return;const r=[...(d1.results||[]),...(d2.results||[])].filter(i=>landscape?i.backdrop_path:i.poster_path);setItems(Array.from(new Map(r.map(i=>[i.id,i])).values()));setFetched(true);}catch{}})();return()=>{ok=false;};},[url,apiKey,data,vis,fetched,landscape]);

  const blk=useCallback(()=>{if(!sr.current||!items.length||!loop)return 0;const ch=sr.current.children;return ch.length>=items.length*3&&ch[items.length]?ch[items.length].offsetLeft-ch[0].offsetLeft:0;},[items.length,loop]);
  useEffect(()=>{if(fetched&&sr.current&&loop){const t=setTimeout(()=>{if(sr.current){sr.current.style.scrollBehavior='auto';sr.current.scrollLeft=blk();setTimeout(()=>{if(sr.current)sr.current.style.scrollBehavior='smooth';},50);}},50);return()=>clearTimeout(t);}},[fetched,loop,blk]);

  const snap=useCallback(()=>{if(!loop||drag.current||dn.current||!sr.current)return;const b=blk();if(!b)return;const s=sr.current;if(s.scrollLeft<b*.5){s.style.scrollBehavior='auto';s.scrollLeft+=b;setTimeout(()=>{if(s)s.style.scrollBehavior='smooth';},40);}else if(s.scrollLeft>b*1.5){s.style.scrollBehavior='auto';s.scrollLeft-=b;setTimeout(()=>{if(s)s.style.scrollBehavior='smooth';},40);}},[loop,blk]);
  const scrl=d=>{if(sr.current)sr.current.scrollBy({left:d==='r'?sr.current.clientWidth*.75:-sr.current.clientWidth*.75,behavior:'smooth'});};
  const md=e=>{dn.current=true;drag.current=false;sx.current=e.pageX-sr.current.offsetLeft;sl.current=sr.current.scrollLeft;sr.current.style.scrollBehavior='auto';};
  const ml=()=>{dn.current=false;if(sr.current)sr.current.style.scrollBehavior='smooth';};
  const mu=()=>{dn.current=false;if(sr.current){sr.current.style.scrollBehavior='smooth';snap();}};
  const mm=e=>{if(!dn.current)return;e.preventDefault();const w=(e.pageX-sr.current.offsetLeft-sx.current)*1.4;if(Math.abs(w)>4)drag.current=true;let nl=sl.current-w;if(loop){const b=blk();if(b>0){if(nl<5){nl+=b;sl.current+=b;}else if(nl>sr.current.scrollWidth-sr.current.clientWidth-5){nl-=b;sl.current-=b;}}}sr.current.scrollLeft=nl;};
  const click=useCallback(m=>{if(!drag.current)onCard(m);},[onCard]);

  if(!data&&!fetched)return<div ref={setRef} className="mb-10 w-full" style={{height:landscape?'12rem':'15rem'}}/>;
  if(!items.length)return null;

  return(
    <div ref={setRef} className="mb-8 md:mb-10 group/row">
      <div className="flex items-center justify-between px-5 md:px-10 lg:px-14 mb-4 max-w-[1800px] mx-auto">
        <h2 className="text-[16px] md:text-[18px] font-bold tracking-[-0.02em] text-white/88">{title}</h2>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover/row:text-white/45 transition-colors"/>
      </div>
      <div className="relative group/nav max-w-[1800px] mx-auto">
        <button onClick={()=>scrl('l')} className="absolute left-0 inset-y-0 w-12 md:w-16 bg-gradient-to-r from-black/95 via-black/60 to-transparent z-10 hidden md:flex items-center justify-start pl-2 opacity-0 group-hover/nav:opacity-100 transition-all outline-none">
          <div className="w-8 h-8 rounded-full glass2 border border-white/12 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shadow-xl"><ChevronLeft className="w-4 h-4"/></div>
        </button>
        <div ref={sr} onScroll={()=>{clearTimeout(st.current);st.current=setTimeout(snap,200);}} onMouseDown={md} onMouseLeave={ml} onMouseUp={mu} onMouseMove={mm}
          className={cn('flex overflow-x-auto gap-3 md:gap-4 py-1 px-5 md:px-10 lg:px-14 cursor-grab active:cursor-grabbing snap-x snap-mandatory',ranking&&'pl-8 md:pl-14')}
          style={{scrollBehavior:'smooth'}}>
          {disp.map((m,i)=>landscape
            ?<div key={`${m.id}_${i}`} className="w-64 md:w-80 flex-shrink-0 snap-start"><LandscapeCard media={m} onClick={click}/></div>
            :<div key={`${m.id}_${i}`} className={cn('flex-shrink-0 snap-start',ranking?'w-24 md:w-36':'w-[110px] sm:w-[130px] md:w-[145px] lg:w-[160px]')}><PosterCard media={m} onClick={click} rank={ranking?i+1:null}/></div>
          )}
        </div>
        <button onClick={()=>scrl('r')} className="absolute right-0 inset-y-0 w-12 md:w-16 bg-gradient-to-l from-black/95 via-black/60 to-transparent z-10 hidden md:flex items-center justify-end pr-2 opacity-0 group-hover/nav:opacity-100 transition-all outline-none">
          <div className="w-8 h-8 rounded-full glass2 border border-white/12 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all shadow-xl"><ChevronRight className="w-4 h-4"/></div>
        </button>
      </div>
    </div>
  );
});

// ─── HERO ────────────────────────────────────────────────────────────────────
const Hero=React.memo(({onPlay,onInfo,apiKey,type='all'})=>{
  const[m,setM]=useState(null);
  const rand=useCallback(async()=>{try{const ep=type==='all'?'/trending/all/day':type==='movie'?'/trending/movie/day':'/trending/tv/day';const[d1,d2]=await Promise.all([fetch2(`${BASE}${ep}?api_key=${apiKey}`),fetch2(`${BASE}${ep}?api_key=${apiKey}&page=2`)]);const v=[...(d1.results||[]),...(d2.results||[])].filter(i=>i.backdrop_path&&!i.adult);setM(v[Math.floor(Math.random()*v.length)]);}catch{}},[apiKey,type]);
  useEffect(()=>{if(apiKey)rand();},[apiKey,rand]);
  if(!m)return<div className="h-[75vh] bg-gradient-to-b from-[#111] to-black"/>;
  const bg=`${IMG}w1280${m.backdrop_path}`;const isTv=m.media_type==='tv';
  return(
    <div className="relative w-full min-h-[72vh] flex flex-col justify-end overflow-hidden bg-black">
      <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover object-center opacity-70 scale-[1.02]" decoding="async" draggable="false"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"/>
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/35 to-transparent hidden md:block"/>
      <div className="relative px-5 md:px-14 pb-16 md:pb-20 pt-36 max-w-[1800px] mx-auto w-full">
        <div className="max-w-2xl au">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black text-white/55 uppercase tracking-[0.18em] border border-white/12 px-2.5 py-[3px] rounded">{isTv?'Series':'Film'}</span>
            {m.vote_average>0&&<span className="text-[10px] font-bold text-yellow-400 flex items-center gap-1 bg-yellow-400/10 px-2 py-[3px] rounded"><Star className="w-2.5 h-2.5 fill-current"/>{m.vote_average.toFixed(1)}</span>}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] mb-4 text-white drop-shadow-xl">{m.title||m.name}</h1>
          <p className="text-white/60 text-sm md:text-[15px] leading-relaxed max-w-xl line-clamp-2 md:line-clamp-3 mb-8">{m.overview}</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={()=>onPlay(m)} className="flex items-center gap-2.5 bg-white text-black px-7 py-3.5 rounded-full font-bold text-[14px] hover:bg-white/90 hover:scale-[1.02] transition-all shadow-xl outline-none"><Play className="w-5 h-5 fill-black"/>Play</button>
            <button onClick={()=>onInfo(m)} className="flex items-center gap-2 glass2 border border-white/12 text-white px-7 py-3.5 rounded-full font-semibold text-[14px] hover:bg-white/12 hover:scale-[1.02] transition-all outline-none"><Info className="w-5 h-5"/>More Info</button>
            <button onClick={rand} className="w-12 h-12 glass2 border border-white/12 text-white rounded-full flex items-center justify-center hover:bg-white/12 hover:scale-[1.02] transition-all outline-none" title="Shuffle"><Shuffle className="w-4 h-4"/></button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
const HomeView=React.memo(({apiKey,history,watchlist,algoPrefs,onPlay,onInfo})=>{
  const[dynRows,setDynRows]=useState([]);
  const[hasMore,setHasMore]=useState(true);
  const obs=useRef(null);
  const used=useRef(new Set(['t10','cont','onair','topM','topT']));
  const cont=useMemo(()=>history.filter(i=>i.progress>0&&i.progress<95).slice(0,10),[history]);
  const genRow=useCallback(()=>{for(const s of [...history,...watchlist].sort(()=>.5-Math.random())){const k=`rec_${s.id}`;if(!used.current.has(k)){used.current.add(k);const t=s.media_type||'movie';return{id:k,title:`Because you ${history.some(h=>h.id===s.id)?'watched':'saved'} "${(s.title||s.name||'').slice(0,25)}"`,url:`/${t}/${s.id}/recommendations`,landscape:true};}}for(const g of ALL_GENRES.filter(g=>!algoPrefs.excluded.includes(g.id)).sort(()=>.5-Math.random())){const km=`gm_${g.id}`;if(!used.current.has(km)){used.current.add(km);return{id:km,title:`${g.name} Movies`,url:`/discover/movie?with_genres=${g.id}&sort_by=popularity.desc`};}const kt=`gt_${g.id}`;if(!used.current.has(kt)){used.current.add(kt);return{id:kt,title:`${g.name} Series`,url:`/discover/tv?with_genres=${g.id}&sort_by=popularity.desc`};}}return null;},[algoPrefs,history,watchlist]);
  const lastRef=useCallback(n=>{if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting&&hasMore){setDynRows(p=>{const nr=[];for(let i=0;i<3;i++){const r=genRow();if(r)nr.push(r);}if(!nr.length)setHasMore(false);return[...p,...nr];});}},{rootMargin:'800px'});if(n)obs.current.observe(n);},[hasMore,genRow]);
  return(
    <div className="pb-28 bg-black min-h-screen">
      <Hero onPlay={onPlay} onInfo={onInfo} apiKey={apiKey}/>
      <div className="-mt-16 md:-mt-24 relative z-10">
        {cont.length>0&&<Row title="Continue Watching" data={cont} onCard={onInfo} landscape/>}
        <Row title="Top 10 Today" url="/trending/all/day" onCard={onInfo} apiKey={apiKey} ranking/>
        <Row title="Trending Now" url="/trending/all/week" onCard={onInfo} apiKey={apiKey} landscape/>
        <Row title="New in Theatres" url="/movie/now_playing" onCard={onInfo} apiKey={apiKey}/>
        <Row title="Now Airing" url="/tv/on_the_air" onCard={onInfo} apiKey={apiKey}/>
        <Row title="Highest Rated Movies" url="/movie/top_rated" onCard={onInfo} apiKey={apiKey} landscape/>
        <Row title="Acclaimed Series" url="/tv/top_rated" onCard={onInfo} apiKey={apiKey}/>
        {dynRows.map(r=><Row key={r.id} title={r.title} url={r.url} onCard={onInfo} apiKey={apiKey} landscape={r.landscape}/>)}
        {hasMore&&<div ref={lastRef} className="h-10 flex items-center justify-center"><Spin sz={5}/></div>}
      </div>
    </div>
  );
});

// ─── GENRE GRID ───────────────────────────────────────────────────────────────
const GridView=React.memo(({apiKey,type,genreId,onCard})=>{
  const[res,setRes]=useState([]),[pg,setPg]=useState(1),[more,setMore]=useState(true),[load,setLoad]=useState(false);
  const obs=useRef();
  const gObj=ALL_GENRES.find(g=>g.id===genreId);
  useEffect(()=>{setRes([]);setPg(1);setMore(true);},[genreId,type]);
  useEffect(()=>{let ok=true;setLoad(true);(async()=>{try{let u=`${BASE}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&page=${pg}`;if(gObj)u+=`&with_genres=${gObj.id}`;const d=await fetch2(u);if(!ok)return;if(d.results?.length){setRes(p=>Array.from(new Map([...p,...d.results.filter(i=>i.poster_path)].map(i=>[i.id,i])).values()));if(pg>=d.total_pages||pg>=50)setMore(false);}else setMore(false);}catch{}if(ok)setLoad(false);})();return()=>{ok=false;};},[apiKey,type,genreId,pg,gObj]);
  const last=useCallback(n=>{if(load)return;if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting&&more)setPg(p=>p+1);},{rootMargin:'600px'});if(n)obs.current.observe(n);},[load,more]);
  return(
    <div className="pt-24 md:pt-28 px-5 md:px-10 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto pb-28 au">
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8 text-white">{gObj?.name} {type==='movie'?'Movies':'Series'}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-6 pb-12">
        {res.map(i=><PosterCard key={i.id} media={i} onClick={onCard}/>)}
      </div>
      {more&&<div ref={last} className="py-10 flex justify-center"><Spin/></div>}
    </div>
  );
});

// ─── SEARCH VIEW ─────────────────────────────────────────────────────────────
const SearchView=React.memo(({apiKey,geminiKey,history,onCard})=>{
  const[mode,setMode]=useState('standard');
  const[q,setQ]=useState('');
  const dq=useDebounce(q,500);
  const[res,setRes]=useState([]),[pg,setPg]=useState(1),[more,setMore]=useState(true),[loading,setLoading]=useState(false);
  const[fType,setFType]=useState('all'),[fSort,setFSort]=useState('popularity.desc');
  const[fGenre,setFGenre]=useState(''),[fYear,setFYear]=useState(''),[fRating,setFRating]=useState('');
  const[showF,setShowF]=useState(false);
  const[aiQ,setAiQ]=useState(''),[aiLoad,setAiLoad]=useState(false),[aiRes,setAiRes]=useState(null),[aiErr,setAiErr]=useState('');
  const obs=useRef();
  const cy=new Date().getFullYear();
  const yrs=[...Array(35)].map((_,i)=>cy-i).map(String);
  const fc=[fGenre,fYear,fRating].filter(Boolean).length;

  useEffect(()=>{setRes([]);setPg(1);setMore(true);},[dq,fType,fSort,fGenre,fYear,fRating,mode]);
  useEffect(()=>{
    let ok=true;if(mode!=='standard')return;
    (async()=>{
      setLoading(true);
      try{
        let nr=[],tp=1;
        if(!dq){
          const types=fType==='all'?['movie','tv']:[fType];
          const urls=[];
          types.forEach(t=>{let u=`${BASE}/discover/${t}?api_key=${apiKey}&sort_by=${fSort}&page=${pg}`;if(fGenre)u+=`&with_genres=${fGenre}`;if(fYear)u+=`&${t==='movie'?'primary_release_year':'first_air_date_year'}=${fYear}`;if(fRating)u+=`&vote_average.gte=${fRating}`;urls.push(u,u.replace(`page=${pg}`,`page=${pg+1}`));});
          const rs=await Promise.all(urls.map(u=>fetch2(u)));if(!ok)return;
          rs.forEach(d=>{if(d.results)nr.push(...d.results.filter(i=>i.poster_path).map(i=>({...i,media_type:i.media_type||(fType==='all'?'movie':fType)})));tp=Math.max(tp,d.total_pages||1);});
        }else{
          const cq=dq.replace(/ movies?| films?| shows?| series/gi,'').trim();
          const rs=await Promise.all([1,2,3].map(n=>fetch2(`${BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(cq)}&page=${pg+n-1}`)));if(!ok)return;
          rs.forEach(d=>{if(d.results){let v=d.results.filter(i=>(i.media_type==='movie'||i.media_type==='tv')&&i.poster_path);if(fType!=='all')v=v.filter(i=>i.media_type===fType);if(fRating)v=v.filter(i=>(i.vote_average||0)>=parseFloat(fRating));nr.push(...v);tp=Math.max(tp,d.total_pages||1);}});
        }
        const dd=Array.from(new Map(nr.map(i=>[i.id,i])).values()).sort((a,b)=>fSort.includes('vote_average')?(b.vote_average||0)-(a.vote_average||0):(b.popularity||0)-(a.popularity||0));
        setRes(p=>pg===1?dd:[...p,...dd.filter(i=>!p.some(x=>x.id===i.id))]);
        if(pg>=tp||pg>=40)setMore(false);
      }catch{}finally{if(ok)setLoading(false);}
    })();return()=>{ok=false;};
  },[dq,apiKey,fType,fSort,fGenre,fYear,fRating,pg,mode]);

  const lastRef=useCallback(n=>{if(loading||mode!=='standard')return;if(obs.current)obs.current.disconnect();obs.current=new IntersectionObserver(([e])=>{if(e.isIntersecting&&more)setPg(p=>p+(dq?3:2));},{rootMargin:'600px'});if(n)obs.current.observe(n);},[loading,more,dq,mode]);

  const handleAi=async evt=>{
    evt.preventDefault();if(!aiQ.trim()||aiLoad)return;
    if(!geminiKey){setAiErr('Add your Gemini API key in Settings → API Keys.');return;}
    setAiLoad(true);setAiErr('');setAiRes(null);
    const MODELS=['gemini-2.0-flash-lite','gemini-2.0-flash','gemini-1.5-flash'];
    let lastErr='';
    for(const model of MODELS){
      try{
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({contents:[{parts:[{text:`User wants: "${aiQ}"\nWatch history: ${history.slice(0,8).map(h=>h.title||h.name).join(', ')||'none'}\n\nRespond with ONLY valid JSON: {"text_response":"your recommendation intro (2 sentences)","items":[{"type":"movie or tv","search_query":"title to search","reason":"one sentence why"}]}`}]}],generationConfig:{maxOutputTokens:800}})
        });
        if(!r.ok){const e=await r.json().catch(()=>({}));const msg=e?.error?.message||`HTTP ${r.status}`;if(r.status===404||msg.includes('not found')){{lastErr=msg;continue;}}throw new Error(msg);}
        const raw=await r.json();const txt=raw.candidates?.[0]?.content?.parts?.[0]?.text||'';
        const jm=txt.match(/\{[\s\S]*\}/);if(!jm)throw new Error('Bad response format');
        const j=JSON.parse(jm[0]);
        const cards=[];
        for(const rec of(j.items||[]).slice(0,8)){try{const sr=await fetch2(`${BASE}/search/${rec.type==='tv'?'tv':'movie'}?api_key=${apiKey}&query=${encodeURIComponent(rec.search_query)}`);const m=sr.results?.find(x=>x.poster_path);if(m)cards.push({...rec,media:m});}catch{}}
        setAiRes({text:(j.text_response||'').replace(/\*/g,''),cards});setAiLoad(false);return;
      }catch(e){const msg=e.message||'';if(msg.includes('quota')||msg.includes('429')){setAiErr('Gemini quota exceeded — please wait a moment then retry.');setAiLoad(false);return;}lastErr=msg;}
    }
    setAiErr(`Could not reach Gemini. ${lastErr||'Check your API key.'}`);setAiLoad(false);
  };

  return(
    <div className="pt-24 md:pt-28 px-5 md:px-10 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto pb-28 au">
      {/* Mode toggle */}
      <div className="flex justify-center mb-6">
        <div className="glass border border-white/10 p-[3px] rounded-full flex gap-[2px]">
          {[['standard','Search',Search],['ai','Ask AI',Sparkles]].map(([id,lbl,Icon])=>(
            <button key={id} onClick={()=>setMode(id)} className={cn('flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-semibold transition-all outline-none',mode===id?id==='ai'?'text-white shadow':'bg-white text-black shadow':'text-white/45 hover:text-white')}>
              <Icon className="w-3.5 h-3.5"/>{lbl}
            </button>
          ))}
        </div>
      </div>

      {mode==='standard'&&(<>
        <div className="sticky top-[60px] bg-black/92 backdrop-blur-2xl pt-2 pb-4 z-40 max-w-3xl mx-auto mb-8">
          {/* Search input */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"/>
            <input type="text" placeholder="Search movies, series, genres…" value={q} onChange={e=>setQ(e.target.value)} autoFocus
              className="w-full bg-white/[0.07] border border-white/[0.09] text-white pl-11 pr-10 py-3.5 rounded-2xl outline-none placeholder:text-white/25 focus:bg-white/10 focus:border-white/20 text-[14px] transition-all"/>
            {q&&<button onClick={()=>setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white outline-none"><X className="w-4 h-4"/></button>}
          </div>
          {/* Primary filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type pill */}
            <div className="glass border border-white/10 p-[3px] rounded-full flex gap-[2px]">
              {[['all','All'],['movie','Movies'],['tv','Series']].map(([v,l])=>(
                <button key={v} onClick={()=>setFType(v)} className={cn('px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all outline-none',fType===v?'bg-white text-black':'text-white/45 hover:text-white')}>{l}</button>
              ))}
            </div>
            {/* Sort */}
            <select value={fSort} onChange={e=>setFSort(e.target.value)} className="cs glass border border-white/10 text-white/70 rounded-full px-4 py-2 outline-none text-[12px] font-semibold pr-7">
              <option value="popularity.desc" className="bg-[#111]">Popular</option>
              <option value="vote_average.desc" className="bg-[#111]">Top Rated</option>
              <option value="primary_release_date.desc" className="bg-[#111]">Newest</option>
              <option value="revenue.desc" className="bg-[#111]">Box Office</option>
            </select>
            {/* Filters toggle */}
            <button onClick={()=>setShowF(v=>!v)} className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold border transition-all outline-none',showF||fc>0?'bg-white/10 border-white/20 text-white':'glass border-white/10 text-white/45 hover:text-white')}>
              <Filter className="w-3 h-3"/>Filters{fc>0&&<span className="w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center" style={{background:ACCENT}}>{fc}</span>}
            </button>
            {fc>0&&<button onClick={()=>{setFGenre('');setFYear('');setFRating('');}} className="text-[11px] text-white/35 hover:text-white/60 flex items-center gap-1 outline-none"><X className="w-3 h-3"/>Clear</button>}
          </div>
          {/* Expanded filters */}
          {showF&&(
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.07]">
              <select value={fGenre} onChange={e=>setFGenre(e.target.value)} className="cs glass border border-white/10 text-white/70 rounded-full px-4 py-2 outline-none text-[12px] font-semibold pr-7">
                <option value="" className="bg-[#111]">All Genres</option>
                {ALL_GENRES.map(g=><option key={g.id} value={g.id} className="bg-[#111]">{g.name}</option>)}
              </select>
              <select value={fYear} onChange={e=>setFYear(e.target.value)} className="cs glass border border-white/10 text-white/70 rounded-full px-4 py-2 outline-none text-[12px] font-semibold pr-7">
                <option value="" className="bg-[#111]">Any Year</option>
                {yrs.map(y=><option key={y} value={y} className="bg-[#111]">{y}</option>)}
              </select>
              <select value={fRating} onChange={e=>setFRating(e.target.value)} className="cs glass border border-white/10 text-white/70 rounded-full px-4 py-2 outline-none text-[12px] font-semibold pr-7">
                <option value="" className="bg-[#111]">Any Rating</option>
                <option value="9" className="bg-[#111]">9+ ★ Masterpiece</option>
                <option value="8" className="bg-[#111]">8+ ★ Excellent</option>
                <option value="7" className="bg-[#111]">7+ ★ Great</option>
                <option value="6" className="bg-[#111]">6+ ★ Good</option>
                <option value="5" className="bg-[#111]">5+ ★ Average</option>
              </select>
            </div>
          )}
        </div>
        {res.length>0?(<>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-7 pb-10">
            {res.map(i=><PosterCard key={i.id} media={i} onClick={onCard}/>)}
          </div>
          {more&&<div ref={lastRef} className="py-10 flex justify-center"><Spin/></div>}
          {!more&&res.length>0&&<p className="text-center text-white/20 text-xs py-6">End of results</p>}
        </>):loading?(<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{[...Array(10)].map((_,i)=><div key={i} className="aspect-[2/3] sk rounded-2xl"/>)}</div>):(
          <div className="py-28 text-center text-white/25"><Search className="w-12 h-12 mx-auto mb-4 opacity-20"/><p>Search or browse above</p></div>
        )}
      </>)}

      {mode==='ai'&&(
        <div className="max-w-2xl mx-auto">
          {!geminiKey&&<div className="mb-6 p-4 rounded-2xl border border-white/8 text-center" style={{background:`${ACCENT}12`}}><Sparkles className="w-6 h-6 mx-auto mb-2" style={{color:ACCENT}}/><p className="text-white/70 text-sm font-semibold">Add your Gemini API key in Settings → API Keys</p></div>}
          <form onSubmit={handleAi} className="relative mb-8">
            <input type="text" placeholder="e.g. Dark sci-fi with mind-bending plot twists…" value={aiQ} onChange={e=>setAiQ(e.target.value)} disabled={aiLoad} autoFocus
              className="w-full glass border border-white/10 text-white py-4 pl-5 pr-14 rounded-2xl outline-none placeholder:text-white/25 focus:border-white/20 text-[14px] transition-all"/>
            <button type="submit" disabled={aiLoad||!aiQ.trim()||!geminiKey} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl text-white disabled:opacity-40 outline-none transition-all" style={{background:ACCENT}}>
              {aiLoad?<Spin sz={5} c="#fff"/>:<Send className="w-4 h-4"/>}
            </button>
          </form>
          {aiErr&&<div className="text-red-400 text-sm mb-6 p-4 rounded-2xl bg-red-500/8 border border-red-500/12">{aiErr}</div>}
          {aiRes&&(
            <div className="glass border border-white/8 rounded-2xl p-6 as">
              <p className="text-white/75 text-[15px] leading-relaxed mb-6">{aiRes.text}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-5">
                {aiRes.cards.map((c,i)=>(
                  <div key={i} onClick={()=>onCard(c.media)} className="cursor-pointer group">
                    <PosterCard media={c.media} onClick={()=>onCard(c.media)}/>
                    <p className="text-white/40 text-[10px] mt-1.5 line-clamp-2 leading-tight px-0.5">{c.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─── LIVE TV ─────────────────────────────────────────────────────────────────
const LiveTile=React.memo(({ch,isMain,onFocus,hasAudio,onAudio,vol,onVol})=>{
  const vRef=useRef(null),hlsRef=useRef(null),cRef=useRef(null);
  const[hasVid,setHasVid]=useState(false),[err,setErr]=useState(false),[inView,setInView]=useState(false),[playing,setPlaying]=useState(true);
  useEffect(()=>{const o=new IntersectionObserver(([e])=>setInView(e.isIntersecting),{threshold:.05});if(cRef.current)o.observe(cRef.current);return()=>o.disconnect();},[]);
  const load=useCallback(()=>{setErr(false);setHasVid(false);const v=vRef.current;if(!v)return null;return initHls(v,ch.url,isMain,{onParsed:()=>v.play().then(()=>{setHasVid(true);setPlaying(true);}).catch(()=>{}),onError:(e,d)=>{if(d.fatal){if(d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR&&hlsRef.current)hlsRef.current.startLoad();else if(d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR&&hlsRef.current)hlsRef.current.recoverMediaError();else{if(hlsRef.current)hlsRef.current.destroy();setErr(true);}}}});},[ch.url,isMain]);
  useEffect(()=>{if(!inView)return;let i;loadHls(()=>{i=load();hlsRef.current=i;});return()=>{if(i)i.destroy();if(vRef.current){vRef.current.pause();vRef.current.removeAttribute('src');vRef.current.load();}};},[inView,load]);
  useEffect(()=>{if(vRef.current){vRef.current.muted=!hasAudio;vRef.current.volume=vol;}},[hasAudio,vol]);
  const tog=e=>{e.stopPropagation();if(vRef.current){playing?vRef.current.pause():vRef.current.play().catch(()=>{});setPlaying(!playing);}};
  const retry=e=>{e.stopPropagation();if(hlsRef.current)hlsRef.current.destroy();load();};
  if(err)return(
    <div ref={cRef} onClick={()=>onFocus&&!isMain&&onFocus()} className="w-full h-full rounded-xl border border-white/5 bg-white/[0.03] flex items-center justify-center cursor-pointer">
      <div className="text-center"><div className="w-10 h-10 mx-auto mb-2 bg-white rounded-lg flex items-center justify-center p-1.5"><img src={ch.logo} className="w-full h-full object-contain" alt="" onError={e=>{e.target.style.display='none';}}/></div>{isMain&&<button onClick={retry} className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 mx-auto"><RefreshCw className="w-3 h-3"/>Retry</button>}</div>
    </div>
  );
  return(
    <div ref={cRef} onClick={()=>onFocus&&!isMain&&onFocus()} className={cn('relative w-full h-full overflow-hidden rounded-xl group cursor-pointer',hasAudio&&!isMain?'border-2':'border border-white/8 hover:border-white/20')} style={hasAudio&&!isMain?{borderColor:ACCENT}:{}}>
      <video ref={vRef} muted={!hasAudio} playsInline className={cn('absolute inset-0 w-full h-full object-contain bg-black transition-opacity',hasVid?'opacity-100':'opacity-0')}/>
      {!hasVid&&<div className="absolute inset-0 flex items-center justify-center"><Spin/></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"/>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
        <button onMouseDown={e=>e.stopPropagation()} onClick={tog} className={cn('glass2 border border-white/15 text-white rounded-full flex items-center justify-center pointer-events-auto outline-none hover:bg-white hover:text-black transition-all',isMain?'w-11 h-11':'w-8 h-8')}>
          {playing?<Pause className={cn('fill-current',isMain?'w-4 h-4':'w-3 h-3')}/>:<Play className={cn('fill-current ml-0.5',isMain?'w-4 h-4':'w-3 h-3')}/>}
        </button>
      </div>
      <div className={cn('absolute z-10 opacity-0 group-hover:opacity-100 pointer-events-none',isMain?'bottom-3 left-3':'top-1.5 left-1.5')}>
        <div className="flex items-center gap-1.5 glass2 border border-white/10 p-1 rounded-lg pointer-events-auto">
          <div className="bg-white rounded p-0.5 shrink-0 w-7 h-4 flex items-center justify-center"><img src={ch.logo} className="w-full h-full object-contain" alt=""/></div>
          {isMain&&<span className="text-white text-xs font-semibold pr-1 truncate max-w-[100px]">{ch.name}</span>}
        </div>
      </div>
      <div className="absolute bottom-2 right-2 glass2 border border-white/8 p-0.5 rounded-full flex items-center gap-0.5 opacity-0 group-hover:opacity-100 pointer-events-auto z-10">
        <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onAudio&&onAudio();}} className={cn('p-1.5 rounded-full outline-none transition-colors text-white',hasAudio?'':'hover:bg-white/10')} style={hasAudio?{background:ACCENT}:{}}>
          {hasAudio?<Volume2 className="w-3 h-3"/>:<VolumeX className="w-3 h-3"/>}
        </button>
        {hasAudio&&isMain&&<input type="range" min="0" max="1" step=".05" value={vol} onMouseDown={e=>e.stopPropagation()} onChange={e=>onVol(parseFloat(e.target.value))} className="w-14 hidden sm:block cursor-pointer"/>}
        <button onMouseDown={e=>e.stopPropagation()} onClick={retry} className="p-1.5 rounded-full text-white hover:bg-white/10 outline-none"><RefreshCw className="w-3 h-3"/></button>
      </div>
    </div>
  );
});

const LiveTvView=React.memo(({focus,setFocus})=>{
  const[view,setView]=useLS('ltv_v','sidebar');
  const[cols,setCols]=useLS('ltv_c',3);
  const[main,setMain]=useState(LIVE_CH[0].id);
  const[audio,setAudio]=useState([LIVE_CH[0].id]);
  const[vol,setVol]=useLS('ltv_vol',1);
  const reqAudio=id=>setAudio(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const setFocusCh=id=>{setMain(id);setAudio([id]);if(view==='grid')setView('sidebar');};
  const mainCh=LIVE_CH.find(c=>c.id===main)||LIVE_CH[0];
  const others=LIVE_CH.filter(c=>c.id!==main);
  const colCls=['','grid-cols-1 max-w-xl mx-auto','grid-cols-2','grid-cols-2 md:grid-cols-3','grid-cols-2 md:grid-cols-4','grid-cols-3 md:grid-cols-5'][cols]||'grid-cols-3';
  return(
    <div className={cn('bg-black flex flex-col px-5 md:px-10 lg:px-14 max-w-[1800px] mx-auto',focus?'pt-3':'pt-[68px]',view==='sidebar'||view==='single'?'h-screen overflow-hidden pb-4':'min-h-screen pb-28')}>
      <div className={cn('flex items-center justify-end gap-2 py-3 shrink-0',focus?'mb-2':'mb-4')}>
        {view==='grid'&&<div className="flex items-center gap-2 glass border border-white/10 px-4 py-1.5 rounded-full"><span className="text-[11px] text-white/40 hidden sm:block">Columns</span><input type="range" min="1" max="5" value={cols} onChange={e=>setCols(+e.target.value)} className="w-12 cursor-pointer"/><span className="text-xs font-bold text-white w-3">{cols}</span></div>}
        <div className="glass border border-white/10 p-[3px] rounded-full flex gap-[2px]">
          {[['grid',<LayoutGrid key="g" className="w-3.5 h-3.5"/>,],['sidebar',<Sidebar key="s" className="w-3.5 h-3.5"/>],['single',<Square key="sq" className="w-3.5 h-3.5"/>]].map(([id,icon])=>(
            <button key={id} onClick={()=>setView(id)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all outline-none flex items-center gap-1 capitalize',view===id?'bg-white text-black':'text-white/45 hover:text-white')}>
              {icon}<span className="hidden sm:inline">{id}</span>
            </button>
          ))}
          <div className="w-px bg-white/10 self-stretch mx-0.5 hidden sm:block"/>
          <button onClick={()=>setFocus(v=>!v)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all outline-none flex items-center gap-1',focus?'text-white':'text-white/45 hover:text-white')} style={focus?{background:ACCENT}:{}}>
            {focus?<Minimize className="w-3.5 h-3.5"/>:<Maximize className="w-3.5 h-3.5"/>}<span className="hidden sm:inline">Focus</span>
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        {view==='sidebar'&&<div className="flex flex-col lg:flex-row gap-3 h-full min-h-0"><div className="flex-1 min-h-0 rounded-2xl overflow-hidden"><LiveTile ch={mainCh} isMain hasAudio={audio.includes(mainCh.id)} onAudio={()=>reqAudio(mainCh.id)} vol={vol} onVol={setVol}/></div><div className="w-full lg:w-64 xl:w-72 flex-shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 min-h-[120px] lg:min-h-0">{others.map(c=><div key={c.id} className="w-44 lg:w-full aspect-video flex-shrink-0"><LiveTile ch={c} isMain={false} onFocus={()=>setFocusCh(c.id)} hasAudio={audio.includes(c.id)} onAudio={()=>reqAudio(c.id)} vol={vol} onVol={setVol}/></div>)}</div></div>}
        {view==='single'&&<div className="flex-1 min-h-0 relative group rounded-2xl overflow-hidden"><div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity"><select value={mainCh.id} onChange={e=>setFocusCh(e.target.value)} className="cs glass2 text-white border border-white/12 rounded-full px-4 py-2 outline-none text-sm font-semibold pr-8">{LIVE_CH.map(c=><option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}</select></div><LiveTile ch={mainCh} isMain hasAudio={audio.includes(mainCh.id)} onAudio={()=>reqAudio(mainCh.id)} vol={vol} onVol={setVol}/></div>}
        {view==='grid'&&<div className={cn('grid gap-3 overflow-y-auto pb-28 pt-1 h-full min-h-0',colCls)}>{LIVE_CH.map(c=><div key={c.id} className="aspect-video"><LiveTile ch={c} isMain={c.id===main} onFocus={()=>setFocusCh(c.id)} hasAudio={audio.includes(c.id)} onAudio={()=>reqAudio(c.id)} vol={vol} onVol={setVol}/></div>)}</div>}
      </div>
    </div>
  );
});

// ─── SPORTS ──────────────────────────────────────────────────────────────────
const fmtSport=n=>{if(!n)return'';const m={'football':'Soccer','american-football':'NFL','basketball':'NBA','baseball':'MLB','hockey':'NHL','tennis':'Tennis','mma':'MMA','boxing':'Boxing','cricket':'Cricket','rugby':'Rugby','motor-sports':'Motorsport'};return m[n.toLowerCase()]||n.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');};
const rSc=s=>{if(s==null)return'—';if(typeof s==='object')return String(s.current||s.display||s.total||'—');return String(s);};

const SportCard=({match,live,fmtT,onPlay,loading})=>{
  const[scores,setScores]=useState(null);
  useEffect(()=>{if(!live||!match.id)return;let ok=true;(async()=>{try{const d=await fetch2(`https://streamed.pk/api/matches/${match.id}`);if(ok&&d?.score)setScores(d.score);}catch{}})();const t=setInterval(async()=>{try{const d=await fetch2(`https://streamed.pk/api/matches/${match.id}`);if(ok&&d?.score)setScores(d.score);}catch{}},30000);return()=>{ok=false;clearInterval(t);};},[live,match.id]);
  const sc=scores||match.score;
  return(
    <div onClick={()=>onPlay(match)} className="relative bg-white/[0.04] hover:bg-white/[0.07] rounded-2xl p-4 cursor-pointer transition-all border border-white/[0.06] hover:border-white/14 outline-none" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onPlay(match);}}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/35">{fmtSport(match.category)}</span>
        {live?<div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-500/12 border border-red-500/20 px-2 py-0.5 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-red-500 lp"/>LIVE</div>:<span className="text-[11px] text-white/35 font-medium">{fmtT(match.date)}</span>}
      </div>
      {match.teams?.home&&match.teams?.away?(
        <div className="space-y-2.5">
          {[match.teams.away,match.teams.home].map((t,i)=>(
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0 overflow-hidden border border-white/5">
                  {t.badge?<img src={`https://streamed.pk/api/images/badge/${t.badge}.webp`} className="w-5 h-5 object-contain" alt="" onError={e=>{e.target.style.display='none';}}/>:<span className="text-[10px] font-black text-white/40">{t.name?.[0]||'?'}</span>}
                </div>
                <span className="text-white/85 font-semibold text-sm truncate">{t.name}</span>
              </div>
              <span className="text-white font-bold text-lg tabular-nums shrink-0">{sc?rSc(i===0?sc.away:sc.home):live?'0':'—'}</span>
            </div>
          ))}
        </div>
      ):<h3 className="text-white/80 font-semibold text-sm line-clamp-2">{String(match.title||match.name)}</h3>}
      {loading&&<div className="absolute inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10"><Spin/></div>}
    </div>
  );
};

const SportsView=React.memo(({onPlay})=>{
  const[all,setAll]=useState([]),[load,setLoad]=useState(true),[cat,setCat]=useState('All'),[lId,setLId]=useState(null);
  const isLive=useCallback(d=>{const n=Date.now(),m=new Date(d).getTime();return n>=m&&n<=m+10800000;},[]);
  const fmtT=d=>{const dt=new Date(d),t=new Date(),tm=new Date();tm.setDate(tm.getDate()+1);const ts=dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(dt.toDateString()===t.toDateString())return`Today ${ts}`;if(dt.toDateString()===tm.toDateString())return`Tomorrow ${ts}`;return`${dt.toLocaleDateString([],{month:'short',day:'numeric'})} ${ts}`;};
  useEffect(()=>{let ok=true;(async()=>{try{const d=await fetch2('https://streamed.pk/api/matches/all');let md=[];if(Array.isArray(d))md=d;else if(typeof d==='object')Object.values(d).forEach(v=>{if(Array.isArray(v))md.push(...v);});const um=new Map();md.forEach(m=>{const k=m.teams?.home&&m.teams?.away?[m.teams.home.name,m.teams.away.name].sort().join('|'):(m.title||m.id||'').trim();if(!k)return;const ex=um.get(k);if(!ex||(m.teams?.home?.badge&&!ex.teams?.home?.badge))um.set(k,m);});if(ok)setAll(Array.from(um.values()));}catch{}if(ok)setLoad(false);})();return()=>{ok=false;};},[]);
  const sports=useMemo(()=>{const s=new Set(all.map(m=>fmtSport(m.category)).filter(Boolean));const p=['NBA','NFL','MLB','NHL','Soccer','Tennis'];return['All',...Array.from(s).sort((a,b)=>{const ia=p.indexOf(a),ib=p.indexOf(b);if(ia>-1&&ib>-1)return ia-ib;if(ia>-1)return-1;if(ib>-1)return 1;return a.localeCompare(b);})]},[all]);
  const sorted=useMemo(()=>(cat==='All'?all:all.filter(m=>fmtSport(m.category)===cat)).sort((a,b)=>{const al=isLive(a.date),bl=isLive(b.date);return al!==bl?al?-1:1:new Date(a.date)-new Date(b.date);}),[all,cat,isLive]);
  const handlePlay=async m=>{setLId(m.id);await onPlay(m);setLId(null);};
  return(
    <div className="pt-24 md:pt-28 px-5 md:px-10 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto pb-28 au">
      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 fade-r">
        {sports.map(s=><button key={s} onClick={()=>setCat(s)} className={cn('px-4 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap border transition-all outline-none',cat===s?'bg-white text-black border-white':'glass border-white/10 text-white/50 hover:text-white hover:border-white/20')}>{s}</button>)}
      </div>
      {/* Live banner */}
      {sorted.some(m=>isLive(m.date))&&<div className="flex items-center gap-2 mb-4 text-sm font-semibold text-red-400"><div className="w-2 h-2 rounded-full bg-red-500 lp"/>{sorted.filter(m=>isLive(m.date)).length} live {sorted.filter(m=>isLive(m.date)).length===1?'match':'matches'} right now</div>}
      {load?(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{[...Array(8)].map((_,i)=><div key={i} className="h-36 sk rounded-2xl"/>)}</div>
      ):sorted.length>0?(
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{sorted.map(m=><SportCard key={m.id} match={m} live={isLive(m.date)} fmtT={fmtT} onPlay={handlePlay} loading={lId===m.id}/>)}</div>
      ):(
        <div className="py-24 flex flex-col items-center text-white/25"><Dribbble className="w-12 h-12 mb-4 opacity-25"/><p className="font-medium">No matches right now</p></div>
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
    <div className="absolute bottom-16 right-5 z-50" style={{animation:'fadeUp .3s cubic-bezier(.16,1,.3,1) both'}}>
      <button onClick={skip} className="flex items-center gap-2 glass2 border border-white/22 hover:bg-white hover:text-black text-white px-6 py-3 rounded-full font-semibold text-[13px] transition-all shadow-2xl outline-none group">
        {labels[seg.type]||'Skip'}<SkipForward className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"/>
      </button>
    </div>
  );
});

// ─── PLAYER ──────────────────────────────────────────────────────────────────
const Player=({media,config,onClose,sourceKey,vpSettings,skipSettings})=>{
  const[loading,setLoading]=useState(true),[err,setErr]=useState(false),[showCtrl,setShowCtrl]=useState(true);
  const[src,setSrc]=useState(''),[srcKey,setSrcKey]=useState(sourceKey||'vidplus'),[ifrKey,setIfrKey]=useState(0);
  const[elapsed,setElapsed]=useState(0),[skipTime,setSkipTime]=useState(0);
  const[autoTried,setAutoTried]=useState(false);
  const vRef=useRef(null),ctrlT=useRef(null),elT=useRef(null),elO=useRef(null),loadT=useRef(null),m=useRef(true);

  const isLive=media.isLive;
  const isTv=!isLive&&(media.media_type==='tv'||(!media.release_date&&media.name));
  const cfg=config||{season:1,episode:1};
  const srcKeys=Object.keys(SOURCES);
  const curIdx=srcKeys.indexOf(srcKey);

  useEffect(()=>{m.current=true;lock();return()=>{m.current=false;unlock();};},[]);
  useEffect(()=>{const h=e=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[onClose]);

  const buildSrc=useCallback((sk,st=0)=>{
    if(isLive)return media.url||'';
    const id=media.id;if(!id)return'';
    const{season:s=1,episode:e=1}=cfg;
    const t=isTv?'tv':'movie';
    const fn=SOURCES[sk]?.url;
    if(!fn)return'';
    let url=fn(t,id,s,e);
    if(st>0&&sk==='vidplus')url+=`&progress=${Math.floor(st)}`;
    return url;
  },[isLive,isTv,media,cfg]);

  useEffect(()=>{
    setLoading(true);setErr(false);setAutoTried(false);
    setSrc(buildSrc(srcKey,0));setSkipTime(0);setElapsed(0);
    clearInterval(elT.current);clearTimeout(loadT.current);
    // 20s timeout — auto-try next source once
    loadT.current=setTimeout(()=>{
      if(m.current&&!isLive){
        setAutoTried(t=>{if(!t){const ni=(curIdx+1)%srcKeys.length;setSrcKey(srcKeys[ni]);return true;}return t;});
        setLoading(false);
      }
    },20000);
  },[srcKey,buildSrc,isLive,curIdx,srcKeys]);

  const startElapsed=useCallback((from=0)=>{clearInterval(elT.current);elO.current=Date.now()-from*1000;elT.current=setInterval(()=>{if(m.current)setElapsed(Math.floor((Date.now()-elO.current)/1000));},500);},[]);
  useEffect(()=>()=>{clearInterval(elT.current);clearTimeout(loadT.current);},[]);

  const onLoad=useCallback(()=>{if(!m.current)return;clearTimeout(loadT.current);setLoading(false);setErr(false);startElapsed(skipTime);},[skipTime,startElapsed]);
  const onSkipTo=useCallback(endSec=>{if(!m.current)return;setSrc(buildSrc(srcKey,endSec));setSkipTime(endSec);setIfrKey(k=>k+1);setLoading(true);setErr(false);clearTimeout(loadT.current);loadT.current=setTimeout(()=>{if(m.current)setLoading(false);},20000);startElapsed(endSec);setElapsed(endSec);},[srcKey,buildSrc,startElapsed]);

  // HLS for live
  useEffect(()=>{if(!isLive||!src?.includes?.('.m3u8'))return;let hls;loadHls(()=>{setLoading(false);const v=vRef.current;if(!v)return;hls=initHls(v,src,true,{onParsed:()=>v.play().catch(()=>{}),onError:(e,d)=>{if(d.fatal){if(hls&&d.type===window.Hls?.ErrorTypes?.NETWORK_ERROR)hls.startLoad();else if(hls&&d.type===window.Hls?.ErrorTypes?.MEDIA_ERROR)hls.recoverMediaError();else{if(hls)hls.destroy();setErr(true);}}}});});return()=>{if(hls)hls.destroy();};},[isLive,src]);

  const mMove=useCallback(()=>{setShowCtrl(true);clearTimeout(ctrlT.current);ctrlT.current=setTimeout(()=>{if(m.current)setShowCtrl(false);},3500);},[]);
  useEffect(()=>{window.addEventListener('mousemove',mMove);window.addEventListener('touchstart',mMove,{passive:true});mMove();return()=>{window.removeEventListener('mousemove',mMove);window.removeEventListener('touchstart',mMove);clearTimeout(ctrlT.current);};},[mMove]);

  return(
    <div className="fixed inset-0 z-[90] bg-black flex flex-col" style={{animation:'fadeUp .25s ease both'}}>
      {/* Loading overlay */}
      {loading&&!isLive&&(
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 pointer-events-none">
          <Spin sz={10}/><p className="text-white/30 text-sm mt-4">{SOURCES[srcKey]?.name||'Loading'}…</p>
          <p className="text-white/18 text-xs mt-1">If this takes too long, try another source above</p>
        </div>
      )}
      {/* Top bar */}
      <div className={cn('absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 md:p-5 bg-gradient-to-b from-black/85 to-transparent transition-opacity duration-300',showCtrl?'opacity-100 pointer-events-auto':'opacity-0 pointer-events-none')}>
        <button onClick={onClose} className="flex items-center gap-2 glass2 border border-white/14 text-white hover:bg-white hover:text-black px-5 py-2.5 rounded-full font-semibold text-sm transition-all outline-none group shadow-xl">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"/>Back
        </button>
        {/* Source switcher */}
        {!isLive&&(
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {srcKeys.map(k=>(
              <button key={k} onClick={()=>setSrcKey(k)}
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all outline-none border',srcKey===k?'bg-white text-black border-white shadow':'glass2 text-white/50 border-white/12 hover:text-white hover:border-white/30')}>
                {SOURCES[k].name}
              </button>
            ))}
          </div>
        )}
        {isLive&&<div className="flex items-center gap-2 glass2 border border-white/12 px-4 py-2 rounded-full"><div className="w-2 h-2 rounded-full bg-red-500 lp"/><span className="text-white text-xs font-semibold">{String(media.name||'Live')}</span></div>}
      </div>
      {/* Player */}
      <div className="flex-1 relative bg-black">
        {isLive&&media.type==='iframe'&&<iframe src={src} className="w-full h-full border-0" allowFullScreen allow="autoplay;encrypted-media;fullscreen" onLoad={()=>{if(m.current)setLoading(false);}}/>}
        {isLive&&src?.includes?.('.m3u8')&&<video ref={vRef} controls autoPlay playsInline className="w-full h-full outline-none"/>}
        {!isLive&&(
          <iframe key={ifrKey} src={src} className="w-full h-full border-0"
            allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen;payment"
            allowFullScreen referrerPolicy="origin"
            onLoad={onLoad} onError={()=>{if(m.current){setErr(true);setLoading(false);}}}
            title="Media Player"/>
        )}
        {/* Error overlay */}
        {err&&!isLive&&(
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
            <AlertCircle className="w-10 h-10 text-white/20 mb-4"/>
            <p className="text-white/60 font-semibold mb-1">Stream unavailable</p>
            <p className="text-white/30 text-sm mb-6">Try a different source</p>
            <div className="flex gap-3">
              <button onClick={()=>setSrcKey(srcKeys[(curIdx+1)%srcKeys.length])} className="px-6 py-3 bg-white text-black rounded-full font-semibold text-sm hover:bg-white/90 outline-none">Next Source</button>
              <button onClick={()=>{setErr(false);setIfrKey(k=>k+1);setLoading(true);loadT.current=setTimeout(()=>{if(m.current)setLoading(false);},20000);}} className="px-6 py-3 glass2 border border-white/12 text-white rounded-full font-semibold text-sm hover:bg-white/10 outline-none">Retry</button>
            </div>
          </div>
        )}
      </div>
      {/* Skip button */}
      {!isLive&&skipSettings?.enabled&&<SkipBtn mediaId={media.id} isTv={isTv} season={cfg.season} episode={cfg.episode} elapsed={elapsed} onSkip={onSkipTo} settings={skipSettings}/>}
    </div>
  );
};

// ─── PERSON MODAL ────────────────────────────────────────────────────────────
const PersonModal=({id,apiKey,onClose,onCard})=>{
  const[det,setDet]=useState(null),[cred,setCred]=useState([]);
  useEffect(()=>{lock();return()=>unlock();},[]);
  useEffect(()=>{if(!id||!apiKey)return;let ok=true;(async()=>{try{const[d,c]=await Promise.all([fetch2(`${BASE}/person/${id}?api_key=${apiKey}`),fetch2(`${BASE}/person/${id}/combined_credits?api_key=${apiKey}`)]);if(!ok)return;setDet(d);setCred(Array.from(new Map((c.cast?.filter(x=>x.poster_path).sort((a,b)=>(b.popularity||0)-(a.popularity||0))||[]).map(i=>[i.id,i])).values()).slice(0,16));}catch{}})();return()=>{ok=false;};},[id,apiKey]);
  if(!det)return<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-2xl"><Spin sz={8}/></div>;
  return(
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-10 au">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={onClose}/>
      <div className="relative bg-[#0c0c0c] border border-white/8 w-full md:max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] as">
        <button onClick={onClose} className="absolute top-4 right-4 p-2.5 glass2 rounded-full text-white z-10 hover:bg-white hover:text-black transition-all outline-none shadow-xl"><X className="w-4 h-4"/></button>
        <div className="p-6 pt-14 md:p-10 flex flex-col md:flex-row gap-7 overflow-y-auto">
          <div className="md:w-48 shrink-0 flex flex-col items-center md:items-start">
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-2xl overflow-hidden border border-white/10 shadow-xl mb-4 bg-white/5">
              {det.profile_path?<img src={`${IMG}w500${det.profile_path}`} className="w-full h-full object-cover" alt="" decoding="async"/>:<div className="w-full h-full flex items-center justify-center"><User className="w-10 h-10 text-white/20"/></div>}
            </div>
            <h2 className="text-xl font-bold text-white text-center md:text-left tracking-tight">{det.name}</h2>
            {det.known_for_department&&<p className="text-white/40 text-sm mt-1">{det.known_for_department}</p>}
            {det.birthday&&<p className="text-white/25 text-xs mt-1">b. {fmtDate(det.birthday)}</p>}
          </div>
          <div className="flex-1 space-y-7">
            {det.biography&&<div><h3 className="text-white font-bold mb-2">Biography</h3><p className="text-white/50 text-sm leading-relaxed line-clamp-5 hover:line-clamp-none cursor-pointer transition-all">{det.biography}</p></div>}
            <div><h3 className="text-white font-bold mb-4">Known For</h3><div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-3 gap-y-5">{cred.map(m=><PosterCard key={m.id} media={m} onClick={x=>{onCard(x);onClose();}}/>)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DETAIL MODAL (inspired by Image 2 layout) ───────────────────────────────
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
        const d=await fetch2(`${BASE}/${t}/${media.id}?api_key=${apiKey}&append_to_response=credits,similar,videos,external_ids`);
        if(!ok)return;setDet(d);
        const vt=d.videos?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube'&&v.official)||d.videos?.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube');
        if(vt)setTrailer(vt.key);
        const imdb=d.imdb_id||d.external_ids?.imdb_id;
        if(omdbKey&&imdb){const o=await fetch2(`https://www.omdbapi.com/?i=${imdb}&apikey=${omdbKey}`);if(ok&&o&&!o.Error)setOmdb(o);}
        setSimilar(Array.from(new Map((d.similar?.results?.filter(i=>i.poster_path)||[]).map(i=>[i.id,i])).values()).slice(0,12));
      }catch{}
      if(ok)setLoading(false);
    })();return()=>{ok=false;};
  },[isOpen,media,apiKey,omdbKey]);

  useEffect(()=>{
    const isTvM=det&&(media?.media_type==='tv'||(!media?.release_date&&media?.name));
    if(!isTvM||media?.isLive||!apiKey||!det||tab!=='episodes')return;
    let ok=true;setEpsLoad(true);
    (async()=>{try{const d=await fetch2(`${BASE}/tv/${media.id}/season/${season}?api_key=${apiKey}`);if(ok)setEps(d.episodes||[]);}catch{if(ok)setEps([]);}finally{if(ok)setEpsLoad(false);}}
    )();return()=>{ok=false;};
  },[season,media,apiKey,det,tab]);

  if(!isOpen||!media||media.isLive)return null;
  const isTv=det?(det.number_of_seasons>0):media.media_type==='tv';
  const bg=`${IMG}original${media.backdrop_path||media.poster_path}`;
  const cast=Array.from(new Map(det?.credits?.cast?.map(p=>[p.id,p])||[]).values()).slice(0,10);
  const hasImdb=omdb?.imdbRating&&omdb.imdbRating!=='N/A';
  const rt=omdb?.Ratings?.find(r=>r.Source==='Rotten Tomatoes');
  const genres=(det?.genres||[]).map(g=>g.name);
  const runtime=det?.runtime?`${Math.floor(det.runtime/60)}h ${det.runtime%60}m`:det?.number_of_seasons?`${det.number_of_seasons} Season${det.number_of_seasons>1?'s':''}`:null;

  return(
    <div className="fixed inset-0 z-[70] bg-black overflow-hidden" style={{animation:'fadeUp .3s ease both'}}>
      {/* Close */}
      <button onClick={onClose} className="fixed top-4 right-4 md:top-6 md:right-6 p-3 glass2 hover:bg-white hover:text-black border border-white/10 rounded-full text-white z-[170] shadow-xl outline-none transition-all"><X className="w-5 h-5"/></button>
      {/* Trailer */}
      {showTr&&trailer&&(
        <div className="fixed inset-0 z-[160] bg-black/96 backdrop-blur-2xl flex items-center justify-center" style={{animation:'scaleIn .3s ease both'}}>
          <button onClick={()=>setShowTr(false)} className="absolute top-5 right-5 p-3.5 glass2 rounded-full text-white hover:bg-white hover:text-black outline-none z-10 transition-all"><X className="w-5 h-5"/></button>
          <div className="w-full max-w-5xl px-4">
            <div style={{position:'relative',paddingTop:'56.25%',borderRadius:'1rem',overflow:'hidden'}}>
              <iframe style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}} src={`https://tube.rvere.com/embed?v=${trailer}&autoplay=1&rel=0`} title="Trailer" allowFullScreen allow="autoplay;fullscreen"/>
            </div>
          </div>
        </div>
      )}
      {/* Backdrop */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover object-top opacity-55 scale-[1.01]" decoding="async"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/25"/>
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent hidden md:block"/>
      </div>
      {/* Scroll container */}
      <div className="relative z-10 w-full h-full overflow-y-auto">
        {/* Hero section — styled like Image 2 */}
        <div className="min-h-[70vh] flex flex-col justify-end px-5 md:px-12 lg:px-14 pt-20 pb-8 max-w-[1800px] mx-auto w-full">
          <div className="max-w-3xl">
            {loading&&!det&&<div className="py-10 flex items-center gap-3 text-white/30"><Spin sz={5}/><span className="text-sm">Loading…</span></div>}
            {det&&(<>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {isTv&&<span className="text-[10px] font-black uppercase tracking-widest border border-white/12 px-2.5 py-[3px] rounded text-white/55">Series</span>}
                {det.status&&<span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">{det.status}</span>}
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05] text-white mb-3 drop-shadow-xl">{media.title||media.name}</h1>
              {det.tagline&&<p className="text-white/40 text-base md:text-lg italic mb-4 font-medium">{det.tagline}</p>}
              {/* Metadata row — like Image 2 */}
              <div className="flex items-center gap-2.5 flex-wrap text-[13px] mb-5">
                {hasImdb&&<span className="font-bold text-yellow-400 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current"/>{omdb.imdbRating}</span>}
                {!hasImdb&&media.vote_average>0&&<span className="text-yellow-400/80 font-bold flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current"/>{media.vote_average.toFixed(1)}</span>}
                {rt&&<><span className="text-white/20">·</span><span className="text-white/55">{rt.Value}</span></>}
                {(det.release_date||det.first_air_date)&&<><span className="text-white/20">·</span><span className="text-white/55">{fmtYear(det.release_date||det.first_air_date)}</span></>}
                {runtime&&<><span className="text-white/20">·</span><span className="text-white/55">{runtime}</span></>}
                {genres.slice(0,3).map(g=><><span className="text-white/20">·</span><span key={g} className="text-white/55">{g}</span></>)}
              </div>
              <p className="text-white/60 text-[14px] md:text-[15px] leading-relaxed max-w-2xl mb-7">{media.overview}</p>
              {/* Action buttons — like Image 2 */}
              <div className="flex flex-wrap gap-3">
                <button onClick={()=>onPlay(media,isTv?{season,episode:1}:null)} className="flex items-center gap-2.5 bg-white text-black px-8 py-3.5 rounded-full font-bold text-[14px] hover:bg-white/92 hover:scale-[1.02] transition-all outline-none shadow-xl"><Play className="w-5 h-5 fill-black"/>Play</button>
                {trailer&&<button onClick={()=>setShowTr(true)} className="flex items-center gap-2 glass2 border border-white/12 hover:bg-white/12 text-white px-6 py-3.5 rounded-full font-semibold text-[14px] transition-all outline-none hover:scale-[1.02]"><Film className="w-4 h-4"/>Trailer</button>}
                <button onClick={()=>toggleWL(media)} className={cn('flex items-center gap-2 glass2 border text-white px-6 py-3.5 rounded-full font-semibold text-[14px] transition-all outline-none hover:scale-[1.02]',inWL?'bg-white/14 border-white/25':'border-white/12 hover:bg-white/12')}>
                  <Bookmark className="w-4 h-4" fill={inWL?'currentColor':'none'}/>{inWL?'Saved':'Save'}
                </button>
              </div>
            </>)}
          </div>
        </div>

        {/* Content tabs */}
        <div className="px-5 md:px-12 lg:px-14 pb-28 max-w-[1800px] mx-auto w-full">
          {det&&(<>
            <div className="flex items-center gap-7 border-b border-white/8 mb-7 overflow-x-auto fade-r">
              {['overview',isTv?'episodes':null,'similar'].filter(Boolean).map(t=>(
                <button key={t} onClick={()=>setTab(t)} className={cn('text-[15px] font-bold capitalize pb-3 shrink-0 relative outline-none transition-colors',tab===t?'text-white':'text-white/35 hover:text-white/65')}>
                  {t}{tab===t&&<div className="absolute bottom-0 left-0 w-full h-[2px] rounded-full" style={{background:ACCENT}}/>}
                </button>
              ))}
            </div>
            {/* Overview tab */}
            {tab==='overview'&&(
              <div className="grid md:grid-cols-[2fr_1fr] gap-10 lg:gap-16 au">
                {/* Actors — like Image 2 */}
                {cast.length>0&&(
                  <div>
                    <h3 className="text-white font-bold text-[17px] mb-4">Actors</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {cast.map(p=>(
                        <button key={p.id} onClick={()=>onPerson(p.id)}
                          className="flex items-center gap-3 glass2 border border-white/8 hover:border-white/18 px-3 py-3 rounded-2xl transition-all text-left outline-none group">
                          {p.profile_path?<img src={`${IMG}w200${p.profile_path}`} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" decoding="async"/>:<div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-white/25"/></div>}
                          <div className="min-w-0">
                            <p className="text-white font-semibold text-[13px] group-hover:text-white/90 truncate">{p.name}</p>
                            <p className="text-white/35 text-xs truncate mt-0.5">{p.character?.split('/')[0]}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Details sidebar */}
                <div className="glass border border-white/8 rounded-2xl p-5 h-fit">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">Details</p>
                  <div className="space-y-3 text-[13px]">
                    {[['Status',det.status],['Language',(det.original_language||'').toUpperCase()],['Budget',det.budget?`$${(det.budget/1e6).toFixed(1)}M`:null],['Revenue',det.revenue?`$${(det.revenue/1e6).toFixed(1)}M`:null],['Seasons',det.number_of_seasons?String(det.number_of_seasons):null],['Episodes',det.number_of_episodes?String(det.number_of_episodes):null]].filter(([,v])=>v).map(([l,v])=>(
                      <div key={l} className="flex justify-between border-b border-white/5 pb-2.5 last:border-0 last:pb-0"><span className="text-white/35">{l}</span><span className="text-white/75 font-medium">{v}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Episodes tab */}
            {tab==='episodes'&&isTv&&(
              <div className="au space-y-5">
                <div className="flex gap-2 overflow-x-auto pb-2 fade-r">
                  {det.seasons?.filter(s=>s.season_number>0&&s.episode_count>0).map(s=>(
                    <button key={s.id} onClick={()=>{setSeason(s.season_number);localStorage.setItem(`ses_${media.id}`,JSON.stringify(s.season_number));}}
                      className={cn('px-5 py-2.5 rounded-full text-[12px] font-semibold border shrink-0 transition-all outline-none',season===s.season_number?'bg-white text-black border-white':'glass border-white/10 text-white/50 hover:text-white hover:border-white/20')}>
                      Season {s.season_number}
                    </button>
                  ))}
                </div>
                {epsLoad?<div className="py-12 text-center text-white/30 text-sm">Loading episodes…</div>:(
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {eps.map(ep=>{
                      const di=ep.air_date?new Date(ep.air_date):null;const future=di&&di>new Date();
                      const rev=spoilers[ep.id];
                      const bg2=ep.still_path?`${IMG}w500${ep.still_path}`:null;
                      return(
                        <div key={ep.id} className="group glass border border-white/8 hover:border-white/16 rounded-2xl overflow-hidden transition-all">
                          <div className="relative aspect-video bg-white/5 overflow-hidden">
                            {bg2?<img src={bg2} className="w-full h-full object-cover opacity-75 group-hover:opacity-95 transition-opacity" alt=""/>:<div className="w-full h-full flex items-center justify-center"><Film className="w-6 h-6 text-white/15"/></div>}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/35 transition-opacity">
                              {!future&&<button onClick={()=>onPlay(media,{season,episode:ep.episode_number})} className="bg-white text-black p-3.5 rounded-full hover:scale-110 transition-transform shadow-2xl outline-none"><Play className="w-4 h-4 fill-current"/></button>}
                            </div>
                            {isTouchDev()&&!future&&<button onClick={()=>onPlay(media,{season,episode:ep.episode_number})} className="absolute bottom-2 right-2 glass2 text-white p-2.5 rounded-full z-10 outline-none"><Play className="w-3.5 h-3.5 fill-current"/></button>}
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold flex items-center gap-1" style={{color:ACCENT}}>
                                EP {ep.episode_number}
                                {!future&&di&&(new Date()-di)/86400000<=14&&<span className="text-[9px] font-black uppercase text-white px-1.5 py-0.5 rounded ml-1" style={{background:ACCENT}}>New</span>}
                                {future&&<span className="text-white/30 text-[9px] ml-1">Upcoming</span>}
                              </span>
                              {ep.runtime&&<span className="text-white/30 text-[11px] font-mono">{ep.runtime}m</span>}
                            </div>
                            <h4 className="text-white font-semibold text-[13px] mb-1 line-clamp-1">{String(ep.name||`Episode ${ep.episode_number}`)}</h4>
                            {di&&<p className="text-white/30 text-[11px] mb-2">{fmtDate(ep.air_date)}</p>}
                            {ep.overview&&<p className={cn('text-[11px] text-white/40 leading-relaxed line-clamp-3',!rev&&'spoil')} onClick={()=>setSpoilers(p=>({...p,[ep.id]:true}))}>{ep.overview}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* Similar tab */}
            {tab==='similar'&&(
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-7 au">
                {similar.map(i=><PosterCard key={i.id} media={i} onClick={x=>{setTab('overview');onCard?.(x);}}/>)}
                {!similar.length&&!loading&&<p className="col-span-full text-center text-white/25 py-12">No similar titles found</p>}
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

  const Toggle=({v,on})=><button onClick={on} className={cn('w-11 h-6 rounded-full transition-colors relative shrink-0 outline-none',v?'':'bg-white/14')} style={v?{background:ACCENT}:{}}><div className={cn('w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow',v?'translate-x-5':'translate-x-0.5')}/></button>;
  const Row=({l,s,children})=><div className="flex items-center justify-between py-[18px] border-b border-white/[0.06] last:border-0 gap-4"><div><p className="text-white/85 font-semibold text-[14px]">{l}</p>{s&&<p className="text-white/35 text-[11px] mt-0.5">{s}</p>}</div><div className="shrink-0">{children}</div></div>;

  const sections=[{id:'playback',l:'Playback',I:Play},{id:'display',l:'Display',I:Monitor},{id:'discover',l:'Discover',I:TrendingUp},{id:'api',l:'API Keys',I:Server},{id:'account',l:'Account',I:User}];

  return(
    <div className="pt-24 md:pt-28 px-5 md:px-10 lg:px-14 pb-28 max-w-5xl mx-auto min-h-screen bg-black au">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{background:`${ACCENT}22`}}><Settings className="w-5 h-5" style={{color:ACCENT}}/></div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
      </div>
      <div className="flex flex-col md:flex-row gap-5 md:gap-7">
        {/* Sidebar */}
        <div className="md:w-48 shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {sections.map(({id,l,I})=>(
              <button key={id} onClick={()=>setSec(id)} className={cn('flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap outline-none shrink-0 md:w-full text-left border',sec===id?'bg-white/10 text-white border-white/12':'text-white/38 border-transparent hover:bg-white/5 hover:text-white/65')}>
                <I className="w-3.5 h-3.5 shrink-0"/>{l}
              </button>
            ))}
          </div>
        </div>
        {/* Panel */}
        <div className="flex-1 glass border border-white/8 rounded-2xl overflow-hidden" key={sec}>
          {sec==='playback'&&(<>
            <div className="p-5 pb-3">
              <p className="text-[10px] font-black text-white/28 uppercase tracking-widest mb-4">Default Streaming Source</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(SOURCES).map(([k,v])=>(
                  <button key={k} onClick={()=>set('sourceKey',k)} className={cn('px-4 py-2.5 rounded-xl border text-left text-sm font-semibold transition-all outline-none',settings.sourceKey===k?'bg-white/10 border-white/22 text-white':'border-white/8 text-white/40 hover:border-white/18 hover:text-white/70')}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 divide-y divide-white/[0.06]">
              <Row l="Icon Style" s="VidPlus player button icons"><div className="flex gap-1.5 flex-wrap justify-end">{['lucide','netflix','vidstack','vid','tabler'].map(ic=><button key={ic} onClick={()=>setN('vp','icons',ic)} className={cn('px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all outline-none capitalize',vp.icons===ic?'bg-white text-black border-white':'glass border-white/10 text-white/40 hover:text-white')}>{ic}</button>)}</div></Row>
              <Row l="Auto-next episode"><Toggle v={vp.autoNext!==false} on={()=>setN('vp','autoNext',!(vp.autoNext!==false))}/></Row>
              <Row l="Episode list in player"><Toggle v={vp.episodeList!==false} on={()=>setN('vp','episodeList',!(vp.episodeList!==false))}/></Row>
            </div>
            <div className="px-5 pb-4">
              <div className="flex items-center justify-between pt-4 mb-3">
                <div><p className="text-white/85 font-semibold text-[14px]">Skip Timestamps</p><p className="text-white/30 text-[11px]">Powered by TheIntroDB</p></div>
                <Toggle v={sk.enabled} on={()=>set('skip',p=>({...p,enabled:!p.enabled}))}/>
              </div>
              {sk.enabled&&(<div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[['Intro','showIntro'],['Recap','showRecap'],['Credits','showCredits'],['Preview','showPreview']].map(([l,k])=><button key={k} onClick={()=>set('skip',p=>({...p,[k]:!p[k]}))} className={cn('py-2.5 rounded-xl text-[12px] font-semibold border transition-all outline-none',sk[k]?'bg-white text-black border-white':'glass border-white/10 text-white/40 hover:text-white')}>{l}</button>)}</div>
                <Row l="Auto-skip"><Toggle v={sk.autoSkip} on={()=>set('skip',p=>({...p,autoSkip:!p.autoSkip}))}/></Row>
                {!sk.autoSkip&&<Row l={`Button shows for: ${sk.buttonDuration||7}s`}><input type="range" min="3" max="15" value={sk.buttonDuration||7} onChange={e=>set('skip',p=>({...p,buttonDuration:+e.target.value}))} className="w-20 cursor-pointer"/></Row>}
              </div>)}
            </div>
          </>)}

          {sec==='display'&&(
            <div className="p-5">
              <p className="text-[10px] font-black text-white/28 uppercase tracking-widest mb-4">Subtitle Appearance</p>
              {/* Preview */}
              <div className="w-full aspect-[16/6] bg-black/40 rounded-xl overflow-hidden relative mb-5 border border-white/8 flex items-end justify-center pb-4">
                <img src="https://image.tmdb.org/t/p/w500/8Y43POKjjKDGI9MH89NW0NAzzp8.jpg" className="absolute inset-0 w-full h-full object-cover opacity-35" alt=""/>
                <div className="relative z-10 text-center">
                  {['This is subtitle line one.','Second subtitle line here.'].map((l,i)=><div key={i} className="inline-block px-3 py-1 rounded-lg mb-1 block" style={{fontFamily:cc.font,fontSize:cc.size,color:cc.color,backgroundColor:cc.bg,textShadow:getTs(cc.edge),fontWeight:600,lineHeight:1.5}}>{l}</div>)}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  [cc.font,v=>setN('cc','font',v),[['system-ui,sans-serif','System'],['Georgia,serif','Serif'],['monospace','Mono'],["'Comic Sans MS',sans-serif",'Casual'],['Impact,fantasy','Display']]],
                  [cc.size,v=>setN('cc','size',v),[['0.85rem','Small'],['1.1rem','Medium'],['1.45rem','Large'],['1.9rem','X-Large']]],
                  [cc.color,v=>setN('cc','color',v),[['#ffffff','White'],['#fcd34d','Yellow'],['#4ade80','Green'],['#22d3ee','Cyan'],['#f87171','Red']]],
                  [cc.bg,v=>setN('cc','bg',v),[['rgba(0,0,0,0.82)','Dark'],['rgba(0,0,0,1)','Black'],['rgba(255,255,255,.12)','Light'],['transparent','None']]],
                  [cc.edge,v=>setN('cc','edge',v),[['dropshadow','Shadow'],['raised','Raised'],['outline','Outline'],['none','None']]],
                ].map(([val,setter,opts],i)=>(
                  <select key={i} value={val} onChange={e=>setter(e.target.value)} className="cs bg-black/30 border border-white/10 text-white/65 rounded-xl px-3.5 py-2.5 outline-none cursor-pointer text-[12px] font-semibold pr-8">
                    {opts.map(([v,l])=><option key={v} value={v} className="bg-[#111]">{l}</option>)}
                  </select>
                ))}
              </div>
            </div>
          )}

          {sec==='discover'&&(
            <div className="p-5">
              <p className="text-[10px] font-black text-white/28 uppercase tracking-widest mb-2">Genre Preferences</p>
              <p className="text-white/30 text-xs mb-5">Tap to cycle: Default → Boosted → Hidden</p>
              <div className="flex flex-wrap gap-2">
                {ALL_GENRES.map(g=>{const b=settings.algoPrefs.boosted.includes(g.id),ex=settings.algoPrefs.excluded.includes(g.id);return(
                  <button key={g.id} onClick={()=>set('algoPrefs',p=>{if(p.boosted.includes(g.id))return{boosted:p.boosted.filter(x=>x!==g.id),excluded:[...p.excluded,g.id]};if(p.excluded.includes(g.id))return{boosted:p.boosted,excluded:p.excluded.filter(x=>x!==g.id)};return{boosted:[...p.boosted,g.id],excluded:p.excluded};})} className={cn('px-4 py-2 rounded-full text-[12px] font-semibold border transition-all outline-none',ex?'bg-red-500/10 text-red-400 border-red-500/20':b?'bg-white text-black border-white':'glass text-white/40 border-white/8 hover:text-white hover:border-white/18')}>
                    {g.name}{b?' ✦':''}
                  </button>
                );})}
              </div>
            </div>
          )}

          {sec==='api'&&(
            <div className="p-5 space-y-5">
              {[{l:'TMDB API Key',s:'Required for all content metadata',k:'apiKey',ph:'Enter API key…',link:'https://www.themoviedb.org/settings/api'},{l:'OMDb API Key',s:'Enables IMDb and Rotten Tomatoes ratings',k:'omdbKey',ph:'e.g. 93a6d7d6',link:'https://www.omdbapi.com/apikey.aspx'},{l:'Gemini API Key',s:'AI-powered search — get a free key below',k:'geminiKey',ph:'AIza…',link:'https://aistudio.google.com/app/apikey',pw:true}].map(({l,s,k,ph,link,pw})=>(
                <div key={k}>
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="text-white/85 font-semibold text-[14px]">{l}</p><p className="text-white/30 text-xs mt-0.5">{s} — <a href={link} target="_blank" rel="noreferrer" className="text-white/50 hover:text-white underline">Get key</a></p></div>
                  </div>
                  <input type={pw?'password':'text'} value={settings[k]||''} onChange={e=>set(k,e.target.value)} placeholder={ph} spellCheck="false"
                    className="w-full bg-black/40 border border-white/8 rounded-xl px-4 py-3 font-mono text-[13px] text-white/75 focus:border-white/20 focus:bg-black/60 outline-none transition-all"/>
                </div>
              ))}
            </div>
          )}

          {sec==='account'&&(
            <div className="p-5">
              <div className="flex items-center gap-4 mb-6 p-4 glass border border-white/8 rounded-2xl">
                {user?.photoURL?<img src={user.photoURL} className="w-12 h-12 rounded-full object-cover border border-white/12" alt=""/>:<div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white border border-white/12" style={{background:ACCENT}}>{(user?.displayName||user?.email||'?')[0].toUpperCase()}</div>}
                <div>
                  <p className="text-white font-semibold">{user?.displayName||'User'}</p>
                  <p className="text-white/40 text-sm">{user?.email}</p>
                </div>
              </div>
              <button onClick={()=>firebaseSignOut(auth)} className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 hover:bg-red-500/15 font-semibold transition-all outline-none">
                <LogOut className="w-4 h-4"/>Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  const[expH,setExpH]=useState({});

  useEffect(()=>{const u=onAuthStateChanged(auth,u=>{setUser(u||null);setMounted(true);});return u;},[]);

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
    saveHistory(p=>[{...media,watchedAt:new Date().toISOString(),config:fc,progress:ex?.progress||0},...p.filter(h=>h.id!==media.id)].slice(0,150));
  },[saveHistory]);

  const handleSport=useCallback(match=>new Promise(async res=>{
    if(!match){res();return;}
    let url='',isIfr=true;
    if(match.sources?.length){
      for(const src of match.sources){
        try{const r=await fetch(`https://streamed.pk/api/stream/${src.source}/${src.id}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)continue;const ss=await r.json();const streams=Array.isArray(ss)?ss:Object.values(ss||{}).flat();const best=streams.find(s=>s.hd)||streams[0];if(best){const su=best.embedUrl||best.streamUrl||best.url||best.stream_url;if(su){url=su;isIfr=!su.includes('.m3u8');break;}}}catch{}
      }
    }
    if(!url&&match.id){url=`https://streamed.pk/watch/${match.id}`;isIfr=true;}
    if(url)setPlayMedia({isLive:true,type:isIfr?'iframe':'m3u8',name:String(match.title||match.name||'Live Sport'),url});
    res();
  }),[]);

  const toggleWL=useCallback(m=>saveWatchlist(p=>p.find(x=>x.id===m.id)?p.filter(x=>x.id!==m.id):[m,...p]),[saveWatchlist]);
  const remHistory=useCallback(id=>saveHistory(p=>p.filter(h=>h.id!==id)),[saveHistory]);

  // Loading / auth guards
  if(!mounted||user===undefined)return<div className="min-h-screen bg-black flex items-center justify-center"><G/><Spin sz={10}/></div>;
  if(!user&&!isGuest)return<LoginScreen onGuest={()=>setIsGuest(true)}/>;
  if(!loaded)return<div className="min-h-screen bg-black flex items-center justify-center"><G/><Spin sz={10} c={ACCENT}/></div>;

  const apiKey=settings.apiKey;
  const cc={...DEFAULT_CC,...(settings.cc||{})};
  const vpS={...DEFAULT_VP,...(settings.vp||{})};
  const skipS={...DEFAULT_SK,...(settings.skip||{})};
  const algoPrefs=settings.algoPrefs||{excluded:[],boosted:[]};

  return(
    <div className="min-h-screen bg-black text-white overflow-x-hidden" style={{fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif',WebkitFontSmoothing:'antialiased'}}>
      <G/>
      <TopNav tab={tab} setTab={setTab} genre={genre} setGenre={setGenre} focus={focus} user={user} isGuest={isGuest}/>
      <main>
        {tab==='home'&&<HomeView apiKey={apiKey} history={history} watchlist={watchlist} algoPrefs={algoPrefs} onPlay={handlePlay} onInfo={setSelMedia}/>}
        {tab==='live'&&<LiveTvView focus={focus} setFocus={setFocus}/>}
        {tab==='sports'&&<SportsView onPlay={handleSport}/>}
        {tab==='movies'&&(
          <div className="pb-28 bg-black min-h-screen">
            {genre==='All'?(<>
              <Hero onPlay={handlePlay} onInfo={setSelMedia} apiKey={apiKey} type="movie"/>
              <div className="relative z-10 -mt-12 md:-mt-20">
                <Row title="Top 10 Movies Today" url="/trending/movie/day" onCard={setSelMedia} apiKey={apiKey} ranking/>
                <Row title="Trending Movies" url="/trending/movie/week" onCard={setSelMedia} apiKey={apiKey} landscape/>
                <Row title="In Theatres Now" url="/movie/now_playing" onCard={setSelMedia} apiKey={apiKey}/>
                <Row title="All-Time Greats" url="/movie/top_rated" onCard={setSelMedia} apiKey={apiKey} landscape/>
                {GENRES.movie.map(g=><Row key={g.id} title={g.name} url={`/discover/movie?with_genres=${g.id}&sort_by=popularity.desc`} onCard={setSelMedia} apiKey={apiKey}/>)}
              </div>
            </>):<GridView apiKey={apiKey} type="movie" genreId={genre} onCard={setSelMedia}/>}
          </div>
        )}
        {tab==='tv'&&(
          <div className="pb-28 bg-black min-h-screen">
            {genre==='All'?(<>
              <Hero onPlay={handlePlay} onInfo={setSelMedia} apiKey={apiKey} type="tv"/>
              <div className="relative z-10 -mt-12 md:-mt-20">
                <Row title="Top 10 Series Today" url="/trending/tv/day" onCard={setSelMedia} apiKey={apiKey} ranking/>
                <Row title="Trending Series" url="/trending/tv/week" onCard={setSelMedia} apiKey={apiKey} landscape/>
                <Row title="On Air Now" url="/tv/on_the_air" onCard={setSelMedia} apiKey={apiKey}/>
                <Row title="Critically Acclaimed" url="/tv/top_rated" onCard={setSelMedia} apiKey={apiKey} landscape/>
                {GENRES.tv.map(g=><Row key={g.id} title={g.name} url={`/discover/tv?with_genres=${g.id}&sort_by=popularity.desc`} onCard={setSelMedia} apiKey={apiKey}/>)}
              </div>
            </>):<GridView apiKey={apiKey} type="tv" genreId={genre} onCard={setSelMedia}/>}
          </div>
        )}
        {tab==='search'&&<SearchView apiKey={apiKey} geminiKey={settings.geminiKey} history={history} onCard={setSelMedia}/>}
        {tab==='watchlist'&&(
          <div className="px-5 md:px-10 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto pt-24 md:pt-28 au">
            <div className="flex items-center gap-3 mb-8"><div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{background:`${ACCENT}22`}}><Bookmark className="w-5 h-5" style={{color:ACCENT}}/></div><h2 className="text-3xl font-bold tracking-tight text-white">Library</h2></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-7 pb-28">
              {watchlist.map(i=><PosterCard key={i.id} media={i} onClick={setSelMedia}/>)}
            </div>
            {!watchlist.length&&<div className="flex flex-col items-center py-28 text-white/20"><Bookmark className="w-14 h-14 mb-4 opacity-20"/><p className="font-medium">Your library is empty</p><p className="text-sm mt-1 opacity-70">Save movies and series to watch later</p></div>}
          </div>
        )}
        {tab==='history'&&(
          <div className="px-5 md:px-10 lg:px-14 min-h-screen bg-black max-w-[1800px] mx-auto pt-24 md:pt-28 au">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{background:`${ACCENT}22`}}><Clock className="w-5 h-5" style={{color:ACCENT}}/></div><h2 className="text-3xl font-bold tracking-tight text-white">History</h2></div>
              {history.length>0&&<button onClick={()=>saveHistory([])} className="text-[13px] text-red-400/65 hover:text-red-400 flex items-center gap-1.5 px-4 py-2.5 rounded-xl hover:bg-red-500/8 font-semibold outline-none transition-all"><Trash2 className="w-4 h-4"/>Clear all</button>}
            </div>
            <div className="flex flex-col gap-2.5 pb-28">
              {history.map(item=>(
                <div key={item.id} className="glass border border-white/8 hover:border-white/14 rounded-2xl overflow-hidden transition-all group">
                  <div className="flex gap-4 p-4 items-center">
                    <div className="w-14 md:w-20 aspect-[2/3] rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                      {item.poster_path?<img src={`${IMG}w200${item.poster_path}`} className="w-full h-full object-cover" alt="" onError={e=>{e.target.style.display='none';}}/>:<div className="w-full h-full flex items-center justify-center"><Film className="w-5 h-5 text-white/15"/></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white/88 truncate mb-1">{item.title||item.name}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-white/35 uppercase tracking-wide border border-white/10 px-2 py-0.5 rounded">{item.media_type==='tv'||item.name?'Series':'Movie'}</span>
                        {item.config&&<span className="text-[10px] font-bold text-black bg-white/75 px-2 py-0.5 rounded">S{item.config.season}E{item.config.episode}</span>}
                        <span className="text-white/28 text-xs">{fmtDT(item.watchedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={()=>handlePlay(item,item.config)} className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 shadow-lg outline-none"><Play className="w-3.5 h-3.5 fill-current"/></button>
                      <button onClick={()=>remHistory(item.id)} className="p-2 text-white/25 hover:text-white/60 hover:bg-white/8 rounded-full outline-none transition-all"><X className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                </div>
              ))}
              {!history.length&&<div className="flex flex-col items-center py-28 text-white/20"><Clock className="w-14 h-14 mb-4 opacity-20"/><p className="font-medium">No watch history yet</p></div>}
            </div>
          </div>
        )}
        {tab==='settings'&&<SettingsView settings={settings} save={saveSettings} user={user}/>}
      </main>

      {/* Modals */}
      <DetailModal
        isOpen={!!selMedia} media={selMedia} onClose={()=>setSelMedia(null)}
        onPlay={handlePlay} toggleWL={toggleWL}
        inWL={selMedia?wlRef.current.some(m=>m.id===selMedia.id):false}
        apiKey={apiKey} omdbKey={settings.omdbKey}
        onPerson={setSelPerson} onCard={setSelMedia}
      />
      {selPerson&&<PersonModal id={selPerson} apiKey={apiKey} onClose={()=>setSelPerson(null)} onCard={m=>{setSelPerson(null);setSelMedia(m);}}/>}
      {playMedia&&<Player media={playMedia} config={playCfg} onClose={()=>setPlayMedia(null)} sourceKey={settings.sourceKey} vpSettings={vpS} skipSettings={skipS}/>}
    </div>
  );
}
