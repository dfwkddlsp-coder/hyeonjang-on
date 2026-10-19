// Who may see and write what. Every permission rule of the API lives here.
// 세부 권한은 운영자가 앱의 설정 → 권한에서 역할마다 켜고 끔 (lib/perms.js, 처음 값 = 예전 규칙).
//
// Roles: admin   운영자 — 언제나 전부
//        manager 관리자 · user 사용자 · driver 장비운전원 · guest 임시 운전원(QR, 자정까지) — 권한 설정을 따름
// 코드로 고정된 것: 운영자는 전부 · 운영자 계정은 운영자만 만들고 고침(routes/users.js) ·
//   '본인 장비' = 운전원 연락처가 로그인 번호와 같거나 직접 추가한 장비
import { fail } from './http.js';
import { SETTING_GROUPS, can, permsOf } from './perms.js';
export { can, permsOf };

export const ROLES = ['admin', 'manager', 'user', 'driver', 'guest'];
/** 장비운전원처럼 본인 장비만 다루는 역할 (세션·화면 모양에만 씀, 권한은 perms) */
export const isDriverLike = (u) => u.role === 'driver' || u.role === 'guest';
export const STORES = new Set(['workers', 'equipment', 'violations', 'alcohol', 'vuln', 'eqchecks', 'plans', 'records', 'settings']);
export const REGISTER_STORES = new Set(['workers', 'equipment', 'vuln']); // replaced wholesale by Excel uploads
const SCOPED_STORES = new Set(['plans', 'records']); // carry scope 'all' | 'staff' (운영자·관리자만)
/** 동기화하지 않는 저장소 (운영자는 각각의 API로 봄) */
const PRIVATE = "'feedback','aiuse','guestinv','pushkey','pushsub','pushpref','joinreq','rejectlog'";
/** 저장소마다 보려면 필요한 권한 */
const VIEW = { violations: 'strike.view', alcohol: 'alc.view', workers: 'workers.view', vuln: 'vuln.view', plans: 'records.view', records: 'records.view' };
const DRV_ID = /^(wkd|wpd)-/; // 운전원 점검 기록 (나머지 wk-·wp-·옛 기록은 관리자 점검)

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
/** 예전 이름 호환: 관리자·운영자 */
export const isStaff = (u) => u.role === 'admin' || u.role === 'manager';
export const vulnAllowed = (env, u) => can(env, u, 'vuln.view');

/* 본인 장비: 직접 추가했거나, 장비 대장의 운전원 연락처 = 로그인 아이디(휴대폰 번호). 연락처가 없는 장비는 이름으로 */
export async function driverEquipIds(env, u) {
  const dg = (s) => String(s || '').replace(/\D/g, ''), nm = (s) => String(s || '').replace(/\s/g, '');
  const loginPhone = /^\d{10,11}$/.test(dg(u.login_id)) ? dg(u.login_id) : '';
  const r = await env.DB.prepare("SELECT id,data,created_by FROM docs WHERE store='equipment' AND deleted=0").all();
  const ids = new Set();
  for (const row of r.results) {
    if (row.created_by === u.id) { ids.add(row.id); continue; }
    if (u.role === 'guest') continue; // 임시 운전원은 직접 추가한 장비만
    const e = parse(row.data);
    if (!e) continue;
    const ph = dg(e.phone);
    if ((ph && loginPhone && ph === loginPhone) || ((!ph || !loginPhone) && nm(e.operator) && nm(e.operator) === nm(u.name))) ids.add(row.id);
  }
  return ids;
}
/** 볼 수 있는 장비: 모든 장비 권한이면 null(전부), 아니면 본인 장비 id 묶음 */
const equipScope = async (env, u, P) => (P.has('equip.view') ? null : driverEquipIds(env, u));
/** 장비 점검 기록 한 쪽(관리자/운전원)을 볼 수 있나 */
const trackVisible = (P, drv) => (drv ? P.has('eq.drv') || P.has('eq.other') : P.has('eq.mgr') || P.has('eq.other'));

