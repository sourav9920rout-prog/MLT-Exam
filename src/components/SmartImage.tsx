import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { Loader2 } from 'lucide-react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  className?: string;
  alt?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

const imageCache = new Map<string, string>();

export default function SmartImage({ src, className, alt, ...props }: SmartImageProps) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) return;
    
    if (src.startsWith('IMG-')) {
      if (imageCache.has(src)) {
        setDataUri(imageCache.get(src)!);
        return;
      }
      
      setLoading(true);
      setError(false);
      getDoc(doc(db, 'public_images', src)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data().dataUri;
          imageCache.set(src, data);
          setDataUri(data);
        } else {
          setError(true);
        }
      }).catch(err => {
        console.error("Failed to load image", err);
        setError(true);
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setDataUri(src);
    }
  }, [src]);

  if (!src) return null;
  if (loading) return <div className={`flex items-center justify-center bg-slate-100 animate-pulse text-slate-400 rounded ${className}`}><Loader2 size={16} className="animate-spin" /></div>;
  if (error) return <div className={`flex items-center justify-center bg-red-50 text-red-400 text-xs text-center p-2 rounded border border-red-100 ${className}`}>Unavailable (Code: {src})</div>;

  return <img src={dataUri || src} className={className} alt={alt} {...props} />;
}
