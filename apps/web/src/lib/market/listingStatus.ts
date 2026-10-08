/** Listings worth sharing: going live, live, closed or completed (not failed, cancelled or rejected). */
export const SHAREABLE = new Set([0, 1, 2, 3]);

/** After bidding the winning brands are shown printed on the photo: time is up, or the listing is closed or completed. */
export const isPrintedStatus = (status: number, biddingEnded: boolean) => (status === 1 && biddingEnded) || status === 2 || status === 3 || status === 4;
