import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { LogIn, Heart, User as UserIcon, Layers, Info, X, PlayCircle, Play, Share2, UserPlus, Star, TrendingUp, HeartOff, Loader2, Film, Copy, Check } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { signInWithGoogle, logout } from './firebase';
import { getMovies, getMovieById, getUserSwipes, swipeMovie, subscribeToMatches, Movie } from './services/movieService';
import QRCode from 'react-qr-code';

// --- Components ---

const Navbar = () => {
  const { profile } = useAuth();
  return (
    <nav className="absolute top-0 left-0 w-full z-[60] flex justify-between items-center px-6 py-5 bg-gradient-to-b from-background via-background/80 to-transparent backdrop-blur-sm pointer-events-none">
      <div className="w-10 flex items-center justify-start pointer-events-auto">
        {profile?.photoURL && (
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 shadow-lg shadow-primary/5"
          >
            <img src={profile.photoURL} alt="User avatar" referrerPolicy="no-referrer" />
          </motion.div>
        )}
      </div>
      <Link to="/" className="flex flex-col items-center pointer-events-auto">
        <span className="text-2xl font-black tracking-[-0.05em] text-gradient font-headline uppercase leading-none">
          CINEPAIR
        </span>
        <span className="text-[8px] font-label uppercase tracking-[0.4em] text-on-surface-variant opacity-60 mt-0.5">
          Cinematic Match
        </span>
      </Link>
      <div className="w-10" />
    </nav>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[85%] z-50 flex justify-around items-center px-4 py-3 bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
      <Link to="/" className={`relative flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 ${isActive('/') ? 'text-primary scale-110' : 'text-on-surface/40 hover:text-on-surface'}`}>
        <Layers size={22} fill={isActive('/') ? 'currentColor' : 'none'} />
        {isActive('/') && <motion.div layoutId="nav-glow" className="absolute inset-0 bg-primary/10 rounded-full blur-md" />}
      </Link>
      <Link to="/watchlist" className={`relative flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 ${isActive('/watchlist') ? 'text-primary scale-110' : 'text-on-surface/40 hover:text-on-surface'}`}>
        <Heart size={22} fill={isActive('/watchlist') ? 'currentColor' : 'none'} />
        {isActive('/watchlist') && <motion.div layoutId="nav-glow" className="absolute inset-0 bg-primary/10 rounded-full blur-md" />}
      </Link>
      <Link to="/profile" className={`relative flex flex-col items-center justify-center p-3 rounded-full transition-all duration-300 ${isActive('/profile') ? 'text-primary scale-110' : 'text-on-surface/40 hover:text-on-surface'}`}>
        <UserIcon size={22} fill={isActive('/profile') ? 'currentColor' : 'none'} />
        {isActive('/profile') && <motion.div layoutId="nav-glow" className="absolute inset-0 bg-primary/10 rounded-full blur-md" />}
      </Link>
    </footer>
  );
};

// --- Pages ---

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);

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

  const shareUrl = "https://mayydayy99.github.io/cinepair/";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a] relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-600/20 blur-[120px] rounded-full mix-blend-screen opacity-60 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-orange-500/20 blur-[120px] rounded-full mix-blend-screen opacity-60 animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
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
                  <button 
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#e50914] to-[#b81d24] text-white font-headline font-black py-4 rounded-2xl shadow-lg shadow-red-900/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-wide group"
                  >
                    <LogIn size={22} className="group-hover:translate-x-1 transition-transform" />
                    {loading ? 'Belépés...' : 'Belépés Google-lel'}
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
  key?: any;
}

