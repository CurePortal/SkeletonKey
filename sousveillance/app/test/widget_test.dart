// Minimal smoke test. The app needs a running server + location permission, so
// we assert the local defaults that hold without any platform channels.
import 'package:flutter_test/flutter_test.dart';

import 'package:beacon/settings.dart';

void main() {
  test('settings default to unconfigured with TTS on', () {
    final s = AppSettings();
    expect(s.configured, false);
    expect(s.ttsEnabled, true);
    expect(s.speakReceived, true);
  });
}
