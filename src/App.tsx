import { FormEvent, useEffect, useMemo, useState } from 'react';
import * as api from './api';
import { getToday } from './mockData';
import { cardStreak } from './businessTime';
import type { AppData, CheckInRecord, GymCard, NewCardForm, NewUserForm, NewWorkspaceForm, PageKey, User } from './types';

const tabs: { key: PageKey; label: string; icon: string }[] = [
  { key: 'home', label: '首页', icon: '⌂' },
  { key: 'records', label: '记录', icon: '▦' },
  { key: 'cards', label: '健身卡', icon: '▭' },
  { key: 'users', label: '用户', icon: '○' },
];

const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${month}月${day}日（周${weekdayNames[weekday]}）`;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function daysInMonth(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

function getMonthDays(month: string) {
  return Array.from({ length: daysInMonth(month) }, (_, index) => {
    const day = `${index + 1}`.padStart(2, '0');
    return `${month}-${day}`;
  });
}

function addMonths(month: string, diff: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthIndex - 1 + diff, 1));
  return `${next.getUTCFullYear()}-${`${next.getUTCMonth() + 1}`.padStart(2, '0')}`;
}

function countByUser(records: CheckInRecord[], userId: string) {
  return records.filter((record) => record.userId === userId).length;
}

function isSameDay(record: CheckInRecord, date: string) {
  return record.date === date;
}

function getUserName(users: User[], userId: string) {
  return users.find((user) => user.id === userId)?.name ?? '未知用户';
}

function getUserColor(users: User[], userId: string) {
  return users.find((user) => user.id === userId)?.color ?? '#9aa4b2';
}

function useCardStats(card: GymCard | undefined, records: CheckInRecord[]) {
  return useMemo(() => {
    if (!card) {
      return { used: 0, remaining: 0, percent: 0 };
    }
    const cardRecords = records.filter((record) => record.cardId === card.id);
    const used = cardRecords.length;
    const remaining = Math.max(card.total - used, 0);
    const percent = Math.min((used / card.total) * 100, 100);
    return { used, remaining, percent };
  }, [card, records]);
}

function App() {
  const [today, setToday] = useState(getToday);
  const [page, setPage] = useState<PageKey>('home');
  const [shareId, setShareId] = useState(() => new URLSearchParams(window.location.search).get('space') ?? '');
  const [appData, setAppData] = useState<AppData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(shareId ? 'loading' : 'idle');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [successRecord, setSuccessRecord] = useState<CheckInRecord | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [checkInDate, setCheckInDate] = useState(today);
  const [checkInNote, setCheckInNote] = useState('');

  useEffect(() => {
    const refreshDay = () => setToday(getToday());
    const timer = window.setInterval(refreshDay, 30000);
    window.addEventListener('focus', refreshDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDay);
    };
  }, []);

  const users = appData?.users ?? [];
  const cards = appData?.cards ?? [];
  const records = appData?.records ?? [];
  const activeCard = cards.find((card) => card.status === 'active');
  const homeCard = activeCard ?? cards[0];
  const currentRecords = records.filter((record) => record.cardId === homeCard?.id);
  const stats = useCardStats(activeCard, records);
  const homeStats = useCardStats(homeCard, records);
  const activeUsers = users.filter((user) => user.active);

  useEffect(() => {
    if (!shareId) return;
    void loadWorkspace(shareId);
  }, [shareId]);

  useEffect(() => {
    if (selectedUserId && activeUsers.some((user) => user.id === selectedUserId)) return;
    setSelectedUserId(activeUsers[0]?.id ?? '');
  }, [activeUsers, selectedUserId]);

  async function loadWorkspace(nextShareId: string) {
    setStatus('loading');
    setError('');
    try {
      const data = await api.getWorkspace(nextShareId);
      setAppData(data);
      setStatus('ready');
    } catch (err) {
      setAppData(null);
      setStatus('error');
      setError(err instanceof Error ? err.message : '共享空间加载失败。');
    }
  }

  async function runMutation(task: () => Promise<AppData>) {
    setIsSaving(true);
    setError('');
    try {
      const data = await task();
      setAppData(data);
      setStatus('ready');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试。');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  async function createSharedWorkspace(form: NewWorkspaceForm) {
    const data = await runMutation(() => api.createWorkspace(form));
    setShareId(data.workspace.shareId);
    window.history.replaceState(null, '', `?space=${data.workspace.shareId}`);
  }

  async function createRecord() {
    if (!activeCard || !selectedUserId || !shareId) return;
    setSuccessRecord(null);
    const beforeIds = new Set(records.map((record) => record.id));
    try {
      const data = await runMutation(() =>
        api.addCheckIn(shareId, {
          cardId: activeCard.id,
          userId: selectedUserId,
          date: checkInDate,
          note: checkInNote.trim() || undefined,
        }),
      );
      const createdRecord = data.records.find((record) => !beforeIds.has(record.id));
      setToday(getToday());
      setCheckInOpen(false);
      setCheckInNote('');
      setSuccessRecord(createdRecord ?? null);
    } catch {
      // The modal stays open and displays the error set by runMutation.
    }
  }

  async function undoRecord(recordId: string) {
    if (!shareId || !window.confirm('确定撤销这次打卡吗？对应的使用次数也会减少 1 次。')) return;
    try {
      await runMutation(() => api.undoCheckIn(shareId, recordId));
    } catch {
      // The existing error banner reports the failed request.
    }
  }

  async function endActiveCard() {
    if (!activeCard || !shareId) return;
    await runMutation(() => api.endCard(shareId, activeCard.id));
  }

  async function addCard(form: NewCardForm) {
    if (!shareId) return;
    await runMutation(() => api.addCard(shareId, form));
  }

  async function addUser(form: NewUserForm) {
    if (!shareId) return;
    await runMutation(() => api.addUser(shareId, form));
  }

  async function renameUser(id: string, name: string) {
    if (!shareId || !name.trim()) return;
    await runMutation(() => api.updateUser(shareId, id, { name: name.trim() }));
  }

  async function toggleUser(id: string, active: boolean) {
    if (!shareId) return;
    await runMutation(() => api.updateUser(shareId, id, { active }));
  }

  if (status === 'idle') {
    return (
      <div className="page-shell">
        <main className="phone-frame">
          <CreateWorkspacePage onCreate={createSharedWorkspace} isSaving={isSaving} error={error} />
        </main>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="page-shell">
        <main className="phone-frame">
          <section className="screen state-screen">
            <AppHeader />
            <section className="panel">
              <h2>正在加载共享空间</h2>
              <p className="muted">正在从云端读取健身卡数据...</p>
            </section>
          </section>
        </main>
      </div>
    );
  }

  if (status === 'error' || !appData) {
    return (
      <div className="page-shell">
        <main className="phone-frame">
          <section className="screen state-screen">
            <AppHeader />
            <section className="panel">
              <h2>共享空间无法打开</h2>
              <p className="muted">{error || '请检查共享链接是否完整。'}</p>
              <button className="primary-button" onClick={() => loadWorkspace(shareId)}>
                重新加载
              </button>
            </section>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <main className="phone-frame">
        {error && <div className="toast-error">{error}</div>}
        {page === 'home' && (
          <HomePage
            activeCard={homeCard}
            records={records}
            users={users}
            stats={homeStats}
            today={today}
            canUse={Boolean(activeCard && activeUsers.length && !isSaving)}
            onUse={() => { setCheckInDate(getToday()); setError(''); setCheckInOpen(true); }}
          />
        )}
        {page === 'records' && (
          <RecordsPage
            users={users}
            cards={cards}
            records={records}
            activeCardId={activeCard?.id}
            today={today}
            isSaving={isSaving}
            onUndo={undoRecord}
          />
        )}
        {page === 'cards' && (
          <CardsPage
            users={users}
            cards={cards}
            records={records}
            activeCard={activeCard}
            stats={stats}
            onEndActiveCard={endActiveCard}
            onAddCard={addCard}
            isSaving={isSaving}
            today={today}
          />
        )}
        {page === 'users' && (
          <UsersPage
            users={users}
            records={currentRecords}
            onAddUser={addUser}
            onRename={renameUser}
            onToggle={(id, nextActive) => toggleUser(id, nextActive)}
            isSaving={isSaving}
            today={today}
          />
        )}
        <BottomNav page={page} onChange={setPage} />
      </main>

      {checkInOpen && activeCard && (
        <CheckInModal
          users={activeUsers}
          selectedUserId={selectedUserId}
          date={checkInDate}
          note={checkInNote}
          onUserChange={setSelectedUserId}
          onDateChange={setCheckInDate}
          onNoteChange={setCheckInNote}
          onClose={() => setCheckInOpen(false)}
          onConfirm={createRecord}
          isSaving={isSaving}
          error={error}
        />
      )}

      {successRecord && (
        <SuccessModal
          userName={getUserName(users, successRecord.userId)}
          onClose={() => setSuccessRecord(null)}
        />
      )}
    </div>
  );
}

function AppHeader() {
  return (
    <header className="app-header">
      <span />
      <h1>健身卡计数器</h1>
      <button className="icon-button" aria-label="设置">⚙</button>
    </header>
  );
}

function CreateWorkspacePage({
  onCreate,
  isSaving,
  error,
}: {
  onCreate: (form: NewWorkspaceForm) => Promise<void>;
  isSaving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<NewWorkspaceForm>({ name: '我的健身卡' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate(form);
  }

  return (
    <section className="screen state-screen">
      <AppHeader />
      <section className="streak-banner soft">
        <div className="mascot happy">✓</div>
        <div>
          <strong>创建一个共享空间</strong>
          <p>创建后会生成链接，发给朋友即可一起记录。</p>
        </div>
      </section>

      <form className="panel form-panel" onSubmit={submit}>
        <h2>开始使用</h2>
        <input
          className="field"
          placeholder="共享空间名称"
          value={form.name}
          onChange={(event) => setForm({ name: event.target.value })}
        />
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button" disabled={isSaving}>
          {isSaving ? '创建中...' : '创建共享空间'}
        </button>
      </form>

      <section className="panel compact">
        <h2>第一版说明</h2>
        <p className="muted">拿到链接的人都可以添加用户、创建健身卡和打卡。请只分享给可信朋友。</p>
      </section>
    </section>
  );
}

function HomePage({
  activeCard,
  records,
  users,
  stats,
  today,
  canUse,
  onUse,
}: {
  activeCard?: GymCard;
  records: CheckInRecord[];
  users: User[];
  stats: { used: number; remaining: number; percent: number };
  today: string;
  canUse: boolean;
  onUse: () => void;
}) {
  const streak = activeCard
    ? cardStreak(records.filter((record) => record.cardId === activeCard.id).map((record) => record.date), today, activeCard.startDate)
    : null;
  const todayRecords = records.filter((record) => activeCard && record.cardId === activeCard.id && isSameDay(record, today));

  return (
    <section className="screen">
      <AppHeader />
      <StreakBanner state={streak} hasCard={Boolean(activeCard)} />

      <section className="panel">
        <div className="panel-title-row">
          <h2>当前健身卡</h2>
          <span className="link-text">{activeCard?.name ?? '暂无卡'} ›</span>
        </div>
        <div className="big-count">
          <strong>{stats.used}</strong>
          <span>/ {activeCard?.total ?? 0}</span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${stats.percent}%` }} />
        </div>
        <p className="muted center">已使用 {stats.used} 次 · 剩余 {stats.remaining} 次</p>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2>今日打卡</h2>
          <span className="muted">{formatDate(today)}</span>
        </div>
        <div className="check-list">
          {users.length === 0 && <p className="muted">还没有用户。请先到“用户”页面添加你和朋友。</p>}
          {users.map((user) => {
            const userToday = todayRecords.filter((record) => record.userId === user.id);
            const latest = userToday.at(-1);
            return (
              <div className="check-row" key={user.id}>
                <span className="avatar-dot" style={{ background: userToday.length ? user.color : '#c8d0da' }} />
                <strong>{user.name}</strong>
                <span className={userToday.length ? 'status-good' : 'muted'}>
                  {latest ? `✓ ${latest.time}${userToday.length > 1 ? ` ×${userToday.length}` : ''}` : '尚未打卡'}
                </span>
              </div>
            );
          })}
        </div>
        {!activeCard && <p className="muted">还没有健身卡。请先到“健身卡”页面添加一张新卡。</p>}
        {activeCard?.status === 'completed' && <p className="muted">这张卡已使用完毕，请到“健身卡”页面创建新卡。</p>}
        <button className="primary-button" onClick={onUse} disabled={!canUse}>
          ＋ 使用一次
        </button>
      </section>
    </section>
  );
}

