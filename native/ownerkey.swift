// gotechy 오너 키 도구(contract.md 6.3절). Secure Enclave에서 P-256 키를 만들고, 오너 확인(Touch ID나 Mac 암호) 뒤 서명한다.
// 개인 키는 Secure Enclave 밖으로 나오지 않는다. 파일에는 Secure Enclave가 감싼 blob만 남는다.
// `gotechy keys init`이 swiftc로 빌드한다. 테스트는 -D GOTECHY_TEST_NO_PRESENCE로 빌드해 사람 확인 없이 돈다(배포 빌드에는 넣지 않는다).
//
// 사용법:
//   create <blob>                 새 키를 만들고 공개 키(SPKI DER의 base64)를 출력
//   pub <blob>                    공개 키를 출력
//   sign <blob> --reason <글>     표준 입력의 JSON 문자열 배열을 한 번의 확인으로 서명하고 서명 배열(DER의 base64)을 JSON으로 출력
// 종료 코드: 0 성공, 1 실패, 2 사용법, 3 Secure Enclave 없음, 4 오너가 확인을 취소하거나 실패
import CryptoKit
import Foundation
import LocalAuthentication

func fail(_ msg: String, _ code: Int32 = 1) -> Never {
  FileHandle.standardError.write(Data((msg + "\n").utf8))
  exit(code)
}

func isCancel(_ error: Error) -> Bool {
  guard let la = error as? LAError else { return false }
  return [.userCancel, .appCancel, .systemCancel, .authenticationFailed, .userFallback].contains(la.code)
}

let args = CommandLine.arguments
guard args.count >= 3 else { fail("사용법: gotechy-ownerkey create|pub|sign <blob> [--reason 글]", 2) }
let cmd = args[1]
let blobURL = URL(fileURLWithPath: args[2])
var reason = "gotechy 결정 서명"
if let i = args.firstIndex(of: "--reason"), i + 1 < args.count { reason = args[i + 1] }

func publicKeyText(_ key: SecureEnclave.P256.Signing.PrivateKey) -> String {
  key.publicKey.derRepresentation.base64EncodedString()
}

func loadKey(_ ctx: LAContext) -> SecureEnclave.P256.Signing.PrivateKey {
  do {
    let blob = try Data(contentsOf: blobURL)
    return try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: blob, authenticationContext: ctx)
  } catch {
    fail("키를 열 수 없어요: \(error)")
  }
}

switch cmd {
case "create":
  guard SecureEnclave.isAvailable else { fail("이 컴퓨터에는 Secure Enclave가 없어요", 3) }
  var flags: SecAccessControlCreateFlags = [.privateKeyUsage]
  #if !GOTECHY_TEST_NO_PRESENCE
    flags.insert(.userPresence)
  #endif
  var cfError: Unmanaged<CFError>?
  guard
    let access = SecAccessControlCreateWithFlags(
      nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, flags, &cfError)
  else { fail("접근 제어를 만들 수 없어요: \(String(describing: cfError))") }
  do {
    let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: access)
    // 이미 있는 blob은 덮어쓰지 않는다
    try key.dataRepresentation.write(to: blobURL, options: [.withoutOverwriting])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: blobURL.path)
    print(publicKeyText(key))
  } catch {
    fail("키를 만들 수 없어요: \(error)")
  }
case "pub":
  print(publicKeyText(loadKey(LAContext())))
case "sign":
  let input = FileHandle.standardInput.readDataToEndOfFile()
  guard let messages = try? JSONDecoder().decode([String].self, from: input), !messages.isEmpty else {
    fail("표준 입력은 비어 있지 않은 JSON 문자열 배열이어야 해요", 2)
  }
  let ctx = LAContext()
  ctx.localizedReason = reason
  #if !GOTECHY_TEST_NO_PRESENCE
    // 확인을 한 번 먼저 받고, 같은 context로 여러 서명을 만든다
    let done = DispatchSemaphore(value: 0)
    var authError: Error?
    ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { ok, error in
      if !ok { authError = error ?? LAError(.authenticationFailed) }
      done.signal()
    }
    done.wait()
    if let e = authError { fail("오너 확인을 받지 못했어요: \(e.localizedDescription)", isCancel(e) ? 4 : 1) }
  #endif
  let key = loadKey(ctx)
  do {
    let sigs = try messages.map { try key.signature(for: Data($0.utf8)).derRepresentation.base64EncodedString() }
    let out = try JSONEncoder().encode(sigs)
    print(String(decoding: out, as: UTF8.self))
  } catch {
    fail("서명하지 못했어요: \(error)", isCancel(error) ? 4 : 1)
  }
default:
  fail("모르는 명령이에요: \(cmd)", 2)
}
