import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bell,
  Clock3,
  History,
  Library,
  ListMusic,
  Loader2,
  MessageSquare,
  Music2,
  Pause,
  Play,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import type { AnnouncementItem } from "@shared/system";
import type { AppSettings, AppThemeSettings, ThemeMode } from "@shared/settings";
import { DEFAULT_APP_SETTINGS } from "@shared/settings";
import type { MusicSource, SourceGroupedResult, TrackSearchResult } from "@shared/music";
import { MUSIC_SOURCE_LABEL } from "@shared/music";
import type { PlayHistoryItem } from "@shared/library";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { applyTheme } from "@/lib/theme";
import { cn, formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/stores/playerStore";

type RouteKey = "search" | "queue" | "history" | "settings";

const sourceOrder: MusicSource[] = ["kg", "wy", "kw"];

export function App() {
  const [route, setRoute] = useState<RouteKey>("search");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  useEffect(() => {
    void window.pisa.settings.get().then((next) => {
      setSettings(next);
      applyTheme(next.theme);
      setRoute((next.lastRoute as RouteKey) || "search");
      usePlayerStore.getState().setVolume(next.volume);
    });
    void window.pisa.library.getQueueSnapshot().then((snapshot) => {
      if (snapshot) {
        usePlayerStore.getState().restoreQueue(snapshot.queue, snapshot.currentIndex);
      }
    });
    void window.pisa.system.getAnnouncements().then(setAnnouncements).catch(() => setAnnouncements([]));
  }, []);

  useEffect(() => {
    return window.pisa.player.onTrayCommand((command) => {
      const player = usePlayerStore.getState();
      if (command === "toggle-play") player.togglePlay();
      if (command === "previous") void player.previous();
      if (command === "next") void player.next();
    });
  }, []);

  const handleRouteChange = (next: RouteKey) => {
    setRoute(next);
    const updated = { ...settings, lastRoute: next };
    setSettings(updated);
    void window.pisa.settings.save(updated);
  };

  return (
    <div className="grid h-full grid-rows-[1fr_auto] overflow-hidden p-3">
      <div className="grid min-h-0 grid-cols-[236px_1fr_330px] overflow-hidden rounded-lg border bg-background/80 shadow-xl backdrop-blur">
        <Sidebar route={route} onRouteChange={handleRouteChange} announcements={announcements.length} />
        <main className="min-w-0 border-x bg-background/70">
          {route === "search" && <SearchPage />}
          {route === "queue" && <QueuePage />}
          {route === "history" && <HistoryPage />}
          {route === "settings" && (
            <SettingsPage settings={settings} onSettingsChange={setSettings} announcements={announcements} />
          )}
        </main>
        <NowPlayingPanel />
      </div>
      <PlayerBar settings={settings} onSettingsChange={setSettings} />
      <Toaster richColors position="top-right" />
    </div>
  );
}

function Sidebar({ route, onRouteChange, announcements }: { route: RouteKey; onRouteChange: (route: RouteKey) => void; announcements: number }) {
  const nav = [
    { key: "search" as const, label: "聚合搜索", icon: Search },
    { key: "queue" as const, label: "播放队列", icon: ListMusic },
    { key: "history" as const, label: "播放历史", icon: History },
    { key: "settings" as const, label: "设置反馈", icon: Settings },
  ];
  return (
    <aside className="flex min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
          <Music2 />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">PisaMusic</h1>
          <p className="truncate text-xs text-muted-foreground">Desktop Preview</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                route === item.key && "bg-primary/15 text-foreground",
              )}
              onClick={() => onRouteChange(item.key)}
            >
              <Icon />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 p-4">
        <Card className="border-primary/30 bg-primary/10">
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell />
              公告
            </CardTitle>
            <CardDescription>{announcements > 0 ? `${announcements} 条服务端公告可查看` : "暂无新公告"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </aside>
  );
}

