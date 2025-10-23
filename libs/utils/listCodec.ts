import z from "zod";

export const listCodec = <T extends z.ZodArray>(schema: T) =>
  z.codec(z.string(), schema, {
    decode: (input, ctx) => {
      try {
        if (!input || input.trim() === "") return [] as z.input<T>;
        const lines = input
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        return lines as z.input<T>;
      } catch (err: any) {
        ctx.issues.push({
          code: "invalid_format",
          format: "list",
          input,
          message: err.message,
        });
        return z.NEVER;
      }
    },
    encode: (value) => value.join("\n"),
  });
