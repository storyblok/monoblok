import { delay } from './utils';

const users = [
  { id: 1, name: 'John Doe' },
  { id: 2, name: 'Jane Smith' },
  { id: 3, name: 'Alice Johnson' },
  { id: 4, name: 'Bob Brown' },
  { id: 5, name: 'Charlie Davis' },
  { id: 6, name: 'Diana Evans' },
  { id: 7, name: 'Frank Green' },
  { id: 8, name: 'Grace Harris' },
  { id: 9, name: 'Henry Irving' },
  { id: 10, name: 'Ivy Jackson' },
];
export interface User {
  id: number;
  name: string;
}
export async function getUsers() {
  await delay(2000); // Simulate network delay
  return users;
}
