import type { AppData, NewCardForm, NewUserForm, NewWorkspaceForm } from './types';

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || '请求失败，请稍后重试。';
    throw new Error(message);
  }

  return data as T;
}

export function createWorkspace(form: NewWorkspaceForm) {
  return request<AppData>('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export function getWorkspace(shareId: string) {
  return request<AppData>(`/api/workspaces/${encodeURIComponent(shareId)}`);
}

export function addUser(shareId: string, form: NewUserForm) {
  return request<AppData>(`/api/workspaces/${encodeURIComponent(shareId)}/users`, {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export function updateUser(shareId: string, userId: string, patch: { name?: string; active?: boolean }) {
  return request<AppData>(`/api/workspaces/${encodeURIComponent(shareId)}/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function addCard(shareId: string, form: NewCardForm) {
  return request<AppData>(`/api/workspaces/${encodeURIComponent(shareId)}/cards`, {
    method: 'POST',
    body: JSON.stringify(form),
  });
}

export function endCard(shareId: string, cardId: string) {
  return request<AppData>(`/api/workspaces/${encodeURIComponent(shareId)}/cards/${encodeURIComponent(cardId)}/end`, {
    method: 'PATCH',
  });
}

export function addCheckIn(
  shareId: string,
  payload: { cardId: string; userId: string; date: string; time?: string; note?: string },
) {
  return request<AppData>(`/api/workspaces/${encodeURIComponent(shareId)}/check-ins`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function undoCheckIn(shareId: string, recordId: string) {
  return request<AppData>(`/api/workspaces/${encodeURIComponent(shareId)}/check-ins/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  });
}
