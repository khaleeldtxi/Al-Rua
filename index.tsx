import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// --- Constants ---
const CALCULATION_METHODS = [
  { id: 2, name: "Islamic Society of North America (ISNA)" },
  { id: 3, name: "Muslim World League" },
  { id: 4, name: "Umm Al-Qura University, Makkah" },
  { id: 5, name: "Egyptian General Authority of Surveying" },
  { id: 1, name: "University of Islamic Sciences, Karachi" },
  { id: 0, name: "Shia Ithna-Ashari (Jafari)" },
  { id: 12, name: "France (UOIF)" },
  { id: 13, name: "Turkey (Diyanet)" },
  { id: 14, name: "Russia (Spiritual Administration)" },
  { id: 11, name: "Singapore (MUIS)" },
  { id: 8, name: "Gulf Region" },
  { id: 991, name: "University of Islamic Sciences (17 degree)" },
];

const FIQH_OPTIONS = [
  { id: 0, name: "Standard (Shafi, Maliki, Hanbali)" },
  { id: 1, name: "Hanafi" }
];

const DAILY_VERSES = [
  {
    arabic: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
    translation: "For indeed, with hardship [will be] ease.",
    ref: "Surah Ash-Sharh 94:5"
  },
  {
    arabic: "اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ",
    translation: "Allah is the Light of the heavens and the earth.",
    ref: "Surah An-Nur 24:35"
  },
  {
    arabic: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ",
    translation: "And when My servants ask you concerning Me, indeed I am near.",
    ref: "Surah Al-Baqarah 2:186"
  },
  {
    arabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    translation: "Indeed, Allah is with the patient.",
    ref: "Surah Al-Baqarah 2:153"
  },
  {
     arabic: "وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ",
     translation: "And my success is not but through Allah.",
     ref: "Surah Hud 11:88"
  },
  {
     arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً",
     translation: "Our Lord, give us in this world [that which is] good and in the Hereafter [that which is] good.",
     ref: "Surah Al-Baqarah 2:201"
  },
  {
    arabic: "وَاللَّهُ يَرْزُقُ مَن يَشَاءُ بِغَيْرِ حِسَابٍ",
    translation: "And Allah gives provision to whom He wills without account.",
    ref: "Surah Al-Baqarah 2:212"
  }
];

// --- Types & Interfaces ---

interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

// --- Icons (FontAwesome wrappers for simpler usage) ---
const Icons = {
  Mosque: () => <i className="fa-solid fa-mosque"></i>,
  Sun: () => <i className="fa-solid fa-sun"></i>,
  Moon: () => <i className="fa-solid fa-moon"></i>,
  Book: () => <i className="fa-solid fa-book-quran"></i>,
  Compass: () => <i className="fa-solid fa-compass"></i>,
  Send: () => <i className="fa-solid fa-paper-plane"></i>,
  Close: () => <i className="fa-solid fa-xmark"></i>,
  Robot: () => <i className="fa-solid fa-hands-praying"></i>,
  Spinner: () => <i className="fa-solid fa-circle-notch fa-spin"></i>,
  Location: () => <i className="fa-solid fa-location-dot"></i>,
  Pen: () => <i className="fa-solid fa-pen"></i>,
  GPS: () => <i className="fa-solid fa-crosshairs"></i>,
  Refresh: () => <i className="fa-solid fa-arrows-rotate"></i>,
  Bowl: () => <i className="fa-solid fa-utensils"></i>,
  MoonCloud: () => <i className="fa-solid fa-cloud-moon"></i>,
  ChevronRight: () => <i className="fa-solid fa-chevron-right"></i>,
  Settings: () => <i className="fa-solid fa-gear"></i>,
  Minus: () => <i className="fa-solid fa-minus"></i>,
  Plus: () => <i className="fa-solid fa-plus"></i>,
};

// --- Helper Functions ---

