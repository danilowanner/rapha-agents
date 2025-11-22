import { JSDOM } from "jsdom";
import { getUserChatId } from "../libs/context/getUserChatId.ts";
import { telegramBot } from "../libs/utils/telegram.ts";

const TD_URL =
  "https://abs2.td.gov.hk/tdab2/tdabs_external/AdminServlet_english?cmd=cmdGetOfficeBookingStatusAction&serviceTypeCode=DI&storedAppointmentExpiryDate=11-11-1901&enablePick=Y";

const daniloId = getUserChatId("Danilo");

let lastAvailableDate: string | null = null;

export async function transportDepartmentCheckHandler(): Promise<void> {
  try {
    const response = await fetch(TD_URL);
    if (!response.ok) {
      console.error(`Failed to fetch TD website: ${response.status}`);
      return;
    }

    const html = await response.text();
    const availabilityInfo = parseAvailability(html);

    if (!availabilityInfo) {
      console.warn("No availability data found");
      return;
    }

    const { hasAvailableSlots, latestDate, slotsOnLatestDate, totalDates, availableDates, unavailableDates } =
      availabilityInfo;

    if (availableDates + unavailableDates !== totalDates) {
      console.error(
        `Sanity check failed: Available (${availableDates}) + Unavailable (${unavailableDates}) != Total (${totalDates})`
      );
    }

    if (totalDates < 20) {
      console.error(`Sanity check failed: Total dates (${totalDates}) is below threshold of 20`);
    }

    const dateChanged = lastAvailableDate !== latestDate;

    if (dateChanged) {
      lastAvailableDate = latestDate;
      if (slotsOnLatestDate)
        await notifyDanilo(`🚗 Transport Department Update!\n\n` + `✅ New date opened with slots: ${latestDate}`);
    } else if (hasAvailableSlots) {
      await notifyDanilo(`🚗 Transport Department slots available!\n\n` + `✅ Slots found on one or more dates`);
    }

    console.log(`TD check complete - Available: ${hasAvailableSlots}, Latest: ${latestDate}`);
  } catch (error) {
    console.error("Error checking transport department:", error);
  }
}

type AvailabilityInfo = {
  hasAvailableSlots: boolean;
  latestDate: string;
  slotsOnLatestDate: boolean;
  totalDates: number;
  availableDates: number;
  unavailableDates: number;
};

const parseAvailability = (html: string): AvailabilityInfo | null => {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const dateCells = Array.from(
    document.querySelectorAll('td[rowspan="2"].tbleCopy[style*="background-color: #ffebac"]')
  );

  if (dateCells.length === 0) return null;

  let hasAvailableSlots = false;
  let availableDates = 0;
  let totalTicks = 0;
  let totalCrosses = 0;
  let slotsOnLatestDate = false;

  for (let i = 0; i < dateCells.length; i++) {
    const dateCell = dateCells[i];
    const row = dateCell.parentElement;
    if (!row) continue;

    const tickImages = row.querySelectorAll('img[src*="tick.gif"]');
    const crossImages = row.querySelectorAll('img[src*="cross.gif"]');
    const hasTickInRow = tickImages.length > 0;

    totalTicks += tickImages.length;
    totalCrosses += crossImages.length;

    if (hasTickInRow) {
      hasAvailableSlots = true;
      availableDates++;
    }

    if (i === dateCells.length - 1) {
      slotsOnLatestDate = hasTickInRow;
    }
  }

  const lastDateCell = dateCells[dateCells.length - 1];
  const latestDate = lastDateCell?.textContent?.trim();

  if (!latestDate) {
    console.error("Failed to parse latest date");
    return null;
  }

  const totalDates = dateCells.length;
  const unavailableDates = totalDates - availableDates;

  return {
    hasAvailableSlots,
    latestDate,
    slotsOnLatestDate,
    totalDates,
    availableDates,
    unavailableDates,
  };
};

const notifyDanilo = async (message: string): Promise<void> => {
  if (!daniloId) return console.error("Danilo's chat ID not found");

  try {
    await telegramBot.api.sendMessage(daniloId, message);
    console.log("Notification sent to Danilo");
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
};
