import { CheckCircle2, ImageIcon, UploadIcon } from "lucide-react";
import React, { useCallback, useState, useRef } from "react";
import { useOutletContext } from "react-router";
import {
  PROGRESS_INTERVAL_MS,
  PROGRESS_STEP,
  REDIRECT_DELAY_MS,
} from "../lib/constants";

type UploadProps = {
  onComplete: (base64Data: string) => void;
};

const Upload = ({ onComplete }: UploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { isSignedIn } = useOutletContext<AuthContext>();

  const processFile = useCallback(
    (selectedFile: File) => {
      if (!isSignedIn) return;

      setFile(selectedFile);
      setProgress(0);

      const reader = new FileReader();

      reader.onload = (e) => {
        const base64String = e.target?.result as string;

        // Start progress increment interval
        intervalRef.current = setInterval(() => {
          setProgress((prev) => {
            const nextProgress = prev + PROGRESS_STEP;
            if (nextProgress >= 100) {
              // Clear interval when progress reaches 100
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }

              // Call onComplete after redirect delay
              setTimeout(() => {
                onComplete(base64String);
              }, REDIRECT_DELAY_MS);

              return 100;
            }
            return nextProgress;
          });
        }, PROGRESS_INTERVAL_MS);
      };

      reader.readAsDataURL(selectedFile);
    },
    [isSignedIn, onComplete],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isSignedIn) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isSignedIn) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isSignedIn) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isSignedIn) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  return (
    <div className="upload">
      {!file ? (
        <div
          className={`dropzone ${isDragging ? "is-dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            className="drop-input"
            disabled={!isSignedIn}
            onChange={handleChange}
          />

          <div className="drop-content">
            <div className="drop-icon">
              <UploadIcon size={20} />
            </div>

            <p className="">
              {isSignedIn
                ? "Click to upload or just drag and drop"
                : "Sign in or sign up with Puter to upload your floor plan"}
            </p>

            <p className="help">Maximum file size 50 MB.</p>
          </div>
        </div>
      ) : (
        <div className="upload-status">
          <div className="status-content">
            <div className="status-icon">
              {progress === 100 ? (
                <CheckCircle2 className="check" />
              ) : (
                <ImageIcon className="image" />
              )}
            </div>

            <h3>{file.name}</h3>

            <div className="progress">
              <div className="progress-bar" style={{ width: `${progress}%` }} />

              <p className="status-text">
                {progress < 100 ? `Analyzing Floor Plan...` : "Redirecting..."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
