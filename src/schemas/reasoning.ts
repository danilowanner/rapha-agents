import z from "zod";

export const reasoning = z.object({
  title: z.string().max(120).describe("The title of the reasoning step (max 120 characters)"),
  details: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      "Detailed internal reasoning or chain-of-thought style notes. Use markdown. WRITE OUT ALL OF YOUR WORK. Remains internal and not exposed to end users."
    ),
});

export type Reasoning = z.infer<typeof reasoning>;
