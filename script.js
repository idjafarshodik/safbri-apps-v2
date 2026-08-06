let currentStep = 0;
const titles = ['Foto Working Permit', 'Foto Safety Briefing', 'Data Pekerjaan', 'Data Pelaksana'];
const images = { WP: null, SB: null };
let qrScanFails = 0;
let extractionPromise = null;
let extractedData = null;
let abortController = null;

if (window.QrScanner) {
    QrScanner.WORKER_PATH = 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner-worker.min.js';
}

document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
  input.addEventListener('input', (e) => {
    localStorage.setItem(`safbri_${e.target.id}`, e.target.value);
  });
});

flatpickr("#tanggal_pekerjaan", { 
  dateFormat: "d/m/Y", 
  disableMobile: true,
  onChange: function(selectedDates, dateStr) {
    localStorage.setItem('safbri_tanggal_pekerjaan', dateStr);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  ['nomor_wp', 'nama_pekerjaan', 'tanggal_pekerjaan', 'lokasi', 'tim_pelaksana', 'pengawas_k3', 'pengawas_pekerjaan', 'jumlah_pelaksana'].forEach(id => {
    const val = localStorage.getItem(`safbri_${id}`);
    if (val && document.getElementById(id)) document.getElementById(id).value = val;
  });

  document.getElementById('ignore-qr').addEventListener('change', (e) => {
      document.getElementById('btn-next-1').disabled = !e.target.checked && !images.WP;
      if (e.target.checked && images.WP) {
          document.getElementById('btn-next-1').disabled = false;
      }
  });

  updateUI();
});

const showToast = (message, isError = false) => {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.className = `fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl text-white font-bold text-sm transition-all duration-300 z-50 transform -translate-y-20 opacity-0 pointer-events-none text-center min-w-[280px] ${isError ? 'bg-red-500' : 'bg-green-500'}`;
  
  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('-translate-y-20', 'opacity-0');
  }, 3500);
};

const updateUI = () => {
  document.querySelectorAll('.step-card').forEach(el => {
    el.classList.toggle('active', el.id === `step-${currentStep}`);
  });
  
  const progressContainer = document.getElementById('progress-container');
  if (currentStep >= 1 && currentStep <= 4) {
    progressContainer.classList.remove('hidden');
    document.getElementById('current-step-indicator').innerText = currentStep;
    document.getElementById('step-title').innerText = titles[currentStep - 1];
    document.getElementById('progress-bar').style.width = `${(currentStep / 4) * 100}%`;
  } else {
    progressContainer.classList.add('hidden');
  }
};

const validateStep = (step) => {
  if (step === 1 && !images.WP) { 
    showToast("Harap ambil foto Working Permit!", true); 
    return false; 
  }
  if (step === 2 && !images.SB) { 
    showToast("Harap ambil foto Safety Briefing!", true); 
    return false; 
  }
  if (step === 3 || step === 4) {
      const inputs = document.querySelectorAll(`#step-${step} input[required]`);
      let isValid = true;
      inputs.forEach(input => {
        if (!input.value.trim()) {
          input.classList.add('border-red-500');
          isValid = false;
        } else {
          input.classList.remove('border-red-500');
        }
      });
      return isValid;
  }
  return true;
};

const fetchExtractionData = async (url) => {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    
    try {
        const response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: abortController.signal
        });
        
        if (response.ok) {
            const res = await response.json();
            const dataObj = Array.isArray(res) ? res[0] : res;
            if (dataObj && dataObj.data) extractedData = dataObj.data;
        }
    } catch (e) {
        extractedData = null;
    }
};

const nextStep = async (targetStep) => {
  if (currentStep === 0 || validateStep(currentStep)) {
      
    if (currentStep === 2 && targetStep === 3) {
        const overlay = document.getElementById('sync-overlay');
        const isManual = document.getElementById('ignore-qr').checked;
        
        if (!isManual && extractionPromise) {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            
            const timeoutPromise = new Promise(resolve => setTimeout(() => {
                if (abortController) abortController.abort();
                resolve();
            }, 15000));
            
            await Promise.race([extractionPromise, timeoutPromise]);
            
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
            
            if (extractedData) {
                ['nomor_wp', 'nama_pekerjaan', 'tim_pelaksana', 'pengawas_k3', 'pengawas_pekerjaan'].forEach(key => {
                    if (extractedData[key]) {
                        const el = document.getElementById(key);
                        if(el) {
                            el.value = extractedData[key];
                            localStorage.setItem(`safbri_${key}`, extractedData[key]);
                        }
                    }
                });
                showToast("Data berhasil diekstrak.");
            } else {
                showToast("Sinyal lambat, silakan lengkapi manual.", true);
            }
        }
    }
      
    currentStep = targetStep;
    updateUI();
  } else {
    showToast("Harap lengkapi data yang diwajibkan.", true);
  }
};

const prevStep = (targetStep) => {
  currentStep = targetStep;
  updateUI();
};

