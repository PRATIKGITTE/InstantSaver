import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

const STEPS = [
  { n: 1, text: "Copy the link from Instagram or YouTube" },
  { n: 2, text: 'Paste it in the box on the homepage and click "Preview"' },
  { n: 3, text: 'Click the green "Download" button to save the file' },
];

const SEO_PAGE_DATA = {
  "instagram-downloader": {
    title: "Instagram Downloader — Download Instagram Videos & Photos Free",
    h1: "Instagram Downloader",
    desc: "Download any Instagram video, photo, reel, or carousel post for free. No login, no watermark, works on iPhone, Android, and PC.",
    metaDesc: "Free Instagram downloader — save Instagram videos, photos, reels, and carousel posts in HD. No watermark, no login. Works on iPhone, Android, and PC.",
    keywords: "instagram downloader, download instagram videos, instagram photo downloader, free instagram downloader",
    faq: [
      { q: "How do I download Instagram videos?", a: "Copy the Instagram video URL, paste it into InstantSaver, click Preview, then click Download. Your video saves in seconds." },
      { q: "Can I download Instagram photos?", a: "Yes. Paste the post URL and InstantSaver detects whether it is a photo or video and shows the correct download button." },
      { q: "Do I need to create an account?", a: "No account or login is ever needed. InstantSaver is completely free and anonymous." },
      { q: "Is there a watermark on downloaded files?", a: "No. Files are downloaded directly from Instagram's CDN in their original quality — no watermark is added." },
    ],
    featureTitle: "What You Can Download",
    features: [
      { icon: "🎬", text: "Instagram Reels — full HD video" },
      { icon: "🖼️", text: "Photos & feed posts" },
      { icon: "🗂️", text: "Carousel posts — every image individually" },
      { icon: "📺", text: "IGTV long-form videos" },
      { icon: "👤", text: "Profile pictures in original quality" },
    ],
  },

  "reels-downloader": {
    title: "Instagram Reels Downloader — Save Reels in HD Free",
    h1: "Instagram Reels Downloader",
    desc: "Save any Instagram Reel to your device in HD quality. No watermark, no sign-up, works on any device instantly.",
    metaDesc: "Download Instagram Reels in HD for free. No watermark, no login required. Save reels to iPhone, Android, or PC in seconds with InstantSaver.",
    keywords: "instagram reels downloader, download instagram reels, save reels, reels saver, reels download free",
    faq: [
      { q: "How do I download Instagram Reels?", a: "Open the Reel on Instagram, tap the three-dot menu (⋯) and copy the link. Paste it into InstantSaver and click Download." },
      { q: "Can I download Reels on iPhone?", a: "Yes. InstantSaver works in Safari on iPhone. After downloading, the video is in your Files or Photos app." },
      { q: "Can I download Reels on Android?", a: "Yes. The video saves to your device's Downloads folder automatically." },
      { q: "Are downloaded Reels HD quality?", a: "Yes. Reels are fetched at their original resolution — up to 1080p when available." },
    ],
    featureTitle: "Why Use InstantSaver for Reels?",
    features: [
      { icon: "⚡", text: "Download any public Reel in under 5 seconds" },
      { icon: "🔇", text: "No watermark — clean original file" },
      { icon: "📱", text: "Works on iPhone, Android, tablet, and desktop" },
      { icon: "🔒", text: "No login or account needed — ever" },
      { icon: "♾️", text: "Unlimited downloads, no daily cap" },
    ],
  },

  "youtube-downloader": {
    title: "YouTube Video Downloader — Download YouTube Videos Free",
    h1: "YouTube Video Downloader",
    desc: "Download YouTube videos and Shorts for free. Save MP4 video or audio directly to your device — fast and easy.",
    metaDesc: "Free YouTube video downloader. Download YouTube videos and Shorts in MP4 or audio-only format. No sign-up needed. Fast and simple.",
    keywords: "youtube downloader, download youtube videos, youtube video downloader, youtube shorts downloader, download youtube mp4",
    faq: [
      { q: "How do I download YouTube videos?", a: "Switch to the YouTube tab on InstantSaver, paste the video URL, click Preview, then click Download." },
      { q: "Can I download YouTube Shorts?", a: "Yes. Paste the Shorts URL and InstantSaver handles the download automatically." },
      { q: "What quality is the download?", a: "InstantSaver downloads the best available pre-muxed quality, typically up to 720p." },
      { q: "Can I download just the audio?", a: "Yes. After previewing a video, click the Download Audio button to get the M4A audio track." },
    ],
    featureTitle: "YouTube Download Options",
    features: [
      { icon: "🎥", text: "MP4 video — 360p, 480p, 720p options" },
      { icon: "🎵", text: "Audio-only M4A download" },
      { icon: "⚡", text: "YouTube Shorts — same as any video" },
      { icon: "🔒", text: "No account required" },
      { icon: "📱", text: "Mobile and desktop compatible" },
    ],
  },

  "profile-picture-downloader": {
    title: "Instagram Profile Picture Downloader — Save HD Profile Photo",
    h1: "Instagram Profile Picture Downloader",
    desc: "Download anyone's Instagram profile picture in full size. Just paste the profile URL and save the DP instantly.",
    metaDesc: "Download Instagram profile pictures (DPs) in original quality. Paste any public Instagram profile URL and save the photo to your device free.",
    keywords: "instagram profile picture downloader, instagram dp downloader, download instagram profile photo, instagram profile pic saver",
    faq: [
      { q: "How do I download an Instagram profile picture?", a: "Go to the Instagram profile, copy the URL (e.g. instagram.com/username), paste it into InstantSaver, and click Download Profile Picture." },
      { q: "Can I download a private account's profile picture?", a: "No. Only public account profile pictures are accessible without logging in." },
      { q: "Is the downloaded photo the full-size version?", a: "InstantSaver downloads the highest quality image available from Instagram's public CDN." },
      { q: "What format is the downloaded profile picture?", a: "Profile pictures are saved as JPEG files." },
    ],
    featureTitle: "How It Works",
    features: [
      { icon: "👤", text: "Works for any public Instagram account" },
      { icon: "🖼️", text: "Downloads the highest available quality" },
      { icon: "⚡", text: "Instant preview before download" },
      { icon: "🔒", text: "No login — anonymous and private" },
      { icon: "📱", text: "Works on all devices and browsers" },
    ],
  },

  "carousel-downloader": {
    title: "Instagram Carousel Downloader — Download All Carousel Photos & Videos",
    h1: "Instagram Carousel Downloader",
    desc: "Download every photo and video from an Instagram carousel post individually or all at once with one click.",
    metaDesc: "Download all photos and videos from Instagram carousel posts. Save each item individually or use Download All. Free, fast, no watermark.",
    keywords: "instagram carousel downloader, download instagram carousel, instagram multiple photos download, carousel post saver, instagram album downloader",
    faq: [
      { q: "Can I download all carousel images at once?", a: 'Yes. After pasting a carousel URL, InstantSaver shows every item with individual download buttons plus a "Download All" button.' },
      { q: "What if a carousel has videos and photos mixed?", a: "InstantSaver detects each item type automatically — photos save as JPG, videos save as MP4." },
      { q: "Is there a limit on how many items I can download?", a: "No limit. InstantSaver can detect and download carousels with up to 20 items." },
      { q: "How do I get the carousel link?", a: "On Instagram, open the post, tap ⋯ and choose Copy Link. The URL contains /p/ — that's a post, which can be a carousel." },
    ],
    featureTitle: "Carousel Download Features",
    features: [
      { icon: "🗂️", text: "Detects all carousel items automatically" },
      { icon: "⬇️", text: "Individual download button for each item" },
      { icon: "📦", text: "Download All button for one-click bulk save" },
      { icon: "🎬", text: "Handles mixed photo + video carousels" },
      { icon: "✨", text: "Preview thumbnails before downloading" },
    ],
  },
};

