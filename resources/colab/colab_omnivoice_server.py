# ==============================================================================
# VIGEN AIO STUDIO - GOOGLE COLAB SERVER FOR OMNIVOICE (ASYNC TASK SUPPORT)
# ==============================================================================
# Hướng dẫn chạy trên Google Colab:
# 1. Truy cập https://colab.research.google.com và tạo một Notebook mới.
# 2. Thay đổi môi trường chạy (Runtime) thành GPU T4 (hoặc chọn GPU bất kỳ để tăng tốc).
# 3. Chạy các lệnh cài đặt sau trong một ô mã nguồn (Code cell):
#    !pip install flask omnivoice torch
# 4. Tải tệp này lên Colab hoặc sao chép toàn bộ mã nguồn phía dưới dán vào ô Code mới.
# 5. Chạy ô Code chứa mã nguồn này. Hệ thống sẽ tự động khởi chạy máy chủ và tạo 
#    đường dẫn Cloudflare Tunnel (trycloudflare.com).
# 6. Sao chép đường dẫn `https://xxxx.trycloudflare.com` dán vào trường 
#    "Google Colab / Local API URL" trong Cài Đặt Hệ Thống của ứng dụng ViGen AIO.
# ==============================================================================

import os
import re
import time
import uuid
import tempfile
import threading
import subprocess
import torch
import torchaudio
from flask import Flask, request, send_file, jsonify

def save_audio_file(audio, output_path):
    if isinstance(audio, tuple):
        audio_data, sr = audio[0], audio[1]
    else:
        audio_data, sr = audio, 24000
    
    if isinstance(audio_data, torch.Tensor):
        audio_tensor = audio_data.detach().cpu()
    elif isinstance(audio_data, list):
        audio_tensor = torch.tensor(audio_data, dtype=torch.float32)
    elif hasattr(audio_data, '__array__'):
        audio_tensor = torch.from_numpy(audio_data).float()
    else:
        audio_tensor = torch.tensor(audio_data, dtype=torch.float32)

    if audio_tensor.dim() == 1:
        audio_tensor = audio_tensor.unsqueeze(0)

    torchaudio.save(output_path, audio_tensor, sr)

# Khởi tạo Flask app
app = Flask(__name__)
TEMP_DIR = tempfile.gettempdir()

# Task Queue Manager cho Asynchronous Processing
tasks = {}

def cleanup_old_tasks():
    now = time.time()
    for tid in list(tasks.keys()):
        if now - tasks[tid].get("created_at", 0) > 3600: # 1 hour TTL
            task_info = tasks.pop(tid, None)
            if task_info and task_info.get("output_path") and os.path.exists(task_info["output_path"]):
                try:
                    os.remove(task_info["output_path"])
                except Exception:
                    pass

# Tải mô hình OmniVoice
print("Đang khởi tạo mô hình OmniVoice...")
try:
    import torch
    from omnivoice import OmniVoice
    
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    
    print(f"Loading OmniVoice on device: {device}...")
    model = OmniVoice.from_pretrained(
        "k2-fsa/OmniVoice", 
        device_map=device, 
        dtype=dtype
    )
    print("Khởi tạo mô hình OmniVoice thành công!")
except Exception as e:
    print(f"LỖI khởi tạo mô hình OmniVoice: {str(e)}")
    print("Vui lòng đảm bảo đã chạy: pip install flask omnivoice torch")

@app.route('/upload_ref', methods=['POST'])
def upload_ref():
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy trường 'file' trong request."}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Không có tệp tin nào được chọn."}), 400
    
    file_path = os.path.join(TEMP_DIR, f"omnivoice_ref_{os.urandom(4).hex()}.wav")
    file.save(file_path)
    print(f"[OmniVoice] Đã lưu tệp mẫu: {file_path}")
    return jsonify({"ref_path": file_path})

