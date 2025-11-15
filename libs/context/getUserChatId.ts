export function getUserChatId(user: string): string | undefined {
  switch (user) {
    case "Danilo":
      return "30318273";
    case "Kian":
      return "926261094";
    default:
      return undefined;
  }
}
