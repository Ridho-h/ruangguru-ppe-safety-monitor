# UC-03: Workplace Safety (K3) PPE Monitor (Real-Time Inference)

Proyek showcase **AI Engineer Bootcamp Ruangguru** untuk modul **Visual Models (OpenCV, YOLO), Deep Learning, & PyTorch**.

## Fitur Utama (100% Real-Time Inference)

1. **Real-Time YOLOv8n PPE di Browser (`onnxruntime-web`):**
   - Menjalankan model **YOLOv8n PPE** (`mancalazure/construction-ppe-safety`, `ppe-yolov8n.onnx` ~11.7 MB, 10 kelas: `Hardhat`, `Safety Vest`, `Mask`, `NO-Hardhat`, `NO-Safety Vest`, `NO-Mask`, `Person`, dll.) secara langsung di browser tanpa server GPU.
   - Privasi penuh: tidak ada frame kamera yang dikirim ke server.
2. **2 Sumber Live Stream (Tanpa Upload Foto/Video Statis):**
   - **Live CCTV Feed:** Video CCTV area gudang & konstruksi yang diputar *loop* sambil dianalisis *frame-by-frame* oleh model YOLOv8n ONNX secara nyata.
   - **Live Webcam / Kamera HP:** Menggunakan `getUserMedia` dengan tombol ganti kamera depan/belakang.
3. **HSE Control Room UI:**
   - Overlay bounding box Hijau (`Patuh`) & Merah (`Pelanggaran`), HUD real-time **FPS** & **Latency (ms)**, 4 KPI kepatuhan K3, toggle aturan wajib (`Helm`, `Rompi`, `Masker`), slider *Confidence*, serta **Log Pelanggaran Bertimestamp WIB** (cooldown anti-spam 3 detik + thumbnail snapshot + **Export CSV**).
4. **Materi Silabus Python (`python-yolo/`):**
   - `realtime_ppe_webcam.py`: skrip realtime **OpenCV + ONNX/YOLO** untuk webcam lokal (`--source 0`) atau RTSP CCTV.
   - `prepare_assets.py` & `tests/test_ppe_pipeline.py`: verifikasi otomatis kontrak tensor ONNX & deteksi nyata.

## Cara Menjalankan Lokal

### 1. Web App (Next.js)
```bash
cd web
npm install
npm run dev
```
Buka `http://localhost:3000`.

### 2. Materi Python (OpenCV + ONNX/YOLO)
```bash
cd python-yolo
uv run --with onnxruntime --with numpy --with opencv-python python realtime_ppe_webcam.py --source 0
uv run --with pytest --with onnxruntime --with numpy --with opencv-python-headless python -m pytest tests/test_ppe_pipeline.py -v
```
