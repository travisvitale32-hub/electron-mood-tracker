const STORAGE_KEY = 'mood_entries_v1';

const dateEl = document.getElementById('date');
const anxietyEl = document.getElementById('anxiety');
const depressionEl = document.getElementById('depression');
const anxietyVal = document.getElementById('anxietyVal');
const depressionVal = document.getElementById('depressionVal');
const notesEl = document.getElementById('notes');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

dateEl.valueAsDate = new Date();

anxietyEl.addEventListener('input',()=>anxietyVal.textContent = anxietyEl.value);
depressionEl.addEventListener('input',()=>depressionVal.textContent = depressionEl.value);

function loadEntries(){
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveEntries(entries){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function addOrUpdateEntry(entries, entry){
  const idx = entries.findIndex(e=>e.date===entry.date);
  if(idx>=0) entries[idx]=entry;
  else entries.push(entry);
  entries.sort((a,b)=>a.date.localeCompare(b.date));
  return entries;
}

saveBtn.addEventListener('click',()=>{
  const date = dateEl.value;
  if(!date){statusEl.textContent='Please pick a date';return;}
  const entry = {
    date,
    anxiety: Number(anxietyEl.value),
    depression: Number(depressionEl.value),
    notes: notesEl.value.trim()
  };
  let entries = loadEntries();
  entries = addOrUpdateEntry(entries, entry);
  saveEntries(entries);
  statusEl.textContent = 'Saved ✓';
  setTimeout(()=>statusEl.textContent='',2000);
  renderChart(currentRange);
  updateStats();
});

let chart;
const ctx = document.getElementById('moodChart').getContext('2d');
function makeChart(labels, anxietyData, depressionData){
  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Anxiety', data:anxietyData, borderColor:'#7aa2f7', backgroundColor:'rgba(122,162,247,.15)', tension:.35, fill:true},
        {label:'Depression', data:depressionData, borderColor:'#f78da7', backgroundColor:'rgba(247,141,167,.15)', tension:.35, fill:true}
      ]
    },
    options:{
      responsive:true,
      plugins:{legend:{labels:{color:'#e8ecf2'}}},
      scales:{
        x:{ticks:{color:'#9aa4b2'}},
        y:{min:0,max:10,ticks:{color:'#9aa4b2'},grid:{color:'rgba(255,255,255,.06)'}}
      }
    }
  });
}

function formatDate(d){return d.toISOString().slice(0,10)}
function getRangeData(entries, range){
  const map = new Map();
  const today = new Date();
  const daysBack = {daily:7, weekly:12, monthly:12, yearly:5}[range];
  // We'll just filter last N periods
  const filtered = entries.filter(e=>{
    const ed = new Date(e.date);
    const diffDays = (today-ed)/(1000*60*60*24);
    if(range==='daily') return diffDays<=30;
    if(range==='weekly') return diffDays<=84;
    if(range==='monthly') return diffDays<=365;
    return diffDays<=1095;
  });

  if(range==='daily'){
    // last 7 days
    const labels=[];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      labels.push(d.toLocaleDateString(undefined,{month:'short',day:'numeric'}));
    }
    const data = labels.map(l=>{
      const iso = new Date(l).toISOString().slice(0,10); // not reliable
      return null;
    });
  }

  // Build aggregated points
  const points=[];
  filtered.forEach(e=>{
    const d=new Date(e.date);
    let key='';
    if(range==='daily'){
      key = e.date;
    } else if(range==='weekly'){
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate()-d.getDay());
      key = weekStart.toISOString().slice(0,10);
    } else if(range==='monthly'){
      key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    } else {
      key = `${d.getFullYear()}`;
    }
    if(!map.has(key)) map.set(key,{anxiety:[],depression:[],label:key});
    map.get(key).anxiety.push(e.anxiety);
    map.get(key).depression.push(e.depression);
  });

  const sortedKeys = Array.from(map.keys()).sort();
  const labels = [];
  const anxietyAvg=[];
  const depressionAvg=[];
  sortedKeys.forEach(k=>{
    const v=map.get(k);
    const aAvg = v.anxiety.reduce((s,x)=>s+x,0)/v.anxiety.length;
    const dAvg = v.depression.reduce((s,x)=>s+x,0)/v.depression.length;
    let label=k;
    if(range==='weekly'){
      const d=new Date(k); label = `W ${d.toLocaleDateString(undefined,{month:'short'})}`;
    } else if(range==='monthly'){
      const [y,m]=k.split('-');
      label = `${new Date(y,m-1).toLocaleString(undefined,{month:'short'})} ${y}`;
    } else if(range==='yearly'){
      label=k;
    } else {
      label=new Date(k).toLocaleDateString(undefined,{month:'short',day:'numeric'});
    }
    labels.push(label);
    anxietyAvg.push(+aAvg.toFixed(2));
    depressionAvg.push(+dAvg.toFixed(2));
  });
  return {labels, anxietyAvg, depressionAvg};
}

let currentRange='daily';
function renderChart(range){
  const entries=loadEntries();
  const {labels, anxietyAvg, depressionAvg}=getRangeData(entries,range);
  if(labels.length===0){
    makeChart(['No data'],[null],[null]);
    return;
  }
  makeChart(labels, anxietyAvg, depressionAvg);
}

function updateStats(){
  const entries=loadEntries();
  const count=entries.length;
  document.getElementById('entryCount').textContent=count;
  if(count===0){
    document.getElementById('avgAnxiety').textContent='-';
    document.getElementById('avgDepression').textContent='-';
    return;
  }
  const avgA = entries.reduce((s,e)=>s+e.anxiety,0)/count;
  const avgD = entries.reduce((s,e)=>s+e.depression,0)/count;
  document.getElementById('avgAnxiety').textContent=avgA.toFixed(1);
  document.getElementById('avgDepression').textContent=avgD.toFixed(1);
}

document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentRange=btn.dataset.range;
    renderChart(currentRange);
  });
});

// Init
anxietyVal.textContent=anxietyEl.value;
depressionVal.textContent=depressionEl.value;
renderChart(currentRange);
updateStats();
// Developer section defaults
const devAvatar = document.getElementById('devAvatar');
const devName = document.getElementById('devName');
if(devAvatar){devAvatar.src='https://i.pravatar.cc/128?u=travis';}
if(devName){devName.textContent='Travis';}