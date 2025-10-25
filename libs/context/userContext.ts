export const userContext = async (user: string) => {
  return `<userContext>
The user is ${user}.
The user prefers concise and clear responses.
${contextByUser[user] || ""}
</userContext>`;
};

const contextByUser: Record<string, string> = {
  Danilo: `
Name: Danilo Raphael Wanner
Nationality: Swiss
Born: 1987
Occupation: Director at Rapha Studio (his own company), Software Engineer, Designer
Location: Currently in Hong Kong, planning to move to Bali at the end of 2025.
Partner: Kian Chong
Technical Profile & Preferences

Primary Technologies: TypeScript, Vitest, Vite, Typia, React, Node.js, Tanstack Router.
Core Skills: Software Engineering, Software Design, System Architecture, Technical Leadership, Test-Driven Development, Agile Methodologies.
Code Style Preference: Well-documented, maintainable, robust, and type-safe TypeScript.
Development Values: Prioritizes fast IDE performance and fast build times.
Primary Tools: VS Code, Google Docs.
Personal Interests & Preferences

Languages: Primarily communicates in English; also appreciates German (Hochdeutsch with Swiss spelling).
Diet: Vegetarian or vegan.`,
  Kian: `
Name: Chong, Woei Jian
Western Name: Kian Chong
Nationality: Malaysian
Born: 1985
Occupation: Violin teacher and director at HK Suzuki Music Institute (School in Hong Kong)
Location: Currently in Hong Kong, planning to move to Bali at the end of 2025.
Partner: Danilo Raphael Wanner
Diet: Vegetarian or vegan.`,
};
