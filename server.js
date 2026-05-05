/**
 * ============================================
 * iMissPDF Smart System - Node.js Backend
 * PDF Processing via iLovePDF REST API
 * ============================================
 */

// ===== Load Environment Variables =====
require('dotenv').config();

// ===== Dependencies =====
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const AdmZip = require('adm-zip');

// ===== Initialize Express =====
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// ===== iLovePDF API Configuration =====
const ILOVEPDF_PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY;
const ILOVEPDF_SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY;
const ILOVEPDF_API_BASE = 'https://api.ilovepdf.com/v1';

// ===== Multer Setup (File Upload) =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload PDF, JPG, PNG, or DOCX files.'));
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// ===== Helper: Count ranges =====
function countRanges(rangesStr) {
    if (!rangesStr) return 1;
    return rangesStr.split(',').length;
}

// ===== Helper: Get iLovePDF Auth Token =====
async function getAuthToken() {
    try {
        const response = await axios.post(ILOVEPDF_API_BASE + '/auth', {
            public_key: ILOVEPDF_PUBLIC_KEY
        });
        return response.data.token;
    } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with iLovePDF API');
    }
}

// ===== Helper: Start a Task =====
async function startTask(token, tool) {
    try {
        const response = await axios.get(ILOVEPDF_API_BASE + '/start/' + tool, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        return {
            server: response.data.server,
            taskId: response.data.task
        };
    } catch (error) {
        console.error('Start task error:', error.response?.data || error.message);
        throw new Error('Failed to start PDF task');
    }
}

// ===== Helper: Upload File to Task =====
async function uploadFile(token, taskServer, taskId, filePath) {
    try {
        const form = new FormData();
        form.append('task', taskId);
        form.append('file', fs.createReadStream(filePath));

        const response = await axios.post(
            'https://' + taskServer + '/v1/upload',
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': 'Bearer ' + token
                }
            }
        );
        return response.data.server_filename;
    } catch (error) {
        console.error('Upload error:', error.response?.data || error.message);
        throw new Error('Failed to upload file');
    }
}

