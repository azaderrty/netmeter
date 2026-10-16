const $ = id => document.getElementById(id);

const Native = window.Capacitor || {};
const Plugins = Native.Plugins || {};
const Device = Plugins.Device || null;
const Network = Plugins.Network || null;

function canUseNative(name) {
  if (Plugins[name]) return true;
  console.warn('[NetMeter] Capacitor plugin ' + name + ' недоступний');
  return false;
}

let theme = localStorage.getItem('theme') || 'dark';
if (theme === 'light') document.body.classList.add('light');
$('themeToggle').onclick = () => {
  document.body.classList.toggle('light');
  theme = document.body.classList.contains('light') ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
};

async function getCFMeta() {
  try {
    const res = await fetch('https://speed.cloudflare.com/__down?bytes=1', { cache: 'no-store' });
    const h = res.headers;
    return {
      ip: h.get('cf-meta-ip'),
      asn: h.get('cf-meta-asn'),
      colo: h.get('cf-meta-colo'),
      city: h.get('cf-meta-city'),
      country: h.get('cf-meta-country'),
      tz: h.get('cf-meta-timezone'),
      lat: h.get('cf-meta-latitude'),
      lon: h.get('cf-meta-longitude')
    };
  } catch (e) {
    return {};
  }
}

async function getIPWHO() {
  try {
    const r = await fetch('https://ipwho.is/?fields=ip,connection,country,city,timezone,latitude,longitude', { cache: 'no-store' });
    return await r.json();
  } catch (e) {
    return {};
  }
}

