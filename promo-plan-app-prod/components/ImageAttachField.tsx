"use client";

import { useState } from "react";
import { fileToCompressedDataUrl, ImageTooLargeError } from "@/lib/imageUtils";

export default function ImageAttachField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      onChange(dataUrl);
    } catch (e) {
      setError(e instanceof ImageTooLargeError ? e.message : "Не удалось прикрепить изображение");
    } finally {
      setLoading(false);
    }
  };

  if (value) {
    return (
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Вложение" className="max-h-32 rounded-lg border border-line" />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label="Убрать изображение"
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-xs text-white hover:bg-ink-800"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft">
        📎 {loading ? "Загрузка…" : "Прикрепить картинку"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
