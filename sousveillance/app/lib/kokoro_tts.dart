import 'dart:async';
import 'dart:isolate';

import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa;

/// The 11 speakers of kokoro-en-v0_19, indexed by sid.
const List<String> kokoroVoices = [
  'af', // 0 female
  'af_bella', // 1
  'af_nicole', // 2
  'af_sarah', // 3
  'af_sky', // 4
  'am_adam', // 5 male
  'am_michael', // 6 male  <- calm handler default
  'bf_emma', // 7 female (UK)
  'bf_isabella', // 8 female (UK)
  'bm_george', // 9 male (UK)
  'bm_lewis', // 10 male (UK)
];

/// On-device neural TTS (sherpa-onnx + Kokoro), fully offline.
///
/// All model loading and synthesis run in a dedicated background isolate, so
/// the UI never blocks (loading the ~350 MB model on the main thread caused an
/// ANR). Playback happens on the main isolate via audioplayers.
///
/// Files expected in the model dir: model.onnx, voices.bin, tokens.txt and an
/// espeak-ng-data/ directory. [load] returns false if anything is missing or
/// the engine fails to start; the app then falls back to system TTS.
class KokoroTtsService {
  final ReceivePort _rx = ReceivePort();
  final Completer<SendPort> _portReady = Completer<SendPort>();
  final Map<int, Completer<Map<String, dynamic>>> _pending = {};
  Isolate? _isolate;
  SendPort? _toWorker;
  int _nextId = 0;
  bool _loaded = false;
  String? _error;
  int _sid = 6;
  double _speed = 1.0;
  final AudioPlayer _player = AudioPlayer();

  bool get ready => _loaded;
  String? get error => _error;
  int get sid => _sid;
  double get speed => _speed;

  KokoroTtsService() {
    _rx.listen((msg) {
      if (msg is SendPort) {
        if (!_portReady.isCompleted) _portReady.complete(msg);
        return;
      }
      if (msg is Map && msg['id'] is int) {
        _pending.remove(msg['id'] as int)?.complete(msg.cast<String, dynamic>());
      }
    });
  }

  void configure({int? sid, double? speed}) {
    if (sid != null) _sid = sid;
    if (speed != null) _speed = speed;
  }

  Future<SendPort> _worker() async {
    if (_toWorker != null) return _toWorker!;
    _isolate ??= await Isolate.spawn(_kokoroWorker, _rx.sendPort, debugName: 'kokoro-tts');
    _toWorker = await _portReady.future;
    return _toWorker!;
  }

  Future<Map<String, dynamic>> _call(Map<String, dynamic> req) async {
    final port = await _worker();
    final id = _nextId++;
    final c = Completer<Map<String, dynamic>>();
    _pending[id] = c;
    port.send({...req, 'id': id});
    return c.future;
  }

  Future<bool> load(String modelDir) async {
    try {
      final res = await _call({'cmd': 'load', 'dir': modelDir});
      _loaded = res['ok'] == true;
      _error = _loaded ? null : (res['error'] as String?);
    } catch (e) {
      _loaded = false;
      _error = e.toString();
    }
    return _loaded;
  }

  Future<void> speak(String text) async {
    if (!_loaded || text.trim().isEmpty) return;
    try {
      await _player.stop();
      final tmp = await getTemporaryDirectory();
      final path = '${tmp.path}/beacon_kokoro.wav';
      final res = await _call({
        'cmd': 'synth',
        'text': text,
        'sid': _sid,
        'speed': _speed,
        'path': path,
      });
      if (res['ok'] == true) {
        await _player.play(DeviceFileSource(path));
      }
    } catch (_) {
      // best effort; the text is already on screen
    }
  }

  Future<void> stop() async {
    try {
      await _player.stop();
    } catch (_) {}
  }

  void dispose() {
    try {
      _player.dispose();
    } catch (_) {}
    _isolate?.kill(priority: Isolate.immediate);
    _isolate = null;
    _toWorker = null;
    _loaded = false;
  }
}

/// Background isolate: owns the sherpa-onnx engine and does all heavy work.
Future<void> _kokoroWorker(SendPort main) async {
  final rp = ReceivePort();
  main.send(rp.sendPort);

  sherpa.OfflineTts? tts;
  var bindings = false;

  await for (final dynamic m in rp) {
    if (m is! Map) continue;
    final id = m['id'];
    var ok = false;
    String? err;

    if (m['cmd'] == 'load') {
      try {
        if (!bindings) {
          sherpa.initBindings();
          bindings = true;
        }
        tts?.free();
        tts = null;
        final dir = m['dir'] as String;
        tts = sherpa.OfflineTts(
          sherpa.OfflineTtsConfig(
            model: sherpa.OfflineTtsModelConfig(
              numThreads: 2,
              debug: false,
              kokoro: sherpa.OfflineTtsKokoroModelConfig(
                model: '$dir/model.onnx',
                voices: '$dir/voices.bin',
                tokens: '$dir/tokens.txt',
                dataDir: '$dir/espeak-ng-data',
              ),
            ),
          ),
        );
        ok = true;
      } catch (e) {
        err = e.toString();
        tts = null;
      }
      main.send({'id': id, 'ok': ok, 'error': err});
    } else if (m['cmd'] == 'synth') {
      try {
        final engine = tts;
        if (engine == null) throw 'model not loaded';
        final audio = engine.generate(
          text: m['text'] as String,
          sid: (m['sid'] as int?) ?? 6,
          speed: ((m['speed'] as num?) ?? 1.0).toDouble(),
        );
        ok = audio.samples.isNotEmpty &&
            sherpa.writeWave(
              filename: m['path'] as String,
              samples: audio.samples,
              sampleRate: audio.sampleRate,
            );
      } catch (e) {
        err = e.toString();
      }
      main.send({'id': id, 'ok': ok, 'error': err, 'path': m['path']});
    }
  }
}
