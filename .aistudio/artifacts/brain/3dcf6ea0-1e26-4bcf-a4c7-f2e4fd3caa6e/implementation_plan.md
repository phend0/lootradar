# LootRadar — Store & Platform Iconography + GitHub Repository Sync

This update adds crisp, recognizable SVG **Store Brand Icons** (`Epic Games`, `Steam`, `GOG`, `Prime Gaming`, `itch.io`) and **OS / Device Platform Icons** (`Windows`, `macOS`, `Linux`, `Steam Deck`, `Console / Mobile`) across the Hero Spotlight, Expiring Queue, Filter Bars, Game Cards, Claimed Library, Push Alerts, and Game Detail Modal—followed by rebuilding the signed **Samsung S26 Ultra APK** and pushing the complete codebase to `https://github.com/phend0/lootradar`.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions incorporate your confirmed selections:

- **Confirmed Decision 1 — Dual Icon System**: Render both **Store Brand Icons** (Epic shield, Steam piston, GOG cube, Prime crown, itch.io controller) and **OS / Device Platform Icons** (Windows 4-pane logo, Apple macOS glyph, Linux penguin/terminal emblem, Valve Steam Deck handheld ring, and Console/Mobile gamepad).
- **Confirmed Decision 2 — Full-App Coverage**: Display these icons across the **Hero Spotlight**, **Ending Soonest Priority Queue**, **Interactive Store & Platform Filter Bars**, **Live & Upcoming Game Cards**, **Claimed Library**, **Alerts Rules**, and **Game Detail Modal**.
- **Confirmed Decision 3 — Rebuild APK & Push to GitHub**: Recompile and re-sign `LootRadar-S26Ultra.apk` (`v1.5.0`) with the new iconography and push all updated source files and the signed APK to `https://github.com/phend0/lootradar`.

---

## 1. Overview & Core Concept

- **What It Does**: Introduces a dedicated vector icon system (`StoreIcon` and `PlatformIcon`) that pairs every store name and supported operating system/device with its distinct silhouette for instant visual scanning across the radar.
- **Target Audience / Persona**: PC, Steam Deck, and mobile gamers scanning daily 100% off game giveaways who want to identify at a glance whether a title activates on Steam, Epic, or GOG and whether it runs natively on Windows, macOS, Linux, or Steam Deck.
- **Key Value**: Eliminates text-only scanning fatigue while preserving clean unboxed metadata alignment (`[StoreIcon] Epic Games · [PlatformIcons] Windows, Steam Deck`).

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Interactive Filter Bar Scanning**: Every store filter button (`Epic Games`, `Steam`, `GOG`, `Prime Gaming`, `itch.io`) and platform filter button (`Windows`, `Mac`, `Linux`, `Steam Deck`, `Console / Mobile`) renders its crisp vector icon alongside the single-line label.
  2. **Card & Hero Visual Recognition**: Each game card in the Live Radar, Upcoming Drops, Expiring Queue, and Claimed Library displays the store brand icon next to the store name and inline OS/device icons next to the supported platforms.
  3. **Game Detail Modal Breakdown**: The modal header, primary store claim button, and Supported Platforms specification row display full store and platform iconography.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Sleek dark gaming command center (`#0B0F19` canvas, `#111827` structural surfaces, `1px` `#1E293B` borders) with zero pill-badge clutter.
  - *Color Palette & Mood*: Store icons inherit semantic store brand accents (`#22D3EE` for Epic, `#38BDF8` for Steam, `#C084FC` for GOG, `#2DD4BF` for Prime, `#FB7185` for itch.io) when unselected, and adapt cleanly to high-contrast dark text when inside active cyan CTA buttons.
  - *Typography & Hierarchy*: Icons are optically sized (`14px`–`16px` inline, `shrink-0`) to align with `Plus Jakarta Sans` metadata kickers and `Outfit` headings without causing line wrapping.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Self-Contained Inline SVG Icon Component (`PlatformIcons.tsx`)**
  - *Chosen Approach*: Build a dedicated, zero-dependency SVG component library (`StoreIcon`, `PlatformIcon`, and `PlatformIconGroup`) using crisp `viewBox="0 0 24 24"` paths rather than external CDN icon images.
  - *Why*: Guarantees zero network latency, crisp rendering on the Samsung S26 Ultra QHD+ display (including offline inside the bundled Android APK), and automatic `currentColor` inheritance across hover and active filter states.
  - *Alternatives Considered*: External favicon/SVG image URLs were rejected because they cannot inherit button text colors dynamically on active/hover states and can fail offline.

- **Decision 2: Clean GitHub Push Without Exposing Tokens**
  - *Chosen Approach*: Push the updated repository state cleanly to `https://github.com/phend0/lootradar` (`main` branch) while keeping `.env` secrets excluded and stripping credentials from `.git/config` after push.
  - *Why*: Ensures the remote repository is immediately up to date and secure.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 VECTOR ICON SYSTEM (StoreIcon & PlatformIcon)            │
│  • Store Brands: Epic Games, Steam, GOG, Prime Gaming, itch.io           │
│  • OS / Devices: Windows, macOS, Linux, Steam Deck, Console / Mobile     │
└───────────────────┬──────────────────────────────────┬───────────────────┘
                    │                                  │
                    ▼                                  ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────┐
│       RADAR & FILTER SURFACES        │  │   INSPECTOR & VAULT SURFACES   │
│  • Hero Spotlight & Expiring Queue   │  │  • Game Detail Modal Header &  │
│  • Store & Platform Filter Bars      │  │    Supported Platforms List    │
│  • Live & Upcoming Game Cards        │  │  • Claimed Library & Push      │
│                                      │  │    Notification Filter Toggles │
└───────────────────┬──────────────────┘  └────────────────┬───────────────┘
                    │                                      │
                    └──────────────────┬───────────────────┘
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│           BUILD, ANDROID APK PACKAGING & GITHUB REPOSITORY SYNC          │
│  1. Compile Production Vite Bundle (dist/)                               │
│  2. Package & V1/V2/V3-Sign LootRadar-S26Ultra.apk (v1.5.0)              │
│  3. Commit & Push Updated Source + Signed APK to github.com/phend0/lootradar│
└──────────────────────────────────────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `StoreIcon`: Accepts `store: StoreId` and `className`, rendering the corresponding vector path for `epic`, `steam`, `gog`, `prime`, or `itch`.
  - `PlatformIcon`: Accepts `platform: PlatformId` and `className`, rendering the corresponding vector path for `windows`, `mac`, `linux`, `steamdeck`, or `console`.
  - `PlatformIconGroup`: Renders a compact row of platform icons + labels with `title` tooltips for each supported platform on a `GiveawayGame`.
