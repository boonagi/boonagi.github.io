/* เช็คตรรกะ game-core.js ที่กดเทสในเบราว์เซอร์ไม่ได้ (ไฟติดข้ามวัน / เลเวล / ภารกิจ)
   รัน: node test-game.js */
const fs = require('fs'), assert = require('assert');

/* ---- ของปลอมเท่าที่ game-core.js ต้องใช้ ---- */
const mem = new Map();
const localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k,v) => mem.set(k,String(v)) };
const document = { createElement: () => ({ classList:{add(){}}, remove(){} }), head: { appendChild(){} }, body: { appendChild(){} }, getElementById: () => null };
const PROF = { active: 'เทส', list: () => ['เทส','พี่'] };
const esc = s => s;

const src = fs.readFileSync('game-core.js', 'utf8');
const GAME = new Function('PROF','localStorage','document','esc', src + '\n;return GAME;')(PROF, localStorage, document, esc);

const iso = d => d.toLocaleDateString('sv-SE');
const ago = n => { const d = new Date(); d.setDate(d.getDate()-n); return iso(d); };

/* ---- ไฟติด ---- */
assert.strictEqual(GAME.streak([]), 0, 'ไม่เคยทำ = ไฟ 0');
assert.strictEqual(GAME.streak([ago(0)]), 1, 'ทำวันนี้วันเดียว = 1');
assert.strictEqual(GAME.streak([ago(1)]), 1, 'ทำเมื่อวาน วันนี้ยังไม่ทำ = ไฟยังติด 1');
assert.strictEqual(GAME.streak([ago(0),ago(1),ago(2)]), 3, 'ติดกัน 3 วัน = 3');
assert.strictEqual(GAME.streak([ago(0),ago(2),ago(3)]), 3, 'ขาดวันเดียว โล่กันไว้ = ยังนับ 3');
assert.strictEqual(GAME.streak([ago(0),ago(3)]), 1, 'ขาด 2 วัน โล่ไม่พอ = ไฟดับเหลือ 1');
assert.strictEqual(GAME.streak([ago(5),ago(6)]), 0, 'หายไปนาน = 0');

/* ---- เลเวล: XP ที่ต้องใช้ถึงเลเวล n = 50*(n-1)² ---- */
assert.strictEqual(GAME.level(0), 1);
assert.strictEqual(GAME.level(49), 1);
assert.strictEqual(GAME.level(50), 2);
assert.strictEqual(GAME.level(200), 3);
assert.strictEqual(GAME.level(450), 4);
assert.strictEqual(GAME.level(800), 5);

/* ---- ภารกิจทุกแบบต้องเดินหน้าและจ่าย XP ---- */
for (const [ev, times, name] of [['answer',10,'ฝึกครบ N ข้อ'], ['ok',8,'ตอบถูก N ข้อ'], ['combo',10,'ถูกติดกัน'], ['real',1,'ข้อสอบจริง']]) {
  mem.clear();
  for (let i = 0; i < times; i++) {
    if (ev === 'real') GAME.finish({kind:'real', score:20, total:30, year:'2568', improved:0});
    else GAME.answered(ev !== 'answer');            // answer: ตอบผิดก็ต้องนับ
  }
  const g = GAME.load();
  assert.ok(g.xp > 0, name + ': ต้องได้ XP');
  assert.ok(g.quest, name + ': ต้องมีภารกิจของวันนี้');
}

/* ---- ตอบผิดต้องยังได้ XP (ให้รางวัลความพยายาม) ---- */
mem.clear(); GAME.resetCombo(); GAME.answered(false);
assert.strictEqual(GAME.load().xp, 10, 'ตอบผิดต้องได้ 10 XP');

/* ---- ตารางในบ้าน: เรียงตาม XP มากไปน้อย ---- */
mem.clear();
mem.set('tedet-game:เทส', JSON.stringify({xp:100}));
mem.set('tedet-game:พี่',  JSON.stringify({xp:900}));
assert.deepStrictEqual(GAME.board().map(r => r.name), ['พี่','เทส'], 'ต้องเรียง XP มากขึ้นก่อน');

/* ---- เหรียญ id ห้ามซ้ำ ---- */
assert.strictEqual(new Set(GAME.BADGES.map(b => b.id)).size, GAME.BADGES.length);

console.log('ผ่านหมด ✔  (ไฟติด/โล่, เลเวล, ภารกิจ 4 แบบ, XP ตอบผิด, ตารางในบ้าน, เหรียญ)');
