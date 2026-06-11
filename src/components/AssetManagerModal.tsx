import React, { useState, useEffect } from "react";
import {
  Upload,
  X,
  Copy,
  Check,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { db } from "../utils/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface AssetManagerModalProps {
  onClose: () => void;
  onNotify: (message: string, isError?: boolean) => void;
}

// Cache admin uploaded images across sessions
const UPLOADED_CACHE_KEY = 'admin_uploaded_images_v2';


export default function AssetManagerModal({
  onClose,
  onNotify,
}: AssetManagerModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<
    { name: string; url: string }[]
  >([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to load previous images from local storage
    const cached = localStorage.getItem(UPLOADED_CACHE_KEY);
    if (cached) {
      try { setUploadedAssets(JSON.parse(cached)); } catch(e){}
    }
  }, []);

  const saveAssets = (newAssets: {name: string, url: string}[]) => {
     setUploadedAssets(newAssets);
     localStorage.setItem(UPLOADED_CACHE_KEY, JSON.stringify(newAssets.slice(0, 50))); // limit cache size
  };

  const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800; // good for quality/size tradeoff (approx 50-100kb in JPEG)
                  const scaleSize = MAX_WIDTH / img.width;
                  const newWidth = Math.min(MAX_WIDTH, img.width);
                  const newHeight = img.height * (newWidth / img.width);

                  canvas.width = newWidth;
                  canvas.height = newHeight;

                  const ctx = canvas.getContext('2d');
                  if (!ctx) return reject('No canvas context');
                  ctx.drawImage(img, 0, 0, newWidth, newHeight);

                  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                  resolve(dataUrl);
              };
              img.onerror = () => reject('Image load error');
              if (event.target && event.target.result) {
                 img.src = event.target.result as string;
              }
          };
          reader.onerror = () => reject('File read error');
          reader.readAsDataURL(file);
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newAssets: { name: string; url: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          onNotify(`File ${file.name} is not an image`, true);
          continue;
        }

        // Compress and extract
        const dataUri = await compressImage(file);
        
        // Generate a random ID prefixed with IMG-
        const code = `IMG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        
        // Save to public Firestore collection
        await setDoc(doc(db, 'public_images', code), {
           dataUri,
           fileName: file.name,
           createdAt: serverTimestamp()
        });

        // The URL provided to the user is the Code (e.g. IMG-XXXXX)
        newAssets.push({ name: file.name, url: code });
      }

      if (newAssets.length > 0) {
        saveAssets([...newAssets, ...uploadedAssets]);
        onNotify(`Successfully uploaded ${newAssets.length} image(s)`);
      }
    } catch (err) {
      console.error(err);
      onNotify(
        "Failed to upload image. Please try again or check permissions.",
        true,
      );
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-blue-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">
              Image Asset Manager
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex flex-col flex-1 overflow-hidden">
          <div className="mb-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <Loader2
                    size={32}
                    className="text-blue-600 animate-spin mb-2"
                  />
                ) : (
                  <Upload size={32} className="text-slate-400 mb-2" />
                )}
                <p className="mb-2 text-sm text-slate-500 font-bold">
                  {uploading
                    ? "Uploading..."
                    : "Click or drag images to upload"}
                </p>
                <p className="text-xs text-slate-500">
                  SVG, PNG, JPG or GIF (MAX. 5MB)
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {uploadedAssets.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">
                No images uploaded in this session yet.
              </div>
            ) : (
              uploadedAssets.map((asset, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={asset.url.startsWith('IMG-') ? undefined : asset.url}
                      alt="upload"
                      className="w-12 h-12 object-cover rounded bg-slate-100 border border-slate-200"
                    />
                    <div className="overflow-hidden">
                      <p
                        className="text-xs font-bold text-slate-800 truncate"
                        title={asset.name}
                      >
                        {asset.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono font-bold truncate">
                        {asset.url}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(asset.url)}
                    className={`ml-3 shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition ${copiedUrl === asset.url ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {copiedUrl === asset.url ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copiedUrl === asset.url ? "Copied URL" : "Copy URL"}
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Paste the copied Image Code (e.g., <b>IMG-XXXXXX</b>) into the <b>Image URL</b> field when
              creating a question manually.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
