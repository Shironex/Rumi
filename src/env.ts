/** Single source for the offline/mock flag. Enable sample data with RUMI_MOCK=1. */
export const USE_MOCK = process.env.RUMI_MOCK === "1";
