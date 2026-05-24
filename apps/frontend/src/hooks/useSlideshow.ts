import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { fileToImageBinary } from '../utils/image';

export interface QueueItem {
  id: string;
  name: string;
}

export interface SlideshowStatus {
  running: boolean;
  queue_length: number;
  current_index: number;
  display_ms: number;
  transition_ms: number;
  queue: QueueItem[];
}

export function useSlideshow() {
  const [status, setStatus] = useState<SlideshowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshStatus = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/slideshow`);
    if (!response.ok) {
      throw new Error('Failed to fetch slideshow status');
    }
    const data = (await response.json()) as SlideshowStatus;
    setStatus(data);
    return data;
  }, []);

  useEffect(() => {
    refreshStatus().catch((fetchError) => {
      console.error(fetchError);
    });
  }, [refreshStatus]);

  const addImages = useCallback(
    async (files: FileList | File[]) => {
      setIsLoading(true);
      setError(null);

      try {
        for (const file of Array.from(files)) {
          const binaryData = await fileToImageBinary(file);
          const params = new URLSearchParams({
            name: file.name,
            auto_start: 'true',
          });
          const response = await fetch(
            `${API_BASE_URL}/slideshow/queue?${params.toString()}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: binaryData,
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to add ${file.name}`);
          }

          const data = await response.json();
          setStatus(data.slideshow);
        }
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : 'Failed to upload images';
        setError(message);
        throw uploadError;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files?.length) return;

      try {
        await addImages(files);
      } catch {
        // Error state is already set in addImages.
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [addImages]
  );

  const removeImage = useCallback(async (imageId: string) => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/slideshow/queue/${imageId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to remove image');
    }

    const data = await response.json();
    setStatus(data.slideshow);
  }, []);

  const startSlideshow = useCallback(async () => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/slideshow/start`, {
      method: 'POST',
    });
    const data = await response.json();
    setStatus(data.slideshow);
    if (!response.ok) {
      throw new Error(data.reason ?? 'Failed to start slideshow');
    }
  }, []);

  const stopSlideshow = useCallback(async () => {
    setError(null);
    const response = await fetch(`${API_BASE_URL}/slideshow/stop`, {
      method: 'POST',
    });
    const data = await response.json();
    setStatus(data.slideshow);
  }, []);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    status,
    isLoading,
    error,
    fileInputRef,
    addImages,
    handleFileSelect,
    removeImage,
    startSlideshow,
    stopSlideshow,
    triggerFileInput,
    refreshStatus,
  };
}
