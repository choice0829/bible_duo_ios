import Foundation
import StoreKit

/// 후원하기: App Store 앱 안 결제(StoreKit 2)로 '후원' 상품을 불러오고 결제한다.
/// - 후원 상품은 소모성(consumable)이며, 결제해도 앱의 기능이 열리거나 닫히지 않는다(후원 전용).
/// - 상품은 App Store Connect 에 아래 productIDs 와 같은 ID 로 만들어 두어야 한다(docs/SUPPORT-SETUP.md).
/// - 사이드로드(Sideloadly)로 설치한 앱에서는 상품을 불러올 수 없어 빈 목록이 돌아간다. 웹 화면이 안내 문구를 보여 준다.
/// 결과는 모두 딕셔너리로 돌려주고, 웹으로 보내는 일은 ViewController가 한다.
@MainActor
final class SupportBridge {
    /// App Store Connect 의 상품 ID. 앱 번들 ID를 바꾸면 이 값과 App Store Connect 의 상품도 함께 맞춘다.
    static let productIDs = [
        "com.choice0829.bibleflip.support.small",
        "com.choice0829.bibleflip.support.medium",
        "com.choice0829.bibleflip.support.large",
    ]

    /// 웹으로 보낼 결과: ["kind": "list" | "buy", "id": 요청 번호, ...]
    var onEvent: (([String: Any]) -> Void)?

    private var updatesTask: Task<Void, Never>?
    private var cache: [String: Product] = [:]

    /// 앱이 켜져 있는 동안 늦게 도착하는 결제 소식(예: 승인 대기 중이던 결제가 승인됨)을 받아 마무리한다.
    func startListening() {
        guard updatesTask == nil else { return }
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let transaction) = update {
                    await transaction.finish()
                    self?.onEvent?(["kind": "buy", "id": 0, "result": "thanks"])
                }
            }
        }
    }

    /// 후원 상품 목록(가격 낮은 순). 상품이 없으면 items 가 빈 배열이다.
    func list(id: Int) {
        Task { [weak self] in
            guard let self = self else { return }
            var items: [[String: Any]] = []
            do {
                let products = try await Product.products(for: SupportBridge.productIDs)
                for p in products.sorted(by: { $0.price < $1.price }) {
                    self.cache[p.id] = p
                    items.append(["id": p.id, "name": p.displayName, "price": p.displayPrice])
                }
            } catch {
                items = []
            }
            self.onEvent?(["kind": "list", "id": id, "items": items])
        }
    }

    /// 결제 창을 띄워 후원한다. result: thanks | cancelled | pending | unavailable | failed
    func buy(id: Int, productID: String) {
        guard SupportBridge.productIDs.contains(productID) else { reply(id, "failed"); return }
        Task { [weak self] in
            guard let self = self else { return }
            do {
                var found = self.cache[productID]
                if found == nil {
                    found = try await Product.products(for: [productID]).first
                }
                guard let product = found else { self.reply(id, "unavailable"); return }
                self.cache[productID] = product
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        self.reply(id, "thanks")
                    case .unverified:
                        self.reply(id, "failed")
                    }
                case .userCancelled:
                    self.reply(id, "cancelled")
                case .pending:
                    self.reply(id, "pending")
                @unknown default:
                    self.reply(id, "failed")
                }
            } catch {
                self.reply(id, "failed")
            }
        }
    }

    private func reply(_ id: Int, _ result: String) {
        onEvent?(["kind": "buy", "id": id, "result": result])
    }
}
