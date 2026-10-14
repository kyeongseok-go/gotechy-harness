// N0 실험: Secure Enclave P-256 키 만들기, 공개 키 출력, 서명. 키는 Secure Enclave가 감싼 blob으로만 파일에 남는다.
import CryptoKit
import Foundation
import LocalAuthentication

func fail(_ msg: String, _ code: Int32 = 1) -> Never {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
  exit(code)
}

let args = CommandLine.arguments
guard args.count >= 3 else { fail("usage: ownerkey create|pub|sign <blob> [--no-presence] [--reason text]", 2) }
let cmd = args[1]
let blobPath = args[2]
let noPresence = args.contains("--no-presence")
var reason = "gotechy 결정 서명"
if let i = args.firstIndex(of: "--reason"), i + 1 < args.count { reason = args[i + 1] }

func spkiBase64(_ key: P256.Signing.PublicKey) -> String { key.derRepresentation.base64EncodedString() }

switch cmd {
case "create":
  guard SecureEnclave.isAvailable else { fail("Secure Enclave를 쓸 수 없어요", 3) }
  var flags: SecAccessControlCreateFlags = [.privateKeyUsage]
  if !noPresence { flags.insert(.userPresence) }
  var err: Unmanaged<CFError>?
  guard let ac = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, flags, &err) else {
    fail("access control: \(String(describing: err))")
  }
  do {
    let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: ac)
    try key.dataRepresentation.write(to: URL(fileURLWithPath: blobPath), options: [.withoutOverwriting])
    print(spkiBase64(key.publicKey))
  } catch { fail("create: \(error)") }
case "pub", "sign":
  do {
    let blob = try Data(contentsOf: URL(fileURLWithPath: blobPath))
    let ctx = LAContext()
    ctx.localizedReason = reason
    let key = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob, authenticationContext: ctx)
    if cmd == "pub" { print(spkiBase64(key.publicKey)); exit(0) }
    let msg = FileHandle.standardInput.readDataToEndOfFile()
    let sig = try key.signature(for: msg)
    print(sig.derRepresentation.base64EncodedString())
  } catch { fail("\(cmd): \(error)") }
default:
  fail("unknown command \(cmd)", 2)
}
