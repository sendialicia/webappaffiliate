"use client"

import { useState } from "react"
import type { ProductImage } from "@/types/shopee-pid"

/**
 * A product photo from the marketplace CDN.
 *
 * Deliberately a plain <img> rather than next/image: the URLs are already thumbnails (13-17 KB),
 * so routing them through Vercel's optimizer would add cost and a remotePatterns entry without
 * making anything smaller.
 *
 * Shopee's thumbnail is built by appending a suffix the CDN honours by convention rather than by
 * contract, so a failed load quietly retries the full-size original before giving up.
 */
type Props = {
  image: ProductImage | null
  alt: string
  size: number
  className?: string
}

/**
 * Keyed by URL so the retry stage starts over for each photo: the detail card reuses one
 * instance as the selection changes, and a failure on the previous product must not carry over.
 */
export function ProductPhoto(props: Props) {
  return <ProductPhotoInner key={props.image?.url ?? "none"} {...props} />
}

function ProductPhotoInner({
  image,
  alt,
  size,
  className = "",
}: Props) {
  const [stage, setStage] = useState<"thumb" | "full" | "failed">("thumb")

  const src = stage === "thumb" ? image?.url : stage === "full" ? image?.fallback : undefined

  if (!image || !src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex flex-none items-center justify-center rounded-lg border border-dashed border-[var(--ov-line)] bg-[var(--ov-fill1)] text-center text-[11px] leading-tight text-[var(--ov-faint)] ${className}`}
      >
        Tanpa
        <br />
        foto
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional; see the note above.
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      // Only the thumbnail gets a second chance; if the original fails too, fall back to the slot.
      onError={() => setStage((s) => (s === "thumb" ? "full" : "failed"))}
      style={{ width: size, height: size }}
      className={`flex-none rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill1)] object-cover ${className}`}
    />
  )
}
