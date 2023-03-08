import XCTest
@testable import OutlineTunnel
@testable import PacketTunnelProvider

final class OutlineTunnelTest: XCTestCase {
    
    static let kAppGroup = "outline.spm.tests"
    
    // Example test
    func testTunnelStoreDoesNotLoadBeforeSetup() throws {
        let tunnelStore = OutlineTunnelStore(appGroup: OutlineTunnelTest.kAppGroup)
        XCTAssertNil(tunnelStore.load())
    }
}
