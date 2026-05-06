import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  Clock3,
  Download,
  Heart,
  Home,
  ListMusic,
  Loader2,
  Maximize2,
  Menu,
  MessageSquare,
  Minimize2,
  Music,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { applyTheme } from "@/lib/theme";
import { cn, formatDuration } from "@/lib/utils";
import { usePlayerStore } from "@/stores/playerStore";

type RouteKey = "search" | "queue" | "history" | "settings";

const sourceOrder: MusicSource[] = ["kg", "wy", "kw"];
const channelTabs = ["推荐", "乐库", "歌单", "频道", "分类", "视频", "AI帮唱", "金币中心"];

const featureCards = [
  { title: "猜你喜欢", desc: "根据你的听歌口味推荐", tone: "from-[#78D8D2] to-[#4BB8C8]", cover: "bg-[#eefcff]" },
  { title: "每日推荐", desc: "强推！收藏 10w+", tone: "from-[#F079BE] to-[#D45DAE]", cover: "bg-[#fff0f8]" },
  { title: "排行榜", desc: "热门之选，潮流必备", tone: "from-[#7B78EA] to-[#655BD3]", cover: "bg-[#f1f0ff]" },
  { title: "歌单广场", desc: "歌单潮音，一键畅享", tone: "from-[#6DD0CF] to-[#52BABA]", cover: "bg-[#eefdfb]" },
  { title: "歌手", desc: "歌手精选，一键播放", tone: "from-[#F29155] to-[#E37439]", cover: "bg-[#fff4ec]" },
];

const recommendationCards = [
  { tag: "流行", plays: "790.4万", title: "仲夏蝉鸣声响，爱意贯穿心脏", tone: "bg-[#D8A447]" },
  { tag: "轻音乐", plays: "2322万", title: "治愈轻音：沉溺在动漫中的美好时光", tone: "bg-[#AFCEDF]" },
  { tag: "日语", plays: "77.1万", title: "日语说唱：街头嘻哈文化正在入侵", tone: "bg-[#475C76]" },
  { tag: "流行", plays: "534.7万", title: "夜色温柔，适合循环一整晚", tone: "bg-[#AB7ACD]" },
  { tag: "华语", plays: "891万", title: "把故事写进旋律，慢慢听完", tone: "bg-[#C75F69]" },
  { tag: "轻音乐", plays: "1204万", title: "清晨通勤，留一点松弛感", tone: "bg-[#90B6A8]" },
];

export function App() {
  const [route, setRoute] = useState<RouteKey>("search");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SourceGroupedResult>({ kg: [], wy: [], kw: [] });
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const playTrack = usePlayerStore((state) => state.playTrack);

  const flattened = useMemo(() => sourceOrder.flatMap((source) => results[source]), [results]);

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

  const runSearch = () => {
    const value = keyword.trim();
    if (!value || isSearching) return;
    setRoute("search");
    setSearchError("");
    setIsSearching(true);
    void window.pisa.library.addSearchHistory(value);
    void window.pisa.music
      .search({ keyword: value, page: 1, pageSize: 20 })
      .then(setResults)
      .catch((error: unknown) => setSearchError(error instanceof Error ? error.message : "搜索失败"))
      .finally(() => setIsSearching(false));
  };

  const handlePlay = (track: TrackSearchResult) => {
    void playTrack(track, flattened.length ? flattened : [track]);
  };

  return (
    <div className="grid h-full grid-cols-[276px_minmax(0,1fr)] grid-rows-[72px_minmax(0,1fr)_96px] overflow-hidden bg-background">
      <Sidebar route={route} onRouteChange={handleRouteChange} announcements={announcements.length} />
      <TopBar
        keyword={keyword}
        setKeyword={setKeyword}
        onSearch={runSearch}
        isSearching={isSearching}
        activeRoute={route}
        onRouteChange={handleRouteChange}
      />
      <main className="min-h-0 min-w-0 overflow-hidden bg-[linear-gradient(180deg,#f5faff_0%,#fbfdff_36%,#ffffff_100%)]">
        {route === "search" && (
          <SearchPage
            results={results}
            error={searchError}
            isSearching={isSearching}
            hasKeyword={Boolean(keyword.trim())}
            onPlay={handlePlay}
          />
        )}
        {route === "queue" && <QueuePage />}
        {route === "history" && <HistoryPage />}
        {route === "settings" && (
          <SettingsPage settings={settings} onSettingsChange={setSettings} announcements={announcements} />
        )}
      </main>
      <PlayerBar settings={settings} onSettingsChange={setSettings} />
      <Toaster richColors position="top-right" />
    </div>
  );
}

