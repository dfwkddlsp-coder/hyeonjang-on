// 설정 → 권한 화면용: 권한 목록·역할·지금 표. 저장은 공유 설정(perms)으로 (lib/policy.js checkSettings가 set.perms 확인)
import { json } from '../lib/http.js';
import { requirePerm, PERMS, PERM_ROLES, loadPermTable } from '../lib/perms.js';

// GET /api/perms → {defs:[{k,group,label,note,def:[역할]}], roles, table}
async function get({ req, env }) {
  await requirePerm(req, env, 'set.perms', '권한 설정 권한이 없습니다');
  return json({
    defs: PERMS.map(([k, group, label, def, note]) => ({ k, group, label, def, note: note || '' })),
    roles: PERM_ROLES,
    table: await loadPermTable(env),
  });
}

export default [['GET', '/api/perms', get]];
