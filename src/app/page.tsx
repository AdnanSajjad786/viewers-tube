"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import NativeVideoCarousel from "@/app/components/native-video-carousel";

type Video = {
  id: string;
  title: string;
  creator: string;
  thumbnail: string;
  published: string;
  description: string;
  url: string;
  provider: string;
};

function watchHref(v: Video) {
  const params = new URLSearchParams({
    provider: v.provider,
    id: v.id,
    title: v.title,
    creator: v.creator
  });
  return `/watch?${params.toString()}`;
}

const categories = ["For you","Technology","Gaming","Music","Education","Documentary","Travel","Creativity","18+ (TXXX.porn)"];
const providers = ["All platforms","YouTube","Vimeo","Dailymotion"];
const countries = ["Worldwide","USA","UK","France","Japan","Korea"];
const languages = ["All languages","English","French","Arabic"];

const profileGroups = [
  {
    title: "Professional Profiles",
    subtitle: "Professional work, portfolios and creative communities",
    links: [
      ["LinkedIn","https://www.linkedin.com/in/adnan-sajjad-b48567262/"],
      ["GitHub","https://github.com/AdnanSajjad786"],
      ["GitHub Portfolio","https://adnansajjad786.github.io/portfolio-website/"],
      ["GitHub Wiki","https://github.com/AdnanSajjad786/portfolio-website/wiki"],
      ["Google Developer Profile","https://developers.google.com/profile/u/adnan-sajjad"],
      ["Behance","https://www.behance.net/adnansajjad2"],
      ["Dribbble","https://dribbble.com/Adnansajjad786"],
      ["Xing","https://www.xing.com/profile/Adnan_Sajjad/web_profiles"],
      ["SlideShare","https://www.slideshare.net/AdnanSajjad13"],
      ["Flickr","https://www.flickr.com/photos/204864725@N02/"]
    ]
  },
  {
    title: "Websites & Digital Cards",
    subtitle: "Websites, portfolios, online identity and CV",
    links: [
      ["Gravatar","https://gravatar.com/adnansajjadnew786"],
      ["Digital Business Card","https://tinyurl.com/Adnan-sajjad"],
      ["Linktree","https://linktr.ee/adnansajjad786"],
      ["Campsite.bio","https://campsite.bio/adnansajjad"],
      ["Google Sites","https://sites.google.com/view/adnan-sajjad"],
      ["WordPress","https://adnansajjad786.wordpress.com"],
      ["Blogger Profile","https://www.blogger.com/profile/09356015196666368292"],
      ["Cloudflare Pages Portfolio","https://portfolio-website-hjo.pages.dev/"],
      ["Netlify Portfolio","https://profound-piroshki-d24591.netlify.app/"],
      ["Vercel Portfolio","https://portfolio-website-m27l.vercel.app/"],
      ["Firebase Portfolio","https://adnan-sajjad-portfolio-website.web.app/"],
      ["Published Google CV","https://docs.google.com/document/d/e/2PACX-1vRZw2jm6GjlQ6RUYIcyvSd1R0y_87sz4yT2sl_cIC7ZgD7I4yeo_MnrNiKew8wj2xbMiS3Mz5fKwUfg/pub"]
    ]
  },
  {
    title: "Social Media & Video",
    subtitle: "Follow, connect and watch across social platforms",
    links: [
      ["Facebook Profile","https://www.facebook.com/profile.php?id=61580769429465"],
      ["Facebook Page","https://www.facebook.com/profile.php?id=61563646817562"],
      ["MeWe","https://mewe.com/adnan_sajjad"],
      ["X","https://x.com/AdnanSajjadnew"],
      ["Instagram","https://www.instagram.com/adnansajjad786"],
      ["Threads","https://www.threads.com/@adnansajjad786"],
      ["TikTok","https://www.tiktok.com/@adnan.sajjad.addy"],
      ["YouTube","https://www.youtube.com/@adnansajjad786"],
      ["Dailymotion","https://www.dailymotion.com/user/adnansajjad786"],
      ["Pinterest","https://www.pinterest.com/adnansajjadnew786"],
      ["Snapchat","https://www.snapchat.com/add/adnansajjadkhi"],
      ["Twitch","https://www.twitch.tv/adnansajjad"]
    ]
  },
  {
    title: "Contact, Meetings & Services",
    subtitle: "Appointments, communication and service links",
    links: [
      ["ERPNext Contact Page · Private network","https://adnan-hp-elitebook-folio-9480m.tail1d44e6.ts.net/contact"],
      ["Dolibarr CRM · Local network","http://192.168.100.72/contact-adnan-sajjad-dolibarr-crm.php"],
      ["Laptop Location Viewer","https://adnan-laptop-location.web.app/view.html"],
      ["Laptop Location Tracker","https://adnan-laptop-location.web.app/location.html"],
      ["Calendly Appointment","https://calendly.com/adnansajjadnew786/adnan-sajjad"],
      ["Google Meet","https://meet.google.com/dge-ytjp-zdo?pli=1"],
      ["Microsoft Teams","https://teams.live.com/l/invite/FEAwzpFsG45z8GyIwM?v=g1"],
      ["Skype","https://join.skype.com/IVr202tWLh3t"],
      ["Zoom Profile","https://us05web.zoom.us/profile"],
      ["Join Zoom Meeting","https://us05web.zoom.us/j/3565627499"]
    ]
  },
  {
    title: "Email Contacts",
    subtitle: "Choose an email address to start a message",
    links: [
      ["Gmail · Primary","mailto:adnansajjadnew786@gmail.com"],
      ["Gmail · 2025","mailto:adnansajjad786new2025@gmail.com"],
      ["Gmail · 2026","mailto:adnansajjad786new2026@gmail.com"],
      ["Gmail · Contact","mailto:02136940190adnan@gmail.com"],
      ["Yahoo Mail","mailto:adnansajjad786new@yahoo.com"],
      ["Hotmail","mailto:adnansajjad786new@hotmail.com"],
      ["Outlook","mailto:adnansajjadnew786@outlook.com"],
      ["Proton Mail","mailto:adnansajjad786new@proton.me"],
      ["Proton Mail · Contact","mailto:02136940190adnan@proton.me"]
    ]
  }
];


