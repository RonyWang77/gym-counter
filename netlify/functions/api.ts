import type { Config, Context } from '@netlify/functions';

type WorkspaceRow = {
  id: string;
  share_id: string;
  name: string;
  created_at: string;
};

type UserRow = {
  id: string;
  workspace_id: string;
  name: string;
  joined_at: string;
  note: string | null;
  color: string;
  active: boolean;
  created_at: string;
};

type GymCardRow = {
  id: string;
  workspace_id: string;
  name: string;
  total: number;
  start_date: string;
  end_date: string | null;
  note: string | null;
  status: 'active' | 'completed' | 'ended';
  created_at: string;
};

type CheckInRow = {
  id: string;
  workspace_id: string;
  card_id: string;
  user_id: string;
  used_date: string;
  used_time: string;
  note: string | null;
  created_at: string;
};

type AppData = {
  workspace: {
    id: string;
    shareId: string;
    name: string;
  };
  users: Array<{
    id: string;
    name: string;
    joinedAt: string;
    note?: string;
    color: string;
    active: boolean;
  }>;
  cards: Array<{
    id: string;
    name: string;
    total: number;
    startDate: string;
    endDate?: string;
    note?: string;
    status: 'active' | 'completed' | 'ended';
  }>;
  records: Array<{
    id: string;
    cardId: string;
    userId: string;
    date: string;
    time: string;
    note?: string;
  }>;
};

const colorPool = [
  '#e84d4f',
  '#2f80ed',
  '#f2c94c',
  '#27ae60',
  '#f2994a',
  '#9b51e0',
  '#00a3a3',
  '#eb5757',
];

const beijingDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const beijingTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dateInBeijing(instant: Date) {
  const parts = beijingDate.formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function getEnv(name: string) {
  const netlifyEnv = typeof Netlify === 'undefined' ? '' : Netlify.env.get(name);
  const nodeEnv = process.env[name];
  return netlifyEnv || nodeEnv || '';
}

function assertSupabaseEnv() {
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SECRET_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('缺少 Supabase 环境变量：SUPABASE_URL 或 SUPABASE_SECRET_KEY');
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}) {
  const { url, key } = assertSupabaseEnv();
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  if (!key.startsWith('sb_secret_')) {
    headers.set('Authorization', `Bearer ${key}`);
  }
  headers.set('Content-Type', 'application/json');
  if (!headers.has('Prefer')) {
    headers.set('Prefer', 'return=representation');
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase 请求失败：${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function makeShareId() {
  return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().slice(0, 8);
}

function mapWorkspace(row: WorkspaceRow) {
  return {
    id: row.id,
    shareId: row.share_id,
    name: row.name,
  };
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    joinedAt: row.joined_at,
    note: row.note || undefined,
    color: row.color,
    active: row.active,
  };
}

function mapCard(row: GymCardRow) {
  return {
    id: row.id,
    name: row.name,
    total: row.total,
    startDate: row.start_date,
    endDate: row.end_date || undefined,
    note: row.note || undefined,
    status: row.status,
  };
}

function mapRecord(row: CheckInRow) {
  const created = new Date(row.created_at);
  const utcDate = created.toISOString().slice(0, 10);
  const utcTime = created.toISOString().slice(11, 16);
  const wasSavedWithUtcClock = row.used_date === utcDate && row.used_time.slice(0, 5) === utcTime;
  return {
    id: row.id,
    cardId: row.card_id,
    userId: row.user_id,
    date: wasSavedWithUtcClock ? dateInBeijing(created) : row.used_date,
    time: beijingTime.format(created),
    note: row.note || undefined,
  };
}

async function findWorkspace(shareId: string) {
  const rows = await supabaseFetch<WorkspaceRow[]>(
    `workspaces?share_id=eq.${encodeURIComponent(shareId)}&select=*&limit=1`,
    { method: 'GET' },
  );
  return rows[0] ?? null;
}

async function getWorkspaceData(shareId: string): Promise<AppData> {
  const workspace = await findWorkspace(shareId);
  if (!workspace) {
    throw new Response(JSON.stringify({ message: '找不到这个共享空间，请检查链接是否完整。' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const workspaceId = encodeURIComponent(workspace.id);
  const [users, cards, records] = await Promise.all([
    supabaseFetch<UserRow[]>(`users?workspace_id=eq.${workspaceId}&select=*&order=created_at.asc`, { method: 'GET' }),
    supabaseFetch<GymCardRow[]>(`gym_cards?workspace_id=eq.${workspaceId}&select=*&order=created_at.desc`, {
      method: 'GET',
    }),
    supabaseFetch<CheckInRow[]>(`check_ins?workspace_id=eq.${workspaceId}&select=*&order=used_date.asc,used_time.asc`, {
      method: 'GET',
    }),
  ]);

  return {
    workspace: mapWorkspace(workspace),
    users: users.map(mapUser),
    cards: cards.map(mapCard),
    records: records.map(mapRecord),
  };
}

async function createWorkspace(req: Request) {
  const body = await readJson(req);
  const name = cleanText(body.name) || '我的健身卡';
  const shareId = makeShareId();
  const rows = await supabaseFetch<WorkspaceRow[]>('workspaces', {
    method: 'POST',
    body: JSON.stringify({
      share_id: shareId,
      name,
    }),
  });
  return getWorkspaceData(rows[0].share_id);
}

async function addUser(shareId: string, req: Request) {
  const workspace = await requireWorkspace(shareId);
  const body = await readJson(req);
  const name = cleanText(body.name);
  if (!name) return json({ message: '用户名不能为空。' }, 400);

  const existingUsers = await supabaseFetch<UserRow[]>(
    `users?workspace_id=eq.${encodeURIComponent(workspace.id)}&select=id`,
    { method: 'GET' },
  );
  const color = colorPool[existingUsers.length % colorPool.length];

  await supabaseFetch<UserRow[]>('users', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: workspace.id,
      name,
      joined_at: cleanDate(body.joinedAt),
      note: cleanText(body.note) || null,
      color,
      active: true,
    }),
  });

  return getWorkspaceData(shareId);
}

async function updateUser(shareId: string, userId: string, req: Request) {
  const workspace = await requireWorkspace(shareId);
  const body = await readJson(req);
  const patch: Record<string, unknown> = {};
  if ('name' in body) {
    const name = cleanText(body.name);
    if (!name) return json({ message: '用户名不能为空。' }, 400);
    patch.name = name;
  }
  if ('active' in body) {
    patch.active = Boolean(body.active);
  }

  await supabaseFetch<UserRow[]>(
    `users?id=eq.${encodeURIComponent(userId)}&workspace_id=eq.${encodeURIComponent(workspace.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );

  return getWorkspaceData(shareId);
}

async function addCard(shareId: string, req: Request) {
  const workspace = await requireWorkspace(shareId);
  const body = await readJson(req);
  const name = cleanText(body.name);
  const total = Number(body.total);
  if (!name) return json({ message: '健身卡名称不能为空。' }, 400);
  if (!Number.isFinite(total) || total <= 0) return json({ message: '总次数必须大于 0。' }, 400);

  await supabaseFetch<GymCardRow[]>(
    `gym_cards?workspace_id=eq.${encodeURIComponent(workspace.id)}&status=eq.active`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ended' }),
    },
  );

  await supabaseFetch<GymCardRow[]>('gym_cards', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: workspace.id,
      name,
      total,
      start_date: cleanDate(body.startDate),
      end_date: cleanText(body.endDate) || null,
      note: cleanText(body.note) || null,
      status: 'active',
    }),
  });

  return getWorkspaceData(shareId);
}

async function endCard(shareId: string, cardId: string) {
  const workspace = await requireWorkspace(shareId);
  await supabaseFetch<GymCardRow[]>(
    `gym_cards?id=eq.${encodeURIComponent(cardId)}&workspace_id=eq.${encodeURIComponent(workspace.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ended' }),
    },
  );
  return getWorkspaceData(shareId);
}

async function addCheckIn(shareId: string, req: Request) {
  const workspace = await requireWorkspace(shareId);
  const body = await readJson(req);
  const cardId = cleanText(body.cardId);
  const userId = cleanText(body.userId);
  if (!cardId || !userId) return json({ message: '请选择健身卡和用户。' }, 400);

  const [cardRows, userRows] = await Promise.all([
    supabaseFetch<GymCardRow[]>(
      `gym_cards?id=eq.${encodeURIComponent(cardId)}&workspace_id=eq.${encodeURIComponent(workspace.id)}&select=*&limit=1`,
      { method: 'GET' },
    ),
    supabaseFetch<UserRow[]>(
      `users?id=eq.${encodeURIComponent(userId)}&workspace_id=eq.${encodeURIComponent(workspace.id)}&active=eq.true&select=*&limit=1`,
      { method: 'GET' },
    ),
  ]);

  const card = cardRows[0];
  if (!card || card.status !== 'active') return json({ message: '当前健身卡不可打卡。' }, 400);
  if (!userRows[0]) return json({ message: '当前用户不可打卡。' }, 400);

  const existingRecords = await supabaseFetch<CheckInRow[]>(
    `check_ins?card_id=eq.${encodeURIComponent(card.id)}&workspace_id=eq.${encodeURIComponent(workspace.id)}&select=id`,
    { method: 'GET' },
  );

  if (existingRecords.length >= card.total) {
    await markCardCompleted(workspace.id, card.id);
    return json({ message: '这张卡的次数已经用完。' }, 400);
  }

  await supabaseFetch<CheckInRow[]>('check_ins', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: workspace.id,
      card_id: card.id,
      user_id: userId,
      used_date: cleanDate(body.date),
      used_time: beijingTime.format(new Date()) + ':00',
      note: cleanText(body.note) || null,
    }),
  });

  if (existingRecords.length + 1 >= card.total) {
    await markCardCompleted(workspace.id, card.id);
  }

  return getWorkspaceData(shareId);
}

async function undoCheckIn(shareId: string, recordId: string) {
  const workspace = await requireWorkspace(shareId);
  const workspaceId = encodeURIComponent(workspace.id);
  const recordIdFilter = encodeURIComponent(recordId);
  const records = await supabaseFetch<CheckInRow[]>(
    `check_ins?id=eq.${recordIdFilter}&workspace_id=eq.${workspaceId}&select=id,card_id&limit=1`,
    { method: 'GET' },
  );
  if (!records.length) return json({ message: '这条打卡记录不存在或已撤销。' }, 404);

  const deleted = await supabaseFetch<CheckInRow[]>(
    `check_ins?id=eq.${recordIdFilter}&workspace_id=eq.${workspaceId}&select=id`,
    { method: 'DELETE' },
  );
  if (!deleted.length) return json({ message: '这条打卡记录已被其他人撤销，请刷新页面。' }, 404);

  const data = await getWorkspaceData(shareId);
  const card = data.cards.find((item) => item.id === records[0].card_id);
  if (card?.status === 'completed' && data.records.filter((item) => item.cardId === card.id).length < card.total) {
    const nextStatus = data.cards[0]?.id === card.id && !data.cards.some((item) => item.status === 'active')
      ? 'active'
      : 'ended';
    await supabaseFetch<GymCardRow[]>(
      `gym_cards?id=eq.${encodeURIComponent(card.id)}&workspace_id=eq.${workspaceId}`,
      { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) },
    );
    return getWorkspaceData(shareId);
  }
  return data;
}

