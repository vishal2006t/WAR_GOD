import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken } from "../middleware/auth";
import { computeSha256 } from "../utils/hash";
import { prisma } from "../utils/prisma";

const router = Router();

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, `${Date.now()}-${basename}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".json", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed. Supported formats: PDF, Images, CSV, JSON"));
    }
  },
});

// POST /api/evidence/upload
router.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: "No file uploaded" });
        return;
      }

      // Read buffer to compute SHA-256 hash
      const fileBuffer = fs.readFileSync(req.file.path);
      const sha256Hash = computeSha256(fileBuffer);

      const fileRecord = await prisma.evidenceFile.create({
        data: {
          fileName: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
          sha256Hash,
          filePath: `/uploads/${req.file.filename}`,
          uploadedByUserId: req.user!.id,
        },
      });

      res.status(201).json({
        success: true,
        file: fileRecord,
        sha256Hash,
        url: `/uploads/${req.file.filename}`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
