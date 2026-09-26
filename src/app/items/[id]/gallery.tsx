"use client";

/**
 * Image gallery.
 *
 * The only client component on this page. Everything else renders on the
 * server, because the rest of the page has no state.
 *
 * This is not the assessed AJAX work: it makes no network call. The assessed
 * fetch interactions are the category filter (slice 03) and the cart badge
 * (slice 05).
 */

import Image from "next/image";
import { useState } from "react";

type GalleryImage = { url: string; sortOrder: number };

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded border border-[#DDDEE9] bg-[#EDEEF6]">
        <span className="font-mono text-xs text-[#6B6E84]">No photographs</span>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-[#DDDEE9] bg-[#EDEEF6]">
        <Image
          src={current.url}
          // Alt text from the item title: a screen reader gets the item, not
          // "image 2 of 3", which says nothing about what is pictured.
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          className="object-cover"
          priority
        />
      </div>

      {images.length > 1 && (
        <ul className="flex flex-wrap gap-3" aria-label="Item photographs">
          {images.map((image, index) => {
            const selected = index === active;
            return (
              <li key={image.url}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show photograph ${index + 1} of ${images.length}`}
                  aria-current={selected}
                  className={`relative block h-[72px] w-[104px] overflow-hidden rounded bg-[#EDEEF6] transition-[border-color] ${
                    selected
                      ? "border-2 border-[#12142B]"
                      : "border border-[#DDDEE9] hover:border-[#6B6E84]"
                  }`}
                >
                  <Image
                    src={image.url}
                    alt=""
                    fill
                    sizes="104px"
                    className="object-cover"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
