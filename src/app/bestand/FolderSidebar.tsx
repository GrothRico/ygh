"use client";

import Link from "next/link";
import { useState } from "react";
import type { LocationRow } from "../../server/locations";
import { FolderActions } from "./FolderActions";

function branchContains(location: LocationRow, locations: LocationRow[], targetId: string | null): boolean {
  if (!targetId) return false;
  let parentId = locations.find((item) => item.id === targetId)?.parentId;
  while (parentId) {
    if (parentId === location.id) return true;
    parentId = locations.find((item) => item.id === parentId)?.parentId ?? null;
  }
  return false;
}

function FolderBranch({ location, locations, selectedId, expanded, onToggle }: {
  location: LocationRow; locations: LocationRow[]; selectedId: string | null; expanded: Set<string>; onToggle: (id: string) => void;
}) {
  const children = locations.filter((item) => item.parentId === location.id);
  const isExpanded = expanded.has(location.id);
  return <li>
    <div className="folder-nav-row">
      {children.length ? <button type="button" className="folder-nav-toggle" aria-label={`${location.name} Unterordner ${isExpanded ? "schließen" : "öffnen"}`} aria-expanded={isExpanded} onClick={() => onToggle(location.id)}>{isExpanded ? "⌄" : "›"}</button> : <span className="folder-nav-spacer" aria-hidden="true" />}
      <Link href={`/bestand?locationId=${encodeURIComponent(location.id)}`} aria-current={selectedId === location.id ? "page" : undefined}>{location.name}</Link>
      <FolderActions location={location} locations={locations} currentLocationId={selectedId} />
    </div>
    {children.length > 0 && isExpanded && <ul>{children.map((child) => <FolderBranch key={child.id} location={child} locations={locations} selectedId={selectedId} expanded={expanded} onToggle={onToggle} />)}</ul>}
  </li>;
}

export function FolderSidebar({ locations, selectedId }: { locations: LocationRow[]; selectedId: string | null }) {
  const initialExpanded = new Set(locations.filter((location) => location.id === selectedId || branchContains(location, locations, selectedId)).map((location) => location.id));
  const [expanded, setExpanded] = useState(initialExpanded);
  const roots = locations.filter((location) => location.parentId === null);
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return <aside className="folder-sidebar" aria-label="Standortordner">
    <h2>Ordner</h2>
    <Link className="folder-sidebar-all" href="/bestand" aria-current={!selectedId ? "page" : undefined}>Alle Karten</Link>
    {roots.length ? <ul>{roots.map((root) => <FolderBranch key={root.id} location={root} locations={locations} selectedId={selectedId} expanded={expanded} onToggle={toggle} />)}</ul> : <p>Noch keine Ordner vorhanden.</p>}
  </aside>;
}