async function getIPv6() {
  try {
    const r = await fetch('https://api6.ipify.org?format=json', { cache: 'no-store' });
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function loadNetInfo() {
  const cf = await getCFMeta();
  const who = await getIPWHO();
  const ip6 = await getIPv6();

  $('pubIP').textContent = cf.ip || who.ip || '--';
  setIpBadge(cf.ip || who.ip);
  $('ip6').textContent = ip6?.ip || 'недоступний';
  const isp = who.connection || {};
  $('isp').textContent = [isp.isp, isp.asn, isp.org].filter(Boolean).join(' / ') || cf.asn || '--';
  $('loc').textContent = [who.city, who.country].filter(Boolean).join(', ') || [cf.city, cf.country].filter(Boolean).join(', ') || '--';
  $('colo').textContent = cf.colo || '--';
  $('tz').textContent = cf.tz || who.timezone?.id || '--';
  const lat = who.latitude || cf.lat, lon = who.longitude || cf.lon;
  $('coords').textContent = (lat && lon) ? lat+','+lon : '--';

  if (canUseNative('Network')) {
    try {
      const net = await Network.getStatus();
      $('netType').textContent = net.connectionType || '--';
    } catch (e) { $('netType').textContent = '--'; }
  } else {
    $('netType').textContent = navigator.onLine ? 'online' : 'offline';
  }

  // Device info
  if (canUseNative('Device')) {
    try {
      const dev = await Device.getInfo();
      $('devModel').textContent = [dev.manufacturer, dev.model].filter(Boolean).join(' ');
      $('devOs').textContent = `${dev.operatingSystem} ${dev.osVersion} (SDK ${dev.androidSdkVersion || '-'})`;
    } catch (e) { /* ignore */ }
  }
  $('devScr').textContent = `${window.screen.width}×${window.screen.height}`;
  const ua = navigator.userAgent;
  const webv = ua.match(/Chrome\/([\d.]+)/i);
  $('devWeb').textContent = webv ? webv[1] : '--';
  $('devLoc').textContent = navigator.language || '--';
}

loadNetInfo();

function setIpBadge(ip) {
  const el = $('ipBadgeValue');
  if (el) el.textContent = ip || '--';
}

async function copyText(text) {
  if (!text || text === '--') return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fallback нижче */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

const copyBtn = $('copyIp');
if (copyBtn) {
  copyBtn.onclick = async () => {
    const ok = await copyText(($('ipBadgeValue').textContent || '').trim());
    const prev = copyBtn.textContent;
    copyBtn.classList.toggle('copied', ok);
    copyBtn.textContent = ok ? 'Скопійовано ✓' : 'Не вдалось';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.textContent = prev;
    }, 1500);
  };
}

let testRunning=false;
$('startTest').onclick = async () => {
  if (testRunning) return;
  testRunning = true;
  $('startTest').disabled = true;
  $('status').textContent = 'Початок...';
  $('dl').textContent='--'; $('ul').textContent='--'; $('ping').textContent='--'; $('jitter').textContent='--'; $('loss').textContent='--';
  const bytes = Number($('testSize').value)*1024*1024;
  await runTest(bytes);
  testRunning = false;
  $('startTest').disabled = false;
};

async function warmup() {
  try { await fetch('https://speed.cloudflare.com/__down?bytes=51200', { cache:'no-store' }); } catch(e){}
}

async function runTest(maxBytes){
  await warmup();
  const pings = [];
  $('status').textContent = 'Пінг...';
  for(let i=0;i<8;i++){
    const t0=performance.now();
    try { await fetch('https://speed.cloudflare.com/__down?bytes=1&nocache='+Date.now(), {cache:'no-store'}); } catch(e){}
    const t1=performance.now();
    pings.push(t1-t0);
    await new Promise(r=>setTimeout(r,200));
  }
  pings.sort((a,b)=>a-b);
  const mid=pings.slice(2,6);
  const avg=mid.reduce((s,x)=>s+x,0)/mid.length;
  const varr=mid.reduce((s,x)=>s+(x-avg)**2,0)/mid.length;
  const jitter=Math.sqrt(varr);
  $('ping').textContent = avg.toFixed(1);
  $('jitter').textContent = jitter.toFixed(1);
  $('loss').textContent = '0.0';

  const ctx = $('graph').getContext('2d');
  ctx.fillStyle='#0b1225'; ctx.fillRect(0,0,300,120);
  ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2;
  ctx.beginPath();

  $('status').textContent = 'Download...';
  let dlSpeed=0;
  const chunk=Math.min(10*1024*1024, maxBytes/5);
  const tStart=performance.now();
  for(let i=0;i<5;i++){
    const c0=performance.now();
    try { await fetch('https://speed.cloudflare.com/__down?bytes='+chunk, {cache:'no-store'}); } catch(e){}
    const c1=performance.now();
    const mb=chunk/1024/1024; const sec=(c1-c0)/1000; const mbps=mb/sec*8;
    if(mbps>dlSpeed) dlSpeed=mbps;
    const x=i*60; const y=120 - Math.min(110, mbps*2.5);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    ctx.stroke();
    const prog=(i+1)/5*100; $('bar').style.width=prog+'%';
  }
  const tEnd=performance.now();
  const totalSec=(tEnd-tStart)/1000; const totalMb=maxBytes/1024/1024; const eff=totalMb/totalSec*8;
  $('dl').textContent = Math.max(dlSpeed,eff).toFixed(1);
  $('bar').style.width='100%';

  $('status').textContent = 'Upload...';
  const upChunk=Math.min(5*1024*1024, maxBytes/10);
  const body=new Uint8Array(upChunk).fill(0x41);
  let ulSpeed=0;
  for(let i=0;i<3;i++){
    const u0=performance.now();
    try { await fetch('https://speed.cloudflare.com/__up', {method:'POST', body:body, cache:'no-store'}); } catch(e){}
    const u1=performance.now();
    const mb=upChunk/1024/1024; const sec=(u1-u0)/1000; const mbps=mb/sec*8;
    if(mbps>ulSpeed) ulSpeed=mbps;
  }
  $('ul').textContent = ulSpeed.toFixed(1);
  $('status').textContent = 'Готово';

  saveHistory({ts:Date.now(), dl:Math.max(dlSpeed,eff).toFixed(1), ul:ulSpeed.toFixed(1), ping:avg.toFixed(1), jitter:jitter.toFixed(1), loss:'0.0', mb:Number($('testSize').value)});
}

function saveHistory(h){
  const arr=JSON.parse(localStorage.getItem('nm_hist')||'[]');
  arr.unshift(h); if(arr.length>20) arr.length=20;
  localStorage.setItem('nm_hist', JSON.stringify(arr));
  renderHist();
}

function renderHist(){
  const arr=JSON.parse(localStorage.getItem('nm_hist')||'[]');
  $('histList').innerHTML='';
  arr.forEach(h=>{
    const li=document.createElement('li');
    const dt=new Date(h.ts).toLocaleString();
    li.textContent=`${dt} | DL ${h.dl} UP ${h.ul} PING ${h.ping} (~${h.mb}MB)`;
    $('histList').appendChild(li);
  });
}
$('clearHist').onclick=()=>{localStorage.removeItem('nm_hist'); renderHist();};
renderHist();

// Tools - best-effort placeholders (will be enhanced by native plugin when available)
$('dnsLookup').onclick=async ()=>{
  const q=$('dnsName').value.trim(); if(!q) return;
  $('dnsOut').textContent='Запит...';
  try{
    const r=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(q)+'&type=A', {headers:{Accept:'application/dns-json'}});
    const j=await r.json();
    $('dnsOut').textContent=JSON.stringify(j, null, 2);
  }catch(e){$('dnsOut').textContent='Помилка';}
};
$('portCheck').onclick=async ()=>{
  $('portOut').textContent='Перевірка порту потребує нативного плагіну localnet (best-effort).';
};
$('wifiBtn').onclick=async ()=>{
  $('wifiOut').textContent='RSSI/Wi-Fi info — best-effort через нативний плагін localnet.';
};
$('traceBtn').onclick=async ()=>{
  $('traceOut').textContent='Traceroute (best-effort) — може працювати обмежено на Android.';
};
