# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

- **Debug build**: `./gradlew assembleDebug`
- **Release build**: `./gradlew assembleRelease`
- **Install debug**: `./gradlew installDebug`
- **Clean**: `./gradlew clean`
- **No separate test suite exists** — testing is manual via device/emulator

Debug server: `http://192.168.9.100:53380/`, Release: `https://pm-server.hs.partialy.cn/`

## Architecture

Single-module (`:app`) Android music player app, MVVM pattern with Hilt DI. No Room database — persistence uses SharedPreferences + kotlinx.serialization JSON files.

### Player (Facade Pattern)

`MusicController` is the single entry point, delegates to:
- `PlaylistManager` — playlist state (StateFlow), play-next queue, ExoPlayer media items
- `PlayerEngine` — ExoPlayer + MediaSession lifecycle, playback events, progress, play modes
- `PlayUrlGetter` — resolves KG/WY/KW stream URLs with quality fallback
- `MediaItemFactory` — placeholder pattern: creates unresolved MediaItems, lazily resolved on playback via PlayUrlGetter
- `PlayerStateStore` — SharedPreferences + kotlinx.serialization for cross-session state persistence
- `MusicService` — foreground MediaSessionService, notification management

### Network (Multi-Source)

Three music sources with parallel structure: each has `ApiService` (Retrofit interface) + `UrlProxyApiService` (proxy for URLs) + `Repository` (@Singleton):
- **Kugou (KG)** — search, playlists, recommend, song URL, lyrics
- **NetEase Cloud (WY)** — cloud search, song URL v1/legacy, lyrics, download
- **Kuwo (KW)** — search, play URL, download

`ConfigManager` (@Singleton) fetches runtime endpoint URLs from the system server at startup, dynamically configures Retrofit base URLs. `NetworkModule` provides OkHttpClient and Retrofit instances for each source.

### Persistence

| Component | Storage | Content |
|---|---|---|
| `SettingsPrefs` | SharedPreferences | Theme, play mode, download naming, cache prefs |
| `LoveManager` | JSON file | Liked songs list |
| `PlaylistCollectionManager` | JSON file | Collected playlists |
| `PlayerStateStore` | SharedPreferences + kotlinx.serialization | Player state across sessions |
| `PersistedUserCookieStore` | Cookie persistence | KG/WY login sessions |

### Data Flow

```
UI (Activity/Fragment) → ViewModel (@HiltViewModel) → Repository (@Singleton) → Retrofit ApiService → Remote API
                           → MusicController (Facade)
                                → PlaylistManager (StateFlow)
                                → PlayerEngine (ExoPlayer + MediaSession)
                                → PlayUrlGetter → Repository (URL resolution)
```

## Key Patterns & Conventions

- **DI**: All Activities/Fragments use `@AndroidEntryPoint`, ViewModels use `@HiltViewModel` with `@Inject` constructor
- **Base classes**: `BaseActivity` injects `loveManager` + `musicController`; `BaseSongFragment` provides shared song list behavior
- **View binding**: Enabled (`viewBinding = true`), no DataBinding
- **Coroutines**: ViewModels use `viewModelScope.launch`; Repositories are suspend-based
- **State**: UI state via `StateFlow`/`MutableStateFlow`, not LiveData
- **Song type**: `SongInfo` has a `SongType` enum (`KG`, `WY`, `KW`, `LOCAL`) — determines which repository handles the song
- **Cookie auth**: KG/WY login uses cookie-based auth with interceptors; `DfidInterceptor` injects Kugou device fingerprint
- **Serialization**: Network models use Gson (Retrofit converter); Player state uses kotlinx.serialization; `SongInfo` is a data class
- **Image loading**: Both Coil and Glide are used in the project

## Server Module

A Node.js backend exists at `server/` providing the system API (bootstrap config, announcements, updates, agreements). It has a web admin panel at `server/admin/`. The Android app's `SYSTEM_SERVICE_BASE_URL` points to this server.