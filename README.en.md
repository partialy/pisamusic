# PISA Music

An Android application that aggregates music from multiple platforms, supporting search, playback, and download of songs from Kugou Music, NetEase Cloud Music, and Kuwo Music.

## Features

### Core Features
- **Multi-source Music Search**: Simultaneously search for songs across Kugou, NetEase Cloud, and Kuwo platforms
- **Online Playback**: Smooth playback of music from all platforms with quality selection options
- **Lyrics Display**: Scrolling lyrics with customizable color themes
- **Song Download**: Download high-quality music to your device
- **Playlist Management**: Favorite playlists and manage local playback lists

### My Music
- **Favorite Songs**: One-tap favorite songs
- **Local Music**: Scan and manage audio files stored on your device
- **Download Management**: View and manage downloaded music

### Playback Features
- **Playback Modes**: Sequential, shuffle, and single-loop playback
- **Quality Selection**: Automatically select optimal audio quality based on network conditions
- **Mini Player**: Persistent mini player at the bottom of the screen

### Other Features
- **Theme Switching**: Support for light, dark, and system-following themes
- **Playlist Import**: Import playlists from Kugou and NetEase Cloud Music

## Project Structure

```
pisamusic/
├── pm/                      # Android main application
│   ├── app/src/main/
│   │   ├── java/cn/partialy/pm/
│   │   │   ├── activity/    # Activity screens
│   │   │   ├── di/          # Dependency injection modules
│   │   │   ├── model/       # Data models
│   │   │   ├── network/     # Network layer
│   │   │   ├── player/      # Player core
│   │   │   ├── ui/          # UI components
│   │   │   └── utils/       # Utility classes
│   │   └── assets/          # Static resources
│   └── build.gradle.kts
├── server/                  # Backend service
│   ├── admin/               # Admin panel
│   ├── frontend/            # Official homepage
│   └── src/                 # Server-side code
└── yixi/                    # Desktop app (Electron)
    ├── electron/            # Electron main process
    └── src/                 # Vue render process
```

## Technology Stack

### Android
- **Language**: Kotlin
- **Architecture**: MVVM + Clean Architecture
- **Dependency Injection**: Hilt
- **Networking**: Retrofit + OkHttp
- **Database**: Room + SQLite
- **Player**: ExoPlayer (Media3)
- **Asynchronous Operations**: Kotlin Coroutines + Flow

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: better-sqlite3

### Desktop
- **Framework**: Electron + Vue 3
- **Build Tool**: electron-vite

## Build and Run

### Android App

```bash
# Navigate to project directory
cd pm

# View available tasks
./gradlew tasks

# Debug build
./gradlew assembleDebug

# Release build
./gradlew assembleRelease
```

### Backend Service

```bash
cd server

# Install dependencies
npm install

# Start server
npm run start
```

### Desktop App

```bash
cd yixi

# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build
```

## Network APIs

The project uses a multi-source aggregation architecture with primary data sources:

- **Kugou Music**: Recommended songs, playlist search, song playback
- **NetEase Cloud Music**: Cloud storage search, lyric retrieval
- **Kuwo Music**: Music search

## License

This project is intended solely for learning and communication purposes. Please respect the terms of service of each platform and do not use it for commercial purposes.