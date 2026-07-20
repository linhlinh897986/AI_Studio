# ==============================================================================
# VIGEN AIO STUDIO - GOOGLE COLAB SERVER FOR VIENEU-TTS (ASYNC TASK SUPPORT)
# ==============================================================================
# Hướng dẫn chạy trên Google Colab:
# 1. Truy cập https://colab.research.google.com và tạo một Notebook mới.
# 2. Thay đổi môi trường chạy (Runtime) thành GPU T4 (hoặc chọn GPU bất kỳ để tăng tốc).
# 3. Chạy các lệnh cài đặt sau trong một ô mã nguồn (Code cell):
#    !pip install flask vieneu torch onnxruntime-gpu
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
from flask import Flask, request, send_file, jsonify

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

# Tải mô hình VieNeu-TTS
print("Đang khởi tạo mô hình VieNeu-TTS...")
try:
    from vieneu import Vieneu
    tts = Vieneu()
    print("Khởi tạo mô hình VieNeu-TTS thành công!")
except Exception as e:
    print(f"LỖI khởi tạo mô hình VieNeu-TTS: {str(e)}")
    print("Vui lòng đảm bảo đã chạy: pip install flask vieneu torch onnxruntime-gpu")

@app.route('/upload_ref', methods=['POST'])
def upload_ref():
    if 'file' not in request.files:
        return jsonify({"error": "Không tìm thấy trường 'file' trong request."}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Không có tệp tin nào được chọn."}), 400
    
    file_path = os.path.join(TEMP_DIR, f"vieneu_ref_{os.urandom(4).hex()}.wav")
    file.save(file_path)
    print(f"[VieNeu] Đã lưu tệp mẫu: {file_path}")
    return jsonify({"ref_path": file_path})

@app.route('/synthesize_async', methods=['POST'])
def synthesize_async():
    cleanup_old_tasks()
    text = request.form.get('text', '')
    voice = request.form.get('voice', '')
    ref_path = request.form.get('ref_path', '')
    
    if not text:
        return jsonify({"error": "Tham số 'text' không được để trống."}), 400
        
    ref_audio_file = None
    if ref_path and os.path.exists(ref_path):
        ref_audio_file = ref_path
    elif 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            ref_audio_file = os.path.join(TEMP_DIR, f"vieneu_ref_{os.urandom(4).hex()}.wav")
            file.save(ref_audio_file)

    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": "processing",
        "output_path": None,
        "error": None,
        "created_at": time.time()
    }

    def run_synthesis_job(tid, txt, v_name, r_file):
        output_path = os.path.join(TEMP_DIR, f"vieneu_out_{tid}.wav")
        print(f"[VieNeu Async Task {tid}] Bắt đầu tổng hợp. Văn bản: '{txt[:50]}...'")
        try:
            if r_file:
                audio = tts.infer(text=txt, ref_audio=r_file)
            elif v_name:
                audio = tts.infer(text=txt, voice=v_name)
            else:
                audio = tts.infer(text=txt)
                
            tts.save(audio, output_path)
            print(f"[VieNeu Async Task {tid}] Hoàn thành -> {output_path}")

            drive_info = {}
            if os.path.exists("/content/drive/MyDrive"):
                try:
                    gdrive_dir = "/content/drive/MyDrive/ViGen_AIO_Audio"
                    os.makedirs(gdrive_dir, exist_ok=True)
                    gdrive_path = os.path.join(gdrive_dir, f"vieneu_out_{tid}.wav")
                    import shutil
                    shutil.copy2(output_path, gdrive_path)
                    print(f"[VieNeu Async Task {tid}] ✅ Đã tự động sao chép sang Google Drive: {gdrive_path}")
                    drive_info["gdrive_path"] = gdrive_path

                    # Try to fetch file ID and set public permission automatically
                    try:
                        from googleapiclient.discovery import build
                        from google.colab import auth
                        auth.authenticate_user()
                        drive_service = build('drive', 'v3')
                        filename = f"vieneu_out_{tid}.wav"
                        results = drive_service.files().list(q=f"name='{filename}' and trashed=false", fields="files(id, name)").execute()
                        items = results.get('files', [])
                        if items:
                            file_id = items[0]['id']
                            drive_service.permissions().create(fileId=file_id, body={'type': 'anyone', 'role': 'reader'}).execute()
                            print(f"[Google Drive API] ✅ Đã tự động kích hoạt quyền công khai link cho tệp ID: {file_id}")
                            drive_info["drive_file_id"] = file_id
                    except Exception as pe:
                        print(f"[Google Drive Auto-Perm Note]: Thư mục ViGen_AIO_Audio thừa hưởng quyền chia sẻ ({pe})")
                except Exception as de:
                    print(f"[Google Drive Save Warning]: {de}")

            tasks[tid]["status"] = "completed"
            tasks[tid]["output_path"] = output_path
            tasks[tid]["file_size"] = os.path.getsize(output_path) if os.path.exists(output_path) else 0
            tasks[tid]["drive_info"] = drive_info
        except Exception as e:
            import traceback
            traceback.print_exc()
            tasks[tid]["status"] = "error"
            tasks[tid]["error"] = str(e)

    threading.Thread(target=run_synthesis_job, args=(task_id, text, voice, ref_audio_file), daemon=True).start()
    return jsonify({"task_id": task_id, "status": "processing"})

