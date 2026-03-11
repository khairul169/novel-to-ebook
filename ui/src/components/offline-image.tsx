import { getOfflineImage } from "@/hooks/use-offline";
import { useEffect, useState } from "react";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
  fallback?: string;
};

export default function OfflineImage({ src, fallback, ...props }: Props) {
  const [imageSrc, setImageSrc] = useState<string>();

  useEffect(() => {
    if (!src) return;

    // let blobUrl: string | undefined;

    getOfflineImage(src)
      .then((url) => {
        // blobUrl = url;
        setImageSrc(url);
      })
      .catch(() => {
        if (fallback) setImageSrc(fallback);
      });

    // return () => {
    //   if (blobUrl) URL.revokeObjectURL(blobUrl);
    // };
  }, [src, fallback]);

  if (!imageSrc) {
    return null;
  }

  return <img src={imageSrc} {...props} />;
}
