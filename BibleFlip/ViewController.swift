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
        load()
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
        guard let t = body["theme"] as? String else { return }
        UserDefaults.standard.set(t, forKey: "bf.theme")
        applyTheme(t)
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