const triggerScanFail = () => {
    qrScanFails++;
    document.getElementById('qr-error-msg').classList.remove('hidden');
    document.getElementById('btn-next-1').disabled = true;
    if (qrScanFails >= 2) {
        document.getElementById('manual-override-container').classList.remove('hidden');
        document.getElementById('manual-override-container').classList.add('flex');
    }
};

const scanImage = (file, type) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = async () => {
        images[type] = img;
        let decodedText = null;

        document.getElementById(`init-ui-${type}`).classList.add('hidden');
        const preview = document.getElementById(`preview-${type}`);
        preview.src = objectUrl;
        preview.classList.remove('hidden');
        document.getElementById(`retake-btn-${type}`).classList.remove('hidden');

        if (type === 'WP') {
            const container = document.getElementById('container-WP');
            if (img.width <= img.height) {
                container.classList.remove('aspect-video');
                container.classList.add('aspect-[3/4]');
            } else {
                container.classList.remove('aspect-[3/4]');
                container.classList.add('aspect-video');
            }

            if ('BarcodeDetector' in window) {
                try {
                    const detector = new BarcodeDetector({ formats: ['qr_code'] });
                    const barcodes = await detector.detect(img);
                    if (barcodes.length > 0) decodedText = barcodes[0].rawValue;
                } catch(err) {}
            }

            if (!decodedText && window.QrScanner) {
                console.log(`[DEBUG] Lapis 2: Eksekusi Hybrid (Potong Bawah + OpenCV Binarization + Nimiq)`);

                const c = document.createElement('canvas');
                
                // 1. Ambil 55% bagian bawah (Zona pasti QR PLN)
                const cropY = img.height * 0.45; 
                const cropH = img.height - cropY;
                const cropW = img.width;

                // 2. Proteksi Resolusi & Zoom 2x (Ide Japp)
                const maxSafeRes = 1400; // Batas aman RAM HP
                let scale = 2; // Default Zoom 2x

                // Cegah HP Crash jika foto dari galeri berukuran 4000px
                if ((cropW * scale) > maxSafeRes || (cropH * scale) > maxSafeRes) {
                    scale = Math.min(maxSafeRes / cropW, maxSafeRes / cropH); 
                }

                c.width = Math.floor(cropW * scale);
                c.height = Math.floor(cropH * scale);
                console.log(`[DEBUG] Dimensi Canvas Potong & Zoom: ${c.width} x ${c.height}`);

                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 
                    0, Math.floor(cropY), Math.floor(cropW), Math.floor(cropH), 
                    0, 0, c.width, c.height
                );

                // 3. Proses "Cuci Cetak" menggunakan OpenCV
                if (typeof cv !== 'undefined' && cv.Mat) {
                    try {
                        console.log(`[DEBUG] OpenCV Aktif: Memulai Grayscale & Adaptive Threshold...`);
                        let src = cv.imread(c);
                        let dst = new cv.Mat();

                        // Ubah ke Abu-abu
                        cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
                        
                        // Buang noise bintik kamera (Blur Tipis)
                        let ksize = new cv.Size(3, 3);
                        cv.GaussianBlur(dst, dst, ksize, 0, 0, cv.BORDER_DEFAULT);

                        // Binarization: Ubah piksel bayangan/blur jadi Hitam-Putih mutlak
                        cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);

                        // Render kembali ke Canvas
                        cv.imshow(c, dst);

                        // WAJIB CLEAR RAM (Mencegah Memory Leak)
                        src.delete();
                        dst.delete();
                        console.log(`[DEBUG] OpenCV Selesai. Gambar di-binarize sempurna.`);
                    } catch (cvErr) {
                        console.error(`[DEBUG] OpenCV Error (Menggunakan canvas normal):`, cvErr);
                    }
                } else {
                    console.warn(`[DEBUG] OpenCV belum terload. Lanjut tanpa Binarization.`);
                }

                // 4. Lakukan Scan pada kanvas yang sudah super tajam
                try {
                    const result = await QrScanner.scanImage(c, { returnDetailedScanResult: true });
                    if (result && result.data) {
                        decodedText = result.data;
                        console.log(`[DEBUG] Lapis 2 SUKSES! Hasil: ${decodedText}`);
                    }
                } catch (err) {
                    console.warn(`[DEBUG] Lapis 2 GAGAL. Pesan:`, err);
                }
            }

            if (decodedText && decodedText.includes('hsse.pln.co.id')) {
                document.getElementById('qr-error-msg').classList.add('hidden');
                document.getElementById('manual-override-container').classList.add('hidden');
                document.getElementById('btn-next-1').disabled = false;
                
                extractedData = null;
                extractionPromise = fetchExtractionData(decodedText);
                nextStep(2);
            } else {
                triggerScanFail();
            }
        } else if (type === 'SB') {
            document.getElementById('btn-next-2').disabled = false;
        }
    };
    img.src = objectUrl;
};

const handleFile = (input, type) => {
  if (input.files && input.files[0]) {
      scanImage(input.files[0], type);
  }
  input.value = '';
};

