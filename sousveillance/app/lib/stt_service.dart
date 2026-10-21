import 'dart:async';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa;

/// On-device speech-to-text via sherpa-onnx + Whisper (base.en, int8). Fully
/// offline — the audio never leaves the phone. Runs in a background isolate so
/// decoding never blocks the UI.
///
/// Expected files in [modelDir]: base.en-encoder.int8.onnx,
/// base.en-decoder.int8.onnx, base.en-tokens.txt.
class SttService {
  final ReceivePort _rx = ReceivePort();
  final Completer<SendPort> _portReady = Completer<SendPort>();
  final Map<int, Completer<Map<String, dynamic>>> _pending = {};
  Isolate? _isolate;
  SendPort? _toWorker;
  int _nextId = 0;
  bool _loaded = false;
  String? _error;

  bool get ready => _loaded;
  String? get error => _error;

  SttService() {
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

  Future<SendPort> _worker() async {
    if (_toWorker != null) return _toWorker!;
    _isolate ??= await Isolate.spawn(_sttWorker, _rx.sendPort, debugName: 'stt');
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

  Future<String?> transcribe(Float32List samples) async {
    if (!_loaded || samples.isEmpty) return null;
    try {
      final res = await _call({'cmd': 'transcribe', 'samples': samples});
      return res['ok'] == true ? (res['text'] as String?) : null;
    } catch (_) {
      return null;
    }
  }

  void dispose() {
    _isolate?.kill(priority: Isolate.immediate);
    _isolate = null;
    _toWorker = null;
    _loaded = false;
  }
}

Future<void> _sttWorker(SendPort main) async {
  final rp = ReceivePort();
  main.send(rp.sendPort);

  sherpa.OfflineRecognizer? rec;
  var bindings = false;

  await for (final dynamic m in rp) {
    if (m is! Map) continue;
    final id = m['id'];
    var ok = false;
    String? err;
    var text = "";

    if (m['cmd'] == 'load') {
      try {
        if (!bindings) {
          sherpa.initBindings();
          bindings = true;
        }
        final dir = m['dir'] as String;
        rec = sherpa.OfflineRecognizer(
          sherpa.OfflineRecognizerConfig(
            model: sherpa.OfflineModelConfig(
              whisper: sherpa.OfflineWhisperModelConfig(
                encoder: '$dir/base.en-encoder.int8.onnx',
                decoder: '$dir/base.en-decoder.int8.onnx',
                language: 'en',
                task: 'transcribe',
              ),
              tokens: '$dir/base.en-tokens.txt',
              numThreads: 2,
              debug: false,
              provider: 'cpu',
            ),
          ),
        );
        ok = true;
      } catch (e) {
        err = e.toString();
        rec = null;
      }
      main.send({'id': id, 'ok': ok, 'error': err});
    } else if (m['cmd'] == 'transcribe') {
      try {
        final engine = rec;
        if (engine == null) throw 'model not loaded';
        final samples = m['samples'] as Float32List;
        final stream = engine.createStream();
        stream.acceptWaveform(samples: samples, sampleRate: 16000);
        engine.decode(stream);
        text = engine.getResult(stream).text.trim();
        ok = true;
      } catch (e) {
        err = e.toString();
      }
      main.send({'id': id, 'ok': ok, 'error': err, 'text': text});
    }
  }
}
