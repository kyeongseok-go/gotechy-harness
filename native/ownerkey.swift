// gotechy 오너 키 도구(contract.md 6.3절). Secure Enclave에서 P-256 키를 만들고, 오너 확인(Touch ID나 Mac 암호) 뒤 서명한다.
// 개인 키는 Secure Enclave 밖으로 나오지 않는다. 파일에는 Secure Enclave가 감싼 blob만 남는다.
// `gotechy keys init`이 swiftc로 빌드한다. 테스트는 -D GOTECHY_TEST_NO_PRESENCE로 빌드해 사람 확인 없이 돈다(배포 빌드에는 넣지 않는다).
//
// 사용법:
//   create <blob>                 새 키를 만들고 공개 키(SPKI DER의 base64)를 출력
//   pub <blob>                    공개 키를 출력
//   probe <blob>                  사람 확인 없이 서명되는 키면 exit 5 (keys init이 만든 직후에 본다)
//   sign <blob>                   표준 입력의 [결정 서명 대상, 장부 줄] 두 문자열을 한 번의 확인으로 서명하고
//                                 서명 두 개(DER의 base64)를 JSON 배열로 출력. 둘이 서로 맞지 않으면 서명하지 않는다.
//                                 확인 창 문구는 서명 대상의 gate_id와 choice로 도구가 직접 만든다(보안 감사 6차 중간 1)
// 종료 코드: 0 성공, 1 실패, 2 입력이나 사용법 오류, 3 Secure Enclave 없음, 4 오너가 확인을 취소하거나 실패, 5 사람 확인 없는 키
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
guard args.count >= 3 else { fail("사용법: gotechy-ownerkey create|pub|probe|sign <blob>", 2) }
let cmd = args[1]
let blobURL = URL(fileURLWithPath: args[2])

func sha256Hex(_ data: Data) -> String {
  SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

/** 제어 문자(Cc)와 형식 문자(Cf: 양방향 제어, 폭 없는 공백, U+061C 포함)를 지운다. 문구는 워커가 쓴 선택지에서 나온다 */
func plain(_ text: String) -> String {
  let kept = text.unicodeScalars.filter { u in
    let c = u.properties.generalCategory
    return !(c == .control || c == .format)
  }
  return String(String.UnicodeScalarView(kept).prefix(120))
}

/**
 * 서명할 두 메시지를 검사하고 확인 창 문구를 만든다. 하나의 확인으로 결정 하나만 서명되게 한다:
 * 메시지는 정확히 두 개이고, 둘째(장부 줄)는 첫째(결정 서명 대상)와 게이트, nonce, 키, 해시가 같아야 한다.
 */
func checkedReason(_ messages: [String]) -> String {
  guard messages.count == 2,
    let d0 = messages[0].data(using: .utf8),
    let p = (try? JSONSerialization.jsonObject(with: d0)) as? [String: Any],
    let gate = p["gate_id"] as? String, let choice = p["choice"] as? String,
    let task = p["task_id"] as? String,
    let nonce = p["nonce"] as? String, let keyId = p["key_id"] as? String,
    let d1 = messages[1].data(using: .utf8),
    let line = (try? JSONSerialization.jsonObject(with: d1)) as? [String: Any],
    line["gate"] as? String == gate, line["nonce"] as? String == nonce,
    line["key_id"] as? String == keyId, line["payload_sha256"] as? String == sha256Hex(d0)
  else { fail("서명 입력은 [결정 서명 대상, 그 결정의 장부 줄] 두 개여야 해요. 서명하지 않았어요", 2) }
  // 작업 번호와 확인 코드(nonce 앞 4자리)를 넣는다. 화면에 같은 코드가 보여서 오너가 자기 결정의 창인지 알아본다(감사 8차 중간 5)
  return plain("gotechy \(gate) \(task): \(choice) (확인 \(nonce.prefix(4).uppercased()))")
}

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
case "probe":
  // 화면에 아무것도 띄우지 못하게 한 context로 서명이 되면, 사람 확인이 걸리지 않은 키다
  let ctx = LAContext()
  ctx.interactionNotAllowed = true
  let key = loadKey(ctx)
  if (try? key.signature(for: Data("gotechy probe".utf8))) != nil {
    fail("사람 확인 없이 서명되는 키예요", 5)
  }
  print("ok")
case "sign":
  let input = FileHandle.standardInput.readDataToEndOfFile()
  guard let messages = try? JSONDecoder().decode([String].self, from: input) else {
    fail("표준 입력은 JSON 문자열 배열이어야 해요", 2)
  }
  let reason = checkedReason(messages)
  let ctx = LAContext()
  ctx.localizedReason = reason
  #if GOTECHY_TEST_NO_PRESENCE
    // 테스트 빌드는 확인 창 대신 문구를 stderr에 남긴다
    FileHandle.standardError.write(Data("확인 문구: \(reason)\n".utf8))
  #else
    // 확인을 한 번 먼저 받고, 같은 context로 두 서명을 만든다
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
