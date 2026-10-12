// Who may see and write what. Every permission rule of the API lives here.
//
// Roles: admin   운영자 — everything: settings, users, deletes, voids, backups
//        manager 관리자 — sees and records everything incl. 취약근로자; uploads files (register Excel, PDF);
//                        no settings, users, deletes or voids
//        user    사용자 — sees and records everything except 취약근로자 (and categories the operator marked staff-only);
//                        photos yes, files (Excel/PDF) no
//        driver  장비운전원 — only their own equipment and its checks
//        guest   임시 운전원 — QR로 하루만 들어온 운전원: 본인이 추가한 장비와 그 점검만 (자정에 세션 끝)
import { fail } from './http.js';

export const ROLES = ['admin', 'manager', 'user', 'driver', 'guest'];
/** 장비운전원처럼 본인 장비만 다루는 역할 */
export const isDriverLike = (u) => u.role === 'driver' || u.role === 'guest';
export const STORES = new Set(['workers', 'equipment', 'violations', 'alcohol', 'vuln', 'eqchecks', 'plans', 'records', 'settings']);
export const REGISTER_STORES = new Set(['workers', 'equipment', 'vuln']); // replaced wholesale by Excel uploads
const SCOPED_STORES = new Set(['plans', 'records']); // carry scope 'all' | 'staff' (운영자·관리자만)

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
/** 관리자·운영자: 취약근로자 열람, 파일(대장 엑셀·PDF) 등록 */
export const isStaff = (u) => u.role === 'admin' || u.role === 'manager';

/* 취약근로자(건강정보)는 관리자·운영자만 */
export async function vulnAllowed(env, u) {
  return isStaff(u);
}

/* 장비운전원 본인 장비: 장비 대장의 운전원 연락처 = 로그인 아이디(휴대폰 번호). 연락처가 없는 장비는 이름으로 */
export async function driverEquipIds(env, u) {
  if (u.role === 'guest') // 임시 운전원: 본인이 추가한 장비
    return new Set((await env.DB.prepare("SELECT id FROM docs WHERE store='equipment' AND deleted=0 AND created_by=?").bind(u.id).all()).results.map((r) => r.id));
  const dg = (s) => String(s || '').replace(/\D/g, ''), nm = (s) => String(s || '').replace(/\s/g, '');
  const loginPhone = /^\d{10,11}$/.test(dg(u.login_id)) ? dg(u.login_id) : '';
  const r = await env.DB.prepare("SELECT id,data FROM docs WHERE store='equipment' AND deleted=0").all();
  const ids = new Set();
  for (const row of r.results) {
    const e = parse(row.data);
    if (!e) continue;
    const ph = dg(e.phone);
    if ((ph && loginPhone && ph === loginPhone) || ((!ph || !loginPhone) && nm(e.operator) && nm(e.operator) === nm(u.name))) ids.add(row.id);
  }
  return ids;
}

/** SQL condition limiting the stores a user's sync may read. */
export async function syncStoreFilter(env, u) {
  if (isDriverLike(u)) return "AND store IN ('equipment','eqchecks','settings')";
  return "AND store NOT IN ('feedback','aiuse','guestinv','pushkey','pushsub','pushpref','joinreq') " + ((await vulnAllowed(env, u)) ? '' : "AND store<>'vuln'"); // 의견·AI 사용 횟수는 동기화하지 않음 (운영자는 /api/feedback)
}

/** Row-level filter on sync results (rows straight from the docs table). */
export async function syncRowFilter(env, u) {
  if (isDriverLike(u)) { // 본인 장비와 그 점검 기록만
    const mine = await driverEquipIds(env, u);
    return (d) => {
      if (d.store === 'settings' || d.deleted) return true;
      if (d.store === 'equipment') return mine.has(d.id);
      if (/^(wk|wp)-/.test(d.id)) return false; // 관리자 점검은 운전원 기기로 보내지 않음 (운전원 점검은 wkd-·wpd-)
      return mine.has((parse(d.data) || {}).equipId);
    };
  }
  if (u.role === 'user') // '운영자·관리자만' 문서함·카테고리 기록은 일반 사용자에게 보내지 않음
    return (d) => !SCOPED_STORES.has(d.store) || d.deleted || (parse(d.data) || {}).scope !== 'staff';
  return () => true;
}