const resetMedia = (type) => {
  if (images[type]) {
      URL.revokeObjectURL(images[type].src);
  }
  images[type] = null;
  document.getElementById(`preview-${type}`).classList.add('hidden');
  document.getElementById(`retake-btn-${type}`).classList.add('hidden');
  document.getElementById(`init-ui-${type}`).classList.remove('hidden');
  
  if (type === 'WP') {
      const container = document.getElementById('container-WP');
      container.classList.remove('aspect-[3/4]');
      container.classList.add('aspect-video');
      
      document.getElementById('btn-next-1').disabled = true;
      document.getElementById('ignore-qr').checked = false;
  }
  if (type === 'SB') {
      document.getElementById('btn-next-2').disabled = true;
  }
};

const startNewReport = () => {
  localStorage.clear();
  document.getElementById('safetyForm').reset();
  resetMedia('WP');
  resetMedia('SB');
  
  qrScanFails = 0;
  extractedData = null;
  extractionPromise = null;
  document.getElementById('qr-error-msg').classList.add('hidden');
  document.getElementById('manual-override-container').classList.add('hidden');
  document.getElementById('manual-override-container').classList.remove('flex');
  
  const btn = document.getElementById('submitBtn');
  btn.disabled = false;
  btn.innerText = 'KIRIM LAPORAN ✔';
  
  currentStep = 0;
  updateUI();
};

const generateCollageAndResize = async () => {
    const processImage = (imgObj, targetMax) => {
        const canvas = document.createElement('canvas');
        let w = imgObj.width;
        let h = imgObj.height;
        
        if (w > h) {
            if (w > targetMax) { h = Math.round(h * targetMax / w); w = targetMax; }
        } else {
            if (h > targetMax) { w = Math.round(w * targetMax / h); h = targetMax; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgObj, 0, 0, w, h);
        return canvas;
    };

    const wpCanvas = processImage(images.WP, 1200);
    const sbCanvas = processImage(images.SB, 1200);

    const finalCanvas = document.createElement('canvas');
    const ctx = finalCanvas.getContext('2d');
    
    const isPortraitSB = images.SB.width <= images.SB.height;
    const isPortraitWP = images.WP.width <= images.WP.height;
    
    const gap = 32; 

    if (isPortraitSB && isPortraitWP) {
        const targetWidth = 1200;
        const hSB = (sbCanvas.height / sbCanvas.width) * targetWidth;
        const hWP = (wpCanvas.height / wpCanvas.width) * targetWidth;
        const innerHeight = Math.max(hSB, hWP);

        finalCanvas.width = (targetWidth * 2) + (gap * 3);
        finalCanvas.height = innerHeight + (gap * 2);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    
        ctx.drawImage(sbCanvas, gap, gap + (innerHeight - hSB) / 2, targetWidth, hSB);
        ctx.drawImage(wpCanvas, (gap * 2) + targetWidth, gap + (innerHeight - hWP) / 2, targetWidth, hWP);
    } else {
        const targetWidth = 1600;
        const hSB = (sbCanvas.height / sbCanvas.width) * targetWidth;
        const hWP = (wpCanvas.height / wpCanvas.width) * targetWidth;
        
        finalCanvas.width = targetWidth + (gap * 2);
        finalCanvas.height = hSB + hWP + (gap * 3);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        ctx.drawImage(sbCanvas, gap, gap, targetWidth, hSB);
        ctx.drawImage(wpCanvas, gap, (gap * 2) + hSB, targetWidth, hWP);
    }

    return finalCanvas.toDataURL('image/jpeg', 0.85);
};

document.getElementById('safetyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!images.SB) { 
    showToast("Harap ambil foto Safety Briefing!", true); 
    return; 
  }
  
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerText = 'MENGIRIM...';

  try {
    const finalCollageBase64 = await generateCollageAndResize();
      
    const payload = {
      nama_pekerjaan: document.getElementById('nama_pekerjaan').value,
      tanggal_pekerjaan: document.getElementById('tanggal_pekerjaan').value,
      lokasi: document.getElementById('lokasi').value,
      tim_pelaksana: document.getElementById('tim_pelaksana').value,
      pengawas_k3: document.getElementById('pengawas_k3').value,
      pengawas_pekerjaan: document.getElementById('pengawas_pekerjaan').value,
      jumlah_pelaksana: document.getElementById('jumlah_pelaksana').value,
      foto_collage: finalCollageBase64
    };
    
    let optionalWp = document.getElementById('nomor_wp');
    if(optionalWp && optionalWp.value) {
        payload.nomor_wp = optionalWp.value;
    }

    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      localStorage.clear(); 
      currentStep = 5;    
      updateUI(); 
    } else {
      btn.disabled = false;
      btn.innerText = 'KIRIM LAPORAN ✔';
      currentStep = 6;     
      updateUI();
    }
  } catch (error) {
    btn.disabled = false;
    btn.innerText = 'KIRIM LAPORAN ✔';
    currentStep = 6;    
    updateUI();
  }
});