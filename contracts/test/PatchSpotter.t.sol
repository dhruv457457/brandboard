// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {PatchSpotter} from "../src/PatchSpotter.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";

contract PatchSpotterTest is BaseTest {
    PatchSpotter internal spotter;
    uint256 internal id;
    address internal dave = makeAddr("dave"); // a spotter
    bytes32 internal constant PHOTO = keccak256("photo");

    event Spotted(
        uint32 indexed eventId,
        uint256 indexed listingId,
        address indexed spotter,
        address creator,
        bytes32 photoHash,
        string photoURI
    );

    function setUp() public override {
        super.setUp();
        spotter = new PatchSpotter(market);
        id = _createActive(2);
    }

    function test_spotRecordsAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit Spotted(0, id, dave, creator, PHOTO, "ipfs://photo");
        vm.prank(dave);
        spotter.spot(id, PHOTO, "ipfs://photo");
        assertTrue(spotter.hasSpotted(dave, id));
        assertEq(spotter.spotCount(id), 1);
        assertEq(spotter.spotsBy(dave), 1);
    }

    function test_manyWalletsCanSpotOneListing() public {
        vm.prank(dave);
        spotter.spot(id, PHOTO, "ipfs://a");
        vm.prank(alice); // a brand spotting a creator is fine
        spotter.spot(id, PHOTO, "ipfs://b");
        assertEq(spotter.spotCount(id), 2);
    }

    function test_oneSpotPerWalletPerListing() public {
        vm.startPrank(dave);
        spotter.spot(id, PHOTO, "ipfs://a");
        vm.expectRevert(PatchSpotter.AlreadySpotted.selector);
        spotter.spot(id, PHOTO, "ipfs://b");
        vm.stopPrank();
        assertEq(spotter.spotsBy(dave), 1);
    }

    function test_sameWalletCanSpotAnotherListing() public {
        uint256 id2 = _createActive(1);
        vm.startPrank(dave);
        spotter.spot(id, PHOTO, "ipfs://a");
        spotter.spot(id2, PHOTO, "ipfs://b");
        vm.stopPrank();
        assertEq(spotter.spotsBy(dave), 2);
    }

    function test_creatorCannotSpotThemselves() public {
        vm.prank(creator);
        vm.expectRevert(PatchSpotter.OwnListing.selector);
        spotter.spot(id, PHOTO, "ipfs://a");
    }

    function test_payeeCannotSpotTheTeam() public {
        PatchedMarket.ListingParams memory p = _params(1, _twoMilestones());
        p.payees = new address[](2);
        p.shares = new uint16[](2);
        (p.payees[0], p.payees[1]) = (creator, dave);
        (p.shares[0], p.shares[1]) = (5000, 5000);
        vm.prank(creator);
        uint256 team = market.createListing(p);
        vm.prank(admin);
        market.approveListing(team);

        vm.prank(dave);
        vm.expectRevert(PatchSpotter.OwnListing.selector);
        spotter.spot(team, PHOTO, "ipfs://a");
    }

    function test_pendingListingIsNotSpottable() public {
        uint256 pending = _create(1);
        vm.prank(dave);
        vm.expectRevert(PatchSpotter.NotSpottable.selector);
        spotter.spot(pending, PHOTO, "ipfs://a");
    }

    function test_unknownListingIsNotSpottable() public {
        vm.prank(dave);
        vm.expectRevert(PatchSpotter.NotSpottable.selector);
        spotter.spot(9999, PHOTO, "ipfs://a");
    }

    function test_spottableWhileDelivering() public {
        uint256 d = _delivering();
        vm.prank(dave);
        spotter.spot(d, PHOTO, "ipfs://a");
        assertEq(spotter.spotCount(d), 1);
    }

    function test_cancelledListingIsNotSpottable() public {
        uint256 c = _createActive(1);
        vm.prank(creator);
        market.cancelListing(c);
        vm.prank(dave);
        vm.expectRevert(PatchSpotter.NotSpottable.selector);
        spotter.spot(c, PHOTO, "ipfs://a");
    }

    function test_badPhotoIsRejected() public {
        vm.startPrank(dave);
        vm.expectRevert(PatchSpotter.BadPhoto.selector);
        spotter.spot(id, bytes32(0), "ipfs://a");
        vm.expectRevert(PatchSpotter.BadPhoto.selector);
        spotter.spot(id, PHOTO, "");
        vm.expectRevert(PatchSpotter.BadPhoto.selector);
        spotter.spot(id, PHOTO, string(new bytes(161)));
        vm.stopPrank();
        assertFalse(spotter.hasSpotted(dave, id), "a rejected spot leaves no trace");
    }

    function testFuzz_countersMatch(uint8 n) public {
        n = uint8(bound(n, 1, 40));
        for (uint256 i; i < n; ++i) {
            vm.prank(address(uint160(0x1000 + i)));
            spotter.spot(id, PHOTO, "ipfs://a");
        }
        assertEq(spotter.spotCount(id), n);
    }
}
