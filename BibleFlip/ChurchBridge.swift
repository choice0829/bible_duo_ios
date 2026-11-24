import Foundation
import Security

/// 교회 계정(v75): 웹 화면이 부탁하는 두 가지 일을 대신한다.
/// 1) 서버 요청 대행 — 앱 안 웹 주소(bibleflip://)에서 바로 보내면 다른 출처(CORS) 규칙에 걸릴 수 있어, 앱이 URLSession으로 보낸다.
///    앱에 함께 들어간 www/sb.json 의 서버 주소(호스트)로 가는 https 요청만 허용한다(아무 곳으로나 보내는 통로가 되지 않게).
/// 2) 로그인 정보(토큰) 보관 — 아이폰 키체인에 저장한다(앱을 지우면 함께 지워지도록 이 기기에서만, 처음 잠금 해제 후 읽기 가능).
final class ChurchBridge {
    private static let service = "com.choice0829.bibleflip.church"

    /// www/sb.json 의 url 에서 꺼낸 서버 호스트(없으면 nil → 서버 요청을 모두 거절)
    private lazy var allowedHost: String? = {
        guard let url = Bundle.main.resourceURL?.appendingPathComponent("www/sb.json"),
              let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let s = obj["url"] as? String, let u = URL(string: s), u.scheme?.lowercased() == "https",
              let host = u.host?.lowercased(), !host.isEmpty else { return nil }
        return host
    }()

    private let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral      // 쿠키·캐시를 남기지 않는다(토큰은 머리글로만 보낸다)
        c.timeoutIntervalForRequest = 30
        c.timeoutIntervalForResource = 120   // 증빙 서류(최대 10MB)를 느린 망에서 올릴 때
        return URLSession(configuration: c)
    }()

    // MARK: 서버 요청 대행
    /// req: { url, method, headers: {이름: 값}, body: 문자열 | bodyB64: base64(이진 파일) } → done: { result: "ok", status, body } 또는 { result: "fail", error }
    func http(_ req: [String: Any], done: @escaping ([String: Any]) -> Void) {
        guard let s = req["url"] as? String, let url = URL(string: s), url.scheme?.lowercased() == "https",
              let host = url.host?.lowercased(), let allowed = allowedHost, host == allowed else {
            done(["result": "fail", "error": "host not allowed"])
            return
        }
        var r = URLRequest(url: url)
        let method = ((req["method"] as? String) ?? "GET").uppercased()
        guard ["GET", "POST", "PUT", "PATCH", "DELETE"].contains(method) else {
            done(["result": "fail", "error": "method not allowed"])
            return
        }
        r.httpMethod = method
        if let h = req["headers"] as? [String: Any] {
            for (k, v) in h { if let vs = v as? String { r.setValue(vs, forHTTPHeaderField: k) } }
        }
        if let b64 = req["bodyB64"] as? String, method != "GET" {
            // 증빙 서류(사진·PDF) 같은 이진 파일: 웹이 base64 로 보낸 것을 풀어 그대로 보낸다 (v77, 15MB까지)
            guard b64.count <= 20_000_000, let d = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else {
                done(["result": "fail", "error": "bad body"])
                return
            }
            r.httpBody = d
        } else if let b = req["body"] as? String, method != "GET" {
            r.httpBody = Data(b.utf8)
            if r.value(forHTTPHeaderField: "Content-Type") == nil { r.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        }
        session.dataTask(with: r) { data, resp, err in
            DispatchQueue.main.async {
                if let e = err {
                    done(["result": "fail", "error": e.localizedDescription])
                    return
                }
                let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
                let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                done(["result": "ok", "status": status, "body": String(text.prefix(2_000_000))])
            }
        }.resume()
    }

    // MARK: 키체인 (계정 이름 하나에 글자 하나: 로그인 정보 JSON)
    /// op: "get" | "set" | "del" → done: { result: "ok", v: 저장된 글자(get일 때, 없으면 "") } 또는 { result: "fail" }
    func keychain(_ op: String, account: String, value: String?, done: ([String: Any]) -> Void) {
        let acct = String(account.prefix(40))
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: ChurchBridge.service,
            kSecAttrAccount as String: acct,
        ]
        switch op {
        case "get":
            var q = base
            q[kSecReturnData as String] = true
            q[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            let st = SecItemCopyMatching(q as CFDictionary, &item)
            if st == errSecSuccess, let d = item as? Data, let s = String(data: d, encoding: .utf8) {
                done(["result": "ok", "v": s])
            } else if st == errSecItemNotFound {
                done(["result": "ok", "v": ""])
            } else {
                done(["result": "fail", "error": "keychain \(st)"])
            }
        case "set":
            let data = Data((value ?? "").prefix(20_000).utf8)
            SecItemDelete(base as CFDictionary)
            var q = base
            q[kSecValueData as String] = data
            q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let st = SecItemAdd(q as CFDictionary, nil)
            done(st == errSecSuccess ? ["result": "ok"] : ["result": "fail", "error": "keychain \(st)"])
        case "del":
            let st = SecItemDelete(base as CFDictionary)
            done(st == errSecSuccess || st == errSecItemNotFound ? ["result": "ok"] : ["result": "fail", "error": "keychain \(st)"])
        default:
            done(["result": "fail", "error": "bad op"])
        }
    }
}
