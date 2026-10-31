export interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Linus" },
];

export async function loadUser(id: number): Promise<User> {
  const user = users.find((candidate) => candidate.id === id);
  if (!user) throw new Error(`user ${id} not found`);
  return user;
}

export async function fetchUserCount(): Promise<number> {
  return users.length;
}

export async function fetchPosts(userId: number): Promise<string[]> {
  return userId === 1 ? ["first", "second"] : [];
}
