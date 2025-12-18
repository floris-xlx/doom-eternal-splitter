"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type ImageLightboxProps = {
  images: { name: string; url: string; metadata?: string }[];
  currentIndex: number;
  onClose: () => void;
};

export function ImageLightbox({ images, currentIndex, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(currentIndex);
  const current = images[index];

  const handlePrevious = () => {
    setIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      handlePrevious();
    } else if (e.key === "ArrowRight") {
      handleNext();
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none"
        onKeyDown={handleKeyDown}
      >
        <div className="relative flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous button */}
          {images.length > 1 && (
            <button
              onClick={handlePrevious}
              className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <div className="flex flex-col items-center gap-4">
            <img
              src={current.url}
              alt={current.name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            
            {/* Metadata */}
            <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
              <div className="font-medium">{current.name}</div>
              {current.metadata && (
                <div className="text-xs text-gray-300 mt-1">{current.metadata}</div>
              )}
              {images.length > 1 && (
                <div className="text-xs text-gray-400 mt-1">
                  {index + 1} / {images.length}
                </div>
              )}
            </div>
          </div>

          {/* Next button */}
          {images.length > 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