export default function Home() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [nativeVideos, setNativeVideos] = useState<Array<{
    id: string; title: string; creator: string; thumbnail?: string | null;
    description?: string | null; ownerType?: string; provider: string;
  }>>([]);
  const [nativeLoading, setNativeLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/videos/library", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Library unavailable");
        return response.json();
      })
      .then((data) => setNativeVideos(Array.isArray(data.items) ? data.items : []))
      .catch((error) => {
        if (error.name !== "AbortError") console.error("Native library could not load.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setNativeLoading(false);
      });
    return () => controller.abort();
  }, []);


  useEffect(() => {
    if (!session?.user?.id) {
      setAccountRole(null);
      return;
    }

    const controller = new AbortController();

    fetch("/api/account-role", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load account role");
        return response.json();
      })
      .then((data) => {
        if (["ADMIN", "CREATOR", "VIEWER"].includes(data.role)) {
          setAccountRole(data.role);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Account role lookup failed");
        }
      });

    return () => controller.abort();
  }, [session?.user?.id]);
  const [query, setQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const popularSearches = [
    "Hollywood latest movies",
    "Hollywood movie trailers",
    "Latest Bollywood movies",
    "Indian songs",
    "Latest Hindi songs",
    "Punjabi songs",
    "Pakistani dramas",
    "Pakistani songs",
    "K-pop music videos",
    "Latest music videos",
    "Cricket highlights",
    "Football highlights",
    "Gaming highlights",
    "Technology reviews",
    "AI news and tutorials",
    "Educational documentaries",
    "Travel videos around the world",
    "Funny videos",
    "Latest movie trailers"
  ];

  const searchSuggestions = query.trim()
    ? popularSearches
        .filter(item => item.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 7)
    : popularSearches.slice(0, 7);

  const visibleSuggestions = query.trim() && searchSuggestions.length === 0
    ? [
        `${query.trim()} latest videos`,
        `${query.trim()} songs`,
        `${query.trim()} trailers`,
        `${query.trim()} highlights`
      ]
    : searchSuggestions;

  function chooseSearchSuggestion(value: string) {
    setQuery(value);
    setShowSearchSuggestions(false);
  }

  function SearchSuggestions() {
    if (!showSearchSuggestions) return null;
    return (
      <div className="search-suggestions">
        <div className="suggestions-heading">
          {query.trim() ? "SUGGESTED SEARCHES" : "POPULAR SEARCHES"}
        </div>
        {visibleSuggestions.map(item => (
          <button
            type="button"
            key={item}
            onMouseDown={e => e.preventDefault()}
            onClick={() => chooseSearchSuggestion(item)}
          >
            <span>⌕</span>{item}
          </button>
        ))}
      </div>
    );
  }
  const [category, setCategory] = useState("For you");
  const [provider, setProvider] = useState("All platforms");
  const [country, setCountry] = useState("Worldwide");
  const [language, setLanguage] = useState("All languages");
  const [translated, setTranslated] = useState(false);
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adultGateOpen, setAdultGateOpen] = useState(false);
  const [myChannel, setMyChannel] = useState<{title:string;thumbnail:string;url:string} | null>(null);
  const [myVideos, setMyVideos] = useState<Video[]>([]);
  const [myChannelLoading, setMyChannelLoading] = useState(true);
  const [myChannelError, setMyChannelError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadMyChannel() {
      try {
        const response = await fetch("/api/founder-channel", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your channel.");
        setMyChannel(data.channel || null);
        setMyVideos(data.items || []);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMyChannelError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) setMyChannelLoading(false);
      }
    }

    loadMyChannel();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        q: query,
        category: category === "For you" ? "" : category,
        country: country === "Worldwide" ? "" : country,
        language: language === "All languages" ? "" : language,
        provider
      });

      try {
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Search failed.");

        setVideos(data.items || []);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
          setVideos([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, provider, country, language]);


  useEffect(() => {
    if (!translated || videos.length === 0) {
      setTranslatedTitles({});
      return;
    }
    const controller = new AbortController();
    const targetLanguages: Record<string, string> = {
      English: "en", French: "fr", Arabic: "ar"
    };

    async function translateTitles() {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            targetLanguage: targetLanguages[language] || "en",
            items: videos.map(v => ({ id: v.id, text: v.title }))
          })
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted) setTranslatedTitles(data.translations || {});
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError")
          console.error("Title translation failed:", err.message);
      }
    }
    translateTitles();
    return () => controller.abort();
  }, [translated, videos, language]);

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-symbol">V</span><span>VIEWERS<span className="brand-accent">TUBE</span><small>WATCH · CREATE · SHARE</small></span></a>
        <nav className="main-nav"><a className="active" href="#discover">Discover</a><a href="#trending">Trending</a><a href="#creators">Creators</a><a href="/creator-guidelines">Creator Guidelines</a><a href="/studio">Studio</a></nav>
        <div className="top-actions">
          {sessionPending ? (
            <span className="signin" aria-live="polite">Checking...</span>
          ) : session ? (
            <>
              <a className="signin" href="/account">
                <span className="flex flex-col leading-tight">
                  <span>{session.user.name || "My account"}</span>
                  {accountRole && (
                    <span className="text-[10px] font-bold tracking-wider text-emerald-300">
                      {accountRole}
                    </span>
                  )}
                </span>
              </a>
              <a className="join-button" href="/account">My account ↗</a>
            </>
          ) : (
            <>
              <a className="signin" href="/login">Sign in</a>
              <a className="join-button" href="/signup">Join free ↗</a>
            </>
          )}
        </div>
      </header>

      <section className="quick-search" aria-label="Quick video search">
        <div className="quick-search-inner">
          <div className="quick-search-label">WHAT DO YOU WANT TO WATCH?</div>
          <div className="search-box quick-search-box">
            <span>⌕</span>
            <input
              aria-label="Search videos"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setShowSearchSuggestions(true);
              }}
              onFocus={() => setShowSearchSuggestions(true)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === "Escape")
                  setShowSearchSuggestions(false);
              }}
              placeholder="Search Hollywood movies, Indian songs, gaming and more..."
            />
            {query && (
              <button aria-label="Clear search" onClick={() => {
                setQuery("");
                setShowSearchSuggestions(true);
              }}>✕</button>
            )}
            <button
              type="button"
              className="quick-search-submit"
              onClick={() => setShowSearchSuggestions(false)}
            >Search ↗</button>
            <SearchSuggestions />
          </div>
          <div className="quick-search-hint">
            Search videos across YouTube, Vimeo and Dailymotion
          </div>
        </div>
      </section>

      <section className="hero" id="discover">
        <div className="hero-glow glow-a"/>
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot"/> ONE WORLD. EVERY VIDEO.</div>
          <h1>Every story.<br/>Everywhere.<br/><span>One place.</span></h1>
          <p className="hero-description">Discover videos from around the world. Explore different platforms, languages and cultures through one unified experience.</p>
          <div className="hero-actions"><a className="join-button large" href="#trending">Explore videos ↗</a><a className="text-link" href="#creators">I'm a creator →</a></div>
          <div className="hero-proof"><span className="proof-icon">◎</span> Discover content across video platforms</div>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
          <div className="hero-frame">
            <div className="frame-top"><span>VT / GLOBAL DISCOVERY <span className="tv-owner-name">· ADNAN SAJJAD</span></span><span className="quality">ULTRA HD</span></div>
            <div className="tv-display-row">
              <div className="tv-speaker tv-speaker-left"><span/><span/><span/><span/><span/><i/></div>
              <div className="hero-landscape">
                <div className="tv-world-globe"><div className="tv-world-map"></div><div className="tv-world-orbit"></div></div>
                <div className="tv-screen-glare"/>
                <div className="tv-screen-stars"><i/><i/><i/><i/><i/><i/><i/><i/></div>
                <div className="tv-brand-intro">
                  <div className="tv-opening-line"><span className="tv-opening-not">NOT </span><span className="tv-word-i">I</span><span className="tv-opening-not">. NOT </span><span className="tv-word-you">YOU</span><span className="tv-opening-not">.</span></div>
                  <div className="tv-we-logo"><span>V</span><i>=</i><strong>WE.</strong></div>
                  <div className="tv-brand-title">VIEWERS <span>TUBE.</span></div>
                  <div className="tv-brand-tagline">ONE WORLD. EVERY VOICE. EVERY STORY.</div>
                  <div className="tv-brand-divider"/>
                  <div className="tv-brand-actions">WATCH <b>·</b> CREATE <b>·</b> SHARE</div>
                </div>
                <div className="tv-screen-status"><i/> GLOBAL SIGNAL <span>4K UHD</span></div>
              </div>
              <div className="tv-speaker tv-speaker-right"><span/><span/><span/><span/><span/><i/></div>
            </div>
            <div className="frame-bottom"><span>01 — DISCOVER THE WORLD</span><span>WATCH ANYWHERE ↗</span></div>
          </div>
          <div className="float-card float-quality"><span>✦</span><div><strong>Global search</strong><small>MULTI-PLATFORM</small></div></div>
          <div className="float-card float-ai"><span>文</span><div><strong>Language discovery</strong><small>EXPLORE THE WORLD</small></div></div>
        </div>
        <div className="hero-bottom"><span>WATCH · DISCOVER · CONNECT</span><span>SCROLL TO EXPLORE ↓</span><span>EST. 2026</span></div>
      </section>

      <NativeVideoCarousel videos={nativeVideos} loading={nativeLoading} />

      <section className="content-section" id="trending">
        <div className="section-heading"><div><div className="eyebrow">YOUR WORLD OF VIDEO</div><h2>Discover <span>something new.</span></h2></div><span className="result-count">{loading ? "Searching..." : `${videos.length} videos`}</span></div>

        <div className="search-panel">
          <div className="search-box main-search-box">
            <span>⌕</span>
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setShowSearchSuggestions(true);
              }}
              onFocus={() => setShowSearchSuggestions(true)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === "Escape")
                  setShowSearchSuggestions(false);
              }}
              placeholder="Search YouTube, Vimeo and Dailymotion videos, creators, topics..."
            />
            {query && <button onClick={() => setQuery("")}>✕</button>}
            <SearchSuggestions />
          </div>
          <div className="filter-row">
            <label>PLATFORM<select value={provider} onChange={e=>setProvider(e.target.value)}>{providers.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>COUNTRY<select value={country} onChange={e=>setCountry(e.target.value)}>{countries.map(x=><option key={x}>{x}</option>)}</select></label>
            <label>LANGUAGE<select value={language} onChange={e=>setLanguage(e.target.value)}>{languages.map(x=><option key={x}>{x}</option>)}</select></label>
            <button className={translated?"translate active-translate":"translate"} onClick={()=>setTranslated(!translated)}>文 {translated?"Auto translation ON":"Auto translate"}</button>
          </div>
          <div className="translation-note">{translated ? `Translating titles into ${language === "All languages" ? "English" : language}.` : "Live search powered by YouTube, Vimeo and Dailymotion. Results appear in their original language."}</div>
        </div>

        <div className="category-row">{categories.map(c=><button key={c} onClick={()=>c==="18+ (TXXX.porn)"?setAdultGateOpen(true):setCategory(c)} className={category===c?"category selected":"category"}>{c}</button>)}</div>

        {adultGateOpen && (
          <div role="dialog" aria-modal="true" aria-labelledby="adult-title" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(5,5,15,.94)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
            <div style={{width:"100%",maxWidth:440,background:"#171426",border:"1px solid #59436e",borderRadius:18,padding:28,textAlign:"center",color:"#fff"}}>
              <div style={{fontSize:38,marginBottom:12}}>🔞</div>
              <h2 id="adult-title" style={{fontSize:24,marginBottom:12}}>18+ Adult Content</h2>
              <p style={{color:"#c4bfd0",lineHeight:1.6,marginBottom:22}}>This link leads to an external adult website. You must be at least 18 years old, or the age of majority in your location, whichever is higher. Adult content will open on TXXX.porn, not inside Viewers Tube.</p>
              <a href="https://www.txxx.porn/" target="_blank" rel="noopener noreferrer" className="join-button" onClick={()=>setAdultGateOpen(false)} style={{display:"inline-block",marginBottom:14}}>I confirm I'm 18+ · Continue ↗</a>
              <div><button className="category" onClick={()=>setAdultGateOpen(false)}>Cancel · Go back</button></div>
              <small style={{display:"block",color:"#9992aa",marginTop:18}}>External link only. TXXX search integration is not connected.</small>
            </div>
          </div>
        )}

        {error && <div className="empty-state"><strong>Search notice</strong><p>{error}</p></div>}
        {loading && <div className="empty-state"><strong>Finding videos...</strong><p>Searching YouTube for your selection.</p></div>}

        {!loading && !error && videos.length > 0 && (
          <div className="video-grid">
            {videos.map((v,i)=><article className="video-card" key={v.id}>
              <a href={watchHref(v)} className={`video-art art-${["one","two","three","four","five","six","seven","eight"][i%8]}`} style={{display:"block",position:"relative"}}>
                {v.thumbnail && <img src={v.thumbnail} alt={v.title} style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/>}
                <span className="video-tag" style={{zIndex:1}}>{v.provider}</span><span className="art-number" style={{zIndex:1}}>0{i+1}</span><span className="art-play" style={{zIndex:1}}>▶</span>
              </a>
              <div className="video-info"><div className="creator-avatar">{v.creator.charAt(0)}</div><div className="video-text"><h3><a href={watchHref(v)}>{translatedTitles[v.id] || v.title}</a></h3><p>{v.creator}</p><small>{v.provider} · {v.published ? new Date(v.published).toLocaleDateString() : "Video"} · <a href={v.url} target="_blank" rel="noopener noreferrer">Original ↗</a></small></div></div>
            </article>)}
          </div>
        )}

        {!loading && !error && videos.length===0 && <div className="empty-state"><strong>No videos found</strong><p>Try another search or change your filters.</p><button className="join-button" onClick={()=>{setQuery("");setCategory("For you");setProvider("All platforms");setCountry("Worldwide");setLanguage("All languages")}}>Clear filters ↗</button></div>}


      </section>

      <section className="content-section" id="my-channel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FROM THE FOUNDER</div>
            <h2>Adnan Sajjad — <span>My Channel.</span></h2>
          </div>
          {myChannel && <a className="text-link" href="https://www.youtube.com/@adnansajjad786/videos" target="_blank" rel="noopener noreferrer">View all videos ↗</a>}
        </div>

        {myChannel && (
          <div style={{display:"flex",alignItems:"center",gap:14,margin:"24px 0 28px"}}>
            {myChannel.thumbnail && <img src={myChannel.thumbnail} alt={myChannel.title} style={{width:54,height:54,borderRadius:"50%",objectFit:"cover"}} />}
            <div>
              <strong style={{fontSize:15}}>{myChannel.title}</strong>
              <p style={{fontSize:11,color:"#9998ab",margin:"5px 0 0"}}>Official YouTube channel · Latest uploads</p>
            </div>
          </div>
        )}

        {myChannelLoading && <div className="empty-state"><strong>Loading your channel...</strong><p>Fetching your latest YouTube videos.</p></div>}
        {myChannelError && <div className="empty-state"><strong>Channel notice</strong><p>{myChannelError}</p></div>}

        {!myChannelLoading && !myChannelError && myVideos.length > 0 && (
          <div className="video-grid">
            {myVideos.map((v,i)=><article className="video-card" key={v.id}>
              <a href={watchHref(v)} className={`video-art art-${["one","two","three","four","five","six","seven","eight"][i%8]}`} style={{display:"block",position:"relative"}}>
                {v.thumbnail && <img src={v.thumbnail} alt={v.title} style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}} />}
                <span className="video-tag" style={{zIndex:1}}>YouTube</span>
                <span className="art-number" style={{zIndex:1}}>{String(i+1).padStart(2,"0")}</span>
                <span className="art-play" style={{zIndex:1}}>▶</span>
              </a>
              <div className="video-info">
                <div className="creator-avatar">A</div>
                <div className="video-text">
                  <h3><a href={watchHref(v)}>{v.title}</a></h3>
                  <p>{v.creator}</p>
                  <small>{v.published ? new Date(v.published).toLocaleDateString() : "YouTube video"} · <a href={v.url} target="_blank" rel="noopener noreferrer">Original ↗</a></small>
                </div>
              </div>
            </article>)}
          </div>
        )}

        {!myChannelLoading && !myChannelError && myVideos.length === 0 && <div className="empty-state"><strong>No public videos found</strong><p>Your channel is connected, but no public uploads were returned.</p></div>}
      </section>


      <section className="content-section" id="terabox-library">
        <div className="section-heading">
          <div>
            <div className="eyebrow">TERABOX COLLECTION</div>
            <h2>More to watch. <span>More to discover.</span></h2>
          </div>
          <span className="result-count">TERABOX</span>
        </div>

        <article className="video-card" style={{maxWidth:520,marginTop:24}}>
          <a
            href="https://1024terabox.com/s/18PLgFoa6h9Mk-uEniDuFHA"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the Viewers Tube TeraBox collection"
            style={{
              display:"flex",
              minHeight:190,
              alignItems:"center",
              justifyContent:"center",
              flexDirection:"column",
              gap:12,
              background:"linear-gradient(135deg,#172554,#312e81,#581c87)",
              color:"#fff",
              textDecoration:"none",
              borderRadius:14
            }}
          >
            <span style={{fontSize:42,fontWeight:800,letterSpacing:2}}>TB</span>
            <strong style={{fontSize:17}}>VIEWERS TUBE COLLECTION</strong>
            <span style={{fontSize:12,opacity:.85}}>TeraBox shared folder</span>
          </a>
          <div className="video-info">
            <div className="creator-avatar">T</div>
            <div className="video-text">
              <h3>My TeraBox collection</h3>
              <p>Shared videos and files hosted on TeraBox</p>
              <small>
                <a
                  href="https://1024terabox.com/s/18PLgFoa6h9Mk-uEniDuFHA"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open collection on TeraBox ↗
                </a>
              </small>
            </div>
          </div>
        </article>
      </section>

      <section className="official-profiles" id="official-profiles">
        <div className="profiles-heading">
          <div className="eyebrow">THE PERSON BEHIND VIEWERS TUBE</div>
          <h2>Adnan Sajjad — <span>Official Profiles &amp; Connect.</span></h2>
          <p>Explore my professional profiles, websites, social channels and contact options in one place.</p>
        </div>

        <div className="profile-feature profile-feature-orbit">
        <div className="profile-orbit-stage">
          <div className="orbit-ring orbit-ring-one">
            <a className="orbit-icon" href="https://www.linkedin.com/in/adnan-sajjad-b48567262/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><img src="https://cdn.simpleicons.org/linkedin/0A66C2" alt="LinkedIn" /></a>
            <a className="orbit-icon" href="https://github.com/AdnanSajjad786" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><img src="https://cdn.simpleicons.org/github/FFFFFF" alt="GitHub" /></a>
            <a className="orbit-icon" href="https://www.facebook.com/profile.php?id=61580769429465" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><img src="https://cdn.simpleicons.org/facebook/0866FF" alt="Facebook" /></a>
            <a className="orbit-icon" href="https://www.instagram.com/adnansajjad786" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><img src="https://cdn.simpleicons.org/instagram/E4405F" alt="Instagram" /></a>
            <a className="orbit-icon" href="https://www.youtube.com/@adnansajjad786" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><img src="https://cdn.simpleicons.org/youtube/FF0033" alt="YouTube" /></a>
            <a className="orbit-icon" href="https://www.tiktok.com/@adnan.sajjad.addy" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><img src="https://cdn.simpleicons.org/tiktok/FFFFFF" alt="TikTok" /></a>
            <a className="orbit-icon" href="https://x.com/AdnanSajjadnew" target="_blank" rel="noopener noreferrer" aria-label="X"><img src="https://cdn.simpleicons.org/x/FFFFFF" alt="X" /></a>
            <a className="orbit-icon" href="https://www.pinterest.com/adnansajjadnew786" target="_blank" rel="noopener noreferrer" aria-label="Pinterest"><img src="https://cdn.simpleicons.org/pinterest/E60023" alt="Pinterest" /></a>
            <a className="orbit-icon" href="https://www.snapchat.com/add/adnansajjadkhi" target="_blank" rel="noopener noreferrer" aria-label="Snapchat"><img src="https://cdn.simpleicons.org/snapchat/FFFC00" alt="Snapchat" /></a>
            <a className="orbit-icon" href="https://www.twitch.tv/adnansajjad" target="_blank" rel="noopener noreferrer" aria-label="Twitch"><img src="https://cdn.simpleicons.org/twitch/9146FF" alt="Twitch" /></a>
            <a className="orbit-icon" href="https://www.dailymotion.com/user/adnansajjad786" target="_blank" rel="noopener noreferrer" aria-label="Dailymotion"><img src="https://cdn.simpleicons.org/dailymotion/FFFFFF" alt="Dailymotion" /></a>
            <a className="orbit-icon" href="https://www.threads.com/@adnansajjad786" target="_blank" rel="noopener noreferrer" aria-label="Threads"><img src="https://cdn.simpleicons.org/threads/FFFFFF" alt="Threads" /></a>
          </div>
          <div className="profile-center-photo">
            <img src="/images/adnan-sajjad.png" alt="Adnan Sajjad" />
          </div>
          <div className="orbit-center-label">ADNAN<br/>SAJJAD</div>
        </div>
        <div className="profile-intro profile-intro-centered">
          <div className="eyebrow">FOUNDER &amp; CREATOR</div>
          <h3>Adnan Sajjad</h3>
          <p>Creator of Viewers Tube. Connect with me through my official professional, creative and social platforms.</p>
          <div className="snap-details">
            <span>Snapchat username</span><strong>adnansajjadkhi</strong>
            <span>Snapchat Business ID</span><strong>68f75f72-5b84-44b0-9981-b5c8ee75d278</strong>
          </div>
        </div>
      </div>

      <div className="profile-groups">
          {profileGroups.map((group, index) => (
            <div className="profile-group" key={group.title}>
              <div className="profile-group-heading">
                <span className="profile-group-number">{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{group.title}</h3><p>{group.subtitle}</p></div>
                <span className="profile-count">{group.links.length} LINKS</span>
              </div>
              <div className="profile-link-grid">
                {group.links.map(([label, url]) => (
                  <a className="profile-link" href={url} key={label}
                    target={url.startsWith("mailto:") ? undefined : "_blank"}
                    rel={url.startsWith("mailto:") ? undefined : "noopener noreferrer"}>
                    <span className="profile-link-icon">↗</span>
                    <span>{label}</span>
                    <span className="profile-link-arrow">↗</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="profile-disclaimer">External websites open in a new tab. Some private-network links may only work when connected to the relevant network.</p>
      </section>

      <section className="creator-banner" id="creators"><div><div className="eyebrow">YOUR STORY DESERVES A STAGE</div><h2>Create without<br/><span>limits.</span></h2><p>Build your channel, share your work and grow a community around what you love.</p><a className="join-button large" href="#join">Start creating ↗</a></div><div className="creator-side"><div className="creator-stat"><strong>01</strong><span>Your channel.<br/>Your identity.</span></div><div className="creator-stat"><strong>02</strong><span>Your audience.<br/>Your community.</span></div><div className="creator-stat"><strong>03</strong><span>Your creativity.<br/>Your future.</span></div></div></section>

      <footer className="footer"><a className="brand" href="#"><span className="brand-symbol">V</span><span>VIEWERS<span className="brand-accent">TUBE</span><small>WATCH · CREATE · SHARE</small></span></a><div className="footer-credit">Created & founded by <strong>Adnan Sajjad</strong><br/><span>© 2026 Viewers Tube. All rights reserved.</span></div><div className="footer-links"><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a><a href="/creator-guidelines">Creator Guidelines</a></div></footer>
    </main>
  );
}
