/** A comment on a listing, as the API returns it. */
export interface ListingComment {
  id: string;
  /** The spot it is about, or null for the listing as a whole. */
  patchId: number | null;
  body: string;
  createdAt: string;
  author: { name: string; handle: string | null; avatar: string | null; wallet: string | null };
  /** Written by the person looking at it (they can remove it). */
  mine: boolean;
}