@app.route('/status/<task_id>', methods=['GET'])
def get_status(task_id):
    if task_id not in tasks:
        return jsonify({"error": "Task ID không tồn tại hoặc đã hết hạn."}), 404
    info = tasks[task_id]
    return jsonify({
        "task_id": task_id,
        "status": info["status"],
        "file_size": info.get("file_size", 0),
        "error": info.get("error"),
        "drive_info": info.get("drive_info", {})
    })

@app.route('/download/<task_id>', methods=['GET'])
def download_result(task_id):
    if task_id not in tasks:
        return jsonify({"error": "Task ID không tồn tại hoặc đã hết hạn."}), 404
    info = tasks[task_id]
    if info["status"] != "completed" or not info.get("output_path") or not os.path.exists(info["output_path"]):
        return jsonify({"error": f"Tệp âm thanh chưa sẵn sàng hoặc bị lỗi: {info.get('error')}"}), 400
    return send_file(info["output_path"], mimetype="audio/wav")

@app.route('/delete/<task_id>', methods=['POST', 'DELETE', 'GET'])
def delete_task_file(task_id):
    info = tasks.pop(task_id, {})
    deleted_files = []
    
    if info.get("output_path") and os.path.exists(info["output_path"]):
        try:
            os.remove(info["output_path"])
            deleted_files.append(info["output_path"])
        except Exception as e:
            print(f"[Delete Error]: {e}")

    drive_info = info.get("drive_info", {})
    if drive_info.get("gdrive_path") and os.path.exists(drive_info["gdrive_path"]):
        try:
            os.remove(drive_info["gdrive_path"])
            deleted_files.append(drive_info["gdrive_path"])
            print(f"[Google Drive Cleanup] Đã tự động dọn dẹp tệp trên Drive: {drive_info['gdrive_path']}")
        except Exception as e:
            print(f"[Google Drive Delete Error]: {e}")

    return jsonify({"success": True, "deleted": deleted_files})

@app.route('/synthesize', methods=['POST'])
def synthesize():
    text = request.form.get('text', '')
    voice = request.form.get('voice', '')
    ref_path = request.form.get('ref_path', '')
    
    if not text:
        return jsonify({"error": "Tham số 'text' không được để trống."}), 400
        
    ref_audio_file = None
    if ref_path and os.path.exists(ref_path):
        ref_audio_file = ref_path
    elif 'file' in request.files:
        file = request.files['file']
        if file.filename != '':
            ref_audio_file = os.path.join(TEMP_DIR, f"vieneu_ref_{os.urandom(4).hex()}.wav")
            file.save(ref_audio_file)
            
    output_path = os.path.join(TEMP_DIR, f"vieneu_out_{os.urandom(4).hex()}.wav")
    print(f"[VieNeu] Bắt đầu tổng hợp giọng nói. Văn bản: '{text[:50]}...'")
    
    try:
        if ref_audio_file:
            audio = tts.infer(text=text, ref_audio=ref_audio_file)
        elif voice:
            audio = tts.infer(text=text, voice=voice)
        else:
            audio = tts.infer(text=text)
            
        tts.save(audio, output_path)
        return send_file(output_path, mimetype="audio/wav")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Cấu hình Ngrok AuthToken (Tùy chọn - Tốc độ nhanh & Ổn định nhất)
NGROK_AUTHTOKEN = ""  # Dán NGROK Authtoken của bạn vào giữa cặp dấu ngoặc kép (Ví dụ: "2abc123...XYZ")

def start_tunnel():
    authtoken = NGROK_AUTHTOKEN.strip()
    if authtoken:
        print("\n⚡ Phát hiện Ngrok Authtoken! Đang khởi động đường truyền Ngrok...")
        try:
            subprocess.run(["pip", "install", "-q", "pyngrok"])
            from pyngrok import ngrok
            ngrok.set_auth_token(authtoken)
            tunnel = ngrok.connect(39828)
            public_url = tunnel.public_url
            if public_url.startswith("http://"):
                public_url = public_url.replace("http://", "https://")
            print("\n" + "="*55)
            print(f" 🚀 LIÊN KẾT ĐƯỜNG TRUYỀN NGROK CỦA BẠN (ƯU TIÊN):")
            print(f" {public_url}")
            print("="*55 + "\n")
            print("Hãy sao chép liên kết Ngrok trên dán vào tab Cài Đặt của ViGen AIO.")
            return
        except Exception as ne:
            print(f"⚠️ Khởi tạo Ngrok thất bại ({ne}). Đang tự động chuyển sang Cloudflare Tunnel...")

    print("\n🌐 Đang cài đặt và khởi tạo đường truyền Cloudflare Tunnel...")
    subprocess.run(["wget", "-q", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"])
    subprocess.run(["dpkg", "-i", "cloudflared-linux-amd64.deb"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    proc = subprocess.Popen(
        ["cloudflared", "tunnel", "--url", "http://127.0.0.1:39828"], 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, 
        text=True
    )
    
    for _ in range(30):
        time.sleep(1)
        line = proc.stdout.readline()
        if "trycloudflare.com" in line:
            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            if match:
                tunnel_url = match.group(0)
                print("\n" + "="*55)
                print(f" 🌐 LIÊN KẾT ĐƯỜNG TRUYỀN CLOUDFLARE CỦA BẠN:")
                print(f" {tunnel_url}")
                print("="*55 + "\n")
                print("Hãy sao chép liên kết trên dán vào tab Cài Đặt của ViGen AIO.")
                break

if __name__ == '__main__':
    threading.Thread(target=start_tunnel, daemon=True).start()
    print("Đang khởi chạy Flask server trên cổng 39828...")
    app.run(port=39828, host='0.0.0.0')
