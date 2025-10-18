import z from "zod";

export const listing = z.object({
  title: z.string().describe("The title of the listing."),
  description: z.string().describe("The description of the listing."),
  price: z.number().describe("The price of the listing in HKD."),
});

export type Listing = z.infer<typeof listing>;
