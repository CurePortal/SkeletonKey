import 'dart:async';
import 'dart:convert';
import 'dart:math' show pow;

import 'package:battery_plus/battery_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'crypto.dart';
import 'kokoro_tts.dart';
import 'settings.dart';
import 'stt_service.dart';
import 'tts_service.dart';

/// One line in the transcript shown on screen.
class BeaconMessage {
  BeaconMessage(this.text, {required this.received, this.ambient = false});
  final String text;
  final bool received; // true = from the agent, false = local status
  final bool ambient; // true = background stream, never spoken
  final DateTime at = DateTime.now();
}

enum LinkState { idle, connecting, online, offline }

/// The brain of the app: keeps a live WebSocket to beacond (downlink), streams
/// location up (uplink), and speaks incoming agent messages with on-device TTS.
class BeaconController extends ChangeNotifier {
  BeaconController(this.settings, this.tts, this.kokoro, this.stt);

  final AppSettings settings;
  final TtsService tts;
  final KokoroTtsService kokoro;
  final SttService stt;

  LinkState link = LinkState.idle;
  final List<BeaconMessage> messages = [];
  Position? lastPosition;
  DateTime? lastSentAt;
  String? error;
  bool kokoroReady = false;
  bool sttReady = false;
  bool listening = false;
  bool ambient = false;
  String? lastAmbient;
  Timer? _ambientTimer;
  bool _ambientBusy = false;
  String? sttError;
  String? get kokoroError => kokoro.error;

  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  StreamSubscription<Position>? _posSub;
  StreamSubscription? _baroSub;
  StreamSubscription? _micSub;
  Timer? _reconnectTimer;
  bool _running = false;
  double?
  _pressureHpa; // latest barometric pressure (hPa), if the device has a barometer
  final AudioRecorder _rec = AudioRecorder();
  final List<int> _micBytes = [];
  static const MethodChannel _ambientService = MethodChannel('beacon/ambient');

  bool get running => _running;

  BeaconCrypto get _crypto => BeaconCrypto(settings.beaconKey);

  String get _base => settings.serverUrl.trim().replaceAll(RegExp(r'/+$'), '');

  Uri get _wsUri {
    final base = Uri.parse(_base);
    final path = '${base.path}/stream'.replaceAll('//', '/');
    return base.replace(
      scheme: base.scheme == 'https' ? 'wss' : 'ws',
      path: path,
      queryParameters: {'token': settings.token},
    );
  }

  void start() {
    if (!settings.configured) {
      error = 'Set the server URL and token in Settings first.';
      notifyListeners();
      return;
    }
    _running = true;
    error = null;
    _openSocket();
    _startLocation();
    _startSensors();
    loadKokoro(); // best-effort; falls back to system TTS until ready
    loadStt(); // best-effort; STT also loads lazily on first use
    if (settings.ambientEnabled) {
      Future.delayed(const Duration(milliseconds: 800), () {
        if (_running && !ambient) startAmbient();
      });
    }
    notifyListeners();
  }

  void stop() {
    _running = false;
    ambient = false;
    _ambientTimer?.cancel();
    _ambientTimer = null;
    unawaited(_setAmbientService(false));
    _reconnectTimer?.cancel();
    _sub?.cancel();
    _posSub?.cancel();
    _baroSub?.cancel();
    _micSub?.cancel();
    _rec.stop().then((_) {}, onError: (_) {});
    _channel?.sink.close();
    _channel = null;
    _sub = null;
    _posSub = null;
    _baroSub = null;
    link = LinkState.idle;
    notifyListeners();
  }

  void restart() {
    final was = _running;
    stop();
    if (was || settings.configured) start();
  }

  // --- downlink -------------------------------------------------------------

