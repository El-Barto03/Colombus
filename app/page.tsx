"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import type {
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet";
import {
  getDirectionsUrl,
  initialShops,
  makeInitials,
  sortShops,
  type Shop,
  type ShopCategory,
} from "@/lib/shops";
import {
  coordinatesMapUrl,
  parseMapCoordinates,
  type Coordinates,
} from "@/lib/shop-location";
import { fitAllShops } from "@/lib/map-view";

type FormMode = "add" | "edit" | "duplicate" | null;
type CategoryFilter = "all" | ShopCategory;
type MobileView = "list" | "map";
type ShopSyncState = "loading" | "ready" | "fallback";
type PriceRow = { product: string; minimum: string; maximum: string };
type ContactKind = "email" | "phone" | "link";
type ContactRow = { kind: ContactKind; value: string };
type LogoCropSource = { blob: Blob; name: string };
type TrackingDraft = {
  visitStatus: "visited" | "not_visited";
  reachOutSent: boolean;
  followupSent: boolean;
  manualNotes: string;
};

const supportedLogoTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function normalizeWebImageUrl(value: string) {
  const candidate = value.trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate.startsWith("//") ? `https:${candidate}` : candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function droppedWebImageUrl(dataTransfer: DataTransfer) {
  const html = dataTransfer.getData("text/html");
  if (html) {
    const document = new DOMParser().parseFromString(html, "text/html");
    const image = document.querySelector("img");
    const source = image?.getAttribute("src") || image?.getAttribute("data-src") || "";
    const normalized = normalizeWebImageUrl(source);
    if (normalized) return normalized;
  }

  const downloadUrl = dataTransfer.getData("DownloadURL");
  if (downloadUrl) {
    const normalized = normalizeWebImageUrl(downloadUrl.split(":").slice(2).join(":"));
    if (normalized) return normalized;
  }

  for (const value of [dataTransfer.getData("text/uri-list"), dataTransfer.getData("text/plain")]) {
    const candidate = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    const normalized = normalizeWebImageUrl(candidate || "");
    if (normalized) return normalized;
  }

  return "";
}

type ShopDraft = {
  name: string;
  category: ShopCategory;
  logo: string;
  logoBackground: "light" | "dark";
  type: string;
  productRange: string;
  fit: string;
  address: string;
  neighborhood: string;
  website: string;
  directionsUrl: string;
  note: string;
};

const categoryDetails: Record<ShopCategory, { label: string; search: string; className: string }> = {
  shop: { label: "Shop", search: "shop tienda", className: "shop" },
  museum: { label: "Museum shop", search: "museum shop tienda museo", className: "museum" },
  airport: { label: "Airport shop", search: "airport shop tienda aeropuerto", className: "airport" },
  train_station: {
    label: "Train station shop",
    search: "train station shop tienda estación estacion tren railway rail",
    className: "train",
  },
};

function shopCategory(shop: Shop): ShopCategory {
  return shop.category && shop.category in categoryDetails ? shop.category : "shop";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function installSmoothWheelZoom(map: LeafletMap) {
  const continuousMap = map as LeafletMap & {
    _moveStart: (zoomChanged: boolean, noMoveStart?: boolean) => LeafletMap;
    _move: (
      center: ReturnType<LeafletMap["getCenter"]>,
      zoom: number,
      data: { pinch: boolean; round: boolean },
    ) => LeafletMap;
    _moveEnd: (zoomChanged: boolean) => LeafletMap;
  };
  const container = map.getContainer();
  let frame = 0;
  let lastFrameTime = 0;
  let targetZoom = map.getZoom();
  let zoomOrigin = map.getSize().divideBy(2);
  let zoomAnchor = map.getCenter();
  let lastWheelTime = 0;

  const clampZoom = (zoom: number) =>
    Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));

  const centerAroundAnchor = (zoom: number) => {
    const viewHalf = map.getSize().divideBy(2);
    const anchorPixel = map.project(zoomAnchor, zoom);
    const centerPixel = anchorPixel.subtract(zoomOrigin.subtract(viewHalf));
    return map.unproject(centerPixel, zoom);
  };

  const animateZoom = (time: number) => {
    const currentZoom = map.getZoom();
    const distance = targetZoom - currentZoom;

    if (Math.abs(distance) < 0.002) {
      continuousMap._move(
        centerAroundAnchor(targetZoom),
        targetZoom,
        { pinch: true, round: false },
      );
      continuousMap._moveEnd(true);
      frame = 0;
      lastFrameTime = 0;
      return;
    }

    const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 34) : 16.7;
    const progress = 1 - Math.exp(-elapsed / 82);
    lastFrameTime = time;
    const nextZoom = currentZoom + distance * progress;
    continuousMap._move(
      centerAroundAnchor(nextZoom),
      nextZoom,
      { pinch: true, round: false },
    );
    frame = window.requestAnimationFrame(animateZoom);
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();

    const deltaUnit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? container.clientHeight
          : 1;
    const wheelPixels = event.deltaY * deltaUnit;
    const isMouseWheel = event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(event.deltaY) >= 40;
    const wheelRate = isMouseWheel ? 0.0026 : 0.0017;
    const maximumStep = isMouseWheel ? 0.34 : 0.13;
    const zoomStep = Math.max(-maximumStep, Math.min(maximumStep, -wheelPixels * wheelRate));
    if (!zoomStep) return;

    const wheelTime = performance.now();
    const startsNewGesture = !frame || wheelTime - lastWheelTime > 180;
    if (startsNewGesture) {
      map.stop();
      targetZoom = map.getZoom();
    }
    zoomOrigin = map.mouseEventToContainerPoint(event);
    zoomAnchor = map.containerPointToLatLng(zoomOrigin);
    lastWheelTime = wheelTime;
    const nextTargetZoom = clampZoom(targetZoom + zoomStep);
    if (nextTargetZoom === targetZoom) return;
    targetZoom = nextTargetZoom;
    if (!frame) {
      continuousMap._moveStart(true, false);
      frame = window.requestAnimationFrame(animateZoom);
    }
  };

  const cancelWheelZoom = () => {
    if (!frame) return;
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastFrameTime = 0;
    targetZoom = map.getZoom();
    continuousMap._moveEnd(true);
  };

  container.addEventListener("wheel", handleWheel, { passive: false });
  // A button-driven camera move must not compete with a pending wheel frame.
  map.on("movestart", cancelWheelZoom);

  return () => {
    container.removeEventListener("wheel", handleWheel);
    map.off("movestart", cancelWheelZoom);
    if (frame) window.cancelAnimationFrame(frame);
  };
}

function enableSubpixelMarkerPosition(marker: LeafletMarker, map: LeafletMap) {
  const smoothMarker = marker as LeafletMarker & {
    _setPos: (position: ReturnType<LeafletMap["project"]>) => void;
    update: () => LeafletMarker;
  };

  smoothMarker.update = () => {
    if (marker.getElement()) {
      const position = map
        .project(marker.getLatLng())
        .subtract(map.getPixelOrigin());
      smoothMarker._setPos(position);
    }
    return marker;
  };
}