function StreakBanner({ state, hasCard }: { state: ReturnType<typeof cardStreak> | null; hasCard: boolean }) {
  const streak = state?.streak ?? 0;
  const missed = state?.missed ?? 0;
  let tone = 'cool';
  let title = '今天还没有打卡哦';
  let message = '动一动，让连续记录继续吧！';
  if (!hasCard) {
    title = '今天还没打卡哦';
    message = '动起来吧，更好的自己正在路上！';
  } else if (streak >= 3) {
    tone = 'warm';
    title = `您已连续打卡 ${streak} 天！`;
    message = '太棒了！继续保持，越来越好！';
  } else if (streak === 2) {
    tone = 'warm';
    title = '已经连续 2 天啦！';
    message = '再坚持一天，会有惊喜！';
  } else if (streak === 1) {
    tone = 'warm';
    title = '今天打卡成功！';
    message = '好的开始，坚持一下～';
  } else if (!state?.pendingToday && missed > 0) {
    title = `已有 ${missed} 天未打卡`;
    message = missed === 1 ? '别灰心，从今天重新开始吧！' : missed === 2 ? '动一动，会让心情更好！' : '休息没关系，但别忘了重新出发！';
  }
  return (
    <section className={`streak-banner ${tone}`}>
      <div className={`mascot cat ${tone === 'warm' ? 'happy' : 'sleepy'}`} aria-hidden="true">
        <i className="cat-ear left" /><i className="cat-ear right" />
        <span className="cat-face">{tone === 'warm' ? '˶ᵔ ᵕ ᵔ˶' : '－ ᴥ －'}</span>
      </div>
      <div><strong>{title}</strong><p>{message}</p></div>
      {tone === 'warm' && <span className="banner-spark" aria-hidden="true">✦</span>}
    </section>
  );
}

