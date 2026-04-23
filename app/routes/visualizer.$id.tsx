import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { generate3DView } from "../../lib/ai.action";
import { Box, Download, RefreshCcw, Share2, X } from "lucide-react";
import Button from "../../components/ui/Button";
import { createProject, getProjectById } from "../../lib/puter.action";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

const VisualizerId = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useOutletContext<AuthContext>();

  const hasInitialGenerated = useRef(false);

  const [project, setProject] = useState<DesignItem | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const handleBack = () => navigate("/");

  const handleExport = () => {
    if (!currentImage) return;

    const link = document.createElement("a");
    link.href = currentImage;
    link.download = `roomify-${project?.id || "export"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!currentImage) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}`;
    const shareText = `Check out my 3D room visualization on Roomify!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Roomify - Room Visualization",
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Share link copied to clipboard!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
      }
    }
  };

  const runGeneration = async (item: DesignItem) => {
    // Capture the current route ID to prevent state updates from stale async operations
    const capturedId = id;
    if (!capturedId || !item.sourceImage) return;

    try {
      setIsProcessing(true);

      const result = await generate3DView({ sourceImage: item.sourceImage });

      // Guard: verify route ID hasn't changed after await
      if (capturedId !== id) return;

      if (result.renderedImage) {
        setCurrentImage(result.renderedImage);

        const updatedItem = {
          ...item,
          renderedImage: result.renderedImage,
          renderedPath: result.renderedPath,
          timestamp: Date.now(),
          ownerId: item.ownerId ?? userId ?? null,
          isPublic: item.isPublic ?? false,
        };

        const saved = await createProject({
          item: updatedItem,
          visibility: "private",
        });

        // Guard: verify route ID hasn't changed after await
        if (capturedId !== id) return;

        if (saved) {
          setProject(saved);
          setCurrentImage(saved.renderedImage || result.renderedImage);
        }
      }
    } catch (error) {
      console.error("Error generating 3D view:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProject = async () => {
      if (!id) {
        setIsProjectLoading(false);
        return;
      }

      setIsProjectLoading(true);
      // Clear stale UI state immediately when starting to load a different project
      setProject(null);
      setCurrentImage(null);

      const fetchedProject = await getProjectById({ id });

      if (!isMounted) return;

      setProject(fetchedProject);
      setCurrentImage(fetchedProject?.renderedImage || null);
      setIsProjectLoading(false);
      hasInitialGenerated.current = false;
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (
      isProjectLoading ||
      hasInitialGenerated.current ||
      !project?.sourceImage
    )
      return;

    if (project.renderedImage) {
      setCurrentImage(project.renderedImage);
      hasInitialGenerated.current = true;
      return;
    }

    hasInitialGenerated.current = true;
    void runGeneration(project);
  }, [project, isProjectLoading]);

  return (
    <div className="visualizer">
      <nav className="topbar">
        <div className="brand">
          <Box className="logo" />

          <span className="name">Roomify</span>
        </div>

        <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
          <X /> Exit Editor
        </Button>
      </nav>

      <section className="content">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-meta">
              <p className="">Project</p>
              <h2 className="">
                {project?.name || `Residence ${project?.id}`}
              </h2>
              <p className="note">Created by You</p>
            </div>

            <div className="panel-actions">
              <Button
                size="sm"
                onClick={handleExport}
                className="export"
                disabled={isProcessing || !currentImage}
              >
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="share"
              >
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>
          </div>

          <div className={`render-area ${isProcessing ? "is-processing" : ""}`}>
            {currentImage ? (
              <img src={currentImage} alt="AI Render" className="render-img" />
            ) : (
              <div className="render-placeholder">
                {project?.sourceImage && (
                  <img
                    src={project.sourceImage}
                    alt="Original"
                    className="render-fallback"
                  />
                )}
              </div>
            )}

            {isProcessing && (
              <div className="render-overlay">
                <div className="rendering-card">
                  <RefreshCcw className="spinner" />
                  <span className="title">Rendering...</span>
                  <span className="title">
                    Generating your 3D visualization...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel compare">
          <div className="panel-header">
            <div className="panel-meta">
              <p className="">Comparison</p>
              <h3 className="">Before and After</h3>
            </div>
            <div className="hint">Drag to compare</div>
          </div>

          <div className="compare-stage">
            {project?.sourceImage && currentImage ? (
              <ReactCompareSlider
                defaultValue={50}
                style={{ width: "100%", height: "auto" }}
                itemOne={
                  <ReactCompareSliderImage
                    src={project.sourceImage}
                    alt="Original"
                    className="compare-img"
                  />
                }
                itemTwo={
                  <ReactCompareSliderImage
                    src={currentImage ?? project?.renderedImage}
                    alt="AI Render"
                    className="compare-img"
                  />
                }
              />
            ) : (
              <div className="compare-fallback">
                {project?.sourceImage && (
                  <img
                    src={project.sourceImage}
                    alt="Original"
                    className="compare-img"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default VisualizerId;
