import UIKit
import SwiftUI

/// v103: iPhone Duo 경첩 각도를 웹 화면에 알려 준다(iOS 27.1 SwiftUI `onHingeChange`).
/// 웹은 이 값으로 '접기 시작'을 미리 알아, 화면이 바뀌기 전에 머리줄을 접힘 자리로 움직인다.
/// Apple 안내대로 배치 결정이 아닌 움직임(효과)에만 쓴다. 경첩이 없는 기기·iOS 27.1 미만에서는 아무 일도 하지 않는다.
final class HingeBridge {
    /// (각도°, 상태 문자열) — 평평하면 180°, 상태는 closed / partiallyOpen / fullyOpen
    var onChange: ((Int, String) -> Void)?
    private var host: UIViewController?
    private var lastSent: CFTimeInterval = 0
    private var lastAngle = -999
    private var lastStatus = ""

    func attach(to parent: UIViewController) {
        guard #available(iOS 27.1, *) else { return }
        let probe = HingeProbe { [weak self] deg, status in self?.emit(deg, status) }
        let hc = UIHostingController(rootView: probe)
        hc.view.backgroundColor = .clear
        hc.view.isUserInteractionEnabled = false
        hc.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
        parent.addChild(hc)
        parent.view.addSubview(hc.view)
        hc.didMove(toParent: parent)
        host = hc
    }

    private func emit(_ degrees: Double, _ status: String) {
        let deg = Int(degrees.rounded())
        let now = CACurrentMediaTime()
        // 너무 잦은 전달을 줄인다: 상태가 같고 2° 미만으로 바뀌었으면 0.1초에 한 번만
        if status == lastStatus && abs(deg - lastAngle) < 2 && now - lastSent < 0.1 { return }
        lastSent = now; lastAngle = deg; lastStatus = status
        onChange?(deg, status)
    }
}

@available(iOS 27.1, *)
private struct HingeProbe: View {
    let onChange: (Double, String) -> Void
    var body: some View {
        Color.clear
            .onHingeChange { _, context in
                // 경첩이 없는 기기에서는 nil
                guard let hinge = context.hinge else { return }
                onChange(hinge.angle.degrees, String(describing: hinge.status))
            }
    }
}
