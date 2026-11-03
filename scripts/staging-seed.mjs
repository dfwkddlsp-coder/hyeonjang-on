// 시험용 사이트에 가짜 근로자·장비를 넣는다 (docs/GENERALIZATION.md 0단계). 실제 현장 데이터는 없음.
//   set STAGE_ADMIN_ID=... & set STAGE_ADMIN_PW=... & node scripts/staging-seed.mjs            (시험용 사이트)
//   STAGE_BASE=http://localhost:8787 로 로컬 npm run dev 에도 넣을 수 있다.
// 고정 id(seed-…)라 다시 실행해도 늘어나지 않고 같은 기록을 덮어쓴다.
const BASE = process.env.STAGE_BASE || 'https://hyeonjang-on-staging.lj2.workers.dev';
if (!/^(http:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https:\/\/hyeonjang-on-staging\.lj2\.workers\.dev)$/.test(BASE))
  throw new Error('시험용 사이트 또는 로컬만 가능합니다: ' + BASE);
const ADMIN = { loginId: process.env.STAGE_ADMIN_ID, password: process.env.STAGE_ADMIN_PW };
if (!ADMIN.loginId || !ADMIN.password) throw new Error('STAGE_ADMIN_ID, STAGE_ADMIN_PW (시험용 운영자 계정)을 정하세요');

let cookie = '';
const api = async (path, payload) => {
  const r = await fetch(`${BASE}/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(payload) });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const t = await r.text();
  if (r.status !== 200) throw new Error(`${path} ${r.status}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
};

const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const created = new Date().toISOString().slice(0, 16);
const CO = ['시험건설', '가나토건', '다라설비'];
const JOB = ['형틀목공', '철근공', '배관공', '전기공', '신호수'];
const NAME = ['김시험', '이연습', '박가짜', '최샘플', '정예시', '강테스트', '조모의', '윤시범', '장견본', '임데모'];
const workers = NAME.map((name, i) => ({
  id: `seed-w${String(i + 1).padStart(2, '0')}`, name, company: CO[i % 3], job: JOB[i % 5], gender: i % 4 ? '남' : '여',
  birth: `${1960 + i * 4}-0${(i % 9) + 1}-15`, phone: `010-0000-${String(1000 + i)}`, inDate: day(30 + i),
  elderly: 1960 + i * 4 < 1966 ? 'O' : '', note: '시험용 가짜 데이터', created, src: '시험 데이터',
}));
const EQ = [['굴착기', '서울12가3401'], ['덤프트럭', '인천34나5602'], ['지게차', '경기56다7803'], ['크레인', '부산78라9004'], ['살수차', '대전90마1205']];
const equipment = EQ.map(([type, plate], i) => ({
  id: `seed-e${i + 1}`, no: String(i + 1), type, plate, company: CO[i % 3], operator: `운전${'일이삼사오'[i]}`,
  phone: `010-0000-000${i + 1}`, inDate: day(20 + i), inspect: day(-200 + i * 30), insurance: day(-100 + i * 20),
  manager: '김시험', note: '시험용 가짜 데이터', created, src: '시험 데이터',
}));

await api('login', ADMIN);
const docs = [...workers.map((data) => ({ store: 'workers', id: data.id, data })), ...equipment.map((data) => ({ store: 'equipment', id: data.id, data }))];
const r = await api('docs', { docs });
console.log(`${BASE}: 근로자 ${workers.length}명, 장비 ${equipment.length}대 저장 (${(r.saved || []).length}건)`);
console.log('운전원 시험: 사용자 관리에서 장비운전원 계정 아이디를 010-0000-0001 (굴착기 운전일) 로 만들면 그 장비만 보입니다.');
