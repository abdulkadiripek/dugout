import { fetchPosts, loadUser, fetchUserCount } from "./api.ts";

export async function describeUser(id: number): Promise<string> {
  const user = await loadUser(id);
  const posts = await fetchPosts(id);
  return `${user.name} (${posts.length} posts)`;
}

export async function describeCount(): Promise<string> {
  return `${await fetchUserCount()} users`;
}
