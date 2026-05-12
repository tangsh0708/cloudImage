const ROOT_PATH = "/root";
const FOLDERS_COLLECTION = "folders";
const IMAGES_COLLECTION = "images";

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

function safeFolderName(name) {
	return String(name || "")
		.trim()
		.replace(/[\\/]+/g, "-")
		.replace(/\s+/g, " ");
}

function joinPath(parentPath, folderName) {
	if (parentPath === ROOT_PATH) {
		return `${ROOT_PATH}/${folderName}`;
	}
	return `${parentPath}/${folderName}`;
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

function getFileExt(filePath) {
	const i = filePath.lastIndexOf(".");
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

async function ensureRootFolder() {
	const db = getDb();
	const query = await db.collection(FOLDERS_COLLECTION).where({
		path: ROOT_PATH,
	}).limit(1).get();
	if (query.data.length > 0) {
		return query.data[0];
	}
	const now = Date.now();
	await db.collection(FOLDERS_COLLECTION).add({
		data: {
			name: "root",
			path: ROOT_PATH,
			parentPath: "",
			depth: 0,
			createdAt: now,
			updatedAt: now,
		},
	});
	return {
		name: "root",
		path: ROOT_PATH,
		parentPath: "",
		depth: 0,
		createdAt: now,
		updatedAt: now,
	};
}

async function createFolder(parentPath, name) {
	const db = getDb();
	const folderName = safeFolderName(name);
	if (!folderName) {
		throw new Error("分组名称不能为空");
	}
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
			createdAt: now,
			updatedAt: now,
		},
	});
}

async function getTempUrls(fileIds) {
	if (!fileIds.length) {
		return {};
	}
	const res = await wx.cloud.getTempFileURL({
		fileList: fileIds,
	});
	return res.fileList.reduce((acc, item) => {
		acc[item.fileID] = item.tempFileURL || "";
		return acc;
	}, {});
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

async function listFolderContent(folderPath) {
	const db = getDb();
	const [foldersRes, imagesRes] = await Promise.all([
		getAllCollectionData(
			db.collection(FOLDERS_COLLECTION).where({
				parentPath: folderPath,
			}).orderBy("name", "asc"),
		),
		getAllCollectionData(
			db.collection(IMAGES_COLLECTION).where({
				folderPath,
			}).orderBy("createdAt", "desc"),
		),
	]);

	// 统计每个文件夹的图片数量
	const folderPaths = foldersRes.map(f => f.path);
	const imageCounts = {};
	if (folderPaths.length > 0) {
		const countPromises = folderPaths.map(async (path) => {
			const count = await db.collection(IMAGES_COLLECTION).where({
				folderPath: path,
			}).count();
			return { path, count: count.total || 0 };
		});
		const counts = await Promise.all(countPromises);
		counts.forEach(({ path, count }) => {
			imageCounts[path] = count;
		});
	}

	const folders = foldersRes.map(folder => ({
		...folder,
		imageCount: imageCounts[folder.path] || 0,
	}));

	const fileIds = imagesRes.map((item) => item.cloudFileId).filter(Boolean);
	const urlMap = await getTempUrls(fileIds);
	const images = imagesRes.map((item) => ({
		...item,
		previewUrl: urlMap[item.cloudFileId] || "",
	}));
	return {
		folders,
		images,
	};
}

async function uploadImageToCloud(filePath, folderPath, originalName) {
	const ext = getFileExt(filePath);
	const cloudPath = createCloudPath(folderPath, ext);
	const uploadRes = await wx.cloud.uploadFile({
		cloudPath,
		filePath,
	});
	const db = getDb();
	const fileName = originalName || filePath.split("/").pop() || `${Date.now()}.${ext}`;
	await db.collection(IMAGES_COLLECTION).add({
		data: {
			name: fileName,
			ext,
			size: 0,
			folderPath,
			cloudFileId: uploadRes.fileID,
			filePath: cloudPath,
			createdAt: Date.now(),
		},
	});
}

async function deleteImage(imageId, cloudFileId) {
	const db = getDb();
	await Promise.all([
		wx.cloud.deleteFile({
			fileList: [cloudFileId],
		}),
		db.collection(IMAGES_COLLECTION).doc(imageId).remove(),
	]);
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

export {
	ROOT_PATH,
	buildBreadcrumbs,
	createFolder,
	deleteFolder,
	deleteImage,
	ensureRootFolder,
	getParentPath,
	listFolderContent,
	uploadImageToCloud,
};
