import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Widget gambar ruangan yang mendukung URL HTTP/HTTPS maupun Data URL (Base64)
class RoomImage extends StatelessWidget {
  final String imageUrl;
  final double? width;
  final double? height;
  final BoxFit fit;

  const RoomImage({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  });

  Uint8List? _tryDecodeDataUri(String uri) {
    if (!uri.startsWith('data:image')) return null;
    try {
      final commaIdx = uri.indexOf(',');
      if (commaIdx < 0) return null;
      final base64Part = uri.substring(commaIdx + 1);
      return base64Decode(base64Part);
    } catch (_) {
      return null;
    }
  }

  Widget _fallback() {
    return Container(
      width: width,
      height: height,
      color: AppTheme.surfaceContainerHigh,
      child: const Center(
        child: Icon(Icons.meeting_room_rounded, size: 42, color: AppTheme.outline),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bytes = _tryDecodeDataUri(imageUrl);
    if (bytes != null) {
      return Image.memory(
        bytes,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, __, ___) => _fallback(),
      );
    }

    return Image.network(
      imageUrl,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (_, __, ___) => _fallback(),
    );
  }
}