export default function SeoPage({ slug }) {
  const page = SEO_PAGE_DATA[slug];

  if (!page) {
    return (
      <div className="seo-page">
        <p>Page not found. <Link to="/">← Back to Home</Link></p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{page.title} | InstantSaver</title>
        <meta name="description" content={page.metaDesc} />
        <meta name="keywords" content={page.keywords} />
        <link rel="canonical" href={`https://instantsaver.in/${slug}`} />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.metaDesc} />
        <meta property="og:url" content={`https://instantsaver.in/${slug}`} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://instantsaver.in/og-cover.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          })}
        </script>
      </Helmet>

      <div className="seo-page">
        {/* Nav */}
        <header className="nav">
          <div className="brand">
            <img src="/logo.png" className="logo" alt="InstantSaver" />
            <span>InstantSaver</span>
          </div>
          <nav className="links">
            <Link to="/">Home</Link>
            <a href="/#faq">FAQ</a>
          </nav>
        </header>

        <main className="seo-main">
          {/* Hero */}
          <section className="seo-hero">
            <h1>{page.h1}</h1>
            <p className="seo-desc">{page.desc}</p>
            <Link to="/" className="seo-cta-btn">
              ↓ Go to Downloader →
            </Link>
          </section>

          {/* How to use */}
          <section className="seo-section">
            <h2>How to Use InstantSaver</h2>
            <div className="seo-steps">
              {STEPS.map((s) => (
                <div key={s.n} className="seo-step">
                  <span className="seo-step-num">{s.n}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Features */}
          <section className="seo-section">
            <h2>{page.featureTitle}</h2>
            <ul className="seo-features">
              {page.features.map((f, i) => (
                <li key={i}>
                  <span className="seo-feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="seo-section">
            <h2>Frequently Asked Questions</h2>
            <div className="seo-faq">
              {page.faq.map((item, i) => (
                <details key={i} className="seo-faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="seo-cta-section">
            <h2>Ready to Download?</h2>
            <p>InstantSaver is free, fast, and requires no sign-up.</p>
            <Link to="/" className="seo-cta-btn large">
              Start Downloading — It's Free →
            </Link>
          </section>

          {/* Internal links */}
          <nav className="seo-related">
            <h3>Related Tools</h3>
            <ul>
              {Object.entries(SEO_PAGE_DATA)
                .filter(([k]) => k !== slug)
                .map(([k, p]) => (
                  <li key={k}>
                    <Link to={`/${k}`}>{p.h1}</Link>
                  </li>
                ))}
            </ul>
          </nav>
        </main>

        <footer className="footer">
          <p>© {new Date().getFullYear()} InstantSaver. All rights reserved.</p>
          <nav className="footer-links">
            <Link to="/">Home</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </nav>
        </footer>
      </div>
    </>
  );
}