const MovieCard = ({ movie, onSwipe, onInfo }: MovieCardProps) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);
  const infoOpacity = useTransform(y, [-150, -50], [1, 0]);
  const scale = useTransform(x, [-200, 0, 200], [0.9, 1, 0.9]);

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
      style={{ x, y, rotate, opacity, scale }}
      drag
      dragElastic={0.8}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      whileTap={{ scale: 1.02, cursor: 'grabbing' }}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.9, opacity: 0, y: 40 }}
      animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      exit={{ 
        x: x.get() > 100 ? 500 : x.get() < -100 ? -500 : 0, 
        y: y.get() < -100 ? -500 : 0,
        opacity: 0, 
        transition: { duration: 0.25, ease: "easeOut" } 
      }}
      className="absolute inset-0 rounded-[2.5rem] overflow-hidden card-shadow group cursor-grab bg-surface-container-highest border border-white/5 shadow-2xl"
    >
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface">
          <Loader2 className="w-10 h-10 text-primary/20 animate-spin" />
        </div>
      )}
      
      <motion.div 
        style={{ opacity: likeOpacity }}
        className="absolute top-12 left-12 z-50 border-4 border-secondary text-secondary font-headline font-black text-5xl px-6 py-3 rounded-2xl rotate-[-15deg] uppercase tracking-tighter"
      >
        LIKE
      </motion.div>
      <motion.div 
        style={{ opacity: nopeOpacity }}
        className="absolute top-12 right-12 z-50 border-4 border-error text-error font-headline font-black text-5xl px-6 py-3 rounded-2xl rotate-[15deg] uppercase tracking-tighter"
      >
        NOPE
      </motion.div>
      <motion.div 
        style={{ opacity: infoOpacity }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 border-4 border-primary text-primary font-headline font-black text-5xl px-6 py-3 rounded-2xl uppercase tracking-tighter whitespace-nowrap"
      >
        INFO
      </motion.div>

      <img 
        src={movie.posterUrl} 
        onLoad={() => setImageLoaded(true)}
        className={`w-full h-full object-cover pointer-events-none transition-all duration-700 ease-out ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`} 
        referrerPolicy="no-referrer" 
      />
      <div className="absolute inset-0 poster-gradient pointer-events-none" />
      
      <div className="absolute bottom-0 left-0 w-full p-10 flex flex-col gap-5 pointer-events-none">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-primary text-black text-[10px] font-black rounded-full uppercase tracking-widest">IMDb {movie.rating}</span>
            <span className="text-on-surface/60 font-label text-xs tracking-widest uppercase">{movie.year} • {movie.duration}</span>
          </div>
          <h2 className="text-5xl font-black font-headline leading-[0.9] text-on-surface tracking-[-0.05em] uppercase break-words">
            {movie.title}
          </h2>
        </div>
        
        <p className="text-on-surface-variant text-sm leading-relaxed line-clamp-2 font-body opacity-80">
          {movie.synopsis}
        </p>
        
        <div className="flex flex-wrap gap-2">
          {movie.genres.map(genre => (
            <span key={genre} className="px-4 py-1.5 bg-white/5 rounded-full text-[10px] font-bold text-on-surface/60 uppercase tracking-widest border border-white/5">{genre}</span>
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

  const loadMoreMovies = async (targetPage: number, forceYear?: string) => {
    setLoading(true);
    const yr = forceYear !== undefined ? forceYear : yearFilter;
    const fetchedMovies = await getMovies({ page: targetPage, year: yr });
    
    if (user) {
      const swipedIds = await getUserSwipes(user.uid);
      const unswiped = fetchedMovies.filter(m => !swipedIds.includes(m.id));
      
      if (unswiped.length === 0 && fetchedMovies.length > 0) {
        setPage(targetPage + 1);
        await loadMoreMovies(targetPage + 1, yr);
        return;
      }
      setMovies(unswiped);
      setCurrentIndex(0);
    } else {
      setMovies(fetchedMovies);
      setCurrentIndex(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    loadMoreMovies(1, yearFilter);
  }, [user, yearFilter]);

  const processNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= movies.length) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadMoreMovies(nextPage, yearFilter);
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const handleSwipe = async (type: 'like' | 'dislike') => {
    if (currentIndex >= movies.length) return;
    
    const movie = movies[currentIndex];
    const isMatch = await swipeMovie(user!.uid, movie.id, type, profile?.partnerId);
    
    if (isMatch) {
      setShowMatch(movie);
    } else {
      processNext();
    }
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
    <div className="relative h-full w-full flex flex-col items-center justify-center px-6 pt-24 pb-36 overflow-hidden">
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
                New Connection
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

      <div className="absolute top-24 z-40 px-6 w-full flex justify-between items-center pointer-events-none">
        <select 
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="bg-black/50 text-white border border-white/10 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest backdrop-blur-xl pointer-events-auto cursor-pointer focus:outline-none"
        >
          <option value="">Összes év</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
          <option value="2021">2021</option>
          <option value="2020">2020</option>
          <option value="2010">2010</option>
        </select>
        <div className="bg-black/50 border border-white/10 px-4 py-2 rounded-full backdrop-blur-xl text-xs font-bold uppercase tracking-widest text-primary pointer-events-auto">
          {currentIndex + 1} / {movies.length}
        </div>
      </div>

      <div className="relative w-full max-w-md aspect-[9/16] max-h-[60vh] flex items-center justify-center">
        <AnimatePresence mode="popLayout">
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
            onSwipe={handleSwipe}
            onInfo={() => navigate(`/movie/${currentMovie.id}`)}
          />
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-center gap-10">
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSwipe('dislike')}
          className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/5 shadow-2xl hover:bg-error/20 transition-colors group"
        >
          <X size={36} className="text-error/60 group-hover:text-error group-hover:rotate-12 transition-all" />
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSwipe('like')}
          className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center border border-white/5 shadow-2xl hover:bg-secondary/20 transition-colors group"
        >
          <Heart size={36} className="text-secondary/60 group-hover:text-secondary group-hover:scale-110 transition-all" fill="currentColor" />
        </motion.button>
      </div>
    </div>
  );
};

const WatchlistScreen = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [moviesData, setMoviesData] = useState<Record<string, Movie>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setLoading(true);
      const unsub = subscribeToMatches(user.uid, async (newMatches) => {
        setMatches(newMatches);
        
        let changed = false;
        const newMoviesData = { ...moviesData };
        
        for (const match of newMatches) {
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

  const matchedMovies = matches.map(match => moviesData[match.movieId]).filter(Boolean) as Movie[];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-headline font-black uppercase tracking-[0.2em] text-[10px]">Loading Matches</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full px-6 pt-24 pb-32 overflow-y-auto">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-primary font-headline font-black uppercase tracking-[0.2em] text-[10px] mb-1">Your Collection</p>
          <h1 className="text-4xl font-black font-headline tracking-tight uppercase">Watchlist</h1>
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full">
          <p className="text-xs font-bold text-white/60">
            <span className="text-primary">{matchedMovies.length}</span> FILMS
          </p>
        </div>
      </div>

      {matchedMovies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-24 h-24 bg-surface-container-high rounded-[2rem] flex items-center justify-center text-white/20 border border-white/5">
            <Film size={48} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold font-headline uppercase tracking-tight">Még nincs közös listád</h3>
            <p className="text-on-surface-variant max-w-[240px] mx-auto text-sm leading-relaxed opacity-60">
              Kezdj el húzogatni, és ha a párod is kedveli ugyanazt a filmet, itt fog megjelenni!
            </p>
          </div>
          <Link to="/" className="text-primary font-headline font-black uppercase tracking-widest text-xs hover:underline underline-offset-8">
            Vissza a válogatáshoz
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {matchedMovies.map((movie, index) => (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5"
            >
              <img 
                src={movie.posterUrl} 
                alt={movie.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
              
              <div className="absolute top-3 right-3">
                <div className="bg-primary text-black p-1.5 rounded-full shadow-lg">
                  <Heart size={14} fill="currentColor" />
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">{movie.year}</span>
                  <span className="w-1 h-1 bg-white/30 rounded-full" />
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{movie.duration}</span>
                </div>
                <h3 className="text-sm font-black font-headline text-white uppercase tracking-tight leading-tight line-clamp-2">
                  {movie.title}
                </h3>
              </div>

              <Link 
                to={`/movie/${movie.id}`}
                className="absolute inset-0 z-10"
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const MovieDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMovie = async () => {
      if (id) {
        setLoading(true);
        const allMovies = await getMovies();
        const found = allMovies.find(m => m.id === id);
        setMovie(found || null);
        setLoading(false);
      }
    };
    loadMovie();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-headline font-black uppercase tracking-[0.2em] text-[10px]">Loading Details</p>
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
    <div className="h-full w-full overflow-y-auto pb-40">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-6 pointer-events-none">
        <button 
          onClick={() => navigate(-1)} 
          className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-white border border-white/10 hover:bg-black/60 transition-all active:scale-90"
        >
          <X size={24} />
        </button>
        <button className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full text-primary border border-white/10 hover:bg-black/60 transition-all active:scale-90">
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
          <h3 className="text-xs font-black font-headline uppercase tracking-[0.2em] text-white/40">The Synopsis</h3>
          <p className="text-lg leading-relaxed text-on-surface/90 font-light max-w-3xl">
            {movie.synopsis}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Popularity</span>
            <div className="flex items-center gap-2 text-secondary">
              <TrendingUp size={20} />
              <span className="text-xl font-black font-headline uppercase tracking-tight">Trending</span>
            </div>
          </div>
          <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] flex flex-col items-center text-center">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">IMDb Score</span>
            <div className="flex items-center gap-1 text-primary">
              <span className="text-2xl font-black font-headline uppercase tracking-tight">{movie.rating}</span>
              <span className="text-xs font-bold opacity-40">/10</span>
            </div>
          </div>
        </section>

        <section className="pt-6 border-t border-white/5">
          <button className="w-full py-5 bg-primary text-black font-headline font-black rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 uppercase tracking-tight active:scale-95 transition-transform">
            <PlayCircle size={28} /> Watch Trailer
          </button>
          <button className="w-full mt-4 py-5 bg-white/5 border border-white/10 rounded-2xl text-white font-headline font-bold uppercase tracking-widest text-xs active:scale-95 transition-transform">
            Megosztás
          </button>
        </section>

        <section className="pt-2">
          <button className="w-full py-4 text-error/60 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:text-error transition-colors">
            <HeartOff size={16} /> Remove from Matches
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
          <h3 className="text-xs font-black font-headline uppercase tracking-[0.2em] text-white/40 ml-4">Partner Connection</h3>
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
  const isMovieDetail = location.pathname.startsWith('/movie/');

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
      <div className="w-full sm:w-[414px] sm:h-[896px] sm:max-h-[95vh] bg-background sm:rounded-[2.5rem] sm:border border-white/10 sm:shadow-2xl sm:shadow-red-900/10 overflow-hidden relative flex flex-col">
        {!isMovieDetail && <Navbar />}
        <div className="flex-1 overflow-x-hidden overflow-y-auto w-full h-full pb-20 relative">
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
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
