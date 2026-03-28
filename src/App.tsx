import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { LogIn, Heart, User as UserIcon, Layers, Info, X, PlayCircle, Play, Share2, UserPlus, Star, TrendingUp, HeartOff, Loader2, Film, Copy, Check, Maximize, Minimize, Undo2, Bell, Smartphone, Share, Shuffle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { signInWithGoogle, signInAsGuest, logout } from './firebase';
import { getMovies, getMovieById, getMovieTrailer, getGenreList, getUserSwipes, getPartnerLikedMovies, swipeMovie, undoSwipe, removeMatch, toggleMatchWatched, subscribeToMatches, Movie } from './services/movieService';
import QRCode from 'react-qr-code';
import toast, { Toaster } from 'react-hot-toast';

// --- Components ---

const Navbar = () => {
  const { profile } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <nav className="w-full z-[60] flex justify-between items-center px-4 py-2 bg-background/80 backdrop-blur-md shrink-0">
      <div className="w-8 flex items-center justify-start">
        {profile?.photoURL && (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/30">
            <img src={profile.photoURL} alt="Avatar" referrerPolicy="no-referrer" />
          </div>
        )}
      </div>
      <Link to="/" className="flex items-center gap-1.5">
        <span className="text-lg font-black tracking-[-0.03em] text-gradient font-headline uppercase leading-none">
          CINEPAIR
        </span>
      </Link>
      <div className="w-8 flex items-center justify-end">
        {!window.matchMedia('(display-mode: standalone)').matches && (
          <button onClick={toggleFullscreen} title="Teljes képernyő" className="text-on-surface/40 hover:text-white transition-colors">
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        )}
      </div>
    </nav>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const tabs = [
    { path: '/', icon: Layers, label: 'Felfedezés' },
    { path: '/watchlist', icon: Heart, label: 'Találatok' },
    { path: '/profile', icon: UserIcon, label: 'Saját' },
  ];

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50">
      <div className="bg-[#1a1a1a]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-2 flex items-center justify-between relative shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)]">
        {/* Subtle inner glow */}
        <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          
          return (
            <Link 
              key={tab.path} 
              to={tab.path} 
              className="relative flex-1 py-1.5 flex flex-col items-center justify-center group"
            >
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-primary rounded-full shadow-[0_0_25px_rgba(245,197,24,0.25)]"
                  transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
                />
              )}
              
              <div className={`relative z-10 flex flex-col items-center transition-all duration-500 ${active ? 'text-black translate-y-0' : 'text-white/40 group-hover:text-white/70'}`}>
                <motion.div
                  animate={{ 
                    scale: active ? 1 : 0.9,
                    y: active ? -1 : 0
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <Icon 
                    size={20} 
                    strokeWidth={active ? 3 : 2} 
                    fill={active ? "currentColor" : "none"} 
                    className="transition-all duration-300"
                  />
                </motion.div>
                
                <AnimatePresence mode="wait">
                  {active && (
                    <motion.span
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 3 }}
                      transition={{ duration: 0.2 }}
                      className="text-[9px] font-black uppercase tracking-[0.15em] mt-1 leading-none"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                
                {!active && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] mt-1 opacity-0 group-hover:opacity-40 transition-opacity duration-300">
                    {tab.label}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// --- Pages ---

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Modern Android/Chrome prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAsGuest();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = "https://mayydayy99.github.io/cinepair/";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a] relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-600/20 blur-[120px] rounded-full mix-blend-screen opacity-60 animate-pulse [animation-duration:4s]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-orange-500/20 blur-[120px] rounded-full mix-blend-screen opacity-60 animate-pulse [animation-duration:6s] [animation-delay:2s]" />
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }} 
          className="absolute -top-64 -right-64 text-red-600/5"
        >
          <Film size={800} strokeWidth={0.5} />
        </motion.div>
        
        <motion.div 
          animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-10 -right-10 text-orange-500/20 opacity-40"
        >
          <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 8l2 14h12l2-14H4zm11 12H9l-1-10h8l-1 10zM12 2C10.5 2 9.5 3 9.5 4c0 .5.2 1 .5 1.5C9.2 5.5 8 6.2 8 7.5 8 8.8 9.2 10 10.5 10h3c1.3 0 2.5-1.2 2.5-2.5 0-1.3-1.2-2-2-2 .3-.5.5-1 .5-1.5C14.5 3 13.5 2 12 2z"/>
          </svg>
        </motion.div>
      </div>
      
      <div className="relative z-20 text-center space-y-8 w-full max-w-sm">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center bg-black/60 p-8 rounded-[3rem] border border-orange-500/20 backdrop-blur-xl shadow-2xl shadow-red-900/40"
        >
          <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-[#f5c518] to-[#e50914] font-headline uppercase leading-[1.1] drop-shadow-[0_4px_20px_rgba(229,9,20,0.5)]">
            CINEPAIR
          </h1>
          <div className="h-1.5 w-24 bg-gradient-to-r from-[#f5c518] to-[#e50914] rounded-full my-6 opacity-80" />
          
          <AnimatePresence mode="popLayout" initial={false}>
            {!showQr ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center space-y-6"
              >
                <div className="space-y-4 pt-2">
                  <h2 className="text-xl font-serif italic text-white/90">A te vörös szőnyeged.</h2>
                  <p className="text-white/60 text-sm leading-relaxed px-2">
                    Készítsd be a popcornt! Találd meg a pároddal azt a filmet, amit mindketten megnéznétek.
                  </p>
                </div>

                <div className="w-full space-y-4 pt-4">
                  {/* PWA Install Button */}
                  {!isInstalled && (deferredPrompt || isIOS) && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={isIOS ? () => toast('Kattints a Megosztás gombra, majd az "Adás a főképernyőhöz" opcióra! 📱', { icon: '💡' }) : handleInstallClick}
                      className="w-full bg-primary/10 border border-primary/20 text-primary font-headline font-black py-4 rounded-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] animate-pulse"
                    >
                      <Smartphone size={18} />
                      {isIOS ? 'App telepítése (iOS)' : 'Alkalmazás telepítése'}
                    </motion.button>
                  )}

                  <button 
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#e50914] to-[#b81d24] text-white font-headline font-black py-4 rounded-2xl shadow-lg shadow-red-900/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-wide group"
                  >
                    <LogIn size={22} className="group-hover:translate-x-1 transition-transform" />
                    {loading ? 'Belépés...' : 'Belépés Google-lel'}
                  </button>
                  
                  <button 
                    onClick={handleGuestLogin}
                    disabled={loading}
                    className="w-full bg-white/5 border border-white/10 text-white/70 font-headline font-bold py-4 rounded-2xl hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                  >
                    <UserIcon size={18} />
                    Vendégként folytatom
                  </button>

                  <button 
                    onClick={() => setShowQr(true)}
                    className="w-full bg-[#1a1a1a] border border-[#f5c518]/30 text-[#f5c518] font-headline font-bold py-4 rounded-2xl hover:bg-[#2a2a2a] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                  >
                    Meghívó (QR Kód)
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="qr"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center space-y-6"
              >
                <h3 className="text-sm font-bold text-[#f5c518] uppercase tracking-widest">Hívd meg a párod</h3>
                <div className="bg-white p-4 rounded-3xl shadow-2xl">
                  <QRCode value={shareUrl} size={180} fgColor="#000" bgColor="#fff" />
                </div>
                <p className="text-xs text-white/50 px-4 leading-relaxed">
                  Olvasd be a kamerával a másik telefonról, hogy ő is csatlakozhasson azonnal!
                </p>
                <button 
                  onClick={() => setShowQr(false)}
                  className="w-full bg-[#1a1a1a] border border-white/10 text-white font-headline font-bold py-3 rounded-2xl hover:bg-[#2a2a2a] transition-colors uppercase tracking-widest text-xs mt-4"
                >
                  Vissza a belépéshez
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
          © {new Date().getFullYear()} CINEPAIR CINEMAS
        </p>
      </div>
    </div>
  );
};

