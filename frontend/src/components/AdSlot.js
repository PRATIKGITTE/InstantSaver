// src/components/AdSlot.js
//
// One reusable, provider-agnostic ad placement component. Every page that wants an ad
// zone renders <AdSlot zone="header" />, <AdSlot zone="inContent" />, or
// <AdSlot zone="footer" /> — swapping ad providers later means editing AD_SLOTS/the
// render below in this ONE file, not hunting through every page that shows an ad.
//
// Each zone starts with a `null` slot id below because there are no real AdSense ad-unit
// IDs yet (the AdSense/AdMob account is deactivated pending manual reactivation — see
// public/index.html). A zone with a null id renders nothing: no broken/empty ad box is
// ever shown to users. Fill in real `data-ad-slot` values here once they exist.
import React, { useEffect, useRef } from "react";

const AD_CLIENT = "ca-pub-9877820325984477";

const AD_SLOTS = {
  header: null,     // top-of-page banner, below the nav
  inContent: null,  // between the info/FAQ sections and the footer
  footer: null       // above the footer links
};

let scriptLoadStarted = false;
// Loads the AdSense loader script at most once, and only when it's actually needed —
// with no configured ad-slot IDs it would otherwise fire third-party tracking
// requests/cookies (flagged by Lighthouse) for zero benefit while the account sits
// deactivated. Do not load this unconditionally from index.html.
function ensureAdsenseScriptLoaded() {
  if (scriptLoadStarted) return;
  scriptLoadStarted = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

export default function AdSlot({ zone }) {
  const slotId = AD_SLOTS[zone];
  const insRef = useRef(null);

  useEffect(() => {
    if (!slotId) return;
    ensureAdsenseScriptLoaded();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle.js not loaded yet or blocked (ad blocker) — fail silently, no broken UI
    }
  }, [slotId]);

  if (!slotId) return null;

  return (
    <div className={`ad-slot ad-slot-${zone}`}>
      <span className="ad-slot-label">Advertisement</span>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
