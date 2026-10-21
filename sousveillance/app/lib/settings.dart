import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persisted user settings: where the beacon server is and how the app behaves.
///
/// The server URL/token can be baked in at build time so the phone needs no
/// setup, e.g.:
///   flutter build apk --release \
///     --dart-define=BEACON_URL=https://beacon.example.com \
///     --dart-define=BEACON_TOKEN=...
/// Anything saved in Settings overrides the baked-in default.
class AppSettings extends ChangeNotifier {
  static const _kUrl = 'server_url';
  static const _kToken = 'token';
  static const _kKey = 'beacon_key';
  static const _kTts = 'tts_enabled';
  static const _kSpeak = 'speak_received';
  static const _kEngine = 'tts_engine';
  static const _kVoice = 'kokoro_voice';
  static const _kModelDir = 'model_dir';
  static const _kAmbient = 'ambient_enabled';

  static const _defaultUrl = String.fromEnvironment('BEACON_URL');
  static const _defaultToken = String.fromEnvironment('BEACON_TOKEN');
  static const _defaultKey = String.fromEnvironment('BEACON_KEY');

  String serverUrl = _defaultUrl;
  String token = _defaultToken;
  String beaconKey = _defaultKey;
  bool ttsEnabled = true;
  bool speakReceived = true;
  bool ambientEnabled = true;

  // 'kokoro' (neural, on-device) or 'system' (Android TTS). Kokoro falls back
  // to system automatically when its model is not installed.
  String ttsEngine = 'kokoro';
  int kokoroVoice = 6; // am_michael
  String modelDir = ''; // empty -> app external files dir + /kokoro

  bool get configured => serverUrl.trim().isNotEmpty && token.trim().isNotEmpty;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    serverUrl = p.getString(_kUrl) ?? _defaultUrl;
    token = p.getString(_kToken) ?? _defaultToken;
    beaconKey = p.getString(_kKey) ?? _defaultKey;
    ttsEnabled = p.getBool(_kTts) ?? true;
    speakReceived = p.getBool(_kSpeak) ?? true;
    ttsEngine = p.getString(_kEngine) ?? 'kokoro';
    kokoroVoice = p.getInt(_kVoice) ?? 6;
    modelDir = p.getString(_kModelDir) ?? '';
    ambientEnabled = p.getBool(_kAmbient) ?? true;
    notifyListeners();
  }

  Future<void> save({
    String? serverUrl,
    String? token,
    String? beaconKey,
    bool? ttsEnabled,
    bool? speakReceived,
    String? ttsEngine,
    int? kokoroVoice,
    String? modelDir,
    bool? ambientEnabled,
  }) async {
    if (serverUrl != null) this.serverUrl = serverUrl.trim();
    if (token != null) this.token = token.trim();
    if (beaconKey != null) this.beaconKey = beaconKey.trim();
    if (ttsEnabled != null) this.ttsEnabled = ttsEnabled;
    if (speakReceived != null) this.speakReceived = speakReceived;
    if (ttsEngine != null) this.ttsEngine = ttsEngine;
    if (kokoroVoice != null) this.kokoroVoice = kokoroVoice;
    if (modelDir != null) this.modelDir = modelDir.trim();
    if (ambientEnabled != null) this.ambientEnabled = ambientEnabled;

    final p = await SharedPreferences.getInstance();
    await p.setString(_kUrl, this.serverUrl);
    await p.setString(_kToken, this.token);
    await p.setString(_kKey, this.beaconKey);
    await p.setBool(_kTts, this.ttsEnabled);
    await p.setBool(_kSpeak, this.speakReceived);
    await p.setString(_kEngine, this.ttsEngine);
    await p.setInt(_kVoice, this.kokoroVoice);
    await p.setString(_kModelDir, this.modelDir);
    await p.setBool(_kAmbient, this.ambientEnabled);
    notifyListeners();
  }
}