/** Validate a batch write before anything is stored. `docs` = [{store,id,data}]. */
export async function checkWrite(env, u, docs, { replace = [], remove = null, isImport = false } = {}) {
  if ((isImport || replace.length || remove) && !isStaff(u)) fail(403, '대장 엑셀 업로드는 관리자·운영자만 할 수 있습니다');
  for (const s of replace) if (!REGISTER_STORES.has(s)) fail(400, '교체할 수 없는 대장입니다');
  if (remove && (!REGISTER_STORES.has(remove.store) || !Array.isArray(remove.ids) || remove.ids.some((i) => typeof i !== 'string'))) fail(400, '잘못된 요청');
  for (const d of docs) {
    if (!STORES.has(d.store) || typeof d.id !== 'string' || !d.id || !d.data || typeof d.data !== 'object') fail(400, '잘못된 기록');
    if (d.store === 'settings' && u.role !== 'admin') fail(403, '현장 설정은 운영자만 바꿀 수 있습니다');
    if (d.store === 'plans' && !isStaff(u)) fail(403, 'PDF 문서는 관리자·운영자만 올릴 수 있습니다');
    if (d.store === 'records' && u.role === 'user' && d.data.scope === 'staff') fail(403, '운영자·관리자만 작성할 수 있는 항목입니다');
  }
  /* 장비 주간 점검은 둘로 따로: 운전원 점검(wkd-·wpd-)은 장비운전원·임시 운전원만, 관리자 점검(그 밖)은 나머지만 */
  for (const d of docs) if (d.store === 'eqchecks' && /^(wkd|wpd)-/.test(d.id) !== isDriverLike(u))
    fail(403, isDriverLike(u) ? '운전원 점검만 할 수 있습니다' : '운전원 점검 기록은 운전원만 쓸 수 있습니다');
  if (docs.some((d) => d.store === 'vuln') && !(await vulnAllowed(env, u)))
    fail(403, '취약근로자 정보는 관리자·운영자만 다룰 수 있습니다');
  if (u.role === 'guest') { // 임시 운전원: 본인 장비 추가 + 그 장비의 점검만 (남의 장비는 checkUpdate에서 막음)
    if (docs.some((d) => d.store !== 'eqchecks' && d.store !== 'equipment')) fail(403, '임시 운전원은 본인 장비 추가와 장비점검만 할 수 있습니다');
    const mine = await driverEquipIds(env, u);
    for (const d of docs) if (d.store === 'equipment') mine.add(d.id);
    if (docs.some((d) => d.store === 'eqchecks' && !mine.has(d.data.equipId))) fail(403, '본인 장비만 점검할 수 있습니다');
  }
  if (u.role === 'driver') { // 장비운전원: 본인 장비의 장비점검만
    if (docs.some((d) => d.store !== 'eqchecks')) fail(403, '장비운전원은 장비점검만 할 수 있습니다');
    const mine = await driverEquipIds(env, u);
    if (docs.some((d) => !mine.has(d.data.equipId))) fail(403, '본인 장비만 점검할 수 있습니다');
  }
}

/* 적발·음주·카테고리 기록은 쓴 사람(과 운영자)만 고침. 다른 사람이 바꿔도 되는 칸:
   2차 교육 이수(edu), 음주 재측정 결과(follow), 음주→삼진아웃 연결(linkedViolation) */
const OWN_STORES = new Set(['violations', 'alcohol', 'records']);
const SHARED_FIELDS = { violations: ['edu'], alcohol: ['follow', 'linkedViolation'] };

/** Per-document rules that need the stored previous version (`old`, null if new or deleted; `oldBy` = its writer's id). */
export function checkUpdate(u, d, old, oldBy) {
  if (u.role !== 'admin' && old && oldBy && oldBy !== u.id && OWN_STORES.has(d.store)) {
    const free = new Set(['_by', ...(SHARED_FIELDS[d.store] || [])]);
    for (const k of new Set([...Object.keys(old), ...Object.keys(d.data)]))
      if (!free.has(k) && JSON.stringify(old[k]) !== JSON.stringify(d.data[k])) fail(403, '본인이 작성한 기록만 수정할 수 있습니다');
  }
  if (isDriverLike(u) && old && old.equipId !== d.data.equipId) fail(403, '본인 장비만 점검할 수 있습니다');
  if (u.role === 'guest' && d.store === 'equipment' && old && oldBy !== u.id) fail(403, '본인이 추가한 장비만 고칠 수 있습니다');
  if (u.role !== 'admin' && (d.store === 'violations' || d.store === 'alcohol') && !!(old && old.void) !== !!d.data.void)
    fail(403, '무효 처리는 운영자만 할 수 있습니다');
}

/** May this user open the uploaded PDF? (driver never; plain users not for 'staff' 문서함) */
export async function checkFileAccess(env, u, fileId) {
  if (isDriverLike(u)) fail(403, '열람 권한이 없습니다');
  if (u.role !== 'user') return;
  const r = await env.DB.prepare("SELECT 1 FROM docs WHERE store='plans' AND deleted=0 AND json_extract(data,'$.fileId')=? AND json_extract(data,'$.scope')='staff'").bind(fileId).first();
  if (r) fail(403, '열람 권한이 없습니다');
}