function inferContactKind(value: string): ContactKind {
  if (/https?:\/\//i.test(value)) return "link";
  if (value.includes("@")) return "email";
  return "phone";
}

function parseContactRows(value: string): ContactRow[] {
  if (!value.trim()) return [{ kind: "email", value: "" }];
  try {
    const parsed = JSON.parse(value) as Array<{ kind?: unknown; value?: unknown }>;
    const rows: ContactRow[] = parsed
      .filter((entry) => entry && typeof entry.value === "string")
      .map((entry): ContactRow => ({
        kind: entry.kind === "phone" || entry.kind === "link" ? entry.kind : "email",
        value: String(entry.value),
      }));
    if (rows.length) return rows;
  } catch {
    // Existing entries are plain text and are inferred below.
  }
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => ({ kind: inferContactKind(entry), value: entry }));
}

function formatContactRows(rows: ContactRow[]) {
  const contacts = rows
    .map((row) => ({ kind: row.kind, value: row.value.trim() }))
    .filter((row) => row.value);
  return contacts.length ? JSON.stringify(contacts) : "";
}

function contactHref(contact: ContactRow) {
  if (!contact.value) return "";
  if (contact.kind === "email") {
    const email = contact.value.match(/[^\s()<>]+@[^\s()<>]+\.[^\s()<>]+/)?.[0];
    return email ? "mailto:" + email : "";
  }
  if (contact.kind === "link") {
    return /^https?:\/\//i.test(contact.value) ? contact.value : "";
  }
  const phone = contact.value.replace(/[^\d+]/g, "");
  if (phone.length >= 7) return "tel:" + phone;
  return "";
}

function emptyDraft(shop?: Shop, duplicate = false): ShopDraft {
  return {
    name: shop?.name ?? "",
    category: shop ? shopCategory(shop) : "shop",
    logo: shop?.logo ?? "",
    logoBackground: shop?.logoBackground ?? "light",
    type: shop?.type ?? "",
    productRange: shop?.productRange ?? "",
    fit: shop?.fit ?? "",
    address: duplicate ? "" : shop?.address ?? "",
    neighborhood: duplicate ? "" : shop?.neighborhood ?? "",
    website: shop?.website ?? "",
    directionsUrl: duplicate ? "" : shop?.directionsUrl || (shop ? getDirectionsUrl(shop) : ""),
    note: shop?.note ?? "",
  };
}

function parsePriceRows(value: string): PriceRow[] {
  const rows = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)\s*€\s*([0-9]+(?:[.,][0-9]+)?\+?)\s*(?:[-–]\s*€?\s*([0-9]+(?:[.,][0-9]+)?\+?))?\s*$/);
      if (!match) return { product: line, minimum: "", maximum: "" };
      return {
        product: match[1].trim(),
        minimum: match[2] ?? "",
        maximum: match[3] ?? "",
      };
    });
  return rows.length ? rows : [{ product: "", minimum: "", maximum: "" }];
}

