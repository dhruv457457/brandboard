// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PatchedMarket} from "./PatchedMarket.sol";

/// @title PatchSpotter
/// @notice "I saw this creator wearing their patches": a wallet posts a photo of a creator at an event, on-chain.
///         The photo itself lives on IPFS; this contract records who spotted whom, for which listing and event, with
///         the photo's hash, so the Patchwork graph (and anyone else) can read the social side from logs alone.
///         Holds no funds and has no role on the market: it only reads listings.
contract PatchSpotter {
    PatchedMarket public immutable market;

    /// @notice Longest photo URI accepted (an `ipfs://<cid>` is about 60 bytes).
    uint256 public constant MAX_URI = 160;

    /// @dev One spot per wallet per listing keeps the graph honest and spam out.
    mapping(address spotter => mapping(uint256 listingId => bool)) public hasSpotted;
    mapping(uint256 listingId => uint32) public spotCount;
    mapping(address spotter => uint32) public spotsBy;

    event Spotted(
        uint32 indexed eventId,
        uint256 indexed listingId,
        address indexed spotter,
        address creator,
        bytes32 photoHash,
        string photoURI
    );

    error NotSpottable(); // the listing is not Active or Delivering
    error OwnListing(); // the creator or one of their payees can't spot themselves
    error AlreadySpotted();
    error BadPhoto(); // empty hash or URI, or a URI that is too long

    constructor(PatchedMarket market_) {
        market = market_;
    }

    /// @notice Spot the creator of `listingId`. `photoHash` is keccak256 of the photo record's exact bytes
    ///         (the same pattern as `submitProof`), `photoURI` is `ipfs://<record>`.
    function spot(uint256 listingId, bytes32 photoHash, string calldata photoURI) external {
        uint256 len = bytes(photoURI).length;
        if (photoHash == bytes32(0) || len == 0 || len > MAX_URI) revert BadPhoto();
        if (hasSpotted[msg.sender][listingId]) revert AlreadySpotted();

        PatchedMarket.Listing memory l = market.getListing(listingId);
        if (l.status != PatchedMarket.Status.Active && l.status != PatchedMarket.Status.Delivering) revert NotSpottable();
        if (msg.sender == l.creator) revert OwnListing();
        (address[] memory payees,) = market.getPayees(listingId);
        for (uint256 i; i < payees.length; ++i) {
            if (payees[i] == msg.sender) revert OwnListing();
        }

        hasSpotted[msg.sender][listingId] = true;
        unchecked {
            ++spotCount[listingId];
            ++spotsBy[msg.sender];
        }
        emit Spotted(l.eventId, listingId, msg.sender, l.creator, photoHash, photoURI);
    }
}
