import z from "zod";

export const message = z.object({
  message: z.string().describe("The message text."),
});

export type Message = z.infer<typeof message>;
