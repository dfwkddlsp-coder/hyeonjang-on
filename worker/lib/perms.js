// 권한 설정 (설정 → 권한): 운영자가 앱에서 역할마다 켜고 끄는 세부 권한. 처음 값 = 예전 고정 규칙과 같음.
// 운영자(admin)는 언제나 전부 (실수로 꺼서 갇히지 않게). 저장 위치: 공유 설정 문서(settings/shared)의 perms
//   perms = { '권한키': { manager: true, user: false, driver: false, guest: false }, … }  (없는 칸은 처음 값)
//   perms._users = { 사용자id: { '권한키': true|false } }  — 사람별 예외 (사용자 관리에서 사람을 눌러 설정, 없으면 역할대로)
import { fail } from './http.js';
import { requireUser } from './session.js';

export const PERM_ROLES = ['manager', 'user', 'driver', 'guest'];
const M = 'manager', U = 'user', D = 'driver', G = 'guest';
/** [키, 묶음, 이름, 처음에 켜진 역할, 설명(선택)] */
export const PERMS = [
  ['strike.view', '삼진아웃', '보기', [M, U]],
  ['strike.add', '삼진아웃', '적발 등록', [M, U]],
  ['strike.edu', '삼진아웃', '2차 교육 이수 처리', [M, U]],
  ['alc.view', '음주측정', '보기', [M, U]],
  ['alc.add', '음주측정', '측정 등록·재측정', [M, U]],
  ['workers.view', '근로자 대장', '보기', [M, U]],
  ['workers.edit', '근로자 대장', '직접 추가·수정', [M, U]],
  ['equip.view', '장비 대장', '모든 장비 보기', [M, U], '끄면 본인 장비(운전원 연락처·직접 추가)만 보임'],
  ['equip.add', '장비 대장', '장비 추가·수정', [M, U, G]],
  ['equip.del', '장비 대장', '남이 추가한 장비 삭제', [M]],
  ['vuln.view', '취약근로자', '보기·등록·상담 (건강정보)', [M]],
  ['eq.mgr', '장비점검', '관리자 점검 하기', [M, U]],
  ['eq.drv', '장비점검', '운전원 점검 하기', [D, G]],
  ['eq.other', '장비점검', '다른 쪽 점검 보기', [M, U], '관리자 쪽은 운전원 점검을, 운전원 쪽은 관리자 점검을 봄'],
  ['records.view', '카테고리 기록', '문서함·사진대지·점검표 보기·작성', [M, U]],
  ['records.staff', '카테고리 기록', '"운영자·관리자만" 항목 보기·작성', [M]],
  ['file.excel', '파일', '대장 엑셀 올리기', [M]],
  ['file.pdf', '파일', 'PDF 문서 올리기·순서 바꾸기', [M]],
  ['print', '출력', '확인서·점검표·사진대지 출력', [M, U]],
  ['qr.guest', '출입·초대', '임시 출입 QR 띄우기', [M]],
  ['qr.invite', '출입·초대', '초대 QR 보기·공유', [M]],
  ['join.approve', '출입·초대', '가입 신청 승인', []],
  ['del.own', '삭제·무효', '본인 글 삭제', [M, U, D, G]],
  ['del.any', '삭제·무효', '남의 글 삭제', []],
  ['void', '삭제·무효', '무효 처리 (삼진아웃·음주)', []],
  ['push', '알림·의견', '폰 알림 받기', [M]],
  ['feedback.view', '알림·의견', '받은 의견 보기', []],
  ['set.site', '설정', '현장·기준', []],
  ['set.forms', '설정', '카테고리·양식·홈 배치', []],
  ['set.eqform', '설정', '장비 양식', []],
  ['set.excel', '설정', '엑셀 칸 이름', []],
  ['set.guide', '설정', '안내 봇', []],
  ['set.users', '설정', '사용자 관리 (운영자 계정은 못 건드림)', []],
  ['set.records', '설정', '기록·보고', []],
  ['set.data', '설정', '데이터·백업', []],
  ['set.perms', '설정', '권한 설정', [], '켜면 그 사람이 스스로 권한을 늘릴 수 있음'],
];
export const PERM_KEYS = new Set(PERMS.map((p) => p[0]));

/** 공유 설정의 어느 칸을 바꾸려면 어떤 권한이 필요한가 (settings/shared 쓰기 검사) */
export const SETTING_GROUPS = {
  'set.site': ['site', 'periodMonths', 'vtypes', 'levels', 'alcMode', 'alc', 'alcMsg', 'vulnAge', 'bp'],
  'set.forms': ['docCats', 'forms', 'homeLayout'],
  'set.eqform': ['eqItems', 'eqCheckItems', 'eqForms', 'eqExclude'],
  'set.excel': ['colAlias'],
  'set.guide': ['guide'],
  'set.users': ['joinOpen'],
  'set.perms': ['perms'],
};

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
/** 저장된 perms를 정리: 아는 키·역할만, 없으면 처음 값 */
export function permTable(saved) {
  const out = {};
  for (const [k, , , def] of PERMS) {
    const s = saved && saved[k];
    out[k] = Object.fromEntries(PERM_ROLES.map((r) => [r, s && typeof s[r] === 'boolean' ? s[r] : def.includes(r)]));
  }
  out._users = userOverrides(saved);
  return out;
}
/** 사람별 예외 정리: 아는 권한키 + true/false만 */
export function userOverrides(saved) {
  const out = {};
  for (const [id, o] of Object.entries((saved && saved._users) || {})) {
    const c = Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => PERM_KEYS.has(k) && typeof v === 'boolean'));
    if (Object.keys(c).length) out[id] = c;
  }
  return out;
}
async function savedPerms(env) {
  const r = await env.DB.prepare("SELECT data FROM docs WHERE store='settings' AND id='shared' AND deleted=0").first();
  return (parse(r && r.data) || {}).perms || null;
}
/** 지금 저장된 권한 표 (여러 사람을 볼 때 한 번만 읽어서 permsOf에 넘김) */
export const loadPermTable = async (env) => permTable(await savedPerms(env));
/** 이 사람의 권한 목록 (Set). 요청 하나에서 여러 번 불러도 한 번만 읽음 */
export async function permsOf(env, u, table) {
  if (u._perms) return u._perms;
  let set;
  if (u.role === 'admin') set = new Set(PERM_KEYS);
  else { const t = table || (await loadPermTable(env)); set = new Set(PERMS.map((p) => p[0]).filter((k) => t[k][u.role]));
    for (const [k, on] of Object.entries(t._users[u.id] || {})) on ? set.add(k) : set.delete(k); }
  Object.defineProperty(u, '_perms', { value: set, enumerable: false });
  return set;
}
export const can = async (env, u, p) => (await permsOf(env, u)).has(p);
/** 로그인한 사람 + 권한 하나 */
export async function requirePerm(req, env, p, msg) {
  const u = await requireUser(req, env);
  if (!(await can(env, u, p))) fail(403, msg || '권한이 없습니다 (설정 → 권한에서 운영자가 정함)');
  return u;
}
