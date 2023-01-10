import XCTest
@testable import VPNSources
@testable import VPNSourcesObjC

final class VPNSourcesTest: XCTestCase {
    
    static let kAppGroup = "outline.spm.tests"
    
    // Example test
    func testExample() throws {
        let tunnelStore = OutlineTunnelStore(appGroup: VPNSourcesTest.kAppGroup)
        XCTAssertNil(tunnelStore.load())
    }
}