function TopBar({
  keyword,
  setKeyword,
  onSearch,
  isSearching,
  activeRoute,
  onRouteChange,
}: {
  keyword: string;
  setKeyword: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  activeRoute: RouteKey;
  onRouteChange: (route: RouteKey) => void;
}) {
  return (
    <header className="app-drag grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/70 bg-[#f6fbff]/88 px-6 backdrop-blur">
      <div className="flex min-w-0 items-center gap-4">
        <Button variant="ghost" size="iconSm" className="app-no-drag rounded-full text-muted-foreground">
          <ChevronDown className="rotate-90" />
        </Button>
        <Button variant="ghost" size="iconSm" className="app-no-drag rounded-full text-muted-foreground">
          <RotateCcw />
        </Button>
        <div className="app-no-drag relative w-[292px] max-w-[36vw]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            className="h-11 rounded-full border-[#d6e5f8] bg-white/82 pl-11 pr-12 text-[15px] shadow-[inset_0_1px_5px_rgba(65,121,177,0.12)] focus-visible:ring-[#80c5ff]"
            placeholder="搜索"
          />
          <Button
            variant="ghost"
            size="iconSm"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#eaf4ff] text-primary hover:bg-[#ddecff]"
            onClick={onSearch}
            disabled={isSearching}
          >
            {isSearching ? <Loader2 className="animate-spin" /> : <Music />}
          </Button>
        </div>
        <nav className="ml-3 hidden min-w-0 items-center gap-8 xl:flex">
          {channelTabs.map((tab, index) => (
            <button
              key={tab}
              className={cn(
                "app-no-drag",
                "text-lg font-medium text-[#2f3338] transition-colors hover:text-primary",
                index === 0 && activeRoute === "search" && "text-primary",
              )}
              onClick={() => onRouteChange("search")}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center justify-end gap-3">
        <div className="hidden items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-sm text-muted-foreground shadow-sm lg:flex">
          <div className="size-8 rounded-full bg-[linear-gradient(135deg,#52627b,#111827)]" />
          <span>忆昔</span>
          <Badge className="border-none bg-[#ffb238] text-white">VIP5</Badge>
        </div>
        <Button variant="ghost" size="iconSm" className="app-no-drag rounded-full text-muted-foreground">
          <Bell />
        </Button>
        <Button variant="ghost" size="iconSm" className="app-no-drag rounded-full text-muted-foreground">
          <Menu />
        </Button>
        <WindowControls />
      </div>
    </header>
  );
}

function WindowControls() {
  return (
    <div className="app-no-drag flex items-center overflow-hidden rounded-lg">
      <Button variant="ghost" size="iconSm" className="rounded-none" onClick={() => void window.pisa.window.minimize()}>
        <Minimize2 />
      </Button>
      <Button variant="ghost" size="iconSm" className="rounded-none" onClick={() => void window.pisa.window.toggleMaximize()}>
        <Maximize2 />
      </Button>
      <Button
        variant="ghost"
        size="iconSm"
        className="rounded-none hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => void window.pisa.window.close()}
      >
        <X />
      </Button>
    </div>
  );
}

function Sidebar({
  route,
  onRouteChange,
  announcements,
}: {
  route: RouteKey;
  onRouteChange: (route: RouteKey) => void;
  announcements: number;
}) {
  const nav = [
    { key: "search" as const, label: "音乐", icon: Home },
    { key: "queue" as const, label: "播放队列", icon: ListMusic },
    { key: "history" as const, label: "最近播放", icon: Clock3 },
    { key: "settings" as const, label: "设置反馈", icon: Settings },
  ];
  const secondary = [
    { label: "我的收藏", icon: Heart },
    { label: "本地与下载", icon: Download },
    { label: "我的听书", icon: BookOpen },
    { label: "直播", icon: Radio },
  ];

  return (
    <aside className="row-span-2 flex min-h-0 flex-col border-r border-[#dce9fb] bg-[#edf5ff] text-sidebar-foreground">
      <div className="app-drag flex h-[92px] items-center gap-3 px-7">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#1688ff] text-white shadow-[0_10px_24px_rgba(22,136,255,0.28)]">
          <Music2 className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-[#2b333d]">PisaMusic</h1>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 px-4 pb-6">
          <nav className="flex flex-col gap-2">
            {nav.map((item) => (
              <SidebarButton
                key={item.key}
                active={route === item.key}
                icon={item.icon}
                label={item.label}
                onClick={() => onRouteChange(item.key)}
              />
            ))}
          </nav>

          <div className="h-px bg-[#d7e3f5]" />

          <nav className="flex flex-col gap-2">
            {secondary.map((item) => (
              <SidebarButton key={item.label} active={false} icon={item.icon} label={item.label} muted />
            ))}
            <button className="app-no-drag flex h-10 items-center gap-3 rounded-lg px-4 text-left text-sm text-[#5b6570] hover:bg-white/65">
              <ChevronDown className="size-4" />
              更多
            </button>
          </nav>

          <div className="flex items-center justify-between px-4 text-sm text-[#5c6571]">
            <span>自建歌单</span>
            <button className="app-no-drag rounded-md p-1 hover:bg-white">
              <Plus className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3 px-3">
            {["我喜欢", "默认收藏", "安静", "boStart"].map((name, index) => (
              <div key={name} className="grid h-9 grid-cols-[36px_1fr] items-center gap-3 text-sm text-[#555f6d]">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-white",
                    index === 0 && "bg-[#f4f8ff] text-[#ff5f8a]",
                    index === 1 && "bg-[#516c92]",
                    index === 2 && "bg-[#b77b92]",
                    index === 3 && "bg-[#bdc7e5]",
                  )}
                >
                  {index === 0 ? <Heart className="size-4 fill-current" /> : <Music2 className="size-4" />}
                </div>
                <span className="truncate">{name}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-white/70 p-4 text-sm text-[#5d6874]">
            <div className="mb-1 flex items-center gap-2 font-medium text-[#2f3944]">
              <Bell className="size-4 text-primary" />
              公告
            </div>
            {announcements > 0 ? `${announcements} 条服务端公告可查看` : "暂无新公告"}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function SidebarButton({
  active,
  icon: Icon,
  label,
  muted = false,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "app-no-drag flex h-11 items-center gap-3 rounded-lg px-4 text-left text-base transition-colors",
        active
          ? "bg-[#dcecff] font-semibold text-primary shadow-[inset_3px_0_0_#1688ff]"
          : "text-[#5c6570] hover:bg-white/70",
        muted && "text-[15px]",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-5" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SearchPage({
  results,
  error,
  isSearching,
  hasKeyword,
  onPlay,
}: {
  results: SourceGroupedResult;
  error: string;
  isSearching: boolean;
  hasKeyword: boolean;
  onPlay: (track: TrackSearchResult) => void;
}) {
  const hasResults = sourceOrder.some((source) => results[source].length > 0);

  return (
    <ScrollArea className="h-full">
      <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-10 py-7">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5 2xl:gap-5">
          {featureCards.map((card, index) => (
            <FeatureCard key={card.title} card={card} index={index} />
          ))}
        </div>

        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-[#2d343b]">今日专属推荐</h2>
            <button className="flex items-center gap-2 text-base text-[#6a747f] hover:text-primary">
              <RotateCcw className="size-5" />
              歌单广场
              <ChevronDown className="-rotate-90 size-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-7 xl:grid-cols-4">
            {recommendationCards.map((card) => (
              <RecommendationCard key={card.title} card={card} />
            ))}
          </div>
        </section>

        {(hasKeyword || hasResults || error) && (
          <section className="flex flex-col gap-4 pb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-[#2d343b]">聚合搜索</h2>
              {isSearching && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  正在搜索三方音源
                </span>
              )}
            </div>
            {error && <p className="rounded-lg border border-[#ffd7d7] bg-[#fff4f4] p-3 text-sm text-destructive">{error}</p>}
            {!hasResults && !error && !isSearching && (
              <EmptyBlock title="输入关键词开始搜索" description="结果会按酷狗、网易云、酷我分组展示，点击歌曲即可加入队列并播放。" />
            )}
            {sourceOrder.map((source) => (
              <SourceSection key={source} source={source} tracks={results[source]} onPlay={onPlay} />
            ))}
          </section>
        )}
      </section>
    </ScrollArea>
  );
}

function FeatureCard({ card, index }: { card: (typeof featureCards)[number]; index: number }) {
  return (
    <button
      className={cn(
        "group relative h-[164px] overflow-hidden rounded-md bg-gradient-to-br p-5 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5",
        card.tone,
      )}
      type="button"
    >
      <h3 className="text-[25px] font-bold leading-none">{card.title}</h3>
      <p className="mt-3 text-[16px] font-medium text-white/90">{card.desc}</p>
      <div className="absolute -bottom-5 left-5 size-24 rounded-full bg-black/25" />
      <div className={cn("absolute bottom-0 right-0 h-[100px] w-[120px] rounded-tl-md", card.cover)}>
        <div className="flex size-full items-center justify-center">
          <Music2 className={cn("size-12", index % 2 === 0 ? "text-[#222]/45" : "text-[#e4469b]/55")} />
        </div>
      </div>
    </button>
  );
}

function RecommendationCard({ card }: { card: (typeof recommendationCards)[number] }) {
  return (
    <button className="group min-w-0 text-left" type="button">
      <div className={cn("relative aspect-[1.18] overflow-hidden rounded-md", card.tone)}>
        <Badge className="absolute left-3 top-3 border-none bg-black/25 text-white backdrop-blur">{card.tag}</Badge>
        <span className="absolute bottom-3 left-3 text-[17px] font-medium text-white">{card.plays}</span>
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/42 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-45 transition-opacity group-hover:opacity-70">
          <Music2 className="size-16 text-white" />
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-[18px] leading-7 text-[#33383e]">{card.title}</p>
    </button>
  );
}

function SourceSection({
  source,
  tracks,
  onPlay,
}: {
  source: MusicSource;
  tracks: TrackSearchResult[];
  onPlay: (track: TrackSearchResult) => void;
}) {
  if (!tracks.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-[#e2edf8] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef3fa] px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-[#2d343b]">{MUSIC_SOURCE_LABEL[source]}</h3>
          <p className="text-sm text-muted-foreground">{tracks.length} 首匹配歌曲</p>
        </div>
        <Badge variant="secondary">{source.toUpperCase()}</Badge>
      </div>
      <div className="flex flex-col p-2">
        {tracks.map((track) => (
          <TrackRow key={`${track.source}:${track.id}`} track={track} onPlay={() => onPlay(track)} />
        ))}
      </div>
    </div>
  );
}

function TrackRow({ track, onPlay }: { track: TrackSearchResult; onPlay: () => void }) {
  return (
    <button
      className="grid h-16 grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 text-left transition-colors hover:bg-[#eef7ff]"
      onClick={onPlay}
      type="button"
    >
      <Cover track={track} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#252b31]">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
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
    <PageShell title="播放队列" description={`${queue.length} 首歌曲等待播放`}>
      <div className="flex flex-col gap-2">
        {queue.map((track, index) => (
          <div key={`${track.source}:${track.id}:${index}`} className={cn(index === currentIndex && "rounded-lg bg-[#e5f2ff]")}>
            <TrackRow track={track} onPlay={() => void playTrack(track, queue)} />
          </div>
        ))}
        {!queue.length && <EmptyBlock title="队列还是空的" description="从聚合搜索里点击一首歌，队列会自动保存。" />}
      </div>
    </PageShell>
  );
}

function HistoryPage() {
  const [items, setItems] = useState<PlayHistoryItem[]>([]);
  const playTrack = usePlayerStore((state) => state.playTrack);
  useEffect(() => {
    void window.pisa.library.getPlayHistory().then(setItems);
  }, []);
  return (
    <PageShell title="最近播放" description="SQLite 会保存最近播放记录">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <TrackRow
            key={`${item.track.source}:${item.track.id}:${item.playedAt}`}
            track={item.track}
            onPlay={() => void playTrack(item.track, items.map((x) => x.track))}
          />
        ))}
        {!items.length && <EmptyBlock title="暂无播放历史" description="播放成功后，歌曲会出现在这里。" />}
      </div>
    </PageShell>
  );
}

function SettingsPage({
  settings,
  onSettingsChange,
  announcements,
}: {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  announcements: AnnouncementItem[];
}) {
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
    <PageShell title="设置反馈" description="主题配色、公告和反馈入口">
      <div className="grid gap-5">
        <Card className="border-[#e2edf8] shadow-none">
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
              <Slider value={[settings.theme.radius]} min={4} max={18} step={1} onValueChange={([radius]) => saveTheme({ radius })} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#e2edf8] shadow-none">
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
        <Card className="border-[#e2edf8] shadow-none">
          <CardHeader>
            <CardTitle>公告</CardTitle>
            <CardDescription>启动时从服务端拉取，不做长期持久化。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {announcements.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#e2edf8] bg-[#f8fbff] p-3">
                <p className="text-sm">{item.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.publisher} · {item.time}
                </p>
              </div>
            ))}
            {!announcements.length && <p className="text-sm text-muted-foreground">暂无公告</p>}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function PageShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <ScrollArea className="h-full">
      <section className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-10 py-8">
        <div>
          <h2 className="text-2xl font-semibold text-[#2d343b]">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-xl border border-[#e2edf8] bg-white p-5">{children}</div>
      </section>
    </ScrollArea>
  );
}

function PlayerBar({
  settings,
  onSettingsChange,
}: {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}) {
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
    <footer className="col-span-2 grid h-24 grid-cols-[430px_minmax(0,1fr)_360px] items-center gap-6 border-t border-[#dce7f3] bg-white px-5 shadow-[0_-8px_24px_rgba(60,95,130,0.08)]">
      <div className="grid min-w-0 grid-cols-[84px_minmax(0,1fr)] items-center gap-4">
        {current ? <Cover track={current} player /> : <div className="flex size-[72px] items-center justify-center rounded-md bg-[#eef5ff]"><Music2 /></div>}
        <div className="min-w-0">
          <p className="truncate text-lg font-medium text-[#2e3339]">{current?.title ?? "选择一首歌曲开始播放"}</p>
          <p className="truncate text-sm text-muted-foreground">{current?.artist ?? "PisaMusic Desktop"}</p>
          <div className="mt-2 flex items-center gap-3 text-[#6f7780]">
            <Heart className="size-5" />
            <Download className="size-5" />
            <MessageSquare className="size-5" />
            <Menu className="size-5" />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col items-center gap-3">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="iconSm" className="rounded-full" onClick={() => void previous()} disabled={!current}>
            <SkipBack className="size-6" />
          </Button>
          <Button
            size="icon"
            className="size-12 rounded-full bg-[#1b1f24] text-white hover:bg-[#30353b]"
            onClick={togglePlay}
            disabled={!current || isLoading}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause className="size-6" /> : <Play className="size-6 fill-current" />}
          </Button>
          <Button variant="ghost" size="iconSm" className="rounded-full" onClick={() => void next()} disabled={!current}>
            <SkipForward className="size-6" />
          </Button>
        </div>
        <div className="grid w-full grid-cols-[48px_1fr_48px] items-center gap-3">
          <span className="text-xs text-muted-foreground">{formatDuration(progress)}</span>
          <Slider value={[Math.min(progress, duration || progress)]} max={duration || 1} step={1} onValueChange={([value]) => seek(value)} />
          <span className="text-right text-xs text-muted-foreground">{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-4 text-[#5e6771]">
        <Shuffle className="size-5" />
        <Volume2 className="size-5" />
        <div className="w-28">
          <Slider value={[volume]} max={1} step={0.01} onValueChange={([value]) => updateVolume(value)} />
        </div>
        <Badge variant="outline" className="rounded-sm">
          无损
        </Badge>
        <Badge variant="outline" className="rounded-sm">
          音效
        </Badge>
        <span className="text-xl font-semibold text-primary">词</span>
        <ListMusic className="size-6" />
      </div>
    </footer>
  );
}

function Cover({ track, player = false }: { track: TrackSearchResult; player?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-[#e4edf7] bg-[#eef5ff]", player ? "size-[72px]" : "size-11")}>
      {track.coverUrl ? (
        <img src={track.coverUrl} alt={track.title} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Music2 className={player ? "size-7" : "size-5"} />
        </div>
      )}
    </div>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d8e6f5] bg-[#f8fbff] p-6">
      <h3 className="text-base font-semibold text-[#2d343b]">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
