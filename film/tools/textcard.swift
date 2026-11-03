// 字幕の板を描く（背景透明の PNG）。CoreText なので、重なった輪郭の書体もきれいに出る。
// swift textcard.swift jobs.json
import Foundation
import CoreText
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Run: Decodable { let t: String; let font: String; let size: Double; let color: String; let track: Double? }
struct Line: Decodable { let x: Double; let y: Double; let align: String?; let runs: [Run] }
struct Rect: Decodable { let x: Double; let y: Double; let w: Double; let h: Double; let color: String }
struct Job: Decodable { let w: Int; let h: Int; let out: String; let lines: [Line]; let rects: [Rect]? }

var fonts: [String: CGFont] = [:]
func cgfont(_ path: String) -> CGFont {
  if let f = fonts[path] { return f }
  let p = CGDataProvider(url: URL(fileURLWithPath: path) as CFURL)!
  let f = CGFont(p)!
  fonts[path] = f
  return f
}
func color(_ hex: String) -> CGColor {
  var v: UInt64 = 0
  Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
  let a = hex.count > 7 ? Double(v & 0xff) / 255 : 1
  let rgb = hex.count > 7 ? v >> 8 : v
  return CGColor(srgbRed: Double((rgb >> 16) & 0xff) / 255, green: Double((rgb >> 8) & 0xff) / 255, blue: Double(rgb & 0xff) / 255, alpha: a)
}

let jobs = try JSONDecoder().decode([Job].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
for job in jobs {
  let cs = CGColorSpace(name: CGColorSpace.sRGB)!
  let ctx = CGContext(data: nil, width: job.w, height: job.h, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setShouldAntialias(true)
  ctx.setShouldSmoothFonts(false)
  for r in job.rects ?? [] {
    ctx.setFillColor(color(r.color))
    ctx.fill(CGRect(x: r.x, y: Double(job.h) - r.y - r.h, width: r.w, height: r.h))
  }
  for line in job.lines {
    let s = NSMutableAttributedString()
    for r in line.runs {
      let f = CTFontCreateWithGraphicsFont(cgfont(r.font), r.size, nil, nil)
      var attrs: [NSAttributedString.Key: Any] = [
        NSAttributedString.Key(kCTFontAttributeName as String): f,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): color(r.color),
      ]
      if let tr = r.track { attrs[NSAttributedString.Key(kCTKernAttributeName as String)] = tr }
      s.append(NSAttributedString(string: r.t, attributes: attrs))
    }
    let ct = CTLineCreateWithAttributedString(s)
    let width = CTLineGetTypographicBounds(ct, nil, nil, nil)
    var x = line.x
    if line.align == "right" { x -= width }
    if line.align == "center" { x -= width / 2 }
    ctx.textPosition = CGPoint(x: x, y: Double(job.h) - line.y)
    CTLineDraw(ct, ctx)
  }
  let img = ctx.makeImage()!
  let url = URL(fileURLWithPath: job.out)
  try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, img, nil)
  CGImageDestinationFinalize(dest)
}
print("cards", jobs.count)
