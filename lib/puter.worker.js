const PRIVATE_PROJECT_PREFIX = "roomify_project_private_";
const PUBLIC_PROJECT_PREFIX = "roomify_project_public_";

const jsonError = (status, message, extra = {}) => {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

const getUserInfo = async (userPuter) => {
  try {
    const user = await userPuter.auth.getUser();

    return {
      id: user?.uuid || null,
      username: user?.username || null,
    };
  } catch {
    return {
      id: null,
      username: null,
    };
  }
};

const makePrivateKey = (userId, projectId) =>
  `${PRIVATE_PROJECT_PREFIX}${userId}${projectId}`;
const makePublicKey = (ownerId, projectId) =>
  `${PUBLIC_PROJECT_PREFIX}${ownerId}_${projectId}`;

const normalizeProject = (project, visibility, user) => {
  const validVisibility = visibility === "public" ? "public" : "private";
  const normalized = {
    ...project,
    visibility: validVisibility,
    ownerId: user.id || project.ownerId || null,
    ownerName: user.username || project.ownerName || null,
    updatedAt: new Date().toISOString(),
  };

  if (validVisibility === "public") {
    normalized.sharedBy = user.username || user.id;
    normalized.sharedAt = new Date().toISOString();
  } else {
    normalized.sharedBy = null;
    normalized.sharedAt = null;
  }

  return normalized;
};

router.post("/api/projects/save", async ({ request, user }) => {
  try {
    const userPuter = user.puter;

    if (!userPuter) return jsonError(401, "Authentication failed");

    const body = await request.json();
    const { project } = body;

    if (!project?.id || !project?.sourceImage)
      return jsonError(400, "Project ID and source image are required");

    const user = await getUserInfo(userPuter);
    if (!user.id) return jsonError(401, "Authentication failed");

    const payload = normalizeProject(project, "private", user);
    const key = makePrivateKey(user.id, project.id);
    await userPuter.kv.set(key, payload);

    return { saved: true, id: project.id, project: payload };
  } catch (e) {
    return jsonError(500, "Failed to save project", {
      message: e.message || "Unknown error",
    });
  }
});

router.post("/api/projects/share", async ({ request, user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const body = await request.json();
    const { id } = body || {};
    if (!id) return jsonError(400, "Project ID is required");

    const user = await getUserInfo(userPuter);
    if (!user.id) return jsonError(401, "Authentication failed");

    const privateKey = makePrivateKey(user.id, id);
    const project = await userPuter.kv.get(privateKey);
    if (!project) return jsonError(404, "Private project not found");

    const sharedProject = normalizeProject(project, "public", user);
    const publicKey = makePublicKey(user.id, id);

    await userPuter.kv.set(publicKey, sharedProject);
    await userPuter.kv.del(privateKey);

    return { project: { ...sharedProject, isPublic: true } };
  } catch (e) {
    return jsonError(500, "Failed to share project", {
      message: e.message || "Unknown error",
    });
  }
});

router.post("/api/projects/unshare", async ({ request, user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const body = await request.json();
    const { id } = body || {};
    if (!id) return jsonError(400, "Project ID is required");

    const user = await getUserInfo(userPuter);
    if (!user.id) return jsonError(401, "Authentication failed");

    const publicKey = makePublicKey(user.id, id);
    const project = await userPuter.kv.get(publicKey);
    if (!project) return jsonError(404, "Public project not found");

    if (project.ownerId !== user.id)
      return jsonError(403, "Unauthorized to unshare this project");

    const privateProject = normalizeProject(project, "private", user);
    const privateKey = makePrivateKey(user.id, id);

    await userPuter.kv.set(privateKey, privateProject);
    await userPuter.kv.del(publicKey);

    return { project: { ...privateProject, isPublic: false } };
  } catch (e) {
    return jsonError(500, "Failed to unshare project", {
      message: e.message || "Unknown error",
    });
  }
});

router.get("/api/projects/list", async ({ user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const user = await getUserInfo(userPuter);
    if (!user.id) return jsonError(401, "Authentication failed");

    const privateProjects = (
      await userPuter.kv.list(PRIVATE_PROJECT_PREFIX, true)
    ).map(({ value }) => ({ ...value, isPublic: false }));

    const publicProjects = (
      await userPuter.kv.list(PUBLIC_PROJECT_PREFIX, true)
    ).map(({ value }) => ({ ...value, isPublic: true }));

    const projectMap = new Map();
    [...privateProjects, ...publicProjects].forEach((project) => {
      if (!project?.id) return;
      if (!projectMap.has(project.id)) {
        projectMap.set(project.id, project);
      }
    });

    return { projects: Array.from(projectMap.values()) };
  } catch (e) {
    return jsonError(500, "Failed to list projects", {
      message: e.message || "Unknown error",
    });
  }
});

router.get("/api/projects/get", async ({ request, user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const user = await getUserInfo(userPuter);
    if (!user.id) return jsonError(401, "Authentication failed");

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) return jsonError(400, "Project ID is required");

    const privateKey = makePrivateKey(user.id, id);
    let project = await userPuter.kv.get(privateKey);

    if (project) {
      return {
        project: { ...project, isPublic: project.visibility === "public" },
      };
    }

    const publicEntries = await userPuter.kv.list(PUBLIC_PROJECT_PREFIX, true);
    const publicProject = publicEntries
      .map(({ value }) => value)
      .find((entry) => entry?.id === id);

    if (!publicProject) return jsonError(404, "Project not found");

    return {
      project: { ...publicProject, isPublic: true },
    };
  } catch (e) {
    return jsonError(500, "Failed to get project", {
      message: e.message || "Unknown error",
    });
  }
});

router.post("/api/projects/delete", async ({ request, user }) => {
  try {
    const userPuter = user.puter;
    if (!userPuter) return jsonError(401, "Authentication failed");

    const body = await request.json();
    const { id } = body || {};
    if (!id) return jsonError(400, "Project ID is required");

    const user = await getUserInfo(userPuter);
    if (!user.id) return jsonError(401, "Authentication failed");

    const privateKey = makePrivateKey(user.id, id);
    let deleted = await userPuter.kv.del(privateKey);

    if (!deleted) {
      const publicKey = makePublicKey(user.id, id);
      const publicProject = await userPuter.kv.get(publicKey);

      if (!publicProject) return jsonError(404, "Project not found");
      if (publicProject.ownerId !== user.id)
        return jsonError(403, "Unauthorized to delete this project");

      deleted = await userPuter.kv.del(publicKey);
    }

    if (!deleted) return jsonError(404, "Project not found");

    return { deleted: true };
  } catch (e) {
    return jsonError(500, "Failed to delete project", {
      message: e.message || "Unknown error",
    });
  }
});
