import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// End-to-end payload encryption, matching the server's lib/crypto.mjs.
///
/// AES-256-GCM with a pre-shared 32-byte key (64 hex chars). The envelope is
/// `{v:1, n:<b64 nonce>, c:<b64 ciphertext>, m:<b64 tag>}`. When no valid key is
/// configured this is a pass-through, so the app still works unencrypted.
class BeaconCrypto {
  BeaconCrypto(this.hexKey);

  final String hexKey;
  final AesGcm _algo = AesGcm.with256bits();

  bool get enabled => RegExp(r'^[0-9a-fA-F]{64}$').hasMatch(hexKey.trim());

  SecretKey get _key => SecretKey(_hexToBytes(hexKey.trim()));

  Future<Map<String, dynamic>> encrypt(Map<String, dynamic> obj) async {
    if (!enabled) return obj;
    final box = await _algo.encrypt(
      utf8.encode(jsonEncode(obj)),
      secretKey: _key,
    );
    return {
      'v': 1,
      'n': base64.encode(box.nonce),
      'c': base64.encode(box.cipherText),
      'm': base64.encode(box.mac.bytes),
    };
  }

  Future<Map<String, dynamic>> decrypt(Map<String, dynamic> env) async {
    if (!enabled) return env;
    final box = SecretBox(
      base64.decode(env['c'] as String),
      nonce: base64.decode(env['n'] as String),
      mac: Mac(base64.decode(env['m'] as String)),
    );
    final clear = await _algo.decrypt(box, secretKey: _key);
    return jsonDecode(utf8.decode(clear)) as Map<String, dynamic>;
  }

  static bool isEnvelope(Map<String, dynamic> m) =>
      m['v'] == 1 && m['n'] != null && m['c'] != null && m['m'] != null;

  static Uint8List _hexToBytes(String hex) {
    final out = Uint8List(hex.length ~/ 2);
    for (var i = 0; i < out.length; i++) {
      out[i] = int.parse(hex.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return out;
  }
}
