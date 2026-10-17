export const colorPool = [
  '#e84d4f',
  '#2f80ed',
  '#f2c94c',
  '#27ae60',
  '#f2994a',
  '#9b51e0',
  '#00a3a3',
  '#eb5757',
];

import { businessDate } from './businessTime';

export function getToday() {
  return businessDate();
}
