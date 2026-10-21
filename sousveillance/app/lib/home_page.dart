import 'package:flutter/material.dart';

import 'beacon_controller.dart';
import 'kokoro_tts.dart';
import 'settings.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.settings, required this.controller});

  final AppSettings settings;
  final BeaconController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([settings, controller]),
      builder: (context, _) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('SkeletonKey Beacon'),
            actions: [
              _LinkChip(state: controller.link),
              IconButton(
                icon: Icon(controller.listening ? Icons.mic : Icons.mic_none),
                color: controller.ambient
                    ? Colors.grey
                    : controller.listening
                    ? Colors.red
                    : null,
                tooltip: controller.ambient
                    ? 'Ambient stream is on'
                    : controller.listening
                    ? 'Stop & send'
                    : 'Ask HQ (push to talk)',
                onPressed: controller.ambient
                    ? null
                    : () => controller.listening
                          ? controller.stopListeningAndSend()
                          : controller.startListening(),
              ),
              IconButton(
                icon: const Icon(Icons.settings),
                tooltip: 'Settings',
                onPressed: () => _openSettings(context),
              ),
            ],
          ),
          body: Column(
            children: [
              _StatusCard(settings: settings, controller: controller),
              const Divider(height: 1),
              Expanded(
                child: controller.messages.isEmpty
                    ? const _Empty()
                    : ListView.builder(
                        reverse: true,
                        // keep the last bubbles clear of the FAB and the
                        // on-screen system navigation buttons.
                        padding: EdgeInsets.fromLTRB(
                          12,
                          12,
                          12,
                          12 + MediaQuery.viewPaddingOf(context).bottom + 84,
                        ),
                        itemCount: controller.messages.length,
                        itemBuilder: (context, i) {
                          final m = controller.messages[i];
                          return _Bubble(message: m);
                        },
                      ),
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () =>
                controller.running ? controller.stop() : controller.start(),
            icon: Icon(controller.running ? Icons.stop : Icons.play_arrow),
            label: Text(controller.running ? 'Stop' : 'Start'),
          ),
        );
      },
    );
  }

  Future<void> _openSettings(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            SettingsPage(settings: settings, controller: controller),
      ),
    );
  }
}

class _LinkChip extends StatelessWidget {
  const _LinkChip({required this.state});
  final LinkState state;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (state) {
      LinkState.online => (Colors.green, 'online'),
      LinkState.connecting => (Colors.orange, 'connecting'),
      LinkState.offline => (Colors.red, 'offline'),
      LinkState.idle => (Colors.grey, 'stopped'),
    };
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Center(
        child: Row(
          children: [
            Icon(Icons.circle, size: 12, color: color),
            const SizedBox(width: 6),
            Text(label),
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.settings, required this.controller});
  final AppSettings settings;
  final BeaconController controller;

  @override
  Widget build(BuildContext context) {
    final p = controller.lastPosition;
    final lines = <String>[
      if (!settings.configured)
        'Not configured — open Settings to enter the server URL and token.',
      if (p != null)
        'Position: ${p.latitude.toStringAsFixed(5)}, ${p.longitude.toStringAsFixed(5)}'
            '  ±${p.accuracy.toStringAsFixed(0)}m'
            '  ${p.speed.toStringAsFixed(1)} m/s',
      if (controller.lastSentAt != null)
        'Last upload: ${_ago(controller.lastSentAt!)}',
      if (controller.lastAmbient != null)
        'Ambient: ${_ambientSnippet(controller.lastAmbient!)}',
      if (controller.error != null) '⚠ ${controller.error}',
    ];
    if (lines.isEmpty) lines.add('Ready.');

    return Container(
      width: double.infinity,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final l in lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text(l, style: Theme.of(context).textTheme.bodyMedium),
            ),
          SwitchListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: const Text('Ambient stream'),
            subtitle: const Text(
              'Continuously transcribe surroundings. No spoken replies.',
            ),
            value: controller.ambient,
            onChanged: (value) async {
              await settings.save(ambientEnabled: value);
              await controller.setAmbient(value);
            },
          ),
        ],
      ),
    );
  }

  static String _ambientSnippet(String value) {
    final clean = value.replaceAll(RegExp(r'\s+'), ' ').trim();
    return clean.length <= 120 ? clean : '${clean.substring(0, 117)}…';
  }

  static String _ago(DateTime t) {
    final s = DateTime.now().difference(t).inSeconds;
    if (s < 60) return '${s}s ago';
    return '${s ~/ 60}m ago';
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});
  final BeaconMessage message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = message.ambient
        ? scheme.surfaceContainerHighest
        : scheme.primaryContainer;
    final fg = message.ambient
        ? scheme.onSurfaceVariant
        : scheme.onPrimaryContainer;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 340),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  message.ambient ? Icons.hearing : Icons.campaign_outlined,
                  size: 14,
                  color: fg,
                ),
                const SizedBox(width: 6),
                Text(
                  message.ambient
                      ? 'ambient · ${_clock(message.at)}'
                      : _clock(message.at),
                  style: TextStyle(fontSize: 11, color: fg),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(message.text, style: TextStyle(color: fg)),
          ],
        ),
      ),
    );
  }

  static String _clock(DateTime t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
}

