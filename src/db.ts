import { JSONFilePreset } from "lowdb/node";
import z from "zod";

type Data = {
  listings: Listing[];
  tasks: Task[];
};

export const listing = z.object({
  title: z.string().describe("The title of the listing."),
  description: z.string().describe("The description of the listing."),
  price: z.number().describe("The price of the listing in HKD."),
});

export const task = z.object({
  url: z.string().describe("The URL of the page to perform the task on."),
  task: z.string().describe("The instructions of the task."),
});

export type Task = z.infer<typeof task>;

export type Listing = z.infer<typeof listing>;

const defaultData: Data = { listings: [], tasks: [] };
const fileDB = await JSONFilePreset<Data>("db.json", defaultData);

export const db = {
  getListings: () => fileDB.data.listings,
  addListings: async (newListings: Listing[]) => fileDB.update(({ listings }) => listings.push(...newListings)),
  getTasks: () => fileDB.data.tasks,
  addTasks: async (newTasks: Task[]) => fileDB.update(({ tasks }) => tasks.push(...newTasks)),
};
