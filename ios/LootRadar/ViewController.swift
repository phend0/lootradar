import UIKit
import WebKit
import SafariServices

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private let remoteAppUrl = URL(string: "https://ais-pre-4elawtmchdh5dqp5c6ul7s-491717491862.us-west2.run.app")!

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0)

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0)
        webView.scrollView.backgroundColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = self
        webView.uiDelegate = self

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        loadRadar()
    }

    private func loadRadar() {
        if let indexPath = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "www") {
            let fileUrl = URL(fileURLWithPath: indexPath)
            let dirUrl = fileUrl.deletingLastPathComponent()
            webView.loadFileURL(fileUrl, allowingReadAccessTo: dirUrl)
        } else {
            let request = URLRequest(url: remoteAppUrl, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 15)
            webView.load(request)
        }
    }

    // Open external game store claim links (Epic, Steam, GOG, Prime, itch.io) in SFSafariViewController
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if url.scheme == "http" || url.scheme == "https" {
            let host = (url.host ?? "").lowercased()
            let isInternalHost = host.contains("run.app") || host.contains("localhost") || host.contains("127.0.0.1")
            if !isInternalHost && navigationAction.navigationType == .linkActivated {
                let safariVC = SFSafariViewController(url: url)
                safariVC.preferredBarTintColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0)
                safariVC.preferredControlTintColor = UIColor(red: 6/255, green: 182/255, blue: 212/255, alpha: 1.0)
                present(safariVC, animated: true)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            let safariVC = SFSafariViewController(url: url)
            safariVC.preferredBarTintColor = UIColor(red: 11/255, green: 15/255, blue: 25/255, alpha: 1.0)
            safariVC.preferredControlTintColor = UIColor(red: 6/255, green: 182/255, blue: 212/255, alpha: 1.0)
            present(safariVC, animated: true)
        }
        return nil
    }
}
