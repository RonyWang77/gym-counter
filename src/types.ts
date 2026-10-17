export type PageKey = 'home' | 'records' | 'cards' | 'users';

export type User = {
  id: string;
  name: string;
  joinedAt: string;
  note?: string;
  color: string;
  active: boolean;
};

export type GymCard = {
  id: string;
  name: string;
  total: number;
  startDate: string;
  endDate?: string;
  note?: string;
  status: 'active' | 'completed' | 'ended';
};

export type CheckInRecord = {
  id: string;
  cardId: string;
  userId: string;
  date: string;
  time: string;
  note?: string;
};

export type Workspace = {
  id: string;
  shareId: string;
  name: string;
};

export type AppData = {
  workspace: Workspace;
  users: User[];
  cards: GymCard[];
  records: CheckInRecord[];
};

export type NewCardForm = {
  name: string;
  total: string;
  startDate: string;
  endDate: string;
  note: string;
};

export type NewUserForm = {
  name: string;
  joinedAt: string;
  note: string;
};

export type NewWorkspaceForm = {
  name: string;
};
