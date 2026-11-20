import { createContext, useContext } from 'react'
import type { Photo } from '../story/types'

/** True inside a still of the film (a thumbnail, the editor's stage): a clip is shown as its first frame there. */
export const Stilled = createContext(false)

/**
 * A photo, or a clip: a short video that plays silently and loops where a
 * photo would sit. The film's sound is its song, so a clip never has any. A
 * browser that can't play the clip shows its first frame, like a photo.
 */
export function Media({ photo, onSize }: { photo: Photo; /** The picture's own width and height, once known. */ onSize?: (width: number, height: number) => void }) {
  const still = useContext(Stilled)
  if (photo.clip && !still) {
    return (
      <video
        src={photo.clip}
        poster={photo.src}
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        disablePictureInPicture
        draggable={false}
        style={photo.aspect ? { aspectRatio: String(photo.aspect) } : undefined}
        onLoadedMetadata={(e) => onSize?.(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
      />
    )
  }
  return (
    <img
      src={photo.src}
      alt=""
      draggable={false}
      ref={(img) => {
        if (img?.complete && img.naturalWidth) onSize?.(img.naturalWidth, img.naturalHeight)
      }}
      onLoad={(e) => onSize?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
    />
  )
}
