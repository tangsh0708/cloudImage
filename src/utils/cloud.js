const ROOT_PATH = "/root";
const FOLDERS_COLLECTION = "folders";
const IMAGES_COLLECTION = "images";
const INVALID_NAME_PATTERN = /[\/\\:*?"<>|]/;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const TEMP_URL_BATCH_SIZE = 50;

function assertWechatCloud() {
  // #ifdef MP-WEIXIN
  if (typeof wx !== "undefined" && wx.cloud) {
    return;
  }
  // #endif
  throw new Error("当前环境不支持微信云开发，请在微信小程序端运行。");
}

function getDb() {
  assertWechatCloud();
  return wx.cloud.database();
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function assertValidName(name, label = "名称", maxLength = 50) {
  const normalized = normalizeName(name);

  if (!normalized) {
    throw new Error(`${label}不能为空`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`${label}不能超过${maxLength}个字符`);
  }

  if (INVALID_NAME_PATTERN.test(normalized)) {
    throw new Error(`${label}不能包含特殊字符 / \\ : * ? " < > |`);
  }

  return normalized;
}

function joinPath(parentPath, folderName) {
  if (parentPath === ROOT_PATH) {
    return `${ROOT_PATH}/${folderName}`;
  }
  return `${parentPath}/${folderName}`;
}

function replacePathPrefix(value, oldPrefix, newPrefix) {
  if (value === oldPrefix) {
    return newPrefix;
  }

  if (value.startsWith(`${oldPrefix}/`)) {
    return `${newPrefix}${value.slice(oldPrefix.length)}`;
  }

  return value;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getDepth(path) {
  return path.split("/").filter(Boolean).length - 1;
}

function getParentPath(path) {
  if (path === ROOT_PATH) {
    return "";
  }
  const chunks = path.split("/").filter(Boolean);
  if (chunks.length <= 1) {
    return ROOT_PATH;
  }
  return `/${chunks.slice(0, -1).join("/")}`;
}

function buildBreadcrumbs(path) {
  const chunks = path.split("/").filter(Boolean);
  return chunks.map((name, idx) => ({
    name,
    path: `/${chunks.slice(0, idx + 1).join("/")}`,
  }));
}

function getFileName(filePath) {
  return String(filePath || "")
    .split(/[\\/]/)
    .pop();
}

function hasFileExt(fileName) {
  return /\.[^.]+$/.test(fileName || "");
}

function getFileExt(filePath) {
  const i = String(filePath || "").lastIndexOf(".");
  if (i < 0) {
    return "jpg";
  }
  return filePath.slice(i + 1).toLowerCase();
}

function createCloudPath(folderPath, ext) {
  const safePath = folderPath.replace(/[^\w/-]/g, "_");
  const random = Math.random().toString(36).slice(2, 8);
  return `images${safePath}/${Date.now()}_${random}.${ext}`;
}

function createPathRegExp(db, folderPath) {
  return db.RegExp({
    regexp: `^${escapeRegExp(folderPath)}(?:/|$)`,
    options: "",
  });
}

function createKeywordRegExp(db, keyword) {
  return db.RegExp({
    regexp: escapeRegExp(keyword),
    options: "i",
  });
}

function normalizeListOptions(options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(options.pageSize) || DEFAULT_PAGE_SIZE),
  );

  return {
    page,
    pageSize,
    keyword: String(options.keyword || options.searchKeyword || "").trim(),
    sortBy: options.sortBy || "default",
  };
}

function getImageSort(sortBy) {
  if (sortBy === "name") {
    return [
      ["name", "asc"],
      ["createdAt", "desc"],
    ];
  }

  if (sortBy === "time") {
    return [
      ["updatedAt", "desc"],
      ["createdAt", "desc"],
    ];
  }

  if (sortBy === "size") {
    return [
      ["size", "desc"],
      ["createdAt", "desc"],
    ];
  }

  return [["createdAt", "desc"]];
}

function getFolderSort(sortBy) {
  if (sortBy === "time") {
    return [
      ["updatedAt", "desc"],
      ["name", "asc"],
    ];
  }

  if (sortBy === "size") {
    return [
      ["imageCount", "desc"],
      ["name", "asc"],
    ];
  }

  return [["name", "asc"]];
}

function applySort(query, sortList) {
  return sortList.reduce((acc, [field, order]) => acc.orderBy(field, order), query);
}

function buildFolderWhere(db, parentPath, keyword) {
  const where = { parentPath };

  if (keyword) {
    where.name = createKeywordRegExp(db, keyword);
  }

  return where;
}

function buildImageWhere(db, folderPath, keyword) {
  if (!keyword) {
    return { folderPath };
  }

  const _ = db.command;
  const keywordRegExp = createKeywordRegExp(db, keyword);

  return _.and([
    { folderPath },
    _.or([
      { name: keywordRegExp },
      { ext: keywordRegExp },
    ]),
  ]);
}

async function getLocalFileSize(filePath) {
  if (typeof uni === "undefined" || !uni.getFileInfo) {
    return 0;
  }

  return new Promise((resolve) => {
    uni.getFileInfo({
      filePath,
      success: (res) => resolve(res.size || 0),
      fail: () => resolve(0),
    });
  });
}

async function runInBatches(items, mapper, batchSize = 8) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(mapper));
  }
}

