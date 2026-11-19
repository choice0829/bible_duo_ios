import CoreLocation
import Contacts

/// 모임 장소 지도용: 현재 위치를 한 번 받고, 주소 ↔ 좌표를 찾아 준다.
/// 결과는 모두 딕셔너리로 돌려주고, 웹으로 보내는 일은 ViewController가 한다.
/// (키·계정이 필요 없는 아이폰 기본 기능만 쓴다. 위치는 앱을 쓰는 동안만, 필요할 때 한 번씩 읽는다.)
final class LocationBridge: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var geocoder: CLGeocoder?
    private var wantsFix = false

    /// 현재 위치 결과: ["lat", "lng", "acc"] 또는 ["error": "denied" | "fail"]
    var onFix: (([String: Any]) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    // MARK: 현재 위치 (한 번)
    func requestFix() {
        switch manager.authorizationStatus {
        case .notDetermined:
            wantsFix = true
            manager.requestWhenInUseAuthorization()
        case .restricted, .denied:
            onFix?(["error": "denied"])
        default:
            manager.requestLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard wantsFix else { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            return
        case .restricted, .denied:
            wantsFix = false
            onFix?(["error": "denied"])
        default:
            wantsFix = false
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        onFix?(["lat": loc.coordinate.latitude, "lng": loc.coordinate.longitude, "acc": max(0, loc.horizontalAccuracy)])
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let e = error as? CLError, e.code == .denied {
            onFix?(["error": "denied"])
        } else {
            onFix?(["error": "fail"])
        }
    }

    // MARK: 주소 → 좌표
    func geocode(_ query: String, done: @escaping ([String: Any]) -> Void) {
        geocoder?.cancelGeocode()
        let g = CLGeocoder()
        geocoder = g
        g.geocodeAddressString(query) { marks, error in
            DispatchQueue.main.async {
                if let marks = marks, !marks.isEmpty {
                    done(["results": marks.prefix(5).compactMap { LocationBridge.item($0) }])
                } else if let e = error as? CLError, e.code == .network {
                    done(["error": "network"])
                } else {
                    done(["results": [[String: Any]]()])
                }
            }
        }
    }

    // MARK: 좌표 → 주소
    func reverse(lat: Double, lng: Double, done: @escaping ([String: Any]) -> Void) {
        geocoder?.cancelGeocode()
        let g = CLGeocoder()
        geocoder = g
        g.reverseGeocodeLocation(CLLocation(latitude: lat, longitude: lng)) { marks, _ in
            DispatchQueue.main.async {
                if let m = marks?.first, let it = LocationBridge.item(m) {
                    done(["results": [it]])
                } else {
                    done(["results": [[String: Any]]()])
                }
            }
        }
    }

    private static func item(_ m: CLPlacemark) -> [String: Any]? {
        guard let c = m.location?.coordinate, CLLocationCoordinate2DIsValid(c) else { return nil }
        var addr = ""
        if let postal = m.postalAddress {
            addr = CNPostalAddressFormatter.string(from: postal, style: .mailingAddress)
                .replacingOccurrences(of: "\n", with: " ")
        }
        if addr.isEmpty {
            let parts: [String?] = [m.administrativeArea, m.locality, m.subLocality, m.thoroughfare, m.subThoroughfare]
            addr = parts.compactMap { $0 }.joined(separator: " ")
        }
        return ["name": m.name ?? "", "addr": addr, "lat": c.latitude, "lng": c.longitude]
    }
}