class _Empty extends StatelessWidget {
  const _Empty();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Text(
          'No messages yet.\nPress Start. Ambient transcripts appear here as they '
          'are heard; agent messages are spoken only when you ask.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
    );
  }
}

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    super.key,
    required this.settings,
    required this.controller,
  });
  final AppSettings settings;
  final BeaconController controller;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final TextEditingController _url = TextEditingController(
    text: widget.settings.serverUrl,
  );
  late final TextEditingController _token = TextEditingController(
    text: widget.settings.token,
  );
  late final TextEditingController _key = TextEditingController(
    text: widget.settings.beaconKey,
  );
  late final TextEditingController _modelDir = TextEditingController(
    text: widget.settings.modelDir,
  );
  late bool _tts = widget.settings.ttsEnabled;
  late bool _speak = widget.settings.speakReceived;
  late String _engine = widget.settings.ttsEngine;
  late int _voice = widget.settings.kokoroVoice;

  @override
  void dispose() {
    _url.dispose();
    _token.dispose();
    _key.dispose();
    _modelDir.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    await widget.settings.save(
      serverUrl: _url.text,
      token: _token.text,
      beaconKey: _key.text,
      ttsEnabled: _tts,
      speakReceived: _speak,
      ttsEngine: _engine,
      kokoroVoice: _voice,
      modelDir: _modelDir.text,
    );
    widget.controller.restart();
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _confirmClear() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear chat history?'),
        content: const Text(
          'Removes all messages shown in this app. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    if (ok == true) {
      widget.controller.clearHistory();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Chat history cleared')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        actions: [TextButton(onPressed: _save, child: const Text('Save'))],
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
          16,
          16,
          16,
          16 + MediaQuery.viewPaddingOf(context).bottom,
        ),
        children: [
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'Server URL',
              hintText: 'https://beacon.example.com',
              helperText: 'Your cloudflared/tailscale address for beacond',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _token,
            autocorrect: false,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Token',
              helperText: 'BEACON_TOKEN from sousveillance/server/.env',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _key,
            autocorrect: false,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Encryption key (optional)',
              helperText:
                  'BEACON_KEY — end-to-end encrypts pings (64 hex chars)',
              border: OutlineInputBorder(),
            ),
          ),
          const Divider(height: 32),
          Text('Voice', style: Theme.of(context).textTheme.titleMedium),
          SwitchListTile(
            value: _tts,
            onChanged: (v) => setState(() => _tts = v),
            title: const Text('Text-to-speech'),
            subtitle: const Text('Speak agent messages aloud (on-device)'),
          ),
          SwitchListTile(
            value: _speak,
            onChanged: (v) => setState(() => _speak = v),
            title: const Text('Speak incoming messages'),
            subtitle: const Text('Turn off to show text only'),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _engine,
            decoration: const InputDecoration(
              labelText: 'Voice engine',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                value: 'kokoro',
                child: Text('Kokoro (neural, offline)'),
              ),
              DropdownMenuItem(
                value: 'system',
                child: Text('System (Android TTS)'),
              ),
            ],
            onChanged: (v) => setState(() => _engine = v ?? 'kokoro'),
          ),
          if (_engine == 'kokoro') ...[
            const SizedBox(height: 16),
            DropdownButtonFormField<int>(
              initialValue: _voice,
              decoration: const InputDecoration(
                labelText: 'Handler voice',
                border: OutlineInputBorder(),
              ),
              items: [
                for (var i = 0; i < kokoroVoices.length; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text('$i · ${kokoroVoices[i]}'),
                  ),
              ],
              onChanged: (v) => setState(() => _voice = v ?? 6),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                widget.controller.kokoroReady
                    ? 'Neural voice loaded.'
                    : 'Neural voice unavailable — using system voice.'
                          '${widget.controller.kokoroError != null ? '\n${widget.controller.kokoroError}' : ' Push the model with adb (see README).'}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            TextButton.icon(
              onPressed: () {
                widget.controller.loadKokoro();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Reloading voice model…')),
                );
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Reload voice model'),
            ),
            TextField(
              controller: _modelDir,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Model folder (advanced)',
                helperText: 'Leave blank for the default app folder',
                border: OutlineInputBorder(),
              ),
            ),
          ],
          const Divider(height: 32),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _confirmClear,
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              label: const Text(
                'Clear chat history',
                style: TextStyle(color: Colors.red),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
