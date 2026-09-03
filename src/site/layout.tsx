/**
 * Lumina docs site — shared page shell (sidebar nav + content area).
 * Server-rendered with Hono JSX; no client framework required.
 */
import type { FC } from 'hono/jsx';

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Getting started',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/quickstart', label: 'Quickstart' },
      { href: '/guides/installation', label: 'Installation & Setup' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { href: '/guides/core-concepts', label: 'Core Concepts (Mobject/Animation/Scene)' },
      { href: '/guides/animations', label: 'Animation Catalogue' },
      { href: '/guides/timeline-seek', label: 'Timeline, Seeking & Playback' },
      { href: '/guides/text', label: 'Text & Typography' },
      { href: '/guides/graphing', label: 'Graphing & Coordinate Systems' },
      { href: '/guides/camera-3d', label: '3D, Camera & Lighting' },
      { href: '/guides/updaters', label: 'Updaters & ValueTrackers' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { href: '/api/core', label: 'Core (Mobject, Scene, Animation)' },
      { href: '/api/geometry', label: 'Geometry (2D)' },
      { href: '/api/three-d', label: '3D (Mesh, Solids, Light, Camera)' },
      { href: '/api/animations', label: 'Animations' },
      { href: '/api/text', label: 'Text' },
      { href: '/api/graphing', label: 'Graphing' },
      { href: '/api/cameras-renderers', label: 'Cameras & Renderers' },
    ],
  },
  {
    title: 'Examples',
    items: [
      { href: '/gallery', label: 'Demo Gallery' },
    ],
  },
  {
    title: 'Deployment',
    items: [
      { href: '/deployment/npm', label: 'Publishing to npm' },
      { href: '/deployment/cloudflare', label: 'Hosting on Cloudflare' },
    ],
  },
];

export const Layout: FC<{ title: string; active?: string; children: any }> = ({ title, active, children }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} — Lumina Docs</title>
        <link href="/static/docs.css" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%236c5ce7'/%3E%3C/svg%3E" />
      </head>
      <body>
        <div class="topbar">
          <a class="brand" href="/">
            <span class="brand-dot"></span> Lumina
          </a>
          <div class="topbar-links">
            <a href="/gallery">Gallery</a>
            <a href="/api/core">API</a>
            <a href="https://github.com/i-m-ashutosh99/lumina" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div class="shell">
          <nav class="sidebar">
            {NAV.map((section) => (
              <div class="nav-section">
                <div class="nav-title">{section.title}</div>
                {section.items.map((item) => (
                  <a href={item.href} class={`nav-link${active === item.href ? ' active' : ''}`}>
                    {item.label}
                  </a>
                ))}
              </div>
            ))}
          </nav>
          <main class="content">{children}</main>
        </div>
      </body>
    </html>
  );
};