/** SQL condition limiting the stores a user's sync may read. */
export async function syncStoreFilter(env, u) {
  const P = await permsOf(env, u);
  const hide = Object.entries(VIEW).filter(([, p]) => !P.has(p)).map(([s]) => `'${s}'`);
  return `AND store NOT IN (${[PRIVATE, ...hide].join(',')}) `;
}

/** Row-level filter on sync results (rows straight from the docs table). */
export async function syncRowFilter(env, u) {
  const P = await permsOf(env, u), mine = await equipScope(env, u, P), staffOk = P.has('records.staff');
  const eqVisible = (id) => !mine || mine.has(id);
  return (d) => {
    if (d.store === 'settings' || d.deleted) return true;
    if (d.store === 'equipment') return eqVisible(d.id);
    if (d.store === 'eqchecks') return trackVisible(P, DRV_ID.test(d.id)) && eqVisible((parse(d.data) || {}).equipId);
    if (SCOPED_STORES.has(d.store)) return staffOk || (parse(d.data) || {}).scope !== 'staff';
    return true;
  };
}

/** Validate a batch write before anything is stored. `docs` = [{store,id,data}], `prev` = Map of stored versions. */
export async function checkWrite(env, u, docs, { replace = [], remove = null, isImport = false, prev = new Map() } = {}) {
  const P = await permsOf(env, u), no = (m) => fail(403, m);
  if ((isImport || replace.length || remove) && !P.has('file.excel')) no('대장 엑셀 업로드 권한이 없습니다');
  for (const s of replace) if (!REGISTER_STORES.has(s)) fail(400, '교체할 수 없는 대장입니다');
  if (remove && (!REGISTER_STORES.has(remove.store) || !Array.isArray(remove.ids) || remove.ids.some((i) => typeof i !== 'string'))) fail(400, '잘못된 요청');
  let mine = null;
  const myEquip = async () => (mine = mine || (await equipScope(env, u, P)) || null);
  for (const d of docs) {
    if (!STORES.has(d.store) || typeof d.id !== 'string' || !d.id || !d.data || typeof d.data !== 'object') fail(400, '잘못된 기록');
    const old = prev.get(d.store + '|' + d.id), isNew = !old;
    switch (d.store) {
      case 'settings': await checkSettings(env, u, P, d, old); break;
      case 'violations': if (isNew && !P.has('strike.add')) no('삼진아웃 적발 등록 권한이 없습니다'); break;
      case 'alcohol': if (isNew && !P.has('alc.add')) no('음주측정 등록 권한이 없습니다'); break;
      case 'workers': if (!P.has('workers.edit') && !(isImport && P.has('file.excel')) && !banOnly(old, d.data, P)) no('근로자 대장 수정 권한이 없습니다'); break;
      case 'vuln': if (!P.has('vuln.view')) no('취약근로자 정보를 다룰 권한이 없습니다'); break;
      case 'plans': if (!P.has('file.pdf')) no('PDF 문서를 올릴 권한이 없습니다'); if (d.data.scope === 'staff' && !P.has('records.staff')) no('운영자·관리자만 항목입니다'); break;
      case 'records':
        if (!P.has('records.view')) no('카테고리 기록을 쓸 권한이 없습니다');
        if (d.data.scope === 'staff' && !P.has('records.staff')) no('운영자·관리자만 작성할 수 있는 항목입니다'); break;
      case 'equipment': {
        if (isImport && P.has('file.excel')) break;
        if (!P.has('equip.add')) no('장비를 추가·수정할 권한이 없습니다');
        break; // 남이 추가한 장비 고치기는 checkUpdate에서 (모든 장비 보기 권한이 없으면 본인 것만)
      }
      case 'eqchecks': {
        const drv = DRV_ID.test(d.id);
        if (drv && !P.has('eq.drv')) no('운전원 점검 권한이 없습니다');
        if (!drv && /^(wk|wp)-/.test(d.id) && !P.has('eq.mgr')) no('관리자 점검 권한이 없습니다');
        const m = await myEquip();
        if (m && !m.has(d.data.equipId) && !docs.some((x) => x.store === 'equipment' && x.id === d.data.equipId)) no('본인 장비만 점검할 수 있습니다');
        break;
      }
    }
  }
}
/* 삼진아웃 3차·음주 영구퇴출이 근로자에 '퇴출' 표시만 바꾸는 경우: 근로자 수정 권한 없이도 됨 */
function banOnly(old, data, P) {
  if (!old || !(P.has('strike.add') || P.has('alc.add'))) return false;
  const free = new Set(['banned', 'bannedAt', 'bannedReason', '_by']);
  return [...new Set([...Object.keys(old), ...Object.keys(data)])].every((k) => free.has(k) || JSON.stringify(old[k]) === JSON.stringify(data[k]));
}
/* 공유 설정: 바뀐 칸마다 그 묶음의 설정 권한이 있어야 함 (perms는 권한 설정 권한) */
async function checkSettings(env, u, P, d, old) {
  if (u.role === 'admin') return;

  const groupOf = Object.fromEntries(Object.entries(SETTING_GROUPS).flatMap(([p, keys]) => keys.map((k) => [k, p])));
  for (const k of new Set([...Object.keys(old || {}), ...Object.keys(d.data)])) {
    if (k === 'id' || k === '_by' || JSON.stringify((old || {})[k]) === JSON.stringify(d.data[k])) continue;
    const need = groupOf[k];
    if (!need || !P.has(need)) fail(403, '이 설정을 바꿀 권한이 없습니다');
  }
  // 권한 설정을 받은 사람도 자기 개별 권한은 못 바꿈 (운영자만)
  const mine = (x) => JSON.stringify(((x && x.perms && x.perms._users) || {})[u.id] || {});
  if (mine(old) !== mine(d.data)) fail(403, '자기 권한은 바꿀 수 없습니다');
}

