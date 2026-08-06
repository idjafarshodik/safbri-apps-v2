let currentStep = 0;
const titles = ['Foto Working Permit', 'Foto Safety Briefing', 'Data Pekerjaan', 'Data Pelaksana'];
const images = { WP: null, SB: null };
let qrScanFails = 0;

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

const nextStep = async (targetStep) => {
  if (currentStep === 0 || validateStep(currentStep)) {
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

const setWpStatus = (state) => {
    const container = document.getElementById('wp-status-container');
    const spinner = document.getElementById('wp-status-spinner');
    const text = document.getElementById('wp-status-text');
    
    if (!container) return;
    
    container.classList.remove('hidden');
    spinner.classList.add('hidden');
    text.className = 'font-semibold text-[11px] tracking-wide'; 
    
    if (state === 'loading') {
        spinner.classList.remove('hidden');
        text.innerText = '[reading wp.. ]';
        text.classList.add('text-pln-muted'); 
    } else if (state === 'success') {
        text.innerText = 'Good! Silahkan lanjutkan';
        text.classList.add('text-green-500');
    } else if (state === 'fail') {
        text.innerText = 'Foto tidak jelas - posisikan wp dengan posisi tegak dan tidak blur.';
        text.classList.add('text-red-500');
    } else if (state === 'hidden') {
        container.classList.add('hidden');
    }
};

const triggerScanFail = () => {
    qrScanFails++;
    setWpStatus('fail');
    const btnNext = document.getElementById('btn-next-1');
    if (btnNext) btnNext.disabled = true;
    
    const manualOverride = document.getElementById('manual-override-container');
    if (qrScanFails >= 2 && manualOverride) {
        manualOverride.classList.remove('hidden');
        manualOverride.classList.add('flex');
    }
};

const scanImage = (file, type) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = async () => {
        images[type] = img;
        const initUi = document.getElementById(`init-ui-${type}`);
        if(initUi) initUi.classList.add('hidden');
        
        const preview = document.getElementById(`preview-${type}`);
        if(preview) {
            preview.src = objectUrl;
            preview.classList.remove('hidden');
        }
        
        const retakeBtn = document.getElementById(`retake-btn-${type}`);
        if(retakeBtn) retakeBtn.classList.remove('hidden');

        if (type === 'WP') {
            const container = document.getElementById('container-WP');
            if (container) {
                if (img.width <= img.height) {
                    container.classList.remove('aspect-video');
                    container.classList.add('aspect-[3/4]');
                } else {
                    container.classList.remove('aspect-[3/4]');
                    container.classList.add('aspect-video');
                }
            }

            setWpStatus('loading');

            const c = document.createElement('canvas');
            const cropY = img.height * 0.45; 
            const cropH = img.height - cropY;
            const cropW = img.width;

            const maxSafeRes = 1200; 
            let scale = 1;
            if (cropW > maxSafeRes || cropH > maxSafeRes) {
                scale = Math.min(maxSafeRes / cropW, maxSafeRes / cropH); 
            }

            c.width = Math.floor(cropW * scale);
            c.height = Math.floor(cropH * scale);
            
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 
                0, Math.floor(cropY), Math.floor(cropW), Math.floor(cropH), 
                0, 0, c.width, c.height
            );

            const base64Image = c.toDataURL('image/jpeg', 0.85);

            try {
                const res = await fetch('/api/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64Image })
                });
                
                const dataObj = await res.json();
                
                if (dataObj.status === 'success' && dataObj.data && dataObj.data.nomor_wp) {
                    ['nomor_wp', 'nama_pekerjaan', 'tim_pelaksana', 'pengawas_k3', 'pengawas_pekerjaan'].forEach(key => {
                        if (dataObj.data[key]) {
                            const el = document.getElementById(key);
                            if(el) {
                                el.value = dataObj.data[key];
                                localStorage.setItem(`safbri_${key}`, dataObj.data[key]);
                            }
                        }
                    });
                    setWpStatus('success');
                    
                    const manualOverride = document.getElementById('manual-override-container');
                    if(manualOverride) manualOverride.classList.add('hidden');
                    
                    const btnNext = document.getElementById('btn-next-1');
                    if(btnNext) btnNext.disabled = false;
                } else {
                    triggerScanFail();
                }
            } catch(err) {
                triggerScanFail();
            }

        } else if (type === 'SB') {
            const btnNext2 = document.getElementById('btn-next-2');
            if(btnNext2) btnNext2.disabled = false;
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
  
  const preview = document.getElementById(`preview-${type}`);
  if(preview) preview.classList.add('hidden');
  
  const retakeBtn = document.getElementById(`retake-btn-${type}`);
  if(retakeBtn) retakeBtn.classList.add('hidden');
  
  const initUi = document.getElementById(`init-ui-${type}`);
  if(initUi) initUi.classList.remove('hidden');
  
  if (type === 'WP') {
      const container = document.getElementById('container-WP');
      if(container) {
          container.classList.remove('aspect-[3/4]');
          container.classList.add('aspect-video');
      }
      
      const btnNext1 = document.getElementById('btn-next-1');
      if(btnNext1) btnNext1.disabled = true;
      
      const ignoreQr = document.getElementById('ignore-qr');
      if(ignoreQr) ignoreQr.checked = false;
      
      setWpStatus('hidden');
  }
  if (type === 'SB') {
      const btnNext2 = document.getElementById('btn-next-2');
      if(btnNext2) btnNext2.disabled = true;
  }
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
      btn.innerText = 'KIRIM LAPORAN';
      currentStep = 6;     
      updateUI();
    }
  } catch (error) {
    btn.disabled = false;
    btn.innerText = 'KIRIM LAPORAN';
    currentStep = 6;    
    updateUI();
  }
});