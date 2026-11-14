"use client";

import { useRef, useState } from "react";

type NativeVideo = {
  id: string;
  title: string;
  creator: string;
  thumbnail?: string | null;
  description?: string | null;
  ownerType?: string;
  provider: string;
};

export default function NativeVideoCarousel({
  videos,
  loading,
}: {
  videos: NativeVideo[];
  loading: boolean;
}) {
  const [active, setActive] = useState(0);
  const startX = useRef<number | null>(null);

  function move(direction: number) {
    setActive((current) => (current + direction + videos.length) % videos.length);
  }

  function href(video: NativeVideo) {
    const params = new URLSearchParams({
      provider: "VIEWERS_TUBE",
      id: video.id,
      title: video.title,
      creator: video.creator,
    });
    return `/watch?${params.toString()}`;
  }

  return (
    <section className="native-library">
      <div className="native-library-heading">
        <div>
          <div className="native-eyebrow">VIEWERS TUBE ORIGINAL LIBRARY</div>
          <h2>Watch <span>on Viewers Tube.</span></h2>
          <p>Videos uploaded by our Admin and verified Creators.</p>
        </div>
        <span className="native-count">{videos.length} videos</span>
      </div>

      {loading ? (
        <p className="native-message">Loading the native video library…</p>
      ) : videos.length === 0 ? (
        <p className="native-message">
          No public videos are available yet. Published Admin and Creator uploads will appear here.
        </p>
      ) : (
        <>
          <div
            className="native-stage"
            onPointerDown={(event) => {
              startX.current = event.clientX;
            }}
            onPointerUp={(event) => {
              if (startX.current === null) return;
              const distance = event.clientX - startX.current;
              if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
              startX.current = null;
            }}
            onPointerCancel={() => { startX.current = null; }}
          >
            {[-2, -1, 0, 1, 2].map((offset) => {
              const index = (active + offset + videos.length) % videos.length;
              const video = videos[index];
              if (!video || (videos.length < 5 && Math.abs(offset) >= videos.length)) return null;

              const position = offset * 190;
              const style = {
                transform: `translateX(${position}px) translateZ(${-Math.abs(offset) * 100}px) rotateY(${-offset * 23}deg) scale(${offset === 0 ? 1 : 0.83})`,
                zIndex: 10 - Math.abs(offset),
                opacity: Math.abs(offset) > 1 ? 0.55 : 1,
              };

              return offset === 0 ? (
                <a
                  key={`${video.id}-${offset}`}
                  className="native-card native-card-active"
                  href={href(video)}
                  style={style}
                  draggable={false}
                >
                  <div className="native-thumb">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnail} alt="" draggable={false} />
                    ) : <div className="native-thumb-placeholder">V</div>}
                    <span className="native-play">▶</span>
                    <span className="native-owner">{video.ownerType === "ADMIN" ? "ADMIN" : "CREATOR"}</span>
                  </div>
                  <div className="native-card-info">
                    <strong>{video.title}</strong>
                    <span>{video.creator}</span>
                    <small>PLAY ON VIEWERS TUBE ↗</small>
                  </div>
                </a>
              ) : (
                <button
                  key={`${video.id}-${offset}`}
                  type="button"
                  className="native-card"
                  style={style}
                  onClick={() => setActive(index)}
                  aria-label={`Select ${video.title}`}
                >
                  <div className="native-thumb">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnail} alt="" draggable={false} />
                    ) : <div className="native-thumb-placeholder">V</div>}
                    <span className="native-owner">{video.ownerType === "ADMIN" ? "ADMIN" : "CREATOR"}</span>
                  </div>
                  <div className="native-card-info">
                    <strong>{video.title}</strong>
                    <span>{video.creator}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="native-controls">
            <button type="button" onClick={() => move(-1)} aria-label="Previous video">←</button>
            <span>{active + 1} / {videos.length}</span>
            <button type="button" onClick={() => move(1)} aria-label="Next video">→</button>
          </div>
        </>
      )}

      <style jsx>{`
        .native-library { padding: 65px 5%; overflow: hidden; background: linear-gradient(180deg,#0c1220,#080b12); color:#f5f7fb; }
        .native-library-heading { max-width:1200px; margin:0 auto 20px; display:flex; justify-content:space-between; align-items:end; gap:20px; }
        .native-eyebrow { color:#70e5ed; font-size:11px; letter-spacing:2px; font-weight:800; }
        .native-library h2 { font-size:clamp(27px,4vw,42px); margin:9px 0; }
        .native-library h2 span { color:#79dce9; }
        .native-library-heading p,.native-message { color:#aab2c5; }
        .native-count { color:#9eacc4; white-space:nowrap; }
        .native-message { text-align:center; padding:45px 10px; }
        .native-stage { height:410px; max-width:1100px; margin:0 auto; position:relative; display:flex; align-items:center; justify-content:center; perspective:1100px; touch-action:pan-y; user-select:none; }
        .native-card { position:absolute; width:min(310px,68vw); height:340px; border:1px solid #34435c; border-radius:19px; padding:0; overflow:hidden; text-align:left; color:white; background:#151e30; box-shadow:0 24px 65px #0009; transition:transform .42s ease,opacity .42s ease; cursor:pointer; text-decoration:none; }
        .native-card-active { border-color:#70e5ed; box-shadow:0 22px 70px #20b8c944; }
        .native-thumb { height:210px; position:relative; background:#202b40; overflow:hidden; }
        .native-thumb img { width:100%; height:100%; object-fit:cover; pointer-events:none; }
        .native-thumb-placeholder { height:100%; display:grid; place-items:center; font-size:70px; font-weight:900; color:#70e5ed; background:linear-gradient(135deg,#182c49,#253c54); }
        .native-play { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#70e5ed; color:#07111a; border-radius:50%; width:52px; height:52px; display:grid; place-items:center; }
        .native-owner { position:absolute; top:12px; left:12px; background:#07111add; padding:6px 9px; border-radius:6px; font-size:10px; letter-spacing:1px; }
        .native-card-info { padding:15px; display:grid; gap:8px; }
        .native-card-info strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .native-card-info span { color:#aab2c5; font-size:13px; }
        .native-card-info small { color:#70e5ed; font-size:10px; letter-spacing:1px; margin-top:7px; }
        .native-controls { display:flex; align-items:center; justify-content:center; gap:25px; }
        .native-controls button { width:42px; height:42px; border-radius:50%; border:1px solid #52627d; background:#172237; color:white; font-size:22px; cursor:pointer; }
        .native-controls span { color:#aab2c5; font-size:13px; }
        @media(max-width:650px) { .native-stage { height:365px; } .native-card { height:310px; } .native-thumb { height:185px; } .native-library-heading { align-items:start; } }
        @media(prefers-reduced-motion:reduce) { .native-card { transition:none; } }
      `}</style>
    </section>
  );
}
