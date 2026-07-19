import { Permission, Role } from "appwrite";

export function privateUserPermissions(userId: string) {
  const role = Role.user(userId);
  return [Permission.read(role), Permission.update(role), Permission.delete(role)];
}
