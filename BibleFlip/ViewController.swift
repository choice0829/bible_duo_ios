import UIKit
import WebKit

/// 웹 메시지를 받는 쪽이 ViewController를 붙잡고 있지 않도록(순환 참조 방지) 약하게 이어 주는 중간 다리
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(ucc, didReceive: message)
    }
}

final class ViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var theme: String = UserDefaults.standard.string(forKey: "bf.theme") ?? "paper"
    private var errorShown = false
    private let places = LocationBridge()   // 모임 장소 지도: 현재 위치·주소 찾기

    // Mac 없이도 문제를 알 수 있도록: 웹에서 난 오류를 앱이 한 번 화면에 띄운다 (진단용)
    private static let diagScript = """
    (function () {
      var sent = 0;
      function report(m) { if (sent++ > 2) return; try { window.webkit.messageHandlers.bf.postMessage({ error: String(m).slice(0, 400) }); } catch (e) {} }
      window.addEventListener('error', function (e) { report((e.message || 'error') + ' @' + (e.filename || '') + ':' + (e.lineno || '')); });
      window.addEventListener('unhandledrejection', function (e) { report('promise: ' + ((e.reason && e.reason.message) || e.reason)); });
    })();
    """

    // 책상 색 (웹앱 style.css의 --desk 와 같은 값)
    private static let deskColors: [String: UIColor] = [
        "paper": UIColor(red: 220/255, green: 212/255, blue: 194/255, alpha: 1),
        "sepia": UIColor(red: 205/255, green: 186/255, blue: 144/255, alpha: 1),
        "night": UIColor(red: 10/255, green: 11/255, blue: 13/255, alpha: 1),
    ]

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "bibleflip")
        config.allowsInlineMediaPlayback = true
        // 지도 바탕(OpenStreetMap) 서버가 앱을 알아볼 수 있도록 앱 이름을 접속 정보(User-Agent)에 덧붙인다
        config.applicationNameForUserAgent = "BibleFlip/59"
        let controller = WKUserContentController()
        controller.add(WeakMessageHandler(self), name: "bf")
        controller.addUserScript(WKUserScript(source: ViewController.diagScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = controller

        let container = UIView()
        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = self
        wv.uiDelegate = self
        // 화면 전체(안전영역 아래까지)를 웹이 직접 쓴다. 안전영역은 웹의 env(safe-area-inset-*)로 전달된다.
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.scrollView.bounces = false
        wv.scrollView.showsVerticalScrollIndicator = false
        wv.scrollView.showsHorizontalScrollIndicator = false
        wv.isOpaque = false
        wv.backgroundColor = .clear
        wv.scrollView.backgroundColor = .clear
        wv.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { wv.isInspectable = true }
        wv.frame = container.bounds
        wv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.addSubview(wv)
        self.webView = wv
        self.view = container
        applyTheme(theme)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // 키보드: 웹뷰는 키보드가 올라와도 보이는 영역이 줄지 않으므로, 키보드가 화면을 덮는 높이를 웹에 알려 창이 키보드 위쪽에 맞춰지게 한다
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardFrameChanged(_:)),
                                               name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)),
                                               name: UIResponder.keyboardWillHideNotification, object: nil)
        places.onFix = { [weak self] r in self?.sendToWeb("bfLocation", r) }
        load()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func keyboardFrameChanged(_ n: Notification) {
        guard let value = n.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else { return }
        let end = value.cgRectValue
        let local: CGRect
        if let space = view.window?.screen.coordinateSpace {
            local = view.convert(end, from: space)
        } else {
            local = view.convert(end, from: nil)
        }
        sendKeyboardHeight(max(0, view.bounds.maxY - local.minY))
    }

    @objc private func keyboardWillHide(_ n: Notification) {
        sendKeyboardHeight(0)
    }

    private func sendKeyboardHeight(_ h: CGFloat) {
        let px = Int(h.rounded())
        webView.evaluateJavaScript("window.bfKeyboard && window.bfKeyboard(\(px))", completionHandler: nil)
    }

    private func load() {
        if let url = URL(string: "bibleflip://app/index.html") {
            webView.load(URLRequest(url: url))
        }
    }

    // MARK: 테마 (웹앱이 알려 준다)
    private func applyTheme(_ t: String) {
        theme = ViewController.deskColors[t] != nil ? t : "paper"
        view.backgroundColor = ViewController.deskColors[theme]
        overrideUserInterfaceStyle = (theme == "night") ? .dark : .light
        setNeedsStatusBarAppearanceUpdate()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return theme == "night" ? .lightContent : .darkContent
    }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "bf", let body = message.body as? [String: Any] else { return }
        if let err = body["error"] as? String { reportError(err); return }
        // 바이블 포토 카드: 웹이 만든 JPEG(base64)를 받아 아이폰 공유 창(이미지 저장·메시지·카카오톡 등)을 띄운다
        if let b64 = body["share"] as? String { shareImage(base64: b64, name: body["name"] as? String); return }
        // 모임 장소 지도: 현재 위치 · 주소 → 좌표 · 좌표 → 주소 · 다른 지도 앱 열기
        if body["loc"] != nil { places.requestFix(); return }
        if let q = body["geocode"] as? String {
            let id = (body["id"] as? Int) ?? 0
            places.geocode(String(q.prefix(200))) { [weak self] r in
                var out = r
                out["id"] = id
                self?.sendToWeb("bfGeo", out)
            }
            return
        }
        if let r = body["rgeo"] as? [String: Any], let lat = r["lat"] as? Double, let lng = r["lng"] as? Double {
            let id = (body["id"] as? Int) ?? 0
            places.reverse(lat: lat, lng: lng) { [weak self] res in
                var out = res
                out["id"] = id
                self?.sendToWeb("bfGeo", out)
            }
            return
        }
        if let u = body["open"] as? String { openExternal(u, fallback: body["fallback"] as? String); return }
        guard let t = body["theme"] as? String else { return }
        UserDefaults.standard.set(t, forKey: "bf.theme")
        applyTheme(t)
    }

    // MARK: 웹으로 결과 보내기 (window.함수이름(JSON))
    private func sendToWeb(_ fn: String, _ payload: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.\(fn) && window.\(fn)(\(json))", completionHandler: nil)
    }

    // MARK: 다른 지도 앱(네이버 지도 등) 열기. 앱이 없어 열리지 않으면 fallback 주소(웹)로 연다.
    private func openExternal(_ text: String, fallback: String?) {
        let allowed = ["https", "http", "nmap", "tel"]
        guard let url = URL(string: text), let scheme = url.scheme?.lowercased(), allowed.contains(scheme) else { return }
        UIApplication.shared.open(url, options: [:]) { ok in
            guard !ok, let f = fallback, let fu = URL(string: f),
                  let fs = fu.scheme?.lowercased(), fs == "https" || fs == "http" else { return }
            UIApplication.shared.open(fu, options: [:], completionHandler: nil)
        }
    }

    // MARK: 바이블 포토 카드 공유 (웹의 사진 → 임시 파일 → 공유 창)
    private func shareImage(base64: String, name: String?) {
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters), !data.isEmpty else {
            reportError("바이블 포토 카드 이미지를 읽지 못했습니다")
            return
        }
        if presentedViewController != nil { return }   // 이미 다른 창이 떠 있으면 겹쳐 띄우지 않는다
        // 파일 이름은 영문·숫자·.-_ 만 쓴다 (경로 조작 방지)
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_")
        var safe = String((name ?? "").unicodeScalars.filter { allowed.contains($0) }.map { Character($0) })
        if safe.isEmpty || !safe.lowercased().hasSuffix(".jpg") { safe = "photocard.jpg" }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(safe)
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            reportError("바이블 포토 카드 파일을 만들지 못했습니다: \(error.localizedDescription)")
            return
        }
        let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        vc.completionWithItemsHandler = { _, _, _, _ in _ = try? FileManager.default.removeItem(at: url) }
        if let pop = vc.popoverPresentationController {   // 아이패드처럼 팝오버로 뜨는 기기용
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        present(vc, animated: true)
    }

    private func reportError(_ text: String) {
        if errorShown || text.contains("ResizeObserver") { return }
        errorShown = true
        let a = UIAlertController(title: "오류 알림 (진단용)", message: text, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "확인", style: .default))
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        reportError("화면 불러오기 실패: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        reportError("화면 오류: \(error.localizedDescription)")
    }

    // MARK: 이동 제한: 앱 안 주소만 열고, 바깥 링크는 사파리로
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "bibleflip" || url.scheme == "about" { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }

    // 웹 프로세스가 메모리 때문에 종료되면 다시 불러온다
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        load()
    }

    // MARK: 웹의 alert/confirm/prompt 가 조용히 무시되지 않도록
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "취소", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}