async function getAllCollectionData(query, batchSize = 20) {
  let allData = [];
  let skip = 0;

  while (true) {
    const res = await query.skip(skip).limit(batchSize).get();
    const batch = res.data || [];
    allData = allData.concat(batch);

    if (batch.length < batchSize) {
      break;
    }

    skip += batchSize;
  }

  return allData;
}

async function getTempUrls(fileIds) {
  const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)));

  if (!uniqueFileIds.length) {
    return {};
  }

  const urlMap = {};

  for (let i = 0; i < uniqueFileIds.length; i += TEMP_URL_BATCH_SIZE) {
    const fileList = uniqueFileIds.slice(i, i + TEMP_URL_BATCH_SIZE);
    const res = await wx.cloud.getTempFileURL({ fileList });

    (res.fileList || []).forEach((item) => {
      urlMap[item.fileID] = item.tempFileURL || "";
    });
  }

  return urlMap;
}

async function updateFolderImageCount(folderPath, delta) {
  if (!folderPath || !delta) {
    return;
  }

  const db = getDb();
  const now = Date.now();

  if (delta > 0) {
    const _ = db.command;
    await db.collection(FOLDERS_COLLECTION).where({
      path: folderPath,
    }).update({
      data: {
        imageCount: _.inc(delta),
        updatedAt: now,
      },
    });
    return;
  }

  const folderRes = await db.collection(FOLDERS_COLLECTION).where({
    path: folderPath,
  }).limit(1).get();
  const currentCount = Number(folderRes.data[0]?.imageCount) || 0;

  await db.collection(FOLDERS_COLLECTION).where({
    path: folderPath,
  }).update({
    data: {
      imageCount: Math.max(0, currentCount + delta),
      updatedAt: now,
    },
  });
}

