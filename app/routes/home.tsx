import type { Route } from "./+types/home";
import Navbar from "../../components/Navbar";
import { ArrowRight, ArrowUpRight, Clock, Layers, Trash2 } from "lucide-react";
import Button from "../../components/ui/Button";
import Upload from "../../components/Upload";
import { useNavigate, useOutletContext } from "react-router";
import { useEffect, useRef, useState } from "react";
import {
  createProject,
  deleteProject,
  getProjects,
} from "../../lib/puter.action";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Roomify" },
    { name: "description", content: "Turn your boring 2D floor plans into stunning 3D renders with Roomify!" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { userId } = useOutletContext<AuthContext>();
  const [projects, setProjects] = useState<DesignItem[]>([]);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const isCreatingProjectRef = useRef(false);

  const handleUploadComplete = async (base64Data: string) => {
    try {
      if (isCreatingProjectRef.current) return false;
      isCreatingProjectRef.current = true;
      const newId = Date.now().toString(); // Generate a unique ID for the project (you can replace this with a more robust method)
      const name = `Residence ${newId}`;

      const newItem = {
        id: newId,
        name,
        sourceImage: base64Data,
        renderedImage: undefined,
        timestamp: Date.now(),
      };

      const saved = await createProject({
        item: newItem,
        visibility: "private",
      });

      if (!saved) {
        alert("Failed to create project. Please try again.");
        return false;
      }

      setProjects((prev) => [saved, ...prev]);

      navigate(`/visualizer/${newId}`, {
        state: {
          initialImage: saved.sourceImage,
          initialRendered: saved.renderedImage || null,
          name,
        },
      });

      return true;
    } catch (error) {
      console.error("Error creating project:", error);
      alert("An unexpected error occurred. Please try again.");
      return false;
    } finally {
      isCreatingProjectRef.current = false;
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      const items = await getProjects();
      setProjects(items);
    };

    fetchProjects();
  }, []);

  return (
    <div className={"home"}>
      <Navbar />

      <section className={"hero"}>
        <div className={"announce"}>
          <div className={"dot"}>
            <div className={"pulse"}></div>
          </div>

          <p>Introducing Roomify 1.0</p>
        </div>

        <h1 className="">Build beautiful spaces at the speed of thought with Roomify</h1>

        <p className={"subtitle"}>
          Roomify is an AI-first design evironment that helps you visualize,
          render, and ship architectural projects faster than ever.
        </p>

        <div className="actions">
          <a href="#upload" className="cta">
            Start Building <ArrowRight className="icon" />
          </a>

          <Button variant={"outline"} size={"lg"} className="demo">
            Watch Demo
          </Button>
        </div>

        <div id="upload" className="upload-shell">
          <div className="grid-overlay"></div>

          <div className="upload-card">
            <div className="upload-head">
              <div className="upload-icon">
                <Layers className="icon" />
              </div>

              <h3 className="">Upload your floor plan</h3>
              <p className="">Supports JPG, PNG, formats up to 10MB</p>
            </div>

            <Upload onComplete={handleUploadComplete} />
          </div>
        </div>
      </section>

      <section className="projects">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <h2 className="">Projects</h2>
              <p className="">
                Your latest work and shared community projects, all in one
                place.
              </p>
            </div>
          </div>

          <div className="projects-grid">
            {projects.map(
              ({
                id,
                name,
                renderedImage,
                sourceImage,
                timestamp,
                ownerId,
                ownerName,
                sharedBy,
                isPublic,
              }) => {
                const isOwnedByCurrentUser = Boolean(
                  userId && ownerId === userId,
                );
                const isCommunity = Boolean(isPublic);
                const projectAuthor = isCommunity
                  ? sharedBy || ownerName || "Community"
                  : "You";

                return (
                  <div
                    key={id}
                    className="project-card group relative overflow-hidden"
                    onClick={() => navigate(`/visualizer/${id}`)}
                  >
                    {isOwnedByCurrentUser && (
                      <button
                        type="button"
                        onClick={async (event) => {
                          event.stopPropagation();
                          const confirmed = window.confirm(
                            "Are you sure you want to delete this project? This cannot be undone.",
                          );

                          if (!confirmed) return;

                          setDeletingProjectId(id);

                          const deleted = await deleteProject({ id });
                          setDeletingProjectId(null);

                          if (deleted) {
                            setProjects((prev) =>
                              prev.filter((project) => project.id !== id),
                            );
                          } else {
                            alert(
                              "Unable to delete project. Please try again.",
                            );
                          }
                        }}
                        className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 text-zinc-600 shadow-sm transition-opacity duration-200 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        disabled={deletingProjectId === id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="preview">
                      <img
                        src={renderedImage || sourceImage}
                        alt="Project"
                        className=""
                      />

                      {isCommunity && (
                        <div className="badge">
                          <span>Community</span>
                        </div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="">
                        <h3 className="">{name}</h3>

                        <div className="meta">
                          <Clock size={12} />
                          <span>
                            {new Date(timestamp).toLocaleDateString()}
                          </span>
                          <span>By {projectAuthor}</span>
                        </div>
                      </div>
                      <div className="arrow">
                        <ArrowUpRight size={18} />
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