interface MovieCardProps {
  movie: Movie;
  onSwipe: (type: 'like' | 'dislike') => void | Promise<void>;
  onInfo: () => void | Promise<void>;
  leaveDirection?: 'left' | 'right' | null;
  key?: any;
}

const MovieCard = ({ movie, onSwipe, onInfo, leaveDirection }: MovieCardProps) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const rotateZ = useTransform(x, [-200, 200], [-15, 15]);
  const rotateY = useTransform(x, [-200, 200], [-30, 30]); // 3D effect
  const rotateX = useTransform(y, [-200, 200], [20, -20]); // 3D effect
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);
  const infoOpacity = useTransform(y, [-150, -50], [1, 0]);
  const scale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);

  useEffect(() => {
    const el = document.getElementById('swipe-glow-overlay');
    if (el) el.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => {
    return x.on("change", (latestX) => {
      const el = document.getElementById('swipe-glow-overlay');
      if (el) {
        if (leaveDirection) {
          el.style.backgroundColor = 'transparent';
          return;
        }

        if (latestX > 0) {
          el.style.backgroundColor = `rgba(0, 255, 136, ${Math.min(latestX / 200, 1) * 0.15})`;
        } else if (latestX < 0) {
          el.style.backgroundColor = `rgba(255, 77, 77, ${Math.min(-latestX / 200, 1) * 0.15})`;
        } else {
          el.style.backgroundColor = 'transparent';
        }
      }
    });
  }, [x, leaveDirection]);

  const onDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onSwipe('like');
    } else if (info.offset.x < -100) {
      onSwipe('dislike');
    } else if (info.offset.y < -100) {
      onInfo();
    }
  };

  return (
    <motion.div 
      key={movie.id}
      style={{ x, y, rotateZ, rotateX, rotateY, opacity, scale, perspective: 1000 }}
      custom={leaveDirection}
      drag
      dragElastic={1}
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      whileTap={{ scale: 1.05, cursor: 'grabbing' }}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.9, opacity: 0, y: 50, rotateX: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
      exit={(direction: 'left' | 'right' | null) => ({ 
        x: direction === 'right' ? 800 : direction === 'left' ? -800 : x.get() > 50 ? 800 : x.get() < -50 ? -800 : 0, 
        y: y.get() < -100 ? -800 : direction ? 100 : 0,
        opacity: 0, 
        rotateZ: direction === 'right' ? 45 : direction === 'left' ? -45 : 0,
        transition: { duration: 0.2, ease: "easeIn" } 
      })}
      className="absolute inset-0 rounded-[2.5rem] overflow-hidden card-shadow group cursor-grab bg-surface-container-highest border border-white/5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]"
    >
      <div className={`absolute inset-0 bg-surface-container-highest animate-pulse transition-opacity duration-300 z-[-1] pointer-events-none ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />
      
      <motion.div 
        style={{ opacity: likeOpacity }}
        className="absolute top-8 left-8 z-50 border-4 border-secondary text-secondary font-headline font-black text-3xl sm:text-5xl px-4 py-2 rounded-2xl rotate-[-15deg] uppercase tracking-tighter"
      >
        TETSZIK
      </motion.div>
      <motion.div 
        style={{ opacity: nopeOpacity }}
        className="absolute top-8 right-8 z-50 border-4 border-error text-error font-headline font-black text-3xl sm:text-5xl px-4 py-2 rounded-2xl rotate-[15deg] uppercase tracking-tighter"
      >
        NEM
      </motion.div>
      <motion.div 
        style={{ opacity: infoOpacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 border-4 border-primary text-primary font-headline font-black text-3xl sm:text-5xl px-4 py-2 rounded-2xl uppercase tracking-tighter whitespace-nowrap"
      >
        ADATOK
      </motion.div>

      <img 
        src={movie.posterUrl} 
        alt={movie.title}
        onLoad={() => setImageLoaded(true)}
        className={`w-full h-full object-cover pointer-events-none transition-all duration-700 ease-out ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`} 
        referrerPolicy="no-referrer" 
      />
      <div className="absolute inset-0 poster-gradient pointer-events-none" />
      
      <div className="absolute bottom-0 left-0 w-full p-6 sm:p-10 flex flex-col gap-3 sm:gap-5 pointer-events-none">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="px-3 py-1 bg-primary text-black text-[10px] font-black rounded-full uppercase tracking-widest">IMDb {movie.rating}</span>
            <span className="text-on-surface/60 font-label text-[10px] sm:text-xs tracking-widest uppercase">{movie.year} • {movie.duration}</span>
          </div>
          <h2 className="font-black font-headline leading-[0.9] text-on-surface tracking-[-0.04em] uppercase break-words" style={{ fontSize: 'clamp(1.5rem, 6vw, 3rem)' }}>
            {movie.title}
          </h2>
        </div>
        
        <p className="text-on-surface-variant text-xs sm:text-sm leading-relaxed line-clamp-2 font-body opacity-80">
          {movie.synopsis}
        </p>
        
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {movie.genres.map(genre => (
            <span key={genre} className="px-3 py-1 sm:px-4 sm:py-1.5 bg-white/5 rounded-full text-[9px] sm:text-[10px] font-bold text-on-surface/60 uppercase tracking-widest border border-white/5">{genre}</span>
          ))}
        </div>
      </div>
      
      <button 
        onClick={(e) => { e.stopPropagation(); onInfo(); }}
        className="absolute top-8 right-8 w-12 h-12 rounded-full bg-black/30 backdrop-blur-xl flex items-center justify-center text-white pointer-events-auto border border-white/10 hover:bg-black/50 transition-colors"
      >
        <Info size={24} />
      </button>
    </motion.div>
  );
};

const SwipeScreen = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [genres, setGenres] = useState<{id: number; name: string}[]>([]);
  const [leaveDirection, setLeaveDirection] = useState<'left' | 'right' | null>(null);
  const [lastSwipe, setLastSwipe] = useState<{movieId: string; index: number} | null>(null);

  useEffect(() => { getGenreList().then(setGenres); }, []);

  const loadMoreMovies = async (targetPage: number, forceYear?: string, forceGenre?: string) => {
    setLoading(true);
    const yr = forceYear !== undefined ? forceYear : yearFilter;
    const gr = forceGenre !== undefined ? forceGenre : genreFilter;
    const fetchedMovies = await getMovies({ page: targetPage, year: yr, genreId: gr });
    
    if (user) {
      const swipedIds = await getUserSwipes(user.uid);
      const unswiped = fetchedMovies.filter(m => !swipedIds.includes(m.id));
      
      let finalMovies = [...unswiped];

      // Mix in partner likes if available (80-20 ratio)
      if (profile?.partnerId) {
        const partnerLikes = await getPartnerLikedMovies(profile.partnerId, user.uid);
        if (partnerLikes.length > 0) {
          const mixed: Movie[] = [];
          let pIdx = 0;
          for (let i = 0; i < unswiped.length; i++) {
            mixed.push(unswiped[i]);
            // Every 4th movie shown will be a partner like (if available)
            if ((i + 1) % 4 === 0 && pIdx < partnerLikes.length) {
              mixed.push(partnerLikes[pIdx++]);
            }
          }
          // If any partner likes left, add at the end
          while(pIdx < partnerLikes.length) {
            mixed.push(partnerLikes[pIdx++]);
          }
          finalMovies = mixed;
        }
      }

      if (finalMovies.length === 0 && fetchedMovies.length > 0) {
        setPage(targetPage + 1);
        await loadMoreMovies(targetPage + 1, yr, gr);
        return;
      }
      setMovies(finalMovies);
      setCurrentIndex(0);
    } else {
      setMovies(fetchedMovies);
      setCurrentIndex(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    loadMoreMovies(1, yearFilter, genreFilter);
  }, [user, yearFilter, genreFilter]);

  const processNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= movies.length) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMoreMovies(nextPage, yearFilter, genreFilter);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const handleSwipe = async (type: 'like' | 'dislike') => {
    if (currentIndex >= movies.length) return;
    
    setLeaveDirection(type === 'like' ? 'right' : 'left');
    navigator.vibrate?.(15);
    
    setTimeout(async () => {
      const movie = movies[currentIndex];
      setLastSwipe({ movieId: movie.id, index: currentIndex });
      const isMatch = await swipeMovie(user!.uid, movie.id, type, profile?.partnerId);
      
      if (isMatch) {
        navigator.vibrate?.([50, 30, 50]);
        setShowMatch(movie);
      } else {
        processNext();
        setLeaveDirection(null);
      }
    }, 10);
  };

  const handleUndo = async () => {
    if (!lastSwipe || !user) return;
    await undoSwipe(user.uid, lastSwipe.movieId);
    navigator.vibrate?.(10);
    setCurrentIndex(lastSwipe.index);
    setLastSwipe(null);
  };

  const handleMatchContinue = () => {
    setShowMatch(null);
    processNext();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary/20 rounded-full animate-ping absolute inset-0" />
          <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin relative z-10" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-primary font-headline font-black uppercase tracking-[0.3em] text-xs">Figyeljük a vásznat</p>
          <p className="text-on-surface-variant font-body text-xs opacity-60">Filmek betöltése...</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= movies.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-8">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-surface-container-high rounded-[2rem] flex items-center justify-center text-primary shadow-2xl border border-white/5"
        >
          <Layers size={48} />
        </motion.div>
        <div className="space-y-3 max-w-xs">
          <h2 className="text-3xl font-black font-headline tracking-tight uppercase">Vége a tekercsnek</h2>
          <p className="text-on-surface-variant font-body leading-relaxed opacity-70">
            Még nem találtunk több filmet. Próbálj meg beállítani egy másik évet!
          </p>
        </div>
        <button onClick={() => setYearFilter('')} className="w-full max-w-xs py-5 bg-primary text-black rounded-2xl font-headline font-black uppercase tracking-tight shadow-2xl shadow-primary/20 active:scale-95 transition-transform">
          Összes év mutatása
        </button>
      </div>
    );
  }

  const currentMovie = movies[currentIndex];
  const nextMovie = currentIndex + 1 < movies.length ? movies[currentIndex + 1] : null;

  return (
    <div className="relative h-full w-full flex flex-col items-center px-3 sm:px-6 pb-2 overflow-hidden">
      <div id="swipe-glow-overlay" className="absolute inset-0 z-0 pointer-events-none transition-colors duration-300" />
      
      <AnimatePresence>
        {showMatch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="absolute inset-0 z-0">
              <img src={showMatch.posterUrl} className="w-full h-full object-cover blur-2xl opacity-40 scale-110" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />
            </div>

            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="mb-2 px-4 py-1 bg-secondary text-black text-[10px] font-black rounded-full uppercase tracking-[0.3em]">
                Új Találat
              </div>
              <h1 className="font-headline font-black text-6xl md:text-8xl tracking-[-0.05em] text-primary leading-none mb-4 drop-shadow-[0_0_30px_rgba(245,197,24,0.5)]">
                MATCH!
              </h1>
              
              <div className="flex items-center justify-center gap-4 mb-12">
                <div className="w-16 h-16 rounded-full border-2 border-primary/50 overflow-hidden shadow-2xl">
                  <img src={profile?.photoURL} alt="Me" referrerPolicy="no-referrer" />
                </div>
                <div className="bg-primary text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <Heart size={20} fill="currentColor" />
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-primary/50 bg-surface-container-high flex items-center justify-center shadow-2xl">
                  <UserIcon size={24} className="text-primary" />
                </div>
              </div>

              <div className="relative w-full max-w-[280px] aspect-[2/3] max-h-[50vh] rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] border border-white/10 mb-12">
                <img src={showMatch.posterUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 text-left">
                  <h2 className="font-headline font-black text-3xl text-white tracking-tight uppercase leading-none">{showMatch.title}</h2>
                </div>
              </div>

              <div className="w-full max-w-xs flex flex-col gap-4">
                <button 
                  onClick={() => { navigate(`/movie/${showMatch.id}`); handleMatchContinue(); }}
                  className="w-full bg-primary text-black font-headline font-black py-5 rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-center gap-2 uppercase tracking-tight active:scale-95 transition-transform"
                >
                  Részletek <PlayCircle size={24} />
                </button>
                <button 
                  onClick={handleMatchContinue}
                  className="w-full bg-white/5 backdrop-blur-xl border border-white/10 text-white font-headline font-bold py-5 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-transform"
                >
                  Folytatás
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full z-40 px-3 sm:px-6 flex justify-between items-center gap-2 shrink-0 pt-1 pb-1">
        <div className="flex gap-1.5">
          <select value={yearFilter} aria-label="Év" onChange={(e) => setYearFilter(e.target.value)}
            className="bg-black/40 text-white border border-white/10 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-xl cursor-pointer focus:outline-none">
            <option value="">Év</option>
            <option value="2025">2025</option><option value="2024">2024</option><option value="2023">2023</option>
            <option value="2022">2022</option><option value="2021">2021</option><option value="2020">2020</option>
          </select>
          <select value={genreFilter} aria-label="Műfaj" onChange={(e) => setGenreFilter(e.target.value)}
            className="bg-black/40 text-white border border-white/10 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-xl cursor-pointer focus:outline-none">
            <option value="">Műfaj</option>
            {genres.map(g => <option key={g.id} value={g.id.toString()}>{g.name}</option>)}
          </select>
        </div>
        <div className="bg-black/40 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-xl text-[10px] font-bold uppercase tracking-wider text-primary">
          {currentIndex + 1}/{movies.length}
        </div>
      </div>

      <div className="relative w-full flex-1 max-w-md flex items-center justify-center z-10" style={{ minHeight: 0 }}>
        <AnimatePresence mode="popLayout" custom={leaveDirection}>
          {nextMovie && (
            <div 
              key={`next-${nextMovie.id}`}
              className="absolute inset-0 rounded-[2.5rem] overflow-hidden opacity-40 scale-[0.92] translate-y-4 blur-[2px] pointer-events-none bg-surface-container-highest border border-white/5"
            >
              <img src={nextMovie.posterUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          )}
          
          <MovieCard 
            key={currentMovie.id}
            movie={currentMovie}
            leaveDirection={leaveDirection}
            onSwipe={handleSwipe}
            onInfo={() => navigate(`/movie/${currentMovie.id}`)}
          />
        </AnimatePresence>
      </div>

      <div className="mt-2 sm:mt-4 flex items-center justify-center gap-6 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSwipe('dislike')} title="Nem tetszik"
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/5 shadow-2xl hover:bg-error/20 transition-colors group">
          <X size={28} className="text-error/60 group-hover:text-error transition-all" />
        </motion.button>
        {lastSwipe && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }} onClick={handleUndo} title="Vissza"
            className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-xl hover:bg-white/10 transition-colors">
            <Undo2 size={20} className="text-white/50" />
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSwipe('like')} title="Tetszik"
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/5 shadow-2xl hover:bg-secondary/20 transition-colors group">
          <Heart size={28} className="text-secondary/60 group-hover:text-secondary transition-all" fill="currentColor" />
        </motion.button>
      </div>
    </div>
  );
};

const WatchlistScreen = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<any[]>([]);
  const [moviesData, setMoviesData] = useState<Record<string, Movie>>({});
  const [loading, setLoading] = useState(true);
  const [rouletteWinner, setRouletteWinner] = useState<Movie | null>(null);
  const [showPartnerLikes, setShowPartnerLikes] = useState(false);
  const [partnerLikedMovies, setPartnerLikedMovies] = useState<Movie[]>([]);
  const [loadingPartnerLikes, setLoadingPartnerLikes] = useState(false);

  useEffect(() => {
    if (showPartnerLikes && user && profile?.partnerId) {
      setLoadingPartnerLikes(true);
      getPartnerLikedMovies(profile.partnerId, user.uid).then(movies => {
        setPartnerLikedMovies(movies);
        setLoadingPartnerLikes(false);
      });
    }
  }, [showPartnerLikes, user, profile?.partnerId]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      const unsub = subscribeToMatches(user.uid, async (newMatches) => {
        const sorted = [...newMatches].sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        setMatches(sorted);
        
        const newMoviesData = { ...moviesData };
        let changed = false;
        
        for (const match of sorted) {
          if (!newMoviesData[match.movieId]) {
            const data = await getMovieById(match.movieId);
            if (data) {
              newMoviesData[match.movieId] = data;
              changed = true;
            }
          }
        }
        
        if (changed) {
          setMoviesData(prev => ({ ...prev, ...newMoviesData }));
        }
        setLoading(false);
      });

      return () => unsub();
    }
  }, [user]);

  const handleRoulette = () => {
    const unwatched = matches.filter(m => !m.watched);
    if (unwatched.length === 0) {
      toast.error('Nincs több megnézetlen matchetek!', { icon: '🍿' });
      return;
    }
    const winnerMatch = unwatched[Math.floor(Math.random() * unwatched.length)];
    const winnerMovie = moviesData[winnerMatch.movieId];
    if (winnerMovie) {
      navigator.vibrate?.([100, 50, 100]);
      setRouletteWinner(winnerMovie);
    }
  };

  const displayMatches = [...matches].sort((a, b) => {
    if (a.watched === b.watched) return 0;
    return a.watched ? 1 : -1;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-headline font-black uppercase tracking-[0.2em] text-[10px]">Találatok betöltése</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full px-6 pt-24 pb-32 overflow-y-auto">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-primary font-headline font-black uppercase tracking-[0.2em] text-[10px] mb-1">Közös gyűjtemény</p>
            <h1 className="text-4xl font-black font-headline tracking-tight uppercase">Watchlist</h1>
          </div>
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleRoulette}
              className="w-10 h-10 sm:w-12 sm:h-12 bg-primary text-black rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
              <Shuffle size={18} />
            </motion.button>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full h-10 flex items-center">
              <p className="text-xs font-bold text-white/60"><span className="text-primary">{matches.length}</span></p>
            </div>
          </div>
        </div>

        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
          <button onClick={() => setShowPartnerLikes(false)}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${!showPartnerLikes ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}>
            <Heart size={14} fill={!showPartnerLikes ? "currentColor" : "none"} /> MATCH-EK
          </button>
          <button onClick={() => { if (!profile?.partnerId) { toast.error('Csak partnerrel érhető el!'); return; } setShowPartnerLikes(true); }}
            className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${showPartnerLikes ? 'bg-secondary/20 text-secondary shadow-lg border border-secondary/20' : 'text-white/40 hover:text-white/60'}`}>
            <Sparkles size={14} fill={showPartnerLikes ? "currentColor" : "none"} /> PÁROM KEDVENCEI
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showPartnerLikes ? (
          <motion.div key="partner-likes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            {loadingPartnerLikes ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-bold text-secondary/60 uppercase tracking-widest leading-none">Scanneljük a párod szívét</p>
              </div>
            ) : partnerLikedMovies.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/20"><Sparkles size={32} /></div>
                <p className="text-white/40 text-sm max-w-[200px] mx-auto italic font-serif">Minden kedvencét láttad már. Igazi harmónia!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {partnerLikedMovies.map((movie, idx) => (
                  <motion.div key={movie.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: idx * 0.05 }}
                    className="group relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                    <img src={movie.posterUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                    <div className="absolute top-3 right-3">
                      <button onClick={async (e) => { e.preventDefault(); await swipeMovie(user!.uid, movie.id, 'like', profile?.partnerId); toast.success('Lopva hozzáadva a listához! 😉', { icon: '❤️' }); setPartnerLikedMovies(prev => prev.filter(m => m.id !== movie.id)); }}
                        className="w-10 h-10 bg-secondary/80 backdrop-blur-xl text-black rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                        <Heart size={20} fill="currentColor" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Párod lájkolta</p>
                      <h3 className="text-sm font-black text-white uppercase line-clamp-2">{movie.title}</h3>
                    </div>
                    <Link to={`/movie/${movie.id}`} className="absolute inset-0 z-0" />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="matches" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            {matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="w-24 h-24 bg-surface-container-high rounded-[2rem] flex items-center justify-center text-white/20 border border-white/5"><Film size={48} /></div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-headline uppercase tracking-tight">Még nincs közös listád</h3>
                  <p className="text-on-surface-variant max-w-[240px] mx-auto text-sm leading-relaxed opacity-60">Kezdj el válogatni, és ha a párod is kedveli ugyanazt a filmet, itt fog megjelenni!</p>
                </div>
                <Link to="/" className="text-primary font-headline font-black uppercase tracking-widest text-xs hover:underline underline-offset-8">Vissza a válogatáshoz</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {displayMatches.map((match, index) => {
                  const movie = moviesData[match.movieId];
                  if (!movie) return null;
                  return (
                    <motion.div key={match.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                      className={`group relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5 transition-all duration-500 ${match.watched ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                      <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                      <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <div className={`p-1.5 rounded-full shadow-lg ${match.watched ? 'bg-white/10 text-white/40' : 'bg-primary text-black'}`}><Heart size={14} fill="currentColor" /></div>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMatchWatched(match.id, !match.watched); }}
                          title={match.watched ? "Mégse láttuk" : "Láttuk"} className={`p-1.5 rounded-full shadow-lg transition-colors ${match.watched ? 'bg-primary text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                          {match.watched ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">{movie.year}</span>
                          <span className="w-1 h-1 bg-white/30 rounded-full" />
                          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{movie.duration}</span>
                        </div>
                        <h3 className="text-sm font-black font-headline text-white uppercase tracking-tight leading-tight line-clamp-2">{movie.title}</h3>
                        {match.watched && <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-2">MEGNÉZVE</p>}
                      </div>
                      <Link to={`/movie/${movie.id}`} className="absolute inset-0 z-0" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rouletteWinner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center">
            <p className="text-primary font-headline font-black uppercase tracking-[0.4em] text-xs mb-8">Az sors választott:</p>
            <motion.div initial={{ scale: 0.8, rotateY: 180 }} animate={{ scale: 1, rotateY: 0 }} className="relative w-full max-w-[280px] aspect-[2/3] rounded-[2rem] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.8)] border-2 border-primary/30 mb-12">
              <img src={rouletteWinner.posterUrl} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute bottom-0 p-8 text-left"><h2 className="font-headline font-black text-3xl text-white uppercase leading-none">{rouletteWinner.title}</h2></div>
            </motion.div>
            <div className="w-full max-w-xs flex flex-col gap-4">
              <button onClick={() => { navigate(`/movie/${rouletteWinner.id}`); setRouletteWinner(null); }} className="w-full bg-primary text-black font-headline font-black py-5 rounded-2xl uppercase tracking-tight shadow-2xl shadow-primary/20">Ezt nézzük meg!</button>
              <button onClick={() => setRouletteWinner(null)} className="w-full bg-white/5 text-white/60 font-bold py-5 rounded-2xl uppercase tracking-widest text-[10px]">Vissza</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MovieDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    const loadMovie = async () => {
      if (id) {
        setLoading(true);
        const [movieData, trailer] = await Promise.all([
          getMovieById(id),
          getMovieTrailer(id)
        ]);
        setMovie(movieData);
        setTrailerUrl(trailer);
        setLoading(false);
      }
    };
    loadMovie();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-headline font-black uppercase tracking-[0.2em] text-[10px]">Részletek betöltése</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center text-error opacity-40">
          <X size={40} />
        </div>
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight">Film nem található</h2>
        <button onClick={() => navigate(-1)} className="text-primary font-headline font-black uppercase tracking-widest text-xs">Vissza</button>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full relative pb-10">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-6 pointer-events-none">
        <button 
          onClick={() => navigate(-1)} 
          className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-white border border-white/10 hover:bg-black/60 transition-all active:scale-90 shadow-2xl"
        >
          <X size={24} />
        </button>
        <button className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-primary border border-white/10 hover:bg-black/60 transition-all active:scale-90 shadow-2xl">
          <Heart size={24} fill="currentColor" />
        </button>
      </header>

      {/* Hero Section */}
      <div className="relative h-[65vh] w-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={movie.posterUrl} className="w-full h-full object-cover blur-md scale-110 opacity-40" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background" />
        </div>

        <div className="relative z-10 h-full flex flex-col items-center justify-end px-8 pb-12">
          <motion.div 
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-48 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] border border-white/10 mb-8"
          >
            <img src={movie.posterUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </motion.div>
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center space-y-2"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="bg-primary text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{movie.year}</span>
              <span className="bg-white/10 backdrop-blur-xl text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-white/5">{movie.duration}</span>
            </div>
            <h1 className="text-4xl font-black font-headline tracking-tight uppercase leading-none">{movie.title}</h1>
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="flex items-center text-primary">
                <Star size={16} fill="currentColor" />
                <span className="text-sm font-black ml-1">{movie.rating}</span>
              </div>
              <div className="flex items-center gap-2">
                {movie.genres.map(g => (
                  <span key={g} className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{g}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-8 space-y-10">
        <section className="space-y-4">
          <h3 className="text-xs font-black font-headline uppercase tracking-[0.2em] text-white/40">Összefoglaló</h3>
          <p className="text-lg leading-relaxed text-on-surface/90 font-light max-w-3xl">
            {movie.synopsis}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Népszerűség</span>
            <div className="flex items-center gap-2 text-secondary">
              <TrendingUp size={20} />
              <span className="text-xl font-black font-headline uppercase tracking-tight">Felkapott</span>
            </div>
          </div>
          <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">IMDb Pontszám</span>
            <div className="flex items-center gap-1 text-primary">
              <span className="text-2xl font-black font-headline uppercase tracking-tight">{movie.rating}</span>
              <span className="text-xs font-bold opacity-40">/10</span>
            </div>
          </div>
        </section>

        {showTrailer && trailerUrl && (
          <section className="rounded-2xl overflow-hidden aspect-video bg-black border border-white/10">
            <iframe src={trailerUrl} className="w-full h-full" allowFullScreen title="Trailer" />
          </section>
        )}

        <section className="pt-6 border-t border-white/5">
          {trailerUrl ? (
            <button onClick={() => setShowTrailer(!showTrailer)} className="w-full py-5 bg-primary text-black font-headline font-black rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 uppercase tracking-tight active:scale-95 transition-transform">
              <PlayCircle size={28} /> {showTrailer ? 'Előzetes elrejtése' : 'Előzetes megnézése'}
            </button>
          ) : (
            <button disabled className="w-full py-5 bg-white/5 text-white/30 font-headline font-black rounded-2xl flex items-center justify-center gap-3 uppercase tracking-tight cursor-not-allowed">
              <PlayCircle size={28} /> Nincs elérhető előzetes
            </button>
          )}
          <button onClick={() => {
            if (navigator.share) {
              navigator.share({ title: movie.title, text: `Nézd meg: ${movie.title} (${movie.year})`, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }} className="w-full mt-4 py-5 bg-white/5 border border-white/10 rounded-2xl text-white font-headline font-bold uppercase tracking-widest text-xs active:scale-95 transition-transform">
            Megosztás
          </button>
        </section>
      </div>
    </div>
  );
};

const ProfileScreen = () => {
  const { profile, user, setPartnerId } = useAuth();
  const [partnerIdInput, setPartnerIdInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profile?.partnerId) {
      setPartnerIdInput(profile.partnerId);
    }
  }, [profile]);

  const handleSetPartner = async () => {
    await setPartnerId(partnerIdInput);
    setIsEditing(false);
  };
  
  const myPartnerUrl = `https://mayydayy99.github.io/cinepair/#/?partner=${user?.uid || ''}`;

  return (
    <div className="h-full w-full px-6 pt-24 pb-32 overflow-y-auto">
      <div className="mb-10">
        <p className="text-primary font-headline font-black uppercase tracking-[0.2em] text-[10px] mb-1">Account Settings</p>
        <h1 className="text-4xl font-black font-headline tracking-tight uppercase">Profile</h1>
      </div>

      <div className="space-y-8">
        {/* User Info Card */}
        <div className="bg-glass rounded-[2rem] p-8 border border-white/5 shadow-2xl flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full border-4 border-primary/20 overflow-hidden shadow-2xl">
              <img src={profile?.photoURL} alt={profile?.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-primary text-black p-2 rounded-full shadow-lg">
              <UserIcon size={16} />
            </div>
          </div>
          <h2 className="text-2xl font-black font-headline uppercase tracking-tight">{profile?.displayName}</h2>
          <p className="text-on-surface-variant font-body text-sm opacity-60">{user?.email}</p>
        </div>

        {/* Partner Connection Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-4">
            <h3 className="text-xs font-black font-headline uppercase tracking-[0.2em] text-white/40">Partner összekötés</h3>
            <button 
              onClick={() => {
                if ('Notification' in window) {
                  Notification.requestPermission().then(permission => {
                    if (permission === 'granted') toast.success('Értesítések engedélyezve!');
                  });
                }
              }}
              className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 active:scale-95"
            >
              <Bell size={12} /> Értesítések
            </button>
          </div>
          <div className="bg-glass rounded-[2rem] p-8 border border-white/5 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary border border-secondary/20">
                <Heart size={24} fill="currentColor" />
              </div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-tight">Párosítás</p>
                <p className="text-xs text-on-surface-variant opacity-60">Add meg a párod azonosítóját a közös listához.</p>
              </div>
            </div>

            {isEditing || !profile?.partnerId ? (
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={partnerIdInput}
                    onChange={(e) => setPartnerIdInput(e.target.value)}
                    placeholder="Partner User ID"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-primary/50 transition-colors placeholder:text-white/20"
                  />
                </div>
                <button
                  onClick={handleSetPartner}
                  className="w-full bg-primary text-black font-headline font-black py-4 rounded-2xl uppercase tracking-tight active:scale-95 transition-transform shadow-lg shadow-primary/10"
                >
                  Mentés
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
                  <p className="text-sm font-bold text-white/80 font-mono">{profile.partnerId}</p>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-primary font-black text-[10px] uppercase tracking-widest hover:underline"
                >
                  Módosítás
                </button>
              </div>
            )}

            <div className="pt-6 border-t border-white/5 space-y-6">
              <button 
                onClick={() => setShowQr(!showQr)} 
                className="w-full bg-[#1a1a1a] border border-secondary/30 text-secondary font-headline font-bold py-4 rounded-2xl hover:bg-[#2a2a2a] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
              >
                Közös link QR mutatása
              </button>
              <AnimatePresence>
                {showQr && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }} 
                    className="overflow-hidden flex flex-col items-center pt-2 space-y-3"
                  >
                    <div className="bg-white p-3 rounded-2xl shadow-xl">
                      <QRCode value={myPartnerUrl} size={150} fgColor="#000" bgColor="#fff" />
                    </div>
                    <p className="text-[10px] text-white/50 text-center uppercase tracking-widest px-4 line-clamp-2">
                      Olvasd be a kamerával a másik telefonon a gyors csatlakozáshoz!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(user?.uid || '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 px-5 py-4 rounded-2xl transition-colors flex items-center justify-between group active:scale-[0.98]"
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">A te azonosítód</span>
                  <span className="text-white/80 font-mono text-xs">{user?.uid}</span>
                </div>
                {copied ? (
                  <div className="flex items-center gap-2 text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                    <Check size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">Másolva</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-white/40 group-hover:text-white/80 transition-colors">
                    <Copy size={16} />
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-8 flex flex-col gap-4">
          <button
            onClick={() => logout()}
            className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-error font-headline font-black uppercase tracking-widest text-xs hover:bg-error/10 transition-colors active:scale-95"
          >
            Kijelentkezés
          </button>
          <p className="text-center text-[10px] text-on-surface-variant opacity-30 uppercase tracking-[0.3em]">CinePair v2.0 Premium</p>
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, loading, setPartnerId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMovieDetail = location.pathname.startsWith('/movie/');
  const [previousMatchCount, setPreviousMatchCount] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      const unsub = subscribeToMatches(user.uid, async (matches) => {
        if (previousMatchCount !== null && matches.length > previousMatchCount) {
          // Find the newest match based on timestamp
          const newMatch = matches.reduce((prev, current) => 
            (prev.timestamp?.toMillis() || 0) > (current.timestamp?.toMillis() || 0) ? prev : current
          );
          
          if (newMatch && newMatch.matchedBy && newMatch.matchedBy !== user.uid) {
            const movie = await getMovieById(newMatch.movieId);
            if (movie) {
              // Trigger in-app toast
              toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-surface-container-high shadow-[0_20px_40px_rgba(0,0,0,0.8)] rounded-2xl pointer-events-auto flex items-center border border-primary/20 p-4 gap-4`}>
                  <div className="h-16 w-12 rounded-lg overflow-hidden shrink-0">
                    <img src={movie.posterUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black tracking-widest uppercase text-primary mb-1">Új Találat!</p>
                    <p className="text-sm font-bold text-white line-clamp-1">{movie.title}</p>
                    <p className="text-xs text-white/50">A párod épp most kedvelte!</p>
                  </div>
                  <button onClick={() => { toast.dismiss(t.id); navigate(`/movie/${movie.id}`); }} className="bg-primary text-black px-4 py-2 text-xs font-bold uppercase rounded-full">
                    Nézem
                  </button>
                </div>
              ), { duration: 5000, position: 'top-center' });

              // Trigger OS notification if allowed
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Új CinePair Találat! 🍿', { body: `A párod is kedvelte: ${movie.title}`, icon: '/icon-512.png' });
              }
            }
          }
        }
        setPreviousMatchCount(matches.length);
      });
      return unsub;
    }
  }, [user, previousMatchCount, navigate]);

  useEffect(() => {
    let partnerId = null;
    if (location.search) {
      const params = new URLSearchParams(location.search);
      partnerId = params.get('partner');
    }
    if (!partnerId && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      const params = new URLSearchParams(hashQuery);
      partnerId = params.get('partner');
    }

    if (user && partnerId) {
      setPartnerId(partnerId).then(() => {
        const url = new URL(window.location.href);
        if (url.hash.includes('?')) {
          const parts = url.hash.split('?');
          const params = new URLSearchParams(parts[1]);
          params.delete('partner');
          const newParams = params.toString();
          const newHash = parts[0] + (newParams ? '?' + newParams : '');
          window.history.replaceState({}, '', url.pathname + url.search + newHash);
        }
      });
    }
  }, [user, location, setPartnerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-full h-[100dvh] sm:w-[414px] sm:h-[896px] sm:max-h-[95vh] bg-background sm:rounded-[2.5rem] sm:border border-white/10 sm:shadow-2xl sm:shadow-red-900/10 overflow-hidden relative flex flex-col">
        {!isMovieDetail && <Navbar />}
        <div className="flex-1 overflow-x-hidden overflow-y-auto w-full h-full pb-28 relative">
          <Routes>
            <Route path="/" element={<SwipeScreen />} />
            <Route path="/watchlist" element={<WatchlistScreen />} />
            <Route path="/movie/:id" element={<MovieDetailScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
        {!isMovieDetail && <BottomNav />}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Toaster />
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
