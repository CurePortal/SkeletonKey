import 'package:flutter/material.dart';

import 'beacon_controller.dart';
import 'home_page.dart';
import 'kokoro_tts.dart';
import 'settings.dart';
import 'stt_service.dart';
import 'tts_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final settings = AppSettings();
  await settings.load();
  final tts = TtsService();
  await tts.init();
  final kokoro = KokoroTtsService();
  final stt = SttService();
  final controller = BeaconController(settings, tts, kokoro, stt);
  runApp(BeaconApp(settings: settings, controller: controller));
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (settings.configured) controller.start();
  });
}

class BeaconApp extends StatelessWidget {
  const BeaconApp({
    super.key,
    required this.settings,
    required this.controller,
  });

  final AppSettings settings;
  final BeaconController controller;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SkeletonKey Beacon',
      theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
      darkTheme: ThemeData(
        colorSchemeSeed: Colors.teal,
        brightness: Brightness.dark,
        useMaterial3: true,
      ),
      home: HomePage(settings: settings, controller: controller),
    );
  }
}
