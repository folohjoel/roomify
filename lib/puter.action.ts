import puter from "@heyputer/puter.js";
import {
  getOrCreateHostingConfig,
  uploadImageToHosting,
} from "./puter.hosting";
import { isHostedUrl } from "./utils";
import { PUTER_WORKER_URL } from "./constants";

export const signIn = async () => await puter.auth.signIn();

export const signOut = () => puter.auth.signOut();

export const getCurrentUser = async () => {
  try {
    return await puter.auth.getUser();
  } catch {
    return null;
  }
};

export const createProject = async ({
  item,
  visibility = "private",
}: CreateProjectParams): Promise<DesignItem | null | undefined> => {
  if (!PUTER_WORKER_URL) {
    console.warn("Missing VITE_PUTER_WORKER_URL; skip history fetch;");
    return null;
  }
  const projectId = item.id;

  const hosting = await getOrCreateHostingConfig();

  const hostedSource = projectId
    ? await uploadImageToHosting({
        hosting,
        url: item.sourceImage,
        projectId,
        label: "source",
      })
    : null;

  const hostedRender =
    projectId && item.renderedImage
      ? await uploadImageToHosting({
          hosting,
          url: item.renderedImage,
          projectId,
          label: "rendered",
        })
      : null;

  const resolvedSource =
    hostedSource?.url ||
    (isHostedUrl(item.sourceImage) ? item.sourceImage : "");

  if (!resolvedSource) {
    console.warn("Failed to host source image, skipping save.");
    return null;
  }

  const resolvedRender = hostedRender?.url
    ? hostedRender?.url
    : item.renderedImage && isHostedUrl(item.renderedImage)
      ? item.renderedImage
      : undefined;

  const {
    sourcePath: _sourcePath,
    renderedPath: _renderedPath,
    publicPath: _publicPath,
    ...rest
  } = item;

  const payload = {
    ...rest,
    sourceImage: resolvedSource,
    renderedImage: resolvedRender,
  };

  try {
    const response = await puter.workers.exec(
      `${PUTER_WORKER_URL}/api/projects/save`,
      {
        method: "POST",
        body: JSON.stringify({
          project: payload,
          visibility,
        }),
      },
    );

    if (!response.ok) {
      console.error("failed to save the project", await response.text());
      return null;
    }

    const data = (await response.json()) as { project?: DesignItem | null };

    return data?.project ?? null;
  } catch (e) {
    console.log("Failed to save project", e);
    return null;
  }
};

export const getProjects = async () => {
  if (!PUTER_WORKER_URL) {
    console.warn("Missing VITE_PUTER_WORKER_URL; skip history fetch;");
    return [];
  }

  try {
    const response = await puter.workers.exec(
      `${PUTER_WORKER_URL}/api/projects/list`,
      { method: "GET" },
    );

    if (!response.ok) {
      console.error("Failed to fetch history", await response.text());
      return [];
    }

    const data = (await response.json()) as { projects?: DesignItem[] | null };

    return Array.isArray(data?.projects) ? data?.projects : [];
  } catch (e) {
    console.error("Failed to get projects", e);
    return [];
  }
};

export const getProjectById = async ({ id }: { id: string }) => {
  if (!PUTER_WORKER_URL) {
    console.warn("Missing VITE_PUTER_WORKER_URL; skipping project fetch.");
    return null;
  }

  try {
    if (!(await getCurrentUser())) {
      console.warn(
        "User not authenticated, attempting sign in before fetching project",
      );
      await signIn();
    }
  } catch (error) {
    console.error("Failed to sign in before fetching project:", error);
    return null;
  }

  const url = new URL(`${PUTER_WORKER_URL}/api/projects/get`);
  url.searchParams.set("id", id);

  console.log("Fetching project with URL:", url.toString());

  try {
    const response = await puter.workers.exec(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    console.log("Fetch project response:", response);

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("Failed to fetch project:", response.status, bodyText);

      if (response.status === 404) {
        try {
          JSON.parse(bodyText);
          // If JSON parses, it's likely a project not found error, return null
          return null;
        } catch {
          // If not JSON, it's likely a route not found error, fallback to list
          console.warn(
            "GET route missing on worker, falling back to project list lookup",
          );
          const fallbackResponse = await puter.workers.exec(
            `${PUTER_WORKER_URL}/api/projects/list`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
            },
          );

          if (fallbackResponse.ok) {
            const listData = (await fallbackResponse.json()) as {
              projects?: DesignItem[] | null;
            };
            const project =
              listData?.projects?.find((item) => item.id === id) ?? null;

            if (project) {
              console.log("Found project via list fallback:", project);
              return project;
            }
          }
        }
      }

      return null;
    }

    const data = (await response.json()) as {
      project?: DesignItem | null;
    };

    console.log("Fetched project data:", data);

    return data?.project ?? null;
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return null;
  }
};

export const deleteProject = async ({ id }: DeleteProjectParams) => {
  if (!PUTER_WORKER_URL) {
    console.warn("Missing VITE_PUTER_WORKER_URL; skip delete request;");
    return false;
  }

  try {
    const response = await puter.workers.exec(
      `${PUTER_WORKER_URL}/api/projects/delete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      },
    );

    if (!response.ok) {
      console.error("Failed to delete project", await response.text());
      return false;
    }

    const data = (await response.json()) as { deleted?: boolean };
    return Boolean(data?.deleted);
  } catch (e) {
    console.error("Failed to delete project", e);
    return false;
  }
};