// ===== Helper: Process Task =====
async function processTask(token, taskServer, taskId, tool, options = {}) {
    try {
        const payload = {
            task: taskId,
            tool: tool
        };

        if (options.serverFilenames && options.serverFilenames.length > 0) {
            payload.files = options.serverFilenames.map(name => ({
                server_filename: name,
                filename: name
            }));
        }

        if (tool === 'split') {
            if (options.split_mode === 'ranges') {
                payload.split_mode = 'ranges';
                payload.ranges = options.ranges || '1';
                const numRanges = countRanges(options.ranges || '1');
                if (numRanges <= 1) {
                    payload.merge_after = true;
                } else if (options.merge_after === 'true' || options.merge_after === true) {
                    payload.merge_after = true;
                }
            } else if (options.split_mode === 'fixed') {
                payload.split_mode = 'fixed_range';
                payload.fixed_range = parseInt(options.fixed_range) || 1;
            } else if (options.ranges) {
                payload.split_mode = 'ranges';
                payload.ranges = options.ranges;
                const numRanges = countRanges(options.ranges);
                if (numRanges <= 1) {
                    payload.merge_after = true;
                } else if (options.merge_after === 'true' || options.merge_after === true) {
                    payload.merge_after = true;
                }
            } else if (options.fixed_range) {
                payload.split_mode = 'fixed_range';
                payload.fixed_range = parseInt(options.fixed_range) || 1;
            } else {
                payload.split_mode = 'fixed_range';
                payload.fixed_range = 1;
            }
        }

        if (tool === 'compress' && options.compression_level) {
            payload.compression_level = options.compression_level;
        }

        if (tool === 'imagepdf') {
            payload.orientation = options.orientation || 'portrait';
            payload.margin = options.margin || 0;
            payload.pagesize = options.pagesize || 'fit';
            payload.merge_after = true;
        }

        if (tool === 'pdfjpg') {
            payload.pdfjpg_mode = options.pdfjpg_mode || 'pages';
        }

        if (tool === 'watermark') {
    payload.mode = options.mode || 'text';
    payload.text = options.text || 'CONFIDENTIAL';
    payload.pages = options.pages || 'all';

    payload.vertical_position = options.vertical_position || 'middle';
    payload.horizontal_position = options.horizontal_position || 'center';

    payload.font_family = options.font_family || 'Arial';
    payload.font_size = parseInt(options.font_size) || 40;
    payload.font_color = options.font_color || '#ff0000';

    payload.transparency = parseInt(options.transparency) || 50;
    payload.rotation = parseInt(options.rotation) || 45;

    payload.mosaic = options.mosaic === false;
    payload.layer = options.layer || 'above';
}

        if (tool === 'protect' && options.password) {
            payload.password = options.password;
        }

        if (tool === 'unlock' && options.password) {
            payload.password = options.password;
        }

        if (tool === 'rotate') {
    // iLovePDF requires rotation on each file, not as a top-level parameter
    if (payload.files && payload.files.length > 0) {
        payload.files = payload.files.map(f => ({
            ...f,
            rotate: parseInt(options.rotation) || 90
        }));
    }
}

        console.log('Process payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(
            'https://' + taskServer + '/v1/process',
            payload,
            {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Process error:', JSON.stringify(error.response?.data, null, 2));
        throw new Error('Failed to process PDF task');
    }
}

// ===== Helper: Download Result =====
async function downloadFile(token, taskServer, taskId, outputPath) {
    try {
        const response = await axios.get(
            'https://' + taskServer + '/v1/download/' + taskId,
            {
                headers: { 'Authorization': 'Bearer ' + token },
                responseType: 'arraybuffer'
            }
        );

        if (!response.data || response.data.byteLength === 0) {
            throw new Error('Downloaded file is empty');
        }

        const buffer = Buffer.from(response.data);
        fs.writeFileSync(outputPath, buffer);
        
        const stats = fs.statSync(outputPath);
        console.log(`Downloaded: ${path.basename(outputPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
        
        if (buffer.length > 4) {
            const signature4 = buffer.toString('hex', 0, 4);
            if (signature4 === '504b0304') {
                console.log('  → Valid ZIP file detected');
            } else if (signature4 === '25504446') {
                console.log('  → Valid PDF file detected');
            } else if (signature4 === 'ffd8ffe0' || signature4 === 'ffd8ffe1') {
                console.log('  → Valid JPG image detected');
            } else if (signature4 === '89504e47') {
                console.log('  → Valid PNG image detected');
            } else {
                console.log(`  → Signature: ${signature4}`);
            }
        }
        
        return { size: stats.size, buffer };
    } catch (error) {
        console.error('Download error:', error.response?.data || error.message);
        throw new Error('Failed to download processed file');
    }
}

// ===== Helper: Clean up uploaded files =====
function cleanupFiles(files) {
    files.forEach(file => {
        if (file && fs.existsSync(file)) {
            try { fs.unlinkSync(file); } catch (e) {}
        }
    });
}

// ===== Main PDF Processing Function =====
async function handlePdfTask(req, res, tool, outputPrefix, options = {}) {
    const uploadedFiles = [];
    let token, outputFilename, outputPath, fileSize, fileBuffer;

    try {
        const files = req.files ? (Array.isArray(req.files) ? req.files : [req.files]) : [];
        const file = req.file;

        if (file) uploadedFiles.push(file.path);
        if (files.length > 0) files.forEach(f => uploadedFiles.push(f.path));

        if (uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please upload at least one file.'
            });
        }

        token = await getAuthToken();
        const { server, taskId } = await startTask(token, tool);

        const serverFilenames = [];
        for (const filePath of uploadedFiles) {
            const serverFilename = await uploadFile(token, server, taskId, filePath);
            serverFilenames.push(serverFilename);
        }

        await processTask(token, server, taskId, tool, { ...options, serverFilenames });

        const downloadDir = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        // Determine if this will be a single PDF or ZIP
        let isSinglePdf = true;
        
        if (tool === 'split') {
            const numRanges = countRanges(options.ranges || '1');
            const mergeRequested = options.merge_after === 'true' || options.merge_after === true;
            
            if (options.split_mode === 'fixed' || options.fixed_range) {
                isSinglePdf = false;
            } else if (options.split_mode === 'ranges' || options.ranges) {
                if (numRanges <= 1) {
                    isSinglePdf = true;
                } else if (mergeRequested) {
                    isSinglePdf = true;
                } else {
                    isSinglePdf = false;
                }
            }
        } else if (tool === 'pdfjpg') {
            isSinglePdf = false;
        }

        // Get original filename
        const originalFile = file || (files.length > 0 ? files[0] : null);
        let originalName = 'document';
        if (originalFile && originalFile.originalname) {
            originalName = path.basename(originalFile.originalname, path.extname(originalFile.originalname));
            originalName = originalName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'document';
        }
        
        // Build clean filename
        if (tool === 'split') {
            if (options.ranges) {
                const numRanges = countRanges(options.ranges || '1');
                if (numRanges <= 1) {
                    outputFilename = `${originalName}_split.pdf`;
                } else if (isSinglePdf) {
                    outputFilename = `${originalName}_split_merged.pdf`;
                } else {
                    outputFilename = `${originalName}_split.zip`;
                }
            } else {
                outputFilename = `${originalName}_split.zip`;
            }
        } else if (tool === 'compress') {
            outputFilename = `${originalName}_compressed.pdf`;
        } else if (tool === 'pdfjpg') {
            outputFilename = `${originalName}_to_jpg`;
        } else if (tool === 'imagepdf') {
            outputFilename = `${originalName}_to_pdf.pdf`;
        } else if (tool === 'watermark') {
            outputFilename = `${originalName}_watermarked.pdf`;
        } else if (tool === 'protect') {
            outputFilename = `${originalName}_protected.pdf`;
        } else if (tool === 'unlock') {
            outputFilename = `${originalName}_unlocked.pdf`;
        } else if (tool === 'rotate') {
            outputFilename = `${originalName}_rotated.pdf`;
        } else if (tool === 'repair') {
            outputFilename = `${originalName}_repaired.pdf`;
        } else if (tool === 'merge') {
            outputFilename = `merged_document.pdf`;
        } else {
            outputFilename = `${originalName}_processed${isSinglePdf ? '.pdf' : '.zip'}`;
        }
        
        outputFilename = outputFilename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
        
        // For pdfjpg, add temporary .zip extension
        if (tool === 'pdfjpg') {
            outputFilename += '.zip';
        }
        
        outputPath = path.join(downloadDir, outputFilename);
        const downloadResult = await downloadFile(token, server, taskId, outputPath);
        fileSize = downloadResult.size;
        fileBuffer = downloadResult.buffer;

        if (fileSize < 100) {
            throw new Error('Downloaded file is too small or empty (' + fileSize + ' bytes)');
        }

        const actualSignature4 = fileBuffer.toString('hex', 0, 4).toLowerCase();
        const isActuallyPdf = actualSignature4 === '25504446';
        const isActuallyZip = actualSignature4 === '504b0304';
        const isActuallyJpg = actualSignature4.startsWith('ffd8');

        // ===== STEP 1: Fix wrong extensions =====
        if (isActuallyPdf && outputFilename.endsWith('.zip')) {
            outputFilename = outputFilename.replace('.zip', '.pdf');
            const newPath = outputPath.replace('.zip', '.pdf');
            fs.renameSync(outputPath, newPath);
            outputPath = newPath;
            console.log('  → Fixed: File is actually PDF, renamed to .pdf');
        } else if (isActuallyZip && outputFilename.endsWith('.pdf')) {
            outputFilename = outputFilename.replace('.pdf', '.zip');
            const newPath = outputPath.replace('.pdf', '.zip');
            fs.renameSync(outputPath, newPath);
            outputPath = newPath;
            console.log('  → Fixed: File is actually ZIP, renamed to .zip');
        }

        // ===== STEP 2: Handle PDF to JPG =====
        if (tool === 'pdfjpg' && outputFilename.endsWith('.zip')) {
            if (isActuallyJpg && !isActuallyZip) {
                // The API returned a raw JPG — rename it
                const jpgFilename = outputFilename.replace('.zip', '.jpg');
                const jpgPath = outputPath.replace('.zip', '.jpg');
                fs.renameSync(outputPath, jpgPath);
                outputFilename = jpgFilename;
                outputPath = jpgPath;
                console.log('  → Single JPG detected, renamed to .jpg');
            } else if (isActuallyZip) {
                // It's a real ZIP — try to extract single file
                try {
                    const zip = new AdmZip(outputPath);
                    const entries = zip.getEntries();
                    
                    if (entries.length === 1) {
                        const jpgData = entries[0].getData();
                        const jpgFilename = outputFilename.replace('.zip', '.jpg');
                        const jpgPath = outputPath.replace('.zip', '.jpg');
                        fs.writeFileSync(jpgPath, jpgData);
                        fs.unlinkSync(outputPath);
                        
                        outputFilename = jpgFilename;
                        outputPath = jpgPath;
                        fileSize = jpgData.length;
                        fileBuffer = jpgData;
                        console.log('  → Single JPG extracted from ZIP, saved as .jpg');
                    } else {
                        const newZip = new AdmZip();
                        entries.forEach((entry, index) => {
                            const ext = path.extname(entry.entryName) || '.jpg';
                            const newName = `iMissPDF_${originalName}_page_${index + 1}${ext}`;
                            newZip.addFile(newName, entry.getData());
                        });
                        newZip.writeZip(outputPath);
                        console.log(`  → ${entries.length} files in ZIP, kept as ZIP`);
                    }
                } catch (e) {
                    console.log('  → ZIP extraction failed, keeping as ZIP');
                }
            }
        }

        // ===== STEP 3: Handle Split ZIP rename =====
        if (tool === 'split' && outputFilename.endsWith('.zip')) {
            try {
                const zip = new AdmZip(outputPath);
                const entries = zip.getEntries();
                const ranges = (options.ranges || '1').split(',');
                const newZip = new AdmZip();
                entries.forEach((entry, index) => {
                    const rangeName = ranges[index] || `part_${index + 1}`;
                    const cleanRange = rangeName.replace(/[^0-9\-]/g, '');
                    const newName = `iMissPDF_split_${originalName}_${cleanRange}.pdf`;
                    newZip.addFile(newName, entry.getData());
                });
                newZip.writeZip(outputPath);
                console.log('  → Internal ZIP files renamed');
            } catch (e) {
                console.log('  → Could not rename internal files');
            }
        }

        // ===== STEP 4: Send file =====
        let contentType;
        if (outputFilename.endsWith('.zip')) {
            contentType = 'application/zip';
        } else if (outputFilename.endsWith('.jpg') || outputFilename.endsWith('.jpeg')) {
            contentType = 'image/jpeg';
        } else {
            contentType = 'application/pdf';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
        res.setHeader('Content-Length', fileSize);
        
        const finalBuffer = fs.readFileSync(outputPath);
        res.send(finalBuffer);
        
        setTimeout(() => {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        }, 60000);

    } catch (error) {
        console.error('Task error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'PDF processing failed'
        });
    } finally {
        cleanupFiles(uploadedFiles);
    }
}

// ============================================
//  PDF TOOLS API ROUTES
// ============================================

app.post('/api/merge', upload.array('files', 25), async (req, res) => {
    await handlePdfTask(req, res, 'merge', 'merged');
});

app.post('/api/split', upload.single('file'), async (req, res) => {
    const options = {};
    if (req.body.split_mode) options.split_mode = req.body.split_mode;
    if (req.body.ranges) options.ranges = req.body.ranges;
    if (req.body.fixed_range) options.fixed_range = parseInt(req.body.fixed_range);
    if (req.body.merge_after) options.merge_after = req.body.merge_after;
    await handlePdfTask(req, res, 'split', 'split', options);
});

app.post('/api/compress', upload.single('file'), async (req, res) => {
    const options = {};
    if (req.body.compression_level) options.compression_level = req.body.compression_level;
    await handlePdfTask(req, res, 'compress', 'compressed', options);
});

app.post('/api/jpg-to-pdf', upload.array('files', 25), async (req, res) => {
    const options = {};
    if (req.body.orientation) options.orientation = req.body.orientation;
    if (req.body.margin) options.margin = parseInt(req.body.margin);
    await handlePdfTask(req, res, 'imagepdf', 'jpg-to-pdf', options);
});

app.post('/api/pdf-to-jpg', upload.single('file'), async (req, res) => {
    const options = {};
    if (req.body.pdfjpg_mode) options.pdfjpg_mode = req.body.pdfjpg_mode;
    if (req.body.jpeg_quality) options.jpeg_quality = req.body.jpeg_quality;
    await handlePdfTask(req, res, 'pdfjpg', 'pdf-to-jpg', options);
});

app.post('/api/watermark', upload.single('file'), async (req, res) => {
    const options = {
        mode: 'text',
        text: req.body.text || 'CONFIDENTIAL',
        pages: req.body.pages || 'all',
        vertical_position: req.body.vertical_position || 'middle',
        horizontal_position: req.body.horizontal_position || 'center',
        font_size: parseInt(req.body.font_size) || 40,
        font_color: req.body.font_color || '#000000',
        font_family: req.body.font_family || 'Arial',
        transparency: parseInt(req.body.transparency) || 50,
        rotation: parseInt(req.body.rotation) || 45,
        mosaic: req.body.mosaic === 'true',
        layer: req.body.layer || 'above'
    };

    await handlePdfTask(req, res, 'watermark', 'watermarked', options);
});

app.post('/api/unlock', upload.single('file'), async (req, res) => {
    const options = {};
    if (req.body.password) options.password = req.body.password;
    await handlePdfTask(req, res, 'unlock', 'unlocked', options);
});

app.post('/api/protect', upload.single('file'), async (req, res) => {
    const options = { password: req.body.password || '123456' };
    await handlePdfTask(req, res, 'protect', 'protected', options);
});

app.post('/api/rotate', upload.single('file'), async (req, res) => {
    const options = { rotation: parseInt(req.body.rotation) || 90 };
    await handlePdfTask(req, res, 'rotate', 'rotated', options);
});

app.post('/api/repair', upload.single('file'), async (req, res) => {
    await handlePdfTask(req, res, 'repair', 'repaired');
});

// ============================================
//  SERVER & PAGES
// ============================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/tools', (req, res) => res.sendFile(path.join(__dirname, 'tools.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

app.get('/tools/merge', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'merge.html')));
app.get('/tools/split', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'split.html')));
app.get('/tools/compress', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'compress.html')));
app.get('/tools/jpg-to-pdf', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'jpg-to-pdf.html')));
app.get('/tools/pdf-to-jpg', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'pdf-to-jpg.html')));
app.get('/tools/watermark', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'watermark.html')));
app.get('/tools/unlock', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'unlock.html')));
app.get('/tools/protect', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'protect.html')));
app.get('/tools/rotate', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'rotate.html')));
app.get('/tools/repair', (req, res) => res.sendFile(path.join(__dirname, 'tools', 'repair.html')));

app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   iMissPDF Smart System Server          ║`);
    console.log(`║   Running on: http://localhost:${PORT}      ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
});