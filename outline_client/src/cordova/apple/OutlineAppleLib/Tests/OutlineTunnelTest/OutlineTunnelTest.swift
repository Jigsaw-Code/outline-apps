import XCTest

import NetworkExtension
import Tun2socks

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
        XCTAssertTrue(kVpnSubnetCandidates.values.contains(selectVpnAddress(interfaceAddresses: getNetworkInterfaceAddresses())))
    }
    
    func testGetTunnelNetworkSettings() {
        let settings = OutlineTunnel.getTunnelNetworkSettings(tunnelRemoteAddress: "1.2.3.4")
        
        XCTAssertEqual("1.2.3.4", settings.tunnelRemoteAddress)
        
        XCTAssertEqual(1, settings.ipv4Settings?.addresses.count)
        XCTAssertTrue(kVpnSubnetCandidates.values.contains(settings.ipv4Settings?.addresses[0] ?? ""))
        XCTAssertEqual(["255.255.255.0"], settings.ipv4Settings?.subnetMasks)
        
        XCTAssertEqual([NEIPv4Route.default()], settings.ipv4Settings?.includedRoutes)
        XCTAssertEqual(15, settings.ipv4Settings?.excludedRoutes?.count ?? 0)

        XCTAssertEqual(["1.1.1.1", "9.9.9.9", "208.67.222.222", "208.67.220.220"], settings.dnsSettings?.servers)
    }
}
