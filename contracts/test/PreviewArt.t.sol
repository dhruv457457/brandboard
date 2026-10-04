// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PatchedMarket} from "../src/PatchedMarket.sol";
import {BaseTest} from "./Base.t.sol";

/// Writes sample cards to contracts/out-art/ so the on-chain art can be looked at (and compared with the website's
/// card). Does nothing unless PREVIEW_ART=true:  PREVIEW_ART=true forge test --match-contract PreviewArt
contract PreviewArt is BaseTest {
    address internal dave = makeAddr("dave");
    address internal erin = makeAddr("erin");

    function _name(address who, bytes32 name) internal {
        vm.prank(who);
        market.setBrandName(name);
    }

    function _dump(string memory file, uint256 id, uint8 patchId) internal {
        vm.writeFile(string.concat("./out-art/", file, ".svg"), renderer.image(market, market.tokenIdOf(id, patchId)));
    }

    function _listing(PatchedMarket.Surface surface, uint256 patches, uint16[] memory bps)
        internal
        returns (uint256 id)
    {
        PatchedMarket.ListingParams memory p = _params(patches, bps);
        p.surface = surface;
        vm.prank(creator);
        id = market.createListing(p);
        vm.prank(admin);
        market.approveListing(id);
    }

    function test_preview() public {
        if (!vm.envOr("PREVIEW_ART", false)) return;
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? dave : erin;
            usdc.mint(who, 100_000e6);
            vm.prank(who);
            usdc.approve(address(market), type(uint256).max);
        }
        _name(creator, "mira");
        _name(alice, "Monad");
        _name(bob, "Privy");
        _name(carol, "Pendle");
        _name(dave, "Phantom");
        _name(erin, "Kuru");

        uint16[] memory three = new uint16[](3);
        three[0] = 3000;
        three[1] = 3000;
        three[2] = 4000;

        // Outfit, five shapes, then the full life of patch 0.
        uint256 a = _listing(PatchedMarket.Surface.Outfit, 5, three);
        _bid(alice, a, 0, 420e6);
        _bid(bob, a, 1, 450e6);
        _bid(carol, a, 2, 150e6);
        _bid(dave, a, 3, 300e6);
        _bid(erin, a, 4, 120e6);
        vm.warp(biddingEnd);
        market.closeBidding(a);
        for (uint8 i; i < 5; ++i) _dump(string.concat("won-shape", vm.toString(i)), a, i);

        _submit(a, 0);
        _dump("printed", a, 0);
        vm.warp(biddingEnd + 4 days);
        market.release(a, 0);
        _submit(a, 1);
        _dump("seen-1-of-2", a, 0);
        vm.warp(biddingEnd + 8 days);
        market.release(a, 1);
        _submit(a, 2);
        _dump("seen-2-of-2", a, 0);
        vm.warp(biddingEnd + 12 days);
        market.release(a, 2);
        _dump("delivered", a, 0);

        // Car, a long name, gold thread; refunded.
        biddingEnd = uint40(vm.getBlockTimestamp() + 2 days);
        PatchedMarket.ListingParams memory p = _params(2, three);
        p.surface = PatchedMarket.Surface.Car;
        p.floors[0] = 1_000e6;
        p.buyNows[0] = 5_000e6;
        vm.prank(creator);
        uint256 b = market.createListing(p);
        vm.prank(admin);
        market.approveListing(b);
        _name(alice, "Patched Test Brand Studio");
        _bid(alice, b, 0, 1_250e6);
        _bid(bob, b, 1, 200e6);
        vm.warp(biddingEnd);
        market.closeBidding(b);
        _dump("won-car-gold", b, 0);
        vm.warp(biddingEnd + 9 days);
        market.markFailed(b);
        _dump("refunded-car", b, 0);

        // Hoodie, disputed.
        biddingEnd = uint40(vm.getBlockTimestamp() + 2 days);
        uint256 c = _listing(PatchedMarket.Surface.Hoodie, 2, three);
        _bid(bob, c, 0, 200e6);
        vm.warp(biddingEnd);
        market.closeBidding(c);
        _submit(c, 0);
        vm.prank(bob);
        market.dispute(c, 0, 0, "ipfs://why");
        _dump("disputed-hoodie", c, 0);

        vm.writeFile("./out-art/token-uri.txt", receipt.tokenURI(market.tokenIdOf(a, 0)));
        vm.writeFile("./out-art/contract-uri.txt", receipt.contractURI());
    }
}