function formatPriceRows(rows: PriceRow[]) {
  return rows
    .map(({ product, minimum, maximum }) => {
      const label = product.trim();
      const min = minimum.trim();
      const max = maximum.trim();
      const range = min && max ? `€${min} - €${max}` : min ? `€${min}` : max ? `€${max}` : "";
      return [label, range].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("\n");
}

function AutoFitWordmark({ value, large }: { value: string; large: boolean }) {
  const wordmarkRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const wordmark = wordmarkRef.current;
    const container = wordmark?.parentElement;
    if (!wordmark || !container) return;

    const maxSize = large ? 25 : 17;
    const fit = () => {
      const availableWidth = wordmark.getBoundingClientRect().width;
      if (!availableWidth) return;

      let smallest = 1;
      let largest = maxSize;
      while (largest - smallest > 0.1) {
        const candidate = (smallest + largest) / 2;
        wordmark.style.fontSize = `${candidate}px`;
        if (wordmark.scrollWidth <= availableWidth + 0.5) smallest = candidate;
        else largest = candidate;
      }

      wordmark.style.fontSize = `${Math.floor(smallest * 10) / 10}px`;
    };

    fit();
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [large, value]);

  return (
    <span ref={wordmarkRef} className="logo-wordmark">
      {value}
    </span>
  );
}

function ShopLogo({ shop, large = false }: { shop: Shop; large?: boolean }) {
  const isCroppedUpload = Boolean(
    shop.logo &&
      (shop.logo.startsWith("/api/logos/") || shop.logo.startsWith("blob:")),
  );
  const className = [
    "brand-mark",
    large ? "large" : "",
    shop.logoBackground === "dark" ? "logo-dark" : "",
    shop.id === "la-integral" ? "logo-square" : "",
    isCroppedUpload ? "logo-full-bleed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className} aria-hidden="true">
      {shop.logo ? (
        <>
          <img
            className="shop-logo-img"
            src={shop.logo}
            alt=""
            loading={large ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            onLoad={(event) => event.currentTarget.parentElement?.classList.remove("is-fallback")}
            onError={(event) => event.currentTarget.parentElement?.classList.add("is-fallback")}
          />
          <span className="logo-fallback">{shop.initials}</span>
        </>
      ) : (
        <AutoFitWordmark value={shop.name} large={large} />
      )}
    </span>
  );
}

function PriceRangeDisplay({ value }: { value: string }) {
  const rows = parsePriceRows(value).filter(
    (row) => row.product || row.minimum || row.maximum,
  );

  return (
    <div className="price-view" role="table" aria-label="Price range">
      <div className="price-view-head" role="row">
        <span role="columnheader">Product type</span>
        <span role="columnheader">Price range</span>
      </div>
      {rows.map((row, index) => (
        <div className="price-view-row" role="row" key={`${row.product}-${index}`}>
          <span className="price-view-product" role="cell">{row.product || "Product"}</span>
          <span className="price-view-range" role="cell">
            {row.minimum ? (
              <span className="price-view-amount"><b>€</b><span>{row.minimum}</span></span>
            ) : null}
            {row.minimum && row.maximum ? <span className="price-view-dash">–</span> : null}
            {row.maximum ? (
              <span className="price-view-amount"><b>€</b><span>{row.maximum}</span></span>
            ) : null}
            {!row.minimum && !row.maximum ? <span className="price-view-unparsed">—</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function trackingDraft(shop: Shop): TrackingDraft {
  return {
    visitStatus: shop.visitStatus === "visited" ? "visited" : "not_visited",
    reachOutSent: shop.reachOutSent === true,
    followupSent: shop.followupSent === true,
    manualNotes: shop.manualNotes ?? "",
  };
}

function sameTrackingDraft(left: TrackingDraft, right: TrackingDraft) {
  return (
    left.visitStatus === right.visitStatus &&
    left.reachOutSent === right.reachOutSent &&
    left.followupSent === right.followupSent &&
    left.manualNotes === right.manualNotes
  );
}

function ShopTracker({
  shop,
  onUpdated,
}: {
  shop: Shop;
  onUpdated: (shop: Shop) => void;
}) {
  const [draft, setDraft] = useState<TrackingDraft>(() => trackingDraft(shop));
  const [saved, setSaved] = useState<TrackingDraft>(() => trackingDraft(shop));
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const draftRef = useRef(draft);
  const onUpdatedRef = useRef(onUpdated);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    onUpdatedRef.current = onUpdated;
  }, [onUpdated]);

  useEffect(() => {
    if (sameTrackingDraft(draft, saved)) return;

    const controller = new AbortController();
    // This effect owns the debounced autosave state machine.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveState("pending");
    setSaveError("");
    const submitted = draft;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void fetch(`/api/shops/${shop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitted),
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = (await response.json()) as { shop?: Shop; error?: string };
          if (!response.ok || !result.shop) {
            throw new Error(result.error || "Could not save prospect tracking.");
          }
          const confirmed = trackingDraft(result.shop);
          setSaved(confirmed);
          if (sameTrackingDraft(draftRef.current, submitted)) setDraft(confirmed);
          setSaveState("saved");
          onUpdatedRef.current(result.shop);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSaveError(error instanceof Error ? error.message : "Could not save prospect tracking.");
          setSaveState("error");
        });
    }, 550);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft, retryVersion, saved, shop.id]);

  return (
    <section className="prospect-tracker" aria-labelledby={`tracker-${shop.id}`}>
      <div className="prospect-tracker-heading">
        <h2 id={`tracker-${shop.id}`}>Prospect tracking</h2>
        <span className={`tracker-save-state is-${saveState}`} aria-live="polite">
          {saveState === "pending" || saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Not saved"
                : "Auto-saves"}
        </span>
      </div>

      <div className="prospect-tracker-grid">
        <label className="tracker-select">
          <span>Visit status</span>
          <select
            value={draft.visitStatus}
            onChange={(event) => {
              const visitStatus = event.target.value === "visited" ? "visited" : "not_visited";
              setDraft((current) => ({ ...current, visitStatus }));
            }}
          >
            <option value="visited">Visited</option>
            <option value="not_visited">Not visited</option>
          </select>
        </label>

        <div className="tracker-checkboxes">
          <label className="tracker-checkbox">
            <input
              type="checkbox"
              checked={draft.reachOutSent}
              onChange={(event) => {
                const reachOutSent = event.target.checked;
                setDraft((current) => ({ ...current, reachOutSent }));
              }}
            />
            <span>Reach out sent</span>
          </label>
          <label className="tracker-checkbox">
            <input
              type="checkbox"
              checked={draft.followupSent}
              onChange={(event) => {
                const followupSent = event.target.checked;
                setDraft((current) => ({ ...current, followupSent }));
              }}
            />
            <span>Followup sent</span>
          </label>
        </div>
      </div>

      <label className="tracker-notes">
        <span>Manual notes</span>
        <textarea
          rows={4}
          maxLength={4000}
          value={draft.manualNotes}
          placeholder="Add notes about calls, emails, replies or next steps…"
          onChange={(event) => {
            const manualNotes = event.target.value;
            setDraft((current) => ({ ...current, manualNotes }));
          }}
        />
      </label>

      {saveState === "error" && (
        <p className="tracker-error" role="alert">
          {saveError} <button type="button" onClick={() => setRetryVersion((value) => value + 1)}>Retry</button>
        </p>
      )}
    </section>
  );
}

function ShopDetail({
  shop,
  onBack,
  onEdit,
  onDuplicate,
  onDeleted,
  onTracked,
}: {
  shop: Shop;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDeleted: (id: string) => void;
  onTracked: (shop: Shop) => void;
}) {
  const contacts = parseContactRows(shop.contact).filter((contact) => contact.value.trim());
  const category = shopCategory(shop);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const deleteShop = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${shop.name}? This will remove it for everyone with the map link.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/shops/${shop.id}`, { method: "DELETE" });
      const result = (await response.json()) as { deletedId?: string; error?: string };
      if (!response.ok || !result.deletedId) {
        throw new Error(result.error || "Could not delete this shop.");
      }
      onDeleted(result.deletedId);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this shop.");
      setDeleting(false);
    }
  };

  return (
    <section className="detail-view" aria-label={`${shop.name} details`}>
      <div className="detail-nav">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> All shops
        </button>
        <div className="detail-nav-actions">
          <button className="duplicate-button" type="button" onClick={onDuplicate} disabled={deleting}>
            <span aria-hidden="true">⧉</span> Duplicate
          </button>
          <button className="edit-button" type="button" onClick={onEdit} disabled={deleting}>
            <span aria-hidden="true">✎</span> Edit
          </button>
          <button className="delete-button" type="button" onClick={deleteShop} disabled={deleting}>
            <span aria-hidden="true">×</span> {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {deleteError && <p className="delete-error" role="alert">{deleteError}</p>}

      <div className="detail-heading">
        <ShopLogo shop={shop} large />
        <div>
          {(category !== "shop" || shop.neighborhood) && (
            <p className={`eyebrow ${categoryDetails[category].className}-eyebrow`}>
              {category !== "shop" ? categoryDetails[category].label : shop.neighborhood}
            </p>
          )}
          <h1>{shop.name}</h1>
          <p className="detail-type">{shop.type}</p>
        </div>
      </div>

      <div className="action-row">
        <a className="primary-action" href={getDirectionsUrl(shop)} target="_blank" rel="noreferrer">
          <span aria-hidden="true">↗</span> Directions
        </a>
        {shop.website && (
          <a className="secondary-action" href={shop.website} target="_blank" rel="noreferrer">
            Website
          </a>
        )}
      </div>

      <ShopTracker key={shop.id} shop={shop} onUpdated={onTracked} />

      <dl className="detail-list">
        <div>
          <dt>Address</dt>
          <dd>{shop.address}</dd>
        </div>
        {contacts.length > 0 && (
          <div>
            <dt>Contacts</dt>
            <dd>
              <span className="contact-list">
                {contacts.map((contact, index) => {
                  const href = contactHref(contact);
                  return (
                    <span
                      className="contact-item"
                      key={contact.kind + "-" + contact.value + "-" + index}
                    >
                      <b>{contact.kind === "email" ? "Email" : contact.kind === "phone" ? "Phone" : "Link"}</b>
                      {href ? (
                        <a
                          href={href}
                          target={contact.kind === "link" ? "_blank" : undefined}
                          rel={contact.kind === "link" ? "noreferrer" : undefined}
                        >
                          {contact.value}
                        </a>
                      ) : (
                        <span>{contact.value}</span>
                      )}
                    </span>
                  );
                })}
              </span>
            </dd>
          </div>
        )}
        {shop.productRange && (
          <div>
            <dt>Product range</dt>
            <dd>{shop.productRange}</dd>
          </div>
        )}
        {shop.priceRange && (
          <div>
            <dt>Price range</dt>
            <dd><PriceRangeDisplay value={shop.priceRange} /></dd>
          </div>
        )}
        {shop.fit && (
          <div className="fit-card">
            <dt>Where Ambar would fit</dt>
            <dd>{shop.fit}</dd>
          </div>
        )}
      </dl>

      {shop.note && <p className="location-note">{shop.note}</p>}
    </section>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  name: keyof ShopDraft;
  value: string;
  onChange: (name: keyof ShopDraft, value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="form-field">
      <span>
        {label} {required && <em>Required</em>}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function FormTextArea({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  name: keyof ShopDraft;
  value: string;
  onChange: (name: keyof ShopDraft, value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <textarea
        name={name}
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

function PriceRangeEditor({
  rows,
  onChange,
}: {
  rows: PriceRow[];
  onChange: (rows: PriceRow[]) => void;
}) {
  const updateRow = (index: number, field: keyof PriceRow, value: string) => {
    const cleanValue = field === "product" ? value : value.replace(/[^0-9.,+]/g, "");
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: cleanValue } : row)));
  };

  return (
    <div className="price-editor">
      <div className="price-editor-labels" aria-hidden="true">
        <span>Product type</span>
        <span>Price range</span>
      </div>
      {rows.map((row, index) => (
        <div className="price-row" key={index}>
          <input
            type="text"
            value={row.product}
            aria-label={`Product type ${index + 1}`}
            placeholder="Postcards"
            onChange={(event) => updateRow(index, "product", event.target.value)}
          />
          <div className="price-inputs">
            <label>
              <span>€</span>
              <input
                type="text"
                inputMode="decimal"
                value={row.minimum}
                aria-label={`Minimum price ${index + 1}`}
                placeholder="0"
                onChange={(event) => updateRow(index, "minimum", event.target.value)}
              />
            </label>
            <span className="price-dash" aria-hidden="true">–</span>
            <label>
              <span>€</span>
              <input
                type="text"
                inputMode="decimal"
                value={row.maximum}
                aria-label={`Maximum price ${index + 1}`}
                placeholder="0"
                onChange={(event) => updateRow(index, "maximum", event.target.value)}
              />
            </label>
          </div>
          {rows.length > 1 && (
            <button
              className="remove-price-row"
              type="button"
              aria-label={`Remove price row ${index + 1}`}
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        className="add-price-row"
        type="button"
        onClick={() => onChange([...rows, { product: "", minimum: "", maximum: "" }])}
      >
        <span aria-hidden="true">＋</span> Add another product
      </button>
      <p className="form-help">Saved as “Product type €0 - €0”. Leave the second amount blank for a single price.</p>
    </div>
  );
}

function ContactEditor({
  rows,
  onChange,
}: {
  rows: ContactRow[];
  onChange: (rows: ContactRow[]) => void;
}) {
  const updateRow = (index: number, field: keyof ContactRow, value: string) => {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } as ContactRow : row,
      ),
    );
  };

  return (
    <div className="contact-editor">
      <div className="contact-editor-labels" aria-hidden="true">
        <span>Contact type</span>
        <span>Contact details</span>
      </div>
      {rows.map((row, index) => (
        <div className="contact-row" key={index}>
          <select
            value={row.kind}
            aria-label={"Contact type " + (index + 1)}
            onChange={(event) => updateRow(index, "kind", event.target.value)}
          >
            <option value="email">Email</option>
            <option value="phone">Phone number</option>
            <option value="link">Contact link</option>
          </select>
          <input
            type="text"
            inputMode={row.kind === "email" ? "email" : row.kind === "phone" ? "tel" : "url"}
            value={row.value}
            aria-label={"Contact details " + (index + 1)}
            placeholder={
              row.kind === "email"
                ? "hello@example.com"
                : row.kind === "phone"
                  ? "+34 600 000 000"
                  : "https://…"
            }
            onChange={(event) => updateRow(index, "value", event.target.value)}
          />
          {rows.length > 1 && (
            <button
              className="remove-contact-row"
              type="button"
              aria-label={"Remove contact " + (index + 1)}
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        className="add-contact-row"
        type="button"
        onClick={() => onChange([...rows, { kind: "email", value: "" }])}
      >
        <span aria-hidden="true">＋</span> Add another contact
      </button>
    </div>
  );
}

function LogoCropDialog({
  source,
  background,
  onCancel,
  onApply,
}: {
  source: LogoCropSource;
  background: "light" | "dark";
  onCancel: () => void;
  onApply: (file: File) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const previewUrl = useMemo(() => URL.createObjectURL(source.blob), [source.blob]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);
  const [cropError, setCropError] = useState("");

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !applying) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [applying, onCancel]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      const bounds = viewport.getBoundingClientRect();
      setViewportSize({ width: bounds.width, height: bounds.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const fitScale = imageSize.width && imageSize.height && viewportSize.width && viewportSize.height
    ? Math.min(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height)
    : 0;
  const displayWidth = imageSize.width * fitScale * zoom;
  const displayHeight = imageSize.height * fitScale * zoom;

  const resetCrop = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const applyCrop = async () => {
    const image = imageRef.current;
    if (!image || !imageSize.width || !viewportSize.width) {
      setCropError("The image is still loading. Please try again.");
      return;
    }

    setApplying(true);
    setCropError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 600;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The crop could not be created.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const scaleX = canvas.width / viewportSize.width;
      const scaleY = canvas.height / viewportSize.height;
      const drawX = ((viewportSize.width - displayWidth) / 2 + offset.x) * scaleX;
      const drawY = ((viewportSize.height - displayHeight) / 2 + offset.y) * scaleY;
      context.drawImage(
        image,
        drawX,
        drawY,
        displayWidth * scaleX,
        displayHeight * scaleY,
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", 0.9);
      });
      if (!blob) throw new Error("The crop could not be created.");
      if (blob.size > 2_000_000) throw new Error("The cropped logo is still larger than 2 MB.");

      const baseName = source.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "logo";
      onApply(new File([blob], `${baseName}-cropped.webp`, { type: blob.type }));
    } catch (caught) {
      setCropError(caught instanceof Error ? caught.message : "The crop could not be created.");
      setApplying(false);
    }
  };

  return (
    <div className="logo-crop-backdrop">
      <section
        className="logo-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-crop-title"
      >
        <div className="logo-crop-heading">
          <div>
            <p className="eyebrow">Logo editor</p>
            <h2 id="logo-crop-title">Crop and size your logo</h2>
            <p>Drag the image to position it, then adjust its size.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={applying} aria-label="Close logo editor">
            ×
          </button>
        </div>

        <div
          ref={viewportRef}
          className={`logo-crop-viewport${background === "dark" ? " is-dark" : ""}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              offsetX: offset.x,
              offsetY: offset.y,
            };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            setOffset({
              x: drag.offsetX + event.clientX - drag.x,
              y: drag.offsetY + event.clientY - drag.y,
            });
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <img
            ref={imageRef}
            src={previewUrl}
            alt="Logo crop preview"
            draggable={false}
            onLoad={(event) => {
              setImageSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
            style={{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
          <span>Drag to reposition</span>
        </div>

        <div className="logo-crop-controls">
          <div className="logo-crop-size-row">
            <label htmlFor="logo-crop-zoom">Logo size</label>
            <output htmlFor="logo-crop-zoom">{Math.round(zoom * 100)}%</output>
          </div>
          <div className="logo-crop-slider">
            <button
              type="button"
              aria-label="Make logo smaller"
              onClick={() => setZoom((current) => Math.max(0.35, current - 0.1))}
            >
              −
            </button>
            <input
              id="logo-crop-zoom"
              type="range"
              min="0.35"
              max="4"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <button
              type="button"
              aria-label="Make logo larger"
              onClick={() => setZoom((current) => Math.min(4, current + 0.1))}
            >
              +
            </button>
          </div>
          <button className="logo-crop-reset" type="button" onClick={resetCrop}>
            Reset to fit
          </button>
        </div>

        {cropError && <p className="form-error" role="alert">{cropError}</p>}

        <div className="logo-crop-actions">
          <button type="button" onClick={onCancel} disabled={applying}>Cancel</button>
          <button type="button" onClick={applyCrop} disabled={applying || !imageSize.width}>
            {applying ? "Preparing…" : "Use this crop"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ShopForm({
  shop,
  mode,
  manualLocation,
  onCancel,
  onClearMapPick,
  onRequestMapPick,
  onSaved,
}: {
  shop?: Shop;
  mode: Exclude<FormMode, null>;
  manualLocation: Coordinates | null;
  onCancel: () => void;
  onClearMapPick: () => void;
  onRequestMapPick: (initialLocation: Coordinates | null) => void;
  onSaved: (shop: Shop) => void;
}) {
  const isDuplicate = mode === "duplicate";
  const [draft, setDraft] = useState<ShopDraft>(() => emptyDraft(shop, isDuplicate));
  const [priceRows, setPriceRows] = useState<PriceRow[]>(() => parsePriceRows(shop?.priceRange ?? ""));
  const [contactRows, setContactRows] = useState<ContactRow[]>(
    () => parseContactRows(shop?.contact ?? ""),
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<LogoCropSource | null>(null);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [importingLogo, setImportingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvingManualLocation, setResolvingManualLocation] = useState(false);
  const [error, setError] = useState("");
  const [coordinateHint, setCoordinateHint] = useState("");
  const autoLocationValueRef = useRef("");
  const logoPreviewUrl = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : ""),
    [logoFile],
  );

  useEffect(
    () => () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    },
    [logoPreviewUrl],
  );

  useEffect(() => {
    if (!manualLocation) return;

    const previousAutomaticValue = autoLocationValueRef.current;
    const currentValue = draft.directionsUrl.trim();
    if (currentValue && currentValue !== previousAutomaticValue) return;

    const fallbackUrl = coordinatesMapUrl(manualLocation);
    autoLocationValueRef.current = fallbackUrl;
    setDraft((current) => ({ ...current, directionsUrl: fallbackUrl }));
    setCoordinateHint("Coordinates added automatically from the selected pin.");
    setResolvingManualLocation(true);

    const controller = new AbortController();
    let active = true;
    const query = new URLSearchParams({
      lat: String(manualLocation.lat),
      lng: String(manualLocation.lng),
    });
    void fetch(`/api/location/reverse?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as {
          address?: string;
          mapsUrl?: string;
        };
        if (!response.ok) return;
        if (!active || autoLocationValueRef.current !== fallbackUrl) return;
        const detectedValue = result.address?.trim() || result.mapsUrl || fallbackUrl;
        autoLocationValueRef.current = detectedValue;
        setDraft((current) => {
          if (current.directionsUrl !== fallbackUrl) return current;
          return { ...current, directionsUrl: detectedValue };
        });
        setCoordinateHint(
          result.address?.trim()
            ? "Address added automatically from the selected pin."
            : "Coordinates added automatically from the selected pin.",
        );
      })
      .catch((caught: unknown) => {
        if (
          active &&
          !(caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setCoordinateHint("Coordinates added automatically from the selected pin.");
        }
      })
      .finally(() => {
        if (active) setResolvingManualLocation(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // The current value is inspected only when a new map position arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualLocation]);

  const update = (name: keyof ShopDraft, value: string) => {
    if (name === "directionsUrl" && value !== autoLocationValueRef.current) {
      autoLocationValueRef.current = "";
    }
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === "directionsUrl") {
        const coordinates = parseMapCoordinates(value);
        setCoordinateHint(
          !value.trim()
            ? ""
            : coordinates
              ? "Location detected. The address will be added automatically when you save."
              : "The address and map position will be extracted automatically when you save.",
        );
      }
      return next;
    });
  };

  const openLogoCrop = (blob: Blob, name: string) => {
    if (!supportedLogoTypes.includes(blob.type)) {
      setError("Choose a PNG, JPG, WEBP or GIF image.");
      return false;
    }
    if (blob.size > 10_000_000) {
      setError("Images prepared for cropping must be 10 MB or smaller.");
      return false;
    }
    setError("");
    setCropSource({ blob, name });
    return true;
  };

  const handleLogoDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setLogoDragActive(false);

    const file = Array.from(event.dataTransfer.files).find((candidate) =>
      supportedLogoTypes.includes(candidate.type),
    );
    if (file) {
      openLogoCrop(file, file.name);
      return;
    }

    const imageUrl = droppedWebImageUrl(event.dataTransfer);
    if (!imageUrl) {
      setError("Drop an image file or drag the image itself from another website.");
      return;
    }

    setError("");
    setImportingLogo(true);
    try {
      const response = await fetch("/api/logos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, preview: true }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "The web image could not be prepared.");
      }
      const blob = await response.blob();
      openLogoCrop(blob, `${new URL(imageUrl).hostname}-logo`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The web image could not be prepared.");
    } finally {
      setImportingLogo(false);
    }
  };

  const preview: Shop = {
    id: mode === "edit" ? shop?.id ?? "new-shop" : "new-shop",
    name: draft.name || "New shop",
    category: draft.category,
    initials: makeInitials(draft.name),
    logo: logoPreviewUrl || draft.logo || undefined,
    logoText: undefined,
    logoBackground: draft.logoBackground,
    type: draft.type,
    productRange: draft.productRange,
    priceRange: formatPriceRows(priceRows),
    contact: formatContactRows(contactRows),
    fit: draft.fit,
    address: draft.address,
    neighborhood: draft.neighborhood,
    website: draft.website,
    directionsUrl: draft.directionsUrl || undefined,
    lat: mode === "edit" ? shop?.lat ?? 0 : 0,
    lng: mode === "edit" ? shop?.lng ?? 0 : 0,
    note: draft.note || undefined,
    visitStatus: mode === "edit" && shop?.visitStatus === "visited" ? "visited" : "not_visited",
    reachOutSent: mode === "edit" && shop?.reachOutSent === true,
    followupSent: mode === "edit" && shop?.followupSent === true,
    manualNotes: mode === "edit" ? shop?.manualNotes || undefined : undefined,
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      let logoUrl = draft.logo;
      if (logoFile) {
        const uploadBody = new FormData();
        uploadBody.append("logo", logoFile);
        const uploadResponse = await fetch("/api/logos", {
          method: "POST",
          body: uploadBody,
        });
        const uploadResult = (await uploadResponse.json()) as {
          logoUrl?: string;
          error?: string;
        };
        if (!uploadResponse.ok || !uploadResult.logoUrl) {
          throw new Error(uploadResult.error || "Could not upload this logo.");
        }
        logoUrl = uploadResult.logoUrl;
      }

      const payload: Record<string, unknown> = Object.fromEntries(
        Object.entries(preview).filter(
          ([key]) => !["id", "address", "lat", "lng", "logo"].includes(key),
        ),
      );
      payload.initials = makeInitials(draft.name);
      payload.logo = logoUrl;
      payload.logoText = "";
      if (manualLocation) payload.manualLocation = manualLocation;

      const response = await fetch(mode === "edit" ? `/api/shops/${shop?.id}` : "/api/shops", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { shop?: Shop; error?: string };
      if (!response.ok || !result.shop) throw new Error(result.error || "Could not save this shop.");
      onSaved(result.shop);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this shop.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="form-view"
      aria-label={
        mode === "add"
          ? "Add a shop"
          : mode === "duplicate"
            ? `Duplicate ${shop?.name}`
            : `Edit ${shop?.name}`
      }
    >
      <button className="back-button" type="button" onClick={onCancel}>
        <span aria-hidden="true">←</span> {mode === "add" ? "All shops" : "Shop details"}
      </button>

      <div className="form-heading">
        <ShopLogo shop={preview} large />
        <div>
          <p className="eyebrow">
            {mode === "add" ? "New map entry" : mode === "duplicate" ? "Duplicate chain location" : "Update map entry"}
          </p>
          <h1>{mode === "add" ? "Add a shop" : mode === "duplicate" ? `Duplicate ${shop?.name}` : `Edit ${shop?.name}`}</h1>
          <p>
            {mode === "duplicate"
              ? "Business information is copied. Add the new location to create another branch."
              : "Changes are shared with everyone who has this map link."}
          </p>
        </div>
      </div>

      <form className="shop-form" onSubmit={submit}>
        <fieldset>
          <legend>Shop identity</legend>
          <FormField label="Shop name" name="name" value={draft.name} onChange={update} required />
          <div className="form-grid">
            <label className="form-field">
              <span>Map category</span>
              <select
                value={draft.category}
                onChange={(event) => update("category", event.target.value)}
              >
                <option value="shop">Shop</option>
                <option value="museum">Museum shop</option>
                <option value="airport">Airport shop</option>
                <option value="train_station">Train station shop</option>
              </select>
            </label>
            <label className="form-field initials-field">
              <span>Initials <em>Automatic</em></span>
              <input type="text" value={makeInitials(draft.name)} readOnly />
              <small>Updates from the first three words of the shop name.</small>
            </label>
          </div>
          <FormField label="Shop type" name="type" value={draft.type} onChange={update} placeholder="Concept store" />
          <div className="form-grid">
            <div className="logo-upload-field">
              <span>Logo image</span>
              <label
                className={`logo-upload-control${logoDragActive ? " is-dragging" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setLogoDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setLogoDragActive(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setLogoDragActive(false);
                  }
                }}
                onDrop={handleLogoDrop}
              >
                <input
                  key={logoFile ? logoFile.name + logoFile.lastModified : draft.logo || "empty"}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={importingLogo}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    openLogoCrop(file, file.name);
                    event.currentTarget.value = "";
                  }}
                />
                <strong aria-hidden="true">⇩</strong>
                <span>
                  {importingLogo
                    ? "Preparing web image…"
                    : logoFile || draft.logo
                    ? "Drop or choose another image"
                    : "Drop an image here or click to browse"}
                </span>
              </label>
              <small>
                {logoFile
                  ? `${logoFile.name} · cropped and ready to upload.`
                  : draft.logo
                    ? "The current image will be kept unless you replace or remove it."
                    : "Drag directly from another website, or choose an image from your computer. You can crop and resize it before saving."}
              </small>
              {(logoFile || draft.logo) && (
                <button
                  className="remove-logo-button"
                  type="button"
                  onClick={() => {
                    setLogoFile(null);
                    update("logo", "");
                  }}
                >
                  Remove image
                </button>
              )}
            </div>
            <label className="form-field">
              <span>Logo background</span>
              <select
                value={draft.logoBackground}
                onChange={(event) => update("logoBackground", event.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Location</legend>
          <div className="location-input-row">
            <FormField
              label="Google Maps link or address"
              name="directionsUrl"
              type="text"
              value={draft.directionsUrl}
              onChange={update}
              required={!manualLocation}
              placeholder="Paste a Google Maps link or type an address"
              hint="Paste a Google Maps link, type an address such as “Claudio Coello 24” or “Giuseppe Failla 61”, or use Pick on map and this field will be completed automatically."
            />
            <button
              className="map-pick-button"
              type="button"
              onClick={() =>
                onRequestMapPick(
                  manualLocation ||
                    parseMapCoordinates(draft.directionsUrl) ||
                    (shop ? { lat: shop.lat, lng: shop.lng } : null),
                )
              }
            >
              <span aria-hidden="true">⌖</span>
              {manualLocation ? "Move pin" : "Pick on map"}
            </button>
          </div>
          {manualLocation ? (
            <>
              <p className="coordinate-success manual-coordinate-success">
                ✓ Manual pin selected at {manualLocation.lat.toFixed(5)}, {manualLocation.lng.toFixed(5)}.
                <button type="button" onClick={onClearMapPick}>Use detected position instead</button>
              </p>
              <p className="coordinate-success" role="status">
                {resolvingManualLocation ? "Finding the nearest address…" : `✓ ${coordinateHint}`}
              </p>
            </>
          ) : coordinateHint ? (
            <p className="coordinate-success">✓ {coordinateHint}</p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>Contact & links</legend>
          <FormField label="Website" name="website" type="url" value={draft.website} onChange={update} placeholder="https://…" />
          <ContactEditor rows={contactRows} onChange={setContactRows} />
        </fieldset>

        <fieldset>
          <legend>Shop information</legend>
          <FormTextArea label="Product range" name="productRange" value={draft.productRange} onChange={update} placeholder="What the shop sells…" />
          <PriceRangeEditor rows={priceRows} onChange={setPriceRows} />
          <FormTextArea label="Where Ambar would fit" name="fit" value={draft.fit} onChange={update} placeholder="Why this shop is a good fit…" />
          <FormTextArea label="Additional note" name="note" value={draft.note} onChange={update} placeholder="Optional location or context note…" rows={3} />
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="form-actions">
          <button className="secondary-form-action" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="primary-form-action" type="submit" disabled={saving}>
            {saving
              ? "Locating & saving…"
              : mode === "add"
                ? "Add shop"
                : mode === "duplicate"
                  ? "Add duplicate"
                  : "Save changes"}
          </button>
        </div>
      </form>
      {cropSource && (
        <LogoCropDialog
          source={cropSource}
          background={draft.logoBackground}
          onCancel={() => setCropSource(null)}
          onApply={(file) => {
            setLogoFile(file);
            setCropSource(null);
            setError("");
          }}
        />
      )}
    </section>
  );
}

export default function Home() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<Record<string, LeafletMarker>>({});
  const manualMarkerRef = useRef<LeafletMarker | null>(null);
  const hasFittedMapRef = useRef(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopSyncState, setShopSyncState] = useState<ShopSyncState>("loading");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [manualLocation, setManualLocation] = useState<Coordinates | null>(null);
  const [locationPicking, setLocationPicking] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [syncError, setSyncError] = useState("");

  const filteredShops = useMemo(() => {
    const normalized = normalizeSearch(query.trim());
    return shops.filter((shop) => {
      const category = shopCategory(shop);
      if (categoryFilter !== "all" && category !== categoryFilter) return false;
      if (!normalized) return true;
      const searchableText = [
        shop.name,
        categoryDetails[category].search,
        shop.type,
        shop.productRange,
        shop.priceRange,
        shop.neighborhood,
        shop.address,
        shop.contact,
        shop.fit,
      ].join(" ");
      return normalizeSearch(searchableText).includes(normalized);
    });
  }, [categoryFilter, query, shops]);

  const categoryCounts = useMemo(
    () => ({
      shop: shops.filter((shop) => shopCategory(shop) === "shop").length,
      museum: shops.filter((shop) => shopCategory(shop) === "museum").length,
      airport: shops.filter((shop) => shopCategory(shop) === "airport").length,
      train_station: shops.filter((shop) => shopCategory(shop) === "train_station").length,
    }),
    [shops],
  );

  const selectedShop = shops.find((shop) => shop.id === selectedId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/shops", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as { shops?: Shop[]; error?: string };
        if (!response.ok || !result.shops) throw new Error(result.error || "Could not load shared updates.");
        setShops(sortShops(result.shops));
        setShopSyncState("ready");
        setSyncError("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setShops(sortShops(initialShops));
        setShopSyncState("fallback");
        setSyncError(error instanceof Error ? error.message : "Could not load shared updates.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    let disposed = false;
    let createdMap: LeafletMap | null = null;
    let removeSmoothWheelZoom: (() => void) | null = null;

    void import("leaflet").then((leafletModule) => {
      if (disposed || !mapNodeRef.current) return;
      const L = leafletModule;
      leafletRef.current = L;
      const worldBounds = L.latLngBounds(
        [-85.05112878, -180],
        [85.05112878, 180],
      );
      const map = L.map(mapNodeRef.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        zoomSnap: 0,
        zoomAnimation: true,
        zoomAnimationThreshold: 8,
        fadeAnimation: true,
        worldCopyJump: false,
        maxBounds: worldBounds,
        maxBoundsViscosity: 1,
      });
      createdMap = map;
      mapRef.current = map;
      const keepOneWorldVisible = () => {
        const worldViewPadding = L.point(72, 72);
        map.setMinZoom(map.getBoundsZoom(worldBounds, false, worldViewPadding));
      };
      keepOneWorldVisible();
      map.on("resize", keepOneWorldVisible);
      map.setView([40.4185, -3.703], 14);
      removeSmoothWheelZoom = installSmoothWheelZoom(map);

      const tileOptions = {
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 20,
        maxNativeZoom: 19,
        updateWhenIdle: true,
        updateWhenZooming: false,
        updateInterval: 50,
        keepBuffer: 5,
        noWrap: true,
        bounds: worldBounds,
        opacity: 0.9,
        className: "google-style-map-tile",
      };

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        tileOptions,
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      setMapReady(true);
    });

    return () => {
      disposed = true;
      removeSmoothWheelZoom?.();
      createdMap?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    manualMarkerRef.current?.remove();
    manualMarkerRef.current = null;
    if (!map || !L || !mapReady || !manualLocation) return;

    const icon = L.divIcon({
      className: "manual-location-pin-wrap",
      html: '<span class="shop-pin manual-location-pin"><span>✓</span></span>',
      iconSize: [40, 48],
      iconAnchor: [20, 44],
    });
    const marker = L.marker([manualLocation.lat, manualLocation.lng], {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    });
    enableSubpixelMarkerPosition(marker, map);
    marker.addTo(map);
    manualMarkerRef.current = marker;

    return () => {
      marker.remove();
      if (manualMarkerRef.current === marker) manualMarkerRef.current = null;
    };
  }, [manualLocation, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !locationPicking) return;

    const selectManualLocation = (event: LeafletMouseEvent) => {
      setManualLocation({ lat: event.latlng.lat, lng: event.latlng.lng });
      setLocationPicking(false);
      setMobileView("list");
    };
    map.on("click", selectManualLocation);
    return () => {
      map.off("click", selectManualLocation);
    };
  }, [locationPicking, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;

    Object.values(markersRef.current).forEach((marker) => marker.removeFrom(map));
    markersRef.current = {};

    shops.forEach((shop) => {
      const category = shopCategory(shop);
      const pinClass = category === "shop" ? "" : ` ${categoryDetails[category].className}-pin`;
      const icon = L.divIcon({
        className: "shop-pin-wrap",
        html: `<span class="shop-pin${pinClass}"><span>${escapeHtml(shop.initials)}</span></span>`,
        iconSize: [40, 48],
        iconAnchor: [20, 44],
      });
      const marker = L.marker([shop.lat, shop.lng], {
        icon,
        title: shop.name,
        keyboard: true,
        riseOnHover: true,
      });
      enableSubpixelMarkerPosition(marker, map);
      marker.addTo(map);
      marker.bindTooltip(shop.name, {
        direction: "top",
        offset: [0, -40],
        className: "shop-tooltip",
      });
      marker.on("click", () => {
        setFormMode(null);
        setSelectedId(shop.id);
        setMobileView("list");
      });
      markersRef.current[shop.id] = marker;
    });

    if (!hasFittedMapRef.current && shops.length > 0) {
      map.fitBounds(
        shops.map((shop) => [shop.lat, shop.lng] as [number, number]),
        { padding: [70, 70], maxZoom: 16 },
      );
      hasFittedMapRef.current = true;
    }
  }, [mapReady, shops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const visibleIds = new Set(filteredShops.map((shop) => shop.id));

    shops.forEach((shop) => {
      const marker = markersRef.current[shop.id];
      if (!marker) return;
      if (visibleIds.has(shop.id) && !map.hasLayer(marker)) marker.addTo(map);
      if (!visibleIds.has(shop.id) && map.hasLayer(marker)) map.removeLayer(marker);
    });

    if (filteredShops.length > 0 && (query.trim() || categoryFilter !== "all")) {
      map.fitBounds(
        filteredShops.map((shop) => [shop.lat, shop.lng] as [number, number]),
        { padding: [80, 80], maxZoom: 16 },
      );
    }
  }, [categoryFilter, filteredShops, mapReady, query, shops]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    Object.values(markersRef.current).forEach((marker) => marker.closeTooltip());
    if (!selectedShop) return;
    mapRef.current.flyTo([selectedShop.lat, selectedShop.lng], 17, { duration: 0.65 });
    markersRef.current[selectedShop.id]?.openTooltip();
  }, [selectedShop, mapReady]);

  useEffect(() => {
    if (mobileView !== "map" || !mapReady || !mapRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({ pan: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mapReady, mobileView]);

  const viewAllShops = () => {
    setQuery("");
    setCategoryFilter("all");
    setSelectedId(null);
    fitAllShops(mapRef.current, markersRef.current, shops);
  };

  const openList = () => {
    setSelectedId(null);
    setFormMode(null);
    setManualLocation(null);
    setLocationPicking(false);

    const map = mapRef.current;
    if (!map || filteredShops.length === 0) return;

    Object.values(markersRef.current).forEach((marker) => marker.closeTooltip());
    map.fitBounds(
      filteredShops.map((shop) => [shop.lat, shop.lng] as [number, number]),
      { padding: [70, 70], maxZoom: 16, animate: true, duration: 0.45 },
    );
  };

  const handleSaved = (savedShop: Shop) => {
    setShops((current) =>
      sortShops([...current.filter((shop) => shop.id !== savedShop.id), savedShop]),
    );
    setQuery("");
    setSelectedId(savedShop.id);
    setFormMode(null);
    setManualLocation(null);
    setLocationPicking(false);
    setSyncError("");
  };

  const handleDeleted = (deletedId: string) => {
    setShops((current) => current.filter((shop) => shop.id !== deletedId));
    setSelectedId(null);
    setFormMode(null);
    setManualLocation(null);
    setLocationPicking(false);
    setSyncError("");
  };

  const handleTracked = (trackedShop: Shop) => {
    setShops((current) =>
      sortShops([...current.filter((shop) => shop.id !== trackedShop.id), trackedShop]),
    );
    setSyncError("");
  };

  const requestMapPick = (initialLocation: Coordinates | null) => {
    setLocationPicking(true);
    setMobileView("map");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const map = mapRef.current;
        if (!map) return;
        map.invalidateSize({ pan: false });
        if (initialLocation) {
          map.flyTo(
            [initialLocation.lat, initialLocation.lng],
            Math.max(map.getZoom(), 16),
            { duration: 0.45 },
          );
        }
      });
    });
  };

  return (
    <main className={`map-app mobile-${mobileView}-open`}>
      <aside className="sidebar">
        <header className="app-header">
          <div className="title-row">
            <div>
              <h1>Ambar - Madrid Retail Mapping</h1>
            </div>
            <div className="header-actions">
              <button
                className="add-button"
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setManualLocation(null);
                  setLocationPicking(false);
                  setFormMode("add");
                }}
              >
                <span aria-hidden="true">＋</span> Add
              </button>
            </div>
          </div>

          <label className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <span className="sr-only">Search shops</span>
            <input
              type="search"
              placeholder="Search shops or products"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(null);
                setFormMode(null);
              }}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                ×
              </button>
            )}
          </label>
          <button
            className="mobile-map-toggle"
            type="button"
            onClick={() => setMobileView("map")}
          >
            <span aria-hidden="true">⌖</span> View map
          </button>
          {syncError && <p className="sync-notice" role="status">{syncError} Showing the saved baseline.</p>}
        </header>

        {formMode === "add" ? (
          <ShopForm
            mode="add"
            manualLocation={manualLocation}
            onCancel={openList}
            onClearMapPick={() => setManualLocation(null)}
            onRequestMapPick={requestMapPick}
            onSaved={handleSaved}
          />
        ) : formMode === "edit" && selectedShop ? (
          <ShopForm
            key={selectedShop.id}
            mode="edit"
            shop={selectedShop}
            manualLocation={manualLocation}
            onCancel={() => {
              setFormMode(null);
              setManualLocation(null);
              setLocationPicking(false);
            }}
            onClearMapPick={() => setManualLocation(null)}
            onRequestMapPick={requestMapPick}
            onSaved={handleSaved}
          />
        ) : formMode === "duplicate" && selectedShop ? (
          <ShopForm
            key={`${selectedShop.id}-duplicate`}
            mode="duplicate"
            shop={selectedShop}
            manualLocation={manualLocation}
            onCancel={() => {
              setFormMode(null);
              setManualLocation(null);
              setLocationPicking(false);
            }}
            onClearMapPick={() => setManualLocation(null)}
            onRequestMapPick={requestMapPick}
            onSaved={handleSaved}
          />
        ) : selectedShop ? (
          <ShopDetail
            shop={selectedShop}
            onBack={openList}
            onEdit={() => {
              setManualLocation(null);
              setLocationPicking(false);
              setFormMode("edit");
            }}
            onDuplicate={() => {
              setManualLocation(null);
              setLocationPicking(false);
              setFormMode("duplicate");
            }}
            onDeleted={handleDeleted}
            onTracked={handleTracked}
          />
        ) : shopSyncState === "loading" ? (
          <div className="shop-data-loading" role="status" aria-live="polite">
            <span className="loading-pin" aria-hidden="true" />
            <p>Loading shops…</p>
          </div>
        ) : (
          <section className="results" aria-label="Shop results">
            <div className="category-filters" aria-label="Filter map categories">
              <button
                className="category-filter--all"
                type="button"
                aria-pressed={categoryFilter === "all"}
                onClick={viewAllShops}
              >
                View all <em>{shops.length}</em>
              </button>
              <button
                className="category-filter--shop"
                type="button"
                aria-pressed={categoryFilter === "shop"}
                onClick={() => setCategoryFilter("shop")}
              >
                <span className="category-dot shop-dot" aria-hidden="true" />
                Shops <em>{categoryCounts.shop}</em>
              </button>
              <button
                className="category-filter--museum"
                type="button"
                aria-pressed={categoryFilter === "museum"}
                onClick={() => setCategoryFilter("museum")}
              >
                <span className="category-dot museum-dot" aria-hidden="true" />
                Museum shops <em>{categoryCounts.museum}</em>
              </button>
              <button
                className="category-filter--airport"
                type="button"
                aria-pressed={categoryFilter === "airport"}
                onClick={() => setCategoryFilter("airport")}
              >
                <span className="category-dot airport-dot" aria-hidden="true" />
                Airport shops <em>{categoryCounts.airport}</em>
              </button>
              <button
                className="category-filter--train"
                type="button"
                aria-pressed={categoryFilter === "train_station"}
                onClick={() => setCategoryFilter("train_station")}
              >
                <span className="category-dot train-dot" aria-hidden="true" />
                Train station shops <em>{categoryCounts.train_station}</em>
              </button>
            </div>
            <div className="results-label">
              <span>{filteredShops.length} {filteredShops.length === 1 ? "location" : "locations"}</span>
              <span>A–Z · Madrid</span>
            </div>
            <div className="shop-list">
              {filteredShops.map((shop) => (
                <button
                  className="shop-card"
                  key={shop.id}
                  type="button"
                  onClick={() => setSelectedId(shop.id)}
                >
                  <ShopLogo shop={shop} />
                  <span className="shop-summary">
                    <strong>{shop.name}</strong>
                    <span>{shop.type}</span>
                    <span className="shop-address">
                      {[shop.neighborhood, shop.address.split(",")[0]].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="chevron" aria-hidden="true">›</span>
                </button>
              ))}
              {filteredShops.length === 0 && (
                <div className="empty-state">
                  <span aria-hidden="true">⌕</span>
                  <h2>No shops found</h2>
                  <p>Try a name, neighbourhood, product or price.</p>
                  <button type="button" onClick={() => setQuery("")}>Clear search</button>
                </div>
              )}
            </div>
          </section>
        )}

        <footer className="sidebar-footer">
          Shared map · Additions and edits are visible to everyone with the link
        </footer>
      </aside>

      <section
        className={`map-stage${locationPicking ? " is-location-picking" : ""}`}
        aria-label="Interactive shop map"
      >
        <button
          className="mobile-list-toggle"
          type="button"
          onClick={() => {
            setLocationPicking(false);
            setMobileView("list");
          }}
        >
          <span aria-hidden="true">←</span> Back to list
        </button>
        <div className={`map-loading ${mapReady && shopSyncState !== "loading" ? "is-hidden" : ""}`}>
          <span className="loading-pin" aria-hidden="true" />
          <p>{shopSyncState === "loading" ? "Loading shops…" : "Loading Madrid map…"}</p>
        </div>
        <div ref={mapNodeRef} id="shop-map" />
        {locationPicking ? (
          <div className="location-picker-caption" role="status">
            <span className="caption-pin" aria-hidden="true" />
            <strong>Click the map to place the shop pin</strong>
            <button
              type="button"
              onClick={() => {
                setLocationPicking(false);
                setMobileView("list");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="map-caption" aria-hidden="true">
            <span className="caption-pin" />
            Select a marker to view shop details
          </div>
        )}
      </section>
    </main>
  );
}
