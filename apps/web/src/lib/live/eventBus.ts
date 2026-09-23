type EventCallback<T = unknown> = (data: T) => void;

export interface BidPlacedEvent {
  listingId: string;
  patchId: string | number;
  patchLabel: string;
  bidder: string;
  brandName: string;
  amount: bigint;
  prevBidder?: string;
  prevAmount?: bigint;
  isBuyNow?: boolean;
  color?: string;
  logo?: string | null;
  timestamp: number;
}

export interface PatchBoughtEvent {
  listingId: string;
  patchId: string | number;
  patchLabel: string;
  buyer: string;
  brandName: string;
  amount: bigint;
  timestamp: number;
}

export interface BiddingExtendedEvent {
  listingId: string;
  newEndsAt: number;
}

export interface OutbidEvent {
  listingId: string;
  patchId: string | number;
  patchLabel: string;
  minNextBid: bigint;
  outbidBy: string;
}

export interface AuctionEventMap {
  BidPlaced: BidPlacedEvent;
  PatchBought: PatchBoughtEvent;
  BiddingExtended: BiddingExtendedEvent;
  Outbid: OutbidEvent;
}

class EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<string, Set<(data: any) => void>>();

  on<K extends keyof AuctionEventMap>(
    event: K,
    callback: EventCallback<AuctionEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof AuctionEventMap>(
    event: K,
    callback: EventCallback<AuctionEventMap[K]>
  ) {
    this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof AuctionEventMap>(event: K, data: AuctionEventMap[K]) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    });
  }
}

export const auctionEventBus = new EventBus();