async function markCardCompleted(workspaceId: string, cardId: string) {
  await supabaseFetch<GymCardRow[]>(
    `gym_cards?id=eq.${encodeURIComponent(cardId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    },
  );
}

async function requireWorkspace(shareId: string) {
  const workspace = await findWorkspace(shareId);
  if (!workspace) {
    throw new Response(JSON.stringify({ message: '找不到这个共享空间，请检查链接是否完整。' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  return workspace;
}

async function readJson(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanDate(value: unknown) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : dateInBeijing(new Date());
}

async function handleRequest(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  if (req.method === 'POST' && parts[0] === 'workspaces' && parts.length === 1) {
    return json(await createWorkspace(req), 201);
  }

  if (parts[0] !== 'workspaces' || !parts[1]) {
    return json({ message: '接口不存在。' }, 404);
  }

  const shareId = parts[1];

  if (req.method === 'GET' && parts.length === 2) {
    return json(await getWorkspaceData(shareId));
  }

  if (req.method === 'POST' && parts[2] === 'users' && parts.length === 3) {
    return json(await addUser(shareId, req), 201);
  }

  if (req.method === 'PATCH' && parts[2] === 'users' && parts[3] && parts.length === 4) {
    return json(await updateUser(shareId, parts[3], req));
  }

  if (req.method === 'POST' && parts[2] === 'cards' && parts.length === 3) {
    return json(await addCard(shareId, req), 201);
  }

  if (req.method === 'PATCH' && parts[2] === 'cards' && parts[3] && parts[4] === 'end') {
    return json(await endCard(shareId, parts[3]));
  }

  if (req.method === 'POST' && parts[2] === 'check-ins' && parts.length === 3) {
    return json(await addCheckIn(shareId, req), 201);
  }

  if (req.method === 'DELETE' && parts[2] === 'check-ins' && parts[3] && parts.length === 4) {
    return json(await undoCheckIn(shareId, parts[3]));
  }

  return json({ message: '接口不存在。' }, 404);
}

export default async (req: Request, _context: Context) => {
  try {
    return await handleRequest(req);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const message = error instanceof Error ? error.message : '服务器发生未知错误。';
    const status = message.includes('缺少 Supabase 环境变量') ? 500 : 400;
    return json({ message }, status);
  }
};

export const config: Config = {
  path: '/api/*',
};
