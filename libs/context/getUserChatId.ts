type UserContext = {
  name: string;
  chatId: string;
};

const users: readonly UserContext[] = [
  { name: "Danilo", chatId: "30318273" },
  { name: "Kian", chatId: "926261094" },
  { name: "HayNaNi", chatId: "8552481604" },
] as const;

/**
 * Looks up a user by a given field.
 */
export function getUserBy<K extends keyof UserContext>(
  field: K,
  value: UserContext[K],
): UserContext | undefined {
  return users.find((user) => user[field] === value);
}

/**
 * Returns the Telegram chat id for a user name.
 */
export function getUserChatId(user: string): string | undefined {
  return getUserBy("name", user)?.chatId;
}