function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SourceGroupedResult>({ kg: [], wy: [], kw: [] });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const playTrack = usePlayerStore((state) => state.playTrack);
  const flattened = useMemo(() => sourceOrder.flatMap((source) => results[source]), [results]);

  const runSearch = () => {
    const value = keyword.trim();
    if (!value) return;
    setError("");
    startTransition(() => {
      void window.pisa.library.addSearchHistory(value);
      void window.pisa.music
        .search({ keyword: value, page: 1, pageSize: 20 })
        .then(setResults)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "搜索失败"));
    });
  };

  const handlePlay = (track: TrackSearchResult) => {
    void playTrack(track, flattened);
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex h-20 items-center gap-3 px-6">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runSearch();
            }}
            className="h-12 pl-10 text-base"
            placeholder="搜索歌曲、歌手或专辑"
          />
        </div>
        <Button className="h-12 px-5" onClick={runSearch} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Search />}
          搜索
        </Button>
      </header>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-6">
          {error && <p className="rounded-md border bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {!flattened.length && !error && (
            <Card className="border-dashed bg-card/70">
              <CardHeader>
                <CardTitle>开始一次聚合搜索</CardTitle>
                <CardDescription>结果会按酷狗、网易云、酷我分组展示，点击歌曲即可加入队列并播放。</CardDescription>
              </CardHeader>
            </Card>
          )}
          {sourceOrder.map((source) => (
            <SourceSection key={source} source={source} tracks={results[source]} onPlay={handlePlay} />
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

function SourceSection({ source, tracks, onPlay }: { source: MusicSource; tracks: TrackSearchResult[]; onPlay: (track: TrackSearchResult) => void }) {
  if (!tracks.length) return null;
  return (
    <Card className="overflow-hidden bg-card/85">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>{MUSIC_SOURCE_LABEL[source]}</CardTitle>
          <CardDescription>{tracks.length} 首匹配歌曲</CardDescription>
        </div>
        <Badge variant="secondary">{source.toUpperCase()}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {tracks.map((track) => (
          <TrackRow key={`${track.source}:${track.id}`} track={track} onPlay={() => onPlay(track)} />
        ))}
      </CardContent>
    </Card>
  );
}

function TrackRow({ track, onPlay }: { track: TrackSearchResult; onPlay: () => void }) {
  return (
    <button
      className="grid h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-accent"
      onClick={onPlay}
    >
      <Cover track={track} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {track.quality && <Badge variant="outline">{track.quality}</Badge>}
        <span className="text-xs text-muted-foreground">{formatDuration(track.duration)}</span>
      </div>
    </button>
  );
}

function QueuePage() {
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const playTrack = usePlayerStore((state) => state.playTrack);
  return (
    <section className="flex h-full min-h-0 flex-col">
      <PageHeader title="播放队列" description={`${queue.length} 首歌曲等待播放`} />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-6">
          {queue.map((track, index) => (
            <div key={`${track.source}:${track.id}:${index}`} className={cn(index === currentIndex && "rounded-md bg-primary/10")}>
              <TrackRow track={track} onPlay={() => void playTrack(track, queue)} />
            </div>
          ))}
          {!queue.length && <EmptyBlock title="队列还是空的" description="从聚合搜索里点击一首歌，队列会自动保存。" />}
        </div>
      </ScrollArea>
    </section>
  );
}

function HistoryPage() {
  const [items, setItems] = useState<PlayHistoryItem[]>([]);
  const playTrack = usePlayerStore((state) => state.playTrack);
  useEffect(() => {
    void window.pisa.library.getPlayHistory().then(setItems);
  }, []);
  return (
    <section className="flex h-full min-h-0 flex-col">
      <PageHeader title="播放历史" description="SQLite 保存最近播放记录" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-6">
          {items.map((item) => (
            <TrackRow key={`${item.track.source}:${item.track.id}:${item.playedAt}`} track={item.track} onPlay={() => void playTrack(item.track, items.map((x) => x.track))} />
          ))}
          {!items.length && <EmptyBlock title="暂无播放历史" description="播放成功后，歌曲会出现在这里。" />}
        </div>
      </ScrollArea>
    </section>
  );
}

function SettingsPage({ settings, onSettingsChange, announcements }: { settings: AppSettings; onSettingsChange: (settings: AppSettings) => void; announcements: AnnouncementItem[] }) {
  const [feedback, setFeedback] = useState("");
  const [contact, setContact] = useState("");

  const saveTheme = (patch: Partial<AppThemeSettings>) => {
    const theme = { ...settings.theme, ...patch, version: 1 as const };
    const next = { ...settings, theme };
    onSettingsChange(next);
    applyTheme(theme);
    void window.pisa.settings.saveTheme(theme).then(onSettingsChange);
  };

  const submit = () => {
    const content = feedback.trim();
    if (!content) return;
    void window.pisa.system
      .submitFeedback({ content, contact })
      .then(() => {
        setFeedback("");
        toast.success("反馈已提交");
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "反馈提交失败"));
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <PageHeader title="设置反馈" description="主题配色、公告和反馈入口" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-5 p-6">
          <Card>
            <CardHeader>
              <CardTitle>主题</CardTitle>
              <CardDescription>Pisa Blue 是默认主题，后续可扩展更多预设和自定义取色。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Tabs value={settings.theme.mode} onValueChange={(mode) => saveTheme({ mode: mode as ThemeMode })}>
                <TabsList>
                  <TabsTrigger value="light">浅色</TabsTrigger>
                  <TabsTrigger value="dark">深色</TabsTrigger>
                  <TabsTrigger value="system">跟随系统</TabsTrigger>
                </TabsList>
                <TabsContent value={settings.theme.mode} className="text-sm text-muted-foreground">
                  当前主色：{settings.theme.primaryColor}，圆角：{settings.theme.radius}px
                </TabsContent>
              </Tabs>
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                <span className="text-sm text-muted-foreground">圆角</span>
                <Slider
                  value={[settings.theme.radius]}
                  min={4}
                  max={16}
                  step={1}
                  onValueChange={([radius]) => saveTheme({ radius })}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare />
                反馈
              </CardTitle>
              <CardDescription>复用外层 server 的反馈接口。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="描述你遇到的问题或建议" />
              <Input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="联系方式，可选" />
              <Button className="self-start" onClick={submit}>
                提交反馈
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>公告</CardTitle>
              <CardDescription>启动时从服务端拉取，不做长期持久化。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {announcements.map((item) => (
                <div key={item.id} className="rounded-md border bg-background p-3">
                  <p className="text-sm">{item.content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.publisher} · {item.time}</p>
                </div>
              ))}
              {!announcements.length && <p className="text-sm text-muted-foreground">暂无公告</p>}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </section>
  );
}

function NowPlayingPanel() {
  const current = usePlayerStore((state) => state.currentTrack);
  const queue = usePlayerStore((state) => state.queue);
  const lyrics = usePlayerStore((state) => state.lyrics);
  const lyricCount = current ? (lyrics[`${current.source}:${current.id}`]?.text.split("\n").filter(Boolean).length ?? 0) : 0;
  return (
    <aside className="flex min-h-0 flex-col bg-card/70">
      <PageHeader title="正在播放" description={current ? current.sourceName : "等待选择歌曲"} compact />
      <div className="flex flex-col gap-4 p-5">
        {current ? (
          <>
            <div className="aspect-square overflow-hidden rounded-lg border bg-secondary">
              {current.coverUrl ? <img src={current.coverUrl} alt={current.title} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><Music2 /></div>}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold">{current.title}</h2>
              <p className="truncate text-sm text-muted-foreground">{current.artist}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoTile label="队列" value={`${queue.length} 首`} />
              <InfoTile label="歌词" value={lyricCount > 0 ? `${lyricCount} 行已缓存` : "待获取"} />
            </div>
          </>
        ) : (
          <EmptyBlock title="还没有播放歌曲" description="从搜索结果中选择一首歌开始。" />
        )}
      </div>
    </aside>
  );
}

function PlayerBar({ settings, onSettingsChange }: { settings: AppSettings; onSettingsChange: (settings: AppSettings) => void }) {
  const current = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isLoading = usePlayerStore((state) => state.isLoading);
  const error = usePlayerStore((state) => state.error);
  const progress = usePlayerStore((state) => state.progress);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const updateVolume = (nextVolume: number) => {
    setVolume(nextVolume);
    const updated = { ...settings, volume: nextVolume };
    onSettingsChange(updated);
    void window.pisa.settings.save(updated);
  };

  return (
    <footer className="mt-3 grid h-24 grid-cols-[320px_1fr_260px] items-center gap-5 rounded-lg border bg-player-surface px-5 shadow-xl">
      <div className="grid min-w-0 grid-cols-[52px_1fr] items-center gap-3">
        {current ? <Cover track={current} large /> : <div className="flex size-12 items-center justify-center rounded-md bg-secondary"><Music2 /></div>}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{current?.title ?? "选择一首歌曲开始播放"}</p>
          <p className="truncate text-xs text-muted-foreground">{current?.artist ?? "PisaMusic Desktop"}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="iconSm" onClick={() => void previous()} disabled={!current}>
            <SkipBack />
          </Button>
          <Button size="icon" onClick={togglePlay} disabled={!current || isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button variant="ghost" size="iconSm" onClick={() => void next()} disabled={!current}>
            <SkipForward />
          </Button>
        </div>
        <div className="grid w-full grid-cols-[44px_1fr_44px] items-center gap-3">
          <span className="text-xs text-muted-foreground">{formatDuration(progress)}</span>
          <Slider value={[Math.min(progress, duration || progress)]} max={duration || 1} step={1} onValueChange={([value]) => seek(value)} />
          <span className="text-right text-xs text-muted-foreground">{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Volume2 className="text-muted-foreground" />
        <Slider value={[volume]} max={1} step={0.01} onValueChange={([value]) => updateVolume(value)} />
      </div>
    </footer>
  );
}

function PageHeader({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <header className={cn("flex items-center justify-between border-b px-6", compact ? "h-20" : "h-20")}>
      <div className="min-w-0">
        <h2 className="truncate text-xl font-semibold">{title}</h2>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}

function Cover({ track, large = false }: { track: TrackSearchResult; large?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-md border bg-secondary", large ? "size-12" : "size-11")}>
      {track.coverUrl ? (
        <img src={track.coverUrl} alt={track.title} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Music2 />
        </div>
      )}
    </div>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed bg-card/60">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock3 />
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
