/** Single source for the offline/mock flag. Enable sample data with RUMI_MOCK=1. */
export const USE_MOCK = process.env.RUMI_MOCK === "1";

/** Frozen "now" for mock runs, so "updated" labels read the same on every run. */
export const MOCK_NOW = Date.parse("2026-01-15T12:00:00.000Z");
