import { useEffect, useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  Maximize,
  Minimize,
  AlertOctagon,
  MonitorPlay
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStudyTools } from "@/contexts/StudyToolsContext";
import { useToast } from "@/hooks/use-toast";

interface ClassPlayerProps {
  videoId: string;
  title?: string;
  onEnded?: () => void;
  watermarkText?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const WatermarkOverlay = ({ text }: { text: string }) => {
    const [position, setPosition] = useState({ top: '10%', left: '10%' });

    useEffect(() => {
        const interval = setInterval(() => {
            const top = Math.floor(Math.random() * 80) + 10 + '%';
            const left = Math.floor(Math.random() * 80) + 10 + '%';
            setPosition({ top, left });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            id="secure-overlay-wm"
            className="absolute z-[100] pointer-events-none select-none text-white whitespace-nowrap font-mono text-sm font-bold bg-black/10 px-2 rounded backdrop-blur-[1px]"
            style={{
                top: position.top,
                left: position.left,
                opacity: 0.15,
                transition: 'top 5s linear, left 5s linear'
            }}
        >
            {text}
        </div>
    );
};

const ClassPlayer = ({ videoId, title, onEnded, watermarkText }: ClassPlayerProps) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [watchTime, setWatchTime] = useState(0);
  const { updateStreak, updateStats } = useStudyTools();
  const { toast } = useToast();
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>("auto");
  const [securityViolation, setSecurityViolation] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Security Check Logic
  useEffect(() => {
      if (!watermarkText) return;

      const checkWatermark = () => {
          const wm = document.getElementById('secure-overlay-wm');
          if (!wm) {
              setSecurityViolation(true);
              return;
          }
          const style = window.getComputedStyle(wm);
          if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') {
              setSecurityViolation(true);
          }
      };

      const interval = setInterval(checkWatermark, 1000);

      const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                  const removedNodes = Array.from(mutation.removedNodes);
                  const isWatermarkRemoved = removedNodes.some(
                      (node) => node instanceof HTMLElement && node.id === 'secure-overlay-wm'
                  );
                  if (isWatermarkRemoved) {
                      setSecurityViolation(true);
                  }
              }
          });
      });

      if (containerRef.current) {
          observer.observe(containerRef.current, { childList: true, subtree: true });
      }

      return () => {
          clearInterval(interval);
          observer.disconnect();
      };
  }, [watermarkText]);

  // Extract ID if full URL is passed
  const extractVideoId = (urlOrId: string) => {
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : urlOrId;
  };

  const actualVideoId = extractVideoId(videoId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPlayerReady = (event: any) => {
    setDuration(event.target.getDuration());
    setVolume(event.target.getVolume());
    updateQualityLevels();

    // Start interval to update time
    setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 1000);
  };

  // Track watch time for streak & stats
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setWatchTime((prev) => {
          const newState = prev + 1;

          // Update streak at 30 mins
          if (newState === 1800) {
             updateStreak();
             toast({ title: "Study Streak Updated!", description: "You've studied for 30 minutes." });
          }

          // Update stats every minute (to avoid spamming DB every second)
          if (newState % 60 === 0) {
              updateStats("total_class_time", 1); // Add 1 minute
          }

          return newState;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, updateStreak, toast, updateStats]);

  const updateQualityLevels = () => {
    if (playerRef.current && playerRef.current.getAvailableQualityLevels) {
        setAvailableQualities(playerRef.current.getAvailableQualityLevels());
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPlayerStateChange = (event: any) => {
    setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
    if (event.data === window.YT.PlayerState.ENDED && onEnded) {
      onEnded();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onQualityChange = (event: any) => {
      setCurrentQuality(event.data);
  };

  const initializePlayer = useCallback(() => {
    if (playerRef.current) return; // Already initialized

    playerRef.current = new window.YT.Player("youtube-player", {
      height: "100%",
      width: "100%",
      videoId: actualVideoId,
      playerVars: {
        playsinline: 1,
        controls: 0, // Hide default controls
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        fs: 0, // Hide fullscreen button
        iv_load_policy: 3, // Hide annotations
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onPlaybackQualityChange: onQualityChange,
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualVideoId]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = initializePlayer;
    } else {
      initializePlayer();
    }

    return () => {
        if (playerRef.current) {
            try {
                playerRef.current.destroy();
            } catch (e) {
                console.error("Error destroying player", e);
            }
        }
    };
  }, [actualVideoId, initializePlayer]);

  const handlePlayPause = () => {
    if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (value: number[]) => {
    if (!playerRef.current || typeof playerRef.current.seekTo !== 'function') return;
    const newTime = value[0];
    setCurrentTime(newTime);
    playerRef.current.seekTo(newTime, true);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!playerRef.current || typeof playerRef.current.setVolume !== 'function') return;
    const newVolume = value[0];
    setVolume(newVolume);
    playerRef.current.setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      playerRef.current.unMute();
    }
  };

  const toggleMute = () => {
    if (!playerRef.current || typeof playerRef.current.mute !== 'function') return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume || 100);
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handlePlaybackRate = (rate: number) => {
    if (!playerRef.current || typeof playerRef.current.setPlaybackRate !== 'function') return;
    setPlaybackRate(rate);
    playerRef.current.setPlaybackRate(rate);
  };

  const handleQualityChange = (quality: string) => {
      if (playerRef.current && typeof playerRef.current.setPlaybackQuality === 'function') {
          playerRef.current.setPlaybackQuality(quality);
          setCurrentQuality(quality);
      }
  };

  const skipForward = () => {
    if (!playerRef.current || typeof playerRef.current.seekTo !== 'function') return;
    const newTime = Math.min(currentTime + 10, duration);
    playerRef.current.seekTo(newTime, true);
  };

  const skipBackward = () => {
    if (!playerRef.current || typeof playerRef.current.seekTo !== 'function') return;
    const newTime = Math.max(currentTime - 10, 0);
    playerRef.current.seekTo(newTime, true);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  useEffect(() => {
      // Hide controls initially after 3s if playing
      if (isPlaying) {
          controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      } else {
          setShowControls(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
      return () => {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
  }, [isPlaying]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      switch(e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentTime, isMuted, volume]);


  if (securityViolation) {
      return (
          <div className="w-full aspect-video bg-black flex flex-col items-center justify-center text-destructive p-6 text-center animate-in zoom-in">
              <AlertOctagon className="h-12 w-12 mb-2" />
              <h3 className="text-xl font-bold">Playback Suspended</h3>
              <p className="text-sm">Security violation detected. Please refresh.</p>
              <Button onClick={() => window.location.reload()} variant="destructive" size="sm" className="mt-4">
                  Reload
              </Button>
          </div>
      );
  }

  return (
    <TooltipProvider>
      <div
          ref={containerRef}
          className="relative group bg-black w-full aspect-video overflow-hidden rounded-lg shadow-xl select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          onDoubleClick={toggleFullscreen}
      >
        {watermarkText && <WatermarkOverlay text={watermarkText} />}

        <div id="youtube-player" className="w-full h-full pointer-events-none" />

        {/* Overlay/Controls */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 flex flex-col justify-end px-3 sm:px-4 pb-2 z-20 ${showControls ? 'opacity-100' : 'opacity-0 cursor-none pointer-events-none'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar */}
          <div className="mb-2 group/slider w-full">
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="cursor-pointer py-2 [&>.relative>.bg-primary]:h-1 [&>.relative>.bg-primary]:sm:h-1.5 [&>.relative>.bg-primary]:group-hover/slider:h-2 [&>.relative]:h-1 [&>.relative]:sm:h-1.5 [&>.relative]:group-hover/slider:h-2 transition-all [&_span[role='slider']]:h-3 [&_span[role='slider']]:w-3 [&_span[role='slider']]:sm:h-5 [&_span[role='slider']]:sm:w-5"
              />
          </div>

          <div className="flex items-center justify-between pb-1 sm:pb-2 pointer-events-auto">
            <div className="flex items-center gap-2 sm:gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handlePlayPause} className="text-white hover:bg-white/20 hover:text-white h-8 w-8 sm:h-10 sm:w-10">
                    {isPlaying ? <Pause className="h-5 w-5 sm:h-6 sm:w-6 fill-current" /> : <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPlaying ? "Pause (Space)" : "Play (Space)"}</p>
                </TooltipContent>
              </Tooltip>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={skipBackward} className="text-white hover:bg-white/20 hover:text-white h-8 w-8 hidden sm:inline-flex">
                      <SkipBack className="h-4 w-4 fill-current" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Rewind 10s (←)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={skipForward} className="text-white hover:bg-white/20 hover:text-white h-8 w-8 hidden sm:inline-flex">
                      <SkipForward className="h-4 w-4 fill-current" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Forward 10s (→)</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2 group/vol ml-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 hover:text-white h-8 w-8 hidden sm:inline-flex">
                      {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isMuted ? "Unmute (M)" : "Mute (M)"}</p>
                    </TooltipContent>
                  </Tooltip>

                  <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 ease-out hidden sm:block">
                      <Slider
                          value={[isMuted ? 0 : volume]}
                          min={0}
                          max={100}
                          onValueChange={handleVolumeChange}
                          className="w-20 cursor-pointer"
                      />
                  </div>
              </div>

              <span className="text-white text-[10px] sm:text-sm font-mono ml-2 select-none">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {availableQualities.length > 0 && (
                  <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white gap-1 min-w-[2rem] sm:min-w-[3rem] h-8 px-1 sm:px-2">
                                  <MonitorPlay className="h-4 w-4" />
                                  <span className="text-xs font-bold uppercase hidden sm:inline">{currentQuality}</span>
                              </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Quality</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent container={containerRef.current} align="end" side="top" className="max-h-60 overflow-y-auto bg-black/90 border-white/20 text-white backdrop-blur-md">
                          {availableQualities.map((q) => (
                              <DropdownMenuItem key={q} onClick={() => handleQualityChange(q)} className="focus:bg-white/20 focus:text-white cursor-pointer justify-center font-mono text-xs">
                                  {q.toUpperCase()}
                              </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                  </DropdownMenu>
              )}

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white gap-1 min-w-[2rem] sm:min-w-[3rem] h-8 px-1 sm:px-2">
                        <Settings className="h-4 w-4" />
                        <span className="text-xs font-bold hidden sm:inline">{playbackRate}x</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Speed</TooltipContent>
                </Tooltip>
                <DropdownMenuContent container={containerRef.current} align="end" side="top" className="bg-black/90 border-white/20 text-white backdrop-blur-md">
                  {[1, 1.25, 1.5, 1.75, 2, 2.5, 2.75, 3].map((rate) => (
                    <DropdownMenuItem key={rate} onClick={() => handlePlaybackRate(rate)} className="focus:bg-white/20 focus:text-white cursor-pointer justify-center font-mono text-xs">
                      {rate === 1 ? "Normal" : `${rate}x`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20 hover:text-white h-8 w-8 sm:h-9 sm:w-9">
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Centered Play Button (Initial or Paused) */}
        {!isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
                <div className="bg-black/40 p-4 sm:p-5 rounded-full backdrop-blur-[2px] border border-white/10 shadow-2xl animate-in zoom-in-50 duration-300">
                    <Play className="h-8 w-8 sm:h-10 sm:w-10 text-white fill-white ml-1" />
                </div>
            </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default ClassPlayer;