async function ensureRootFolder() {
  const db = getDb();
  const query = await db.collection(FOLDERS_COLLECTION).where({
    path: ROOT_PATH,
  }).limit(1).get();

  if (query.data.length > 0) {
    return query.data[0];
  }

  const now = Date.now();
  const rootFolder = {
    name: "root",
    path: ROOT_PATH,
    parentPath: "",
    depth: 0,
    imageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(FOLDERS_COLLECTION).add({
    data: rootFolder,
  });

  return rootFolder;
}

async function createFolder(parentPath, name) {
  const db = getDb();
  const folderName = assertValidName(name, "分组名称");
  const path = joinPath(parentPath, folderName);
  const existed = await db.collection(FOLDERS_COLLECTION).where({
    path,
  }).limit(1).get();

  if (existed.data.length > 0) {
    throw new Error("该分组已存在");
  }

  const now = Date.now();
  await db.collection(FOLDERS_COLLECTION).add({
    data: {
      name: folderName,
      path,
      parentPath,
      depth: getDepth(path),
      imageCount: 0,
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function listAllFolders() {
  const db = getDb();
  const folders = await getAllCollectionData(
    db.collection(FOLDERS_COLLECTION)
      .orderBy("depth", "asc")
      .orderBy("name", "asc"),
  );

  return folders.map((folder) => ({
    ...folder,
    imageCount: Number(folder.imageCount) || 0,
    breadcrumbName: buildBreadcrumbs(folder.path)
      .map((item) => item.name)
      .join(" / "),
  }));
}

async function listFolderContent(folderPath, options = {}) {
  const db = getDb();
  const { page, pageSize, keyword, sortBy } = normalizeListOptions(options);
  const folderWhere = buildFolderWhere(db, folderPath, keyword);
  const imageWhere = buildImageWhere(db, folderPath, keyword);
  const imageSkip = (page - 1) * pageSize;

  const folderQuery = applySort(
    db.collection(FOLDERS_COLLECTION).where(folderWhere),
    getFolderSort(sortBy),
  );
  const imageBaseQuery = db.collection(IMAGES_COLLECTION).where(imageWhere);
  const imageListQuery = applySort(imageBaseQuery, getImageSort(sortBy))
    .skip(imageSkip)
    .limit(pageSize);

  const [foldersRes, folderCountRes, imagesRes, imageCountRes] = await Promise.all([
    getAllCollectionData(folderQuery, MAX_PAGE_SIZE),
    db.collection(FOLDERS_COLLECTION).where(folderWhere).count(),
    imageListQuery.get(),
    db.collection(IMAGES_COLLECTION).where(imageWhere).count(),
  ]);

  const imagesRaw = imagesRes.data || [];
  const fileIds = imagesRaw.map((item) => item.cloudFileId).filter(Boolean);
  const urlMap = await getTempUrls(fileIds);
  const folders = foldersRes.map((folder) => ({
    ...folder,
    imageCount: Number(folder.imageCount) || 0,
  }));
  const images = imagesRaw.map((item) => ({
    ...item,
    previewUrl: urlMap[item.cloudFileId] || "",
  }));
  const imageTotal = imageCountRes.total || 0;

  return {
    folders,
    images,
    pagination: {
      page,
      pageSize,
      folderTotal: folderCountRes.total || folders.length,
      imageTotal,
      imageLoaded: imageSkip + images.length,
      hasMoreImages: imageSkip + images.length < imageTotal,
    },
  };
}

async function uploadImageToCloud(filePath, folderPath, originalName, metadata = {}) {
  const sourceName = originalName || getFileName(filePath) || `${Date.now()}.jpg`;
  const fileName = assertValidName(sourceName, "图片名称", 100);
  const ext = getFileExt(fileName || filePath);
  const cloudPath = createCloudPath(folderPath, ext);
  const size = Number(metadata.size) || await getLocalFileSize(filePath);
  const uploadRes = await wx.cloud.uploadFile({
    cloudPath,
    filePath,
  });
  const db = getDb();
  const now = Date.now();

  await db.collection(IMAGES_COLLECTION).add({
    data: {
      name: fileName,
      ext,
      size,
      folderPath,
      cloudFileId: uploadRes.fileID,
      filePath: cloudPath,
      createdAt: now,
      updatedAt: now,
    },
  });
  await updateFolderImageCount(folderPath, 1);
}

async function renameImage(imageId, name) {
  const db = getDb();
  const imageRes = await db.collection(IMAGES_COLLECTION).doc(imageId).get();
  const image = imageRes.data;

  if (!image) {
    throw new Error("图片不存在");
  }

  const nextName = assertValidName(name, "图片名称", 100);
  const nextExt = hasFileExt(nextName) ? getFileExt(nextName) : image.ext;

  await db.collection(IMAGES_COLLECTION).doc(imageId).update({
    data: {
      name: nextName,
      ext: nextExt,
      updatedAt: Date.now(),
    },
  });
}

async function moveImages(imageIds, targetFolderPath) {
  const db = getDb();
  const ids = Array.from(new Set(imageIds)).filter(Boolean);

  if (!ids.length) {
    return 0;
  }

  const folderRes = await db.collection(FOLDERS_COLLECTION).where({
    path: targetFolderPath,
  }).limit(1).get();

  if (!folderRes.data.length) {
    throw new Error("目标分组不存在");
  }

  const imageDocs = await Promise.all(
    ids.map(async (imageId) => {
      try {
        const res = await db.collection(IMAGES_COLLECTION).doc(imageId).get();
        return res.data;
      } catch (error) {
        return null;
      }
    }),
  );
  const movableImages = imageDocs.filter(
    (item) => item && item.folderPath !== targetFolderPath,
  );

  if (!movableImages.length) {
    return 0;
  }

  const now = Date.now();
  await runInBatches(movableImages, (image) =>
    db.collection(IMAGES_COLLECTION).doc(image._id).update({
      data: {
        folderPath: targetFolderPath,
        updatedAt: now,
      },
    }),
  );

  const sourceCountMap = movableImages.reduce((acc, image) => {
    acc[image.folderPath] = (acc[image.folderPath] || 0) + 1;
    return acc;
  }, {});

  await Promise.all([
    ...Object.entries(sourceCountMap).map(([folderPath, count]) =>
      updateFolderImageCount(folderPath, -count),
    ),
    updateFolderImageCount(targetFolderPath, movableImages.length),
  ]);

  return movableImages.length;
}

async function renameFolder(folderPath, name) {
  if (folderPath === ROOT_PATH) {
    throw new Error("根目录不能重命名");
  }

  const db = getDb();
  const folderRes = await db.collection(FOLDERS_COLLECTION).where({
    path: folderPath,
  }).limit(1).get();
  const folder = folderRes.data[0];

  if (!folder) {
    throw new Error("分组不存在");
  }

  const folderName = assertValidName(name, "分组名称");
  const nextPath = joinPath(folder.parentPath, folderName);

  if (nextPath !== folderPath) {
    const existed = await db.collection(FOLDERS_COLLECTION).where({
      path: nextPath,
    }).limit(1).get();

    if (existed.data.length > 0) {
      throw new Error("该分组已存在");
    }
  }

  const pathRegExp = createPathRegExp(db, folderPath);
  const [folders, images] = await Promise.all([
    getAllCollectionData(
      db.collection(FOLDERS_COLLECTION).where({
        path: pathRegExp,
      }),
    ),
    getAllCollectionData(
      db.collection(IMAGES_COLLECTION).where({
        folderPath: pathRegExp,
      }),
    ),
  ]);
  const now = Date.now();
  const sortedFolders = folders.sort((a, b) => a.depth - b.depth);

  await runInBatches(sortedFolders, (item) => {
    const itemPath = replacePathPrefix(item.path, folderPath, nextPath);
    const parentPath = item.path === folderPath
      ? folder.parentPath
      : replacePathPrefix(item.parentPath, folderPath, nextPath);

    return db.collection(FOLDERS_COLLECTION).doc(item._id).update({
      data: {
        name: item.path === folderPath ? folderName : item.name,
        path: itemPath,
        parentPath,
        depth: getDepth(itemPath),
        updatedAt: now,
      },
    });
  });

  await runInBatches(images, (item) =>
    db.collection(IMAGES_COLLECTION).doc(item._id).update({
      data: {
        folderPath: replacePathPrefix(item.folderPath, folderPath, nextPath),
        updatedAt: now,
      },
    }),
  );

  return nextPath;
}

async function deleteImage(imageId, cloudFileId) {
  const db = getDb();
  let image = null;

  try {
    const imageRes = await db.collection(IMAGES_COLLECTION).doc(imageId).get();
    image = imageRes.data || null;
  } catch (error) {
    image = null;
  }

  const fileID = cloudFileId || image?.cloudFileId;
  const tasks = [db.collection(IMAGES_COLLECTION).doc(imageId).remove()];

  if (fileID) {
    tasks.unshift(wx.cloud.deleteFile({
      fileList: [fileID],
    }));
  }

  await Promise.all(tasks);

  if (image?.folderPath) {
    await updateFolderImageCount(image.folderPath, -1);
  }
}

async function deleteFolder(folderPath) {
  const db = getDb();
  const [subFolders, images] = await Promise.all([
    db.collection(FOLDERS_COLLECTION).where({
      parentPath: folderPath,
    }).limit(1).get(),
    db.collection(IMAGES_COLLECTION).where({
      folderPath,
    }).limit(1).get(),
  ]);

  if (subFolders.data.length > 0 || images.data.length > 0) {
    throw new Error("该分组不为空，无法删除");
  }

  await db.collection(FOLDERS_COLLECTION).where({
    path: folderPath,
  }).remove();
}

async function rebuildFolderImageCounts() {
  const db = getDb();
  const [folders, images] = await Promise.all([
    getAllCollectionData(db.collection(FOLDERS_COLLECTION)),
    getAllCollectionData(db.collection(IMAGES_COLLECTION)),
  ]);
  const countMap = images.reduce((acc, image) => {
    acc[image.folderPath] = (acc[image.folderPath] || 0) + 1;
    return acc;
  }, {});
  const now = Date.now();

  await runInBatches(folders, (folder) =>
    db.collection(FOLDERS_COLLECTION).doc(folder._id).update({
      data: {
        imageCount: countMap[folder.path] || 0,
        updatedAt: now,
      },
    }),
  );

  return {
    folderTotal: folders.length,
    imageTotal: images.length,
  };
}

export {
  ROOT_PATH,
  assertValidName,
  buildBreadcrumbs,
  createFolder,
  deleteFolder,
  deleteImage,
  ensureRootFolder,
  getParentPath,
  listAllFolders,
  listFolderContent,
  moveImages,
  rebuildFolderImageCounts,
  renameFolder,
  renameImage,
  uploadImageToCloud,
};
