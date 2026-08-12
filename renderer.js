const STORAGE_KEY = 'mood_entries_v1';

const dateEl = document.getElementById('date');
const anxietyEl = document.getElementById('anxiety');
const depressionEl = document.getElementById('depression');
const anxietyVal = document.getElementById('anxietyVal');
const depressionVal = document.getElementById('depressionVal');
const notesEl = document.getElementById('notes');
const tagsEl = document.getElementById('tags');
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
  const tags = tagsEl.value.trim().split(',').map(t=>t.trim()).filter(t=>t);
  const entry = {
    date,
    anxiety: Number(anxietyEl.value),
    depression: Number(depressionEl.value),
    notes: notesEl.value.trim(),
    tags: tags
  };
  let entries = loadEntries();
  entries = addOrUpdateEntry(entries, entry);
  saveEntries(entries);
  statusEl.textContent = 'Saved ✓';
  setTimeout(()=>statusEl.textContent='',2000);
  renderChart(currentRange);
  renderHistory();
  updateStats();
  updateStreakAndStats();
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

function renderHistory(){
  const entries=loadEntries();
  const historyTable=document.getElementById('historyTable');
  if(entries.length===0){
    historyTable.innerHTML='<div class="no-entries">No entries yet. Start logging your mood!</div>';
    return;
  }
  let html='<div class="history-row header"><div>Date</div><div>Anxiety</div><div>Depression</div><div>Notes</div><div>Tags</div><div>Actions</div></div>';
  entries.slice().reverse().forEach((e,idx)=>{
    const displayDate=new Date(e.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
    const notes=e.notes||'-';
    const tags=(e.tags||[]).length>0?e.tags.join(', '):'-';
    html+=`<div class="history-row" data-date="${e.date}">
      <div class="date">${displayDate}</div>
      <div class="anxiety">${e.anxiety}</div>
      <div class="depression">${e.depression}</div>
      <div class="notes" title="${notes}">${notes}</div>
      <div class="notes" title="${tags}">${tags}</div>
      <div class="actions">
        <button class="edit-btn" onclick="editEntry('${e.date}')">Edit</button>
        <button class="delete-btn" onclick="deleteEntry('${e.date}')">Delete</button>
      </div>
    </div>`;
  });
  historyTable.innerHTML=html;
}

function deleteEntry(date){
  if(!confirm('Delete this entry? This cannot be undone.')) return;
  let entries=loadEntries();
  entries=entries.filter(e=>e.date!==date);
  saveEntries(entries);
  renderHistory();
  renderChart(currentRange);
  updateStats();
  updateStreakAndStats();
  statusEl.textContent='Entry deleted ✓';
  setTimeout(()=>statusEl.textContent='',2000);
}

function editEntry(date){
  const entries=loadEntries();
  const entry=entries.find(e=>e.date===date);
  if(!entry) return;
  const row=document.querySelector(`[data-date="${date}"]`);
  if(row.classList.contains('edit-mode')){
    row.classList.remove('edit-mode');
    renderHistory();
    return;
  }
  const displayDate=new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  row.classList.add('edit-mode');
  row.innerHTML=`
    <div class="date">${displayDate}</div>
    <div><input type="number" class="edit-anxiety" value="${entry.anxiety}" min="0" max="10" style="width:50px"/></div>
    <div><input type="number" class="edit-depression" value="${entry.depression}" min="0" max="10" style="width:50px"/></div>
    <div><textarea class="edit-notes" style="width:100%;height:40px;resize:none">${entry.notes}</textarea></div>
    <div class="actions">
      <button onclick="saveEditedEntry('${date}')">Save</button>
      <button onclick="editEntry('${date}')">Cancel</button>
    </div>
  `;
}

function saveEditedEntry(date){
  let entries=loadEntries();
  const entry=entries.find(e=>e.date===date);
  if(!entry) return;
  const row=document.querySelector(`[data-date="${date}"]`);
  const newAnxiety=Number(row.querySelector('.edit-anxiety').value);
  const newDepression=Number(row.querySelector('.edit-depression').value);
  const newNotes=row.querySelector('.edit-notes').value.trim();
  if(newAnxiety<0||newAnxiety>10||newDepression<0||newDepression>10){
    alert('Anxiety and depression must be between 0 and 10');
    return;
  }
  entry.anxiety=newAnxiety;
  entry.depression=newDepression;
  entry.notes=newNotes;
  saveEntries(entries);
  renderHistory();
  renderChart(currentRange);
  updateStats();
  updateStreakAndStats();
  statusEl.textContent='Entry updated ✓';
  setTimeout(()=>statusEl.textContent='',2000);
}

function calculateStreak(){
  const entries=loadEntries();
  if(entries.length===0) return {current:0,longest:0};
  const sortedDates=entries.map(e=>new Date(e.date)).sort((a,b)=>b-a);
  let current=0,longest=0,tempStreak=1;
  for(let i=0;i<sortedDates.length;i++){
    if(i===0){
      const today=new Date();
      today.setHours(0,0,0,0);
      const latestDate=new Date(sortedDates[i]);
      latestDate.setHours(0,0,0,0);
      const diff=(today-latestDate)/(1000*60*60*24);
      if(diff<=1) current=1;
      else break;
    } else {
      const diff=(sortedDates[i-1]-sortedDates[i])/(1000*60*60*24);
      if(Math.abs(diff-1)<0.1) tempStreak++;
      else break;
    }
  }
  current=Math.max(current,tempStreak);
  tempStreak=1;
  for(let i=1;i<sortedDates.length;i++){
    const diff=(sortedDates[i-1]-sortedDates[i])/(1000*60*60*24);
    if(Math.abs(diff-1)<0.1) tempStreak++;
    else {longest=Math.max(longest,tempStreak);tempStreak=1;}
  }
  longest=Math.max(longest,tempStreak);
  return {current,longest};
}

function updateStreakAndStats(){
  const entries=loadEntries();
  const {current,longest}=calculateStreak();
  document.getElementById('currentStreak').textContent=`${current} day${current!==1?'s':''}`;
  document.getElementById('longestStreak').textContent=`${longest} day${longest!==1?'s':''}`;
  
  if(entries.length===0){
    document.getElementById('minAnxiety').textContent='-';
    document.getElementById('maxAnxiety').textContent='-';
    document.getElementById('minDepression').textContent='-';
    document.getElementById('maxDepression').textContent='-';
    updateAdvancedStats([]);
    return;
  }
  
  const anxieties=entries.map(e=>e.anxiety);
  const depressions=entries.map(e=>e.depression);
  const minA=Math.min(...anxieties);
  const maxA=Math.max(...anxieties);
  const minD=Math.min(...depressions);
  const maxD=Math.max(...depressions);
  
  document.getElementById('minAnxiety').textContent=minA;
  document.getElementById('maxAnxiety').textContent=maxA;
  document.getElementById('minDepression').textContent=minD;
  document.getElementById('maxDepression').textContent=maxD;
  
  updateAdvancedStats(entries);
}

function updateAdvancedStats(entries){
  const container=document.getElementById('advancedStats');
  if(entries.length===0){
    container.innerHTML='<div class="stat-box">No data yet to calculate trends.</div>';
    return;
  }
  
  const sorted=entries.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const first=sorted[0];
  const last=sorted[sorted.length-1];
  
  const anxietyTrend=last.anxiety-first.anxiety;
  const depressionTrend=last.depression-first.depression;
  const anxietyTrendDir=anxietyTrend<0?'trend-up':'trend-down';
  const depressionTrendDir=depressionTrend<0?'trend-up':'trend-down';
  
  const allTags=new Set();
  entries.forEach(e=>{if(e.tags) e.tags.forEach(t=>allTags.add(t));});
  
  let tagStats='';
  if(allTags.size>0){
    tagStats='<div class="stat-box"><div class="stat-box-label">Most Used Tags:</div>';
    const tagCounts={};
    entries.forEach(e=>{if(e.tags) e.tags.forEach(t=>{tagCounts[t]=(tagCounts[t]||0)+1;});});
    const topTags=Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
    tagStats+=topTags.map(([tag,count])=>`<div>${tag}: ${count}</div>`).join('')+'</div>';
  }
  
  const correlationAvg=entries.reduce((acc,e)=>acc+Math.abs(e.anxiety-e.depression),0)/entries.length;
  
  const anxietyLabel=anxietyTrend>0?'📈 Anxiety Increasing':'📉 Anxiety Improving';
  const depressionLabel=depressionTrend>0?'📈 Depression Increasing':'📉 Depression Improving';
  
  container.innerHTML=`
    <div class="stat-box">
      <div class="stat-box-label">Anxiety Trend</div>
      <div class="stat-box-value ${anxietyTrendDir}">${anxietyLabel}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">Change: ${anxietyTrend>0?'+':''}${anxietyTrend.toFixed(1)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-label">Depression Trend</div>
      <div class="stat-box-value ${depressionTrendDir}">${depressionLabel}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">Change: ${depressionTrend>0?'+':''}${depressionTrend.toFixed(1)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-box-label">Avg Difference</div>
      <div class="stat-box-value">${correlationAvg.toFixed(1)}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">Anxiety vs Depression</div>
    </div>
    ${tagStats}
  `;
}

function exportAsCSV(){
  const entries=loadEntries();
  if(entries.length===0){alert('No entries to export');return;}
  let csv='Date,Anxiety,Depression,Notes,Tags\n';
  entries.forEach(e=>{
    const tags=(e.tags||[]).join(';');
    const notes=(e.notes||'').replace(/"/g,'""');
    csv+=`${e.date},${e.anxiety},${e.depression},"${notes}","${tags}"\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`mood_entries_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  const exportStatus=document.getElementById('exportStatus');
  exportStatus.textContent='CSV exported ✓';
  setTimeout(()=>exportStatus.textContent='',2000);
}

function exportAsJSON(){
  const entries=loadEntries();
  if(entries.length===0){alert('No entries to export');return;}
  const json=JSON.stringify(entries,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`mood_entries_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const exportStatus=document.getElementById('exportStatus');
  exportStatus.textContent='JSON exported ✓';
  setTimeout(()=>exportStatus.textContent='',2000);
}

document.getElementById('exportCsvBtn').addEventListener('click',exportAsCSV);
document.getElementById('exportJsonBtn').addEventListener('click',exportAsJSON);

// Init
anxietyVal.textContent=anxietyEl.value;
depressionVal.textContent=depressionEl.value;
renderChart(currentRange);
renderHistory();
updateStats();
updateStreakAndStats();
// Developer section defaults
const devAvatar = document.getElementById('devAvatar');
const devName = document.getElementById('devName');
if(devAvatar){devAvatar.src='https://i.pravatar.cc/128?u=travis';}
if(devName){devName.textContent='Travis';}