@app.route('/synthesize_async', methods=['POST'])
def synthesize_async():
    cleanup_old_tasks()
    text = request.form.get('text', '')
    ref_path = request.form.get('ref_path', '')
    num_step = request.form.get('num_step', 32)
    guidance_scale = request.form.get('guidance_scale', 2.5)
    
    try:
        num_step = int(num_step)
        guidance_scale = float(guidance_scale)
    except ValueError:
        num_step = 32
        guidance_scale = 2.5
    
    if not text:
        return jsonify({"error": "Tham số 'text' không được để trống."}), 400
        
    ref_audio_file = None
    if ref_path and os.path.exists(ref_path):
        ref_audio_file = ref_path
    elif 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            ref_audio_file = os.path.join(TEMP_DIR, f"omnivoice_ref_{os.urandom(4).hex()}.wav")
            file.save(ref_audio_file)
            
    if not ref_audio_file:
        return jsonify({"error": "Chưa cung cấp tệp âm thanh mẫu (.wav) để clone giọng."}), 400

    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": "processing",
        "output_path": None,
        "error": None,
        "created_at": time.time()
    }

    def run_synthesis_job(tid, txt, r_file):
        output_path = os.path.join(TEMP_DIR, f"omnivoice_out_{tid}.wav")
        print(f"[OmniVoice Async Task {tid}] Bắt đầu tổng hợp. Văn bản: '{txt[:50]}...'")
        try:
            try:
                audio = model.generate(text=txt, ref_audio=r_file)
            except Exception as ve:
                if "preprocess_prompt" in str(ve):
                    print("[OmniVoice] Thử lại với preprocess_prompt=False...")
                    audio = model.generate(text=txt, ref_audio=r_file, preprocess_prompt=False)
                else:
                    raise ve
            save_audio_file(audio, output_path)
            print(f"[OmniVoice Async Task {tid}] Hoàn thành -> {output_path}")
            tasks[tid]["status"] = "completed"
            tasks[tid]["output_path"] = output_path
        except Exception as e:
            import traceback
            traceback.print_exc()
            tasks[tid]["status"] = "error"
            tasks[tid]["error"] = str(e)

    threading.Thread(target=run_synthesis_job, args=(task_id, text, ref_audio_file), daemon=True).start()
    return jsonify({"task_id": task_id, "status": "processing"})

@app.route('/status/<task_id>', methods=['GET'])
def get_status(task_id):
    if task_id not in tasks:
        return jsonify({"error": "Task ID không tồn tại hoặc đã hết hạn."}), 404
    info = tasks[task_id]
    return jsonify({
        "task_id": task_id,
        "status": info["status"],
        "error": info.get("error")
    })

@app.route('/download/<task_id>', methods=['GET'])
def download_result(task_id):
    if task_id not in tasks:
        return jsonify({"error": "Task ID không tồn tại hoặc đã hết hạn."}), 404
    info = tasks[task_id]
    if info["status"] != "completed" or not info.get("output_path") or not os.path.exists(info["output_path"]):
        return jsonify({"error": f"Tệp âm thanh chưa sẵn sàng hoặc bị lỗi: {info.get('error')}"}), 400
    return send_file(info["output_path"], mimetype="audio/wav")

@app.route('/synthesize', methods=['POST'])
def synthesize():
    text = request.form.get('text', '')
    ref_path = request.form.get('ref_path', '')
    
    if not text:
        return jsonify({"error": "Tham số 'text' không được để trống."}), 400
        
    ref_audio_file = None
    if ref_path and os.path.exists(ref_path):
        ref_audio_file = ref_path
    elif 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            ref_audio_file = os.path.join(TEMP_DIR, f"omnivoice_ref_{os.urandom(4).hex()}.wav")
            file.save(ref_audio_file)
            
    if not ref_audio_file:
        return jsonify({"error": "Chưa cung cấp tệp âm thanh mẫu (.wav) để clone giọng."}), 400
        
    output_path = os.path.join(TEMP_DIR, f"omnivoice_out_{os.urandom(4).hex()}.wav")
    print(f"[OmniVoice] Bắt đầu tổng hợp giọng nói. Văn bản: '{text[:50]}...'")
    
    try:
        audio = model.generate(text=text, ref_audio=ref_audio_file)
        save_audio_file(audio, output_path)
        return send_file(output_path, mimetype="audio/wav")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def start_cloudflare_tunnel():
    print("\nĐang cài đặt Cloudflare Tunnel (cloudflared)...")
    subprocess.run(["wget", "-q", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"])
    subprocess.run(["dpkg", "-i", "cloudflared-linux-amd64.deb"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    print("Đang khởi tạo đường truyền Cloudflare Tunnel...")
    proc = subprocess.Popen(
        ["cloudflared", "tunnel", "--url", "http://127.0.0.1:39828"], 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, 
        text=True
    )
    
    tunnel_url = None
    for _ in range(30):
        time.sleep(1)
        line = proc.stdout.readline()
        if "trycloudflare.com" in line:
            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            if match:
                tunnel_url = match.group(0)
                print("\n" + "="*50)
                print(f" LIÊN KẾT ĐƯỜNG TRUYỀN GOOGLE COLAB CỦA BẠN:")
                print(f" {tunnel_url}")
                print("="*50 + "\n")
                print("Hãy sao chép liên kết trên dán vào tab Cấu Hình của ViGen AIO.")
                break

if __name__ == '__main__':
    threading.Thread(target=start_cloudflare_tunnel, daemon=True).start()
    print("Đang khởi chạy Flask server trên cổng 39828...")
    app.run(port=39828, host='0.0.0.0')
