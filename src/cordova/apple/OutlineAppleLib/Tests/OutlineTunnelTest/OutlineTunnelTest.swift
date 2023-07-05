import XCTest

import NetworkExtension

@testable import OutlineTunnel
@testable import PacketTunnelProvider

final class OutlineTunnelTest: XCTestCase {
    
    static let kAppGroup = "outline.spm.tests"
    
    // Example test
    func testTunnelStoreDoesNotLoadBeforeSetup() throws {
        let tunnelStore = OutlineTunnelStore(appGroup: OutlineTunnelTest.kAppGroup)
        XCTAssertNil(tunnelStore.load())
    }
    
    func testSelectVpnAddress() {
        XCTAssertEqual("10.111.222.0", selectVpnAddress(interfaceAddresses:["172.16.9.2", "192.168.20.2", "169.254.19.1"]))
        XCTAssertEqual("172.16.9.1", selectVpnAddress(interfaceAddresses:["10.111.222.1", "192.168.20.2", "169.254.19.1"]))
        XCTAssertEqual("192.168.20.1", selectVpnAddress(interfaceAddresses:["10.111.222.1", "172.16.9.2", "169.254.19.1"]))
        XCTAssertEqual("169.254.19.0", selectVpnAddress(interfaceAddresses:["10.111.222.1", "172.16.9.2", "192.168.20.2"]))
    }
    
    func testGetAddressForVpn() {
        XCTAssertTrue(kVpnSubnetCandidates.values.contains(OutlineTunnel.getAddressForVpn()))
    }
}
