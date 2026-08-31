/* ===== ระบบสร้างแรงจูงใจ: ไฟติด / XP / เหรียญตรา / ภารกิจ / ตารางในบ้าน =====
   ไฟล์นี้คือต้นฉบับเดียว — build-exam-banks.py จะฝังลงทั้ง index.html และห้องสอบทั้งสอง
   แก้ที่นี่ที่เดียวแล้วรัน `python build-exam-banks.py` */
const GAME = (()=>{
  const KEY = n => 'tedet-game:'+(n||PROF.active);
  const iso = d => d.toLocaleDateString('sv-SE');          // YYYY-MM-DD ตามเวลาเครื่อง
  const TODAY = ()=> iso(new Date());
  const BLANK = ()=>({xp:0, days:[], badges:[], topics:{}, quest:null, examDate:'', bestCombo:0, questDone:0, grade:''});
  const load = n => { try{ return Object.assign(BLANK(), JSON.parse(localStorage.getItem(KEY(n))||'{}')); }catch(e){ return BLANK(); } };
  const save = g => { try{ localStorage.setItem(KEY(), JSON.stringify(g)); }catch(e){} };
  let combo = 0;   // ถูกติดกันกี่ข้อ — นับเฉพาะรอบที่เปิดหน้าอยู่ ไม่ต้องเก็บลงเครื่อง

  /* ระดับชั้นของโปรไฟล์ — เควสและตารางแข่งใช้อันนี้ */
  const GLABEL = {p5:'ป.5', p6:'ป.6', m1:'ม.1'};
  const gradeOf = n => load(n).grade || '';
  const setGrade = (n, gr) => { const g = load(n); g.grade = gr; try{ localStorage.setItem(KEY(n), JSON.stringify(g)); }catch(e){} };

  /* ยศจากเปอร์เซ็นต์คะแนน (ธีม TEDET Quest): S ≥90, A ≥75, B ≥60, C ต่ำกว่า */
  const rank = pct => pct>=90?'S':pct>=75?'A':pct>=60?'B':'C';
  /* ฉายานักผจญภัยตามเลเวล */
  const rankTitle = lv => lv>=15?'ผู้พิชิตยอดเขา':lv>=10?'นายพรานโจทย์':lv>=5?'นักสำรวจ':'นักเดินป่าฝึกหัด';
  /* น้องนาคา — มาสคอต inline SVG ตัวเดียวทั้งเว็บ */
  const NAGA = `<svg class="naga" width="64" height="52" viewBox="0 0 64 52" aria-hidden="true">
    <path d="M6 46 Q 2 34 12 30 T 26 22 Q 38 16 36 8" fill="none" stroke="var(--sci)" stroke-width="8" stroke-linecap="round"/>
    <path d="M8 44 Q 6 36 14 32" fill="none" stroke="var(--flag)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="38" cy="10" r="9" fill="var(--sci)"/>
    <path d="M36 1 l3 -5 l3 5 z" fill="var(--flag)"/>
    <g class="eye" style="transform-origin:41px 9px">
      <circle cx="38" cy="9" r="1.8" fill="#fff"/><circle cx="44" cy="9" r="1.8" fill="#fff"/>
    </g>
    <path d="M40 14 q 3 2 6 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

  /* เลเวล: ช่วงแรกขึ้นไว แล้วค่อย ๆ ห่างขึ้น — XP ที่ต้องใช้ถึงเลเวล n = 50*(n-1)² */
  const level = xp => Math.floor(Math.sqrt(Math.max(0,xp)/50))+1;
  const lvlXP = n => 50*(n-1)*(n-1);

  /* ไฟติดต่อกัน: ขาดได้ 1 วันโดยไฟไม่ดับ (โล่กันไฟดับ) — เด็กพลาดวันเดียวแล้วไม่ท้อเลิกเล่น */
  function streak(days){
    const set = new Set(days), d = new Date();
    let s = 0, shield = 1;
    if(!set.has(iso(d))) d.setDate(d.getDate()-1);   // ยังไม่ได้ทำวันนี้ ก็ยังนับไฟจากเมื่อวาน
    for(;;){
      if(set.has(iso(d))) s++;
      else if(shield && s) shield = 0;               // ใช้โล่ 1 ครั้ง
      else break;
      d.setDate(d.getDate()-1);
    }
    return s;
  }

  /* จำนวนปีของข้อสอบจริงที่เคยทำจบ (นับปีไม่ซ้ำ ไม่ว่าคณิตหรือวิทย์) */
  function realYears(n){
    const out = new Set(), me = ':'+(n||PROF.active);
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('tedet-real-') && k.endsWith(me)){
        try{ JSON.parse(localStorage.getItem(k)||'[]').forEach(r=> out.add(String(r.year))); }catch(e){}
      }
    }
    return out.size;
  }

  const BADGES = [
    {id:'first',   e:'🌱', n:'ก้าวแรก',          h:'ตอบข้อแรกในเว็บ'},
    {id:'s3',      e:'🔥', n:'ไฟติด 3 วัน',      h:'เข้ามาฝึก 3 วันติด'},
    {id:'s7',      e:'🔥', n:'ไฟติด 7 วัน',      h:'เข้ามาฝึก 7 วันติด'},
    {id:'s30',     e:'🌋', n:'ไฟไม่มีวันดับ',    h:'เข้ามาฝึก 30 วันติด'},
    {id:'combo5',  e:'⚡', n:'ต่อเนื่อง 5 ข้อ',   h:'ตอบถูกติดกัน 5 ข้อ'},
    {id:'combo10', e:'🌀', n:'ต่อเนื่อง 10 ข้อ',  h:'ตอบถูกติดกัน 10 ข้อ'},
    {id:'lv5',     e:'⭐', n:'เลเวล 5',          h:'สะสม XP ถึงเลเวล 5'},
    {id:'lv10',    e:'💫', n:'เลเวล 10',         h:'สะสม XP ถึงเลเวล 10'},
    {id:'y1',      e:'🗺️', n:'นักสำรวจ',         h:'ทำข้อสอบจริงจบ 1 ปี'},
    {id:'y6',      e:'🧭', n:'ครึ่งทางแล้ว',      h:'ทำข้อสอบจริงจบ 6 ปี'},
    {id:'y12',     e:'👑', n:'ครบทุกปี',         h:'ทำข้อสอบจริงจบครบ 12 ปี'},
    {id:'sc20',    e:'🎖️', n:'20 ข้อขึ้นไป',     h:'ข้อสอบจริงได้ 20/30 ขึ้นไป'},
    {id:'sc25',    e:'🏅', n:'25 ข้อขึ้นไป',     h:'ข้อสอบจริงได้ 25/30 ขึ้นไป'},
    {id:'better',  e:'📈', n:'เก่งขึ้นกว่าเดิม',  h:'ทำปีเดิมซ้ำแล้วได้คะแนนดีขึ้น'},
    {id:'quest3',  e:'🎯', n:'นักล่าภารกิจ',      h:'ทำภารกิจประจำวันสำเร็จ 3 วัน'},
    {id:'early',   e:'🌅', n:'ตื่นเช้ามาฝึก',     h:'ฝึกก่อน 8 โมงเช้า'},
  ];

  const QUESTS = [
    {id:'q5',   t:'ฝึกให้ครบ 5 ข้อ',        goal:5,  ev:'answer', xp:60},
    {id:'q10',  t:'ฝึกให้ครบ 10 ข้อ',       goal:10, ev:'answer', xp:100},
    {id:'qc3',  t:'ตอบถูกติดกัน 3 ข้อ',     goal:3,  ev:'combo',  xp:80},
    {id:'qok8', t:'ตอบถูกให้ได้ 8 ข้อ',     goal:8,  ev:'ok',     xp:90},
    {id:'qr1',  t:'ทำข้อสอบจริงให้จบ 1 ปี', goal:1,  ev:'real',   xp:150},
  ];
  function questOfDay(){                      // สุ่มจากวันที่ → ทุกหน้าเห็นภารกิจเดียวกัน
    const d = TODAY(); let h = 0;
    for(const c of d) h = (h*31 + c.charCodeAt(0)) | 0;
    return QUESTS[Math.abs(h) % QUESTS.length];
  }

  /* ---------- ป้ายเด้ง ---------- */
  function toast(html, big){
    const t = document.createElement('div');
    t.className = 'gtoast'+(big?' big':'');
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 400); }, big?2600:1600);
  }

  function award(g, id){
    if(g.badges.includes(id)) return false;
    const b = BADGES.find(x=>x.id===id); if(!b) return false;
    g.badges.push(id);
    toast(`<b>${b.e} ได้เหรียญใหม่!</b><br>${b.n}`, true);
    return true;
  }

  /* เหรียญที่คำนวณได้เองจากสถิติ — เรียกทุกครั้งที่ค่าเปลี่ยน */
  function autoBadges(g){
    const s = streak(g.days), y = realYears(), lv = level(g.xp);
    if(g.xp>0) award(g,'first');
    if(s>=3) award(g,'s3');  if(s>=7) award(g,'s7');  if(s>=30) award(g,'s30');
    if(lv>=5) award(g,'lv5'); if(lv>=10) award(g,'lv10');
    if(y>=1) award(g,'y1');  if(y>=6) award(g,'y6');  if(y>=12) award(g,'y12');
    if(new Date().getHours()<8) award(g,'early');
  }

  function addXP(g, n, why){
    const before = level(g.xp);
    g.xp += n;
    const day = TODAY();
    if(!g.days.includes(day)) g.days.push(day);
    g.days = g.days.slice(-400);
    autoBadges(g);
    const after = level(g.xp);
    if(after>before) toast(`<b>🎉 เลเวล ${after}!</b><br>เก่งขึ้นอีกขั้นแล้ว`, true);
    else if(n>0) toast(`+${n} XP${why?' · '+why:''}`);
  }

  /* ---------- ภารกิจประจำวัน ---------- */
  function quest(g){
    const q = questOfDay();
    if(!g.quest || g.quest.date!==TODAY() || g.quest.id!==q.id) g.quest = {date:TODAY(), id:q.id, n:0, done:false};
    return q;
  }
  function progress(g, ev, n){
    const q = quest(g);
    if(q.ev!==ev || g.quest.done) return;
    g.quest.n = ev==='combo' ? Math.max(g.quest.n, n) : g.quest.n + n;
    if(g.quest.n >= q.goal){
      g.quest.done = true;
      g.questDone = (g.questDone||0) + 1;
      if(g.questDone>=3) award(g,'quest3');
      addXP(g, q.xp, 'ภารกิจสำเร็จ! 🎯');
    }
  }

  /* ---------- เหตุการณ์จากหน้าเว็บ ---------- */
  function answered(ok, topic){                // ตรวจคำตอบ 1 ข้อ (โหมดฝึก)
    if(!PROF.active) return;
    const g = load();
    if(topic){ const c = g.topics[topic]||{ok:0,n:0}; g.topics[topic] = {ok:c.ok+(ok?1:0), n:c.n+1}; }
    combo = ok ? combo+1 : 0;
    if(combo > (g.bestCombo||0)) g.bestCombo = combo;
    if(combo>=5) award(g,'combo5');
    if(combo>=10) award(g,'combo10');
    progress(g,'answer',1);
    if(ok) progress(g,'ok',1);
    progress(g,'combo',combo);
    addXP(g, ok?15:10, ok?'ถูกต้อง!':'ได้ลองแล้ว');   // ผิดก็ยังได้ XP — ให้รางวัลความพยายาม
    save(g);
  }
  /* จบชุด: kind = practice | mock | real */
  function finish(o){
    if(!PROF.active) return;
    const g = load();
    if(o.kind==='real'){
      if(o.score>=20) award(g,'sc20');
      if(o.score>=25) award(g,'sc25');
      if(o.improved>0) award(g,'better');
      progress(g,'real',1);
      addXP(g, 150 + o.score*5, `จบข้อสอบจริงปี ${o.year}`);
    } else {
      addXP(g, (o.kind==='mock'?120:50) + (o.score||0)*5, 'จบชุดแล้ว');
    }
    if(o.topics) for(const [t,v] of Object.entries(o.topics)){
      const cur = g.topics[t] || {ok:0,n:0};
      g.topics[t] = {ok:cur.ok+v.ok, n:cur.n+v.n};
    }
    save(g);
  }

  /* ---------- ตารางในบ้าน: จัดอันดับทุกโปรไฟล์ในเครื่องนี้ ---------- */
  function board(){
    return PROF.list().map(n=>{ const g = load(n); return {name:n, xp:g.xp, lv:level(g.xp), s:streak(g.days), b:g.badges.length, gr:g.grade||''}; })
                      .sort((a,b)=> b.xp-a.xp);
  }

  /* ---------- หน้าตา ---------- */
  const CSS = `
  .gcard{position:relative; background:var(--card); border:2px solid var(--line); border-radius:18px; padding:16px 18px; box-shadow:var(--shadow); margin-top:16px}
  .gcard h2{margin:0 0 10px; font-size:1.05rem}
  .gnaga{position:absolute; top:-30px; right:22px; pointer-events:none}
  .gtrail{display:flex; align-items:flex-start; gap:4px; margin:0 0 14px; flex-wrap:wrap; padding-bottom:16px}
  .gtnode{position:relative; width:44px; height:44px; border-radius:50%; border:2px dashed var(--line); background:var(--paper);
    display:grid; place-items:center; font-size:1.15rem; flex:none}
  .gtnode i{position:absolute; top:100%; left:50%; transform:translateX(-50%); font-style:normal; font-size:.68rem; color:var(--muted); white-space:nowrap; margin-top:2px}
  .gtnode.on{border-style:solid; border-color:var(--flag); background:color-mix(in srgb, var(--flag) 22%, var(--card))}
  .gtnode.gflag{border-color:var(--flag)}
  .gtline{flex:1; min-width:14px; border-top:3px dotted var(--line); margin-top:21px}
  .ggrid{display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:16px}
  .glvl{display:flex; align-items:center; gap:12px}
  .gcompass{flex:none}
  .gbar{position:relative; height:10px; border-radius:9px; margin-top:8px;
    background:repeating-linear-gradient(90deg, var(--grid) 0 8px, transparent 8px 14px)}
  .gbar i{display:block; height:100%; background:var(--math); border-radius:9px; transition:width .6s cubic-bezier(.22,1,.36,1)}
  .gbar.q i{background:var(--ok)}
  .gdays{display:flex; gap:5px; margin-top:12px}
  .gday{width:30px; height:30px; border-radius:50%; background:var(--paper); border:2px solid var(--line); display:grid; place-items:center; font-size:.66rem; color:var(--muted); position:relative}
  .gday.on{border-color:var(--accent); background:color-mix(in srgb, var(--accent) 18%, var(--card)); color:var(--ink); font-weight:700}
  .gday.on::after{content:'🔥'; position:absolute; top:-11px; font-size:.72rem}
  .gday.on:last-child::after{animation:gflick 1.1s ease-in-out infinite alternate; transform-origin:bottom}
  @keyframes gflick{from{transform:scaleY(1)} to{transform:scaleY(1.12) skewX(2deg)}}
  .gseal{color:var(--ok); font-weight:700}
  .gbadges{display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; align-items:center}
  .gb{width:46px; height:46px; display:grid; place-items:center; font-size:1.35rem;
    background:var(--paper); border:2px solid var(--flag);
    clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%); border-radius:10px}
  .gb.lock,.gb.ghost{opacity:.35; filter:grayscale(1); border:2px dashed var(--line)}
  .gb.ghost{opacity:.22}
  .gbwrap{display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; margin-top:10px}
  .gbrow{display:flex; gap:10px; align-items:center; background:var(--paper); border-radius:12px; padding:8px 10px}
  .gbrow.lock .gb{opacity:.3; filter:grayscale(1); border-style:dashed}
  .gbrow .t{font-size:.82rem; line-height:1.3}
  .glb{width:100%; border-collapse:collapse; margin-top:6px; font-size:.92rem}
  .glb td{padding:5px 6px; border-bottom:1px solid var(--line)}
  .glb tr.me{background:var(--math-soft); font-weight:700}
  .ggr{display:inline-block; font-size:.7rem; font-weight:700; color:var(--sci); background:var(--sci-soft); border-radius:999px; padding:1px 7px; vertical-align:1px}
  .gspark{width:100%; height:52px; margin-top:6px; overflow:visible}
  .gweak{background:var(--bad-soft); border-radius:10px; padding:8px 10px; margin-top:8px; font-size:.9rem}
  .gtoast{position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:9999; pointer-events:none;
    background:var(--ink); color:var(--paper); padding:10px 18px; border-radius:999px; font-weight:600;
    box-shadow:0 6px 24px rgba(0,0,0,.28); animation:gpop .3s ease-out; text-align:center}
  .gtoast.big{border-radius:16px; padding:14px 24px; font-size:1.05rem; background:var(--flag); color:#3a2400;
    animation:gstamp .45s cubic-bezier(.34,1.56,.64,1)}
  .gtoast.out{opacity:0; transition:opacity .4s}
  @keyframes gpop{from{opacity:0; transform:translate(-50%,14px)} to{opacity:1; transform:translate(-50%,0)}}
  @keyframes gstamp{from{opacity:0; transform:translate(-50%,0) scale(2)} to{opacity:1; transform:translate(-50%,0) scale(1)}}
  @media (prefers-reduced-motion:reduce){ .gtoast{animation:none} .gbar i{transition:none} .gday.on:last-child::after{animation:none} }`;

  function sparkline(pts){
    if(pts.length<2) return '';
    const w=260, h=48, max=100;
    const x = i => i*(w/(pts.length-1)), y = v => h - (v/max)*(h-6) - 3;
    const d = pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
    return `<svg class="gspark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="กราฟคะแนนล่าสุด">
      <path d="${d}" fill="none" stroke="var(--ok)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p).toFixed(1)}" r="3.5" fill="var(--ok)"/>`).join('')}
    </svg>`;
  }

  /* opts.scores = [เปอร์เซ็นต์คะแนนเรียงเก่า→ใหม่] */
  function card(opts){
    opts = opts||{};
    if(!PROF.active) return '';
    const g = load(), q = quest(g), lv = level(g.xp), s = streak(g.days);
    save(g);                                   // เผื่อภารกิจเพิ่งถูกสุ่มใหม่ของวันนี้
    const cur = g.xp - lvlXP(lv), need = lvlXP(lv+1) - lvlXP(lv);
    const set = new Set(g.days);
    const dots = Array.from({length:7},(_,k)=>{
      const d = new Date(); d.setDate(d.getDate()-(6-k));
      return `<div class="gday ${set.has(iso(d))?'on':''}" title="${iso(d)}">${['อา','จ','อ','พ','พฤ','ศ','ส'][d.getDay()]}</div>`;
    }).join('');
    const qp = Math.min(100, Math.round(g.quest.n/q.goal*100));
    const lb = board();
    const weak = Object.entries(g.topics).filter(([,v])=>v.n>=3).sort((a,b)=> a[1].ok/a[1].n - b[1].ok/b[1].n)[0];
    const days = g.examDate ? Math.ceil((new Date(g.examDate+'T00:00') - new Date(TODAY()+'T00:00'))/86400000) : null;
    const shown = BADGES.filter(b=> g.badges.includes(b.id)).slice(-5);

    const trail = [
      {e:'⛺', t:'เปิดแคมป์', on:true},
      {e:'🎯', t:'เควส', on:g.quest.done},
      {e:'✏️', t:'ฝึกวันนี้', on:set.has(TODAY())},
      {e:'🚩', t: days!==null && days>0 ? `อีก ${days} วัน` : 'ยอดเขา', on:false, flag:true},
    ];
    const R = 25, CIRCUM = 2*Math.PI*R, frac = Math.min(1, cur/need);
    return `<div class="gcard" id="gcard">
      <div class="gnaga">${NAGA}</div>
      <div class="gtrail" role="img" aria-label="เส้นทางวันนี้">
        ${trail.map((n,k)=>`${k?'<span class="gtline"></span>':''}<span class="gtnode ${n.on?'on':''} ${n.flag?'gflag':''}" title="${n.t}">${n.e}<i>${n.t}</i></span>`).join('')}
      </div>
      <div class="ggrid">
        <div>
          <h2>🧭 ${esc(PROF.active)} · <span class="ranktitle">${rankTitle(lv)}</span></h2>
          <div class="glvl">
            <svg class="gcompass" width="66" height="66" viewBox="0 0 66 66">
              <circle cx="33" cy="33" r="${R}" fill="none" stroke="var(--grid)" stroke-width="7"/>
              <circle cx="33" cy="33" r="${R}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round"
                stroke-dasharray="${(frac*CIRCUM).toFixed(1)} ${CIRCUM.toFixed(1)}" transform="rotate(-90 33 33)"/>
              <text x="33" y="39" text-anchor="middle" class="gring" style="font-size:1.15rem; fill:var(--ink)">${lv}</text>
            </svg>
            <div style="flex:1">
              <div class="sub" style="font-size:.85rem">เลเวล ${lv} · ${cur}/${need} XP → ด่านต่อไป</div>
              <div class="gbar"><i style="width:${Math.round(frac*100)}%"></i></div>
              <div class="sub" style="font-size:.8rem; margin-top:4px">สะสม ${g.xp} XP · ${g.badges.length}/${BADGES.length} เหรียญ</div>
            </div>
          </div>
          <h2 style="margin-top:14px">🔥 กองไฟติด ${s} วัน${s>=3?' สุดยอด!':''}</h2>
          <div class="gdays">${dots}</div>
          <div class="sub" style="font-size:.78rem; margin-top:6px">มีโล่กันไฟดับ — ขาดได้ 1 วันไฟไม่ดับ</div>
        </div>
        <div>
          <h2>🎯 เควสวันนี้</h2>
          <div class="gquest">${g.quest.done?'<span class="gseal">สำเร็จ ✔</span> ':''}${q.t} <span class="sub">(${Math.min(g.quest.n,q.goal)}/${q.goal})</span></div>
          <div class="gbar q"><i style="width:${qp}%"></i></div>
          <div class="sub" style="font-size:.82rem; margin-top:4px">${g.quest.done?`รับไปแล้ว ${q.xp} XP 🎉`:`ทำสำเร็จรับ ${q.xp} XP`}</div>
          <h2 style="margin-top:14px">⏳ นับถอยหลังพิชิตยอดเขา</h2>
          ${days!==null
            ? `<div style="font-size:1.05rem"><b class="summitflag">${days>0?`🚩 อีก ${days} วันถึงยอดเขา TEDET`:days===0?'วันนี้คือวันสอบ! 💪':'สอบผ่านไปแล้ว'}</b><br><span class="sub">ซ้อมมาแล้ว ${realYears()} ปี</span></div>`
            : `<div class="sub" style="font-size:.9rem">ยังไม่ได้ตั้งวันสอบ</div>`}
          <div class="row" style="margin-top:6px">
            <input type="date" id="gExamDate" value="${g.examDate}" style="font-family:inherit; font-size:.9rem; padding:6px 8px; border-radius:10px; border:2px solid var(--line); background:var(--card); color:var(--ink)">
          </div>
        </div>
        <div>
          <h2>🏆 ธงประจำบ้าน</h2>
          <table class="glb">${lb.map((r,i)=>`<tr class="${r.name===PROF.active?'me':''}">
            <td style="width:28px">${['🥇','🥈','🥉'][i]||(i+1)}</td>
            <td>${esc(r.name)}${r.gr?` <span class="ggr">${GLABEL[r.gr]||r.gr}</span>`:''}</td>
            <td class="sub" style="text-align:right; white-space:nowrap">Lv.${r.lv} · ${r.xp} XP</td>
            <td class="sub" style="text-align:right; white-space:nowrap">🔥${r.s}</td></tr>`).join('')}</table>
          <div class="sub" style="font-size:.75rem; margin-top:4px">XP วัดความขยัน — คนละชั้นก็แข่งกันได้</div>
          ${opts.scores && opts.scores.length>1 ? `<h2 style="margin-top:14px">📈 กราฟฝีมือ</h2>${sparkline(opts.scores)}
            <div class="sub" style="font-size:.8rem">คะแนน ${opts.scores.length} ครั้งล่าสุด (เก่า → ใหม่)</div>` : ''}
          ${weak ? `<div class="gweak">จุดที่ควรซ้อม: <b>${esc(weak[0])}</b> — ถูก ${weak[1].ok}/${weak[1].n} ข้อ</div>` : ''}
        </div>
      </div>
      <h2 style="margin-top:16px">🏅 กำแพงถ้วยรางวัล <span class="sub" style="font-weight:400; font-size:.85rem">${g.badges.length}/${BADGES.length}</span></h2>
      <div class="gbadges">
        ${shown.map(b=>`<div class="gb" title="${b.n}">${b.e}</div>`).join('')}
        ${BADGES.filter(b=>!g.badges.includes(b.id)).slice(0,3).map(b=>`<div class="gb ghost" title="ยังไม่ได้: ${b.h}">${b.e}</div>`).join('')}
        <button class="btn ghost" id="gAllBadges" style="padding:6px 14px; min-height:40px">ดูตู้ทั้งหมด</button>
      </div>
    </div>`;
  }

  function badgeModal(){
    const g = load();
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `<div class="card modal" style="max-width:640px; max-height:86vh; overflow:auto">
      <h2>🏅 ตู้เหรียญตรา — ได้แล้ว ${g.badges.length}/${BADGES.length}</h2>
      <div class="gbwrap">${BADGES.map(b=>{ const got = g.badges.includes(b.id);
        return `<div class="gbrow ${got?'':'lock'}"><div class="gb">${b.e}</div>
          <div class="t"><b>${b.n}</b><br><span class="sub">${got?'ได้แล้ว ✔':b.h}</span></div></div>`; }).join('')}</div>
      <div class="row" style="justify-content:flex-end; margin-top:14px"><button class="btn ghost" id="gClose">ปิด</button></div></div>`;
    document.body.appendChild(bd);
    bd.querySelector('#gClose').onclick = ()=> bd.remove();
    bd.addEventListener('click', e=>{ if(e.target===bd) bd.remove(); });
  }

  function wire(redraw){
    const all = document.getElementById('gAllBadges');
    if(all) all.onclick = badgeModal;
    const inp = document.getElementById('gExamDate');
    if(inp) inp.onchange = ()=>{ const g = load(); g.examDate = inp.value; save(g); if(redraw) redraw(); };
  }

  /* ใส่ CSS ครั้งเดียว */
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  /* self-check: id เหรียญ/ภารกิจต้องไม่ซ้ำ ไม่งั้นปลดล็อกเพี้ยน */
  if(new Set(BADGES.map(b=>b.id)).size!==BADGES.length) console.error('badge id ซ้ำ');
  if(new Set(QUESTS.map(q=>q.id)).size!==QUESTS.length) console.error('quest id ซ้ำ');

  return {card, wire, answered, finish, board, level, streak, load, rank, rankTitle, NAGA, grade:gradeOf, setGrade, GLABEL, resetCombo:()=>{combo=0;}, BADGES};
})();
