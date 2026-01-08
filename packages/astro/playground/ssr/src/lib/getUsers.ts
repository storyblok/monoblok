import { delay } from './utils';

export async function getUsers() {
  await delay(2000); // Simulate network delay
  const res = await fetch('https://jsonplaceholder.typicode.com/users');
  if (!res.ok) {
    throw new Error('Failed to fetch users');
  }
  const users = await res.json();
  return users;
}