const formatTime = (time24: string) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${minutes} ${ampm}`;
};

const addMinutes = (timeStr: string, minutesToAdd: number) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  date.setMinutes(date.getMinutes() + minutesToAdd);
  const newH = String(date.getHours()).padStart(2, '0');
  const newM = String(date.getMinutes()).padStart(2, '0');
  return `${newH}:${newM}`;
};

const getHijriDate = (adjustment = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + adjustment);
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    calendar: "islamic-umalqura",
  } as any;
  return new Intl.DateTimeFormat("en-US-u-ca-islamic", options).format(date);
};

const getDailyVerse = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return DAILY_VERSES[day % DAILY_VERSES.length];
};

// --- Components ---

const PrayerCard = ({
  name,
  time,
  isNext,
  icon,
  index
}: {
  name: string;
  time: string;
  isNext: boolean;
  icon: React.ReactNode;
  index: number;
}) => (
  <div
    style={{ animationDelay: `${index * 100}ms` }}
    className={`relative overflow-hidden flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-500 ease-out cursor-default border ${
      isNext
        ? "bg-qolb-dark text-white shadow-xl shadow-qolb-primary/30 scale-[1.02] border-qolb-dark animate-pulse-slow ring-4 ring-qolb-primary/10"
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-slate-700 hover:shadow-lg border-slate-100 dark:border-slate-700 animate-slide-in-right"
    }`}
  >
    {isNext && (
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-qolb-accent to-transparent"></div>
    )}
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-3 transition-colors duration-300 ${
        isNext 
        ? "bg-white/10 text-qolb-accent" 
        : "bg-qolb-bg dark:bg-slate-700 text-slate-400 group-hover:text-qolb-dark dark:group-hover:text-qolb-light"
      }`}
    >
      {icon}
    </div>
    
    <span className={`block font-serif text-lg mb-1 ${isNext ? "font-bold text-white" : "font-medium text-slate-800 dark:text-white"}`}>
      {name}
    </span>
    
    <span className={`font-mono text-2xl font-bold tracking-tight ${isNext ? "text-qolb-accent" : "text-slate-600 dark:text-slate-400"}`}>
      {formatTime(time)}
    </span>
    
    {isNext && (
      <span className="mt-2 text-[10px] bg-qolb-accent/20 text-qolb-accent px-2 py-0.5 rounded-full uppercase tracking-widest font-bold animate-pulse">
        Upcoming
      </span>
    )}
  </div>
);

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "model", text: "Assalamu Alaykum. I am your guide for Al Rua. How may I assist you in your journey today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [{ text: userMsg }],
          },
        ],
        config: {
          systemInstruction:
            "You are a wise, polite, and knowledgeable Islamic assistant for a website named 'Al Rua'. Your purpose is to provide guidance on Islamic teachings, Quranic verses, Hadith, and history. Answer with serenity and respect. If asked about prayer times, kindly refer the user to the dashboard. Keep answers concise but spiritually enriching.",
        },
      });

      const text = response.text || "I apologize, I am momentarily unable to reflect on that.";
      setMessages((prev) => [...prev, { role: "model", text }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "An error occurred. Please try again later." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-qolb-dark hover:bg-qolb-primary text-qolb-accent rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 group border border-qolb-accent/20 hover:scale-110 active:scale-95"
      >
        {isOpen ? <Icons.Close /> : <Icons.Robot />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 md:w-96 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden z-40 h-[500px] animate-scale-in origin-bottom-right">
          <div className="bg-qolb-dark p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-qolb-accent">
              <Icons.Robot />
            </div>
            <div>
              <h3 className="text-white font-serif">Al Rua Guide</h3>
              <p className="text-white/60 text-xs font-sans">Powered by Gemini</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-scroll bg-qolb-bg dark:bg-slate-900">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-qolb-dark text-white rounded-br-none"
                      : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-600 rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-white dark:bg-slate-700 p-3 rounded-2xl rounded-bl-none shadow-sm">
                  <span className="text-qolb-dark dark:text-slate-300"><Icons.Spinner /></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about faith..."
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-qolb-primary text-slate-800 dark:text-slate-200 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="w-10 h-10 bg-qolb-dark hover:bg-qolb-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-colors"
            >
              <Icons.Send />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const LocationModal = ({
  isOpen,
  onClose,
  onSave,
  onUseGPS,
  currentMethod,
  currentFiqh,
  currentAdjustment,
  currentCity,
  currentCountry,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (city: string, country: string, method: number, fiqh: number, adjustment: number) => void;
  onUseGPS: (method: number, fiqh: number, adjustment: number) => void;
  currentMethod: number;
  currentFiqh: number;
  currentAdjustment: number;
  currentCity: string;
  currentCountry: string;
}) => {
  const [city, setCity] = useState(currentCity);
  const [country, setCountry] = useState(currentCountry);
  const [method, setMethod] = useState(currentMethod);
  const [fiqh, setFiqh] = useState(currentFiqh);
  const [adjustment, setAdjustment] = useState(currentAdjustment);

  useEffect(() => {
    if (isOpen) {
        setMethod(currentMethod);
        setFiqh(currentFiqh);
        setAdjustment(currentAdjustment);
        setCity(currentCity);
        setCountry(currentCountry);
    }
  }, [isOpen, currentMethod, currentFiqh, currentAdjustment, currentCity, currentCountry]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-slate-200 dark:border-slate-700 transform transition-all">
        <div className="bg-qolb-bg dark:bg-slate-900 p-6 flex justify-between items-center border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-serif text-xl font-bold text-qolb-dark dark:text-white flex items-center gap-2">
            Settings & Location
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
            <Icons.Close />
          </button>
        </div>
        <div className="p-6 space-y-5">
          
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Calculation Method</label>
            <div className="relative">
                <select
                    value={method}
                    onChange={(e) => setMethod(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-qolb-dark text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 transition-all"
                >
                    {CALCULATION_METHODS.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.name}
                        </option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.ChevronRight />
                </div>
            </div>
          </div>

          <div>
             <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Jurisprudence</label>
            <div className="relative">
                <select
                    value={fiqh}
                    onChange={(e) => setFiqh(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-qolb-dark text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 transition-all"
                >
                    {FIQH_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.name}
                        </option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.ChevronRight />
                </div>
            </div>
          </div>

          <div>
             <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Hijri Date Adjustment</label>
             <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-700 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                <button 
                  onClick={() => setAdjustment(a => a - 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-600 rounded-full shadow-sm text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors"
                >
                  <Icons.Minus />
                </button>
                <span className="flex-1 text-center font-mono font-bold text-slate-700 dark:text-white text-lg">
                  {adjustment > 0 ? `+${adjustment}` : adjustment} Days
                </span>
                <button 
                  onClick={() => setAdjustment(a => a + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-600 rounded-full shadow-sm text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors"
                >
                  <Icons.Plus />
                </button>
             </div>
             <p className="text-[10px] text-slate-400 mt-2 ml-1">Adjust if the lunar date differs from your local sighting.</p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-2"></div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">City</label>
                <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Mecca"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-qolb-dark text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 transition-all"
                />
             </div>
             <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Country</label>
                <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Saudi Arabia"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-qolb-dark text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600 transition-all"
                />
             </div>
          </div>

          <div className="flex gap-3 pt-4">
             <button
              onClick={() => {
                if(city && country) onSave(city, country, method, fiqh, adjustment);
              }}
              className="flex-1 bg-qolb-dark hover:bg-qolb-primary text-white py-3 rounded-xl font-serif font-bold transition-transform hover:scale-[1.02] shadow-lg shadow-qolb-dark/20"
            >
              Update Settings
            </button>
            <button
              onClick={() => onUseGPS(method, fiqh, adjustment)}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-white rounded-xl font-medium transition-transform hover:scale-[1.02] flex items-center gap-2"
              title="Use GPS"
            >
              <Icons.GPS />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<string | null>(null);
  const [locationName, setLocationName] = useState("Locating...");
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [error, setError] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Initialize state from LocalStorage if available
  const [locationMode, setLocationMode] = useState<'gps' | 'city'>(() => {
    const saved = localStorage.getItem('locationMode');
    // Default to 'gps' if not explicitly set to 'city'
    return saved === 'city' ? 'city' : 'gps';
  });
  
  const [savedCity, setSavedCity] = useState<{city: string, country: string} | null>(() => {
    const saved = localStorage.getItem('savedCity');
    try {
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
  });

  const [calculationMethod, setCalculationMethod] = useState(() => {
    const saved = localStorage.getItem('calculationMethod');
    return saved ? parseInt(saved) : 991;
  });

  const [fiqh, setFiqh] = useState(() => {
    const saved = localStorage.getItem('fiqh');
    return saved ? parseInt(saved) : 1;
  });

  const [hijriAdjustment, setHijriAdjustment] = useState(() => {
    const saved = localStorage.getItem('hijriAdjustment');
    return saved ? parseInt(saved) : 0;
  });

  const [dailyVerse, setDailyVerse] = useState(DAILY_VERSES[0]);

  // Set default theme to 'dark'
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  // --- Persistence Effects ---
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('locationMode', locationMode);
  }, [locationMode]);

  useEffect(() => {
    if (savedCity) {
      localStorage.setItem('savedCity', JSON.stringify(savedCity));
    }
  }, [savedCity]);

  useEffect(() => {
    localStorage.setItem('calculationMethod', calculationMethod.toString());
  }, [calculationMethod]);

  useEffect(() => {
    localStorage.setItem('fiqh', fiqh.toString());
  }, [fiqh]);

  useEffect(() => {
    localStorage.setItem('hijriAdjustment', hijriAdjustment.toString());
  }, [hijriAdjustment]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update Daily Verse
  useEffect(() => {
      setDailyVerse(getDailyVerse());
  }, []);

  const fetchByGPS = (methodId: number = calculationMethod, fiqhId: number = fiqh, adjustment: number = hijriAdjustment) => {
      setLocationMode('gps');
      if (methodId !== calculationMethod) setCalculationMethod(methodId);
      if (fiqhId !== fiqh) setFiqh(fiqhId);
      if (adjustment !== hijriAdjustment) setHijriAdjustment(adjustment);
      
      setPrayerTimes(null);
      setError(null);
      setLocationName("Locating...");
      
      if (!navigator.geolocation) {
        setError("Geolocation not supported");
        return;
      }

      const apiMethod = methodId === 991 ? 1 : methodId;
  
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          // Simple reverse geocoding fallback text
          setLocationName(`${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`);
  
          try {
            const date = new Date();
            const timestamp = Math.floor(date.getTime() / 1000);
            
            const response = await fetch(
              `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=${apiMethod}&school=${fiqhId}`
            );
            const data = await response.json();
            if (data.code === 200) {
              const timings = data.data.timings;
              
              if (methodId === 991) {
                const originalFajr = timings.Fajr;
                timings.Fajr = addMinutes(originalFajr, 5);
                timings.Imsak = originalFajr;
              }

              setPrayerTimes(timings);
              setLocationName(data.data.meta.timezone.split('/')[1]?.replace('_', ' ') || data.data.meta.timezone); 
              setTimezone(data.data.meta.timezone);
            } else {
              setError("Failed to fetch data");
            }
          } catch (err) {
            setError("Network Error");
          }
        },
        () => setError("Location access denied")
      );
  }

  const fetchByCity = async (city: string, country: string, methodId: number = calculationMethod, fiqhId: number = fiqh, adjustment: number = hijriAdjustment) => {
      setLocationMode('city');
      setSavedCity({city, country});
      if (methodId !== calculationMethod) setCalculationMethod(methodId);
      if (fiqhId !== fiqh) setFiqh(fiqhId);
      if (adjustment !== hijriAdjustment) setHijriAdjustment(adjustment);

      setPrayerTimes(null);
      setError(null);
      setLocationName(`${city}, ${country}`);

      const apiMethod = methodId === 991 ? 1 : methodId;
      
      try {
        const date = new Date();
        const timestamp = Math.floor(date.getTime() / 1000);
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByCity/${timestamp}?city=${city}&country=${country}&method=${apiMethod}&school=${fiqhId}`
        );
        const data = await response.json();
        
        if (data.code === 200) {
            const timings = data.data.timings;
            if (methodId === 991) {
              const originalFajr = timings.Fajr;
              timings.Fajr = addMinutes(originalFajr, 5);
              timings.Imsak = originalFajr;
            }
            setPrayerTimes(timings);
            setTimezone(data.data.meta.timezone);
            setLocationName(`${city}, ${country}`);
        } else {
            setError("Location not found");
        }
      } catch (err) {
          setError("Network Error");
      }
  }

  const handleRefresh = () => {
    if (locationMode === 'gps') {
      fetchByGPS();
    } else if (locationMode === 'city' && savedCity) {
      fetchByCity(savedCity.city, savedCity.country);
    }
  };

  // Initial Fetch based on saved preference
  useEffect(() => {
    // Explicitly check for saved city preference to prioritize it
    if (locationMode === 'city' && savedCity) {
      fetchByCity(savedCity.city, savedCity.country, calculationMethod, fiqh, hijriAdjustment);
    } else {
      fetchByGPS(calculationMethod, fiqh, hijriAdjustment);
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (!prayerTimes) return;
    const now = new Date();
    let timeNow = 0;
    try {
        const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            hour: 'numeric',
            minute: 'numeric',
            hourCycle: 'h23',
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);
        const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
        const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
        timeNow = h * 60 + m;
    } catch (e) {
        timeNow = now.getHours() * 60 + now.getMinutes();
    }

    const times = [
      { name: "Fajr", time: prayerTimes.Fajr },
      { name: "Dhuhr", time: prayerTimes.Dhuhr },
      { name: "Asr", time: prayerTimes.Asr },
      { name: "Maghrib", time: prayerTimes.Maghrib },
      { name: "Isha", time: prayerTimes.Isha },
    ];

    let found = false;
    for (const t of times) {
      const [h, m] = t.time.split(":").map(Number);
      const tMinutes = h * 60 + m;
      if (tMinutes > timeNow) {
        setNextPrayer(t.name);
        found = true;
        break;
      }
    }
    if (!found) setNextPrayer("Fajr");
  }, [prayerTimes, timezone, currentTime]); // Re-check every second with clock

  return (
    <div className="min-h-screen pattern-bg pb-20 selection:bg-qolb-primary selection:text-white transition-colors duration-500">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3 animate-fade-in-up">
             <div className="w-10 h-10 bg-qolb-dark text-white rounded-xl flex items-center justify-center text-xl shadow-lg shadow-qolb-dark/20 transition-transform hover:scale-105">
                <i className="fa-solid fa-kaaba"></i>
             </div>
             <span className="text-2xl font-serif font-bold text-qolb-dark dark:text-white tracking-tight">Al Rua</span>
          </div>
          
          <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
             <button 
               onClick={toggleTheme}
               className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-qolb-accent transition-all hover:rotate-12"
             >
               {theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}
             </button>

             {/* Dedicated Settings Button */}
             <button
               onClick={() => setShowLocationModal(true)}
               className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-qolb-accent transition-all hover:rotate-90"
               title="Settings"
             >
                <Icons.Settings />
             </button>

             {/* Location Display (Clickable fallback) */}
             <button
                onClick={() => setShowLocationModal(true)}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
             >
                <Icons.Location />
                <span>{locationName}</span>
             </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        
        {/* --- Hero Section --- */}
        <div className="relative rounded-[3rem] overflow-hidden min-h-[550px] flex flex-col p-8 md:p-12 shadow-2xl shadow-qolb-dark/20 group animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            
            {/* Background Images */}
            <div className="absolute inset-0 z-0 bg-white dark:bg-black transition-colors duration-500">
               {/* Light Mode Image */}
               <img 
                  src="https://images.unsplash.com/photo-1542468087-175591c2780e?q=80&w=2670&auto=format&fit=crop" 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${theme === 'light' ? 'opacity-100' : 'opacity-0'}`}
                  alt="Golden Arch"
               />
               
               {/* Dark Mode Image */}
               <img 
                  src="https://lh3.googleusercontent.com/pw/AP1GczOfzCLDs1-uc-D22_ecMmX4eyyC1F4XicMqQ5gfQ8fk9ulnHFGI_k_iyHS8KcdpPPclVJ_ghH5F6mlAqM01h3s9JJ5r3CTWUSvw7UhtqfkGJYnGAcp0JSVsnHtEe5s_dgZLw5zv1Vyy40W67qqA2RTG=w1312-h736-s-no" 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`}
                  alt="Dark Arch"
               />
               
               {/* Overlays */}
               <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-white/10 dark:from-slate-900 dark:via-slate-900/40 dark:to-slate-900/10 mix-blend-multiply transition-colors duration-500"></div>
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-transparent dark:via-slate-900/60 opacity-50 transition-colors duration-500"></div>
            </div>

            {/* Content Container */}
            <div className="relative z-10 flex flex-col h-full justify-between">
                
                {/* Top Row: Date & Current Time Label */}
                <div className="flex justify-between items-start text-qolb-dark dark:text-white">
                    <p className="font-bold tracking-widest uppercase text-sm md:text-base opacity-80">{getHijriDate(hijriAdjustment)}</p>
                    <p className="font-bold tracking-widest uppercase text-sm md:text-base opacity-80">Current Time</p>
                </div>

                {/* Middle Row: Greeting & Big Clock */}
                <div className="flex flex-col md:flex-row justify-between items-center md:items-start my-8 gap-8">
                     {/* Left: Greeting */}
                    <div className="text-center md:text-left">
                         <h2 className="text-4xl md:text-6xl font-serif font-bold text-qolb-dark dark:text-white mb-2 leading-tight drop-shadow-sm">
                            Peace be upon you
                         </h2>
                         <h2 className="text-3xl md:text-5xl font-arabic text-qolb-dark dark:text-white mb-4 opacity-90 drop-shadow-sm">
                            السلام عليكم
                         </h2>
                         <p className="text-qolb-primary dark:text-qolb-light font-sans text-lg flex items-center justify-center md:justify-start gap-2 font-medium">
                            <Icons.Location /> <span>{locationName}</span>
                         </p>
                    </div>

                    {/* Right: Clock & Next Prayer */}
                    <div className="text-center md:text-right">
                         <div className="text-6xl md:text-8xl font-mono font-light text-qolb-dark dark:text-white tracking-wide mb-2 drop-shadow-sm">
                            {currentTime.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute:'2-digit', hour12: true }).replace(/ AM| PM/, '')}
                            <span className="text-2xl md:text-3xl ml-2 font-sans font-bold text-qolb-primary dark:text-qolb-light">
                                {currentTime.toLocaleTimeString('en-US', { timeZone: timezone, hour12: true }).slice(-2)}
                            </span>
                         </div>
                         <div className="inline-block bg-qolb-dark/5 dark:bg-white/10 backdrop-blur-sm px-6 py-2 rounded-full border border-qolb-dark/10 dark:border-white/10">
                             <span className="text-qolb-primary dark:text-qolb-light text-xs font-bold uppercase tracking-widest mr-3">Upcoming: {nextPrayer || "--"}</span>
                             <span className="text-qolb-dark dark:text-white text-xl font-mono font-bold">
                                {prayerTimes && nextPrayer ? formatTime(prayerTimes[nextPrayer as keyof PrayerTimes]) : "--:--"}
                             </span>
                         </div>
                    </div>
                </div>

                {/* Bottom Row: Daily Quranic Wisdom */}
                <div className="flex flex-col md:flex-row items-center md:items-end gap-6 border-t border-qolb-dark/10 dark:border-white/10 pt-8 mt-auto">
                     {/* Left: Label */}
                     <div className="hidden md:flex flex-col items-center justify-center w-32 border-r border-qolb-dark/10 dark:border-white/10 pr-6 h-full">
                         <div className="text-qolb-primary dark:text-qolb-light text-2xl mb-2"><Icons.Book /></div>
                         <div className="text-qolb-dark dark:text-white text-[10px] font-bold uppercase tracking-[0.2em] text-center leading-relaxed">Daily<br/>Wisdom</div>
                     </div>
                     
                     {/* Center: Verse */}
                     <div className="flex-1 text-center animate-fade-in">
                         {/* Arabic Verse - Centered & Large */}
                         <p className="text-4xl md:text-6xl font-arabic text-qolb-dark dark:text-white leading-relaxed mb-6 drop-shadow-sm" dir="rtl">
                             {dailyVerse.arabic}
                         </p>
                         <p className="text-qolb-dark/80 dark:text-white/80 italic font-serif text-xl md:text-2xl leading-relaxed mb-2">
                             "{dailyVerse.translation}"
                         </p>
                         <p className="text-sm text-qolb-primary dark:text-qolb-light font-bold uppercase tracking-widest">— {dailyVerse.ref}</p>
                     </div>

                     {/* Right: Decorative (optional) */}
                     <div className="hidden md:block w-32 opacity-20 text-qolb-dark dark:text-white text-right text-xs font-bold leading-loose">
                        YOU ARE<br/>NOT ALONE<br/><br/>DON'T<br/>GIVE UP
                     </div>
                </div>
            </div>
        </div>

        {/* --- Prayer Times Grid --- */}
        <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
                 <h3 className="font-serif text-3xl font-bold text-qolb-dark dark:text-white">Prayer Schedule</h3>
                 <button onClick={handleRefresh} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-qolb-primary transition-colors">
                    <Icons.Refresh /> Refresh
                 </button>
            </div>
            
            {prayerTimes ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <PrayerCard index={0} icon={<Icons.Sun />} name="Fajr" time={prayerTimes.Fajr} isNext={nextPrayer === "Fajr"} />
                    <PrayerCard index={1} icon={<Icons.Sun />} name="Sunrise" time={prayerTimes.Sunrise} isNext={false} />
                    <PrayerCard index={2} icon={<Icons.Sun />} name="Dhuhr" time={prayerTimes.Dhuhr} isNext={nextPrayer === "Dhuhr"} />
                    <PrayerCard index={3} icon={<Icons.Sun />} name="Asr" time={prayerTimes.Asr} isNext={nextPrayer === "Asr"} />
                    <PrayerCard index={4} icon={<Icons.Moon />} name="Maghrib" time={prayerTimes.Maghrib} isNext={nextPrayer === "Maghrib"} />
                    <PrayerCard index={5} icon={<Icons.Moon />} name="Isha" time={prayerTimes.Isha} isNext={nextPrayer === "Isha"} />
                </div>
            ) : (
                <div className="h-40 flex items-center justify-center text-slate-400 gap-3">
                     <span className="text-2xl animate-spin"><Icons.Spinner /></span>
                     <span className="text-sm">Retrieving Prayer Times...</span>
                </div>
            )}
        </div>

        {/* --- Fasting Schedule --- */}
        {prayerTimes && (
            <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                 <div className="bg-[#E6DCC3] dark:bg-[#3d3626] rounded-[2rem] p-8 md:p-10 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 transform transition-all hover:scale-[1.005] duration-500">
                    
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -translate-y-10 translate-x-10"></div>
                    <div className="absolute -left-10 -bottom-10 text-9xl text-black/5 dark:text-white/5">
                        <Icons.Moon />
                    </div>

                    {/* Header */}
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-[#786028] text-[#E6DCC3] flex items-center justify-center text-3xl shadow-lg">
                            <Icons.Bowl />
                        </div>
                        <div>
                             <h3 className="text-[#5C491E] dark:text-[#E6DCC3] font-serif text-3xl font-bold mb-1">Fasting Schedule</h3>
                             <p className="text-[#786028] dark:text-[#a8925b] font-medium">Suhoor & Iftar timings for today</p>
                        </div>
                    </div>
                    
                    {/* Timings */}
                    <div className="relative z-10 flex w-full md:w-auto bg-white/40 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-2 divide-x divide-[#5C491E]/10 dark:divide-[#E6DCC3]/10">
                        <div className="px-8 py-4 flex-1 text-center">
                            <p className="text-[#786028] dark:text-[#a8925b] text-xs font-bold uppercase tracking-wider mb-2">Suhoor Ends</p>
                            <p className="text-3xl font-mono text-[#423315] dark:text-[#F7F5F0] font-bold">{formatTime(prayerTimes.Imsak)}</p>
                        </div>
                        <div className="px-8 py-4 flex-1 text-center">
                            <p className="text-[#786028] dark:text-[#a8925b] text-xs font-bold uppercase tracking-wider mb-2">Iftar Starts</p>
                            <p className="text-3xl font-mono text-[#423315] dark:text-[#F7F5F0] font-bold">{formatTime(prayerTimes.Maghrib)}</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </main>

      <ChatWidget />
      
      <LocationModal 
        isOpen={showLocationModal} 
        onClose={() => setShowLocationModal(false)}
        onSave={(city, country, method, fiqh, adjustment) => {
            fetchByCity(city, country, method, fiqh, adjustment);
            setShowLocationModal(false);
        }}
        onUseGPS={(method, fiqh, adjustment) => {
            fetchByGPS(method, fiqh, adjustment);
            setShowLocationModal(false);
        }}
        currentMethod={calculationMethod}
        currentFiqh={fiqh}
        currentAdjustment={hijriAdjustment}
        currentCity={savedCity?.city || ""}
        currentCountry={savedCity?.country || ""}
      />
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);