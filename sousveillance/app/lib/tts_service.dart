import 'package:flutter_tts/flutter_tts.dart';

/// On-device text-to-speech. Uses the phone's built-in TTS engine, so it works
/// offline with no model download and no round-trip to the home machine.
class TtsService {
  final FlutterTts _tts = FlutterTts();
  bool _ready = false;

  Future<void> init() async {
    try {
      await _tts.setLanguage('en-US');
      await _tts.setSpeechRate(0.5);
      await _tts.setPitch(1.0);
      await _tts.setVolume(1.0);
      await _tts.awaitSpeakCompletion(true);
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  Future<void> speak(String text) async {
    if (!_ready) await init();
    if (!_ready) return;
    await _tts.stop(); // don't stack utterances
    await _tts.speak(text);
  }

  Future<void> stop() => _tts.stop();
}