  void _openSocket() {
    link = LinkState.connecting;
    notifyListeners();
    try {
      final ch = WebSocketChannel.connect(_wsUri);
      _channel = ch;
      _sub = ch.stream.listen(
        _onData,
        onDone: () => _scheduleReconnect('socket closed'),
        onError: (e) => _scheduleReconnect('socket error'),
        cancelOnError: true,
      );
      link = LinkState.online;
      notifyListeners();
    } catch (e) {
      _scheduleReconnect('connect failed: $e');
    }
  }

  void _scheduleReconnect(String reason) {
    _channel = null;
    if (!_running) return;
    link = LinkState.offline;
    error = reason;
    notifyListeners();
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), _openSocket);
  }

  void _onData(dynamic data) {
    _handleData(data);
  }

  Future<void> _handleData(dynamic data) async {
    Map<String, dynamic> raw;
    try {
      raw = jsonDecode(data as String) as Map<String, dynamic>;
    } catch (_) {
      return;
    }

    var m = raw;
    if (settings.beaconKey.trim().isNotEmpty) {
      if (!BeaconCrypto.isEnvelope(raw)) return; // expected an encrypted frame
      try {
        m = await _crypto.decrypt(raw);
      } catch (_) {
        return; // bad key / tampered frame
      }
    }

    link = LinkState.online;
    error = null;
    switch (m['type']) {
      case 'say':
        final text = (m['text'] ?? '').toString().trim();
        if (text.isNotEmpty) {
          messages.insert(0, BeaconMessage(text, received: true));
          _speak(text);
        }
        break;
      case 'hello':
      case 'ack':
      case 'pong':
        break;
    }
    notifyListeners();
  }

  Future<void> _speak(String text) async {
    if (ambient) return; // ambient stream never talks back
    if (!settings.ttsEnabled || !settings.speakReceived) return;
    if (settings.ttsEngine == 'kokoro' && kokoro.ready) {
      kokoro.configure(sid: settings.kokoroVoice);
      await kokoro.speak(text);
    } else {
      await tts.speak(text);
    }
  }

  /// Directory holding the Kokoro model files. Empty setting -> app external
  /// files dir + /kokoro (where `adb push` places them).
  Future<String> modelDir() async {
    if (settings.modelDir.trim().isNotEmpty) return settings.modelDir.trim();
    final ext = await getExternalStorageDirectory();
    if (ext == null) return '';
    return '${ext.path}/kokoro';
  }

  /// Try to load the neural voice in the background; safe to call repeatedly.
  Future<void> loadKokoro() async {
    final dir = await modelDir();
    if (dir.isEmpty) return;
    final ok = await kokoro.load(dir);
    kokoroReady = ok;
    notifyListeners();
  }

  void clearHistory() {
    messages.clear();
    notifyListeners();
  }

  // --- voice uplink (on-device STT -> text -> HQ) ---------------------------

  /// Directory holding the Whisper STT model files. Default: app external
  /// files dir + /stt (where `adb push` places them).
  Future<String> sttModelDir() async {
    final ext = await getExternalStorageDirectory();
    if (ext == null) return '';
    return '${ext.path}/stt';
  }

  Future<void> loadStt() async {
    final dir = await sttModelDir();
    if (dir.isEmpty) return;
    sttReady = await stt.load(dir);
    notifyListeners();
  }

  Future<void> startListening() async {
    if (ambient) {
      sttError = 'Ambient stream is on. Turn it off to ask a question.';
      notifyListeners();
      return;
    }
    if (listening) return;
    try {
      if (!await _rec.hasPermission()) {
        sttError = 'Microphone permission denied.';
        notifyListeners();
        return;
      }
      _micBytes.clear();
      final stream = await _rec.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
        ),
      );
      _micSub = stream.listen((chunk) => _micBytes.addAll(chunk));
      listening = true;
      sttError = null;
      notifyListeners();
    } catch (e) {
      sttError = 'mic: $e';
      notifyListeners();
    }
  }

  Future<void> stopListeningAndSend() async {
    if (!listening) return;
    listening = false;
    notifyListeners();
    try {
      await _rec.stop();
    } catch (_) {}
    await _micSub?.cancel();
    _micSub = null;

    if (!stt.ready) await loadStt();
    final samples = _pcm16ToF32(_micBytes);
    _micBytes.clear();
    final text = await stt.transcribe(samples);
    if (text == null || text.isEmpty) {
      sttError = 'Didn\'t catch that — try again.';
      notifyListeners();
      return;
    }
    messages.insert(0, BeaconMessage(text, received: false));
    notifyListeners();
    await _sendAsk(text);
  }

  // --- ambient stream (continuous microphone -> silent SkeletonKey updates) --

  Future<void> setAmbient(bool on) async {
    if (on) {
      await startAmbient();
    } else {
      await stopAmbient();
    }
  }

  Future<void> startAmbient() async {
    if (ambient) return;
    if (!_running) start();
    if (!settings.configured) {
      error = 'Set the server URL and token in Settings first.';
      notifyListeners();
      return;
    }
    if (!await _rec.hasPermission()) {
      sttError = 'Microphone permission denied.';
      notifyListeners();
      return;
    }
    if (!stt.ready) await loadStt();
    _micBytes.clear();
    await _setAmbientService(true);
    try {
      final stream = await _rec.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
        ),
      );
      _micSub = stream.listen((chunk) => _micBytes.addAll(chunk));
    } catch (e) {
      await _setAmbientService(false);
      sttError = 'ambient mic: $e';
      notifyListeners();
      return;
    }
    ambient = true;
    sttError = null;
    notifyListeners();
    _ambientTimer?.cancel();
    _ambientTimer = Timer.periodic(
      const Duration(seconds: 8),
      (_) => _flushAmbient(),
    );
  }

  Future<void> stopAmbient() async {
    if (!ambient) return;
    _ambientTimer?.cancel();
    _ambientTimer = null;
    await _flushAmbient();
    ambient = false;
    try {
      await _rec.stop();
    } catch (_) {}
    await _micSub?.cancel();
    _micSub = null;
    await _setAmbientService(false);
    notifyListeners();
  }

  Future<void> _setAmbientService(bool on) async {
    try {
      await _ambientService.invokeMethod(on ? 'start' : 'stop');
    } catch (_) {
      // Non-Android or method channel unavailable.
    }
  }

  Future<void> _flushAmbient() async {
    if (_ambientBusy || _micBytes.isEmpty) return;
    _ambientBusy = true;
    final bytes = List<int>.from(_micBytes);
    _micBytes.clear();
    try {
      if (!stt.ready) await loadStt();
      final text = await stt.transcribe(_pcm16ToF32(bytes));
      final clean = text?.trim() ?? '';
      if (!_looksLikeSpeech(clean)) return;
      lastAmbient = clean;
      messages.insert(0, BeaconMessage(clean, received: false, ambient: true));
      notifyListeners();
      await _sendAmbient(clean);
    } finally {
      _ambientBusy = false;
    }
  }

  bool _looksLikeSpeech(String text) {
    final lower = text
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9 ]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (lower.length < 4) return false;
    const noise = {'sound', 'buzzer', 'blank audio', 'music', 'silence'};
    return !noise.contains(lower);
  }

  Future<void> _sendAmbient(String text) async {
    final frame = await _crypto.encrypt({'type': 'ambient', 'text': text});
    final ch = _channel;
    if (link == LinkState.online && ch != null) {
      try {
        ch.sink.add(jsonEncode(frame));
        return;
      } catch (_) {}
    }
    try {
      await http.post(
        Uri.parse('$_base/ambient'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${settings.token}',
        },
        body: jsonEncode(frame),
      );
    } catch (e) {
      sttError = 'ambient send failed: $e';
      notifyListeners();
    }
  }

  static Float32List _pcm16ToF32(List<int> bytes) {
    final n = bytes.length ~/ 2;
    final out = Float32List(n);
    for (var i = 0; i < n; i++) {
      var s = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
      if (s >= 32768) s -= 65536;
      out[i] = s / 32768.0;
    }
    return out;
  }

  Future<void> _sendAsk(String text) async {
    final frame = await _crypto.encrypt({'type': 'ask', 'text': text});
    final ch = _channel;
    if (link == LinkState.online && ch != null) {
      try {
        ch.sink.add(jsonEncode(frame));
        return;
      } catch (_) {}
    }
    try {
      await http.post(
        Uri.parse('$_base/ask'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${settings.token}',
        },
        body: jsonEncode(frame),
      );
    } catch (e) {
      sttError = 'send failed: $e';
      notifyListeners();
    }
  }

  // --- uplink ---------------------------------------------------------------

  Future<void> _startLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        error = 'Location services are off.';
        notifyListeners();
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        error = 'Location permission denied.';
        notifyListeners();
        return;
      }

      _posSub =
          Geolocator.getPositionStream(
            locationSettings: AndroidSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 10, // metres between updates
              intervalDuration: const Duration(seconds: 15),
              // Use the platform location service instead of Google's fused
              // provider: works on de-Googled phones and without Play Services.
              forceLocationManager: true,
              foregroundNotificationConfig: const ForegroundNotificationConfig(
                notificationTitle: 'Beacon active',
                notificationText: 'Sharing your location with your agent',
                notificationChannelName: 'Beacon location',
                enableWakeLock: true,
                setOngoing: true,
              ),
            ),
          ).listen(
            _sendPosition,
            onError: (e) {
              error = 'location: $e';
              notifyListeners();
            },
          );
    } catch (e) {
      error = 'location: $e';
      notifyListeners();
    }
  }

  void _startSensors() {
    try {
      _baroSub = barometerEventStream(
        samplingPeriod: SensorInterval.normalInterval,
      ).listen((e) => _pressureHpa = e.pressure, onError: (_) {});
    } catch (_) {
      // no barometer on this device
    }
  }

  void _sendPosition(Position p) {
    lastPosition = p;
    _pushPosition(p).whenComplete(notifyListeners);
  }

  Future<void> _pushPosition(Position p) async {
    int? battery;
    try {
      battery = await Battery().batteryLevel;
    } catch (_) {}

    final pressure = _pressureHpa;
    double? altitude = p.altitude;
    if (pressure != null && pressure > 0) {
      // Barometric altitude (ISA): 44330 * (1 - (P/P0)^(1/5.255))
      altitude = 44330.0 * (1 - pow(pressure / 1013.25, 1 / 5.255));
    }

    final payload = <String, dynamic>{
      'type': 'pos',
      'lat': p.latitude,
      'lon': p.longitude,
      'speed': p.speed,
      'heading': p.heading,
      'accuracy': p.accuracy,
      'altitude': altitude,
      'pressure': pressure,
      'battery': battery,
      'ts': DateTime.now().millisecondsSinceEpoch,
    };
    final frame = await _crypto.encrypt(payload); // no-op when no key

    final ch = _channel;
    if (link == LinkState.online && ch != null) {
      try {
        ch.sink.add(jsonEncode(frame));
        lastSentAt = DateTime.now();
      } catch (_) {
        await _postHttp(frame);
      }
    } else {
      await _postHttp(frame);
    }
  }

  Future<void> _postHttp(Map<String, dynamic> payload) async {
    if (!settings.configured) return;
    try {
      final r = await http.post(
        Uri.parse('$_base/beacon'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${settings.token}',
        },
        body: jsonEncode(payload),
      );
      if (r.statusCode == 200) {
        lastSentAt = DateTime.now();
        error = null;
      } else {
        error = 'send failed: HTTP ${r.statusCode}';
      }
    } catch (e) {
      error = 'send failed: $e';
    }
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
