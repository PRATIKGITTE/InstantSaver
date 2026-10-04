#!/usr/bin/env bash
set -e

echo "🔄 Downloading yt-dlp binary..."
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o bin/yt-dlp || \
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod +x bin/yt-dlp
echo "✅ yt-dlp ready at ./bin/yt-dlp"
./bin/yt-dlp --version

# YouTube stopped reliably serving pre-muxed video+audio formats, so downloads now need
# ffmpeg server-side to merge separate video/audio streams into a real playable MP4.
if [ ! -f bin/ffmpeg ]; then
  echo "🔄 Downloading static ffmpeg binary (Linux amd64)..."
  curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz
  mkdir -p /tmp/ffmpeg-extract
  tar -xf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg-extract --strip-components=1
  mv /tmp/ffmpeg-extract/ffmpeg bin/ffmpeg
  chmod +x bin/ffmpeg
  rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg-extract
  echo "✅ ffmpeg ready at ./bin/ffmpeg"
  ./bin/ffmpeg -version | head -1
fi