/* 적발·음주·카테고리 기록은 쓴 사람(과 운영자)만 고침. 다른 사람이 바꿔도 되는 칸:
   2차 교육 이수(edu), 음주 재측정 결과(follow), 음주→삼진아웃 연결(linkedViolation) */
const OWN_STORES = new Set(['violations', 'alcohol', 'records']);
const SHARED_FIELDS = { violations: ['edu'], alcohol: ['follow', 'linkedViolation'] };

/** Per-document rules that need the stored previous version (`old`, null if new or deleted; `oldBy` = its writer's id; P = 권한). */
export function checkUpdate(u, d, old, oldBy, P) {
  const no = (m) => fail(403, m), changed = (k) => JSON.stringify((old || {})[k]) !== JSON.stringify(d.data[k]);
  if (u.role !== 'admin' && old && oldBy && oldBy !== u.id && OWN_STORES.has(d.store)) {
    const free = new Set(['_by', 'void', ...(SHARED_FIELDS[d.store] || [])]);
    for (const k of new Set([...Object.keys(old), ...Object.keys(d.data)]))
      if (!free.has(k) && changed(k)) no('본인이 작성한 기록만 수정할 수 있습니다');
  }
  if (d.store === 'violations' && old && changed('edu') && !P.has('strike.edu')) no('2차 교육 이수 처리 권한이 없습니다');
  if ((d.store === 'violations' || d.store === 'alcohol') && !!(old && old.void) !== !!d.data.void && !P.has('void')) no('무효 처리 권한이 없습니다');
  if (d.store === 'eqchecks' && old && old.equipId !== d.data.equipId && u.role !== 'admin') no('본인 장비만 점검할 수 있습니다');
  if (d.store === 'equipment' && old && oldBy !== u.id && !P.has('equip.view')) no('본인이 추가한 장비만 고칠 수 있습니다');
}

/** May this user open the uploaded PDF? */
export async function checkFileAccess(env, u, fileId) {
  const P = await permsOf(env, u);
  if (!P.has('records.view')) fail(403, '열람 권한이 없습니다');
  if (P.has('records.staff')) return;
  const r = await env.DB.prepare("SELECT 1 FROM docs WHERE store='plans' AND deleted=0 AND json_extract(data,'$.fileId')=? AND json_extract(data,'$.scope')='staff'").bind(fileId).first();
  if (r) fail(403, '열람 권한이 없습니다');
}
