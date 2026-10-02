export interface SpottedPost {
  id: string;
  photo: string;
  caption: string | null;
  createdAt: string;
  listingId: number | null;
  eventId: number | null;
  creator: string | null;
  reactions: { counts: Record<"flame" | "zap" | "heart", number>; mine: ("flame" | "zap" | "heart")[] };
  author: { name: string; handle: string | null; avatar: string | null; wallet: string | null };
}