function RecordsPage({
  users,
  cards,
  records,
  activeCardId,
  today,
  isSaving,
  onUndo,
}: {
  users: User[];
  cards: GymCard[];
  records: CheckInRecord[];
  activeCardId?: string;
  today: string;
  isSaving: boolean;
  onUndo: (recordId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'calendar' | 'table'>('calendar');
  const [month, setMonth] = useState(monthKey(today));
  const [cardId, setCardId] = useState(activeCardId ?? cards[0]?.id ?? '');
  const [selectedDate, setSelectedDate] = useState(today);
  const monthDays = getMonthDays(month);
  const cardRecords = records.filter((record) => record.cardId === cardId && monthKey(record.date) === month);
  const selectedRecords = cardRecords.filter((record) => record.date === selectedDate);

  return (
    <section className="screen">
      <AppHeader />
      <div className="toolbar">
        <button onClick={() => setMode('calendar')} className={mode === 'calendar' ? 'active' : ''}>日历</button>
        <button onClick={() => setMode('table')} className={mode === 'table' ? 'active' : ''}>表格</button>
      </div>

      <div className="month-row">
        <button className="plain-button" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <strong>{month.replace('-', '年')}月</strong>
        <button className="plain-button" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>

      <select className="field" value={cardId} onChange={(event) => setCardId(event.target.value)} disabled={!cards.length}>
        {!cards.length && <option value="">暂无健身卡</option>}
        {cards.map((card) => (
          <option value={card.id} key={card.id}>{card.name}</option>
        ))}
      </select>

      {mode === 'calendar' ? (
        <CalendarView
          users={users}
          month={month}
          days={monthDays}
          records={cardRecords}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      ) : (
        <TableView users={users} days={monthDays} records={cardRecords} />
      )}

      <section className="panel compact">
        <h2>{selectedDate} 记录</h2>
        {selectedRecords.length ? (
          selectedRecords.map((record) => (
            <div className="checkin-entry" key={record.id}>
              <span className="record-dot" style={{ background: getUserColor(users, record.userId) }} />
              <div className="checkin-details">
                <strong>{getUserName(users, record.userId)} · {record.time}</strong>
                <small>备注：{record.note || '无'}</small>
              </div>
              {mode === 'calendar' && (
                <button
                  type="button"
                  className="undo-button"
                  onClick={() => void onUndo(record.id)}
                  disabled={isSaving}
                  aria-label={`撤销 ${getUserName(users, record.userId)} 在 ${record.date} ${record.time} 的打卡`}
                >
                  ↶ 撤销
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="muted">这一天还没有打卡记录。</p>
        )}
      </section>
    </section>
  );
}

function CalendarView({
  users,
  month,
  days,
  records,
  selectedDate,
  onSelect,
}: {
  users: User[];
  month: string;
  days: string[];
  records: CheckInRecord[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthIndex - 1, 1)).getUTCDay();
  return (
    <section className="panel">
      <div className="weekday-grid">
        {weekdayNames.map((name) => <span key={name}>{name}</span>)}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: firstDay }, (_, index) => <span className="empty-day" key={`empty-${index}`} />)}
        {days.map((day) => {
          const dayRecords = records.filter((record) => record.date === day);
          return (
            <button
              className={`calendar-day ${selectedDate === day ? 'selected' : ''}`}
              key={day}
              onClick={() => onSelect(day)}
            >
              <span>{Number(day.slice(-2))}</span>
              <div className="dot-row">
                {[...new Set(dayRecords.map((record) => record.userId))].map((userId) => (
                  <i key={userId} style={{ background: getUserColor(users, userId) }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TableView({ users, days, records }: { users: User[]; days: string[]; records: CheckInRecord[] }) {
  return (
    <section className="panel table-panel">
      <div className="record-table" style={{ gridTemplateColumns: `62px repeat(${Math.max(users.length, 1)}, minmax(90px, 1fr))` }}>
        <div className="table-head">日期</div>
        {users.map((user) => <div className="table-head" key={user.id}>{user.name}</div>)}
        {days.map((day) => (
          <div className="table-row" key={day}>
            <div>{Number(day.slice(-2))}日</div>
            {users.map((user) => {
              const count = records.filter((record) => record.date === day && record.userId === user.id).length;
              return <div key={user.id} className={count ? 'status-good' : 'muted'}>{count ? `✓${count > 1 ? ` ×${count}` : ''}` : '-'}</div>;
            })}
          </div>
        ))}
      </div>
      <div className="summary-row">
        {users.map((user) => (
          <span key={user.id}>
            <i style={{ background: user.color }} /> {user.name}：{countByUser(records, user.id)} 次
          </span>
        ))}
      </div>
    </section>
  );
}

function CardsPage({
  users,
  cards,
  records,
  activeCard,
  stats,
  onEndActiveCard,
  onAddCard,
  isSaving,
  today,
}: {
  users: User[];
  cards: GymCard[];
  records: CheckInRecord[];
  activeCard?: GymCard;
  stats: { used: number; remaining: number; percent: number };
  onEndActiveCard: () => void;
  onAddCard: (form: NewCardForm) => Promise<void>;
  isSaving: boolean;
  today: string;
}) {
  const [form, setForm] = useState<NewCardForm>({
    name: '',
    total: '50',
    startDate: today,
    endDate: '',
    note: '',
  });
  const historyCards = cards.filter((card) => card.status !== 'active');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onAddCard(form);
    setForm({ name: '', total: '50', startDate: today, endDate: '', note: '' });
  }

  return (
    <section className="screen">
      <AppHeader />
      <section className="panel">
        <div className="panel-title-row">
          <h2>当前卡信息</h2>
          <span className={activeCard ? 'pill active' : 'pill'}>{activeCard ? '使用中' : '无当前卡'}</span>
        </div>
        {activeCard ? (
          <>
            <h3>{activeCard.name}</h3>
            <div className="stat-grid">
              <span>总次数<strong>{activeCard.total}</strong></span>
              <span>已使用<strong>{stats.used}</strong></span>
              <span>剩余<strong>{stats.remaining}</strong></span>
            </div>
            <p className="muted">启用日期：{activeCard.startDate}</p>
            <p className="muted">有效期：{activeCard.endDate || '未设置'}</p>
            <button className="danger-button" onClick={onEndActiveCard} disabled={isSaving}>手动结束当前卡</button>
          </>
        ) : (
          <p className="muted">当前没有启用中的健身卡，可以在下方创建新卡。</p>
        )}
      </section>

      <form className="panel form-panel" onSubmit={submit}>
        <h2>添加新卡</h2>
        <input className="field" placeholder="名称，例如：第34张卡" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="field" type="number" placeholder="总次数" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
        <label>启用日期<input className="field" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        <label>有效期（选填）<input className="field" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
        <textarea className="field" placeholder="备注（选填）" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="primary-button" disabled={isSaving}>{isSaving ? '保存中...' : '启用新卡'}</button>
      </form>

      <section className="panel">
        <h2>历史卡</h2>
        {historyCards.map((card) => {
          const cardRecords = records.filter((record) => record.cardId === card.id);
          return (
            <details className="history-card" key={card.id}>
              <summary>
                <strong>{card.name}</strong>
                <span>{card.status === 'completed' ? '已完成' : '提前结束'}</span>
              </summary>
              <p className="muted">{card.startDate} 至 {card.endDate || '未设置'}</p>
              {users.map((user) => (
                <p className="record-line" key={user.id}>
                  <span style={{ background: user.color }} />
                  {user.name} 使用 {countByUser(cardRecords, user.id)} 次
                </p>
              ))}
            </details>
          );
        })}
      </section>
    </section>
  );
}

function UsersPage({
  users,
  records,
  onAddUser,
  onRename,
  onToggle,
  isSaving,
  today,
}: {
  users: User[];
  records: CheckInRecord[];
  onAddUser: (form: NewUserForm) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
  isSaving: boolean;
  today: string;
}) {
  const [form, setForm] = useState<NewUserForm>({ name: '', joinedAt: today, note: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onAddUser(form);
    setForm({ name: '', joinedAt: today, note: '' });
  }

  return (
    <section className="screen">
      <AppHeader />
      <section className="panel">
        <h2>当前用户</h2>
        {users.map((user) => {
          const userRecords = records.filter((record) => record.userId === user.id);
          return (
            <details className="user-card" key={user.id}>
              <summary>
                <span className="avatar-dot" style={{ background: user.color }} />
                <input defaultValue={user.name} onBlur={(event) => onRename(user.id, event.target.value)} />
                <button className={user.active ? 'small-button' : 'small-button muted-button'} onClick={(event) => {
                  event.preventDefault();
                  void onToggle(user.id, !user.active);
                }} disabled={isSaving}>
                  {user.active ? '停用' : '启用'}
                </button>
              </summary>
              <p className="muted">加入日期：{user.joinedAt}</p>
              <p className="muted">当前周期共 {userRecords.length} 次</p>
              {userRecords.map((record) => (
                <div className="record-line user-record" key={record.id}>
                  <span style={{ background: user.color }} />
                  <div>
                    {record.date} · {record.time}
                    <small>备注：{record.note || '无'}</small>
                  </div>
                </div>
              ))}
            </details>
          );
        })}
      </section>

      <form className="panel form-panel" onSubmit={submit}>
        <h2>添加用户</h2>
        <input className="field" placeholder="用户名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label>加入日期<input className="field" type="date" value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} /></label>
        <textarea className="field" placeholder="备注（选填）" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="primary-button" disabled={isSaving}>{isSaving ? '保存中...' : '添加用户'}</button>
      </form>
    </section>
  );
}

function CheckInModal({
  users,
  selectedUserId,
  date,
  note,
  onUserChange,
  onDateChange,
  onNoteChange,
  onClose,
  onConfirm,
  isSaving,
  error,
}: {
  users: User[];
  selectedUserId: string;
  date: string;
  note: string;
  onUserChange: (id: string) => void;
  onDateChange: (date: string) => void;
  onNoteChange: (note: string) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSaving: boolean;
  error: string;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card">
        <h2>使用健身卡</h2>
        <p className="label">选择使用人</p>
        {users.map((user) => (
          <label className="radio-row" key={user.id}>
            <input type="radio" checked={selectedUserId === user.id} onChange={() => onUserChange(user.id)} />
            <span style={{ background: user.color }} />
            {user.name}
          </label>
        ))}
        <label>使用日期<input className="field" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
        <label>备注（可选）<input className="field" placeholder="例如：力量训练" value={note} onChange={(event) => onNoteChange(event.target.value)} /></label>
        {error && <p className="error-text" role="alert">保存失败：{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} disabled={isSaving}>取消</button>
          <button className="primary-button" onClick={onConfirm} disabled={isSaving}>{isSaving ? '保存中...' : '确认'}</button>
        </div>
      </section>
    </div>
  );
}

function SuccessModal({ userName, onClose }: { userName: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 1800);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section className="modal-card success-card">
        <div className="confetti">
          <i /><i /><i /><i /><i /><i />
        </div>
        <div className="flower">
          <span>●</span><span>●</span><span>●</span><span>●</span><b>☺</b>
        </div>
        <h2>打卡成功！</h2>
        <p>{userName} 已使用 1 次</p>
        <p className="muted">坚持就是进步！</p>
        <button className="primary-button" onClick={onClose}>太棒了！</button>
      </section>
    </div>
  );
}

function BottomNav({ page, onChange }: { page: PageKey; onChange: (page: PageKey) => void }) {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button key={tab.key} className={page === tab.key ? 'active' : ''} onClick={() => onChange(tab.key)}>
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default App;
