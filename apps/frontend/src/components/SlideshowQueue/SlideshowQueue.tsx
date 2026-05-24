import './SlideshowQueue.css';
import { useSlideshow } from '../../hooks/useSlideshow';

export default function SlideshowQueue() {
  const {
    status,
    isLoading,
    error,
    fileInputRef,
    handleFileSelect,
    removeImage,
    startSlideshow,
    stopSlideshow,
    triggerFileInput,
  } = useSlideshow();

  const handleRemove = async (imageId: string) => {
    try {
      await removeImage(imageId);
    } catch (removeError) {
      console.error(removeError);
    }
  };

  const handleStart = async () => {
    try {
      await startSlideshow();
    } catch (startError) {
      console.error(startError);
    }
  };

  const handleStop = async () => {
    try {
      await stopSlideshow();
    } catch (stopError) {
      console.error(stopError);
    }
  };

  return (
    <div className="slideshow-queue">
      <h2>Image Slideshow</h2>
      <p className="slideshow-status">
        {status?.running
          ? `Playing image ${status.current_index + 1} of ${status.queue_length}`
          : status?.queue_length
            ? `${status.queue_length} image${status.queue_length === 1 ? '' : 's'} queued`
            : 'No images queued'}
        {status ? ` · ${status.display_ms / 1000}s per image` : ''}
      </p>
      {error && <p className="slideshow-error">{error}</p>}
      <div className="slideshow-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button onClick={triggerFileInput} disabled={isLoading}>
          {isLoading ? 'Uploading...' : 'Add to Queue'}
        </button>
        <button
          onClick={handleStart}
          disabled={!status?.queue_length || status.running || isLoading}
        >
          Start
        </button>
        <button onClick={handleStop} disabled={!status?.running || isLoading}>
          Stop
        </button>
      </div>
      {status?.queue.length ? (
        <ul className="slideshow-items">
          {status.queue.map((item, index) => (
            <li
              key={item.id}
              className={`slideshow-item${
                status.running && index === status.current_index
                  ? ' slideshow-item-current'
                  : ''
              }`}
            >
              <span className="slideshow-item-name">
                {index + 1}. {item.name}
                {status.running && index === status.current_index ? ' (now playing)' : ''}
              </span>
              <button onClick={() => handleRemove(item.id)} disabled={isLoading}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="slideshow-empty">
          Upload one or more images to cycle through on the display.
        </p>
      )}
    </div>
  );
}
