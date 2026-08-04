let currentStep = 0; // Mulai dari Step 0 (Welcome Page)
const titles = ['Data Pekerjaan', 'Data Pelaksana', 'Foto Working Permit', 'Foto Safety Briefing'];
const images = { WP: null, SB: null };

// Integrasi Local Storage untuk Input Teks/Tanggal
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

// Pemulihan Data (Load dari Local Storage)
window.addEventListener('DOMContentLoaded', () => {
  ['nama_pekerjaan', 'tanggal_pekerjaan', 'lokasi', 'tim_pelaksana', 'pengawas_k3', 'pengawas_pekerjaan', 'jumlah_pelaksana'].forEach(id => {
    const val = localStorage.getItem(`safbri_${id}`);
    if (val) document.getElementById(id).value = val;
  });

  ['WP', 'SB'].forEach(type => {
    const base64 = localStorage.getItem(`safbri_img_${type}`);
    if (base64) {
      const img = new Image();
      img.onload = () => {
        images[type] = img;
        document.getElementById(`init-ui-${type}`).classList.add('hidden');
        const preview = document.getElementById(`preview-${type}`);
        preview.src = base64;
        preview.classList.remove('hidden');
        document.getElementById(`retake-btn-${type}`).classList.remove('hidden');
      };
      img.src = base64;
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
  
  if (step === 3 && !images.WP) { 
    showToast("Harap ambil foto Working Permit!", true); 
    return false; 
  }
  return isValid;
};

const nextStep = (targetStep) => {
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

// Fungsi Pintar: Resize/Kompresi sebelum masuk memory agar HP tidak crash
const resizeImage = (img, maxWidth, maxHeight) => {
  const canvas = document.createElement('canvas');
  let width = img.width;
  let height = img.height;
  if (width > height) {
    if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
  } else {
    if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
  }
  canvas.width = width; 
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85); 
};

const handleFile = (input, type) => {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Kompres gambar maksimum 1200px sebelum disimpan ke lokal
        const base64Compressed = resizeImage(img, 1200, 1200);
        localStorage.setItem(`safbri_img_${type}`, base64Compressed);
        
        const finalImg = new Image();
        finalImg.onload = () => {
          images[type] = finalImg;
          document.getElementById(`init-ui-${type}`).classList.add('hidden');
          const preview = document.getElementById(`preview-${type}`);
          preview.src = base64Compressed;
          preview.classList.remove('hidden');
          document.getElementById(`retake-btn-${type}`).classList.remove('hidden');
        };
        finalImg.src = base64Compressed;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
  input.value = '';
};

const resetMedia = (type) => {
  images[type] = null;
  localStorage.removeItem(`safbri_img_${type}`);
  document.getElementById(`preview-${type}`).classList.add('hidden');
  document.getElementById(`retake-btn-${type}`).classList.add('hidden');
  document.getElementById(`init-ui-${type}`).classList.remove('hidden');
};

const startNewReport = () => {
  localStorage.clear();
  document.getElementById('safetyForm').reset();
  resetMedia('WP');
  resetMedia('SB');
  
  const btn = document.getElementById('submitBtn');
  btn.disabled = false;
  btn.innerText = 'KIRIM LAPORAN ✔';
  
  currentStep = 1;
  updateUI();
};

const generateCollage = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const isPortraitSB = images.SB.width <= images.SB.height;
  const isPortraitWP = images.WP.width <= images.WP.height;
  
  const gap = 32; 

  if (isPortraitSB && isPortraitWP) {
    const targetWidth = 1200;
    const hSB = (images.SB.height / images.SB.width) * targetWidth;
    const hWP = (images.WP.height / images.WP.width) * targetWidth;
    const innerHeight = Math.max(hSB, hWP);

    canvas.width = (targetWidth * 2) + (gap * 3);
    canvas.height = innerHeight + (gap * 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    ctx.drawImage(images.SB, gap, gap + (innerHeight - hSB) / 2, targetWidth, hSB);
    ctx.drawImage(images.WP, (gap * 2) + targetWidth, gap + (innerHeight - hWP) / 2, targetWidth, hWP);
    
  } else {
    const targetWidth = 1600;
    const hSB = (images.SB.height / images.SB.width) * targetWidth;
    const hWP = (images.WP.height / images.WP.width) * targetWidth;
    
    canvas.width = targetWidth + (gap * 2);
    canvas.height = hSB + hWP + (gap * 3);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(images.SB, gap, gap, targetWidth, hSB);
    ctx.drawImage(images.WP, gap, (gap * 2) + hSB, targetWidth, hWP);
  }

  return canvas.toDataURL('image/jpeg', 0.92); 
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
    const payload = {
      nama_pekerjaan: document.getElementById('nama_pekerjaan').value,
      tanggal_pekerjaan: document.getElementById('tanggal_pekerjaan').value,
      lokasi: document.getElementById('lokasi').value,
      tim_pelaksana: document.getElementById('tim_pelaksana').value,
      pengawas_k3: document.getElementById('pengawas_k3').value,
      pengawas_pekerjaan: document.getElementById('pengawas_pekerjaan').value,
      jumlah_pelaksana: document.getElementById('jumlah_pelaksana').value,
      foto_collage: generateCollage()
    };

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